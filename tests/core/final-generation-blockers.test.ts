/**
 * Step 6.4 — Final generation blockers tests.
 *
 * Tests:
 * 1. Final generation with missing critical blockers returns blocked.
 * 2. Final generation with partial critical blockers returns blocked.
 * 3. Final generation with unresolved contradictions returns blocked.
 * 4. Final generation writes no files when blocked.
 * 5. Final generation does not accept confirmedPartialGeneration as bypass.
 * 6. Blocked final generation returns wroteFiles: false.
 * 7. Blocked final generation returns generatedPaths: [].
 * 8. Blocked final generation returns partialDraft: false.
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
// Tests
// ---------------------------------------------------------------------------

describe('final generation blockers', () => {
	// --- 1. Final generation with missing critical returns blocked ---
	it('final generation with missing critical returns blocked', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		// No answers → missing critical questions.
		fs.addIntakeState(createEmptyIntakeState());

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.code === 'missing_critical_questions'),
		).toBe(true);
	});

	// --- 2. Final generation with partial critical blockers returns blocked ---
	it('final generation with partial critical returns blocked', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A partial answer.',
			answeredAt: NOW,
			questionId: CRITICAL_Q_ID,
			status: 'partial',
		};
		fs.addIntakeState(intakeState);

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.code === 'partial_critical_questions'),
		).toBe(true);
	});

	// --- 3. Final generation with unresolved contradictions returns blocked ---
	it('final generation with unresolved contradictions returns blocked', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();

		const intakeState = createEmptyIntakeState();
		intakeState.answeredQuestions[CRITICAL_Q_ID] = {
			answer: 'A sufficient answer.',
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
			summary: 'Contradictory thesis statements.',
		};
		fs.addIntakeState(intakeState);

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.code === 'unresolved_contradictions'),
		).toBe(true);
	});

	// --- 4. Final generation writes no files when blocked ---
	it('final generation writes no files when blocked', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toEqual([]);
		expect(result.data?.wroteFiles).toBe(false);
	});

	// --- 5. confirmedPartialGeneration does not bypass final blockers ---
	it('confirmedPartialGeneration does not bypass final blockers', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			confirmedPartialGeneration: true,
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.status).toBe('blocked');
		expect(result.data?.confirmationProvided).toBe(false);
		expect(result.data?.generatedPaths).toEqual([]);
	});

	// --- 6. Blocked final generation returns partialDraft: false ---
	it('blocked final generation returns partialDraft: false', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.partialDraft).toBe(false);
		expect(result.data?.incomplete).toBe(false);
	});

	// --- 7. Blocked final generation has no generated paths ---
	it('blocked final generation has no generated paths', async () => {
		const fs = createPreflightTestFilesystem();
		fs.addStandardProfile();
		fs.addLogosConfig();
		fs.addIntakeState(createEmptyIntakeState());

		const core = createLogosCore({ filesystem: fs });
		const result = await core.generate({
			mode: 'final',
			now: NOW,
			projectRoot: '/project',
		});

		expect(result.data?.generatedPaths).toHaveLength(0);
	});
});
