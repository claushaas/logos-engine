/**
 * LOGOS Pi Extension — Command registration boundary (Step 7.2).
 *
 * Placeholder wiring that connects the existing command adapter contract
 * (from Step 5.5) to the real Pi Extension API.
 *
 * Rules:
 * - Only the five allowed lifecycle commands are registered.
 * - Every handler calls `core.handleIntakeCommand(...)` first.
 * - `core.handleIntakeMessage(...)` is never called from lifecycle handlers.
 * - Full command handler implementation arrives in later Phase 7 steps
 *   (register-commands.ts acts as the wiring boundary, not the handler impl).
 *
 * This module is an adapter — it must not own product logic.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import { getProjectRootFromContext } from '../project-root.js';
import type { PiCommandRegistrationSurface } from './command-adapter-contract.js';
import { registerLogosLifecycleCommands } from './command-adapter-contract.js';

// ---------------------------------------------------------------------------
// Public registration function
// ---------------------------------------------------------------------------

/**
 * Register the five allowed LOGOS lifecycle commands on the real Pi
 * Extension API surface.
 *
 * The real `pi` (ExtensionAPI) is structurally compatible with
 * `PiCommandRegistrationSurface` — both expose `registerCommand(name, handler)`
 * where the handler receives a context with `cwd`.
 *
 * Command names do not include a leading slash.
 *
 * This function delegates to `registerLogosLifecycleCommands` from the
 * Step 5.5 contract adapter.  The adapter handles interruption disposition
 * routing.  This function supplies the wiring (project root extraction,
 * Core binding).
 *
 * Renderer injection is reserved for later steps — `renderCoreResult`
 * is left `undefined` for now.
 */
export function registerLogosCommands(
	deps: LogosPiExtensionDependencies,
): void {
	// Resolve project root (allow injection, default to getProjectRootFromContext).
	const resolveRoot =
		deps.getProjectRoot ??
		((ctx: { cwd?: string }) => getProjectRootFromContext(ctx));

	// Build adapter deps, omitting renderCoreResult when not available.
	const adapterDeps: {
		core: {
			generate: typeof deps.core.generate;
			getStatus: typeof deps.core.getStatus;
			handleIntakeCommand: typeof deps.core.handleIntakeCommand;
			initProject: typeof deps.core.initProject;
			startIntake: typeof deps.core.startIntake;
			stopIntake: typeof deps.core.stopIntake;
		};
		getProjectRoot: (input: { cwd: string }) => string;
		renderCoreResult?: (result: unknown) => Promise<void> | void;
	} = {
		core: {
			generate: deps.core.generate.bind(deps.core),
			getStatus: deps.core.getStatus.bind(deps.core),
			handleIntakeCommand: deps.core.handleIntakeCommand.bind(deps.core),
			initProject: deps.core.initProject.bind(deps.core),
			startIntake: deps.core.startIntake.bind(deps.core),
			stopIntake: deps.core.stopIntake.bind(deps.core),
		},
		getProjectRoot: (input: { cwd: string }) => resolveRoot({ cwd: input.cwd }),
	};

	registerLogosLifecycleCommands({
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		deps: adapterDeps,
		// The real Pi ExtensionAPI.registerCommand is structurally compatible
		// with PiCommandRegistrationSurface.  Handlers receive full
		// ExtensionCommandContext but only access `cwd`, so the cast is safe.
		pi: deps.pi as unknown as PiCommandRegistrationSurface,
	});
}
