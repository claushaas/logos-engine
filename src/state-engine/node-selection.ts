/**
 * Node selection and deselection — primary navigation actions for the state engine.
 *
 * `selectNode` sets `activeNodeId` with all required guards:
 * - Profile must be selected.
 * - Node must exist in the profile's node definitions.
 * - Dependencies are checked — if unmet, the node opens in `blocked` lifecycle.
 * - First access initialises `NodeRuntimeState` with `lifecycle: "not_started"`.
 * - Re-selection preserves existing conversation and canonical answer state.
 *
 * `deselectNode` clears `activeNodeId`, returns to `structure_overview` mode,
 * and updates `lastActiveNodeId` so the user can resume later.
 *
 * All functions are pure: they return a new state object and never mutate
 * the input.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §7}
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §10}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	NodeDependencyState,
	NodeLifecycle,
	NodeRuntimeState,
	PromptState,
} from '../contracts/index.js';
import { buildDependencyGraph, getProfile } from '../profiles/index.js';
import type { NodeId } from '../shared/index.js';
import { nowIso } from '../shared/index.js';
import { resolveSessionMode } from './session-mode.js';
import {
	diagnostic,
	type StateEngineResult,
	stateErr,
	stateOk,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_NO_PROFILE_SELECTED = 'LOGOS_STATE_NO_PROFILE_SELECTED';
const DIAG_NODE_NOT_IN_PROFILE = 'LOGOS_STATE_NODE_NOT_IN_PROFILE';
const DIAG_PROFILE_LOAD_FAILED = 'LOGOS_STATE_PROFILE_LOAD_FAILED';

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a shallow clone of the runtime state with overrides applied.
 *
 * This is the only mutation primitive used by the selection functions.
 * It is intentionally local (not shared with `state-engine.ts`) to avoid
 * circular imports.
 */
function patchState(
	base: LogosRuntimeState,
	overrides: Partial<LogosRuntimeState>,
): LogosRuntimeState {
	return { ...base, ...overrides, updatedAt: nowIso() };
}

/**
 * Map a node lifecycle to its default prompt state.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §1.3}
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

/**
 * Build a fresh `NodeDependencyState` for the given node from the graph.
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
 * Initialise a `NodeRuntimeState` for a node that has never been accessed.
 *
 * Returns a fresh state with empty conversation, no canonical answer,
 * empty completeness/extracted data, and no allowed actions (Step 3.5
 * will compute the action set later).
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

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Select a node for focused conversation.
 *
 * All guards are evaluated in order:
 * 1. Profile must be selected.
 * 2. Node must exist in the profile's `nodes` array.
 * 3. Dependencies are checked — if required dependencies are not yet
 *    `accepted`, the node opens in `blocked` lifecycle (navigation is
 *    still allowed).
 *
 * On first access a fresh `NodeRuntimeState` is initialised with
 * `lifecycle: "not_started"` (or `"blocked"` if dependencies are unmet).
 *
 * On re-selection the existing conversation, canonical answer,
 * completeness, and extracted data are preserved. Only the dependency
 * state is recomputed from the graph, and the lifecycle is adjusted if
 * blockers have appeared or been resolved.
 *
 * @param state   - The current runtime state (not mutated).
 * @param nodeId  - The ID of the node to select.
 * @param options - Optional configuration.
 * @param options.profileDirectory - Directory to scan for profile files
 *   (default: the built-in `profiles/` directory).
 * @returns A new `LogosRuntimeState` with `activeNodeId` set, or an error
 *   result with diagnostics.
 */
