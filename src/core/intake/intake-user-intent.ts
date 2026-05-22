/**
 * LOGOS Core — Intake user intent contracts.
 *
 * Defines the canonical IntakeUserIntent union, structured intent
 * classification type, and a deterministic validation helper.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Canonical intent values
// ---------------------------------------------------------------------------

export const INTAKE_USER_INTENT_VALUES = [
	'answer_current_question',
	'ask_question_about_current_question',
	'revise_previous_answer',
	'pause_intake',
	'skip_current_question',
	'request_status',
	'request_generation',
	'out_of_scope',
] as const;

/** The canonical union of user intents during active intake mode. */
export type IntakeUserIntent = (typeof INTAKE_USER_INTENT_VALUES)[number];

// ---------------------------------------------------------------------------
// Structured classification result
// ---------------------------------------------------------------------------

/**
 * Structured result of classifying a user message during active intake.
 * Used by future deterministic routing (Step 4.2) but defined here so
 * validation can be tested independently.
 */
export type IntakeIntentClassification = {
	/** Must be one of the canonical IntakeUserIntent values. */
	intent: IntakeUserIntent;
	/** Confidence score between 0 and 1 (inclusive). */
	confidence: number;
	/** Optional human-readable rationale for the classification. */
	reason?: string;
	/** Optional id of a previously answered question targeted by a revision. */
	targetQuestionId?: string;
	/** Extra serializable metadata. Must be a plain record. */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const intentEnumSchema = z.enum(INTAKE_USER_INTENT_VALUES);
const metadataSchema = z.record(z.string(), z.unknown());

export const intakeIntentClassificationSchema = z.object({
	confidence: z.number().min(0).max(1),
	intent: intentEnumSchema,
	metadata: metadataSchema.optional(),
	reason: z.string().optional(),
	targetQuestionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/** Structured result of validating an intake-intent classification object. */
export type IntakeIntentValidationResult =
	| {
			ok: true;
			classification: IntakeIntentClassification;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
			warnings: string[];
	  };

/**
 * Validates an unknown value against the {@link IntakeIntentClassification}
 * contract.
 *
 * Rules enforced:
 * - intent must be a recognised {@link IntakeUserIntent} value;
 * - confidence must be a number in [0, 1];
 * - metadata, if present, must be a plain serializable record;
 * - unknown top-level fields are stripped by the schema;
 * - optional fields may be absent.
 *
 * @returns A structured validation result.  Never throws for normal invalid
 *          input.
 */
export function validateIntakeIntentClassification(
	value: unknown,
): IntakeIntentValidationResult {
	const parsed = intakeIntentClassificationSchema.safeParse(value);

	if (!parsed.success) {
		const errors: string[] = [];
		for (const issue of parsed.error.issues) {
			errors.push(formatZodIssue(issue));
		}
		return { errors, ok: false, warnings: [] };
	}

	// safeParse with .strip() (default) already strips unknown fields
	return {
		classification: parsed.data as IntakeIntentClassification,
		ok: true,
		warnings: [],
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Formats a single Zod issue into a human-readable string.
 * Preserves path information when available.
 */
function formatZodIssue(issue: z.ZodIssue): string {
	const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
	return `${path}${issue.message}`;
}
