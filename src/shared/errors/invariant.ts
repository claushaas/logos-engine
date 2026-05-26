import { LogosError } from './LogosError.js';

/**
 * Invariant assertion — condition must be `true` at runtime.
 *
 * Throws a `LogosError` with code `LOGOS_INVARIANT_VIOLATION` if the
 * condition is falsy. Uses `asserts condition` to narrow types after
 * the call.
 *
 * @param condition - The condition that must be truthy.
 * @param message - A descriptive message explaining the violation.
 */
export function invariant(
	condition: unknown,
	message: string,
): asserts condition {
	if (!condition) {
		throw new LogosError(
			'LOGOS_INVARIANT_VIOLATION',
			'invalid_state',
			`Invariant violation: ${message}`,
			{
				details: { condition: String(condition), message },
				recoverable: false,
			},
		);
	}
}
