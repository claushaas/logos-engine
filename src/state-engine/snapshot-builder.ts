/**
 * State engine snapshot builder — builds `StateEngineSnapshot` from
 * `LogosRuntimeState` and `LogosProfile`.
 *
 * The application layer maps the domain `StateEngineSnapshot` to
 * `TuiRenderSnapshot` for the TUI (Step 8.1). This module stays in
 * the state engine layer and produces domain types only.
 *
 * All functions are pure: no side effects, no state mutation.
 *
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §12}
 */
import type {
	DocumentRuntimeState,
	ErrorPanel,
	LogosProfile,
	LogosRuntimeState,
	MainPanelRenderModel,
	NodeAction,
	NodeConversationPanel,
	NodeLifecycle,
	NodeRuntimeState,
	SidebarDocument,
	SidebarNode,
	SidebarPhase,
	SidebarRenderModel,
} from '../contracts/index.js';
import type { DocumentId, NodeId } from '../shared/index.js';
import { getAllowedActions } from './allowed-actions.js';
import { resolveSessionModeWithDiagnostics } from './session-mode.js';
import type { StateDiagnostic, StateEngineSnapshot } from './types.js';

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

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar builder
// ═══════════════════════════════════════════════════════════════════════════

function buildSidebarNode(
	nodeDef: { readonly id: NodeId; readonly title: string },
	nodeState: NodeRuntimeState | undefined,
	activeNodeId: NodeId | null,
): SidebarNode {
	const lifecycle: NodeLifecycle = nodeState?.lifecycle ?? 'not_started';

	return {
		disabled: false,
		nodeId: nodeDef.id,
		selected: activeNodeId === nodeDef.id,
		statusSymbol: STATUS_SYMBOL_MAP[lifecycle],
		title: nodeDef.title,
	};
}

function buildSidebarDocument(
	docDef: { readonly id: DocumentId; readonly title: string },
	nodeDefs: ReadonlyArray<{
		readonly id: NodeId;
		readonly documentId: DocumentId;
		readonly title: string;
	}>,
	documentState: DocumentRuntimeState | undefined,
	nodeStates: Record<NodeId, NodeRuntimeState>,
	activeNodeId: NodeId | null,
): SidebarDocument {
	const docNodes = nodeDefs
		.filter((n) => n.documentId === docDef.id)
		.map((n) => buildSidebarNode(n, nodeStates[n.id], activeNodeId));

	if (documentState?.status !== undefined) {
		return {
			documentId: docDef.id,
			nodes: docNodes,
			statusSymbol: documentState.status,
			title: docDef.title,
		};
	}

	return {
		documentId: docDef.id,
		nodes: docNodes,
		title: docDef.title,
	} as SidebarDocument;
}

