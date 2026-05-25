// Purpose: LLM configuration model.
// What it should do: Load and validate model endpoint settings from env/config.
// Why it exists: Keeps credentials and provider assumptions explicit.

import type { RetryConfig } from './retry-policy.js';

// ─── Types ───────────────────────────────────────────────────────────────────

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
} as const;

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

// ─── Compatibility stub ─────────────────────────────────────────────────────

export const LlmConfig = {
	load: loadLlmConfig,
	validate: validateLlmConfig,
};
