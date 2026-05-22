/**
 * Step 5.2 — /logos-start during active intake preserves follow-up.
 *
 * Tests:
 * 1. Given intake mode is intake_active.
 * 2. Given active prompt is a follow-up for Q1.
 * 3. When logos-start is handled.
 * 4. Then result disposition is reaffirm.
 * 5. Then message kind is follow_up.
 * 6. Then followUpId is preserved.
 * 7. Then activeQuestionId remains Q1.
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

describe('handleIntakeCommand — logos-start preserves follow-up', () => {
	it('re-emits follow-up for Q1 with followUpId preserved', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		// Initialize project so config exists.
		const { initProject } = await import('../../src/core/api.js');
		await initProject({ filesystem: fs, projectRoot: PROJECT_ROOT });

		// Use a known question id from the standard test profile.
		const q1Id = '01-foundation.01-thesis.core-thesis.q01';

		// Pre-populate intake state with an active follow-up prompt.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = q1Id;
		state.activePrompt = {
			followUpId: 'fu-1',
			kind: 'follow_up',
			questionId: q1Id,
			startedAt: NOW,
			updatedAt: NOW,
		};
		state.partialQuestions[q1Id] = {
			missingAspects: ['specific example', 'trade-off'],
			questionId: q1Id,
			recordedAt: NOW,
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
		expect(result.message.kind).toBe('follow_up');
		expect(result.data?.activeQuestionId).toBe(q1Id);
		expect(result.data?.preservedQuestionId).toBe(q1Id);

		// followUpId must be preserved in the active prompt data.
		expect(result.data?.activePrompt?.followUpId).toBe('fu-1');

		// Message metadata should carry followUpId.
		expect(result.message.metadata).toBeDefined();
		expect(result.message.metadata?.followUpId).toBe('fu-1');

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
			expect(loadResult.state.activePrompt?.kind).toBe('follow_up');
			expect(loadResult.state.activePrompt?.followUpId).toBe('fu-1');
			expect(loadResult.state.mode).toBe('intake_active');
		}
	});
});
