import type { SlashCommandId } from '../commands/slash-command-registry.js';

export type ApplicationCommandResult = {
	readonly body: readonly string[];
	readonly status: 'ok' | 'not_implemented';
	readonly title: string;
};

export type LogosApplicationServices = {
	readonly continueIntake: () => ApplicationCommandResult;
	readonly diagnoseWorkspace: () => ApplicationCommandResult;
	readonly generateDocuments: () => ApplicationCommandResult;
	readonly initializeWorkspace: () => ApplicationCommandResult;
	readonly showAiConfig: () => ApplicationCommandResult;
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
		initializeWorkspace: () =>
			createStubResult(
				'/init',
				'Workspace initialization will create .logos state and the canonical docs tree in Phase 2.',
			),
		showAiConfig: () =>
			createStubResult(
				'/config ai',
				'AI provider configuration will store non-secret settings and disclose remote context in a later phase.',
			),
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
