/**
 * State engine event dispatch — the single entry point for all state mutations.
 *
 * `dispatch(state, event, profile)` routes events to the appropriate
 * handler, applies guards and effects, recomputes derived state (mode,
 * allowedActions, document readiness), and returns a `StateEngineResult`
 * with a `StateEngineSnapshot` for the TUI.
 *
 * All previous state engine operations are callable through `dispatch`.
 *
 * `dispatch` is a pure function — it returns a new state object and
 * never mutates the input. It has no side effects.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §12}
 * @see {@link https://logos-engine/docs/13-prototypes.md §5.1-5.4}
 */
import type {
	DocumentRuntimeState,
	LogosProfile,
	LogosRuntimeState,
	NodeDefinition,
	NodeDependencyState,
	NodeLifecycle,
	NodeMessage,
	NodeMessageRole,
	NodeRuntimeState,
	PromptState,
	SessionEvent,
} from '../contracts/index.js';
import { buildDependencyGraph } from '../profiles/index.js';
import {
	generateId,
	type NodeId,
	nowIso,
	type SessionId,
} from '../shared/index.js';
import { getAllowedActions } from './allowed-actions.js';
import { evaluateCompleteness } from './completeness.js';
import { recomputeAllDocumentReadiness } from './document-readiness.js';
import { isValidTransition } from './node-lifecycle.js';
import { resolveSessionMode } from './session-mode.js';
import { buildSnapshot } from './snapshot-builder.js';
import {
	diagnostic,
	type LogosEvent,
	type StateDiagnostic,
	type StateEngineResult,
	stateErr,
	stateOk,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_NO_PROFILE = 'LOGOS_DISPATCH_NO_PROFILE';
const DIAG_NO_ACTIVE_NODE = 'LOGOS_DISPATCH_NO_ACTIVE_NODE';
const DIAG_EVENT_NODE_MISMATCH = 'LOGOS_DISPATCH_EVENT_NODE_MISMATCH';
const DIAG_NODE_NOT_IN_PROFILE = 'LOGOS_DISPATCH_NODE_NOT_IN_PROFILE';
const DIAG_INVALID_TRANSITION = 'LOGOS_DISPATCH_INVALID_TRANSITION';
const DIAG_UNKNOWN_EVENT = 'LOGOS_DISPATCH_UNKNOWN_EVENT';
const DIAG_SESSION_EVENT_NOT_IMPL =
	'LOGOS_DISPATCH_SESSION_EVENT_NOT_IMPLEMENTED';
const DIAG_PROFILE_MISMATCH = 'LOGOS_DISPATCH_PROFILE_MISMATCH';
const DIAG_CANNOT_ANSWER_IN_LIFECYCLE =
	'LOGOS_DISPATCH_CANNOT_ANSWER_IN_LIFECYCLE';
const DIAG_ACTIVE_NODE_REMOVED_FROM_PROFILE =
	'LOGOS_DISPATCH_ACTIVE_NODE_REMOVED_FROM_PROFILE';

// ═══════════════════════════════════════════════════════════════════════════
// State patch helper (pure — returns new object)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clone the input state with the given overrides applied.
 *
 * This is the only mutation primitive for `dispatch` — every operation
 * delegates to this helper to guarantee immutability.
 */
function patchState(
	base: LogosRuntimeState,
	overrides: Partial<LogosRuntimeState>,
): LogosRuntimeState {
	return { ...base, ...overrides, updatedAt: nowIso() };
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map a node lifecycle to its default prompt state.
 */
function lifecycleToPromptState(lifecycle: NodeLifecycle): PromptState {
	const map: Record<NodeLifecycle, PromptState> = {
		accepted: 'accepted',
		active: 'follow_up',
		answered: 'follow_up',
		blocked: 'blocked',
		deferred: 'blocked',
		needs_clarification: 'clarification',
		needs_refinement: 'refinement',
		not_started: 'initial',
		ready_for_synthesis: 'synthesis',
		synthesized: 'review',
	};
	return map[lifecycle];
}

/**
 * Compute a `NodeDependencyState` for a node from the dependency graph.
 */
function computeDependencyState(
	nodeId: NodeId,
	state: LogosRuntimeState,
	graph: ReturnType<typeof buildDependencyGraph>,
): NodeDependencyState {
	const requiredNodeIds = graph.getDependencies(nodeId);
	const blockedBy = requiredNodeIds.filter((depId) => {
		const depState = state.nodeStates[depId];
		return !depState || depState.lifecycle !== 'accepted';
	});
	const unlocks = graph.getDependents(nodeId);

	return { blockedBy, requiredNodeIds, unlocks };
}

/**
 * Create a fresh `NodeRuntimeState` for first-time access.
 */
function createNodeRuntimeState(
	nodeId: NodeId,
	lifecycle: NodeLifecycle,
	promptState: PromptState,
	dependencies: NodeDependencyState,
): NodeRuntimeState {
	return {
		allowedActions: [],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies,
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle,
		nodeId,
		promptState,
		updatedAt: nowIso(),
	};
}

/**
 * Find a node definition in the profile by ID.
 */
function findNodeDef(
	profile: LogosProfile,
	nodeId: NodeId,
): NodeDefinition | undefined {
	return profile.nodes.find((n) => n.id === nodeId);
}

/**
 * Guard: an active node must exist and match the event's nodeId.
 */
function guardActiveNode(
	state: LogosRuntimeState,
	eventNodeId: NodeId | null,
): StateEngineResult | null {
	if (eventNodeId === null && state.activeNodeId !== null) {
		// Event has no nodeId but state has an active node — allow
		// (the handler interprets the active node as the target).
		return null;
	}

	if (eventNodeId === null && state.activeNodeId === null) {
		return stateErr('No active node', [
			diagnostic(DIAG_NO_ACTIVE_NODE, 'No active node is selected.', 'error'),
		]);
	}

	if (eventNodeId !== null && state.activeNodeId !== eventNodeId) {
		return stateErr(
			`Event node "${eventNodeId}" does not match active node "${state.activeNodeId}"`,
			[
				diagnostic(
					DIAG_EVENT_NODE_MISMATCH,
					`Event targets node "${eventNodeId}" but "${state.activeNodeId}" is active.`,
					'error',
					eventNodeId,
				),
			],
		);
	}

	return null;
}

/**
 * Guard: the state's selectedProfileId must be non-null and match the
 * provided profile.  Returns `null` on success (guard passes).
 */
function guardProfileMatch(
	state: LogosRuntimeState,
	profile: LogosProfile,
): StateEngineResult | null {
	if (state.selectedProfileId === null) {
		return stateErr('No profile selected', [
			diagnostic(
				DIAG_NO_PROFILE,
				'Select a profile before performing this action.',
				'error',
			),
		]);
	}

	if (state.selectedProfileId !== profile.id) {
		return stateErr(
			`Profile mismatch: state has "${state.selectedProfileId}" but dispatch received "${profile.id}"`,
			[
				diagnostic(
					DIAG_PROFILE_MISMATCH,
					`Selected profile "${state.selectedProfileId}" does not match supplied profile "${profile.id}".`,
					'error',
				),
			],
		);
	}

	return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Event handlers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handle CREATE_SESSION.
 *
 * Returns a fresh idle `LogosRuntimeState` with no profile, no active node,
 * and no node/document state. The profile parameter is ignored.
 */
function handleCreateSession(
	_state: LogosRuntimeState,
	_event: Extract<LogosEvent, { type: 'CREATE_SESSION' }>,
	profile: LogosProfile,
): StateEngineResult {
	const sessionId = generateId() as SessionId;

	const newState: LogosRuntimeState = {
		activeNodeId: null,
		documentStates: {} as Record<string, DocumentRuntimeState>,
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'idle',
		nodeStates: {},
		selectedProfileId: null,
		sessionId,
		updatedAt: nowIso(),
	};

	const snapshot = buildSnapshot(newState, profile, [
		diagnostic('LOGOS_DISPATCH_SESSION_CREATED', 'Session created.', 'info'),
	]);

	return stateOk(newState, snapshot);
}

/**
 * Handle SELECT_PROFILE.
 *
 * Sets `selectedProfileId`, resets node/document states, initializes
 * document states from the profile, and transitions to `structure_overview`.
 */
function handleSelectProfile(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'SELECT_PROFILE' }>,
	profile: LogosProfile,
): StateEngineResult {
	// Guard: the event must reference the provided profile.
	if (event.profileId !== profile.id) {
		return stateErr(
			`Profile mismatch: event references "${event.profileId}" but dispatch received "${profile.id}"`,
			[
				diagnostic(
					DIAG_PROFILE_MISMATCH,
					`Event profile "${event.profileId}" does not match supplied profile "${profile.id}".`,
					'error',
				),
			],
		);
	}

	let nextState = patchState(state, {
		activeNodeId: null,
		documentStates: {} as Record<string, DocumentRuntimeState>,
		lastActiveNodeId: null,
		nodeStates: {},
		selectedProfileId: event.profileId,
	});

	const mode = resolveSessionMode(nextState, profile);
	nextState = patchState(nextState, { mode });
	nextState = recomputeAllDocumentReadiness(nextState, profile);

	const snapshot = buildSnapshot(nextState, profile);

	return stateOk(nextState, snapshot);
}

/**
 * Handle CHANGE_PROFILE.
 *
 * Delegates to the same logic as SELECT_PROFILE — changing profiles
 * always resets node/document runtime state.
 */
function handleChangeProfile(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'CHANGE_PROFILE' }>,
	profile: LogosProfile,
): StateEngineResult {
	return handleSelectProfile(
		state,
		{ profileId: event.profileId, type: 'SELECT_PROFILE' as const },
		profile,
	);
}

/**
 * Handle SELECT_NODE / NODE_SELECTED.
 *
 * Guard: node must exist in the profile's nodes.
 * - First access: initialize `NodeRuntimeState` with `not_started` (or `blocked`).
 * - Re-selection: preserve existing conversation and canonical answer.
 * - Dependencies checked — blocked nodes navigable but open as `blocked`.
 */
function handleSelectNode(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'SELECT_NODE' | 'NODE_SELECTED' }>,
	profile: LogosProfile,
): StateEngineResult {
	// Guard: a profile must be selected and match the provided profile.
	const profileErr = guardProfileMatch(state, profile);
	if (profileErr) return profileErr;

	const nodeDef = findNodeDef(profile, event.nodeId);
	if (!nodeDef) {
		return stateErr(
			`Node "${event.nodeId}" does not exist in profile "${profile.id}"`,
			[
				diagnostic(
					DIAG_NODE_NOT_IN_PROFILE,
					`Node "${event.nodeId}" was not found in profile "${profile.id}".`,
					'error',
					event.nodeId,
				),
			],
		);
	}

	// Build dependency graph from the provided profile
	const graph = buildDependencyGraph(profile);
	const depState = computeDependencyState(event.nodeId, state, graph);

	const existing = state.nodeStates[event.nodeId];

	let nextLifecycle: NodeLifecycle;
	let nextPromptState: PromptState;
	let nextNodeState: NodeRuntimeState;

	if (existing) {
		// Re-selection: preserve existing state
		if (depState.blockedBy.length > 0) {
			nextLifecycle = 'blocked';
			nextPromptState = 'blocked';
		} else if (existing.lifecycle === 'blocked') {
			nextLifecycle = 'not_started';
			nextPromptState = lifecycleToPromptState('not_started');
		} else {
			nextLifecycle = existing.lifecycle;
			nextPromptState = existing.promptState;
		}

		nextNodeState = {
			...existing,
			dependencies: depState,
			lifecycle: nextLifecycle,
			promptState: nextPromptState,
			updatedAt: nowIso(),
		};
	} else {
		// First access
		if (depState.blockedBy.length > 0) {
			nextLifecycle = 'blocked';
			nextPromptState = 'blocked';
		} else {
			nextLifecycle = 'not_started';
			nextPromptState = lifecycleToPromptState('not_started');
		}

		nextNodeState = createNodeRuntimeState(
			event.nodeId,
			nextLifecycle,
			nextPromptState,
			depState,
		);
	}

	let nextState = patchState(state, {
		activeNodeId: event.nodeId,
		lastActiveNodeId: state.activeNodeId,
		nodeStates: {
			...state.nodeStates,
			[event.nodeId]: nextNodeState,
		},
	});

	const mode = resolveSessionMode(nextState, profile);
	nextState = patchState(nextState, { mode });

	const snapshot = buildSnapshot(nextState, profile);

	return stateOk(nextState, snapshot);
}

