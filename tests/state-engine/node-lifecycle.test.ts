/**
 * Tests for Step 3.4 — node lifecycle transition validation.
 *
 * Covers:
 *  - Transition matrix: every `from × to` combination produces expected validity.
 *  - Valid transitions with correct events:
 *    - `not_started → active` with `ASKED_INITIAL` succeeds.
 *    - `synthesized → accepted` with `USER_ACCEPT` succeeds.
 *    - `active → answered` with `USER_ANSWER_EVALUATED` succeeds.
 *    - `deferred → active` with `USER_RESUME` succeeds.
 *    - `blocked → active` with `DEPENDENCY_RESOLVED` (no blockers) succeeds.
 *    - `blocked → not_started` with `DEPENDENCY_RESOLVED` (no blockers) succeeds.
 *    - `accepted → active` with `USER_REOPEN` succeeds.
 *  - Invalid transitions are rejected with descriptive errors:
 *    - `not_started → accepted` fails.
 *    - `needs_clarification → accepted` fails.
 *    - `needs_refinement → accepted` fails.
 *    - `blocked → accepted` fails.
 *    - `accepted → synthesized` fails.
 *    - `accepted → deferred` fails.
 *  - Event guard:
 *    - Missing event → rejected.
 *    - Wrong event (`NODE_READY_FOR_ACCEPTANCE` for synthesized → accepted) → rejected.
 *    - Wrong event (`USER_REOPEN` for synthesized → accepted) → rejected.
 *  - Dependency guard: `blocked → active` and `blocked → not_started` rejected
 *    when `blockedBy` is non-empty.
 *  - Transition effects: lifecycle, promptState, allowedActions, updatedAt.
 *  - Immutability: input state is never mutated.
 *  - Non-existent node → error.
 */
import { describe, expect, it } from 'vitest';

import type {
	LogosRuntimeState,
	NodeDefinition,
	NodeDependencyState,
	NodeLifecycle,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { NodeId, SessionId } from '../../src/shared/index.js';
import { generateId, nowIso } from '../../src/shared/index.js';
import {
	applyLifecycleTransition,
	createSession,
} from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All 10 lifecycle states for exhaustive iteration.
 */
const ALL_LIFECYCLES: readonly NodeLifecycle[] = [
	'not_started',
	'active',
	'answered',
	'needs_clarification',
	'needs_refinement',
	'ready_for_synthesis',
	'synthesized',
	'accepted',
	'deferred',
	'blocked',
] as const;

/**
 * Create a minimal node runtime state at the given lifecycle with
 * optional dependencies.
 */
function makeNodeState(
	nodeId: NodeId,
	lifecycle: NodeLifecycle,
	dependencies?: Partial<NodeDependencyState>,
): NodeRuntimeState {
	return {
		allowedActions: [],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: {
			blockedBy: dependencies?.blockedBy ?? [],
			requiredNodeIds: dependencies?.requiredNodeIds ?? [],
			unlocks: dependencies?.unlocks ?? [],
		},
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle,
		nodeId,
		promptState: 'initial',
		updatedAt: nowIso(),
	};
}

/**
 * Create a minimal runtime state with a single node at the given lifecycle.
 */
function stateWithNode(
	nodeId: NodeId,
	lifecycle: NodeLifecycle,
	dependencies?: Partial<NodeDependencyState>,
): LogosRuntimeState {
	const sessionId = generateId() as SessionId;
	return {
		activeNodeId: nodeId,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'node_focus',
		nodeStates: {
			[nodeId]: makeNodeState(nodeId, lifecycle, dependencies),
		},
		selectedProfileId: null,
		sessionId,
		updatedAt: nowIso(),
	};
}

/**
 * Deep-clone a state object so we can detect mutations.
 */
function cloneState(state: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(state));
}

/**
 * The valid transition matrix used by the implementation.
 *
 * Self-transitions are not valid unless explicitly listed (none are).
 */
const VALID_TRANSITIONS: Readonly<
	Record<NodeLifecycle, ReadonlySet<NodeLifecycle>>
