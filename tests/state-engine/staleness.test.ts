/**
 * Tests for Step 11.1 — staleness cascade for canonical answers.
 *
 * Covers:
 *  - `propagateStaleness(state, changedNodeId, profile)`: basic cascade,
 *    transitive cascade, no-op when upstream not accepted.
 *  - Dispatch integration: `accepted → active` triggers downstream staleness.
 *  - Document readiness: recomputes to `stale` when sources become stale.
 *  - Sidebar: stale accepted nodes show the stale symbol `↻` instead of `✓`.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §9}
 * @see {@link https://logos-engine/docs/02-state-engine-canonical-spec.md §13}
 */
import { describe, expect, it } from 'vitest';

import type {
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type {
	DocumentId,
	NodeId,
	ProfileId,
} from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { buildSnapshot } from '../../src/state-engine/snapshot-builder.js';
import { propagateStaleness } from '../../src/state-engine/staleness.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal accepted `NodeRuntimeState` with a non-stale canonical answer.
 */
function acceptedNodeState(
	nodeId: NodeId,
	overrides?: Partial<NodeRuntimeState>,
): NodeRuntimeState {
	return {
		allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
		canonicalAnswer: {
			accepted: true,
			confidence: 'high',
			content: `Answer for ${nodeId}`,
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: ['msg-1'],
			stale: false,
		},
		completeness: {
			blockingIssues: [],
			complete: true,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'accepted',
		nodeId,
		promptState: 'accepted',
		updatedAt: nowIso(),
		...overrides,
	};
}

/**
 * Create a `LogosRuntimeState` with specific node states wired in.
 */
function stateWithNodes(
	nodes: NodeRuntimeState[],
	activeNodeId: NodeId | null = null,
	profileId: ProfileId = 'test-profile' as ProfileId,
): LogosRuntimeState {
	const nodeStates: Record<NodeId, NodeRuntimeState> = {};
	for (const n of nodes) {
		nodeStates[n.nodeId] = n;
	}

	return {
		activeNodeId,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: activeNodeId ? 'node_focus' : 'structure_overview',
		nodeStates,
		selectedProfileId: profileId,
		sessionId: 'test-session',
		updatedAt: nowIso(),
	};
}

/**
 * Profile with a dependency chain: node-a ← node-b ← node-c
 * (node-b depends on node-a; node-c depends on node-b).
 */
function chainProfile(): LogosProfile {
	return {
		description: 'Dependency chain profile',
		documents: [
			{
				id: 'doc-1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/tmp/doc1.md',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: [
					'node-a' as NodeId,
					'node-b' as NodeId,
					'node-c' as NodeId,
				],
				title: 'Doc 1',
			},
		],
		id: 'chain-profile' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the core thesis?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-1' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node A (root)',
			},
			{
				canonicalQuestion: 'What is the implication?',
				coverageTopics: ['implication'],
				dependencies: {
					recommendedNodeIds: [],
					requiredNodeIds: ['node-a' as NodeId],
				},
				documentId: 'doc-1' as DocumentId,
				id: 'node-b' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node B (depends on A)',
			},
			{
				canonicalQuestion: 'What is the conclusion?',
				coverageTopics: ['conclusion'],
				dependencies: {
					recommendedNodeIds: [],
					requiredNodeIds: ['node-b' as NodeId],
				},
				documentId: 'doc-1' as DocumentId,
				id: 'node-c' as NodeId,
				order: 3,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node C (depends on B)',
			},
		],
		phases: [
			{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' },
		],
		title: 'Chain Profile',
		version: '1.0.0',
	};
}

/**
 * Profile where node-a has multiple dependents: node-b and node-c both
 * depend on node-a directly.
 */
function fanOutProfile(): LogosProfile {
	return {
		description: 'Fan-out profile',
		documents: [
			{
				id: 'doc-1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/tmp/doc1.md',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: [
					'node-a' as NodeId,
					'node-b' as NodeId,
					'node-c' as NodeId,
				],
				title: 'Doc 1',
			},
		],
		id: 'fanout-profile' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the core thesis?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-1' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node A (root)',
			},
			{
				canonicalQuestion: 'What is implication 1?',
				coverageTopics: ['imp1'],
				dependencies: {
					recommendedNodeIds: [],
					requiredNodeIds: ['node-a' as NodeId],
				},
				documentId: 'doc-1' as DocumentId,
				id: 'node-b' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node B (depends on A)',
			},
			{
				canonicalQuestion: 'What is implication 2?',
				coverageTopics: ['imp2'],
				dependencies: {
					recommendedNodeIds: [],
					requiredNodeIds: ['node-a' as NodeId],
				},
				documentId: 'doc-1' as DocumentId,
				id: 'node-c' as NodeId,
				order: 3,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node C (depends on A)',
			},
		],
		phases: [
			{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' },
		],
		title: 'Fan-Out Profile',
		version: '1.0.0',
	};
}

