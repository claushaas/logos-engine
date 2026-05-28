/**
 * Flow C — Sidebar Navigation During Work
 *
 * Validates non-linear navigation without losing conversational state:
 *   - Work on node A mid-conversation.
 *   - Navigate to node B, start working.
 *   - Navigate back to node A — state preserved exactly.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.3}
 */
import { describe, expect, it } from 'vitest';

import type { LogosEvent } from '../../src/state-engine/types.js';
import {
	createMultiNodeProfile,
	createTestSession,
	simulateUserTurn,
} from '../harness/conversation-harness.js';

describe('Flow C — Sidebar Navigation During Work', () => {
	it('preserves node state when navigating away and back', async () => {
		const profile = createMultiNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeAId = profile.nodes[0]!.id;
		const nodeBId = profile.nodes[1]!.id;

		// ── Setup: select profile ─────────────────────────────────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;
		expect(s.mode).toBe('structure_overview');

		// ── Step 1: Select and work on Node A ─────────────────────
		const r1 = dispatch(s, {
			nodeId: nodeAId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;
		expect(s.activeNodeId).toBe(nodeAId);

		// Send a user message to leave not_started
		const turnA1 = await simulateUserTurn(
			s,
			'We believe hiring filters for credentials instead of competence.',
		);
		expect(turnA1.ok).toBe(true);
		s = turnA1.state!;

		const nodeABeforeNav = s.nodeStates[nodeAId]!;
		const lifecycleABefore = nodeABeforeNav.lifecycle;
		const convLengthABefore = nodeABeforeNav.conversation.length;
		expect(convLengthABefore).toBeGreaterThan(0);

		// ── Step 2: Navigate to Node B ────────────────────────────
		const r2 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r2.ok).toBe(true);
		s = r2.state!;
		expect(s.activeNodeId).toBe(nodeBId);

		// Node A state should still exist and be unchanged
		expect(s.nodeStates[nodeAId]).toBeDefined();
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe(lifecycleABefore);
		expect(s.nodeStates[nodeAId]!.conversation.length).toBe(convLengthABefore);

		// lastActiveNodeId should point to Node A
		expect(s.lastActiveNodeId).toBe(nodeAId);

		// ── Step 3: Work on Node B ────────────────────────────────
		const turnB1 = await simulateUserTurn(
			s,
			'There is a structural mismatch between how companies hire ' +
				'and how work actually gets done.',
		);
		expect(turnB1.ok).toBe(true);
		s = turnB1.state!;

		expect(s.nodeStates[nodeBId]!.conversation.length).toBeGreaterThan(0);

		// ── Step 4: Navigate back to Node A ───────────────────────
		const r4 = dispatch(s, {
			nodeId: nodeAId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r4.ok).toBe(true);
		s = r4.state!;
		expect(s.activeNodeId).toBe(nodeAId);

		// Node A state preserved exactly
		const nodeAAfterReturn = s.nodeStates[nodeAId]!;
		expect(nodeAAfterReturn.lifecycle).toBe(lifecycleABefore);
		expect(nodeAAfterReturn.conversation.length).toBe(convLengthABefore);

		// Node B state preserved independently
		const nodeBAfterReturn = s.nodeStates[nodeBId]!;
		expect(nodeBAfterReturn.conversation.length).toBeGreaterThan(0);
		expect(nodeBAfterReturn.lifecycle).not.toBe('not_started');

		// lastActiveNodeId should point to Node B after returning to A
		expect(s.lastActiveNodeId).toBe(nodeBId);
	});

	it('deselecting node returns to structure_overview', () => {
		const profile = createMultiNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r1 = dispatch(s, {
			nodeId: profile.nodes[0]!.id,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;
		expect(s.mode).toBe('node_focus');

		const r2 = dispatch(s, {
			type: 'DESELECT_NODE',
		} as LogosEvent);
		expect(r2.ok).toBe(true);
		s = r2.state!;
		expect(s.mode).toBe('structure_overview');
		expect(s.activeNodeId).toBeNull();

		// Node state still exists
		expect(s.nodeStates[profile.nodes[0]!.id]).toBeDefined();

		// lastActiveNodeId is updated
		expect(s.lastActiveNodeId).toBe(profile.nodes[0]!.id);
	});
});
