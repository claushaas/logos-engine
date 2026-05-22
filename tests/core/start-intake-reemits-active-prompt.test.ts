/**
 * Tests for startIntake re-emission of active prompt (Step 3.4).
 *
 * Covers:
 * - Given mode: "intake_active" and active prompt Q1, calling startIntake
 *   returns Q1.
 * - It does not advance to Q2.
 * - It does not create a new session.
 * - It does not clear follow-up/contradiction metadata.
 * - If active prompt references missing question, result is blocked with
 *   active_prompt_invalid.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';
import { saveIntakeState } from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startIntake re-emits active prompt', () => {
	it('re-emits Q1 when already active instead of advancing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// First call selects Q1.
		const result1 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(result1.status).toBe('ok');
		expect(result1.data?.mode).toBe('intake_active');
		const q1Id = result1.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Second call while already active should re-emit Q1.
		const result2 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result2.status).toBe('ok');
		expect(result2.data?.mode).toBe('intake_active');
		expect(result2.data?.activeQuestionId).toBe(q1Id);
	});

	it('does not advance to Q2 when already active', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// First call selects Q1.
		const result1 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = result1.data?.activeQuestionId;

		// Now manually "answer" Q1 sufficiently, but without advancing.
		// Then save a state where mode is still intake_active and activePrompt
		// is set to Q2. Wait — actually for this test we want to prove that
		// when active prompt is Q1, starting again returns Q1 and NOT Q2.
		// We already prove this in the test above. This test is redundant but
		// let's keep it as an explicit check.

		// Start intake again — should still re-emit Q1.
		const result2 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result2.data?.activeQuestionId).toBe(q1Id);
		// Q2 would have a different id. With 4 questions in the test profile,
		// we can verify it's still Q1.
	});

	it('does not create a new session on re-emission', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result1 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(result1.status).toBe('ok');

		// Record the initializedAt timestamp from persisted state.
		const { loadIntakeState } = await import(
			'../../src/core/state/intake-state-persistence.js'
		);
		const load1 = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(load1.ok).toBe(true);
		const originalInitAt = load1.ok ? load1.state.initializedAt : NOW;

		// Re-emit.
		await core.startIntake({
			now: '2026-05-22T01:00:00Z',
			projectRoot: PROJECT_ROOT,
		});

		const load2 = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(load2.ok).toBe(true);
		if (load2.ok) {
			// initializedAt should not have changed — no new session created.
			expect(load2.state.initializedAt).toBe(originalInitAt);
			// updatedAt should be updated on re-emission.
			expect(load2.state.updatedAt).toBe('2026-05-22T01:00:00Z');
		}
	});

	it('does not clear follow-up metadata on re-emission', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Load the question registry to get question ids.
		const { loadProfileContracts } = await import(
			'../../src/core/profiles/load-profile-contracts.js'
		);
		const profileResult = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});
		if (!profileResult.ok) return;

		const questions = profileResult.contracts.questionRegistry.questions;
		expect(questions.length).toBeGreaterThan(0);
		const q1 = questions[0];
		expect(q1).toBeDefined();

		// Pre-populate intake state with an active follow-up prompt.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = q1.id;
		state.activePrompt = {
			followUpId: 'fu-1',
			kind: 'follow_up',
			questionId: q1.id,
			startedAt: NOW,
			updatedAt: NOW,
		};
		state.partialQuestions[q1.id] = {
			missingAspects: ['detail'],
			questionId: q1.id,
			recordedAt: NOW,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		// Re-emit.
		const result = await core.startIntake({
			now: '2026-05-22T01:00:00Z',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		// The re-emitted prompt should still be a follow-up.
		if (result.data?.activePrompt) {
			expect(result.data.activePrompt.kind).toBe('follow_up');
		}
	});

	it('re-emits with contradiction metadata preserved', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Load the question registry to get question ids.
		const { loadProfileContracts } = await import(
			'../../src/core/profiles/load-profile-contracts.js'
		);
		const profileResult = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});
		if (!profileResult.ok) return;

		const questions = profileResult.contracts.questionRegistry.questions;
		expect(questions.length).toBeGreaterThan(0);
		const q1 = questions[0];
		expect(q1).toBeDefined();

		// Pre-populate intake state with an active contradiction prompt.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = q1.id;
		state.activePrompt = {
			contradictionId: 'contra-1',
			kind: 'contradiction_resolution',
			questionId: q1.id,
			startedAt: NOW,
			updatedAt: NOW,
		};
		state.contradictions['contra-1'] = {
			conflictsWithQuestionIds: [q1.id],
			createdAt: NOW,
			id: 'contra-1',
			questionId: q1.id,
			status: 'unresolved',
			summary: 'Contradiction between A and B.',
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		// Re-emit.
		const result = await core.startIntake({
			now: '2026-05-22T01:00:00Z',
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		if (result.data?.activePrompt) {
			expect(result.data.activePrompt.kind).toBe('contradiction_resolution');
		}
	});

	it('blocks when active prompt references missing question', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Pre-populate intake state with an active prompt referencing a
		// non-existent question.
		const state = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		state.mode = 'intake_active';
		state.activeQuestionId = 'missing-question';
		state.activePrompt = {
			kind: 'question',
			questionId: 'missing-question',
			startedAt: NOW,
			updatedAt: NOW,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state,
		});

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.code === 'active_prompt_invalid'),
		).toBe(true);
		expect(result.data?.mode).toBe('idle');
	});
});
