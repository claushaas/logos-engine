/**
 * Step 6.2 — Missing critical blocks final generation tests.
 *
 * Tests:
 * 1. Missing critical question creates blocker missing_critical_questions.
 * 2. ready is false.
 * 3. status is blocked.
 * 4. Missing critical question ids are listed.
 * 5. generate({ mode: "final" }) returns blocked and writes no generated paths.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { runGenerationPreflight } from '../../src/core/generation/preflight.js';

import {
	CRITICAL_Q_ID,
	createEmptyIntakeState,
	createPreflightTestFilesystem,
	NOW,
} from './_preflight-fixtures.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('missing critical blocks final generation', () => {
	// --- 1. Missing critical question creates blocker ---
	it('missing critical question creates blocker missing_critical_questions', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		// No answers → critical question is missing.
		fs.addIntakeState(createEmptyIntakeState());

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const preflight = result.preflight;

		const blocker = preflight.blockers.find(
			(b) => b.code === 'missing_critical_questions',
		);
		expect(blocker).toBeDefined();
		expect(blocker?.questionIds).toContain(CRITICAL_Q_ID);
	});

	// --- 2. ready is false when critical is missing ---
	it('ready is false when critical question is missing', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.ready).toBe(false);
	});

	// --- 3. status is blocked when critical is missing ---
	it('status is blocked when critical question is missing', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.status).toBe('blocked');
	});

	// --- 4. Missing critical question ids are listed ---
	it('missing critical question ids are listed in missingCriticalQuestions', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.missingCriticalQuestions).toContain(CRITICAL_Q_ID);
	});

	// --- 5. generate({ mode: "final" }) returns blocked and writes nothing ---
	it('generate final returns blocked and writes no generated paths', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.generatedPaths).toEqual([]);
		expect(
			result.blockers.some((b) => b.code === 'missing_critical_questions'),
		).toBe(true);

		// No generated docs were written.
		expect(
			await fs.fileExists({ path: '/project/docs/generated/thesis.md' }),
		).toBe(false);
	});
});
