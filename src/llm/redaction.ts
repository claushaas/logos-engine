/**
 * Prompt context redaction — sanitizes prompt content before it leaves the machine.
 *
 * Applies deterministic regex-based redaction to detect and mask common
 * secret patterns in `LlmRequest` text (system prompt + messages).
 * Only operates on assembled text content — no repository scanning.
 *
 * ## Redaction categories
 *
 * - `api_key`: OpenAI/Anthropic/OpenRouter-style API keys (`sk-...`).
 * - `bearer_token`: Bearer authentication tokens.
 * - `private_key`: PEM-encoded private key blocks.
 * - `env_assignment`: Environment variable assignments with
 *   sensitive-sounding key names.
 * - `password_like`: Password or passwd inline assignments.
 * - `cloud_credential`: Common cloud credential patterns (AWS access keys).
 *
 * ## Safety properties
 *
 * - **Deterministic**: same input always produces the same output.
 * - **No raw storage**: only per-category match counts are tracked in
 *   diagnostics — raw matches are never retained.
 * - **Preserves non-secret content**: only high-confidence patterns
 *   are matched; arbitrary user text passes through unchanged.
 *
 * @see {@link https://logos-engine/docs/15-real-llm-implementation-roadmap.md §LLM-09}
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §13}
 */
import type { LlmRequest } from '../prompt-orchestration/prompt-assembler.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/** Secret categories recognised by the redaction engine. */
export type RedactionCategory =
	| 'api_key'
	| 'bearer_token'
	| 'private_key'
	| 'env_assignment'
	| 'password_like'
	| 'cloud_credential';

/**
 * Sanitized diagnostics produced by a redaction pass.
 *
 * Only per-category *counts* are stored — raw matches are never retained.
 */
export interface RedactionDiagnostics {
	/** Total number of secrets redacted across all categories. */
	readonly totalMatches: number;

	/**
	 * Breakdown of matches per category.
	 *
	 * Keys with value `0` are omitted.
	 */
	readonly categories: Partial<Record<RedactionCategory, number>>;
}

/** Result of redacting a single text input. */
export interface RedactionResult {
	/** The input text with all matched secrets replaced. */
	readonly redacted: string;

	/** Per-category match diagnostics. */
	readonly diagnostics: RedactionDiagnostics;
}

// ═══════════════════════════════════════════════════════════════════════════
// Redaction patterns
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A redaction pattern: the secret category, its regex, and the
 * replacement string used when the regex matches.
 *
 * Patterns are applied in declaration order (private_key first, then
 * bearer_token, etc.) so broader matches take priority and prevent
 * double-counting of overlapping patterns.
 */
interface RedactionPattern {
	readonly category: RedactionCategory;

	/** Regular expression to match. Must have the `g` flag. */
	readonly regex: RegExp;

	/**
	 * Static replacement string.
	 *
	 * May include `$1` backreferences to preserve captured prefix text
	 * (used for `env_assignment` and `password_like` to keep the key name).
	 */
	readonly replacement: string;
}

/**
 * Ordered redaction patterns.
 *
 * Order matters: broader patterns (private_key, bearer_token) are listed
 * before narrower patterns (api_key, cloud_credential) so overlapping
 * matches are consumed by the higher-priority pattern.
 */
const PATTERNS: readonly RedactionPattern[] = [
	// 1. Private key blocks (PEM) — largest text spans, process first.
	{
		category: 'private_key',
		regex:
			/-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|ENCRYPTED\s+)?PRIVATE\s+KEY-----(?:\r?\n|.)*?-----END\s+(?:RSA\s+|EC\s+|OPENSSH\s+|ENCRYPTED\s+)?PRIVATE\s+KEY-----/gi,
		replacement: '[REDACTED: private_key]',
	},

	// 2. Bearer tokens — may contain api_key patterns within the token
	//    string, so process before the narrower api_key pattern.
	//    Case-insensitive to match Bearer, bearer, BEARER.
	{
		category: 'bearer_token',
		regex: /\bbearer\s+[a-zA-Z0-9_\-=.]{20,}\b/gi,
		replacement: 'Bearer [REDACTED: bearer_token]',
	},

	// 3. .env-style assignments with sensitive-sounding key names.
	//    Must precede api_key — an `API_KEY=sk-...` should be one
	//    env_assignment match, not env_assignment + overlapping api_key.
	//    Preserves the key and separator; replaces only the value.
	{
		category: 'env_assignment',
		regex:
			/\b((?:API[_-]?KEY|SECRET|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN)\s*[:=]\s*)['"]?\S{8,}['"]?/gi,
		replacement: '$1[REDACTED: env]',
	},

	// 4. Password-like inline assignments.
	//    Must precede api_key for the same reason as env_assignment.
	//    Preserves the key and separator; replaces only the value.
	{
		category: 'password_like',
		regex: /\b((?:password|passwd|pwd)\s*[:=]\s*)\S{3,}/gi,
		replacement: '$1[REDACTED: password]',
	},

	// 5. Standalone API keys — `sk-` prefix used by OpenAI, Anthropic,
	//    OpenRouter, and many compatible providers.
	{
		category: 'api_key',
		regex: /\bsk-[a-zA-Z0-9_-]{20,}\b/g,
		replacement: '[REDACTED: api_key]',
	},

	// 6. Cloud credentials — AWS access key IDs.
	{
		category: 'cloud_credential',
		regex: /\bAKIA[0-9A-Z]{16}\b/g,
		replacement: '[REDACTED: cloud_credential]',
	},
];

