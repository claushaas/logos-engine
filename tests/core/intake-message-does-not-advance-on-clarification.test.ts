/**
 * Step 8.4 — Intake message does not advance on clarification.
 *
 * Explicitly tests that when Q1 is active and the user asks for
 * clarification, Q1 remains active, Q2 is not selected, no sufficient
 * answer is recorded, and state remains effectively unchanged.
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

describe('handleIntakeMessage — does not advance on clarification', () => {
	it('Q1 active → clarification → Q1 remains active', async () => {
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

		// Ask for clarification.
		const clarifyResult = await core.handleIntakeMessage({
			message: 'o que você quer dizer?',
			projectRoot: PROJECT_ROOT,
		});

		expect(clarifyResult.status).toBe('ok');
		expect(clarifyResult.data?.activeQuestionId).toBe(q1Id);
		expect(clarifyResult.data?.stateChanged).toBe(false);
		expect(clarifyResult.data?.transition).toBe('clarification_requested');
	});

	it('Q2 is not selected after clarification', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});

		const stateResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateResult.ok).toBe(true);
		if (stateResult.ok) {
			expect(stateResult.state.activeQuestionId).toBe(q1Id);
			expect(stateResult.state.mode).toBe('intake_active');
			// No next question selected.
			expect(stateResult.state.activePrompt?.questionId).toBe(q1Id);
		}
	});

	it('no sufficient answer is recorded after clarification', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await core.handleIntakeMessage({
			message: 'can you clarify?',
			projectRoot: PROJECT_ROOT,
		});

		const stateResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateResult.ok).toBe(true);
		if (stateResult.ok) {
			// No answered questions at all.
			expect(Object.keys(stateResult.state.answeredQuestions).length).toBe(0);
			// Progress should be all zeros.
			expect(stateResult.state.progress.sufficient).toBe(0);
			expect(stateResult.state.progress.partial).toBe(0);
		}
	});

	it('after clarification, a normal answer still advances correctly', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		// Step 1: Clarification.
		await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});

		// Step 2: Real answer.
		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });
		const answerResult = await core.handleIntakeMessage({
			evaluator,
			message: 'My thesis is about durable local truth.',
			projectRoot: PROJECT_ROOT,
		});

		expect(answerResult.status).toBe('ok');
		expect(answerResult.data?.transition).toBe('answer_accepted');
		expect(answerResult.data?.stateChanged).toBe(true);

		// Q1 should now be answered as sufficient.
		const stateResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateResult.ok).toBe(true);
		if (stateResult.ok) {
			expect(stateResult.state.answeredQuestions[q1Id as string]?.status).toBe(
				'sufficient',
			);
		}
	});

	it('state updatedAt does not change after clarification (no mutation)', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const preLoad = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(preLoad.ok).toBe(true);
		const preUpdatedAt = preLoad.ok ? preLoad.state.updatedAt : undefined;

		await core.handleIntakeMessage({
			message: 'explique melhor',
			projectRoot: PROJECT_ROOT,
		});

		const postLoad = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(postLoad.ok).toBe(true);
		if (postLoad.ok && preUpdatedAt) {
			// updatedAt should be unchanged (no mutation).
			expect(postLoad.state.updatedAt).toBe(preUpdatedAt);
		}
	});

	it('multiple clarification requests preserve Q1', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		for (let i = 0; i < 3; i++) {
			const r = await core.handleIntakeMessage({
				message: 'what do you mean?',
				projectRoot: PROJECT_ROOT,
			});
			expect(r.data?.activeQuestionId).toBe(q1Id);
			expect(r.data?.stateChanged).toBe(false);
		}
	});
});
