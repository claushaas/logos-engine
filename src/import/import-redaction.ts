/** Step 12.1 — Import plan secret detection and redaction */

import { redactString } from '../runtime/redaction.js';

// ---------------------------------------------------------------------------
// Secret detection patterns
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
	/\bsk-[a-zA-Z0-9]{20,}\b/g,
	/\bsk-proj-[a-zA-Z0-9\-_]{20,}\b/g,
	/\bgsk_[a-zA-Z0-9]{20,}\b/g,
	/\bhf_[a-zA-Z0-9]{20,}\b/g,
	/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
	/\bBasic\s+[A-Za-z0-9+/=]+\b/gi,
	/\bapi[_-]?key\s*[:=]\s*["']?[A-Za-z0-9\-_]{20,}["']?/gi,
	/\bsecret\s*[:=]\s*["']?[A-Za-z0-9\-_+/=]{20,}["']?/gi,
	/\btoken\s*[:=]\s*["']?[A-Za-z0-9\-_+/=]{20,}["']?/gi,
	/\bpassword\s*[:=]\s*["']?\S{8,}["']?/gi,
	/\bauthorization\s*[:=]\s*["']?[A-Za-z0-9\-_./+=\s]+["']?/gi,
	/\bprivate[_-]?key\s*[:=]\s*["']?[A-Za-z0-9\-_+/=\n\r]{20,}["']?/gi,
	/\baccess[_-]?token\s*[:=]\s*["']?[A-Za-z0-9\-_./+]{20,}["']?/gi,
	/\bclient[_-]?secret\s*[:=]\s*["']?[A-Za-z0-9\-_+/=]{20,}["']?/gi,
	/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
	/\bxox[bp]-[A-Za-z0-9-]{20,}\b/g,
	/\bdapi-[A-Za-z0-9]{32,}\b/g,
	/\bsl\.[A-Za-z0-9\-_]{20,}\b/g,
	/\bAKIA[A-Z0-9]{16}\b/g,
	/\beyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, // JWT tokens
];

const PRIVATE_KEY_PATTERNS = [
	/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
	/-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/,
	/-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/,
	/-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/,
];

const ENV_EXPORT_PATTERNS = [
	/export\s+(?:[A-Z_]+[=]["'][A-Za-z0-9\-_/+]{20,}["'])/,
	/\b\d+_[a-zA-Z0-9\-_]{20,}\b/, // Anthropic-style patterns
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export interface ImportSecretFinding {
	pattern: string;
	location: 'content' | 'frontmatter' | 'heading' | 'metadata';
	line?: number | undefined;
}

/**
 * Scan content for secret-like patterns.
 * Returns true if secrets are found.
 */
export function hasSecretLikeContent(content: string): boolean {
	for (const pattern of SECRET_PATTERNS) {
		pattern.lastIndex = 0;
		if (pattern.test(content)) return true;
	}
	for (const pattern of PRIVATE_KEY_PATTERNS) {
		pattern.lastIndex = 0;
		if (pattern.test(content)) return true;
	}
	for (const pattern of ENV_EXPORT_PATTERNS) {
		pattern.lastIndex = 0;
		if (pattern.test(content)) return true;
	}
	return false;
}

/**
 * Scan content and return findings about detected secrets.
 */
export function scanForSecrets(content: string): ImportSecretFinding[] {
	const findings: ImportSecretFinding[] = [];

	for (const pattern of SECRET_PATTERNS) {
		pattern.lastIndex = 0;
		let match = pattern.exec(content);
		while (match !== null) {
			findings.push({
				location: 'content',
				pattern: pattern.source,
			});
			match = pattern.exec(content);
		}
	}

	for (const pattern of PRIVATE_KEY_PATTERNS) {
		if (pattern.test(content)) {
			findings.push({
				location: 'content',
				pattern: pattern.source,
			});
		}
	}

	for (const pattern of ENV_EXPORT_PATTERNS) {
		if (pattern.test(content)) {
			findings.push({
				location: 'content',
				pattern: pattern.source,
			});
		}
	}

	return findings;
}

/**
 * Redact secret-like values from content for safe inclusion in diagnostics and reports.
 * Uses both the runtime redaction and import-specific patterns.
 */
export function redactImportContent(content: string): string {
	let result = redactString(content);

	// Also apply import-specific patterns that the runtime may miss
	for (const pattern of SECRET_PATTERNS) {
		pattern.lastIndex = 0;
		result = result.replace(pattern, '[REDACTED]');
	}

	for (const pattern of PRIVATE_KEY_PATTERNS) {
		result = result.replace(pattern, '[REDACTED-PRIVATE-KEY]');
	}

	for (const pattern of ENV_EXPORT_PATTERNS) {
		result = result.replace(pattern, '[REDACTED-ENV]');
	}

	return result;
}

/**
 * Generate a safe content snippet (first N chars, redacted).
 */
export function safeContentSnippet(
	content: string,
	maxLength = 200,
): string | undefined {
	if (!content || content.length === 0) return undefined;
	const truncated =
		content.length > maxLength ? `${content.slice(0, maxLength)}...` : content;
	const redacted = redactImportContent(truncated);
	// If the entire snippet was redacted, return a marker
	if (redacted === '[REDACTED]' || redacted.trim().length === 0) {
		return '[content-redacted]';
	}
	return redacted;
}
