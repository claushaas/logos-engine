/**
 * LOGOS Pi Extension — Renderer registration boundary (Step 9.1).
 *
 * Custom message renderers are intentionally NOT registered at this time.
 *
 * Pi's `registerMessageRenderer` expects an Ink/React component as the
 * return value, but the Pi extension cannot import Ink/React/TUI (forbidden
 * per the coding contract).  A pass-through renderer that returns a plain
 * object causes a TUI crash (`child.render is not a function`).
 *
 * Instead, LOGOS messages are sent via `pi.sendMessage` with
 * `customType: 'logos'` and rely on Pi's built-in default rendering for
 * custom messages.  The message `content` and `details` (a structured
 * `LogosRenderedMessage`) are available for display and future custom
 * rendering when a valid Ink boundary becomes available.
 *
 * This module must not:
 * - Import React, Ink, or legacy TUI.
 * - Call Core product APIs.
 * - Implement product behavior.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';

/**
 * Register custom Pi message renderers for LOGOS messages.
 *
 * Currently a deliberate no-op.  See module-level documentation for the
 * rationale.
 *
 * @param _deps - Injectable extension dependencies (unused).
 */
export function registerLogosRenderers(
	_deps: LogosPiExtensionDependencies,
): void {
	// Intentional no-op — see module-level documentation.
}
