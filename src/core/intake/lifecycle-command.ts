/**
 * LOGOS Core — Lifecycle command contracts (Step 5.1).
 *
 * Defines the canonical LOGOS lifecycle command union, the forbidden
 * command-first pattern list, and deterministic type guards.
 *
 * This module is the single authority for:
 * - which LOGOS slash commands are allowed in the MVP;
 * - which command-first patterns are explicitly prohibited;
 * - runtime guards that differentiate allowed from forbidden commands.
 *
 * Internal command values must NOT include a leading slash.
 * Do not add aliases.
 * Do not include forbidden commands in the allowed list.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

// ---------------------------------------------------------------------------
// Allowed lifecycle commands
// ---------------------------------------------------------------------------

/**
 * The canonical list of allowed LOGOS lifecycle commands (without leading
 * slash). This is the authoritative source for command detection,
 * command-interruption handling, and the Pi extension surface.
 */
export const LOGOS_LIFECYCLE_COMMANDS = [
	'logos-init',
	'logos-start',
	'logos-stop',
	'logos-status',
	'logos-generate',
] as const;

/** Union type of every allowed LOGOS lifecycle command. */
export type LogosLifecycleCommand = (typeof LOGOS_LIFECYCLE_COMMANDS)[number];

// ---------------------------------------------------------------------------
// Forbidden command-first patterns
// ---------------------------------------------------------------------------

/**
 * Commands that MUST NOT be implemented in the MVP.
 *
 * These patterns are forbidden because they would move the primary workflow
 * from conversation into command execution.
 */
export const FORBIDDEN_LOGOS_COMMANDS = [
	'logos-next',
	'logos-answer',
	'logos-continue',
	'logos-question',
	'logos-phase',
	'logos-doc',
	'logos-set-answer',
	'logos-skip',
	'logos-followup',
] as const;

/** Union type of every explicitly forbidden LOGOS command. */
export type ForbiddenLogosCommand = (typeof FORBIDDEN_LOGOS_COMMANDS)[number];

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `value` is one of the allowed lifecycle commands.
 *
 * The check is case-sensitive and deterministic — no fuzzy matching.
 */
export function isLogosLifecycleCommand(
	value: string,
): value is LogosLifecycleCommand {
	return (LOGOS_LIFECYCLE_COMMANDS as readonly string[]).includes(value);
}

/**
 * Returns `true` when `value` is one of the explicitly forbidden
 * command-first patterns.
 *
 * The check is case-sensitive and deterministic.
 */
export function isForbiddenLogosCommand(
	value: string,
): value is ForbiddenLogosCommand {
	return (FORBIDDEN_LOGOS_COMMANDS as readonly string[]).includes(value);
}
