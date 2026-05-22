/**
 * Step 4.4 — Sufficient answer advances to next prompt automatically.
 *
 * Tests:
 * 1. Given active prompt Q1 and fake evaluator returns sufficient.
 * 2. When handleIntakeMessage receives a normal answer.
 * 3. Then Q1 answer/evaluation is persisted as sufficient.
 * 4. Then next prompt Q2 is selected.
 * 5. Then activeQuestionId becomes Q2.
 * 6. Then result assistant message asks Q2.
 * 7. Then no /logos-next is required.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { createFakeAnswerEvaluator } from '../../src/core/evaluation/fake-answer-evaluator.js';
import { loadIntakeState } from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00.000Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIntakeMessage — sufficient answer advances automatically', () => {
	it('sufficient answer advances to next prompt without /logos-next', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		// Init and start intake.
		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Create a fake evaluator that returns sufficient.
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		// Send a natural-language answer.
		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message:
				'This is my clear and specific thesis: LOGOS bridges the gap between intent and documentation.',
			projectRoot: PROJECT_ROOT,
		});

		// Assertions
		expect(msgResult.status).toBe('ok');
		expect(msgResult.data?.stateChanged).toBe(true);
		expect(msgResult.data?.transition).toBe('answer_accepted');

		// Next question should be different from Q1.
		expect(msgResult.data?.activeQuestionId).toBeDefined();
		expect(msgResult.data?.activeQuestionId).not.toBe(q1Id);

		// Assistant message should be present.
		expect(msgResult.data?.assistantMessage).toBeDefined();
		expect(msgResult.data?.assistantMessage?.body.length).toBeGreaterThan(0);

		// State should be persisted.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			// Q1 should have a sufficient answer.
			const q1Record = loadResult.state.answeredQuestions[q1Id as string];
			expect(q1Record).toBeDefined();
			expect(q1Record?.status).toBe('sufficient');

			// Mode should still be intake_active.
			expect(loadResult.state.mode).toBe('intake_active');

			// Active question should match the returned next question.
			expect(loadResult.state.activeQuestionId).toBe(
				msgResult.data?.activeQuestionId,
			);
		}
	});

	it('sufficient answer for last question completes intake', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Start intake to get the registry loaded.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		// Manually mark all but the last question as sufficient in persisted state.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (!loadResult.ok) return;

		const state = loadResult.state;

		// Load the intake state from disk again to get access to the state repo.
		// We'll pre-fill all but one question as sufficient.
		const _questionIds = Object.keys(
			// Registry is internal, so we just start fresh for each test.
			// Instead, let's test that a full intake that covers all questions
			// returns complete status.
			// We'll use a simplified approach: directly use the state to
			// set up answered questions.
			state.answeredQuestions,
		);

		// For this test, we restart intake with a new state where all questions
		// except the last are already answered.  Since we can't easily pre-fill
		// the registry, we test the handleIntakeMessage path — when the
		// selector returns "complete" after all questions are answered.

		// Simpler: use the transition result directly.
		// For a proper integration test, we answer each question in sequence
		// until the selector returns complete.

		// This is an integration-level test. We answer questions one by one
		// using a fresh setup and sufficient evaluator.
		// Since the profile fixture generates 8 questions, we'll loop.
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		const fs2 = createFakeFilesystem();
		fs2.addStandardProfile();
		const core2 = createLogosCore({ filesystem: fs2 });

		await core2.initProject({ projectRoot: PROJECT_ROOT });
		const sr = await core2.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(sr.status).toBe('ok');

		// Answer questions until complete (max 20 iterations to prevent infinite).
		let lastResult = sr;
		for (let i = 0; i < 20; i++) {
			const mr = await core2.handleIntakeMessage({
				evaluator,
				message: `My detailed answer for question ${i + 1}.`,
				projectRoot: PROJECT_ROOT,
			});

			lastResult = mr;

			if (mr.status === 'ok' && mr.data?.transition === 'complete') {
				break;
			}
			if (mr.status !== 'ok') break;
		}

		// Eventually it should complete.
		expect(lastResult.data?.mode).toBe('complete');
		const finalLoad = await loadIntakeState({
			filesystem: fs2,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(finalLoad.ok).toBe(true);
		if (finalLoad.ok) {
			expect(finalLoad.state.mode).toBe('complete');
		}
	});
});
