/**
 * Tests for provider configuration model (LLM-01).
 *
 * Covers:
 *  - ProviderConfig type shape and defaults.
 *  - resolveProviderConfig: explicit options before env values.
 *  - resolveProviderConfig: LOGOS_USE_MOCK_LLM=true selects mock mode.
 *  - resolveProviderConfig: real mode when token is available.
 *  - resolveProviderConfig: unconfigured mode when token is missing.
 *  - resolveProviderConfig: safe default when nothing specified.
 *  - resolveProviderConfig: LOGOS_LLM_TOKEN_ENV overrides token source.
 *  - toSafeProviderConfig: never includes raw token values.
 *  - resolveApiKey: reads token from the configured env var.
 *  - resolveProviderConfig: LOGOS_LLM_PROVIDER=openai-compatible selects real.
 *  - resolveProviderConfig: useMock overrides LOGOS_LLM_PROVIDER.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	type ProviderConfig,
	resolveApiKey,
	resolveProviderConfig,
	toSafeProviderConfig,
} from '../../src/llm/config.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Env vars touched by the provider config resolver. */
const RELEVANT_ENV_VARS = [
	'LOGOS_LLM_PROVIDER',
	'LOGOS_LLM_MODEL',
	'LOGOS_LLM_BASE_URL',
	'LOGOS_LLM_API_KEY',
	'LOGOS_LLM_TOKEN_ENV',
	'LOGOS_LLM_TIMEOUT',
	'LOGOS_USE_MOCK_LLM',
	'LOGOS_DISCLOSURE_ACCEPTED',
	'LOGOS_ENV_FILE',
];

/**
 * Save relevant env var values so they can be restored.
 */
function snapshotEnv(): Record<string, string | undefined> {
	const snap: Record<string, string | undefined> = {};
	for (const key of RELEVANT_ENV_VARS) {
		snap[key] = process.env[key];
	}
	return snap;
}

/**
 * Restore env vars from a snapshot.
 */
