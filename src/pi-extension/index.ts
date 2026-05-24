/**
 * LOGOS Pi Extension — Entrypoint (Step 7.2).
 *
 * This module is the Pi-loadable extension entrypoint.
 *
 * It exports:
 * - A **default function** (`logosExtension`) that Pi calls with the
 *   `ExtensionAPI` instance.
 * - Named re-exports for internal consumption and test support.
 *
 * The entrypoint is deliberately thin:
 * - It creates a LOGOS Core instance through the public Core factory.
 * - It delegates all wiring to `createLogosPiExtension`.
 * - It does **not** implement product behavior, intake logic, evaluation,
 *   generation, or rendering inline.
 *
 * Boundary: only this directory (`src/pi-extension/**`) may import Pi types.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLogosCore } from '../core/index.js';
import { createNodeFilesystemAdapter } from './adapters/node-filesystem.js';
import { createLogosPiExtension } from './create-extension.js';
import type { LogosPiExtensionApi } from './pi-types.js';
import { getProjectRootFromContext } from './project-root.js';

// ---------------------------------------------------------------------------
// Resolve the bundled profiles directory
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the `profiles/` directory bundled with the LOGOS package.
 *
 * The extension source lives at `<package>/src/pi-extension/index.ts`.
 * Going up two levels (`../../`) from `__dirname` yields the package root,
 * so `<package>/profiles/` is the bundled profiles directory.
 */
const BUNDLED_PROFILES_PATH = path.resolve(__dirname, '../../profiles');

// ---------------------------------------------------------------------------
// Default export — Pi extension factory
// ---------------------------------------------------------------------------

/**
 * LOGOS Pi extension factory.
 *
 * This is the function Pi calls when it loads the extension.
 *
 * It:
 * 1. Creates a LOGOS Core instance via `createLogosCore()`.
 * 2. Wires Core + Pi through `createLogosPiExtension(...)`.
 *
 * It does **not**:
 * - Start intake automatically.
 * - Generate documentation.
 * - Register forbidden commands.
 * - Import CLI/TUI/Ink/React.
 */
export default function logosExtension(pi: LogosPiExtensionApi): void {
	const filesystem = createNodeFilesystemAdapter();
	createLogosPiExtension({
		core: createLogosCore({ filesystem }),
		getProjectRoot: getProjectRootFromContext,
		pi,
		profileSourcePath: BUNDLED_PROFILES_PATH,
	});
}

// ---------------------------------------------------------------------------
// Named exports — test support and sub-packages
// ---------------------------------------------------------------------------

// Re-export the existing public surface (commands contract, pi-types).
export * from './commands/index.js';
// Re-export the new Step 7.2 shell so tests can import without depending on
// the default-export factory.
export { createLogosPiExtension } from './create-extension.js';
export type { LogosPiExtensionDependencies } from './extension-dependencies.js';
export * from './pi-types.js';
export type { ProjectRootContext } from './project-root.js';
export { getProjectRootFromContext } from './project-root.js';
export type {
	LogosRenderedMessage,
	LogosRenderedMessageKind,
	RenderAssistantMessageInput,
	RenderCoreResultInput,
} from './rendering/index.js';
// Rendering exports (Step 9.1).
export {
	extractRenderedMessage,
	registerLogosRenderers,
	renderAssistantMessage,
	renderCoreResult,
} from './rendering/index.js';
