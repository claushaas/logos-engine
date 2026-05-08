import { describe, expect, it } from 'vitest';
import {
	type AiOperationId,
	AiResponseValidationError,
	assertConfigDoesNotContainRawToken,
	createMockLlmProvider,
	defaultAiProviderConfig,
	getProviderPreset,
	type LlmProvider,
	LlmProviderError,
	type LlmRequest,
	type LlmResponse,
	ProviderConfigurationError,
	providerPresetRegistry,
	redactAiProviderConfig,
	redactSecret,
	resolveProviderConfigDefaults,
	resolveTokenFromEnvironment,
	runAiOperation,
} from '../../src/index.js';

describe('AI failure handling', () => {
	describe('provider unavailable', () => {
		it('rejects with provider_unavailable error', () => {
			const error = new LlmProviderError(
				'Provider is not available at this time.',
				'provider_unavailable',
				true,
			);
			expect(error.code).toBe('provider_unavailable');
			expect(error.retryable).toBe(true);
		});

		it('handles failing provider in runAiOperation without corrupting input', async () => {
			const failingProvider: LlmProvider = {
				complete: async (_request: LlmRequest): Promise<LlmResponse> => {
					throw new LlmProviderError(
						'Connection refused',
						'provider_unavailable',
						true,
					);
				},
				metadata: createMockLlmProvider().metadata,
			};

			const input: LlmRequest = {
				messages: [{ content: 'test', role: 'user' }],
				operationId: 'summarize_answer' as AiOperationId,
			};

			await expect(runAiOperation(failingProvider, input)).rejects.toThrow(
				LlmProviderError,
			);
			expect(input.operationId).toBe('summarize_answer');
		});
	});

	describe('authentication failure', () => {
		it('rejects with authentication_failed error', () => {
			const error = new LlmProviderError(
				'Invalid API key.',
				'authentication_failed',
				false,
			);
			expect(error.code).toBe('authentication_failed');
			expect(error.retryable).toBe(false);
		});

		it('handles auth failure from provider adapter', async () => {
			const authFailProvider: LlmProvider = {
				complete: async (_request: LlmRequest): Promise<LlmResponse> => {
					throw new LlmProviderError(
						'Invalid authentication credentials',
						'authentication_failed',
						false,
					);
				},
				metadata: createMockLlmProvider().metadata,
			};

			await expect(
				runAiOperation(authFailProvider, {
					messages: [{ content: 'test', role: 'user' }],
					operationId: 'summarize_answer' as AiOperationId,
				}),
			).rejects.toThrow('Invalid authentication credentials');
		});
	});

	describe('rate limit', () => {
		it('rejects with rate_limited error (retryable)', () => {
			const error = new LlmProviderError(
				'Rate limit exceeded. Retry after 60s.',
				'rate_limited',
				true,
			);
			expect(error.code).toBe('rate_limited');
			expect(error.retryable).toBe(true);
			expect(error.message).toContain('Retry after');
		});

		it('handles rate limit from provider', async () => {
			const rateLimitedProvider: LlmProvider = {
				complete: async (_request: LlmRequest): Promise<LlmResponse> => {
					throw new LlmProviderError('Too many requests', 'rate_limited', true);
				},
				metadata: createMockLlmProvider().metadata,
			};

			await expect(
				runAiOperation(rateLimitedProvider, {
					messages: [{ content: 'test', role: 'user' }],
					operationId: 'recommend_next_question_group' as AiOperationId,
				}),
			).rejects.toThrow(LlmProviderError);
		});
	});

	describe('invalid structured output', () => {
		it('rejects malformed AI response with AiResponseValidationError', async () => {
			const junkProvider: LlmProvider = {
				complete: async (request: LlmRequest): Promise<LlmResponse> => ({
					finishReason: 'stop',
					model: 'junk-model',
					operationId: request.operationId,
					output: { invalid: 'garbage' },
					providerId: 'junk',
					rawText: null,
					usage: { inputTokens: null, outputTokens: null },
				}),
				metadata: createMockLlmProvider().metadata,
			};

			await expect(
				runAiOperation(junkProvider, {
					messages: [{ content: 'test', role: 'user' }],
					operationId: 'summarize_answer' as AiOperationId,
				}),
			).rejects.toThrow(AiResponseValidationError);
		});

		it('rejects AI response with wrong operation id', async () => {
			const wrongOpProvider: LlmProvider = {
				complete: async (_request: LlmRequest): Promise<LlmResponse> => ({
					finishReason: 'stop',
					model: 'test-model',
					operationId: 'identify_gaps' as AiOperationId,
					output: {},
					providerId: 'test',
					rawText: null,
					usage: { inputTokens: null, outputTokens: null },
				}),
				metadata: createMockLlmProvider().metadata,
			};

			await expect(
				runAiOperation(wrongOpProvider, {
					messages: [{ content: 'test', role: 'user' }],
					operationId: 'summarize_answer' as AiOperationId,
				}),
			).rejects.toThrow(LlmProviderError);
		});

		it('rejects AI output with confirmed status', async () => {
			const confirmedProvider: LlmProvider = {
				complete: async (request: LlmRequest): Promise<LlmResponse> => ({
					finishReason: 'stop',
					model: 'test-model',
					operationId: request.operationId,
					output: { status: 'confirmed', summary: 'Confirmed without user' },
					providerId: 'test',
					rawText: null,
					usage: { inputTokens: null, outputTokens: null },
				}),
				metadata: createMockLlmProvider().metadata,
			};

			await expect(
				runAiOperation(confirmedProvider, {
					messages: [{ content: 'test', role: 'user' }],
					operationId: 'summarize_answer' as AiOperationId,
				}),
			).rejects.toThrow(AiResponseValidationError);
		});
	});

	describe('timeout', () => {
		it('rejects with timeout error code', () => {
			const error = new LlmProviderError(
				'Request timed out after 30000ms.',
				'timeout',
				true,
			);
			expect(error.code).toBe('timeout');
			expect(error.retryable).toBe(true);
		});
	});

	describe('context length exceeded', () => {
		it('rejects with invalid_response error for context overflow', () => {
			const error = new LlmProviderError(
				'Context length exceeded model maximum.',
				'invalid_response',
				false,
			);
			expect(error.code).toBe('invalid_response');
			expect(error.retryable).toBe(false);
		});
	});

	describe('no-provider configured behavior', () => {
		it('returns default config with AI disabled', () => {
			expect(defaultAiProviderConfig.enabled).toBe(false);
			expect(defaultAiProviderConfig.provider).toBe(null);
			expect(defaultAiProviderConfig.endpoint).toBe(null);
		});

		it('mock provider works without any configuration', async () => {
			const provider = createMockLlmProvider();
			expect(provider.metadata.providerId).toBe('mock');

			const result = await runAiOperation(provider, {
				messages: [{ content: 'test', role: 'user' }],
				operationId: 'summarize_answer' as AiOperationId,
			});
			expect(result.summary).toBe('Deterministic mock summary.');
		});

		it('all provider presets describe their transmission mode', () => {
			for (const preset of providerPresetRegistry) {
				expect(preset.transmission.mode).toBeDefined();
				expect(preset.transmission.contextLeavesMachine).toBeDefined();
				expect(preset.capabilities.local).toBeDefined();
			}
		});
	});

	describe('remote provider disclosure', () => {
		it('remote presets require user acknowledgement', () => {
			for (const preset of providerPresetRegistry) {
				if (preset.transmission.mode === 'remote-explicit') {
					expect(preset.transmission.requiresUserAcknowledgement).toBe(true);
				}
			}
		});

		it('local and test presets do not require user acknowledgement', () => {
			for (const preset of providerPresetRegistry) {
				if (
					preset.transmission.mode === 'local' ||
					preset.transmission.mode === 'test-fixture'
				) {
					expect(preset.transmission.requiresUserAcknowledgement).toBe(false);
				}
			}
		});

		it('remote preset disclosure explains context transmission', () => {
			const openaiPreset = getProviderPreset('openai');
			expect(openaiPreset.transmission.disclosure).toBeTruthy();
			expect(openaiPreset.transmission.contextLeavesMachine).toBe(true);
		});

		it('mock preset keeps context local', () => {
			const mockPreset = getProviderPreset('mock');
			expect(mockPreset.transmission.mode).toBe('test-fixture');
			expect(mockPreset.transmission.contextLeavesMachine).toBe(false);
		});
	});

	describe('raw token protection', () => {
		it('redacts tokens shorter than 9 characters entirely', () => {
			expect(redactSecret('12345678')).toBe('[redacted]');
		});

		it('redacts longer tokens showing only first 4 and last 4', () => {
			const result = redactSecret('sk-or-v1-abcdefghijklmnop');
			expect(result).toContain('sk-o');
			expect(result).toContain('[redacted]');
			expect(result).toContain('mnop');
		});

		it('redacts AI provider config with manual_session', () => {
			const config = {
				...defaultAiProviderConfig,
				tokenSource: { type: 'manual_session' as const },
			};
			const redacted = redactAiProviderConfig(config);
			expect(redacted.tokenSource?.type).toBe('manual_session');
		});

		it('rejects config objects with forbidden raw token keys', () => {
			expect(() =>
				assertConfigDoesNotContainRawToken({
					apiKey: 'sk-1234567890abcdef',
				}),
			).toThrow(ProviderConfigurationError);

			expect(() =>
				assertConfigDoesNotContainRawToken({
					model: 'gpt-4',
					provider: 'openai',
				}),
			).not.toThrow();
		});

		it('resolves tokens from environment variables', () => {
			const result = resolveTokenFromEnvironment(
				{ envVar: 'TEST_TOKEN_VAR', type: 'environment' },
				{ TEST_TOKEN_VAR: 'my-secret-token-12345' },
			);
			expect(result.token).toBe('my-secret-token-12345');
			expect(result.redacted).not.toBe('my-secret-token-12345');
		});

		it('returns null token when env var is not set', () => {
			const result = resolveTokenFromEnvironment(
				{ envVar: 'MISSING_VAR', type: 'environment' },
				{},
			);
			expect(result.token).toBe(null);
			expect(result.redacted).toBe(null);
		});

		it('returns null token for none token source', () => {
			const result = resolveTokenFromEnvironment({ type: 'none' });
			expect(result.token).toBe(null);
		});

		it('resolves provider config defaults for known presets', () => {
			const resolved = resolveProviderConfigDefaults({
				...defaultAiProviderConfig,
				enabled: true,
				provider: 'openai',
			});
			expect(resolved.endpoint).toBe('https://api.openai.com/v1');
			expect(resolved.timeoutMs).toBe(60000);
		});

		it('returns unchanged config when provider is null', () => {
			const resolved = resolveProviderConfigDefaults({
				...defaultAiProviderConfig,
			});
			expect(resolved.provider).toBe(null);
			expect(resolved.endpoint).toBe(null);
		});
	});

	describe('all LlmProviderError codes are usable', () => {
		const errorCodes: Array<[NonNullable<LlmProviderError['code']>, boolean]> =
			[
				['authentication_failed', false],
				['configuration_error', false],
				['invalid_response', false],
				['network_error', true],
				['provider_unavailable', true],
				['rate_limited', true],
				['timeout', true],
				['unsupported_operation', false],
			];

		for (const [code, expectedRetryable] of errorCodes) {
			it(`constructs LlmProviderError with code ${code}`, () => {
				const error = new LlmProviderError(
					`Simulated ${code}`,
					code,
					expectedRetryable,
				);
				expect(error.code).toBe(code);
				expect(error.retryable).toBe(expectedRetryable);
				expect(error.name).toBe('LlmProviderError');
			});
		}
	});

	describe('provider failure does not corrupt workspace state', () => {
		it('mock provider always returns valid output', async () => {
			const provider = createMockLlmProvider();
			const operationIds = [
				'summarize_answer',
				'extract_decision_proposals',
				'classify_assumptions',
				'identify_gaps',
				'identify_risks',
				'draft_document_section',
				'generate_follow_up_questions',
				'recommend_next_question_group',
			] as const;

			for (const operationId of operationIds) {
				const result = await runAiOperation(provider, {
					messages: [{ content: 'test', role: 'user' }],
					operationId,
				});
				expect(result).toBeDefined();
				expect(result.status).toBeDefined();
				expect(result.status).not.toBe('confirmed');
			}
		});
	});
});
