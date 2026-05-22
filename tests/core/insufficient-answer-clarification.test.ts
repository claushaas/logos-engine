/**
 * Step 4.4 — Insufficient answer returns clarification without advancing.
 *
 * Tests:
 * 1. Fake evaluator returns insufficient.
 * 2. State records non-advancing result.
 * 3. Active question remains Q1.
 * 4. Assistant message asks for clarification or follow-up.
 * 5. No next question is selected.
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

describe('handleIntakeMessage — insufficient answer does not advance', () => {
	it('insufficient answer is recorded and active question does not change', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		const evaluator = createFakeAnswerEvaluator({ mode: 'insufficient' });

		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message: 'I like pizza.',
			projectRoot: PROJECT_ROOT,
		});

		expect(msgResult.status).toBe('ok');
		expect(msgResult.data?.stateChanged).toBe(true);
		expect(msgResult.data?.transition).toBe('insufficient_answer');

		// Active question should still be Q1.
		expect(msgResult.data?.activeQuestionId).toBe(q1Id);

		// Assistant message should be follow_up or clarification.
		expect(msgResult.data?.assistantMessage).toBeDefined();
		expect(['follow_up', 'clarification']).toContain(
			msgResult.data?.assistantMessage?.kind,
		);

		// Verify persisted state.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const q1Answer = loadResult.state.answeredQuestions[q1Id as string];
			expect(q1Answer).toBeDefined();
			expect(q1Answer?.status).toBe('insufficient');

			// Active question should still be Q1.
			expect(loadResult.state.activeQuestionId).toBe(q1Id);

			// Mode should still be intake_active.
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});

	it('needs_clarification answer returns clarification message', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const evaluator = createFakeAnswerEvaluator({
			mode: 'needs_clarification',
		});

		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message: 'Ummm... maybe?',
			projectRoot: PROJECT_ROOT,
		});

		expect(msgResult.status).toBe('ok');
		expect(msgResult.data?.transition).toBe('clarification_requested');
		expect(msgResult.data?.stateChanged).toBe(true);
	});

	it('insufficient answer does not advance even after multiple attempts', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;

		const evaluator = createFakeAnswerEvaluator({ mode: 'insufficient' });

		// First insufficient attempt.
		await core.handleIntakeMessage({
			evaluator,
			message: 'Nope.',
			projectRoot: PROJECT_ROOT,
		});

		// Second insufficient attempt.
		const msg2 = await core.handleIntakeMessage({
			evaluator,
			message: 'Still no.',
			projectRoot: PROJECT_ROOT,
		});

		// Still on Q1.
		expect(msg2.data?.activeQuestionId).toBe(q1Id);
		expect(msg2.data?.transition).toBe('insufficient_answer');
	});
});
