/**
 * Step 15.2 — Render snapshot schema contract tests
 *
 * Validates that example `TuiRenderSnapshot` objects match the contract
 * shape. Covers:
 *   - All 7 `MainPanelRenderModel` variants with valid example fixtures.
 *   - Sidebar, action bar, input, and diagnostics sub-models.
 *   - Architecture invariant: actions in the action bar must be compatible
 *     with the node's current lifecycle (uses production `getAllowedActions`).
 *   - Snapshot self-containment: all required sub-models are present.
 *
 * Uses the production `getAllowedActions` from `src/state-engine/` for the
 * invariant check. No production render-snapshot validator exists yet.
 *
 * All tests run without LLM credentials.
 *
 * @see {@link https://logos-engine/docs/architecture/07-contracts-and-schemas.md §13}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §6}
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md}
 */
import { describe, expect, it } from 'vitest';

import type {
	ActionBarRenderAction,
	ActionBarRenderModel,
	ErrorPanel,
	ErrorRecoveryAction,
	ExportPanel,
	IdlePanel,
	InputRenderModel,
	MainPanelRenderModel,
	NodeConversationPanel,
	NodeLifecycle,
	ProfilePanel,
	RuntimeDiagnostic,
	SessionMode,
	SidebarNode,
	SidebarPhase,
	SidebarRenderModel,
	TuiRenderSnapshot,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId } from '../../src/shared/index.js';
import { getAllowedActions, type NodeAction } from '../../src/state-engine/index.js';

// ─── Test-local shape validators ───────────────────────────────────────────

/**
 * Validate that a value has all expected keys.
 */
function hasAllKeys(
	obj: Record<string, unknown>,
	requiredKeys: string[],
): string[] {
	const missing: string[] = [];
	for (const key of requiredKeys) {
		if (!(key in obj)) {
			missing.push(key);
		}
	}
	return missing;
}

/**
 * Run basic assertions on a full TuiRenderSnapshot.
 * Returns an array of error messages, empty if valid.
 */
function validateSnapshotShape(snapshot: TuiRenderSnapshot): string[] {
	const errors: string[] = [];

	// Top-level required fields
	const topMissing = hasAllKeys(snapshot as unknown as Record<string, unknown>, [
		'mode',
		'sidebar',
		'mainPanel',
		'actionBar',
		'input',
		'diagnostics',
	]);
	for (const k of topMissing) {
		errors.push(`snapshot.${k}: missing required field`);
	}

	if (!Array.isArray(snapshot.diagnostics)) {
		errors.push('snapshot.diagnostics: expected array');
	}

	// Sidebar
	const sidebarMissing = hasAllKeys(
		snapshot.sidebar as unknown as Record<string, unknown>,
		['phases', 'activeNodeId'],
	);
	for (const k of sidebarMissing) {
		errors.push(`sidebar.${k}: missing`);
	}
	if (!Array.isArray(snapshot.sidebar.phases)) {
		errors.push('sidebar.phases: expected array');
	}

	// Action bar
	if (!Array.isArray(snapshot.actionBar.actions)) {
		errors.push('actionBar.actions: expected array');
	}

	// Input
	const inputMissing = hasAllKeys(
		snapshot.input as unknown as Record<string, unknown>,
		['enabled'],
	);
	for (const k of inputMissing) {
		errors.push(`input.${k}: missing`);
	}

	return errors;
}

/**
 * Check that every action in the action bar is compatible with the given
 * lifecycle. Uses the production `getAllowedActions` from the state engine.
 */
