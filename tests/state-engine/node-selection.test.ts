/**
 * Tests for Step 3.3 — node selection and deselection.
 *
 * Covers:
 *  - First selection initialises `NodeRuntimeState.lifecycle` as `"not_started"`.
 *  - Re-selection of a previously worked node preserves its full state.
 *  - Blocked nodes are navigable but open in `blocked` lifecycle.
 *  - Deselection sets `mode` to `structure_overview` and preserves node state.
 *  - `lastActiveNodeId` is updated correctly on navigation.
 *  - Selecting a non-existent node returns an error.
 *  - Selecting a node without a selected profile returns an error.
 *  - Immutability: input state is never mutated.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import {
	createSession,
	deselectNode,
	selectNode,
	selectProfile,
} from '../../src/state-engine/index.js';
import type { NodeId, ProfileId } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

let tempDir: string;

function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), 'logos-node-selection-test-'));
}

/**
 * Write a profile with the given nodes to the temp directory.
 *
 * Each node entry can specify optional `requiredNodeIds` for dependency edges.
 * All nodes belong to a single phase and document so the profile passes
 * structural validation.
 */
function writeProfile(
	dir: string,
	id: string,
	nodes: Array<{
		id: string;
		requiredNodeIds?: string[];
	}>,
): void {
	const nodeYml = nodes
		.map(
			(n) => `  - id: ${n.id}
    phaseId: phase-1
    documentId: ${id}-doc
    title: "Node ${n.id}"
    order: 1
    canonicalQuestion: "What is ${n.id}?"
    sufficiencyCriteria: []
    coverageTopics: []
    promptRefs: {}
    dependencies:
      requiredNodeIds: [${(n.requiredNodeIds ?? []).join(', ')}]
      recommendedNodeIds: []`,
		)
		.join('\n');

	const yml = `\
id: ${id}
title: "Test Profile ${id}"
version: "1.0.0"
phases:
  - id: phase-1
    title: "Phase 1"
    order: 1
    purpose: "Testing"
documents:
  - id: ${id}-doc
    phaseId: phase-1
    title: "Test Document"
    order: 1
    purpose: "Testing"
    outputPath: /dev/null
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
${nodeYml}
materializationRules: []
`;
	writeFileSync(join(dir, `${id}.yml`), yml, 'utf-8');
}

/** Deep-clone a state object so we can detect mutations. */
function cloneState(state: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(state));
}

/**
 * Helper: create a session, select a profile, then select a node.
 *
 * Returns the resulting state (asserts ok) for use in re-selection tests.
 */
function setupSessionWithNode(
	profileId: string,
	nodeId: string,
): LogosRuntimeState {
	const initial = createSession();

	const profileResult = selectProfile(
		initial,
		profileId as ProfileId,
		{ profileDirectory: tempDir },
	);
	if (!profileResult.ok) {
		throw new Error(`Failed to select profile: ${profileResult.error}`);
	}

	const nodeResult = selectNode(
		profileResult.state,
		nodeId as NodeId,
		{ profileDirectory: tempDir },
	);
	if (!nodeResult.ok) {
		throw new Error(`Failed to select node: ${nodeResult.error}`);
	}

	return nodeResult.state;
}

beforeEach(() => {
	tempDir = makeTempDir();
});