export function selectNode(
	state: LogosRuntimeState,
	nodeId: NodeId,
	options?: { profileDirectory?: string },
): StateEngineResult {
	// ── Guard 1: profile must be selected ──────────────────────────
	if (state.selectedProfileId === null) {
		return stateErr('Cannot select a node without a selected profile', [
			diagnostic(
				DIAG_NO_PROFILE_SELECTED,
				'A profile must be selected before selecting a node.',
				'error',
				nodeId,
			),
		]);
	}

	// ── Load profile for node validation and dependency graph ─────
	const profileResult = getProfile(
		state.selectedProfileId,
		options?.profileDirectory,
	);
	if (!profileResult.ok) {
		return stateErr(`Failed to load profile "${state.selectedProfileId}"`, [
			diagnostic(
				DIAG_PROFILE_LOAD_FAILED,
				profileResult.error.userFacingMessage,
				'error',
				state.selectedProfileId,
			),
		]);
	}
	const profile: LogosProfile = profileResult.value;

	// ── Guard 2: node must exist in profile ───────────────────────
	const nodeDef = profile.nodes.find((n) => n.id === nodeId);
	if (!nodeDef) {
		return stateErr(
			`Node "${nodeId}" does not exist in profile "${profile.id}"`,
			[
				diagnostic(
					DIAG_NODE_NOT_IN_PROFILE,
					`Node "${nodeId}" was not found in profile "${profile.id}".`,
					'error',
					nodeId,
				),
			],
		);
	}

	// ── Build dependency graph & compute fresh dependency state ───
	const graph = buildDependencyGraph(profile);
	const depState = computeDependencyState(nodeId, state, graph);

	// ── Resolve lifecycle for this selection ──────────────────────
	const existing = state.nodeStates[nodeId];

	let nextLifecycle: NodeLifecycle;
	let nextPromptState: PromptState;
	let nextNodeState: NodeRuntimeState;

	if (existing) {
		// ── Re-selection: preserve conversation, canonical answer,
		//    completeness, and extracted data.
		if (depState.blockedBy.length > 0) {
			// Dependencies are not met — open as blocked.
			nextLifecycle = 'blocked';
			nextPromptState = 'blocked';
		} else if (existing.lifecycle === 'blocked') {
			// Dependencies are now met — auto-resolve from blocked.
			nextLifecycle = 'not_started';
			nextPromptState = lifecycleToPromptState('not_started');
		} else {
			// Preserve existing lifecycle and prompt state.
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
		// ── First access: initialise fresh NodeRuntimeState.
		if (depState.blockedBy.length > 0) {
			nextLifecycle = 'blocked';
			nextPromptState = 'blocked';
		} else {
			nextLifecycle = 'not_started';
			nextPromptState = lifecycleToPromptState('not_started');
		}

		nextNodeState = createNodeRuntimeState(
			nodeId,
			nextLifecycle,
			nextPromptState,
			depState,
		);
	}

	// ── Apply state changes ───────────────────────────────────────
	const withSelection = patchState(state, {
		activeNodeId: nodeId,
		lastActiveNodeId: state.activeNodeId,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: nextNodeState,
		},
	});

	// ── Recompute mode ────────────────────────────────────────────
	const mode = resolveSessionMode(withSelection, profile);
	return stateOk(patchState(withSelection, { mode }));
}

/**
 * Deselect the active node and return to structural overview.
 *
 * The current node's runtime state is preserved (conversation,
 * canonical answer, lifecycle, etc.). `lastActiveNodeId` is updated
 * so the user can resume the node later via `resume_last_node`.
 *
 * The mode is always recomputed from the resulting state — even when
 * `activeNodeId` is already `null`, this ensures the mode reflects
 * the true session condition (e.g., fixing a stale mode).
 *
 * @param state - The current runtime state (not mutated).
 * @returns A new `LogosRuntimeState` with `activeNodeId` cleared and
 *   mode recomputed.
 */
export function deselectNode(state: LogosRuntimeState): StateEngineResult {
	const nextState = patchState(state, {
		activeNodeId: null,
		lastActiveNodeId: state.activeNodeId ?? state.lastActiveNodeId,
	});

	const mode = resolveSessionMode(nextState);
	return stateOk(patchState(nextState, { mode }));
}
