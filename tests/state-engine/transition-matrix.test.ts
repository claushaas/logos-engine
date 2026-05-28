/**
 * Step 15.1 — Transition matrix tests
 *
 * Comprehensive test suite that validates every lifecycle transition
 * combination (10 × 10 = 100) against the canonical state machine.
 *
 * Uses a table-driven approach for maintainability: the expected
 * matrix is defined once as data and iterated over with vitest's
 * `it.each`.
 *
 * All tests run without LLM credentials — pure state engine.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §6-7}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §5}
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
	allLifecycles,
	applyLifecycleTransition,
	isValidTransition,
	type LifecycleTransitionEvent,
} from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Sanity checks — allLifecycles()
// ═══════════════════════════════════════════════════════════════════════════

describe('allLifecycles()', () => {
	it('returns exactly 10 states', () => {
		expect(allLifecycles()).toHaveLength(10);
	});

	it('contains all documented lifecycle states', () => {
		const states = allLifecycles();
		expect(states).toContain('not_started');
		expect(states).toContain('active');
		expect(states).toContain('answered');
		expect(states).toContain('needs_clarification');
		expect(states).toContain('needs_refinement');
		expect(states).toContain('ready_for_synthesis');
		expect(states).toContain('synthesized');
		expect(states).toContain('accepted');
		expect(states).toContain('deferred');
		expect(states).toContain('blocked');
	});

	it('has no duplicate states', () => {
		const states = allLifecycles();
		expect(new Set(states).size).toBe(states.length);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Expected transition matrix
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The canonical expected transition matrix — the single source of truth
 * for this test file.
 *
 * Each key is a `from` lifecycle; the value lists every `to` lifecycle
 * that should be valid. Self-transitions are never valid (none are listed).
 *
 * Derived from `docs/04-node-lifecycle-and-question-state.md` §6-7 and
 * `docs/13-prototypes.md` §1.2. Must match `LIFECYCLE_TRANSITION_MATRIX`
 * in `src/state-engine/node-lifecycle.ts`.
 */
const EXPECTED_VALID_TARGETS: Readonly<
	Record<NodeLifecycle, readonly NodeLifecycle[]>
