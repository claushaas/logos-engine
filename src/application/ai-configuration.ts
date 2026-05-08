import { join } from 'node:path';
import {
	type AiProviderConfig,
	aiProviderConfigSchema,
	assertConfigDoesNotContainRawToken,
	defaultAiProviderConfig,
	getProviderPreset,
	providerPresetRegistry,
	redactAiProviderConfig,
	resolveProviderConfigDefaults,
	resolveTokenFromEnvironment,
	type TokenSource,
} from '../ai/provider-config.js';
import {
	readWorkspaceState,
	workspaceSchemaVersion,
} from '../domain/workspace-state.js';
import { detectProjectRoot } from '../storage/project-root.js';
import { atomicReplaceJsonFile } from '../storage/safe-file-writes.js';

export type AiConfigCommandResult = {
	readonly changed: boolean;
	readonly lines: readonly string[];
	readonly status: 'error' | 'ok';
	readonly title: string;
};

export function showAiConfiguration(cwd: string): AiConfigCommandResult {
	const projectRoot = detectProjectRoot(cwd);
	const state = readWorkspaceState(projectRoot);
	const config = redactAiProviderConfig(state.config.ai);
	const lines = [
		`Enabled: ${config.enabled}`,
		`Provider: ${config.provider ?? '(not configured)'}`,
		`Endpoint: ${config.endpoint ?? '(provider default)'}`,
		`Model: ${config.model ?? '(not configured)'}`,
		`Timeout: ${config.timeoutMs ?? '(provider default)'} ms`,
		`Token source: ${formatTokenSource(config.tokenSource)}`,
		`Remote disclosure accepted: ${config.remoteContextDisclosureAccepted}`,
		'Available presets:',
		...providerPresetRegistry.map(
			(preset) =>
				`- ${preset.id}: ${preset.name}; ${preset.transmission.mode}; token required: ${preset.capabilities.requiresToken}`,
		),
		'Raw tokens are not stored in .logos/config.json.',
	];

	return {
		changed: false,
		lines,
		status: 'ok',
		title: 'AI configuration',
	};
}

export function disableAiConfiguration(cwd: string): AiConfigCommandResult {
	const projectRoot = detectProjectRoot(cwd);
	const state = readWorkspaceState(projectRoot);
	const nextConfig = {
		...state.config,
		ai: defaultAiProviderConfig,
	};

	writeWorkspaceConfig(projectRoot, nextConfig);

	return {
		changed: true,
		lines: ['AI provider usage is disabled.', 'No raw tokens were written.'],
		status: 'ok',
		title: 'AI configuration disabled',
	};
}

export function updateAiConfiguration(
	cwd: string,
	args: readonly string[],
): AiConfigCommandResult {
	const projectRoot = detectProjectRoot(cwd);
	const state = readWorkspaceState(projectRoot);
	const parsed = parseAiConfigArgs(args);

	if (!parsed.ok) {
		return {
			changed: false,
			lines: [parsed.message],
			status: 'error',
			title: 'AI configuration failed',
		};
	}

	const provider = parsed.values.provider ?? state.config.ai.provider;
	const preset = provider ? getProviderPreset(provider) : null;
	const currentWithDefaults = resolveProviderConfigDefaults(state.config.ai);
	const nextAiConfig = aiProviderConfigSchema.parse({
		enabled: true,
		endpoint:
			parsed.values.endpoint ??
			state.config.ai.endpoint ??
			preset?.defaultEndpoint ??
			null,
		model:
			parsed.values.model ??
			state.config.ai.model ??
			preset?.defaultModel ??
			null,
		provider,
		remoteContextDisclosureAccepted:
			parsed.values.remoteContextDisclosureAccepted ??
			state.config.ai.remoteContextDisclosureAccepted,
		timeoutMs:
			parsed.values.timeoutMs ??
			state.config.ai.timeoutMs ??
			preset?.defaultTimeoutMs ??
			currentWithDefaults.timeoutMs,
		tokenSource:
			parsed.values.tokenSource ??
			state.config.ai.tokenSource ??
			createTokenSourceFromPreset(preset),
	});

	assertConfigDoesNotContainRawToken(nextAiConfig);
	writeWorkspaceConfig(projectRoot, {
		...state.config,
		ai: nextAiConfig,
	});

	return {
		changed: true,
		lines: [
			`Provider: ${nextAiConfig.provider ?? '(not configured)'}`,
			`Endpoint: ${nextAiConfig.endpoint ?? '(provider default)'}`,
			`Model: ${nextAiConfig.model ?? '(not configured)'}`,
			`Token source: ${formatTokenSource(nextAiConfig.tokenSource)}`,
			'Raw tokens were not written to .logos/config.json.',
		],
		status: 'ok',
		title: 'AI configuration updated',
	};
}

