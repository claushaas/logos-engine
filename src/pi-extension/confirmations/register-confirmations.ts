/**
 * LOGOS Pi Extension — Confirmation registration boundary (Step 7.2).
 *
 * Placeholder.  When implemented in later Phase 9 steps, this function
 * will register confirmation UI flows via `ctx.ui.confirm(...)` for
 * partial generation and destructive operations.
 *
 * Current behaviour: no-op.  Confirmations proceed without UI while this
 * remains a placeholder.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';

export function registerLogosConfirmations(
	_deps: LogosPiExtensionDependencies,
): void {
	// Confirmation UI is implemented in later Phase 9 steps.
	void _deps;
}
