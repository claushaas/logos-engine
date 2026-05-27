/**
 * Render model builder — maps `StateEngineSnapshot` to `TuiRenderSnapshot`.
 *
 * This is a pure transformation layer that keeps domain and presentation
 * separate. The state engine produces a domain snapshot; this module
 * produces a render-optimized model with labels, status symbols, and
 * layout information consumed by the TUI.
 *
 * All functions are pure: no side effects, no state mutation.
 *
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md}
 * @see {@link https://logos-engine/docs/architecture/06-tui-rendering-architecture.md}
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.9}
 */
import type {
	ActionBarRenderAction,
	ActionBarRenderModel,
	InputRenderModel,
	LogosProfile,
	MainPanelRenderModel,
	NodeAction,
	NodeLifecycle,
	RuntimeDiagnostic,
	SessionMode,
	SidebarDocument,
	SidebarNode,
	SidebarPhase,
	SidebarRenderModel,
	TuiRenderSnapshot,
} from '../contracts/index.js';
import type { DocumentId, NodeId } from '../shared/index.js';
import type { StateEngineSnapshot } from '../state-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Status symbols per lifecycle
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_SYMBOL_MAP: Readonly<Record<NodeLifecycle, string>> = {
	accepted: '✓',
	active: '◐',
	answered: '◐',
	blocked: '⚠',
	deferred: '⏸',
	needs_clarification: '?',
	needs_refinement: '△',
	not_started: '○',
	ready_for_synthesis: '◆',
	synthesized: '◆',
};

/**
 * Return the single-character status symbol for a given node lifecycle.
 *
 * Exported for unit testing status-symbol mappings.
 *
 * @param lifecycle - The current node lifecycle.
 * @returns The status symbol string (e.g., '◐' for 'active').
 */
export function getStatusSymbolForLifecycle(lifecycle: NodeLifecycle): string {
	return STATUS_SYMBOL_MAP[lifecycle];
}

// ═══════════════════════════════════════════════════════════════════════════
// Action labels — from prototypes §2.9 (Contextual Actions)
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_LABEL_MAP: Readonly<Record<NodeAction, string>> = {
	accept: '[Accept]',
	answer: '[Answer]',
	ask_for_example: '[Ask for example]',
	continue_next: '[Continue →]',
	defer: '[Defer]',
	edit: '[Edit]',
	mark_as_assumption: '[Mark as Assumption]',
	mark_as_decision: '[Mark as Decision]',
	open_document_preview: '[Preview Document]',
	open_prerequisite: '[Open Prerequisite]',
	regenerate: '[Regenerate]',
	reopen: '[Reopen]',
	resume: '[Resume]',
	skip: '[Skip]',
};

// ─── Global (non-node) actions for structural modes ─────────────────────────

type GlobalActionId = 'select_profile' | 'import_context' | 'open_settings';

const GLOBAL_ACTION_LABEL_MAP: Readonly<Record<GlobalActionId, string>> = {
	import_context: '[Import Context]',
	open_settings: '[Settings]',
	select_profile: '[Select Profile]',
};

// ═══════════════════════════════════════════════════════════════════════════
// Input enabled lifecycles
// ═══════════════════════════════════════════════════════════════════════════

const INPUT_ENABLED_LIFECYCLES: ReadonlySet<NodeLifecycle> = new Set([
	'not_started',
	'active',
	'answered',
	'needs_clarification',
	'needs_refinement',
]);

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a fresh `SidebarRenderModel` from the snapshot's existing sidebar
 * and the profile's structural ordering.
 *
 * Strategy:
 * 1. Flatten `snapshot.sidebar` into lookup maps by `nodeId` and
 *    `documentId` so we preserve all state-derived render data that
 *    the snapshot builder already computed.
 * 2. Rebuild the ordered phase/document/node hierarchy from
 *    `profile.phases/documents/nodes`.
 * 3. For each node, merge the existing render state from the flattened
 *    map and normalize `selected`, `disabled`, and `statusSymbol`.
 */
