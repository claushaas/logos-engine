/**
 * Flow D — Review, Edit, Regenerate
 *
 * Validates user control over generated canonical content:
 *   - Review draft in `synthesized` state.
 *   - Accept → transitions to `accepted`.
 *   - Edit → appends correction message, marks stale, regenerates.
 *   - Regenerate → marks stale, produces new draft.
 *   - Reopen → returns to `active` with stale canonical answer.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.4}
 */
import { describe, expect, it } from 'vitest';
import {
	acceptCanonicalAnswerUseCase,
} from '../../src/application/use-cases/accept-canonical-answer.js';
import {
	editCanonicalAnswerUseCase,
} from '../../src/application/use-cases/edit-canonical-answer.js';
import {
	regenerateCanonicalAnswerUseCase,
} from '../../src/application/use-cases/regenerate-canonical-answer.js';
import {
	reopenNodeUseCase,
} from '../../src/application/use-cases/reopen-node.js';
import type {
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import { PromptRegistry } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function flowTestProfile(): LogosProfile {
	return {
		description: 'Flow test profile — single node.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: ['node-thesis' as NodeId],
				title: 'Thesis Document',
			},
		],
		id: 'flow-test' as ProfileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion: 'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
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
		title: 'Flow Test Profile',
		version: '1.0.0',
	};
}

/**
 * Build a session with the node in `synthesized` lifecycle with a
 * non-accepted canonical answer draft.
 */
