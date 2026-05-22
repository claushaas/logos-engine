/**
 * Step 4.3 — Evaluator output validation integration tests.
 *
 * Proves cross-cutting validation and safety rules:
 * 1. Deterministic evaluator rejects invalid generated evaluation.
 * 2. Fake evaluator validates outputs before returning success.
 * 3. Invalid override cannot return ok: true.
 * 4. Extracted facts/assumptions/decisions/risks are structured.
 * 5. Successful results are JSON-serializable.
 * 6. Raw Error objects are not exposed as canonical evaluator output.
 */

import { describe, expect, it } from 'vitest';
import { createDeterministicAnswerEvaluator } from '../../src/core/evaluation/deterministic-evaluator.js';
import { validateAnswerEvaluation } from '../../src/core/evaluation/evaluation-validation.js';
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

function createActivePromptFixture(): ActivePrompt {
	return {
		context: undefined,
		documentId: '01-thesis',
		kind: 'question',
		phaseId: '01-foundation',
		priority: 'critical',
		questionId: 'test-q-1',
		required: true,
		sectionId: 'core-thesis',
		text: 'What is the central thesis?',
	};
}

function createIntakeStateFixture(): LogosIntakeState {
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
	};
}

// ---------------------------------------------------------------------------
// 1. Deterministic evaluator validates output
// ---------------------------------------------------------------------------

