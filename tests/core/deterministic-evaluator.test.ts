/**
 * Step 4.3 — Deterministic evaluator tests.
 *
 * Tests for {@link createDeterministicAnswerEvaluator}.
 *
 * Covers:
 * 1. Empty answer → insufficient, shouldAdvance: false.
 * 2. Whitespace answer → insufficient.
 * 3. Slash command answer → ok: false, not treated as normal answer.
 * 4. Vague short answers → needs_clarification or insufficient.
 * 5. Normal non-empty answer → conservative partial, shouldAdvance: false.
 * 6. All successful outputs pass validateAnswerEvaluation.
 * 7. No deterministic result advances unless explicitly safe and tested.
 */

import { describe, expect, it } from 'vitest';
import { createDeterministicAnswerEvaluator } from '../../src/core/evaluation/deterministic-evaluator.js';
import { validateAnswerEvaluation } from '../../src/core/evaluation/evaluation-validation.js';
import type { ActivePrompt } from '../../src/core/intake/prompt-selection-types.js';
import type { LogosQuestion } from '../../src/core/questions/question-types.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createQuestionFixture(
	overrides: Partial<LogosQuestion> = {},
): LogosQuestion {
	return {
		acceptanceCriteria: ['Clear proposition exists'],
		completionSignals: ['Answer is specific'],
		documentId: '01-thesis',
		followUpPolicy: {
			askForExamples: true,
			askForTradeoffs: true,
			maxFollowUps: 3,
		},
		id: 'test-q-1',
		insufficiencySignals: [],
		phaseId: '01-foundation',
		priority: 'critical',
		profileId: 'standard',
		purpose: 'Define the central thesis.',
		question: 'What is the central thesis of the project?',
		required: true,
		sectionId: 'core-thesis',
		sourcePath: '/project/profiles/standard/phases/01-foundation/01-thesis.yml',
		...overrides,
	};
}

function createActivePromptFixture(
	overrides: Partial<ActivePrompt> = {},
): ActivePrompt {
	return {
		context: undefined,
		documentId: '01-thesis',
		kind: 'question',
		phaseId: '01-foundation',
		priority: 'critical',
		questionId: 'test-q-1',
		required: true,
		sectionId: 'core-thesis',
		text: 'What is the central thesis that justifies this project existing?',
		...overrides,
	};
}

function createIntakeStateFixture(
	overrides: Partial<LogosIntakeState> = {},
): LogosIntakeState {
	return {
		activePrompt: undefined,
		activeQuestionId: undefined,
		answeredQuestions: {},
		contradictions: {},
		initializedAt: '2026-01-01T00:00:00.000Z',
		mode: 'intake_active',
		partialQuestions: {},
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 0,
			partial: 0,
			skipped: 0,
			sufficient: 0,
			total: 0,
		},
		projectRoot: '/tmp/test',
		skippedQuestions: {},
		updatedAt: '2026-01-01T00:00:00.000Z',
		version: 1,
		...overrides,
	};
}

async function evaluate(answer: string) {
	const evaluator = createDeterministicAnswerEvaluator();
	return evaluator.evaluateAnswer({
		activePrompt: createActivePromptFixture(),
		answer,
		intakeState: createIntakeStateFixture(),
		now: '2026-01-01T00:00:00.000Z',
		question: createQuestionFixture(),
	});
}

// ---------------------------------------------------------------------------
// Empty answer tests
// ---------------------------------------------------------------------------