/**
 * Handle DESELECT_NODE.
 *
 * Clears `activeNodeId`, preserves node state, transitions to
 * `structure_overview`.
 */
function handleDeselectNode(
	state: LogosRuntimeState,
	_event: LogosEvent,
	profile: LogosProfile,
): StateEngineResult {
	let nextState = patchState(state, {
		activeNodeId: null,
		lastActiveNodeId: state.activeNodeId ?? state.lastActiveNodeId,
	});

	const mode = resolveSessionMode(nextState, profile);
	nextState = patchState(nextState, { mode });

	const snapshot = buildSnapshot(nextState, profile);

	return stateOk(nextState, snapshot);
}

/**
 * Handle USER_MESSAGE / USER_MESSAGE_ADDED.
 *
 * Appends a user message to the active node's conversation. Transitions
 * the node lifecycle from `not_started` → `active` or preserves the
 * current lifecycle.
 *
 * Guard: an active node must exist and match the event's nodeId.
 */
function handleUserMessage(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'USER_MESSAGE_ADDED' | 'USER_MESSAGE' }>,
	profile: LogosProfile,
): StateEngineResult {
	// Guard: profile must be selected and match.
	const profileErr = guardProfileMatch(state, profile);
	if (profileErr) return profileErr;

	// Guard: active node must match event node
	const guardErr = guardActiveNode(state, event.nodeId);
	if (guardErr) return guardErr;

	// guardActiveNode ensures activeNodeId is non-null and matches
	const targetNodeId = state.activeNodeId;
	if (targetNodeId === null) {
		return stateErr('No active node selected', [
			diagnostic(DIAG_NO_ACTIVE_NODE, 'No active node is selected.', 'error'),
		]);
	}

	const existingNode = state.nodeStates[targetNodeId];
	if (!existingNode) {
		return stateErr(`Node "${targetNodeId}" has no runtime state`, [
			diagnostic(
				DIAG_NODE_NOT_IN_PROFILE,
				`Node "${targetNodeId}" has no runtime state. Select a node first.`,
				'error',
				targetNodeId,
			),
		]);
	}

	// Build the message
	const messageId = event.messageId ?? generateId();
	const message: NodeMessage = {
		content: event.content,
		createdAt: nowIso(),
		id: messageId,
		role: 'user' as NodeMessageRole,
	};

	// Guard: answer is only allowed in specific lifecycles.
	// blocked, deferred, ready_for_synthesis, synthesized, and accepted
	// cannot accept new user messages.
	const answerAllowed: ReadonlySet<NodeLifecycle> = new Set([
		'not_started',
		'active',
		'answered',
		'needs_clarification',
		'needs_refinement',
	]);

	if (!answerAllowed.has(existingNode.lifecycle)) {
		return stateErr(`Cannot answer in "${existingNode.lifecycle}" lifecycle`, [
			diagnostic(
				DIAG_CANNOT_ANSWER_IN_LIFECYCLE,
				`Node "${targetNodeId}" is in "${existingNode.lifecycle}" lifecycle and cannot accept new answers. ` +
					'Allowed lifecycles: not_started, active, answered, needs_clarification, needs_refinement.',
				'error',
				targetNodeId,
			),
		]);
	}

	// Determine the next lifecycle.
	// Only invariant-safe transitions — the toggle answered↔active is removed
	// because answered→active is not a valid lifecycle transition per Step 3.4.
	const currentLifecycle = existingNode.lifecycle;
	let nextLifecycle: NodeLifecycle;

	switch (currentLifecycle) {
		case 'not_started':
			nextLifecycle = 'active';
			break;

		case 'needs_clarification':
		case 'needs_refinement':
			// User responded to clarification/refinement — go back to active.
			nextLifecycle = 'active';
			break;

		case 'active':
		case 'answered':
			// Preserve current lifecycle — no automatic toggle.
			// The engine will re-evaluate completeness below.
			nextLifecycle = currentLifecycle;
			break;

		default:
			// Exhaustive: allowed set above guarantees we only see
			// not_started|active|answered|needs_clarification|needs_refinement.
			nextLifecycle = currentLifecycle;
	}

	// Validate that any lifecycle change is a valid transition.
	if (nextLifecycle !== currentLifecycle) {
		if (!isValidTransition(currentLifecycle, nextLifecycle)) {
			return stateErr(
				`Invalid lifecycle transition from user message: ${currentLifecycle} → ${nextLifecycle}`,
				[
					diagnostic(
						DIAG_INVALID_TRANSITION,
						`User message on node "${targetNodeId}" would cause invalid transition from "${currentLifecycle}" to "${nextLifecycle}".`,
						'error',
						targetNodeId,
					),
				],
			);
		}
	}

	// ── Step 10.2: evaluate completeness and potentially override lifecycle ──
	//
	// After the user's message is appended, evaluate completeness against
	// the node definition's coverage topics. If the answer is contradictory
	// or ambiguously vague, the engine overrides the base lifecycle:
	//   - blockingIssues (contradictions, ambiguity) → needs_clarification
	//   - weak topics                              → needs_refinement
	//   - missing topics only                      → stay active (normal follow-up)
	//
	// Transitions are validated against the lifecycle matrix to ensure
	// each hop (e.g., active → needs_clarification) is permitted.
	let completeness = existingNode.completeness;

	const nodeDef = profile.nodes.find((n) => n.id === targetNodeId);
	if (nodeDef) {
		// Build a preview of the node with the new message appended.
		const previewNode: NodeRuntimeState = {
			...existingNode,
			conversation: [...existingNode.conversation, message],
			lifecycle: nextLifecycle,
		};

		const comp = evaluateCompleteness(previewNode, nodeDef);
		completeness = comp;

		if (comp.blockingIssues.length > 0) {
			// Contradictions or ambiguity block synthesis.
			if (isValidTransition(nextLifecycle, 'needs_clarification')) {
				nextLifecycle = 'needs_clarification';
			}
		} else if (comp.weak.length > 0) {
			// Weak content needs sharper answers.
			if (isValidTransition(nextLifecycle, 'needs_refinement')) {
				nextLifecycle = 'needs_refinement';
			}
		}
		// If only missing topics → stay active for normal follow-up.
	}

	const nextPromptState = lifecycleToPromptState(nextLifecycle);

	// Compute allowed actions for the new lifecycle
	const allowedActions = getAllowedActions(nextLifecycle);

	const updatedNode: NodeRuntimeState = {
		...existingNode,
		allowedActions,
		completeness,
		conversation: [...existingNode.conversation, message],
		lifecycle: nextLifecycle,
		promptState: nextPromptState,
		updatedAt: nowIso(),
	};

	let nextState = patchState(state, {
		nodeStates: {
			...state.nodeStates,
			[targetNodeId]: updatedNode,
		},
	});

	// Recompute document readiness
	nextState = recomputeAllDocumentReadiness(nextState, profile);

	const snapshot = buildSnapshot(nextState, profile, [
		diagnostic(
			'LOGOS_DISPATCH_USER_MESSAGE_ADDED',
			`User message added to node "${targetNodeId}". ` +
				`Lifecycle: ${currentLifecycle} → ${nextLifecycle}. ` +
				`Completeness: ${completeness.complete ? 'complete' : 'incomplete'} ` +
				`(missing: ${completeness.missing.length}, weak: ${completeness.weak.length}, ` +
				`blocking: ${completeness.blockingIssues.length}).`,
			'info',
			targetNodeId,
		),
	]);

	return stateOk(nextState, snapshot);
}

