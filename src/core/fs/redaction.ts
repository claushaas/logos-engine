/**
 * LOGOS Core — Secret redaction helpers.
 *
 * Recursively inspects plain objects and arrays to redact values for keys
 * that look secret-like. Does not mutate the input.
 */

const SECRET_KEYS: string[] = [
	'token',
	'secret',
	'password',
	'apikey',
	'api_key',
	'authorization',
	'auth',
	'bearer',
	'credential',
	'privatekey',
	'private_key',
];

function isSecretKey(key: string): boolean {
	return SECRET_KEYS.includes(key.toLowerCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

export function redactSecrets(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => redactSecrets(item));
	}

	if (isPlainObject(value)) {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			if (isSecretKey(key)) {
				result[key] = '[REDACTED]';
			} else {
				result[key] = redactSecrets(val);
			}
		}
		return result;
	}

	return value;
}
