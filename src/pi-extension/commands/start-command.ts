import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import { argsToAdapterArgs, type PiCommandHandler } from './command-handler.js';
import { runLifecycleCommandAdapter } from './lifecycle-command-adapter.js';

export function createStartCommandHandler(
	deps: LogosPiExtensionDependencies,
): PiCommandHandler {
	return async (args, ctx) => {
		await runLifecycleCommandAdapter({
			args: argsToAdapterArgs(args),
			command: 'logos-start',
			ctx,
			deps,
		});
	};
}
