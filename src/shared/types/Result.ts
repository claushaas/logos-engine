/**
 * Result type — a discriminated union for operations that can succeed or fail.
 *
 * Every module in the LOGOS Engine uses `Result` to avoid throwing
 * exceptions for expected failure paths.
 */
export type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };

/** Create a successful result. */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true as const, value };
}

/** Create a failed result. */
export function err<E>(error: E): Result<never, E> {
	return { ok: false as const, error };
}

/** Type guard: narrows to the success variant. */
export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
	return result.ok === true;
}

/** Type guard: narrows to the failure variant. */
export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
	return result.ok === false;
}
