/**
 * Step 6.2 — Generation preflight tests.
 *
 * Tests:
 * 1. Valid initialized project with complete intake returns ready: true.
 * 2. Preflight result includes mode, status, ready, completenessScore,
 *    blockers, warnings, and checkedAt.
 * 3. Preflight does not write generated docs.
 * 4. Preflight uses active profile contracts.
 * 5. Preflight result is JSON-serializable.
 * 6. Write-plan-not-built warning exists.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { runGenerationPreflight } from '../../src/core/generation/preflight.js';
import type { GenerationPreflightResult } from '../../src/core/generation/preflight-result.js';

import {
	CRITICAL_Q_ID,
	createEmptyIntakeState,
	createPreflightTestFilesystem,
	NOW,
} from './_preflight-fixtures.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runGenerationPreflight', () => {
	// --- 1. Project not initialized ---
	it('returns not_initialized when no config exists', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const preflight = result.preflight;
		expect(preflight.status).toBe('not_initialized');
		expect(preflight.ready).toBe(false);
		expect(
			preflight.blockers.some((b) => b.code === 'project_not_initialized'),
		).toBe(true);
		expect(preflight.completenessScore).toBe(0);
		expect(preflight.canGeneratePartialDraft).toBe(false);
		expect(preflight.requiresExplicitConfirmation).toBe(false);
	});

	// --- 2. Profile not found ---
	it('returns blocked with profile_not_found for missing profile', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addLogosConfig('missing-profile');

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const preflight = result.preflight;
		expect(preflight.status).toBe('blocked');
		expect(preflight.ready).toBe(false);
		expect(preflight.blockers.some((b) => b.code === 'profile_not_found')).toBe(
			true,
		);
	});

	// --- 3. Complete intake produces ready: true ---
	it('complete intake with all sufficient answers returns ready', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A clear thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const preflight = result.preflight;
		expect(preflight.status).toBe('ready');
		expect(preflight.ready).toBe(true);
		expect(preflight.blockers).toHaveLength(0);
		expect(preflight.completenessScore).toBeGreaterThan(0);
	});

	// --- 4. Preflight result includes all required fields ---
	it('preflight result includes mode, status, ready, completenessScore, blockers, warnings, checkedAt', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A clear thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const preflight = result.preflight;
		expect(preflight.mode).toBe('dry_run');
		expect(preflight.status).toBe('ready');
		expect(typeof preflight.ready).toBe('boolean');
		expect(typeof preflight.completenessScore).toBe('number');
		expect(preflight.completenessScore).toBeGreaterThanOrEqual(0);
		expect(preflight.completenessScore).toBeLessThanOrEqual(1);
		expect(Array.isArray(preflight.blockers)).toBe(true);
		expect(Array.isArray(preflight.warnings)).toBe(true);
		expect(typeof preflight.checkedAt).toBe('string');
		expect(preflight.checkedAt).toBe(NOW);
	});

	// --- 5. Preflight does not write generated docs ---
	it('preflight does not write generated documentation files', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A clear thesis.',
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

		expect(
			await fs.fileExists({ path: '/project/docs/generated/thesis.md' }),
		).toBe(false);
		expect(await fs.fileExists({ path: '/project/output/final.md' })).toBe(
			false,
		);
	});

	// --- 6. Preflight uses active profile contracts ---
	it('preflight uses active profile contracts from ensureProfileReady', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig('standard');

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const hasRegistryBlocker = result.preflight.blockers.some(
			(b) => b.code === 'question_registry_empty',
		);
		expect(hasRegistryBlocker).toBe(false);
	});

	// --- 7. Preflight result is JSON-serializable ---
	it('preflight result is JSON-serializable', async () => {
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

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);

		const json = JSON.stringify(result.preflight);
		const parsed = JSON.parse(json) as GenerationPreflightResult;

		expect(parsed.status).toBe(result.preflight.status);
		expect(parsed.ready).toBe(result.preflight.ready);
		expect(parsed.completenessScore).toBe(result.preflight.completenessScore);
		expect(parsed.blockers).toHaveLength(result.preflight.blockers.length);
	});

	// --- 8. Write-plan-not-built warning exists ---
	it('includes write_plan_not_built warning', async () => {
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

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(
			result.preflight.warnings.some((w) => w.code === 'write_plan_not_built'),
		).toBe(true);
		expect(
			result.preflight.warnings.some(
				(w) => w.code === 'output_paths_not_fully_validated',
			),
		).toBe(true);
		expect(
			result.preflight.warnings.some(
				(w) => w.code === 'manual_edit_detection_not_available',
			),
		).toBe(true);
	});

	// --- 9. generate() with dry_run calls preflight ---
	it('generate() with dry_run calls preflight', async () => {
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

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'dry_run',
			projectRoot: '/project',
		});

		// Preflight passed, but generation write not implemented → blocked.
		expect(result.status).toBe('blocked');
		expect(result.message.body).toContain('not implemented');
		expect(result.data?.generatedPaths).toEqual([]);
	});

	// --- 10. generate() with final mode calls preflight ---
	it('generate() with final mode calls preflight', async () => {
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

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			projectRoot: '/project',
		});

		// Preflight passed → blocked because write isn't implemented.
		expect(result.status).toBe('blocked');
		expect(result.message.body).toContain('not implemented');
	});
});
