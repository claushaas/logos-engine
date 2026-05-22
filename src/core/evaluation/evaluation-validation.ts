/**
 * LOGOS Core — Evaluation validation.
 *
 * Provides deterministic validation of {@link AnswerEvaluation} objects.
 * Every evaluator (deterministic or AI-assisted) must produce output
 * that passes these checks before the result can be applied to canonical
 * intake state.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { z } from 'zod';
import type { AnswerEvaluation } from './answer-evaluation.js';
import { answerEvaluationSchema } from './answer-evaluation.js';

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

/** Structured result of validating an {@link AnswerEvaluation} object. */
export type AnswerEvaluationValidationResult =
	| {
			ok: true;
			evaluation: AnswerEvaluation;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// validateAnswerEvaluation
// ---------------------------------------------------------------------------

/**
 * Validates an unknown value against the {@link AnswerEvaluation} contract.
 *
 * Performs two layers of checks:
 * 1. **Schema validation** — ensures all required fields are present and
 *    correctly typed.
 * 2. **Advancement consistency** — enforces logical relationships between
 *    `status`, `completenessScore`, `missingAspects`, `suggestedFollowUp`,
 *    `extractedRisks`, and `shouldAdvance`.
 *
 * Unknown top-level fields are stripped.  Optional fields may be absent.
 *
 * @returns A structured validation result.  Never throws for normal invalid
 *          input.  `ok: false` with `errors` on hard failures; `ok: true`
 *          with `warnings` on soft suggestions.
 */
export function validateAnswerEvaluation(
	value: unknown,
): AnswerEvaluationValidationResult {
	// ---------- Schema-level validation ----------
	const parsed = answerEvaluationSchema.safeParse(value);

	if (!parsed.success) {
		const errors: string[] = [];
		for (const issue of parsed.error.issues) {
			errors.push(formatZodIssue(issue));
		}
		return { errors, ok: false, warnings: [] };
	}

	const evaluation = parsed.data as AnswerEvaluation;

	// ---------- Consistency validation ----------
	const consistencyErrors = validateRequiredConsistency(evaluation);
	const consistencyWarnings = validateAdvisoryConsistency(evaluation);

	if (consistencyErrors.length > 0) {
		return {
			errors: consistencyErrors,
			ok: false,
			warnings: consistencyWarnings,
		};
	}

	return {
		evaluation,
		ok: true,
		warnings: consistencyWarnings,
	};
}

// ---------------------------------------------------------------------------
// validateEvaluationAdvancementConsistency
// ---------------------------------------------------------------------------

/**
 * Standalone helper that checks consistency between an evaluation's
 * `status`, `completenessScore`, and `shouldAdvance`.
 *
 * This is the same logic embedded inside {@link validateAnswerEvaluation};
 * the standalone export exists so consumers can call it without full
 * schema re-validation.
 *
 * @returns An array of consistency problems.  Empty array = no issues.
 *          Problems prefixed with `[error]` represent hard violations
 *          of advancement rules (e.g. a non-sufficient status with
 *          `shouldAdvance: true`).  Other problems are advisory.
 */
export function validateEvaluationAdvancementConsistency(
	evaluation: AnswerEvaluation,
): string[] {
	const issues: string[] = [
		...validateRequiredConsistency(evaluation),
		...validateAdvisoryConsistency(evaluation),
	];
	return issues;
}

// ---------------------------------------------------------------------------
// Internal: mandatory consistency rules
// ---------------------------------------------------------------------------

function validateRequiredConsistency(evaluation: AnswerEvaluation): string[] {
	const errors: string[] = [];
	const { status, completenessScore, shouldAdvance } = evaluation;

	// Partial must not advance
	if (status === 'partial' && shouldAdvance) {
		errors.push('[error] partial status requires shouldAdvance: false');
	}

	// Insufficient must not advance
	if (status === 'insufficient' && shouldAdvance) {
		errors.push('[error] insufficient status requires shouldAdvance: false');
	}

	// Needs clarification must not advance
	if (status === 'needs_clarification' && shouldAdvance) {
		errors.push(
			'[error] needs_clarification status requires shouldAdvance: false',
		);
	}

	// Contradictory must not advance
	if (status === 'contradictory' && shouldAdvance) {
		errors.push('[error] contradictory status requires shouldAdvance: false');
	}

	// Sufficient with shouldAdvance must meet completeness threshold
	if (status === 'sufficient' && shouldAdvance && completenessScore < 0.8) {
		errors.push(
			'[error] sufficient status with shouldAdvance: true requires completenessScore >= 0.8',
		);
	}

	return errors;
}

// ---------------------------------------------------------------------------
// Internal: advisory consistency rules
// ---------------------------------------------------------------------------

function validateAdvisoryConsistency(evaluation: AnswerEvaluation): string[] {
	const warnings: string[] = [];
	const { status, missingAspects, suggestedFollowUp, extractedRisks } =
		evaluation;

	// Partial should surface missing aspects or a suggested follow-up
	if (
		status === 'partial' &&
		missingAspects.length === 0 &&
		!suggestedFollowUp
	) {
		warnings.push(
			'partial status should include missingAspects or suggestedFollowUp',
		);
	}

	// Needs clarification should include a suggested follow-up
	if (status === 'needs_clarification' && !suggestedFollowUp) {
		warnings.push(
			'needs_clarification status should include suggestedFollowUp',
		);
	}

	// Contradictory should surface missing aspects, follow-up, or risks
	if (
		status === 'contradictory' &&
		missingAspects.length === 0 &&
		!suggestedFollowUp &&
		extractedRisks.length === 0
	) {
		warnings.push(
			'contradictory status should include missingAspects, suggestedFollowUp, or extractedRisks',
		);
	}

	return warnings;
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
