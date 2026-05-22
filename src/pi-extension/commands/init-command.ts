import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import { argsToAdapterArgs, type PiCommandHandler } from './command-handler.js';
import { runLifecycleCommandAdapter } from './lifecycle-command-adapter.js';

export function createInitCommandHandler(
	deps: LogosPiExtensionDependencies,
): PiCommandHandler {
	return async (args, ctx) => {
		await runLifecycleCommandAdapter({
			args: argsToAdapterArgs(args),
			command: 'logos-init',
			ctx,
			deps,
		});
	};
}
