/**
 * LOGOS Pi Extension — Command registration boundary (Step 7.4).
 *
 * Registers exactly the five allowed lifecycle commands with thin handlers.
 * Command behavior lives in the shared lifecycle adapter and Core.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import { createGenerateCommandHandler } from './generate-command.js';
import { createInitCommandHandler } from './init-command.js';
import { createStartCommandHandler } from './start-command.js';
import { createStatusCommandHandler } from './status-command.js';
import { createStopCommandHandler } from './stop-command.js';

export function registerLogosCommands(
	deps: LogosPiExtensionDependencies,
): void {
	deps.pi.registerCommand('logos-init', {
		description: 'Initialize LOGOS project state.',
		handler: createInitCommandHandler(deps),
	});

	deps.pi.registerCommand('logos-start', {
		description: 'Start or resume LOGOS conversational intake.',
		handler: createStartCommandHandler(deps),
	});

	deps.pi.registerCommand('logos-stop', {
		description: 'Pause LOGOS intake and preserve the active question.',
		handler: createStopCommandHandler(deps),
	});

	deps.pi.registerCommand('logos-status', {
		description: 'Show LOGOS project status.',
		handler: createStatusCommandHandler(deps),
	});

	deps.pi.registerCommand('logos-generate', {
		description: 'Run LOGOS generation preflight and generation.',
		handler: createGenerateCommandHandler(deps),
	});
}
