/**
 * Node lifecycle transition validation — the core state machine for every
 * node's lifecycle.
 *
 * `isValidTransition` checks whether a transition from one lifecycle to
 * another is permitted by the canonical transition matrix.
 *
 * `applyLifecycleTransition` validates and applies a transition to the
 * runtime state, updating the node's `lifecycle`, `promptState`,
 * `allowedActions`, and `updatedAt` fields.
 *
 * All functions are pure: they return a new state object and never mutate
 * the input.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §6-7}
 * @see {@link https://logos-engine/docs/13-prototypes.md §1.2}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	NodeDefinition,
	NodeLifecycle,
	NodeRuntimeState,
	PromptState,
	TransitionEvent,
} from '../contracts/index.js';
import type { NodeId } from '../shared/index.js';
import { nowIso } from '../shared/index.js';
import { getAllowedActions } from './allowed-actions.js';
import { evaluateCompleteness } from './completeness.js';
import { recomputeAllDocumentReadiness } from './document-readiness.js';
import {
	diagnostic,
	type StateEngineResult,
	stateErr,
	stateOk,
} from './types.js';
import type { CanonicalAnswer } from '../contracts/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Canonical answer staleness helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the canonical answer after a lifecycle transition, applying
 * staleness rules (spec §9).
 *
 * - `accepted → active` (reopen): mark stale.
 * - Any → `accepted` (accept): clear stale (user explicitly accepted).
 * - Otherwise: preserve existing answer unchanged.
 */
function computeNextCanonicalAnswer(
	from: NodeLifecycle,
	to: NodeLifecycle,
	current: CanonicalAnswer | null,
): CanonicalAnswer | null {
	if (current === null) return null;

	// Reopening an accepted node → mark stale.
	if (from === 'accepted' && to === 'active') {
		return { ...current, stale: true };
	}

	// Transitioning to accepted → clear stale (user explicitly accepted).
	if (to === 'accepted' && current.stale) {
		return { ...current, stale: false };
	}

	return current;
}

// ═══════════════════════════════════════════════════════════════════════════
// Transition matrix — the single source of truth for valid transitions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The complete lifecycle transition matrix.
 *
 * Each key is a `from` lifecycle; the set contains every valid `to`
 * lifecycle. Derived from the canonical spec §6-7 and prototypes §1.2.
 *
 * "Final" states (`accepted`) cannot transition to `deferred` or `blocked`.
 * "Non-final" states may all transition to `deferred` and `blocked`.
 */
const LIFECYCLE_TRANSITION_MATRIX: Readonly<
	Record<NodeLifecycle, ReadonlySet<NodeLifecycle>>
> = {
	// Accepted is a final state — only `active` (reopen) is allowed.
	accepted: new Set<NodeLifecycle>(['active']),

	active: new Set<NodeLifecycle>([
		'answered',
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	]),

	answered: new Set<NodeLifecycle>([
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	]),

	// Blocked: can auto-resolve to `not_started`, be manually activated,
	// or be deferred.
	blocked: new Set<NodeLifecycle>(['active', 'not_started', 'deferred']),

	// Deferred: can be resumed or blocked by dependencies.
	deferred: new Set<NodeLifecycle>(['active', 'blocked']),

	needs_clarification: new Set<NodeLifecycle>([
		'active',
		'deferred',
		'blocked',
	]),

	needs_refinement: new Set<NodeLifecycle>([
		'active',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	]),

	not_started: new Set<NodeLifecycle>(['active', 'deferred', 'blocked']),

	ready_for_synthesis: new Set<NodeLifecycle>([
		'synthesized',
		'deferred',
		'blocked',
	]),

	synthesized: new Set<NodeLifecycle>([
		'accepted',
		'active',
		'deferred',
		'blocked',
	]),
};

// ═══════════════════════════════════════════════════════════════════════════
// NodeLifecycle helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All 10 lifecycle states as a sorted array — used by tests and exhaustive
 * iteration.
 */
export function allLifecycles(): readonly NodeLifecycle[] {
	return [
		'not_started',
		'active',
		'answered',
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'synthesized',
		'accepted',
		'deferred',
		'blocked',
	] as const;
}

// ═══════════════════════════════════════════════════════════════════════════
// isValidTransition
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check whether a transition from `from` to `to` is valid according to
 * the canonical lifecycle transition matrix.
 *
 * Only transitions explicitly listed in the matrix are valid.
 * Self-transitions (`from === to`) are invalid unless explicitly
 * enumerated in the matrix (currently none are).
 *
 * @param from - The current node lifecycle.
 * @param to   - The desired node lifecycle.
 * @returns `true` if the transition is permitted.
 */
