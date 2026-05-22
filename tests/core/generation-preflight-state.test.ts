/**
 * Step 6.2 — Generation preflight state persistence tests.
 *
 * Tests:
 * 1. Running preflight persists generation state.
 * 2. Generation state records lastPreflightAt.
 * 3. Generation state records status, readiness, completenessScore,
 *    blocker codes, and warning codes.
 * 4. Preflight does not mutate intake state.
 * 5. Preflight state survives reload through fake filesystem.
 */

import { describe, expect, it } from 'vitest';
import {
	getLogosGenerationStatePath,
	loadGenerationState,
} from '../../src/core/generation/generation-state.js';
import { runGenerationPreflight } from '../../src/core/generation/preflight.js';
import { loadIntakeState } from '../../src/core/state/intake-state-persistence.js';

import {
	CRITICAL_Q_ID,
	createEmptyIntakeState,
	createPreflightTestFilesystem,
	NOW,
} from './_preflight-fixtures.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generation preflight state persistence', () => {
	// --- 1. Running preflight persists generation state ---
	it('running preflight persists generation state file', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		const statePath = getLogosGenerationStatePath('/project');
		expect(await fs.fileExists({ path: statePath })).toBe(false);

		await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(await fs.fileExists({ path: statePath })).toBe(true);
	});

	// --- 2. Generation state records lastPreflightAt ---
	it('generation state records lastPreflightAt', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		const loadResult = await loadGenerationState({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(loadResult.ok).toBe(true);
		expect(loadResult.state.lastPreflightAt).toBe(NOW);
	});

	// --- 3. Generation state records status, readiness, completenessScore, blocker/warning codes ---
	it('generation state records status, readiness, completenessScore, blocker codes, and warning codes', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		// Missing critical → blocked with missing_critical_questions.
		fs.addIntakeState(createEmptyIntakeState());

		await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		const loadResult = await loadGenerationState({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(loadResult.ok).toBe(true);
		const snapshot = loadResult.state.lastPreflight;
		expect(snapshot).toBeDefined();
		expect(snapshot?.status).toBe('blocked');
		expect(snapshot?.ready).toBe(false);
		expect(snapshot?.completenessScore).toBe(0);
		expect(snapshot?.blockerCodes).toContain('missing_critical_questions');
		expect(snapshot?.warningCodes).toContain('write_plan_not_built');
	});

	// --- 4. Preflight does not mutate intake state ---
	it('preflight does not mutate intake state', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		// Reload intake state and verify it was not mutated.
		const reloadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(reloadResult.ok).toBe(true);
		expect(reloadResult.state.mode).toBe('idle');
		expect(reloadResult.state.answeredQuestions[CRITICAL_Q_ID]).toBeDefined();
		expect(reloadResult.state.answeredQuestions[CRITICAL_Q_ID]?.status).toBe(
			'sufficient',
		);
	});

	// --- 5. Preflight state survives reload ---
	it('preflight state survives reload through fake filesystem', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		// Run preflight once.
		await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		// Reload from disk.
		const loadResult1 = await loadGenerationState({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(loadResult1.ok).toBe(true);
		expect(loadResult1.state.lastPreflightAt).toBe(NOW);
		expect(loadResult1.state.lastPreflight?.ready).toBe(true);

		// Run preflight a second time with a different timestamp.
		const NOW2 = '2026-06-01T00:00:00.000Z';
		await runGenerationPreflight({
			filesystem: fs,
			now: NOW2,
			projectRoot: '/project',
		});

		// Reload again and verify the update.
		const loadResult2 = await loadGenerationState({
			filesystem: fs,
			now: NOW2,
			projectRoot: '/project',
		});

		expect(loadResult2.ok).toBe(true);
		expect(loadResult2.state.lastPreflightAt).toBe(NOW2);
		expect(loadResult2.state.lastPreflight?.checkedAt).toBe(NOW2);
	});
});
