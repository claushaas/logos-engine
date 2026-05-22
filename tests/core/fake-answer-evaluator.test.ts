/**
 * Step 4.3 — Fake answer evaluator tests.
 *
 * Tests for {@link createFakeAnswerEvaluator}.
 *
 * Covers all 7 modes:
 * 1. sufficient → status sufficient, shouldAdvance: true.
 * 2. partial → status partial, shouldAdvance: false.
 * 3. insufficient → status insufficient, shouldAdvance: false.
 * 4. contradictory → status contradictory, shouldAdvance: false.
 * 5. needs_clarification → status needs_clarification, shouldAdvance: false.
 * 6. invalid_output → ok: false.
 * 7. throws → ok: false.
 *
 * Also covers:
 * - Overrides are validated.
 * - No fake evaluator requires network, credentials, or Pi.
 */

import { describe, expect, it } from 'vitest';
import type { AnswerEvaluation } from '../../src/core/evaluation/answer-evaluation.js';
import type { EvaluateAnswerInput } from '../../src/core/evaluation/answer-evaluator-port.js';
import { createFakeAnswerEvaluator } from '../../src/core/evaluation/fake-answer-evaluator.js';
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

function makeInput(
	overrides: Partial<EvaluateAnswerInput> = {},
): EvaluateAnswerInput {
	return {
		activePrompt: createActivePromptFixture(),
		answer: 'Test answer.',
		intakeState: createIntakeStateFixture(),
		now: '2026-01-01T00:00:00.000Z',
		question: createQuestionFixture(),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Mode-specific tests
// ---------------------------------------------------------------------------

describe('fake answer evaluator — sufficient mode', () => {
	it('returns status sufficient and shouldAdvance: true', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('sufficient');
			expect(result.evaluation.shouldAdvance).toBe(true);
			expect(result.evaluation.completenessScore).toBe(1);
		}
	});

	it('has empty missingAspects', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.missingAspects).toEqual([]);
		}
	});
});

describe('fake answer evaluator — partial mode', () => {
	it('returns status partial and shouldAdvance: false', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'partial' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('partial');
			expect(result.evaluation.shouldAdvance).toBe(false);
		}
	});

	it('has non-empty missingAspects', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'partial' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.missingAspects.length).toBeGreaterThan(0);
		}
	});

	it('has suggestedFollowUp', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'partial' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.suggestedFollowUp).toBeDefined();
		}
	});
});

describe('fake answer evaluator — insufficient mode', () => {
	it('returns status insufficient and shouldAdvance: false', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'insufficient' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('insufficient');
			expect(result.evaluation.shouldAdvance).toBe(false);
			expect(result.evaluation.completenessScore).toBe(0);
		}
	});
});

describe('fake answer evaluator — contradictory mode', () => {
	it('returns status contradictory and shouldAdvance: false', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'contradictory' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('contradictory');
			expect(result.evaluation.shouldAdvance).toBe(false);
		}
	});

	it('has extractedRisks or suggestedFollowUp or missingAspects', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'contradictory' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			const hasContent =
				result.evaluation.extractedRisks.length > 0 ||
				result.evaluation.missingAspects.length > 0 ||
				result.evaluation.suggestedFollowUp !== undefined;
			expect(hasContent).toBe(true);
		}
	});
});

describe('fake answer evaluator — needs_clarification mode', () => {
	it('returns status needs_clarification and shouldAdvance: false', async () => {
		const evaluator = createFakeAnswerEvaluator({
			mode: 'needs_clarification',
		});
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.status).toBe('needs_clarification');
			expect(result.evaluation.shouldAdvance).toBe(false);
		}
	});

	it('has suggestedFollowUp', async () => {
		const evaluator = createFakeAnswerEvaluator({
			mode: 'needs_clarification',
		});
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.suggestedFollowUp).toBeDefined();
			expect(result.evaluation.suggestedFollowUp?.length).toBeGreaterThan(0);
		}
	});
});

describe('fake answer evaluator — invalid_output mode', () => {
	it('returns ok: false', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'invalid_output' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	it('invalid_output cannot return ok: true', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'invalid_output' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
	});
});

describe('fake answer evaluator — throws mode', () => {
	it('returns ok: false', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'throws' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	it('does not throw to caller', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'throws' });
		await expect(evaluator.evaluateAnswer(makeInput())).resolves.toBeDefined();
	});

	it('error contains evaluator_throw prefix', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'throws' });
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('evaluator_throw'))).toBe(
				true,
			);
		}
	});
});

// ---------------------------------------------------------------------------
// Override tests
// ---------------------------------------------------------------------------

describe('fake answer evaluator — overrides', () => {
	it('valid override is accepted', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: {
				completenessScore: 0.85,
				missingAspects: ['budget'],
				suggestedFollowUp: 'What about budget?',
			},
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.completenessScore).toBe(0.85);
			expect(result.evaluation.missingAspects).toContain('budget');
			expect(result.evaluation.suggestedFollowUp).toBe('What about budget?');
		}
	});

	it('override that makes evaluation invalid returns ok: false', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: {
				completenessScore: -0.5,
				shouldAdvance: true, // partial + shouldAdvance: true is illegal
				status: 'partial',
			} as Partial<AnswerEvaluation>,
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
	});

	it('override with out-of-range completeness score fails', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: {
				completenessScore: 1.5,
			},
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
	});

	it('override with empty questionId fails', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: {
				questionId: '',
			},
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer(makeInput());
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// No network/credentials/Pi
// ---------------------------------------------------------------------------

describe('fake answer evaluator — no network/credentials/Pi', () => {
	it('does not require network, credentials, or Pi', () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		expect(evaluator).toBeDefined();
		expect(typeof evaluator.evaluateAnswer).toBe('function');
	});
});

// ---------------------------------------------------------------------------
// JSON serializability
// ---------------------------------------------------------------------------

describe('fake answer evaluator — JSON serializability', () => {
	it('sufficient result is JSON-serializable', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		const result = await evaluator.evaluateAnswer(makeInput());
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(true);
	});

	it('invalid_output result is JSON-serializable', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'invalid_output' });
		const result = await evaluator.evaluateAnswer(makeInput());
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(false);
		expect(Array.isArray(parsed.errors)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// All modes produce correct questionId
// ---------------------------------------------------------------------------

describe('fake answer evaluator — questionId consistency', () => {
	it('all modes return the correct questionId', async () => {
		const modes = [
			'sufficient',
			'partial',
			'insufficient',
			'contradictory',
			'needs_clarification',
		] as const;

		for (const mode of modes) {
			const evaluator = createFakeAnswerEvaluator({ mode });
			const result = await evaluator.evaluateAnswer(makeInput());
			if (result.ok) {
				expect(result.evaluation.questionId).toBe('test-q-1');
			}
		}
	});
});