afterEach(() => {
	rmSync(tempDir, { force: true, recursive: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// selectNode — guards
// ═══════════════════════════════════════════════════════════════════════════

describe('selectNode guards', () => {
	it('returns error when no profile is selected', () => {
		const initial = createSession();

		const result = selectNode(initial, 'any-node' as NodeId);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain(
			'Cannot select a node without a selected profile',
		);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]!.code).toBe(
			'LOGOS_STATE_NO_PROFILE_SELECTED',
		);
	});

	it('returns error when node does not exist in profile', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const initial = createSession();

		const profileResult = selectProfile(
			initial,
			'test-profile' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!profileResult.ok) throw new Error('Expected profile selected');

		const result = selectNode(
			profileResult.state,
			'nonexistent' as NodeId,
			{ profileDirectory: tempDir },
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('does not exist in profile');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]!.code).toBe(
			'LOGOS_STATE_NODE_NOT_IN_PROFILE',
		);
	});

	it('does not mutate input state on error', () => {
		const initial = createSession();
		const original = cloneState(initial);

		selectNode(initial, 'any-node' as NodeId);

		expect(initial).toEqual(original);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// selectNode — first selection
// ═══════════════════════════════════════════════════════════════════════════

describe('selectNode — first selection', () => {
	it('initialises NodeRuntimeState with lifecycle "not_started"', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const nodeState: NodeRuntimeState | undefined =
			state.nodeStates['node-A'];
		expect(nodeState).toBeDefined();
		expect(nodeState!.lifecycle).toBe('not_started');
	});

	it('initialises promptState to "initial" for not_started', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.nodeStates['node-A']!.promptState).toBe('initial');
	});

	it('initialises empty conversation', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.nodeStates['node-A']!.conversation).toEqual([]);
	});

	it('initialises no canonical answer', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.nodeStates['node-A']!.canonicalAnswer).toBeNull();
	});

	it('initialises empty completeness state', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.nodeStates['node-A']!.completeness).toEqual({
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		});
	});

	it('initialises empty extracted data', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.nodeStates['node-A']!.extracted).toEqual({
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		});
	});

	it('sets activeNodeId to the selected node', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.activeNodeId).toBe('node-A');
	});

	it('sets mode to "node_focus"', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.mode).toBe('node_focus');
	});

	it('sets lastActiveNodeId to null when first node is selected', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.lastActiveNodeId).toBeNull();
	});

	it('does not mutate input state', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const initial = createSession();

		const profileResult = selectProfile(
			initial,
			'test-profile' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!profileResult.ok) throw new Error('Expected ok');

		const original = cloneState(profileResult.state);
		selectNode(
			profileResult.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);

		expect(profileResult.state).toEqual(original);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// selectNode — re-selection (state preservation)
// ═══════════════════════════════════════════════════════════════════════════

describe('selectNode — re-selection', () => {
	it('preserves lifecycle on re-selection (not_started → not_started)', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const first = setupSessionWithNode('test-profile', 'node-A');

		// Deselect, then re-select.
		const deselected = deselectNode(first);
		if (!deselected.ok) throw new Error('Expected deselect ok');

		const reResult = selectNode(
			deselected.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!reResult.ok) throw new Error('Expected ok');

		expect(reResult.state.nodeStates['node-A']!.lifecycle).toBe(
			'not_started',
		);
	});

	it('preserves conversation on re-selection', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const first = setupSessionWithNode('test-profile', 'node-A');

		// Simulate adding a conversation entry by patching the state.
		const withMsg: LogosRuntimeState = {
			...first,
			nodeStates: {
				...first.nodeStates,
				'node-A': {
					...first.nodeStates['node-A']!,
					conversation: [
						{
							id: 'msg-1',
							role: 'user',
							content: 'Hello',
							createdAt: new Date().toISOString(),
						},
					],
				},
			},
		};

		// Deselect, then re-select.
		const deselected = deselectNode(withMsg);
		if (!deselected.ok) throw new Error('Expected deselect ok');

		const reResult = selectNode(
			deselected.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!reResult.ok) throw new Error('Expected ok');

		expect(
			reResult.state.nodeStates['node-A']!.conversation,
		).toHaveLength(1);
		expect(reResult.state.nodeStates['node-A']!.conversation[0]!.content).toBe(
			'Hello',
		);
	});

	it('preserves canonical answer on re-selection', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const first = setupSessionWithNode('test-profile', 'node-A');

		const withAnswer: LogosRuntimeState = {
			...first,
			nodeStates: {
				...first.nodeStates,
				'node-A': {
					...first.nodeStates['node-A']!,
					canonicalAnswer: {
						content: 'This is the answer.',
						accepted: false,
						confidence: 'medium',
						sourceMessageIds: [],
						generatedAt: new Date().toISOString(),
					},
				},
			},
		};

		const deselected = deselectNode(withAnswer);
		if (!deselected.ok) throw new Error('Expected deselect ok');

		const reResult = selectNode(
			deselected.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!reResult.ok) throw new Error('Expected ok');

		expect(
			reResult.state.nodeStates['node-A']!.canonicalAnswer,
		).not.toBeNull();
		expect(
			reResult.state.nodeStates['node-A']!.canonicalAnswer!.content,
		).toBe('This is the answer.');
	});

	it('updates lastActiveNodeId when navigating between nodes', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B' },
		]);
		const initial = createSession();

		const profileResult = selectProfile(
			initial,
			'test-profile' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!profileResult.ok) throw new Error('Expected ok');

		// Select node-A first.
		const aResult = selectNode(
			profileResult.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!aResult.ok) throw new Error('Expected ok');
		// No previous active node → lastActiveNodeId should still be null.
		expect(aResult.state.lastActiveNodeId).toBeNull();
		expect(aResult.state.activeNodeId).toBe('node-A');

		// Now select node-B.
		const bResult = selectNode(
			aResult.state,
			'node-B' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!bResult.ok) throw new Error('Expected ok');
		// lastActiveNodeId should now be node-A.
		expect(bResult.state.lastActiveNodeId).toBe('node-A');
		expect(bResult.state.activeNodeId).toBe('node-B');
	});

	it('updates lastActiveNodeId when deselecting', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const result = deselectNode(state);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.lastActiveNodeId).toBe('node-A');
		expect(result.state.activeNodeId).toBeNull();
	});

	it('recomputes dependencies on re-selection', () => {
		// node-B depends on node-A.
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B', requiredNodeIds: ['node-A'] },
		]);

		// First select node-B (blocked, since node-A is not accepted).
		const initial = createSession();
		const profileResult = selectProfile(
			initial,
			'test-profile' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!profileResult.ok) throw new Error('Expected ok');

		const bFirst = selectNode(
			profileResult.state,
			'node-B' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!bFirst.ok) throw new Error('Expected ok');
		expect(bFirst.state.nodeStates['node-B']!.lifecycle).toBe('blocked');
		expect(bFirst.state.nodeStates['node-B']!.dependencies.blockedBy).toEqual(
			['node-A'],
		);

		// Manually accept node-A by patching its node state.
		const aNodeState: NodeRuntimeState = {
			nodeId: 'node-A' as NodeId,
			lifecycle: 'accepted',
			conversation: [],
			canonicalAnswer: null,
			completeness: {
				blockingIssues: [],
				complete: true,
				coverage: {},
				missing: [],
				weak: [],
			},
			extracted: {
				assumptions: [],
				decisions: [],
				facts: [],
				openQuestions: [],
				risks: [],
			},
			promptState: 'accepted',
			allowedActions: [],
			dependencies: {
				requiredNodeIds: [],
				blockedBy: [],
				unlocks: ['node-B'],
			},
			updatedAt: new Date().toISOString(),
		};

		const withAAccepted: LogosRuntimeState = {
			...bFirst.state,
			nodeStates: {
				...bFirst.state.nodeStates,
				'node-A': aNodeState,
			},
		};

		// Deselect and re-select node-B — should now be unblocked.
		const deselected = deselectNode(withAAccepted);
		if (!deselected.ok) throw new Error('Expected deselect ok');

		const bSecond = selectNode(
			deselected.state,
			'node-B' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!bSecond.ok) throw new Error('Expected ok');

		// node-B was blocked, now dependencies are met → auto-resolved to not_started.
		expect(bSecond.state.nodeStates['node-B']!.lifecycle).toBe(
			'not_started',
		);
		expect(
			bSecond.state.nodeStates['node-B']!.dependencies.blockedBy,
		).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// selectNode — blocked nodes (unmet dependencies)
