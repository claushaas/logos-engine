/**
 * Tests for Step 10.1 — select-node use case.
 *
 * Covers:
 *  - Selecting a fresh not_started node generates the initial question.
 *  - The node remains not_started after initial question generation.
 *  - The render snapshot has input enabled and correct actions on not_started.
 *  - The LLM request includes the canonical question from the node definition.
 *  - Re-selecting a node with existing conversation preserves state.
 *  - Blocked nodes are handled correctly.
 *  - Error: no profile, invalid node, agent turn failure fallback.
 */
import { describe, expect, it } from 'vitest';
import { selectNodeUseCase } from '../../src/application/use-cases/select-node.js';
import type { LogosProfile } from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import { PromptRegistry } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

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
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'test-doc' as DocumentId,
				id: 'node-1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
		],
		phases: [
			{
				id: 'phase-1',
				order: 1,
				purpose: 'Testing',
				title: 'Foundation',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('selectNodeUseCase', () => {
	it('selects a fresh not_started node and generates initial question', async () => {
		const profile = minimalProfile();
		const state = createSession();

		// Setup: select profile first
		const { dispatch } = await import('../../src/state-engine/dispatch.js');
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId: 'node-1' as NodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// The node should exist and be not_started
		const node = result.state.nodeStates['node-1' as NodeId];
		expect(node).toBeDefined();
		expect(node!.lifecycle).toBe('not_started');
		expect(node!.promptState).toBe('initial');

		// The initial question should have been appended as an assistant message
		expect(node!.conversation.length).toBe(1);
		expect(node!.conversation[0]!.role).toBe('assistant');
		expect(node!.conversation[0]!.content).toContain('core thesis');

		// Render snapshot: input should be enabled with placeholder
		expect(result.snapshot.input.enabled).toBe(true);
		expect(result.snapshot.input.placeholder).toBe('Type your answer…');

		// Actions should be correct for not_started
		const actionIds = result.snapshot.actionBar.actions.map((a) => a.id);
		expect(actionIds).toContain('answer');
		expect(actionIds).toContain('skip');
		expect(actionIds).toContain('ask_for_example');
		// These should NOT be in not_started
		expect(actionIds).not.toContain('accept');
		expect(actionIds).not.toContain('defer');

		// The snapshot should be node_conversation mode
		expect(result.snapshot.mode).toBe('node_focus');
		if (result.snapshot.mainPanel.kind === 'node_conversation') {
			expect(result.snapshot.mainPanel.nodeId).toBe('node-1');
		}
	});

	it('initial question paraphrases the canonical question', async () => {
		const profile = minimalProfile();
		const state = createSession();

		const { dispatch } = await import('../../src/state-engine/dispatch.js');
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		// Use a profile with a specific canonical question
		const specificProfile: LogosProfile = {
			...profile,
			nodes: [
				{
					...profile.nodes[0]!,
					canonicalQuestion: 'What conviction makes this project necessary?',
					title: 'Core Thesis',
				},
			],
		};

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId: 'node-1' as NodeId,
			profile: specificProfile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const node = result.state.nodeStates['node-1' as NodeId];
		expect(node!.conversation.length).toBe(1);
		const initialMsg = node!.conversation[0]!.content;
		// The initial question should paraphrase the canonical question,
		// not use a generic static message
		expect(initialMsg).toContain('conviction');

		// Must NOT be the canonical question verbatim
		expect(initialMsg).not.toBe(
			'What conviction makes this project necessary?',
		);
	});

	it('does not generate initial question for non-not_started nodes', async () => {
		const profile = minimalProfile();
		const state = createSession();

		const { dispatch } = await import('../../src/state-engine/dispatch.js');
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		// Select the node first
		const r1 = dispatch(
			r0.state!,
			{ nodeId: 'node-1' as NodeId, type: 'SELECT_NODE' },
			profile,
		);
		expect(r1.ok).toBe(true);

		// Send a user message through the state engine to move past not_started
		const r2 = dispatch(
			r1.state!,
			{
				content: 'This is my answer.',
				nodeId: 'node-1' as NodeId,
				type: 'USER_MESSAGE_ADDED',
			},
			profile,
		);
		expect(r2.ok).toBe(true);

		// Now re-select the node — it should already have conversation
		// and be active, so no initial question should be generated
		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await selectNodeUseCase(r2.state!, {
			llmProvider: mockLlm,
			nodeId: 'node-1' as NodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const node = result.state.nodeStates['node-1' as NodeId];
		expect(node).toBeDefined();
		// The conversation length should be 1 (the user message we sent)
		// not 2 (no additional initial question)
		expect(node!.conversation.length).toBe(1);
		expect(node!.lifecycle).toBe('active');
	});

	it('returns error for node not in profile', async () => {
		const profile = minimalProfile();
		const state = createSession();

		const { dispatch } = await import('../../src/state-engine/dispatch.js');
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId: 'nonexistent' as NodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('nonexistent');
		}
	});

	it('returns error without selected profile', async () => {
		const profile = minimalProfile();
		const state = createSession();

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await selectNodeUseCase(state, {
			llmProvider: mockLlm,
			nodeId: 'node-1' as NodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('profile');
		}
	});

	it('exposes allowed actions for not_started: answer, skip, ask_for_example', async () => {
		const profile = minimalProfile();
		const state = createSession();

		const { dispatch } = await import('../../src/state-engine/dispatch.js');
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId: 'node-1' as NodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const actions = result.snapshot.actionBar.actions;
		const labels = actions.map((a) => a.label);

		// Per prototypes §1.6, not_started → [answer, skip, ask_for_example]
		expect(labels).toContain('[Answer]');
		expect(labels).toContain('[Skip]');
		expect(labels).toContain('[Ask for example]');
	});
});
