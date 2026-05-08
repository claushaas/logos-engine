import { describe, expect, it } from 'vitest';
import {
	getGlobalAiDefaultsPath,
	getProviderPreset,
	providerPresetRegistry,
	redactSecret,
	resolveProviderConfigDefaults,
	resolveTokenFromEnvironment,
} from '../../src/index.js';

describe('provider preset registry', () => {
	it('defines inspectable presets for remote and local provider styles', () => {
		expect(providerPresetRegistry.map((preset) => preset.id)).toEqual([
			'mock',
			'fixture',
			'openai-compatible',
			'openai',
			'openrouter',
			'anthropic',
			'ollama',
			'lm-studio',
			'custom',
		]);
		expect(getProviderPreset('openai').transmission.mode).toBe(
			'remote-explicit',
		);
		expect(getProviderPreset('ollama').transmission.mode).toBe('local');
	});

	it('resolves provider defaults without requiring raw secrets', () => {
		const config = resolveProviderConfigDefaults({
			enabled: true,
			endpoint: null,
			model: 'gpt-test',
			provider: 'openai',
			remoteContextDisclosureAccepted: true,
			timeoutMs: null,
			tokenSource: null,
		});

		expect(config.endpoint).toBe('https://api.openai.com/v1');
		expect(config.tokenSource).toEqual({
			envVar: 'LOGOS_LLM_API_KEY',
			type: 'environment',
		});
	});

	it('resolves and redacts environment-variable token sources', () => {
		const resolved = resolveTokenFromEnvironment(
			{
				envVar: 'LOGOS_TEST_KEY',
				type: 'environment',
			},
			{
				LOGOS_TEST_KEY: 'sk-test-secret-value',
			},
		);

		expect(resolved.token).toBe('sk-test-secret-value');
		expect(resolved.redacted).toBe('sk-t...[redacted]...alue');
		expect(redactSecret('short')).toBe('[redacted]');
	});

	it('defines an optional global AI defaults path outside project state', () => {
		expect(getGlobalAiDefaultsPath()).toContain('logos-engine');
		expect(getGlobalAiDefaultsPath()).toContain('ai-defaults.json');
	});
});