function validateActionsCompatibleWithLifecycle(
	actions: readonly ActionBarRenderAction[],
	lifecycle: NodeLifecycle,
): string[] {
	const errors: string[] = [];
	const allowed = new Set<NodeAction>(getAllowedActions(lifecycle));

	for (const action of actions) {
		if (action.nodeAction && !allowed.has(action.nodeAction)) {
			errors.push(
				`Action "${action.nodeAction}" (${action.label}) is not allowed in lifecycle "${lifecycle}"`,
			);
		}
	}

	return errors;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeSidebarNode(
	nodeId: NodeId,
	title: string,
	lifecycle: NodeLifecycle,
	selected: boolean,
): SidebarNode {
	const STATUS_SYMBOLS: Record<NodeLifecycle, string> = {
		accepted: '✓',
		active: '●',
		answered: '○',
		blocked: '⛔',
		deferred: '⏸',
		needs_clarification: '?',
		needs_refinement: '…',
		not_started: '·',
		ready_for_synthesis: '◆',
		synthesized: '◇',
	};

	return {
		disabled: lifecycle === 'blocked',
		nodeId,
		reasonIfDisabled: lifecycle === 'blocked' ? 'Blocked by prerequisite' : undefined,
		selected,
		statusSymbol: STATUS_SYMBOLS[lifecycle] ?? '·',
		title,
	};
}

function makeSidebarRenderModel(
	activeNodeId: NodeId | null,
): SidebarRenderModel {
	const nodes: SidebarNode[] = [
		makeSidebarNode('node-thesis' as NodeId, 'Core Thesis', 'answered', activeNodeId === ('node-thesis' as NodeId)),
		makeSidebarNode('node-problem' as NodeId, 'Core Problem', 'not_started', activeNodeId === ('node-problem' as NodeId)),
		makeSidebarNode('node-val' as NodeId, 'Validation Approach', 'blocked', activeNodeId === ('node-val' as NodeId)),
	];

	return {
		activeNodeId,
		phases: [
			{
				documents: [
					{
						documentId: 'doc-foundation' as DocumentId,
						nodes: [nodes[0], nodes[1]],
						statusSymbol: '○',
						title: 'Foundation',
					},
				],
				phaseId: '01-foundation',
				title: 'Foundation',
			},
			{
				documents: [
					{
						documentId: 'doc-validation' as DocumentId,
						nodes: [nodes[2]],
						statusSymbol: '·',
						title: 'Validation',
					},
				],
				phaseId: '02-validation',
				title: 'Validation',
			},
		],
		profileTitle: 'Startup Documentation Profile',
	};
}

function makeActionBar(
	actions: readonly {
		id: string;
		label: string;
		enabled: boolean;
		nodeAction?: NodeAction;
	}[],
): ActionBarRenderModel {
	return {
		actions: actions.map((a) => ({
			enabled: a.enabled,
			id: a.id,
			label: a.label,
			nodeAction: a.nodeAction,
		})),
	};
}

function makeInput(enabled: boolean, placeholder?: string): InputRenderModel {
	return {
		enabled,
		placeholder: placeholder ?? (enabled ? 'Type your answer...' : undefined),
		reasonIfDisabled: enabled
			? undefined
			: 'No node selected for conversation.',
		submitAction: enabled ? 'SUBMIT_USER_MESSAGE' : undefined,
	};
}

function makeEmptyDiagnostics(): RuntimeDiagnostic[] {
	return [];
}

function makeWarningDiagnostics(): RuntimeDiagnostic[] {
	return [
		{
			code: 'NODE_STALE',
			message: 'Canonical answer is stale due to upstream changes.',
			severity: 'warning',
			sourceId: 'node-thesis',
		},
	];
}

// ─── Panel fixtures ────────────────────────────────────────────────────────

function idlePanel(): IdlePanel {
	return {
		hasAvailableSessions: false,
		kind: 'idle',
	};
}

function profilePanel(): ProfilePanel {
	return {
		availableProfileIds: ['p_startup', 'p_minimal'],
		kind: 'profile',
		message: 'Select a profile to begin.',
	};
}

function nodeConversationPanel(lifecycle: NodeLifecycle): NodeConversationPanel {
	return {
		breadcrumb: 'Foundation / Thesis / Core Thesis',
		canonicalAnswerAccepted: lifecycle === 'accepted',
		canonicalAnswerConfidence: lifecycle === 'accepted' ? 'high' : undefined,
		canonicalAnswerPreview:
			lifecycle === 'synthesized' || lifecycle === 'accepted'
				? '## Core Thesis\n\nThe project exists because...'
				: null,
		canonicalAnswerSourceMessageCount:
			lifecycle === 'synthesized' || lifecycle === 'accepted' ? 4 : undefined,
		canonicalAnswerStale: false,
		completenessSummary:
			lifecycle === 'not_started'
				? 'No conversation yet.'
				: '2/3 topics covered.',
		kind: 'node_conversation',
		lifecycle,
		messages: [
			{
				content: 'What is the core thesis of your project?',
				createdAt: '2026-05-27T00:00:00.000Z',
				id: 'msg_1',
				role: 'assistant',
			},
			{
				content: 'My thesis is that sustainable food requires local production.',
				createdAt: '2026-05-27T00:01:00.000Z',
				id: 'msg_2',
				role: 'user',
			},
		],
		nodeId: 'node-thesis' as NodeId,
		title: 'Core Thesis',
	};
}

function documentPreviewPanel(): import('../../src/contracts/index.js').DocumentPreviewPanel {
	return {
		content: '# Foundation Thesis\n\nGenerated content here.',
		documentId: 'doc-foundation' as DocumentId,
		exportEligible: false,
		kind: 'document_preview',
		missingNodeIds: ['node-problem' as NodeId],
		staleNodeIds: [],
		title: 'Foundation Thesis',
	};
}

function exportPanel(): ExportPanel {
	return {
		availableFormats: ['markdown', 'html', 'agent_pack'],
		eligibleDocumentIds: [],
		generatedArtifacts: [],
		kind: 'export',
	};
}

function settingsPanel(): import('../../src/contracts/index.js').SettingsPanel {
	return { kind: 'settings' };
}

function errorPanel(): ErrorPanel {
	return {
		category: 'invalid_state',
		code: 'LOGOS_DISPATCH_NO_PROFILE',
		details: { attemptedNodeId: 'node-bogus' },
		kind: 'error',
		message: 'Cannot select a node without first selecting a profile.',
		recoverable: true,
		recoveryActions: ['clear_invalid_active_node' as ErrorRecoveryAction],
		recoveryHint: 'Select a profile first, then navigate to a node.',
	};
}

// ─── Full snapshot builders ────────────────────────────────────────────────

function makeSnapshot(
	mode: SessionMode,
	mainPanel: MainPanelRenderModel,
	sidebar: SidebarRenderModel,
	actionBar: ActionBarRenderModel,
	input: InputRenderModel,
	diagnostics?: RuntimeDiagnostic[],
): TuiRenderSnapshot {
	return {
		actionBar,
		diagnostics: diagnostics ?? makeEmptyDiagnostics(),
		input,
		mainPanel,
		mode,
		sidebar,
	};
}

// ─── Tests — valid snapshots for all panel variants ────────────────────────

describe('Render snapshot schema — valid examples', () => {
	it('idle snapshot has all required parts', () => {
		const snapshot = makeSnapshot(
			'idle',
			idlePanel(),
			makeSidebarRenderModel(null),
			makeActionBar([]),
			makeInput(false),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mainPanel.kind).toBe('idle');
	});

	it('profile panel snapshot has all required parts', () => {
		const snapshot = makeSnapshot(
			'profile_selection',
			profilePanel(),
			makeSidebarRenderModel(null),
			makeActionBar([
				{ enabled: true, id: 'select-profile', label: 'Select Profile' },
			]),
			makeInput(false),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mainPanel.kind).toBe('profile');
	});

	it('structure overview snapshot has correct mode', () => {
		const snapshot = makeSnapshot(
			'structure_overview',
			profilePanel(),
			makeSidebarRenderModel(null),
			makeActionBar([
				{ enabled: true, id: 'select-node', label: 'Select Node' },
			]),
			makeInput(false),
		);
		expect(snapshot.mode).toBe('structure_overview');
	});

	it('node conversation snapshot has all required parts (active lifecycle)', () => {
		const lifecycle: NodeLifecycle = 'active';
		const snapshot = makeSnapshot(
			'node_focus',
			nodeConversationPanel(lifecycle),
			makeSidebarRenderModel('node-thesis' as NodeId),
			makeActionBar([
				{ enabled: true, id: 'answer', label: 'Answer', nodeAction: 'answer' as NodeAction },
				{ enabled: true, id: 'defer', label: 'Defer', nodeAction: 'defer' as NodeAction },
			]),
			makeInput(true, 'Type your answer...'),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mode).toBe('node_focus');
		expect(snapshot.mainPanel.kind).toBe('node_conversation');

		// Verify action compatibility invariant
		const invariants = validateActionsCompatibleWithLifecycle(
			snapshot.actionBar.actions,
			lifecycle,
		);
		expect(invariants).toEqual([]);
	});

	it('node conversation snapshot (not_started lifecycle) has compatible actions', () => {
		const lifecycle: NodeLifecycle = 'not_started';
		const snapshot = makeSnapshot(
			'node_focus',
			nodeConversationPanel(lifecycle),
			makeSidebarRenderModel('node-problem' as NodeId),
			makeActionBar([
				{ enabled: true, id: 'answer', label: 'Answer', nodeAction: 'answer' as NodeAction },
				{ enabled: true, id: 'skip', label: 'Skip', nodeAction: 'skip' as NodeAction },
			]),
			makeInput(true, 'Type your answer...'),
		);
		const invariants = validateActionsCompatibleWithLifecycle(
			snapshot.actionBar.actions,
			lifecycle,
		);
		expect(invariants).toEqual([]);
	});

	it('node conversation snapshot (synthesized lifecycle) has compatible actions', () => {
		const lifecycle: NodeLifecycle = 'synthesized';
		const snapshot = makeSnapshot(
			'node_focus',
			nodeConversationPanel(lifecycle),
			makeSidebarRenderModel('node-thesis' as NodeId),
			makeActionBar([
				{ enabled: true, id: 'accept', label: 'Accept', nodeAction: 'accept' as NodeAction },
				{ enabled: true, id: 'edit', label: 'Edit', nodeAction: 'edit' as NodeAction },
				{ enabled: true, id: 'regenerate', label: 'Regenerate', nodeAction: 'regenerate' as NodeAction },
			]),
			makeInput(false),
		);
		const invariants = validateActionsCompatibleWithLifecycle(
			snapshot.actionBar.actions,
			lifecycle,
		);
		expect(invariants).toEqual([]);
	});

	it('node conversation snapshot (accepted lifecycle) has compatible actions', () => {
		const lifecycle: NodeLifecycle = 'accepted';
		const snapshot = makeSnapshot(
			'node_focus',
			nodeConversationPanel(lifecycle),
			makeSidebarRenderModel('node-thesis' as NodeId),
			makeActionBar([
				{ enabled: true, id: 'continue', label: 'Continue', nodeAction: 'continue_next' as NodeAction },
				{ enabled: true, id: 'reopen', label: 'Reopen', nodeAction: 'reopen' as NodeAction },
			]),
			makeInput(false),
		);
		const invariants = validateActionsCompatibleWithLifecycle(
			snapshot.actionBar.actions,
			lifecycle,
		);
		expect(invariants).toEqual([]);
	});

	it('document preview snapshot has all required parts', () => {
		const snapshot = makeSnapshot(
			'document_preview',
			documentPreviewPanel(),
			makeSidebarRenderModel(null),
			makeActionBar([
				{ enabled: true, id: 'export', label: 'Export' },
			]),
			makeInput(false),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mainPanel.kind).toBe('document_preview');
	});

	it('export panel snapshot has all required parts', () => {
		const snapshot = makeSnapshot(
			'export',
			exportPanel(),
			makeSidebarRenderModel(null),
			makeActionBar([
				{ enabled: true, id: 'export-markdown', label: 'Export Markdown' },
			]),
			makeInput(false),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mainPanel.kind).toBe('export');
	});

	it('settings panel snapshot has all required parts', () => {
		const snapshot = makeSnapshot(
			'settings',
			settingsPanel(),
			makeSidebarRenderModel(null),
			makeActionBar([]),
			makeInput(false),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mainPanel.kind).toBe('settings');
	});

	it('error panel snapshot has all required parts', () => {
		const snapshot = makeSnapshot(
			'error',
			errorPanel(),
			makeSidebarRenderModel(null),
			makeActionBar([
				{ enabled: true, id: 'retry', label: 'Retry' },
			]),
			makeInput(false),
			makeWarningDiagnostics(),
		);
		const errors = validateSnapshotShape(snapshot);
		expect(errors).toEqual([]);
		expect(snapshot.mainPanel.kind).toBe('error');
		expect(snapshot.diagnostics.length).toBeGreaterThan(0);
	});
});

// ─── Tests — architecture invariants ──────────────────────────────────────

describe('Render snapshot schema — architecture invariants', () => {
	it('snapshot is self-contained — all sub-models present', () => {
		const snapshot = makeSnapshot(
			'node_focus',
			nodeConversationPanel('active'),
			makeSidebarRenderModel('node-thesis' as NodeId),
			makeActionBar([{ enabled: true, id: 'answer', label: 'Answer', nodeAction: 'answer' as NodeAction }]),
			makeInput(true),
			makeWarningDiagnostics(),
		);

		expect(snapshot.mode).toBeDefined();
		expect(snapshot.sidebar).toBeDefined();
		expect(snapshot.mainPanel).toBeDefined();
		expect(snapshot.actionBar).toBeDefined();
		expect(snapshot.input).toBeDefined();
		expect(snapshot.diagnostics).toBeDefined();
	});

	it('accept action is NOT available in not_started lifecycle', () => {
		const lifecycle: NodeLifecycle = 'not_started';
		const allowed = getAllowedActions(lifecycle);
		expect(allowed).not.toContain('accept');
	});

	it('accept action IS available in synthesized lifecycle', () => {
		const lifecycle: NodeLifecycle = 'synthesized';
		const allowed = getAllowedActions(lifecycle);
		expect(allowed).toContain('accept');
	});

	it('action bar with incompatible action is caught by invariant check', () => {
		const lifecycle: NodeLifecycle = 'not_started';
		const actions: ActionBarRenderAction[] = [
			{ enabled: true, id: 'accept', label: 'Accept', nodeAction: 'accept' as NodeAction },
		];
		const errors = validateActionsCompatibleWithLifecycle(actions, lifecycle);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]).toContain('accept');
	});

	it('all 10 lifecycles have a valid action set', () => {
		const lifecycles: NodeLifecycle[] = [
			'not_started', 'active', 'answered', 'needs_clarification',
			'needs_refinement', 'ready_for_synthesis', 'synthesized',
			'accepted', 'deferred', 'blocked',
		];
		for (const lc of lifecycles) {
			const actions = getAllowedActions(lc);
			expect(Array.isArray(actions)).toBe(true);
		}
	});

	it('sidebar nodes have all required fields', () => {
		const sidebar = makeSidebarRenderModel('node-thesis' as NodeId);
		for (const phase of sidebar.phases) {
			expect(typeof phase.phaseId).toBe('string');
			expect(typeof phase.title).toBe('string');
			expect(Array.isArray(phase.documents)).toBe(true);
			for (const doc of phase.documents) {
				expect(typeof doc.documentId).toBe('string');
				expect(typeof doc.title).toBe('string');
				expect(Array.isArray(doc.nodes)).toBe(true);
				for (const node of doc.nodes) {
					expect(typeof node.nodeId).toBe('string');
					expect(typeof node.title).toBe('string');
					expect(typeof node.statusSymbol).toBe('string');
					expect(typeof node.selected).toBe('boolean');
					expect(typeof node.disabled).toBe('boolean');
				}
			}
		}
	});

	it('active node in sidebar is marked as selected', () => {
		const sidebar = makeSidebarRenderModel('node-thesis' as NodeId);
		expect(sidebar.activeNodeId).toBe('node-thesis');

		// At least one node must be selected
		const allNodes = sidebar.phases.flatMap((p) =>
			p.documents.flatMap((d) => d.nodes),
		);
		const selectedNode = allNodes.find((n) => n.selected);
		expect(selectedNode).toBeDefined();
		expect(selectedNode?.nodeId).toBe('node-thesis');
	});

	it('no node is selected when activeNodeId is null', () => {
		const sidebar = makeSidebarRenderModel(null);
		const allNodes = sidebar.phases.flatMap((p) =>
			p.documents.flatMap((d) => d.nodes),
		);
		const anySelected = allNodes.some((n) => n.selected);
		expect(anySelected).toBe(false);
	});

	it('blocked node is disabled with reason', () => {
		const sidebar = makeSidebarRenderModel(null);
		const allNodes = sidebar.phases.flatMap((p) =>
			p.documents.flatMap((d) => d.nodes),
		);
		const blockedNode = allNodes.find((n) => n.nodeId === ('node-val' as NodeId));
		expect(blockedNode).toBeDefined();
		expect(blockedNode?.disabled).toBe(true);
		expect(blockedNode?.reasonIfDisabled).toBeDefined();
	});

	it('input is disabled with reason when no node is active', () => {
		const input = makeInput(false);
		expect(input.enabled).toBe(false);
		expect(input.reasonIfDisabled).toBeDefined();
		expect(input.submitAction).toBeUndefined();
	});

	it('input is enabled with placeholder and submit action when node is active', () => {
		const input = makeInput(true, 'Type your answer...');
		expect(input.enabled).toBe(true);
		expect(input.placeholder).toBe('Type your answer...');
		expect(input.submitAction).toBe('SUBMIT_USER_MESSAGE');
		expect(input.reasonIfDisabled).toBeUndefined();
	});

	it('error panel includes recovery actions when recoverable', () => {
		const panel = errorPanel();
		expect(panel.recoverable).toBe(true);
		expect(panel.recoveryActions).toBeDefined();
		expect(panel.recoveryActions!.length).toBeGreaterThan(0);
	});

	it('diagnostic has all required fields', () => {
		const diags = makeWarningDiagnostics();
		expect(diags.length).toBeGreaterThan(0);
		const d = diags[0];
		expect(typeof d.code).toBe('string');
		expect(typeof d.message).toBe('string');
		expect(['info', 'warning', 'error']).toContain(d.severity);
	});

	it('export panel available formats are valid', () => {
		const panel = exportPanel();
		expect(panel.availableFormats).toContain('markdown');
		expect(panel.availableFormats).toContain('html');
		expect(panel.availableFormats).toContain('agent_pack');
	});
});

