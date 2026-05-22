/**
 * LOGOS Core — Question selection status helper (Step 3.3).
 *
 * Determines the selection-status of a single question based on the current
 * intake state. Used by the next-prompt selector to classify questions into
 * buckets (unanswered, partial, sufficient, etc.) for priority ordering.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosQuestion } from '../questions/question-types.js';
import type { LogosIntakeState } from '../state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Selection-oriented classification of a single question.
 *
 * - `sufficient`: a sufficient answer exists and there is no unresolved
 *    contradiction tied to this question.
 * - `partial`: the question has a partial or insufficient answer record,
 *    the answer status is anything other than `sufficient`, or a required
 *    question was skipped (treated as partial for revisit).
 * - `skipped`: an optional question was explicitly skipped.
 * - `unanswered`: no answer or partial record exists.
 * - `contradictory`: an unresolved contradiction is tied to this question.
 */
export type QuestionSelectionStatus =
	| 'sufficient'
	| 'partial'
	| 'skipped'
	| 'unanswered'
	| 'contradictory';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type GetQuestionSelectionStatusInput = {
	question: LogosQuestion;
	intakeState: LogosIntakeState;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Determine the selection status of a single question.
 *
 * Order of checks matters:
 * 1. Unresolved contradiction wins — it blocks selection.
 * 2. Sufficient answer with no contradiction → sufficient.
 * 3. Existing answer record with a non-sufficient status → partial.
 * 4. Partial record → partial.
 * 5. Skipped optional → skipped.
 * 6. Skipped required → partial (must be revisited).
 * 7. No records at all → unanswered.
 */
export function getQuestionSelectionStatus(
	input: GetQuestionSelectionStatusInput,
): QuestionSelectionStatus {
	const { question, intakeState } = input;

	// 1. Check for unresolved contradiction tied to this question.
	for (const contradiction of Object.values(intakeState.contradictions)) {
		if (
			contradiction.questionId === question.id &&
			contradiction.status === 'unresolved'
		) {
			return 'contradictory';
		}
	}

	// 2. Check for a sufficient answer record.
	const answerRecord = intakeState.answeredQuestions[question.id];
	if (answerRecord !== undefined) {
		if (answerRecord.status === 'sufficient') {
			return 'sufficient';
		}
		// Any other status (partial, insufficient, needs_clarification) is partial.
		return 'partial';
	}

	// 3. Check for a partial record.
	const partialRecord = intakeState.partialQuestions[question.id];
	if (partialRecord !== undefined) {
		return 'partial';
	}

	// 4. Check for a skipped record.
	const skippedRecord = intakeState.skippedQuestions[question.id];
	if (skippedRecord !== undefined) {
		// Required questions that were skipped must be revisited.
		if (question.required) {
			return 'partial';
		}
		return 'skipped';
	}

	// 5. No records at all.
	return 'unanswered';
}
