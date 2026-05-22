/**
 * Step 8.4 — Intake clarification intent integration tests.
 *
 * Tests that clarification requests during active intake:
 * 1. Route to the clarification intent via handleIntakeMessage.
 * 2. Do not call the answer evaluator.
 * 3. Return message.kind: "clarification".
 * 4. Preserve the active question id.
 * 5. Do not advance to the next question.
 * 6. Do not persist an answer record.
 * 7. Include a re-ask / explanation of the current question.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
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

describe('handleIntakeMessage — clarification intent', () => {
	it('clarification phrase routes to clarification intent', async () => {
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

		const result = await core.handleIntakeMessage({
			message: 'o que você quer dizer?',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.transition).toBe('clarification_requested');
		expect(result.data?.stateChanged).toBe(false);
	});

	it('handleIntakeMessage does not call evaluator for clarification', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await core.handleIntakeMessage({
			message: 'não entendi',
			projectRoot: PROJECT_ROOT,
		});

		// No evaluationResult should be present.
		expect(result.data?.evaluationResult).toBeUndefined();
	});

	it('returns message.kind: "clarification"', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.message.kind).toBe('clarification');
		expect(result.data?.assistantMessage?.kind).toBe('clarification');
	});

	it('preserves activeQuestionId after clarification', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		const result = await core.handleIntakeMessage({
			message: 'can you clarify?',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.activeQuestionId).toBe(q1Id);
	});

	it('does not advance to next question', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Send clarification.
		await core.handleIntakeMessage({
			message: 'explique melhor',
			projectRoot: PROJECT_ROOT,
		});

		// Active question should still be Q1.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});

	it('does not persist an answer record', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const answeredIds = Object.keys(loadResult.state.answeredQuestions);
			// No new answers should have been added (initial state has none).
			expect(answeredIds.length).toBe(0);
		}
	});

	it('includes the current question in the clarification message', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await core.handleIntakeMessage({
			message: 'o que você quer dizer?',
			projectRoot: PROJECT_ROOT,
		});

		// The clarification message should contain "Original question:"
		expect(result.message.body).toContain('Original question:');
		// And it should contain re-ask guidance.
		expect(result.message.body).toContain('Please answer the active question');
	});

	it('clarification in Portuguese also returns the proper message', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await core.handleIntakeMessage({
			message: 'não entendi',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.transition).toBe('clarification_requested');
		expect(result.message.kind).toBe('clarification');
	});

	it('multiple clarification requests do not advance or mutate state', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		// First clarification.
		await core.handleIntakeMessage({
			message: 'what do you mean?',
			projectRoot: PROJECT_ROOT,
		});

		// Second clarification.
		const r2 = await core.handleIntakeMessage({
			message: 'can you clarify?',
			projectRoot: PROJECT_ROOT,
		});

		expect(r2.data?.activeQuestionId).toBe(q1Id);
		expect(r2.data?.stateChanged).toBe(false);

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			// No answers recorded.
			expect(Object.keys(loadResult.state.answeredQuestions).length).toBe(0);
		}
	});

	it('stateChanged is false for clarification', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await core.handleIntakeMessage({
			message: 'explain',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.stateChanged).toBe(false);
	});
});
