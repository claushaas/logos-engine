/**
 * Tests for OpenAiCompatibleLlmProvider (LLM-03).
 *
 * All tests use mocked `fetch` — no real network calls, no credentials
 * required. The adapter is tested against the {@link LlmProvider} contract.
 *
 * Covered:
 *  - Adapter implements LlmProvider.
 *  - Calls `/chat/completions` with correct URL, method, and headers.
 *  - Sends `response_format: { type: "json_schema" }` with schema name
 *    and schema body.
 *  - Maps provider JSON response to AgentTurnOutput.
 *  - Captures sanitized diagnostics (no API key, hostname only).
 *  - Uses request-level model/temperature when present; falls back to
 *    provider config.
 *  - Maps LlmRequest (systemPrompt + messages) to provider messages
 *    (system, user, assistant).
 *  - Handles provider HTTP errors without leaking API keys.
 *  - Handles JSON parse failures gracefully.
 *  - Handles missing userFacingMessage gracefully.
 *  - Does NOT make real network calls in any test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AGENT_TURN_OUTPUT_SCHEMA_NAME } from '../../src/contracts/agent-turn.schema.js';
import type { AgentTurnOutput } from '../../src/contracts/index.js';
import { resolveProviderConfig } from '../../src/llm/config.js';
import {
	OpenAiCompatibleLlmProvider,
	type ProviderCallDiagnostics,
} from '../../src/llm/openai-compatible-provider.js';
import type { LlmRequest } from '../../src/prompt-orchestration/prompt-assembler.js';
import { LogosError } from '../../src/shared/errors/LogosError.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a minimal {@link LlmRequest} for testing.
 */
function makeRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
	return {
		messages: [{ content: 'What is the core thesis?', role: 'user' }],
		schema: {},
		systemPrompt: 'You are an expert interviewer.',
		...overrides,
	};
}

/**
 * Build a mock fetch Response with JSON body and status 200.
 */
function mockJsonResponse(
	body: unknown,
	options: { status?: number; headers?: Record<string, string> } = {},
): Response {
	return {
		headers: new Headers(options.headers ?? {}),
		json: () => Promise.resolve(body),
		ok: (options.status ?? 200) < 400,
		status: options.status ?? 200,
		statusText: options.status === 401 ? 'Unauthorized' : 'OK',
		text: () =>
			Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
	} as Response;
}

/**
 * A valid minimal AgentTurnOutput that the provider might return.
 */
const VALID_OUTPUT: AgentTurnOutput = {
	userFacingMessage: 'What conviction makes this project necessary?',
};

/**
 * A valid synthesis output with canonical answer draft.
 */
const VALID_SYNTHESIS_OUTPUT: AgentTurnOutput = {
	canonicalAnswerDraft: {
		confidence: 'high',
		content: '## Core Thesis\n\nThe project exists because...',
		format: 'markdown',
		generatedAt: '2026-05-27T00:00:00.000Z',
		generatedFromMessageIds: ['msg_001'],
	},
	completenessEvaluation: {
		blockingIssues: [],
		complete: true,
		coverage: { 'central conviction': 'sufficient' },
		missing: [],
		weak: [],
	},
	proposedLifecycle: 'synthesized',
	proposedPromptState: 'review',
	suggestedActions: ['accept', 'edit', 'regenerate'],
	userFacingMessage: "Here's the synthesized canonical answer for your review.",
};

/**
 * Set up a real-mode provider config with a test API key in the environment.
 */
function setupProviderConfig(overrides: Record<string, string> = {}): void {
	process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
	process.env.LOGOS_LLM_API_KEY = 'sk-test-mock-key';
	process.env.LOGOS_LLM_MODEL = 'gpt-4.1-mini';
	process.env.LOGOS_DISCLOSURE_ACCEPTED = 'true';
	for (const [key, value] of Object.entries(overrides)) {
		process.env[key] = value;
	}
}

/**
 * Clear relevant environment variables.
 */
