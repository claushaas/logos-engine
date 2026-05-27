/**
 * Flow D — Review, Edit, Regenerate
 *
 * Validates user control over generated canonical content:
 *   synthesized → edit (reopen to active) → add edit message →
 *   ready_for_synthesis → regenerate synthesis → accept.
 *
 * **Note:** True `EDIT_CANONICAL_ANSWER` and `REGENERATE_CANONICAL_ANSWER`
 * events are not yet implemented in `dispatch()` (Phase 10 tasks). This test
 * drives equivalent behaviour via `NODE_LIFECYCLE_CHANGED` events and
 * validates the lifecycle transition + canonical draft persistence.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.4}
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

describe('Flow D — Review, Edit, Regenerate', () => {
	it('edits canonical answer via reopen → edit → synthesize → accept', async () => {
		const profile = createFlowTestProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeId = profile.nodes[0]!.id;

		// ── Setup: select profile and node, start conversation ────
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

		const turn1 = await simulateUserTurn(
			s,
			'Hiring evaluates credentials over competence.',
		);
		expect(turn1.ok).toBe(true);
		s = turn1.state!;

		// ── Step 1: Reach synthesized ─────────────────────────────
		const rfsResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'ready_for_synthesis' as NodeLifecycle,
		} as LogosEvent);
		expect(rfsResult.ok).toBe(true);
		s = rfsResult.state!;

		const synthResult = await simulateAgentTurn(
			s,
			nodeId,
			'ready_for_synthesis',
		);
		expect(synthResult.ok).toBe(true);
		s = synthResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('synthesized');
		expect(s.nodeStates[nodeId]!.canonicalAnswer).not.toBeNull();

		const originalDraft = s.nodeStates[nodeId]!.canonicalAnswer!;
		expect(originalDraft.content).toBeTruthy();

		// ── Step 2: Edit — reopen to active (simulating edit) ─────
		const reopenResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'active' as NodeLifecycle,
		} as LogosEvent);
		expect(reopenResult.ok).toBe(true);
		s = reopenResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('active');

		// The canonical answer draft is preserved for reference
		if (s.nodeStates[nodeId]!.canonicalAnswer) {
			expect(
				s.nodeStates[nodeId]!.canonicalAnswer!.content,
			).toBeTruthy();
		}

		// Add the user's edit as a message
		const editMsgResult = dispatch(s, {
			type: 'USER_MESSAGE_ADDED',
			nodeId,
			content:
				'EDIT: Please change "credentials over competence" to ' +
				'"traditional credentials over demonstrated competence."',
		} as LogosEvent);
		expect(editMsgResult.ok).toBe(true);
		s = editMsgResult.state!;

		// ── Step 3: Regenerate — force ready_for_synthesis → synthesized ─
		const rfs2Result = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'ready_for_synthesis' as NodeLifecycle,
		} as LogosEvent);
		expect(rfs2Result.ok).toBe(true);
		s = rfs2Result.state!;

		const regenResult = await simulateAgentTurn(
			s,
			nodeId,
			'ready_for_synthesis',
		);
		expect(regenResult.ok).toBe(true);
		s = regenResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('synthesized');

		// Canonical answer should be re-stored with new draft
		const regeneratedDraft = s.nodeStates[nodeId]!.canonicalAnswer;
		expect(regeneratedDraft).not.toBeNull();

		// ── Step 4: Accept ────────────────────────────────────────
		const acceptResult = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'accepted' as NodeLifecycle,
		} as LogosEvent);
		expect(acceptResult.ok).toBe(true);
		s = acceptResult.state!;
		expect(s.nodeStates[nodeId]!.lifecycle).toBe('accepted');
	});

	it('rejects direct not_started → accepted transition', () => {
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

		const result = dispatch(s, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'accepted' as NodeLifecycle,
		} as LogosEvent);

		expect(result.ok).toBe(false);
	});
});
