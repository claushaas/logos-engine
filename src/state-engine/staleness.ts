/**
 * Staleness cascade — propagates canonical answer staleness from an
 * upstream node to all transitive downstream dependents.
 *
 * When an accepted upstream node's canonical answer changes (due to reopen,
 * edit, or completeness drop), all dependent nodes that have accepted
 * canonical answers must be marked stale. This ensures document consistency:
 * if a foundational thesis changes, every derived answer must be reviewed.
 *
 * `propagateStaleness` is the primary entry point. It uses the profile's
 * dependency graph to find transitive dependents, marks their answers
 * stale, recomputes document readiness, and produces diagnostic events.
 *
 * All functions are pure: they return new `LogosRuntimeState` objects
 * and never mutate the input state.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §9}
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §13}
 */
import type {
	CanonicalAnswer,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../contracts/index.js';
import { buildDependencyGraph } from '../profiles/index.js';
import type { NodeId } from '../shared/index.js';
import { nowIso } from '../shared/index.js';
import { recomputeAllDocumentReadiness } from './document-readiness.js';
import { buildSnapshot } from './snapshot-builder.js';
import {
	diagnostic,
	type StateDiagnostic,
	type StateEngineResult,
	stateErr,
	stateOk,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_STALE_NO_DEPENDENTS = 'LOGOS_STALE_NO_DEPENDENTS';
const DIAG_STALE_PROPAGATED = 'LOGOS_STALE_PROPAGATED';
const DIAG_STALE_CASCADE = 'LOGOS_STALE_CASCADE';
const DIAG_STALE_NODE_NOT_FOUND = 'LOGOS_STALE_NODE_NOT_FOUND';
const DIAG_STALE_NOT_ACCEPTED = 'LOGOS_STALE_NOT_ACCEPTED';

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark a single node's canonical answer as stale (pure, returns new node state).
 *
 * If the node has no canonical answer or the answer is already stale,
 * returns the node state unchanged.
 */
function markNodeAnswerStale(
	nodeState: NodeRuntimeState,
): NodeRuntimeState {
	const answer = nodeState.canonicalAnswer;

	if (answer === null || answer.stale === true) {
		return nodeState;
	}

	const updatedAnswer: CanonicalAnswer = {
		...answer,
		stale: true,
	};

	return {
		...nodeState,
		canonicalAnswer: updatedAnswer,
		updatedAt: nowIso(),
	};
}

/**
 * Compute the full transitive closure of dependents for a given node ID
 * using BFS over the dependency graph's `getDependents` method.
 *
 * Returns a set of all node IDs that transitively list `rootNodeId` as a
 * required dependency.
 */
function transitiveDependents(
	rootNodeId: NodeId,
	profile: LogosProfile,
): Set<NodeId> {
	const graph = buildDependencyGraph(profile);
	const visited = new Set<NodeId>();
	const queue: NodeId[] = [rootNodeId];
	visited.add(rootNodeId);

	while (queue.length > 0) {
		const current = queue.shift()!;
		const directDependents = graph.getDependents(current);

		for (const dep of directDependents) {
			if (!visited.has(dep)) {
				visited.add(dep);
				queue.push(dep);
			}
		}
	}

	// Remove the root node — we only care about dependents, not the source.
	visited.delete(rootNodeId);
	return visited;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Propagate staleness from an upstream node to all transitive downstream
 * dependents that have accepted (non-stale) canonical answers.
 *
 * Guard: no-op if `changedNodeId` does not have an accepted canonical
 * answer — stale answers only cascade from accepted upstream answers.
 *
 * Effects:
 * - Finds all transitive dependents via the profile's dependency graph.
 * - For each dependent with an accepted, non-stale canonical answer,
 *   marks it stale and records a diagnostic.
 * - Recomputes document readiness for all documents in the profile.
 * - Returns the updated state with a snapshot for the TUI.
 *
 * @param state         - The current runtime state (not mutated).
 * @param changedNodeId - The upstream node whose answer changed.
 * @param profile       - The loaded profile (for dependency graph).
 * @returns A `StateEngineResult` with updated state and snapshot.
 */
export function propagateStaleness(
	state: LogosRuntimeState,
	changedNodeId: NodeId,
	profile: LogosProfile,
): StateEngineResult {
	// ── Guard: changed node must exist ───────────────────────────────
	const changedNode = state.nodeStates[changedNodeId];
	if (!changedNode) {
		return stateErr(
			`Cannot propagate staleness: node "${changedNodeId}" has no runtime state.`,
			[
				diagnostic(
					DIAG_STALE_NODE_NOT_FOUND,
					`Node "${changedNodeId}" has no runtime state. Select a node first.`,
					'error',
					changedNodeId,
				),
			],
		);
	}

	// ── Guard: only cascade from accepted answers ────────────────────
	if (!changedNode.canonicalAnswer || !changedNode.canonicalAnswer.accepted) {
		// No-op: a non-accepted node's changes don't cascade to dependents.
		const snapshot = buildSnapshot(state, profile, [
			diagnostic(
				DIAG_STALE_NOT_ACCEPTED,
				`Node "${changedNodeId}" does not have an accepted canonical answer — no staleness to propagate.`,
				'info',
				changedNodeId,
			),
		]);
		return stateOk(state, snapshot);
	}

	// ── Compute transitive dependents ─────────────────────────────────
	const dependents = transitiveDependents(changedNodeId, profile);

	if (dependents.size === 0) {
		// No dependents, but the changed node may itself be a document source.
		// Recompute readiness so the document status reflects the stale source.
		const nextState = recomputeAllDocumentReadiness(state, profile);
		const snapshot = buildSnapshot(nextState, profile, [
			diagnostic(
				DIAG_STALE_NO_DEPENDENTS,
				`Node "${changedNodeId}" has no dependent nodes. No staleness to propagate.`,
				'info',
				changedNodeId,
			),
		]);
		return stateOk(nextState, snapshot);
	}

	// ── Mark dependents stale ─────────────────────────────────────────
	const diags: StateDiagnostic[] = [];
	let nextNodeStates = { ...state.nodeStates };
	let staleCount = 0;

	for (const depId of dependents) {
		const depState = nextNodeStates[depId];
		if (!depState) {
			// Dependent node not yet initialised — skip.
			continue;
		}

		// Only mark stale if the dependent has an accepted, non-stale answer.
		if (
			depState.canonicalAnswer &&
			depState.canonicalAnswer.accepted &&
			!depState.canonicalAnswer.stale
		) {
			nextNodeStates = {
				...nextNodeStates,
				[depId]: markNodeAnswerStale(depState),
			};
			staleCount++;
			diags.push(
				diagnostic(
					DIAG_STALE_PROPAGATED,
					`Canonical answer for node "${depId}" marked stale — upstream node "${changedNodeId}" changed.`,
					'warning',
					depId,
				),
			);
		}
	}

	// ── Build updated state ───────────────────────────────────────────
	let nextState: LogosRuntimeState = {
		...state,
		nodeStates: nextNodeStates,
		updatedAt: nowIso(),
	};

	// ── Recompute document readiness ──────────────────────────────────
	nextState = recomputeAllDocumentReadiness(nextState, profile);

	diags.push(
		diagnostic(
			DIAG_STALE_CASCADE,
			`Staleness cascade from "${changedNodeId}": ${staleCount} dependent node(s) marked stale across ${dependents.size} transitive dependent(s).`,
			'info',
			changedNodeId,
		),
	);

	// ── Build snapshot ────────────────────────────────────────────────
	const snapshot = buildSnapshot(nextState, profile, diags);

	return stateOk(nextState, snapshot);
}
