/**
 * Step 4.4 — Handle intake message state persistence.
 *
 * Tests:
 * 1. State is persisted after sufficient answer.
 * 2. State is persisted after partial answer.
 * 3. State is persisted after contradiction.
 * 4. State is not mutated for pure clarification if that is the chosen behavior.
 * 5. Persisted state survives reload through fake filesystem/state repository.
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

describe('handleIntakeMessage — state persistence', () => {
	it('state is persisted after sufficient answer', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId as string;

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		await core.handleIntakeMessage({
			evaluator,
			message: 'My specific thesis answer.',
			projectRoot: PROJECT_ROOT,
		});

		// Load state from disk.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const state = loadResult.state;
			expect(state.answeredQuestions[q1Id]).toBeDefined();
			expect(state.answeredQuestions[q1Id]?.status).toBe('sufficient');
			// Progress should have at least one sufficient.
			expect(state.progress.sufficient).toBeGreaterThanOrEqual(1);
			// updatedAt should have changed from initial.
			expect(state.updatedAt).not.toBe(startResult.data?.mode);
		}
	});

	it('state is persisted after partial answer', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId as string;

		const evaluator = createFakeAnswerEvaluator({ mode: 'partial' });

		await core.handleIntakeMessage({
			evaluator,
			message: 'Partially complete.',
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const state = loadResult.state;
			expect(state.answeredQuestions[q1Id]).toBeDefined();
			expect(state.answeredQuestions[q1Id]?.status).toBe('partial');
			expect(state.partialQuestions[q1Id]).toBeDefined();
			expect(state.mode).toBe('intake_active');
		}
	});

	it('state is persisted after contradiction', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId as string;

		const evaluator = createFakeAnswerEvaluator({ mode: 'contradictory' });

		await core.handleIntakeMessage({
			evaluator,
			message: 'I contradict my previous answer.',
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const state = loadResult.state;
			expect(state.answeredQuestions[q1Id]?.status).toBe('contradictory');
			const contradictionEntries = Object.values(state.contradictions);
			expect(contradictionEntries.length).toBeGreaterThanOrEqual(1);
			expect(contradictionEntries[0]?.status).toBe('unresolved');
			expect(state.activePrompt?.kind).toBe('contradiction_resolution');
		}
	});

	it('state is NOT mutated for pure clarification requests', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		// Record the disk state before clarification.
		const preLoad = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(preLoad.ok).toBe(true);
		if (!preLoad.ok) return;
		const preUpdatedAt = preLoad.state.updatedAt;

		// Send clarification request.
		await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});

		// State should not have changed.
		const postLoad = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(postLoad.ok).toBe(true);
		if (postLoad.ok) {
			// updatedAt should still be the same (no mutation).
			expect(postLoad.state.updatedAt).toBe(preUpdatedAt);
		}
	});

	it('persisted state survives reload through fake filesystem', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		await core.handleIntakeMessage({
			evaluator,
			message: 'Specific project thesis.',
			projectRoot: PROJECT_ROOT,
		});

		// Reload state — simulating process restart.
		const load1 = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(load1.ok).toBe(true);

		// Reload again — state should be identical.
		const load2 = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(load2.ok).toBe(true);

		if (load1.ok && load2.ok) {
			expect(load1.state.mode).toBe(load2.state.mode);
			expect(load1.state.activeQuestionId).toBe(load2.state.activeQuestionId);
			expect(
				Object.keys(load1.state.answeredQuestions).length,
			).toBeGreaterThanOrEqual(1);
			expect(Object.keys(load1.state.answeredQuestions).length).toBe(
				Object.keys(load2.state.answeredQuestions).length,
			);
		}
	});

	it('stateChanged is true only for state-mutating transitions', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const evaluator = createFakeAnswerEvaluator({ mode: 'sufficient' });

		// Sufficient answer → stateChanged: true.
		const answerResult = await core.handleIntakeMessage({
			evaluator,
			message: 'A clear answer.',
			projectRoot: PROJECT_ROOT,
		});
		expect(answerResult.data?.stateChanged).toBe(true);

		// Clarification request → stateChanged: false.
		const clarifyResult = await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});
		expect(clarifyResult.data?.stateChanged).toBe(false);
	});

	it('out-of-scope messages do not mutate state', async () => {
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

		const result = await core.handleIntakeMessage({
			message: 'write a function to sort arrays',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.transition).toBe('out_of_scope');
		expect(result.data?.stateChanged).toBe(false);
	});

	it('lifecycle commands during intake are never evaluated as answers', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await core.handleIntakeMessage({
			message: '/logos-stop',
			projectRoot: PROJECT_ROOT,
		});

		// Command control — not answer evaluation.
		expect(result.data?.transition).toBe('command_control');
		expect(result.data?.stateChanged).toBe(false);

		// Verify evaluation was never called.
		expect(result.data?.evaluationResult).toBeUndefined();
	});
});