// ═══════════════════════════════════════════════════════════════════════════
// Core redaction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply all redaction patterns to a text string and return the
 * redacted result together with per-category diagnostics.
 *
 * Patterns are applied in declaration order. Each pattern operates
 * on the text as modified by earlier patterns, so overlapping matches
 * are resolved by priority.
 *
 * @param text — The raw text to redact (system prompt, message body, etc.).
 * @returns The redacted text and match diagnostics (counts only).
 */
export function redactText(text: string): RedactionResult {
	let result = text;
	const categories: Partial<Record<RedactionCategory, number>> = {};
	let totalMatches = 0;

	for (const pattern of PATTERNS) {
		// Reset lastIndex — some regex engines reuse it across calls.
		pattern.regex.lastIndex = 0;

		// Count matches before replacing so we capture the true count.
		const matches = result.match(pattern.regex);
		const count = matches ? matches.length : 0;

		if (count > 0) {
			// Reset lastIndex again after counting (match() also advances it).
			pattern.regex.lastIndex = 0;

			result = result.replace(pattern.regex, pattern.replacement);

			categories[pattern.category] =
				(categories[pattern.category] ?? 0) + count;
			totalMatches += count;
		}
	}

	return {
		diagnostics: { categories, totalMatches },
		redacted: result,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// LlmRequest redaction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Redact the system prompt and all message bodies in an {@link LlmRequest}.
 *
 * Each text field is redacted independently via {@link redactText},
 * and per-field diagnostics are summed into a single aggregate.
 *
 * The request is shallow-cloned; the original {@link LlmRequest} is not
 * mutated. Metadata fields (`schema`, `model`, `temperature`, `metadata`)
 * are passed through unchanged.
 *
 * @param request — The assembled LLM request to redact.
 * @returns A shallow clone of the request with redacted text fields,
 *   plus aggregate diagnostics.
 */
export function redactLlmRequest(request: LlmRequest): {
	redacted: LlmRequest;
	diagnostics: RedactionDiagnostics;
} {
	const aggregated: Partial<Record<RedactionCategory, number>> = {};
	let totalMatches = 0;

	// Redact the system prompt.
	const sysResult = redactText(request.systemPrompt);
	const redactedSystemPrompt = sysResult.redacted;
	mergeDiagnostics(aggregated, sysResult.diagnostics.categories);
	totalMatches += sysResult.diagnostics.totalMatches;

	// Redact each message body.
	const redactedMessages = request.messages.map((msg) => {
		const msgResult = redactText(msg.content);
		totalMatches += msgResult.diagnostics.totalMatches;
		mergeDiagnostics(aggregated, msgResult.diagnostics.categories);
		return { ...msg, content: msgResult.redacted };
	});

	return {
		diagnostics: { categories: aggregated, totalMatches },
		redacted: {
			...request,
			messages: redactedMessages,
			systemPrompt: redactedSystemPrompt,
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge per-field category counts into the aggregate.
 *
 * Mutates `aggregated` in place.
 */
function mergeDiagnostics(
	aggregated: Partial<Record<RedactionCategory, number>>,
	fieldCounts: Partial<Record<RedactionCategory, number>>,
): void {
	for (const [cat, count] of Object.entries(fieldCounts)) {
		if (count === undefined) continue;
		const key = cat as RedactionCategory;
		aggregated[key] = (aggregated[key] ?? 0) + count;
	}
}
