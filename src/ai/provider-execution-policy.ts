/** AI Provider Execution Policy — enforces mode, disclosure, timeout before provider calls */

import type { AiProviderConfig } from './provider-config-model.js';
import type { AiProviderDiagnostic } from './provider-port.js';

// ---------------------------------------------------------------------------
// Policy evaluation result
// ---------------------------------------------------------------------------

export interface AiProviderExecutionPolicyResult {
	allowed: boolean;
	diagnostics: AiProviderDiagnostic[];
	timeoutMs: number;
}

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

export function evaluateAiProviderExecutionPolicy(
	config: AiProviderConfig,
): AiProviderExecutionPolicyResult {
	const diagnostics: AiProviderDiagnostic[] = [];

	// Disabled
	if (config.mode === 'disabled') {
		return {
			allowed: false,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_DISABLED',
					message:
						'AI provider execution is disabled. Enable the provider to use AI features.',
					recoveryHint:
						'Run /config ai mode remote or /config ai mode local to enable AI assistance.',
					severity: 'error',
				},
			],
			timeoutMs: config.timeoutMs,
		};
	}

	// No provider
	if (config.mode === 'no_provider') {
		return {
			allowed: false,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message:
						'No AI provider is configured. AI features are not available.',
					recoveryHint:
						'Run /config ai to set up an AI provider, or continue with deterministic fallback.',
					severity: 'info',
				},
			],
			timeoutMs: config.timeoutMs,
		};
	}

	// Remote — requires disclosure
	if (config.mode === 'remote') {
		if (!config.disclosure.accepted) {
			diagnostics.push({
				code: 'LOGOS_AI_DISCLOSURE_REQUIRED',
				message:
					'Remote provider execution requires disclosure consent. Context may leave your local machine.',
				recoveryHint:
					'Run /config ai disclosure to review the disclosure preview, then /config ai disclosure accept to consent.',
				severity: 'error',
			});
			return {
				allowed: false,
				diagnostics,
				timeoutMs: config.timeoutMs,
			};
		}

		// Check token env var if provider requires it
		if (config.tokenEnvVar) {
			const tokenValue = process.env[config.tokenEnvVar];
			if (!tokenValue || tokenValue.length === 0) {
				diagnostics.push({
					code: 'LOGOS_AI_TOKEN_ENV_INVALID',
					message: `Token environment variable "${config.tokenEnvVar}" is not set or empty.`,
					recoveryHint: `Set the ${config.tokenEnvVar} environment variable before making remote provider calls.`,
					severity: 'error',
				});
				return {
					allowed: false,
					diagnostics,
					timeoutMs: config.timeoutMs,
				};
			}
		}
	}

	// Local — no disclosure required but validate endpoint
	if (config.mode === 'local' && config.tokenEnvVar) {
		const tokenValue = process.env[config.tokenEnvVar];
		if (!tokenValue || tokenValue.length === 0) {
			diagnostics.push({
				code: 'LOGOS_AI_TOKEN_ENV_INVALID',
				message: `Token environment variable "${config.tokenEnvVar}" is not set or empty.`,
				recoveryHint: `Set the ${config.tokenEnvVar} environment variable if your local provider requires authentication.`,
				severity: 'warning',
			});
			// Continue anyway — local providers may not require auth
		}
	}

	return {
		allowed: true,
		diagnostics,
		timeoutMs: config.timeoutMs,
	};
}

// ---------------------------------------------------------------------------
// Block check convenience
// ---------------------------------------------------------------------------

export function isAiProviderExecutionBlocked(config: AiProviderConfig): {
	blocked: boolean;
	reason: string | undefined;
	recoveryHint: string | undefined;
} {
	const result = evaluateAiProviderExecutionPolicy(config);
	if (result.allowed)
		return { blocked: false, reason: undefined, recoveryHint: undefined };

	const primary = result.diagnostics[0];
	return {
		blocked: true,
		reason: primary?.message,
		recoveryHint: primary?.recoveryHint,
	};
}

// ---------------------------------------------------------------------------
// Timeout-safe execution wrapper
// ---------------------------------------------------------------------------

export interface TimeoutExecutionOptions<T> {
	timeoutMs: number;
	fn: (signal: AbortSignal) => Promise<T>;
}

export interface TimeoutExecutionResult<T> {
	success: boolean;
	result?: T;
	diagnostics: AiProviderDiagnostic[];
}

export async function executeWithTimeout<T>(
	options: TimeoutExecutionOptions<T>,
): Promise<TimeoutExecutionResult<T>> {
	const { timeoutMs, fn } = options;
	const controller = new AbortController();

	const timeoutId = setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	try {
		const result = await fn(controller.signal);
		clearTimeout(timeoutId);

		if (controller.signal.aborted) {
			return {
				diagnostics: [
					{
						code: 'LOGOS_AI_PROVIDER_TIMEOUT',
						message: `Provider call timed out after ${timeoutMs}ms.`,
						recoveryHint:
							'Increase the timeout via /config ai timeout or check provider endpoint availability.',
						severity: 'error',
					},
				],
				success: false,
			};
		}

		return { diagnostics: [], result, success: true };
	} catch (error) {
		clearTimeout(timeoutId);

		if (controller.signal.aborted) {
			return {
				diagnostics: [
					{
						code: 'LOGOS_AI_PROVIDER_TIMEOUT',
						message: `Provider call timed out after ${timeoutMs}ms.`,
						recoveryHint:
							'Increase the timeout via /config ai timeout or check provider endpoint availability.',
						severity: 'error',
					},
				],
				success: false,
			};
		}

		const message = error instanceof Error ? error.message : String(error);
		return {
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_UNAVAILABLE',
					message: `Provider call failed: ${message}`,
					recoveryHint:
						'Check provider endpoint, credentials, and network connectivity. Run /config ai test to verify.',
					severity: 'error',
				},
			],
			success: false,
		};
	}
}

// ---------------------------------------------------------------------------
// Blocked AI path recovery helper
// ---------------------------------------------------------------------------

export function getBlockedAiRecoveryHint(config: AiProviderConfig): string {
	switch (config.mode) {
		case 'disabled':
			return 'AI provider is disabled. Run /config ai mode remote or /config ai mode local to enable AI assistance.';
		case 'no_provider':
			return 'No AI provider configured. Run /config ai to set up an AI provider, or continue with deterministic features (/status, /validate, /diagnose, /generate).';
		case 'remote':
			if (!config.disclosure.accepted) {
				return 'Remote provider requires disclosure. Run /config ai disclosure to review and accept.';
			}
			return 'Check /config ai status for provider configuration details.';
		case 'local':
			return 'Local provider may be unavailable. Run /config ai test to verify connectivity.';
	}
}
