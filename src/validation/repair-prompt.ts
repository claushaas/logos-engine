/**
 * Repair prompt generation — builds a repair `LlmRequest` when LLM output
 * fails validation, enabling the system to recover without user intervention.
 *
 * The repair loop:
 * 1. `validateAgentTurnOutput` returns validation errors.
 * 2. `buildRepairPrompt` constructs a revised `LlmRequest` with the
 *    original context plus specific error details and repair instructions.
 * 3. The LLM regenerates structured output.
 * 4. `validateAgentTurnOutput` validates again.
 * 5. After `DEFAULT_REPAIR_ATTEMPT_LIMIT` failures, a `repair_failed`
 *    recoverable error is returned.
 *
 * This module does NOT call the provider or validate output — it only
 * builds the prompt and manages the retry counter.
 *
 * @see {@link https://logos-engine/docs/05-prompt-orchestration-spec.md §11}
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §7}
 */

import type {
	LlmMessage,
	LlmRequest,
} from '../prompt-orchestration/prompt-assembler.js';
import type { Result } from '../shared/index.js';
import { err, ok } from '../shared/index.js';
import type { ValidationError } from './agent-turn-validator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default maximum number of repair attempts.
 *
 * After this many attempts, the system returns a `repair_failed` error
 * instead of retrying indefinitely.
 */
export const DEFAULT_REPAIR_ATTEMPT_LIMIT = 3;

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A recoverable error returned when all repair attempts are exhausted
 * without producing valid output.
 */
export type RepairFailedError = {
	/** Always `'repair_failed'`. */
	readonly code: 'repair_failed';

	/** Human-readable summary of the failure. */
	readonly message: string;

	/** `true` — this is a recoverable error, not a crash. */
	readonly recoverable: true;

	/** Diagnostics for debugging and reporting. */
	readonly diagnostics: {
		/** How many repair attempts were made. */
		readonly attempts: number;

		/** The configured maximum number of repair attempts. */
		readonly maxAttempts: number;

		/** The validation errors from the last failed attempt. */
		readonly validationErrors: readonly ValidationError[];
	};
};

/**
 * A single repair attempt with its assembled `LlmRequest` and retry counter.
 */
export type RepairAttempt = {
	/** The current repair attempt number (1-indexed). */
	readonly attempt: number;

	/** The configured maximum number of repair attempts. */
	readonly maxAttempts: number;

	/** The assembled `LlmRequest` ready for the LLM provider. */
	readonly request: LlmRequest;
};

// ═══════════════════════════════════════════════════════════════════════════
// Error formatting
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format a single `ValidationError` as a numbered list entry.
 *
 * Produces: `1. [CODE] path.to.field: message`
 *
 * When the path is empty, `<root>` is used as the field reference.
 */
function formatError(error: ValidationError, index: number): string {
	const field = error.path.length > 0 ? error.path.join('.') : '<root>';
	return `${index}. [${error.code}] ${field}: ${error.message}`;
}

/**
 * Format the full list of validation errors as a repair block.
 */
