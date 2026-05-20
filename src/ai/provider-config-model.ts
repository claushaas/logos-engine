/** AI Provider Configuration Model — types, defaults, constants, validators */

import type { WorkspaceProviderConfigReference } from '../state/workspace-state.schema.js';
import type { AiProviderDiagnostic } from './provider-port.js';

// ---------------------------------------------------------------------------
// Provider modes
// ---------------------------------------------------------------------------

export const AI_PROVIDER_MODES = [
	'disabled',
	'no_provider',
	'local',
	'remote',
] as const;

export type AiProviderMode = (typeof AI_PROVIDER_MODES)[number];

// ---------------------------------------------------------------------------
// Timeout constants
// ---------------------------------------------------------------------------

export const DEFAULT_AI_PROVIDER_TIMEOUT_MS = 60_000;
export const MAX_AI_PROVIDER_TIMEOUT_MS = 180_000;

// ---------------------------------------------------------------------------
// Disclosure
// ---------------------------------------------------------------------------

export const AI_PROVIDER_DISCLOSURE_VERSION = '1.0.0';

export const AI_PROVIDER_DISCLOSURE_CONTEXT_CATEGORIES = [
	'user_prompt',
	'bounded_project_context',
	'profile_contract_metadata',
	'generated_documentation_summaries',
	'validation_findings',
	'conversation_session_snippets',
] as const;

export type AiProviderDisclosureContextCategory =
	(typeof AI_PROVIDER_DISCLOSURE_CONTEXT_CATEGORIES)[number];

export interface AiProviderDisclosureState {
	accepted: boolean;
	acceptedAt?: string | undefined;
	declinedAt?: string | undefined;
	version: string;
	contextCategories: AiProviderDisclosureContextCategory[];
}

// ---------------------------------------------------------------------------
// Test summary (redacted)
// ---------------------------------------------------------------------------

export interface AiProviderTestSummary {
	status: 'never_run' | 'passed' | 'failed' | 'blocked' | 'skipped';
	testedAt?: string | undefined;
	providerId?: string | undefined;
	modelId?: string | undefined;
	endpointOrigin?: string | undefined;
	durationMs?: number | undefined;
	diagnosticCodes: string[];
}

// ---------------------------------------------------------------------------
// Full provider config (normalized, resolved from workspace state)
// ---------------------------------------------------------------------------

export interface AiProviderConfig {
	mode: AiProviderMode;
	providerId?: string | undefined;
	modelId?: string | undefined;
	endpoint?: string | undefined;
	tokenEnvVar?: string | undefined;
	timeoutMs: number;
	disclosure: AiProviderDisclosureState;
	lastTest?: AiProviderTestSummary | undefined;
	updatedAt?: string | undefined;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function defaultAiProviderDisclosureState(): AiProviderDisclosureState {
	return {
		accepted: false,
		contextCategories: [...AI_PROVIDER_DISCLOSURE_CONTEXT_CATEGORIES],
		version: AI_PROVIDER_DISCLOSURE_VERSION,
	};
}

export function defaultAiProviderConfig(): AiProviderConfig {
	return {
		disclosure: defaultAiProviderDisclosureState(),
		mode: 'no_provider',
		timeoutMs: DEFAULT_AI_PROVIDER_TIMEOUT_MS,
	};
}

// ---------------------------------------------------------------------------
// Normalize from workspace state reference
// ---------------------------------------------------------------------------

export function normalizeAiProviderConfig(
	ref: WorkspaceProviderConfigReference | undefined,
): AiProviderConfig {
	if (!ref) return defaultAiProviderConfig();

	const mode: AiProviderMode = ref.mode
		? ref.mode
		: ref.enabled
			? 'remote'
			: 'no_provider';

	const disclosure: AiProviderDisclosureState = ref.disclosure
		? {
				accepted: ref.disclosure.accepted,
				acceptedAt: ref.disclosure.acceptedAt,
				contextCategories: (ref.disclosure.contextCategories ??
					[]) as AiProviderDisclosureContextCategory[],
				declinedAt: ref.disclosure.declinedAt,
				version: ref.disclosure.version ?? AI_PROVIDER_DISCLOSURE_VERSION,
			}
		: defaultAiProviderDisclosureState();

	return {
		disclosure,
		endpoint: ref.endpoint,
		lastTest: ref.lastTest,
		mode,
		modelId: ref.modelId,
		providerId: ref.providerId,
		timeoutMs: ref.timeoutMs ?? DEFAULT_AI_PROVIDER_TIMEOUT_MS,
		tokenEnvVar: ref.tokenEnvVarName ?? ref.apiKeyEnvVarName,
		updatedAt: ref.updatedAt,
	};
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function isValidAiProviderMode(value: unknown): value is AiProviderMode {
	return (
		typeof value === 'string' &&
		(AI_PROVIDER_MODES as readonly string[]).includes(value)
	);
}

export function looksLikeRawSecret(value: string): boolean {
	if (typeof value !== 'string') return false;
	const lower = value.toLowerCase();
	if (lower.startsWith('sk-')) return true;
	if (lower.startsWith('sk_')) return true;
	if (lower.startsWith('bearer ')) return true;
	if (lower.startsWith('basic ')) return true;
	if (lower.startsWith('authorization:')) return true;
	if (value.startsWith('Authorization:')) return true;
	if (/^[A-Za-z]+=/.test(value) && value.length > 40) return true;
	if (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/=]{30,}/.test(value)
	)
		return true;
	if (
		value.length > 20 &&
		/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)
	)
		return true;
	return false;
}

