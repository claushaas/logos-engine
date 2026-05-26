/**
 * Tests for Step 3.7 — document readiness computation.
 *
 * Covers:
 *  - `computeDocumentReadiness`: status evaluation, missingRequiredNodeIds
 *    population, staleSourceNodeIds population.
 *  - `recomputeAllDocumentReadiness`: recomputes all documents in the profile.
 *  - `applyLifecycleTransition` with `profile` option: automatic
 *    recomputation after accept/reopen transitions.
 *  - Acceptance criteria:
 *    - Document with all required nodes accepted → `ready`.
 *    - Document with one accepted, one missing → `partially_ready`,
 *      correct `missingRequiredNodeIds`.
 *    - Document with no accepted nodes → `not_ready`.
 *    - Document with stale source → `stale`, correct
 *      `staleSourceNodeIds`.
 *    - Readiness recomputes automatically after accept event.
 *  - Edge cases: document not in profile, empty profile, only optional
 *    nodes accepted, stale takes precedence over partial readiness.
 */
import { describe, expect, it } from 'vitest';

import type {
	DocumentRuntimeState,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import {
	applyLifecycleTransition,
	computeDocumentReadiness,
	recomputeAllDocumentReadiness,
} from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal accepted `NodeRuntimeState` with a non-stale canonical answer.
 */
function acceptedNodeState(
	nodeId: NodeId,
	overrides?: Partial<NodeRuntimeState>,
): NodeRuntimeState {
	return {
		allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
		canonicalAnswer: {
			accepted: true,
			confidence: 'high',
			content: `Answer for ${nodeId}`,
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: ['msg-1', 'msg-2'],
			stale: false,
		},
		completeness: {
			blockingIssues: [],
			complete: true,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'accepted',
		nodeId,
		promptState: 'accepted',
		updatedAt: nowIso(),
		...overrides,
	};
}

/**
 * Minimal active `NodeRuntimeState` (not yet accepted).
 */
function activeNodeState(nodeId: NodeId): NodeRuntimeState {
	return {
		allowedActions: [
			'answer',
			'defer',
			'mark_as_assumption',
			'mark_as_decision',
		],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'active',
		nodeId,
		promptState: 'follow_up',
		updatedAt: nowIso(),
	};
}

/**
 * Minimal stale `NodeRuntimeState` — accepted but with a stale canonical
 * answer.
 */
function staleNodeState(nodeId: NodeId): NodeRuntimeState {
	return acceptedNodeState(nodeId, {
		canonicalAnswer: {
			accepted: true,
			confidence: 'high',
			content: `Answer for ${nodeId}`,
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: ['msg-1'],
			stale: true,
		},
	});
}

/**
 * Minimal `LogosProfile` for testing document readiness.
 */
function testProfile(overrides?: Partial<LogosProfile>): LogosProfile {
	return {
		description: 'Test profile',
		documents: overrides?.documents ?? [
			{
				id: 'test-doc' as DocumentId,
				optionalNodeIds: ['node-c' as NodeId],
				order: 1,
				outputPath: '/tmp/test.md',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
				title: 'Test Document',
			},
		],
		id: 'test-profile' as ProfileId,
		materializationRules: overrides?.materializationRules ?? [],
		nodes: overrides?.nodes ?? [
			{
				canonicalQuestion: 'What is A?',
				coverageTopics: ['Topic A'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node A',
			},
			{
				canonicalQuestion: 'What is B?',
				coverageTopics: ['Topic B'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-b' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node B',
			},
			{
				canonicalQuestion: 'What is C?',
				coverageTopics: ['Topic C'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-c' as NodeId,
				order: 3,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node C',
			},
		],
		phases: [{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' }],
		title: 'Test Profile',
		version: '1.0.0',
		...overrides,
	};
}

/**
 * Create a `LogosRuntimeState` with specific node states wired in.
 */
function stateWithNodes(
	nodes: NodeRuntimeState[],
	documentStates?: Record<DocumentId, DocumentRuntimeState>,
): LogosRuntimeState {
	const nodeStates: Record<NodeId, NodeRuntimeState> = {};
	for (const n of nodes) {
		nodeStates[n.nodeId] = n;
	}

	return {
		activeNodeId: null,
		documentStates: documentStates ?? {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'structure_overview',
		nodeStates,
		selectedProfileId: 'test-profile' as ProfileId,
		sessionId: 'test-session',
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// computeDocumentReadiness
// ═══════════════════════════════════════════════════════════════════════════

describe('computeDocumentReadiness', () => {
	// ── Acceptance criteria ─────────────────────────────────────────────

	it('returns "ready" when all required nodes are accepted and fresh', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('ready');
		expect(result.missingRequiredNodeIds).toEqual([]);
		expect(result.staleSourceNodeIds).toEqual([]);
		expect(result.sourceNodeIds).toContain('node-a' as NodeId);
		expect(result.sourceNodeIds).toContain('node-b' as NodeId);
	});

	it('detects a single accepted node, one missing → "partially_ready"', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			activeNodeState('node-b' as NodeId),
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('partially_ready');
		expect(result.missingRequiredNodeIds).toEqual(['node-b' as NodeId]);
		expect(result.staleSourceNodeIds).toEqual([]);
	});

	it('returns "not_ready" when no source nodes are accepted', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			activeNodeState('node-a' as NodeId),
			activeNodeState('node-b' as NodeId),
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('not_ready');
		expect(result.missingRequiredNodeIds).toEqual([
			'node-a' as NodeId,
			'node-b' as NodeId,
		]);
		expect(result.staleSourceNodeIds).toEqual([]);
	});

	it('returns "stale" when an accepted source node has a stale canonical answer', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			staleNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('stale');
		expect(result.staleSourceNodeIds).toEqual(['node-a' as NodeId]);
		// Stale nodes are still accepted — they should NOT appear in missing.
		expect(result.missingRequiredNodeIds).toEqual([]);
	});

	// ── Edge cases ──────────────────────────────────────────────────────

	it('returns "not_ready" when no node states exist at all', () => {
		const profile = testProfile();
		const state = stateWithNodes([]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('not_ready');
		expect(result.missingRequiredNodeIds).toEqual([
			'node-a' as NodeId,
			'node-b' as NodeId,
		]);
	});

	it('returns "stale" when even one source is stale (stale overrides partial)', () => {
		const profile = testProfile();
		// node-a is stale, node-b is active (not accepted)
		const state = stateWithNodes([
			staleNodeState('node-a' as NodeId),
			activeNodeState('node-b' as NodeId),
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('stale');
		expect(result.staleSourceNodeIds).toEqual(['node-a' as NodeId]);
	});

	it('preserves an existing draft when recomputing', () => {
		const profile = testProfile();
		const existingDraft = {
			content: 'Existing content',
			documentId: 'test-doc' as DocumentId,
			format: 'markdown' as const,
			generatedAt: nowIso(),
			missingSections: [],
			sourceNodeIds: ['node-a' as NodeId],
			stale: false,
		};
		const existingDocState: DocumentRuntimeState = {
			documentId: 'test-doc' as DocumentId,
			draft: existingDraft,
			missingRequiredNodeIds: [],
			optionalNodeIds: [],
			requiredNodeIds: [],
			sourceNodeIds: [],
			staleSourceNodeIds: [],
			status: 'ready',
			updatedAt: nowIso(),
		};
		const state = {
			...stateWithNodes([
				acceptedNodeState('node-a' as NodeId),
				acceptedNodeState('node-b' as NodeId),
			]),
			documentStates: { 'test-doc': existingDocState } as Record<
				DocumentId,
				DocumentRuntimeState
			>,
		};

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('ready');
		expect(result.draft).toEqual(existingDraft);
	});

	it('returns "not_ready" for a document not in the profile', () => {
		const profile = testProfile();
		const state = stateWithNodes([]);

		const result = computeDocumentReadiness(
			'unknown-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.status).toBe('not_ready');
		expect(result.sourceNodeIds).toEqual([]);
		expect(result.requiredNodeIds).toEqual([]);
	});

	it('uses materializationRule metadata when available', () => {
		const profile = testProfile({
			materializationRules: [
				{
					documentId: 'test-doc' as DocumentId,
					optionalNodeIds: ['node-c' as NodeId],
					outputPath: '/tmp/test.md',
					requiredNodeIds: ['node-a' as NodeId],
					sections: [],
					sourceNodeIds: [
						'node-a' as NodeId,
						'node-b' as NodeId,
						'node-c' as NodeId,
					],
					title: 'Rule-driven doc',
				},
			],
		});

		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			activeNodeState('node-b' as NodeId),
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		// Only node-a is required by the rule; node-b accepted but not
		// in the rule's required set, so it doesn't block readiness.
		expect(result.status).toBe('ready');
		expect(result.missingRequiredNodeIds).toEqual([]);
		expect(result.requiredNodeIds).toEqual(['node-a' as NodeId]);
	});

	it('accepts only optional nodes → "partially_ready" with correct missing', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-c' as NodeId), // optional only
		]);

		const result = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		// At least one source node accepted → partially_ready.
		// But neither node-a nor node-b (required) are accepted.
		expect(result.status).toBe('partially_ready');
		expect(result.missingRequiredNodeIds).toEqual([
			'node-a' as NodeId,
			'node-b' as NodeId,
		]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// recomputeAllDocumentReadiness
// ═══════════════════════════════════════════════════════════════════════════

describe('recomputeAllDocumentReadiness', () => {
	it('recomputes readiness for all documents in the profile', () => {
		const profile = testProfile({
			documents: [
				{
					id: 'doc-a' as DocumentId,
					optionalNodeIds: [],
					order: 1,
					outputPath: '/tmp/a.md',
					phaseId: 'phase-1',
					purpose: 'Doc A',
					requiredNodeIds: ['node-a' as NodeId],
					title: 'Document A',
				},
				{
					id: 'doc-b' as DocumentId,
					optionalNodeIds: [],
					order: 2,
					outputPath: '/tmp/b.md',
					phaseId: 'phase-1',
					purpose: 'Doc B',
					requiredNodeIds: ['node-b' as NodeId],
					title: 'Document B',
				},
			],
		});

		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			activeNodeState('node-b' as NodeId),
		]);

		const updated = recomputeAllDocumentReadiness(state, profile);

		expect(updated.documentStates['doc-a' as DocumentId]).toBeDefined();
		expect(updated.documentStates['doc-a' as DocumentId]?.status).toBe('ready');
		expect(updated.documentStates['doc-b' as DocumentId]?.status).toBe(
			'not_ready',
		);
	});

	it('preserves existing state fields (activeNodeId, mode, etc.)', () => {
		const profile = testProfile();
		const state = stateWithNodes([acceptedNodeState('node-a' as NodeId)]);

		const updated = recomputeAllDocumentReadiness(state, profile);

		expect(updated.sessionId).toBe(state.sessionId);
		expect(updated.mode).toBe(state.mode);
		expect(updated.activeNodeId).toBe(state.activeNodeId);
		expect(updated.selectedProfileId).toBe(state.selectedProfileId);
	});

	it('does not mutate the input state', () => {
		const profile = testProfile();
		const state = stateWithNodes([acceptedNodeState('node-a' as NodeId)]);
		const original = JSON.parse(JSON.stringify(state));

		recomputeAllDocumentReadiness(state, profile);

		expect(state).toEqual(original);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Automatic recomputation via applyLifecycleTransition
// ═══════════════════════════════════════════════════════════════════════════

describe('automatic recomputation after lifecycle transitions', () => {
	it('recomputes document readiness after accepting a node', () => {
		const profile = testProfile();

		// Start with node-a in synthesized state and node-b already accepted.
		const synthesizedNodeA: NodeRuntimeState = {
			...acceptedNodeState('node-a' as NodeId),
			canonicalAnswer: {
				accepted: false,
				confidence: 'high',
				content: 'Answer for node-a',
				format: 'markdown',
				generatedAt: nowIso(),
				generatedFromMessageIds: ['msg-1'],
				stale: false,
			},
			lifecycle: 'synthesized',
			promptState: 'review',
		};

		const state = stateWithNodes([
			synthesizedNodeA,
			acceptedNodeState('node-b' as NodeId),
		]);

		// Before accept: node-a is not accepted → document should be partially_ready.
		const before = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);
		expect(before.status).toBe('partially_ready');

		// Accept node-a via applyLifecycleTransition with profile.
		// Lifecycle transition to "accepted" is the Step 3.7 trigger —
		// it does NOT require canonicalAnswer.accepted === true (Step 4.2).
		const result = applyLifecycleTransition(
			state,
			'node-a' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT', profile },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		// After accept with profile: document readiness should be recomputed.
		const afterDoc = result.state.documentStates['test-doc' as DocumentId];
		expect(afterDoc).toBeDefined();
		expect(afterDoc?.status).toBe('ready');
		expect(afterDoc?.missingRequiredNodeIds).toEqual([]);
	});

	it('recomputes document readiness after reopening an accepted node', () => {
		const profile = testProfile();

		// Both nodes accepted → document is ready.
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
			acceptedNodeState('node-b' as NodeId),
		]);

		const before = computeDocumentReadiness(
			'test-doc' as DocumentId,
			state,
			profile,
		);
		expect(before.status).toBe('ready');

		// Reopen node-a (accepted → active).
		const result = applyLifecycleTransition(
			state,
			'node-a' as NodeId,
			'active',
			{ event: 'USER_REOPEN', profile },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		// After reopen: node-a is no longer accepted → partially_ready.
		const afterDoc = result.state.documentStates['test-doc' as DocumentId];
		expect(afterDoc).toBeDefined();
		expect(afterDoc?.status).toBe('partially_ready');
		expect(afterDoc?.missingRequiredNodeIds).toContain('node-a' as NodeId);
	});

	it('does NOT recompute document readiness when profile is not provided', () => {
		const _profile = testProfile();

		// node-a synthesized, node-b accepted. No profile → no recomputation.
		const synthesizedNodeA: NodeRuntimeState = {
			...acceptedNodeState('node-a' as NodeId),
			canonicalAnswer: {
				accepted: false,
				confidence: 'high',
				content: 'Answer for node-a',
				format: 'markdown',
				generatedAt: nowIso(),
				generatedFromMessageIds: ['msg-1'],
				stale: false,
			},
			lifecycle: 'synthesized',
			promptState: 'review',
		};

		const state = stateWithNodes([
			synthesizedNodeA,
			acceptedNodeState('node-b' as NodeId),
		]);

		// Accept without profile.
		const result = applyLifecycleTransition(
			state,
			'node-a' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT' },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		// documentStates should remain unchanged (empty — no recomputation).
		expect(result.state.documentStates).toEqual({});
	});

	it('accept → reopen → accept cycle keeps document readiness in sync', () => {
		const profile = testProfile();

		// Canonical answer has `accepted: false` — Step 4.2 will set it.
		// Lifecycle acceptance alone is sufficient for Step 3.7 readiness.
		const synthesizedNodeA: NodeRuntimeState = {
			...acceptedNodeState('node-a' as NodeId),
			canonicalAnswer: {
				accepted: false,
				confidence: 'high',
				content: 'Answer for node-a',
				format: 'markdown',
				generatedAt: nowIso(),
				generatedFromMessageIds: ['msg-1'],
				stale: false,
			},
			// Provide sufficient conversation so the completeness guard
			// passes when transitioning back through ready_for_synthesis.
			conversation: [
				{
					content:
						'The target audience is busy parents, specifically 150,000 urban ' +
						'professionals aged 30-45. This topic addresses the core value proposition ' +
						'of delivering 20-minute healthy meals, validated through pilot tests with 85% ' +
						'satisfaction. Differentiation comes from sourcing locally and ' +
						'offering a subscription model with 70% retention.',
					createdAt: nowIso(),
					id: 'msg-1',
					role: 'user' as const,
				},
			],
			lifecycle: 'synthesized',
			promptState: 'review',
		};

		let state = stateWithNodes([
			synthesizedNodeA,
			acceptedNodeState('node-b' as NodeId),
		]);

		// Step 1: Accept node-a → ready.
		const r1 = applyLifecycleTransition(state, 'node-a' as NodeId, 'accepted', {
			event: 'USER_ACCEPT',
			profile,
		});
		if (!r1.ok) throw new Error('Expected ok');
		expect(r1.state.documentStates['test-doc' as DocumentId]?.status).toBe(
			'ready',
		);

		state = r1.state;

		// Step 2: Reopen node-a → partially_ready.
		const r2 = applyLifecycleTransition(state, 'node-a' as NodeId, 'active', {
			event: 'USER_REOPEN',
			profile,
		});
		if (!r2.ok) throw new Error('Expected ok');
		expect(r2.state.documentStates['test-doc' as DocumentId]?.status).toBe(
			'partially_ready',
		);

		state = r2.state;

		// Step 3: Re-synthesize node-a → accepted again → ready.
		// The path: active → ready_for_synthesis → synthesized → accepted.
		// Step 3a: active → ready_for_synthesis (requires nodeDef for completeness).
		const r3a = applyLifecycleTransition(
			state,
			'node-a' as NodeId,
			'ready_for_synthesis',
			{ event: 'USER_ANSWER_EVALUATED', nodeDef: profile.nodes[0], profile },
		);
		if (!r3a.ok) throw new Error(`Expected ok, got: ${r3a.error}`);
		expect(r3a.state.documentStates['test-doc' as DocumentId]?.status).toBe(
			'partially_ready',
		);
		state = r3a.state;

		// Step 3b: ready_for_synthesis → synthesized.
		const r3b = applyLifecycleTransition(
			state,
			'node-a' as NodeId,
			'synthesized',
			{ event: 'SYNTHESIS_PROPOSED', profile },
		);
		if (!r3b.ok) throw new Error(`Expected ok, got: ${r3b.error}`);
		expect(r3b.state.documentStates['test-doc' as DocumentId]?.status).toBe(
			'partially_ready',
		);
		state = r3b.state;

		// Step 3c: Accept.
		const r3c = applyLifecycleTransition(
			state,
			'node-a' as NodeId,
			'accepted',
			{ event: 'USER_ACCEPT', profile },
		);
		if (!r3c.ok) throw new Error(`Expected ok, got: ${r3c.error}`);
		expect(r3c.state.documentStates['test-doc' as DocumentId]?.status).toBe(
			'ready',
		);
	});
});
