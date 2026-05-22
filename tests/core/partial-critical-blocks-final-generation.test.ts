/**
 * Step 6.2 — Partial critical blocks final generation tests.
 *
 * Tests:
 * 1. Partial critical question creates blocker partial_critical_questions.
 * 2. ready is false.
 * 3. Partial critical question ids are listed.
 * 4. Partial critical question can allow canGeneratePartialDraft: true
 *    if profile/state are valid.
 * 5. requiresExplicitConfirmation is true when partial draft is possible.
 */

import { describe, expect, it } from 'vitest';

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

describe('partial critical blocks final generation', () => {
	// --- 1. Partial critical creates blocker ---
	it('partial critical question creates blocker partial_critical_questions', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A partial thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'partial',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		const preflight = result.preflight;

		const blocker = preflight.blockers.find(
			(b) => b.code === 'partial_critical_questions',
		);
		expect(blocker).toBeDefined();
		expect(blocker?.questionIds).toContain(CRITICAL_Q_ID);
	});

	// --- 2. ready is false when critical is partial ---
	it('ready is false when critical question is partial', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Partial.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'partial',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.ready).toBe(false);
	});

	// --- 3. Partial critical question ids are listed ---
	it('partial critical question ids are listed in partialCriticalQuestions', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Partial.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'partial',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.partialCriticalQuestions).toContain(CRITICAL_Q_ID);
	});

	// --- 4. canGeneratePartialDraft is true when profile/state are valid ---
	it('canGeneratePartialDraft is true even with partial critical questions', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Partial.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'partial',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.canGeneratePartialDraft).toBe(true);
	});

	// --- 5. requiresExplicitConfirmation is true when partial draft is possible ---
	it('requiresExplicitConfirmation is true when partial draft is possible', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Partial.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'partial',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.requiresExplicitConfirmation).toBe(true);
	});

	// --- Additional: requiresExplicitConfirmation is false when no blockers ---
	it('requiresExplicitConfirmation is false when no blockers exist', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A full sufficient thesis.',
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
		expect(result.preflight.ready).toBe(true);
		expect(result.preflight.requiresExplicitConfirmation).toBe(false);
	});

	// --- Additional: mode="partial_draft" forces requiresExplicitConfirmation ---
	it('mode=partial_draft forces requiresExplicitConfirmation even when ready', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'Full thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			mode: 'partial_draft',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.ready).toBe(true);
		expect(result.preflight.requiresExplicitConfirmation).toBe(true);
	});
});