export function isValidTokenEnvVarName(value: string): boolean {
	if (typeof value !== 'string' || value.length === 0) return false;
	if (looksLikeRawSecret(value)) return false;
	// Reject KEY=value assignments
	if (value.includes('=')) return false;
	// Reject spaces and shell metacharacters
	if (/[\s$`!&|;<>#]/.test(value)) return false;
	// Reject authorization header strings
	if (/^(bearer|basic|authorization)/i.test(value)) return false;
	// Accept typical env var names like OPENAI_API_KEY, ANTHROPIC_API_KEY, LOGOS_AI_TOKEN
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return false;
	return true;
}

export function isValidEndpoint(
	value: string,
	mode: AiProviderMode,
): { valid: boolean; diagnostic?: AiProviderDiagnostic } {
	if (typeof value !== 'string' || value.length === 0) {
		return {
			diagnostic: {
				code: 'LOGOS_AI_ENDPOINT_INVALID',
				message: 'Endpoint must be a non-empty string.',
				recoveryHint: 'Provide a valid URL for the provider endpoint.',
				severity: 'error',
			},
			valid: false,
		};
	}

	// Reject unsafe protocols
	const lower = value.toLowerCase();
	if (lower.startsWith('ftp://') || lower.startsWith('file://')) {
		return {
			diagnostic: {
				code: 'LOGOS_AI_ENDPOINT_INVALID',
				message: 'Endpoint uses an unsafe protocol.',
				recoveryHint:
					'Use https:// or http://localhost for provider endpoints.',
				severity: 'error',
			},
			valid: false,
		};
	}

	// Reject URLs with embedded credentials
	if (/https?:\/\/[^@]*:[^@]*@/.test(value)) {
		return {
			diagnostic: {
				code: 'LOGOS_AI_ENDPOINT_INVALID',
				message: 'Endpoint contains embedded credentials.',
				recoveryHint:
					'Remove credentials from the URL; use token-env for authentication.',
				severity: 'error',
			},
			valid: false,
		};
	}

	// Remote mode requires https
	if (mode === 'remote' && !lower.startsWith('https://')) {
		return {
			diagnostic: {
				code: 'LOGOS_AI_ENDPOINT_INVALID',
				message: 'Remote provider endpoint must use https://.',
				recoveryHint: 'Use an https:// URL for remote providers.',
				severity: 'error',
			},
			valid: false,
		};
	}

	// Local mode allows http://localhost or https://
	if (mode === 'local') {
		if (
			!lower.startsWith('https://') &&
			!lower.startsWith('http://localhost') &&
			!lower.startsWith('http://127.0.0.1')
		) {
			return {
				diagnostic: {
					code: 'LOGOS_AI_ENDPOINT_INVALID',
					message:
						'Local provider endpoint must use https:// or http://localhost.',
					recoveryHint:
						'Use http://localhost:PORT or https:// for local providers.',
					severity: 'error',
				},
				valid: false,
			};
		}
	}

	return { valid: true };
}

export function redactEndpointUrl(url: string): string {
	// Remove query parameters which may contain tokens
	try {
		const parsed = new URL(url);
		if (parsed.search) {
			return `${parsed.origin}${parsed.pathname}?<redacted>`;
		}
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		// Best-effort: strip query string
		const qIdx = url.indexOf('?');
		if (qIdx >= 0) return `${url.slice(0, qIdx)}?<redacted>`;
		return url;
	}
}

export function endpointOrigin(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).origin;
	} catch {
		// Best-effort extraction
		const match = /^(https?:\/\/[^/?#]+)/.exec(url);
		return match ? match[1] : undefined;
	}
}

export function validateTimeout(value: number): {
	valid: boolean;
	diagnostic?: AiProviderDiagnostic;
} {
	if (!Number.isFinite(value) || value <= 0) {
		return {
			diagnostic: {
				code: 'LOGOS_AI_TIMEOUT_INVALID',
				message: `Timeout must be a positive number. Received: ${value}`,
				recoveryHint:
					'Provide a valid timeout in milliseconds (e.g., 60000 for 60 seconds).',
				severity: 'error',
			},
			valid: false,
		};
	}

	if (value > MAX_AI_PROVIDER_TIMEOUT_MS) {
		return {
			diagnostic: {
				code: 'LOGOS_AI_TIMEOUT_TOO_HIGH',
				message: `Timeout ${value}ms exceeds the maximum of ${MAX_AI_PROVIDER_TIMEOUT_MS}ms (180 seconds).`,
				recoveryHint: `Provide a timeout between 1 and ${MAX_AI_PROVIDER_TIMEOUT_MS} milliseconds.`,
				severity: 'error',
			},
			valid: false,
		};
	}

	return { valid: true };
}

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

export function redactSecretValue(value: string): string {
	if (value.length <= 4) return '***';
	return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

export function redactProviderConfigForDisplay(
	config: AiProviderConfig,
): AiProviderConfig {
	return {
		...config,
		endpoint: config.endpoint ? redactEndpointUrl(config.endpoint) : undefined,
		tokenEnvVar: config.tokenEnvVar, // env var name is safe to display
	};
}

// Build a status text summary — never returns raw tokens
export function formatAiProviderStatusText(config: AiProviderConfig): string {
	switch (config.mode) {
		case 'disabled':
			return 'disabled (provider execution is turned off)';
		case 'no_provider':
			return 'not configured (no AI provider selected)';
		case 'local':
			return `local${config.providerId ? ` (${config.providerId})` : ''}`;
		case 'remote': {
			const consented = config.disclosure.accepted ? 'disclosed' : 'blocked';
			const provider = config.providerId ?? 'unknown';
			return `remote ${provider} [${consented}]`;
		}
	}
}