describe('deterministic evaluator validates output', () => {
	it('empty answer output passes validateAnswerEvaluation', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: '',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const validation = validateAnswerEvaluation(result.evaluation);
			expect(validation.ok).toBe(true);
		}
	});

	it('normal answer output passes validateAnswerEvaluation', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'A meaningful answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const validation = validateAnswerEvaluation(result.evaluation);
			expect(validation.ok).toBe(true);
		}
	});

	it('command answer returns ok: false — no invalid evaluation escapes', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: '/logos-status',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		// ok: false means no evaluation was produced — it was rejected early.
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 2. Fake evaluator validates outputs before returning success
// ---------------------------------------------------------------------------

describe('fake evaluator validates outputs before returning success', () => {
	it('all valid modes produce output that passes validateAnswerEvaluation', async () => {
		const modes = [
			'sufficient',
			'partial',
			'insufficient',
			'contradictory',
			'needs_clarification',
		] as const;

		for (const mode of modes) {
			const evaluator = createFakeAnswerEvaluator({ mode });
			const result = await evaluator.evaluateAnswer({
				activePrompt: createActivePromptFixture(),
				answer: 'Test answer.',
				intakeState: createIntakeStateFixture(),
				now: '2026-01-01T00:00:00.000Z',
				question: createQuestionFixture(),
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				const validation = validateAnswerEvaluation(result.evaluation);
				expect(
					validation.ok,
					`Mode "${mode}" produced invalid output: ${JSON.stringify(validation)}`,
				).toBe(true);
			}
		}
	});

	it('invalid_output mode returns ok: false', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'invalid_output' });
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 3. Invalid override cannot return ok: true
// ---------------------------------------------------------------------------

describe('invalid override cannot return ok: true', () => {
	it('override with out-of-range completeness score fails', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: { completenessScore: 2.5 },
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
	});

	it('override with negative completeness score fails', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: { completenessScore: -1 },
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
	});

	it('override with illegal shouldAdvance for partial status fails', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: { shouldAdvance: true },
			mode: 'partial',
		});
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
	});

	it('override with insufficient + shouldAdvance: true fails', async () => {
		const evaluator = createFakeAnswerEvaluator({
			evaluation: { shouldAdvance: true },
			mode: 'insufficient',
		});
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 4. Extracted facts/assumptions/decisions/risks are structured
// ---------------------------------------------------------------------------

describe('extracted items are structured', () => {
	it('sufficient mode has structured extractedFacts', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const facts = result.evaluation.extractedFacts;
			expect(Array.isArray(facts)).toBe(true);
			for (const fact of facts) {
				expect(typeof fact.text).toBe('string');
				expect(fact.text.length).toBeGreaterThan(0);
			}
		}
	});

	it('contradictory mode has structured extractedRisks', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'contradictory' });
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const risks = result.evaluation.extractedRisks;
			expect(Array.isArray(risks)).toBe(true);
			for (const risk of risks) {
				expect(typeof risk.text).toBe('string');
				expect(risk.text.length).toBeGreaterThan(0);
			}
		}
	});

	it('all extracted arrays are always present in valid results', async () => {
		const modes = [
			'sufficient',
			'partial',
			'insufficient',
			'contradictory',
			'needs_clarification',
		] as const;

		for (const mode of modes) {
			const evaluator = createFakeAnswerEvaluator({ mode });
			const result = await evaluator.evaluateAnswer({
				activePrompt: createActivePromptFixture(),
				answer: 'Test answer.',
				intakeState: createIntakeStateFixture(),
				now: '2026-01-01T00:00:00.000Z',
				question: createQuestionFixture(),
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(
					Array.isArray(result.evaluation.extractedFacts),
					`${mode}: extractedFacts should be array`,
				).toBe(true);
				expect(
					Array.isArray(result.evaluation.extractedAssumptions),
					`${mode}: extractedAssumptions should be array`,
				).toBe(true);
				expect(
					Array.isArray(result.evaluation.extractedDecisions),
					`${mode}: extractedDecisions should be array`,
				).toBe(true);
				expect(
					Array.isArray(result.evaluation.extractedRisks),
					`${mode}: extractedRisks should be array`,
				).toBe(true);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// 5. Successful results are JSON-serializable
// ---------------------------------------------------------------------------

describe('successful results are JSON-serializable', () => {
	it('deterministic evaluator result round-trips through JSON', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'A test answer for JSON round-trip.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		const json = JSON.stringify(result);
		const restored = JSON.parse(json) as typeof result;
		expect(restored.ok).toBe(result.ok);
		if (result.ok && restored.ok) {
			expect(restored.evaluation.status).toBe(result.evaluation.status);
			expect(restored.evaluation.completenessScore).toBe(
				result.evaluation.completenessScore,
			);
			expect(restored.evaluation.shouldAdvance).toBe(
				result.evaluation.shouldAdvance,
			);
		}
	});

	it('error result round-trips through JSON', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: '/logos-status',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		const json = JSON.stringify(result);
		const restored = JSON.parse(json) as typeof result;
		expect(restored.ok).toBe(false);
		expect(Array.isArray(restored.errors)).toBe(true);
	});

	it('fake evaluator results round-trip through JSON', async () => {
		const modes = [
			'sufficient',
			'partial',
			'insufficient',
			'contradictory',
			'needs_clarification',
			'invalid_output',
			'throws',
		] as const;

		for (const mode of modes) {
			const evaluator = createFakeAnswerEvaluator({ mode });
			const result = await evaluator.evaluateAnswer({
				activePrompt: createActivePromptFixture(),
				answer: 'Test answer.',
				intakeState: createIntakeStateFixture(),
				now: '2026-01-01T00:00:00.000Z',
				question: createQuestionFixture(),
			});
			const json = JSON.stringify(result);
			expect(typeof json, `${mode}: result should be JSON`).toBe('string');
			const restored = JSON.parse(json) as typeof result;
			expect(restored.ok, `${mode}: restored.ok should match`).toBe(result.ok);
		}
	});
});

// ---------------------------------------------------------------------------
// 6. Raw Error objects are not exposed as canonical evaluator output
// ---------------------------------------------------------------------------

describe('raw Error objects are not exposed', () => {
	it('throws mode returns structured errors array, not an Error', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'throws' });
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			// errors should be an array of strings
			for (const err of result.errors) {
				expect(typeof err).toBe('string');
				expect(err).not.toBeInstanceOf(Error);
			}
		}
	});

	it('command answer returns structured errors, not an Error', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: '/logos-stop',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			for (const err of result.errors) {
				expect(typeof err).toBe('string');
			}
		}
	});

	it('invalid_output mode returns structured errors, not Error', async () => {
		const evaluator = createFakeAnswerEvaluator({ mode: 'invalid_output' });
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Test answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			for (const err of result.errors) {
				expect(typeof err).toBe('string');
				expect(err).not.toBeInstanceOf(Error);
			}
		}
	});
});
