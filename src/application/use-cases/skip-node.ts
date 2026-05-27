/**
 * Skip-node use case — defers the active node by dispatching `DEFER_NODE`.
 *
 * This is a minimal mapping from the `skip` TUI action to the state
 * engine's deferred lifecycle transition. Skippable lifecycles are
 * restricted to those that explicitly allow `skip` in their allowed
 * actions set (currently only `not_started`).
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §1.6}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import type { NodeId } from '../../shared/index.js';
import { dispatch } from '../../state-engine/dispatch.js';
import { buildSnapshot } from '../../state-engine/snapshot-builder.js';
import type { StateDiagnostic } from '../../state-engine/types.js';
import { buildRenderSnapshot } from '../render-model-builder.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

export type SkipNodeResult =
	| {
			readonly ok: true;
			readonly state: LogosRuntimeState;
			readonly snapshot: TuiRenderSnapshot;
			readonly diagnostics: StateDiagnostic[];
	  }
	| {
			readonly ok: false;
			readonly error: string;
			readonly diagnostics: StateDiagnostic[];
	  };

export type SkipNodeOptions = {
	/** The node to skip (defaults to state's active node). */
	readonly nodeId?: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Skip (defer) the current node.
 *
 * Dispatches `DEFER_NODE` against the target node. The state engine
 * validates that the node's current lifecycle allows the `deferred`
 * transition.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Skip options (nodeId optional, defaults to active node).
 * @returns A `SkipNodeResult` with updated state and render snapshot.
 */
export function skipNodeUseCase(
	state: LogosRuntimeState,
	options: SkipNodeOptions,
): SkipNodeResult {
	const { profile } = options;
	const targetNodeId: NodeId | null = options.nodeId ?? state.activeNodeId;

	if (targetNodeId === null) {
		return {
			diagnostics: [],
			error: 'No active node to skip.',
			ok: false as const,
		};
	}

	const deferResult = dispatch(
		state,
		{ nodeId: targetNodeId, type: 'DEFER_NODE' },
		profile,
	);

	if (!deferResult.ok) {
		return {
			diagnostics: deferResult.diagnostics,
			error: deferResult.error,
			ok: false as const,
		};
	}

	const snapshot = buildRenderSnapshot(
		deferResult.snapshot ?? buildSnapshot(deferResult.state, profile),
		profile,
	);

	return {
		diagnostics: [],
		ok: true as const,
		snapshot,
		state: deferResult.state,
	};
}