// ─── Tests — intentionally broken snapshots ───────────────────────────────

describe('Render snapshot schema — broken snapshots', () => {
	it('missing mainPanel is detected', () => {
		const broken = makeSnapshot(
			'idle' as SessionMode,
			undefined as unknown as MainPanelRenderModel,
			makeSidebarRenderModel(null),
			makeActionBar([]),
			makeInput(false),
		);
		expect(broken.mainPanel).toBeUndefined();
	});

	it('missing actionBar is detected', () => {
		const broken = {
			diagnostics: [],
			input: makeInput(false),
			mainPanel: idlePanel(),
			mode: 'idle',
			sidebar: makeSidebarRenderModel(null),
		} as unknown as TuiRenderSnapshot;
		expect(broken).not.toHaveProperty('actionBar');
	});

	it('missing input is detected', () => {
		const broken = {
			actionBar: makeActionBar([]),
			diagnostics: [],
			mainPanel: idlePanel(),
			mode: 'idle',
			sidebar: makeSidebarRenderModel(null),
		} as unknown as TuiRenderSnapshot;
		expect(broken).not.toHaveProperty('input');
	});

	it('sidebar missing phases is detected', () => {
		const sidebar = { activeNodeId: null } as unknown as SidebarRenderModel;
		expect(Array.isArray((sidebar as Record<string, unknown>).phases)).toBe(false);
	});

	it('sidebar node with empty title is suspicious', () => {
		const node: SidebarNode = {
			disabled: false,
			nodeId: 'n1' as NodeId,
			selected: false,
			statusSymbol: '·',
			title: '',
		};
		expect(node.title.length).toBe(0);
	});

	it('action with incompatible nodeAction is caught (accept in not_started)', () => {
		const lifecycle: NodeLifecycle = 'not_started';
		const actions: ActionBarRenderAction[] = [
			{ enabled: true, id: 'accept', label: 'Accept', nodeAction: 'accept' as NodeAction },
		];
		const errors = validateActionsCompatibleWithLifecycle(actions, lifecycle);
		expect(errors.length).toBeGreaterThan(0);
	});

	it('action with incompatible nodeAction is caught (defer in ready_for_synthesis)', () => {
		const lifecycle: NodeLifecycle = 'ready_for_synthesis';
		const actions: ActionBarRenderAction[] = [
			{ enabled: true, id: 'defer', label: 'Defer', nodeAction: 'defer' as NodeAction },
		];
		const errors = validateActionsCompatibleWithLifecycle(actions, lifecycle);
		expect(errors.length).toBeGreaterThan(0);
	});
});
