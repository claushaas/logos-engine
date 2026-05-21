/** AI Provider Configuration Service — reads/writes provider config via workspace state */

import type { WorkspaceProviderConfigReference } from '../state/workspace-state.schema.js';
import {
	readWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import {
	AI_PROVIDER_DISCLOSURE_CONTEXT_CATEGORIES,
	AI_PROVIDER_DISCLOSURE_VERSION,
	type AiProviderConfig,
	type AiProviderMode,
	type AiProviderTestSummary,
	defaultAiProviderConfig,
	defaultAiProviderDisclosureState,
	endpointOrigin,
	isValidAiProviderMode,
	isValidEndpoint,
	isValidTokenEnvVarName,
	looksLikeRawSecret,
	normalizeAiProviderConfig,
	validateTimeout,
} from './provider-config-model.js';
import type { AiProviderDiagnostic } from './provider-port.js';
import {
	getProviderEntry,
	isKnownProvider,
	PROVIDER_REGISTRY,
} from './provider-registry.js';

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export interface AiProviderConfigResult {
	success: boolean;
	config: AiProviderConfig;
	diagnostics: AiProviderDiagnostic[];
	messages: string[];
	changedPaths: string[];
}

// ---------------------------------------------------------------------------
// Common options
// ---------------------------------------------------------------------------

export interface AiProviderConfigServiceOptions {
	projectRoot: string;
	dryRun?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Helper: read current state and normalize
// ---------------------------------------------------------------------------

async function loadConfig(
	projectRoot: string,
): Promise<{ config: AiProviderConfig; workspaceExists: boolean }> {
	const readResult = await readWorkspaceState({ projectRoot });
	if (!readResult.success || !readResult.state) {
		return { config: defaultAiProviderConfig(), workspaceExists: false };
	}
	return {
		config: normalizeAiProviderConfig(readResult.state.provider),
		workspaceExists: true,
	};
}

function toWorkspaceRef(
	config: AiProviderConfig,
): WorkspaceProviderConfigReference {
	return {
		disclosure: {
			accepted: config.disclosure.accepted,
			acceptedAt: config.disclosure.acceptedAt,
			contextCategories: config.disclosure.contextCategories,
			declinedAt: config.disclosure.declinedAt,
			version: config.disclosure.version,
		},
		enabled: config.mode !== 'disabled' && config.mode !== 'no_provider',
		endpoint: config.endpoint,
		lastTest: config.lastTest,
		mode: config.mode,
		modelId: config.modelId,
		providerId: config.providerId ?? 'none',
		timeoutMs: config.timeoutMs,
		tokenEnvVarName: config.tokenEnvVar,
		updatedAt: config.updatedAt ?? new Date().toISOString(),
	};
}

async function writeConfig(
	options: AiProviderConfigServiceOptions,
	config: AiProviderConfig,
): Promise<AiProviderConfigResult> {
	const { projectRoot, dryRun } = options;

	const updateResult = await updateWorkspaceState({
		dryRun,
		projectRoot,
		updater: (state) => {
			state.provider = toWorkspaceRef(config);
			return state;
		},
	});

	const diagnostics: AiProviderDiagnostic[] = updateResult.diagnostics.map(
		(d) => ({
			code: d.code,
			message: d.message,
			recoveryHint: d.recoveryHint,
			severity: d.severity,
		}),
	);

	return {
		changedPaths: updateResult.changedPaths,
		config,
		diagnostics,
		messages: dryRun
			? ['(dry-run: no changes written)']
			: updateResult.success
				? ['Provider configuration updated.']
				: ['Failed to update provider configuration.'],
		success: updateResult.success,
	};
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function getAiProviderStatus(
	options: AiProviderConfigServiceOptions,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);

	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message:
						'Workspace is not initialized. AI provider configuration is not available.',
					recoveryHint:
						'Run /init to initialize the workspace, then /config ai to configure a provider.',
					severity: 'warning',
				},
			],
			messages: ['Workspace not initialized. Use /init first.'],
			success: false,
		};
	}

	return {
		changedPaths: [],
		config,
		diagnostics: [],
		messages: [],
		success: true,
	};
}

// ---------------------------------------------------------------------------
// Set mode
// ---------------------------------------------------------------------------

export async function setAiProviderMode(
	options: AiProviderConfigServiceOptions,
	mode: string,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);

	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot set provider mode without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	// Normalize no-provider vs no_provider
	const normalized = mode === 'no-provider' ? 'no_provider' : mode;

	if (!isValidAiProviderMode(normalized)) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_MODE_INVALID',
					message: `Invalid provider mode: "${mode}". Valid modes: no_provider, local, remote, disabled.`,
					recoveryHint: 'Use one of: disabled, no_provider, local, remote.',
					severity: 'error',
				},
			],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		mode: normalized as AiProviderMode,
		updatedAt: new Date().toISOString(),
	};

	// Reset disclosure when switching away from remote
	if (normalized !== 'remote') {
		next.disclosure = defaultAiProviderDisclosureState();
	}

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Set provider
// ---------------------------------------------------------------------------

