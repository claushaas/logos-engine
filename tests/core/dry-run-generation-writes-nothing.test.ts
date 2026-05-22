/**
 * Step 6.4 — Dry-run generation writes nothing tests.
 *
 * Tests:
 * 1. mode: "dry_run" writes no files.
 * 2. dryRun: true writes no files.
 * 3. Dry-run can return preflight and write plan.
 * 4. Dry-run does not mark wroteFiles: true.
 * 5. Dry-run does not record generated paths.
 * 6. Dry-run returns dryRun: true in result.
 * 7. Dry-run returns wroteFiles: false.
 */

import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';

import {
	CRITICAL_Q_ID,
	createEmptyIntakeState,
	createPreflightTestFilesystem,
	NOW,
} from './_preflight-fixtures.js';

// ---------------------------------------------------------------------------
// Helper: complete intake so preflight passes → can exercise dry-run path
// to write plan construction.
// ---------------------------------------------------------------------------

function createCompleteIntakeFs() {
	const fs = createPreflightTestFilesystem();
	fs.addStandardProfile();
	fs.addLogosConfig();

	const intakeState = createEmptyIntakeState();
	intakeState.answeredQuestions[CRITICAL_Q_ID] = {
		answer: 'A clear, complete thesis.',
		answeredAt: NOW,
		questionId: CRITICAL_Q_ID,
		status: 'sufficient',
	};
	fs.addIntakeState(intakeState);

	return fs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dry-run generation writes nothing', () => {
	// --- 1. mode: "dry_run" writes no files ---
	it('mode dry_run writes no files', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
		expect(result.dryRun).toBe(true);
	});

	// --- 2. dryRun: true writes no files ---
	it('dryRun: true writes no files', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			dryRun: true,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
	});

	// --- 3. Dry-run can return preflight and write plan ---
	it('dry_run can return preflight and write plan', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.preflight).toBeDefined();
		// writePlan may or may not be present depending on path validation,
		// but when present it should not result in writes.
		if (result.data?.writePlan) {
			expect(result.data?.writePlan.dryRun).toBe(true);
		}
	});

	// --- 4. Dry-run does not mark wroteFiles: true ---
	it('dry_run does not mark wroteFiles: true', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.wroteFiles).toBe(false);
	});

	// --- 5. Dry-run does not record generated paths ---
	it('dry_run does not record generated paths', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toHaveLength(0);
	});

	// --- 6. Dry-run with blocked preflight still writes nothing ---
	it('dry_run with blocked preflight still writes nothing', async () => {
		const fs = createPreflightTestFilesystem();
		// No profile, no config → project_not_initialized.
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		// Dry-run with blockers: should still not write files.
		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
	});

	// --- 7. dryRun: true with final mode is treated as dry_run ---
	it('dryRun: true with final mode is treated as dry_run', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			dryRun: true,
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		// dryRun: true takes precedence over mode: "final".
		expect(result.dryRun).toBe(true);
		expect(result.data?.wroteFiles).toBe(false);
		expect(result.data?.generatedPaths).toHaveLength(0);
	});

	// --- 8. Dry-run status is ok (not blocked, not noop) ---
	it('dry_run returns ok status', async () => {
		const fs = createCompleteIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'dry_run',
			now: NOW,
			projectRoot: '/project',
		});

		// Even if write plan has blockers, dry-run should return ok
		// because it's a preview-only operation.
		expect(result.status).toBe('ok');
	});
});