export function isValidTransition(
	from: NodeLifecycle,
	to: NodeLifecycle,
): boolean {
	const allowed = LIFECYCLE_TRANSITION_MATRIX[from];
	return allowed.has(to);
}

// ═══════════════════════════════════════════════════════════════════════════
// Event guard — lifecycle transitions must pair with the correct event
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Events that may accompany a lifecycle transition.
 *
 * Extends the LLM-proposed `TransitionEvent` with user-initiated and
 * system events so the guard can validate the full lifecycle event space.
 */
export type LifecycleTransitionEvent =
	| TransitionEvent
	| 'USER_DEFER'
	| 'USER_ACCEPT'
	| 'USER_REOPEN'
	| 'USER_RESUME'
	| 'USER_SKIP'
	| 'USER_ANSWERED'
	| 'DEPENDENCY_RESOLVED'
	| 'AUTO_EVALUATE';

/**
 * Maps each (from → to) pair to the set of events that may trigger it.
 *
 * Used by `applyLifecycleTransition` to reject transitions paired with
 * an inappropriate event.
 */
const TRANSITION_EVENT_MAP: ReadonlyMap<
	string,
	ReadonlySet<LifecycleTransitionEvent>
> = new Map([
	// not_started transitions
	[
		'not_started→active',
		new Set<LifecycleTransitionEvent>(['ASKED_INITIAL', 'USER_ANSWERED']),
	],
	[
		'not_started→deferred',
		new Set<LifecycleTransitionEvent>(['USER_SKIP', 'USER_DEFER']),
	],
	['not_started→blocked', new Set<LifecycleTransitionEvent>(['NODE_BLOCKED'])],

	// active transitions
	[
		'active→answered',
		new Set<LifecycleTransitionEvent>([
			'USER_ANSWER_EVALUATED',
			'USER_ANSWERED',
			'AUTO_EVALUATE',
		]),
	],
	[
		'active→needs_clarification',
		new Set<LifecycleTransitionEvent>([
			'CLARIFICATION_REQUESTED',
			'AUTO_EVALUATE',
		]),
	],
	[
		'active→needs_refinement',
		new Set<LifecycleTransitionEvent>([
			'REFINEMENT_REQUESTED',
			'AUTO_EVALUATE',
		]),
	],
	[
		'active→ready_for_synthesis',
		new Set<LifecycleTransitionEvent>([
			'USER_ANSWER_EVALUATED',
			'AUTO_EVALUATE',
		]),
	],
	['active→deferred', new Set<LifecycleTransitionEvent>(['USER_DEFER'])],
	['active→blocked', new Set<LifecycleTransitionEvent>(['NODE_BLOCKED'])],

	// answered transitions
	[
		'answered→needs_clarification',
		new Set<LifecycleTransitionEvent>([
			'CLARIFICATION_REQUESTED',
			'AUTO_EVALUATE',
		]),
	],
	[
		'answered→needs_refinement',
		new Set<LifecycleTransitionEvent>([
			'REFINEMENT_REQUESTED',
			'AUTO_EVALUATE',
		]),
	],
	[
		'answered→ready_for_synthesis',
		new Set<LifecycleTransitionEvent>(['SYNTHESIS_PROPOSED', 'AUTO_EVALUATE']),
	],
	['answered→deferred', new Set<LifecycleTransitionEvent>(['USER_DEFER'])],
	['answered→blocked', new Set<LifecycleTransitionEvent>(['NODE_BLOCKED'])],

	// needs_clarification transitions
	[
		'needs_clarification→active',
		new Set<LifecycleTransitionEvent>(['USER_ANSWERED', 'AUTO_EVALUATE']),
	],
	[
		'needs_clarification→deferred',
		new Set<LifecycleTransitionEvent>(['USER_DEFER']),
	],
	[
		'needs_clarification→blocked',
		new Set<LifecycleTransitionEvent>(['NODE_BLOCKED']),
	],

	// needs_refinement transitions
	[
		'needs_refinement→active',
		new Set<LifecycleTransitionEvent>(['USER_ANSWERED', 'AUTO_EVALUATE']),
	],
	[
		'needs_refinement→ready_for_synthesis',
		new Set<LifecycleTransitionEvent>(['SYNTHESIS_PROPOSED', 'AUTO_EVALUATE']),
	],
	[
		'needs_refinement→deferred',
		new Set<LifecycleTransitionEvent>(['USER_DEFER']),
	],
	[
		'needs_refinement→blocked',
		new Set<LifecycleTransitionEvent>(['NODE_BLOCKED']),
	],

	// ready_for_synthesis transitions
	[
		'ready_for_synthesis→synthesized',
		new Set<LifecycleTransitionEvent>(['SYNTHESIS_PROPOSED', 'AUTO_EVALUATE']),
	],
	[
		'ready_for_synthesis→deferred',
		new Set<LifecycleTransitionEvent>(['USER_DEFER']),
	],
	[
		'ready_for_synthesis→blocked',
		new Set<LifecycleTransitionEvent>(['NODE_BLOCKED']),
	],

	// synthesized transitions
	['synthesized→accepted', new Set<LifecycleTransitionEvent>(['USER_ACCEPT'])],
	['synthesized→active', new Set<LifecycleTransitionEvent>(['USER_REOPEN'])],
	['synthesized→deferred', new Set<LifecycleTransitionEvent>(['USER_DEFER'])],
	['synthesized→blocked', new Set<LifecycleTransitionEvent>(['NODE_BLOCKED'])],

	// accepted transitions
	['accepted→active', new Set<LifecycleTransitionEvent>(['USER_REOPEN'])],

	// deferred transitions
	['deferred→active', new Set<LifecycleTransitionEvent>(['USER_RESUME'])],
	['deferred→blocked', new Set<LifecycleTransitionEvent>(['NODE_BLOCKED'])],

	// blocked transitions
	[
		'blocked→active',
		new Set<LifecycleTransitionEvent>(['DEPENDENCY_RESOLVED']),
	],
	[
		'blocked→not_started',
		new Set<LifecycleTransitionEvent>(['DEPENDENCY_RESOLVED']),
	],
	['blocked→deferred', new Set<LifecycleTransitionEvent>(['USER_DEFER'])],
]);

