/** Structured error helpers for runtime/CLI/service errors */

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
