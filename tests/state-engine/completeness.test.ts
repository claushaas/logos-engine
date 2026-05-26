/**
 * Tests for Step 3.6 — completeness evaluation.
 *
 * Covers:
 *  - `evaluateCompleteness`: topic coverage evaluation, specificity
 *    heuristics, contradiction detection, overall `complete` flag.
 *  - Completeness guard in `applyLifecycleTransition`: blocks
 *    `answered → ready_for_synthesis` when incomplete, allows it
 *    when complete.
 *  - Acceptance criteria:
 *    - Empty conversation → all topics `"missing"`, `complete: false`.
 *    - Conversation covers all topics with specific content → all
 *      topics `"sufficient"`, `complete: true`.
 *    - Missing one topic → `complete: false` with topic listed in
 *      `missing`.
 *    - Contradiction → `blockingIssues` populated.
 *    - `answered → ready_for_synthesis` blocked when incomplete.
 *  - Edge cases: empty coverageTopics, single short message, vague
 *    phrases, no user messages.
 */
import { describe, expect, it } from 'vitest';

import type {
	NodeDefinition,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import {
	applyLifecycleTransition,
	evaluateCompleteness,
} from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal `NodeRuntimeState` with an empty conversation.
 */
function emptyNodeState(nodeId: NodeId): NodeRuntimeState {
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
			blockedBy: [],
			requiredNodeIds: [],
			unlocks: [],
		},
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'answered',
		nodeId,
		promptState: 'follow_up',
		updatedAt: nowIso(),
	};
}

/**
 * Build a `NodeRuntimeState` with the given lifecycle and user messages.
 *
 * Each message is created with a simple incrementing ID.
 */
function nodeStateWithMessages(
	nodeId: NodeId,
	lifecycle: 'answered' | 'active' | 'needs_clarification' | 'needs_refinement',
	messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): NodeRuntimeState {
	return {
		...emptyNodeState(nodeId),
		conversation: messages.map((m, i) => ({
			content: m.content,
			createdAt: nowIso(),
			id: `msg-${i + 1}`,
			role: m.role,
		})),
		lifecycle,
		promptState:
			lifecycle === 'needs_clarification'
				? 'clarification'
				: lifecycle === 'needs_refinement'
					? 'refinement'
					: 'follow_up',
	};
}

/**
 * Minimal `NodeDefinition` for testing.
 */
function testNodeDef(overrides?: Partial<NodeDefinition>): NodeDefinition {
	return {
		canonicalQuestion: 'What is your product?',
		coverageTopics: overrides?.coverageTopics ?? [
			'Target audience',
			'Core value proposition',
			'Competitive differentiation',
		],
		documentId: 'doc-1' as DocumentId,
		id: 'node-1' as NodeId,
		order: 1,
		phaseId: 'phase-1',
		promptRefs: {},
		sufficiencyCriteria: overrides?.sufficiencyCriteria ?? [
			'Audience is specific and measurable',
			'Value prop is concrete and falsifiable',
		],
		title: 'Product definition',
	};
}

/**
 * Helper to create a minimal `LogosRuntimeState` suitable for
 * `applyLifecycleTransition` tests.
 */
