/**
 * Tests for stop/resume intake transitions (Step 3.4).
 *
 * Covers:
 * - Given active intake with Q1, stopIntake sets mode to paused.
 * - stopIntake preserves activeQuestionId.
 * - stopIntake preserves active prompt.
 * - Calling startIntake after stop resumes/re-emits Q1.
 * - State survives save/load through the fake filesystem.
 * - stopIntake on idle mode returns noop.
 * - stopIntake on already paused mode returns noop.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import {
	getLogosIntakeStatePath,
	loadIntakeState,
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

describe('stopIntake transition', () => {
	it('sets mode to paused when intake is active', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Start intake to get into active mode.
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		expect(startResult.data?.mode).toBe('intake_active');

		// Stop intake.
		const stopResult = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(stopResult.status).toBe('ok');
		expect(stopResult.data?.mode).toBe('paused');
	});

	it('preserves activeQuestionId after stop', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(startResult.status).toBe('ok');
		const qId = startResult.data?.activeQuestionId;
		expect(qId).toBeDefined();

		const stopResult = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(stopResult.data?.activeQuestionId).toBe(qId);
	});

	it('preserves activePrompt after stop', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		const stopResult = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// The activePrompt should still be present in the persisted state.
		expect(stopResult.data?.activePrompt).toBeDefined();
		expect(stopResult.data?.activePrompt?.kind).toBe('question');
	});

	it('persists paused state to filesystem', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		await core.stopIntake({
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
			expect(loadResult.state.mode).toBe('paused');
		}
	});

	it('resumes to same question after stop and start', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// First start picks Q1.
		const result1 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(result1.status).toBe('ok');
		const q1Id = result1.data?.activeQuestionId;
		expect(q1Id).toBeDefined();

		// Stop.
		await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Start again — should re-emit Q1.
		const result2 = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result2.status).toBe('ok');
		expect(result2.data?.activeQuestionId).toBe(q1Id);
	});

	it('state survives save/load round-trip', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Verify state exists on disk.
		const statePath = getLogosIntakeStatePath(PROJECT_ROOT);
		expect(await fs.fileExists({ path: statePath })).toBe(true);

		// Load and verify.
		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.mode).toBe('paused');
			expect(loadResult.state.activeQuestionId).toBeDefined();
			expect(loadResult.state.activePrompt).toBeDefined();
		}
	});

	it('returns noop when intake is already idle', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Don't start intake — stay in idle.
		const result = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.status).toBe('ok');
		expect(result.data?.mode).toBe('idle');
	});

	it('returns noop when intake is already paused', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// First stop transitions to paused.
		const stop1 = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stop1.data?.mode).toBe('paused');

		// Second stop should be noop.
		const stop2 = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		expect(stop2.status).toBe('ok');
		expect(stop2.data?.mode).toBe('paused');
		expect(stop2.message.body).toContain('already paused');
	});

	it('can be called without valid profile resolution', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });

		// Start intake.
		await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// Corrupt the config to point to a missing profile.
		// stopIntake should still work because it doesn't require profile resolution.
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: '/project/.logos/config.yml',
		});

		const stopResult = await core.stopIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});

		// stopIntake must succeed even though the profile is missing.
		expect(stopResult.status).toBe('ok');
		expect(stopResult.data?.mode).toBe('paused');
		expect(stopResult.data?.activeQuestionId).toBeDefined();
	});
});
