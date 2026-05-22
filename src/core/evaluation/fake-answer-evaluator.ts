/**
 * LOGOS Core — Fake answer evaluator for deterministic tests.
 *
 * Provides a configurable fake {@link AnswerEvaluator} that returns
 * pre-determined evaluation outcomes.  Intended for use in unit,
 * integration, and contract tests that must not depend on AI providers,
 * network access, credentials, or Pi runtime.
 *
 * The fake evaluator supports seven modes:
 * - `sufficient` → advances the intake.
 * - `partial` → non-advancing, with missing aspects.
 * - `insufficient` → non-advancing, low completeness.
 * - `contradictory` → non-advancing, with risks / follow-up.
 * - `needs_clarification` → non-advancing, with suggested follow-up.
 * - `invalid_output` → produces invalid output internally; validation catches
 *    it and returns `ok: false`.
 * - `throws` → catches internal throw and returns `ok: false`.
 *
 * All successful outputs are validated through
 * {@link validateAnswerEvaluation}.  Test overrides are also validated.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 * Must not call network, credentials, or AI.
 */

import type { LogosQuestion } from '../questions/question-types.js';
import type { AnswerEvaluation } from './answer-evaluation.js';
import type {
	AnswerEvaluator,
	EvaluateAnswerInput,
	EvaluateAnswerResult,
} from './answer-evaluator-port.js';
import {
	validateAnswerEvaluation,
	validateEvaluationAdvancementConsistency,
} from './evaluation-validation.js';

// ---------------------------------------------------------------------------
// Mode type
// ---------------------------------------------------------------------------

/**
 * Pre-defined evaluation mode for the fake answer evaluator.
 *
 * Each mode produces a deterministic {@link AnswerEvaluation} (or error)
 * with predictable `status`, `completenessScore`, `shouldAdvance`, and
 * associated extracted items.
 */
export type FakeAnswerEvaluatorMode =
	| 'sufficient'
	| 'partial'
	| 'insufficient'
	| 'contradictory'
	| 'needs_clarification'
	| 'invalid_output'
	| 'throws';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Configuration for {@link createFakeAnswerEvaluator}.
 *
 * @property mode — The evaluation outcome to simulate.
 * @property evaluation — Optional partial {@link AnswerEvaluation} override.
 *   The override is merged onto the default evaluation for the mode.
 *   Required fields (`questionId`, `status`, `shouldAdvance`,
 *   `completenessScore`, `missingAspects`, extracted arrays) may be
 *   overridden individually, but the override is still validated.
 */
export type FakeAnswerEvaluatorOptions = {
	mode: FakeAnswerEvaluatorMode;
	evaluation?: Partial<AnswerEvaluation>;
};

// ---------------------------------------------------------------------------
// Default evaluations per mode
// ---------------------------------------------------------------------------