function minimalRuntimeState(nodeId: NodeId, nodeState: NodeRuntimeState) {
	return {
		activeNodeId: nodeId,
		documentStates: {} as Record<string, unknown>,
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'node_focus' as const,
		nodeStates: { [nodeId]: nodeState },
		selectedProfileId: 'test-profile' as NodeId,
		sessionId: 'test-session' as NodeId,
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// evaluateCompleteness — acceptance criteria
// ═══════════════════════════════════════════════════════════════════════════

describe('evaluateCompleteness — acceptance criteria', () => {
	it('empty conversation → all topics "missing", complete: false', () => {
		const state = emptyNodeState('node-1' as NodeId);
		const nodeDef = testNodeDef();

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.complete).toBe(false);
		expect(result.missing).toEqual(nodeDef.coverageTopics);
		expect(result.weak).toEqual([]);
		expect(result.blockingIssues).toEqual([]);
		for (const topic of nodeDef.coverageTopics) {
			expect(result.coverage[topic]).toBe('missing');
		}
	});

	it('complete coverage → complete: true', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'Our target audience is early-stage SaaS founders with 2-10 employees who have raised seed funding. They are technical but time-constrained.',
				role: 'user',
			},
			{
				content: 'Got it, that is a specific audience.',
				role: 'assistant',
			},
			{
				content:
					'The core value proposition is reducing time-to-documentation by 80% for seed-stage startups. Instead of spending weeks writing docs, founders converse with an agent and get a complete document in hours.',
				role: 'user',
			},
			{
				content: 'Strong value prop.',
				role: 'assistant',
			},
			{
				content:
					'Our competitive differentiation is that unlike Notion or Confluence which are blank-canvas tools, our product actively guides the documentation process through structured conversations. For example, when a user selects a new node, the agent asks a targeted question based on the node coverage topics. This results in 3x faster completion compared to self-directed documentation in tools like Notion.',
				role: 'user',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.complete).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.weak).toEqual([]);
		expect(result.blockingIssues).toEqual([]);
		for (const topic of nodeDef.coverageTopics) {
			expect(result.coverage[topic]).toBe('sufficient');
		}
	});

	it('missing one topic → complete: false with topic in missing', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'Our target audience is early-stage SaaS founders with 2-10 employees.',
				role: 'user',
			},
			{
				content: 'Core value proposition: 80% faster documentation.',
				role: 'user',
			},
			// No message addressing "Competitive differentiation" — it remains missing.
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.complete).toBe(false);
		expect(result.missing).toContain('Competitive differentiation');
		expect(result.coverage['Competitive differentiation']).toBe('missing');
	});

	it('contradiction → blockingIssues populated', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'The core value proposition is that the documentation process is always manual and requires human oversight at every step.',
				role: 'user',
			},
			{
				content: 'Understood.',
				role: 'assistant',
			},
			{
				content:
					'Actually, the documentation process should never require manual oversight — it is fully automated.',
				role: 'user',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.blockingIssues.length).toBeGreaterThan(0);
		expect(result.complete).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// evaluateCompleteness — specificity heuristics
// ═══════════════════════════════════════════════════════════════════════════

describe('evaluateCompleteness — specificity heuristics', () => {
	it('short vague message → topic is "weak"', () => {
		const nodeDef = testNodeDef({
			coverageTopics: ['Target audience'],
		});
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content: 'Our target audience is everyone.', // very short & generic
				role: 'user',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.coverage['Target audience']).toBe('weak');
		expect(result.weak).toContain('Target audience');
		expect(result.complete).toBe(false);
	});

	it('vague phrase → topic is "weak"', () => {
		const nodeDef = testNodeDef({
			coverageTopics: ['Core value proposition'],
		});
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'The core value proposition is a game changer. It is an innovative solution that will be great for everyone.',
				role: 'user',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.coverage['Core value proposition']).toBe('weak');
	});

	it('specific content → topic is "sufficient"', () => {
		const nodeDef = testNodeDef({
			coverageTopics: ['Core value proposition'],
		});
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'Core value proposition: Our product reduces QA cycle time from 4 hours to 15 minutes because it automates test case generation. Specifically, we use ML to infer expected behavior from production traffic patterns, which eliminates manual test writing. We validated this through a pilot with 3 mid-size companies where QA engineers reported a 73% reduction in time spent writing tests.',
				role: 'user',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.coverage['Core value proposition']).toBe('sufficient');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// evaluateCompleteness — edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('evaluateCompleteness — edge cases', () => {
	it('empty coverageTopics → complete: false (no quality target)', () => {
		const nodeDef = testNodeDef({ coverageTopics: [] });
		const state = emptyNodeState('node-1' as NodeId);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.complete).toBe(false); // no topics → no quality target to meet
		expect(result.missing).toEqual([]);
		expect(result.weak).toEqual([]);
	});

	it('only assistant messages → all topics "missing"', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'active', [
			{
				content: 'What is your target audience?',
				role: 'assistant',
			},
			{
				content: 'Can you describe your core value proposition?',
				role: 'assistant',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);

		expect(result.complete).toBe(false);
		for (const topic of nodeDef.coverageTopics) {
			expect(result.coverage[topic]).toBe('missing');
		}
	});

	it('no contradictions with single user message', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content: 'It is always required and never optional.',
				role: 'user',
			},
		]);

		const result = evaluateCompleteness(state, nodeDef);
		expect(result.blockingIssues).toEqual([]);
	});

	it('deterministic — repeated calls produce identical results', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'Target audience: SaaS founders. Core value proposition: faster docs. Competitive differentiation: conversational approach.',
				role: 'user',
			},
		]);

		const r1 = evaluateCompleteness(state, nodeDef);
		const r2 = evaluateCompleteness(state, nodeDef);

		expect(r1).toEqual(r2);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Completeness guard in applyLifecycleTransition
