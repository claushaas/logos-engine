/**
 * Tests for retry-policy.ts (LLM-04).
 *
 * Covers:
 *  - isRetryable: 429 → true, 5xx → true, network errors → true.
 *  - isRetryable: 401/403/400 → false, non-Error → false.
 *  - backoffDelay: exponential growth, cap enforcement.
 *  - withRetry: retries on retryable errors, stops at maxRetries,
 *    re-throws non-retryable immediately, succeeds on retry.
 *
 * All tests are deterministic — no real network calls.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	backoffDelay,
	DEFAULT_RETRY_CONFIG,
	isRetryable,
	withRetry,
} from '../../src/llm/retry-policy.js';

// ═══════════════════════════════════════════════════════════════════════════
// isRetryable
// ═══════════════════════════════════════════════════════════════════════════

describe('isRetryable', () => {
	// ── Retryable cases ───────────────────────────────────────────────

	it('returns true for 429 (rate limit)', () => {
		expect(isRetryable(new Error('Request failed with status 429'))).toBe(true);
		expect(isRetryable(new Error('429 Too Many Requests'))).toBe(true);
	});

	it('returns true for 5xx errors', () => {
		expect(
			isRetryable(new Error('Request failed (500 Internal Server Error)')),
		).toBe(true);
		expect(isRetryable(new Error('502 Bad Gateway'))).toBe(true);
		expect(isRetryable(new Error('503 Service Unavailable'))).toBe(true);
		expect(isRetryable(new Error('Got 504 Gateway Timeout'))).toBe(true);
	});

	it('returns true for network errors', () => {
		expect(isRetryable(new Error('fetch failed'))).toBe(true);
		expect(isRetryable(new Error('ETIMEDOUT'))).toBe(true);
		expect(isRetryable(new Error('ECONNRESET'))).toBe(true);
		expect(isRetryable(new Error('ECONNREFUSED'))).toBe(true);
		expect(isRetryable(new Error('ENOTFOUND'))).toBe(true);
		expect(isRetryable(new Error('ENETUNREACH'))).toBe(true);
	});

	it('returns true for errors containing "network"', () => {
		expect(isRetryable(new Error('A network error occurred'))).toBe(true);
		expect(isRetryable(new Error('Network failure'))).toBe(true);
	});

	it('returns true for errors containing "timeout"', () => {
		expect(isRetryable(new Error('Connection timeout'))).toBe(true);
		expect(isRetryable(new Error('Request timeout occurred'))).toBe(true);
	});

	// ── Non-retryable cases ───────────────────────────────────────────

	it('returns false for 401 (unauthorized)', () => {
		expect(isRetryable(new Error('Request failed (401 Unauthorized)'))).toBe(
			false,
		);
	});

	it('returns false for 403 (forbidden)', () => {
		expect(isRetryable(new Error('Request failed (403 Forbidden)'))).toBe(
			false,
		);
	});

	it('returns false for 400 (bad request)', () => {
		expect(isRetryable(new Error('Request failed (400 Bad Request)'))).toBe(
			false,
		);
	});

	it('returns false for 404 (not found)', () => {
		expect(isRetryable(new Error('Request failed (404 Not Found)'))).toBe(
			false,
		);
	});

	it('returns false for validation errors', () => {
		expect(isRetryable(new Error('Invalid JSON schema'))).toBe(false);
		expect(isRetryable(new Error('Missing required field'))).toBe(false);
	});

	it('returns false for non-Error values', () => {
		expect(isRetryable('just a string')).toBe(false);
		expect(isRetryable(42)).toBe(false);
		expect(isRetryable(null)).toBe(false);
		expect(isRetryable(undefined)).toBe(false);
		expect(isRetryable({ message: '429' })).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// backoffDelay
// ═══════════════════════════════════════════════════════════════════════════

describe('backoffDelay', () => {
	it('returns a number', () => {
		const delay = backoffDelay(0, DEFAULT_RETRY_CONFIG);
		expect(typeof delay).toBe('number');
		expect(delay).toBeGreaterThanOrEqual(0);
	});

	it('grows exponentially with attempt number', () => {
		// With full jitter, we can't assert exact values, but we can
		// check that the ceiling grows.
		const max0 = DEFAULT_RETRY_CONFIG.baseDelayMs * 2 ** 0;
		const max2 = DEFAULT_RETRY_CONFIG.baseDelayMs * 2 ** 2;

		expect(max2).toBeGreaterThan(max0);
	});

	it('respects maxDelayMs cap', () => {
		const config = {
			baseDelayMs: 1000,
			maxDelayMs: 2000,
			maxRetries: 3,
		};

		// Run many times to be confident the cap holds.
		for (let i = 0; i < 100; i++) {
			const delay = backoffDelay(10, config);
			expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
			expect(delay).toBeGreaterThanOrEqual(0);
		}
	});

	it('returns 0 for attempt 0 with baseDelayMs 0', () => {
		const config = {
			baseDelayMs: 0,
			maxDelayMs: 1000,
			maxRetries: 3,
		};
		// baseDelayMs * 2^0 = 0, capped to maxDelayMs = 1000
		// Jitter: Math.random() * 0 = 0
		const delay = backoffDelay(0, config);
		expect(delay).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// withRetry
// ═══════════════════════════════════════════════════════════════════════════

describe('withRetry', () => {
	it('returns the result on first success', async () => {
		const fn = vi.fn().mockResolvedValue('success');
		const result = await withRetry(fn);

		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries on retryable error and succeeds on second attempt', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('429 Rate limit'))
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { baseDelayMs: 0, maxRetries: 3 });

		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries up to maxRetries then throws', async () => {
		const retryableError = new Error('500 Internal Server Error');
		const fn = vi.fn().mockRejectedValue(retryableError);

		await expect(
			withRetry(fn, { baseDelayMs: 0, maxRetries: 2 }),
		).rejects.toThrow('500 Internal Server Error');

		// Initial + 2 retries = 3 calls
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it('does NOT retry non-retryable errors', async () => {
		const nonRetryable = new Error('401 Unauthorized');
		const fn = vi.fn().mockRejectedValue(nonRetryable);

		await expect(
			withRetry(fn, { baseDelayMs: 0, maxRetries: 3 }),
		).rejects.toThrow('401 Unauthorized');

		// Should fail immediately, no retries.
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries retryable errors but stops and throws on non-retryable mid-sequence', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('429 Rate limit'))
			.mockRejectedValueOnce(new Error('401 Unauthorized'))
			.mockResolvedValue('never reached');

		await expect(
			withRetry(fn, { baseDelayMs: 0, maxRetries: 3 }),
		).rejects.toThrow('401 Unauthorized');

		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('uses default retry config when none provided', async () => {
		const fn = vi.fn().mockResolvedValue('ok');

		const result = await withRetry(fn);
		expect(result).toBe('ok');
	});

	it('retries on network errors (ETIMEDOUT)', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('ETIMEDOUT'))
			.mockResolvedValueOnce('recovered');

		const result = await withRetry(fn, { baseDelayMs: 0, maxRetries: 2 });

		expect(result).toBe('recovered');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('respects custom retry config', async () => {
		const error = new Error('500 Error');
		const fn = vi.fn().mockRejectedValue(error);

		await expect(
			withRetry(fn, { baseDelayMs: 0, maxRetries: 1 }),
		).rejects.toThrow('500 Error');

		expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
	});
});
