/**
 * Error categories and RuntimeError interface for the diagnostics layer.
 *
 * This module formalizes the error type contract consumed by the
 * diagnostics module. It imports `ErrorCategory` from the shared layer
 * (where `LogosError` lives) and re-exports it as `RuntimeErrorCategory`
 * — the diagnostics-facing name.
 *
 * The `RuntimeError` interface is satisfied by `LogosError` instances
 * as well as any plain object carrying the same shape (e.g., module-level
 * error types such as `PersistenceError` or `ResumeError` when suitably
 * conformed).
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md §3-4}
 */
import type { ErrorCategory } from '../shared/index.js';

// ─── RuntimeErrorCategory ──────────────────────────────────────────────────

/**
 * Runtime error category — diagnostics-facing alias for `ErrorCategory`.
 *
 * Categories:
 * - `validation` — input/output schema violations
 * - `invalid_state` — inconsistent runtime state
 * - `llm_provider` — LLM API errors (timeout, auth, rate-limit)
 * - `structured_output` — LLM output parse/repair failures
 * - `persistence` — snapshot/event-log I/O failures
 * - `profile_schema` — profile YAML load/parse/schema failures
 * - `materialization` — document assembly failures
 * - `tui_rendering` — terminal render failures
 * - `export` — artifact generation failures
 */
export type RuntimeErrorCategory = ErrorCategory;

// ─── RuntimeError ──────────────────────────────────────────────────────────

/**
 * Runtime error interface — the type contract for all errors flowing
 * through the diagnostics layer.
 *
 * `LogosError` satisfies this interface. Module-level error objects
 * (e.g., `PersistenceError`, `ResumeError`) can also be adapted to
 * satisfy it when they carry `code`, `category`, `message`, and
 * `recoverable` fields.
 *
 * @see {@link LogosError} in `src/shared/errors/LogosError.ts`
 */
export interface RuntimeError {
	/** Machine-readable error code (e.g., `LOGOS_DISPATCH_NO_PROFILE`). */
	readonly code: string;

	/** Category for diagnostics routing and recovery decisions. */
	readonly category: RuntimeErrorCategory;

	/** Human-readable error message (for logs and diagnostics). */
	readonly message: string;

	/** Whether the system can attempt automatic or guided recovery. */
	readonly recoverable: boolean;

	/** Optional message suitable for display in the TUI error panel. */
	readonly userFacingMessage?: string;

	/** Additional structured context (e.g., affected node IDs). */
	readonly details?: Record<string, unknown>;
}
