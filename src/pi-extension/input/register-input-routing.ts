/**
 * LOGOS Pi Extension — Input routing registration boundary (Step 7.2).
 *
 * Placeholder.  When implemented in later Phase 7/8 steps, this function
 * will register a `pi.on("input", ...)` handler that routes active-intake
 * user messages to LOGOS Core.
 *
 * Current behaviour: no-op.  Input is not intercepted while this remains
 * a placeholder.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';

export function registerLogosInputRouting(
	_deps: LogosPiExtensionDependencies,
): void {
	// Input routing is implemented in later Phase 7/8 steps.
	// Prevent unused-parameter lint errors.
	void _deps;
}
