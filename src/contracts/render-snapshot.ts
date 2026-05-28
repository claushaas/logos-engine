/**
 * TUI render snapshot contracts.
 *
 * The TUI receives a fully-specified render snapshot from the application
 * layer. It renders what the state engine says is true — it never owns state
 * logic, lifecycle rules, or prompt selection.
 *
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md}
 * @see {@link https://logos-engine/docs/architecture/06-tui-rendering-architecture.md}
 */
import type { DocumentId, NodeId } from '../shared/index.js';
import type { NodeAction, NodeLifecycle } from './node-state.js';
import type { SessionMode } from './runtime-state.js';

// ─── RuntimeDiagnostic ─────────────────────────────────────────────────────

/**
 * A non-fatal diagnostic surfaced to the TUI.
 *
 * Diagnostics carry warnings, hints, and recoverable errors that the user
 * may act on. They never represent fatal state corruption.
 */
export type RuntimeDiagnostic = {
	/** Machine-readable diagnostic code. */
	readonly code: string;

	/** Human-readable message. */
	readonly message: string;

	/** Severity level. */
	readonly severity: 'info' | 'warning' | 'error';

	/** Optional node or document this diagnostic relates to. */
	readonly sourceId?: string;
};

// ─── Sidebar render model ──────────────────────────────────────────────────

/**
 * A single node in the sidebar tree.
 */
export type SidebarNode = {
	/** Unique node identifier (branded). */
	readonly nodeId: NodeId;

	/** Display title for the node. */
	readonly title: string;

	/** Single-character status symbol rendered next to the title. */
	readonly statusSymbol: string;

	/** Whether this node is the currently selected (active) node. */
	readonly selected: boolean;

	/** Whether navigation to this node is disabled. */
	readonly disabled: boolean;

	/** Human-readable reason if the node is disabled. */
	readonly reasonIfDisabled?: string;
};

/**
 * A document grouping within a sidebar phase.
 */
export type SidebarDocument = {
	/** Document identifier (branded). */
	readonly documentId: DocumentId;

	/** Display title for the document. */
	readonly title: string;

	/** Document readiness status indicator (optional, for display). */
	readonly statusSymbol?: string;

	/** Nodes belonging to this document, in display order. */
	readonly nodes: SidebarNode[];
};

/**
 * A phase grouping within the sidebar, containing documents.
 */
export type SidebarPhase = {
	/** Phase identifier. */
	readonly phaseId: string;

	/** Display title for the phase. */
	readonly title: string;

	/** Documents within this phase, in display order. */
	readonly documents: SidebarDocument[];
};

/**
 * Full sidebar render model — ready for the TUI to render without
 * any additional computation.
 */
export type SidebarRenderModel = {
	/** Selected profile display title, if a profile is loaded. */
	readonly profileTitle?: string;

	/** Phases containing documents and nodes, in display order. */
	readonly phases: SidebarPhase[];

	/** The currently active node ID, or `null` for structural mode. */
	readonly activeNodeId: NodeId | null;
};

// ─── Main panel render model (discriminated union) ─────────────────────────

/**
 * Panel shown when the session is idle — no profile selected.
 */
export type IdlePanel = {
	readonly kind: 'idle';

	/**
	 * Whether one or more previous sessions exists on disk.
	 *
	 * When `true`, the action bar should offer a `[Resume Session]`
	 * action. Set by the application layer after checking the
	 * snapshot store — the state engine does not own this value.
	 */
	readonly hasAvailableSessions?: boolean;
};

/**
 * Panel shown for profile selection / structure overview.
 */
export type ProfilePanel = {
	readonly kind: 'profile';
	/** Available profile IDs. */
	readonly availableProfileIds: string[];
	/** Human-readable status or welcome message. */
	readonly message?: string;
};

/**
 * Panel shown when a node is in focus — the primary conversational surface.
 */
