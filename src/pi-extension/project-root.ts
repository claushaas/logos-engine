/**
 * LOGOS Pi Extension — Project root extraction (Step 7.2).
 *
 * Extracts the project root directory from a Pi command context.
 * This helper is a Pi-adapter-only concern: Core validates path
 * containment and filesystem existence later.
 *
 * Boundary: must not import Core internals, Pi runtime values, or
 * legacy CLI/TUI/Ink/React modules.  Must not validate filesystem.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal context shape for project root extraction.
 *
 * In the real Pi runtime this will be the `cwd` property from
 * `ExtensionCommandContext` or `ExtensionContext`.
 * Tests pass plain objects and may omit `cwd`.
 */
export type ProjectRootContext = {
	/** Current working directory as reported by Pi (string or undefined). */
	cwd?: string | undefined;
};

// ---------------------------------------------------------------------------
// Extraction helper
// ---------------------------------------------------------------------------

/**
 * Return the project root directory from a Pi-like context.
 *
 * Behaviour:
 * - When `ctx.cwd` is a non-empty, non-whitespace string → return it.
 * - Otherwise → return `process.cwd()` as a deterministic fallback.
 *
 * This function does **not** validate that the returned path exists on
 * the filesystem.  Core performs path containment and existence checks
 * when it needs them.
 *
 * @example
 * ```ts
 * getProjectRootFromContext({ cwd: '/home/user/my-project' });
 * // → '/home/user/my-project'
 *
 * getProjectRootFromContext({ cwd: '   ' });
 * // → process.cwd()
 *
 * getProjectRootFromContext({});
 * // → process.cwd()
 * ```
 */
export function getProjectRootFromContext(ctx: ProjectRootContext): string {
	if (
		ctx.cwd !== undefined &&
		typeof ctx.cwd === 'string' &&
		ctx.cwd.trim().length > 0
	) {
		return ctx.cwd;
	}

	return process.cwd();
}
