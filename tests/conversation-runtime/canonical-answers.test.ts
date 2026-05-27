/**
 * Tests for Step 4.2 — canonical answer management.
 *
 * Covers:
 *  - `setCanonicalAnswerDraft` — sets draft in correct lifecycle,
 *    rejects in wrong lifecycle.
 *  - `acceptCanonicalAnswer` — sets `accepted: true`, `acceptedAt`,
 *    rejects in wrong lifecycle.
 *  - `markCanonicalAnswerStale` — marks stale, idempotent when
 *    no answer exists.
 *  - `regenerateCanonicalAnswer` — marks old stale, new draft
 *    replaces via `setCanonicalAnswerDraft`.
 *  - Staleness via `appendUserMessage` — new message marks
 *    existing answer stale.
 *  - Staleness via `applyLifecycleTransition` — accepted → active
 *    (reopen) marks answer stale.
 *  - Immutability: input state is never mutated.
 */
import { describe, expect, it } from 'vitest';

import type {
	CanonicalAnswer,
	CanonicalAnswerDraft,
	LogosRuntimeState,
	NodeLifecycle,
	PromptState,
} from '../../src/contracts/index.js';
import type { NodeId } from '../../src/shared/index.js';
import { generateId, nowIso } from '../../src/shared/index.js';
import {
	acceptCanonicalAnswer,
	appendUserMessage,
	markCanonicalAnswerStale,
	regenerateCanonicalAnswer,
	setCanonicalAnswerDraft,
} from '../../src/conversation-runtime/index.js';
import { applyLifecycleTransition } from '../../src/state-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

const N1: NodeId = 'n1' as NodeId;

/** Create a valid `CanonicalAnswerDraft` fixture. */
function makeDraft(overrides?: Partial<CanonicalAnswerDraft>): CanonicalAnswerDraft {
	return {
		confidence: 'medium',
		content: 'The central thesis is that distributed systems improve resilience.',
		format: 'markdown',
		generatedAt: nowIso(),
		generatedFromMessageIds: ['msg-001'],
		...overrides,
	};
}

/** Create a canonical answer already on a node (for accept/stale/regenerate tests). */
function acceptedAnswer(): CanonicalAnswer {
	return {
		accepted: false,
		confidence: 'high',
		content: 'The thesis has been synthesised.',
		format: 'markdown',
		generatedAt: nowIso(),
		generatedFromMessageIds: ['msg-001', 'msg-002'],
		stale: false,
	};
}

/** Create a minimal `LogosRuntimeState` for a node with a given lifecycle. */
function stateWithLifecycle(lifecycle: NodeLifecycle): LogosRuntimeState {
	const sessionId = generateId();
	return {
		activeNodeId: N1,
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
			[N1]: {
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
				lifecycle,
				nodeId: N1,
				promptState: 'follow_up' as PromptState,
				updatedAt: nowIso(),
			},
		},
		selectedProfileId: 'test-profile' as import('../../src/shared/index.js').ProfileId,
		sessionId: sessionId as import('../../src/shared/index.js').SessionId,
		updatedAt: nowIso(),
	};
}

/** Deep-clone for immutability assertions. */
function cloneState(s: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(s));
}

// ═══════════════════════════════════════════════════════════════════════════
// setCanonicalAnswerDraft
// ═══════════════════════════════════════════════════════════════════════════

