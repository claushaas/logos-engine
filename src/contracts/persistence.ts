/**
 * Persistence contracts — session snapshots, persisted sessions, and migrations.
 *
 * Snapshots enable fast resume. Events explain how state changed.
 * Migrations handle schema evolution.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md}
 * @see {@link https://logos-engine/docs/architecture/04-data-and-persistence-architecture.md}
 */
import type { SessionId } from '../shared/index.js';
import type { LogosRuntimeState } from './runtime-state.js';
import type { SessionEvent } from './session-event.js';

// ─── SessionSnapshot ───────────────────────────────────────────────────────

/**
 * A point-in-time snapshot of the full runtime state.
 *
 * Optimized for fast resume — the application layer can restore the
 * entire runtime state without replaying the event log.
 *
 * @see {@link https://logos-engine/docs/architecture/04-data-and-persistence-architecture.md §5}
 */
export type SessionSnapshot = {
	/** The session this snapshot belongs to (branded). */
	readonly sessionId: SessionId;

	/** Schema version string — used for migration compatibility checks. */
	readonly schemaVersion: string;

	/** The full runtime state at the time of the snapshot. */
	readonly runtimeState: LogosRuntimeState;

	/** ISO-8601 timestamp of when the snapshot was saved. */
	readonly savedAt: string;
};

// ─── PersistedSession ──────────────────────────────────────────────────────

/**
 * A fully persisted session — includes a snapshot for fast resume and
 * an event log for audit/replay.
 *
 * The `schemaVersion` at the top level mirrors `SessionSnapshot.schemaVersion`
 * and is the source of truth for migration decisions.
 */
export type PersistedSession = {
	/** Schema version — required, never omitted. */
	readonly schemaVersion: string;

	/** The session identifier (branded). */
	readonly sessionId: SessionId;

	/** The latest snapshot for fast resume. */
	readonly snapshot: SessionSnapshot;

	/** All events recorded for this session, in chronological order. */
	readonly events: SessionEvent[];
};

// ─── Migration ─────────────────────────────────────────────────────────────

/**
 * A migration from one schema version to another.
 *
 * Migrations are typed but accept `unknown` input at the boundary
 * to support deserialized data from disk.
 *
 * @see {@link https://logos-engine/docs/architecture/04-data-and-persistence-architecture.md §11}
 */
export type Migration<TFrom = unknown, TTo = unknown> = {
	/** The schema version this migration applies to. */
	readonly from: string;

	/** The target schema version after migration. */
	readonly to: string;

	/**
	 * Transform data from `from` version to `to` version.
	 *
	 * Must never silently discard node conversations or accepted canonical answers.
	 * If migration cannot preserve state, it should throw rather than corrupt data.
	 */
	readonly migrate: (data: TFrom) => TTo;
};