> = {
	accepted: new Set<NodeLifecycle>(['active']),
	active: new Set<NodeLifecycle>([
		'answered',
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	]),
	answered: new Set<NodeLifecycle>([
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	]),
	blocked: new Set<NodeLifecycle>(['active', 'not_started', 'deferred']),
	deferred: new Set<NodeLifecycle>(['active', 'blocked']),
	needs_clarification: new Set<NodeLifecycle>([
		'active',
		'deferred',
		'blocked',
	]),
	needs_refinement: new Set<NodeLifecycle>([
		'active',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	]),
	not_started: new Set<NodeLifecycle>(['active', 'deferred', 'blocked']),
	ready_for_synthesis: new Set<NodeLifecycle>([
		'synthesized',
		'deferred',
		'blocked',
	]),
	synthesized: new Set<NodeLifecycle>([
		'accepted',
		'active',
		'deferred',
		'blocked',
	]),
};

// ═══════════════════════════════════════════════════════════════════════════
// Import isValidTransition directly for the matrix test
// ═══════════════════════════════════════════════════════════════════════════

import { isValidTransition } from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Transition matrix — exhaustive from × to test
// ═══════════════════════════════════════════════════════════════════════════

describe('isValidTransition — exhaustive matrix', () => {
	for (const from of ALL_LIFECYCLES) {
		for (const to of ALL_LIFECYCLES) {
			// Self-transitions are invalid unless explicitly in the matrix (none are).
			const expectedValid = VALID_TRANSITIONS[from].has(to);
			it(`${from} → ${to} should be ${expectedValid ? 'valid' : 'invalid'}`, () => {
				expect(isValidTransition(from, to)).toBe(expectedValid);
			});
		}
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// Valid transitions — specific tests
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — valid transitions', () => {
	it('not_started → active succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('synthesized → accepted with USER_ACCEPT succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('accepted');
	});

	it('active → answered succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'active');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'answered',
			{ event: 'USER_ANSWER_EVALUATED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('answered');
	});

	it('deferred → active succeeds (resume)', () => {
		const state = stateWithNode('node-A' as NodeId, 'deferred');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_RESUME' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('blocked → active succeeds when no blockers remain', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: [], // all dependencies resolved
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'DEPENDENCY_RESOLVED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('blocked → not_started succeeds when no blockers remain', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: [],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'not_started',
			{ event: 'DEPENDENCY_RESOLVED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('not_started');
	});

	it('blocked → deferred succeeds even with blockers', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: ['node-B'],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'deferred',
			{ event: 'USER_DEFER' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('deferred');
	});

	it('accepted → active succeeds (reopen)', () => {
		const state = stateWithNode('node-A' as NodeId, 'accepted');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_REOPEN' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('needs_refinement → ready_for_synthesis succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'needs_refinement');
		// Patch the node state to have a conversation that satisfies a
		// minimal coverage topic so the completeness guard (Step 3.6)
		// allows the transition.
		const existingNode = state.nodeStates['node-A'];
		const patchedState: LogosRuntimeState = {
			...state,
			nodeStates: {
				...state.nodeStates,
				'node-A': existingNode
					? {
							...existingNode,
							conversation: [
								{
									content:
										'Our target audience is SaaS founders with 2-10 employees.',
									createdAt: nowIso(),
									id: 'msg-1',
									role: 'user' as const,
								},
							],
						}
					: undefined,
			},
		};
		const nodeDef: NodeDefinition = {
			canonicalQuestion: 'Who is the target audience?',
			coverageTopics: ['Target audience'],
			documentId: 'doc-1' as NodeId,
			id: 'node-A' as NodeId,
			order: 1,
			phaseId: 'phase-1',
			promptRefs: {},
			sufficiencyCriteria: ['Audience is specific'],
			title: 'Target audience',
		};
		const result = applyLifecycleTransition(
			patchedState,
			'node-A' as NodeId,
			'ready_for_synthesis',
			{ event: 'SYNTHESIS_PROPOSED', nodeDef },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe(
			'ready_for_synthesis',
		);
	});

	it('ready_for_synthesis → synthesized succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'ready_for_synthesis');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'synthesized',
			{ event: 'SYNTHESIS_PROPOSED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('synthesized');
	});

	it('needs_clarification → active succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'needs_clarification');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_ANSWERED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('any non-final → deferred succeeds (needs_refinement)', () => {
		const state = stateWithNode('node-A' as NodeId, 'needs_refinement');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'deferred',
			{ event: 'USER_DEFER' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('deferred');
	});

	it('any non-final → blocked succeeds (active)', () => {
		const state = stateWithNode('node-A' as NodeId, 'active');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'blocked',
			{ event: 'NODE_BLOCKED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('blocked');
	});

	it('synthesized → active succeeds (reopen/edit)', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_REOPEN' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Invalid transitions — must be rejected with descriptive errors
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — invalid transitions', () => {
	it('not_started → accepted fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('needs_clarification → accepted fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'needs_clarification');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('needs_refinement → accepted fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'needs_refinement');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('blocked → accepted fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('accepted → synthesized fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'accepted');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'synthesized',
			{ event: 'SYNTHESIS_PROPOSED' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('accepted → deferred fails (accepted is final)', () => {
		const state = stateWithNode('node-A' as NodeId, 'accepted');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'deferred',
			{ event: 'USER_DEFER' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('accepted → blocked fails (accepted is final)', () => {
		const state = stateWithNode('node-A' as NodeId, 'accepted');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'blocked',
			{ event: 'NODE_BLOCKED' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('not_started → ready_for_synthesis fails (skipping intermediate states)', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'ready_for_synthesis',
			{ event: 'SYNTHESIS_PROPOSED' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});

	it('active → accepted fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'active');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});

	it('self-transitions are invalid (e.g., active → active)', () => {
		const state = stateWithNode('node-A' as NodeId, 'active');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_ANSWER_EVALUATED' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('is not allowed');
	});

	it('synthesized → export is not a lifecycle (verified via not_started fallback)', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'not_started',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Event guard — wrong event must be rejected
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — event guard', () => {
	it('missing event is rejected', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		// Call with no 4th argument — options is undefined.
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('requires an event');
		expect(result.diagnostics[0]?.code).toBe(
			'LOGOS_STATE_MISSING_TRANSITION_EVENT',
		);
	});

	it('synthesized → accepted with NODE_READY_FOR_ACCEPTANCE fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'NODE_READY_FOR_ACCEPTANCE' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('cannot be triggered by event');
	});

	it('synthesized → accepted with USER_REOPEN fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_REOPEN' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('cannot be triggered by event');
	});

	it('synthesized → accepted with USER_ACCEPT succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('accepted');
	});

	it('accepted → active with wrong event fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'accepted');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});

	it('accepted → active with USER_REOPEN succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'accepted');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_REOPEN' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('deferred → active with correct event succeeds', () => {
		const state = stateWithNode('node-A' as NodeId, 'deferred');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_RESUME' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
	});

	it('deferred → active with wrong event fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'deferred');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_DEFER' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});

	it('blocked → active with wrong event fails', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: [],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'USER_RESUME' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Dependency guard — blocked → active/not_started requires resolved blockers
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — dependency guard', () => {
	it('blocked → active fails when blockedBy is non-empty', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: ['node-B'],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'DEPENDENCY_RESOLVED' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('unresolved blockers');
		expect(result.diagnostics[0]?.code).toBe('LOGOS_STATE_UNRESOLVED_BLOCKERS');
	});

	it('blocked → not_started fails when blockedBy is non-empty', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: ['node-B', 'node-C'],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'not_started',
			{ event: 'DEPENDENCY_RESOLVED' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('unresolved blockers');
	});

	it('blocked → active succeeds when blockedBy is empty', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: [],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'DEPENDENCY_RESOLVED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('blocked → deferred succeeds even with non-empty blockedBy', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: ['node-B'],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'deferred',
			{ event: 'USER_DEFER' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('deferred');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Transition effects — state updates
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — effects', () => {
	it('updates node.lifecycle to the new lifecycle', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
	});

	it('updates node.updatedAt to a fresh timestamp', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(
			new Date(result.state.nodeStates['node-A']?.updatedAt).getTime(),
		).toBeGreaterThanOrEqual(
			new Date(state.nodeStates['node-A']?.updatedAt).getTime(),
		);
	});

	it('updates state.updatedAt to a fresh timestamp', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(new Date(result.state.updatedAt).getTime()).toBeGreaterThanOrEqual(
			new Date(state.updatedAt).getTime(),
		);
	});

	it('recomputes promptState based on new lifecycle', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		// not_started → initial, active → follow_up
		expect(result.state.nodeStates['node-A']?.promptState).toBe('follow_up');
	});

	it('recomputes allowedActions for the new lifecycle', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		// accepted → [continue_next, reopen, open_document_preview]
		expect(result.state.nodeStates['node-A']?.allowedActions).toContain(
			'continue_next',
		);
		expect(result.state.nodeStates['node-A']?.allowedActions).not.toContain(
			'accept',
		);
	});

	it('not_started → active sets active-specific allowedActions', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.allowedActions).toEqual([
			'answer',
			'defer',
			'mark_as_assumption',
			'mark_as_decision',
		]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Nonexistent node — error
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — nonexistent node', () => {
	it('returns error when node does not exist in state', () => {
		const initial = createSession();
		const result = applyLifecycleTransition(
			initial,
			'nonexistent' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('non-existent node');
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe(
			'LOGOS_STATE_CANNOT_APPLY_LIFECYCLE_TRANSITION_TO_NON_EXISTENT_NODE',
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Immutability — input state is never mutated
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — immutability', () => {
	it('does not mutate input state on success', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const original = cloneState(state);

		applyLifecycleTransition(state, 'node-A' as NodeId, 'active', {
			event: 'ASKED_INITIAL',
		});

		expect(state).toEqual(original);
	});

	it('does not mutate input state on error', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const original = cloneState(state);

		applyLifecycleTransition(state, 'node-A' as NodeId, 'accepted', {
			event: 'USER_ACCEPT',
		});

		expect(state).toEqual(original);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — edge cases', () => {
	it('preserves other node states when transitioning one node', () => {
		const sessionId = generateId() as SessionId;
		const state: LogosRuntimeState = {
			activeNodeId: 'node-A' as NodeId,
			documentStates: {},
			exportState: { artifacts: [] },
			globalContext: {
				preferences: {},
				projectName: null,
				summary: null,
			},
			lastActiveNodeId: null,
			mode: 'node_focus',
			nodeStates: {
				'node-A': makeNodeState('node-A' as NodeId, 'not_started'),
				'node-B': makeNodeState('node-B' as NodeId, 'accepted'),
			},
			selectedProfileId: null,
			sessionId,
			updatedAt: nowIso(),
		};

		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		// node-A transitioned
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('active');
		// node-B untouched
		expect(result.state.nodeStates['node-B']?.lifecycle).toBe('accepted');
		expect(result.state.nodeStates['node-B']).toEqual(
			state.nodeStates['node-B'],
		);
	});

	it('needs_refinement → blocked succeeds (any non-final → blocked)', () => {
		const state = stateWithNode('node-A' as NodeId, 'needs_refinement');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'blocked',
			{ event: 'NODE_BLOCKED' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
		expect(result.state.nodeStates['node-A']?.lifecycle).toBe('blocked');
	});

	it('all valid transitions from the spec are accepted (spot check)', () => {
		expect(isValidTransition('not_started', 'active')).toBe(true);
		expect(isValidTransition('active', 'answered')).toBe(true);
		expect(isValidTransition('active', 'needs_clarification')).toBe(true);
		expect(isValidTransition('active', 'needs_refinement')).toBe(true);
		expect(isValidTransition('active', 'ready_for_synthesis')).toBe(true);
		expect(isValidTransition('answered', 'needs_clarification')).toBe(true);
		expect(isValidTransition('answered', 'needs_refinement')).toBe(true);
		expect(isValidTransition('answered', 'ready_for_synthesis')).toBe(true);
		expect(isValidTransition('needs_clarification', 'active')).toBe(true);
		expect(isValidTransition('needs_refinement', 'active')).toBe(true);
		expect(isValidTransition('needs_refinement', 'ready_for_synthesis')).toBe(
			true,
		);
		expect(isValidTransition('ready_for_synthesis', 'synthesized')).toBe(true);
		expect(isValidTransition('synthesized', 'accepted')).toBe(true);
		expect(isValidTransition('synthesized', 'active')).toBe(true);
		expect(isValidTransition('accepted', 'active')).toBe(true);
		expect(isValidTransition('deferred', 'active')).toBe(true);
		expect(isValidTransition('blocked', 'active')).toBe(true);
		expect(isValidTransition('blocked', 'not_started')).toBe(true);
	});

	it('all invalid transitions from the spec are rejected (spot check)', () => {
		expect(isValidTransition('not_started', 'accepted')).toBe(false);
		expect(isValidTransition('needs_clarification', 'accepted')).toBe(false);
		expect(isValidTransition('needs_refinement', 'accepted')).toBe(false);
		expect(isValidTransition('blocked', 'accepted')).toBe(false);
		expect(isValidTransition('accepted', 'synthesized')).toBe(false);
		expect(isValidTransition('accepted', 'deferred')).toBe(false);
		expect(isValidTransition('not_started', 'synthesized')).toBe(false);
	});

	it('self-transitions are all invalid (no identity no-ops)', () => {
		for (const lifecycle of ALL_LIFECYCLES) {
			expect(isValidTransition(lifecycle, lifecycle)).toBe(false);
		}
	});
});