/**
 * Validate that a lifecycle transition is paired with the correct event.
 *
 * Every transition must be paired with an event that explains why the
 * transition occurred. Missing or wrong events are rejected.
 *
 * @returns `true` if the event is valid for the transition.
 */
function isValidEventForTransition(
	from: NodeLifecycle,
	to: NodeLifecycle,
	event: LifecycleTransitionEvent | undefined,
): boolean {
	if (event === undefined) {
		return false; // Event is required — no internal bypass.
	}
	const key = `${from}→${to}`;
	const allowed = TRANSITION_EVENT_MAP.get(key);
	return allowed?.has(event) ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Prompt state calculation — local duplicate of lifecycleToPromptState
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map a node lifecycle to its default prompt state.
 *
 * This is intentionally duplicated from `node-selection.ts` to avoid
 * coupling between selection and lifecycle modules. If this mapping
 * appears in more than two places, extract it to a shared helper.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §1.3}
 */
function lifecycleToPromptState(lifecycle: NodeLifecycle): PromptState {
	const map: Record<NodeLifecycle, PromptState> = {
		accepted: 'accepted',
		active: 'follow_up',
		answered: 'follow_up',
		blocked: 'blocked',
		deferred: 'blocked', // deferred nodes have no active prompt; 'blocked' is the closest sentinel
		needs_clarification: 'clarification',
		needs_refinement: 'refinement',
		not_started: 'initial',
		ready_for_synthesis: 'synthesis',
		synthesized: 'review',
	};
	return map[lifecycle];
}

// ═══════════════════════════════════════════════════════════════════════════
// applyLifecycleTransition
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for `applyLifecycleTransition`.
 */
export type ApplyLifecycleTransitionOptions = {
	/**
	 * The event that triggered this transition.
	 *
	 * Required. Every lifecycle transition must be paired with an event
	 * that explains why the transition occurred.
	 */
	readonly event: LifecycleTransitionEvent;

	/**
	 * The node's static definition from the profile.
	 *
	 * Required when transitioning to `ready_for_synthesis` so the
	 * completeness guard can evaluate whether the conversation covers
	 * all required topics with sufficient specificity.
	 *
	 * Optional for all other transitions.
	 */
	readonly nodeDef?: NodeDefinition;

	/**
	 * The loaded profile.
	 *
	 * When provided, document readiness is recomputed after every
	 * successful lifecycle transition. This keeps `documentStates`
	 * in sync with node lifecycle changes (e.g., accept, reopen)
	 * without requiring callers to manually recompute readiness.
	 *
	 * Optional for callers that do not need document state updates.
	 */
	readonly profile?: LogosProfile;
};

