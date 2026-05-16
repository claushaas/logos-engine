/** Session repository tests */

import { describe, expect, it } from 'vitest';
import {
	createSessionRecord,
	getCurrentSessionSummary,
	listSessionRecords,
	updateSessionRecord,
} from '../src/state/session-repository.js';
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

describe('session-repository', () => {
	describe('createSessionRecord', () => {
		it('creates TUI session metadata', () => {
			const state = makeState();
			const result = createSessionRecord({
				input: { sessionType: 'manual' },
				state,
			});
			expect(result.session.sessionType).toBe('manual');
			expect(result.state.sessions).toHaveLength(1);
		});

		it('creates intake session metadata', () => {
			const state = makeState();
			const result = createSessionRecord({
				input: { sessionType: 'intake', status: 'open' },
				state,
			});
			expect(result.session.sessionType).toBe('intake');
			expect(result.session.status).toBe('open');
		});

		it('uses injected id/clock in tests', () => {
			const state = makeState();
			const result = createSessionRecord({
				clock: { now: () => '2024-06-01T12:00:00.000Z' },
				idFactory: () => 'injected-session-id',
				input: { sessionType: 'intake' },
				state,
			});
			expect(result.session.sessionId).toBe('injected-session-id');
			expect(result.session.startedAt).toBe('2024-06-01T12:00:00.000Z');
		});

		it('does not persist raw transcript or token-like data', () => {
			const state = makeState();
			const result = createSessionRecord({
				input: {
					sessionType: 'intake',
					summary: 'User discussed frontend framework options.',
				},
				state,
			});
			expect(result.session.summary).toBe(
				'User discussed frontend framework options.',
			);
			// Session record should not have a content/transcript field
			expect('content' in result.session).toBe(false);
			expect('transcript' in result.session).toBe(false);
		});
	});

	describe('updateSessionRecord', () => {
		it('updates session status to completed', () => {
			const state = makeState();
			const created = createSessionRecord({
				input: { sessionType: 'intake', status: 'open' },
				state,
			});
			const updated = updateSessionRecord({
				sessionId: created.session.sessionId,
				state: created.state,
				updates: { endedAt: '2024-06-01T13:00:00.000Z', status: 'completed' },
			});
			expect(updated.found).toBe(true);
			expect(updated.session.status).toBe('completed');
			expect(updated.session.endedAt).toBe('2024-06-01T13:00:00.000Z');
		});

		it('returns found false for unknown session', () => {
			const state = makeState();
			const result = updateSessionRecord({
				sessionId: 'nonexistent',
				state,
				updates: { status: 'completed' },
			});
			expect(result.found).toBe(false);
		});
	});

	describe('listSessionRecords', () => {
		it('lists sessions in deterministic order', () => {
			let state = makeState();
			const s1 = createSessionRecord({
				clock: { now: () => '2024-01-01T10:00:00.000Z' },
				idFactory: () => 's1',
				input: { sessionType: 'intake' },
				state,
			});
			state = s1.state;
			const s2 = createSessionRecord({
				clock: { now: () => '2024-01-01T11:00:00.000Z' },
				idFactory: () => 's2',
				input: { sessionType: 'manual' },
				state,
			});
			state = s2.state;

			const list = listSessionRecords({ state });
			expect(list.map((s) => s.sessionId)).toEqual(['s2', 's1']);
		});

		it('filters by type', () => {
			let state = makeState();
			const s1 = createSessionRecord({
				input: { sessionType: 'intake' },
				state,
			});
			state = s1.state;
			const s2 = createSessionRecord({
				input: { sessionType: 'manual' },
				state,
			});
			state = s2.state;

			const list = listSessionRecords({ filterByType: 'intake', state });
			expect(list).toHaveLength(1);
			expect(list[0].sessionType).toBe('intake');
		});

		it('filters by status', () => {
			let state = makeState();
			const s1 = createSessionRecord({
				input: { sessionType: 'intake', status: 'open' },
				state,
			});
			state = s1.state;
			const s2 = createSessionRecord({
				input: { sessionType: 'manual', status: 'completed' },
				state,
			});
			state = s2.state;

			const list = listSessionRecords({ filterByStatus: 'completed', state });
			expect(list).toHaveLength(1);
			expect(list[0].status).toBe('completed');
		});
	});

	describe('getCurrentSessionSummary', () => {
		it('latest session summary is deterministic', () => {
			let state = makeState();
			const s1 = createSessionRecord({
				clock: { now: () => '2024-01-01T10:00:00.000Z' },
				idFactory: () => 's1',
				input: { sessionType: 'intake', status: 'open' },
				state,
			});
			state = s1.state;

			const summary = getCurrentSessionSummary(state);
			expect(summary.totalSessions).toBe(1);
			expect(summary.activeSessions).toBe(1);
			expect(summary.latestSession?.sessionId).toBe('s1');
		});

		it('counts active sessions correctly', () => {
			let state = makeState();
			state = createSessionRecord({
				input: { sessionType: 'intake', status: 'open' },
				state,
			}).state;
			state = createSessionRecord({
				input: { sessionType: 'manual', status: 'completed' },
				state,
			}).state;
			state = createSessionRecord({
				input: { sessionType: 'validation', status: 'paused' },
				state,
			}).state;

			const summary = getCurrentSessionSummary(state);
			expect(summary.totalSessions).toBe(3);
			expect(summary.activeSessions).toBe(2);
		});
	});
});
