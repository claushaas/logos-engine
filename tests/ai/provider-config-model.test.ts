/** AI Provider Config Model tests */

import { describe, expect, it } from 'vitest';
import {
	AI_PROVIDER_DISCLOSURE_VERSION,
	AI_PROVIDER_MODES,
	DEFAULT_AI_PROVIDER_TIMEOUT_MS,
	defaultAiProviderConfig,
	defaultAiProviderDisclosureState,
	endpointOrigin,
	isValidAiProviderMode,
	isValidEndpoint,
	isValidTokenEnvVarName,
	looksLikeRawSecret,
	MAX_AI_PROVIDER_TIMEOUT_MS,
	normalizeAiProviderConfig,
	redactEndpointUrl,
	redactProviderConfigForDisplay,
	validateTimeout,
} from '../../src/index.js';

describe('provider config model', () => {
	describe('constants', () => {
		it('default timeout is 60 seconds', () => {
			expect(DEFAULT_AI_PROVIDER_TIMEOUT_MS).toBe(60_000);
		});

		it('max timeout is 180 seconds', () => {
			expect(MAX_AI_PROVIDER_TIMEOUT_MS).toBe(180_000);
		});

		it('has explicit modes', () => {
			expect(AI_PROVIDER_MODES).toContain('disabled');
			expect(AI_PROVIDER_MODES).toContain('no_provider');
			expect(AI_PROVIDER_MODES).toContain('local');
			expect(AI_PROVIDER_MODES).toContain('remote');
		});
	});

	describe('defaultAiProviderConfig', () => {
		it('defaults to no_provider mode', () => {
			const cfg = defaultAiProviderConfig();
			expect(cfg.mode).toBe('no_provider');
		});

		it('defaults timeout to 60 seconds', () => {
			const cfg = defaultAiProviderConfig();
			expect(cfg.timeoutMs).toBe(60_000);
		});

		it('defaults disclosure to not accepted', () => {
			const cfg = defaultAiProviderConfig();
			expect(cfg.disclosure.accepted).toBe(false);
		});

		it('has no provider, model, endpoint, or token', () => {
			const cfg = defaultAiProviderConfig();
			expect(cfg.providerId).toBeUndefined();
			expect(cfg.modelId).toBeUndefined();
			expect(cfg.endpoint).toBeUndefined();
			expect(cfg.tokenEnvVar).toBeUndefined();
		});
	});

	describe('isValidAiProviderMode', () => {
		it('validates all defined modes', () => {
			for (const mode of AI_PROVIDER_MODES) {
				expect(isValidAiProviderMode(mode)).toBe(true);
			}
		});

		it('rejects invalid modes', () => {
			expect(isValidAiProviderMode('cloud')).toBe(false);
			expect(isValidAiProviderMode('')).toBe(false);
			expect(isValidAiProviderMode('REMOTE')).toBe(false);
			expect(isValidAiProviderMode(null)).toBe(false);
		});
	});

	describe('validateTimeout', () => {
		it('accepts valid timeout', () => {
			expect(validateTimeout(60_000).valid).toBe(true);
		});

		it('accepts max timeout', () => {
			expect(validateTimeout(180_000).valid).toBe(true);
		});

		it('rejects timeout above max', () => {
			const result = validateTimeout(180_001);
			expect(result.valid).toBe(false);
			expect(result.diagnostic?.code).toBe('LOGOS_AI_TIMEOUT_TOO_HIGH');
		});

		it('rejects zero timeout', () => {
			const result = validateTimeout(0);
			expect(result.valid).toBe(false);
			expect(result.diagnostic?.code).toBe('LOGOS_AI_TIMEOUT_INVALID');
		});

		it('rejects negative timeout', () => {
			const result = validateTimeout(-1000);
			expect(result.valid).toBe(false);
		});

		it('rejects NaN', () => {
			const result = validateTimeout(NaN);
			expect(result.valid).toBe(false);
		});

		it('rejects Infinity', () => {
			const result = validateTimeout(Infinity);
			expect(result.valid).toBe(false);
		});
	});

	describe('isValidTokenEnvVarName', () => {
		it('accepts valid env var names', () => {
			expect(isValidTokenEnvVarName('OPENAI_API_KEY')).toBe(true);
			expect(isValidTokenEnvVarName('ANTHROPIC_API_KEY')).toBe(true);
			expect(isValidTokenEnvVarName('LOGOS_AI_TOKEN')).toBe(true);
		});

		it('rejects raw secrets', () => {
			// sk- prefix
			expect(isValidTokenEnvVarName('sk-abc123')).toBe(false);
			// sk_ prefix
			expect(isValidTokenEnvVarName('sk_abc123')).toBe(false);
		});

		it('rejects KEY=value assignments', () => {
			expect(isValidTokenEnvVarName('KEY=secret')).toBe(false);
		});

		it('rejects spaces', () => {
			expect(isValidTokenEnvVarName('MY KEY')).toBe(false);
		});

		it('rejects shell metacharacters', () => {
			expect(isValidTokenEnvVarName('MY$KEY')).toBe(false);
			expect(isValidTokenEnvVarName('MY`KEY`')).toBe(false);
		});

		it('rejects authorization header strings', () => {
			expect(isValidTokenEnvVarName('Bearer xyz')).toBe(false);
			expect(isValidTokenEnvVarName('Basic xyz')).toBe(false);
		});

		it('rejects empty string', () => {
			expect(isValidTokenEnvVarName('')).toBe(false);
		});
	});

	describe('looksLikeRawSecret', () => {
		it('detects sk- prefix', () => {
			expect(looksLikeRawSecret('sk-proj-abc123')).toBe(true);
		});

		it('detects bearer prefix', () => {
			expect(looksLikeRawSecret('bearer abc123')).toBe(true);
		});

		it('detects authorization header', () => {
			expect(looksLikeRawSecret('Authorization: Bearer xyz')).toBe(true);
		});

		it('detects long base64-like strings', () => {
			expect(
				looksLikeRawSecret(
					'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/==',
				),
			).toBe(true);
		});

		it('does not flag typical env var names', () => {
			expect(looksLikeRawSecret('OPENAI_API_KEY')).toBe(false);
		});

		it('detects KEY=value with long value', () => {
			expect(
				looksLikeRawSecret(
					'TOKEN=sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				),
			).toBe(true);
		});
	});

	describe('isValidEndpoint', () => {
		it('accepts https endpoint for remote', () => {
			expect(isValidEndpoint('https://api.openai.com/v1', 'remote').valid).toBe(
				true,
			);
		});

		it('rejects http for remote', () => {
			const result = isValidEndpoint('http://api.openai.com/v1', 'remote');
			expect(result.valid).toBe(false);
			expect(result.diagnostic?.code).toBe('LOGOS_AI_ENDPOINT_INVALID');
		});

		it('accepts http://localhost for local', () => {
			expect(isValidEndpoint('http://localhost:11434/v1', 'local').valid).toBe(
				true,
			);
		});

		it('accepts https for local', () => {
			expect(isValidEndpoint('https://localhost:8080/v1', 'local').valid).toBe(
				true,
			);
		});

		it('rejects ftp', () => {
			expect(isValidEndpoint('ftp://example.com', 'remote').valid).toBe(false);
		});

		it('rejects file protocol', () => {
			expect(isValidEndpoint('file:///etc/passwd', 'local').valid).toBe(false);
		});

		it('rejects URL with embedded credentials', () => {
			expect(
				isValidEndpoint('https://user:pass@api.example.com/v1', 'remote').valid,
			).toBe(false);
		});

		it('rejects empty string', () => {
			expect(isValidEndpoint('', 'remote').valid).toBe(false);
		});
	});

	describe('redactEndpointUrl', () => {
		it('removes query parameters', () => {
			const redacted = redactEndpointUrl(
				'https://api.example.com/v1?key=secret',
			);
			expect(redacted).toBe('https://api.example.com/v1?<redacted>');
		});

		it('preserves URL without query', () => {
			expect(redactEndpointUrl('https://api.example.com/v1')).toBe(
				'https://api.example.com/v1',
			);
		});

		it('handles invalid URLs gracefully', () => {
			const redacted = redactEndpointUrl('not-a-url?secret=abc');
			expect(redacted).toContain('<redacted>');
		});
	});

	describe('endpointOrigin', () => {
		it('extracts origin', () => {
			expect(endpointOrigin('https://api.openai.com/v1/chat')).toBe(
				'https://api.openai.com',
			);
		});

		it('returns undefined for undefined', () => {
			expect(endpointOrigin(undefined)).toBeUndefined();
		});

		it('returns undefined for invalid URL', () => {
			expect(endpointOrigin('not-a-url')).toBeUndefined();
		});
	});

	describe('normalizeAiProviderConfig', () => {
		it('returns default config for undefined ref', () => {
			const cfg = normalizeAiProviderConfig(undefined);
			expect(cfg.mode).toBe('no_provider');
			expect(cfg.timeoutMs).toBe(60_000);
		});

		it('maps enabled:true to remote mode when mode is absent', () => {
			const cfg = normalizeAiProviderConfig({
				enabled: true,
				providerId: 'openai',
			});
			expect(cfg.mode).toBe('remote');
		});

		it('maps enabled:false to no_provider when mode is absent', () => {
			const cfg = normalizeAiProviderConfig({
				enabled: false,
				providerId: 'none',
			});
			expect(cfg.mode).toBe('no_provider');
		});

		it('uses explicit mode over enabled', () => {
			const cfg = normalizeAiProviderConfig({
				enabled: false,
				mode: 'remote',
				providerId: 'openai',
			});
			expect(cfg.mode).toBe('remote');
		});

		it('props all fields through', () => {
			const cfg = normalizeAiProviderConfig({
				disclosure: {
					accepted: true,
					acceptedAt: '2024-01-01',
					contextCategories: ['user_prompt'],
					version: '1.0.0',
				},
				endpoint: 'https://api.example.com',
				lastTest: {
					diagnosticCodes: [],
					status: 'passed',
					testedAt: '2024-01-01T00:00:00Z',
				},
				mode: 'remote',
				modelId: 'gpt-4',
				providerId: 'openai',
				timeoutMs: 120_000,
				tokenEnvVarName: 'MY_KEY',
			});
			expect(cfg.mode).toBe('remote');
			expect(cfg.providerId).toBe('openai');
			expect(cfg.modelId).toBe('gpt-4');
			expect(cfg.endpoint).toBe('https://api.example.com');
			expect(cfg.tokenEnvVar).toBe('MY_KEY');
			expect(cfg.timeoutMs).toBe(120_000);
			expect(cfg.disclosure.accepted).toBe(true);
			expect(cfg.lastTest?.status).toBe('passed');
		});
	});

	describe('defaultAiProviderDisclosureState', () => {
		it('has accepted=false', () => {
			expect(defaultAiProviderDisclosureState().accepted).toBe(false);
		});

		it('has correct version', () => {
			expect(defaultAiProviderDisclosureState().version).toBe(
				AI_PROVIDER_DISCLOSURE_VERSION,
			);
		});

		it('has context categories', () => {
			expect(
				defaultAiProviderDisclosureState().contextCategories.length,
			).toBeGreaterThan(0);
		});
	});

	describe('redactProviderConfigForDisplay', () => {
		it('redacts endpoint query params', () => {
			const cfg = redactProviderConfigForDisplay({
				disclosure: defaultAiProviderDisclosureState(),
				endpoint: 'https://api.example.com/v1?key=secret',
				mode: 'remote',
				timeoutMs: 60_000,
			});
			expect(cfg.endpoint).not.toContain('key=secret');
			expect(cfg.endpoint).toContain('<redacted>');
		});

		it('preserves token env var name', () => {
			const cfg = redactProviderConfigForDisplay({
				disclosure: defaultAiProviderDisclosureState(),
				mode: 'remote',
				timeoutMs: 60_000,
				tokenEnvVar: 'OPENAI_API_KEY',
			});
			expect(cfg.tokenEnvVar).toBe('OPENAI_API_KEY');
		});
	});
});