/** Diagnostic codes for lifecycle transition errors. */
const DIAG_INVALID_TRANSITION = 'LOGOS_STATE_INVALID_LIFECYCLE_TRANSITION';
const DIAG_WRONG_EVENT = 'LOGOS_STATE_WRONG_TRANSITION_EVENT';
const DIAG_MISSING_EVENT = 'LOGOS_STATE_MISSING_TRANSITION_EVENT';
const DIAG_UNRESOLVED_BLOCKERS = 'LOGOS_STATE_UNRESOLVED_BLOCKERS';
const DIAG_INCOMPLETE_FOR_SYNTHESIS = 'LOGOS_STATE_INCOMPLETE_FOR_SYNTHESIS';
const DIAG_MISSING_NODE_DEF = 'LOGOS_STATE_MISSING_NODE_DEF_FOR_SYNTHESIS';
const DIAG_NO_ACTIVE_NODE_OVERRIDE =
	'LOGOS_STATE_CANNOT_APPLY_LIFECYCLE_TRANSITION_TO_NON_EXISTENT_NODE';

/**
 * Validate and apply a lifecycle transition to a node.
 *
 * Guards (evaluated in order):
 * 1. The node must exist in `state.nodeStates`.
 * 2. The transition must be valid per `LIFECYCLE_TRANSITION_MATRIX`.
 * 3. An event must be supplied (`options.event`).
 * 4. The event must be appropriate for the (from → to) pair.
 * 5. For `blocked → active` or `blocked → not_started`, all
 *    dependencies must be resolved (`blockedBy` is empty).
 * 6. For `→ ready_for_synthesis`, `options.nodeDef` is required and
 *    the node must pass `evaluateCompleteness` with `complete: true`.
 *
 * Effects:
 * - Updates `node.lifecycle` to `newLifecycle`.
 * - Recomputes `node.promptState` via `lifecycleToPromptState`.
 * - Recomputes `node.allowedActions` via `getAllowedActions`.
 * - Updates `node.updatedAt` and `state.updatedAt` to the current time.
 *
 * @param state        - The current runtime state (not mutated).
 * @param nodeId       - The ID of the node to transition.
 * @param newLifecycle - The target lifecycle.
 * @param options      - Required configuration.
 * @param options.event - The event that triggered this transition
 *   (validated against the event map).
 * @returns A new `LogosRuntimeState` on success, or an error result with
 *   diagnostics.
 */
