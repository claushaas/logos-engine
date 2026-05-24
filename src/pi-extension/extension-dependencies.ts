/**
 * LOGOS Pi Extension — Extension dependency types (Step 7.2).
 *
 * Defines the dependency injection contract for `createLogosPiExtension`.
 * Kept separate from the factory so tests can import types without
 * pulling in the full wiring graph.
 *
 * Boundary: must not import Core internals, Pi runtime values, or
 * legacy CLI/TUI/Ink/React modules.
 */

import type { CoreResult, LogosCore } from '../core/index.js';
import type {
	LogosPiCommandContext,
	LogosPiEventContext,
	LogosPiExtensionApi,
} from './pi-types.js';

// ---------------------------------------------------------------------------
// Dependency injection contract
// ---------------------------------------------------------------------------

/**
 * Dependencies injected into the LOGOS Pi extension factory.
 *
 * Every dependency is replaceable so that tests can supply fake Core
 * and fake Pi without depending on real filesystem or Pi runtime.
 */
export type LogosPiExtensionDependencies = {
	/** The Pi Extension API surface passed by the Pi runtime. */
	pi: LogosPiExtensionApi;

	/** The LOGOS Core instance (or a fake in tests). */
	core: LogosCore;

	/**
	 * Extract the project root from a Pi-like context.
	 *
	 * Defaults to `getProjectRootFromContext` from `./project-root.js`
	 * when omitted.  Tests may inject a deterministic alternative.
	 */
	getProjectRoot?: ((ctx: { cwd?: string }) => string) | undefined;

	/**
	 * Absolute path to the directory containing bundled profile
	 * directories (e.g. `<logos-package>/profiles/`).
	 *
	 * Passed through to Core's `initProject` so the Standard profile
	 * can be scaffolded into fresh projects.
	 */
	profileSourcePath?: string | undefined;

	/** Optional renderer seam for tests and future richer rendering. */
	renderCoreResult?:
		| ((
				result: CoreResult<unknown>,
				ctx: LogosPiCommandContext | LogosPiEventContext,
		  ) => Promise<void> | void)
		| undefined;

	/** Optional deterministic clock for command adapter tests. */
	now?: (() => string) | undefined;
};
