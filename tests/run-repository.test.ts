/** Run repository tests */

import { describe, expect, it } from 'vitest';
import {
	createRunRecord,
	listRunRecords,
	summarizeRuns,
	updateRunRecord,
} from '../src/state/run-repository.js';
import type { WorkspaceState } from '../src/state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';

function makeState(): WorkspaceState {
	return createDefaultWorkspaceState({
		createdAt: '2024-01-01T00:00:00.000Z',
		projectRootPath: '/tmp/test-repo',
		updatedAt: '2024-01-01T00:00:00.000Z',
		workspaceId: 'test-workspace',
	});
}

describe('run-repository', () => {
	describe('createRunRecord', () => {
		it('creates validation run metadata', () => {
			const state = makeState();
			const result = createRunRecord({
				input: { runType: 'validation' },
				state,
			});
			expect(result.run.runType).toBe('validation');
			expect(result.state.runs).toHaveLength(1);
		});

		it('creates diagnostic run metadata', () => {
			const state = makeState();
			const result = createRunRecord({
				input: { runType: 'diagnostic' },
				state,
			});
			expect(result.run.runType).toBe('diagnostic');
		});

		it('creates generation run metadata', () => {
			const state = makeState();
			const result = createRunRecord({
				input: { runType: 'generation' },
				state,
			});
			expect(result.run.runType).toBe('generation');
		});

		it('creates executive run metadata', () => {
			const state = makeState();
			const result = createRunRecord({
				input: { runType: 'executive' },
				state,
			});
			expect(result.run.runType).toBe('executive');
		});

		it('records dry-run flag', () => {
			const state = makeState();
			const result = createRunRecord({
				input: { dryRun: true, runType: 'validation' },
				state,
			});
			expect(result.run.dryRun).toBe(true);
		});

		it('records changed path summaries', () => {
			const state = makeState();
			const result = createRunRecord({
				input: {
					changedPaths: ['logos/docs/frontend.md'],
					runType: 'generation',
				},
				state,
			});
			expect(result.run.changedPaths).toEqual(['logos/docs/frontend.md']);
		});

		it('no actual validation/generation/executive behavior runs', () => {
			const state = makeState();
			const result = createRunRecord({
				input: { runType: 'validation' },
				state,
			});
			// Just metadata; no side effects
			expect(result.state.artifacts).toHaveLength(0);
			expect(result.state.sessions).toHaveLength(0);
		});
	});

	describe('updateRunRecord', () => {
		it('updates run status', () => {
			const state = makeState();
			const created = createRunRecord({
				input: { runType: 'validation', status: 'running' },
				state,
			});
			const updated = updateRunRecord({
				runId: created.run.runId,
				state: created.state,
				updates: { status: 'completed' },
			});
			expect(updated.found).toBe(true);
			expect(updated.run.status).toBe('completed');
		});

		it('returns found false for unknown run', () => {
			const state = makeState();
			const result = updateRunRecord({
				runId: 'nonexistent',
				state,
				updates: { status: 'completed' },
			});
			expect(result.found).toBe(false);
		});
	});

	describe('listRunRecords', () => {
		it('lists runs in deterministic order', () => {
			let state = makeState();
			const r1 = createRunRecord({
				clock: { now: () => '2024-01-01T10:00:00.000Z' },
				idFactory: () => 'r1',
				input: { runType: 'validation' },
				state,
			});
			state = r1.state;
			const r2 = createRunRecord({
				clock: { now: () => '2024-01-01T11:00:00.000Z' },
				idFactory: () => 'r2',
				input: { runType: 'generation' },
				state,
			});
			state = r2.state;

			const list = listRunRecords({ state });
			expect(list.map((r) => r.runId)).toEqual(['r2', 'r1']);
		});

		it('filters by type', () => {
			let state = makeState();
			state = createRunRecord({
				input: { runType: 'validation' },
				state,
			}).state;
			state = createRunRecord({
				input: { runType: 'generation' },
				state,
			}).state;

			const list = listRunRecords({ filterByType: 'validation', state });
			expect(list).toHaveLength(1);
			expect(list[0].runType).toBe('validation');
		});

		it('filters by status', () => {
			let state = makeState();
			state = createRunRecord({
				input: { runType: 'validation', status: 'running' },
				state,
			}).state;
			state = createRunRecord({
				input: { runType: 'generation', status: 'completed' },
				state,
			}).state;

			const list = listRunRecords({ filterByStatus: 'completed', state });
			expect(list).toHaveLength(1);
			expect(list[0].status).toBe('completed');
		});
	});

	describe('summarizeRuns', () => {
		it('summarizes runs by type', () => {
			let state = makeState();
			state = createRunRecord({
				input: { runType: 'validation' },
				state,
			}).state;
			state = createRunRecord({
				input: { runType: 'diagnostic' },
				state,
			}).state;
			state = createRunRecord({
				input: { runType: 'generation' },
				state,
			}).state;
			state = createRunRecord({ input: { runType: 'executive' }, state }).state;
			state = createRunRecord({
				input: { runType: 'validation' },
				state,
			}).state;

			const summary = summarizeRuns(state);
			expect(summary.totalRuns).toBe(5);
			expect(summary.totalValidationRuns).toBe(2);
			expect(summary.totalDiagnosticRuns).toBe(1);
			expect(summary.totalGenerationRuns).toBe(1);
			expect(summary.totalExecutiveRuns).toBe(1);
		});

		it('latest run is deterministic', () => {
			let state = makeState();
			const r1 = createRunRecord({
				clock: { now: () => '2024-01-01T10:00:00.000Z' },
				idFactory: () => 'r1',
				input: { runType: 'validation' },
				state,
			});
			state = r1.state;

			const summary = summarizeRuns(state);
			expect(summary.latestRun?.runId).toBe('r1');
		});
	});
});
