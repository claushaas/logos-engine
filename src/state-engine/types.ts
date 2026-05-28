/**
 * State engine types — `StateEngineResult`, `StateDiagnostic`, `StateEngineEvent`,
 * `LogosEvent`, `StateEngineSnapshot`.
 *
 * These types are the interface between the state engine and the application
 * layer. Every state engine operation returns a `StateEngineResult`.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §12}
 */
import type {
	LogosRuntimeState,
	MainPanelRenderModel,
	NodeAction,
	NodeLifecycle,
	NodeRuntimeState,
	RuntimeDiagnostic,
	SessionEvent,
	SessionMode,
	SidebarRenderModel,
} from '../contracts/index.js';
import type { NodeId, ProfileId } from '../shared/index.js';

// ─── StateDiagnostic ────────────────────────────────────────────────────────

/**
 * A non-fatal diagnostic produced by the state engine.
 *
 * Mirrors the contract-level `RuntimeDiagnostic` so the state engine can
 * produce diagnostics without depending on render-snapshot types.
 */
export type StateDiagnostic = RuntimeDiagnostic;

// ─── StateEngineResult ──────────────────────────────────────────────────────

/**
 * Result of a state engine operation.
 *
 * Every mutation function returns this type — never throws and never
 * mutates input state.
 *
 * The success branch may include a `StateEngineSnapshot` for the TUI.
 * `dispatch()` always includes the snapshot; lower-level operations
 * (e.g., `selectProfile`) may omit it for backward compatibility.
 */
export type StateEngineResult =
	| {
			readonly ok: true;
			readonly state: LogosRuntimeState;
			readonly snapshot?: StateEngineSnapshot;
			/** Session events emitted by this transition (for audit log). */
			readonly events?: SessionEvent[];
	  }
	| {
			readonly ok: false;
			readonly error: string;
			readonly diagnostics: StateDiagnostic[];
	  };

// ─── StateEngineEvent ───────────────────────────────────────────────────────

/**
 * Union of all events the state engine may process.
 *
 * Aliases the contract-level `SessionEvent` so the state engine can
 * reference events without importing session-event types directly.
 */
export type StateEngineEvent = SessionEvent;

// ─── LogosEvent ────────────────────────────────────────────────────────────

/**
 * Short-form command events accepted by `dispatch()`.
 *
 * These are the canonical commands the application layer and TUI use to
 * drive the state engine. Each event carries exactly the data needed
 * for the corresponding operation — no nested `payload` wrapper.
 *
 * `dispatch()` also accepts a full `StateEngineEvent` (i.e. `SessionEvent`)
 * for backward compatibility with persisted event streams.
 */
export type LogosEvent =
	| { readonly type: 'CREATE_SESSION' }
	| { readonly type: 'SELECT_PROFILE'; readonly profileId: ProfileId }
	| { readonly type: 'CHANGE_PROFILE'; readonly profileId: ProfileId }
	| {
			readonly type: 'SELECT_NODE' | 'NODE_SELECTED';
			readonly nodeId: NodeId;
	  }
	| { readonly type: 'DESELECT_NODE' }
	| {
			readonly type: 'USER_MESSAGE_ADDED' | 'USER_MESSAGE';
			readonly nodeId: NodeId;
			readonly content: string;
			readonly messageId?: string;
	  }
	| {
			readonly type: 'NODE_LIFECYCLE_CHANGED';
			readonly nodeId: NodeId;
			readonly to: NodeLifecycle;
			readonly event?: string;
	  }
	| { readonly type: 'DEFER_NODE' | 'NODE_DEFERRED'; readonly nodeId: NodeId }
	| { readonly type: 'RESUME_NODE'; readonly nodeId: NodeId };

/**
 * Union of event types accepted by `dispatch()`.
 *
 * Includes both the simple `LogosEvent` commands and the full
 * `StateEngineEvent`/`SessionEvent` for persistence compatibility.
 */
export type DispatchEvent = LogosEvent | StateEngineEvent;

// ─── StateEngineSnapshot ───────────────────────────────────────────────────

/**
 * Domain-level snapshot produced by the state engine for the application
 * layer / TUI.
 *
 * Derived from `LogosRuntimeState` and `LogosProfile`. The application
 * layer maps this to `TuiRenderSnapshot` for rendering.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §12}
 */
export type StateEngineSnapshot = {
	/** Current session mode. */
	readonly mode: SessionMode;

	/** The currently selected profile ID, or `null`. */
	readonly selectedProfileId: ProfileId | null;

	/** The currently active node ID, or `null`. */
	readonly activeNodeId: NodeId | null;

	/** Full runtime state of the active node, or `null` if structural mode. */
	readonly activeNodeState: NodeRuntimeState | null;

	/** Actions allowed in the current context. */
	readonly allowedActions: NodeAction[];

	/** Sidebar render model. */
	readonly sidebar: SidebarRenderModel;

	/** Main panel render model. */
	readonly mainPanel: MainPanelRenderModel;

	/** Non-fatal diagnostics to surface. */
	readonly diagnostics: StateDiagnostic[];
};

// ─── Convenience constructors ───────────────────────────────────────────────

/**
 * Create a successful `StateEngineResult`.
 *
 * Optionally accepts a `StateEngineSnapshot`. Call `stateOk(state, snapshot)`
 * when the caller has already computed the snapshot.
 */
export function stateOk(
	state: LogosRuntimeState,
	snapshot?: StateEngineSnapshot,
	events?: SessionEvent[],
): StateEngineResult {
	const base: StateEngineResult = { ok: true as const, state };
	if (snapshot !== undefined)
		(base as Record<string, unknown>).snapshot = snapshot;
	if (events !== undefined) (base as Record<string, unknown>).events = events;
	return base;
}

/**
 * Create a failed `StateEngineResult` with diagnostics.
 */
export function stateErr(
	error: string,
	diagnostics: StateDiagnostic[] = [],
): StateEngineResult {
	return { diagnostics, error, ok: false as const };
}

/**
 * Create a single diagnostic entry.
 */
export function diagnostic(
	code: string,
	message: string,
	severity: 'info' | 'warning' | 'error' = 'error',
	sourceId?: string,
): StateDiagnostic {
	return sourceId !== undefined
		? { code, message, severity, sourceId }
		: { code, message, severity };
}
