/**
 * Flow A — Steps 4-5: Synthesis → Acceptance
 *
 * Validates the synthesis and review flow:
 *   - Node in `ready_for_synthesis` → agent generates canonical draft.
 *   - Node transitions to `synthesized` with draft and review actions.
 *   - User accepts → node transitions to `accepted`.
 *   - Accepted node has `continue_next`, `reopen`, `open_document_preview` actions.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.1 steps 4-5}
 */
import { describe, expect, it } from 'vitest';
import { generateAgentTurn } from '../../src/application/generate-agent-turn.js';
import { acceptCanonicalAnswerUseCase } from '../../src/application/use-cases/accept-canonical-answer.js';
import { selectNodeUseCase } from '../../src/application/use-cases/select-node.js';
import { submitUserMessageUseCase } from '../../src/application/use-cases/submit-user-message.js';
import type {
	LogosProfile,
	LogosRuntimeState,
	NodeLifecycle,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import { PromptRegistry } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

/**
 * Profile with a coverage topic `thesis` that can be evaluated as
 * "sufficient" when the user provides concrete, specific content
 * containing the keyword `thesis` and concrete indicators (numbers,
 * reasoning connectives, etc.).
 */
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
 * Build a session with the node in `ready_for_synthesis` lifecycle.
 *
 * This bypasses the full conversation pipeline so we can test synthesis
 * and acceptance without simulating multiple message rounds.
 */
function sessionReadyForSynthesis(): {
	state: LogosRuntimeState;
	profile: LogosProfile;
} {
	const profile = flowTestProfile();
	const state = createSession();
	const nodeId = 'node-thesis' as NodeId;

	const r0 = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	expect(r0.ok).toBe(true);

	const r1 = dispatch(r0.state!, { nodeId, type: 'SELECT_NODE' }, profile);
	expect(r1.ok).toBe(true);

	// Patch the node to `ready_for_synthesis` with a conversation that
	// has enough messages for the mock provider to produce a draft.
	const existingNode = r1.state!.nodeStates[nodeId]!;
	const now = nowIso();

	const readyNode: NodeRuntimeState = {
		...existingNode,
		allowedActions: [], // automatic transition — no user actions
		conversation: [
			{
				content: 'What conviction makes this project necessary?',
				createdAt: now,
				id: 'msg-init',
				metadata: { promptState: 'initial' },
				role: 'assistant',
			},
			{
				content:
					'We believe hiring filters for credentials instead of competence.',
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
				content:
					"It is about outcomes — credentials don't predict job performance.",
				createdAt: now,
				id: 'msg-003',
				metadata: {},
				role: 'user',
			},
		],
		lifecycle: 'ready_for_synthesis' as NodeLifecycle,
		promptState: 'synthesis',
		updatedAt: now,
	};

	const patchedState: LogosRuntimeState = {
		...r1.state!,
		nodeStates: {
			...r1.state!.nodeStates,
			[nodeId]: readyNode,
		},
		updatedAt: now,
	};

	return { profile, state: patchedState };
}

/**
 * Build a session with the node in `synthesized` lifecycle.
 *
 * Pre-constructs a canonical answer draft so we can test acceptance,
 * reopen, regenerate, and edit directly.
 */
function sessionSynthesized(): {
	state: LogosRuntimeState;
	profile: LogosProfile;
} {
	const { profile, state } = sessionReadyForSynthesis();
	const nodeId = 'node-thesis' as NodeId;
	const existingNode = state.nodeStates[nodeId]!;
	const now = nowIso();

	const synthesizedNode: NodeRuntimeState = {
		...existingNode,
		allowedActions: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
		canonicalAnswer: {
			accepted: false,
			confidence: 'medium',
			content:
				'The hiring industry evaluates credentials over competence. This project aims to make skill-based evaluation the default.',
			format: 'markdown',
			generatedAt: now,
			generatedFromMessageIds: ['msg-001', 'msg-003'],
			stale: false,
		},
		lifecycle: 'synthesized',
		promptState: 'review',
		updatedAt: now,
	};

	const patchedState: LogosRuntimeState = {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: synthesizedNode,
		},
		updatedAt: now,
	};

	return { profile, state: patchedState };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Flow A — Steps 4-5: Synthesis → Acceptance', () => {
	it('step 4: ready_for_synthesis → synthesized (draft generated)', async () => {
		const { profile, state } = sessionReadyForSynthesis();
		const nodeId = 'node-thesis' as NodeId;

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		// ── Run agent turn pipeline ──────────────────────────────────
		// The mock provider's `ready_for_synthesis` fixture returns a
		// canonical draft and proposes `synthesized`.
		const agentResult = await generateAgentTurn(
			state,
			nodeId,
			profile,
			mockLlm,
			registry,
		);

		expect(agentResult.ok).toBe(true);
		if (!agentResult.ok) throw new Error('generateAgentTurn failed');

		const s = agentResult.state;
		const node = s.nodeStates[nodeId]!;

		// Lifecycle should be "synthesized"
		expect(node.lifecycle).toBe('synthesized');

		// Canonical answer draft should exist
		expect(node.canonicalAnswer).not.toBeNull();
		expect(node.canonicalAnswer!.accepted).toBe(false);
		expect(node.canonicalAnswer!.stale).toBe(false);
		expect(node.canonicalAnswer!.confidence).toBe('medium');

		// Allowed actions should be the review set
		const actions = node.allowedActions;
		expect(actions).toContain('accept');
		expect(actions).toContain('edit');
		expect(actions).toContain('regenerate');
		expect(actions).toContain('defer');
		expect(actions).toContain('reopen');

		// Conversation should have an assistant message
		expect(node.conversation.length).toBeGreaterThanOrEqual(5);
		// Last message should be the review prompt from mock provider
		const lastMsg = node.conversation.at(-1)!;
		expect(lastMsg.role).toBe('assistant');
		expect(lastMsg.content).toContain('draft');
	});

	it('step 5: synthesized → accepted (user accepts)', () => {
		const { profile, state } = sessionSynthesized();
		const nodeId = 'node-thesis' as NodeId;

		// Verify preconditions
		const nodeBefore = state.nodeStates[nodeId]!;
		expect(nodeBefore.lifecycle).toBe('synthesized');
		expect(nodeBefore.canonicalAnswer).not.toBeNull();
		expect(nodeBefore.canonicalAnswer!.accepted).toBe(false);

		// ── Accept ───────────────────────────────────────────────────
		const result = acceptCanonicalAnswerUseCase(state, {
			nodeId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('acceptCanonicalAnswerUseCase failed');

		const s = result.state;
		const node = s.nodeStates[nodeId]!;

		// Lifecycle should be "accepted"
		expect(node.lifecycle).toBe('accepted');

		// Canonical answer should be accepted and not stale
		expect(node.canonicalAnswer!.accepted).toBe(true);
		expect(node.canonicalAnswer!.stale).toBe(false);
		expect(node.canonicalAnswer!.acceptedAt).toBeDefined();

		// Allowed actions should be the accepted set
		const actions = node.allowedActions;
		expect(actions).toContain('continue_next');
		expect(actions).toContain('reopen');
		expect(actions).toContain('open_document_preview');

		// Snapshot should reflect accepted state
		expect(result.snapshot.mode).toBe('node_focus');
		const convPanel = result.snapshot.mainPanel;
		expect(convPanel.kind).toBe('node_conversation');
		if (convPanel.kind === 'node_conversation') {
			expect(convPanel.canonicalAnswerAccepted).toBe(true);
			expect(convPanel.canonicalAnswerPreview).not.toBeNull();
		}
	});

	it('accept guard: must be in synthesized lifecycle', () => {
		const { profile, state } = sessionReadyForSynthesis();
		const nodeId = 'node-thesis' as NodeId;

		// Try to accept a node in `ready_for_synthesis` — should fail
		const result = acceptCanonicalAnswerUseCase(state, {
			nodeId,
			profile,
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain('synthesized');
	});

	it('reopen from synthesized marks canonical answer stale', () => {
		const { profile, state } = sessionSynthesized();
		const nodeId = 'node-thesis' as NodeId;

		// Verify preconditions
		const nodeBefore = state.nodeStates[nodeId]!;
		expect(nodeBefore.lifecycle).toBe('synthesized');
		expect(nodeBefore.canonicalAnswer).not.toBeNull();
		expect(nodeBefore.canonicalAnswer!.stale).toBe(false);

		// ── Reopen via lifecycle change ──────────────────────────────
		const result = dispatch(
			state,
			{
				nodeId,
				to: 'active',
				type: 'NODE_LIFECYCLE_CHANGED',
			},
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('dispatch failed');

		const node = result.state.nodeStates[nodeId]!;

		// Lifecycle should be "active"
		expect(node.lifecycle).toBe('active');

		// Canonical answer should be preserved but marked stale
		expect(node.canonicalAnswer).not.toBeNull();
		expect(node.canonicalAnswer!.stale).toBe(true);

		// Allowed actions should be the active set
		const actions = node.allowedActions;
		expect(actions).toContain('answer');
		expect(actions).toContain('defer');
	});

	it('true pipeline: not_started → submit concrete answer → engine determines ready_for_synthesis → LLM synthesizes → accept', async () => {
		const profile = flowTestProfile();
		const state = createSession();
		const nodeId = 'node-thesis' as NodeId;

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		// ── Setup: select profile + select node ─────────────────────
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		const selectResult = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId,
			profile,
			promptRegistry: registry,
		});
		expect(selectResult.ok).toBe(true);
		if (!selectResult.ok) throw new Error('selectNodeUseCase failed');

		let s = selectResult.state;

		// ── Submit concrete answer that satisfies completeness ──────
		// The topic is "thesis" and the message contains:
		// - The keyword "thesis" (required for topic match)
		// - Specific numbers (35%, 500) — concrete indicators
		// - Reasoning connectives (because, specifically)
		// - Length > 50 chars
		const submitResult = await submitUserMessageUseCase(s, {
			content:
				'The core thesis of our project is that skills-based hiring ' +
				'leads to 35% better retention because credentials fail to ' +
				'predict performance. Specifically, we validated this through ' +
				'a controlled study of 500 companies.',
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});

		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) throw new Error('submitUserMessageUseCase failed');

		s = submitResult.state;

		// ── Verify the engine determined readiness and LLM synthesized ──
		// After dispatch evaluates completeness → complete:
		// → lifecycle becomes "ready_for_synthesis"
		// → agent turn runs with "ready_for_synthesis" → mock proposes
		//   "synthesized" with canonical draft
		// → applyAgentTurn transitions to "synthesized"
		const node = s.nodeStates[nodeId]!;
		expect(node.lifecycle).toBe('synthesized');

		// Canonical answer draft should exist
		expect(node.canonicalAnswer).not.toBeNull();
		expect(node.canonicalAnswer!.accepted).toBe(false);
		expect(node.canonicalAnswer!.stale).toBe(false);

		// generatedFromMessageIds should include user message IDs
		expect(
			node.canonicalAnswer!.generatedFromMessageIds.length,
		).toBeGreaterThan(0);

		// Allowed actions should be the review set
		const actions = node.allowedActions;
		expect(actions).toContain('accept');
		expect(actions).toContain('edit');
		expect(actions).toContain('regenerate');
		expect(actions).toContain('defer');
		expect(actions).toContain('reopen');

		// Snapshot should show canonical answer preview
		expect(submitResult.snapshot.mainPanel.kind).toBe('node_conversation');
		if (submitResult.snapshot.mainPanel.kind === 'node_conversation') {
			expect(
				submitResult.snapshot.mainPanel.canonicalAnswerPreview,
			).not.toBeNull();
			expect(submitResult.snapshot.mainPanel.canonicalAnswerAccepted).toBe(
				false,
			);
		}

		// ── Now accept ──────────────────────────────────────────────
		const acceptResult = acceptCanonicalAnswerUseCase(s, {
			nodeId,
			profile,
		});

		expect(acceptResult.ok).toBe(true);
		if (!acceptResult.ok) throw new Error('accept failed');

		const acceptedNode = acceptResult.state.nodeStates[nodeId]!;
		expect(acceptedNode.lifecycle).toBe('accepted');
		expect(acceptedNode.canonicalAnswer!.accepted).toBe(true);

		// Document readiness should be ready (all required nodes accepted)
		const docState =
			acceptResult.state.documentStates['doc-thesis' as DocumentId];
		expect(docState).toBeDefined();
		expect(docState!.status).toBe('ready');
	});
});
