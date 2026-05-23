import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import { argsToAdapterArgs, type PiCommandHandler } from './command-handler.js';
import { runGenerateCommandAdapter } from './lifecycle-command-adapter.js';

export function createGenerateCommandHandler(
	deps: LogosPiExtensionDependencies,
): PiCommandHandler {
	return async (args, ctx) => {
		await runGenerateCommandAdapter({
			args: argsToAdapterArgs(args),
			ctx,
			deps,
		});
	};
}
