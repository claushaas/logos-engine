/**
 * State engine types — `StateEngineResult`, `StateDiagnostic`, `StateEngineEvent`.
 *
 * These types are the interface between the state engine and the application
 * layer. Every state engine operation returns a `StateEngineResult`.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §12}
 */
import type {
	LogosRuntimeState,
	RuntimeDiagnostic,
	SessionEvent,
} from '../contracts/index.js';

// ─── StateDiagnostic ────────────────────────────────────────────────────────

/**
 * A non-fatal diagnostic produced by the state engine.
 *
 * Mirrors the contract-level `RuntimeDiagnostic` so the state engine can
 * produce diagnostics without depending on render-snapshot types.
 */
export type StateDiagnostic = RuntimeDiagnostic;

// ─── StateEngineResult ──────────────────────────────────────────────────────

/**
 * Result of a state engine operation.
 *
 * Every mutation function returns this type — never throws and never
 * mutates input state.
 */
export type StateEngineResult =
	| { readonly ok: true; readonly state: LogosRuntimeState }
	| {
			readonly ok: false;
			readonly error: string;
			readonly diagnostics: StateDiagnostic[];
	  };

// ─── StateEngineEvent ───────────────────────────────────────────────────────

/**
 * Union of all events the state engine may process.
 *
 * Aliases the contract-level `SessionEvent` so the state engine can
 * reference events without importing session-event types directly.
 */
export type StateEngineEvent = SessionEvent;

// ─── Convenience constructors ───────────────────────────────────────────────

/**
 * Create a successful `StateEngineResult`.
 */
export function stateOk(state: LogosRuntimeState): StateEngineResult {
	return { ok: true as const, state };
}

/**
 * Create a failed `StateEngineResult` with diagnostics.
 */
export function stateErr(
	error: string,
	diagnostics: StateDiagnostic[] = [],
): StateEngineResult {
	return { diagnostics, error, ok: false as const };
}

/**
 * Create a single diagnostic entry.
 */
export function diagnostic(
	code: string,
	message: string,
	severity: 'info' | 'warning' | 'error' = 'error',
	sourceId?: string,
): StateDiagnostic {
	return sourceId !== undefined
		? { code, message, severity, sourceId }
		: { code, message, severity };
}
