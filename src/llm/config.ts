// Purpose: LLM configuration model.
// What it should do: Load and validate model endpoint settings from env/config.
// Why it exists: Keeps credentials and provider assumptions explicit.

import { DEFAULT_RETRY_CONFIG, type RetryConfig } from './retry-policy.js';

// ─── Provider Configuration Types ────────────────────────────────────────────

/** Supported provider identifiers. */
export type ProviderId = 'mock' | 'openai-compatible';

/**
 * Resolved provider operation mode.
 *
 * - `mock`: explicitly using the deterministic mock provider.
 * - `real`: a real provider is configured and credentials are available.
 * - `unconfigured`: a real provider was requested but credentials are missing.
 */
export type ProviderMode = 'mock' | 'real' | 'unconfigured';

/**
 * Resolved provider configuration.
 *
 * Contains all settings needed to construct and operate a provider.
 * The raw API key is *not* stored here — only the environment variable
 * name that holds it (`tokenEnv`). Use {@link resolveApiKey} to read
 * the actual token at call time.
 */
export interface ProviderConfig {
	/** Which provider to use. */
	readonly provider: ProviderId;

	/** Resolved operation mode derived from configuration state. */
	readonly mode: ProviderMode;

	/** Model name (e.g., `gpt-4.1-mini`, `gpt-4o`). */
	readonly model: string;

	/** Provider API base URL. */
	readonly baseUrl: string;

	/**
	 * Environment variable name for the API token.
	 *
	 * The actual token value is read from `process.env[tokenEnv]`
	 * at call time and is never stored in this config object.
	 */
	readonly tokenEnv: string;

	/** Request timeout in milliseconds. */
	readonly timeoutMs: number;

	/** Retry policy for transient provider errors. */
	readonly retry: RetryConfig;

	/**
	 * Whether the user has accepted the remote-provider disclosure.
	 *
	 * When `false` and mode is `real`, the runtime should block
	 * remote calls until disclosure is accepted (LLM-08).
	 */
	readonly disclosureAccepted: boolean;
}

/**
 * Serialization-safe view of {@link ProviderConfig}.
 *
 * Never includes raw token values — only a boolean indicating whether
 * the token is available in the environment.
 */
export interface SafeProviderConfig {
	readonly provider: string;
	readonly mode: string;
	readonly model: string;
	readonly baseUrl: string;
	readonly tokenEnv: string;
	readonly tokenConfigured: boolean;
	readonly timeoutMs: number;
	readonly retry: RetryConfig;
	readonly disclosureAccepted: boolean;
}

/**
 * Partial overrides for provider configuration resolution.
 *
 * Used to pass explicit runtime options (from CLI flags or programmatic
 * injection) that take priority over environment variables and defaults.
 */
export interface ProviderConfigOptions {
	/** Explicit provider selection. Overrides `LOGOS_LLM_PROVIDER`. */
	readonly provider?: string;

	/** Explicitly request mock mode. Overrides `LOGOS_USE_MOCK_LLM`. */
	readonly useMock?: boolean;

	/** Model override. Overrides `LOGOS_LLM_MODEL`. */
	readonly model?: string;

	/** Base URL override. Overrides `LOGOS_LLM_BASE_URL`. */
	readonly baseUrl?: string;

	/** Token env var name override. Overrides `LOGOS_LLM_TOKEN_ENV`. */
	readonly tokenEnv?: string;

	/** Timeout override in milliseconds. */
	readonly timeoutMs?: number;

	/** Retry policy override. */
	readonly retry?: Partial<RetryConfig>;

	/** Disclosure acceptance override. */
	readonly disclosureAccepted?: boolean;
}

// ─── Legacy Client Config Types ─────────────────────────────────────────────

