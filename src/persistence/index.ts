/**
 * Persistence module — snapshot store, event log, and migration support.
 *
 * The persistence layer owns storage adapters, session snapshots, event
 * logs, and schema migrations. It must NOT interpret lifecycle rules,
 * prompt state, or document readiness — those are owned by the state
 * engine and conversation runtime.
 *
 * @see {@link https://logos-engine/docs/architecture/03-module-boundaries.md §12}
 */

export type {
	CreateEventLogOptions,
	EventLog,
	EventLogFs,
} from './event-log.js';
export {
	appendEvent,
	createEventLog,
	defaultEventLog,
	getEvents,
	getEventsByType,
} from './event-log.js';
export type {
	CreateSnapshotStoreOptions,
	PersistenceError,
	SessionSummary,
	SnapshotFs,
	SnapshotStore,
} from './snapshot-store.js';
export {
	CURRENT_SCHEMA_VERSION,
	createAutoSave,
	createSnapshotStore,
	defaultStore,
	listSessions,
	loadSnapshot,
	registerSignalHandlers,
	saveSnapshot,
} from './snapshot-store.js';
