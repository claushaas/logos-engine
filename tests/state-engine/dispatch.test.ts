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

	it('preserves answered lifecycle on additional message', () => {
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
		s = dispatch(
			s,
			{
				content: 'First answer.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		).state!;

		// Transition to answered via lifecycle change
		s = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'answered',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		).state!;
		expect(s.nodeStates['node-1' as NodeId]?.lifecycle).toBe('answered');

		// Send another user message — lifecycle should stay answered
		const r = dispatch(
			s,
			{
				content: 'Additional thoughts.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.nodeStates['node-1' as NodeId]?.lifecycle).toBe('answered');
		expect(r.state.nodeStates['node-1' as NodeId]?.conversation.length).toBe(2);
	});

	it('rejects message when node is in blocked lifecycle', () => {
		const profile = multiNodeProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;
		s = dispatch(
			s,
			{ nodeId: 'node-b' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		expect(s.nodeStates['node-b' as NodeId]?.lifecycle).toBe('blocked');

		const r = dispatch(
			s,
			{
				content: 'Hello',
				nodeId: 'node-b' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r.ok).toBe(false);
		if (r.ok) throw new Error('Expected error');

		expect(r.error).toContain('Cannot answer');
		expect(r.diagnostics[0]?.code).toBe(
			'LOGOS_DISPATCH_CANNOT_ANSWER_IN_LIFECYCLE',
		);

		// Conversation should NOT have been appended to
		expect(s.nodeStates['node-b' as NodeId]?.conversation.length).toBe(0);
	});

	it('rejects message when node is in deferred lifecycle', () => {
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
		// Send message to get to active, then defer
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

		const r = dispatch(
			s,
			{
				content: 'Hello',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r.ok).toBe(false);
		if (r.ok) throw new Error('Expected error');

		expect(r.error).toContain('Cannot answer');
		expect(r.diagnostics[0]?.code).toBe(
			'LOGOS_DISPATCH_CANNOT_ANSWER_IN_LIFECYCLE',
		);
	});

	it('rejects message when node is in synthesized lifecycle', () => {
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
		// Transition through: not_started → active → answered → ready_for_synthesis → synthesized
		s = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'active',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		).state!;
		s = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'answered',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		).state!;
		s = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'ready_for_synthesis',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		).state!;
		s = dispatch(
			s,
			{
				nodeId: 'node-1' as NodeId,
				to: 'synthesized',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		).state!;

		expect(s.nodeStates['node-1' as NodeId]?.lifecycle).toBe('synthesized');

		const r = dispatch(
			s,
			{
				content: 'I want to change my answer.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);

		expect(r.ok).toBe(false);
		if (r.ok) throw new Error('Expected error');

		expect(r.error).toContain('Cannot answer');
		expect(r.diagnostics[0]?.code).toBe(
			'LOGOS_DISPATCH_CANNOT_ANSWER_IN_LIFECYCLE',
		);
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
				content:
					'Our core thesis is that AI can transform documentation because it automates repetitive writing tasks. For example, in a pilot study we reduced doc creation time by 40% compared to manual authoring.',
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

// ═══════════════════════════════════════════════════════════════════════════
// dispatch — active node removed from profile (edge case)
// ═══════════════════════════════════════════════════════════════════════════

describe('dispatch — active node removed from profile', () => {
	it('clears activeNodeId when active node is no longer in profile nodes', () => {
		const profile = multiNodeProfile();
		const state = idleSession();

		// Select profile and select node-a
		let s = state;
		s = dispatch(
			s,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;

		s = dispatch(
			s,
			{ nodeId: 'node-a' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		expect(s.activeNodeId).toBe('node-a');

		// Create a new profile that does NOT contain node-a.
		const reducedProfile: LogosProfile = {
			...profile,
			nodes: profile.nodes.filter((n) => n.id !== 'node-a'),
		};

		// Dispatch a user message — the pre-dispatch guard should fire
		// because node-a is no longer in the profile.
		const r = dispatch(
			s,
			{
				content: 'Hello',
				nodeId: 'node-a' as NodeId,
				type: 'USER_MESSAGE',
			},
			reducedProfile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.activeNodeId).toBeNull();
		expect(r.state.mode).toBe('structure_overview');
		expect(r.snapshot).toBeDefined();
		expect(r.snapshot?.diagnostics.length).toBeGreaterThanOrEqual(1);

		const nodeRemovedDiag = r.snapshot?.diagnostics.find(
			(d) => d.code === 'LOGOS_DISPATCH_ACTIVE_NODE_REMOVED_FROM_PROFILE',
		);
		expect(nodeRemovedDiag).toBeDefined();
		expect(nodeRemovedDiag?.severity).toBe('error');
		expect(nodeRemovedDiag?.message).toContain('node-a');
	});

	it('preserves lastActiveNodeId if still in profile after node removal', () => {
		const profile = multiNodeProfile();
		const state = idleSession();

		// Setup: select profile, navigate node-a → node-b.
		let s = state;
		s = dispatch(
			s,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;

		// Select node-a
		s = dispatch(
			s,
			{ nodeId: 'node-a' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		// Navigate to node-b — lastActiveNodeId should be node-a
		s = dispatch(
			s,
			{ nodeId: 'node-b' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		expect(s.lastActiveNodeId).toBe('node-a');

		// Remove node-b from the profile — it's the active node.
		const reducedProfile: LogosProfile = {
			...profile,
			nodes: profile.nodes.filter((n) => n.id !== 'node-b'),
		};

		const r = dispatch(
			s,
			{ nodeId: 'node-a' as NodeId, type: 'DESELECT_NODE' as const },
			reducedProfile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.activeNodeId).toBeNull();
		// node-a still exists in reducedProfile, so lastActiveNodeId preserved
		expect(r.state.lastActiveNodeId).toBe('node-a');
	});

	it('clears lastActiveNodeId if it was also removed from profile', () => {
		const profile = multiNodeProfile();
		const state = idleSession();

		let s = state;
		s = dispatch(
			s,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;

		// Select node-a
		s = dispatch(
			s,
			{ nodeId: 'node-a' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		// Navigate to node-b
		s = dispatch(
			s,
			{ nodeId: 'node-b' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		expect(s.lastActiveNodeId).toBe('node-a');

		// Remove both node-b AND node-a from the profile.
		const reducedProfile: LogosProfile = {
			...profile,
			nodes: [],
		};

		const r = dispatch(
			s,
			{ nodeId: 'node-a' as NodeId, type: 'DESELECT_NODE' as const },
			reducedProfile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');

		expect(r.state.activeNodeId).toBeNull();
		// Both node-b (active) AND node-a (lastActive) were removed
		expect(r.state.lastActiveNodeId).toBeNull();
	});

	it('does not trigger for CREATE_SESSION, SELECT_PROFILE, or CHANGE_PROFILE', () => {
		// These events intrinsically reset/replace profile state, so the guard
		// should not interfere.
		const profile = multiNodeProfile();
		const state = idleSession();

		// SELECT_PROFILE with a full profile should work normally
		const r = dispatch(
			state,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		);

		expect(r.ok).toBe(true);
		if (!r.ok) throw new Error('Expected ok');
		expect(r.state.selectedProfileId).toBe('multi-profile');
	});

	it('returns profile mismatch error when active node removed but profile differs', () => {
		const profile = multiNodeProfile();
		const state = idleSession();

		// Select profile and node-a
		let s = state;
		s = dispatch(
			s,
			{ profileId: 'multi-profile' as ProfileId, type: 'SELECT_PROFILE' },
			profile,
		).state!;

		s = dispatch(
			s,
			{ nodeId: 'node-a' as NodeId, type: 'SELECT_NODE' },
			profile,
		).state!;

		expect(s.activeNodeId).toBe('node-a');

		// Create a DIFFERENT profile (mismatch) that also lacks node-a.
		const otherProfile = minimalProfile('other-profile');

		// Dispatch with the wrong profile — should return profile mismatch,
		// NOT a node-removed diagnostic, because the guard only fires
		// when state.selectedProfileId === profile.id.
		const r = dispatch(
			s,
			{
				content: 'Hello',
				nodeId: 'node-a' as NodeId,
				type: 'USER_MESSAGE',
			},
			otherProfile,
		);

		expect(r.ok).toBe(false);
		if (r.ok) throw new Error('Expected error');

		// Profile mismatch error — the USER_MESSAGE handler should reject it.
		expect(r.error).toContain('Profile mismatch');

		// The original state's activeNodeId should not have been modified
		// (mismatch returns before any state mutation).
		expect(s.activeNodeId).toBe('node-a');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Step 10.2 — completeness-driven lifecycle transitions
// ═══════════════════════════════════════════════════════════════════════════

describe('Step 10.2 — completeness drives lifecycle transitions', () => {
	/**
	 * Profile with typical coverage topics — thesis and evidence.
	 */
	function qualityProfile(): LogosProfile {
		return {
			description: 'Quality test profile',
			documents: [
				{
					id: 'doc-1' as DocumentId,
					optionalNodeIds: [],
					order: 1,
					outputPath: '/dev/null',
					phaseId: 'phase-1',
					purpose: 'Testing',
					requiredNodeIds: ['node-1' as NodeId],
					title: 'Test Document',
				},
			],
			id: 'quality-profile' as ProfileId,
			materializationRules: [],
			nodes: [
				{
					canonicalQuestion: 'What is the core thesis?',
					coverageTopics: ['thesis', 'evidence'],
					dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
					documentId: 'doc-1' as DocumentId,
					id: 'node-1' as NodeId,
					order: 1,
					phaseId: 'phase-1',
					promptRefs: {},
					sufficiencyCriteria: ['Thesis is specific and falsifiable'],
					title: 'Core Thesis',
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
			title: 'Quality Test Profile',
			version: '1.0.0',
		};
	}

	/** Helper: select profile + node and return state with not_started node. */
	function setupNode(profile: LogosProfile): LogosRuntimeState {
		let s = idleSession();
		const r1 = dispatch(
			s,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
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
		return r2.state;
	}

	it('contradictory input → needs_clarification', () => {
		const profile = qualityProfile();
		let s = setupNode(profile);

		// Send a self-contradictory message that triggers blocking issues.
		// "always manual" and "never require oversight" across messages
		// trigger contradiction detection.

		// First message: "always manual"
		const r1 = dispatch(
			s,
			{
				content:
					'The core thesis is that the documentation process is always manual and requires human oversight.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);
		expect(r1.ok).toBe(true);
		s = r1.state!;

		// Second message: "never require" — crosses with "always manual" from first
		const r2 = dispatch(
			s,
			{
				content:
					'Actually, the thesis is that documentation should never require manual oversight — it can be fully automated.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);
		expect(r2.ok).toBe(true);
		s = r2.state!;

		// Completeness should detect contradiction → needs_clarification.
		const node = s.nodeStates['node-1' as NodeId]!;
		expect(node.lifecycle).toBe('needs_clarification');
		expect(node.promptState).toBe('clarification');
		expect(node.completeness.blockingIssues.length).toBeGreaterThan(0);
	});

	it('generic weak input → needs_refinement', () => {
		const profile = qualityProfile();
		const s = setupNode(profile);

		// Submit a message that addresses the thesis topic but is too
		// short, vague, and lacks concrete indicators. Use a message
		// WITHOUT ambiguous comparative terms (like "better") so the
		// ambiguity detection doesn't fire first.
		const r = dispatch(
			s,
			{
				content: 'Our thesis is about making hiring different.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE',
			},
			profile,
		);
		expect(r.ok).toBe(true);

		const node = r.state!.nodeStates['node-1' as NodeId]!;
		expect(node.lifecycle).toBe('needs_refinement');
		expect(node.promptState).toBe('refinement');
		expect(node.completeness.weak.length).toBeGreaterThan(0);
	});
});
