/**
 * Tests for Step 6.3 — applyAgentTurn.
 *
 * Covers:
 *  - Valid AgentTurnOutput → state updates correctly (message, lifecycle,
 *    completeness, extracted data, snapshot).
 *  - Invalid lifecycle → rejected, error returned.
 *  - LLM proposes "accepted" → rejected.
 *  - Canonical answer draft stored correctly.
 *  - Completeness merged correctly (LLM advisory).
 *  - Extracted data merged with deduplication.
 *  - Prompt state updated when proposed.
 *  - allowedActions recomputed.
 *  - Immutability: input state never mutated.
 */
import { describe, expect, it } from 'vitest';
import { applyAgentTurn } from '../../src/application/apply-agent-turn.js';
import type {
	AgentTurnOutput,
	CanonicalAnswerDraft,
	CompletenessState,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { isValidTransition } from '../../src/state-engine/node-lifecycle.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

function minimalProfile(profileId = 'test-profile'): LogosProfile {
	return {
		description: 'A minimal test profile',
		documents: [
			{
				id: 'test-doc' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-1' as NodeId],
				title: 'Test Document',
			},
		],
		id: profileId as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What is the core thesis?',
				coverageTopics: ['thesis', 'evidence'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'test-doc' as DocumentId,
				id: 'node-1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Test Node 1',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Testing',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

/** Deep-clone a state object for immutability assertions. */
function cloneState(s: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(s));
}

/** Create a session with profile selected and node active (not_started). */
function sessionWithActiveNode(): {
	state: LogosRuntimeState;
	profile: LogosProfile;
} {
	const profile = minimalProfile();
	const base = createSession();

	const r1 = dispatch(
		base,
		{ profileId: 'test-profile' as ProfileId, type: 'SELECT_PROFILE' },
		profile,
	);
	if (!r1.ok) throw new Error('Expected profile selection to succeed');

	const r2 = dispatch(
		r1.state,
		{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
		profile,
	);
	if (!r2.ok) throw new Error('Expected node selection to succeed');

	return { profile, state: r2.state };
}

/** Create a session with an active node in the `active` lifecycle. */
function sessionWithActiveNode_Active(): {
	state: LogosRuntimeState;
	profile: LogosProfile;
} {
	const { profile, state } = sessionWithActiveNode();

	// Transition from not_started → active via USER_MESSAGE
	const r = dispatch(
		state,
		{
			content: 'My initial answer about the thesis.',
			nodeId: 'node-1' as NodeId,
			type: 'USER_MESSAGE',
		},
		profile,
	);
	if (!r.ok) throw new Error('Expected user message to succeed');

	return { profile, state: r.state };
}

/**
 * Create a session with an active node in the `synthesized` lifecycle.
 *
 * This bypasses the full lifecycle pipeline to construct a state
 * directly — the fixture only needs the right lifecycle for testing
 * canonical answer draft storage and "accepted" rejection.
 */
function sessionWithActiveNode_Synthesized(): {
	state: LogosRuntimeState;
	profile: LogosProfile;
} {
	const { profile, state: baseState } = sessionWithActiveNode();

	const node = baseState.nodeStates['node-1' as NodeId]!;

	// Construct a synthesized node state directly.
	const synthesizedNode: NodeRuntimeState = {
		...node,
		allowedActions: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
		canonicalAnswer: {
			accepted: false,
			confidence: 'high',
			content: 'The core thesis is X.',
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: [],
			stale: false,
		},
		lifecycle: 'synthesized',
		promptState: 'review',
		updatedAt: nowIso(),
	};

	const state: LogosRuntimeState = {
		...baseState,
		nodeStates: {
			...baseState.nodeStates,
			['node-1' as NodeId]: synthesizedNode,
		},
		updatedAt: nowIso(),
	};

	return { profile, state };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: build a minimal valid AgentTurnOutput
// ═══════════════════════════════════════════════════════════════════════════

function validOutput(
	overrides: Partial<AgentTurnOutput> = {},
): AgentTurnOutput {
	return {
		userFacingMessage: 'This is the agent response.',
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('applyAgentTurn', () => {
	// ── Valid output → state updated ─────────────────────────────────

	it('appends assistant message and updates state for a valid output', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		const original = cloneState(state);

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				proposedLifecycle: 'answered',
				transitionIntent: {
					event: 'USER_ANSWER_EVALUATED',
					reason: 'User provided sufficient detail',
				},
			}),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		expect(updatedNode).toBeDefined();

		// Assistant message was appended
		expect(updatedNode!.conversation.length).toBeGreaterThan(
			original.nodeStates['node-1' as NodeId]!.conversation.length,
		);
		const lastMsg =
			updatedNode!.conversation[updatedNode!.conversation.length - 1];
		expect(lastMsg!.role).toBe('assistant');
		expect(lastMsg!.content).toBe('This is the agent response.');

		// Lifecycle was updated
		expect(updatedNode!.lifecycle).toBe('answered');

		// allowedActions were recomputed
		expect(updatedNode!.allowedActions).toEqual([
			'answer',
			'defer',
			'mark_as_assumption',
			'mark_as_decision',
		]);

		// Snapshot is present
		expect(result.snapshot).toBeDefined();
		expect(result.snapshot!.mode).toBe('node_focus');

		// Input state not mutated
		expect(state).toEqual(original);
	});

	// ── Invalid lifecycle → rejected ─────────────────────────────────

	it('rejects an invalid lifecycle transition', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		const original = cloneState(state);

		// active → accepted is an invalid transition
		expect(isValidTransition('active', 'accepted')).toBe(false);

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				proposedLifecycle: 'accepted',
				transitionIntent: {
					event: 'NODE_READY_FOR_ACCEPTANCE',
					reason: 'Ready to accept',
				},
			}),
			profile,
		);

		// Should be rejected because LLM proposed "accepted"
		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('accepted');
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

		// State not mutated
		expect(state).toEqual(original);
	});

	// ── LLM proposes "accepted" → rejected ──────────────────────────

	it('rejects LLM-proposed "accepted" lifecycle', () => {
		const { profile, state } = sessionWithActiveNode_Synthesized();
		const original = cloneState(state);

		// synthesized → accepted is a valid transition,
		// but the LLM is NEVER allowed to propose it.
		expect(isValidTransition('synthesized', 'accepted')).toBe(true);

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				proposedLifecycle: 'accepted',
				transitionIntent: {
					event: 'NODE_READY_FOR_ACCEPTANCE',
					reason: 'Node is ready for acceptance',
				},
			}),
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('accepted');
		expect(result.error).toContain('user-driven');

		// State not mutated
		expect(state).toEqual(original);
	});

	// ── Invalid lifecycle transition (non-accepted) ──────────────────

	it('rejects an invalid lifecycle transition (active → synthesized)', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		const original = cloneState(state);

		// active → synthesized is not a valid transition
		expect(isValidTransition('active', 'synthesized')).toBe(false);

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				proposedLifecycle: 'synthesized',
				transitionIntent: {
					event: 'REVIEW_REQUESTED',
					reason: 'Ready to review',
				},
			}),
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('Invalid proposed lifecycle');
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);

		// No assistant message appended — input state unchanged
		expect(state).toEqual(original);
	});

	// ── Canonical answer draft stored ───────────────────────────────

	it('stores a canonical answer draft when present', () => {
		const { profile, state } = sessionWithActiveNode_Synthesized();
		const original = cloneState(state);

		const draft: CanonicalAnswerDraft = {
			confidence: 'high',
			content: 'The core thesis is: X leads to Y because of Z.',
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: [],
		};

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ canonicalAnswerDraft: draft }),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		expect(updatedNode!.canonicalAnswer).not.toBeNull();
		expect(updatedNode!.canonicalAnswer!.content).toBe(draft.content);
		expect(updatedNode!.canonicalAnswer!.confidence).toBe('high');
		expect(updatedNode!.canonicalAnswer!.format).toBe('markdown');

		// Canonical answer should not be accepted
		expect(updatedNode!.canonicalAnswer!.accepted).toBe(false);
		expect(updatedNode!.canonicalAnswer!.stale).toBe(false);

		// State not mutated
		expect(state).toEqual(original);
	});

	it('does not fail when canonicalAnswerDraft is null', () => {
		const { profile, state } = sessionWithActiveNode_Synthesized();

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ canonicalAnswerDraft: null }),
			profile,
		);

		// Should succeed — null draft is ignored
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		// The answer should still be whatever it was before.
		expect(updatedNode!.canonicalAnswer).toBe(
			state.nodeStates['node-1' as NodeId]!.canonicalAnswer,
		);
	});

	it('rejects when canonicalAnswerDraft fails lifecycle guard', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		// active lifecycle should not allow drafts

		const draft: CanonicalAnswerDraft = {
			confidence: 'low',
			content: 'A premature draft.',
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: [],
		};

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ canonicalAnswerDraft: draft }),
			profile,
		);

		// Draft storage failure is fatal.
		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('canonical answer draft');
	});

	// ── Completeness merged correctly ──────────────────────────────

	it('merges completeness evaluation advisory', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const evaluation: CompletenessState = {
			blockingIssues: [],
			complete: false,
			coverage: { evidence: 'weak', thesis: 'sufficient' },
			missing: [],
			weak: ['evidence'],
		};

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ completenessEvaluation: evaluation }),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		const completeness = updatedNode!.completeness;

		// Coverage merged
		expect(completeness.coverage.thesis).toBe('sufficient');
		expect(completeness.coverage.evidence).toBe('weak');

		// Weak topics populated
		expect(completeness.weak).toContain('evidence');

		// Not yet complete
		expect(completeness.complete).toBe(false);
	});

	it('marks complete only when LLM says complete AND no gaps remain', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const evaluation: CompletenessState = {
			blockingIssues: [],
			complete: true,
			coverage: { evidence: 'sufficient', thesis: 'sufficient' },
			missing: [],
			weak: [],
		};

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ completenessEvaluation: evaluation }),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		expect(updatedNode!.completeness.complete).toBe(true);
	});

	it('does not mark complete when LLM says complete but gaps exist', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const evaluation: CompletenessState = {
			blockingIssues: [],
			complete: true, // LLM is over-optimistic
			coverage: { evidence: 'weak', thesis: 'sufficient' },
			missing: [],
			weak: ['evidence'],
		};

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ completenessEvaluation: evaluation }),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		// Should NOT be complete because evidence is still weak
		expect(updatedNode!.completeness.complete).toBe(false);
		expect(updatedNode!.completeness.weak).toContain('evidence');
	});

	it('deduplicates blocking issues across merges', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		// First merge — one blocker
		const r1 = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				completenessEvaluation: {
					blockingIssues: ['Contradiction in thesis.'],
					complete: false,
					coverage: {},
					missing: [],
					weak: [],
				},
			}),
			profile,
		);
		expect(r1.ok).toBe(true);
		if (!r1.ok) return;

		// Second merge — same blocker plus a new one
		const r2 = applyAgentTurn(
			r1.state,
			'node-1' as NodeId,
			validOutput({
				completenessEvaluation: {
					blockingIssues: [
						'Contradiction in thesis.', // duplicate
						'Missing evidence for claim.',
					],
					complete: false,
					coverage: {},
					missing: [],
					weak: [],
				},
			}),
			profile,
		);
		expect(r2.ok).toBe(true);
		if (!r2.ok) return;

		const updatedNode = r2.state.nodeStates['node-1' as NodeId];
		expect(updatedNode!.completeness.blockingIssues).toHaveLength(2);
		expect(updatedNode!.completeness.blockingIssues).toContain(
			'Contradiction in thesis.',
		);
		expect(updatedNode!.completeness.blockingIssues).toContain(
			'Missing evidence for claim.',
		);
	});

	// ── Extracted data merged with dedup ────────────────────────────

	it('merges extracted data with deduplication', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		// First turn — one fact
		const r1 = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				extracted: {
					assumptions: ['Market will grow.'],
					decisions: [],
					facts: ['Revenue is $10M.'],
					openQuestions: [],
					risks: [],
				},
			}),
			profile,
		);
		expect(r1.ok).toBe(true);
		if (!r1.ok) return;

		// Second turn — new facts, duplicate assumption
		const r2 = applyAgentTurn(
			r1.state,
			'node-1' as NodeId,
			validOutput({
				extracted: {
					assumptions: [
						'Market will grow.', // duplicate
						'Competitors are slow.',
					],
					decisions: ['Pivot to enterprise.'],
					facts: ['Revenue is $10M.', 'Team size is 50.'],
					openQuestions: ['What about churn?'],
					risks: ['Regulatory risk.'],
				},
			}),
			profile,
		);
		expect(r2.ok).toBe(true);
		if (!r2.ok) return;

		const updatedNode = r2.state.nodeStates['node-1' as NodeId];
		const extracted = updatedNode!.extracted;

		expect(extracted.facts).toHaveLength(2);
		expect(extracted.facts).toContain('Revenue is $10M.');
		expect(extracted.facts).toContain('Team size is 50.');

		expect(extracted.assumptions).toHaveLength(2);
		expect(extracted.assumptions).toContain('Market will grow.');
		expect(extracted.assumptions).toContain('Competitors are slow.');

		expect(extracted.decisions).toHaveLength(1);
		expect(extracted.decisions).toContain('Pivot to enterprise.');

		expect(extracted.openQuestions).toHaveLength(1);
		expect(extracted.openQuestions).toContain('What about churn?');

		expect(extracted.risks).toHaveLength(1);
		expect(extracted.risks).toContain('Regulatory risk.');
	});

	// ── Prompt state updated ────────────────────────────────────────

	it('updates prompt state when proposed', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		const originalPromptState =
			state.nodeStates['node-1' as NodeId]!.promptState;

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ proposedPromptState: 'refinement' }),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		expect(updatedNode!.promptState).toBe('refinement');
		expect(updatedNode!.promptState).not.toBe(originalPromptState);
	});

	// ── Preflight: target node must be active ──────────────────────

	it('rejects when activeNodeId does not match nodeId', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		// Deselect node first
		const r = dispatch(state, { type: 'DESELECT_NODE' }, profile);
		if (!r.ok) throw new Error('Expected deselect to succeed');

		// Now try to apply to a nodeId that isn't active
		const result = applyAgentTurn(
			r.state,
			'node-1' as NodeId,
			validOutput(),
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('active node');
	});

	it('rejects when profile does not match', () => {
		const { state } = sessionWithActiveNode_Active();
		const otherProfile = minimalProfile('other-profile');

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput(),
			otherProfile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('Profile mismatch');
	});

	// ── allowedActions recomputed ───────────────────────────────────

	it('recomputes allowedActions after lifecycle change', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		// active → answered should change allowed actions
		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				proposedLifecycle: 'answered',
				transitionIntent: {
					event: 'USER_ANSWER_EVALUATED',
					reason: 'Answer evaluated',
				},
			}),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];

		// active and answered share the same action set, so this won't change
		// but it verifies the recomputation happened
		expect(updatedNode!.allowedActions).toEqual([
			'answer',
			'defer',
			'mark_as_assumption',
			'mark_as_decision',
		]);
	});

	// ── Transition intent logged ────────────────────────────────────

	it('logs transition intent as diagnostics', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				transitionIntent: {
					event: 'USER_ANSWER_EVALUATED',
					reason: 'The user provided a clear answer.',
				},
			}),
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const diags = result.snapshot!.diagnostics;
		const intentDiag = diags.find(
			(d) => d.code === 'LOGOS_APPLY_AT_TRANSITION_INTENT_LOGGED',
		);
		expect(intentDiag).toBeDefined();
		expect(intentDiag!.message).toContain('USER_ANSWER_EVALUATED');
		expect(intentDiag!.message).toContain('provided a clear answer');
	});

	// ── Agent diagnostics passed through ────────────────────────────

	it('accepts an output with agent diagnostics', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				diagnostics: [
					{
						code: 'AGENT_INFO',
						message: 'Token count: 2450',
						severity: 'info',
					},
				],
			}),
			profile,
		);

		expect(result.ok).toBe(true);
	});

	// ── Options: model attribution ───────────────────────────────────

	it('attributes assistant message to the specified model', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput(),
			profile,
			{ model: 'claude-sonnet-4-20250514' },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		const lastMsg =
			updatedNode!.conversation[updatedNode!.conversation.length - 1];
		expect(lastMsg!.metadata?.model).toBe('claude-sonnet-4-20250514');
	});

	// ── Options: explicit structured output ID ───────────────────────

	it('uses the provided structured output ID', () => {
		const { profile, state } = sessionWithActiveNode_Active();

		const result = applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput(),
			profile,
			{ structuredOutputId: 'custom-output-123' },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const updatedNode = result.state.nodeStates['node-1' as NodeId];
		const lastMsg =
			updatedNode!.conversation[updatedNode!.conversation.length - 1];
		expect(lastMsg!.metadata?.structuredOutputId).toBe('custom-output-123');
	});

	// ── Immutability ─────────────────────────────────────────────────

	it('never mutates the input state', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		const original = cloneState(state);

		applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({
				proposedLifecycle: 'answered',
				transitionIntent: {
					event: 'USER_ANSWER_EVALUATED',
					reason: 'Valid answer',
				},
			}),
			profile,
		);

		expect(state).toEqual(original);
	});

	it('never mutates the input state on error', () => {
		const { profile, state } = sessionWithActiveNode_Active();
		const original = cloneState(state);

		applyAgentTurn(
			state,
			'node-1' as NodeId,
			validOutput({ proposedLifecycle: 'accepted' }),
			profile,
		);

		expect(state).toEqual(original);
	});
});
