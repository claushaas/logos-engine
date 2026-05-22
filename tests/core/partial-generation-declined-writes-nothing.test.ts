/**
 * Step 6.4 — Partial generation declined writes nothing tests.
 *
 * Tests:
 * 1. Missing confirmation writes nothing.
 * 2. Explicit confirmedPartialGeneration: false writes nothing.
 * 3. Generated paths remain empty.
 * 4. Existing files are not modified.
 * 5. Generation state does not claim files were written.
 * 6. Partial draft without confirmation returns wroteFiles: false.
 * 7. Status is confirmation_required, not ok.
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
// Helper
// ---------------------------------------------------------------------------

function createPartialIntakeFs() {
	const fs = createPreflightTestFilesystem();
	fs.addStandardProfile();
	fs.addLogosConfig();

	const intakeState = createEmptyIntakeState();
	intakeState.answeredQuestions[CRITICAL_Q_ID] = {
		answer: 'A partial thesis answer.',
		answeredAt: NOW,
		questionId: CRITICAL_Q_ID,
		status: 'partial',
	};
	fs.addIntakeState(intakeState);

	return fs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('partial generation declined writes nothing', () => {
	// --- 1. Missing confirmation writes nothing ---
	it('missing confirmation writes no files', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
			// No confirmedPartialGeneration provided.
		});

		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
	});

	// --- 2. Explicit confirmedPartialGeneration: false writes nothing ---
	it('explicit confirmedPartialGeneration: false writes nothing', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			confirmedPartialGeneration: false,
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
		expect(result.data?.confirmationProvided).toBe(false);
	});

	// --- 3. Generated paths remain empty ---
	it('generated paths remain empty when confirmation is missing', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toHaveLength(0);
	});

	// --- 4. Existing files are not modified ---
	it('existing files are not modified when confirmation is missing', async () => {
		const fs = createPartialIntakeFs();

		// Add a pre-existing file that should not be touched.
		fs.addFile('/project/docs/existing-file.md', '# Original Content');

		const core = createLogosCore({ filesystem: fs });
		await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		// The existing file should still contain its original content.
		const readResult = await fs.readTextFile('/project/docs/existing-file.md');
		expect(readResult.content).toBe('# Original Content');
	});

	// --- 5. Status is confirmation_required, not ok ---
	it('status is confirmation_required when unconfirmed', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('confirmation_required');
		expect(result.status).not.toBe('ok');
	});

	// --- 6. Result has requiresExplicitConfirmation: true ---
	it('result has requiresExplicitConfirmation: true when unconfirmed', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.requiresExplicitConfirmation).toBe(true);
	});

	// --- 7. Unconfirmed result has confirmationProvided: false ---
	it('unconfirmed result has confirmationProvided: false', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.confirmationProvided).toBe(false);
	});

	// --- 8. Declined write does not change changedPaths to created ---
	it('declined write does not report created changedPaths', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		// No changedPaths should be marked as "created" — nothing was written.
		const created = result.changedPaths.filter((cp) => cp.kind === 'created');
		expect(created).toHaveLength(0);
	});
});