/**
 * Handle NODE_LIFECYCLE_CHANGED.
 *
 * Validates the transition via `isValidTransition`, applies the new
 * lifecycle, recalculates allowedActions and promptState.
 */
function handleNodeLifecycleChanged(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'NODE_LIFECYCLE_CHANGED' }>,
	profile: LogosProfile,
): StateEngineResult {
	// Guard: profile must be selected and match.
	const profileErr = guardProfileMatch(state, profile);
	if (profileErr) return profileErr;

	const guardErr = guardActiveNode(state, event.nodeId);
	if (guardErr) return guardErr;

	const targetNodeId = state.activeNodeId;
	if (targetNodeId === null) {
		return stateErr('No active node selected', [
			diagnostic(DIAG_NO_ACTIVE_NODE, 'No active node is selected.', 'error'),
		]);
	}

	const existingNode = state.nodeStates[targetNodeId];
	if (!existingNode) {
		return stateErr(`Node "${targetNodeId}" has no runtime state`, [
			diagnostic(
				DIAG_NODE_NOT_IN_PROFILE,
				`Node "${targetNodeId}" has no runtime state.`,
				'error',
				targetNodeId,
			),
		]);
	}

	if (!isValidTransition(existingNode.lifecycle, event.to)) {
		return stateErr(
			`Invalid lifecycle transition: ${existingNode.lifecycle} → ${event.to}`,
			[
				diagnostic(
					DIAG_INVALID_TRANSITION,
					`Transition from "${existingNode.lifecycle}" to "${event.to}" is not allowed.`,
					'error',
					targetNodeId,
				),
			],
		);
	}

	const nextLifecycle = event.to;
	const nextPromptState = lifecycleToPromptState(nextLifecycle);
	const allowedActions = getAllowedActions(nextLifecycle);

	const updatedNode: NodeRuntimeState = {
		...existingNode,
		allowedActions,
		lifecycle: nextLifecycle,
		promptState: nextPromptState,
		updatedAt: nowIso(),
	};

	const diags: StateDiagnostic[] = [
		diagnostic(
			'LOGOS_DISPATCH_LIFECYCLE_CHANGED',
			`Node "${targetNodeId}" lifecycle: ${existingNode.lifecycle} → ${nextLifecycle}.`,
			'info',
			targetNodeId,
		),
	];

	// Mark canonical answer stale if reopening from accepted
	if (
		existingNode.lifecycle === 'accepted' &&
		nextLifecycle === 'active' &&
		existingNode.canonicalAnswer
	) {
		const staleAnswer = {
			...existingNode.canonicalAnswer,
			stale: true as const,
		};
		const updatedNodeStale: NodeRuntimeState = {
			...updatedNode,
			canonicalAnswer: staleAnswer,
		};
		let nextState = patchState(state, {
			nodeStates: {
				...state.nodeStates,
				[targetNodeId]: updatedNodeStale,
			},
		});
		nextState = recomputeAllDocumentReadiness(nextState, profile);

		const snapshot = buildSnapshot(nextState, profile, diags);
		return stateOk(nextState, snapshot);
	}

	let nextState = patchState(state, {
		nodeStates: {
			...state.nodeStates,
			[targetNodeId]: updatedNode,
		},
	});

	nextState = recomputeAllDocumentReadiness(nextState, profile);

	const snapshot = buildSnapshot(nextState, profile, diags);
	return stateOk(nextState, snapshot);
}

