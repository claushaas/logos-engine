/** Token persistence negative tests — raw secrets must be rejected */

import { describe, expect, it } from 'vitest';
import {
	redactSecretValue,
	validateWorkspaceState,
} from '../src/state/workspace-state-validation.js';
import {
	getEmptyWorkspaceState,
	getInvalidApiKeyState,
	getInvalidBearerState,
	getInvalidProviderTokenState,
} from './fixtures/workspace-state.js';

describe('Token persistence guard', () => {
	it('rejects raw provider token in tokenEnvVarName', () => {
		const state = getInvalidProviderTokenState();
		const result = validateWorkspaceState(state);
		expect(result.success).toBe(false);
		expect(
			result.errors.some((e) => e.path.includes('provider.tokenEnvVarName')),
		).toBe(true);
	});

	it('rejects raw apiKey in apiKeyEnvVarName', () => {
		const state = getInvalidApiKeyState();
		const result = validateWorkspaceState(state);
		expect(result.success).toBe(false);
		expect(
			result.errors.some((e) => e.path.includes('provider.apiKeyEnvVarName')),
		).toBe(true);
	});

	it('rejects Bearer token in tokenEnvVarName', () => {
		const state = getInvalidBearerState();
		const result = validateWorkspaceState(state);
		expect(result.success).toBe(false);
		expect(
			result.errors.some((e) => e.path.includes('provider.tokenEnvVarName')),
		).toBe(true);
	});

	it('allows environment variable name references', () => {
		const state = getEmptyWorkspaceState();
		const withEnvVar = {
			...state,
			provider: {
				apiKeyEnvVarName: 'OPENAI_API_KEY',
				enabled: true,
				providerId: 'openai',
				tokenEnvVarName: 'OPENAI_API_KEY',
			},
		};
		const result = validateWorkspaceState(withEnvVar);
		expect(result.success).toBe(true);
	});

	it('allows model names and provider ids', () => {
		const state = getEmptyWorkspaceState();
		const withModel = {
			...state,
			provider: {
				enabled: true,
				modelId: 'claude-3-5-sonnet-20241022',
				providerId: 'anthropic',
				providerName: 'Anthropic',
			},
		};
		const result = validateWorkspaceState(withModel);
		expect(result.success).toBe(true);
	});

	it('validation diagnostics do not echo raw secret values', () => {
		const state = getInvalidProviderTokenState();
		const result = validateWorkspaceState(state);
		expect(result.success).toBe(false);
		for (const err of result.errors) {
			expect(err.message).not.toContain(
				'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLM',
			);
		}
	});

	it('JSON serialization of valid state does not include raw token values', () => {
		const state = getEmptyWorkspaceState();
		const withEnvVar = {
			...state,
			provider: {
				enabled: true,
				providerId: 'openai',
				tokenEnvVarName: 'OPENAI_API_KEY',
			},
		};
		const json = JSON.stringify(withEnvVar);
		expect(json).not.toContain('sk-');
		expect(json).not.toContain('Bearer ');
		expect(json).toContain('OPENAI_API_KEY');
	});
});

describe('redactSecretValue', () => {
	it('redacts short values fully', () => {
		expect(redactSecretValue('abc')).toBe('***');
	});

	it('redacts long values with ellipses', () => {
		expect(redactSecretValue('sk-1234567890abcdef')).toBe('sk-...def');
	});
});
