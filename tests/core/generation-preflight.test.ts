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

	// --- 8. Write-plan warnings are no longer emitted by preflight ---
	// In Step 6.2, preflight emitted placeholder write_plan_not_built
	// warnings. In Step 6.3, actual write plan building handles path
	// safety, overwrite, and manual-edit checks.  Preflight no longer
	// emits these placeholders.
	it('no longer emits step 6.2 placeholder write-plan warnings', async () => {
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
		// Preflight is ready — the write plan placeholder warnings are gone.
		expect(result.preflight.status).toBe('ready');
		expect(
			result.preflight.warnings.some((w) => w.code === 'write_plan_not_built'),
		).toBe(false);
	});

	// --- 9. generate() with dry_run builds write plan ---
	it('generate() with dry_run builds write plan and returns blocked', async () => {
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

		// Preflight passes and write plan is built.
		// The fixture document has no outputs block, so the write plan
		// produces a blocked canonical_markdown operation (empty path).
		// Status is blocked because write plan has blockers.
		expect(result.status).toBe('blocked');
		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.preflight).toBeDefined();
		expect(result.data?.writePlan).toBeDefined();
	});

	// --- 10. generate() with final mode builds write plan ---
	it('generate() with final mode builds write plan', async () => {
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

		// Preflight passes and write plan is built.
		// The fixture document has no outputs block, so write plan
		// produces a blocked canonical_markdown operation.
		expect(result.status).toBe('blocked');
		expect(result.data?.preflight).toBeDefined();
		expect(result.data?.writePlan).toBeDefined();
	});
});
