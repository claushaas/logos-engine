/**
 * Error categories — derived from `docs/architecture/08-error-handling-and-recovery.md`.
 *
 * Each category maps to a subsystem boundary and carries specific recovery rules.
 */
export type ErrorCategory =
	| 'validation'
	| 'invalid_state'
	| 'llm_provider'
	| 'structured_output'
	| 'persistence'
	| 'profile_schema'
	| 'materialization'
	| 'tui_rendering'
	| 'export';

/**
 * LogosError — the base error class for the LOGOS Engine.
 *
 * All runtime errors thrown within the engine (including invariant violations)
 * extend or use this class. Every error carries a machine-readable code,
 * a category for diagnostics routing, and an optional user-facing message.
 */
export class LogosError extends Error {
	/** Machine-readable error code (e.g., `LOGOS_INVARIANT_VIOLATION`). */
	public readonly code: string;

	/** Error category for diagnostics routing and recovery decisions. */
	public readonly category: ErrorCategory;

	/** Whether the system can attempt automatic recovery. */
	public readonly recoverable: boolean;

	/** Human-readable message suitable for display in the TUI. */
	public readonly userFacingMessage: string;

	/** Additional structured context (e.g., affected node IDs, LLM provider details). */
	public readonly details: Record<string, unknown>;

	constructor(
		code: string,
		category: ErrorCategory,
		message: string,
		options: {
			recoverable?: boolean;
			userFacingMessage?: string;
			details?: Record<string, unknown>;
			cause?: unknown;
		} = {},
	) {
		super(message);
		this.name = 'LogosError';
		this.code = code;
		this.category = category;
		this.recoverable = options.recoverable ?? false;
		this.userFacingMessage = options.userFacingMessage ?? message;
		this.details = options.details ?? {};

		if (options.cause !== undefined) {
			this.cause = options.cause;
		}

		// Restore prototype chain for instanceof checks in ES2022+.
		Object.setPrototypeOf(this, LogosError.prototype);
	}
}
