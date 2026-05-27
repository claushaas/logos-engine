/**
 * Reopen-node use case — orchestrates reopening a synthesized or accepted
 * node back to `active` for further conversation.
 *
 * Pipeline:
 * 1. Guard: active node exists, lifecycle is `synthesized` or `accepted`.
 * 2. Dispatch `NODE_LIFECYCLE_CHANGED` → transitions lifecycle to `active`.
 *    The state engine marks the canonical answer as stale automatically
 *    (Step 10.3: `handleNodeLifecycleChanged` handles `synthesized → active`
 *    and `accepted → active` staleness).
 * 3. Build `TuiRenderSnapshot` for the TUI.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.7, §4.4}
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

/**
 * Result of the reopen-node use case.
 */
export type ReopenNodeResult =
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

/**
 * Options for `reopenNodeUseCase`.
 */
export type ReopenNodeOptions = {
	/** The node to reopen (defaults to active node). */
	readonly nodeId?: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reopen a node, returning it to `active` lifecycle.
 *
 * Valid from `synthesized` and `accepted` lifecycles. The state engine
 * marks the canonical answer as stale automatically during the transition.
 *
 * Guards:
 * - An active node must be selected.
 * - The node lifecycle must allow the `active` transition (only valid
 *   from `synthesized` and `accepted`).
 *
 * Effects:
 * - Lifecycle transitions to `active`.
 * - Canonical answer is marked stale.
 * - Prompt state resets to `follow_up`.
 * - Allowed actions update to active-set (`answer`, `defer`, etc.).
 * - Document readiness recomputes.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Target node ID and loaded profile.
 * @returns A `ReopenNodeResult` with updated state and snapshot.
 */
export function reopenNodeUseCase(
	state: LogosRuntimeState,
	options: ReopenNodeOptions,
): ReopenNodeResult {
	const { profile } = options;
	const targetNodeId: NodeId | null = options.nodeId ?? state.activeNodeId;

	if (targetNodeId === null) {
		return {
			diagnostics: [],
			error: 'No active node selected for reopen.',
			ok: false as const,
		};
	}

	// ── Step 1: Transition lifecycle to "active" ───────────────────
	// The state engine handles staleness automatically for
	// synthesized → active and accepted → active.
	const result = dispatch(
		state,
		{
			nodeId: targetNodeId,
			to: 'active',
			type: 'NODE_LIFECYCLE_CHANGED',
		},
		profile,
	);

	if (!result.ok) {
		return {
			diagnostics: result.diagnostics,
			error: result.error,
			ok: false as const,
		};
	}

	// ── Step 2: Build render snapshot ──────────────────────────────
	const snapshot = buildRenderSnapshot(
		result.snapshot ?? buildSnapshot(result.state, profile),
		profile,
	);

	return {
		diagnostics: [],
		ok: true as const,
		snapshot,
		state: result.state,
	};
}
