import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export const providerPresetIds = [
	'mock',
	'fixture',
	'openai-compatible',
	'openai',
	'openrouter',
	'anthropic',
	'ollama',
	'lm-studio',
	'custom',
] as const;

export const providerAdapterIds = [
	'mock',
	'fixture',
	'openai-compatible',
	'anthropic-compatible',
	'ollama',
] as const;

export type ProviderPresetId = (typeof providerPresetIds)[number];
export type ProviderAdapterId = (typeof providerAdapterIds)[number];

export const tokenSourceSchema = z.discriminatedUnion('type', [
	z.object({
		envVar: z.string().min(1),
		type: z.literal('environment'),
	}),
	z.object({
		key: z.string().min(1),
		service: z.string().min(1),
		type: z.literal('keychain'),
	}),
	z.object({
		type: z.literal('manual_session'),
	}),
	z.object({
		type: z.literal('none'),
	}),
]);

export type TokenSource = z.infer<typeof tokenSourceSchema>;

export const providerTransmissionSchema = z.object({
	contextLeavesMachine: z.boolean(),
	disclosure: z.string().min(1),
	mode: z.enum(['local', 'remote-explicit', 'test-fixture']),
	requiresUserAcknowledgement: z.boolean(),
});

export type ProviderTransmission = z.infer<typeof providerTransmissionSchema>;

export const providerCapabilitySchema = z.object({
	local: z.boolean(),
	requiresToken: z.boolean(),
	streaming: z.boolean(),
	structuredJson: z.boolean(),
});

export type ProviderCapability = z.infer<typeof providerCapabilitySchema>;

export const providerPresetSchema = z.object({
	adapter: z.enum(providerAdapterIds),
	capabilities: providerCapabilitySchema,
	defaultEndpoint: z.string().nullable(),
	defaultModel: z.string().nullable(),
	defaultTimeoutMs: z.number().int().positive(),
	description: z.string().min(1),
	id: z.enum(providerPresetIds),
	modelExamples: z.array(z.string().min(1)),
	name: z.string().min(1),
	tokenEnvVarAliases: z.array(z.string().min(1)),
	transmission: providerTransmissionSchema,
});

export type ProviderPreset = z.infer<typeof providerPresetSchema>;

export const aiProviderConfigSchema = z.object({
	enabled: z.boolean(),
	endpoint: z.string().url().nullable(),
	model: z.string().min(1).nullable(),
	provider: z.enum(providerPresetIds).nullable(),
	remoteContextDisclosureAccepted: z.boolean(),
	timeoutMs: z.number().int().positive().nullable(),
	tokenSource: tokenSourceSchema.nullable(),
});

export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>;

export type ResolvedToken =
	| {
			readonly redacted: string;
			readonly source: TokenSource;
			readonly token: string;
	  }
	| {
			readonly redacted: null;
			readonly source: TokenSource | null;
			readonly token: null;
	  };

const localTransmission = {
	contextLeavesMachine: false,
	disclosure: 'Project context remains on this machine.',
	mode: 'local',
	requiresUserAcknowledgement: false,
} as const satisfies ProviderTransmission;

const fixtureTransmission = {
	contextLeavesMachine: false,
	disclosure: 'Only deterministic fixture data is used.',
	mode: 'test-fixture',
	requiresUserAcknowledgement: false,
} as const satisfies ProviderTransmission;

const remoteTransmission = {
	contextLeavesMachine: true,
	disclosure:
		'Selected project context may be transmitted to the configured remote endpoint.',
	mode: 'remote-explicit',
	requiresUserAcknowledgement: true,
} as const satisfies ProviderTransmission;