function clearProviderEnv(): void {
	delete process.env.LOGOS_LLM_PROVIDER;
	delete process.env.LOGOS_LLM_API_KEY;
	delete process.env.LOGOS_LLM_MODEL;
	delete process.env.LOGOS_LLM_BASE_URL;
	delete process.env.LOGOS_LLM_TOKEN_ENV;
	delete process.env.LOGOS_USE_MOCK_LLM;
	delete process.env.LOGOS_DISCLOSURE_ACCEPTED;
	delete process.env.LOGOS_ENV_FILE;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('OpenAiCompatibleLlmProvider', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		vi.stubGlobal('fetch', mockFetch);
		setupProviderConfig();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		clearProviderEnv();
	});

	// ── 1. Implements LlmProvider ────────────────────────────────────

	it('implements LlmProvider interface', () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});
		const provider = new OpenAiCompatibleLlmProvider(config);

		// TypeScript structural check: the class satisfies the interface.
		expect(typeof provider.generateStructuredOutput).toBe('function');
	});

	// ── 1.5. Disclosure gate (LLM-08) ──────────────────────────────

	it('blocks remote call when disclosure is not accepted', async () => {
		// Override the setupProviderConfig default of LOGOS_DISCLOSURE_ACCEPTED=true
		process.env.LOGOS_DISCLOSURE_ACCEPTED = 'false';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
			// disclosureAccepted defaults to false when env says 'false'.
		});

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_DISCLOSURE_NOT_ACCEPTED');
			expect(le.category).toBe('llm_provider');
			expect(le.recoverable).toBe(true);
		}

		// The mock fetch must NOT have been called — the gate blocks before
		// any network request is attempted.
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('blocks remote call when disclosureAccepted is explicitly false', async () => {
		const config = resolveProviderConfig({
			disclosureAccepted: false,
			provider: 'openai-compatible',
		});

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_DISCLOSURE_NOT_ACCEPTED');
		}

		// Verify no fetch was attempted.
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('allows remote call when disclosure is accepted', async () => {
		const config = resolveProviderConfig({
			disclosureAccepted: true,
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		const result = await provider.generateStructuredOutput(makeRequest());

		expect(result.userFacingMessage).toBe(VALID_OUTPUT.userFacingMessage);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('disclosure error message does not contain API key', async () => {
		process.env.LOGOS_LLM_API_KEY = 'sk-very-secret-disclosure-key';
		const config = resolveProviderConfig({
			disclosureAccepted: false,
			provider: 'openai-compatible',
		});

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).not.toContain('sk-very-secret-disclosure-key');

			if (error instanceof LogosError) {
				const detailsStr = JSON.stringify(error.details);
				expect(detailsStr).not.toContain('sk-very-secret-disclosure-key');
			}
		}
	});

	// ── 2. Calls /chat/completions ───────────────────────────────────

	it('calls /chat/completions with correct URL', async () => {
		const config = resolveProviderConfig({
			baseUrl: 'https://api.openai.com/v1',
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		expect(mockFetch).toHaveBeenCalledTimes(1);

		const url = mockFetch.mock.calls[0]?.[0] as string;
		expect(url).toBe('https://api.openai.com/v1/chat/completions');
	});

	it('sends POST request with correct headers', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		const options = mockFetch.mock.calls[0]?.[1] as RequestInit;
		expect(options.method).toBe('POST');
		expect((options.headers as Record<string, string>)['Content-Type']).toBe(
			'application/json',
		);
		expect((options.headers as Record<string, string>).Authorization).toBe(
			'Bearer sk-test-mock-key',
		);
	});

	// ── 3. Sends response_format.json_schema ─────────────────────────

	it('sends response_format.type = "json_schema"', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		expect(capturedBody).not.toBeNull();
		const rf = capturedBody!.response_format as Record<string, unknown>;
		expect(rf.type).toBe('json_schema');

		const js = rf.json_schema as Record<string, unknown>;
		expect(js.name).toBe(AGENT_TURN_OUTPUT_SCHEMA_NAME);
		expect(js.schema).toBeDefined();
		expect(js.strict).toBe(false);
	});

	it('includes the AgentTurnOutput JSON Schema in the request', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		const rf = capturedBody!.response_format as Record<string, unknown>;
		const js = rf.json_schema as Record<string, unknown>;
		const schema = js.schema as Record<string, unknown>;

		// The schema should be the canonical JSON Schema for AgentTurnOutput.
		expect(schema.type).toBe('object');
		expect(schema.additionalProperties).toBe(true);
		expect(schema.required as string[]).toContain('userFacingMessage');
	});

	// ── 4. Maps provider JSON response to AgentTurnOutput ────────────

	it('returns parsed AgentTurnOutput from provider response', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		const result = await provider.generateStructuredOutput(makeRequest());

		expect(result.userFacingMessage).toBe(VALID_OUTPUT.userFacingMessage);
	});

	it('returns full synthesis output with all fields', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: JSON.stringify(VALID_SYNTHESIS_OUTPUT),
						},
					},
				],
				usage: {
					completion_tokens: 150,
					prompt_tokens: 500,
					total_tokens: 650,
				},
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		const result = await provider.generateStructuredOutput(makeRequest());

		expect(result.userFacingMessage).toBe(
			VALID_SYNTHESIS_OUTPUT.userFacingMessage,
		);
		expect(result.proposedLifecycle).toBe('synthesized');
		expect(result.proposedPromptState).toBe('review');
		expect(result.suggestedActions).toEqual(['accept', 'edit', 'regenerate']);
		expect(result.canonicalAnswerDraft).toBeDefined();
		expect(result.canonicalAnswerDraft!.confidence).toBe('high');
		expect(result.canonicalAnswerDraft!.format).toBe('markdown');
		expect(result.completenessEvaluation).toBeDefined();
		expect(result.completenessEvaluation!.complete).toBe(true);
	});

	it('passes extra passthrough fields through', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		const outputWithExtra = {
			...VALID_OUTPUT,
			_extraField: 'should survive',
		};

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: JSON.stringify(outputWithExtra),
						},
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		const result = await provider.generateStructuredOutput(makeRequest());

		expect((result as Record<string, unknown>)._extraField).toBe(
			'should survive',
		);
	});

	// ── 5. Captures sanitized diagnostics ───────────────────────────

	it('captures sanitized provider diagnostics after a call', async () => {
		const config = resolveProviderConfig({
			baseUrl: 'https://api.openai.com/v1',
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
				usage: {
					completion_tokens: 50,
					prompt_tokens: 200,
					total_tokens: 250,
				},
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		const diag: ProviderCallDiagnostics | null = provider.lastDiagnostics;
		expect(diag).not.toBeNull();

		if (diag) {
			expect(diag.provider).toBe('openai-compatible');
			expect(diag.model).toBe('gpt-4.1-mini');
			expect(diag.baseUrlHost).toBe('api.openai.com');
			expect(typeof diag.latencyMs).toBe('number');
			expect(diag.latencyMs).toBeGreaterThanOrEqual(0);
			expect(diag.finishReason).toBe('stop');
			expect(diag.tokenUsage).toBeDefined();
			expect(diag.tokenUsage!.prompt).toBe(200);
			expect(diag.tokenUsage!.completion).toBe(50);
			expect(diag.tokenUsage!.total).toBe(250);
		}
	});

	it('diagnostics never include API key', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		const diag = provider.lastDiagnostics;
		expect(diag).not.toBeNull();

		// Serialize and verify no API key present.
		const serialized = JSON.stringify(diag);
		expect(serialized).not.toContain('sk-test-mock-key');
		expect(serialized).not.toContain('Bearer');
		expect(serialized).not.toContain('apiKey');
		expect(serialized).not.toContain('api_key');
	});

	it('diagnostics baseUrlHost is hostname only, not full URL', async () => {
		const config = resolveProviderConfig({
			baseUrl: 'https://custom.provider.com:8443/v1/secret-path',
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: JSON.stringify(VALID_OUTPUT) },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		const diag = provider.lastDiagnostics;
		expect(diag).not.toBeNull();
		expect(diag!.baseUrlHost).toBe('custom.provider.com:8443');
		// Must not contain the full path.
		expect(diag!.baseUrlHost).not.toContain('/v1');
		expect(diag!.baseUrlHost).not.toContain('secret');
	});

	it('lastDiagnostics is null before first call', () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});
		const provider = new OpenAiCompatibleLlmProvider(config);

		expect(provider.lastDiagnostics).toBeNull();
	});

	// ── 6. Model / temperature passthrough ───────────────────────────

	it('uses request-level model when present', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest({ model: 'gpt-4o' }));

		expect(capturedBody!.model).toBe('gpt-4o');
	});

	it('falls back to config model when request does not specify one', async () => {
		const config = resolveProviderConfig({
			model: 'gpt-4.1-mini',
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		expect(capturedBody!.model).toBe('gpt-4.1-mini');
	});

	it('passes request temperature when present', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest({ temperature: 0.7 }));

		expect(capturedBody!.temperature).toBe(0.7);
	});

	it('omits temperature when not present in request', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(makeRequest());

		expect(capturedBody!.temperature).toBeUndefined();
	});

	// ── 7. Message mapping ───────────────────────────────────────────

	it('maps systemPrompt to system message', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(
			makeRequest({
				messages: [
					{
						content: 'User question',
						role: 'user',
					},
				],
				systemPrompt: 'Custom system instruction.',
			}),
		);

		const messages = capturedBody!.messages as Array<{
			role: string;
			content: string;
		}>;

		expect(messages.length).toBe(2);
		expect(messages[0]!.role).toBe('system');
		expect(messages[0]!.content).toBe('Custom system instruction.');
		expect(messages[1]!.role).toBe('user');
		expect(messages[1]!.content).toBe('User question');
	});

	it('maps user and assistant messages correctly', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		let capturedBody: Record<string, unknown> | null = null;
		mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
			return Promise.resolve(
				mockJsonResponse({
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: JSON.stringify(VALID_OUTPUT),
							},
						},
					],
				}),
			);
		});

		const provider = new OpenAiCompatibleLlmProvider(config);
		await provider.generateStructuredOutput(
			makeRequest({
				messages: [
					{ content: 'First user msg', role: 'user' },
					{ content: 'Assistant reply', role: 'assistant' },
					{ content: 'Second user msg', role: 'user' },
				],
			}),
		);

		const messages = capturedBody!.messages as Array<{
			role: string;
			content: string;
		}>;

		// system + 3 conversation messages
		expect(messages.length).toBe(4);
		expect(messages[1]!.role).toBe('user');
		expect(messages[1]!.content).toBe('First user msg');
		expect(messages[2]!.role).toBe('assistant');
		expect(messages[2]!.content).toBe('Assistant reply');
		expect(messages[3]!.role).toBe('user');
		expect(messages[3]!.content).toBe('Second user msg');
	});

	// ── 8. Error handling ────────────────────────────────────────────

	it('throws LogosError with llm_provider category on HTTP error', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse(
				{ error: { message: 'Invalid API key' } },
				{ status: 401 },
			),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.category).toBe('llm_provider');
			expect(le.code).toBe('LOGOS_PROVIDER_ERROR');
			expect(le.recoverable).toBe(true);
		}
	});

	it('error message does not contain API key on HTTP failure', async () => {
		process.env.LOGOS_LLM_API_KEY = 'sk-very-secret-token';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse(
				{ error: { message: 'Invalid API key' } },
				{ status: 401 },
			),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			const le = error as LogosError;
			// The error message must not contain the API key.
			expect(le.message).not.toContain('sk-very-secret-token');
			// The details must not contain the API key.
			const detailsStr = JSON.stringify(le.details);
			expect(detailsStr).not.toContain('sk-very-secret-token');
		}
	});

	it('throws LogosError on JSON parse failure', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

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

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_JSON_PARSE_FAILED');
			expect(le.category).toBe('structured_output');
			expect(le.recoverable).toBe(true);
		}
	});

	it('throws LogosError when response is not a JSON object', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '"just a string"' },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_INVALID_OUTPUT_SHAPE');
			expect(le.category).toBe('structured_output');
		}
	});

	it('throws LogosError when response is an array', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: { content: '[1, 2, 3]' },
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_INVALID_OUTPUT_SHAPE');
		}
	});

	it('throws LogosError when userFacingMessage is missing', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: JSON.stringify({
								proposedLifecycle: 'active',
							}),
						},
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_MISSING_USER_FACING_MESSAGE');
			expect(le.category).toBe('structured_output');
		}
	});

	it('throws LogosError when userFacingMessage is whitespace-only', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: JSON.stringify({
								userFacingMessage: '   ',
							}),
						},
					},
				],
			}),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_MISSING_USER_FACING_MESSAGE');
		}
	});

	it('throws when API key env var is missing', async () => {
		delete process.env.LOGOS_LLM_API_KEY;
		// Prevent .env loading from polluting the test.
		process.env.LOGOS_ENV_FILE = '/tmp/logos-nonexistent-env-file.env';

		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_PROVIDER_UNCONFIGURED');
			expect(le.category).toBe('llm_provider');
			expect(le.recoverable).toBe(true);
			// Error message should mention the token env var, not the token value.
			expect(le.message).toContain('LOGOS_LLM_API_KEY');
		}
	});

	it('does not make real network calls — fetch is mocked', () => {
		// This test verifies that the test suite itself never makes real
		// network calls. If fetch had not been mocked, this would fail.
		expect(mockFetch).toBeDefined();
		expect(vi.isMockFunction(mockFetch)).toBe(true);
	});

	// ── 9. Edge cases from provider (LLM-04) ─────────────────────────

	it('handles empty choices from provider gracefully', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
			retry: { maxRetries: 0 },
		});

		mockFetch.mockResolvedValueOnce(mockJsonResponse({ choices: [] }));

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.category).toBe('llm_provider');
			expect(le.code).toBe('LOGOS_PROVIDER_ERROR');
			expect(le.message).toContain('no choices');
		}
	});

	it('handles missing choices field from provider', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
			retry: { maxRetries: 0 },
		});

		mockFetch.mockResolvedValueOnce(mockJsonResponse({}));

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.category).toBe('llm_provider');
			expect(le.message).toContain('no choices');
		}
	});

	it('handles message with no content from provider', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

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

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			// Empty content → JSON.parse('') fails first.
			expect(le.code).toBe('LOGOS_JSON_PARSE_FAILED');
			expect(le.category).toBe('structured_output');
		}
	});

	it('handles 403 Forbidden as a non-retryable provider error', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ error: { message: 'Forbidden' } }, 403),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_PROVIDER_ERROR');
			expect(le.category).toBe('llm_provider');
			expect(le.recoverable).toBe(true);
		}
	});

	it('error message does not contain API key on 403 response', async () => {
		process.env.LOGOS_LLM_API_KEY = 'sk-very-secret-token';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ error: { message: 'Forbidden' } }, 403),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).not.toContain('sk-very-secret-token');

			if (error instanceof LogosError) {
				const detailsStr = JSON.stringify(error.details);
				expect(detailsStr).not.toContain('sk-very-secret-token');
			}
		}
	});

	it('handles 500 server error (retryable) as provider error', async () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
			retry: { maxRetries: 0 },
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ error: { message: 'Server error' } }, 500),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(LogosError);
			const le = error as LogosError;
			expect(le.code).toBe('LOGOS_PROVIDER_ERROR');
			expect(le.category).toBe('llm_provider');
			expect(le.recoverable).toBe(true);
		}
	});

	it('error message on 500 does not contain API key', async () => {
		process.env.LOGOS_LLM_API_KEY = 'sk-another-secret';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
			retry: { maxRetries: 0 },
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ error: { message: 'Server error' } }, 500),
		);

		const provider = new OpenAiCompatibleLlmProvider(config);

		try {
			await provider.generateStructuredOutput(makeRequest());
			expect.fail('Expected an error to be thrown');
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			expect(msg).not.toContain('sk-another-secret');
		}
	});
});
