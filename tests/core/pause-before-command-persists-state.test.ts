/**
 * Step 5.3 — Pause-before-command persists state.
 *
 * Tests:
 * 1. Pause-before-command writes updated state to repository/filesystem.
 * 2. Reloading state shows mode: "paused".
 * 3. Reloading state shows same activeQuestionId.
 * 4. Reloading state shows same active prompt kind.
 * 5. Reloading state preserves follow-up metadata.
 * 6. Reloading state preserves contradiction metadata.
 * 7. Invalid active prompt blocks rather than corrupting state.
 */

import { describe, expect, it } from 'vitest';
import { createLogosCore } from '../../src/core/api.js';
import { handleIntakeCommand } from '../../src/core/intake/handle-intake-command.js';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';
import {
	getLogosIntakeStatePath,
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

describe('pause-before-command persists state', () => {
	it('writes updated state to filesystem', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const statePath = getLogosIntakeStatePath(PROJECT_ROOT);
		const before = await fs.fileExists({ path: statePath });
		expect(before).toBe(true);

		await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		const after = await fs.fileExists({ path: statePath });
		expect(after).toBe(true);
	});

	it('reloading state shows mode paused after logos-stop', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			now: NOW,
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
		}
	});

	it('reloading state shows same activeQuestionId after logos-status', async () => {
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
			command: 'logos-status',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
		}
	});

	it('reloading state shows same active prompt kind after logos-generate', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		await handleIntakeCommand({
			command: 'logos-generate',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activePrompt?.kind).toBe('question');
		}
	});

	it('preserves follow-up metadata through pause and reload', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		// Manually inject a follow-up prompt into state.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (!loadResult.ok) return;

		const state = loadResult.state;
		const q1Id = state.activeQuestionId;
		state.activePrompt = {
			followUpId: 'fu-1',
			kind: 'follow_up',
			questionId: q1Id ?? 'q1',
			startedAt: NOW,
			updatedAt: NOW,
		};
		state.activeQuestionId = q1Id ?? 'q1';

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		await handleIntakeCommand({
			command: 'logos-stop',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		const reloadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(reloadResult.ok).toBe(true);
		if (reloadResult.ok) {
			expect(reloadResult.state.activePrompt?.followUpId).toBe('fu-1');
			expect(reloadResult.state.mode).toBe('paused');
		}
	});

	it('preserves contradiction metadata through pause and reload', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		// Manually inject a contradiction prompt into state.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (!loadResult.ok) return;

		const state = loadResult.state;
		const q1Id = state.activeQuestionId;
		state.contradictions = {
			'c-1': {
				conflictsWithQuestionIds: ['q2'],
				createdAt: NOW,
				id: 'c-1',
				questionId: q1Id ?? 'q1',
				status: 'unresolved',
				summary: 'Test contradiction',
			},
		};
		state.activePrompt = {
			contradictionId: 'c-1',
			kind: 'contradiction_resolution',
			questionId: q1Id ?? 'q1',
			startedAt: NOW,
			updatedAt: NOW,
		};
		state.activeQuestionId = q1Id ?? 'q1';

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		await handleIntakeCommand({
			command: 'logos-status',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		const reloadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(reloadResult.ok).toBe(true);
		if (reloadResult.ok) {
			expect(reloadResult.state.activePrompt?.contradictionId).toBe('c-1');
			expect(reloadResult.state.mode).toBe('paused');
		}
	});

	it('blocks and does not corrupt state when active prompt is invalid', async () => {
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

		const commands = ['logos-stop', 'logos-status', 'logos-generate'] as const;

		for (const command of commands) {
			const result = await handleIntakeCommand({
				command,
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});

			expect(result.status, `${command} should block`).toBe('blocked');
			expect(
				result.blockers.some((b) => b.code === 'active_prompt_invalid'),
				`${command} should report active_prompt_invalid`,
			).toBe(true);
			expect(
				result.data?.stateChanged,
				`${command} should not change state`,
			).toBe(false);
			expect(result.data?.persisted, `${command} should not persist`).toBe(
				false,
			);
		}

		// State must remain intake_active and unchanged.
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
});
