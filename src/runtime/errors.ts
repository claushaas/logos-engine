/** Structured error helpers for runtime/CLI/service errors */

import type {
	DiagnosticArea,
	LogosDiagnostic,
	LogosDiagnosticCode,
	LogosDiagnosticRelatedIds,
	LogosDiagnosticSeverity,
	LogosRecoveryHint,
} from './diagnostics.js';
import {
	createDiagnostic,
	diagnosticCode,
	recoveryHint,
	wrapUnknownError,
} from './diagnostics.js';

// Re-export diagnostic-area type for callers
export type { DiagnosticArea } from './diagnostics.js';

// ---------------------------------------------------------------------------
// Stable error codes
// ---------------------------------------------------------------------------

/** Well-known error codes used across the system */
export const ErrorCodes = {
	CLI_UNEXPECTED_ERROR: diagnosticCode('CLI', 'UNEXPECTED_ERROR'),
	// CLI
	CLI_UNKNOWN_COMMAND: diagnosticCode('CLI', 'UNKNOWN_COMMAND'),

	// Consistency
	CONSISTENCY_INSUFFICIENT_OBSERVATION: diagnosticCode(
		'CONSISTENCY',
		'INSUFFICIENT_OBSERVATION',
	),
	EXECUTIVE_EXPORT_FAILED: diagnosticCode('EXECUTIVE', 'EXPORT_FAILED'),

	// Executive
	EXECUTIVE_READINESS_BLOCKED: diagnosticCode('EXECUTIVE', 'READINESS_BLOCKED'),
	EXECUTIVE_SCHEMA_FAILED: diagnosticCode('EXECUTIVE', 'SCHEMA_FAILED'),

	// Extraction
	EXTRACTION_CONFLICT: diagnosticCode('EXTRACTION', 'CONFLICT'),
	EXTRACTION_DEFERRED: diagnosticCode('EXTRACTION', 'DEFERRED'),
	FS_ALREADY_EXISTS: diagnosticCode('FS', 'ALREADY_EXISTS'),
	FS_BACKUP_FAILED: diagnosticCode('FS', 'BACKUP_FAILED'),
	FS_COLLISION: diagnosticCode('FS', 'COLLISION'),
	FS_DISK_FULL: diagnosticCode('FS', 'DISK_FULL'),
	FS_NOT_FOUND: diagnosticCode('FS', 'NOT_FOUND'),

	// Filesystem
	FS_PATH_TRAVERSAL: diagnosticCode('FS', 'PATH_TRAVERSAL'),
	FS_PERMISSION_DENIED: diagnosticCode('FS', 'PERMISSION_DENIED'),
	FS_UNSAFE_ABSOLUTE_PATH: diagnosticCode('FS', 'UNSAFE_ABSOLUTE_PATH'),
	FS_WRITE_FAILED: diagnosticCode('FS', 'WRITE_FAILED'),

	// Generation
	GENERATION_BLOCKED: diagnosticCode('GENERATION', 'BLOCKED'),
	GENERATION_MANUAL_EDIT_COLLISION: diagnosticCode(
		'GENERATION',
		'MANUAL_EDIT_COLLISION',
	),
	GENERATION_MISSING_SOURCE: diagnosticCode('GENERATION', 'MISSING_SOURCE'),
	GENERATION_REGISTRY_FAILED: diagnosticCode('GENERATION', 'REGISTRY_FAILED'),
	GENERATION_RENDER_FAILED: diagnosticCode('GENERATION', 'RENDER_FAILED'),
	GENERATION_STALE_SOURCE: diagnosticCode('GENERATION', 'STALE_SOURCE'),
	GENERATION_WRITE_FAILED: diagnosticCode('GENERATION', 'WRITE_FAILED'),

	// Import
	IMPORT_UNSAFE_PATH: diagnosticCode('IMPORT', 'UNSAFE_PATH'),
	IMPORT_UNSUPPORTED_FORMAT: diagnosticCode('IMPORT', 'UNSUPPORTED_FORMAT'),
	PROFILE_CIRCULAR_DEPENDENCY: diagnosticCode('PROFILE', 'CIRCULAR_DEPENDENCY'),
	PROFILE_DUPLICATE_ID: diagnosticCode('PROFILE', 'DUPLICATE_ID'),
	PROFILE_INVALID_YAML: diagnosticCode('PROFILE', 'INVALID_YAML'),
	PROFILE_MISSING_DESCRIPTOR: diagnosticCode('PROFILE', 'MISSING_DESCRIPTOR'),

	// Profile
	PROFILE_NOT_FOUND: diagnosticCode('PROFILE', 'NOT_FOUND'),
	PROFILE_SCHEMA_MISMATCH: diagnosticCode('PROFILE', 'SCHEMA_MISMATCH'),
	PROFILE_UNSUPPORTED_VERSION: diagnosticCode('PROFILE', 'UNSUPPORTED_VERSION'),

	// Scanner
	SCANNER_POLICY_LIMIT: diagnosticCode('SCANNER', 'POLICY_LIMIT'),

	// Security
	SECURITY_CHECK_FAILED: diagnosticCode('SECURITY', 'CHECK_FAILED'),
	SECURITY_TOKEN_LEAK: diagnosticCode('SECURITY', 'TOKEN_LEAK'),
	STATE_CORRUPT_JSON: diagnosticCode('STATE', 'CORRUPT_JSON'),
	STATE_CORRUPT_REGISTRY: diagnosticCode('STATE', 'CORRUPT_REGISTRY'),
	STATE_INVALID_SCHEMA: diagnosticCode('STATE', 'INVALID_SCHEMA'),

	// State
	STATE_MISSING: diagnosticCode('STATE', 'MISSING'),
	STATE_READ_ERROR: diagnosticCode('STATE', 'READ_ERROR'),
	STATE_UNSUPPORTED_VERSION: diagnosticCode('STATE', 'UNSUPPORTED_VERSION'),
	STATE_WRITE_ERROR: diagnosticCode('STATE', 'WRITE_ERROR'),

	// TUI
	TUI_COMMAND_ERROR: diagnosticCode('TUI', 'COMMAND_ERROR'),

	// Unknown
	UNKNOWN_ERROR: diagnosticCode('UNKNOWN', 'ERROR'),
	VALIDATION_PROVIDER_UNAVAILABLE: diagnosticCode(
		'VALIDATION',
		'PROVIDER_UNAVAILABLE',
	),

	// Validation
	VALIDATION_SUBSYSTEM_FAILED: diagnosticCode('VALIDATION', 'SUBSYSTEM_FAILED'),
} as const satisfies Record<string, LogosDiagnosticCode>;

