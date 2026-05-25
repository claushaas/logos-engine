/**
 * LOGOS Core — Apply answer evaluation to intake state (Step 4.4).
 *
 * Pure function that applies a validated {@link AnswerEvaluation} to durable
 * intake state and returns the resulting transition, updated state, and any
 * assistant prompt hints.
 *
 * This module is owned by Core.  It must not import Pi, Ink, React, TUI,
 * or CLI modules.
 *
 * Boundary: pure function — does not persist, call evaluators, or resolve
 *           profiles.  The caller is responsible for persistence and
 *           next-prompt selection.
 */

import type { AnswerEvaluation } from '../evaluation/answer-evaluation.js';
import type { LogosQuestion } from '../questions/question-types.js';
import type {
	IntakeAnswerRecord,
	IntakePartialRecord,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import { createContradictionPrompt } from './active-prompt.js';
import { createContradictionRecord } from './contradiction-resolution.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Transition classification returned by `applyAnswerEvaluation`.
 *
 * Each value represents the single semantic change that occurred.
 */
export type EvaluationTransition =
	| 'answer_accepted'
	| 'follow_up_requested'
	| 'clarification_requested'
	| 'contradiction_recorded'
	| 'insufficient_answer'
	| 'pending_recorded'
	| 'skipped';

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export type ApplyAnswerEvaluationInput = {
	/** Current durable intake state (will not be mutated). */
	intakeState: LogosIntakeState;
	/** The active question being answered. */
	question: LogosQuestion;
	/** The active prompt at the time of the answer. */
	activePrompt: ActivePrompt;
	/** The raw user answer text. */
	answer: string;
	/** Validated answer evaluation. */
	evaluation: AnswerEvaluation;
	/** ISO-8601 timestamp for "now" (injectable for deterministic tests). */
	now: string;
};

export type ApplyAnswerEvaluationResult = {
	/** A copy of the intake state with the evaluation applied. */
	state: LogosIntakeState;
	/** The semantic transition that occurred. */
	transition: EvaluationTransition;
	/**
	 * A prompt hint for the caller.  When the transition advances to a new
	 * question, this is `undefined` — the caller must run the selector.
	 * When the transition does not advance, this contains the follow-up,
	 * clarification, or contradiction prompt.
	 */
	nextPromptHint?: ActivePrompt | undefined;
	/** Non-blocking advisory messages. */
	warnings: string[];
};

// ---------------------------------------------------------------------------
// State-copy helpers
// ---------------------------------------------------------------------------

/**
 * Create a shallow copy of the intake state with `updatedAt` set.
 * This is the starting point for every mutation path.
 *
 * Spreads the original state (which preserves the presence/absence of
 * `activePrompt` and `activeQuestionId` correctly for
 * `exactOptionalPropertyTypes`) then overrides the mutable sub-objects
 * with shallow copies.
 */
function copyState(
	intakeState: LogosIntakeState,
	now: string,
): LogosIntakeState {
	return {
		...intakeState,
		answeredQuestions: { ...intakeState.answeredQuestions },
		contradictions: { ...intakeState.contradictions },
		partialQuestions: { ...intakeState.partialQuestions },
		progress: {
			...intakeState.progress,
			byPhase: { ...intakeState.progress.byPhase },
		},
		skippedQuestions: { ...intakeState.skippedQuestions },
		updatedAt: now,
	};
}

// ---------------------------------------------------------------------------
// Answer-record builder
// ---------------------------------------------------------------------------

function makeAnswerRecord(
	question: LogosQuestion,
	answer: string,
	evaluation: AnswerEvaluation,
	now: string,
): IntakeAnswerRecord {
	return {
		answer,
		answeredAt: now,
		evaluationId: `eval.${question.id}.${now}`,
		metadata: {
			completenessScore: evaluation.completenessScore,
			missingAspects: evaluation.missingAspects,
		},
		questionId: question.id,
		status: evaluation.status,
	};
}

// ---------------------------------------------------------------------------
// Partial-record builder
// ---------------------------------------------------------------------------

function makePartialRecord(
	question: LogosQuestion,
	answer: string,
	evaluation: AnswerEvaluation,
	now: string,
): IntakePartialRecord {
	return {
		answer,
		metadata: {
			completenessScore: evaluation.completenessScore,
		},
		missingAspects: evaluation.missingAspects,
		questionId: question.id,
		reason: evaluation.suggestedFollowUp ?? 'Your answer was incomplete.',
		recordedAt: now,
	};
}

// ---------------------------------------------------------------------------
// Progress recalculation
// ---------------------------------------------------------------------------

/**
 * Recalculate intake progress counts from current state records.
 *
 * This mirrors the selector's question-status logic: it counts answers
 * by their authoritative `IntakeAnswerStatus` rather than re-deriving
 * from selector statuses.
 */
function recalculateProgress(
	state: LogosIntakeState,
): LogosIntakeState['progress'] {
	let sufficient = 0;
	let partial = 0;
	let contradictory = 0;
	let skipped = 0;
	let missing = 0;
	let total = 0;

	for (const _key of Object.keys(state.answeredQuestions)) {
		total++;
		const record = state.answeredQuestions[_key];
		if (record === undefined) continue;
		switch (record.status) {
			case 'sufficient':
				sufficient++;
				break;
			case 'contradictory':
				contradictory++;
				break;
			default:
				// partial, insufficient, needs_clarification
				partial++;
				break;
		}
	}

	// Also count skipped records toward total.
	for (const _key of Object.keys(state.skippedQuestions)) {
		total++;
		skipped++;
	}

	// Missing = total - all accounted (in the MVP, we don't have a direct
	// registry reference here, so we leave missing as a derived count from
	// whatever the caller can provide).
	missing = total - sufficient - partial - contradictory - skipped;
	if (missing < 0) missing = 0;

	// Preserve byPhase if already computed; otherwise empty.
	// The caller can later enhance byPhase with registry knowledge.
	return {
		...state.progress,
		contradictory,
		missing,
		partial,
		skipped,
		sufficient,
		total,
	};
}

// ---------------------------------------------------------------------------
// Main application logic
// ---------------------------------------------------------------------------

/**
 * Apply a validated {@link AnswerEvaluation} to durable intake state.
 *
 * This is a pure function: it does not call evaluators, resolve profiles,
 * select next prompts, or persist state.  The caller is responsible for:
 * 1. Calling `selectNextPrompt(...)` when the transition indicates advancement.
 * 2. Persisting the returned `state`.
 * 3. Building the final assistant message.
 *
 * Rules:
 * - Never mutates the input `intakeState`.
 * - Returns a shallow-copied state with changes applied.
 * - Sufficient with `shouldAdvance: true` → clears active prompt (caller
 *   selects next).
 * - Partial → creates partial record, keeps active prompt as follow-up.
 * - Insufficient / needs_clarification → records answer as non-advancing,
 *   keeps active prompt.
 * - Contradictory → creates contradiction record, sets active prompt to
 *   contradiction resolution.
 */
export function applyAnswerEvaluation(
	input: ApplyAnswerEvaluationInput,
): ApplyAnswerEvaluationResult {
	const { intakeState, question, activePrompt, answer, evaluation, now } =
		input;
	const warnings: string[] = [];
	const { status, shouldAdvance } = evaluation;

	// ---- 1. Copy state ----
	const state = copyState(intakeState, now);

	// ---- 2. Always record the answer ----
	// When this is a follow-up response, preserve the original answer
	// text so the user's earlier, more complete answer is not lost.
	const existingAnswer = intakeState.answeredQuestions[question.id];
	const preservedAnswer =
		activePrompt.kind === 'follow_up' && existingAnswer !== undefined
			? existingAnswer.answer
			: answer;
	const answerRecord = makeAnswerRecord(
		question,
		preservedAnswer,
		evaluation,
		now,
	);
	if (existingAnswer !== undefined) {
		answerRecord.revisedAt = now;
	}
	state.answeredQuestions[question.id] = answerRecord;

	// ---- 3. Dispatch by status ----
	switch (status) {
		// ================================================================
		// SUFFICIENT
		// ================================================================
		case 'sufficient': {
			if (!shouldAdvance) {
				// Sufficient but evaluator says not to advance — unusual.
				// Treat as partial: record partial and ask follow-up.
				warnings.push(
					'Evaluator returned sufficient with shouldAdvance=false. Treating as partial.',
				);
				const partialRecord = makePartialRecord(
					question,
					answer,
					evaluation,
					now,
				);
				state.partialQuestions[question.id] = partialRecord;
				// Keep active prompt as follow-up.
				state.activePrompt = {
					kind: 'follow_up',
					questionId: question.id,
					startedAt: now,
					updatedAt: now,
				};
				state.activeQuestionId = question.id;
				state.progress = recalculateProgress(state);
				return {
					nextPromptHint: createNonAdvancingPrompt(
						question,
						activePrompt,
						evaluation,
						status,
					),
					state,
					transition: 'follow_up_requested',
					warnings,
				};
			}

			// Sufficient + shouldAdvance.
			// Remove partial state if present.
			delete state.partialQuestions[question.id];
			// Clear active prompt — caller will select next.
			delete state.activePrompt;
			delete state.activeQuestionId;
			state.progress = recalculateProgress(state);

			return {
				state,
				transition: 'answer_accepted',
				warnings,
			};
		}

		// ================================================================
		// PARTIAL
		// ================================================================
		case 'partial': {
			const partialRecord = makePartialRecord(
				question,
				answer,
				evaluation,
				now,
			);
			state.partialQuestions[question.id] = partialRecord;

			// Set active prompt to follow-up (same question).
			state.activePrompt = {
				followUpId: `followup.${question.id}.${now}`,
				kind: 'follow_up',
				questionId: question.id,
				startedAt: now,
				updatedAt: now,
			};
			state.activeQuestionId = question.id;
			state.progress = recalculateProgress(state);

			const fuPrompt = createNonAdvancingPrompt(
				question,
				activePrompt,
				evaluation,
				status,
			);

			return {
				nextPromptHint: fuPrompt,
				state,
				transition: 'follow_up_requested',
				warnings,
			};
		}

		// ================================================================
		// INSUFFICIENT
		// ================================================================
		case 'insufficient': {
			// Record as partial (non-advancing), keep active prompt.
			const partialRecord = makePartialRecord(
				question,
				answer,
				evaluation,
				now,
			);
			state.partialQuestions[question.id] = partialRecord;

			// Keep active prompt as follow-up for same question.
			state.activePrompt = {
				followUpId: `followup.${question.id}.${now}`,
				kind: 'follow_up',
				questionId: question.id,
				startedAt: now,
				updatedAt: now,
			};
			state.activeQuestionId = question.id;
			state.progress = recalculateProgress(state);

			const insPrompt = createNonAdvancingPrompt(
				question,
				activePrompt,
				evaluation,
				status,
			);

			return {
				nextPromptHint: insPrompt,
				state,
				transition: 'insufficient_answer',
				warnings,
			};
		}

		// ================================================================
		// NEEDS_CLARIFICATION
		// ================================================================
		case 'needs_clarification': {
			// Record as partial (non-advancing), keep active prompt.
			const partialRecord = makePartialRecord(
				question,
				answer,
				evaluation,
				now,
			);
			state.partialQuestions[question.id] = partialRecord;

			state.activePrompt = {
				followUpId: `followup.${question.id}.${now}`,
				kind: 'follow_up',
				questionId: question.id,
				startedAt: now,
				updatedAt: now,
			};
			state.activeQuestionId = question.id;
			state.progress = recalculateProgress(state);

			const clPrompt = createNonAdvancingPrompt(
				question,
				activePrompt,
				evaluation,
				status,
			);

			return {
				nextPromptHint: clPrompt,
				state,
				transition: 'clarification_requested',
				warnings,
			};
		}

		// ================================================================
		// CONTRADICTORY
		// ================================================================
		case 'contradictory': {
			// Create contradiction record.
			const contradiction = createContradictionRecord({
				evaluation,
				intakeState,
				now,
				questionId: question.id,
			});

			state.contradictions[contradiction.id] = contradiction;

			// Remove partial state for this question if present.
			delete state.partialQuestions[question.id];

			// Set active prompt to contradiction resolution.
			state.activePrompt = {
				contradictionId: contradiction.id,
				kind: 'contradiction_resolution',
				questionId: question.id,
				startedAt: now,
				updatedAt: now,
			};
			state.activeQuestionId = question.id;
			state.progress = recalculateProgress(state);

			// Build contradiction prompt using the shared active-prompt helper.
			const ctPrompt = createContradictionPrompt({
				contradiction,
				question,
			});

			return {
				nextPromptHint: ctPrompt,
				state,
				transition: 'contradiction_recorded',
				warnings,
			};
		}

		default: {
			// Exhaustiveness — should never reach.
			const _exhaustive: never = status;
			throw new Error(`Unknown evaluation status: ${String(_exhaustive)}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Non-advancing prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a non-advancing follow-up / clarification prompt from an evaluation.
 *
 * Prefers `evaluation.suggestedFollowUp` when present.  Otherwise falls
 * back to deterministic language based on the status.
 */
function createNonAdvancingPrompt(
	question: LogosQuestion,
	activePrompt: ActivePrompt,
	evaluation: AnswerEvaluation,
	status: AnswerEvaluation['status'],
): ActivePrompt {
	let text: string;

	if (
		evaluation.suggestedFollowUp !== undefined &&
		evaluation.suggestedFollowUp.length > 0
	) {
		text = evaluation.suggestedFollowUp;
	} else if (evaluation.missingAspects.length > 0) {
		const joined = evaluation.missingAspects.join(', ');
		text = `I need one clarification before moving on: ${joined}. Please expand your answer.`;
	} else {
		// Deterministic fallback by status.
		switch (status) {
			case 'partial':
				text =
					'Your answer was partially complete. Could you provide more detail?';
				break;
			case 'insufficient':
				text =
					"Your answer doesn't fully address the question. Could you try a different approach?";
				break;
			case 'needs_clarification':
				text =
					'I need more context to understand your answer. Could you clarify?';
				break;
			default:
				text = 'Please expand your answer.';
		}
	}

	const prompt: ActivePrompt = {
		context: question.question,
		documentId: activePrompt.documentId,
		followUpId: `followup.${question.id}`,
		kind: 'follow_up',
		phaseId: activePrompt.phaseId,
		priority: activePrompt.priority,
		questionId: question.id,
		required: activePrompt.required,
		sectionId: activePrompt.sectionId,
		text,
	};

	if (activePrompt.sourcePath !== undefined) {
		prompt.sourcePath = activePrompt.sourcePath;
	}

	return prompt;
}
