/** AI Provider Config Service tests — workspace state integration */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	acceptAiProviderDisclosure,
	createDefaultWorkspaceState,
	declineAiProviderDisclosure,
	disableAiProvider,
	getAiProviderStatus,
	getDisclosurePreview,
	resetAiProviderConfig,
	setAiProvider,
	setAiProviderEndpoint,
	setAiProviderMode,
	setAiProviderModel,
	setAiProviderTimeout,
	setAiProviderTokenEnvVar,
	testAiProvider,
	writeWorkspaceState,
} from '../../src/index.js';

describe('provider config service', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(
			process.env.TMPDIR ?? '/tmp',
			`logos-test-provider-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(tempDir, { recursive: true });
		await mkdir(join(tempDir, '.logos'), { recursive: true });

		// Initialize workspace
		const state = createDefaultWorkspaceState({
			projectRootPath: tempDir,
			workspaceId: 'test-provider-config',
		});
		await writeWorkspaceState({
			projectRoot: tempDir,
			state,
		});
	});

	afterEach(async () => {
		await rm(tempDir, { force: true, recursive: true });
	});

	async function loadProjectRoot(): Promise<string> {
		return tempDir;
	}

	describe('getAiProviderStatus', () => {
		it('returns default config for initialized workspace', async () => {
			const result = await getAiProviderStatus({
				projectRoot: await loadProjectRoot(),
			});
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('no_provider');
			expect(result.config.timeoutMs).toBe(60_000);
			expect(result.config.disclosure.accepted).toBe(false);
		});

		it('returns failure for uninitialized workspace', async () => {
			const result = await getAiProviderStatus({
				projectRoot: '/nonexistent/workspace',
			});
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some(
					(d) => d.code === 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
				),
			).toBe(true);
		});
	});

	describe('setAiProviderMode', () => {
		it('sets mode to disabled', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode({ projectRoot: root }, 'disabled');
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('disabled');
		});

		it('sets mode to no_provider', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode(
				{ projectRoot: root },
				'no_provider',
			);
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('no_provider');
		});

		it('accepts no-provider as alias for no_provider', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode(
				{ projectRoot: root },
				'no-provider',
			);
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('no_provider');
		});

		it('sets mode to local', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode({ projectRoot: root }, 'local');
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('local');
		});

		it('sets mode to remote', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode({ projectRoot: root }, 'remote');
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('remote');
		});

		it('rejects invalid mode', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode({ projectRoot: root }, 'cloud');
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some(
					(d) => d.code === 'LOGOS_AI_PROVIDER_MODE_INVALID',
				),
			).toBe(true);
		});

		it('dry-run does not write', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderMode(
				{ dryRun: true, projectRoot: root },
				'remote',
			);
			expect(result.success).toBe(true);
			expect(result.messages.join('\n')).toContain('dry-run');
		});
	});

	describe('setAiProvider', () => {
		it('sets known provider', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProvider({ projectRoot: root }, 'openai');
			expect(result.success).toBe(true);
			expect(result.config.providerId).toBe('openai');
			expect(result.config.mode).toBe('remote');
		});

		it('sets local provider', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProvider(
				{ projectRoot: root },
				'local-openai-compatible',
			);
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('local');
		});

		it('rejects unknown provider', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProvider({ projectRoot: root }, 'unknown-ai');
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'LOGOS_AI_PROVIDER_UNKNOWN'),
			).toBe(true);
		});
	});

	describe('setAiProviderModel', () => {
		it('sets model id', async () => {
			const root = await loadProjectRoot();
			// Set up a provider first
			await setAiProvider({ projectRoot: root }, 'openai');
			const result = await setAiProviderModel({ projectRoot: root }, 'gpt-4o');
			expect(result.success).toBe(true);
			expect(result.config.modelId).toBe('gpt-4o');
		});

		it('rejects empty model id', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderModel({ projectRoot: root }, '');
			expect(result.success).toBe(false);
		});

		it('trims whitespace from model id', async () => {
			const root = await loadProjectRoot();
			await setAiProvider({ projectRoot: root }, 'openai');
			const result = await setAiProviderModel(
				{ projectRoot: root },
				'  gpt-4o  ',
			);
			expect(result.success).toBe(true);
			expect(result.config.modelId).toBe('gpt-4o');
		});
	});

	describe('setAiProviderEndpoint', () => {
		it('sets valid endpoint', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			const result = await setAiProviderEndpoint(
				{ projectRoot: root },
				'https://api.example.com/v1',
			);
			expect(result.success).toBe(true);
			expect(result.config.endpoint).toBe('https://api.example.com/v1');
		});

		it('rejects http endpoint for remote', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			const result = await setAiProviderEndpoint(
				{ projectRoot: root },
				'http://api.example.com/v1',
			);
			expect(result.success).toBe(false);
		});

		it('rejects endpoint with embedded credentials', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			const result = await setAiProviderEndpoint(
				{ projectRoot: root },
				'https://user:pass@api.example.com/v1',
			);
			expect(result.success).toBe(false);
		});

		it('accepts localhost for local mode', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'local');
			const result = await setAiProviderEndpoint(
				{ projectRoot: root },
				'http://localhost:11434',
			);
			expect(result.success).toBe(true);
		});
	});

	describe('setAiProviderTokenEnvVar', () => {
		it('sets token env var name', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTokenEnvVar(
				{ projectRoot: root },
				'OPENAI_API_KEY',
			);
			expect(result.success).toBe(true);
			expect(result.config.tokenEnvVar).toBe('OPENAI_API_KEY');
		});

		it('rejects raw secret value', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTokenEnvVar(
				{ projectRoot: root },
				'sk-proj-abc123',
			);
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some(
					(d) => d.code === 'LOGOS_AI_TOKEN_VALUE_REJECTED',
				),
			).toBe(true);
		});

		it('rejects KEY=value assignment', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTokenEnvVar(
				{ projectRoot: root },
				'OPENAI_API_KEY=sk-abc',
			);
			expect(result.success).toBe(false);
		});

		it('rejects authorization header', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTokenEnvVar(
				{ projectRoot: root },
				'Bearer xyz',
			);
			expect(result.success).toBe(false);
		});
	});

	describe('setAiProviderTimeout', () => {
		it('sets timeout', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTimeout({ projectRoot: root }, 120_000);
			expect(result.success).toBe(true);
			expect(result.config.timeoutMs).toBe(120_000);
		});

		it('rejects timeout above maximum', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTimeout({ projectRoot: root }, 200_000);
			expect(result.success).toBe(false);
		});

		it('rejects zero timeout', async () => {
			const root = await loadProjectRoot();
			const result = await setAiProviderTimeout({ projectRoot: root }, 0);
			expect(result.success).toBe(false);
		});
	});

	describe('disclosure', () => {
		it('accepts disclosure', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');

			const result = await acceptAiProviderDisclosure({
				projectRoot: root,
			});
			expect(result.success).toBe(true);
			expect(result.config.disclosure.accepted).toBe(true);
			expect(result.config.disclosure.acceptedAt).toBeDefined();
		});

		it('declines disclosure', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');

			const result = await declineAiProviderDisclosure({
				projectRoot: root,
			});
			expect(result.success).toBe(true);
			expect(result.config.disclosure.accepted).toBe(false);
			expect(result.config.disclosure.declinedAt).toBeDefined();
		});

		it('reset clears disclosure', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');
			await acceptAiProviderDisclosure({ projectRoot: root });

			const resetResult = await resetAiProviderConfig({
				projectRoot: root,
			});
			expect(resetResult.success).toBe(true);
			expect(resetResult.config.disclosure.accepted).toBe(false);
			expect(resetResult.config.mode).toBe('no_provider');
		});
	});

	describe('getDisclosurePreview', () => {
		it('returns preview for remote provider', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');

			const { preview } = await getDisclosurePreview({
				projectRoot: root,
			});
			expect(preview).toBeDefined();
			expect(preview?.providerId).toBe('openai');
			expect(preview?.contextCategories.length).toBeGreaterThan(0);
			expect(preview?.statement.length).toBeGreaterThan(0);
		});

		it('returns no preview for non-remote mode', async () => {
			const root = await loadProjectRoot();
			const { preview } = await getDisclosurePreview({
				projectRoot: root,
			});
			expect(preview).toBeUndefined();
		});
	});

	describe('disableAiProvider', () => {
		it('disables provider', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');

			const result = await disableAiProvider({ projectRoot: root });
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('disabled');
		});
	});

	describe('resetAiProviderConfig', () => {
		it('resets to defaults', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');
			await setAiProviderModel({ projectRoot: root }, 'gpt-4o');
			await setAiProviderTokenEnvVar({ projectRoot: root }, 'MY_KEY');

			const result = await resetAiProviderConfig({ projectRoot: root });
			expect(result.success).toBe(true);
			expect(result.config.mode).toBe('no_provider');
			expect(result.config.providerId).toBeUndefined();
			expect(result.config.modelId).toBeUndefined();
			expect(result.config.tokenEnvVar).toBeUndefined();
			expect(result.config.endpoint).toBeUndefined();
			expect(result.config.disclosure.accepted).toBe(false);
		});
	});

	describe('testAiProvider', () => {
		it('blocks test when disabled', async () => {
			const root = await loadProjectRoot();
			await disableAiProvider({ projectRoot: root });

			const result = await testAiProvider({ projectRoot: root });
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'LOGOS_AI_PROVIDER_DISABLED'),
			).toBe(true);
		});

		it('blocks test for no_provider', async () => {
			const root = await loadProjectRoot();
			const result = await testAiProvider({ projectRoot: root });
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some(
					(d) => d.code === 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
				),
			).toBe(true);
		});

		it('blocks remote test without disclosure', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');

			const result = await testAiProvider({ projectRoot: root });
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some(
					(d) => d.code === 'LOGOS_AI_PROVIDER_TEST_BLOCKED',
				),
			).toBe(true);
		});

		it('runs test with test runner injected', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'remote');
			await setAiProvider({ projectRoot: root }, 'openai');
			await acceptAiProviderDisclosure({ projectRoot: root });

			const result = await testAiProvider({
				_testRunner: async () => ({
					diagnosticCodes: [],
					durationMs: 42,
					endpointOrigin: 'https://api.openai.com',
					modelId: 'gpt-4o',
					providerId: 'openai',
					status: 'passed',
					testedAt: new Date().toISOString(),
				}),
				projectRoot: root,
			});

			expect(result.success).toBe(true);
			expect(result.config.lastTest?.status).toBe('passed');
			expect(result.config.lastTest?.durationMs).toBe(42);
		});

		it('handles test failure gracefully', async () => {
			const root = await loadProjectRoot();
			await setAiProviderMode({ projectRoot: root }, 'local');
			await setAiProvider({ projectRoot: root }, 'local-openai-compatible');
			await setAiProviderEndpoint(
				{ projectRoot: root },
				'http://localhost:11434/v1',
			);

			const result = await testAiProvider({
				_testRunner: async () => {
					throw new Error('Connection refused');
				},
				projectRoot: root,
			});

			expect(result.success).toBe(true); // service itself succeeded (write was ok)
			expect(result.config.lastTest?.status).toBe('failed');
		});
	});
});