// ═══════════════════════════════════════════════════════════════════════════

describe('selectNode — blocked nodes', () => {
	it('opens as "blocked" when required dependency is not accepted', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B', requiredNodeIds: ['node-A'] },
		]);
		const state = setupSessionWithNode('test-profile', 'node-B');

		expect(state.nodeStates['node-B']!.lifecycle).toBe('blocked');
		expect(state.nodeStates['node-B']!.promptState).toBe('blocked');
	});

	it('populates dependencies.blockedBy with unmet dependency IDs', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B', requiredNodeIds: ['node-A'] },
		]);
		const state = setupSessionWithNode('test-profile', 'node-B');

		expect(state.nodeStates['node-B']!.dependencies.blockedBy).toEqual([
			'node-A',
		]);
	});

	it('populates dependencies.requiredNodeIds from the graph', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B', requiredNodeIds: ['node-A'] },
		]);
		const state = setupSessionWithNode('test-profile', 'node-B');

		expect(
			state.nodeStates['node-B']!.dependencies.requiredNodeIds,
		).toEqual(['node-A']);
	});

	it('populates dependencies.unlocks from the graph', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B', requiredNodeIds: ['node-A'] },
		]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		// node-A unlocks node-B.
		expect(state.nodeStates['node-A']!.dependencies.unlocks).toEqual([
			'node-B',
		]);
	});

	it('node with no dependencies opens as not_started', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		expect(state.nodeStates['node-A']!.lifecycle).toBe('not_started');
		expect(
			state.nodeStates['node-A']!.dependencies.blockedBy,
		).toEqual([]);
	});

	it('blocked node is still navigable (activeNodeId is set)', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B', requiredNodeIds: ['node-A'] },
		]);
		const state = setupSessionWithNode('test-profile', 'node-B');

		expect(state.activeNodeId).toBe('node-B');
		expect(state.mode).toBe('node_focus');
	});

	it('multiple unmet dependencies are all listed in blockedBy', () => {
		writeProfile(tempDir, 'test-profile', [
			{ id: 'node-A' },
			{ id: 'node-B' },
			{ id: 'node-C', requiredNodeIds: ['node-A', 'node-B'] },
		]);
		const state = setupSessionWithNode('test-profile', 'node-C');

		expect(state.nodeStates['node-C']!.lifecycle).toBe('blocked');
		const blockedBy =
			state.nodeStates['node-C']!.dependencies.blockedBy;
		expect(blockedBy).toHaveLength(2);
		expect(blockedBy).toContain('node-A');
		expect(blockedBy).toContain('node-B');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// deselectNode
// ═══════════════════════════════════════════════════════════════════════════

describe('deselectNode', () => {
	it('returns to "structure_overview" mode', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const result = deselectNode(state);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.mode).toBe('structure_overview');
	});

	it('sets activeNodeId to null', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const result = deselectNode(state);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.activeNodeId).toBeNull();
	});

	it('preserves node state (lifecycle, conversation, etc.)', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const result = deselectNode(state);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.nodeStates['node-A']).toBeDefined();
		expect(result.state.nodeStates['node-A']!.lifecycle).toBe(
			'not_started',
		);
	});

	it('updates lastActiveNodeId to the deselected node', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const result = deselectNode(state);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.lastActiveNodeId).toBe('node-A');
	});

	it('recomputes mode even when no node is active (defensive recomputation)', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const initial = createSession();

		const profileResult = selectProfile(
			initial,
			'test-profile' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!profileResult.ok) throw new Error('Expected ok');

		// activeNodeId is already null — but mode is always recomputed.
		const result = deselectNode(profileResult.state);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.activeNodeId).toBeNull();
		expect(result.state.mode).toBe('structure_overview');
		expect(result.state.selectedProfileId).toBe('test-profile');
	});

	it('recomputes mode to idle when profile is null and node is null', () => {
		const initial = createSession();
		// initial has mode: 'idle', but we can force a stale mode.
		const stale: LogosRuntimeState = {
			...initial,
			mode: 'node_focus', // stale — no active node or profile
		};

		const result = deselectNode(stale);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.activeNodeId).toBeNull();
		expect(result.state.mode).toBe('idle');
	});

	it('does not mutate input state', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');
		const original = cloneState(state);

		deselectNode(state);

		expect(state).toEqual(original);
	});

	it('twice-deselect is idempotent', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);
		const state = setupSessionWithNode('test-profile', 'node-A');

		const r1 = deselectNode(state);
		if (!r1.ok) throw new Error('Expected ok');
		const r2 = deselectNode(r1.state);
		if (!r2.ok) throw new Error('Expected ok');

		expect(r2.state.activeNodeId).toBeNull();
		expect(r2.state.mode).toBe('structure_overview');
		expect(r2.state.lastActiveNodeId).toBe('node-A'); // preserved from first deselect
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// End-to-end: navigation flow
// ═══════════════════════════════════════════════════════════════════════════

