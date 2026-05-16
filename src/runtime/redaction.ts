/** Redaction helpers for paths and secret-like values */

import { isAbsolute, relative } from 'node:path';

/** Keys that suggest secret-like values */
const SECRET_KEY_PATTERNS = [
	/^token$/i,
	/^api_?key$/i,
	/^secret$/i,
	/^password$/i,
	/^authorization$/i,
	/^bearer$/i,
	/^auth$/i,
	/^credential$/i,
	/^private_?key$/i,
	/^access_?token$/i,
	/^refresh_?token$/i,
	/^client_?secret$/i,
	/^sk-\w+$/i, // OpenAI-style key names
];

/** String patterns that look like provider tokens */
const SECRET_VALUE_PATTERNS = [
	/^Bearer\s+\S+/i,
	/^Basic\s+\S+/i,
	/^sk-[a-zA-Z0-9]{20,}$/, // OpenAI-style
	/^sk-proj-[a-zA-Z0-9\-_]{20,}$/, // OpenAI project keys
	/^gsk_[a-zA-Z0-9]{20,}$/, // Groq-style
	/^hf_[a-zA-Z0-9]{20,}$/, // HuggingFace
	/^\d{4}-[a-zA-Z0-9\-_]{20,}$/, // Anthropic-style patterns
];

const REDACTED_PLACEHOLDER = '[REDACTED]';

function isSecretKey(key: string): boolean {
	return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function looksLikeSecretValue(value: string): boolean {
	return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export interface RedactionOptions {
	/** Relativize absolute paths against this root */
	projectRoot?: string;
	/** Custom keys to redact in addition to defaults */
	additionalSecretKeys?: string[];
	/** Minimum string length to treat as a potential secret value */
	minSecretLength?: number;
}

function shouldRedactKey(key: string, additionalKeys?: string[]): boolean {
	if (isSecretKey(key)) return true;
	if (additionalKeys) {
		const lowerKey = key.toLowerCase();
		for (const ak of additionalKeys) {
			if (lowerKey === ak.toLowerCase()) return true;
		}
	}
	return false;
}

/** Redact a string in-place, replacing secret-like values */
export function redactString(
	input: string,
	_options?: RedactionOptions,
): string {
	if (!input || typeof input !== 'string') return input;

	let result = input;

	// Replace authorization/bearer headers
	result = result.replace(
		/(Authorization\s*[:=]\s*).*/gi,
		`$1${REDACTED_PLACEHOLDER}`,
	);
	result = result.replace(/(Bearer\s+)\S+/gi, `$1${REDACTED_PLACEHOLDER}`);

	// Replace common "key": "value" and key=value patterns for secrets
	for (const pattern of SECRET_KEY_PATTERNS) {
		result = result.replace(
			new RegExp(
				`(["']?${pattern.source}["']?\\s*[:=]\\s*)(["']?)[^\\s,"'\n\r]+\\2`,
				'gi',
			),
			`$1$2${REDACTED_PLACEHOLDER}$2`,
		);
	}

	// Replace standalone token-like values
	result = result.replace(/\b(sk-[a-zA-Z0-9]{20,})\b/g, REDACTED_PLACEHOLDER);
	result = result.replace(/\b(gsk_[a-zA-Z0-9]{20,})\b/g, REDACTED_PLACEHOLDER);
	result = result.replace(/\b(hf_[a-zA-Z0-9]{20,})\b/g, REDACTED_PLACEHOLDER);

	return result;
}

/** Recursively redact values in an object/array/primitive */
export function redactValue(
	value: unknown,
	options?: RedactionOptions,
	seen?: WeakSet<object>,
): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === 'string') {
		return redactString(value, options);
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'function' || typeof value === 'symbol') {
		return undefined;
	}
	if (Array.isArray(value)) {
		const arrSeen = seen ?? new WeakSet<object>();
		if (arrSeen.has(value)) return '[Circular]';
		arrSeen.add(value);
		const result = value.map((item) => redactValue(item, options, arrSeen));
		arrSeen.delete(value);
		return result;
	}
	if (typeof value === 'object') {
		const objSeen = seen ?? new WeakSet<object>();
		if (objSeen.has(value)) return '[Circular]';
		objSeen.add(value);
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			if (shouldRedactKey(key, options?.additionalSecretKeys)) {
				result[key] =
					typeof val === 'string' && looksLikeSecretValue(val)
						? REDACTED_PLACEHOLDER
						: REDACTED_PLACEHOLDER;
			} else {
				result[key] = redactValue(val, options, objSeen);
			}
		}
		objSeen.delete(value);
		return result;
	}
	return value;
}

/** Relativize absolute paths for test/JSON stability */
export function relativizePaths(
	value: unknown,
	projectRoot: string,
	seen?: WeakSet<object>,
): unknown {
	if (!projectRoot) return value;
	if (typeof value === 'string') {
		if (isAbsolute(value)) {
			try {
				return relative(projectRoot, value) || '.';
			} catch {
				return value;
			}
		}
		return value;
	}
	if (value === null || typeof value !== 'object') return value;
	if (Array.isArray(value)) {
		const arrSeen = seen ?? new WeakSet<object>();
		if (arrSeen.has(value)) return '[Circular]';
		arrSeen.add(value);
		const result = value.map((item) =>
			relativizePaths(item, projectRoot, arrSeen),
		);
		arrSeen.delete(value);
		return result;
	}
	const objSeen = seen ?? new WeakSet<object>();
	if (objSeen.has(value)) return '[Circular]';
	objSeen.add(value);
	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value)) {
		result[key] = relativizePaths(val, projectRoot, objSeen);
	}
	objSeen.delete(value);
	return result;
}

/** Convenience: redact and optionally relativize paths */
export function redactAndRelativize(
	value: unknown,
	options?: RedactionOptions,
): unknown {
	let result = redactValue(value, options);
	if (options?.projectRoot) {
		result = relativizePaths(result, options.projectRoot);
	}
	return result;
}
