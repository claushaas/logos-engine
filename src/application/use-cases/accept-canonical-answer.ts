/**
 * Accept canonical answer use case — orchestrates the user-driven
 * acceptance of a canonical answer draft.
 *
 * Pipeline:
 * 1. Guard: active node exists, lifecycle is `synthesized`, canonical
 *    answer exists.
 * 2. Call `acceptCanonicalAnswer()` to mark the answer as accepted.
 * 3. Dispatch `NODE_LIFECYCLE_CHANGED` → transitions lifecycle to `accepted`.
 * 4. Build `TuiRenderSnapshot` for the TUI.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.7, §4.1 step 5}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import { acceptCanonicalAnswer } from '../../conversation-runtime/canonical-answers.js';
import type { NodeId } from '../../shared/index.js';
import { dispatch } from '../../state-engine/dispatch.js';
import { buildSnapshot } from '../../state-engine/snapshot-builder.js';
import type { StateDiagnostic } from '../../state-engine/types.js';
import { buildRenderSnapshot } from '../render-model-builder.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of the accept-canonical-answer use case.
 */
export type AcceptCanonicalAnswerResult =
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
 * Options for `acceptCanonicalAnswerUseCase`.
 */
export type AcceptCanonicalAnswerOptions = {
	/** The node whose canonical answer to accept (defaults to active node). */
	readonly nodeId?: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Accept the canonical answer for a node.
 *
 * Guards (failures return `ok: false` with diagnostics):
 * - An active node must be selected.
 * - The node lifecycle must be `synthesized`.
 * - The node must have a canonical answer (not null).
 *
 * Effects on success:
 * - Sets `canonicalAnswer.accepted = true`, `acceptedAt`, `stale = false`.
 * - Transitions lifecycle to `accepted`.
 * - Recomputes document readiness.
 * - Builds a `TuiRenderSnapshot` with updated allowed actions and
 *   canonical answer status.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Target node ID and loaded profile.
 * @returns An `AcceptCanonicalAnswerResult` with updated state and snapshot.
 */
export function acceptCanonicalAnswerUseCase(
	state: LogosRuntimeState,
	options: AcceptCanonicalAnswerOptions,
): AcceptCanonicalAnswerResult {
	const { profile } = options;
	const targetNodeId: NodeId | null = options.nodeId ?? state.activeNodeId;

	if (targetNodeId === null) {
		return {
			diagnostics: [],
			error: 'No active node selected for accept.',
			ok: false as const,
		};
	}

	// ── Step 1: Accept the canonical answer ────────────────────────
	const acceptResult = acceptCanonicalAnswer(state, targetNodeId);
	if (!acceptResult.ok) {
		return {
			diagnostics: acceptResult.diagnostics ?? [],
			error: acceptResult.error,
			ok: false as const,
		};
	}

	const afterAccept = acceptResult.state;

	// ── Step 2: Transition lifecycle to "accepted" ─────────────────
	const lifecycleResult = dispatch(
		afterAccept,
		{
			nodeId: targetNodeId,
			to: 'accepted',
			type: 'NODE_LIFECYCLE_CHANGED',
		},
		profile,
	);

	if (!lifecycleResult.ok) {
		return {
			diagnostics: lifecycleResult.diagnostics,
			error: lifecycleResult.error,
			ok: false as const,
		};
	}

	const finalState = lifecycleResult.state;

	// ── Step 3: Build render snapshot ──────────────────────────────
	const snapshot = buildRenderSnapshot(
		lifecycleResult.snapshot ?? buildSnapshot(finalState, profile),
		profile,
	);

	return {
		diagnostics: [],
		ok: true as const,
		snapshot,
		state: finalState,
	};
}
