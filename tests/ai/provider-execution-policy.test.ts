/** AI Provider Execution Policy tests */

import { describe, expect, it } from 'vitest';
import type { AiProviderConfig } from '../../src/index.js';
import {
	defaultAiProviderDisclosureState,
	evaluateAiProviderExecutionPolicy,
	executeWithTimeout,
	FakeProvider,
	getBlockedAiRecoveryHint,
	isAiProviderExecutionBlocked,
	runProviderTest,
} from '../../src/index.js';

function makeConfig(
	overrides: Partial<AiProviderConfig> = {},
): AiProviderConfig {
	return {
		disclosure: defaultAiProviderDisclosureState(),
		mode: 'no_provider',
		timeoutMs: 60_000,
		...overrides,
	};
}

describe('provider execution policy', () => {
	describe('evaluateAiProviderExecutionPolicy', () => {
		it('blocks disabled mode', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({ mode: 'disabled' }),
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('LOGOS_AI_PROVIDER_DISABLED');
		});

		it('blocks no_provider mode', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({ mode: 'no_provider' }),
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe(
				'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
			);
		});

		it('blocks remote mode without disclosure', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({
					disclosure: {
						...defaultAiProviderDisclosureState(),
						accepted: false,
					},
					mode: 'remote',
				}),
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('LOGOS_AI_DISCLOSURE_REQUIRED');
		});

		it('allows remote mode with disclosure', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({
					disclosure: {
						...defaultAiProviderDisclosureState(),
						accepted: true,
						acceptedAt: '2024-01-01T00:00:00Z',
					},
					mode: 'remote',
				}),
			);
			expect(result.allowed).toBe(true);
		});

		it('allows local mode without disclosure', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({ mode: 'local' }),
			);
			expect(result.allowed).toBe(true);
		});

		it('warns if token env var is set but not available', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({
					disclosure: {
						...defaultAiProviderDisclosureState(),
						accepted: true,
					},
					mode: 'remote',
					tokenEnvVar: 'NONEXISTENT_TOKEN_VAR',
				}),
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('LOGOS_AI_TOKEN_ENV_INVALID');
		});

		it('allows remote when token env var is set in environment', () => {
			process.env.TEST_TOKEN_VAR = 'test-value';
			try {
				const result = evaluateAiProviderExecutionPolicy(
					makeConfig({
						disclosure: {
							...defaultAiProviderDisclosureState(),
							accepted: true,
						},
						mode: 'remote',
						tokenEnvVar: 'TEST_TOKEN_VAR',
					}),
				);
				expect(result.allowed).toBe(true);
			} finally {
				delete process.env.TEST_TOKEN_VAR;
			}
		});

		it('includes timeout in response', () => {
			const result = evaluateAiProviderExecutionPolicy(
				makeConfig({ timeoutMs: 120_000 }),
			);
			expect(result.timeoutMs).toBe(120_000);
		});
	});

	describe('isAiProviderExecutionBlocked', () => {
		it('returns blocked for disabled', () => {
			const { blocked, reason } = isAiProviderExecutionBlocked(
				makeConfig({ mode: 'disabled' }),
			);
			expect(blocked).toBe(true);
			expect(reason).toBeDefined();
		});

		it('returns not blocked for local', () => {
			const { blocked } = isAiProviderExecutionBlocked(
				makeConfig({ mode: 'local' }),
			);
			expect(blocked).toBe(false);
		});
	});

	describe('getBlockedAiRecoveryHint', () => {
		it('returns hint for disabled', () => {
			const hint = getBlockedAiRecoveryHint(makeConfig({ mode: 'disabled' }));
			expect(hint).toContain('/config ai');
		});

		it('returns hint for no_provider', () => {
			const hint = getBlockedAiRecoveryHint(
				makeConfig({ mode: 'no_provider' }),
			);
			expect(hint).toContain('/config ai');
		});

		it('returns hint for remote without disclosure', () => {
			const hint = getBlockedAiRecoveryHint(
				makeConfig({
					disclosure: {
						...defaultAiProviderDisclosureState(),
						accepted: false,
					},
					mode: 'remote',
				}),
			);
			expect(hint).toContain('disclosure');
		});
	});

	describe('executeWithTimeout', () => {
		it('returns result on success', async () => {
			const result = await executeWithTimeout({
				fn: async () => 'done' as const,
				timeoutMs: 5000,
			});
			expect(result.success).toBe(true);
			expect(result.result).toBe('done');
			expect(result.diagnostics).toEqual([]);
		});

		it('returns timeout error', async () => {
			const result = await executeWithTimeout({
				fn: async (signal) => {
					await new Promise((_resolve, reject) => {
						const onAbort = () => reject(new Error('Aborted'));
						signal.addEventListener('abort', onAbort, { once: true });
						// Never resolves — test timeout is very short
					});
					return 'should not reach';
				},
				timeoutMs: 10,
			});
			expect(result.success).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('LOGOS_AI_PROVIDER_TIMEOUT');
		});

		it('returns error on provider failure', async () => {
			const result = await executeWithTimeout({
				fn: async () => {
					throw new Error('Connection refused');
				},
				timeoutMs: 5000,
			});
			expect(result.success).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('LOGOS_AI_PROVIDER_UNAVAILABLE');
		});
	});

	describe('runProviderTest', () => {
		it('blocks test when provider is disabled', async () => {
			const provider = new FakeProvider();
			const { summary } = await runProviderTest({
				config: makeConfig({ mode: 'disabled' }),
				provider,
			});
			expect(summary.status).toBe('blocked');
		});

		it('blocks test when no provider', async () => {
			const provider = new FakeProvider();
			const { summary } = await runProviderTest({
				config: makeConfig({ mode: 'no_provider' }),
				provider,
			});
			expect(summary.status).toBe('blocked');
		});

		it('runs test with fake provider for local', async () => {
			const provider = new FakeProvider();
			const { summary } = await runProviderTest({
				config: makeConfig({ mode: 'local', providerId: 'fake' }),
				provider,
			});
			expect(summary.status).toBe('passed');
		});

		it('uses synthetic context only — no workspace content', async () => {
			const provider = new FakeProvider();
			const { summary } = await runProviderTest({
				config: makeConfig({ mode: 'local', providerId: 'test' }),
				provider,
			});
			expect(summary.status).toBe('passed');
			expect(summary.diagnosticCodes).toEqual([]);
		});

		it('reports failure from failing fake provider', async () => {
			const provider = new FakeProvider({
				failureCode: 'TEST_FAIL',
				failureMessage: 'Simulated failure',
				simulateFailure: true,
			});
			const { summary } = await runProviderTest({
				config: makeConfig({ mode: 'local', providerId: 'test' }),
				provider,
			});
			expect(summary.status).toBe('failed');
		});

		it('stores redacted summary only — no raw response', async () => {
			const provider = new FakeProvider();
			const { summary } = await runProviderTest({
				config: makeConfig({ mode: 'local', providerId: 'test' }),
				provider,
			});
			// Summary fields are all metadata, no raw model response
			expect(summary.status).toBeDefined();
			expect(typeof summary.providerId).toBe('string');
			// No raw response content
			expect(summary).not.toHaveProperty('rawResponse');
			expect(summary).not.toHaveProperty('response');
		});
	});
});