// ═══════════════════════════════════════════════════════════════════════════

describe('applyLifecycleTransition — completeness guard', () => {
	it('answered → ready_for_synthesis blocked when incomplete', () => {
		const nodeDef = testNodeDef();
		const nodeState = emptyNodeState('node-1' as NodeId);
		const runtimeState = minimalRuntimeState('node-1' as NodeId, {
			...nodeState,
			lifecycle: 'answered',
		});

		const result = applyLifecycleTransition(
			runtimeState,
			'node-1' as NodeId,
			'ready_for_synthesis',
			{
				event: 'SYNTHESIS_PROPOSED',
				nodeDef,
			},
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('not complete');
		}
	});

	it('answered → ready_for_synthesis allowed when complete', () => {
		const nodeDef = testNodeDef();
		const state = nodeStateWithMessages('node-1' as NodeId, 'answered', [
			{
				content:
					'Target audience: early-stage SaaS founders with 2-10 employees who have raised seed funding. Core value proposition: reduces documentation time by 80% through conversational automation. Competitive differentiation: unlike Notion which is a blank canvas, we guide the documentation process.',
				role: 'user',
			},
		]);
		const runtimeState = minimalRuntimeState('node-1' as NodeId, state);

		const result = applyLifecycleTransition(
			runtimeState,
			'node-1' as NodeId,
			'ready_for_synthesis',
			{
				event: 'SYNTHESIS_PROPOSED',
				nodeDef,
			},
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.state.nodeStates['node-1']?.lifecycle).toBe(
				'ready_for_synthesis',
			);
			// Completeness evaluation should be stored on the node.
			expect(result.state.nodeStates['node-1']?.completeness.complete).toBe(
				true,
			);
		}
	});

	it('ready_for_synthesis transition without nodeDef → fails (guard not bypassable)', () => {
		const nodeState = emptyNodeState('node-1' as NodeId);
		const runtimeState = minimalRuntimeState('node-1' as NodeId, {
			...nodeState,
			lifecycle: 'answered',
		});

		const result = applyLifecycleTransition(
			runtimeState,
			'node-1' as NodeId,
			'ready_for_synthesis',
			{ event: 'SYNTHESIS_PROPOSED' },
		);

		// Without nodeDef the completeness guard cannot evaluate —
		// the transition MUST be rejected.
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('node definition is required');
		}
	});

	it('answered → needs_clarification (not ready_for_synthesis) → completeness guard not applied', () => {
		const nodeDef = testNodeDef();
		const nodeState = emptyNodeState('node-1' as NodeId);
		const runtimeState = minimalRuntimeState('node-1' as NodeId, {
			...nodeState,
			lifecycle: 'answered',
		});

		const result = applyLifecycleTransition(
			runtimeState,
			'node-1' as NodeId,
			'needs_clarification',
			{
				event: 'CLARIFICATION_REQUESTED',
				nodeDef,
			},
		);

		// The completeness guard only applies to `ready_for_synthesis`.
		expect(result.ok).toBe(true);
	});
});
