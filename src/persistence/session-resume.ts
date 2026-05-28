/**
 * Session resume — detects, validates, and restores a previous session.
 *
 * On launch, the system checks for existing sessions via `listSessions()`.
 * If one is found, the `resumeSession()` function loads the latest snapshot,
 * validates the runtime state, repairs safe inconsistencies, and returns
 * the restored `LogosRuntimeState` for the application layer to dispatch.
 *
 * The module is the entry point for session continuity. It collaborates
 * with the snapshot store, the migration engine, and (optionally) the
 * profile loader to validate the runtime state before handing it off.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md §10}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.9}
 */

import type {
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../contracts/index.js';
import type { Migration } from '../contracts/persistence.js';
import {
	err,
	type NodeId,
	nowIso,
	ok,
	type ProfileId,
	type Result,
} from '../shared/index.js';
import { runMigrations } from './migrations.js';
import type { SnapshotStore } from './snapshot-store.js';
import { CURRENT_SCHEMA_VERSION, defaultStore } from './snapshot-store.js';

// ═══════════════════════════════════════════════════════════════════════════
// Error types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resume recovery action — describes how the caller can recover from
 * a non-fatal resume error.
 */
export type ResumeRecovery =
	| 'select_new_profile'
	| 'create_new_session'
	| 'inspect_snapshot';

/**
 * Structured error returned by `resumeSession`.
 *
 * Every error carries a machine-readable `code`, a `recoverable` flag,
 * and `recoveryOptions` suggesting next steps. The application layer
 * can surface these to the user or automate recovery.
 */
export type ResumeError = {
	/** Machine-readable error code. */
	readonly code: string;
	/** Human-readable description. */
	readonly message: string;
	/** Whether the error is recoverable. */
	readonly recoverable: boolean;
	/** Possible recovery actions. */
	readonly recoveryOptions: ReadonlyArray<ResumeRecovery>;
	/** The session ID that triggered the error, if known. */
	readonly sessionId?: string;
	/** Underlying cause, if available. */
	readonly cause?: unknown;
	/** Partially-repaired state, if a partial repair was attempted. */
	readonly repairedState?: LogosRuntimeState;
};

function resumeErr(
	code: string,
	message: string,
	recoverable: boolean,
	recoveryOptions: ReadonlyArray<ResumeRecovery> = [],
	extra?: {
		sessionId?: string;
		cause?: unknown;
		repairedState?: LogosRuntimeState;
	},
): ResumeError {
	return {
		code,
		message,
		recoverable,
		recoveryOptions,
		...(extra?.sessionId !== undefined ? { sessionId: extra.sessionId } : {}),
		...(extra?.cause !== undefined ? { cause: extra.cause } : {}),
		...(extra?.repairedState !== undefined
			? { repairedState: extra.repairedState }
			: {}),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Options
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for `resumeSession`.
 *
 * All fields are optional — defaults use the singleton snapshot store
 * and an empty migration list. Tests inject custom stores, profile
 * loaders, and migrations.
 */
export type ResumeSessionOptions = {
	/** Snapshot store to use (default: `defaultStore`). */
	readonly store?: SnapshotStore;

	/**
	 * Profile loader function.
	 *
	 * Receives a `ProfileId` and must return a `Result<LogosProfile, unknown>`.
	 * If not provided, the session will be restored to idle mode without
	 * profile validation — the application layer must prompt the user to
	 * re-select a profile.
	 */
	readonly loadProfile?: (
		profileId: ProfileId,
	) => Result<LogosProfile, unknown> | Promise<Result<LogosProfile, unknown>>;

	/** Migrations to apply (default: empty — identity only). */
	readonly migrations?: ReadonlyArray<Migration>;
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recompute the session mode from the runtime state's primary fields.
 *
 * This is a simplified mode resolution that does NOT require a loaded
 * profile. It is used during resume when the profile may not be
 * available yet.
 */
function resolveModeFromState(
	state: LogosRuntimeState,
): LogosRuntimeState['mode'] {
	if (state.activeNodeId !== null) return 'node_focus';
	if (state.selectedProfileId !== null) return 'structure_overview';
	return 'idle';
}

/**
 * Produce a repaired copy of the runtime state with updated `mode`
 * and `updatedAt`.
 */
function withMode(
	state: LogosRuntimeState,
	mode: LogosRuntimeState['mode'],
): LogosRuntimeState {
	// If mode already matches, return as-is to preserve structural sharing.
	if (state.mode === mode) return state;

	return {
		...state,
		mode,
		updatedAt: nowIso(),
	} as LogosRuntimeState;
}

/**
 * Clear a field on the runtime state (set to null) and return
 * the updated copy.
 */
function withCleared<K extends keyof LogosRuntimeState>(
	state: LogosRuntimeState,
	key: K,
	nullValue: null,
): LogosRuntimeState {
	if (state[key] === nullValue) return state;
	return {
		...state,
		[key]: nullValue,
		updatedAt: nowIso(),
	} as LogosRuntimeState;
}

/**
 * Repair a single node state entry: ensure an accepted node has
 * `canonicalAnswer.accepted === true`.
 *
 * Returns a new `NodeRuntimeState` or `null` if no change was needed.
 */
function repairAcceptedNodeCanonicalAnswer(
	nodeState: NodeRuntimeState,
): NodeRuntimeState | null {
	if (nodeState.lifecycle !== 'accepted') return null;
	if (nodeState.canonicalAnswer === null) return null; // Unrepairable — caller handles.
	if (nodeState.canonicalAnswer.accepted === true) return null;

	// Safe repair: set accepted flag.
	return {
		...nodeState,
		canonicalAnswer: {
			...nodeState.canonicalAnswer,
			accepted: true,
		},
		updatedAt: nowIso(),
	} as NodeRuntimeState;
}

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes (informational, not errors)
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_RESTORED_ACTIVE_NODE = 'LOGOS_RESUME_RESTORED_ACTIVE_NODE';
const DIAG_RESTORED_PROFILE = 'LOGOS_RESUME_RESTORED_PROFILE';
const DIAG_CLEARED_INVALID_ACTIVE_NODE =
	'LOGOS_RESUME_CLEARED_INVALID_ACTIVE_NODE';
const DIAG_CLEARED_INVALID_LAST_ACTIVE_NODE =
	'LOGOS_RESUME_CLEARED_INVALID_LAST_ACTIVE_NODE';
const DIAG_REPAIRED_CANONICAL_ANSWER_ACCEPTED =
	'LOGOS_RESUME_REPAIRED_CANONICAL_ANSWER_ACCEPTED';
const DIAG_MIGRATION_APPLIED = 'LOGOS_RESUME_MIGRATION_APPLIED';
const DIAG_NO_PROFILE_SELECTED = 'LOGOS_RESUME_NO_PROFILE_SELECTED';

/**
 * A diagnostic produced during resume — informational, not an error.
 */
export type ResumeDiagnostic = {
	readonly code: string;
	readonly message: string;
	readonly severity: 'info' | 'warning';
	readonly nodeId?: string;
};

function resumeDiag(
	code: string,
	message: string,
	severity: 'info' | 'warning' = 'info',
	nodeId?: string,
): ResumeDiagnostic {
	const d: ResumeDiagnostic = { code, message, severity };
	if (nodeId !== undefined) (d as Record<string, unknown>).nodeId = nodeId;
	return d;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resume result — the restored state plus any diagnostics produced
 * during validation and repair.
 */
export type ResumeResult = {
	/** The restored (and possibly repaired) runtime state. */
	readonly state: LogosRuntimeState;

	/** Informational diagnostics produced during resume. */
	readonly diagnostics: ResumeDiagnostic[];
};

/**
 * Check whether any resumable sessions exist.
 *
 * @param store - The snapshot store (default: `defaultStore`).
 * @returns `true` if at least one session snapshot exists.
 */
export async function hasResumableSessions(
	store: SnapshotStore = defaultStore,
): Promise<boolean> {
	const sessions = await store.listSessions();
	return sessions.length > 0;
}

/**
 * Resume a session from a persisted snapshot.
 *
 * If `sessionId` is omitted, the latest session (most recently saved)
 * is loaded. The function performs the following steps:
 *
 * 1. Load the snapshot.
 * 2. Run schema migrations if needed.
 * 3. Validate the selected profile.
 * 4. Validate the active node ID.
 * 5. Validate node states (accepted nodes must have canonical answers).
 * 6. Repair safe inconsistencies.
 * 7. Return the restored state with diagnostics.
 *
 * @param sessionId - The session to resume, or `undefined` to load the latest.
 * @param options - Injection points for the snapshot store, profile loader,
 *   and migrations.
 * @returns The restored state plus diagnostics, or a `ResumeError`.
 */
export async function resumeSessionWithDiagnostics(
	sessionId?: string,
	options: ResumeSessionOptions = {},
): Promise<Result<ResumeResult, ResumeError>> {
	const store = options.store ?? defaultStore;
	const migrations = options.migrations ?? [];
	const loadProfile = options.loadProfile ?? null;

	const diagnostics: ResumeDiagnostic[] = [];

	// ── 1. Resolve session ID ─────────────────────────────────────────
	let resolvedId: string;

	if (sessionId !== undefined) {
		resolvedId = sessionId;
	} else {
		const sessions = await store.listSessions();
		if (sessions.length === 0) {
			return err(
				resumeErr('RESUME_NO_SESSIONS', 'No previous sessions found.', true, [
					'create_new_session',
				]),
			);
		}
		// listSessions() sorts by savedAt descending — first is latest.
		// length check above guarantees sessions[0] exists.
		const first = sessions[0];
		if (first === undefined) {
			return err(
				resumeErr('RESUME_NO_SESSIONS', 'No previous sessions found.', true, [
					'create_new_session',
				]),
			);
		}
		resolvedId = first.sessionId;
	}

	// ── 2. Load snapshot ──────────────────────────────────────────────
	const loadResult = await store.loadSnapshot(resolvedId);
	if (!loadResult.ok) {
		return err(
			resumeErr(
				'RESUME_SNAPSHOT_LOAD_FAILED',
				`Could not load snapshot for session "${resolvedId}": ${loadResult.error.message}`,
				true,
				['create_new_session', 'inspect_snapshot'],
				{ cause: loadResult.error, sessionId: resolvedId },
			),
		);
	}

	const snapshot = loadResult.value;

	// ── 3. Run migrations if needed ───────────────────────────────────
	let runtimeState = snapshot.runtimeState;

	if (snapshot.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		const migrationResult = runMigrations(
			runtimeState,
			snapshot.schemaVersion,
			CURRENT_SCHEMA_VERSION,
			migrations,
		);

		if (!migrationResult.ok) {
			return err(
				resumeErr(
					'RESUME_MIGRATION_FAILED',
					`Schema migration failed for session "${resolvedId}": ${migrationResult.error.message}`,
					true,
					['inspect_snapshot', 'create_new_session'],
					{ cause: migrationResult.error, sessionId: resolvedId },
				),
			);
		}

		runtimeState = migrationResult.value;
		diagnostics.push(
			resumeDiag(
				DIAG_MIGRATION_APPLIED,
				`Applied schema migration from "${snapshot.schemaVersion}" to "${CURRENT_SCHEMA_VERSION}".`,
			),
		);
	}

	// ── 4. Validate selected profile ──────────────────────────────────
	if (runtimeState.selectedProfileId === null) {
		diagnostics.push(
			resumeDiag(
				DIAG_NO_PROFILE_SELECTED,
				'No profile was selected in the previous session. The session restored in idle mode.',
				'warning',
			),
		);
	} else if (loadProfile !== null) {
		// Attempt to load and validate the profile.
		const profileResult = await Promise.resolve(
			loadProfile(runtimeState.selectedProfileId),
		);

		if (!profileResult.ok) {
			// Profile cannot be loaded — return a recoverable error with
			// the repaired state (profile cleared).
			const repairedState = withMode(
				withCleared(runtimeState, 'selectedProfileId', null),
				'idle',
			);

			return err(
				resumeErr(
					'RESUME_PROFILE_NOT_FOUND',
					`The previously selected profile "${runtimeState.selectedProfileId}" could not be loaded. ` +
						'The session has been restored to idle mode — please select a profile.',
					true,
					['select_new_profile'],
					{
						cause: profileResult.error,
						repairedState,
						sessionId: resolvedId,
					},
				),
			);
		}

		// Profile was loaded successfully. Validate activeNodeId against
		// the profile's node definitions.
		const profile = profileResult.value;

		diagnostics.push(
			resumeDiag(DIAG_RESTORED_PROFILE, `Restored profile "${profile.title}".`),
		);

		// ── 5. Validate activeNodeId ──────────────────────────────────
		if (runtimeState.activeNodeId !== null) {
			const nodeExists = profile.nodes.some(
				(n) => n.id === runtimeState.activeNodeId,
			);

			if (!nodeExists) {
				// Store before clearing so the diagnostic reports the real value.
				const invalidActiveNodeId = runtimeState.activeNodeId;
				runtimeState = withCleared(runtimeState, 'activeNodeId', null);
				diagnostics.push(
					resumeDiag(
						DIAG_CLEARED_INVALID_ACTIVE_NODE,
						`The active node "${invalidActiveNodeId}" no longer exists in profile "${profile.title}". Active node has been cleared.`,
						'warning',
					),
				);
			} else {
				diagnostics.push(
					resumeDiag(
						DIAG_RESTORED_ACTIVE_NODE,
						`Restored active node "${runtimeState.activeNodeId}".`,
					),
				);
			}
		}

		// Validate lastActiveNodeId.
		if (runtimeState.lastActiveNodeId !== null) {
			const lastExists = profile.nodes.some(
				(n) => n.id === runtimeState.lastActiveNodeId,
			);

			if (!lastExists) {
				const invalidLastActiveNodeId = runtimeState.lastActiveNodeId;
				runtimeState = withCleared(runtimeState, 'lastActiveNodeId', null);
				diagnostics.push(
					resumeDiag(
						DIAG_CLEARED_INVALID_LAST_ACTIVE_NODE,
						`The last active node "${invalidLastActiveNodeId}" no longer exists in profile. Reference has been cleared.`,
						'warning',
					),
				);
			}
		}
	}
	// Note: if loadProfile is null and selectedProfileId is non-null,
	// we preserve the profile ID but cannot validate it. The application
	// layer should handle resolution later.

	// ── 6. Validate node states ──────────────────────────────────────
	const repairedNodeStates: Record<string, NodeRuntimeState> = {};
	let hasNodeStateRepairs = false;

	for (const nodeId of Object.keys(runtimeState.nodeStates)) {
		// Object.keys() iterates over the record's own keys — the value
		// always exists because we derive the key set from the same record.
		const nodeState = runtimeState.nodeStates[nodeId as NodeId];
		if (nodeState === undefined) continue;

		// Guard: accepted nodes must have a canonical answer.
		if (
			nodeState.lifecycle === 'accepted' &&
			nodeState.canonicalAnswer === null
		) {
			// This is a hard error — an accepted node without a canonical
			// answer is inconsistent. Return a recoverable error.
			return err(
				resumeErr(
					'RESUME_ACCEPTED_NODE_MISSING_CANONICAL_ANSWER',
					`Node "${nodeId}" is accepted but has no canonical answer. ` +
						'The snapshot may be corrupted.',
					true,
					['inspect_snapshot', 'create_new_session'],
					{ sessionId: resolvedId },
				),
			);
		}

		// Repair: accepted node with canonical answer but `accepted: false`.
		const repaired = repairAcceptedNodeCanonicalAnswer(nodeState);
		if (repaired !== null) {
			repairedNodeStates[nodeId] = repaired;
			hasNodeStateRepairs = true;
			diagnostics.push(
				resumeDiag(
					DIAG_REPAIRED_CANONICAL_ANSWER_ACCEPTED,
					`Node "${nodeId}" was accepted but its canonical answer had "accepted: false". The flag has been repaired.`,
					'warning',
					nodeId,
				),
			);
		} else {
			repairedNodeStates[nodeId] = nodeState;
		}
	}

	if (hasNodeStateRepairs) {
		runtimeState = {
			...runtimeState,
			nodeStates: repairedNodeStates,
			updatedAt: nowIso(),
		} as LogosRuntimeState;
	}

	// ── 7. Recompute mode ────────────────────────────────────────────
	const resolvedMode = resolveModeFromState(runtimeState);
	runtimeState = withMode(runtimeState, resolvedMode);

	// ── 8. Return restored state ────────────────────────────────────
	return ok({
		diagnostics,
		state: runtimeState,
	});
}

/**
 * Resume a session from a persisted snapshot.
 *
 * This is the primary public API — it delegates to
 * `resumeSessionWithDiagnostics` and returns only the restored
 * `LogosRuntimeState` on success (discarding diagnostics).
 *
 * If `sessionId` is omitted, the latest session is loaded.
 *
 * @param sessionId - The session to resume, or `undefined` to load the latest.
 * @param options   - Injection points for the snapshot store, profile loader,
 *   and migrations.
 * @returns The restored runtime state, or a `ResumeError`.
 */
export async function resumeSession(
	sessionId?: string,
	options: ResumeSessionOptions = {},
): Promise<Result<LogosRuntimeState, ResumeError>> {
	const result = await resumeSessionWithDiagnostics(sessionId, options);
	if (!result.ok) return result;
	return ok(result.value.state);
}
