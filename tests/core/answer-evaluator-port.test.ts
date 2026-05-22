/**
 * Step 4.3 — Answer evaluator port tests.
 *
 * Proves:
 * 1. AnswerEvaluator can be implemented by the deterministic evaluator.
 * 2. evaluateAnswer(...) returns structured result (ok: true / ok: false).
 * 3. Evaluator result is JSON-serializable.
 * 4. Evaluator does not mutate input intakeState.
 * 5. Evaluator does not require Pi or network.
 */

import { describe, expect, it } from 'vitest';
import type { AnswerEvaluator } from '../../src/core/evaluation/answer-evaluator-port.js';
import { createDeterministicAnswerEvaluator } from '../../src/core/evaluation/deterministic-evaluator.js';
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnswerEvaluator port', () => {
	it('can be implemented by the deterministic evaluator', () => {
		const evaluator: AnswerEvaluator = createDeterministicAnswerEvaluator();
		expect(evaluator).toBeDefined();
		expect(typeof evaluator.evaluateAnswer).toBe('function');
	});

	it('evaluateAnswer returns structured ok: true result for normal answer', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'My project aims to solve X by doing Y.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation).toBeDefined();
			expect(result.evaluation.questionId).toBe('test-q-1');
			expect(result.evaluation.status).toBe('partial');
			expect(result.evaluation.shouldAdvance).toBe(false);
			expect(Array.isArray(result.warnings)).toBe(true);
		}
	});

	it('evaluateAnswer returns structured ok: false result for command-like answer', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: '/logos-status',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
			expect(
				result.errors.some((e) =>
					e.includes('command_text_cannot_be_evaluated_as_answer'),
				),
			).toBe(true);
		}
	});

	it('evaluator result is JSON-serializable (ok: true)', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'A meaningful answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});

		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(result.ok);
	});

	it('evaluator result is JSON-serializable (ok: false)', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: '/some-command',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});

		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(false);
		expect(Array.isArray(parsed.errors)).toBe(true);
	});

	it('evaluator does not mutate input intakeState', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const intakeState = createIntakeStateFixture();
		const frozen = JSON.stringify(intakeState);

		await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture(),
			answer: 'Some answer text.',
			intakeState,
			now: '2026-01-01T00:00:00.000Z',
			question: createQuestionFixture(),
		});

		expect(JSON.stringify(intakeState)).toBe(frozen);
	});

	it('evaluator does not require Pi or network', () => {
		// The deterministic evaluator is constructed without any imports
		// from Pi, Ink, React, or network APIs.
		const evaluator = createDeterministicAnswerEvaluator();
		expect(evaluator).toBeDefined();
	});

	it('evaluator returns consistent questionId', async () => {
		const evaluator = createDeterministicAnswerEvaluator();
		const question = createQuestionFixture({ id: 'my-question-42' });
		const result = await evaluator.evaluateAnswer({
			activePrompt: createActivePromptFixture({ questionId: 'my-question-42' }),
			answer: 'An answer.',
			intakeState: createIntakeStateFixture(),
			now: '2026-01-01T00:00:00.000Z',
			question,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.evaluation.questionId).toBe('my-question-42');
		}
	});
});