function formatErrorList(errors: readonly ValidationError[]): string {
	return errors.map((e, i) => formatError(e, i + 1)).join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Repair prompt assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Repair instructions appended to the system prompt on retry.
 *
 * These instructions tell the LLM to fix structural errors only — the
 * repair prompt must not re-ask the original task or reinterpret context.
 */
const REPAIR_SYSTEM_INSTRUCTION = [
	'## Repair Mode',
	'Your previous output failed validation. Fix these errors:',
];

/**
 * Structural-repair guard rules appended to every repair message.
 *
 * These prevent the LLM from drifting — it should only fix the errors,
 * not reinterpret the original task.
 */
const REPAIR_GUARD_RULES = [
	'Do not re-ask the original task.',
	'Do not reinterpret or expand the original request.',
	'Return only a corrected structured output conforming to the schema.',
];

/**
 * Build a repair `LlmRequest` from the original request and validation errors.
 *
 * Preserves the original:
 * - `systemPrompt` (repair instructions are appended).
 * - `messages` (a repair-instruction user message is appended).
 * - `schema` (kept by reference).
 * - `model`, `temperature`, and `metadata` (kept as-is).
 *
 * The repair instruction message includes:
 * - "Your previous output failed validation. Fix these errors:"
 * - A numbered list of every validation error (code, path, message).
 * - Explicit structural-repair guard rules.
 *
 * @param originalRequest  - The original `LlmRequest` that produced invalid output.
 * @param errors           - The validation errors to report to the LLM.
 * @returns A new `LlmRequest` with repair context appended.
 */
export function buildRepairPrompt(
	originalRequest: LlmRequest,
	errors: readonly ValidationError[],
): LlmRequest {
	// ── 1. Assemble the repair system prompt ────────────────────────
	const systemSections: string[] = [originalRequest.systemPrompt];

	systemSections.push('');
	systemSections.push(...REPAIR_SYSTEM_INSTRUCTION);
	systemSections.push('');
	systemSections.push(formatErrorList(errors));

	const repairSystemPrompt = systemSections.join('\n');

	// ── 2. Build the repair instruction message ─────────────────────
	const instructionLines: string[] = [
		'Your previous output failed validation. Fix these errors:',
		'',
		formatErrorList(errors),
		'',
		...REPAIR_GUARD_RULES,
	];

	const repairMessage: LlmMessage = {
		content: instructionLines.join('\n'),
		role: 'user',
	};

	// ── 3. Assemble the final request ───────────────────────────────
	return {
		...originalRequest,
		messages: [...originalRequest.messages, repairMessage],
		systemPrompt: repairSystemPrompt,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Retry attempt management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the next repair attempt or return a `repair_failed` error if the
 * retry limit has been exhausted.
 *
 * @param originalRequest  - The original `LlmRequest` that produced invalid output.
 * @param errors           - The validation errors from the most recent failed attempt.
 * @param attemptsUsed     - The number of repair attempts already completed.
 * @param maxAttempts      - Maximum number of repair attempts allowed (default: 3).
 * @returns `ok(RepairAttempt)` with the assembled repair request if retries remain,
 *          or `err(RepairFailedError)` if the limit has been reached.
 *
 * @example
 * ```ts
 * // First repair attempt
 * const r1 = buildNextRepairAttempt(originalRequest, errors, 0);
 * // Second repair attempt
 * const r2 = buildNextRepairAttempt(originalRequest, errors, 1);
 * // Limit exhausted
 * const r3 = buildNextRepairAttempt(originalRequest, errors, 3);
 * if (isErr(r3)) {
 *   console.log(r3.error.code); // 'repair_failed'
 * }
 * ```
 */
export function buildNextRepairAttempt(
	originalRequest: LlmRequest,
	errors: readonly ValidationError[],
	attemptsUsed: number,
	maxAttempts: number = DEFAULT_REPAIR_ATTEMPT_LIMIT,
): Result<RepairAttempt, RepairFailedError> {
	if (attemptsUsed >= maxAttempts) {
		return err({
			code: 'repair_failed',
			diagnostics: {
				attempts: attemptsUsed,
				maxAttempts,
				validationErrors: errors,
			},
			message:
				`Repair failed after ${attemptsUsed}/${maxAttempts} attempts. ` +
				`Last validation produced ${errors.length} error(s).`,
			recoverable: true,
		});
	}

	const request = buildRepairPrompt(originalRequest, errors);

	return ok({
		attempt: attemptsUsed + 1,
		maxAttempts,
		request: {
			...request,
			metadata: {
				...request.metadata,
				maxRepairAttempts: maxAttempts,
				repairAttempt: attemptsUsed + 1,
				repairErrorCount: errors.length,
			},
		},
	});
}