describe('setCanonicalAnswerDraft', () => {
	it('sets a draft when lifecycle is "ready_for_synthesis"', () => {
		const state = stateWithLifecycle('ready_for_synthesis');
		const draft = makeDraft();

		const result = setCanonicalAnswerDraft(state, N1, draft);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const ca = result.state.nodeStates[N1]?.canonicalAnswer;
		expect(ca).toBeDefined();
		expect(ca?.content).toBe(draft.content);
		expect(ca?.format).toBe(draft.format);
		expect(ca?.generatedAt).toBe(draft.generatedAt);
		expect(ca?.generatedFromMessageIds).toEqual(draft.generatedFromMessageIds);
		expect(ca?.confidence).toBe(draft.confidence);
		expect(ca?.accepted).toBe(false);
		expect(ca?.stale).toBe(false);
		expect(ca?.acceptedAt).toBeUndefined();
	});

	it('sets a draft when lifecycle is "synthesized"', () => {
		const state = stateWithLifecycle('synthesized');
		const draft = makeDraft();

		const result = setCanonicalAnswerDraft(state, N1, draft);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.nodeStates[N1]?.canonicalAnswer?.content).toBe(
			draft.content,
		);
	});

	it('rejects when lifecycle is not ready_for_synthesis or synthesized', () => {
		const disallowed: NodeLifecycle[] = [
			'not_started',
			'active',
			'answered',
			'needs_clarification',
			'needs_refinement',
			'accepted',
			'deferred',
			'blocked',
		];

		for (const lc of disallowed) {
			const state = stateWithLifecycle(lc);
			const result = setCanonicalAnswerDraft(state, N1, makeDraft());

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error(`Expected error for lifecycle ${lc}`);
			expect(result.error).toContain(lc);
		}
	});

	it('rejects when node does not exist', () => {
		const state = stateWithLifecycle('ready_for_synthesis');
		const result = setCanonicalAnswerDraft(
			state,
			'nonexistent' as NodeId,
			makeDraft(),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('no runtime state');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// acceptCanonicalAnswer
// ═══════════════════════════════════════════════════════════════════════════

describe('acceptCanonicalAnswer', () => {
	it('sets accepted: true and records acceptedAt when lifecycle is "synthesized"', () => {
		const state = stateWithLifecycle('synthesized');

		// First set a draft, then accept it
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');

		const result = acceptCanonicalAnswer(dr.state, N1);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const ca = result.state.nodeStates[N1]?.canonicalAnswer;
		expect(ca?.accepted).toBe(true);
		expect(ca?.stale).toBe(false);
		expect(ca?.acceptedAt).toBeTypeOf('string');
		expect(ca?.acceptedAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
	});

	it('rejects when lifecycle is not "synthesized"', () => {
		// Use ready_for_synthesis (has a draft but not ready for accept)
		const state = stateWithLifecycle('ready_for_synthesis');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');

		const result = acceptCanonicalAnswer(dr.state, N1);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('ready_for_synthesis');
	});

	it('rejects when no canonical answer exists', () => {
		const state = stateWithLifecycle('synthesized');

		const result = acceptCanonicalAnswer(state, N1);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('no canonical answer');
	});

	it('rejects when node does not exist', () => {
		const state = stateWithLifecycle('synthesized');

		const result = acceptCanonicalAnswer(state, 'nonexistent' as NodeId);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('no runtime state');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// markCanonicalAnswerStale
// ═══════════════════════════════════════════════════════════════════════════

describe('markCanonicalAnswerStale', () => {
	it('marks existing canonical answer as stale', () => {
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');

		const result = markCanonicalAnswerStale(dr.state, N1);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const ca = result.state.nodeStates[N1]?.canonicalAnswer;
		expect(ca?.stale).toBe(true);
		// accepted should remain unchanged
		expect(ca?.accepted).toBe(false);
	});

	it('is idempotent when no canonical answer exists', () => {
		const state = stateWithLifecycle('active');

		const result = markCanonicalAnswerStale(state, N1);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		// State unchanged
		expect(result.state.nodeStates[N1]?.canonicalAnswer).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// regenerateCanonicalAnswer
// ═══════════════════════════════════════════════════════════════════════════

describe('regenerateCanonicalAnswer', () => {
	it('marks old answer as stale, then new draft can be set', () => {
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft({ content: 'Old answer' }));
		if (!dr.ok) throw new Error('Expected ok');

		// Regenerate — marks old as stale
		const regResult = regenerateCanonicalAnswer(dr.state, N1);
		expect(regResult.ok).toBe(true);
		if (!regResult.ok) throw new Error('Expected ok');

		const caAfterRegen = regResult.state.nodeStates[N1]?.canonicalAnswer;
		expect(caAfterRegen?.stale).toBe(true);
		expect(caAfterRegen?.content).toBe('Old answer');

		// Now set a new draft
		const newDraft = makeDraft({ content: 'New answer' });
		const setResult = setCanonicalAnswerDraft(regResult.state, N1, newDraft);
		expect(setResult.ok).toBe(true);
		if (!setResult.ok) throw new Error('Expected ok');

		const caAfterSet = setResult.state.nodeStates[N1]?.canonicalAnswer;
		expect(caAfterSet?.content).toBe('New answer');
		expect(caAfterSet?.stale).toBe(false);
	});

	it('rejects when lifecycle is not "synthesized"', () => {
		const state = stateWithLifecycle('ready_for_synthesis');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');

		const result = regenerateCanonicalAnswer(dr.state, N1);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('synthesized');
	});

	it('rejects when no canonical answer exists', () => {
		const state = stateWithLifecycle('synthesized');

		const result = regenerateCanonicalAnswer(state, N1);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
		expect(result.error).toContain('no canonical answer');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Staleness via appendUserMessage
// ═══════════════════════════════════════════════════════════════════════════

describe('staleness — new user message', () => {
	it('marks existing canonical answer stale when a new user message is appended', () => {
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');

		// Accept it so it's accepted
		const ar = acceptCanonicalAnswer(dr.state, N1);
		if (!ar.ok) throw new Error('Expected ok');

		expect(ar.state.nodeStates[N1]?.canonicalAnswer?.accepted).toBe(true);
		expect(ar.state.nodeStates[N1]?.canonicalAnswer?.stale).toBe(false);

		// Now append a user message — should mark stale
		const msgResult = appendUserMessage(ar.state, N1, 'New information');

		expect(msgResult.ok).toBe(true);
		if (!msgResult.ok) throw new Error('Expected ok');

		const ca = msgResult.state.nodeStates[N1]?.canonicalAnswer;
		expect(ca?.stale).toBe(true);
		expect(ca?.accepted).toBe(true); // accepted preserved
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Staleness via lifecycle transition (accepted → active = reopen)
// ═══════════════════════════════════════════════════════════════════════════

describe('staleness — node reopened', () => {
	it('marks canonical answer stale when transitioning from accepted to active', () => {
		// Start in synthesized, set draft, accept
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');
		const ar = acceptCanonicalAnswer(dr.state, N1);
		if (!ar.ok) throw new Error('Expected ok');

		// Manually transition to accepted (simulate what dispatch would do after accept)
		const acceptedResult = applyLifecycleTransition(ar.state, N1, 'accepted', {
			event: 'USER_ACCEPT',
		});
		if (!acceptedResult.ok) throw new Error('Expected ok');

		expect(acceptedResult.state.nodeStates[N1]?.lifecycle).toBe('accepted');
		expect(acceptedResult.state.nodeStates[N1]?.canonicalAnswer?.stale).toBe(
			false,
		);

		// Now reopen: accepted → active
		const reopenResult = applyLifecycleTransition(
			acceptedResult.state,
			N1,
			'active',
			{
				event: 'USER_REOPEN',
			},
		);
		if (!reopenResult.ok) throw new Error('Expected ok');

		expect(reopenResult.state.nodeStates[N1]?.lifecycle).toBe('active');
		const ca = reopenResult.state.nodeStates[N1]?.canonicalAnswer;
		expect(ca?.stale).toBe(true);
		expect(ca?.accepted).toBe(true); // accepted preserved
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Immutability
// ═══════════════════════════════════════════════════════════════════════════

describe('immutability', () => {
	it('setCanonicalAnswerDraft does not mutate input state', () => {
		const state = stateWithLifecycle('ready_for_synthesis');
		const original = cloneState(state);

		setCanonicalAnswerDraft(state, N1, makeDraft());

		expect(state).toEqual(original);
	});

	it('acceptCanonicalAnswer does not mutate input state', () => {
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');
		const original = cloneState(dr.state);

		acceptCanonicalAnswer(dr.state, N1);

		expect(dr.state).toEqual(original);
	});

	it('markCanonicalAnswerStale does not mutate input state', () => {
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');
		const original = cloneState(dr.state);

		markCanonicalAnswerStale(dr.state, N1);

		expect(dr.state).toEqual(original);
	});

	it('regenerateCanonicalAnswer does not mutate input state', () => {
		const state = stateWithLifecycle('synthesized');
		const dr = setCanonicalAnswerDraft(state, N1, makeDraft());
		if (!dr.ok) throw new Error('Expected ok');
		const original = cloneState(dr.state);

		regenerateCanonicalAnswer(dr.state, N1);

		expect(dr.state).toEqual(original);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// End-to-end: draft → accept → stale → regenerate
// ═══════════════════════════════════════════════════════════════════════════

describe('end-to-end flow', () => {
	it('draft → accept → user message (stale) → regenerate → new draft → accept', () => {
		// 1. Set draft in ready_for_synthesis
		const state = stateWithLifecycle('ready_for_synthesis');
		const r1 = setCanonicalAnswerDraft(state, N1, makeDraft({ content: 'V1' }));
		if (!r1.ok) throw new Error('Expected ok');
		expect(r1.state.nodeStates[N1]?.canonicalAnswer?.content).toBe('V1');

		// 2. Transition to synthesized (lifecycle change)
		const r2 = applyLifecycleTransition(r1.state, N1, 'synthesized', {
			event: 'SYNTHESIS_PROPOSED',
		});
		if (!r2.ok) throw new Error('Expected ok');
		expect(r2.state.nodeStates[N1]?.lifecycle).toBe('synthesized');

		// 3. Accept
		const r3 = acceptCanonicalAnswer(r2.state, N1);
		if (!r3.ok) throw new Error('Expected ok');
		expect(r3.state.nodeStates[N1]?.canonicalAnswer?.accepted).toBe(true);
		expect(r3.state.nodeStates[N1]?.canonicalAnswer?.stale).toBe(false);

		// 4. New user message marks stale
		const r4 = appendUserMessage(r3.state, N1, 'Actually, I want to change this.');
		if (!r4.ok) throw new Error('Expected ok');
		expect(r4.state.nodeStates[N1]?.canonicalAnswer?.stale).toBe(true);

		// 5. Regenerate (marks old stale, caller sets new draft)
		const r5 = regenerateCanonicalAnswer(r4.state, N1);
		if (!r5.ok) throw new Error('Expected ok');

		// 6. Set new draft
		const r6 = setCanonicalAnswerDraft(
			r5.state,
			N1,
			makeDraft({ content: 'V2 — revised' }),
		);
		if (!r6.ok) throw new Error('Expected ok');
		expect(r6.state.nodeStates[N1]?.canonicalAnswer?.content).toBe(
			'V2 — revised',
		);
		expect(r6.state.nodeStates[N1]?.canonicalAnswer?.stale).toBe(false);

		// 7. Accept new draft
		const r7 = acceptCanonicalAnswer(r6.state, N1);
		if (!r7.ok) throw new Error('Expected ok');
		expect(r7.state.nodeStates[N1]?.canonicalAnswer?.accepted).toBe(true);
		expect(r7.state.nodeStates[N1]?.canonicalAnswer?.stale).toBe(false);
	});
});