/**
 * Handle DEFER_NODE / NODE_DEFERRED.
 *
 * Transitions the active node to `deferred` lifecycle.
 */
function handleDeferNode(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'DEFER_NODE' | 'NODE_DEFERRED' }>,
	profile: LogosProfile,
): StateEngineResult {
	// Guard: profile must be selected and match.
	const profileErr = guardProfileMatch(state, profile);
	if (profileErr) return profileErr;

	const guardErr = guardActiveNode(state, event.nodeId);
	if (guardErr) return guardErr;

	const targetNodeId = state.activeNodeId;
	if (targetNodeId === null) {
		return stateErr('No active node selected', [
			diagnostic(DIAG_NO_ACTIVE_NODE, 'No active node is selected.', 'error'),
		]);
	}

	const existingNode = state.nodeStates[targetNodeId];
	if (!existingNode) {
		return stateErr(`Node "${targetNodeId}" has no runtime state`, [
			diagnostic(
				DIAG_NODE_NOT_IN_PROFILE,
				`Node "${targetNodeId}" has no runtime state.`,
				'error',
				targetNodeId,
			),
		]);
	}

	// Guard: deferred is not a valid transition from accepted (but can still be deferred)
	if (!isValidTransition(existingNode.lifecycle, 'deferred')) {
		return stateErr(
			`Cannot defer node in "${existingNode.lifecycle}" lifecycle`,
			[
				diagnostic(
					DIAG_INVALID_TRANSITION,
					`Transition from "${existingNode.lifecycle}" to "deferred" is not allowed.`,
					'error',
					targetNodeId,
				),
			],
		);
	}

	const nextLifecycle: NodeLifecycle = 'deferred';
	const nextPromptState = lifecycleToPromptState(nextLifecycle);
	const allowedActions = getAllowedActions(nextLifecycle);

	const updatedNode: NodeRuntimeState = {
		...existingNode,
		allowedActions,
		lifecycle: nextLifecycle,
		promptState: nextPromptState,
		updatedAt: nowIso(),
	};

	let nextState = patchState(state, {
		nodeStates: {
			...state.nodeStates,
			[targetNodeId]: updatedNode,
		},
	});

	nextState = recomputeAllDocumentReadiness(nextState, profile);

	const snapshot = buildSnapshot(nextState, profile, [
		diagnostic(
			'LOGOS_DISPATCH_NODE_DEFERRED',
			`Node "${targetNodeId}" deferred.`,
			'info',
			targetNodeId,
		),
	]);

	return stateOk(nextState, snapshot);
}

