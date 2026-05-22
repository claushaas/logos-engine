/**
 * LOGOS Pi Extension — Command adapter compatibility contract.
 *
 * Step 7.4 implements command behavior in `lifecycle-command-adapter.ts`.
 * This file keeps the older Step 5.5 test harness API as a thin wrapper over
 * the shared adapter, so there is only one command-disposition implementation.
 */

import type {
	CoreResult,
	LogosCore,
	LogosLifecycleCommand,
} from '../../core/index.js';
import { LOGOS_LIFECYCLE_COMMANDS } from '../../core/index.js';
import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type { LogosPiCommandContext } from '../pi-types.js';
import { runLifecycleCommandAdapter } from './lifecycle-command-adapter.js';

export type LogosCommandAdapterDependencies = {
	core: Pick<
		LogosCore,
		| 'handleIntakeCommand'
		| 'initProject'
		| 'startIntake'
		| 'stopIntake'
		| 'getStatus'
		| 'generate'
	>;
	getProjectRoot(input: { cwd: string }): string;
	renderCoreResult?: (result: unknown) => Promise<void> | void;
};

export type PiCommandRegistrationSurface = {
	registerCommand(
		name: string,
		handler: (ctx: { cwd: string }, args?: string[]) => Promise<void> | void,
	): void;
};

function makeCompatibilityDeps(
	deps: LogosCommandAdapterDependencies,
): LogosPiExtensionDependencies {
	return {
		core: deps.core as LogosCore,
		getProjectRoot: (ctx) => deps.getProjectRoot({ cwd: ctx.cwd ?? '' }),
		pi: {} as LogosPiExtensionDependencies['pi'],
		renderCoreResult: deps.renderCoreResult
			? (result: CoreResult<unknown>) => deps.renderCoreResult?.(result)
			: async () => {},
	};
}

function makeCommandHandler(
	deps: LogosCommandAdapterDependencies,
	command: LogosLifecycleCommand,
): (ctx: { cwd: string }, args?: string[]) => Promise<void> {
	return async (ctx, args) => {
		await runLifecycleCommandAdapter({
			args,
			command,
			ctx: ctx as LogosPiCommandContext,
			deps: makeCompatibilityDeps(deps),
		});
	};
}

export function registerLogosLifecycleCommands(input: {
	pi: PiCommandRegistrationSurface;
	deps: LogosCommandAdapterDependencies;
}): void {
	for (const command of LOGOS_LIFECYCLE_COMMANDS) {
		input.pi.registerCommand(command, makeCommandHandler(input.deps, command));
	}
}
