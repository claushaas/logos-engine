/**
 * Flow J — Change Profile
 *
 * Validates profile switching in idle/structure_overview mode.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.10}
 */
import { describe, expect, it } from 'vitest';

import type { LogosEvent } from '../../src/state-engine/types.js';
import {
	createFlowTestProfile,
	createTestSession,
	simulateUserTurn,
} from '../harness/conversation-harness.js';

describe('Flow J — Change Profile', () => {
	it('changes profile in structure_overview mode', () => {
		const profileA = createFlowTestProfile('profile-a');
		const profileB = createFlowTestProfile('profile-b');
		const { state, dispatch } = createTestSession(profileA);

		// Select profile A
		const r1 = dispatch(state, {
			profileId: profileA.id,
			type: 'SELECT_PROFILE',
		});
		expect(r1.ok).toBe(true);
		const s1 = r1.state!;
		expect(s1.selectedProfileId).toBe(profileA.id);

		// Change to profile B (must pass profileB as override)
		const r2 = dispatch(
			s1,
			{ profileId: profileB.id, type: 'CHANGE_PROFILE' },
			profileB,
		);
		expect(r2.ok).toBe(true);
		const s2 = r2.state!;
		expect(s2.selectedProfileId).toBe(profileB.id);
		expect(s2.mode).toBe('structure_overview');

		// Node states reset for new profile
		expect(Object.keys(s2.nodeStates)).toHaveLength(0);
	});

	it('change profile clears prior node work', async () => {
		const profileA = createFlowTestProfile('profile-a');
		const profileB = createFlowTestProfile('profile-b');
		const { state, dispatch } = createTestSession(profileA);

		const nodeId = profileA.nodes[0]!.id;

		// ── Select profile A and work on a node ────────────────────
		const r0 = dispatch(state, {
			profileId: profileA.id,
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

		// Do some work — send a message
		const turnResult = await simulateUserTurn(
			s,
			'Our core thesis is that credentials do not predict performance.',
		);
		expect(turnResult.ok).toBe(true);
		s = turnResult.state!;

		// Node state exists with conversation
		const nodeState = s.nodeStates[nodeId];
		expect(nodeState).toBeDefined();
		expect(nodeState!.conversation.length).toBeGreaterThan(0);

		// ── Change profile ─────────────────────────────────────────
		// Deselect node first, then change profile
		const r2 = dispatch(s, {
			type: 'DESELECT_NODE',
		} as LogosEvent);
		expect(r2.ok).toBe(true);
		s = r2.state!;

		const r3 = dispatch(
			s,
			{ profileId: profileB.id, type: 'CHANGE_PROFILE' },
			profileB,
		);
		expect(r3.ok).toBe(true);
		s = r3.state!;

		expect(s.selectedProfileId).toBe(profileB.id);
		expect(s.mode).toBe('structure_overview');

		// Node states should be cleared
		expect(Object.keys(s.nodeStates)).toHaveLength(0);

		// lastActiveNodeId should be null (node belonged to old profile)
		expect(s.lastActiveNodeId).toBeNull();
	});
});