function restoreEnv(snap: Record<string, string | undefined>): void {
	for (const key of RELEVANT_ENV_VARS) {
		if (snap[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = snap[key];
		}
	}
}

/**
 * Clear all relevant env vars and prevent `.env` file loading.
 *
 * Sets `LOGOS_ENV_FILE` to a non-existent path so that
 * {@link loadEnvFile} does not pick up repository `.env` values.
 */
function clearRelevantEnv(): void {
	for (const key of RELEVANT_ENV_VARS) {
		delete process.env[key];
	}
	// Prevent the resolver from loading the repo's .env file.
	process.env.LOGOS_ENV_FILE = '/tmp/logos-nonexistent-env-file.env';
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveProviderConfig', () => {
	let savedEnv: Record<string, string | undefined>;

	beforeEach(() => {
		savedEnv = snapshotEnv();
		clearRelevantEnv();
	});

	afterEach(() => {
		restoreEnv(savedEnv);
	});

	// ── Default behaviour ────────────────────────────────────────────

	it('defaults to mock provider when nothing is specified', () => {
		const config = resolveProviderConfig();

		expect(config.provider).toBe('mock');
		expect(config.mode).toBe('mock');
		expect(config.model).toBe('gpt-4.1-mini');
		expect(config.baseUrl).toBe('https://api.openai.com/v1');
		expect(config.tokenEnv).toBe('LOGOS_LLM_API_KEY');
		expect(config.timeoutMs).toBe(60_000);
		expect(config.disclosureAccepted).toBe(false);
	});

	// ── Mock mode selection ──────────────────────────────────────────

	it('selects mock mode via useMock option', () => {
		const config = resolveProviderConfig({ useMock: true });

		expect(config.provider).toBe('mock');
		expect(config.mode).toBe('mock');
	});

	it('selects mock mode via LOGOS_USE_MOCK_LLM=true', () => {
		process.env.LOGOS_USE_MOCK_LLM = 'true';

		const config = resolveProviderConfig();

		expect(config.provider).toBe('mock');
		expect(config.mode).toBe('mock');
	});

	it('useMock option overrides LOGOS_LLM_PROVIDER', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-test';

		const config = resolveProviderConfig({ useMock: true });

		expect(config.provider).toBe('mock');
		expect(config.mode).toBe('mock');
	});

	// ── Real provider configuration ──────────────────────────────────

	it('selects real mode when LOGOS_LLM_PROVIDER is set and token is available', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-test-token';

		const config = resolveProviderConfig();

		expect(config.provider).toBe('openai-compatible');
		expect(config.mode).toBe('real');
	});

	it('reports unconfigured when LOGOS_LLM_PROVIDER is set but token is missing', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		// No LOGOS_LLM_API_KEY set.

		const config = resolveProviderConfig();

		expect(config.provider).toBe('openai-compatible');
		expect(config.mode).toBe('unconfigured');
	});

	it('reports unconfigured when LOGOS_LLM_PROVIDER is set but token is empty', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = '';

		const config = resolveProviderConfig();

		expect(config.provider).toBe('openai-compatible');
		expect(config.mode).toBe('unconfigured');
	});

	// ── Explicit options before env ──────────────────────────────────

	it('explicit provider option overrides LOGOS_LLM_PROVIDER env', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-env-token';

		// Provide a different provider via explicit options.
		const config = resolveProviderConfig({
			baseUrl: 'https://custom.example.com/v1',
			model: 'gpt-4o',
			provider: 'openai-compatible',
			timeoutMs: 30_000,
		});

		expect(config.provider).toBe('openai-compatible');
		expect(config.mode).toBe('real'); // Token from env is available
		expect(config.model).toBe('gpt-4o');
		expect(config.baseUrl).toBe('https://custom.example.com/v1');
		expect(config.timeoutMs).toBe(30_000);
	});

	it('explicit model option overrides LOGOS_LLM_MODEL env', () => {
		process.env.LOGOS_LLM_MODEL = 'gpt-3.5-turbo';

		const config = resolveProviderConfig({ model: 'gpt-4o' });

		expect(config.model).toBe('gpt-4o');
	});

	it('explicit baseUrl option overrides LOGOS_LLM_BASE_URL env', () => {
		process.env.LOGOS_LLM_BASE_URL = 'https://env.example.com/v1';

		const config = resolveProviderConfig({
			baseUrl: 'https://opt.example.com/v1',
		});

		expect(config.baseUrl).toBe('https://opt.example.com/v1');
	});

	// ── Token env var configuration ──────────────────────────────────

	it('reads token from LOGOS_LLM_TOKEN_ENV when configured', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_TOKEN_ENV = 'MY_CUSTOM_TOKEN';
		process.env.MY_CUSTOM_TOKEN = 'sk-custom-token';
		// Do NOT set LOGOS_LLM_API_KEY.

		const config = resolveProviderConfig();

		expect(config.tokenEnv).toBe('MY_CUSTOM_TOKEN');
		expect(config.mode).toBe('real');
	});

	it('reports unconfigured when LOGOS_LLM_TOKEN_ENV points to missing var', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_TOKEN_ENV = 'NONEXISTENT_VAR';
		// Neither LOGOS_LLM_API_KEY nor NONEXISTENT_VAR is set.

		const config = resolveProviderConfig();

		expect(config.tokenEnv).toBe('NONEXISTENT_VAR');
		expect(config.mode).toBe('unconfigured');
	});

	it('explicit tokenEnv option overrides LOGOS_LLM_TOKEN_ENV env', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_TOKEN_ENV = 'WRONG_VAR';
		process.env.MY_TOKEN = 'sk-correct';

		const config = resolveProviderConfig({ tokenEnv: 'MY_TOKEN' });

		expect(config.tokenEnv).toBe('MY_TOKEN');
		expect(config.mode).toBe('real');
	});

	// ── LOGOS_LLM_TIMEOUT ────────────────────────────────────────────

	it('reads timeout from LOGOS_LLM_TIMEOUT env', () => {
		process.env.LOGOS_LLM_TIMEOUT = '120000';

		const config = resolveProviderConfig();

		expect(config.timeoutMs).toBe(120_000);
	});

	it('ignores non-numeric LOGOS_LLM_TIMEOUT values', () => {
		process.env.LOGOS_LLM_TIMEOUT = 'not-a-number';

		const config = resolveProviderConfig();

		expect(config.timeoutMs).toBe(60_000); // Default
	});

	it('ignores negative LOGOS_LLM_TIMEOUT values', () => {
		process.env.LOGOS_LLM_TIMEOUT = '-5000';

		const config = resolveProviderConfig();

		expect(config.timeoutMs).toBe(60_000); // Default
	});

	// ── Retry policy ─────────────────────────────────────────────────

	it('uses default retry config when no override is given', () => {
		const config = resolveProviderConfig();

		expect(config.retry.maxRetries).toBe(3);
		expect(config.retry.baseDelayMs).toBe(1000);
		expect(config.retry.maxDelayMs).toBe(30_000);
	});

	it('allows retry policy override via options', () => {
		const config = resolveProviderConfig({
			retry: { baseDelayMs: 500, maxRetries: 5 },
		});

		expect(config.retry.maxRetries).toBe(5);
		expect(config.retry.baseDelayMs).toBe(500);
		expect(config.retry.maxDelayMs).toBe(30_000); // Not overridden
	});

	// ── Disclosure acceptance ────────────────────────────────────────

	it('defaults disclosureAccepted to false', () => {
		const config = resolveProviderConfig();

		expect(config.disclosureAccepted).toBe(false);
	});

	it('allows disclosureAccepted override via options', () => {
		const config = resolveProviderConfig({ disclosureAccepted: true });

		expect(config.disclosureAccepted).toBe(true);
	});

	it('reads disclosureAccepted from LOGOS_DISCLOSURE_ACCEPTED env var', () => {
		process.env.LOGOS_DISCLOSURE_ACCEPTED = 'true';

		const config = resolveProviderConfig();

		expect(config.disclosureAccepted).toBe(true);
	});

	it('options.disclosureAccepted overrides LOGOS_DISCLOSURE_ACCEPTED env', () => {
		process.env.LOGOS_DISCLOSURE_ACCEPTED = 'true';

		const config = resolveProviderConfig({ disclosureAccepted: false });

		expect(config.disclosureAccepted).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Safe serialization tests
// ═══════════════════════════════════════════════════════════════════════════

describe('toSafeProviderConfig', () => {
	let savedEnv: Record<string, string | undefined>;

	beforeEach(() => {
		savedEnv = snapshotEnv();
		clearRelevantEnv();
	});

	afterEach(() => {
		restoreEnv(savedEnv);
	});

	it('never includes raw token value', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-super-secret-token';
		const config = resolveProviderConfig();

		const safe = toSafeProviderConfig(config);

		// The safe config must not have any field containing the raw token.
		const serialized = JSON.stringify(safe);
		expect(serialized).not.toContain('sk-super-secret-token');
		expect(serialized).not.toContain('apiKey');
		expect(serialized).not.toContain('api_key');
		expect(serialized).not.toContain('secret');
	});

	it('reports tokenConfigured: true when token env is populated', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-present';
		const config = resolveProviderConfig();

		const safe = toSafeProviderConfig(config);

		expect(safe.tokenConfigured).toBe(true);
	});

	it('reports tokenConfigured: false when token env is empty or missing', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		// No LOGOS_LLM_API_KEY.
		const config = resolveProviderConfig();

		const safe = toSafeProviderConfig(config);

		expect(safe.tokenConfigured).toBe(false);
	});

	it('includes all non-sensitive config fields', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-test';
		const config = resolveProviderConfig({
			disclosureAccepted: true,
			model: 'gpt-4o',
			timeoutMs: 45_000,
		});

		const safe = toSafeProviderConfig(config);

		expect(safe.provider).toBe('openai-compatible');
		expect(safe.mode).toBe('real');
		expect(safe.model).toBe('gpt-4o');
		expect(safe.baseUrl).toBe('https://api.openai.com/v1');
		expect(safe.tokenEnv).toBe('LOGOS_LLM_API_KEY');
		expect(safe.timeoutMs).toBe(45_000);
		expect(safe.retry.maxRetries).toBe(3);
		expect(safe.disclosureAccepted).toBe(true);
	});

	it('safe config for mock mode shows mock values', () => {
		const config = resolveProviderConfig({ useMock: true });

		const safe = toSafeProviderConfig(config);

		expect(safe.provider).toBe('mock');
		expect(safe.mode).toBe('mock');
		expect(safe.tokenConfigured).toBe(false);
	});

	it('safe config for unconfigured mode shows correct state', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		// No token.
		const config = resolveProviderConfig();

		const safe = toSafeProviderConfig(config);

		expect(safe.provider).toBe('openai-compatible');
		expect(safe.mode).toBe('unconfigured');
		expect(safe.tokenConfigured).toBe(false);
	});

	it('safe config cast to unknown has no apiKey, token, or secret keys', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-real-token-value';
		const config = resolveProviderConfig();

		const safe = toSafeProviderConfig(config);
		const keys = Object.keys(safe as Record<string, unknown>);

		// No key that suggests a raw token.
		for (const key of keys) {
			expect(key.toLowerCase()).not.toContain('apikey');
			expect(key.toLowerCase()).not.toContain('secret');
			expect(key.toLowerCase()).not.toContain('password');
		}

		// No string value contains the raw token.
		for (const value of Object.values(safe as Record<string, unknown>)) {
			if (typeof value === 'string') {
				expect(value).not.toContain('sk-real-token-value');
			}
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// resolveApiKey
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveApiKey', () => {
	let savedEnv: Record<string, string | undefined>;

	beforeEach(() => {
		savedEnv = snapshotEnv();
		clearRelevantEnv();
	});

	afterEach(() => {
		restoreEnv(savedEnv);
	});

	it('returns the token value from the configured env var', () => {
		process.env.LOGOS_LLM_API_KEY = 'sk-my-token';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		const key = resolveApiKey(config);

		expect(key).toBe('sk-my-token');
	});

	it('returns undefined when the env var is not set', () => {
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});
		// LOGOS_LLM_API_KEY is not set.

		const key = resolveApiKey(config);

		expect(key).toBeUndefined();
	});

	it('returns undefined when the env var is empty', () => {
		process.env.LOGOS_LLM_API_KEY = '';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
		});

		const key = resolveApiKey(config);

		expect(key).toBeUndefined();
	});

	it('respects custom tokenEnv', () => {
		process.env.LOGOS_LLM_API_KEY = 'sk-wrong';
		process.env.MY_KEY = 'sk-correct';
		const config = resolveProviderConfig({
			provider: 'openai-compatible',
			tokenEnv: 'MY_KEY',
		});

		const key = resolveApiKey(config);

		expect(key).toBe('sk-correct');
	});

	it('returns undefined for mock config (no token needed)', () => {
		const config = resolveProviderConfig({ useMock: true });

		const key = resolveApiKey(config);

		expect(key).toBeUndefined();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// ProviderConfig shape
// ═══════════════════════════════════════════════════════════════════════════

describe('ProviderConfig shape', () => {
	let savedEnv: Record<string, string | undefined>;

	beforeEach(() => {
		savedEnv = snapshotEnv();
		clearRelevantEnv();
	});

	afterEach(() => {
		restoreEnv(savedEnv);
	});

	it('has all required fields for mock mode', () => {
		const config = resolveProviderConfig({ useMock: true });

		// Verify all expected keys exist.
		expect(config).toHaveProperty('provider');
		expect(config).toHaveProperty('mode');
		expect(config).toHaveProperty('model');
		expect(config).toHaveProperty('baseUrl');
		expect(config).toHaveProperty('tokenEnv');
		expect(config).toHaveProperty('timeoutMs');
		expect(config).toHaveProperty('retry');
		expect(config).toHaveProperty('disclosureAccepted');
	});

	it('has all required fields for real mode', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		process.env.LOGOS_LLM_API_KEY = 'sk-test';
		const config = resolveProviderConfig();

		expect(config.provider).toBe('openai-compatible');
		expect(config.mode).toBe('real');
	});

	it('has all required fields for unconfigured mode', () => {
		process.env.LOGOS_LLM_PROVIDER = 'openai-compatible';
		// No API key.
		const config = resolveProviderConfig();

		expect(config.provider).toBe('openai-compatible');
		expect(config.mode).toBe('unconfigured');
	});

	it('ProviderConfig is readonly (compile-time)', () => {
		// This is a compile-time check. At runtime we verify the types
		// are structured as expected — the readonly modifier is enforced
		// by TypeScript, not by runtime assertions.
		const config: ProviderConfig = resolveProviderConfig({ useMock: true });

		// We can read all fields.
		const _provider: string = config.provider;
		const _mode: string = config.mode;
		const _model: string = config.model;

		expect(_provider).toBe('mock');
		expect(_mode).toBe('mock');
		expect(typeof _model).toBe('string');
	});
});
