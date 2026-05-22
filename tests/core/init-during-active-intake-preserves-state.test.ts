/**
 * Step 5.4 — /logos-init during active intake state preservation.
 *
 * Tests:
 * 1. Active prompt kind question is preserved.
 * 2. Active prompt kind follow_up preserves followUpId.
 * 3. Active prompt kind contradiction_resolution preserves contradictionId.
 * 4. Answer records remain unchanged.
 * 5. Partial records remain unchanged.
 * 6. Skipped records remain unchanged.
 * 7. Contradiction records remain unchanged.
 * 8. Progress remains unchanged.
 */

import { describe, expect, it } from 'vitest';
import { createLogosCore } from '../../src/core/api.js';
import { handleIntakeCommand } from '../../src/core/intake/handle-intake-command.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../../src/core/state/intake-state-persistence.js';
import { createFakeFilesystem } from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleIntakeCommand — logos-init preserves active prompt kind', () => {
	it('preserves question kind active prompt', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		const result = await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.disposition).toBe('confirm_required');
		expect(result.data?.activePrompt?.kind).toBe('question');
		expect(result.data?.activePrompt?.questionId).toBe(q1Id);

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activePrompt?.kind).toBe('question');
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
		}
	});

	it('preserves follow_up kind active prompt with followUpId', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		// Mutate state to follow_up.
		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.activePrompt = {
			followUpId: 'fu-1',
			kind: 'follow_up',
			questionId: q1Id ?? 'q-1',
			startedAt: NOW,
			updatedAt: NOW,
		};
		stateBefore.state.activeQuestionId = q1Id ?? 'q-1';

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		const result = await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.disposition).toBe('confirm_required');
		expect(result.message.metadata?.followUpId).toBe('fu-1');
		expect(result.message.metadata?.activePromptKind).toBe('follow_up');

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activePrompt?.kind).toBe('follow_up');
			expect(loadResult.state.activePrompt?.followUpId).toBe('fu-1');
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
		}
	});

	it('preserves contradiction_resolution kind active prompt with contradictionId', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		const startResult = await core.startIntake({
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		const q1Id = startResult.data?.activeQuestionId;

		// Mutate state to contradiction_resolution.
		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.contradictions['c-1'] = {
			conflictsWithQuestionIds: ['q-prev'],
			createdAt: NOW,
			id: 'c-1',
			metadata: {},
			questionId: q1Id ?? 'q-1',
			status: 'unresolved',
			summary: 'Test contradiction',
		};
		stateBefore.state.activePrompt = {
			contradictionId: 'c-1',
			kind: 'contradiction_resolution',
			questionId: q1Id ?? 'q-1',
			startedAt: NOW,
			updatedAt: NOW,
		};
		stateBefore.state.activeQuestionId = q1Id ?? 'q-1';

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		const result = await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		expect(result.data?.disposition).toBe('confirm_required');
		expect(result.message.metadata?.contradictionId).toBe('c-1');
		expect(result.message.metadata?.activePromptKind).toBe(
			'contradiction_resolution',
		);

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.activePrompt?.kind).toBe(
				'contradiction_resolution',
			);
			expect(loadResult.state.activePrompt?.contradictionId).toBe('c-1');
			expect(loadResult.state.activePrompt?.questionId).toBe(q1Id);
			expect(loadResult.state.contradictions['c-1']).toBeDefined();
			expect(loadResult.state.contradictions['c-1'].status).toBe('unresolved');
		}
	});
});

describe('handleIntakeCommand — logos-init preserves records', () => {
	it('preserves answered questions', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.answeredQuestions['q-prev'] = {
			answer: 'Previous answer',
			answeredAt: NOW,
			questionId: 'q-prev',
			status: 'sufficient',
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.answeredQuestions['q-prev']).toBeDefined();
			expect(loadResult.state.answeredQuestions['q-prev'].answer).toBe(
				'Previous answer',
			);
		}
	});

	it('preserves partial questions', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.partialQuestions['q-partial'] = {
			answer: 'Partial answer',
			missingAspects: ['aspect-a'],
			questionId: 'q-partial',
			recordedAt: NOW,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.partialQuestions['q-partial']).toBeDefined();
			expect(loadResult.state.partialQuestions['q-partial'].answer).toBe(
				'Partial answer',
			);
		}
	});

	it('preserves skipped questions', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.skippedQuestions['q-skip'] = {
			questionId: 'q-skip',
			reason: 'Not applicable yet',
			skippedAt: NOW,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.skippedQuestions['q-skip']).toBeDefined();
			expect(loadResult.state.skippedQuestions['q-skip'].reason).toBe(
				'Not applicable yet',
			);
		}
	});

	it('preserves contradiction records', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.contradictions['c-2'] = {
			conflictsWithQuestionIds: ['q-a'],
			createdAt: NOW,
			id: 'c-2',
			questionId: 'q-b',
			status: 'unresolved',
			summary: 'Another contradiction',
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.contradictions['c-2']).toBeDefined();
			expect(loadResult.state.contradictions['c-2'].status).toBe('unresolved');
		}
	});

	it('preserves progress counts', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const stateBefore = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(stateBefore.ok).toBe(true);
		if (!stateBefore.ok) return;

		stateBefore.state.progress = {
			byPhase: {
				'01-foundation': {
					byPhase: {},
					contradictory: 0,
					missing: 1,
					partial: 1,
					phaseId: '01-foundation',
					skipped: 0,
					sufficient: 2,
					total: 4,
				},
			},
			contradictory: 0,
			missing: 1,
			partial: 1,
			skipped: 0,
			sufficient: 2,
			total: 4,
		};

		await saveIntakeState({
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
			state: stateBefore.state,
		});

		await handleIntakeCommand({
			command: 'logos-init',
			filesystem: fs,
			projectRoot: PROJECT_ROOT,
		});

		const loadResult = await loadIntakeState({
			filesystem: fs,
			now: NOW,
			projectRoot: PROJECT_ROOT,
		});
		expect(loadResult.ok).toBe(true);
		if (loadResult.ok) {
			expect(loadResult.state.progress.total).toBe(4);
			expect(loadResult.state.progress.sufficient).toBe(2);
			expect(loadResult.state.progress.partial).toBe(1);
			expect(loadResult.state.progress.missing).toBe(1);
			expect(loadResult.state.progress.byPhase['01-foundation'].total).toBe(4);
		}
	});
});