describe('navigation flow (end-to-end)', () => {
	it('select → deselect → re-select preserves all state', () => {
		writeProfile(tempDir, 'test-profile', [{ id: 'node-A' }]);

		const initial = createSession();
		const profileResult = selectProfile(
			initial,
			'test-profile' as ProfileId,
			{ profileDirectory: tempDir },
		);
		if (!profileResult.ok) throw new Error('Expected ok');

		// First selection.
		const first = selectNode(
			profileResult.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!first.ok) throw new Error('Expected ok');
		expect(first.state.mode).toBe('node_focus');
		expect(first.state.activeNodeId).toBe('node-A');
		expect(
			first.state.nodeStates['node-A']!.lifecycle,
		).toBe('not_started');

		// Deselect.
		const deselected = deselectNode(first.state);
		if (!deselected.ok) throw new Error('Expected ok');
		expect(deselected.state.mode).toBe('structure_overview');
		expect(deselected.state.activeNodeId).toBeNull();
		expect(deselected.state.lastActiveNodeId).toBe('node-A');
		// Node state preserved.
		expect(
			deselected.state.nodeStates['node-A']!.lifecycle,
		).toBe('not_started');

		// Re-select.
		const reselected = selectNode(
			deselected.state,
			'node-A' as NodeId,
			{ profileDirectory: tempDir },
		);
		if (!reselected.ok) throw new Error('Expected ok');
		expect(reselected.state.mode).toBe('node_focus');
		expect(reselected.state.activeNodeId).toBe('node-A');
		expect(
			reselected.state.nodeStates['node-A']!.lifecycle,
		).toBe('not_started');
	});
});
