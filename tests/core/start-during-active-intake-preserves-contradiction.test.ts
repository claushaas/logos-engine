/**
 * Step 5.2 — /logos-start during active intake preserves contradiction.
 *
 * Tests:
 * 1. Given intake mode is intake_active.
 * 2. Given active prompt is a contradiction resolution for Q1.
 * 3. Given contradictionId exists.
 * 4. When logos-start is handled.
 * 5. Then result disposition is reaffirm.
 * 6. Then message kind is contradiction.
 * 7. Then contradictionId is preserved.
 * 8. Then no new question is selected.
 */

import { describe, expect, it } from 'vitest';
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

describe('handleIntakeCommand — logos-start preserves contradiction', () => {
	it('re-emits contradiction resolution for Q1 with contradictionId preserved', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		// Initialize project so config exists.
		const { initProject } = await import('../../src/core/api.js');
		await initProject({ filesystem: fs, projectRoot: PROJECT_ROOT });

		// Use a known question id from the standard test profile.
		const q1Id = '01-foundation.01-thesis.core-thesis.q01';
		const contradictionId = 'contra-1';

		// Pre-populate intake state with an active contradiction prompt.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = q1Id;
		state.activePrompt = {
			contradictionId,
			kind: 'contradiction_resolution',
			questionId: q1Id,
			startedAt: NOW,
			updatedAt: NOW,
		};
		state.contradictions[contradictionId] = {
			conflictsWithQuestionIds: [q1Id],
			createdAt: NOW,
			id: contradictionId,
			questionId: q1Id,
			status: 'unresolved',
			summary: 'The thesis contradicts the stated problem scope.',
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		const result = await handleIntakeCommand({
			command: 'logos-start',
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.disposition).toBe('reaffirm');
		expect(result.message.kind).toBe('contradiction');
		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.preservedQuestionId).toBe(q1Id);

		// contradictionId must be preserved in the active prompt data.
		expect(result.data?.activePrompt?.contradictionId).toBe(contradictionId);

		// Message metadata should carry contradictionId.
		expect(result.message.metadata).toBeDefined();
		expect(result.message.metadata?.contradictionId).toBe(contradictionId);

		// State must not have changed.
		expect(result.data?.stateChanged).toBe(false);
		expect(result.data?.persisted).toBe(false);

		// Reload state and confirm no advance occurred.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
			expect(loadResult.state.activePrompt?.kind).toBe(
				'contradiction_resolution',
			);
			expect(loadResult.state.activePrompt?.contradictionId).toBe(
				contradictionId,
			);
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});

	it('blocks with active_prompt_invalid when contradiction record is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const { initProject } = await import('../../src/core/api.js');
		await initProject({ filesystem: fs, projectRoot: PROJECT_ROOT });

		const q1Id = '01-foundation.01-thesis.core-thesis.q01';

		// Pre-populate state with an active contradiction prompt but NO record.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = q1Id;
		state.activePrompt = {
			contradictionId: 'missing-contra',
			kind: 'contradiction_resolution',
			questionId: q1Id,
			startedAt: NOW,
			updatedAt: NOW,
		};
		// Deliberately do NOT add a contradiction record.

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
		expect(result.data?.activeQuestionId).toBe(q1Id);

		// State should remain unchanged.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('intake_active');
			expect(loadResult.state.activeQuestionId).toBe(q1Id);
		}
	});
});
