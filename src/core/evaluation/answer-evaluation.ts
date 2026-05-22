/**
 * LOGOS Core — Answer evaluation contracts.
 *
 * Defines the canonical AnswerEvaluation type, AnswerEvaluationStatus,
 * and ExtractedIntakeItem.  All types are plain serializable data intended
 * to constrain evaluator output before it can be applied to canonical
 * intake state.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const ANSWER_EVALUATION_STATUS_VALUES = [
	'sufficient',
	'partial',
	'insufficient',
	'contradictory',
	'needs_clarification',
] as const;

/**
 * Evaluation status for a user answer against the active question.
 *
 * These values mirror {@link import('../state/intake-state-types.js').IntakeAnswerStatus}
 * to guarantee compatibility when evaluations are later applied to state.
 */
export type AnswerEvaluationStatus =
	(typeof ANSWER_EVALUATION_STATUS_VALUES)[number];

// ---------------------------------------------------------------------------
// Extracted item
// ---------------------------------------------------------------------------

/**
 * A single structured fact, assumption, decision, or risk extracted
 * from a user answer during evaluation.
 *
 * All fields except `text` are optional, but `text` must be non-empty
 * when present.
 */
export type ExtractedIntakeItem = {
	/** Optional stable identifier for cross-reference. */
	id?: string;
	/** The extracted content. Must be non-empty. */
	text: string;
	/** Optional provenance hint (e.g. section or source). */
	source?: string;
	/** Confidence score between 0 and 1 (inclusive). */
	confidence?: number;
	/** Extra serializable metadata. Must be a plain record. */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// AnswerEvaluation
// ---------------------------------------------------------------------------

/**
 * Structured output of an answer evaluation against a specific intake
 * question.
 *
 * This is the canonical shape that evaluators (deterministic or AI-assisted)
 * must produce.  It is validated by {@link validateAnswerEvaluation} before
 * any downstream state mutation.
 */
export type AnswerEvaluation = {
	/** The stable id of the question being evaluated. */
	questionId: string;

	/** Overall evaluation status. */
	status: AnswerEvaluationStatus;

	/**
	 * Completeness score between 0 and 1 (inclusive).
	 * - >= 0.8 is expected for `sufficient`.
	 * - Lower values indicate partial or insufficient coverage.
	 */
	completenessScore: number;

	/** Dimensions or aspects the answer does not yet cover. */
	missingAspects: string[];

	/** Concrete facts extracted from the answer. */
	extractedFacts: ExtractedIntakeItem[];
	/** Assumptions identified in the answer. */
	extractedAssumptions: ExtractedIntakeItem[];
	/** Decisions or choices surfaced in the answer. */
	extractedDecisions: ExtractedIntakeItem[];
	/** Risks, trade-offs, or concerns surfaced in the answer. */
	extractedRisks: ExtractedIntakeItem[];

	/**
	 * Optional follow-up question the system should ask next.
	 * Must be non-empty when present.
	 */
	suggestedFollowUp?: string;

	/**
	 * Whether the system should advance to the next question after
	 * applying this evaluation.
	 *
	 * Must be `false` for every status except (optionally) `sufficient`.
	 */
	shouldAdvance: boolean;

	/** Extra serializable metadata. Must be a plain record. */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const nonEmptyString = z.string().min(1);
const zeroToOne = z.number().min(0).max(1);
const metadataRecord = z.record(z.string(), z.unknown());

export const extractedIntakeItemSchema = z.object({
	confidence: zeroToOne.optional(),
	id: z.string().optional(),
	metadata: metadataRecord.optional(),
	source: z.string().optional(),
	text: nonEmptyString,
});

export const answerEvaluationSchema = z.object({
	completenessScore: zeroToOne,
	extractedAssumptions: z.array(extractedIntakeItemSchema),
	extractedDecisions: z.array(extractedIntakeItemSchema),
	extractedFacts: z.array(extractedIntakeItemSchema),
	extractedRisks: z.array(extractedIntakeItemSchema),
	metadata: metadataRecord.optional(),
	missingAspects: z.array(z.string()),
	questionId: nonEmptyString,
	shouldAdvance: z.boolean(),
	status: z.enum(ANSWER_EVALUATION_STATUS_VALUES),
	suggestedFollowUp: nonEmptyString.optional(),
});
