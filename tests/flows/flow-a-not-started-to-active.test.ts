/**
 * Flow A — Not Started → Active
 *
 * Validates the full initial question flow:
 *   - Select a not_started node → initial question generated immediately.
 *   - Node stays not_started until user answers.
 *   - Skip action → node deferred.
 *   - User answers → node transitions to active.
 *   - Answer after active → agent follow-up.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.1}
 */
import { describe, expect, it } from 'vitest';
import { selectNodeUseCase } from '../../src/application/use-cases/select-node.js';
import { skipNodeUseCase } from '../../src/application/use-cases/skip-node.js';
import { submitUserMessageUseCase } from '../../src/application/use-cases/submit-user-message.js';
import type { LogosProfile } from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import { PromptRegistry } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
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

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Flow A — Not Started → Active', () => {
	it('select node → sees initial question → answer → active', async () => {
		const profile = flowTestProfile();
		const state = createSession();
		const nodeId = 'node-thesis' as NodeId;

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		// ── Step 1: Select profile ─────────────────────────────────
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		// ── Step 2: Select node → initial question generated ───────
		const selectResult = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId,
			profile,
			promptRegistry: registry,
		});

		expect(selectResult.ok).toBe(true);
		if (!selectResult.ok) throw new Error('selectNodeUseCase failed');

		let s = selectResult.state;
		const nodeAfterSelect = s.nodeStates[nodeId];
		expect(nodeAfterSelect!.lifecycle).toBe('not_started');
		expect(nodeAfterSelect!.conversation.length).toBe(1);
		expect(nodeAfterSelect!.conversation[0]!.role).toBe('assistant');

		// Snapshot: input enabled, actions correct
		expect(selectResult.snapshot.input.enabled).toBe(true);
		const selectActions = selectResult.snapshot.actionBar.actions.map(
			(a) => a.id,
		);
		expect(selectActions).toContain('answer');
		expect(selectActions).toContain('skip');
		expect(selectActions).toContain('ask_for_example');

		// ── Step 3: User answers ──────────────────────────────────
		const submitResult = await submitUserMessageUseCase(s, {
			content:
				'We believe hiring filters for credentials instead of competence.',
			llmProvider: mockLlm,
			profile,
			promptRegistry: registry,
		});

		expect(submitResult.ok).toBe(true);
		if (!submitResult.ok) throw new Error('submitUserMessageUseCase failed');

		s = submitResult.state;
		const nodeAfterAnswer = s.nodeStates[nodeId];
		// Lifecycle should be active
		expect(nodeAfterAnswer!.lifecycle).toBe('active');
		// 3 messages: initial question + user answer + agent follow-up
		expect(nodeAfterAnswer!.conversation.length).toBe(3);
		expect(nodeAfterAnswer!.conversation[1]!.role).toBe('user');
		expect(nodeAfterAnswer!.conversation[2]!.role).toBe('assistant');

		// Input still enabled for follow-up
		expect(submitResult.snapshot.input.enabled).toBe(true);
	});

	it('skip from not_started defers the node', async () => {
		const profile = flowTestProfile();
		const state = createSession();
		const nodeId = 'node-thesis' as NodeId;

		// ── Setup ─────────────────────────────────────────────────
		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const selectResult = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId,
			profile,
			promptRegistry: registry,
		});
		expect(selectResult.ok).toBe(true);
		if (!selectResult.ok) throw new Error('selectNodeUseCase failed');

		// ── Skip action ───────────────────────────────────────────
		// Use the application-level skip-node use case
		const skipResult = skipNodeUseCase(selectResult.state, {
			nodeId,
			profile,
		});

		expect(skipResult.ok).toBe(true);
		if (!skipResult.ok) throw new Error('skipNodeUseCase failed');

		const nodeAfterSkip = skipResult.state.nodeStates[nodeId];
		expect(nodeAfterSkip!.lifecycle).toBe('deferred');

		// Verify actions available on deferred node
		const deferActions = nodeAfterSkip!.allowedActions;
		expect(deferActions).toContain('resume');
		expect(deferActions).toContain('continue_next');
	});

	it('initial question is specific to node context', async () => {
		const profile = flowTestProfile();
		const state = createSession();
		const nodeId = 'node-thesis' as NodeId;

		const r0 = dispatch(
			state,
			{ profileId: profile.id, type: 'SELECT_PROFILE' },
			profile,
		);
		expect(r0.ok).toBe(true);

		const mockLlm = new MockLlmProvider();
		const registry = new PromptRegistry();

		const selectResult = await selectNodeUseCase(r0.state!, {
			llmProvider: mockLlm,
			nodeId,
			profile,
			promptRegistry: registry,
		});

		expect(selectResult.ok).toBe(true);
		if (!selectResult.ok) throw new Error('selectNodeUseCase failed');

		const initialMsg =
			selectResult.state.nodeStates[nodeId]!.conversation[0]!.content;

		// The initial question should contain the canonical question content,
		// not a generic static message
		expect(initialMsg).toContain('conviction');
		expect(initialMsg).toContain('necessary');

		// The initial question must NOT be the canonical question verbatim —
		// it must be paraphrased
		const canonicalQ = 'What conviction makes this project necessary?';
		expect(initialMsg).not.toBe(canonicalQ);

		// Must NOT start with the canonical question verbatim
		expect(initialMsg.startsWith(canonicalQ)).toBe(false);
	});

	it('preserves mode as node_focus after initial question', async () => {
		const profile = flowTestProfile();
		const state = createSession();
		const nodeId = 'node-thesis' as NodeId;

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
			nodeId,
			profile,
			promptRegistry: registry,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.snapshot.mode).toBe('node_focus');
		expect(result.snapshot.input.enabled).toBe(true);
	});
});