function buildSidebar(
	state: LogosRuntimeState,
	profile: LogosProfile,
): SidebarRenderModel {
	const phases: SidebarPhase[] = [];

	for (const phaseDef of profile.phases) {
		const phaseDocs: SidebarDocument[] = [];

		for (const docDef of profile.documents.filter(
			(d) => d.phaseId === phaseDef.id,
		)) {
			phaseDocs.push(
				buildSidebarDocument(
					docDef,
					profile.nodes,
					state.documentStates[docDef.id],
					state.nodeStates,
					state.activeNodeId,
				),
			);
		}

		phases.push({
			documents: phaseDocs,
			phaseId: phaseDef.id,
			title: phaseDef.title,
		});
	}

	return {
		activeNodeId: state.activeNodeId,
		phases,
		profileTitle: profile.title,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Main panel builder
// ═══════════════════════════════════════════════════════════════════════════

function buildErrorPanel(
	diagnostics: ReadonlyArray<{ readonly message: string }>,
): ErrorPanel {
	if (diagnostics.length > 1) {
		return {
			kind: 'error',
			message: diagnostics[0]?.message ?? 'An unknown error occurred.',
			recoveryHint: 'Multiple state inconsistencies detected.',
		} as ErrorPanel;
	}

	return {
		kind: 'error',
		message: diagnostics[0]?.message ?? 'An unknown error occurred.',
	} as ErrorPanel;
}

function buildMainPanel(
	state: LogosRuntimeState,
	mode: ReturnType<typeof resolveSessionModeWithDiagnostics>,
	profile: LogosProfile,
): MainPanelRenderModel {
	if (mode.mode === 'error') {
		return buildErrorPanel(mode.diagnostics);
	}

	if (mode.mode === 'idle') {
		return { kind: 'idle' };
	}

	if (mode.mode === 'structure_overview') {
		const availableProfileIds = state.selectedProfileId
			? [state.selectedProfileId]
			: [];

		return {
			availableProfileIds,
			kind: 'profile',
			message: state.selectedProfileId
				? `Working with profile: ${profile.title}`
				: 'Select a profile to begin.',
		};
	}

	if (mode.mode === 'node_focus' && state.activeNodeId !== null) {
		const nodeState = state.nodeStates[state.activeNodeId];
		const nodeDef = profile.nodes.find((n) => n.id === state.activeNodeId);

		if (!nodeState || !nodeDef) {
			return {
				kind: 'error',
				message: `Node "${state.activeNodeId}" not found in profile or runtime state.`,
			} as ErrorPanel;
		}

		const docDef = profile.documents.find((d) => d.id === nodeDef.documentId);
		const phaseDef = profile.phases.find((p) => p.id === nodeDef.phaseId);
		const breadcrumb =
			phaseDef && docDef
				? `${phaseDef.title} / ${docDef.title} / ${nodeDef.title}`
				: nodeDef.title;

		const canonicalAnswer = nodeState.canonicalAnswer;
		const canonicalAnswerPreview = canonicalAnswer?.content ?? null;
		const canonicalAnswerAccepted =
			canonicalAnswer?.accepted === true;
		const canonicalAnswerConfidence = canonicalAnswer?.confidence;
		const canonicalAnswerSourceMessageCount =
			canonicalAnswer?.generatedFromMessageIds.length;
		const canonicalAnswerStale = canonicalAnswer?.stale;

		const messages = nodeState.conversation.map((msg) => ({
			content: msg.content,
			createdAt: msg.createdAt,
			id: msg.id,
			role: msg.role,
		}));

		let completenessSummary: string | undefined;
		if (nodeState.completeness.complete) {
			completenessSummary = 'Conversation is complete — ready for synthesis.';
		} else if (nodeState.completeness.missing.length > 0) {
			completenessSummary = `Missing: ${nodeState.completeness.missing.join(', ')}`;
		} else if (nodeState.completeness.weak.length > 0) {
			completenessSummary = `Weak: ${nodeState.completeness.weak.join(', ')}`;
		}

		// Build NodeConversationPanel with only present optional fields
		const basePanel = {
			breadcrumb,
			canonicalAnswerAccepted,
			canonicalAnswerPreview,
			kind: 'node_conversation' as const,
			lifecycle: nodeState.lifecycle,
			messages,
			nodeId: state.activeNodeId,
			title: nodeDef.title,
		};

		// Attach canonical metadata only when a canonical answer exists
		const basePanelWithCanonical =
			canonicalAnswerPreview !== null
				? {
						...basePanel,
						canonicalAnswerConfidence,
						canonicalAnswerSourceMessageCount,
						canonicalAnswerStale,
				  }
				: basePanel;

		if (completenessSummary !== undefined) {
			return {
				...basePanelWithCanonical,
				completenessSummary,
			} as NodeConversationPanel;
		}

		return basePanelWithCanonical as NodeConversationPanel;
	}

	// Fallback for modes not yet implemented
	if (mode.mode === 'document_preview') {
		return {
			content: null,
			documentId: '' as DocumentId,
			exportEligible: false,
			kind: 'document_preview',
			missingNodeIds: [],
			staleNodeIds: [],
			title: 'Document Preview',
		} as MainPanelRenderModel;
	}

	if (mode.mode === 'export') {
		return {
			availableFormats: ['markdown', 'html', 'agent_pack'],
			eligibleDocumentIds: [],
			generatedArtifacts: [],
			kind: 'export',
		} as MainPanelRenderModel;
	}

	if (mode.mode === 'settings') {
		return { kind: 'settings' };
	}

	return { kind: 'idle' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

export function buildSnapshot(
	state: LogosRuntimeState,
	profile: LogosProfile,
	diagnostics: StateDiagnostic[] = [],
): StateEngineSnapshot {
	const modeResolution = resolveSessionModeWithDiagnostics(state, profile);
	const allDiagnostics = [...diagnostics, ...modeResolution.diagnostics];

	const activeNodeState: NodeRuntimeState | null =
		state.activeNodeId !== null
			? (state.nodeStates[state.activeNodeId] ?? null)
			: null;

	const allowedActions: NodeAction[] = activeNodeState
		? getAllowedActions(activeNodeState.lifecycle)
		: [];

	const sidebar = buildSidebar(state, profile);
	const mainPanel = buildMainPanel(state, modeResolution, profile);

	return {
		activeNodeId: state.activeNodeId,
		activeNodeState,
		allowedActions,
		diagnostics: allDiagnostics,
		mainPanel,
		mode: modeResolution.mode,
		selectedProfileId: state.selectedProfileId,
		sidebar,
	};
}
