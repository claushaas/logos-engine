/**
 * State engine — core operations for session initialization, profile
 * selection, and profile changes.
 *
 * All functions are pure: they return a new state object and never mutate
 * the input. The state engine owns all runtime state; the TUI and
 * application layer consume derived snapshots.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md}
 */
import type {
	LogosRuntimeState,
	RuntimeDocumentState,
} from '../contracts/index.js';
import type { NodeId, ProfileId, SessionId } from '../shared/index.js';
import { generateId, nowIso } from '../shared/index.js';
import { getProfile, listProfiles } from '../profiles/index.js';
import { diagnostic, stateErr, stateOk, type StateEngineResult } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// State change helpers (pure — always return new objects)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh, empty `LogosRuntimeState`.
 *
 * Returns a state in `mode: "idle"` with no selected profile, no active
 * node, and empty node/document state records.
 */
function emptyState(sessionId: SessionId): LogosRuntimeState {
	return {
		activeNodeId: null,
		documentStates: {} as Record<string, RuntimeDocumentState>,
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'idle',
		nodeStates: {},
		selectedProfileId: null,
		sessionId,
		updatedAt: nowIso(),
	};
}

/**
 * Clone the input state with the given overrides applied.
 *
 * This is the only mutation primitive in the state engine — every
 * operation delegates to this helper to guarantee immutability.
 */
function patchState(
	base: LogosRuntimeState,
	overrides: Partial<LogosRuntimeState>,
): LogosRuntimeState {
	return {
		...base,
		...overrides,
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialize a new session.
 *
 * Returns a pristine `LogosRuntimeState` in `mode: "idle"` with no
 * selected profile and no active node. Session creation never fails,
 * so this returns the state directly (not wrapped in `StateEngineResult`).
 *
 * @returns A fresh, empty `LogosRuntimeState`.
 */
export function createSession(): LogosRuntimeState {
	const sessionId = generateId() as SessionId;
	return emptyState(sessionId);
}

/**
 * Select a profile for the current session.
 *
 * Validates that profiles exist in the given directory and that the
 * requested profile can be loaded. On success, transitions the session
 * to `mode: "structure_overview"`, resets node and document runtime
 * state, and clears `activeNodeId`.
 *
 * @param state    - The current runtime state (not mutated).
 * @param profileId - The ID of the profile to select.
 * @param options  - Optional configuration.
 * @param options.profileDirectory - Directory to scan for profile files
 *   (default: the built-in `profiles/` directory).
 * @returns A new `LogosRuntimeState` on success, or an error result with
 *   diagnostics on failure.
 */
export function selectProfile(
	state: LogosRuntimeState,
	profileId: ProfileId,
	options?: { profileDirectory?: string },
): StateEngineResult {
	const directory = options?.profileDirectory;

	// Guard: profiles must exist.
	const available = listProfiles(directory);
	if (available.length === 0) {
		return stateErr('No profiles available', [
			diagnostic(
				'LOGOS_STATE_NO_PROFILES_AVAILABLE',
				`No profile files found${directory ? ` in "${directory}"` : ''}.`,
				'error',
			),
		]);
	}

	// Guard: requested profile must be loadable.
	const result = getProfile(profileId, directory);
	if (!result.ok) {
		return stateErr(`Failed to load profile "${profileId}"`, [
			diagnostic(
				'LOGOS_STATE_PROFILE_LOAD_FAILED',
				result.error.userFacingMessage,
				'error',
				profileId,
			),
		]);
	}

	// Transition to structure_overview — reset all node/document runtime state.
	const profile = result.value;
	return stateOk(
		patchState(state, {
			activeNodeId: null,
			documentStates: {} as Record<string, RuntimeDocumentState>,
			lastActiveNodeId: null,
			mode: 'structure_overview',
			nodeStates: {},
			selectedProfileId: profile.id,
		}),
	);
}

/**
 * Change the selected profile during an active session.
 *
 * Delegates to `selectProfile()`, which resets node and document runtime
 * state. The behavior is identical — changing profiles always means
 * starting fresh with the new profile's structure.
 *
 * @param state    - The current runtime state (not mutated).
 * @param profileId - The ID of the new profile to select.
 * @param options  - Optional configuration.
 * @param options.profileDirectory - Directory to scan for profile files.
 * @returns A new `LogosRuntimeState` on success, or an error result with
 *   diagnostics on failure.
 */
export function changeProfile(
	state: LogosRuntimeState,
	profileId: ProfileId,
	options?: { profileDirectory?: string },
): StateEngineResult {
	return selectProfile(state, profileId, options);
}

/**
 * Select a node for focused conversation (guard-only for Step 3.1).
 *
 * **Step 3.1 scope:** This function only enforces the guard that a
 * profile must be selected before any node selection. Full node
 * selection — resolving node definitions, initialising `NodeRuntimeState`,
 * computing dependencies, and transitioning to `mode: "node_focus"` —
 * is deferred to Step 3.3.
 *
 * @param state  - The current runtime state (not mutated).
 * @param nodeId - The ID of the node to select.
 * @returns A successful result with unchanged state if the guard passes,
 *   or an error result with diagnostics if no profile is selected.
 */
export function selectNode(
	state: LogosRuntimeState,
	nodeId: NodeId,
): StateEngineResult {
	if (state.selectedProfileId === null) {
		return stateErr('Cannot select a node without a selected profile', [
			diagnostic(
				'LOGOS_STATE_NO_PROFILE_SELECTED',
				'A profile must be selected before selecting a node.',
				'error',
				nodeId,
			),
		]);
	}

	// Guard passes — full implementation in Step 3.3.
	// Return state unchanged for now.
	return stateOk(state);
}
