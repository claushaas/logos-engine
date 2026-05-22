/**
 * Step 6.4 — Partial generation confirmation tests.
 *
 * Tests:
 * 1. partial_draft without confirmation returns confirmation_required.
 * 2. partial_draft without confirmation writes no files.
 * 3. Result has requiresExplicitConfirmation: true.
 * 4. Result has confirmationProvided: false.
 * 5. Result includes preflight data.
 * 6. partial_draft with confirmation proceeds past confirmation boundary.
 * 7. Partial draft with confirmation but can't generate returns blocked.
 * 8. Result includes partialDraft: true.
 * 9. Result includes incomplete: true.
 * 10. confirmedPartialGeneration does not bypass final blockers.
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
// Helper: create a filesystem with standard profile, config, and intake
// state where the critical question has a partial answer (so preflight has
// blockers but canGeneratePartialDraft is true).
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

describe('partial generation confirmation', () => {
	// --- 1. partial_draft without confirmation returns confirmation_required ---
	it('partial_draft without confirmation returns confirmation_required', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('confirmation_required');
		expect(result.data?.requiresExplicitConfirmation).toBe(true);
		expect(result.data?.confirmationProvided).toBe(false);
	});

	// --- 2. partial_draft without confirmation writes no files ---
	it('partial_draft without confirmation writes no files', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
		expect(result.status).toBe('confirmation_required');
	});

	// --- 3. Result has requiresExplicitConfirmation: true ---
	it('result has requiresExplicitConfirmation: true', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.requiresExplicitConfirmation).toBe(true);
	});

	// --- 4. Result has confirmationProvided: false ---
	it('result has confirmationProvided: false when not confirmed', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.confirmationProvided).toBe(false);
	});

	// --- 5. Result includes preflight data ---
	it('confirmation_required result includes preflight data', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.preflight).toBeDefined();
		expect(result.data?.preflight?.mode).toBe('partial_draft');
		expect(result.data?.preflight?.canGeneratePartialDraft).toBe(true);
	});

	// --- 6. Result includes partialDraft: true ---
	it('result includes partialDraft: true for partial_draft mode', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.partialDraft).toBe(true);
	});

	// --- 7. Result includes incomplete: true ---
	it('result includes incomplete: true for partial_draft mode', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.incomplete).toBe(true);
	});

	// --- 8. partial_draft with confirmation proceeds past confirmation boundary ---
	it('partial_draft with confirmation proceeds past confirmation boundary', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			confirmedPartialGeneration: true,
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		// Should not be confirmation_required — should be ok, noop, or blocked
		// (depending on write plan success).
		expect(result.status).not.toBe('confirmation_required');
		expect(result.data?.confirmationProvided).toBe(true);
		expect(result.data?.partialDraft).toBe(true);
	});

	// --- 9. confirmedPartialGeneration does not bypass final blockers ---
	it('confirmedPartialGeneration does not bypass final blockers', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		// Final mode with confirmedPartialGeneration: true — should still be blocked.
		const result = await core.generate({
			confirmedPartialGeneration: true,
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
		// confirmedPartialGeneration is irrelevant for final mode.
		expect(result.data?.partialDraft).toBe(false);
	});

	// --- 10. partial_draft with confirmation but can't generate returns blocked ---
	it('partial_draft with confirmation but canGeneratePartialDraft false returns blocked', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addLogosConfig('missing-profile');
		// Profile is missing → canGeneratePartialDraft is false.

		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			confirmedPartialGeneration: true,
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.wroteFiles).toBe(false);
		expect(result.data?.partialDraft).toBe(true);
		expect(result.data?.confirmationProvided).toBe(true);
	});

	// --- 11. Result status message kind for confirmation_required ---
	it('confirmation_required message has kind confirmation_request', async () => {
		const fs = createPartialIntakeFs();
		const core = createLogosCore({ filesystem: fs });

		const result = await core.generate({
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.message.kind).toBe('confirmation_request');
	});
});
