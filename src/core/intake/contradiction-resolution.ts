/**
 * LOGOS Core — Contradiction resolution helpers (Step 4.4).
 *
 * Deterministic helpers for creating contradiction records and
 * generating contradiction-resolution prompts during active intake.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { AnswerEvaluation } from '../evaluation/answer-evaluation.js';
import type { LogosQuestion } from '../questions/question-types.js';
import type {
	ActivePromptState,
	IntakeContradictionRecord,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import { createContradictionPrompt } from './active-prompt.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// ---------------------------------------------------------------------------
// Contradiction ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic id for a contradiction record.
 *
 * Format: `contradiction.<questionId>.<counter>`
 *
 * The counter is derived from the number of existing contradictions in the
 * intake state for the same question, producing stable deterministic ids
 * when `now` is injected.
 */
export function createContradictionId(
	questionId: string,
	intakeState: LogosIntakeState,
): string {
	const existingCount = Object.values(intakeState.contradictions).filter(
		(c) => c.questionId === questionId,
	).length;
	return `contradiction.${questionId}.${existingCount}`;
}

// ---------------------------------------------------------------------------
// Contradiction record creation
// ---------------------------------------------------------------------------

export type CreateContradictionRecordInput = {
	questionId: string;
	intakeState: LogosIntakeState;
	evaluation: AnswerEvaluation;
	now: string;
};

/**
 * Create a new unresolved contradiction record from an evaluation result.
 *
 * The contradiction summary is built from:
 * 1. `evaluation.suggestedFollowUp` (preferred)
 * 2. `evaluation.missingAspects` (fallback)
 * 3. `evaluation.extractedRisks` (fallback)
 *
 * `conflictsWithQuestionIds` is derived by scanning existing sufficient
 * answers for contradicting question ids. In the current implementation
 * this is left empty because the evaluator does not yet provide specific
 * conflicting question ids — the summary text carries the contradiction
 * information instead.
 */
export function createContradictionRecord(
	input: CreateContradictionRecordInput,
): IntakeContradictionRecord {
	const { questionId, intakeState, evaluation, now } = input;

	const id = createContradictionId(questionId, intakeState);

	let summary = evaluation.suggestedFollowUp ?? '';

	if (summary.length === 0 && evaluation.missingAspects.length > 0) {
		summary = `Contradiction detected: ${evaluation.missingAspects.join(', ')}`;
	}

	if (summary.length === 0 && evaluation.extractedRisks.length > 0) {
		const riskTexts = evaluation.extractedRisks.map((r) => r.text);
		summary = `Contradiction detected: ${riskTexts.join('; ')}`;
	}

	if (summary.length === 0) {
		summary =
			'This answer conflicts with previously accepted decisions. Please clarify which direction should be treated as authoritative.';
	}

	// Derive conflicting question ids from existing sufficient answers.
	// In the MVP the evaluator does not yet provide specific ids, so we
	// fall back to an empty array — the summary text handles communication.
	const conflictsWithQuestionIds: string[] = [];

	return {
		conflictsWithQuestionIds,
		createdAt: now,
		id,
		questionId,
		status: 'unresolved',
		summary,
	};
}

// ---------------------------------------------------------------------------
// Build contradiction prompt + state update
// ---------------------------------------------------------------------------

export type BuildContradictionResolutionInput = {
	question: LogosQuestion;
	contradiction: IntakeContradictionRecord;
	intakeState: LogosIntakeState;
	now: string;
};

export type BuildContradictionResolutionResult = {
	/** The updated intake state with the contradiction recorded. */
	state: LogosIntakeState;
	/** The active prompt for contradiction resolution. */
	prompt: ActivePrompt;
	/** The active prompt state to persist. */
	activePromptState: ActivePromptState;
};

/**
 * Build a contradiction-resolution prompt and update intake state.
 *
 * Creates the contradiction prompt, sets the active prompt state to
 * contradiction_resolution kind, and returns the updated state copy.
 * The caller is responsible for persisting the returned state.
 */
export function buildContradictionResolution(
	input: BuildContradictionResolutionInput,
): BuildContradictionResolutionResult {
	const { question, contradiction, intakeState, now } = input;

	// Copy state immutably.
	const state: LogosIntakeState = {
		...intakeState,
		contradictions: { ...intakeState.contradictions },
		updatedAt: now,
	};
	// Clear active prompt for contradiction resolution re-set below.
	delete state.activePrompt;

	// Record the contradiction.
	state.contradictions[contradiction.id] = contradiction;

	const prompt = createContradictionPrompt({ contradiction, question });

	const activePromptState: ActivePromptState = {
		contradictionId: contradiction.id,
		kind: 'contradiction_resolution',
		questionId: question.id,
		startedAt: now,
		updatedAt: now,
	};

	state.activePrompt = activePromptState;
	state.activeQuestionId = question.id;

	return { activePromptState, prompt, state };
}