/**
 * Create a profile with a single node (no dependents).
 */
function soloProfile(): LogosProfile {
	return {
		description: 'Solo node profile',
		documents: [
			{
				id: 'doc-1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/tmp/doc1.md',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-a' as NodeId],
				title: 'Doc 1',
			},
		],
		id: 'solo-profile' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the thesis?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-1' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node A',
			},
		],
		phases: [
			{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' },
		],
		title: 'Solo Profile',
		version: '1.0.0',
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// propagateStaleness — unit tests
// ═══════════════════════════════════════════════════════════════════════════

describe('propagateStaleness', () => {
	// ── Acceptance criteria ─────────────────────────────────────────────

	it('changes upstream accepted node → downstream accepted dependent marked stale', () => {
		const profile = chainProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
		]);

		// Initial: both answers fresh
		expect(
			state.nodeStates['node-a' as NodeId]!.canonicalAnswer!.stale,
		).toBe(false);
		expect(
			state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(false);

		// Mark node-a's answer stale (simulating reopen/edit)
		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		// Propagate staleness downstream
		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// node-b should now be stale
		expect(
			result.state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);

		// node-a should remain accepted (lifecycle unchanged)
		expect(result.state.nodeStates['node-a' as NodeId]!.lifecycle).toBe(
			'accepted',
		);
	});

	it('multiple direct dependents → all marked stale', () => {
		const profile = fanOutProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
			acceptedNodeState('node-c' as NodeId),
		]);

		// Mark node-a stale first
		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Both node-b and node-c should be stale
		expect(
			result.state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
		expect(
			result.state.nodeStates['node-c' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
	});

	it('transitive cascade: A → B → C', () => {
		const profile = chainProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
			acceptedNodeState('node-c' as NodeId),
		]);

		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Both B and C should be stale (transitive)
		expect(
			result.state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
		expect(
			result.state.nodeStates['node-c' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
	});

	it('change non-accepted node → no staleness propagation', () => {
		const profile = chainProfile();
		// node-a is not accepted (no canonical answer), node-b is accepted
		const notAcceptedA: NodeRuntimeState = {
			...acceptedNodeState('node-a' as NodeId),
			canonicalAnswer: null,
			lifecycle: 'active',
		};
		const state = stateWithNodes([
			notAcceptedA,
			acceptedNodeState('node-b' as NodeId),
		]);

		const result = propagateStaleness(
			state,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// node-b should still be fresh
		expect(
			result.state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(false);
	});

	it('document readiness recomputes to stale when source becomes stale', () => {
		const profile = chainProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
			acceptedNodeState('node-c' as NodeId),
		]);

		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Document should be stale because source nodes are stale
		const docState = result.state.documentStates['doc-1' as DocumentId];
		expect(docState).toBeDefined();
		expect(docState!.status).toBe('stale');
	});

	it('no dependents → recomputes document readiness and returns info diagnostic', () => {
		const profile = soloProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
		]);

		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Document readiness should recompute — a stale source makes the doc stale.
		const docState = result.state.documentStates['doc-1' as DocumentId];
		expect(docState).toBeDefined();
		expect(docState!.status).toBe('stale');
	});

	it('does not mark an already-stale dependent stale again', () => {
		const profile = fanOutProfile();
		// node-b is already stale; node-c is fresh. Both depend on node-a.
		const alreadyStaleB: NodeRuntimeState = {
			...acceptedNodeState('node-b' as NodeId),
			canonicalAnswer: {
				...acceptedNodeState('node-b' as NodeId).canonicalAnswer!,
				stale: true,
			},
		};
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			alreadyStaleB,
			acceptedNodeState('node-c' as NodeId),
		]);

		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// node-b was already stale (updatedAt shouldn't change if no-op)
		const bNode = result.state.nodeStates['node-b' as NodeId]!;
		expect(bNode.canonicalAnswer!.stale).toBe(true);
		expect(bNode.updatedAt).toBe(alreadyStaleB.updatedAt); // unchanged

		// node-c should now be stale
		const cNode = result.state.nodeStates['node-c' as NodeId]!;
		expect(cNode.canonicalAnswer!.stale).toBe(true);
	});

	it('error when changed node has no runtime state', () => {
		const profile = chainProfile();
		const state = stateWithNodes([]);

		const result = propagateStaleness(
			state,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(false);
	});

	it('skips dependents that have not been initialised', () => {
		const profile = chainProfile();
		// Only node-a exists in runtime state; node-b and node-c are not
		// yet initialised (no NodeRuntimeState entry).
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			// node-b and node-c are not in nodeStates
		]);

		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);

		// Should succeed — uninitialised dependents are just skipped
		expect(result.ok).toBe(true);
	});

	it('transitive cascade skips intermediate node with no accepted answer', () => {
		// Chain: node-a → node-b → node-c
		// node-b has a canonical answer but it's NOT accepted (synthesized lifecycle).
		// node-c IS accepted. When node-a changes, we should still traverse
		// to node-c through node-b, and mark node-c stale.
		const profile = chainProfile();
		const synthesizedB: NodeRuntimeState = {
			...acceptedNodeState('node-b' as NodeId),
			canonicalAnswer: {
				...acceptedNodeState('node-b' as NodeId).canonicalAnswer!,
				accepted: false,
			},
			lifecycle: 'synthesized',
		};
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			synthesizedB,
			acceptedNodeState('node-c' as NodeId),
		]);

		const staleA = {
			...state,
			nodeStates: {
				...state.nodeStates,
				['node-a' as NodeId]: {
					...state.nodeStates['node-a' as NodeId]!,
					canonicalAnswer: {
						...state.nodeStates['node-a' as NodeId]!.canonicalAnswer!,
						stale: true,
					},
				},
			},
		};

		const result = propagateStaleness(
			staleA,
			'node-a' as NodeId,
			profile,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// node-b should NOT be marked stale (its answer isn't accepted)
		expect(
			result.state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(false);

		// node-c SHOULD be marked stale (accepted answer, transitive)
		expect(
			result.state.nodeStates['node-c' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Dispatch integration: accepted → active triggers cascade
// ═══════════════════════════════════════════════════════════════════════════

describe('dispatch staleness cascade on reopen', () => {
	it('accepted → active triggers downstream staleness via dispatch', () => {
		const profile = chainProfile();
		const state = stateWithNodes(
			[
				acceptedNodeState('node-a' as NodeId),
				acceptedNodeState('node-b' as NodeId),
				acceptedNodeState('node-c' as NodeId),
			],
			'node-a' as NodeId,
			'chain-profile' as ProfileId,
		);

		// Reopen node-a via NODE_LIFECYCLE_CHANGED
		const result = dispatch(
			state,
			{
				nodeId: 'node-a' as NodeId,
				to: 'active',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// node-a's own answer should be stale
		expect(
			result.state.nodeStates['node-a' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
		// node-a lifecycle should now be active
		expect(result.state.nodeStates['node-a' as NodeId]!.lifecycle).toBe('active');

		// node-b and node-c should also be stale (cascade)
		expect(
			result.state.nodeStates['node-b' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
		expect(
			result.state.nodeStates['node-c' as NodeId]!.canonicalAnswer!.stale,
		).toBe(true);
	});

	it('dispatch snapshot includes cascade diagnostics', () => {
		const profile = fanOutProfile();
		const state = stateWithNodes(
			[
				acceptedNodeState('node-a' as NodeId),
				acceptedNodeState('node-b' as NodeId),
				acceptedNodeState('node-c' as NodeId),
			],
			'node-a' as NodeId,
			'fanout-profile' as ProfileId,
		);

		const result = dispatch(
			state,
			{
				nodeId: 'node-a' as NodeId,
				to: 'active',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Snapshot should exist and contain cascade diagnostics
		expect(result.snapshot).toBeDefined();
		const cascadeDiag = result.snapshot!.diagnostics.find(
			(d) => d.code === 'LOGOS_STALE_CASCADE',
		);
		expect(cascadeDiag).toBeDefined();
		expect(cascadeDiag!.severity).toBe('info');

		const propagatedDiags = result.snapshot!.diagnostics.filter(
			(d) => d.code === 'LOGOS_STALE_PROPAGATED',
		);
		// Two dependents (node-b, node-c) should be reported
		expect(propagatedDiags.length).toBe(2);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar: stale accepted nodes show stale symbol
// ═══════════════════════════════════════════════════════════════════════════

describe('sidebar stale indicator', () => {
	it('accepted node with stale canonical answer shows ↻ symbol', () => {
		const profile = chainProfile();
		// Create state where node-b has accepted stale answer
		const staleAcceptedB: NodeRuntimeState = {
			...acceptedNodeState('node-b' as NodeId),
			canonicalAnswer: {
				...acceptedNodeState('node-b' as NodeId).canonicalAnswer!,
				stale: true,
			},
		};
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			staleAcceptedB,
		]);

		const snapshot = buildSnapshot(state, profile);

		// Find node-b in sidebar
		const phase = snapshot.sidebar.phases[0];
		expect(phase).toBeDefined();
		const doc = phase!.documents[0];
		expect(doc).toBeDefined();
		const nodeB = doc!.nodes.find((n) => n.nodeId === ('node-b' as NodeId));
		expect(nodeB).toBeDefined();

		// Stale accepted nodes should show ↻ not ✓
		expect(nodeB!.statusSymbol).toBe('↻');
	});

	it('accepted node with fresh canonical answer shows ✓ symbol', () => {
		const profile = chainProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
		]);

		const snapshot = buildSnapshot(state, profile);

		const phase = snapshot.sidebar.phases[0];
		const doc = phase!.documents[0];
		const nodeB = doc!.nodes.find((n) => n.nodeId === ('node-b' as NodeId));
		expect(nodeB).toBeDefined();

		// Fresh accepted node should show ✓
		expect(nodeB!.statusSymbol).toBe('✓');
	});

	it('non-accepted node with stale answer still shows lifecycle symbol', () => {
		const profile = chainProfile();
		const synthesizedWithStaleAnswer: NodeRuntimeState = {
			...acceptedNodeState('node-a' as NodeId),
			canonicalAnswer: {
				...acceptedNodeState('node-a' as NodeId).canonicalAnswer!,
				accepted: false,
				stale: true,
			},
			lifecycle: 'synthesized',
		};
		const state = stateWithNodes([synthesizedWithStaleAnswer]);

		const snapshot = buildSnapshot(state, profile);

		const phase = snapshot.sidebar.phases[0];
		const doc = phase!.documents[0];
		const nodeA = doc!.nodes.find((n) => n.nodeId === ('node-a' as NodeId));
		expect(nodeA).toBeDefined();

		// Synthesized (non-accepted) should use the lifecycle symbol ◆, not ↻
		expect(nodeA!.statusSymbol).toBe('◆');
	});
});
