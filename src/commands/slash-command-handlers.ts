import type {
	ApplicationCommandResult,
	LogosApplicationServices,
} from '../application/logos-application-service.js';
import type { CommandContext } from './command-context.js';
import type { ParsedSlashCommand } from './slash-command-parser.js';
import { slashCommandDefinitions } from './slash-command-registry.js';

export type SlashCommandHandlerResult = ApplicationCommandResult & {
	readonly exitRequested: boolean;
};

export function handleSlashCommand(
	command: ParsedSlashCommand,
	context: CommandContext,
	services: LogosApplicationServices,
): SlashCommandHandlerResult {
	const result = executeCommand(command, context, services);

	return {
		...result,
		exitRequested: command.definition.id === '/exit',
	};
}

function executeCommand(
	command: ParsedSlashCommand,
	context: CommandContext,
	services: LogosApplicationServices,
): ApplicationCommandResult {
	switch (command.definition.id) {
		case '/init':
			return services.initializeWorkspace(context);
		case '/continue':
			return services.continueIntake();
		case '/status':
			return services.showStatus();
		case '/validate':
			return services.validateWorkspace();
		case '/diagnose':
			return services.diagnoseWorkspace();
		case '/generate':
			return services.generateDocuments();
		case '/config ai':
			return services.showAiConfig(context, command.args);
		case '/help':
			return {
				body: slashCommandDefinitions.map(
					(definition) => `${definition.usage} - ${definition.description}`,
				),
				status: 'ok',
				title: 'LOGOS slash commands',
			};
		case '/exit':
			return {
				body: [
					'Session closed. No workspace state was changed by the Phase 1 shell.',
				],
				status: 'ok',
				title: 'Exit requested',
			};
		default:
			return services.showHelp();
	}
}
