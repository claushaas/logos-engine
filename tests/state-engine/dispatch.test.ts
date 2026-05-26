/**
 * Tests for Step 3.8 — dispatch integration and unit tests.
 *
 * Covers:
 *  - `dispatch(state, { type: "SELECT_NODE", nodeId }, profile)` returns updated state + snapshot.
 *  - Invalid events (e.g., SELECT_NODE without profile) return `ok: false` with diagnostics.
 *  - Full createSession → selectProfile → selectNode → userMessage flow.
 *  - Immutability: input state is never mutated.
 *  - Invalid lifecycle transitions are rejected.
 */
import { describe, expect, it } from 'vitest';

import type {
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Fixture: minimal profile ───────────────────────────────────────────────

function minimalProfile(profileId = 'test-profile'): LogosProfile {
	return {
		description: 'A minimal test profile',
		documents: [
			{
				id: 'test-doc' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-1' as NodeId],
				title: 'Test Document',
			},
		],
		id: profileId as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the core thesis?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'test-doc' as DocumentId,
				id: 'node-1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Test Node 1',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Testing',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

function multiNodeProfile(): LogosProfile {
	return {
		description: 'Profile with multiple nodes',
		documents: [
			{
				id: 'doc-1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
				title: 'Doc 1',
			},
		],
		id: 'multi-profile' as ProfileId,
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
			{
				canonicalQuestion: 'What is the tension?',
				coverageTopics: ['tension'],
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
				title: 'Node B (depends on Node A)',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Testing',
				title: 'Phase 1',
			},
		],
		title: 'Multi-Node Profile',
		version: '1.0.0',
	};
}

/** Deep-clone a state object for immutability assertions. */
function cloneState(s: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(s));
}

// ─── Helper: create an idle session ──────────────────────────────────────────

function idleSession(): LogosRuntimeState {
	return createSession();
}

// ─── CREATE_SESSION ──────────────────────────────────────────────────────────

describe('dispatch CREATE_SESSION', () => {
	it('returns a fresh idle state with snapshot', () => {
		const profile = minimalProfile();
		const state = idleSession();
		const original = cloneState(state);

		const result = dispatch(state, { type: 'CREATE_SESSION' }, profile);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.mode).toBe('idle');
		expect(result.state.selectedProfileId).toBeNull();
		expect(result.state.activeNodeId).toBeNull();
		expect(result.state.sessionId).toBeTypeOf('string');

		// Snapshot must be present
		expect(result.snapshot).toBeDefined();
		expect(result.snapshot?.mode).toBe('idle');

		// Input state not mutated
		expect(state).toEqual(original);
	});
});

// ─── SELECT_PROFILE ──────────────────────────────────────────────────────────

describe('dispatch SELECT_PROFILE', () => {
	it('selects a profile and returns structure_overview', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const result = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.mode).toBe('structure_overview');
		expect(result.state.selectedProfileId).toBe('test-profile');
		expect(result.state.activeNodeId).toBeNull();
		expect(result.state.nodeStates).toEqual({});

		// Snapshot
		expect(result.snapshot).toBeDefined();
		expect(result.snapshot?.mode).toBe('structure_overview');
		expect(result.snapshot?.selectedProfileId).toBe('test-profile');
		expect(result.snapshot?.sidebar.profileTitle).toBe('Test Profile');
	});

	it('preserves original session ID', () => {
		const profile = minimalProfile();
		const state = idleSession();
		const originalId = state.sessionId;

		const result = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.sessionId).toBe(originalId);
	});

	it('does not mutate input state', () => {
		const profile = minimalProfile();
		const state = idleSession();
		const original = cloneState(state);

		dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);

		expect(state).toEqual(original);
	});
});

// ─── SELECT_NODE ─────────────────────────────────────────────────────────────

