/**
 * Global runtime state and session mode types.
 *
 * `LogosRuntimeState` is the root state object owned and mutated exclusively
 * by the state engine. Every other module consumes derived snapshots — never
 * the raw state directly.
 */
import type {
	DocumentId,
	NodeId,
	ProfileId,
	SessionId,
} from '../shared/index.js';
import type { DocumentRuntimeState } from './document-state.js';
import type { ExportRuntimeState } from './export-state.js';
import type { NodeRuntimeState } from './node-state.js';

// ─── Backward-compatibility aliases ────────────────────────────────────────
//
// `RuntimeDocumentState` and `RuntimeExportState` were placeholder types
// introduced in Step 1.2 and replaced in Step 1.4. These aliases ensure
// that existing imports (e.g., typecheck tests) do not break.

/** Canonical type — defined in {@link ./document-state.js}. */
export type RuntimeDocumentState = DocumentRuntimeState;

/** Canonical type — defined in {@link ./export-state.js}. */
export type RuntimeExportState = ExportRuntimeState;

// ─── SessionMode ────────────────────────────────────────────────────────────

/**
 * The session mode determines which panel the TUI renders and which
 * actions are globally available.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §5}
 */
export type SessionMode =
	| 'idle'
	| 'profile_selection'
	| 'structure_overview'
	| 'node_focus'
	| 'document_preview'
	| 'export'
	| 'settings'
	| 'error';

// ─── LogosRuntimeState ──────────────────────────────────────────────────────

/**
 * Root runtime state object.
 *
 * Owned by the state engine. All mutations must pass through
 * `dispatch(event)` (Step 3.8).
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §4}
 */
export type LogosRuntimeState = {
	/** Unique session identifier (branded). */
	readonly sessionId: SessionId;

	/** The currently selected profile, or `null` if no profile is loaded. */
	readonly selectedProfileId: ProfileId | null;

	/** The node currently receiving user focus, or `null` for structural mode. */
	readonly activeNodeId: NodeId | null;

	/** Current session mode — derived from `activeNodeId` and profile state. */
	readonly mode: SessionMode;

	/** Per-node runtime state keyed by node id. */
	readonly nodeStates: Record<NodeId, NodeRuntimeState>;

	/** Per-document runtime state keyed by document id. */
	readonly documentStates: Record<DocumentId, DocumentRuntimeState>;

	/** Global export/progress state. */
	readonly exportState: ExportRuntimeState;

	/** User preferences and project-level metadata carried across the session. */
	readonly globalContext: GlobalContext;

	/** The previously active node, preserved so the user can return to it. */
	readonly lastActiveNodeId: NodeId | null;

	/** ISO-8601 timestamp of the last state mutation. */
	readonly updatedAt: string;
};

// ─── GlobalContext ──────────────────────────────────────────────────────────

/**
 * Session-scoped context that is independent of any single node.
 *
 * Injected into prompts alongside node-local conversation when the
 * prompt orchestrator assembles the LLM request.
 */
export type GlobalContext = {
	/** User-supplied project name, or `null` if not yet provided. */
	readonly projectName: string | null;

	/** Free-text summary of the project, or `null`. */
	readonly summary: string | null;

	/** Arbitrary user preferences surfaced during the session. */
	readonly preferences: Record<string, string | number | boolean | null>;
};
