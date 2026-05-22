/**
 * Step 5.4 — /logos-init during active intake block or confirmation.
 *
 * Tests:
 * 1. Given intake mode is intake_active and active prompt points to Q1.
 * 2. When handleIntakeCommand({ command: "logos-init" }) runs.
 * 3. Then result disposition is confirm_required.
 * 4. Then mode remains intake_active.
 * 5. Then activeQuestionId remains Q1.
 * 6. Then activePrompt remains Q1.
 * 7. Then stateChanged is false.
 * 8. Then persisted is false.
 * 9. Then no config/state reset occurs.
 * 10. Invalid active prompt blocks rather than confirming or initializing.
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

describe('handleIntakeCommand — logos-init during active intake', () => {
	it('returns confirm_required and preserves Q1', async () => {
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
			command: 'logos-init',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('confirmation_required');
		expect(result.data?.disposition).toBe('confirm_required');
		expect(result.data?.mode).toBe('intake_active');
		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.preservedQuestionId).toBe(q1Id);
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);
		expect(result.data?.activePrompt).toBeDefined();
		expect(result.data?.activePrompt?.questionId).toBe(q1Id);
		expect(result.message.kind).toBe('confirmation_request');
		expect(result.message.body).toContain(
			'Initialization cannot run silently while LOGOS intake is active',
		);
	});

	it('does not reset intake state on logos-init', async () => {
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
			command: 'logos-init',
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
			expect(loadResult.state.mode).toBe('intake_active');
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
		}
	});

	it('does not create answer or evaluation records on logos-init', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-init',
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

	it('does not overwrite config on logos-init during active intake', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		// Capture config before.
		const { loadLogosConfig } = await import(
			'../../src/core/config/load-config.js'
		);
		const beforeResult = await loadLogosConfig({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(beforeResult.ok).toBe(true);
		const beforeUpdatedAt = beforeResult.ok
			? beforeResult.config.updatedAt
			: '';

		await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		// Config should be unchanged.
		const afterResult = await loadLogosConfig({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(afterResult.ok).toBe(true);
		if (afterResult.ok) {
			expect(afterResult.config.updatedAt).toBe(beforeUpdatedAt);
		}
	});

	it('blocks with active_intake_state_inconsistent when active prompt is missing', async () => {
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
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.disposition).toBe('block');
		expect(
			result.blockers.some(
				(b) => b.code === 'active_intake_state_inconsistent',
			),
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
			expect(loadResult.state.activeQuestionId).toBeUndefined();
			expect(loadResult.state.activePrompt).toBeUndefined();
		}
	});

	it('blocks with active_intake_state_inconsistent when active prompt references missing question', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

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
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.disposition).toBe('block');
		expect(
			result.blockers.some(
				(b) => b.code === 'active_intake_state_inconsistent',
			),
		).toBe(true);
	});

	it('includes warning about active intake in confirm_required result', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('confirmation_required');
		expect(
			result.warnings.some((w) => w.code === 'init_during_active_intake'),
		).toBe(true);
	});

	it('message metadata includes active prompt details', async () => {
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
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.message.metadata).toBeDefined();
		expect(result.message.metadata?.command).toBe('logos-init');
		expect(result.message.metadata?.disposition).toBe('confirm_required');
		expect(result.message.metadata?.activeQuestionId).toBe(q1Id);
		expect(result.message.metadata?.preservedQuestionId).toBe(q1Id);
		expect(result.message.metadata?.activePromptKind).toBe('question');
	});
});

describe('handleIntakeCommand — logos-init when intake is not active', () => {
	it('returns execute disposition when intake is idle', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('execute');
		expect(result.data?.mode).toBe('idle');
	});

	it('returns execute disposition when intake is paused', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });
		await core.stopIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const result = await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('execute');
		expect(result.data?.mode).toBe('paused');
	});
});