describe('dispatch SELECT_NODE', () => {
	it('selects a node and transitions to node_focus', () => {
		const profile = minimalProfile();
		const state = idleSession();

		// First select profile
		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');

		// Then select node
		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);

		expect(r2.ok).toBe(true);
		if (!r2.ok) throw new Error('Expected ok');

		expect(r2.state.mode).toBe('node_focus');
		expect(r2.state.activeNodeId).toBe('node-1');

		const nodeState: NodeRuntimeState = r2.state.nodeStates['node-1' as NodeId];
		expect(nodeState).toBeDefined();
		expect(nodeState.lifecycle).toBe('not_started');
		expect(nodeState.promptState).toBe('initial');

		// Snapshot
		expect(r2.snapshot).toBeDefined();
		expect(r2.snapshot?.mode).toBe('node_focus');
		expect(r2.snapshot?.activeNodeId).toBe('node-1');
		expect(r2.snapshot?.activeNodeState).toBeDefined();
		expect(r2.snapshot?.activeNodeState?.lifecycle).toBe('not_started');
		expect(r2.snapshot?.allowedActions).toEqual([
			'answer',
			'skip',
			'ask_for_example',
		]);

		// Main panel should be node_conversation
		expect(r2.snapshot?.mainPanel.kind).toBe('node_conversation');
	});

	it('rejects node that does not exist in profile', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');

		const r2 = dispatch(
			r1.state,
			{ nodeId: 'nonexistent' as NodeId, type: 'SELECT_NODE' },
			profile,
		);

		expect(r2.ok).toBe(false);
		if (r2.ok) throw new Error('Expected error');

		expect(r2.error).toContain('does not exist');
		expect(r2.diagnostics.length).toBeGreaterThan(0);
	});

	it('supports the NODE_SELECTED alias', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');

		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'NODE_SELECTED' },
			profile,
		);

		expect(r2.ok).toBe(true);
		if (!r2.ok) throw new Error('Expected ok');

		expect(r2.state.activeNodeId).toBe('node-1');
	});

	it('re-select preserves node state', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');

		// Select node and add a user message
		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		if (!r2.ok) throw new Error('Expected ok');

		const r3 = dispatch(
			r2.state,
			{
				content: 'Hello world',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);
		if (!r3.ok) throw new Error('Expected ok');

		expect(r3.state.nodeStates['node-1' as NodeId]?.lifecycle).not.toBe(
			'not_started',
		);
		expect(r3.state.nodeStates['node-1' as NodeId]?.conversation.length).toBe(
			1,
		);

		// Deselect then reselect
		const r4 = dispatch(r3.state, { type: 'DESELECT_NODE' }, profile);
		if (!r4.ok) throw new Error('Expected ok');

		const r5 = dispatch(
			r4.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		if (!r5.ok) throw new Error('Expected ok');

		// Conversation should be preserved
		const nodeState = r5.state.nodeStates['node-1' as NodeId];
		expect(nodeState?.conversation.length).toBe(1);
		expect(nodeState?.conversation[0]?.content).toBe('Hello world');
	});

	it('sets lastActiveNodeId on selection', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');

		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		if (!r2.ok) throw new Error('Expected ok');

		// lastActiveNodeId should be null (was null before)
		expect(r2.state.lastActiveNodeId).toBeNull();

		const r3 = dispatch(r2.state, { type: 'DESELECT_NODE' }, profile);
		if (!r3.ok) throw new Error('Expected ok');

		expect(r3.state.lastActiveNodeId).toBe('node-1');
	});
});

// ─── Profile guards ────────────────────────────────────────────────────────

describe('dispatch profile guards', () => {
	it('SELECT_NODE without selected profile returns ok:false', () => {
		const profile = minimalProfile();
		const state = idleSession();

		// No profile selected — dispatch directly to SELECT_NODE
		const result = dispatch(
			state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('No profile selected');
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0]?.code).toBe('LOGOS_DISPATCH_NO_PROFILE');
	});

	it('SELECT_NODE with mismatched profile returns ok:false', () => {
		const profileA = minimalProfile('profile-a');
		const profileB = minimalProfile('profile-b');
		const state = idleSession();

		// Select profile-a
		const r1 = dispatch(
			state,
			{ profileId: 'profile-a' as ProfileId, type: 'SELECT_PROFILE' },
			profileA,
		);
		if (!r1.ok) throw new Error('Expected ok');

		// Try to select node with profile-b — mismatch
		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profileB,
		);

		expect(r2.ok).toBe(false);
		if (r2.ok) throw new Error('Expected error');

		expect(r2.error).toContain('Profile mismatch');
		expect(r2.diagnostics[0]?.code).toBe('LOGOS_DISPATCH_PROFILE_MISMATCH');
	});

	it('SELECT_PROFILE with mismatched profile ID returns ok:false', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const result = dispatch(
			state,
			{
				profileId: 'wrong-profile' as ProfileId,
				type: 'SELECT_PROFILE',
			},
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('Profile mismatch');
	});

	it('USER_MESSAGE with mismatched profile returns ok:false', () => {
		const profileA = minimalProfile('profile-a');
		const profileB = minimalProfile('profile-b');
		const state = idleSession();

		// Select profile-a and node
		let s = state;
		s = dispatch(
			s,
			{ profileId: 'profile-a' as ProfileId, type: 'SELECT_PROFILE' },
			profileA,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profileA,
		).state!;

		// Try to add message with profile-b
		const result = dispatch(
			s,
			{
				content: 'Hello',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profileB,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('Profile mismatch');
	});

	it('NODE_LIFECYCLE_CHANGED with mismatched profile returns ok:false', () => {
		const profileA = minimalProfile('profile-a');
		const profileB = minimalProfile('profile-b');
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'profile-a' as ProfileId, type: 'SELECT_PROFILE' },
			profileA,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profileA,
		).state!;

		const result = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'active' as const,
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profileB,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('Profile mismatch');
	});
});

