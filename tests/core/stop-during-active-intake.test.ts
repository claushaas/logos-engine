/**
 * Step 5.3 — /logos-stop during active intake.
 *
 * Tests:
 * 1. Given intake mode is intake_active and active prompt points to Q1.
 * 2. When handleIntakeCommand({ command: "logos-stop" }) runs.
 * 3. Then result disposition is pause_and_execute.
 * 4. Then mode becomes paused.
 * 5. Then activeQuestionId remains Q1.
 * 6. Then activePrompt remains Q1.
 * 7. Then stateChanged is true.
 * 8. Then persisted is true.
 * 9. Then no answer/evaluation record is created.
 * 10. Invalid active prompt blocks rather than corrupting state.
 */

import { describe, expect, it } from 'vitest';
import { createLogosCore } from '../../src/core/api.js';
import { handleIntakeCommand } from '../../src/core/intake/handle-intake-command.js';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIntakeCommand — logos-stop during active intake', () => {
	it('pauses intake and preserves Q1', async () => {
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

		const result = await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('pause_and_execute');
		expect(result.data?.mode).toBe('paused');
		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.preservedQuestionId).toBe(q1Id);
		expect(result.data?.stateChanged).toBe(true);
		expect(result.data?.persisted).toBe(true);
		expect(result.data?.activePrompt).toBeDefined();
		expect(result.data?.activePrompt?.questionId).toBe(q1Id);
		expect(result.message.kind).toBe('status');
	});

	it('does not advance to Q2 on stop', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('paused');
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
			// Q2 must not be selected.
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
		}
	});

	it('does not create answer or evaluation records on stop', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(Object.keys(loadResult.state.answeredQuestions)).toHaveLength(0);
			expect(Object.keys(loadResult.state.partialQuestions)).toHaveLength(0);
			expect(Object.keys(loadResult.state.contradictions)).toHaveLength(0);
		}
	});

	it('blocks with active_prompt_invalid when active prompt is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = undefined;
		state.activePrompt = undefined;

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		const result = await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.disposition).toBe('block');
		expect(
			result.blockers.some((b) => b.code === 'active_prompt_invalid'),
		).toBe(true);
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);

		// State should remain unchanged.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});

	it('includes progress in the stop message', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.message.body).toContain('Intake paused');
	});
});

describe('stopIntake — logos-stop during active intake (via public API)', () => {
	it('pauses and preserves Q1 through public API', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		const stopResult = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(stopResult.status).toBe('ok');
		expect(stopResult.data?.mode).toBe('paused');
		expect(stopResult.data?.activeQuestionId).toBe(q1Id);
	});
});
