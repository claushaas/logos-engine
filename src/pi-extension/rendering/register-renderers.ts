/**
 * LOGOS Pi Extension — Renderer registration boundary (Step 7.2).
 *
 * Placeholder.  When implemented in later Phase 9 steps, this function
 * will register custom message renderers with `pi.registerMessageRenderer`
 * for question, follow-up, contradiction, clarification, status, and
 * generation result messages.
 *
 * Current behaviour: no-op.  Messages are not rendered through custom
 * LOGOS renderers while this remains a placeholder.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';

export function registerLogosRenderers(
	_deps: LogosPiExtensionDependencies,
): void {
	// Renderers are implemented in later Phase 9 steps.
	void _deps;
}
