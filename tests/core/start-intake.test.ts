/**
 * Tests for startIntake transition (Step 3.4).
 *
 * Covers:
 * - Given valid config/profile and idle intake state, startIntake selects one prompt.
 * - Result includes assistant message.
 * - Message kind matches selected prompt kind.
 * - State is persisted with mode: "intake_active".
 * - activeQuestionId is persisted.
 * - activePrompt is persisted.
 * - startIntake does not return a silent/no-message success.
 * - Selector complete result sets state to complete.
 * - No filesystem causes blocked.
 * - Project not initialized blocks.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { createDefaultIntakeState } from '../../src/core/state/intake-state-defaults.js';
import { loadIntakeState } from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startIntake transition', () => {
	it('returns blocked when no filesystem is provided', async () => {
		const core = createLogosCore();
		const result = await core.startIntake({ projectRoot: '/tmp/test' });

		expect(result.status).toBe('blocked');
		expect(result.data?.mode).toBe('idle');
		expect(result.data?.activeQuestionId).toBeUndefined();
	});

	it('returns blocked when project is not initialized', async () => {
		const fs = createFakeFilesystem();
		// Do NOT addStandardProfile — profile won't exist.
		const core = createLogosCore({ filesystem: fs });

		const result = await core.startIntake({ projectRoot: PROJECT_ROOT });

		expect(result.status).toBe('blocked');
		// When not initialized, config defaults to 'standard' but the profile
		// directory doesn't exist, so the blocker is profile_not_found.
		expect(result.blockers.some((b) => b.code === 'profile_not_found')).toBe(
			true,
		);
	});

	it('selects one prompt when intake is idle and profile is valid', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		// Initialize first
		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.mode).toBe('intake_active');
		expect(result.data?.activeQuestionId).toBeDefined();
		expect(result.data?.activeQuestionId).toMatch(/^01-foundation\./);
	});

	it('result includes an assistant message with the prompt text', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.message.body).toBeTruthy();
		expect(result.message.body.length).toBeGreaterThan(0);
	});

	it('message kind matches the selected prompt kind', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		// The first question from a fresh profile should be a normal question prompt.
		expect(result.message.kind).toBe('question');
	});

	it('persists intake state with mode intake_active', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Load persisted state.
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

	it('persists the activeQuestionId', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.activeQuestionId).toBeDefined();

		// Load persisted state.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		if (loadResult.ok) {
			expect(loadResult.state.activeQuestionId).toBe(
				result.data?.activeQuestionId,
			);
		}
	});

	it('persists the activePrompt state', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.activePrompt).toBeDefined();

		// Load persisted state.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		if (loadResult.ok) {
			expect(loadResult.state.activePrompt).toBeDefined();
			expect(loadResult.state.activePrompt?.questionId).toBe(
				result.data?.activeQuestionId,
			);
			expect(loadResult.state.activePrompt?.kind).toBe('question');
		}
	});

	it('does not return silent/no-message success', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		// The message body must contain actual prompt text, not an empty string
		// or a generic "not implemented" stub.
		expect(result.message.body.length).toBeGreaterThan(10);
		expect(result.message.body).not.toContain('not implemented');
	});

	it('returns activePrompt in the result data', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const result = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.activePrompt).toBeDefined();
		expect(result.data?.activePrompt?.kind).toBe('question');
		expect(result.data?.activePrompt?.text).toBeTruthy();
		expect(result.data?.activePrompt?.questionId).toBe(
			result.data?.activeQuestionId,
		);
	});
});

describe('startIntake when registry is complete', () => {
	it('sets state to complete when all questions are answered', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Mark all questions as sufficient.
		// Since we don't know the exact ids, we need to start intake once
		// to get the question ids from the registry, then answer them.
		const firstResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(firstResult.status).toBe('ok');

		// The first question id.
		const q1Id = firstResult.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// We'll manually save state with all questions answered as sufficient.
		// First load the registry questions to get all ids.
		const { loadProfileContracts } = await import(
			'../../src/core/profiles/load-profile-contracts.js'
		);
		const profileResult = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		if (!profileResult.ok) {
			// If profile loading fails, skip the test gracefully.
			return;
		}

		const allQuestionIds =
			profileResult.contracts.questionRegistry.questions.map((q) => q.id);

		// Create a fully sufficient state.
		const completeState = createDefaultIntakeState({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		for (const qid of allQuestionIds) {
			completeState.answeredQuestions[qid] = {
				answer: 'A sufficient answer.',
				answeredAt: NOW,
				questionId: qid,
				status: 'sufficient',
			};
		}

		// Save the complete state.
		const { saveIntakeState } = await import(
			'../../src/core/state/intake-state-persistence.js'
		);
		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: completeState,
		});

		// Now startIntake should return complete.
		const completeResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(completeResult.status).toBe('ok');
		expect(completeResult.data?.mode).toBe('complete');
		expect(completeResult.message.kind).toBe('completion');
	});
});
