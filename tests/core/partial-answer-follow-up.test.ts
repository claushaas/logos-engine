/**
 * Step 4.4 — Partial answer triggers targeted follow-up.
 *
 * Tests:
 * 1. Fake evaluator returns partial.
 * 2. Partial answer is persisted.
 * 3. Missing aspects are persisted.
 * 4. Active prompt remains the same question as follow-up.
 * 5. Assistant message is follow_up.
 * 6. Selector does not advance to Q2.
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

describe('handleIntakeMessage — partial answer triggers follow-up', () => {
	it('partial answer is persisted and does not advance', async () => {
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

		const evaluator = createFakeAnswerEvaluator({ mode: 'partial' });

		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message: 'My project is a documentation tool. (partial answer)',
			projectRoot: PROJECT_ROOT,
		});

		expect(msgResult.status).toBe('ok');
		expect(msgResult.data?.stateChanged).toBe(true);
		expect(msgResult.data?.transition).toBe('follow_up_requested');

		// Active question should still be Q1.
		expect(msgResult.data?.activeQuestionId).toBe(q1Id);

		// Assistant message should be follow_up kind.
		expect(msgResult.data?.assistantMessage).toBeDefined();
		expect(msgResult.data?.assistantMessage?.kind).toBe('follow_up');
		expect(msgResult.data?.assistantMessage?.body.length).toBeGreaterThan(0);

		// State should be persisted with partial record.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			// Q1 should have a partial answer record.
			const q1Answer = loadResult.state.answeredQuestions[q1Id as string];
			expect(q1Answer).toBeDefined();
			expect(q1Answer?.status).toBe('partial');

			// Partial record should exist with missing aspects.
			const partialRec = loadResult.state.partialQuestions[q1Id as string];
			expect(partialRec).toBeDefined();
			expect(partialRec?.missingAspects.length).toBeGreaterThan(0);

			// Active prompt should still be on Q1.
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
			expect(loadResult.state.activePrompt?.kind).toBe('follow_up');

			// Mode should still be intake_active.
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});

	it('partial answer with suggested follow-up uses that text', async () => {
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
			evaluation: {
				suggestedFollowUp:
					'Could you also provide information about budget and timeline?',
			},
			mode: 'partial',
		});

		const msgResult = await core.handleIntakeMessage({
			evaluator,
			message: 'Partially complete answer.',
			projectRoot: PROJECT_ROOT,
		});

		expect(msgResult.status).toBe('ok');
		expect(msgResult.data?.assistantMessage).toBeDefined();
		// The assistant message should contain the suggested follow-up text.
		expect(msgResult.data?.assistantMessage?.body).toContain('budget');
	});
});
