/**
 * Step 5.2 — /logos-start during active intake (question reaffirm).
 *
 * Tests:
 * 1. Given intake mode is intake_active and active prompt points to Q1.
 * 2. When handleIntakeCommand({ command: "logos-start" }) runs.
 * 3. Then result disposition is reaffirm.
 * 4. Then assistant message re-emits Q1 with full text.
 * 5. Then activeQuestionId remains Q1.
 * 6. Then Q2 is not selected.
 * 7. Then stateChanged is false and persisted is false.
 * 8. Then no answer/evaluation record is created.
 * 9. Invalid active prompt blocks instead of advancing.
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

describe('handleIntakeCommand — logos-start during active intake (question)', () => {
	it('reaffirms Q1 with full question text', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Start intake — selects Q1.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const q1Id = startResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();
		const q1Text = startResult.data?.activePrompt?.text;
		expect(q1Text).toBeDefined();

		// Call handleIntakeCommand with logos-start while active.
		const result = await handleIntakeCommand({
			command: 'logos-start',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('reaffirm');
		expect(result.data?.mode).toBe('intake_active');
		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.preservedQuestionId).toBe(q1Id);
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);

		// Message should re-emit the actual question text, not a placeholder.
		expect(result.message.kind).toBe('question');
		expect(result.message.body).toBe(q1Text);
		expect(result.message.body).not.toContain('Active intake question:');
	});

	it('does not advance to Q2 on reaffirm', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		const result = await handleIntakeCommand({
			command: 'logos-start',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.activePrompt?.questionId).toBe(q1Id);

		// Load state and confirm Q1 is still active.
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

	it('does not create answer or evaluation records on reaffirm', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-start',
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

	it('blocks with active_prompt_invalid when active prompt references missing question', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Pre-populate state with an active prompt for a missing question.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = 'missing-question-id';
		state.activePrompt = {
			kind: 'question',
			questionId: 'missing-question-id',
			startedAt: NOW,
			updatedAt: NOW,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		const result = await handleIntakeCommand({
			command: 'logos-start',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.disposition).toBe('block');
		expect(
			result.blockers.some((b) => b.code === 'active_prompt_invalid'),
		).toBe(true);
		expect(result.data?.activeQuestionId).toBe('missing-question-id');

		// State should remain unchanged (no advance, no mutation).
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('intake_active');
			expect(loadResult.state.activeQuestionId).toBe('missing-question-id');
		}
	});

	it('blocks with active_prompt_invalid when active prompt exists but is absent', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// State is active but has no activePrompt record.
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
			command: 'logos-start',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.disposition).toBe('block');
		expect(
			result.blockers.some((b) => b.code === 'active_prompt_invalid'),
		).toBe(true);
	});
});

describe('startIntake — logos-start during active intake (question via public API)', () => {
	it('re-emits Q1 when already active instead of advancing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result1 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(result1.status).toBe('ok');
		const q1Id = result1.data?.activeQuestionId;

		// startIntake while already active should re-emit Q1.
		const result2 = await core.startIntake({
			now: '2026-05-22T01:00:00Z',
			projectRoot: PROJECT_ROOT,
		});

		expect(result2.status).toBe('ok');
		expect(result2.data?.mode).toBe('intake_active');
		expect(result2.data?.activeQuestionId).toBe(q1Id);
		expect(result2.data?.activePrompt?.text).toBe(
			result1.data?.activePrompt?.text,
		);
	});
});
