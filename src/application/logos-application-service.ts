import type { SlashCommandId } from '../commands/slash-command-registry.js';
import {
	disableAiConfiguration,
	showAiConfiguration,
	testAiConfiguration,
	updateAiConfiguration,
} from './ai-configuration.js';
import { initializeWorkspace } from './workspace-initialization.js';

export type ApplicationCommandResult = {
	readonly body: readonly string[];
	readonly status: 'error' | 'ok' | 'not_implemented';
	readonly title: string;
};

export type ApplicationServiceContext = {
	readonly cwd: string;
};

export type LogosApplicationServices = {
	readonly continueIntake: () => ApplicationCommandResult;
	readonly diagnoseWorkspace: () => ApplicationCommandResult;
	readonly generateDocuments: () => ApplicationCommandResult;
	readonly initializeWorkspace: (
		context: ApplicationServiceContext,
	) => ApplicationCommandResult;
	readonly showAiConfig: (
		context: ApplicationServiceContext,
		args: readonly string[],
	) => ApplicationCommandResult;
	readonly showHelp: () => ApplicationCommandResult;
	readonly showStatus: () => ApplicationCommandResult;
	readonly validateWorkspace: () => ApplicationCommandResult;
};

export function createLogosApplicationServices(): LogosApplicationServices {
	return {
		continueIntake: () =>
			createStubResult(
				'/continue',
				'Guided intake will resume the next useful question group in a later phase.',
			),
		diagnoseWorkspace: () =>
			createStubResult(
				'/diagnose',
				'Diagnostics will analyze gaps, assumptions, risks, and affected documents in a later phase.',
			),
		generateDocuments: () =>
			createStubResult(
				'/generate',
				'Document rendering will create or refresh Markdown projections in a later phase.',
			),
		initializeWorkspace: (context) => createInitializeWorkspaceResult(context),
		showAiConfig: (context, args) => createAiConfigResult(context, args),
		showHelp: () => ({
			body: ['Type a slash command or use autocomplete to inspect options.'],
			status: 'ok',
			title: 'LOGOS command help',
		}),
		showStatus: () =>
			createStubResult(
				'/status',
				'Project progress will load from structured workspace state in a later phase.',
			),
		validateWorkspace: () =>
			createStubResult(
				'/validate',
				'Deterministic validation will check readiness and profile rules in a later phase.',
			),
	};
}

function createAiConfigResult(
	context: ApplicationServiceContext,
	args: readonly string[],
): ApplicationCommandResult {
	try {
		const result = args.includes('--test')
			? testAiConfiguration(context.cwd)
			: args.includes('--disable')
				? disableAiConfiguration(context.cwd)
				: args.length === 0 || args.includes('--show')
					? showAiConfiguration(context.cwd)
					: updateAiConfiguration(context.cwd, args);

		return {
			body: result.lines,
			status: result.status,
			title: result.title,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			body: [message, 'No raw tokens were stored.'],
			status: 'error',
			title: 'AI configuration failed',
		};
	}
}

function createInitializeWorkspaceResult(
	context: ApplicationServiceContext,
): ApplicationCommandResult {
	try {
		const result = initializeWorkspace(context.cwd);

		if (result.status === 'exists') {
			return {
				body: [
					`Project root: ${result.projectRoot}`,
					'Existing .logos workspace detected and validated.',
					'No files were changed.',
				],
				status: 'ok',
				title: 'Workspace already initialized',
			};
		}

		return {
			body: [
				`Project root: ${result.projectRoot}`,
				'Created LOGOS workspace files:',
				...result.createdPaths.map((path) => `- ${path}`),
			],
			status: 'ok',
			title: 'Workspace initialized',
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			body: [
				message,
				'Initialization stopped before overwriting any existing workspace state.',
			],
			status: 'error',
			title: 'Workspace initialization failed',
		};
	}
}

export function createUnknownCommandResult(
	commandId: SlashCommandId | string,
): ApplicationCommandResult {
	return {
		body: [
			'This command is not registered in the Phase 1 command surface.',
			'Use /help to view available commands.',
		],
		status: 'not_implemented',
		title: `Unknown command: ${commandId}`,
	};
}

function createStubResult(
	commandId: SlashCommandId,
	message: string,
): ApplicationCommandResult {
	return {
		body: [message, 'No files were changed.'],
		status: 'not_implemented',
		title: `${commandId} stub`,
	};
}
