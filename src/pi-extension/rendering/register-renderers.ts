/**
 * LOGOS Pi Extension — Renderer registration boundary (Step 9.1).
 *
 * Registers custom Pi message renderers for LOGOS messages.
 *
 * When `pi.registerMessageRenderer` is available it registers a minimal
 * LOGOS message renderer for messages carrying `type: "logos"`.
 * Otherwise it safely no-ops.
 *
 * This module must not:
 * - Import React, Ink, or legacy TUI.
 * - Call Core product APIs.
 * - Implement product behavior in the registered renderer.
 * - Register duplicate renderers if called more than once.
 */

import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';

// ---------------------------------------------------------------------------
// Pi surface types (subset of what we need)
// ---------------------------------------------------------------------------

type RegisterMessageRendererFn = (
	type: string,
	renderer: (message: unknown) => unknown,
) => void;

type PiWithMessageRenderer = {
	registerMessageRenderer?: RegisterMessageRendererFn;
};

// ---------------------------------------------------------------------------
// Deduplication guard
// ---------------------------------------------------------------------------

const registeredPiInstances = new WeakSet<object>();

// ---------------------------------------------------------------------------
// Public registration
// ---------------------------------------------------------------------------

/**
 * Register custom Pi message renderers for LOGOS messages.
 *
 * If the injected Pi instance exposes `registerMessageRenderer`, a minimal
 * LOGOS renderer is registered for `type: "logos"`.  The renderer is a
 * pass-through: it returns the already-prepared {@link LogosRenderedMessage}
 * payload.  Pi's built-in rendering handles formatting.
 *
 * If `registerMessageRenderer` is not available the function safely no-ops.
 *
 * Duplicate registration on the same Pi instance is prevented.
 *
 * @param deps - Injectable extension dependencies.
 */
export function registerLogosRenderers(
	deps: LogosPiExtensionDependencies,
): void {
	// Deduplication — only register once per Pi instance.
	if (registeredPiInstances.has(deps.pi)) {
		return;
	}

	const pi = deps.pi as PiWithMessageRenderer;

	if (typeof pi.registerMessageRenderer !== 'function') {
		// Safe no-op when the Pi boundary does not expose custom renderers.
		return;
	}

	pi.registerMessageRenderer('logos', (message: unknown) => {
		// Minimal pass-through renderer.
		// The message is already a structured LogosRenderedMessage payload.
		// Pi's built-in rendering handles the formatting.
		return message;
	});

	registeredPiInstances.add(deps.pi);
}
