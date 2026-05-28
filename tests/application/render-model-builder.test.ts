/**
 * Tests for Step 8.1 — render model builder.
 *
 * Covers:
 *  - Idle mode produces expected render model with global actions.
 *  - Node focus with synthesized lifecycle produces review actions.
 *  - Blocked node sidebar entry has disabled: true.
 *  - Status symbol mapping for all 10 lifecycles.
 *  - Structure overview sidebar is built from profile + snapshot sidebar.
 *  - Input model enabled/disabled per lifecycle.
 */
import { describe, expect, it } from 'vitest';
import {
	buildRenderSnapshot,
	getStatusSymbolForLifecycle,
} from '../../src/application/index.js';
import type {
	DocumentPreviewPanel,
	IdlePanel,
	LogosProfile,
	MainPanelRenderModel,
	NodeAction,
	NodeConversationPanel,
	ProfilePanel,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import type { StateEngineSnapshot } from '../../src/state-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

function testProfile(): LogosProfile {
	return {
		description: 'Test profile for render model builder',
		documents: [
			{
				id: 'doc-1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['n1' as NodeId],
				title: 'Doc 1',
			},
		],
		id: 'test-p' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the core thesis?',
				coverageTopics: ['thesis'],
				dependencies: {},
				documentId: 'doc-1' as DocumentId,
				id: 'n1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
			{
				canonicalQuestion: 'What is the central tension?',
				coverageTopics: ['tension'],
				dependencies: { requiredNodeIds: ['n1' as NodeId] },
				documentId: 'doc-1' as DocumentId,
				id: 'n2' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Central Tension',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Render Model Test Profile',
		version: '1.0.0',
	};
}

/**
 * Create an idle snapshot — no profile selected, no active node.
 */
function idleSnapshot(): StateEngineSnapshot {
	return {
		activeNodeId: null,
		activeNodeState: null,
		allowedActions: [],
		diagnostics: [],
		mainPanel: { kind: 'idle' } as IdlePanel,
		mode: 'idle',
		selectedProfileId: null,
		sidebar: { activeNodeId: null, phases: [] },
	};
}

/**
 * Create a structure-overview snapshot with profile selected.
 */
function structureOverviewSnapshot(profile: LogosProfile): StateEngineSnapshot {
	return {
		activeNodeId: null,
		activeNodeState: null,
		allowedActions: [],
		diagnostics: [],
		mainPanel: {
			availableProfileIds: [profile.id],
			kind: 'profile',
			message: `Working with profile: ${profile.title}`,
		} as ProfilePanel,
		mode: 'structure_overview',
		selectedProfileId: profile.id,
		sidebar: {
			activeNodeId: null,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-1' as DocumentId,
							nodes: [
								{
									disabled: false,
									nodeId: 'n1' as NodeId,
									selected: false,
									statusSymbol: '○',
									title: 'Core Thesis',
								},
								{
									disabled: false,
									nodeId: 'n2' as NodeId,
									selected: false,
									statusSymbol: '○',
									title: 'Central Tension',
								},
							],
							title: 'Doc 1',
						},
					],
					phaseId: 'phase-1',
					title: 'Foundation',
				},
			],
			profileTitle: profile.title,
		},
	};
}

