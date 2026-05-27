/**
 * Snapshot store — local persistence of session snapshots as JSON files.
 *
 * Snapshots are saved after each completed agent turn and enable fast
 * resume without replaying the full event log. This module follows the
 * module boundary rules: it treats runtime state as opaque data and
 * never interprets lifecycle rules, prompt state, or document readiness.
 *
 * Atomic writes (temp file → rename) prevent partial saves. Every
 * snapshot carries a `schemaVersion` for migration compatibility.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md}
 * @see {@link https://logos-engine/docs/architecture/04-data-and-persistence-architecture.md}
 * @see {@link https://logos-engine/docs/architecture/03-module-boundaries.md §12}
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { SessionSnapshot } from '../contracts/persistence.js';
import type { LogosRuntimeState } from '../contracts/runtime-state.js';
import { type Result, err, generateId, nowIso, ok } from '../shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Current schema version — must be present in every persisted snapshot. */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/** File extension for snapshot JSON files. */
const SNAPSHOT_EXTENSION = '.snapshot.json';

/** File extension for temporary write files (atomic write protocol). */
const TEMP_EXTENSION = '.tmp';

/** Default directory for session snapshots (relative to CWD). */
const DEFAULT_SESSIONS_DIR = 'sessions';

// ═══════════════════════════════════════════════════════════════════════════
// Error types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Structured persistence error.
 *
 * Every error carries a machine-readable `code` and a `recoverable`
 * flag. When `recoverable` is `true`, `recoveryOptions` enumerates
 * possible user actions (e.g., restore backup, start fresh, inspect).
 */
export type PersistenceError = {
	/** Machine-readable error code (e.g., `PERSISTENCE_WRITE_FAILED`). */
	readonly code: string;
	/** Human-readable error message. */
	readonly message: string;
	/** Whether automatic or guided recovery is possible. */
	readonly recoverable: boolean;
	/** Recovery actions the caller can offer to the user. */
	readonly recoveryOptions: ReadonlyArray<string>;
	/** File path involved, if applicable. */
	readonly path?: string;
	/** Underlying system error, if available. */
	readonly cause?: unknown;
};

// ═══════════════════════════════════════════════════════════════════════════
// SessionSummary
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lightweight session summary for the session list view.
 *
 * Does not include the full runtime state — only enough metadata to
 * display a session picker in the TUI or CLI.
 */