// ---------------------------------------------------------------------------
// Structured Error
// ---------------------------------------------------------------------------

export interface StructuredErrorOptions {
	code: string;
	message: string;
	severity?: 'error' | 'warning' | 'fatal';
	path?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
	/** Internal only; not exposed in user-facing output */
	cause?: unknown;
}

export interface StructuredError {
	code: string;
	message: string;
	severity: 'error' | 'warning' | 'fatal';
	path?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
	cause?: unknown;
}

export function createStructuredError(
	options: StructuredErrorOptions,
): StructuredError {
	return {
		cause: options.cause,
		code: options.code,
		message: options.message,
		path: options.path,
		pointer: options.pointer,
		recoveryHint: options.recoveryHint,
		severity: options.severity ?? 'error',
	};
}

/** Format a single structured error for human output without exposing raw causes */
export function formatStructuredError(error: StructuredError): string[] {
	const lines: string[] = [];
	lines.push(`[${error.severity.toUpperCase()}] ${error.message}`);
	if (error.code) {
		lines.push(`  Code: ${error.code}`);
	}
	if (error.path) {
		lines.push(`  Path: ${error.path}`);
	}
	if (error.pointer) {
		lines.push(`  Pointer: ${error.pointer}`);
	}
	if (error.recoveryHint) {
		lines.push(`  Recovery: ${error.recoveryHint}`);
	}
	return lines;
}

/** Format multiple errors deterministically without exposing raw causes */
export function formatStructuredErrors(errors: StructuredError[]): string[] {
	const lines: string[] = [];
	for (const error of errors) {
		for (const line of formatStructuredError(error)) {
			lines.push(line);
		}
	}
	return lines;
}

/** Convert a StructuredError to the CommandError shape used in result envelopes */
export function toCommandError(
	error: StructuredError,
): import('./command-result.js').CommandError {
	const result: import('./command-result.js').CommandError = {
		code: error.code,
		message: error.message,
		severity: error.severity,
	};
	if (error.path !== undefined) result.path = error.path;
	if (error.pointer !== undefined) result.pointer = error.pointer;
	if (error.recoveryHint !== undefined)
		result.recoveryHint = error.recoveryHint;
	if (error.cause !== undefined) result.cause = error.cause;
	return result;
}

// ---------------------------------------------------------------------------
// Unknown Error Wrapping (Step 13.1)
// ---------------------------------------------------------------------------

/**
 * Wraps any caught value into a safe LogosDiagnostic.
 *
 * Never exposes raw stack traces, error constructor names, or
 * unredacted absolute paths in user-facing output.
 */
export function wrapUnknownCaughtValue(
	caught: unknown,
	options?: {
		area?: DiagnosticArea;
		path?: string | undefined;
		relatedIds?: LogosDiagnosticRelatedIds | undefined;
	},
): LogosDiagnostic {
	return wrapUnknownError(caught, options);
}

/**
 * Convert a LogosDiagnostic to a StructuredError for use in
 * existing CommandResult envelopes.
 */
export function diagnosticToStructuredError(
	diagnostic: LogosDiagnostic,
): StructuredError {
	const recoveryMessages = diagnostic.recoveryHints.map((h) => h.message);
	return {
		cause: diagnostic.cause,
		code: diagnostic.code,
		message: diagnostic.message,
		path: diagnostic.path,
		pointer: diagnostic.pointer,
		recoveryHint:
			recoveryMessages.length > 0 ? recoveryMessages.join('; ') : undefined,
		severity: diagnostic.severity === 'info' ? 'warning' : diagnostic.severity,
	};
}

/**
 * Convert a StructuredError to a LogosDiagnostic.
 */
export function structuredErrorToDiagnostic(
	error: StructuredError,
	options?: {
		recoveryHintCategory?: LogosRecoveryHint['category'];
		area?: DiagnosticArea;
	},
): LogosDiagnostic {
	const hints: LogosRecoveryHint[] = [];
	if (error.recoveryHint) {
		hints.push(
			recoveryHint(
				options?.recoveryHintCategory ?? 'manual_review',
				error.recoveryHint,
			),
		);
	}

	const severity: LogosDiagnosticSeverity =
		error.severity === 'warning' ? 'warning' : 'error';

	return createDiagnostic({
		cause: error.cause,
		code: error.code satisfies LogosDiagnosticCode,
		message: error.message,
		path: error.path,
		pointer: error.pointer,
		recoveryHints: hints,
		severity,
	});
}