/** Resolved LLM configuration, ready for use by the client. */
export interface LlmConfigData {
	baseUrl: string;
	apiKey: string;
	model: string;
	retry?: Partial<RetryConfig>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ENV_PREFIX = 'LOGOS_LLM_';

const DEFAULTS = {
	baseUrl: 'https://api.openai.com/v1',
	model: 'gpt-4.1-mini',
	provider: 'mock' as ProviderId,
	timeoutMs: 60_000,
} as const;

const DEFAULT_TOKEN_ENV = 'LOGOS_LLM_API_KEY';

/** Path to the `.env` file loaded by `loadEnvFile`. */
let loadedEnvPath: string | null = null;

// ─── .env loading ───────────────────────────────────────────────────────────

/**
 * Load environment variables from the nearest `.env` file.
 *
 * Uses Node's built-in `process.loadEnvFile()` (available since Node 22).
 * Safe to call multiple times — the file is only loaded once.
 */
function loadEnvFile(): void {
	if (loadedEnvPath !== null) return;

	// Respect explicit LOGOS_ENV_FILE override
	const explicitPath = process.env.LOGOS_ENV_FILE;

	try {
		if (typeof process.loadEnvFile === 'function') {
			if (explicitPath) {
				process.loadEnvFile(explicitPath);
				loadedEnvPath = explicitPath;
			} else {
				// loadEnvFile defaults to cwd/.env
				process.loadEnvFile();
				loadedEnvPath = '.env';
			}
		}
	} catch {
		// .env file is optional — missing or unreadable is not an error
	}
}

// ─── Resolver ───────────────────────────────────────────────────────────────

/**
 * Read a configuration value, respecting this priority:
 * 1. Explicit override (passed to `loadLlmConfig`)
 * 2. Environment variable (`LOGOS_LLM_*`)
 * 3. Hard-coded default
 */
function resolve(
	override: string | undefined,
	envKey: string,
	fallback: string,
): string {
	if (override !== undefined) return override;
	const envValue = process.env[envKey];
	if (envValue !== undefined && envValue !== '') return envValue;
	return fallback;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load LLM configuration from environment variables.
 *
 * Automatically loads a `.env` file on first call (via `process.loadEnvFile`).
 * Overrides passed as argument take the highest priority.
 *
 * Environment variables read:
 * - `LOGOS_LLM_BASE_URL`  (default: `https://api.openai.com/v1`)
 * - `LOGOS_LLM_API_KEY`   (required — no default)
 * - `LOGOS_LLM_MODEL`     (default: `gpt-4.1-mini`)
 * - `LOGOS_ENV_FILE`      (custom .env path, optional)
 */
export function loadLlmConfig(
	overrides?: Partial<LlmConfigData>,
): LlmConfigData {
	loadEnvFile();

	const config: LlmConfigData = {
		apiKey: resolve(overrides?.apiKey, `${ENV_PREFIX}API_KEY`, ''),
		baseUrl: resolve(
			overrides?.baseUrl,
			`${ENV_PREFIX}BASE_URL`,
			DEFAULTS.baseUrl,
		),
		model: resolve(overrides?.model, `${ENV_PREFIX}MODEL`, DEFAULTS.model),
	};

	if (overrides?.retry !== undefined) {
		config.retry = overrides.retry;
	}

	return config;
}

/**
 * Validate that a configuration object has all required fields.
 *
 * Throws if `apiKey` is empty. The client performs the same check at
 * call time, but this function allows early validation at startup.
 */
export function validateLlmConfig(config: LlmConfigData): void {
	if (!config.apiKey) {
		throw new Error(
			'LLM API key is missing. Set LOGOS_LLM_API_KEY in the environment or a .env file.',
		);
	}
}

// ─── Provider Config Resolution ──────────────────────────────────────────

/**
 * Resolve the complete provider configuration.
 *
 * Priority (highest first):
 * 1. Explicit {@link ProviderConfigOptions} overrides
 * 2. Environment variables (`LOGOS_LLM_*`, `LOGOS_USE_MOCK_LLM`)
 * 3. Hard-coded safe defaults
 *
 * Automatically loads a `.env` file on first call.
 *
 * The resolved mode depends on:
 * - Whether mock was explicitly requested (`useMock` or `LOGOS_USE_MOCK_LLM`).
 * - Whether a real provider ID was provided.
 * - Whether the API token is available in the environment.
 */
export function resolveProviderConfig(
	options: ProviderConfigOptions = {},
): ProviderConfig {
	loadEnvFile();

	// ── Determine provider and mock flag ────────────────────────────
	const useMock =
		options.useMock === true || process.env.LOGOS_USE_MOCK_LLM === 'true';

	const rawProvider = options.provider ?? process.env[`${ENV_PREFIX}PROVIDER`];

	// ── Resolve provider ID ─────────────────────────────────────────
	let provider: ProviderId;
	let mode: ProviderMode;

	if (useMock) {
		// Explicit mock request — always use mock.
		provider = 'mock';
		mode = 'mock';
	} else if (
		rawProvider !== undefined &&
		rawProvider !== '' &&
		rawProvider !== 'mock'
	) {
		// A real provider was requested.
		provider = rawProvider as ProviderId;

		// Resolve token env var name.
		const tokenEnv =
			options.tokenEnv ??
			process.env[`${ENV_PREFIX}TOKEN_ENV`] ??
			DEFAULT_TOKEN_ENV;

		// Check whether the token is actually available.
		const token = process.env[tokenEnv];
		if (token !== undefined && token !== '') {
			mode = 'real';
		} else {
			mode = 'unconfigured';
		}
	} else {
		// No provider specified — safe default to mock.
		provider = 'mock';
		mode = 'mock';
	}

	// ── Resolve remaining fields ────────────────────────────────────
	const model = resolve(options.model, `${ENV_PREFIX}MODEL`, DEFAULTS.model);
	const baseUrl = resolve(
		options.baseUrl,
		`${ENV_PREFIX}BASE_URL`,
		DEFAULTS.baseUrl,
	);
	const tokenEnv =
		options.tokenEnv ??
		process.env[`${ENV_PREFIX}TOKEN_ENV`] ??
		DEFAULT_TOKEN_ENV;

	const timeoutMs =
		options.timeoutMs ??
		readInt(process.env[`${ENV_PREFIX}TIMEOUT`]) ??
		DEFAULTS.timeoutMs;

	const retry: RetryConfig = {
		...DEFAULT_RETRY_CONFIG,
		...(options.retry ?? {}),
	};

	const disclosureAccepted =
		options.disclosureAccepted ??
		process.env.LOGOS_DISCLOSURE_ACCEPTED === 'true';

	return {
		baseUrl,
		disclosureAccepted,
		mode,
		model,
		provider,
		retry,
		timeoutMs,
		tokenEnv,
	};
}

/**
 * Produce a serialization-safe view of a {@link ProviderConfig}.
 *
 * The returned object never contains raw token values — only a boolean
 * indicating whether the token environment variable is populated.
 */
export function toSafeProviderConfig(
	config: ProviderConfig,
): SafeProviderConfig {
	const tokenValue = process.env[config.tokenEnv];
	const tokenConfigured = tokenValue !== undefined && tokenValue !== '';

	return {
		baseUrl: config.baseUrl,
		disclosureAccepted: config.disclosureAccepted,
		mode: config.mode,
		model: config.model,
		provider: config.provider,
		retry: config.retry,
		timeoutMs: config.timeoutMs,
		tokenConfigured,
		tokenEnv: config.tokenEnv,
	};
}

/**
 * Resolve the actual API key from a {@link ProviderConfig}.
 *
 * Reads `process.env[config.tokenEnv]` at call time and returns
 * the value. Returns `undefined` if the environment variable is
 * not set or empty.
 */
export function resolveApiKey(config: ProviderConfig): string | undefined {
	const value = process.env[config.tokenEnv];
	if (value === undefined || value === '') return undefined;
	return value;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse an integer from a string, returning `undefined` if the string
 * is not a valid non-negative integer.
 */
function readInt(raw: string | undefined): number | undefined {
	if (raw === undefined || raw === '') return undefined;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return Math.floor(parsed);
}

// ─── Compatibility stub ─────────────────────────────────────────────────────

export const LlmConfig = {
	load: loadLlmConfig,
	validate: validateLlmConfig,
};
