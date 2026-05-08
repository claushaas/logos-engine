import type { SlashCommandId } from '../commands/slash-command-registry.js';
import {
	disableAiConfiguration,
	showAiConfiguration,
	testAiConfiguration,
	updateAiConfiguration,
} from './ai-configuration.js';
import { diagnoseWorkspace } from './diagnostics-service.js';
import { generateDocumentsForCwd } from './document-generation.js';
import { continueGuidedIntake } from './guided-intake.js';
import { getProjectStatus } from './status-service.js';
import { validateWorkspace } from './validation-service.js';
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
	readonly continueIntake: (
		context: ApplicationServiceContext,
		args: readonly string[],
	) => Promise<ApplicationCommandResult>;
	readonly diagnoseWorkspace: (
		context: ApplicationServiceContext,
	) => ApplicationCommandResult;
	readonly generateDocuments: (
		context: ApplicationServiceContext,
		args: readonly string[],
	) => ApplicationCommandResult;
	readonly initializeWorkspace: (
		context: ApplicationServiceContext,
	) => ApplicationCommandResult;
	readonly showAiConfig: (
		context: ApplicationServiceContext,
		args: readonly string[],
	) => ApplicationCommandResult;
	readonly showHelp: () => ApplicationCommandResult;
	readonly showStatus: (
		context: ApplicationServiceContext,
	) => ApplicationCommandResult;
	readonly validateWorkspace: (
		context: ApplicationServiceContext,
		args: readonly string[],
	) => ApplicationCommandResult;
};

export function createLogosApplicationServices(): LogosApplicationServices {
	return {
		continueIntake: (context, args) => continueGuidedIntake(context.cwd, args),
		diagnoseWorkspace: (context) => {
			const result = diagnoseWorkspace(context.cwd);
			return {
				body: result.lines,
				status: result.status === 'warning' ? 'ok' : result.status,
				title: result.title,
			};
		},
		generateDocuments: (context, args) => {
			const result = generateDocumentsForCwd(context.cwd, args);
			return {
				body: result.lines,
				status: result.status,
				title: result.title,
			};
		},
		initializeWorkspace: (context) => createInitializeWorkspaceResult(context),
		showAiConfig: (context, args) => createAiConfigResult(context, args),
		showHelp: () => ({
			body: ['Type a slash command or use autocomplete to inspect options.'],
			status: 'ok',
			title: 'LOGOS command help',
		}),
		showStatus: (context) => {
			const result = getProjectStatus(context.cwd);
			return {
				body: result.lines,
				status: result.status,
				title: result.title,
			};
		},
		validateWorkspace: (context, args) => {
			const phaseIndex = args.indexOf('--phase');
			const phaseId = phaseIndex >= 0 ? args[phaseIndex + 1] : undefined;
			const allFlag = args.includes('--all');
			const result = validateWorkspace(context.cwd, {
				all: allFlag,
				phaseId,
			});
			return {
				body: result.lines,
				status: result.status === 'ok' ? 'ok' : 'error',
				title: result.title,
			};
		},
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