export async function setAiProvider(
	options: AiProviderConfigServiceOptions,
	providerId: string,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot set provider without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	if (!isKnownProvider(providerId)) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_UNKNOWN',
					message: `Unknown provider: "${providerId}". Use /config ai providers to see available options.`,
					recoveryHint: `Available providers: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`,
					severity: 'error',
				},
			],
			messages: [],
			success: false,
		};
	}

	const entry = getProviderEntry(providerId);
	if (!entry) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_UNKNOWN',
					message: `Internal inconsistency: provider "${providerId}" passed validation but was not found in the registry.`,
					recoveryHint:
						'This is an unexpected error. Check provider registry consistency.',
					severity: 'error',
				},
			],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		mode: entry.modeCategory,
		providerId,
		updatedAt: new Date().toISOString(),
	};

	// Set default endpoint if available
	if (entry.defaultEndpoint && !next.endpoint) {
		next.endpoint = entry.defaultEndpoint;
	}

	// Reset disclosure when changing to non-remote
	if (entry.modeCategory !== 'remote') {
		next.disclosure = defaultAiProviderDisclosureState();
	}

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Set model
// ---------------------------------------------------------------------------

export async function setAiProviderModel(
	options: AiProviderConfigServiceOptions,
	modelId: string,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot set model without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	if (!modelId || typeof modelId !== 'string' || modelId.trim().length === 0) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_MODEL_MISSING',
					message: 'Model ID must be a non-empty string.',
					recoveryHint:
						'Provide a valid model identifier (e.g., gpt-4o, claude-sonnet-4).',
					severity: 'error',
				},
			],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		modelId: modelId.trim(),
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Set endpoint
// ---------------------------------------------------------------------------

export async function setAiProviderEndpoint(
	options: AiProviderConfigServiceOptions,
	endpoint: string,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot set endpoint without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	const validation = isValidEndpoint(endpoint, config.mode);
	if (!validation.valid) {
		return {
			changedPaths: [],
			config,
			diagnostics: validation.diagnostic ? [validation.diagnostic] : [],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		endpoint,
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Set token env var
// ---------------------------------------------------------------------------

export async function setAiProviderTokenEnvVar(
	options: AiProviderConfigServiceOptions,
	envVarName: string,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot set token env var without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	// Reject raw secrets and invalid env var names
	if (looksLikeRawSecret(envVarName)) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_TOKEN_VALUE_REJECTED',
					message:
						'The provided value looks like a raw token value, not an environment variable name. Only environment variable names are stored.',
					recoveryHint:
						'Provide only the environment variable name (e.g., OPENAI_API_KEY), not the token value itself.',
					severity: 'error',
				},
			],
			messages: [],
			success: false,
		};
	}

	if (!isValidTokenEnvVarName(envVarName)) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_TOKEN_ENV_INVALID',
					message: `Invalid environment variable name: "${envVarName}". Must be a valid shell variable name (e.g., OPENAI_API_KEY).`,
					recoveryHint:
						'Use only letters, digits, and underscores, starting with a letter or underscore.',
					severity: 'error',
				},
			],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		tokenEnvVar: envVarName,
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Set timeout
// ---------------------------------------------------------------------------