function buildSidebar(
	snapshot: StateEngineSnapshot,
	profile: LogosProfile,
): SidebarRenderModel {
	// No profile selected → empty sidebar.
	if (snapshot.selectedProfileId === null) {
		return { activeNodeId: null, phases: [] };
	}

	// ── Flatten snapshot sidebar into lookup maps ───────────────────────

	const nodeMap = new Map<NodeId, SidebarNode>();
	const docStatusMap = new Map<DocumentId, { statusSymbol?: string }>();

	for (const phase of snapshot.sidebar.phases) {
		for (const doc of phase.documents) {
			if (doc.statusSymbol !== undefined) {
				docStatusMap.set(doc.documentId, {
					statusSymbol: doc.statusSymbol,
				});
			}
			for (const node of doc.nodes) {
				nodeMap.set(node.nodeId, node);
			}
		}
	}

	// ── Determine lifecycle for the active node (if any) ────────────────

	const activeNodeLifecycle: NodeLifecycle | null =
		snapshot.activeNodeId !== null && snapshot.activeNodeState !== null
			? snapshot.activeNodeState.lifecycle
			: null;

	// ── Rebuild phases / documents / nodes from profile ordering ────────

	const phases: SidebarPhase[] = [];

	// Sort copies by `.order` to guarantee consistent display ordering
	const sortedPhases = [...profile.phases].sort((a, b) => a.order - b.order);
	const sortedDocs = [...profile.documents].sort((a, b) => a.order - b.order);
	const sortedNodes = [...profile.nodes].sort((a, b) => a.order - b.order);

	for (const phaseDef of sortedPhases) {
		const phaseDocs: SidebarDocument[] = [];

		for (const docDef of sortedDocs.filter(
			(d) => d.phaseId === phaseDef.id,
		)) {
			const existingDocStatus = docStatusMap.get(docDef.id);
			const docNodes: SidebarNode[] = [];

			for (const nodeDef of sortedNodes.filter(
				(n) => n.documentId === docDef.id,
			)) {
				const existing = nodeMap.get(nodeDef.id);

				// Start from existing state if available, otherwise build fresh
				const isActive = snapshot.activeNodeId === nodeDef.id;
				let statusSymbol: string;
				let disabled: boolean;
				let reasonIfDisabled: string | undefined;

				if (existing) {
					// Preserve existing state-derived data from snapshot sidebar
					statusSymbol = existing.statusSymbol;
					disabled = existing.disabled;
					reasonIfDisabled = existing.reasonIfDisabled;

					// Normalize: if snapshot's activeNodeState tells us the lifecycle,
					// use that for the symbol (more accurate than sidebar pass-through)
					if (isActive && activeNodeLifecycle !== null) {
						statusSymbol = STATUS_SYMBOL_MAP[activeNodeLifecycle];
					}

					// Normalize: blocked nodes should always be disabled
					if (statusSymbol === '⚠') {
						disabled = true;
						reasonIfDisabled =
							existing.reasonIfDisabled ??
							'This node is blocked by unmet prerequisites.';
					}
				} else {
					// No existing state — default to not_started
					statusSymbol = STATUS_SYMBOL_MAP['not_started'];
					disabled = false;
					reasonIfDisabled = undefined;
				}

				docNodes.push(
					reasonIfDisabled !== undefined
						? {
								disabled,
								nodeId: nodeDef.id,
								reasonIfDisabled,
								selected: isActive,
								statusSymbol,
								title: nodeDef.title,
						  }
						: {
								disabled,
								nodeId: nodeDef.id,
								selected: isActive,
								statusSymbol,
								title: nodeDef.title,
						  },
				);
			}

			const doc: SidebarDocument = {
				documentId: docDef.id,
				nodes: docNodes,
				title: docDef.title,
			};

			if (existingDocStatus?.statusSymbol !== undefined) {
				(doc as { statusSymbol?: string }).statusSymbol =
					existingDocStatus.statusSymbol;
			}

			phaseDocs.push(doc);
		}

		// Skip phases with no documents
		if (phaseDocs.length > 0) {
			phases.push({
				documents: phaseDocs,
				phaseId: phaseDef.id,
				title: phaseDef.title,
			});
		}
	}

	return {
		activeNodeId: snapshot.activeNodeId,
		phases,
		profileTitle: profile.title,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Action bar builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the action bar from the snapshot's allowed actions and the
 * current session mode.
 *
 * - In `node_focus` mode, maps `snapshot.allowedActions` to
 *   `ActionBarRenderAction` entries with labels from prototypes §2.9.
 * - In `idle` mode, produces deterministic global actions (Select Profile,
 *   Import Context, Settings) as specified in prototypes §3.1.
 */
function buildActionBar(snapshot: StateEngineSnapshot): ActionBarRenderModel {
	const actions: ActionBarRenderAction[] = [];

	// ── Idle mode: global deterministic actions ─────────────────────────

	if (snapshot.mode === 'idle') {
		for (const id of [
			'select_profile',
			'import_context',
			'open_settings',
		] as GlobalActionId[]) {
			actions.push({
				enabled: true,
				id,
				label: GLOBAL_ACTION_LABEL_MAP[id],
			});
		}

		return { actions };
	}

	// ── Node-focused mode: map allowed node actions ─────────────────────

	if (snapshot.activeNodeState !== null) {
		for (const action of snapshot.allowedActions) {
			actions.push({
				enabled: true,
				id: action,
				label: ACTION_LABEL_MAP[action],
				nodeAction: action,
			});
		}

		return { actions };
	}

	// ── Structural modes with profile selected: no node actions, no
	//    global actions (snapshot builder handles main panel actions) ────

	return { actions: [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// Input builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the input model from the snapshot's mode, active node lifecycle,
 * and allowed actions.
 *
 * Text input is enabled only when:
 * - The session is in `node_focus` mode.
 * - The active node's lifecycle permits user text entry.
 * - `answer` is among the allowed actions.
 */
function buildInput(snapshot: StateEngineSnapshot): InputRenderModel {
	// ── Input is only possible in node focus mode ───────────────────────

	if (snapshot.mode !== 'node_focus' || snapshot.activeNodeState === null) {
		return formatDisabledInput(snapshot.mode);
	}

	const lifecycle = snapshot.activeNodeState.lifecycle;

	// ── Check if lifecycle permits input ────────────────────────────────

	if (!INPUT_ENABLED_LIFECYCLES.has(lifecycle)) {
		return {
			enabled: false,
			reasonIfDisabled: reasonForDisabledInput(lifecycle),
		};
	}

	// ── Check if 'answer' action is allowed ─────────────────────────────

	if (!snapshot.allowedActions.includes('answer')) {
		return {
			enabled: false,
			reasonIfDisabled: 'Text input is not available in this context.',
		};
	}

	return {
		enabled: true,
		placeholder: 'Type your answer…',
		submitAction: 'answer',
	};
}

/**
 * Build a disabled input model for non-focus modes.
 */
function formatDisabledInput(mode: SessionMode): InputRenderModel {
	const reasonMap: Readonly<Partial<Record<SessionMode, string>>> = {
		document_preview:
			'Text input is not available while previewing a document.',
		error: 'Text input is not available in error mode.',
		export: 'Text input is not available in export mode.',
		idle: 'Select a profile to begin.',
		profile_selection: 'Text input is not available while selecting a profile.',
		settings: 'Text input is not available in settings mode.',
		structure_overview: 'Select a node to begin answering.',
	};

	return {
		enabled: false,
		reasonIfDisabled: reasonMap[mode] ?? 'Text input is not available.',
	};
}

/**
 * Provide a human-readable reason for disabled input based on lifecycle.
 */
function reasonForDisabledInput(lifecycle: NodeLifecycle): string {
	const reasonMap: Readonly<Partial<Record<NodeLifecycle, string>>> = {
		accepted: 'This node has been accepted. Reopen to edit.',
		blocked:
			'This node is blocked by unmet prerequisites. Resolve them first.',
		deferred: 'This node has been deferred. Resume to continue.',
		synthesized:
			'Review the draft answer before providing input. Accept, edit, or regenerate.',
	};

	return reasonMap[lifecycle] ?? `Text input is not available in the current state (${lifecycle}).`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a `TuiRenderSnapshot` — the fully-specified render model consumed
 * by the TUI — from a domain `StateEngineSnapshot` and the loaded
 * `LogosProfile`.
 *
 * The TUI must be able to render every screen from this snapshot alone.
 *
 * @param snapshot - The domain snapshot produced by the state engine.
 * @param profile  - The loaded profile definition (for structural ordering).
 * @returns A complete `TuiRenderSnapshot` ready for TUI rendering.
 */
export function buildRenderSnapshot(
	snapshot: StateEngineSnapshot,
	profile: LogosProfile,
): TuiRenderSnapshot {
	return {
		actionBar: buildActionBar(snapshot),
		diagnostics: snapshot.diagnostics as RuntimeDiagnostic[],
		input: buildInput(snapshot),
		mainPanel: snapshot.mainPanel as MainPanelRenderModel,
		mode: snapshot.mode,
		sidebar: buildSidebar(snapshot, profile),
	};
}
