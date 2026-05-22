/**
 * LOGOS Pi Extension — Official Pi type boundary.
 *
 * This module is the single TypeScript boundary between the LOGOS Pi
 * extension and the official `@earendil-works/pi-coding-agent` package.
 *
 * Rules enforced by this module:
 * - Only `src/pi-extension/**` files may import Pi package names.
 * - All imports from the Pi package MUST use `import type` to prevent
 *   runtime imports of Pi APIs during typechecking/build.
 * - Core (`src/core/**`) must never import this module or the Pi package.
 * - This file must never re-export Pi types from Core.
 *
 * This module is a TYPE-ONLY boundary.  It does not import runtime values
 * from the Pi package.
 */

import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	ExtensionFactory,
	InputEvent,
	InputEventResult,
} from '@earendil-works/pi-coding-agent';

// ---------------------------------------------------------------------------
// Re-exported Pi types for LOGOS Pi extension consumption
// ---------------------------------------------------------------------------

/** The official Pi Extension API surface passed to the extension factory. */
export type LogosPiExtensionApi = ExtensionAPI;

/** The Pi extension factory signature expected by the Pi runtime. */
export type LogosPiExtensionFactory = ExtensionFactory;

/**
 * The Pi command context available to LOGOS command handlers.
 *
 * This is the Pi `ExtensionCommandContext` type.  LOGOS command handlers
 * receive this as their `ctx` parameter from `pi.registerCommand(...)`.
 */
export type LogosPiCommandContext = ExtensionCommandContext;

/**
 * The Pi event context passed to event handlers (`pi.on(...)` callbacks).
 */
export type LogosPiEventContext = ExtensionContext;

/**
 * The Pi input event emitted on `pi.on("input", ...)`.
 */
export type LogosPiInputEvent = InputEvent;

/**
 * The result returned by an `input` event handler.
 */
export type LogosPiInputHandlerResult = InputEventResult;
