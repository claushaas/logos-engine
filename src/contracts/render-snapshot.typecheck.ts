/**
 * Compile-time assertions for Step 1.5 render snapshot types.
 *
 * This file exercises TypeScript-level type identity for the
 * render-snapshot contracts created in Step 1.5. It is NOT a
 * runtime test — if any assertion were violated, the project
 * would not type-check.
 *
 * Tests:
 *  1. Construct a valid `TuiRenderSnapshot` for each `MainPanelRenderModel` variant.
 *  2. Verify `mainPanel` discriminated union narrowing works via exhaustive `switch`.
 *  3. Verify `SidebarRenderModel` shape.
 *  4. Verify `ActionBarRenderModel` shape.
 *  5. Verify `InputRenderModel` shape.
 *  6. Verify `RuntimeDiagnostic` shape.
 */
import type { DocumentId, NodeId } from '../shared/index.js';
import type {
	ActionBarRenderAction,
	ActionBarRenderModel,
	InputRenderModel,
	MainPanelRenderModel,
	RuntimeDiagnostic,
	SidebarRenderModel,
	TuiRenderSnapshot,
} from './index.js';

// ─── 1. TuiRenderSnapshot for each panel variant ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _idleSnapshot: TuiRenderSnapshot = {
	actionBar: { actions: [] },
	diagnostics: [],
	input: { enabled: false },
	mainPanel: { kind: 'idle' },
	mode: 'idle',
	sidebar: {
		activeNodeId: null,
		phases: [],
	},
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _profileSnapshot: TuiRenderSnapshot = {
	actionBar: {
		actions: [
			{ enabled: true, id: 'select_startup', label: 'Startup Profile' },
		],
	},
	diagnostics: [],
	input: { enabled: false, reasonIfDisabled: 'Profile selection mode' },
	mainPanel: {
		availableProfileIds: ['startup'],
		kind: 'profile',
		message: 'Select a profile',
	},
	mode: 'profile_selection',
	sidebar: {
		activeNodeId: null,
		phases: [],
		profileTitle: 'Startup',
	},
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _nodeConversationSnapshot: TuiRenderSnapshot = {
	actionBar: {
		actions: [
			{ enabled: true, id: 'answer', label: 'Answer', nodeAction: 'answer' },
			{ enabled: true, id: 'defer', label: 'Defer', nodeAction: 'defer' },
			{
				enabled: true,
				id: 'ask_for_example',
				label: 'Ask for Example',
				nodeAction: 'ask_for_example',
			},
		],
	},
	diagnostics: [],
	input: {
		enabled: true,
		placeholder: 'Type your answer...',
		submitAction: 'answer',
	},
	mainPanel: {
		breadcrumb: 'Foundation / Thesis / Core Thesis',
		canonicalAnswerAccepted: false,
		canonicalAnswerPreview: null,
		completenessSummary: '1/3 topics covered',
		kind: 'node_conversation',
		lifecycle: 'needs_refinement',
		messages: [
			{
				content: 'Our thesis is...',
				createdAt: '2026-01-01T00:00:00.000Z',
				id: 'msg_1',
				role: 'user',
			},
			{
				content: 'Got it. But can you make this more specific?',
				createdAt: '2026-01-01T00:00:01.000Z',
				id: 'msg_2',
				role: 'assistant',
			},
		],
		nodeId: 'node_core_thesis' as NodeId,
		title: 'Core Thesis',
	},
	mode: 'node_focus',
	sidebar: {
		activeNodeId: 'node_core_thesis' as NodeId,
		phases: [
			{
				documents: [
					{
						documentId: 'doc_thesis' as DocumentId,
						nodes: [
							{
								disabled: false,
								nodeId: 'node_core_thesis' as NodeId,
								selected: true,
								statusSymbol: '△',
								title: 'Core Thesis',
							},
						],
						title: 'Thesis',
					},
				],
				phaseId: 'phase_01',
				title: 'Foundation',
			},
		],
		profileTitle: 'Startup',
	},
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _documentPreviewSnapshot: TuiRenderSnapshot = {
	actionBar: { actions: [{ enabled: true, id: 'export', label: 'Export' }] },
	diagnostics: [],
	input: { enabled: false, reasonIfDisabled: 'Document preview mode' },
	mainPanel: {
		content: '# Thesis\n\nOur core thesis...',
		documentId: 'doc_thesis' as DocumentId,
		exportEligible: true,
		kind: 'document_preview',
		missingNodeIds: [],
		staleNodeIds: [],
		title: 'Thesis Document',
	},
	mode: 'document_preview',
	sidebar: {
		activeNodeId: 'node_core_thesis' as NodeId,
		phases: [],
		profileTitle: 'Startup',
	},
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _exportSnapshot: TuiRenderSnapshot = {
	actionBar: {
		actions: [
			{ enabled: true, id: 'export_markdown', label: 'Export Markdown' },
		],
	},
	diagnostics: [],
	input: { enabled: false },
	mainPanel: {
		availableFormats: ['markdown', 'html', 'agent_pack'],
		eligibleDocumentIds: ['doc_thesis' as DocumentId],
		generatedArtifacts: [],
		kind: 'export',
	},
	mode: 'export',
	sidebar: {
		activeNodeId: null,
		phases: [],
		profileTitle: 'Startup',
	},
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _settingsSnapshot: TuiRenderSnapshot = {
	actionBar: { actions: [] },
	diagnostics: [],
	input: { enabled: false },
	mainPanel: { kind: 'settings' },
	mode: 'settings',
	sidebar: {
		activeNodeId: null,
		phases: [],
		profileTitle: 'Startup',
	},
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _errorSnapshot: TuiRenderSnapshot = {
	actionBar: { actions: [{ enabled: true, id: 'retry', label: 'Retry' }] },
	diagnostics: [
		{
			code: 'PROFILE_NOT_FOUND',
			message: 'Profile not found at path',
			severity: 'error',
			sourceId: 'startup',
		},
	],
	input: { enabled: false, reasonIfDisabled: 'Error mode' },
	mainPanel: {
		kind: 'error',
		message: 'Profile not found',
		recoveryHint: 'Check the profile path',
	},
	mode: 'error',
	sidebar: {
		activeNodeId: null,
		phases: [],
	},
};

// ─── 2. MainPanelRenderModel discriminated union narrowing ──────────────────

/**
 * Exhaustive switch — if a panel variant is missing, this will not compile.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _renderPanelKind(panel: MainPanelRenderModel): string {
	switch (panel.kind) {
		case 'idle':
			return 'idle';
		case 'profile':
			return `profile: ${panel.availableProfileIds.length} profiles`;
		case 'node_conversation':
			return `node: ${panel.title} (${panel.lifecycle})`;
		case 'document_preview':
			return `document: ${panel.title}`;
		case 'export':
			return `export: ${panel.availableFormats.join(', ')}`;
		case 'settings':
			return 'settings';
		case 'error':
			return `error: ${panel.message}`;
	}
}

// ─── 3. Verify SidebarRenderModel shape ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sidebarModel: SidebarRenderModel = {
	activeNodeId: 'node_core_thesis' as NodeId,
	phases: [
		{
			documents: [
				{
					documentId: 'd1' as DocumentId,
					nodes: [
						{
							disabled: false,
							nodeId: 'node_core_thesis' as NodeId,
							selected: true,
							statusSymbol: '△',
							title: 'Core Thesis',
						},
						{
							disabled: true,
							nodeId: 'node_tension' as NodeId,
							reasonIfDisabled: 'Prerequisite: Core Thesis',
							selected: false,
							statusSymbol: '○',
							title: 'Central Tension',
						},
					],
					statusSymbol: '◆',
					title: 'Thesis',
				},
			],
			phaseId: 'p1',
			title: 'Foundation',
		},
	],
	profileTitle: 'Startup',
};

// ─── 4. Verify ActionBarRenderModel shape ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _actionBar: ActionBarRenderModel = {
	actions: [
		{ enabled: true, id: 'answer', label: 'Answer', nodeAction: 'answer' },
		{
			enabled: false,
			id: 'accept',
			label: 'Accept',
			nodeAction: 'accept',
			reasonIfDisabled: 'Not synthesized yet',
		},
		{
			enabled: true,
			id: 'continue_next',
			label: 'Next Node',
			nodeAction: 'continue_next',
		},
	],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _globalAction: ActionBarRenderAction = {
	enabled: true,
	id: 'export_markdown',
	label: 'Export Markdown',
	// No nodeAction for global actions
};

// ─── 5. Verify InputRenderModel shape ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _inputEnabled: InputRenderModel = {
	enabled: true,
	placeholder: 'Type your answer...',
	submitAction: 'answer',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _inputDisabled: InputRenderModel = {
	enabled: false,
	reasonIfDisabled: 'Document preview mode',
};

// ─── 6. Verify RuntimeDiagnostic shape ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _diag: RuntimeDiagnostic = {
	code: 'STALE_CANONICAL',
	message: 'Node core_thesis has a stale canonical answer',
	severity: 'warning',
	sourceId: 'node_core_thesis',
};
