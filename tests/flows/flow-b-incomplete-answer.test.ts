/**
 * Flow B — Incomplete Answer
 *
 * Validates that the system does not blindly accept weak input.
 * The clarification → refinement → synthesis path:
 *
 *   not_started → active → needs_clarification → active →
 *   needs_refinement → active → ready_for_synthesis →
 *   synthesized → accepted
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.2}
 */
import { describe, expect, it } from 'vitest';

import type { NodeLifecycle } from '../../src/contracts/index.js';
import type { LogosEvent } from '../../src/state-engine/types.js';
import {
	createFlowTestProfile,
	createTestSession,
	simulateAgentTurn,
	simulateUserTurn,
} from '../harness/conversation-harness.js';

describe('Flow B — Incomplete Answer', () => {
	it('drives clarification → refinement → synthesis → acceptance', async () => {
		const profile = createFlowTestProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeId = profile.nodes[0]!.id;

		// ── Setup: select profile and node ────────────────────────
		const r0 = dispatch(state, {
			type: 'SELECT_PROFILE',
			profileId: profile.id,
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r0b = dispatch(s, {
			type: 'SELECT_NODE',
			nodeId,
		} as LogosEvent);
		expect(r0b.ok).toBe(true);
		s = r0b.state!;

		// ── Step 1: Weak initial answer → active ──────────────────
		const turn1 = await simulateUserTurn(
			s,
			'We want to make hiring better.',
		);
		expect(turn1.ok).toBe(true);
		s = turn1.state!;

		// Force needs_clarification
		const clarResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'needs_clarification' as NodeLifecycle,
		} as LogosEvent);
		expect(clarResult.ok).toBe(true);
		s = clarResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('needs_clarification');

		// ── Step 2: Clarification response → active ───────────────
		const turn2 = await simulateUserTurn(
			s,
			'More accurate hiring — credentials do not predict performance.',
		);
		expect(turn2.ok).toBe(true);
		s = turn2.state!;

		// Force needs_refinement
		const refResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'needs_refinement' as NodeLifecycle,
		} as LogosEvent);
		expect(refResult.ok).toBe(true);
		s = refResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('needs_refinement');

		// ── Step 3: Refinement response → active ──────────────────
		const turn3 = await simulateUserTurn(
			s,
			'We analyzed 10,000 hires and found work-sample tests ' +
				'predict performance 4x better than resume screening.',
		);
		expect(turn3.ok).toBe(true);
		s = turn3.state!;

		// ── Step 4: Force ready_for_synthesis → synthesis ──────────
		const rfsResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'ready_for_synthesis' as NodeLifecycle,
		} as LogosEvent);
		expect(rfsResult.ok).toBe(true);
		s = rfsResult.state!;

		// Apply synthesis agent turn (ready_for_synthesis → synthesized)
		// using the harness helper so prompt orchestrator is exercised.
		const synthResult = await simulateAgentTurn(
			s,
			nodeId,
			'ready_for_synthesis',
		);
		expect(synthResult.ok).toBe(true);
		s = synthResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('synthesized');

		// ── Step 5: Accept ────────────────────────────────────────
		const acceptResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'accepted' as NodeLifecycle,
		} as LogosEvent);
		expect(acceptResult.ok).toBe(true);
		s = acceptResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('accepted');

		// ── Final assertions ──────────────────────────────────────
		const finalNode = s.nodeStates[nodeId]!;
		expect(finalNode.conversation.length).toBeGreaterThanOrEqual(4);
		expect(finalNode.canonicalAnswer).not.toBeNull();
	});

	it('rejects answer in blocked lifecycle', () => {
		const profile = createFlowTestProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeId = profile.nodes[0]!.id;

		const r0 = dispatch(state, {
			type: 'SELECT_PROFILE',
			profileId: profile.id,
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r0b = dispatch(s, {
			type: 'SELECT_NODE',
			nodeId,
		} as LogosEvent);
		expect(r0b.ok).toBe(true);
		s = r0b.state!;

		// Move to blocked
		const blockResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'blocked' as NodeLifecycle,
		} as LogosEvent);
		expect(blockResult.ok).toBe(true);
		s = blockResult.state!;

		const answerResult = dispatch(s, {
			type: 'USER_MESSAGE_ADDED',
			nodeId,
			content: 'Trying to answer a blocked node',
		} as LogosEvent);

		expect(answerResult.ok).toBe(false);
	});
});
