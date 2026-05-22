/**
 * LOGOS Pi Extension — Extension wiring factory (Step 7.2).
 *
 * Wires the four Pi adapter boundaries (commands, input routing, renderers,
 * confirmations) into a single callable factory.  This is the function that
 * the extension entrypoint (`index.ts`) calls.
 *
 * The factory is deliberately thin:
 * - It resolves optional injections to defaults.
 * - It delegates to placeholder registration functions.
 * - It does not own product logic, intake state, evaluation, or generation.
 *
 * Tests may inject fake Core and fake Pi through `LogosPiExtensionDependencies`.
 */

import { registerLogosCommands } from './commands/register-commands.js';
import { registerLogosConfirmations } from './confirmations/register-confirmations.js';
import type { LogosPiExtensionDependencies } from './extension-dependencies.js';
import { registerLogosInputRouting } from './input/register-input-routing.js';
import { getProjectRootFromContext } from './project-root.js';
import { registerLogosRenderers } from './rendering/register-renderers.js';

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Wire the LOGOS Pi extension adapter boundaries.
 *
 * Side effects:
 * - Registers the five allowed LOGOS lifecycle commands via
 *   `registerLogosCommands` (delegating to the Step 5.5 command adapter).
 * - Registers input routing, renderers, and confirmation boundaries
 *   (all placeholders in this step).
 *
 * This function does **not**:
 * - Call `startIntake`, `handleIntakeMessage`, or `generate`.
 * - Start intake automatically.
 * - Register forbidden commands.
 * - Create global mutable product state.
 * - Import Core internals other than through the public `LogosCore` type.
 *
 * @param deps - Injectable dependencies.  `getProjectRoot` defaults to
 *   `getProjectRootFromContext` when omitted.
 */
export function createLogosPiExtension(
	deps: LogosPiExtensionDependencies,
): void {
	// Assign the default project-root extractor when none is injected.
	// Downstream consumers (like registerLogosCommands) resolve through
	// `deps.getProjectRoot ??` so they handle the undefined case themselves.
	if (deps.getProjectRoot === undefined) {
		(
			deps as {
				getProjectRoot: typeof getProjectRootFromContext;
			}
		).getProjectRoot = getProjectRootFromContext;
	}

	// Register the four adapter boundaries.
	// Order does not matter at registration time.
	registerLogosCommands(deps);
	registerLogosInputRouting(deps);
	registerLogosRenderers(deps);
	registerLogosConfirmations(deps);
}
