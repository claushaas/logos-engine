/**
 * Step 6.2 — Contradictions block generation tests.
 *
 * Tests:
 * 1. Unresolved contradiction creates blocker unresolved_contradictions.
 * 2. Contradiction ids are listed.
 * 3. Resolved contradictions do not block if question is otherwise sufficient.
 * 4. Final generation is blocked when unresolved contradiction exists.
 * 5. No write plan or generated docs are produced.
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

describe('contradictions block generation', () => {
	// --- 1. Unresolved contradiction creates blocker ---
	it('unresolved contradiction creates blocker unresolved_contradictions', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.contradictions.contra1 = {
			conflictsWithQuestionIds: [],
			createdAt: NOW,
			id: 'contra1',
			questionId: CRITICAL_Q_ID,
			status: 'unresolved',
			summary: 'Contradictory thesis statements.',
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
			(b) => b.code === 'unresolved_contradictions',
		);
		expect(blocker).toBeDefined();
		expect(blocker?.questionIds).toContain(CRITICAL_Q_ID);
	});

	// --- 2. Contradiction ids are listed ---
	it('contradiction question ids are listed in contradictions array', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.contradictions.contra1 = {
			conflictsWithQuestionIds: [],
			createdAt: NOW,
			id: 'contra1',
			questionId: CRITICAL_Q_ID,
			status: 'unresolved',
			summary: 'Contradiction.',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.contradictions).toContain(CRITICAL_Q_ID);
	});

	// --- 3. Resolved contradictions do not block ---
	it('resolved contradictions do not block if question is otherwise sufficient', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A resolved thesis.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		intakeState.contradictions.contra1 = {
			conflictsWithQuestionIds: [],
			createdAt: NOW,
			id: 'contra1',
			questionId: CRITICAL_Q_ID,
			resolution: 'User chose one side.',
			resolvedAt: NOW,
			status: 'resolved',
			summary: 'Was contradictory, now resolved.',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.ready).toBe(true);
		expect(result.preflight.contradictions).toHaveLength(0);
		expect(
			result.preflight.blockers.some(
				(b) => b.code === 'unresolved_contradictions',
			),
		).toBe(false);
	});

	// --- 4. Final generation is blocked when unresolved contradiction exists ---
	it('final generation is blocked when unresolved contradiction exists', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'An answer.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'sufficient',
		};
		intakeState.contradictions.contra1 = {
			conflictsWithQuestionIds: [],
			createdAt: NOW,
			id: 'contra1',
			questionId: CRITICAL_Q_ID,
			status: 'unresolved',
			summary: 'Contradiction.',
		};
		fs.addIntakeState(intakeState);

		const result = await runGenerationPreflight({
			filesystem: fs,
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(result.preflight.status).toBe('blocked');
		expect(result.preflight.ready).toBe(false);
	});

	// --- 5. No write plan or generated docs are produced ---
	it('no write plan or generated docs are produced when blocked', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.contradictions.contra1 = {
			conflictsWithQuestionIds: [],
			createdAt: NOW,
			id: 'contra1',
			questionId: CRITICAL_Q_ID,
			status: 'unresolved',
			summary: 'Contradiction.',
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
});
