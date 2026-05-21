/** Context Redaction — redact secret-like values from intake context */

import {
	redactString,
	redactValue,
	relativizePaths,
} from '../runtime/redaction.js';
import type {
	IntakeContext,
	IntakeContextRedactionResult,
} from './intake-context-types.js';

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

const TOKEN_LIKE_PATTERNS = [
	/\bsk-[a-zA-Z0-9]{20,}\b/,
	/\bsk-proj-[a-zA-Z0-9\-_]{20,}\b/,
	/\bgsk_[a-zA-Z0-9]{20,}\b/,
	/\bhf_[a-zA-Z0-9]{20,}\b/,
	/\bBearer\s+\S+/i,
	/\bBasic\s+\S+/i,
];

function isTokenLike(value: string): boolean {
	return TOKEN_LIKE_PATTERNS.some((p) => p.test(value));
}

const SECRET_KEY_PATTERNS = [
	/token/i,
	/secret/i,
	/password/i,
	/api.*key/i,
	/credential/i,
	/private.*key/i,
	/access.*token/i,
	/refresh.*token/i,
	/client.*secret/i,
];

function isSecretKey(key: string): boolean {
	return SECRET_KEY_PATTERNS.some((p) => p.test(key));
}

// ---------------------------------------------------------------------------
// Redaction result builder
// ---------------------------------------------------------------------------

function scanForRedactions(
	value: unknown,
	category: string | undefined,
	seenCategories: Set<string>,
	seen?: WeakSet<object>,
): number {
	if (value === null || value === undefined) return 0;

	if (typeof value === 'string') {
		if (isTokenLike(value)) {
			if (category) seenCategories.add(category);
			return 1;
		}
		return 0;
	}

	if (typeof value !== 'object') return 0;

	const objectSeen = seen ?? new WeakSet<object>();
	if (objectSeen.has(value)) return 0;
	objectSeen.add(value);

	let count = 0;
	if (Array.isArray(value)) {
		for (const item of value) {
			count += scanForRedactions(item, category, seenCategories, objectSeen);
		}
		objectSeen.delete(value);
		return count;
	}

	for (const [key, item] of Object.entries(value)) {
		const itemCategory = category ?? key;
		if (isSecretKey(key)) {
			seenCategories.add(itemCategory);
			count++;
			continue;
		}
		count += scanForRedactions(item, itemCategory, seenCategories, objectSeen);
	}

	objectSeen.delete(value);
	return count;
}

function buildRedactionResult(
	context: IntakeContext,
	options?: { projectRoot?: string },
): IntakeContextRedactionResult {
	const seenCategories = new Set<string>();
	const redactedKeyCount = scanForRedactions(
		context,
		undefined,
		seenCategories,
	);
	const redactedCategories = [...seenCategories].sort();

	const summaryLines: string[] = [];
	if (redactedCategories.length > 0) {
		summaryLines.push(
			`Redacted ${redactedKeyCount} secret-like value(s) across categories: ${redactedCategories.join(', ')}`,
		);
	} else {
		summaryLines.push('No secret-like values detected in context');
	}

	if (options?.projectRoot) {
		summaryLines.push('Absolute paths relativized for safety');
	}

	return {
		redacted: redactedKeyCount > 0,
		redactedCategories,
		redactedKeyCount,
		summary: summaryLines.join('. '),
	};
}

// ---------------------------------------------------------------------------
// Main redaction function
// ---------------------------------------------------------------------------

export function redactIntakeContext(
	context: IntakeContext,
	options?: { projectRoot?: string },
): IntakeContext {
	const redaction = buildRedactionResult(context, options);
	const redacted = redactValue(context, options) as IntakeContext;
	redacted.redaction = redaction;

	if (options?.projectRoot) {
		return relativizePaths(
			redacted,
			options.projectRoot,
		) as unknown as IntakeContext;
	}

	return redacted;
}

// Re-export helpers for tests
export { isSecretKey, isTokenLike, redactString, redactValue };
