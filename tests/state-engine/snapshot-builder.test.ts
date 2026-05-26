/**
 * Tests for Step 3.8 — snapshot builder.
 *
 * Covers:
 *  - Snapshot includes all required top-level fields.
 *  - Sidebar shape with correct status symbols.
 *  - Main panel shape for each mode.
 *  - Snapshot after each major event type.
 */
import { describe, expect, it } from 'vitest';

import type {
	LogosProfile,
	LogosRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { buildSnapshot } from '../../src/state-engine/snapshot-builder.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Fixture ─────────────────────────────────────────────────────────────────

function testProfile(): LogosProfile {
	return {
		description: 'Test profile',
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
			{
				id: 'doc-2' as DocumentId,
				optionalNodeIds: [],
				order: 2,
				outputPath: '/dev/null',
				phaseId: 'phase-2',
				purpose: 'Testing',
				requiredNodeIds: ['n2' as NodeId],
				title: 'Doc 2',
			},
		],
		id: 'test-p' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the answer?',
				coverageTopics: ['topic-1'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-1' as DocumentId,
				id: 'n1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node 1',
			},
			{
				canonicalQuestion: 'What else?',
				coverageTopics: ['topic-2'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-2' as DocumentId,
				id: 'n2' as NodeId,
				order: 2,
				phaseId: 'phase-2',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node 2',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Phase 1',
				title: 'Phase 1',
			},
			{
				id: 'phase-2',
				order: 2,
				purpose: 'Phase 2',
				title: 'Phase 2',
			},
		],
		title: 'Snapshot Test Profile',
		version: '1.0.0',
	};
}

function idleState(): LogosRuntimeState {
	return createSession();
}

// ─── Top-level fields ────────────────────────────────────────────────────────

describe('buildSnapshot top-level fields', () => {
	it('includes all required fields', () => {
		const profile = testProfile();
		const state = idleState();

		const snap = buildSnapshot(state, profile);

		expect(snap).toHaveProperty('mode');
		expect(snap).toHaveProperty('selectedProfileId');
		expect(snap).toHaveProperty('activeNodeId');
		expect(snap).toHaveProperty('activeNodeState');
		expect(snap).toHaveProperty('allowedActions');
		expect(snap).toHaveProperty('sidebar');
		expect(snap).toHaveProperty('mainPanel');
		expect(snap).toHaveProperty('diagnostics');
	});

	it('idle state snapshot has idle mode and null active state', () => {
		const profile = testProfile();
		const state = idleState();

		const snap = buildSnapshot(state, profile);

		expect(snap.mode).toBe('idle');
		expect(snap.selectedProfileId).toBeNull();
		expect(snap.activeNodeId).toBeNull();
		expect(snap.activeNodeState).toBeNull();
		expect(snap.allowedActions).toEqual([]);
		expect(snap.mainPanel.kind).toBe('idle');
	});

	it('structure_overview snapshot after profile selection', () => {
		const profile = testProfile();
		const state = idleState();

		const r = dispatch(
			state,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r.ok) throw new Error('Expected ok');

		const snap = r.snapshot!;
		expect(snap.mode).toBe('structure_overview');
		expect(snap.selectedProfileId).toBe('test-p');
		expect(snap.mainPanel.kind).toBe('profile');
	});
});

// ─── Sidebar shape ───────────────────────────────────────────────────────────