/**
 * Handle RESUME_NODE.
 *
 * Transitions the active node from `deferred` back to `active`.
 */
function handleResumeNode(
	state: LogosRuntimeState,
	event: Extract<LogosEvent, { type: 'RESUME_NODE' }>,
	profile: LogosProfile,
): StateEngineResult {
	// Guard: profile must be selected and match.
	const profileErr = guardProfileMatch(state, profile);
	if (profileErr) return profileErr;

	const guardErr = guardActiveNode(state, event.nodeId);
	if (guardErr) return guardErr;

	const targetNodeId = state.activeNodeId;
	if (targetNodeId === null) {
		return stateErr('No active node selected', [
			diagnostic(DIAG_NO_ACTIVE_NODE, 'No active node is selected.', 'error'),
		]);
	}

	const existingNode = state.nodeStates[targetNodeId];
	if (!existingNode) {
		return stateErr(`Node "${targetNodeId}" has no runtime state`, [
			diagnostic(
				DIAG_NODE_NOT_IN_PROFILE,
				`Node "${targetNodeId}" has no runtime state.`,
				'error',
				targetNodeId,
			),
		]);
	}

	// Guard: can only resume from deferred or blocked
	if (
		existingNode.lifecycle !== 'deferred' &&
		existingNode.lifecycle !== 'blocked'
	) {
		return stateErr(
			`Cannot resume node in "${existingNode.lifecycle}" lifecycle`,
			[
				diagnostic(
					DIAG_INVALID_TRANSITION,
					`Only deferred or blocked nodes can be resumed. Current: "${existingNode.lifecycle}".`,
					'error',
					targetNodeId,
				),
			],
		);
	}

	const nextLifecycle: NodeLifecycle = 'active';
	const nextPromptState = lifecycleToPromptState(nextLifecycle);
	const allowedActions = getAllowedActions(nextLifecycle);

	const updatedNode: NodeRuntimeState = {
		...existingNode,
		allowedActions,
		lifecycle: nextLifecycle,
		promptState: nextPromptState,
		updatedAt: nowIso(),
	};

	let nextState = patchState(state, {
		nodeStates: {
			...state.nodeStates,
			[targetNodeId]: updatedNode,
		},
	});

	nextState = recomputeAllDocumentReadiness(nextState, profile);

	const snapshot = buildSnapshot(nextState, profile, [
		diagnostic(
			'LOGOS_DISPATCH_NODE_RESUMED',
			`Node "${targetNodeId}" resumed to active.`,
			'info',
			targetNodeId,
		),
	]);

	return stateOk(nextState, snapshot);
}

