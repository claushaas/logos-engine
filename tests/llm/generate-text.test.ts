/**
 * Tests for generateText (LLM-04).
 *
 * Covers the text generation layer with mocked fetch:
 *  - Empty choices → error "no choices".
 *  - Missing message content → returns empty string.
 *  - Null message → returns empty string.
 *  - Missing finish_reason → returns "unknown".
 *  - Token usage extraction from provider response.
 *  - Retryable error → retries and succeeds.
 *  - Non-retryable error → fails immediately (no retry).
 *  - Provider error bodies included in error messages.
 *  - API key never included in thrown error messages.
 *  - No real network calls — fetch is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	GenerateTextInput,
	LlmClientOptions,
} from '../../src/llm/client.js';
import { generateText } from '../../src/llm/generate-text.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const TEST_CONFIG: LlmClientOptions = {
	apiKey: 'sk-test-key-12345',
	baseUrl: 'https://api.example.com/v1',
	model: 'gpt-4.1-mini',
};

const MINIMAL_INPUT: GenerateTextInput = {
	messages: [{ content: 'Hello', role: 'user' }],
};

function mockJsonResponse(body: unknown, status = 200): Response {
	return {
		headers: new Headers(),
		json: () => Promise.resolve(body),
		ok: status < 400,
		status,
		statusText: status === 429 ? 'Too Many Requests' : 'OK',
		text: () =>
			Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
	} as Response;
}

function mockTextResponse(text: string, status = 200): Response {
	return {
		headers: new Headers(),
		json: () => Promise.reject(new Error('Not JSON')),
		ok: status < 400,
		status,
		statusText: 'OK',
		text: () => Promise.resolve(text),
	} as Response;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('generateText', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// ── Basic success ─────────────────────────────────────────────────

	it('returns content and finish_reason on success', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: 'Hello, user!' },
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);

		expect(result.content).toBe('Hello, user!');
		expect(result.finishReason).toBe('stop');
	});

	it('extracts token usage when present', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: 'Hi' },
					},
				],
				usage: {
					completion_tokens: 2,
					prompt_tokens: 10,
					total_tokens: 12,
				},
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);

		expect(result.usage).toBeDefined();
		expect(result.usage!.promptTokens).toBe(10);
		expect(result.usage!.completionTokens).toBe(2);
		expect(result.usage!.totalTokens).toBe(12);
	});

	it('returns undefined usage when not present', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: 'Hi' },
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(result.usage).toBeUndefined();
	});

	// ── Missing / malformed response fields ───────────────────────────

	it('throws when choices array is empty', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse({ choices: [] }));

		await expect(generateText(TEST_CONFIG, MINIMAL_INPUT)).rejects.toThrow(
			'no choices',
		);
	});

	it('throws when choices field is missing', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse({}));

		await expect(generateText(TEST_CONFIG, MINIMAL_INPUT)).rejects.toThrow(
			'no choices',
		);
	});

	it('returns empty content when message.content is missing', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { role: 'assistant' },
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(result.content).toBe('');
	});

	it('returns empty content when message is null', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: null,
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(result.content).toBe('');
	});

	it('returns empty content when message is not an object', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: 'not an object',
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(result.content).toBe('');
	});

	it('returns "unknown" finish_reason when missing', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						message: { content: 'Hi' },
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(result.finishReason).toBe('unknown');
	});

	it('returns "unknown" finish_reason when finish_reason is not a string', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 42,
						message: { content: 'Hi' },
					},
				],
			}),
		);

		const result = await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(result.finishReason).toBe('unknown');
	});

	// ── Provider HTTP errors ──────────────────────────────────────────

	it('includes status code and body in error message for HTTP errors', async () => {
		mockFetch.mockResolvedValueOnce(
			mockTextResponse('{"error":{"message":"Invalid API key"}}', 401),
		);

		await expect(generateText(TEST_CONFIG, MINIMAL_INPUT)).rejects.toThrow(
			/401/,
		);
	});

	it('handles non-JSON error body gracefully', async () => {
		mockFetch.mockResolvedValue({
			headers: new Headers(),
			json: () => Promise.reject(new Error('Not JSON')),
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			text: () => Promise.resolve('Internal Server Error'),
		} as Response);

		await expect(
			generateText({ ...TEST_CONFIG, retry: { maxRetries: 0 } }, MINIMAL_INPUT),
		).rejects.toThrow(/500/);
	});

	it('handles unreadable error body gracefully', async () => {
		mockFetch.mockResolvedValue({
			headers: new Headers(),
			json: () => Promise.resolve({}),
			ok: false,
			status: 503,
			statusText: 'Service Unavailable',
			text: () => Promise.reject(new Error('Cannot read body')),
		} as Response);

		await expect(
			generateText({ ...TEST_CONFIG, retry: { maxRetries: 0 } }, MINIMAL_INPUT),
		).rejects.toThrow(/503/);
	});

	// ── API key safety ────────────────────────────────────────────────

	it('error message does not contain API key on HTTP failure', async () => {
		mockFetch.mockResolvedValueOnce(mockTextResponse('Unauthorized', 401));

		try {
			await generateText(TEST_CONFIG, MINIMAL_INPUT);
			expect.fail('Expected error');
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).not.toContain('sk-test-key-12345');
			expect(msg).not.toContain('Bearer');
		}
	});

	it('error message does not contain API key when response JSON includes error', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ error: { message: 'Invalid API key' } }, 401),
		);

		try {
			await generateText(TEST_CONFIG, MINIMAL_INPUT);
			expect.fail('Expected error');
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).not.toContain('sk-test-key-12345');
		}
	});

	// ── Retry behavior ────────────────────────────────────────────────

	it('retries on 429 (rate limit) and succeeds on retry', async () => {
		mockFetch
			.mockResolvedValueOnce(mockTextResponse('Rate limited', 429))
			.mockResolvedValueOnce(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: 'Retried successfully' },
						},
					],
				}),
			);

		const result = await generateText(
			{ ...TEST_CONFIG, retry: { baseDelayMs: 0, maxRetries: 2 } },
			MINIMAL_INPUT,
		);

		expect(result.content).toBe('Retried successfully');
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('retries on 5xx and succeeds on retry', async () => {
		mockFetch
			.mockResolvedValueOnce(mockTextResponse('Server error', 503))
			.mockResolvedValueOnce(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: 'Recovered' },
						},
					],
				}),
			);

		const result = await generateText(
			{ ...TEST_CONFIG, retry: { baseDelayMs: 0, maxRetries: 2 } },
			MINIMAL_INPUT,
		);

		expect(result.content).toBe('Recovered');
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('does NOT retry on 401 (unauthorized)', async () => {
		mockFetch.mockResolvedValue(mockTextResponse('Unauthorized', 401));

		await expect(
			generateText(
				{ ...TEST_CONFIG, retry: { baseDelayMs: 0, maxRetries: 2 } },
				MINIMAL_INPUT,
			),
		).rejects.toThrow(/401/);

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('does NOT retry on 400 (bad request)', async () => {
		mockFetch.mockResolvedValue(mockTextResponse('Bad request', 400));

		await expect(
			generateText(
				{ ...TEST_CONFIG, retry: { baseDelayMs: 0, maxRetries: 2 } },
				MINIMAL_INPUT,
			),
		).rejects.toThrow(/400/);

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('throws after exhausting retries on retryable errors', async () => {
		mockFetch.mockResolvedValue(mockTextResponse('Server error', 500));

		await expect(
			generateText(
				{ ...TEST_CONFIG, retry: { baseDelayMs: 0, maxRetries: 2 } },
				MINIMAL_INPUT,
			),
		).rejects.toThrow(/500/);

		// Initial + 2 retries = 3 calls
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	// ── Request body construction ─────────────────────────────────────

	it('includes model in request body', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: 'Hi' },
						},
					],
				}),
			);
		});

		await generateText(TEST_CONFIG, MINIMAL_INPUT);
		expect(capturedBody!.model).toBe('gpt-4.1-mini');
	});

	it('includes optional fields when present', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: 'Hi' },
						},
					],
				}),
			);
		});

		await generateText(TEST_CONFIG, {
			maxTokens: 100,
			messages: [{ content: 'Hi', role: 'user' }],
			responseFormat: { type: 'json_schema' },
			stop: ['END'],
			temperature: 0.5,
			topP: 0.9,
		});

		expect(capturedBody!.temperature).toBe(0.5);
		expect(capturedBody!.max_tokens).toBe(100);
		expect(capturedBody!.top_p).toBe(0.9);
		expect(capturedBody!.stop).toEqual(['END']);
		expect(capturedBody!.response_format).toEqual({ type: 'json_schema' });
	});

	it('omits optional fields when not present', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: 'Hi' },
						},
					],
				}),
			);
		});

		await generateText(TEST_CONFIG, MINIMAL_INPUT);

		expect(capturedBody!.temperature).toBeUndefined();
		expect(capturedBody!.max_tokens).toBeUndefined();
		expect(capturedBody!.top_p).toBeUndefined();
		expect(capturedBody!.stop).toBeUndefined();
		expect(capturedBody!.response_format).toBeUndefined();
	});
});