describe('buildSnapshot sidebar', () => {
	it('sidebar has phases, documents, and nodes from profile', () => {
		const profile = testProfile();
		const state = idleState();
		const r = dispatch(
			state,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r.ok) throw new Error('Expected ok');

		const snap = r.snapshot!;
		expect(snap.sidebar.profileTitle).toBe('Snapshot Test Profile');
		expect(snap.sidebar.phases.length).toBe(2);

		// Phase 1
		const p1 = snap.sidebar.phases[0]!;
		expect(p1.title).toBe('Phase 1');
		expect(p1.documents.length).toBe(1);

		const d1 = p1.documents[0]!;
		expect(d1.title).toBe('Doc 1');
		expect(d1.nodes.length).toBe(1);

		const n1 = d1.nodes[0]!;
		expect(n1.title).toBe('Node 1');
		expect(n1.disabled).toBe(false);
		expect(n1.selected).toBe(false);

		// Phase 2
		const p2 = snap.sidebar.phases[1]!;
		expect(p2.title).toBe('Phase 2');
		expect(p2.documents.length).toBe(1);
	});

	it('sidebar marks selected node as selected', () => {
		const profile = testProfile();
		const state = idleState();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(s, { nodeId: 'n1' as NodeId, type: 'SELECT_NODE' }, profile)
			.state!;

		const snap = buildSnapshot(s, profile);

		expect(snap.sidebar.activeNodeId).toBe('n1');
		const n1 = snap.sidebar.phases[0]?.documents[0]?.nodes[0];
		expect(n1?.selected).toBe(true);
	});

	it('sidebar has correct status symbols per lifecycle', () => {
		const profile = testProfile();
		const state = idleState();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(s, { nodeId: 'n1' as NodeId, type: 'SELECT_NODE' }, profile)
			.state!;
		s = dispatch(
			s,
			{
				content: 'test',
				nodeId: 'n1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		).state!;

		const snap = buildSnapshot(s, profile);

		const n1Sym = snap.sidebar.phases[0]?.documents[0]?.nodes[0]?.statusSymbol;
		// After first message, lifecycle is 'active' -> symbol is '◐'
		expect(n1Sym).toBe('◐');

		// Node 2 should still be '○' (not started)
		const n2 = snap.sidebar.phases[1]?.documents[0]?.nodes[0];
		expect(n2?.statusSymbol).toBe('○');
	});
});

// ─── Main panel shape ────────────────────────────────────────────────────────

describe('buildSnapshot mainPanel', () => {
	it('idle mode → idle panel', () => {
		const profile = testProfile();
		const state = idleState();

		const snap = buildSnapshot(state, profile);
		expect(snap.mainPanel.kind).toBe('idle');
	});

	it('structure_overview → profile panel', () => {
		const profile = testProfile();
		const state = idleState();
		const r = dispatch(
			state,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.snapshot?.mainPanel.kind).toBe('profile');
	});

	it('node_focus → node_conversation panel', () => {
		const profile = testProfile();
		const state = idleState();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(s, { nodeId: 'n1' as NodeId, type: 'SELECT_NODE' }, profile)
			.state!;

		const snap = buildSnapshot(s, profile);
		expect(snap.mainPanel.kind).toBe('node_conversation');
		if (snap.mainPanel.kind === 'node_conversation') {
			expect(snap.mainPanel.nodeId).toBe('n1');
			expect(snap.mainPanel.title).toBe('Node 1');
			expect(snap.mainPanel.lifecycle).toBe('not_started');
			expect(snap.mainPanel.breadcrumb).toBe('Phase 1 / Doc 1 / Node 1');
		}
	});

	it('node_conversation panel includes messages after user input', () => {
		const profile = testProfile();
		const state = idleState();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(s, { nodeId: 'n1' as NodeId, type: 'SELECT_NODE' }, profile)
			.state!;
		s = dispatch(
			s,
			{
				content: 'Hello world!',
				nodeId: 'n1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		).state!;

		const snap = buildSnapshot(s, profile);
		expect(snap.mainPanel.kind).toBe('node_conversation');
		if (snap.mainPanel.kind === 'node_conversation') {
			expect(snap.mainPanel.messages.length).toBe(1);
			expect(snap.mainPanel.messages[0]?.content).toBe('Hello world!');
			expect(snap.mainPanel.messages[0]?.role).toBe('user');
		}
	});

	it('node_conversation panel has canonical answer preview when available', () => {
		const profile = testProfile();
		const state = idleState();

		// Build state with canonical answer by transitioning through synthesis
		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-p' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(s, { nodeId: 'n1' as NodeId, type: 'SELECT_NODE' }, profile)
			.state!;

		// Manually set canonical answer on the node state
		const nodeState = s.nodeStates['n1' as NodeId];
		if (!nodeState) throw new Error('Expected node state');
		const updatedNode = {
			...nodeState,
			canonicalAnswer: {
				accepted: false,
				acceptedAt: null,
				assumptions: [],
				confidence: 'medium' as const,
				content: 'This is the canonical answer.',
				generatedAt: new Date().toISOString(),
				generatedFromMessageIds: [],
				id: 'ca-1',
				nodeId: 'n1' as NodeId,
				revisedFromId: null,
				stale: false,
				unresolvedIssues: [],
			},
		};
		s = {
			...s,
			nodeStates: {
				...s.nodeStates,
				['n1' as NodeId]: updatedNode,
			},
		};

		const snap = buildSnapshot(s, profile);
		expect(snap.mainPanel.kind).toBe('node_conversation');
		if (snap.mainPanel.kind === 'node_conversation') {
			expect(snap.mainPanel.canonicalAnswerPreview).toBe(
				'This is the canonical answer.',
			);
			expect(snap.mainPanel.canonicalAnswerAccepted).toBe(false);
		}
	});
});

// ─── Diagnostics ─────────────────────────────────────────────────────────────

describe('buildSnapshot diagnostics', () => {
	it('includes caller-supplied diagnostics', () => {
		const profile = testProfile();
		const state = idleState();

		const snap = buildSnapshot(state, profile, [
			{
				code: 'TEST_DIAG',
				message: 'Test diagnostic',
				severity: 'info',
			},
		]);

		expect(snap.diagnostics.length).toBeGreaterThanOrEqual(1);
		expect(snap.diagnostics.find((d) => d.code === 'TEST_DIAG')).toBeDefined();
	});

	it('includes mode-resolution diagnostics for invalid state', () => {
		const profile = testProfile();
		const state = idleState();

		// Create invalid state: activeNodeId set but no profile
		const invalidState: LogosRuntimeState = {
			...state,
			activeNodeId: 'fake-node' as NodeId,
		};

		const snap = buildSnapshot(invalidState, profile);
		expect(snap.mode).toBe('error');
		expect(snap.diagnostics.length).toBeGreaterThan(0);
		expect(
			snap.diagnostics.find(
				(d) => d.code === 'LOGOS_STATE_ACTIVE_NODE_WITHOUT_PROFILE',
			),
		).toBeDefined();
	});
});