export type NodeConversationPanel = {
	readonly kind: 'node_conversation';

	/** Active node identifier. */
	readonly nodeId: NodeId;

	/** Display title for the node. */
	readonly title: string;

	/** Current lifecycle of the active node. */
	readonly lifecycle: NodeLifecycle;

	/** Conversation messages, in chronological order. */
	readonly messages: Array<{
		readonly id: string;
		readonly role: 'user' | 'assistant' | 'system';
		readonly content: string;
		readonly createdAt: string;
	}>;

	/** Canonical answer content if available, `null` otherwise. */
	readonly canonicalAnswerPreview: string | null;

	/** Whether the canonical answer has been accepted. */
	readonly canonicalAnswerAccepted: boolean;

	/** Confidence level of the canonical answer synthesis (low / medium / high). */
	readonly canonicalAnswerConfidence?: 'low' | 'medium' | 'high';

	/** Number of conversation messages this answer was derived from. */
	readonly canonicalAnswerSourceMessageCount?: number;

	/** Whether the canonical answer is stale (outdated). */
	readonly canonicalAnswerStale?: boolean;

	/** Completeness summary for display hints. */
	readonly completenessSummary?: string;

	/** Breadcrumb path for the active node (e.g. "Foundation / Thesis / Core Thesis"). */
	readonly breadcrumb?: string;
};

/**
 * Panel shown when previewing a materialized document.
 */
export type DocumentPreviewPanel = {
	readonly kind: 'document_preview';

	/** Document identifier (branded). */
	readonly documentId: DocumentId;

	/** Display title for the document. */
	readonly title: string;

	/** Materialized content, or `null` if not yet generated. */
	readonly content: string | null;

	/** Missing required node IDs (branded). */
	readonly missingNodeIds: NodeId[];

	/** Stale source node IDs (branded). */
	readonly staleNodeIds: NodeId[];

	/** Whether the document is eligible for export. */
	readonly exportEligible: boolean;
};

/**
 * A single export option rendered in the export panel.
 *
 * Each option describes one output format with its availability
 * status and a human-readable blocked reason when unavailable.
 */
export type ExportOption = {
	/** Export format. */
	readonly format: 'markdown' | 'html' | 'agent_pack';

	/** Human-readable label (e.g., "Markdown"). */
	readonly label: string;

	/** Short description of the output format. */
	readonly description: string;

	/** Whether the format is currently available for export. */
	readonly available: boolean;

	/** Human-readable reason when `available === false`. */
	readonly blockedReason?: string;
};

/**
 * Panel shown when the export surface is active.
 */
export type ExportPanel = {
	readonly kind: 'export';

	/** Available export formats. */
	readonly availableFormats: Array<'markdown' | 'html' | 'agent_pack'>;

	/** Documents eligible for export (branded). */
	readonly eligibleDocumentIds: DocumentId[];

	/** Already-generated artifacts. */
	readonly generatedArtifacts: Array<{
		readonly id: string;
		readonly type: 'markdown' | 'html' | 'agent_pack';
		readonly path: string;
		readonly stale: boolean;
	}>;

	/** Per-format export options for rendering the export list. */
	readonly exportOptions?: ExportOption[];

	/** Output path shown after a successful export, or `undefined`. */
	readonly outputPath?: string;
};

/**
 * Panel shown for settings / preferences.
 */
export type SettingsPanel = {
	readonly kind: 'settings';
};

/**
 * Recovery actions that may be presented to the user in the error panel.
 *
 * Defined here as a presentation-safe contract so the TUI can render
 * labels without depending on the diagnostics layer.
 */
export type ErrorRecoveryAction =
	| 'retry'
	| 'reopen_node'
	| 'open_missing_prerequisite'
	| 'regenerate_canonical_answer'
	| 'clear_invalid_active_node'
	| 'export_recovery_bundle'
	| 'restore_previous_snapshot'
	| 'open_settings';

/**
 * Panel shown when the session enters an error mode.
 */
export type ErrorPanel = {
	readonly kind: 'error';

	/** Primary error message. */
	readonly message: string;

	/** Optional recovery hint. */
	readonly recoveryHint?: string;

	/** Machine-readable error code (e.g., `LOGOS_DISPATCH_NO_PROFILE`). */
	readonly code?: string;

	/** Error category for display (e.g., `invalid_state`, `persistence`). */
	readonly category?: string;

	/** Whether the system can attempt guided recovery. */
	readonly recoverable?: boolean;

	/** Suggested recovery actions the user may take. */
	readonly recoveryActions?: readonly ErrorRecoveryAction[];

	/** Additional structured context (e.g., affected node IDs). */
	readonly details?: Record<string, unknown>;
};