export function applyLifecycleTransition(
	state: LogosRuntimeState,
	nodeId: NodeId,
	newLifecycle: NodeLifecycle,
	options?: ApplyLifecycleTransitionOptions,
): StateEngineResult {
	// ── Guard 1: node must exist ────────────────────────────────────
	const nodeState: NodeRuntimeState | undefined = state.nodeStates[nodeId];
	if (!nodeState) {
		return stateErr(
			`Cannot apply lifecycle transition to non-existent node "${nodeId}"`,
			[
				diagnostic(
					DIAG_NO_ACTIVE_NODE_OVERRIDE,
					`Node "${nodeId}" does not exist in the current runtime state.`,
					'error',
					nodeId,
				),
			],
		);
	}

	const from: NodeLifecycle = nodeState.lifecycle;

	// ── Guard 2: transition must be valid ────────────────────────────
	if (!isValidTransition(from, newLifecycle)) {
		return stateErr(
			`Invalid lifecycle transition: "${from}" → "${newLifecycle}" is not allowed`,
			[
				diagnostic(
					DIAG_INVALID_TRANSITION,
					`Cannot transition node "${nodeId}" from "${from}" to "${newLifecycle}". ` +
						'This transition is not permitted by the lifecycle state machine.',
					'error',
					nodeId,
				),
			],
		);
	}

	// ── Guard 3: event must be supplied ──────────────────────────────
	const event = options?.event;
	if (event === undefined) {
		return stateErr(
			`Lifecycle transition "${from}" → "${newLifecycle}" requires an event`,
			[
				diagnostic(
					DIAG_MISSING_EVENT,
					`Node "${nodeId}" transition from "${from}" to "${newLifecycle}" ` +
						'was attempted without a triggering event. Every lifecycle transition must be paired with an event.',
					'error',
					nodeId,
				),
			],
		);
	}

	// ── Guard 4: event must be correct for this transition ───────────
	if (!isValidEventForTransition(from, newLifecycle, event)) {
		return stateErr(
			`Lifecycle transition "${from}" → "${newLifecycle}" cannot be triggered by event "${event}"`,
			[
				diagnostic(
					DIAG_WRONG_EVENT,
					`Node "${nodeId}" transition from "${from}" to "${newLifecycle}" ` +
						`is not valid for event "${event}".`,
					'error',
					nodeId,
				),
			],
		);
	}

	// ── Guard 5: blocked → active/not_started requires no blockers ───
	if (
		from === 'blocked' &&
		(newLifecycle === 'active' || newLifecycle === 'not_started')
	) {
		const unresolved = nodeState.dependencies.blockedBy;
		if (unresolved.length > 0) {
			return stateErr(
				`Cannot transition from "blocked" to "${newLifecycle}": node has unresolved blockers`,
				[
					diagnostic(
						DIAG_UNRESOLVED_BLOCKERS,
						`Node "${nodeId}" cannot leave "blocked" because dependencies ` +
							`are still blocked: ${unresolved.join(', ')}.`,
						'error',
						nodeId,
					),
				],
			);
		}
	}

	// ── Guard 6: ready_for_synthesis requires completeness ──────────
	if (newLifecycle === 'ready_for_synthesis') {
		if (!options?.nodeDef) {
			return stateErr(
				'Cannot transition to "ready_for_synthesis": node definition is required for completeness evaluation',
				[
					diagnostic(
						DIAG_MISSING_NODE_DEF,
						`Node "${nodeId}" cannot transition to "ready_for_synthesis" ` +
							'without a node definition. Provide `options.nodeDef` so the completeness guard can evaluate coverage.',
						'error',
						nodeId,
					),
				],
			);
		}

		const completeness = evaluateCompleteness(nodeState, options.nodeDef);
		if (!completeness.complete) {
			const reasons: string[] = [];
			if (completeness.missing.length > 0) {
				reasons.push(`missing topics: ${completeness.missing.join(', ')}`);
			}
			if (completeness.weak.length > 0) {
				reasons.push(`weak topics: ${completeness.weak.join(', ')}`);
			}
			if (completeness.blockingIssues.length > 0) {
				reasons.push(`${completeness.blockingIssues.length} blocking issue(s)`);
			}
			return stateErr(
				`Cannot transition to "ready_for_synthesis": node is not complete. ` +
					reasons.join('; '),
				[
					diagnostic(
						DIAG_INCOMPLETE_FOR_SYNTHESIS,
						`Node "${nodeId}" cannot transition to "ready_for_synthesis" ` +
							'because completeness evaluation returned complete: false. ' +
							reasons.join('; '),
						'error',
						nodeId,
					),
				],
			);
		}
	}

	// ── Apply effects ───────────────────────────────────────────────
	const nextPromptState = lifecycleToPromptState(newLifecycle);
	const nextAllowedActions = getAllowedActions(newLifecycle);

	// Re-evaluate completeness when transitioning to ready_for_synthesis
	// so the stored completeness reflects the evaluation that passed the
	// guard above.
	const nextCompleteness =
		newLifecycle === 'ready_for_synthesis' && options?.nodeDef
			? evaluateCompleteness(nodeState, options.nodeDef)
			: nodeState.completeness;

	// ── Staleness rule: reopening an accepted node marks the ───────
	// canonical answer as stale (spec §9).
	// Conversely, transitioning to `accepted` clears the stale flag
	// because the user has explicitly accepted the answer.
	const nextCanonicalAnswer = computeNextCanonicalAnswer(
		from,
		newLifecycle,
		nodeState.canonicalAnswer,
	);

	const updatedNode: NodeRuntimeState = {
		...nodeState,
		allowedActions: nextAllowedActions,
		canonicalAnswer: nextCanonicalAnswer,
		completeness: nextCompleteness,
		lifecycle: newLifecycle,
		promptState: nextPromptState,
		updatedAt: nowIso(),
	};

	let nextState: LogosRuntimeState = {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: updatedNode,
		},
		updatedAt: nowIso(),
	};

	// ── Recompute document readiness ────────────────────────────────
	if (options?.profile) {
		nextState = recomputeAllDocumentReadiness(nextState, options.profile);
	}

	return stateOk(nextState);
}
