/**
 * Minimal date utilities used across the LOGOS Engine.
 *
 * All timestamps use ISO 8601 in UTC.
 */

/**
 * Return the current time as an ISO 8601 string (UTC).
 *
 * @example `"2026-05-26T12:00:00.000Z"`
 */
export function nowIso(): string {
	return new Date().toISOString();
}

/**
 * Convert a `Date` or timestamp to an ISO 8601 string (UTC).
 */
export function toIsoString(input: Date | number | string): string {
	const date = input instanceof Date ? input : new Date(input);
	return date.toISOString();
}

/**
 * Parse an ISO 8601 string into a `Date`, returning `null` on invalid input.
 */
export function parseIsoDate(iso: string): Date | null {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}