/**
 * Discriminated union of all possible main panel render states.
 *
 * The TUI switches on `kind` to render the appropriate panel.
 */
export type MainPanelRenderModel =
	| IdlePanel
	| ProfilePanel
	| NodeConversationPanel
	| DocumentPreviewPanel
	| ExportPanel
	| SettingsPanel
	| ErrorPanel;

// ─── Action bar render model ───────────────────────────────────────────────

/**
 * A single action in the action bar — derived from the state engine's
 * `getAllowedActions` for the current lifecycle, plus any deterministic
 * global actions.
 *
 * The TUI may map `id` to a keyboard shortcut; it must not invent actions.
 */
export type ActionBarRenderAction = {
	/** Unique action identifier. */
	readonly id: string;

	/** Human-readable label. */
	readonly label: string;

	/** Whether the action can be invoked. */
	readonly enabled: boolean;

	/** Human-readable reason if the action is disabled. */
	readonly reasonIfDisabled?: string;

	/** The `NodeAction` this maps to, if it is a node-scoped action. */
	readonly nodeAction?: NodeAction;
};

/**
 * Action bar model — a list of contextually allowed actions.
 */
export type ActionBarRenderModel = {
	readonly actions: ActionBarRenderAction[];
};

// ─── Input render model ────────────────────────────────────────────────────

/**
 * Controls the user text input area at the bottom of the TUI.
 *
 * Input is enabled only when the current state permits user text entry.
 */
export type InputRenderModel = {
	/** Whether the text input area is enabled. */
	readonly enabled: boolean;

	/** Placeholder text shown when the input is empty. */
	readonly placeholder?: string;

	/** The action to dispatch when the user submits text. */
	readonly submitAction?: string;

	/** Human-readable reason if input is disabled. */
	readonly reasonIfDisabled?: string;
};

// ─── Provider status ────────────────────────────────────────────────────────

/**
 * Provider mode as it appears in the render snapshot.
 *
 * Mirror of the runtime-level provider resolution, converted to a
 * TUI-safe representation. The TUI uses this to display provider
 * status badges and actionable diagnostics.
 */
export type ProviderStatusMode = 'mock' | 'real' | 'unconfigured' | 'injected';

/**
 * Provider status surfaced to the TUI.
 *
 * Included in every render snapshot so the user can tell at a glance
 * whether they are using a mock or real AI provider before submitting
 * meaningful content.
 */
export type ProviderStatus = {
	/** Current provider mode. */
	readonly mode: ProviderStatusMode;

	/** Human-readable label for the status badge. */
	readonly label: string;

	/**
	 * Actionable guidance for unconfigured or problematic states.
	 * `null` when the provider is fully operational.
	 */
	readonly guidance: string | null;
};

// ─── TuiRenderSnapshot ─────────────────────────────────────────────────────

/**
 * The complete render snapshot sent from the application layer to the TUI.
 *
 * The TUI must be able to render every screen from this snapshot alone.
 * It must not consult runtime state, profile definitions, or state-engine
 * internals to decide what to display.
 *
 * @see {@link https://logos-engine/docs/architecture/06-tui-rendering-architecture.md §3}
 */
export type TuiRenderSnapshot = {
	/** Current session mode — determines which panel is rendered. */
	readonly mode: SessionMode;

	/** Sidebar tree model. */
	readonly sidebar: SidebarRenderModel;

	/** Main panel content — discriminated by `kind`. */
	readonly mainPanel: MainPanelRenderModel;

	/** Contextually allowed actions. */
	readonly actionBar: ActionBarRenderModel;

	/** Text input control state. */
	readonly input: InputRenderModel;

	/** Non-fatal diagnostics to surface to the user. */
	readonly diagnostics: RuntimeDiagnostic[];

	/**
	 * Provider status — always present so the TUI can show a badge
	 * before the user submits content.
	 */
	readonly providerStatus: ProviderStatus;
};