// ─── USER_MESSAGE ────────────────────────────────────────────────────────────

describe('dispatch USER_MESSAGE', () => {
	it('appends a message to the active node conversation', () => {
		const profile = minimalProfile();
		const state = idleSession();

		// Setup: select profile → select node
		let s = state;
		const r1 = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');
		s = r1.state;

		const r2 = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		if (!r2.ok) throw new Error('Expected ok');
		s = r2.state;

		const r3 = dispatch(
			s,
			{
				content: 'I believe this project is necessary.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r3.ok).toBe(true);
		if (!r3.ok) throw new Error('Expected ok');

		const nodeState = r3.state.nodeStates['node-1' as NodeId];
		expect(nodeState?.conversation.length).toBe(1);
		expect(nodeState?.conversation[0]?.content).toBe(
			'I believe this project is necessary.',
		);
		expect(nodeState?.conversation[0]?.role).toBe('user');
		expect(nodeState?.conversation[0]?.id).toBeTypeOf('string');
	});

	it('transitions not_started → active on first message', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		expect(s.nodeStates['node-1' as NodeId]?.lifecycle).toBe('not_started');

		const r3 = dispatch(
			s,
			{
				content: 'My answer.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r3.ok).toBe(true);
		if (!r3.ok) throw new Error('Expected ok');

		expect(r3.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe('active');
	});

	it('rejects message if nodeId does not match activeNodeId', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		if (!r1.ok) throw new Error('Expected ok');

		// select node-1
		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		if (!r2.ok) throw new Error('Expected ok');

		// try to message a different node
		const r3 = dispatch(
			r2.state,
			{
				content: 'Hello',
				nodeId: 'other-node' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r3.ok).toBe(false);
		if (r3.ok) throw new Error('Expected error');

		expect(r3.error).toContain('does not match');
	});

	it('supports USER_MESSAGE_ADDED alias', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		const r3 = dispatch(
			s,
			{
				content: 'Message via alias.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE_ADDED',
			},
			profile,
		);

		expect(r3.ok).toBe(true);
		if (!r3.ok) throw new Error('Expected ok');

		expect(
			r3.state.nodeStates['node-1' as NodeId]?.conversation[0]?.content,
		).toBe('Message via alias.');
	});

	it('rejects message when profile is not selected', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const result = dispatch(
			state,
			{
				content: 'Hello',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('profile');
	});
});

// ─── NODE_LIFECYCLE_CHANGED ──────────────────────────────────────────────────

describe('dispatch NODE_LIFECYCLE_CHANGED', () => {
	it('applies valid lifecycle transition', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		// Transition not_started → active
		const result = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'active',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe(
			'active',
		);
		expect(result.state.nodeStates['node-1' as NodeId]?.promptState).toBe(
			'follow_up',
		);
	});

	it('rejects invalid transition', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		// Invalid: not_started → accepted
		const result = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'accepted',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('Invalid lifecycle transition');
	});
});

// ─── DEFER / RESUME ──────────────────────────────────────────────────────────

describe('dispatch DEFER_NODE and RESUME_NODE', () => {
	it('defers an active node', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		// First send a message to get to active
		s = dispatch(
			s,
			{
				content: 'test',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		).state!;

		expect(s.nodeStates['node-1' as NodeId]?.lifecycle).toBe('active');

		// Defer
		const r = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'DEFER_NODE' },
			profile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe('deferred');
		expect(r.snapshot?.allowedActions).toEqual(['resume', 'continue_next']);
	});

	it('resumes a deferred node', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;
		// Message + defer
		s = dispatch(
			s,
			{
				content: 'test',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		).state!;
		s = dispatch(s, { nodeId: 'node-1' as NodeId, type: 'DEFER_NODE' }, profile)
			.state!;

		expect(s.nodeStates['node-1' as NodeId]?.lifecycle).toBe('deferred');

		// Resume
		const r = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'RESUME_NODE' },
			profile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe('active');
	});
});