export async function setAiProviderTimeout(
	options: AiProviderConfigServiceOptions,
	timeoutMs: number,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot set timeout without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	const validation = validateTimeout(timeoutMs);
	if (!validation.valid) {
		return {
			changedPaths: [],
			config,
			diagnostics: validation.diagnostic ? [validation.diagnostic] : [],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		timeoutMs,
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Accept disclosure
// ---------------------------------------------------------------------------

export async function acceptAiProviderDisclosure(
	options: AiProviderConfigServiceOptions,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot accept disclosure without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	const now = new Date().toISOString();
	const next: AiProviderConfig = {
		...config,
		disclosure: {
			accepted: true,
			acceptedAt: now,
			contextCategories: config.disclosure.contextCategories,
			version: AI_PROVIDER_DISCLOSURE_VERSION,
		},
		updatedAt: now,
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Decline disclosure
// ---------------------------------------------------------------------------

export async function declineAiProviderDisclosure(
	options: AiProviderConfigServiceOptions,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message:
						'Cannot decline disclosure without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	const now = new Date().toISOString();
	const next: AiProviderConfig = {
		...config,
		disclosure: {
			accepted: false,
			contextCategories: config.disclosure.contextCategories,
			declinedAt: now,
			version: AI_PROVIDER_DISCLOSURE_VERSION,
		},
		updatedAt: now,
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Disable provider
// ---------------------------------------------------------------------------

export async function disableAiProvider(
	options: AiProviderConfigServiceOptions,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot disable provider without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		mode: 'disabled',
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Reset provider config
// ---------------------------------------------------------------------------

export async function resetAiProviderConfig(
	options: AiProviderConfigServiceOptions,
): Promise<AiProviderConfigResult> {
	const { workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config: defaultAiProviderConfig(),
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message:
						'Cannot reset provider config without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	const defaults = defaultAiProviderConfig();
	return writeConfig(options, defaults);
}

// ---------------------------------------------------------------------------
// Disclosure preview (read-only — no writes)
// ---------------------------------------------------------------------------

export interface DisclosurePreview {
	providerId: string;
	modelId: string | undefined;
	endpointOrigin: string | undefined;
	tokenSource: string | undefined;
	timeoutMs: number;
	contextCategories: string[];
	statement: string;
}

export async function getDisclosurePreview(
	options: AiProviderConfigServiceOptions,
): Promise<{ preview?: DisclosurePreview; config: AiProviderConfig }> {
	const { config } = await loadConfig(options.projectRoot);

	if (config.mode !== 'remote' || !config.providerId) {
		return { config };
	}

	const origin = endpointOrigin(config.endpoint);
	const preview: DisclosurePreview = {
		contextCategories: [
			...AI_PROVIDER_DISCLOSURE_CONTEXT_CATEGORIES,
		] as string[],
		endpointOrigin: origin,
		modelId: config.modelId,
		providerId: config.providerId,
		statement:
			'Enabling a remote AI provider means selected project context (answers, decisions, assumptions, document summaries, and session context) may leave your local machine and be sent to the remote provider. No raw repository files, source code, environment secrets, or private chat history are sent. You can inspect and disable remote execution at any time via /config ai.',
		timeoutMs: config.timeoutMs,
		tokenSource: config.tokenEnvVar
			? `$${config.tokenEnvVar} (environment variable)`
			: undefined,
	};

	return { config, preview };
}

// ---------------------------------------------------------------------------
// Provider test (synthetic context only)
// ---------------------------------------------------------------------------

export async function testAiProvider(
	options: AiProviderConfigServiceOptions & {
		/** Inject a test runner for deterministic testing */
		_testRunner?: (config: AiProviderConfig) => Promise<AiProviderTestSummary>;
	},
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);

	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message: 'Cannot test provider without an initialized workspace.',
					recoveryHint: 'Run /init first.',
					severity: 'error',
				},
			],
			messages: ['Workspace not initialized.'],
			success: false,
		};
	}

	// Check blocked states
	if (config.mode === 'disabled') {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_DISABLED',
					message: 'Provider is disabled. Enable it before testing.',
					recoveryHint:
						'Run /config ai mode remote or /config ai mode local to enable the provider.',
					severity: 'warning',
				},
			],
			messages: ['Provider is disabled.'],
			success: false,
		};
	}

	if (config.mode === 'no_provider') {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_NOT_CONFIGURED',
					message:
						'No provider is configured. Select a provider before testing.',
					recoveryHint:
						'Run /config ai mode local or /config ai mode remote to configure a provider.',
					severity: 'warning',
				},
			],
			messages: ['No provider configured.'],
			success: false,
		};
	}

	if (config.mode === 'remote' && !config.disclosure.accepted) {
		return {
			changedPaths: [],
			config,
			diagnostics: [
				{
					code: 'LOGOS_AI_PROVIDER_TEST_BLOCKED',
					message:
						'Remote provider test is blocked because disclosure consent has not been accepted.',
					recoveryHint:
						'Run /config ai disclosure to review the disclosure, then /config ai disclosure accept to consent.',
					severity: 'error',
				},
			],
			messages: ['Remote provider test requires disclosure consent.'],
			success: false,
		};
	}

	// Run the test
	let testSummary: AiProviderTestSummary;
	try {
		if (options._testRunner) {
			testSummary = await options._testRunner(config);
		} else {
			// Default: return never_run (real test requires provider port injection)
			testSummary = {
				diagnosticCodes: [],
				status: 'skipped',
				testedAt: new Date().toISOString(),
			};
		}
	} catch {
		testSummary = {
			diagnosticCodes: ['LOGOS_AI_PROVIDER_TEST_FAILED'],
			status: 'failed',
			testedAt: new Date().toISOString(),
		};
	}

	const next: AiProviderConfig = {
		...config,
		lastTest: testSummary,
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}

// ---------------------------------------------------------------------------
// Sync lastTest into config (used by external test runner)
// ---------------------------------------------------------------------------

export async function storeAiProviderTestResult(
	options: AiProviderConfigServiceOptions,
	testSummary: AiProviderTestSummary,
): Promise<AiProviderConfigResult> {
	const { config, workspaceExists } = await loadConfig(options.projectRoot);
	if (!workspaceExists) {
		return {
			changedPaths: [],
			config,
			diagnostics: [],
			messages: [],
			success: false,
		};
	}

	const next: AiProviderConfig = {
		...config,
		lastTest: testSummary,
		updatedAt: new Date().toISOString(),
	};

	return writeConfig(options, next);
}