export const providerPresetRegistry = [
	{
		adapter: 'mock',
		capabilities: {
			local: true,
			requiresToken: false,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: null,
		defaultModel: 'mock-deterministic',
		defaultTimeoutMs: 1000,
		description: 'Deterministic in-process provider for tests and local flows.',
		id: 'mock',
		modelExamples: ['mock-deterministic'],
		name: 'Mock',
		tokenEnvVarAliases: [],
		transmission: fixtureTransmission,
	},
	{
		adapter: 'fixture',
		capabilities: {
			local: true,
			requiresToken: false,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: null,
		defaultModel: 'fixture-responses',
		defaultTimeoutMs: 1000,
		description: 'Static fixture response provider for deterministic tests.',
		id: 'fixture',
		modelExamples: ['fixture-responses'],
		name: 'Fixture',
		tokenEnvVarAliases: [],
		transmission: fixtureTransmission,
	},
	{
		adapter: 'openai-compatible',
		capabilities: {
			local: false,
			requiresToken: true,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: null,
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description:
			'Any provider exposing an OpenAI-compatible chat completions API.',
		id: 'openai-compatible',
		modelExamples: ['provider/model-name', 'gpt-4.1-mini'],
		name: 'OpenAI-compatible',
		tokenEnvVarAliases: ['LOGOS_LLM_API_KEY'],
		transmission: remoteTransmission,
	},
	{
		adapter: 'openai-compatible',
		capabilities: {
			local: false,
			requiresToken: true,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: 'https://api.openai.com/v1',
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description: 'OpenAI API using the OpenAI-compatible adapter.',
		id: 'openai',
		modelExamples: ['gpt-4.1-mini', 'gpt-4.1'],
		name: 'OpenAI',
		tokenEnvVarAliases: ['LOGOS_LLM_API_KEY', 'OPENAI_API_KEY'],
		transmission: remoteTransmission,
	},
	{
		adapter: 'openai-compatible',
		capabilities: {
			local: false,
			requiresToken: true,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: 'https://openrouter.ai/api/v1',
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description: 'OpenRouter using the OpenAI-compatible adapter.',
		id: 'openrouter',
		modelExamples: ['openai/gpt-4.1-mini', 'anthropic/claude-3.5-sonnet'],
		name: 'OpenRouter',
		tokenEnvVarAliases: ['LOGOS_LLM_API_KEY', 'OPENROUTER_API_KEY'],
		transmission: remoteTransmission,
	},
	{
		adapter: 'anthropic-compatible',
		capabilities: {
			local: false,
			requiresToken: true,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: 'https://api.anthropic.com/v1',
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description: 'Anthropic-compatible messages API.',
		id: 'anthropic',
		modelExamples: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
		name: 'Anthropic',
		tokenEnvVarAliases: ['LOGOS_LLM_API_KEY', 'ANTHROPIC_API_KEY'],
		transmission: remoteTransmission,
	},
	{
		adapter: 'ollama',
		capabilities: {
			local: true,
			requiresToken: false,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: 'http://localhost:11434',
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description: 'Local Ollama chat API.',
		id: 'ollama',
		modelExamples: ['llama3.1', 'mistral'],
		name: 'Ollama',
		tokenEnvVarAliases: [],
		transmission: localTransmission,
	},
	{
		adapter: 'openai-compatible',
		capabilities: {
			local: true,
			requiresToken: false,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: 'http://localhost:1234/v1',
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description: 'Local LM Studio OpenAI-compatible endpoint.',
		id: 'lm-studio',
		modelExamples: ['local-model'],
		name: 'LM Studio',
		tokenEnvVarAliases: [],
		transmission: localTransmission,
	},
	{
		adapter: 'openai-compatible',
		capabilities: {
			local: false,
			requiresToken: false,
			streaming: false,
			structuredJson: true,
		},
		defaultEndpoint: null,
		defaultModel: null,
		defaultTimeoutMs: 60_000,
		description: 'Custom endpoint configured explicitly by the user.',
		id: 'custom',
		modelExamples: ['custom-model'],
		name: 'Custom',
		tokenEnvVarAliases: ['LOGOS_LLM_API_KEY'],
		transmission: remoteTransmission,
	},
] as const satisfies readonly ProviderPreset[];

export const defaultAiProviderConfig = {
	enabled: false,
	endpoint: null,
	model: null,
	provider: null,
	remoteContextDisclosureAccepted: false,
	timeoutMs: null,
	tokenSource: null,
} as const satisfies AiProviderConfig;

export function getProviderPreset(provider: ProviderPresetId): ProviderPreset {
	const preset = providerPresetRegistry.find((item) => item.id === provider);

	if (!preset) {
		throw new ProviderConfigurationError(
			`Unknown provider preset: ${provider}`,
		);
	}

	return preset;
}

export function resolveProviderConfigDefaults(
	config: AiProviderConfig,
): AiProviderConfig {
	if (!config.provider) {
		return config;
	}

	const preset = getProviderPreset(config.provider);

	return {
		...config,
		endpoint: config.endpoint ?? preset.defaultEndpoint,
		model: config.model ?? preset.defaultModel,
		timeoutMs: config.timeoutMs ?? preset.defaultTimeoutMs,
		tokenSource:
			config.tokenSource ??
			createDefaultTokenSource(preset.tokenEnvVarAliases[0] ?? null),
	};
}

export function createDefaultTokenSource(
	envVar: string | null,
): TokenSource | null {
	if (!envVar) {
		return { type: 'none' };
	}

	return {
		envVar,
		type: 'environment',
	};
}

export function resolveTokenFromEnvironment(
	tokenSource: TokenSource | null,
	environment: NodeJS.ProcessEnv = process.env,
): ResolvedToken {
	if (!tokenSource || tokenSource.type === 'none') {
		return {
			redacted: null,
			source: tokenSource,
			token: null,
		};
	}

	if (tokenSource.type !== 'environment') {
		return {
			redacted: null,
			source: tokenSource,
			token: null,
		};
	}

	const token = environment[tokenSource.envVar] ?? null;

	return token
		? {
				redacted: redactSecret(token),
				source: tokenSource,
				token,
			}
		: {
				redacted: null,
				source: tokenSource,
				token: null,
			};
}

export function redactSecret(secret: string): string {
	if (secret.length <= 8) {
		return '[redacted]';
	}

	return `${secret.slice(0, 4)}...[redacted]...${secret.slice(-4)}`;
}

export function redactAiProviderConfig(
	config: AiProviderConfig,
): AiProviderConfig {
	return {
		...config,
		tokenSource:
			config.tokenSource?.type === 'manual_session'
				? { type: 'manual_session' }
				: config.tokenSource,
	};
}

export function assertConfigDoesNotContainRawToken(value: unknown): void {
	const serialized = JSON.stringify(value).toLowerCase();
	const forbiddenKeys = [
		'apikey',
		'api_key',
		'tokenvalue',
		'rawtoken',
		'secret',
	];

	for (const key of forbiddenKeys) {
		if (serialized.includes(`"${key}"`)) {
			throw new ProviderConfigurationError(
				`AI provider config cannot contain raw secret field "${key}".`,
			);
		}
	}
}

export function getGlobalAiDefaultsPath(): string {
	return join(homedir(), '.config', 'logos-engine', 'ai-defaults.json');
}

export class ProviderConfigurationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ProviderConfigurationError';
	}
}
