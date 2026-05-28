/**
 * Flow J — Change Profile
 *
 * Validates profile switching in idle/structure_overview mode.
 *
 * `CHANGE_PROFILE` event is implemented and tested here.
 * Full flow needs profile picker UI (Phase 16).
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.10}
 */
import { describe, expect, it } from 'vitest';

import {
	createFlowTestProfile,
	createTestSession,
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
});
