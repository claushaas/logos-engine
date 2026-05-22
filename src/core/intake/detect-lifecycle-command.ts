/**
 * LOGOS Core — Lifecycle command detection (Step 4.2).
 *
 * Deterministic detection of LOGOS lifecycle slash commands in incoming
 * user messages.  The detection is pure-string matching: no AI, no regex
 * beyond simple prefix/anchor checks.
 *
 * The canonical lifecycle command list is defined in
 * {@link ./lifecycle-command.js}.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import {
	LOGOS_LIFECYCLE_COMMANDS,
	type LogosLifecycleCommand,
} from './lifecycle-command.js';

// Re-export for callers that imported from detect-lifecycle-command
// before the canonical source was extracted.
export type { LogosLifecycleCommand } from './lifecycle-command.js';

/**
 * @deprecated Use {@link LOGOS_LIFECYCLE_COMMANDS} from
 * {@link ./lifecycle-command.js} instead.  Kept for backward compatibility.
 */
export const ALLOWED_LIFECYCLE_COMMANDS = LOGOS_LIFECYCLE_COMMANDS;

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

/**
 * Result of detecting a lifecycle command in a raw user message.
 *
 * - `detected: true`  → a recognised lifecycle command was found.
 * - `detected: false` → the message is not a recognised lifecycle command.
 *   If `isSlashCommand` is `true`, the message starts with `/` but
 *   does *not* correspond to an allowed command.
 */
export type DetectedLifecycleCommand =
	| {
			detected: true;
			command: LogosLifecycleCommand;
			/** The full raw message as received. */
			raw: string;
			/**
			 * Everything after the command word (leading/trailing whitespace
			 * trimmed).  Empty string when no arguments follow.
			 */
			args: string;
	  }
	| {
			detected: false;
			/** The full raw message as received. */
			raw: string;
			/** `true` when the message starts with `/` but is not an allowed command. */
			isSlashCommand: boolean;
	  };

// ---------------------------------------------------------------------------
// Detection helper
// ---------------------------------------------------------------------------

/**
 * Detect whether `message` is a LOGOS lifecycle slash command.
 *
 * Leading and trailing whitespace is ignored.  The comparison is exact
 * against each allowed command name prefixed with `/`.
 *
 * Unknown slash commands (messages that start with `/` but do not match
 * any allowed command) return `detected: false` with `isSlashCommand: true`
 * — they must never be evaluated as answers.
 *
 * Arguments after the command word are preserved in `args`.
 *
 * @example
 * ```ts
 * detectLifecycleCommand('/logos-start');
 * // → { detected: true, command: 'logos-start', raw: '/logos-start', args: '' }
 *
 * detectLifecycleCommand('  /logos-status  ');
 * // → { detected: true, command: 'logos-status', raw: '  /logos-status  ', args: '' }
 *
 * detectLifecycleCommand('/logos-next');
 * // → { detected: false, raw: '/logos-next', isSlashCommand: true }
 *
 * detectLifecycleCommand('Hello');
 * // → { detected: false, raw: 'Hello', isSlashCommand: false }
 * ```
 */
export function detectLifecycleCommand(
	message: string,
): DetectedLifecycleCommand {
	const trimmed = message.trim();

	// Not a slash command at all.
	if (!trimmed.startsWith('/')) {
		return { detected: false, isSlashCommand: false, raw: message };
	}

	// Extract the command word (everything up to the first whitespace or EOL).
	const firstSpace = trimmed.indexOf(' ');
	const commandPart =
		firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
	const commandName = commandPart.slice(1); // strip leading /

	// Check against allowed commands.
	for (const cmd of ALLOWED_LIFECYCLE_COMMANDS) {
		if (commandName === cmd) {
			const args =
				firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();
			return {
				args,
				command: cmd,
				detected: true,
				raw: message,
			};
		}
	}

	// Starts with / but is not an allowed command.
	return { detected: false, isSlashCommand: true, raw: message };
}
