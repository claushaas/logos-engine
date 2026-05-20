/** AI Provider Registry — metadata describing known providers */

import type { AiProviderMode } from './provider-config-model.js';

// ---------------------------------------------------------------------------
// Provider entry
// ---------------------------------------------------------------------------

export interface ProviderRegistryEntry {
	providerId: string;
	displayLabel: string;
	modeCategory: AiProviderMode; // canonical mode category the provider falls under
	requiresToken: boolean;
	requiresEndpoint: boolean;
	requiresDisclosure: boolean;
	defaultEndpoint?: string | undefined;
	supportedModelIds?: string[] | undefined;
	notes?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
	anthropic: {
		defaultEndpoint: 'https://api.anthropic.com/v1',
		displayLabel: 'Anthropic (Remote)',
		modeCategory: 'remote',
		notes:
			'Remote provider. Requires an API key set via the configured environment variable. Context may leave your local machine.',
		providerId: 'anthropic',
		recoveryHint:
			'Set the token environment variable (e.g., ANTHROPIC_API_KEY) and accept remote disclosure before use.',
		requiresDisclosure: true,
		requiresEndpoint: true,
		requiresToken: true,
		supportedModelIds: [
			'claude-sonnet-4-20250514',
			'claude-3-5-sonnet-20241022',
			'claude-3-5-haiku-20241022',
		],
	},
	'fake-provider': {
		defaultEndpoint: undefined,
		displayLabel: 'Fake Provider (Test / Deterministic)',
		modeCategory: 'no_provider',
		notes:
			'Returns deterministic test responses. No network calls are made. Used by default in automated tests.',
		providerId: 'fake-provider',
		recoveryHint: 'No provider is configured; fake provider is in use.',
		requiresDisclosure: false,
		requiresEndpoint: false,
		requiresToken: false,
		supportedModelIds: ['fake-model'],
	},
	'local-custom': {
		defaultEndpoint: 'http://localhost:8080/v1',
		displayLabel: 'Local (Custom Endpoint)',
		modeCategory: 'local',
		notes:
			'Any local provider with a custom API endpoint. Configure endpoint and model as needed.',
		providerId: 'local-custom',
		recoveryHint:
			'Ensure the local provider is running and the endpoint is reachable.',
		requiresDisclosure: false,
		requiresEndpoint: true,
		requiresToken: false,
		supportedModelIds: [],
	},
	'local-openai-compatible': {
		defaultEndpoint: 'http://localhost:11434/v1',
		displayLabel: 'Local (OpenAI-Compatible Endpoint)',
		modeCategory: 'local',
		notes:
			'Local provider running an OpenAI-compatible API (e.g., Ollama, llama.cpp, vLLM). Endpoint must be accessible on localhost.',
		providerId: 'local-openai-compatible',
		recoveryHint:
			'Ensure the local provider is running on the configured endpoint.',
		requiresDisclosure: false,
		requiresEndpoint: true,
		requiresToken: false,
		supportedModelIds: [],
	},
	none: {
		defaultEndpoint: undefined,
		displayLabel: 'No Provider (Fake / Deterministic)',
		modeCategory: 'no_provider',
		notes:
			'Uses the deterministic fake provider for tests and local scaffolding. No remote calls are made.',
		providerId: 'none',
		recoveryHint:
			'No provider is configured. Run /config ai mode remote to set up a remote provider, or continue with no AI assistance.',
		requiresDisclosure: false,
		requiresEndpoint: false,
		requiresToken: false,
		supportedModelIds: ['fake-model'],
	},
	openai: {
		defaultEndpoint: 'https://api.openai.com/v1',
		displayLabel: 'OpenAI (Remote)',
		modeCategory: 'remote',
		notes:
			'Remote provider. Requires an API key set via the configured environment variable. Context may leave your local machine.',
		providerId: 'openai',
		recoveryHint:
			'Set the token environment variable (e.g., OPENAI_API_KEY) and accept remote disclosure before use.',
		requiresDisclosure: true,
		requiresEndpoint: true,
		requiresToken: true,
		supportedModelIds: [
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-4-turbo',
			'gpt-3.5-turbo',
		],
	},
} as const;

// ---------------------------------------------------------------------------
// Registry queries
// ---------------------------------------------------------------------------

export function getProviderEntry(
	providerId: string,
): ProviderRegistryEntry | undefined {
	return PROVIDER_REGISTRY[providerId];
}

export function listProviderIds(): string[] {
	return Object.keys(PROVIDER_REGISTRY);
}

export function listProvidersByMode(
	mode: AiProviderMode,
): ProviderRegistryEntry[] {
	return Object.values(PROVIDER_REGISTRY).filter(
		(e) => e.modeCategory === mode,
	);
}

export function isKnownProvider(providerId: string): boolean {
	return providerId in PROVIDER_REGISTRY;
}

export function formatProviderListForDisplay(): string[] {
	const lines: string[] = ['Available providers:'];

	const modes = ['no_provider', 'local', 'remote'] as const;
	for (const mode of modes) {
		const providers = listProvidersByMode(mode);
		if (providers.length === 0) continue;
		const modeLabel =
			mode === 'no_provider'
				? 'No Provider / Fake'
				: mode === 'local'
					? 'Local'
					: 'Remote';
		lines.push('');
		lines.push(`  ${modeLabel}:`);
		for (const p of providers) {
			lines.push(
				`    ${p.providerId.padEnd(24)} ${p.displayLabel}${p.requiresToken ? ' [token required]' : ''}${p.requiresDisclosure ? ' [disclosure required]' : ''}`,
			);
		}
	}

	return lines;
}