// ─── Snapshot coverage ──────────────────────────────────────────────────────

describe('dispatch snapshot shape', () => {
	it('snapshot includes all required top-level fields', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const result = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const snap = result.snapshot!;
		expect(snap).toHaveProperty('mode');
		expect(snap).toHaveProperty('selectedProfileId');
		expect(snap).toHaveProperty('activeNodeId');
		expect(snap).toHaveProperty('activeNodeState');
		expect(snap).toHaveProperty('allowedActions');
		expect(snap).toHaveProperty('sidebar');
		expect(snap).toHaveProperty('mainPanel');
		expect(snap).toHaveProperty('diagnostics');
	});

	it('snapshot after selectProfile has sidebar phases', () => {
		const profile = minimalProfile();
		const state = idleSession();

		const result = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const snap = result.snapshot!;
		expect(snap.sidebar.phases.length).toBe(1);
		expect(snap.sidebar.phases[0]?.title).toBe('Phase 1');
		expect(snap.sidebar.phases[0]?.documents.length).toBe(1);
		expect(snap.sidebar.phases[0]?.documents[0]?.nodes.length).toBe(1);
	});

	it('snapshot for node_focus has conversation panel and correct lifecycle', () => {
		const profile = minimalProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		const snap = dispatch(
			s,
			{
				content: 'My answer.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		).snapshot!;

		expect(snap.mainPanel.kind).toBe('node_conversation');
		if (snap.mainPanel.kind === 'node_conversation') {
			expect(snap.mainPanel.lifecycle).toBe('active');
			expect(snap.mainPanel.messages.length).toBe(1);
		}
	});
});

// ─── Full integration flow ──────────────────────────────────────────────────

describe('dispatch integration flow', () => {
	it('full createSession → selectProfile → selectNode → userMessage flow', () => {
		const profile = minimalProfile();
		const state = idleSession();
		const original = cloneState(state);

		// Step 1: Select profile
		const r1 = dispatch(
			state,
			{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r1.ok).toBe(true);
		if (!r1.ok) throw new Error('Expected ok');
		expect(r1.state.mode).toBe('structure_overview');

		// Step 2: Select node
		const r2 = dispatch(
			r1.state,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		expect(r2.ok).toBe(true);
		if (!r2.ok) throw new Error('Expected ok');
		expect(r2.state.mode).toBe('node_focus');
		expect(r2.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe(
			'not_started',
		);

		// Step 3: User message
		const r3 = dispatch(
			r2.state,
			{
				content: 'Our core thesis is that AI can transform documentation.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);
		expect(r3.ok).toBe(true);
		if (!r3.ok) throw new Error('Expected ok');

		expect(r3.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe('active');
		expect(r3.state.nodeStates['node-1' as NodeId]?.conversation.length).toBe(
			1,
		);

		// Step 4: Snapshot is present at every step
		expect(r1.snapshot).toBeDefined();
		expect(r2.snapshot).toBeDefined();
		expect(r3.snapshot).toBeDefined();

		// Input state not mutated
		expect(state).toEqual(original);
	});

	it('blocked node opens as blocked via dispatch', () => {
		const profile = multiNodeProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;

		// Select node-b (depends on node-a, which is not started)
		const r = dispatch(
			s,
			{ nodeId: 'node-b' as NodeId, type: 'SELECT_NODE' },
			profile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.nodeStates['node-b' as NodeId]?.lifecycle).toBe('blocked');
		expect(r.snapshot?.activeNodeState?.lifecycle).toBe('blocked');
		expect(r.snapshot?.allowedActions).toEqual(['open_prerequisite', 'defer']);
	});
});