describe('deterministic evaluator — empty / whitespace', () => {
	it('empty answer returns insufficient and shouldAdvance: false', async () => {
		const result = await evaluate('');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('insufficient');
			expect(result.evaluation.shouldAdvance).toBe(false);
			expect(result.evaluation.completenessScore).toBe(0);
			expect(result.evaluation.missingAspects).toContain('answer');
		}
	});

	it('whitespace-only answer returns insufficient', async () => {
		const result = await evaluate('   \t \n  ');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('insufficient');
			expect(result.evaluation.shouldAdvance).toBe(false);
		}
	});

	it('empty answer includes a suggestedFollowUp', async () => {
		const result = await evaluate('');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.suggestedFollowUp).toBeDefined();
			expect(result.evaluation.suggestedFollowUp?.length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Command-like answer tests
// ---------------------------------------------------------------------------

describe('deterministic evaluator — command-like answers', () => {
	it('slash command answer returns ok: false', async () => {
		const result = await evaluate('/logos-status');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.errors.some((e) =>
					e.includes('command_text_cannot_be_evaluated_as_answer'),
				),
			).toBe(true);
		}
	});

	it('unknown slash command also returns ok: false', async () => {
		const result = await evaluate('/some-unknown-cmd');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.errors.some((e) =>
					e.includes('command_text_cannot_be_evaluated_as_answer'),
				),
			).toBe(true);
		}
	});

	it('slash command answer is never treated as normal answer', async () => {
		const result = await evaluate('/logos-start');
		expect(result.ok).toBe(false);
		// Should never produce ok: true with any non-error status.
	});

	it('slash command does not produce shouldAdvance: true', async () => {
		const result = await evaluate('/logos-generate');
		// ok: false means no evaluation is produced at all.
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Vague short answer tests
// ---------------------------------------------------------------------------

describe('deterministic evaluator — vague short answers', () => {
	const vagueAnswers = [
		'yes',
		'no',
		'maybe',
		'ok',
		'sure',
		'sim',
		'não',
		'nao',
		'talvez',
	];

	for (const answer of vagueAnswers) {
		it(`"${answer}" returns needs_clarification or insufficient and shouldAdvance: false`, async () => {
			const result = await evaluate(answer);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(
					result.evaluation.status === 'needs_clarification' ||
						result.evaluation.status === 'insufficient',
				).toBe(true);
				expect(result.evaluation.shouldAdvance).toBe(false);
				expect(result.evaluation.completenessScore).toBeLessThan(0.5);
			}
		});
	}

	it('vague answer includes suggestedFollowUp', async () => {
		const result = await evaluate('maybe');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.suggestedFollowUp).toBeDefined();
			expect(result.evaluation.suggestedFollowUp?.length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Normal answer tests
// ---------------------------------------------------------------------------

describe('deterministic evaluator — normal non-empty answers', () => {
	it('normal non-empty answer returns conservative partial', async () => {
		const result = await evaluate(
			'My project is about building a better documentation system.',
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('partial');
			expect(result.evaluation.shouldAdvance).toBe(false);
		}
	});

	it('normal answer has completenessScore around 0.5', async () => {
		const result = await evaluate('A detailed answer about the project.');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.completenessScore).toBe(0.5);
		}
	});

	it('normal answer includes missing aspects', async () => {
		const result = await evaluate('Some answer text here.');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.missingAspects.length).toBeGreaterThan(0);
		}
	});

	it('normal answer includes suggestedFollowUp', async () => {
		const result = await evaluate('A decent answer.');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.suggestedFollowUp).toBeDefined();
		}
	});

	it('long answer is also conservative partial', async () => {
		const longAnswer =
			'The central thesis of my project is that existing tools fail to ' +
			'capture project intent in a structured way, and LOGOS should bridge ' +
			'that gap by being conversational, profile-driven, and deterministic. ' +
			'It should not be a command-based questionnaire but rather a guided ' +
			'conversation that extracts decisions and clarifies ambiguity.';
		const result = await evaluate(longAnswer);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('partial');
			expect(result.evaluation.shouldAdvance).toBe(false);
		}
	});

	it('normal answer has extractedFacts populated', async () => {
		const result = await evaluate('A solid answer about the project thesis.');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.extractedFacts.length).toBeGreaterThan(0);
			expect(result.evaluation.extractedFacts[0]?.text).toBeDefined();
		}
	});
});

// ---------------------------------------------------------------------------
// validateAnswerEvaluation coverage
// ---------------------------------------------------------------------------

describe('deterministic evaluator — validateAnswerEvaluation coverage', () => {
	it('empty answer output passes validateAnswerEvaluation', async () => {
		const result = await evaluate('');
		expect(result.ok).toBe(true);
		if (result.ok) {
			const validation = validateAnswerEvaluation(result.evaluation);
			expect(validation.ok).toBe(true);
		}
	});

	it('normal answer output passes validateAnswerEvaluation', async () => {
		const result = await evaluate('A normal answer.');
		expect(result.ok).toBe(true);
		if (result.ok) {
			const validation = validateAnswerEvaluation(result.evaluation);
			expect(validation.ok).toBe(true);
		}
	});

	it('vague answer output passes validateAnswerEvaluation', async () => {
		const result = await evaluate('yes');
		expect(result.ok).toBe(true);
		if (result.ok) {
			const validation = validateAnswerEvaluation(result.evaluation);
			expect(validation.ok).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// No advancement unless safe
// ---------------------------------------------------------------------------

describe('deterministic evaluator — no advancement unless safe', () => {
	it('never returns shouldAdvance: true', async () => {
		// The deterministic evaluator is conservative and never advances.
		const testAnswers = [
			'',
			'   ',
			'yes',
			'no',
			'maybe',
			'A short answer.',
			'A really long detailed answer about many things that might be useful.',
		];

		for (const answer of testAnswers) {
			const result = await evaluate(answer);
			if (result.ok) {
				expect(
					result.evaluation.shouldAdvance,
					`shouldAdvance was true for answer: "${answer}"`,
				).toBe(false);
			}
		}
	});
});