export type SessionSummary = {
	/** The session ID extracted from the snapshot. */
	readonly sessionId: string;
	/** ISO-8601 timestamp of when the snapshot was saved. */
	readonly savedAt: string;
	/** Schema version of the snapshot. */
	readonly schemaVersion: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// Low-level filesystem abstraction (injectable for testing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal filesystem interface used by the snapshot store.
 *
 * Defaults to `node:fs/promises`. Injectable so tests can use temporary
 * directories and verify atomic write ordering.
 */
export type SnapshotFs = {
	mkdir(
		path: string,
		options?: { recursive?: boolean },
	): Promise<string | undefined>;
	writeFile(path: string, data: string): Promise<void>;
	readFile(path: string): Promise<string>;
	rename(oldPath: string, newPath: string): Promise<void>;
	unlink(path: string): Promise<void>;
	readdir(path: string): Promise<string[]>;
	stat(path: string): Promise<{ mtimeMs: number }>;
};

/** Default filesystem adapter — delegates to `node:fs/promises`. */
const defaultFs: SnapshotFs = {
	mkdir: fs.mkdir,
	writeFile: fs.writeFile,
	readFile: (p: string) => fs.readFile(p, 'utf-8'),
	rename: fs.rename,
	unlink: fs.unlink,
	readdir: fs.readdir,
	stat: fs.stat,
};

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
	if (path_ !== undefined) return { ...base, path: path_, cause };
	if (cause !== undefined) return { ...base, cause };
	return base;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode a session ID to a filesystem-safe filename component.
 *
 * Replaces characters that are problematic on most filesystems (/, \\, :,
 * etc.) with underscore. The resulting name is safe but reversible.
 */
function encodeFilename(sessionId: string): string {
	// Replace path separators and other problematic characters.
	return encodeURIComponent(sessionId);
}

/**
 * Build the full path for a session snapshot file.
 */
function snapshotPath(sessionsDir: string, sessionId: string): string {
	return path.join(
		sessionsDir,
		`${encodeFilename(sessionId)}${SNAPSHOT_EXTENSION}`,
	);
}

/**
 * Build the full path for a temporary write file.
 */
function tempPath(
	sessionsDir: string,
	sessionId: string,
	suffix: string,
): string {
	return path.join(
		sessionsDir,
		`${encodeFilename(sessionId)}${SNAPSHOT_EXTENSION}.${suffix}${TEMP_EXTENSION}`,
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// SnapshotStore type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Snapshot store API — all persistence operations for session snapshots.
 *
 * Created via `createSnapshotStore(...)` so tests can inject temporary
 * directories and mock filesystems.
 */
export type SnapshotStore = {
	readonly saveSnapshot: (
		sessionId: string,
		state: LogosRuntimeState,
	) => Promise<Result<void, PersistenceError>>;

	readonly loadSnapshot: (
		sessionId: string,
	) => Promise<Result<SessionSnapshot, PersistenceError>>;

	readonly listSessions: () => Promise<SessionSummary[]>;
};

// ═══════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for `createSnapshotStore`.
 */
export type CreateSnapshotStoreOptions = {
	/** Directory where session snapshot files are stored. */
	readonly sessionsDir: string;
	/** Injectable filesystem adapter (for testing). */
	readonly fs?: SnapshotFs;
};

/**
 * Create a snapshot store.
 *
 * @param options.sessionsDir — Directory for snapshot files.
 * @param options.fs — Injectable filesystem (defaults to `node:fs/promises`).
 */
export function createSnapshotStore(
	options: CreateSnapshotStoreOptions,
): SnapshotStore {
	const sessionsDir = options.sessionsDir;
	const fsAdapter = options.fs ?? defaultFs;

	// ── Ensure sessions directory exists ─────────────────────────────
	async function ensureDir(): Promise<Result<void, PersistenceError>> {
		try {
			await fsAdapter.mkdir(sessionsDir, { recursive: true });
			return ok(undefined);
		} catch (cause: unknown) {
			return err(
				persistErr(
					'PERSISTENCE_DIR_CREATE_FAILED',
					`Could not create sessions directory "${sessionsDir}": ${String(cause)}`,
					false,
					['Check filesystem permissions.'],
					sessionsDir,
					cause,
				),
			);
		}
	}

	// ── saveSnapshot ─────────────────────────────────────────────────
	async function saveSnapshot(
		sessionId: string,
		state: LogosRuntimeState,
	): Promise<Result<void, PersistenceError>> {
		const dirResult = await ensureDir();
		if (!dirResult.ok) return dirResult;

		const finalPath = snapshotPath(sessionsDir, sessionId);
		// Use a unique suffix so concurrent saves to the same session
		// do not stomp each other's temp files.
		const suffix = generateId();
		const tmpPath = tempPath(sessionsDir, sessionId, suffix);

		const snapshot: SessionSnapshot = {
			sessionId: sessionId as import('../shared/index.js').SessionId,
			schemaVersion: CURRENT_SCHEMA_VERSION,
			runtimeState: state,
			savedAt: nowIso(),
		};

		try {
			const json = JSON.stringify(snapshot, null, 2);

			// Atomic write protocol:
			// 1. Write to temp file.
			await fsAdapter.writeFile(tmpPath, json);
			// 2. Rename temp file to final path (atomic on most OSes).
			await fsAdapter.rename(tmpPath, finalPath);

			return ok(undefined);
		} catch (cause: unknown) {
			// Clean up the temp file if it still exists.
			try {
				await fsAdapter.unlink(tmpPath);
			} catch {
				// Best-effort cleanup — ignore errors.
			}

			return err(
				persistErr(
					'PERSISTENCE_WRITE_FAILED',
					`Could not save snapshot for session "${sessionId}": ${String(cause)}`,
					true,
					['Retry the save operation.', 'Check disk space and permissions.'],
					finalPath,
					cause,
				),
			);
		}
	}

	// ── loadSnapshot ─────────────────────────────────────────────────
	async function loadSnapshot(
		sessionId: string,
	): Promise<Result<SessionSnapshot, PersistenceError>> {
		const finalPath = snapshotPath(sessionsDir, sessionId);

		let raw: string;
		try {
			raw = await fsAdapter.readFile(finalPath);
		} catch (cause: unknown) {
			const nodeErr = cause as NodeJS.ErrnoException;
			if (nodeErr?.code === 'ENOENT') {
				return err(
					persistErr(
						'PERSISTENCE_SESSION_NOT_FOUND',
						`Session "${sessionId}" not found.`,
						true,
						['Start a new session.', 'Check the session ID and try again.'],
						finalPath,
						cause,
					),
				);
			}

			return err(
				persistErr(
					'PERSISTENCE_READ_FAILED',
					`Could not read snapshot for session "${sessionId}": ${String(cause)}`,
					true,
					['Check filesystem permissions.', 'Retry the load operation.'],
					finalPath,
					cause,
				),
			);
		}

		// Parse JSON.
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch (cause: unknown) {
			return err(
				persistErr(
					'PERSISTENCE_CORRUPT_SNAPSHOT',
					`Snapshot file for session "${sessionId}" contains invalid JSON: ${String(cause)}`,
					true,
					[
						'Inspect and manually repair the snapshot file.',
						'Delete the corrupted snapshot and start a new session.',
						'Restore from a backup if available.',
					],
					finalPath,
					cause,
				),
			);
		}

		// Minimal structural validation — treat state as opaque, only
		// verify the shape required for persistence to function.
		if (typeof parsed !== 'object' || parsed === null) {
			return err(
				persistErr(
					'PERSISTENCE_CORRUPT_SNAPSHOT',
					`Snapshot file for session "${sessionId}" is not a JSON object.`,
					true,
					[
						'Inspect and manually repair the snapshot file.',
						'Delete the corrupted snapshot and start a new session.',
						'Restore from a backup if available.',
					],
					finalPath,
				),
			);
		}

		const obj = parsed as Record<string, unknown>;

		if (typeof obj.schemaVersion !== 'string') {
			return err(
				persistErr(
					'PERSISTENCE_CORRUPT_SNAPSHOT',
					`Snapshot file for session "${sessionId}" is missing or has an invalid "schemaVersion" field.`,
					true,
					[
						'Inspect and manually repair the snapshot file.',
						'Delete the corrupted snapshot and start a new session.',
					],
					finalPath,
				),
			);
		}

		if (typeof obj.sessionId !== 'string') {
			return err(
				persistErr(
					'PERSISTENCE_CORRUPT_SNAPSHOT',
					`Snapshot file for session "${sessionId}" is missing or has an invalid "sessionId" field.`,
					true,
					[
						'Inspect and manually repair the snapshot file.',
						'Delete the corrupted snapshot and start a new session.',
					],
					finalPath,
				),
			);
		}

		if (typeof obj.savedAt !== 'string') {
			return err(
				persistErr(
					'PERSISTENCE_CORRUPT_SNAPSHOT',
					`Snapshot file for session "${sessionId}" is missing or has an invalid "savedAt" field.`,
					true,
					[
						'Inspect and manually repair the snapshot file.',
						'Delete the corrupted snapshot and start a new session.',
					],
					finalPath,
				),
			);
		}

		if (obj.runtimeState === undefined || obj.runtimeState === null) {
			return err(
				persistErr(
					'PERSISTENCE_CORRUPT_SNAPSHOT',
					`Snapshot file for session "${sessionId}" is missing a "runtimeState" field.`,
					true,
					[
						'Inspect and manually repair the snapshot file.',
						'Delete the corrupted snapshot and start a new session.',
					],
					finalPath,
				),
			);
		}

		// Treat runtimeState as opaque — we do NOT interpret lifecycle,
		// completeness, or any other domain rules.
		return ok({
			sessionId: obj.sessionId as SessionSnapshot['sessionId'],
			schemaVersion: obj.schemaVersion,
			runtimeState: obj.runtimeState as LogosRuntimeState,
			savedAt: obj.savedAt,
		});
	}

	// ── listSessions ─────────────────────────────────────────────────
	async function listSessions(): Promise<SessionSummary[]> {
		let entries: string[];
		try {
			entries = await fsAdapter.readdir(sessionsDir);
		} catch {
			// Directory doesn't exist or is unreadable — return empty.
			return [];
		}

		const summaries: SessionSummary[] = [];

		for (const entry of entries) {
			if (!entry.endsWith(SNAPSHOT_EXTENSION)) continue;

			const filePath = path.join(sessionsDir, entry);

			// Extract session ID from filename (reverse of encodeFilename).
			const encodedId = entry.slice(0, -SNAPSHOT_EXTENSION.length);
			let sessionId: string;
			try {
				sessionId = decodeURIComponent(encodedId);
			} catch {
				// Malformed filename — skip this entry.
				continue;
			}

			// Read minimal metadata (file stat) for speed — we do NOT
			// parse the full snapshot for a listing.
			let stat: { mtimeMs: number };
			try {
				stat = await fsAdapter.stat(filePath);
			} catch {
				// File disappeared between readdir and stat — skip.
				continue;
			}

			// Attempt to read just the schemaVersion without full parse.
			// For a proper listing we need to peek into the file. We read
			// the first ~500 bytes and extract schemaVersion with a regex
			// to avoid parsing the full runtime state.
			let schemaVersion = 'unknown';
			try {
				const head = await fsAdapter.readFile(filePath);
				// Truncate to ~500 bytes for the header extraction.
				const headSnippet = head.slice(0, 500);
				const match = /"schemaVersion"\s*:\s*"([^"]*)"/.exec(headSnippet);
				if (match?.[1]) {
					schemaVersion = match[1];
				}
			} catch {
				// If we can't read it, use 'unknown'.
			}

			summaries.push({
				sessionId,
				savedAt: new Date(stat.mtimeMs).toISOString(),
				schemaVersion,
			});
		}

		// Sort by savedAt descending (most recent first).
		summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

		return summaries;
	}

	return { loadSnapshot, listSessions, saveSnapshot };
}

// ═══════════════════════════════════════════════════════════════════════════
// Default store instance
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default snapshot store — saves to `$CWD/sessions/`.
 *
 * This is the convenience instance used by the application layer and
 * the CLI entry point for typical operation.
 */
export const defaultStore: SnapshotStore = createSnapshotStore({
	sessionsDir: path.resolve(process.cwd(), DEFAULT_SESSIONS_DIR),
});

// ═══════════════════════════════════════════════════════════════════════════
// Convenience functions (delegate to default store)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Save a runtime state snapshot for the given session.
 *
 * Uses the default store (`$CWD/sessions/`). For testing or custom
 * directories, use `createSnapshotStore(...)` instead.
 */
export function saveSnapshot(
	sessionId: string,
	state: LogosRuntimeState,
): Promise<Result<void, PersistenceError>> {
	return defaultStore.saveSnapshot(sessionId, state);
}

/**
 * Load a previously saved session snapshot.
 *
 * Uses the default store (`$CWD/sessions/`).
 */
export function loadSnapshot(
	sessionId: string,
): Promise<Result<SessionSnapshot, PersistenceError>> {
	return defaultStore.loadSnapshot(sessionId);
}

/**
 * List all available sessions.
 *
 * Uses the default store (`$CWD/sessions/`).
 */
export function listSessions(): Promise<SessionSummary[]> {
	return defaultStore.listSessions();
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-save hook and signal handling
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an auto-save function that can be called after each completed
 * agent turn.
 *
 * The returned function saves the given state to the provided session.
 * The caller (CLI entry point, Step 16.1) invokes this after every
 * successful `applyAgentTurn`.
 *
 * @param store - The snapshot store to use (typically `defaultStore`).
 * @param sessionId - The session to save to.
 * @returns An async function `(state) => Promise<Result<void, PersistenceError>>`.
 */
export function createAutoSave(
	store: SnapshotStore,
	sessionId: string,
): (state: LogosRuntimeState) => Promise<Result<void, PersistenceError>> {
	return (state) => store.saveSnapshot(sessionId, state);
}

/**
 * Register signal handlers that save the current runtime state on
 * SIGINT and SIGTERM.
 *
 * The caller must provide:
 * - The snapshot store.
 * - The session ID.
 * - A synchronous function that returns the current `LogosRuntimeState`.
 *
 * When a signal is received, the handler saves a final snapshot and
 * then exits (allowing the OS default behavior after the save).
 *
 * **Note:** Signal handlers are global. Only one set of handlers
 * should be registered per process. This function is intended to be
 * called once from the CLI entry point (Step 16.1).
 *
 * @param store - The snapshot store.
 * @param sessionId - The session to save.
 * @param getState - Synchronous getter for the current runtime state.
 * @returns A cleanup function that removes the signal handlers.
 */
export function registerSignalHandlers(
	store: SnapshotStore,
	sessionId: string,
	getState: () => LogosRuntimeState,
): () => void {
	const handler = async () => {
		// Attempt a final save, then exit.
		try {
			await store.saveSnapshot(sessionId, getState());
		} catch {
			// Best-effort — do not block process exit.
		}
		process.exit(0);
	};

	process.once('SIGINT', handler);
	process.once('SIGTERM', handler);

	// Return a cleanup function.
	return () => {
		process.removeListener('SIGINT', handler);
		process.removeListener('SIGTERM', handler);
	};
}
