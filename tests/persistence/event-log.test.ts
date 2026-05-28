/**
 * Tests for Step 13.2 — event log persistence.
 *
 * Covers:
 *  - appendEvent and getEvents in order.
 *  - Appends without overwriting existing events.
 *  - getEventsByType filtering.
 *  - Verifies required fields (id, sessionId, type, payload, createdAt) exist.
 *  - Missing event log returns [].
 *  - Mismatched sessionId returns PersistenceError.
 */
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type {
	SessionEvent,
	SessionEventType,
} from '../../src/contracts/index.js';
import {
	createEventLog,
	type EventLog,
	type EventLogFs,
} from '../../src/persistence/event-log.js';
import type { PersistenceError } from '../../src/persistence/snapshot-store.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function tempDir(): Promise<string> {
	return realpath(await mkdtemp(join(tmpdir(), 'logos-eventlog-test-')));
}

function makeEvent(
	sessionId: string,
	type: SessionEventType,
	payload: Record<string, unknown> = {},
	id = `evt-${Math.random().toString(36).slice(2, 8)}`,
	createdAt = new Date().toISOString(),
): SessionEvent {
	return {
		createdAt,
		id,
		payload,
		sessionId: sessionId as import('../../src/shared/index.js').SessionId,
		type,
	} as SessionEvent;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('event-log', () => {
	let log: EventLog;
	let dir: string;

	afterEach(async () => {
		// OS tmp directory handles cleanup.
	});

	async function freshLog(): Promise<EventLog> {
		dir = await tempDir();
		log = createEventLog({ sessionsDir: dir });
		return log;
	}

	// ─────────────────────────────────────────────────────────────────
	// appendEvent + getEvents
	// ─────────────────────────────────────────────────────────────────

	describe('appendEvent + getEvents', () => {
		it('should append and read events in order', async () => {
			const l = await freshLog();
			const sid = 'test-session';

			const e1 = makeEvent(
				sid,
				'SESSION_CREATED',
				{ createdAt: '2026-01-01T00:00:00Z' },
				'evt-1',
				'2026-01-01T00:00:00Z',
			);
			const e2 = makeEvent(
				sid,
				'PROFILE_SELECTED',
				{ profileId: 'p1' },
				'evt-2',
				'2026-01-01T00:01:00Z',
			);

			const r1 = await l.appendEvent(sid, e1);
			expect(r1.ok).toBe(true);

			const r2 = await l.appendEvent(sid, e2);
			expect(r2.ok).toBe(true);

			const events = await l.getEvents(sid);
			expect(events).toHaveLength(2);
			expect(events[0]?.id).toBe('evt-1');
			expect(events[0]?.type).toBe('SESSION_CREATED');
			expect(events[1]?.id).toBe('evt-2');
			expect(events[1]?.type).toBe('PROFILE_SELECTED');
		});

		it('should append without overwriting existing events', async () => {
			const l = await freshLog();
			const sid = 'append-only';

			const e1 = makeEvent(
				sid,
				'SESSION_CREATED',
				{ createdAt: '2026-01-01T00:00:00Z' },
				'evt-1',
			);
			await l.appendEvent(sid, e1);

			const e2 = makeEvent(
				sid,
				'PROFILE_SELECTED',
				{ profileId: 'p1' },
				'evt-2',
			);
			await l.appendEvent(sid, e2);

			const events = await l.getEvents(sid);
			expect(events).toHaveLength(2);
			expect(events[0]?.id).toBe('evt-1');
			expect(events[1]?.id).toBe('evt-2');
		});

		it('should return empty array when no events exist', async () => {
			const l = await freshLog();
			const events = await l.getEvents('no-such-session');
			expect(events).toEqual([]);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// getEventsByType
	// ─────────────────────────────────────────────────────────────────

	describe('getEventsByType', () => {
		it('should filter events by type', async () => {
			const l = await freshLog();
			const sid = 'type-filter';

			await l.appendEvent(
				sid,
				makeEvent(
					sid,
					'SESSION_CREATED',
					{ createdAt: '2026-01-01T00:00:00Z' },
					'evt-1',
				),
			);
			await l.appendEvent(
				sid,
				makeEvent(sid, 'PROFILE_SELECTED', { profileId: 'p1' }, 'evt-2'),
			);
			await l.appendEvent(
				sid,
				makeEvent(
					sid,
					'NODE_SELECTED',
					{ nodeId: 'n1', previousNodeId: null },
					'evt-3',
				),
			);
			await l.appendEvent(
				sid,
				makeEvent(
					sid,
					'PROFILE_CHANGED',
					{ newProfileId: 'p2', previousProfileId: 'p1' },
					'evt-4',
				),
			);

			const profileEvents = await l.getEventsByType(sid, 'PROFILE_SELECTED');
			expect(profileEvents).toHaveLength(1);
			expect(profileEvents[0]?.id).toBe('evt-2');

			const nodeEvents = await l.getEventsByType(sid, 'NODE_SELECTED');
			expect(nodeEvents).toHaveLength(1);
			expect(nodeEvents[0]?.id).toBe('evt-3');

			const lifecycleEvents = await l.getEventsByType(
				sid,
				'NODE_LIFECYCLE_CHANGED',
			);
			expect(lifecycleEvents).toHaveLength(0);
		});

		it('should return empty array for unknown session', async () => {
			const l = await freshLog();
			const events = await l.getEventsByType('unknown', 'SESSION_CREATED');
			expect(events).toEqual([]);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Required fields
	// ─────────────────────────────────────────────────────────────────

	describe('event fields', () => {
		it('should contain all required fields: id, sessionId, type, payload, createdAt', async () => {
			const l = await freshLog();
			const sid = 'fields-check';

			const event = makeEvent(
				sid,
				'NODE_LIFECYCLE_CHANGED',
				{ from: 'not_started', nodeId: 'n1', to: 'active' },
				'evt-lc',
				'2026-01-15T12:00:00Z',
			);

			await l.appendEvent(sid, event);
			const events = await l.getEvents(sid);
			expect(events).toHaveLength(1);

			const loaded = events[0]!;
			expect(loaded.id).toBe('evt-lc');
			expect(loaded.sessionId).toBe(sid);
			expect(loaded.type).toBe('NODE_LIFECYCLE_CHANGED');
			expect(loaded.createdAt).toBe('2026-01-15T12:00:00Z');
			expect(loaded.payload).toEqual({
				from: 'not_started',
				nodeId: 'n1',
				to: 'active',
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Mismatched sessionId
	// ─────────────────────────────────────────────────────────────────

	describe('sessionId validation', () => {
		it('should return error when event sessionId does not match target session', async () => {
			const l = await freshLog();
			const event = makeEvent('wrong-session', 'SESSION_CREATED', {
				createdAt: '2026-01-01T00:00:00Z',
			});

			const result = await l.appendEvent('target-session', event);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			const err = result.error as PersistenceError;
			expect(err.code).toBe('PERSISTENCE_EVENT_SESSION_MISMATCH');
			expect(err.recoverable).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Append-only (mock fs verification)
	// ─────────────────────────────────────────────────────────────────

	describe('append-only behavior', () => {
		it('should use appendFile, not writeFile', async () => {
			const callLog: string[] = [];
			const { default: fs } = await import('node:fs/promises');

			const mockFs: EventLogFs = {
				appendFile: async (p, data) => {
					callLog.push(`appendFile:${p}`);
					return fs.appendFile(p, data);
				},
				mkdir: async (p, opts) => {
					callLog.push(`mkdir:${p}`);
					return fs.mkdir(p, opts);
				},
				readdir: async (p) => {
					callLog.push(`readdir:${p}`);
					return fs.readdir(p);
				},
				readFile: async (p) => {
					callLog.push(`readFile:${p}`);
					return fs.readFile(p, 'utf-8');
				},
			};

			const mockLog = createEventLog({
				fs: mockFs,
				sessionsDir: await tempDir(),
			});

			const event = makeEvent('append-verify', 'SESSION_CREATED', {
				createdAt: '2026-01-01T00:00:00Z',
			});
			const result = await mockLog.appendEvent('append-verify', event);
			expect(result.ok).toBe(true);

			// Verify appendFile was called and never writeFile.
			const hasAppend = callLog.some((c) => c.startsWith('appendFile:'));
			expect(hasAppend).toBe(true);
		});

		it('should persist multiple events across separate append calls', async () => {
			const l = await freshLog();
			const sid = 'multi-append';

			await l.appendEvent(
				sid,
				makeEvent(
					sid,
					'SESSION_CREATED',
					{ createdAt: '2026-01-01T00:00:00Z' },
					'evt-a',
				),
			);
			await l.appendEvent(
				sid,
				makeEvent(sid, 'PROFILE_SELECTED', { profileId: 'p1' }, 'evt-b'),
			);
			await l.appendEvent(
				sid,
				makeEvent(
					sid,
					'NODE_SELECTED',
					{ nodeId: 'n1', previousNodeId: null },
					'evt-c',
				),
			);

			// Re-open the log (simulate process restart).
			const newLog = createEventLog({ sessionsDir: dir });
			const events = await newLog.getEvents(sid);

			expect(events).toHaveLength(3);
			expect(events.map((e) => e.id)).toEqual(['evt-a', 'evt-b', 'evt-c']);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Write failure
	// ─────────────────────────────────────────────────────────────────

	describe('write failure', () => {
		it('should return PersistenceError when append fails', async () => {
			const mockFs: EventLogFs = {
				appendFile: async () => {
					throw new Error('Simulated disk full');
				},
				mkdir: async () => undefined,
				readdir: async () => [],
				readFile: async () => {
					throw new Error('should not be called');
				},
			};

			const mockLog = createEventLog({
				fs: mockFs,
				sessionsDir: '/mock/dir',
			});

			const event = makeEvent('fail-session', 'SESSION_CREATED', {
				createdAt: '2026-01-01T00:00:00Z',
			});
			const result = await mockLog.appendEvent('fail-session', event);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('unreachable');
			const err = result.error as PersistenceError;
			expect(err.code).toBe('PERSISTENCE_WRITE_FAILED');
			expect(err.recoverable).toBe(true);
			expect(err.recoveryOptions.length).toBeGreaterThan(0);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// Corrupted JSONL recovery
	// ─────────────────────────────────────────────────────────────────

	describe('corrupted JSONL recovery', () => {
		it('should skip corrupted lines and return valid events', async () => {
			const { default: fs } = await import('node:fs/promises');
			const testDir = await tempDir();
			const sessionDir = join(testDir, encodeURIComponent('corrupt-session'));
			await fs.mkdir(sessionDir, { recursive: true });

			// Write a mix of valid and invalid JSONL.
			const valid1 = JSON.stringify(
				makeEvent(
					'corrupt-session',
					'SESSION_CREATED',
					{ createdAt: '2026-01-01T00:00:00Z' },
					'good-1',
				),
			);
			const valid2 = JSON.stringify(
				makeEvent(
					'corrupt-session',
					'PROFILE_SELECTED',
					{ profileId: 'p1' },
					'good-2',
				),
			);
			const content = `${[
				valid1,
				'{not-valid-json',
				'', // empty line — should be skipped
				valid2,
				'{"type":"missing-fields"}', // missing required fields
			].join('\n')}\n`;

			await fs.writeFile(join(sessionDir, 'events.jsonl'), content);

			const l = createEventLog({ sessionsDir: testDir });
			const events = await l.getEvents('corrupt-session');

			// Only the two valid events should be returned.
			expect(events).toHaveLength(2);
			expect(events[0]?.id).toBe('good-1');
			expect(events[1]?.id).toBe('good-2');
		});
	});
});