function makeNodeConversationPanel(
	overrides: Partial<NodeConversationPanel> & { nodeId: NodeId } = {
		nodeId: 'n1' as NodeId,
	},
): NodeConversationPanel {
	return {
		breadcrumb: 'Foundation / Doc 1 / Core Thesis',
		canonicalAnswerAccepted: false,
		canonicalAnswerPreview: null,
		kind: 'node_conversation',
		lifecycle: 'not_started',
		messages: [],
		title: 'Core Thesis',
		...overrides,
		nodeId: overrides.nodeId,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Status symbol mapping
// ═══════════════════════════════════════════════════════════════════════════

describe('getStatusSymbolForLifecycle', () => {
	it('returns ○ for not_started', () => {
		expect(getStatusSymbolForLifecycle('not_started')).toBe('○');
	});

	it('returns ◐ for active', () => {
		expect(getStatusSymbolForLifecycle('active')).toBe('◐');
	});

	it('returns ◐ for answered', () => {
		expect(getStatusSymbolForLifecycle('answered')).toBe('◐');
	});

	it('returns ? for needs_clarification', () => {
		expect(getStatusSymbolForLifecycle('needs_clarification')).toBe('?');
	});

	it('returns △ for needs_refinement', () => {
		expect(getStatusSymbolForLifecycle('needs_refinement')).toBe('△');
	});

	it('returns ◆ for ready_for_synthesis', () => {
		expect(getStatusSymbolForLifecycle('ready_for_synthesis')).toBe('◆');
	});

	it('returns ◆ for synthesized', () => {
		expect(getStatusSymbolForLifecycle('synthesized')).toBe('◆');
	});

	it('returns ✓ for accepted', () => {
		expect(getStatusSymbolForLifecycle('accepted')).toBe('✓');
	});

	it('returns ⏸ for deferred', () => {
		expect(getStatusSymbolForLifecycle('deferred')).toBe('⏸');
	});

	it('returns ⚠ for blocked', () => {
		expect(getStatusSymbolForLifecycle('blocked')).toBe('⚠');
	});

	it('covers all 10 lifecycles', () => {
		const lifecycles: string[] = [
			'not_started',
			'active',
			'answered',
			'needs_clarification',
			'needs_refinement',
			'ready_for_synthesis',
			'synthesized',
			'accepted',
			'deferred',
			'blocked',
		];

		for (const lc of lifecycles) {
			const sym = getStatusSymbolForLifecycle(lc as never);
			expect(sym).toBeTruthy();
			expect(typeof sym).toBe('string');
			expect(sym.length).toBeGreaterThan(0);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Idle mode
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — idle mode', () => {
	it('produces idle panel with empty sidebar', () => {
		const profile = testProfile();
		const snap = idleSnapshot();

		const render = buildRenderSnapshot(snap, profile);

		expect(render.mode).toBe('idle');
		expect(render.mainPanel.kind).toBe('idle');
		expect(render.sidebar.phases).toEqual([]);
		expect(render.sidebar.activeNodeId).toBeNull();
		expect(render.sidebar.profileTitle).toBeUndefined();
	});

	it('produces deterministic global actions when no sessions available', () => {
		const profile = testProfile();
		const snap = idleSnapshot();

		const render = buildRenderSnapshot(snap, profile);

		const ids = render.actionBar.actions.map((a) => a.id);
		expect(ids).toEqual(['select_profile', 'import_context', 'open_settings']);

		const labels = render.actionBar.actions.map((a) => a.label);
		expect(labels).toEqual([
			'[Select Profile]',
			'[Import Context]',
			'[Settings]',
		]);

		for (const action of render.actionBar.actions) {
			expect(action.enabled).toBe(true);
		}

		// mainPanel should not have hasAvailableSessions flag.
		if (render.mainPanel.kind === 'idle') {
			expect(render.mainPanel.hasAvailableSessions).toBeFalsy();
		}
	});

	it('shows [Resume Session] action when hasAvailableSessions is true', () => {
		const profile = testProfile();
		const snap = idleSnapshot();

		const render = buildRenderSnapshot(snap, profile, {
			hasAvailableSessions: true,
		});

		const ids = render.actionBar.actions.map((a) => a.id);
		expect(ids).toEqual([
			'resume_session',
			'select_profile',
			'import_context',
			'open_settings',
		]);

		const labels = render.actionBar.actions.map((a) => a.label);
		expect(labels).toEqual([
			'[Resume Session]',
			'[Select Profile]',
			'[Import Context]',
			'[Settings]',
		]);

		// mainPanel should carry the flag.
		if (render.mainPanel.kind === 'idle') {
			expect(render.mainPanel.hasAvailableSessions).toBe(true);
		}
	});

	it('has input disabled', () => {
		const profile = testProfile();
		const snap = idleSnapshot();

		const render = buildRenderSnapshot(snap, profile);

		expect(render.input.enabled).toBe(false);
		expect(render.input.reasonIfDisabled).toBe('Select a profile to begin.');
	});

	it('has empty diagnostics when snapshot has none', () => {
		const profile = testProfile();
		const snap = idleSnapshot();

		const render = buildRenderSnapshot(snap, profile);

		expect(render.diagnostics).toEqual([]);
	});

	it('passes through diagnostics', () => {
		const profile = testProfile();
		const snap: StateEngineSnapshot = {
			...idleSnapshot(),
			diagnostics: [
				{
					code: 'TEST_INFO',
					message: 'This is a test diagnostic.',
					severity: 'info',
				},
			],
		};

		const render = buildRenderSnapshot(snap, profile);
		expect(render.diagnostics).toHaveLength(1);
		expect(render.diagnostics[0]?.code).toBe('TEST_INFO');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Structure overview mode
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — structure overview', () => {
	it('builds sidebar from profile with correct phases/documents/nodes', () => {
		const profile = testProfile();
		const snap = structureOverviewSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		expect(render.mode).toBe('structure_overview');
		expect(render.mainPanel.kind).toBe('profile');
		expect(render.sidebar.profileTitle).toBe('Render Model Test Profile');
		expect(render.sidebar.phases).toHaveLength(1);

		const phase = render.sidebar.phases[0]!;
		expect(phase.title).toBe('Foundation');
		expect(phase.documents).toHaveLength(1);

		const doc = phase.documents[0]!;
		expect(doc.title).toBe('Doc 1');
		expect(doc.nodes).toHaveLength(2);

		const n1 = doc.nodes[0]!;
		expect(n1.title).toBe('Core Thesis');
		expect(n1.selected).toBe(false);
		expect(n1.disabled).toBe(false);
		expect(n1.statusSymbol).toBe('○');

		const n2 = doc.nodes[1]!;
		expect(n2.title).toBe('Central Tension');
		expect(n2.selected).toBe(false);
	});

	it('has input disabled in structure overview', () => {
		const profile = testProfile();
		const snap = structureOverviewSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		expect(render.input.enabled).toBe(false);
		expect(render.input.reasonIfDisabled).toBe(
			'Select a node to begin answering.',
		);
	});

	it('has empty action bar (no node actions)', () => {
		const profile = testProfile();
		const snap = structureOverviewSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);
		expect(render.actionBar.actions).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Node focus — synthesized lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — node focus (synthesized)', () => {
	function synthesizedSnapshot(profile: LogosProfile): StateEngineSnapshot {
		return {
			activeNodeId: 'n1' as NodeId,
			activeNodeState: {
				allowedActions: [
					'accept',
					'edit',
					'regenerate',
					'defer',
					'reopen',
				] as NodeAction[],
				canonicalAnswer: {
					accepted: false,
					acceptedAt: null,
					assumptions: [],
					confidence: 'medium',
					content:
						'The core thesis is that skill-based evaluation should replace credential-based hiring.',
					generatedAt: '2025-01-15T10:00:00.000Z',
					generatedFromMessageIds: [],
					id: 'ca-1',
					nodeId: 'n1' as NodeId,
					revisedFromId: null,
					stale: false,
					unresolvedIssues: [],
				},
				completeness: {
					complete: true,
					missing: [],
					score: 1,
					weak: [],
				},
				conversation: [],
				dependencies: {
					blockedBy: [],
					requiredNodeIds: [],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
					risks: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: undefined,
				lifecycle: 'synthesized',
				nodeId: 'n1' as NodeId,
				promptState: 'review',
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
			allowedActions: [
				'accept',
				'edit',
				'regenerate',
				'defer',
				'reopen',
			] as NodeAction[],
			diagnostics: [],
			mainPanel: makeNodeConversationPanel({
				breadcrumb: 'Foundation / Doc 1 / Core Thesis',
				canonicalAnswerAccepted: false,
				canonicalAnswerPreview:
					'The core thesis is that skill-based evaluation should replace credential-based hiring.',
				lifecycle: 'synthesized',
			}),
			mode: 'node_focus',
			selectedProfileId: profile.id,
			sidebar: {
				activeNodeId: 'n1' as NodeId,
				phases: [
					{
						documents: [
							{
								documentId: 'doc-1' as DocumentId,
								nodes: [
									{
										disabled: false,
										nodeId: 'n1' as NodeId,
										selected: true,
										statusSymbol: '◆',
										title: 'Core Thesis',
									},
									{
										disabled: false,
										nodeId: 'n2' as NodeId,
										selected: false,
										statusSymbol: '○',
										title: 'Central Tension',
									},
								],
								title: 'Doc 1',
							},
						],
						phaseId: 'phase-1',
						title: 'Foundation',
					},
				],
				profileTitle: profile.title,
			},
		};
	}

	it('produces review actions for synthesized lifecycle', () => {
		const profile = testProfile();
		const snap = synthesizedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		expect(render.mode).toBe('node_focus');
		expect(render.mainPanel.kind).toBe('node_conversation');

		const actionIds = render.actionBar.actions.map((a) => a.id);
		expect(actionIds).toEqual([
			'accept',
			'edit',
			'regenerate',
			'defer',
			'reopen',
		]);

		const labels = render.actionBar.actions.map((a) => a.label);
		expect(labels).toEqual([
			'[Accept]',
			'[Edit]',
			'[Regenerate]',
			'[Defer]',
			'[Reopen]',
		]);

		// All actions should be enabled and have nodeAction set
		for (const action of render.actionBar.actions) {
			expect(action.enabled).toBe(true);
			expect(action.nodeAction).toBeDefined();
		}
	});

	it('preserves canonical answer preview', () => {
		const profile = testProfile();
		const snap = synthesizedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		if (render.mainPanel.kind === 'node_conversation') {
			expect(render.mainPanel.canonicalAnswerPreview).toBe(
				'The core thesis is that skill-based evaluation should replace credential-based hiring.',
			);
			expect(render.mainPanel.canonicalAnswerAccepted).toBe(false);
		}
	});

	it('has input disabled for synthesized lifecycle', () => {
		const profile = testProfile();
		const snap = synthesizedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		expect(render.input.enabled).toBe(false);
		expect(render.input.reasonIfDisabled).toBe(
			'Review the draft answer before providing input. Accept, edit, or regenerate.',
		);
	});

	it('sidebar marks active node as selected with correct symbol', () => {
		const profile = testProfile();
		const snap = synthesizedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		const n1 = render.sidebar.phases[0]?.documents[0]?.nodes[0];
		expect(n1?.selected).toBe(true);
		expect(n1?.statusSymbol).toBe('◆'); // synthesized = ◆
		expect(n1?.disabled).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Blocked node
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — blocked node', () => {
	function blockedSnapshot(profile: LogosProfile): StateEngineSnapshot {
		return {
			activeNodeId: 'n2' as NodeId,
			activeNodeState: {
				allowedActions: ['open_prerequisite', 'defer'] as NodeAction[],
				canonicalAnswer: null,
				completeness: {
					complete: false,
					missing: ['prerequisite'],
					score: 0,
					weak: [],
				},
				conversation: [],
				dependencies: {
					blockedBy: ['n1' as NodeId],
					requiredNodeIds: ['n1' as NodeId],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
					risks: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: undefined,
				lifecycle: 'blocked',
				nodeId: 'n2' as NodeId,
				promptState: 'blocked',
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
			allowedActions: ['open_prerequisite', 'defer'] as NodeAction[],
			diagnostics: [],
			mainPanel: makeNodeConversationPanel({
				breadcrumb: 'Foundation / Doc 1 / Central Tension',
				lifecycle: 'blocked',
				nodeId: 'n2' as NodeId,
				title: 'Central Tension',
			}),
			mode: 'node_focus',
			selectedProfileId: profile.id,
			sidebar: {
				activeNodeId: 'n2' as NodeId,
				phases: [
					{
						documents: [
							{
								documentId: 'doc-1' as DocumentId,
								nodes: [
									{
										disabled: false,
										nodeId: 'n1' as NodeId,
										selected: false,
										statusSymbol: '✓',
										title: 'Core Thesis',
									},
									{
										disabled: false,
										nodeId: 'n2' as NodeId,
										selected: true,
										statusSymbol: '⚠',
										title: 'Central Tension',
									},
								],
								title: 'Doc 1',
							},
						],
						phaseId: 'phase-1',
						title: 'Foundation',
					},
				],
				profileTitle: profile.title,
			},
		};
	}

	it('blocked node has disabled: true in sidebar', () => {
		const profile = testProfile();
		const snap = blockedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		const n2 = render.sidebar.phases[0]?.documents[0]?.nodes[1];
		expect(n2?.nodeId).toBe('n2');
		expect(n2?.selected).toBe(true);
		expect(n2?.disabled).toBe(true);
		expect(n2?.reasonIfDisabled).toBe(
			'This node is blocked by unmet prerequisites.',
		);
	});

	it('blocked node detected from statusSymbol ⚠ even without activeNodeState lifecycle', () => {
		const profile = testProfile();
		// Scenario: the sidebar has ⚠ statusSymbol but activeNodeState is null
		// (could happen with stale snapshots or edge cases)
		const snap: StateEngineSnapshot = {
			activeNodeId: 'n2' as NodeId,
			activeNodeState: null,
			allowedActions: [],
			diagnostics: [],
			mainPanel: {
				kind: 'error',
				message: 'Node state not found.',
			} as MainPanelRenderModel,
			mode: 'node_focus',
			selectedProfileId: profile.id,
			sidebar: {
				activeNodeId: 'n2' as NodeId,
				phases: [
					{
						documents: [
							{
								documentId: 'doc-1' as DocumentId,
								nodes: [
									{
										disabled: false,
										nodeId: 'n1' as NodeId,
										selected: false,
										statusSymbol: '✓',
										title: 'Core Thesis',
									},
									{
										disabled: false,
										nodeId: 'n2' as NodeId,
										selected: true,
										statusSymbol: '⚠',
										title: 'Central Tension',
									},
								],
								title: 'Doc 1',
							},
						],
						phaseId: 'phase-1',
						title: 'Foundation',
					},
				],
				profileTitle: profile.title,
			},
		};

		const render = buildRenderSnapshot(snap, profile);

		const n2 = render.sidebar.phases[0]?.documents[0]?.nodes[1];
		expect(n2?.disabled).toBe(true);
		expect(n2?.reasonIfDisabled).toBe(
			'This node is blocked by unmet prerequisites.',
		);
	});

	it('blocked node has correct action labels', () => {
		const profile = testProfile();
		const snap = blockedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		const actionLabels = render.actionBar.actions.map((a) => a.label);
		expect(actionLabels).toEqual(['[Open Prerequisite]', '[Defer]']);
	});

	it('blocked node has input disabled', () => {
		const profile = testProfile();
		const snap = blockedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		expect(render.input.enabled).toBe(false);
		expect(render.input.reasonIfDisabled).toContain('blocked');
	});

	it('non-blocked sibling node remains enabled', () => {
		const profile = testProfile();
		const snap = blockedSnapshot(profile);

		const render = buildRenderSnapshot(snap, profile);

		const n1 = render.sidebar.phases[0]?.documents[0]?.nodes[0];
		expect(n1?.nodeId).toBe('n1');
		expect(n1?.disabled).toBe(false);
		expect(n1?.statusSymbol).toBe('✓');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Input model per lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — input model per lifecycle', () => {
	function snapshotForLifecycle(
		lifecycle: string,
		allowedActions: NodeAction[],
	): StateEngineSnapshot {
		return {
			activeNodeId: 'n1' as NodeId,
			activeNodeState: {
				allowedActions,
				canonicalAnswer: null,
				completeness: {
					complete: false,
					missing: [],
					score: 0,
					weak: [],
				},
				conversation: [],
				dependencies: {
					blockedBy: [],
					requiredNodeIds: [],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
					risks: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: undefined,
				lifecycle: lifecycle as never,
				nodeId: 'n1' as NodeId,
				promptState: 'follow_up' as never,
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
			allowedActions,
			diagnostics: [],
			mainPanel: makeNodeConversationPanel({
				lifecycle: lifecycle as never,
			}),
			mode: 'node_focus',
			selectedProfileId: 'test-p' as ProfileId,
			sidebar: {
				activeNodeId: 'n1' as NodeId,
				phases: [
					{
						documents: [
							{
								documentId: 'doc-1' as DocumentId,
								nodes: [
									{
										disabled: false,
										nodeId: 'n1' as NodeId,
										selected: true,
										statusSymbol: '○',
										title: 'Core Thesis',
									},
								],
								title: 'Doc 1',
							},
						],
						phaseId: 'phase-1',
						title: 'Foundation',
					},
				],
				profileTitle: 'Test',
			},
		};
	}

	it('enables input for not_started', () => {
		const snap = snapshotForLifecycle('not_started', [
			'answer',
			'skip',
			'ask_for_example',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(true);
		expect(render.input.submitAction).toBe('answer');
	});

	it('enables input for active', () => {
		const snap = snapshotForLifecycle('active', [
			'answer',
			'defer',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(true);
	});

	it('enables input for answered', () => {
		const snap = snapshotForLifecycle('answered', [
			'answer',
			'defer',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(true);
	});

	it('enables input for needs_clarification', () => {
		const snap = snapshotForLifecycle('needs_clarification', [
			'answer',
			'defer',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(true);
	});

	it('enables input for needs_refinement', () => {
		const snap = snapshotForLifecycle('needs_refinement', [
			'answer',
			'defer',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(true);
	});

	it('disables input for synthesized', () => {
		const snap = snapshotForLifecycle('synthesized', [
			'accept',
			'edit',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(false);
	});

	it('disables input for accepted', () => {
		const snap = snapshotForLifecycle('accepted', [
			'continue_next',
			'reopen',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(false);
		expect(render.input.reasonIfDisabled).toBe(
			'This node has been accepted. Reopen to edit.',
		);
	});

	it('disables input for deferred', () => {
		const snap = snapshotForLifecycle('deferred', [
			'resume',
			'continue_next',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(false);
	});

	it('disables input for blocked', () => {
		const snap = snapshotForLifecycle('blocked', [
			'open_prerequisite',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(false);
	});

	it('disables input when answer not in allowedActions even with valid lifecycle', () => {
		// Edge case: active lifecycle but 'answer' not allowed (shouldn't normally happen)
		const snap = snapshotForLifecycle('active', [
			'defer',
			'mark_as_assumption',
		] as NodeAction[]);
		const render = buildRenderSnapshot(snap, testProfile());
		expect(render.input.enabled).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Action label coverage
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — action labels match Appendix A', () => {
	it('maps all NodeAction values to non-empty labels', () => {
		const allActions: NodeAction[] = [
			'answer',
			'accept',
			'edit',
			'regenerate',
			'defer',
			'reopen',
			'skip',
			'continue_next',
			'mark_as_assumption',
			'mark_as_decision',
			'open_prerequisite',
			'open_document_preview',
			'ask_for_example',
			'resume',
		];

		const profile = testProfile();

		for (const action of allActions) {
			const snap: StateEngineSnapshot = {
				activeNodeId: 'n1' as NodeId,
				activeNodeState: {
					allowedActions: [action],
					canonicalAnswer: null,
					completeness: {
						complete: false,
						missing: [],
						score: 0,
						weak: [],
					},
					conversation: [],
					dependencies: {
						blockedBy: [],
						requiredNodeIds: [],
						unlocks: [],
					},
					extracted: {
						assumptions: [],
						decisions: [],
						facts: [],
						risks: [],
					},
					lastAssistantMessageId: undefined,
					lastUserMessageId: undefined,
					lifecycle: 'active',
					nodeId: 'n1' as NodeId,
					promptState: 'follow_up',
					updatedAt: '2025-01-15T10:00:00.000Z',
				},
				allowedActions: [action],
				diagnostics: [],
				mainPanel: makeNodeConversationPanel({ lifecycle: 'active' }),
				mode: 'node_focus',
				selectedProfileId: profile.id,
				sidebar: {
					activeNodeId: 'n1' as NodeId,
					phases: [
						{
							documents: [
								{
									documentId: 'doc-1' as DocumentId,
									nodes: [
										{
											disabled: false,
											nodeId: 'n1' as NodeId,
											selected: true,
											statusSymbol: '◐',
											title: 'Core Thesis',
										},
									],
									title: 'Doc 1',
								},
							],
							phaseId: 'phase-1',
							title: 'Foundation',
						},
					],
					profileTitle: 'Test',
				},
			};

			const render = buildRenderSnapshot(snap, profile);
			expect(render.actionBar.actions).toHaveLength(1);
			const renderedAction = render.actionBar.actions[0]!;
			expect(renderedAction.label).toBeTruthy();
			expect(renderedAction.id).toBe(action);
			expect(renderedAction.nodeAction).toBe(action);
		}
	});

	it('empty allowed actions (ready_for_synthesis) produces empty action bar', () => {
		const profile = testProfile();
		const snap: StateEngineSnapshot = {
			activeNodeId: 'n1' as NodeId,
			activeNodeState: {
				allowedActions: [],
				canonicalAnswer: null,
				completeness: {
					complete: false,
					missing: [],
					score: 0,
					weak: [],
				},
				conversation: [],
				dependencies: {
					blockedBy: [],
					requiredNodeIds: [],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
					risks: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: undefined,
				lifecycle: 'ready_for_synthesis',
				nodeId: 'n1' as NodeId,
				promptState: 'synthesis',
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
			allowedActions: [],
			diagnostics: [],
			mainPanel: makeNodeConversationPanel({
				lifecycle: 'ready_for_synthesis',
			}),
			mode: 'node_focus',
			selectedProfileId: profile.id,
			sidebar: {
				activeNodeId: 'n1' as NodeId,
				phases: [
					{
						documents: [
							{
								documentId: 'doc-1' as DocumentId,
								nodes: [
									{
										disabled: false,
										nodeId: 'n1' as NodeId,
										selected: true,
										statusSymbol: '◆',
										title: 'Core Thesis',
									},
								],
								title: 'Doc 1',
							},
						],
						phaseId: 'phase-1',
						title: 'Foundation',
					},
				],
				profileTitle: 'Test',
			},
		};

		const render = buildRenderSnapshot(snap, profile);
		expect(render.actionBar.actions).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Document preview mode — action bar rendering
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRenderSnapshot — document preview', () => {
	function docPreviewSnapshot(
		profile: LogosProfile,
		exportEligible: boolean,
	): StateEngineSnapshot {
		return {
			activeNodeId: 'n1' as NodeId,
			activeNodeState: null,
			allowedActions: [],
			diagnostics: [],
			mainPanel: {
				content: '# Foundation Thesis\n\nCompleteness: 2/2 sections accepted',
				documentId: 'doc-1' as DocumentId,
				exportEligible,
				kind: 'document_preview',
				missingNodeIds: [],
				staleNodeIds: [],
				title: 'Foundation Thesis',
			} as DocumentPreviewPanel,
			mode: 'document_preview',
			selectedProfileId: profile.id,
			sidebar: {
				activeNodeId: 'n1' as NodeId,
				phases: [
					{
						documents: [
							{
								documentId: 'doc-1' as DocumentId,
								nodes: [
									{
										disabled: false,
										nodeId: 'n1' as NodeId,
										selected: true,
										statusSymbol: '✓',
										title: 'Core Thesis',
									},
								],
								title: 'Doc 1',
							},
						],
						phaseId: 'phase-1',
						title: 'Foundation',
					},
				],
				profileTitle: profile.title,
			},
		};
	}

	it('renders document preview actions when mode is document_preview', () => {
		const profile = testProfile();
		const snap = docPreviewSnapshot(profile, false);

		const render = buildRenderSnapshot(snap, profile);

		expect(render.actionBar.actions.length).toBe(3);

		const labels = render.actionBar.actions.map((a) => a.label);
		expect(labels).toEqual(['[Regenerate]', '[Export]', '[Close]']);
	});

	it('disables export when document is not export-eligible', () => {
		const profile = testProfile();
		const snap = docPreviewSnapshot(profile, false);

		const render = buildRenderSnapshot(snap, profile);

		const exportAction = render.actionBar.actions.find(
			(a) => a.id === 'export_document',
		);
		expect(exportAction).toBeDefined();
		expect(exportAction?.enabled).toBe(false);
	});

	it('enables export when document is export-eligible', () => {
		const profile = testProfile();
		const snap = docPreviewSnapshot(profile, true);

		const render = buildRenderSnapshot(snap, profile);

		const exportAction = render.actionBar.actions.find(
			(a) => a.id === 'export_document',
		);
		expect(exportAction).toBeDefined();
		expect(exportAction?.enabled).toBe(true);
		expect(exportAction?.label).toBe('[Export]');
	});
});
