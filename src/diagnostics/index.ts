/**
 * Diagnostics module — error categorization, diagnostic collection,
 * and recovery action suggestions.
 *
 * This module is the central entry point for all error diagnostics
 * in the LOGOS Engine. It formalizes error types, accumulates
 * diagnostics during operations, and suggests recovery actions.
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md}
 */
export type {
	RuntimeError,
	RuntimeErrorCategory,
} from './error-categories.js';
export {
	DiagnosticCollector,
	type DiagnosticReport,
	type DiagnosticSeverity,
} from './diagnostic-collector.js';
export {
	getRecoveryActions,
	getRecoveryActionsForError,
	type RecoveryAction,
} from './recovery-actions.js';
