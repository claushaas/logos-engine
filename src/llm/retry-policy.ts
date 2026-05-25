// Purpose: LLM retry policy.
// What it should do: Define retry/backoff behavior for transient provider errors.
// Why it exists: Keeps network/provider instability from leaking into workflow logic.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetryConfig {
	/** Maximum number of retry attempts (default: 3). */
	maxRetries: number;
	/** Base delay in milliseconds before the first retry (default: 1000). */
	baseDelayMs: number;
	/** Maximum delay cap in milliseconds (default: 30_000). */
	maxDelayMs: number;
}

/** Sensible defaults for OpenAI-compatible providers. */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	baseDelayMs: 1000,
	maxDelayMs: 30_000,
	maxRetries: 3,
};

// ─── Classification ─────────────────────────────────────────────────────────

/**
 * Decide whether an error is worth retrying.
 *
 * Retryable cases:
 * - Rate limits (HTTP 429)
 * - Server errors (HTTP 5xx)
 * - Network / DNS / timeout failures from `fetch`
 *
 * Non-retryable cases:
 * - Authentication errors (401, 403)
 * - Bad requests (400, 404)
 * - Validation / parse errors
 */
export function isRetryable(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const message = error.message;
	// Provider HTTP status codes embedded in the error text
	if (message.includes('429')) return true;
	if (/\b5\d{2}\b/.test(message)) return true;
	// Network-level failures surfaced by fetch / Node
	if (
		message.includes('fetch failed') ||
		message.includes('ETIMEDOUT') ||
		message.includes('ECONNRESET') ||
		message.includes('ECONNREFUSED') ||
		message.includes('ENOTFOUND') ||
		message.includes('ENETUNREACH') ||
		/\bnetwork\b/i.test(message) ||
		/\btimeout\b/i.test(message)
	) {
		return true;
	}
	return false;
}

// ─── Backoff ────────────────────────────────────────────────────────────────

/**
 * Calculate the delay for a given retry attempt.
 *
 * Uses exponential backoff with full jitter for better
 * dispersion under contention.
 */
export function backoffDelay(attempt: number, config: RetryConfig): number {
	const exponential = config.baseDelayMs * 2 ** attempt;
	const capped = Math.min(exponential, config.maxDelayMs);
	// Full jitter: random between 0 and capped
	return Math.round(Math.random() * capped);
}

// ─── Wrapper ────────────────────────────────────────────────────────────────

/**
 * Execute an async function, automatically retrying on transient failures.
 *
 * The function `fn` is called at most `maxRetries + 1` times (initial attempt
 * plus retries). Non-retryable errors are re-thrown immediately.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: Partial<RetryConfig> = {},
): Promise<T> {
	const resolved = { ...DEFAULT_RETRY_CONFIG, ...config };

	for (let attempt = 0; attempt <= resolved.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === resolved.maxRetries || !isRetryable(error)) {
				throw error;
			}
			const delay = backoffDelay(attempt, resolved);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	// Unreachable — kept to satisfy TypeScript
	throw new Error('Unreachable: retry loop exhausted.');
}