> = {
	accepted: ['active'],
	active: [
		'answered',
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	],
	answered: [
		'needs_clarification',
		'needs_refinement',
		'ready_for_synthesis',
		'deferred',
		'blocked',
	],
	blocked: ['active', 'not_started', 'deferred'],
	deferred: ['active', 'blocked'],
	needs_clarification: ['active', 'deferred', 'blocked'],
	needs_refinement: ['active', 'ready_for_synthesis', 'deferred', 'blocked'],
	not_started: ['active', 'deferred', 'blocked'],
	ready_for_synthesis: ['synthesized', 'deferred', 'blocked'],
	synthesized: ['accepted', 'active', 'deferred', 'blocked'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Build 100 test cases
// ═══════════════════════════════════════════════════════════════════════════

interface MatrixCase {
	readonly from: NodeLifecycle;
	readonly to: NodeLifecycle;
	readonly valid: boolean;
}

const VALID_SET: ReadonlyMap<
	NodeLifecycle,
	ReadonlySet<NodeLifecycle>
> = new Map(
	Object.entries(EXPECTED_VALID_TARGETS).map(([from, targets]) => [
		from as NodeLifecycle,
		new Set(targets),
	]),
);

const MATRIX_CASES: readonly MatrixCase[] = (() => {
	const cases: MatrixCase[] = [];
	for (const from of allLifecycles()) {
		for (const to of allLifecycles()) {
			cases.push({ from, to, valid: VALID_SET.get(from)!.has(to) });
		}
	}
	return cases;
})();

// ═══════════════════════════════════════════════════════════════════════════
// 100-combination exhaustive test
// ═══════════════════════════════════════════════════════════════════════════

describe('transition matrix — 100 combinations', () => {
	it('has exactly 100 matrix cases (10 × 10)', () => {
		expect(MATRIX_CASES).toHaveLength(100);
	});

	it.each(MATRIX_CASES)('$from → $to is $valid', ({ from, to, valid }) => {
		expect(isValidTransition(from, to)).toBe(valid);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// §7 Invalid transitions — explicit tests
// ═══════════════════════════════════════════════════════════════════════════

const INVALID_TRANSITIONS: readonly {
	readonly from: NodeLifecycle;
	readonly to: NodeLifecycle;
	readonly reason: string;
}[] = [
	{
		from: 'not_started',
		reason: 'cannot jump from initial to final without conversation',
		to: 'accepted',
	},
	{
		from: 'needs_clarification',
		reason: 'ambiguous answers must be clarified before acceptance',
		to: 'accepted',
	},
	{
		from: 'needs_refinement',
		reason: 'weak answers must be refined before acceptance',
		to: 'accepted',
	},
	{
		from: 'blocked',
		reason: 'blocked nodes have unresolved dependencies',
		to: 'accepted',
	},
	{
		from: 'accepted',
		reason: 'cannot revert to synthesized without reopening first',
		to: 'synthesized',
	},
	{
		from: 'not_started',
		reason: 'cannot skip all intermediate states',
		to: 'synthesized',
	},
	{
		from: 'active',
		reason: 'must go through answered/synthesis before acceptance',
		to: 'accepted',
	},
	{
		from: 'answered',
		reason: 'must be synthesized before acceptance',
		to: 'accepted',
	},
	{
		from: 'ready_for_synthesis',
		reason: 'must be synthesized first',
		to: 'accepted',
	},
	{
		from: 'deferred',
		reason: 'deferred nodes must be resumed first',
		to: 'accepted',
	},
	{
		from: 'accepted',
		reason: 'accepted is a final state; cannot defer accepted',
		to: 'deferred',
	},
	{
		from: 'accepted',
		reason: 'accepted is a final state; cannot block accepted',
		to: 'blocked',
	},
];

describe('§7 invalid transitions', () => {
	it.each(INVALID_TRANSITIONS)('$from → $to is rejected ($reason)', ({
		from,
		to,
	}) => {
		expect(isValidTransition(from, to)).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Self-transitions are never valid
// ═══════════════════════════════════════════════════════════════════════════

describe('self-transitions', () => {
	it.each(
		allLifecycles(),
	)('%s → %s is invalid (no identity no-ops)', (lifecycle) => {
		expect(isValidTransition(lifecycle, lifecycle)).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Valid transition count
// ═══════════════════════════════════════════════════════════════════════════

describe('valid transition counts', () => {
	it(`has ${MATRIX_CASES.filter((c) => c.valid).length} valid transitions out of 100`, () => {
		const validCount = MATRIX_CASES.filter((c) => c.valid).length;
		// This is a documentation check — if the matrix changes, the count
		// changes and the test author must decide whether the change is intentional.
		// Count: accepted(1) + active(6) + answered(5) + blocked(3) + deferred(2)
		//   + needs_clarification(3) + needs_refinement(4) + not_started(3)
		//   + ready_for_synthesis(3) + synthesized(4) = 34
		expect(validCount).toBe(34);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers for edge case tests
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases — applyLifecycleTransition
// ═══════════════════════════════════════════════════════════════════════════

describe('edge case: blocked → not_started (dependency resolved)', () => {
	it('succeeds when blockedBy is empty', () => {
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

	it('fails when blockedBy is non-empty', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: ['node-B'],
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

	it('fails with wrong event', () => {
		const state = stateWithNode('node-A' as NodeId, 'blocked', {
			blockedBy: [],
		});
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'not_started',
			{ event: 'USER_RESUME' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});
});

describe('edge case: deferred → active (resume)', () => {
	it('succeeds with USER_RESUME event', () => {
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

	it('fails with wrong event', () => {
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
});

describe('edge case: synthesized → accepted', () => {
	it('is valid per the transition matrix', () => {
		expect(isValidTransition('synthesized', 'accepted')).toBe(true);
	});

	it('succeeds with USER_ACCEPT event only', () => {
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

	it('fails with NODE_READY_FOR_ACCEPTANCE event (wrong event)', () => {
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

	it('fails with USER_REOPEN event (wrong event)', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_REOPEN' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});

	it('fails with USER_DEFER event (wrong event for acceptance)', () => {
		const state = stateWithNode('node-A' as NodeId, 'synthesized');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'accepted',
			{ event: 'USER_DEFER' },
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge case: accepted → active (reopen)
// ═══════════════════════════════════════════════════════════════════════════

describe('edge case: accepted → active (reopen)', () => {
	it('is valid per the transition matrix', () => {
		expect(isValidTransition('accepted', 'active')).toBe(true);
	});

	it('succeeds with USER_REOPEN event', () => {
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
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge case: not_started → active with ASKED_INITIAL
// ═══════════════════════════════════════════════════════════════════════════

describe('edge case: not_started → active', () => {
	it('is valid per the transition matrix', () => {
		expect(isValidTransition('not_started', 'active')).toBe(true);
	});

	it('succeeds with ASKED_INITIAL event', () => {
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
});

// ═══════════════════════════════════════════════════════════════════════════
// All documented valid transitions pass
// ═══════════════════════════════════════════════════════════════════════════

interface DocumentedTransition {
	readonly from: NodeLifecycle;
	readonly to: NodeLifecycle;
	readonly event: LifecycleTransitionEvent;
	/**
	 * Whether this transition requires a node definition for the
	 * completeness guard (transitions to `ready_for_synthesis`).
	 */
	readonly needsNodeDef?: boolean;
}

const DOCUMENTED_VALID_TRANSITIONS: readonly DocumentedTransition[] = [
	{ event: 'ASKED_INITIAL', from: 'not_started', to: 'active' },
	{ event: 'USER_ANSWER_EVALUATED', from: 'active', to: 'answered' },
	{
		event: 'CLARIFICATION_REQUESTED',
		from: 'active',
		to: 'needs_clarification',
	},
	{ event: 'REFINEMENT_REQUESTED', from: 'active', to: 'needs_refinement' },
	{
		event: 'AUTO_EVALUATE',
		from: 'active',
		needsNodeDef: true,
		to: 'ready_for_synthesis',
	},
	{ event: 'USER_DEFER', from: 'active', to: 'deferred' },
	{ event: 'NODE_BLOCKED', from: 'active', to: 'blocked' },
	{
		event: 'CLARIFICATION_REQUESTED',
		from: 'answered',
		to: 'needs_clarification',
	},
	{ event: 'REFINEMENT_REQUESTED', from: 'answered', to: 'needs_refinement' },
	{
		event: 'SYNTHESIS_PROPOSED',
		from: 'answered',
		needsNodeDef: true,
		to: 'ready_for_synthesis',
	},
	{ event: 'USER_DEFER', from: 'answered', to: 'deferred' },
	{ event: 'NODE_BLOCKED', from: 'answered', to: 'blocked' },
	{ event: 'USER_ANSWERED', from: 'needs_clarification', to: 'active' },
	{ event: 'USER_DEFER', from: 'needs_clarification', to: 'deferred' },
	{ event: 'NODE_BLOCKED', from: 'needs_clarification', to: 'blocked' },
	{ event: 'USER_ANSWERED', from: 'needs_refinement', to: 'active' },
	{
		event: 'AUTO_EVALUATE',
		from: 'needs_refinement',
		needsNodeDef: true,
		to: 'ready_for_synthesis',
	},
	{ event: 'USER_DEFER', from: 'needs_refinement', to: 'deferred' },
	{ event: 'NODE_BLOCKED', from: 'needs_refinement', to: 'blocked' },
	{
		event: 'SYNTHESIS_PROPOSED',
		from: 'ready_for_synthesis',
		to: 'synthesized',
	},
	{ event: 'USER_DEFER', from: 'ready_for_synthesis', to: 'deferred' },
	{ event: 'NODE_BLOCKED', from: 'ready_for_synthesis', to: 'blocked' },
	{ event: 'USER_ACCEPT', from: 'synthesized', to: 'accepted' },
	{ event: 'USER_REOPEN', from: 'synthesized', to: 'active' },
	{ event: 'USER_DEFER', from: 'synthesized', to: 'deferred' },
	{ event: 'NODE_BLOCKED', from: 'synthesized', to: 'blocked' },
	{ event: 'USER_REOPEN', from: 'accepted', to: 'active' },
	{ event: 'USER_RESUME', from: 'deferred', to: 'active' },
	{ event: 'NODE_BLOCKED', from: 'deferred', to: 'blocked' },
	{ event: 'DEPENDENCY_RESOLVED', from: 'blocked', to: 'active' },
	{ event: 'DEPENDENCY_RESOLVED', from: 'blocked', to: 'not_started' },
	{ event: 'USER_DEFER', from: 'blocked', to: 'deferred' },
];

describe('all documented valid transitions pass with correct events', () => {
	it.each(DOCUMENTED_VALID_TRANSITIONS)('$from → $to with $event succeeds', ({
		from,
		to,
		event,
		needsNodeDef,
	}) => {
		// Prepare state with resolved dependencies for blocked transitions
		const deps = from === 'blocked' ? { blockedBy: [] } : undefined;
		let state = stateWithNode('node-A' as NodeId, from, deps);

		const extraOpts: { nodeDef?: NodeDefinition } = {};
		if (needsNodeDef) {
			// The completeness guard (Step 3.6) requires a node definition
			// and a conversation that satisfies coverage topics.
			const nodeDef: NodeDefinition = {
				canonicalQuestion: 'What is the core thesis?',
				coverageTopics: ['Core thesis'],
				documentId: 'doc-1' as NodeId,
				id: 'node-A' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Specific thesis'],
				title: 'Core Thesis',
			};
			const existingNode = state.nodeStates['node-A'];
			state = {
				...state,
				nodeStates: {
					...state.nodeStates,
					'node-A': existingNode
						? {
								...existingNode,
								conversation: [
									{
										content:
											'Our core thesis: hiring is broken because it filters on credentials, not competence.',
										createdAt: nowIso(),
										id: 'msg-1',
										role: 'user' as const,
									},
								],
							}
						: undefined,
				},
			};
			extraOpts.nodeDef = nodeDef;
		}

		const result = applyLifecycleTransition(state, 'node-A' as NodeId, to, {
			event,
			...extraOpts,
		});
		expect(result.ok).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Transition effect: lifecycle is updated
// ═══════════════════════════════════════════════════════════════════════════

describe('transition effects', () => {
	it('updates the node lifecycle to the target state', () => {
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

	it('recomputes promptState for the new lifecycle', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const result = applyLifecycleTransition(
			state,
			'node-A' as NodeId,
			'active',
			{ event: 'ASKED_INITIAL' },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');
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
		expect(result.state.nodeStates['node-A']?.allowedActions).toContain(
			'continue_next',
		);
	});

	it('does not mutate input state on success', () => {
		const state = stateWithNode('node-A' as NodeId, 'not_started');
		const original = JSON.parse(JSON.stringify(state));
		applyLifecycleTransition(state, 'node-A' as NodeId, 'active', {
			event: 'ASKED_INITIAL',
		});
		expect(state).toEqual(original);
	});
});