function makeDefaultEvaluation(
	question: LogosQuestion,
	mode: FakeAnswerEvaluatorMode,
): AnswerEvaluation {
	switch (mode) {
		case 'sufficient':
			return {
				completenessScore: 1,
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [
					{ text: 'User provided a complete and specific answer.' },
				],
				extractedRisks: [],
				missingAspects: [],
				questionId: question.id,
				shouldAdvance: true,
				status: 'sufficient',
			};

		case 'partial':
			return {
				completenessScore: 0.5,
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [{ text: 'User provided a partial answer.' }],
				extractedRisks: [],
				missingAspects: ['budget', 'timeline'],
				questionId: question.id,
				shouldAdvance: false,
				status: 'partial',
				suggestedFollowUp:
					'Could you also provide information about budget and timeline?',
			};

		case 'insufficient':
			return {
				completenessScore: 0,
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [],
				extractedRisks: [],
				missingAspects: ['core answer'],
				questionId: question.id,
				shouldAdvance: false,
				status: 'insufficient',
				suggestedFollowUp:
					'Your answer does not address the question. Could you try answering from a different angle?',
			};

		case 'contradictory':
			return {
				completenessScore: 0.3,
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [],
				extractedRisks: [
					{
						text: 'This answer conflicts with a previously accepted decision.',
					},
				],
				missingAspects: ['resolution'],
				questionId: question.id,
				shouldAdvance: false,
				status: 'contradictory',
				suggestedFollowUp:
					'This answer contradicts a previous decision. Which direction should be treated as authoritative?',
			};

		case 'needs_clarification':
			return {
				completenessScore: 0.2,
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [],
				extractedRisks: [],
				missingAspects: [],
				questionId: question.id,
				shouldAdvance: false,
				status: 'needs_clarification',
				suggestedFollowUp:
					'Could you clarify what you mean? I need more context to understand your answer.',
			};

		case 'invalid_output':
			// Deliberately invalid — missing required fields.
			// The validation layer catches this and returns ok: false.
			return {
				completenessScore: 2, // out of range
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [],
				extractedRisks: [],
				missingAspects: [],
				questionId: '',
				shouldAdvance: true,
				status: 'insufficient', // insufficient + shouldAdvance: true is illegal
			};

		case 'throws':
			// Never reaches default evaluation; handled in the evaluator body.
			return {
				completenessScore: 0,
				extractedAssumptions: [],
				extractedDecisions: [],
				extractedFacts: [],
				extractedRisks: [],
				missingAspects: [],
				questionId: question.id,
				shouldAdvance: false,
				status: 'insufficient',
			};

		default: {
			const _exhaustive: never = mode;
			throw new Error(`Unknown fake evaluator mode: ${String(_exhaustive)}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

/**
 * Create a fake answer evaluator for deterministic tests.
 *
 * The returned evaluator produces a pre-determined result based on the
 * configured {@link FakeAnswerEvaluatorMode}.  All successful outputs are
 * validated through {@link validateAnswerEvaluation}.  Invalid overrides or
 * the `invalid_output` mode will cause the evaluator to return `ok: false`.
 *
 * The evaluator never calls AI, network, credentials, or Pi APIs.
 *
 * @param options — Configuration: mode and optional field overrides.
 * @returns A deterministic fake {@link AnswerEvaluator}.
 */
export function createFakeAnswerEvaluator(
	options: FakeAnswerEvaluatorOptions,
): AnswerEvaluator {
	return {
		async evaluateAnswer(
			input: EvaluateAnswerInput,
		): Promise<EvaluateAnswerResult> {
			return evaluateFake(options, input);
		},
	};
}

// ---------------------------------------------------------------------------
// Internal evaluation logic
// ---------------------------------------------------------------------------

async function evaluateFake(
	options: FakeAnswerEvaluatorOptions,
	input: EvaluateAnswerInput,
): Promise<EvaluateAnswerResult> {
	const { mode, evaluation: overrides } = options;
	const { question } = input;

	// ---- "throws" mode: catch internal throw and return structured error ----
	if (mode === 'throws') {
		try {
			// We intentionally throw inside a controlled scope so the caller
			// does not see an unhandled rejection.
			throw new Error('Fake evaluator internal throw (expected in tests).');
		} catch (err: unknown) {
			return {
				errors: [
					`evaluator_throw: ${
						err instanceof Error ? err.message : 'Unknown error'
					}`,
				],
				ok: false,
				warnings: [],
			};
		}
	}

	// ---- Build base evaluation ----
	const base = makeDefaultEvaluation(question, mode);

	// ---- Merge overrides (shallow merge on top-level fields) ----
	let merged: AnswerEvaluation = base;

	if (overrides !== undefined) {
		// Shallow-merge overrides onto the base.  We intentionally allow
		// individual field overrides — the validation layer will reject
		// anything invalid.
		merged = { ...base, ...overrides };
	}

	// ---- Validate ----
	const validation = validateAnswerEvaluation(merged);

	if (!validation.ok) {
		return {
			errors: validation.errors,
			ok: false,
			warnings: validation.warnings,
		};
	}

	// ---- Additional check: validate override didn't break consistency ----
	const consistencyIssues = validateEvaluationAdvancementConsistency(merged);
	if (consistencyIssues.length > 0) {
		const errors = consistencyIssues.filter((i) => i.startsWith('[error]'));
		if (errors.length > 0) {
			return {
				errors,
				ok: false,
				warnings: consistencyIssues.filter((i) => !i.startsWith('[error]')),
			};
		}
	}

	return {
		evaluation: validation.evaluation,
		ok: true,
		warnings: validation.warnings,
	};
}
