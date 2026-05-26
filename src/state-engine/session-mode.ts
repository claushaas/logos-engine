/**
 * Session mode resolution — pure, deterministic mode computation.
 *
 * `resolveSessionMode()` determines whether the session is in structural
 * mode or node-focused mode based on `activeNodeId`. The entire TUI
 * behaviour depends on this switch; if the rule is ambiguous, the
 * renderer will become stateful and violate the architecture.
 *
 * All functions are pure: they never access the filesystem, never call
 * the profile registry, and never produce side effects.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §5-6}
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md §3}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	SessionMode,
} from '../contracts/index.js';
import { diagnostic, type StateDiagnostic } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_ACTIVE_NODE_NO_PROFILE = 'LOGOS_STATE_ACTIVE_NODE_WITHOUT_PROFILE';
const DIAG_PROFILE_MISMATCH = 'LOGOS_STATE_PROFILE_MISMATCH';
const DIAG_NODE_NOT_IN_PROFILE = 'LOGOS_STATE_NODE_NOT_IN_PROFILE';
const DIAG_PROFILE_DEFINITION_REQUIRED =
	'LOGOS_STATE_PROFILE_DEFINITION_REQUIRED';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of `resolveSessionModeWithDiagnostics()`.
 *
 * Carries the resolved `SessionMode` alongside any diagnostics produced
 * during validation (e.g., invalid `activeNodeId`, profile mismatch).
 */
export type SessionModeResolution = {
	readonly mode: SessionMode;
	readonly diagnostics: readonly StateDiagnostic[];
};

// ═══════════════════════════════════════════════════════════════════════════
// Implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve the session mode with full diagnostics.
 *
 * Validates that `activeNodeId` belongs to the selected profile when a
 * profile definition is supplied. Produces a diagnostic for every
 * mismatch or invalid condition detected.
 *
 * @param state   - The current runtime state (not mutated).
 * @param profile - Optional profile definition for node validation.
 *                  When `activeNodeId` is non-null and no profile is
 *                  provided, the resolver cannot confirm validity and
 *                  returns `"error"` with a diagnostic.
 * @returns A `SessionModeResolution` with the computed mode and any
 *          diagnostics.
 */
export function resolveSessionModeWithDiagnostics(
	state: LogosRuntimeState,
	profile?: LogosProfile,
): SessionModeResolution {
	// ── Idle: no profile, no node ──────────────────────────────────────
	if (state.selectedProfileId === null && state.activeNodeId === null) {
		return { diagnostics: [], mode: 'idle' };
	}

	// ── Node focus validation branch ───────────────────────────────────
	if (state.activeNodeId !== null) {
		// Active node without a selected profile is invalid.
		if (state.selectedProfileId === null) {
			return {
				diagnostics: [
					diagnostic(
						DIAG_ACTIVE_NODE_NO_PROFILE,
						`Active node "${state.activeNodeId}" exists but no profile is selected.`,
						'error',
						state.activeNodeId,
					),
				],
				mode: 'error',
			};
		}

		// No profile definition supplied — cannot validate the node.
		if (profile === undefined) {
			return {
				diagnostics: [
					diagnostic(
						DIAG_PROFILE_DEFINITION_REQUIRED,
						`Active node "${state.activeNodeId}" requires a profile definition for validation, but none was supplied.`,
						'error',
						state.activeNodeId,
					),
				],
				mode: 'error',
			};
		}

		// Profile ID in state must match the supplied profile.
		if (profile.id !== state.selectedProfileId) {
			return {
				diagnostics: [
					diagnostic(
						DIAG_PROFILE_MISMATCH,
						`Selected profile "${state.selectedProfileId}" does not match supplied profile "${profile.id}".`,
						'error',
						state.activeNodeId,
					),
				],
				mode: 'error',
			};
		}

		// Validate that activeNodeId exists in the profile's node definitions.
		const nodeExists = profile.nodes.some((n) => n.id === state.activeNodeId);
		if (!nodeExists) {
			return {
				diagnostics: [
					diagnostic(
						DIAG_NODE_NOT_IN_PROFILE,
						`Node "${state.activeNodeId}" does not exist in profile "${profile.id}".`,
						'error',
						state.activeNodeId,
					),
				],
				mode: 'error',
			};
		}

		// All validations passed — active node belongs to selected profile.
		return { diagnostics: [], mode: 'node_focus' };
	}

	// ── Structure overview: profile selected, no active node ───────────
	if (state.selectedProfileId !== null && state.activeNodeId === null) {
		return { diagnostics: [], mode: 'structure_overview' };
	}

	// ── Fallback (should not be reachable) ─────────────────────────────
	return { diagnostics: [], mode: 'idle' };
}

/**
 * Resolve the session mode (compact form).
 *
 * Thin wrapper around `resolveSessionModeWithDiagnostics()` that returns
 * only the computed `SessionMode`. Use this when diagnostics are not
 * needed — e.g., in snapshot construction where the caller already
 * performed validation.
 *
 * @param state   - The current runtime state (not mutated).
 * @param profile - Optional profile definition for node validation.
 * @returns The resolved `SessionMode`.
 */
export function resolveSessionMode(
	state: LogosRuntimeState,
	profile?: LogosProfile,
): SessionMode {
	return resolveSessionModeWithDiagnostics(state, profile).mode;
}
