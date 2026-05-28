/**
 * Flow A — First Use
 *
 * Validates the complete first interaction loop:
 *   idle → profile selection → structure overview → first node →
 *   conversation → synthesis → acceptance.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.1}
 */
import { describe, expect, it } from 'vitest';

import {
	createFlowTestProfile,
	createTestSession,
	simulateNodeCompletion,
} from '../harness/conversation-harness.js';

describe('Flow A — First Use', () => {
	it('completes the idle → accepted loop end-to-end', async () => {
		const profile = createFlowTestProfile();
		const { state, dispatch } = createTestSession(profile);

		// ── Step 1: Idle — assert initial state ────────────────────
		expect(state.mode).toBe('idle');
		expect(state.selectedProfileId).toBeNull();
		expect(state.activeNodeId).toBeNull();

		// ── Step 2: Select profile ─────────────────────────────────
		const r1 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r1.ok).toBe(true);
		const s1 = r1.state!;
		expect(s1.mode).toBe('structure_overview');
		expect(s1.selectedProfileId).toBe(profile.id);

		// ── Step 3: Select first node ──────────────────────────────
		const nodeId = profile.nodes[0]!.id;
		const r2 = dispatch(s1, {
			nodeId,
			type: 'SELECT_NODE',
		});
		expect(r2.ok).toBe(true);
		const s2 = r2.state!;
		expect(s2.mode).toBe('node_focus');
		expect(s2.activeNodeId).toBe(nodeId);

		const nodeState = s2.nodeStates[nodeId];
		expect(nodeState).toBeDefined();
		expect(nodeState!.lifecycle).toBe('not_started');

		// ── Steps 4-5: Complete the node ──────────────────────────
		const completionResult = await simulateNodeCompletion(s2, nodeId);
		expect(completionResult.ok).toBe(true);

		// ── Assert final state ────────────────────────────────────
		const finalNode = completionResult.state!.nodeStates[nodeId];
		expect(finalNode).toBeDefined();
		expect(finalNode!.lifecycle).toBe('accepted');

		// Canonical answer should exist after synthesis
		expect(finalNode!.canonicalAnswer).not.toBeNull();
		expect(finalNode!.canonicalAnswer!.content).toBeTruthy();

		// Conversation should have messages
		expect(finalNode!.conversation.length).toBeGreaterThan(0);
	});

	it('rejects node selection before profile selection', () => {
		const profile = createFlowTestProfile();
		const { state, dispatch } = createTestSession(profile);

		const result = dispatch(state, {
			nodeId: profile.nodes[0]!.id,
			type: 'SELECT_NODE',
		});
		expect(result.ok).toBe(false);
	});
});