export function testAiConfiguration(
	cwd: string,
	environment: NodeJS.ProcessEnv = process.env,
): AiConfigCommandResult {
	const projectRoot = detectProjectRoot(cwd);
	const state = readWorkspaceState(projectRoot);
	const config = resolveProviderConfigDefaults(state.config.ai);

	if (!config.enabled || !config.provider) {
		return {
			changed: false,
			lines: ['AI provider usage is disabled or not configured.'],
			status: 'error',
			title: 'AI configuration check failed',
		};
	}

	const preset = getProviderPreset(config.provider);
	const token = resolveTokenFromEnvironment(config.tokenSource, environment);

	if (
		preset.transmission.requiresUserAcknowledgement &&
		!config.remoteContextDisclosureAccepted
	) {
		return {
			changed: false,
			lines: [
				'Remote provider usage requires explicit acknowledgement with --allow-remote.',
				preset.transmission.disclosure,
			],
			status: 'error',
			title: 'AI configuration check failed',
		};
	}

	if (preset.capabilities.requiresToken && !token.token) {
		return {
			changed: false,
			lines: [
				`Token was not found in ${formatTokenSource(config.tokenSource)}.`,
				'No files were changed.',
			],
			status: 'error',
			title: 'AI configuration check failed',
		};
	}

	return {
		changed: false,
		lines: [
			`Provider preset ${preset.id} is configured.`,
			`Transmission: ${preset.transmission.mode}. ${preset.transmission.disclosure}`,
			token.redacted
				? `Token resolved from ${formatTokenSource(token.source)} as ${token.redacted}.`
				: 'No token is required or configured.',
			'No live model call was made by this deterministic configuration check.',
		],
		status: 'ok',
		title: 'AI configuration check passed',
	};
}

function writeWorkspaceConfig(projectRoot: string, config: unknown): void {
	assertConfigDoesNotContainRawToken(config);
	atomicReplaceJsonFile(join(projectRoot, '.logos', 'config.json'), {
		...(config as object),
		schemaVersion: workspaceSchemaVersion,
	});
	readWorkspaceState(projectRoot);
}

function parseAiConfigArgs(args: readonly string[]):
	| {
			readonly ok: true;
			readonly values: {
				readonly endpoint?: string;
				readonly model?: string;
				readonly provider?: AiProviderConfig['provider'];
				readonly remoteContextDisclosureAccepted?: boolean;
				readonly timeoutMs?: number;
				readonly tokenSource?: TokenSource;
			};
	  }
	| {
			readonly message: string;
			readonly ok: false;
	  } {
	const values: {
		endpoint?: string;
		model?: string;
		provider?: AiProviderConfig['provider'];
		remoteContextDisclosureAccepted?: boolean;
		timeoutMs?: number;
		tokenSource?: TokenSource;
	} = {};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (!arg) {
			continue;
		}

		switch (arg) {
			case '--allow-remote':
				values.remoteContextDisclosureAccepted = true;
				break;
			case '--endpoint':
				values.endpoint = readNextArg(args, index, arg);
				index += 1;
				break;
			case '--model':
				values.model = readNextArg(args, index, arg);
				index += 1;
				break;
			case '--provider':
				values.provider = aiProviderConfigSchema.shape.provider.parse(
					readNextArg(args, index, arg),
				);
				index += 1;
				break;
			case '--timeout-ms':
				values.timeoutMs = Number.parseInt(readNextArg(args, index, arg), 10);
				if (!Number.isInteger(values.timeoutMs) || values.timeoutMs <= 0) {
					return {
						message: '--timeout-ms must be a positive integer.',
						ok: false,
					};
				}
				index += 1;
				break;
			case '--token-env':
				values.tokenSource = {
					envVar: readNextArg(args, index, arg),
					type: 'environment',
				};
				index += 1;
				break;
			default:
				if (
					arg.toLowerCase().includes('key') ||
					arg.toLowerCase().includes('token')
				) {
					return {
						message:
							'Raw tokens are not accepted as slash command arguments. Use --token-env NAME.',
						ok: false,
					};
				}

				return {
					message: `Unknown /config ai option: ${arg}`,
					ok: false,
				};
		}
	}

	return {
		ok: true,
		values,
	};
}

function readNextArg(
	args: readonly string[],
	index: number,
	option: string,
): string {
	const value = args[index + 1];

	if (!value || value.startsWith('--')) {
		throw new Error(`${option} requires a value.`);
	}

	return value;
}

function createTokenSourceFromPreset(
	preset: ReturnType<typeof getProviderPreset> | null,
): TokenSource | null {
	const envVar = preset?.tokenEnvVarAliases[0] ?? null;

	return envVar
		? {
				envVar,
				type: 'environment',
			}
		: { type: 'none' };
}

function formatTokenSource(tokenSource: TokenSource | null): string {
	if (!tokenSource) {
		return '(not configured)';
	}

	switch (tokenSource.type) {
		case 'environment':
			return `environment:${tokenSource.envVar}`;
		case 'keychain':
			return `keychain:${tokenSource.service}/${tokenSource.key}`;
		case 'manual_session':
			return 'manual session';
		case 'none':
			return 'none';
	}
}
