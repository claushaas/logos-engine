/**
 * Diagnostic collector — accumulates diagnostics during state engine
 * operations and enriches them with recovery actions.
 *
 * The collector wraps the existing `RuntimeDiagnostic` contract type
 * and stores a richer `DiagnosticReport` that includes category,
 * recoverable flag, recovery actions, details, and a timestamp.
 *
 * The collector is intentionally imperative (not pure-functional) so
 * it can be passed through a pipeline of operations that each add
 * diagnostics incrementally.
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md §12}
 */
import type { RuntimeDiagnostic } from '../contracts/index.js';
import { nowIso } from '../shared/index.js';
import type { RuntimeError, RuntimeErrorCategory } from './error-categories.js';
import {
	getRecoveryActions,
	getRecoveryActionsForError,
	type RecoveryAction,
} from './recovery-actions.js';

// ─── DiagnosticReport ──────────────────────────────────────────────────────

/**
 * A richer diagnostic entry produced by the diagnostics layer.
 *
 * Extends the contract-level `RuntimeDiagnostic` with error category,
 * recoverability, recovery actions, details, and a timestamp.
 * The TUI will eventually consume this shape (Step 14.2), but for now
 * the contract retains the simpler `RuntimeDiagnostic`.
 */
export interface DiagnosticReport {
	/** Machine-readable diagnostic code. */
	readonly code: string;

	/** Human-readable message. */
	readonly message: string;

	/** Severity level. */
	readonly severity: 'info' | 'warning' | 'error';

	/** Optional node or document this diagnostic relates to. */
	readonly sourceId?: string;

	/** Error category for routing (derived from the source error). */
	readonly category?: RuntimeErrorCategory;

	/** Whether automatic or guided recovery is possible. */
	readonly recoverable?: boolean;

	/** Suggested recovery actions for the user. */
	readonly recoveryActions: RecoveryAction[];

	/** Additional structured context from the source error. */
	readonly details?: Record<string, unknown>;

	/** ISO-8601 timestamp when the diagnostic was produced. */
	readonly timestamp: string;
}

// ─── DiagnosticSeverity ────────────────────────────────────────────────────

/**
 * Canonical diagnostic severity levels.
 *
 * Mirrors the contract-level `RuntimeDiagnostic.severity` union for
 * type-safe construction within the diagnostics module.
 */
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

// ─── DiagnosticCollector ───────────────────────────────────────────────────

/**
 * Collects diagnostic entries during a state engine operation.
 *
 * Internally stores enriched `DiagnosticReport` objects so that
 * category, recoverable flag, details, and recovery actions are
 * preserved end-to-end.
 *
 * Usage:
 * ```ts
 * const collector = new DiagnosticCollector();
 * collector.addError(someError);
 * collector.add({ code: 'X', message: '...', severity: 'warning' });
 * const reports = collector.getReports();              // DiagnosticReport[]
 * const plain = collector.toRuntimeDiagnostics();      // RuntimeDiagnostic[]
 * ```
 */
export class DiagnosticCollector {
	private _reports: DiagnosticReport[] = [];

	// ── Mutation ──────────────────────────────────────────────────────────

	/**
	 * Add a plain `RuntimeDiagnostic` entry.
	 *
	 * The entry is immediately enriched with recovery actions derived
	 * from its error code and stored as a `DiagnosticReport`.
	 */
	add(diagnostic: RuntimeDiagnostic): void {
		const recoveryActions = getRecoveryActions(diagnostic.code);
		this._reports.push({
			code: diagnostic.code,
			message: diagnostic.message,
			severity: diagnostic.severity,
			...(diagnostic.sourceId !== undefined
				? { sourceId: diagnostic.sourceId }
				: {}),
			recoverable: recoveryActions.length > 0,
			recoveryActions: [...recoveryActions],
			timestamp: nowIso(),
		});
	}

	/**
	 * Add multiple `RuntimeDiagnostic` entries at once.
	 *
	 * Common pattern after receiving `stateErr(_, diagnostics)` from
	 * a state engine operation. Each entry is enriched on ingestion.
	 */
	addMany(diagnostics: readonly RuntimeDiagnostic[]): void {
		for (const d of diagnostics) {
			this.add(d);
		}
	}

	/**
	 * Add a diagnostic derived from a `RuntimeError`.
	 *
	 * Preserves the error's category, recoverable flag, and details.
	 * Recovery actions are resolved from the error's code and category.
	 */
	addError(
		error: RuntimeError,
		severity: DiagnosticSeverity = 'error',
		sourceId?: string,
	): void {
		const recoveryActions = getRecoveryActionsForError(
			error.code,
			error.category,
		);

		this._reports.push({
			code: error.code,
			message: error.userFacingMessage ?? error.message,
			severity,
			...(sourceId !== undefined ? { sourceId } : {}),
			category: error.category,
			recoverable: error.recoverable || recoveryActions.length > 0,
			recoveryActions: [...recoveryActions],
			...(error.details !== undefined ? { details: { ...error.details } } : {}),
			timestamp: nowIso(),
		});
	}

	// ── Queries ───────────────────────────────────────────────────────────

	/**
	 * Return a shallow copy of all collected reports.
	 */
	getReports(): DiagnosticReport[] {
		return this._reports.map((r) => ({
			...r,
			recoveryActions: [...r.recoveryActions],
			...(r.details !== undefined ? { details: { ...r.details } } : {}),
		}));
	}

	/**
	 * Return collected diagnostics as contract-compatible
	 * `RuntimeDiagnostic[]` for consumers that expect the simpler type.
	 *
	 * Down-converts `DiagnosticReport` by stripping enrichment fields
	 * that are not part of the `RuntimeDiagnostic` contract.
	 */
	toRuntimeDiagnostics(): RuntimeDiagnostic[] {
		return this._reports.map((r) => ({
			code: r.code,
			message: r.message,
			severity: r.severity,
			...(r.sourceId !== undefined ? { sourceId: r.sourceId } : {}),
		}));
	}

	/**
	 * Return a shallow copy of all collected raw diagnostics.
	 *
	 * Alias for `toRuntimeDiagnostics()`.
	 */
	getAll(): readonly RuntimeDiagnostic[] {
		return this.toRuntimeDiagnostics();
	}

	/**
	 * Whether any collected diagnostic has severity `error`.
	 */
	hasErrors(): boolean {
		return this._reports.some((d) => d.severity === 'error');
	}

	/**
	 * Whether any collected diagnostic has severity `warning`.
	 */
	hasWarnings(): boolean {
		return this._reports.some((d) => d.severity === 'warning');
	}

	/** Total number of collected diagnostics. */
	get count(): number {
		return this._reports.length;
	}

	/** Clear all collected diagnostics (e.g., on successful recovery). */
	clear(): void {
		this._reports = [];
	}
}
