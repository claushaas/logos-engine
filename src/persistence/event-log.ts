/**
 * Event log — append-only audit trail of session events stored as JSONL.
 *
 * Events record every meaningful state transition. They are stored as
 * one JSON object per line under `sessions/<encodedSessionId>/events.jsonl`.
 * The event log is append-only: existing events are never modified or
 * overwritten.
 *
 * The event log module owns storage and querying. It must NOT interpret
 * lifecycle rules, prompt state, or document readiness — those are owned
 * by the state engine and conversation runtime.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md §5-6}
 * @see {@link https://logos-engine/docs/architecture/04-data-and-persistence-architecture.md §6}
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { SessionEvent, SessionEventType } from '../contracts/index.js';
import { err, ok, type Result } from '../shared/index.js';

import type { PersistenceError } from './snapshot-store.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Filename for the JSONL event log within a session directory. */
const EVENTS_FILENAME = 'events.jsonl';

/** Default directory for session data (relative to CWD). */
const DEFAULT_SESSIONS_DIR = 'sessions';

// ═══════════════════════════════════════════════════════════════════════════
// Filesystem abstraction (injectable for testing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal filesystem interface used by the event log.
 *
 * Defaults to `node:fs/promises`. Injectable so tests can use temporary
 * directories and verify append-only behavior.
 */
export type EventLogFs = {
	mkdir(
		p: string,
		options?: { recursive?: boolean },
	): Promise<string | undefined>;
	appendFile(p: string, data: string): Promise<void>;
	readFile(p: string): Promise<string>;
	readdir(p: string): Promise<string[]>;
};