/**
 * Handle a `SessionEvent` (persisted event stream format).
 *
 * Maps known `SessionEvent` types to their `LogosEvent` equivalents and
 * dispatches accordingly. Unmapped event types return an error.
 */
function handleSessionEvent(
	state: LogosRuntimeState,
	event: SessionEvent,
	profile: LogosProfile,
): StateEngineResult {
	switch (event.type) {
		case 'SESSION_CREATED':
			return handleCreateSession(state, { type: 'CREATE_SESSION' }, profile);

		case 'PROFILE_SELECTED':
			return handleSelectProfile(
				state,
				{
					profileId: event.payload.profileId,
					type: 'SELECT_PROFILE',
				},
				profile,
			);

		case 'PROFILE_CHANGED':
			return handleChangeProfile(
				state,
				{
					profileId: event.payload.newProfileId,
					type: 'CHANGE_PROFILE',
				},
				profile,
			);

		case 'NODE_SELECTED':
			return handleSelectNode(
				state,
				{
					nodeId: event.payload.nodeId,
					type: 'NODE_SELECTED',
				},
				profile,
			);

		case 'USER_MESSAGE_ADDED':
			return handleUserMessage(
				state,
				{
					content: event.payload.content,
					messageId: event.payload.messageId,
					nodeId: event.payload.nodeId,
					type: 'USER_MESSAGE_ADDED',
				},
				profile,
			);

		case 'NODE_LIFECYCLE_CHANGED':
			return handleNodeLifecycleChanged(
				state,
				{
					nodeId: event.payload.nodeId,
					to: event.payload.to,
					type: 'NODE_LIFECYCLE_CHANGED',
				},
				profile,
			);

		case 'NODE_DEFERRED':
			return handleDeferNode(
				state,
				{
					nodeId: event.payload.nodeId,
					type: 'NODE_DEFERRED',
				},
				profile,
			);

		case 'NODE_BLOCKED':
			// NODE_BLOCKED is informational — dispatch as lifecycle transition
			return handleNodeLifecycleChanged(
				state,
				{
					nodeId: event.payload.nodeId,
					to: 'blocked' as NodeLifecycle,
					type: 'NODE_LIFECYCLE_CHANGED',
				},
				profile,
			);

		default:
			return stateErr(
				`Session event "${event.type}" is not yet implemented in dispatch`,
				[
					diagnostic(
						DIAG_SESSION_EVENT_NOT_IMPL,
						`Session event "${event.type}" is defined but not handled by dispatch. This handler will be implemented in Phase 4+.`,
						'warning',
						event.id,
					),
				],
			);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — dispatch
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a state engine event and return an updated state with snapshot.
 *
 * This is the single entry point for all state mutations. Every event
 * passes through guards and deterministic effects before state is modified.
 *
 * `dispatch` is pure: it returns a new state object, never mutates the
 * input, and has no side effects (no filesystem access, no network calls).
 *
 * @param state   - The current runtime state (not mutated).
 * @param event   - A `LogosEvent` command or `SessionEvent` from persistence.
 * @param profile - The loaded `LogosProfile` definition.
 * @returns A `StateEngineResult` with updated state and a `StateEngineSnapshot`.
 *
 * @example
 * ```ts
 * const result = dispatch(state, { type: 'SELECT_NODE', nodeId: 'thesis' }, profile);
 * if (result.ok) {
 *   console.log(result.state.mode);         // "node_focus"
 *   console.log(result.snapshot.mode);       // "node_focus"
 *   console.log(result.snapshot.allowedActions); // ["answer", "skip", "ask_for_example"]
 * }
 * ```
 */
export function dispatch(
	state: LogosRuntimeState,
	event: LogosEvent | SessionEvent,
	profile: LogosProfile,
): StateEngineResult {
	// Detect whether this is a LogosEvent (simple) or SessionEvent (persisted)
	// by checking for the `id` field that SessionEvent always has.
	const isSessionEvent =
		'id' in event && 'sessionId' in event && 'createdAt' in event;

	if (isSessionEvent) {
		return handleSessionEvent(state, event as SessionEvent, profile);
	}

	const logosEvent = event as LogosEvent;

	// ── Pre-dispatch guard: detect node deletion from profile ──────────
	// If the active node was removed from the profile (e.g., profile file
	// was edited externally), clear activeNodeId and surface a diagnostic.
	// Only runs when the state's selected profile matches the supplied
	// profile — profile mismatch is handled by individual event guards.
	if (
		state.activeNodeId !== null &&
		state.selectedProfileId === profile.id &&
		logosEvent.type !== 'CREATE_SESSION' &&
		logosEvent.type !== 'SELECT_PROFILE' &&
		logosEvent.type !== 'CHANGE_PROFILE'
	) {
		const nodeStillExists = profile.nodes.some(
			(n) => n.id === state.activeNodeId,
		);

		if (!nodeStillExists) {
			const removedNodeId = state.activeNodeId;

			// Preserve lastActiveNodeId only if that node still exists.
			const lastStillExists =
				state.lastActiveNodeId !== null &&
				profile.nodes.some((n) => n.id === state.lastActiveNodeId);

			let nextState = patchState(state, {
				activeNodeId: null,
				lastActiveNodeId: lastStillExists ? state.lastActiveNodeId : null,
			});

			const mode = resolveSessionMode(nextState, profile);
			nextState = patchState(nextState, { mode });

			const snapshot = buildSnapshot(nextState, profile, [
				diagnostic(
					DIAG_ACTIVE_NODE_REMOVED_FROM_PROFILE,
					`Active node "${removedNodeId}" was removed from profile "${profile.id}". ` +
						'Navigation has been reset to structure overview.',
					'error',
					removedNodeId,
				),
			]);

			return stateOk(nextState, snapshot);
		}
	}

	switch (logosEvent.type) {
		// Safety: explicitly handle string unions to avoid fallthrough bugs.
		case 'CREATE_SESSION':
			return handleCreateSession(state, logosEvent, profile);

		case 'SELECT_PROFILE':
			return handleSelectProfile(
				state,
				logosEvent as Extract<LogosEvent, { type: 'SELECT_PROFILE' }>,
				profile,
			);

		case 'CHANGE_PROFILE':
			return handleChangeProfile(
				state,
				logosEvent as Extract<LogosEvent, { type: 'CHANGE_PROFILE' }>,
				profile,
			);

		case 'SELECT_NODE':
		case 'NODE_SELECTED':
			return handleSelectNode(
				state,
				logosEvent as Extract<
					LogosEvent,
					{ type: 'SELECT_NODE' | 'NODE_SELECTED' }
				>,
				profile,
			);

		case 'DESELECT_NODE':
			return handleDeselectNode(state, logosEvent, profile);

		case 'USER_MESSAGE_ADDED':
		case 'USER_MESSAGE':
			return handleUserMessage(
				state,
				logosEvent as Extract<
					LogosEvent,
					{ type: 'USER_MESSAGE_ADDED' | 'USER_MESSAGE' }
				>,
				profile,
			);

		case 'NODE_LIFECYCLE_CHANGED':
			return handleNodeLifecycleChanged(
				state,
				logosEvent as Extract<LogosEvent, { type: 'NODE_LIFECYCLE_CHANGED' }>,
				profile,
			);

		case 'DEFER_NODE':
		case 'NODE_DEFERRED':
			return handleDeferNode(
				state,
				logosEvent as Extract<
					LogosEvent,
					{ type: 'DEFER_NODE' | 'NODE_DEFERRED' }
				>,
				profile,
			);

		case 'RESUME_NODE':
			return handleResumeNode(
				state,
				logosEvent as Extract<LogosEvent, { type: 'RESUME_NODE' }>,
				profile,
			);

		default: {
			// Exhaustiveness check — LogosEvent union should have no other members.
			const _exhaustive: never = logosEvent;
			return stateErr(
				`Unknown event type: ${(_exhaustive as LogosEvent).type}`,
				[
					diagnostic(
						DIAG_UNKNOWN_EVENT,
						`Event type "${(_exhaustive as LogosEvent).type}" is not recognized by dispatch.`,
						'error',
					),
				],
			);
		}
	}
}
