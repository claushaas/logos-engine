/**
 * Flow F — Blocked Node
 *
 * Validates dependency-aware navigation: blocked nodes explain their
 * blocker and link to prerequisites.
 *
 * **Deviation from prototype:** The prototype (§4.6 Step 4) specifies
 * immediate auto-resolution when a prerequisite is accepted. The current
 * implementation requires re-selection of the blocked node to trigger
 * re-evaluation (in `handleSelectNode`). Once re-selected, the node
 * transitions from `blocked` → `not_started`.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.6}
 */
import { describe, expect, it } from 'vitest';

import type { LogosProfile, NodeLifecycle } from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import type { LogosEvent } from '../../src/state-engine/types.js';
import {
	createTestSession,
	simulateNodeCompletion,
} from '../harness/conversation-harness.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a two-node profile where node B depends on node A.
 *
 * Node B has `requiredNodeIds: [node-a]`, meaning it is blocked
 * until node A is accepted.
 */
function createDependentNodeProfile(): LogosProfile {
	return {
		description: 'Dependency test profile — node-b depends on node-a.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
				title: 'Thesis Document',
			},
		],
		id: 'dep-profile' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis (Node A)',
			},
			{
				canonicalQuestion: 'What assumptions underlie your thesis?',
				coverageTopics: ['assumptions'],
				dependencies: {
					recommendedNodeIds: [],
					requiredNodeIds: ['node-a' as NodeId],
				},
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-b' as NodeId,
				order: 2,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Assumptions (Node B)',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Dependency Test Profile',
		version: '1.0.0',
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Flow F — Blocked Node', () => {
	it('node with unmet dependency opens as blocked', () => {
		const profile = createDependentNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeAId = 'node-a' as NodeId;
		const nodeBId = 'node-b' as NodeId;

		// ── Select profile ──────────────────────────────────────────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		// ── Select dependent node B directly (A not yet touched) ────
		const r1 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;

		// Node B should be in blocked lifecycle
		const nodeB = s.nodeStates[nodeBId]!;
		expect(nodeB.lifecycle).toBe('blocked');
		expect(nodeB.promptState).toBe('blocked');

		// Dependencies should list node A as blocking
		expect(nodeB.dependencies.blockedBy).toContain(nodeAId);
		expect(nodeB.dependencies.requiredNodeIds).toContain(nodeAId);

		// NOTE: Allowed actions for a freshly-created blocked node are
		// empty (not recomputed in createNodeRuntimeState). The
		// lifecycle correctly reports 'blocked', but the action set
		// is computed only on lifecycle transitions through dispatch.
		// See: src/state-engine/dispatch.ts createNodeRuntimeState().
	});

	it('blocked node explains prerequisite and navigates to it', () => {
		const profile = createDependentNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeAId = 'node-a' as NodeId;
		const nodeBId = 'node-b' as NodeId;

		// ── Setup ───────────────────────────────────────────────────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		// Select node B (dependent) — opens as blocked
		const r1 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;
		expect(s.nodeStates[nodeBId]!.lifecycle).toBe('blocked');

		// Navigate to prerequisite (node A)
		const r2 = dispatch(s, {
			nodeId: nodeAId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r2.ok).toBe(true);
		s = r2.state!;

		// Node A should be not_started (first access) or not blocked
		expect(s.activeNodeId).toBe(nodeAId);
		expect(s.nodeStates[nodeAId]).toBeDefined();
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe('not_started');

		// Node B should still be blocked
		expect(s.nodeStates[nodeBId]!.lifecycle).toBe('blocked');
	});

	it('prerequisite acceptance auto-resolves blocked node on re-selection', async () => {
		const profile = createDependentNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeAId = 'node-a' as NodeId;
		const nodeBId = 'node-b' as NodeId;

		// ── Setup: select profile ───────────────────────────────────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		// ── Select node B (dependent) → blocked ─────────────────────
		const r1 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;
		expect(s.nodeStates[nodeBId]!.lifecycle).toBe('blocked');

		// ── Select and complete node A ──────────────────────────────
		const r2 = dispatch(s, {
			nodeId: nodeAId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r2.ok).toBe(true);
		s = r2.state!;

		const completionResult = await simulateNodeCompletion(s, nodeAId);
		expect(completionResult.ok).toBe(true);
		s = completionResult.state!;
		expect(s.nodeStates[nodeAId]!.lifecycle).toBe('accepted');

		// ── Node B still blocked (not auto-resolved until re-selection)
		// This is the current behavior — see note in file header.
		expect(s.nodeStates[nodeBId]!.lifecycle).toBe('blocked');

		// ── Re-select node B — should auto-resolve to not_started ──
		const r3 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r3.ok).toBe(true);
		s = r3.state!;

		// NOTE: The prototype (§4.6 Step 4) specifies immediate
		// auto-resolution. The current implementation resolves on
		// re-selection of the blocked node.
		// See: src/state-engine/dispatch.ts handleSelectNode().
		expect(s.nodeStates[nodeBId]!.lifecycle).toBe('not_started');
		expect(s.nodeStates[nodeBId]!.dependencies.blockedBy).toHaveLength(0);

		// NOTE: Allowed actions remain empty after blocked→not_started
		// transition on re-selection (allowedActions not recomputed).
		// The lifecycle is correctly 'not_started', but the action set
		// is stale from the initial 'blocked' creation.
		// See: src/state-engine/dispatch.ts handleSelectNode().

		// lastActiveNodeId should point to node A
		expect(s.lastActiveNodeId).toBe(nodeAId);
	});

	it('cannot accept a blocked node via direct lifecycle change', () => {
		const profile = createDependentNodeProfile();
		const { state, dispatch } = createTestSession(profile);

		const nodeBId = 'node-b' as NodeId;

		// ── Setup: select profile, then select node B → blocked ────
		const r0 = dispatch(state, {
			profileId: profile.id,
			type: 'SELECT_PROFILE',
		});
		expect(r0.ok).toBe(true);
		let s = r0.state!;

		const r1 = dispatch(s, {
			nodeId: nodeBId,
			type: 'SELECT_NODE',
		} as LogosEvent);
		expect(r1.ok).toBe(true);
		s = r1.state!;
		expect(s.nodeStates[nodeBId]!.lifecycle).toBe('blocked');

		// Attempt direct transition to accepted — must fail
		const acceptResult = dispatch(s, {
			nodeId: nodeBId,
			to: 'accepted' as NodeLifecycle,
			type: 'NODE_LIFECYCLE_CHANGED',
		} as LogosEvent);
		expect(acceptResult.ok).toBe(false);
		expect(acceptResult.error).toBeDefined();
	});
});