/** Default filesystem adapter — delegates to `node:fs/promises`. */
const defaultFs: EventLogFs = {
	appendFile: fs.appendFile,
	mkdir: fs.mkdir,
	readdir: fs.readdir,
	readFile: (p: string) => fs.readFile(p, 'utf-8'),
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode a session ID to a filesystem-safe directory name.
 */
function encodeSessionDir(sessionId: string): string {
	return encodeURIComponent(sessionId);
}

/**
 * Build the full path to the events.jsonl file for a session.
 */
function eventsPath(sessionsDir: string, sessionId: string): string {
	return path.join(sessionsDir, encodeSessionDir(sessionId), EVENTS_FILENAME);
}

// ═══════════════════════════════════════════════════════════════════════════
// Error constructors
// ═══════════════════════════════════════════════════════════════════════════

function persistErr(
	code: string,
	message: string,
	recoverable: boolean,
	recoveryOptions: ReadonlyArray<string> = [],
	path_?: string,
	cause?: unknown,
): PersistenceError {
	const base: PersistenceError = {
		code,
		message,
		recoverable,
		recoveryOptions,
	};
	if (path_ !== undefined) return { ...base, cause, path: path_ };
	if (cause !== undefined) return { ...base, cause };
	return base;
}

/**
 * Parse a JSONL string into an array of parsed JSON objects.
 *
 * Skips empty lines and lines that fail to parse (best-effort).
 */
function parseJsonl(raw: string): unknown[] {
	const lines = raw.split('\n');
	const results: unknown[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		try {
			results.push(JSON.parse(trimmed));
		} catch {
			// Skip corrupted lines — best-effort recovery.
		}
	}

	return results;
}

/**
 * Validate that a parsed object is a `SessionEvent` with all required fields.
 */
function isSessionEvent(obj: unknown): obj is SessionEvent {
	if (typeof obj !== 'object' || obj === null) return false;
	const o = obj as Record<string, unknown>;
	return (
		typeof o.id === 'string' &&
		typeof o.sessionId === 'string' &&
		typeof o.type === 'string' &&
		typeof o.createdAt === 'string' &&
		o.payload !== undefined &&
		o.payload !== null
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// EventLog type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Event log API — append-only event storage and querying for a session.
 *
 * Created via `createEventLog(...)` so tests can inject temporary
 * directories and mock filesystems.
 */
export type EventLog = {
	readonly appendEvent: (
		sessionId: string,
		event: SessionEvent,
	) => Promise<Result<void, PersistenceError>>;

	readonly getEvents: (sessionId: string) => Promise<SessionEvent[]>;

	readonly getEventsByType: (
		sessionId: string,
		type: SessionEventType,
	) => Promise<SessionEvent[]>;
};

// ═══════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for `createEventLog`.
 */
export type CreateEventLogOptions = {
	/** Directory where session event log files are stored. */
	readonly sessionsDir: string;
	/** Injectable filesystem adapter (for testing). */
	readonly fs?: EventLogFs;
};

/**
 * Create an event log.
 *
 * @param options.sessionsDir — Directory for session event log files.
 * @param options.fs — Injectable filesystem (defaults to `node:fs/promises`).
 */
export function createEventLog(options: CreateEventLogOptions): EventLog {
	const sessionsDir = options.sessionsDir;
	const fsAdapter = options.fs ?? defaultFs;

	// ── Ensure session directory exists ──────────────────────────────
	async function ensureSessionDir(
		sessionId: string,
	): Promise<Result<void, PersistenceError>> {
		const dirPath = path.join(sessionsDir, encodeSessionDir(sessionId));
		try {
			await fsAdapter.mkdir(dirPath, { recursive: true });
			return ok(undefined);
		} catch (cause: unknown) {
			return err(
				persistErr(
					'PERSISTENCE_DIR_CREATE_FAILED',
					`Could not create session directory for "${sessionId}": ${String(cause)}`,
					false,
					['Check filesystem permissions.'],
					dirPath,
					cause,
				),
			);
		}
	}

	// ── appendEvent ──────────────────────────────────────────────────
	async function appendEvent(
		sessionId: string,
		event: SessionEvent,
	): Promise<Result<void, PersistenceError>> {
		// Validate event.sessionId matches the target session.
		if (event.sessionId !== sessionId) {
			return err(
				persistErr(
					'PERSISTENCE_EVENT_SESSION_MISMATCH',
					`Event sessionId "${event.sessionId}" does not match target session "${sessionId}".`,
					false,
					['Check the event source and correct the session ID.'],
				),
			);
		}

		const dirResult = await ensureSessionDir(sessionId);
		if (!dirResult.ok) return dirResult;

		const filePath = eventsPath(sessionsDir, sessionId);

		try {
			const line = `${JSON.stringify(event)}\n`;
			await fsAdapter.appendFile(filePath, line);
			return ok(undefined);
		} catch (cause: unknown) {
			return err(
				persistErr(
					'PERSISTENCE_WRITE_FAILED',
					`Could not append event to event log for session "${sessionId}": ${String(cause)}`,
					true,
					['Retry the append operation.', 'Check disk space and permissions.'],
					filePath,
					cause,
				),
			);
		}
	}

	// ── getEvents ────────────────────────────────────────────────────
	async function getEvents(sessionId: string): Promise<SessionEvent[]> {
		const filePath = eventsPath(sessionsDir, sessionId);

		let raw: string;
		try {
			raw = await fsAdapter.readFile(filePath);
		} catch (cause: unknown) {
			const nodeErr = cause as NodeJS.ErrnoException;
			if (nodeErr?.code === 'ENOENT') {
				// No event log yet — return empty array.
				return [];
			}
			// Other errors — best-effort: return empty.
			return [];
		}

		const parsed = parseJsonl(raw);
		return parsed.filter(isSessionEvent);
	}

	// ── getEventsByType ──────────────────────────────────────────────
	async function getEventsByType(
		sessionId: string,
		type: SessionEventType,
	): Promise<SessionEvent[]> {
		const all = await getEvents(sessionId);
		return all.filter((e) => e.type === type);
	}

	return { appendEvent, getEvents, getEventsByType };
}

// ═══════════════════════════════════════════════════════════════════════════
// Default store instance
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default event log — stores events under `$CWD/sessions/<sessionId>/events.jsonl`.
 *
 * This is the convenience instance used by the application layer and
 * the CLI entry point for typical operation.
 */
export const defaultEventLog: EventLog = createEventLog({
	sessionsDir: path.resolve(process.cwd(), DEFAULT_SESSIONS_DIR),
});

// ═══════════════════════════════════════════════════════════════════════════
// Convenience functions (delegate to default event log)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Append a session event to the event log.
 *
 * Uses the default event log (`$CWD/sessions/<sessionId>/events.jsonl`).
 * For testing or custom directories, use `createEventLog(...)` instead.
 */
export function appendEvent(
	sessionId: string,
	event: SessionEvent,
): Promise<Result<void, PersistenceError>> {
	return defaultEventLog.appendEvent(sessionId, event);
}

/**
 * Read all events for a session.
 *
 * Uses the default event log. Returns an empty array if no event log exists.
 */
export function getEvents(sessionId: string): Promise<SessionEvent[]> {
	return defaultEventLog.getEvents(sessionId);
}

/**
 * Read events of a specific type for a session.
 *
 * Uses the default event log. Returns an empty array if no matching events exist.
 */
export function getEventsByType(
	sessionId: string,
	type: SessionEventType,
): Promise<SessionEvent[]> {
	return defaultEventLog.getEventsByType(sessionId, type);
}
