/**
 * Tests for generateStructuredOutput (LLM-04).
 *
 * Covers the structured-output layer with mocked `fetch`:
 *  - JSON parsing from generated text content.
 *  - Schema validation pass-through (optional Zod schema).
 *  - Schema validation failure.
 *  - JSON parse failure handling.
 *  - Response format passthrough to the request body.
 *  - generateStructuredOutputSafe: returns ValidationOutcome.
 *
 * All tests mock `fetch` — no real network calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import type { LlmClientOptions } from '../../src/llm/client.js';
import {
	generateStructuredOutput,
	generateStructuredOutputSafe,
} from '../../src/llm/generate-structured-output.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const TEST_CONFIG: LlmClientOptions = {
	apiKey: 'sk-test',
	baseUrl: 'https://api.example.com/v1',
	model: 'gpt-4.1-mini',
};

const TEST_SCHEMA = {
	jsonSchema: {
		properties: { name: { type: 'string' } },
		required: ['name'],
		type: 'object',
	},
	messages: [{ content: 'Say hello', role: 'user' as const }],
	schemaName: 'TestOutput',
	strict: false,
};

function mockJsonResponse(body: unknown, status = 200): Response {
	return {
		headers: new Headers(),
		json: () => Promise.resolve(body),
		ok: status < 400,
		status,
		statusText: status >= 400 ? 'Error' : 'OK',
		text: () =>
			Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
	} as Response;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('generateStructuredOutput', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// ── JSON parsing ──────────────────────────────────────────────────

	it('parses JSON from generateText content', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{"name": "Alice"}' },
					},
				],
			}),
		);

		const result = await generateStructuredOutput(TEST_CONFIG, TEST_SCHEMA);

		expect(result).toEqual({ name: 'Alice' });
	});

	it('parses complex nested JSON', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: JSON.stringify({
								nested: { array: [1, 2, 3], value: true },
								text: 'Hello',
							}),
						},
					},
				],
			}),
		);

		const result = await generateStructuredOutput(TEST_CONFIG, TEST_SCHEMA);

		expect(result).toEqual({
			nested: { array: [1, 2, 3], value: true },
			text: 'Hello',
		});
	});

	it('throws on invalid JSON', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: 'not valid json{{{!' },
					},
				],
			}),
		);

		await expect(
			generateStructuredOutput(TEST_CONFIG, TEST_SCHEMA),
		).rejects.toThrow('Failed to parse structured output JSON');
	});

	it('error message includes the underlying parse error', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{broken' },
					},
				],
			}),
		);

		try {
			await generateStructuredOutput(TEST_CONFIG, TEST_SCHEMA);
			expect.fail('Expected error');
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).toContain('Failed to parse structured output JSON');
		}
	});

	// ── Schema validation ─────────────────────────────────────────────

	it('returns typed output when schema validator is provided', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{"name": "Bob"}' },
					},
				],
			}),
		);

		const schema = z.object({ name: z.string() });

		const result = await generateStructuredOutput(TEST_CONFIG, {
			...TEST_SCHEMA,
			schema,
		});

		expect(result.name).toBe('Bob');
	});

	it('throws when schema validation fails', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{"name": 42}' },
					},
				],
			}),
		);

		const schema = z.object({ name: z.string() });

		await expect(
			generateStructuredOutput(TEST_CONFIG, { ...TEST_SCHEMA, schema }),
		).rejects.toThrow();
	});

	// ── Response format passthrough ───────────────────────────────────

	it('passes response_format.json_schema in request body', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: '{}' },
						},
					],
				}),
			);
		});

		await generateStructuredOutput(TEST_CONFIG, {
			...TEST_SCHEMA,
			strict: true,
		});

		const rf = capturedBody!.response_format as Record<string, unknown>;
		expect(rf.type).toBe('json_schema');

		const js = rf.json_schema as Record<string, unknown>;
		expect(js.name).toBe('TestOutput');
		expect(js.schema).toEqual(TEST_SCHEMA.jsonSchema);
		expect(js.strict).toBe(true);
	});

	it('defaults strict to true when not specified', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: '{}' },
						},
					],
				}),
			);
		});

		await generateStructuredOutput(TEST_CONFIG, {
			jsonSchema: TEST_SCHEMA.jsonSchema,
			messages: TEST_SCHEMA.messages,
			schemaName: TEST_SCHEMA.schemaName,
		});

		const rf = capturedBody!.response_format as Record<string, unknown>;
		const js = rf.json_schema as Record<string, unknown>;
		expect(js.strict).toBe(true);
	});

	it('passes temperature and maxTokens when present', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: '{}' },
						},
					],
				}),
			);
		});

		await generateStructuredOutput(TEST_CONFIG, {
			...TEST_SCHEMA,
			maxTokens: 500,
			temperature: 0.3,
		});

		expect(capturedBody!.temperature).toBe(0.3);
		expect(capturedBody!.max_tokens).toBe(500);
	});

	it('defaults temperature to 0 when not specified', async () => {
		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: { content: '{}' },
						},
					],
				}),
			);
		});

		await generateStructuredOutput(TEST_CONFIG, TEST_SCHEMA);

		expect(capturedBody!.temperature).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// generateStructuredOutputSafe
// ═══════════════════════════════════════════════════════════════════════════

describe('generateStructuredOutputSafe', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns valid outcome on success', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{"name": "Alice"}' },
					},
				],
			}),
		);

		const result = await generateStructuredOutputSafe(TEST_CONFIG, TEST_SCHEMA);

		expect(result.valid).toBe(true);
		expect(result.data).toEqual({ name: 'Alice' });
		expect(result.issues).toEqual([]);
	});

	it('returns invalid outcome on JSON parse failure', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: 'not json' },
					},
				],
			}),
		);

		const result = await generateStructuredOutputSafe(TEST_CONFIG, TEST_SCHEMA);

		expect(result.valid).toBe(false);
		expect(result.data).toBeNull();
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it('reports schema validation issues when schema is provided and fails', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{"name": 42}' },
					},
				],
			}),
		);

		const schema = z.object({ name: z.string() });

		const result = await generateStructuredOutputSafe(TEST_CONFIG, {
			...TEST_SCHEMA,
			schema,
		});

		expect(result.valid).toBe(false);
		expect(result.data).toBeNull();
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it('returns valid outcome with schema validation on success', async () => {
		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '{"name": "Bob"}' },
					},
				],
			}),
		);

		const schema = z.object({ name: z.string() });

		const result = await generateStructuredOutputSafe(TEST_CONFIG, {
			...TEST_SCHEMA,
			schema,
		});

		expect(result.valid).toBe(true);
		expect(result.data).toEqual({ name: 'Bob' });
	});

	it('handles provider returning an HTTP error', async () => {
		mockFetch.mockResolvedValue(
			mockJsonResponse({ error: 'Server error' }, 500),
		);

		const result = await generateStructuredOutputSafe(
			{ ...TEST_CONFIG, retry: { maxRetries: 0 } },
			TEST_SCHEMA,
		);

		expect(result.valid).toBe(false);
		expect(result.data).toBeNull();
		expect(result.issues.length).toBeGreaterThan(0);
		expect(result.issues[0]!.message).toContain('500');
	});
});
