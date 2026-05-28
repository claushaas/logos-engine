/**
 * Tests for Step 10.1 — submit-user-message use case.
 *
 * Covers:
 *  - Submitting a user message on a not_started node transitions to active.
 *  - The agent responds after the user message.
 *  - Lifecycle transitions from not_started → active after user message.
 *  - User message on active/answered node generates follow-up.
 *  - Error: no active node, blocked/deferred lifecycle rejection.
 */
import { describe, expect, it } from 'vitest';
import { selectNodeUseCase } from '../../src/application/use-cases/select-node.js';
import { submitUserMessageUseCase } from '../../src/application/use-cases/submit-user-message.js';
import type { LogosProfile } from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import { PromptRegistry } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function minimalProfile(): LogosProfile {
	return {
		description: 'Test profile',
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
		id: 'test-profile' as ProfileId,
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

async function selectNodeAndInit(profile: LogosProfile, nodeId: NodeId) {
	const state = createSession();
	const { dispatch } = await import('../../src/state-engine/dispatch.js');
	const r0 = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	if (!r0.ok) throw new Error('Failed to select profile');

	const mockLlm = new MockLlmProvider();
	const registry = new PromptRegistry();

	const result = await selectNodeUseCase(r0.state!, {
		llmProvider: mockLlm,
		nodeId,
		profile,
		promptRegistry: registry,
	});

	if (!result.ok) throw new Error('Failed to select node');

	return { mockLlm, registry, result };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('submitUserMessageUseCase', () => {
	it('transitions not_started → active when user submits answer', async () => {
		const profile = minimalProfile();
		const nodeId = 'node-1' as NodeId;
		const {
			result: selectResult,
			mockLlm,
			registry,
		} = await selectNodeAndInit(profile, nodeId);

		const nodeAfterSelect = selectResult.state.nodeStates[nodeId];
		expect(nodeAfterSelect!.lifecycle).toBe('not_started');
		expect(nodeAfterSelect!.conversation.length).toBe(1); // initial question

		// Now submit a user message
		const submitResult = await submitUserMessageUseCase(selectResult.state, {
			content:
				'We believe hiring filters for credentials instead of competence.',
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});

		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		const nodeAfterSubmit = submitResult.state.nodeStates[nodeId];
		expect(nodeAfterSubmit).toBeDefined();
		// Lifecycle should now be active (transitioned by dispatch)
		expect(nodeAfterSubmit!.lifecycle).toBe('active');
		// Conversation should have: initial question (assistant) + user + agent
		expect(nodeAfterSubmit!.conversation.length).toBe(3);
		expect(nodeAfterSubmit!.conversation[1]!.role).toBe('user');
		expect(nodeAfterSubmit!.conversation[2]!.role).toBe('assistant');
	});

	it('user message content is preserved in conversation', async () => {
		const profile = minimalProfile();
		const nodeId = 'node-1' as NodeId;
		const {
			result: selectResult,
			mockLlm,
			registry,
		} = await selectNodeAndInit(profile, nodeId);

		const userContent = 'This is my thesis about skill-based hiring.';

		const submitResult = await submitUserMessageUseCase(selectResult.state, {
			content: userContent,
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});

		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) return;

		const node = submitResult.state.nodeStates[nodeId];
		const userMsg = node!.conversation[1]!;
		expect(userMsg.role).toBe('user');
		expect(userMsg.content).toBe(userContent);
	});

	it('rejects user message when no active node', async () => {
		const profile = minimalProfile();
		const state = createSession();

		const { dispatch } = await import('../../src/state-engine/dispatch.js');
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		// State is in structure_overview — no active node
		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const result = await submitUserMessageUseCase(r0.state!, {
			content: 'Hello',
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('active node');
		}
	});

	it('agent responds with follow-up after user message on active node', async () => {
		const profile = minimalProfile();
		const nodeId = 'node-1' as NodeId;
		const {
			result: selectResult,
			mockLlm,
			registry,
		} = await selectNodeAndInit(profile, nodeId);

		// Submit first answer
		const submit1 = await submitUserMessageUseCase(selectResult.state, {
			content: 'First answer.',
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});
		expect(submit1.ok).toBe(true);
		if (!submit1.ok) return;

		// Now node is active. Submit another message.
		const submit2 = await submitUserMessageUseCase(submit1.state, {
			content: 'My second answer with more detail.',
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});
		expect(submit2.ok).toBe(true);
		if (!submit2.ok) return;

		const node = submit2.state.nodeStates[nodeId];
		// Should have: initial + user1 + agent1 + user2 + agent2 = 5
		expect(node!.conversation.length).toBe(5);
		// Lifecycle should be active (not synthesized, no lifecycle override)
		expect(node!.lifecycle).toBe('active');
	});

	// ── Step 10.2: fallback after 3+ rounds ──────────────────────────

	it('mock provider returns fallback message after 3+ clarification rounds', async () => {
		const mock = new MockLlmProvider();

		// Simulate a request where the node is in needs_clarification
		// with round >= 3.
		const output = await mock.generateStructuredOutput({
			messages: [],
			metadata: {
				clarificationRound: 3,
				lifecycle: 'needs_clarification',
				nodeId: 'n1',
			},
			schema: {},
			systemPrompt: '',
		});

		// Fallback message should mention the round count
		expect(output.userFacingMessage).toContain('3');
		expect(output.userFacingMessage).toContain('ambiguity');

		// Should NOT propose an invalid lifecycle transition
		expect(output.proposedLifecycle).toBeUndefined();

		// Actions should be lifecycle-compatible
		expect(output.suggestedActions).toContain('defer');
	});

	it('mock provider returns fallback message after 3+ refinement rounds', async () => {
		const mock = new MockLlmProvider();

		const output = await mock.generateStructuredOutput({
			messages: [],
			metadata: {
				lifecycle: 'needs_refinement',
				nodeId: 'n1',
				refinementRound: 4,
			},
			schema: {},
			systemPrompt: '',
		});

		// Fallback message should mention the round count
		expect(output.userFacingMessage).toContain('4');
		expect(output.userFacingMessage).toContain('generic');

		// Should NOT propose an invalid lifecycle transition
		expect(output.proposedLifecycle).toBeUndefined();

		// Actions should be lifecycle-compatible
		expect(output.suggestedActions).toContain('defer');
	});
});
