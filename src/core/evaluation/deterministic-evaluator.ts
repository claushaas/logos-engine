/**
 * LOGOS Core — Deterministic baseline answer evaluator.
 *
 * Provides a conservative, deterministic evaluator that implements the
 * {@link AnswerEvaluator} port.  It performs only structural / safety
 * checks — no semantic understanding, no AI calls, no network.
 *
 * Rules applied:
 * 1. Empty or whitespace-only answer → insufficient, shouldAdvance: false.
 * 2. Command-like answer starting with `/` → ok: false with error.
 * 3. Very short vague answers (yes, no, maybe, sim, não, etc.) →
 *    needs_clarification, shouldAdvance: false.
 * 4. Non-empty normal answer → conservative partial, shouldAdvance: false.
 *
 * All successful outputs are validated through
 * {@link validateAnswerEvaluation} before being returned.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 * Must not call network, credentials, or AI.
 */

import type { AnswerEvaluation } from './answer-evaluation.js';
import type {
	AnswerEvaluator,
	EvaluateAnswerInput,
	EvaluateAnswerResult,
} from './answer-evaluator-port.js';
import { validateAnswerEvaluation } from './evaluation-validation.js';

// ---------------------------------------------------------------------------
// Vague answer patterns
// ---------------------------------------------------------------------------

/**
 * Known short vague responses that carry no substantive content.
 * Matched case-insensitively after trimming.
 */
const VAGUE_ANSWER_PATTERNS: ReadonlySet<string> = new Set([
	'yes',
	'no',
	'maybe',
	'perhaps',
	'sure',
	'ok',
	'okay',
	'yep',
	'nope',
	'yeah',
	'nope',
	'nah',
	'yup',
	'sim',
	'não',
	'nao',
	'talvez',
	'claro',
	'certo',
	'obvio',
	'óbvio',
	'provavelmente',
	'provavelmente sim',
	'provavelmente não',
	'provavelmente nao',
	's',
	'n',
]);

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

/**
 * Create a deterministic baseline answer evaluator.
 *
 * This evaluator implements conservative structural checks:
 * - Rejects empty / whitespace answers as insufficient.
 * - Rejects command-like text (starts with `/`) with `ok: false`.
 * - Returns `needs_clarification` for known vague one-word responses.
 * - Returns a conservative `partial` evaluation for all other non-empty
 *   answers (completenessScore 0.5, shouldAdvance: false).
 *
 * Every successful output is validated through
 * {@link validateAnswerEvaluation}. Invalid outputs are returned as
 * `ok: false` with errors.
 *
 * @returns A deterministic {@link AnswerEvaluator} suitable as a fallback
 *          or for use in tests without AI, network, or credentials.
 */
export function createDeterministicAnswerEvaluator(): AnswerEvaluator {
	return {
		async evaluateAnswer(
			input: EvaluateAnswerInput,
		): Promise<EvaluateAnswerResult> {
			return evaluateDeterministically(input);
		},
	};
}

// ---------------------------------------------------------------------------
// Internal evaluation logic
// ---------------------------------------------------------------------------

function evaluateDeterministically(
	input: EvaluateAnswerInput,
): EvaluateAnswerResult {
	const { question, answer } = input;
	const trimmed = answer.trim();
	const warnings: string[] = [];

	// ---- 1. Empty / whitespace-only ----
	if (trimmed.length === 0) {
		const evaluation: AnswerEvaluation = {
			completenessScore: 0,
			extractedAssumptions: [],
			extractedDecisions: [],
			extractedFacts: [],
			extractedRisks: [],
			missingAspects: ['answer'],
			questionId: question.id,
			shouldAdvance: false,
			status: 'insufficient',
			suggestedFollowUp:
				'The answer was empty. Please provide your answer to the active question.',
		};

		return validateAndReturn(evaluation, warnings);
	}

	// ---- 2. Command-like answer (starts with /) ----
	if (trimmed.startsWith('/')) {
		return {
			errors: [
				'command_text_cannot_be_evaluated_as_answer: ' +
					'Answers beginning with "/" are treated as commands and must not reach answer evaluation.',
			],
			ok: false,
			warnings,
		};
	}

	// ---- 3. Vague short answers ----
	const lower = trimmed.toLowerCase();
	if (VAGUE_ANSWER_PATTERNS.has(lower)) {
		const evaluation: AnswerEvaluation = {
			completenessScore: 0.1,
			extractedAssumptions: [],
			extractedDecisions: [],
			extractedFacts: [],
			extractedRisks: [],
			missingAspects: ['specifics', 'detail'],
			questionId: question.id,
			shouldAdvance: false,
			status: 'needs_clarification',
			suggestedFollowUp:
				'Your answer is very brief. Could you provide more detail or context?',
		};

		return validateAndReturn(evaluation, warnings);
	}

	// ---- 4. Normal non-empty answer → conservative partial ----
	const evaluation: AnswerEvaluation = {
		completenessScore: 0.5,
		extractedAssumptions: [],
		extractedDecisions: [],
		extractedFacts: [{ text: trimmed.slice(0, 500) }],
		extractedRisks: [],
		missingAspects: ['specifics'],
		questionId: question.id,
		shouldAdvance: false,
		status: 'partial',
		suggestedFollowUp:
			'Could you provide more specific details to help me fully understand your answer?',
	};

	return validateAndReturn(evaluation, warnings);
}

// ---------------------------------------------------------------------------
// Validation wrapper
// ---------------------------------------------------------------------------

/**
 * Runs the evaluation through {@link validateAnswerEvaluation} and returns
 * either `ok: true` with the validated evaluation or `ok: false` with
 * validation errors.
 */
function validateAndReturn(
	evaluation: AnswerEvaluation,
	warnings: string[],
): EvaluateAnswerResult {
	const validation = validateAnswerEvaluation(evaluation);

	if (validation.ok) {
		return {
			evaluation: validation.evaluation,
			ok: true,
			warnings: [...warnings, ...validation.warnings],
		};
	}

	return {
		errors: validation.errors,
		ok: false,
		warnings: [...warnings, ...validation.warnings],
	};
}
