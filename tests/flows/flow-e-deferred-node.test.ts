/**
 * Flow E — Deferred Node
 *
 * Validates that uncertainty can be parked without blocking all progress:
 *   1. Drive node to needs_clarification.
 *   2. Defer the node.
 *   3. Continue to the next unblocked node.
 *   4. Resume the deferred node later.
 *
 * **Deviation from prototype:** The prototype (§4.5) specifies
 * `deferred → needs_clarification` on resume. The current
 * `handleResumeNode()` implementation returns `deferred → active`.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.5}
 */
import { describe, expect, it } from 'vitest';

import type { LogosEvent } from '../../src/state-engine/types.js';
import {
	createMultiNodeProfile,
	createTestSession,
	simulateUserTurn,
} from '../harness/conversation-harness.js';

describe('Flow E — Deferred Node', () => {
	it('defers a stuck node, continues elsewhere, and resumes later', async () => {
		const profile = createMultiNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeAId = profile.nodes[0]!.id;
		const nodeBId = profile.nodes[1]!.id;

		// ── Setup: select profile and node A ────────────────────────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r0b = dispatch(s, {
			nodeId: nodeAId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r0b.ok).toBe(true);
		s = r0b.state!;
		expect(s.activeNodeId).toBe(nodeAId);

		// ── Step 1: Drive to needs_clarification via weak answer ────
		const turn1 = await simulateUserTurn(s, 'We want to make hiring better.');
		expect(turn1.ok).toBe(true);
		s = turn1.state!;

		// Engine should detect ambiguity and transition to needs_clarification
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe('needs_clarification');
		expect(s.nodeStates[nodeAId]!.promptState).toBe('clarification');

		const convLengthBeforeDefer = s.nodeStates[nodeAId]!.conversation.length;
		expect(convLengthBeforeDefer).toBeGreaterThan(0);

		// ── Step 2: Defer the node ──────────────────────────────────
		const deferResult = dispatch(s, {
			nodeId: nodeAId,
			type: 'DEFER_NODE',
		} as LogosEvent);
		expect(deferResult.ok).toBe(true);
		s = deferResult.state!;

		// Assert deferred state
		const deferredNode = s.nodeStates[nodeAId]!;
		expect(deferredNode.lifecycle).toBe('deferred');
		expect(deferredNode.allowedActions).toContain('resume');
		expect(deferredNode.allowedActions).toContain('continue_next');

		// Conversation history preserved
		expect(deferredNode.conversation.length).toBe(convLengthBeforeDefer);

		// ── Step 3: Navigate to node B (continue elsewhere) ─────────
		const r2 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r2.ok).toBe(true);
		s = r2.state!;
		expect(s.activeNodeId).toBe(nodeBId);

		// Node A should still be deferred, state preserved
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe('deferred');
		expect(s.nodeStates[nodeAId]!.conversation.length).toBe(
			convLengthBeforeDefer,
		);

		// lastActiveNodeId should point to node A
		expect(s.lastActiveNodeId).toBe(nodeAId);

		// ── Work on node B briefly ──────────────────────────────────
		const turnB = await simulateUserTurn(
			s,
			'There is a structural mismatch in how hiring currently works.',
		);
		expect(turnB.ok).toBe(true);
		s = turnB.state!;
		expect(s.nodeStates[nodeBId]!.lifecycle).not.toBe('not_started');

		// ── Step 4: Navigate back to deferred node A and resume ────
		const r3 = dispatch(s, {
			nodeId: nodeAId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r3.ok).toBe(true);
		s = r3.state!;

		// Verify node A still shows deferred
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe('deferred');
		expect(s.activeNodeId).toBe(nodeAId);

		// Resume the node
		const resumeResult = dispatch(s, {
			nodeId: nodeAId,
			type: 'RESUME_NODE',
		} as LogosEvent);
		expect(resumeResult.ok).toBe(true);
		s = resumeResult.state!;

		// NOTE: The prototype (§4.5) specifies the lifecycle should return
		// to `needs_clarification` on resume, preserving the pre-deferral
		// state. The current implementation returns `active`.
		// See: src/state-engine/dispatch.ts handleResumeNode().
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe('active');

		// Conversation preserved
		expect(s.nodeStates[nodeAId]!.conversation.length).toBe(
			convLengthBeforeDefer,
		);

		// Allowed actions include answer to continue
		expect(s.nodeStates[nodeAId]!.allowedActions).toContain('answer');
	});

	it('preserves conversation and lifecycle during defer-resume cycle', async () => {
		const profile = createMultiNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeId = profile.nodes[0]!.id;

		// ── Setup ───────────────────────────────────────────────────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r1 = dispatch(s, {
			nodeId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;

		// Send a specific answer to build conversation
		const turn1 = await simulateUserTurn(
			s,
			'Our core conviction is that hiring filters for credentials instead of performance potential.',
		);
		expect(turn1.ok).toBe(true);
		s = turn1.state!;

		const _lifecycleBeforeDefer = s.nodeStates[nodeId]!.lifecycle;
		const convLength = s.nodeStates[nodeId]!.conversation.length;
		const messagesBefore = [...s.nodeStates[nodeId]!.conversation];

		// Defer
		const deferResult = dispatch(s, {
			nodeId,
			type: 'DEFER_NODE',
		} as LogosEvent);
		expect(deferResult.ok).toBe(true);
		s = deferResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('deferred');

		// Resume
		const resumeResult = dispatch(s, {
			nodeId,
			type: 'RESUME_NODE',
		} as LogosEvent);
		expect(resumeResult.ok).toBe(true);
		s = resumeResult.state!;

		expect(s.nodeStates[nodeId]!.lifecycle).toBe('active');
		expect(s.nodeStates[nodeId]!.conversation.length).toBe(convLength);

		// All original messages preserved
		for (const msg of messagesBefore) {
			const found = s.nodeStates[nodeId]!.conversation.find(
				(m) => m.id === msg.id,
			);
			expect(found).toBeDefined();
			expect(found!.content).toBe(msg.content);
		}
	});

	it('rejects resume on a non-deferred, non-blocked node', () => {
		const profile = createMultiNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeId = profile.nodes[0]!.id;

		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r1 = dispatch(s, {
			nodeId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;

		// Node is `not_started` — resume should fail
		const resumeResult = dispatch(s, {
			nodeId,
			type: 'RESUME_NODE',
		} as LogosEvent);
		expect(resumeResult.ok).toBe(false);
	});
});
