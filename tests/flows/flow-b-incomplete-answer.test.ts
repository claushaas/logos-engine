/**
 * Flow B — Incomplete Answer
 *
 * Validates that the system does not blindly accept weak input.
 * The engine's deterministic completeness evaluation drives
 * the clarification → refinement → synthesis path:
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
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r0b = dispatch(s, {
			nodeId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r0b.ok).toBe(true);
		s = r0b.state!;

		// ── Step 1: Weak initial answer → needs_clarification ─────
		//
		// "We want to make hiring better." uses a broad comparative
		// ("better") without dimension → flagged as ambiguous by
		// the engine's completeness evaluation.
		const turn1 = await simulateUserTurn(s, 'We want to make hiring better.');
		expect(turn1.ok).toBe(true);
		s = turn1.state!;

		// Engine should detect ambiguity and transition to needs_clarification.
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('needs_clarification');
		expect(s.nodeStates[nodeId]!.promptState).toBe('clarification');

		// ── Step 2: Clarification response → needs_refinement ────
		//
		// "Our thesis is that credentials do not predict performance."
		// This resolves the ambiguity but is still generic/weak.
		const turn2 = await simulateUserTurn(
			s,
			'Our thesis is that credentials do not predict performance.',
		);
		expect(turn2.ok).toBe(true);
		s = turn2.state!;

		// Engine detects weak content (no concrete indicators) →
		// transitions to needs_refinement.
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('needs_refinement');
		expect(s.nodeStates[nodeId]!.promptState).toBe('refinement');

		// ── Step 3: Refinement response → active (sufficient) ────
		//
		// Specific thesis with numbers and concrete data.
		const turn3 = await simulateUserTurn(
			s,
			'Our thesis is supported by data: we analyzed 10,000 hires ' +
				'and found work-sample tests predict performance 4x better ' +
				'than resume screening. This was validated through a ' +
				'controlled study with 15 mid-size tech companies.',
		);
		expect(turn3.ok).toBe(true);
		s = turn3.state!;

		// Engine detects sufficient content → stays active.
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('active');

		// ── Step 4: Force ready_for_synthesis → synthesis ──────────
		const rfsResult = dispatch(s, {
			nodeId,
			to: 'ready_for_synthesis' as NodeLifecycle,
			type: 'NODE_LIFECYCLE_CHANGED',
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
			nodeId,
			to: 'accepted' as NodeLifecycle,
			type: 'NODE_LIFECYCLE_CHANGED',
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
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r0b = dispatch(s, {
			nodeId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r0b.ok).toBe(true);
		s = r0b.state!;

		// Move to blocked
		const blockResult = dispatch(s, {
			nodeId,
			to: 'blocked' as NodeLifecycle,
			type: 'NODE_LIFECYCLE_CHANGED',
		} as LogosEvent);
		expect(blockResult.ok).toBe(true);
		s = blockResult.state!;

		const answerResult = dispatch(s, {
			content: 'Trying to answer a blocked node',
			nodeId,
			type: 'USER_MESSAGE_ADDED',
		} as LogosEvent);

		expect(answerResult.ok).toBe(false);
	});
});