function sessionSynthesized(): {
	state: LogosRuntimeState;
	profile: LogosProfile;
} {
	const profile = flowTestProfile();
	const state = createSession();
	const nodeId = 'node-thesis' as NodeId;
	const now = nowIso();

	const r0 = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	expect(r0.ok).toBe(true);

	const r1 = dispatch(
		r0.state!,
		{ nodeId, type: 'SELECT_NODE' },
		profile,
	);
	expect(r1.ok).toBe(true);

	const existingNode = r1.state!.nodeStates[nodeId]!;

	const synthesizedNode: NodeRuntimeState = {
		...existingNode,
		allowedActions: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
		canonicalAnswer: {
			accepted: false,
			confidence: 'medium',
			content: 'The hiring industry evaluates credentials over competence. This project aims to make skill-based evaluation the default.',
			format: 'markdown',
			generatedAt: now,
			generatedFromMessageIds: ['msg-001', 'msg-003'],
			stale: false,
		},
		conversation: [
			{
				content: 'What conviction makes this project necessary?',
				createdAt: now,
				id: 'msg-init',
				metadata: { promptState: 'initial' },
				role: 'assistant',
			},
			{
				content: 'We believe hiring filters for credentials instead of competence.',
				createdAt: now,
				id: 'msg-001',
				metadata: {},
				role: 'user',
			},
			{
				content: 'Is the tension primarily about speed, fairness, or outcomes?',
				createdAt: now,
				id: 'msg-002',
				metadata: { promptState: 'follow_up' },
				role: 'assistant',
			},
			{
				content: 'It is about outcomes — credentials don\'t predict job performance.',
				createdAt: now,
				id: 'msg-003',
				metadata: {},
				role: 'user',
			},
			{
				content: 'Here\'s a draft of your canonical answer. Review it and accept, edit, or regenerate.',
				createdAt: now,
				id: 'msg-review',
				metadata: { promptState: 'review' },
				role: 'assistant',
			},
		],
		lifecycle: 'synthesized',
		promptState: 'review',
		updatedAt: now,
	};

	const patchedState: LogosRuntimeState = {
		...r1.state!,
		nodeStates: {
			...r1.state!.nodeStates,
			[nodeId]: synthesizedNode,
		},
		updatedAt: now,
	};

	return { profile, state: patchedState };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Flow D — Review, Edit, Regenerate', () => {
	const nodeId = 'node-thesis' as NodeId;

	it('step 1-2: review synthesized draft → accept → accepted', () => {
		const { profile, state } = sessionSynthesized();

		// Verify preconditions
		const nodeBefore = state.nodeStates[nodeId]!;
		expect(nodeBefore.lifecycle).toBe('synthesized');
		expect(nodeBefore.canonicalAnswer).not.toBeNull();
		expect(nodeBefore.canonicalAnswer!.accepted).toBe(false);
		expect(nodeBefore.canonicalAnswer!.stale).toBe(false);
		expect(nodeBefore.allowedActions).toContain('accept');

		// ── Accept ───────────────────────────────────────────────────
		const result = acceptCanonicalAnswerUseCase(state, {
			nodeId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('accept failed');

		const node = result.state.nodeStates[nodeId]!;
		expect(node.lifecycle).toBe('accepted');
		expect(node.canonicalAnswer!.accepted).toBe(true);
		expect(node.canonicalAnswer!.stale).toBe(false);
		expect(node.allowedActions).toContain('reopen');
		expect(node.allowedActions).toContain('continue_next');
	});

	it('step 3: reopen from synthesized → active with stale answer', () => {
		const { profile, state } = sessionSynthesized();

		// Verify preconditions
		const nodeBefore = state.nodeStates[nodeId]!;
		expect(nodeBefore.canonicalAnswer!.stale).toBe(false);

		// ── Reopen ───────────────────────────────────────────────────
		const result = reopenNodeUseCase(state, {
			nodeId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('reopen failed');

		const node = result.state.nodeStates[nodeId]!;
		expect(node.lifecycle).toBe('active');
		expect(node.canonicalAnswer).not.toBeNull();
		expect(node.canonicalAnswer!.stale).toBe(true);
		expect(node.canonicalAnswer!.accepted).toBe(false); // never was accepted
		expect(node.allowedActions).toContain('answer');
		expect(node.allowedActions).toContain('defer');
	});

	it('step 3 (alt): regenerate → stale + new draft produced', async () => {
		const { profile, state } = sessionSynthesized();

		// Verify preconditions
		const nodeBefore = state.nodeStates[nodeId]!;
		expect(nodeBefore.canonicalAnswer!.stale).toBe(false);

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		// ── Regenerate ───────────────────────────────────────────────
		const result = await regenerateCanonicalAnswerUseCase(state, {
			llmProvider: mockLlm,
			nodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('regenerate failed');

		const node = result.state.nodeStates[nodeId]!;

		// Should still be in synthesized lifecycle
		expect(node.lifecycle).toBe('synthesized');

		// Should have a canonical answer — the new draft
		expect(node.canonicalAnswer).not.toBeNull();
		expect(node.canonicalAnswer!.stale).toBe(false); // new draft is fresh
		expect(node.canonicalAnswer!.accepted).toBe(false);

		// Allowed actions should still be the review set
		expect(node.allowedActions).toContain('accept');
		expect(node.allowedActions).toContain('edit');
	});

	it('step 2-3: edit → append correction → mark stale → regenerate', async () => {
		const { profile, state } = sessionSynthesized();

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const nodeBefore = state.nodeStates[nodeId]!;
		const conversationCountBefore = nodeBefore.conversation.length;

		// ── Edit ────────────────────────────────────────────────────
		const result = await editCanonicalAnswerUseCase(state, {
			content: 'Please change the tone to be more technical.',
			llmProvider: mockLlm,
			nodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('edit failed');

		const node = result.state.nodeStates[nodeId]!;

		// Should still be in synthesized lifecycle
		expect(node.lifecycle).toBe('synthesized');

		// Should have a fresh canonical answer
		expect(node.canonicalAnswer).not.toBeNull();
		expect(node.canonicalAnswer!.stale).toBe(false);

		// Conversation should have the edit message appended
		expect(node.conversation.length).toBeGreaterThan(conversationCountBefore);

		// The edit message should be in the conversation
		const editMsg = node.conversation.find((m) =>
			m.content.includes('more technical'),
		);
		expect(editMsg).toBeDefined();
		expect(editMsg!.role).toBe('user');

		// Step 10.3: the regenerated draft's `generatedFromMessageIds`
		// must include the edit message ID for traceability.
		expect(node.canonicalAnswer!.generatedFromMessageIds).toContain(
			editMsg!.id,
		);

		// Allowed actions should still be the review set
		expect(node.allowedActions).toContain('accept');
	});

	it('edit rejects if not in synthesized lifecycle', async () => {
		const { profile, state } = sessionSynthesized();

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		// First accept the node → accepted
		const acceptResult = acceptCanonicalAnswerUseCase(state, {
			nodeId,
			profile,
		});
		expect(acceptResult.ok).toBe(true);
		if (!acceptResult.ok) throw new Error('accept failed');

		// Try to edit from accepted → should fail (edit guard in dispatch
		// via USER_MESSAGE_ADDED rejects answers in non-answer lifecycles)
		const editResult = await editCanonicalAnswerUseCase(
			acceptResult.state,
			{
				content: 'Cannot edit accepted',
				llmProvider: mockLlm,
				nodeId,
				profile,
				promptRegistry: registry,
			},
		);

		expect(editResult.ok).toBe(false);
		expect(editResult.error).toBeDefined();
	});

	it('accept guard: node must have canonical answer', () => {
		const { profile, state: baseState } = sessionSynthesized();

		// Remove the canonical answer
		const nodeWithoutCA: NodeRuntimeState = {
			...baseState.nodeStates[nodeId]!,
			canonicalAnswer: null,
		};

		const state: LogosRuntimeState = {
			...baseState,
			nodeStates: {
				...baseState.nodeStates,
				[nodeId]: nodeWithoutCA,
			},
		};

		const result = acceptCanonicalAnswerUseCase(state, {
			nodeId,
			profile,
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain('no canonical answer');
	});
});
