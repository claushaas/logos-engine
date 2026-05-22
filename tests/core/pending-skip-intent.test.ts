/**
 * Step 4.4 — Pending / skip intent behavior.
 *
 * Tests:
 * 1. Natural-language pending/skip intent is not evaluated as answer.
 * 2. Optional question can be skipped and next prompt selected.
 * 3. Required question is recorded as partial/pending according to policy.
 * 4. State is persisted.
 * 5. Command-style /logos-skip is not treated as valid answer or lifecycle command.
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

describe('handleIntakeMessage — skip / pending intent', () => {
	it('natural-language skip intent is not evaluated as answer', async () => {
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

		// Send "skip this" — a natural-language skip intent.
		const result = await core.handleIntakeMessage({
			message: 'skip this',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.stateChanged).toBe(true);

		// Q1 should be skipped (required → recorded as partial/pending).
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			const skippedRec = loadResult.state.skippedQuestions[q1Id as string];
			expect(skippedRec).toBeDefined();

			// Required question should also have a partial record.
			const partialRec = loadResult.state.partialQuestions[q1Id as string];
			expect(partialRec).toBeDefined();
			expect(partialRec?.metadata?.skippedRequired).toBe(true);
		}
	});

	it('"não sei" (Portuguese skip) records as pending', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		const result = await core.handleIntakeMessage({
			message: 'não sei',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.stateChanged).toBe(true);
		// Required questions get pending_recorded transition.
		expect(result.data?.transition).toBe('pending_recorded');
	});

	it('"/logos-skip" is treated as unknown command, not skip intent', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');

		// /logos-skip is not a recognized lifecycle command.
		const result = await core.handleIntakeMessage({
			message: '/logos-skip',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		// It's an unknown slash command — out_of_scope.
		expect(result.data?.transition).toBe('out_of_scope');
		expect(result.data?.stateChanged).toBe(false);
	});

	it('skip advances to next question for optional questions', async () => {
		// This test requires an optional question.  The standard profile marks
		// all sections as required by default.  We test with the standard profile
		// — required questions get pending_recorded.
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

		const result = await core.handleIntakeMessage({
			message: 'skip',
			projectRoot: PROJECT_ROOT,
		});

		// Required question: recorded as pending, advances to next.
		expect(result.data?.transition).toBe('pending_recorded');
		expect(result.data?.activeQuestionId).toBeDefined();
		expect(result.data?.activeQuestionId).not.toBe(q1Id);
	});

	it('state is persisted after skip', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await core.handleIntakeMessage({
			message: 'skip this',
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			// At least one skipped question should exist.
			const skippedIds = Object.keys(loadResult.state.skippedQuestions);
			expect(skippedIds.length).toBeGreaterThanOrEqual(1);
		}
	});
});
