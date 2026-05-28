/**
 * Tests for `generateAgentTurn` — the shared agent-turn pipeline with
 * the real-output repair loop (LLM-10).
 *
 * Covers:
 *  - Valid first response → success without repair.
 *  - Invalid first response + valid repair response → success after repair.
 *  - Invalid through all repair attempts → recoverable error.
 *  - Failed repair leaves state unchanged (no invalid assistant messages).
 *  - Provider exception → error returned without entering repair.
 *  - Repair request includes validation errors and preserves original context.
 */
import { describe, expect, it } from 'vitest';

import { generateAgentTurn } from '../../src/application/generate-agent-turn.js';
import type {
	AgentTurnOutput,
	LogosProfile,
} from '../../src/contracts/index.js';
import type { LlmProvider, LlmResponse } from '../../src/llm/index.js';
import type { LlmRequest } from '../../src/prompt-orchestration/prompt-assembler.js';
import { PromptRegistry } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
// Custom test mock — returns pre-configured outputs in call order
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A test-only {@link LlmProvider} that returns pre-configured
 * `AgentTurnOutput` values in sequence.
 *
 * After the last configured output, repeats the final value.
 * Every response is deep-cloned to prevent test cross-contamination.
 */
class CallSequenceMockProvider implements LlmProvider {
	private callIndex = 0;
	/** All requests received, in order — useful for inspecting repair context. */
	public readonly requests: LlmRequest[] = [];

	constructor(private readonly outputs: AgentTurnOutput[]) {}

	async generateStructuredOutput(request: LlmRequest): Promise<LlmResponse> {
		this.requests.push(request);
		const output =
			this.outputs[this.callIndex] ?? this.outputs[this.outputs.length - 1]!;
		this.callIndex++;
		return JSON.parse(JSON.stringify(output)) as AgentTurnOutput;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/** An output that fails structural validation (empty `userFacingMessage`). */
const INVALID_OUTPUT: AgentTurnOutput = {
	userFacingMessage: '',
};

/** A minimal valid output that passes both structural and semantic checks. */
const VALID_OUTPUT: AgentTurnOutput = {
	userFacingMessage: 'This is a valid agent response.',
};

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

/**
 * Set up runtime state with a node in the `active` lifecycle, ready for
 * `generateAgentTurn`.
 *
 * Steps:
 * 1. Create session + select profile.
 * 2. Select node (initialises `NodeRuntimeState` at `not_started`).
 * 3. Add a user message (transitions to `active`).
 */
function setupActiveNodeState() {
	const profile = minimalProfile();
	const nodeId = 'node-1' as NodeId;

	const state = createSession();

	let r = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	if (!r.ok) throw new Error('Failed to select profile');

	r = dispatch(r.state!, { nodeId, type: 'SELECT_NODE' }, profile);
	if (!r.ok) throw new Error('Failed to select node');

	r = dispatch(
		r.state!,
		{
			content:
				'The core thesis of our project is that skill-based hiring produces better outcomes ' +
				'because it focuses on demonstrated competence rather than credential proxies. ' +
				'For example, we measured a 30% improvement in candidate quality when using work-sample tests.',
			nodeId,
			type: 'USER_MESSAGE_ADDED',
		},
		profile,
	);
	if (!r.ok) throw new Error('Failed to add user message');

	const nodeState = r.state!.nodeStates[nodeId];
	if (!nodeState) throw new Error('Node state missing');

	// Step 10.2 completeness evaluation may override the lifecycle to
	// ready_for_synthesis if the message covers all topics sufficiently.
	// We accept both active and ready_for_synthesis as valid states.
	const validLifecycles: string[] = ['active', 'ready_for_synthesis'];
	if (!validLifecycles.includes(nodeState.lifecycle)) {
		throw new Error(
			`Expected active or ready_for_synthesis lifecycle, got ${nodeState.lifecycle}`,
		);
	}

	return { nodeId, profile, state: r.state! };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('generateAgentTurn — repair loop (LLM-10)', () => {
	// ── Happy path: valid first response ────────────────────────────

	it('returns success when the first LLM response is valid', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([VALID_OUTPUT]);
		const registry = new PromptRegistry();

		const result = await generateAgentTurn(
			state,
			nodeId,
			profile,
			mock,
			registry,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// State should have the assistant message appended.
		const nodeState = result.state.nodeStates[nodeId];
		expect(nodeState).toBeDefined();
		const lastMsg = nodeState!.conversation[nodeState!.conversation.length - 1];
		expect(lastMsg!.role).toBe('assistant');
		expect(lastMsg!.content).toBe(VALID_OUTPUT.userFacingMessage);

		// Only one LLM call — no repair needed.
		expect(mock.requests.length).toBe(1);
	});

	// ── Repair: invalid first → valid second ───────────────────────

	it('retries once when the first LLM response is invalid and the second is valid', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([INVALID_OUTPUT, VALID_OUTPUT]);
		const registry = new PromptRegistry();

		const result = await generateAgentTurn(
			state,
			nodeId,
			profile,
			mock,
			registry,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Assistant message should be the VALID one, not the INVALID one.
		const nodeState = result.state.nodeStates[nodeId];
		const lastMsg = nodeState!.conversation[nodeState!.conversation.length - 1];
		expect(lastMsg!.content).toBe(VALID_OUTPUT.userFacingMessage);

		// Two LLM calls: original + 1 repair.
		expect(mock.requests.length).toBe(2);
	});

	// ── Exhausted repair attempts ──────────────────────────────────

	it('returns a recoverable error when all repair attempts produce invalid output', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([
			INVALID_OUTPUT,
			INVALID_OUTPUT,
			INVALID_OUTPUT,
			INVALID_OUTPUT,
		]);
		const registry = new PromptRegistry();

		const result = await generateAgentTurn(
			state,
			nodeId,
			profile,
			mock,
			registry,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;

		// Error message should mention repair exhaustion.
		expect(result.error).toContain('Repair failed');
		expect(result.error).toContain('3/3');

		// Should have made 4 calls: 1 original + 3 repair attempts.
		expect(mock.requests.length).toBe(4);
	});

	// ── State not mutated on repair failure ────────────────────────

	it('does not mutate node state when repair fails', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([
			INVALID_OUTPUT,
			INVALID_OUTPUT,
			INVALID_OUTPUT,
			INVALID_OUTPUT,
		]);
		const registry = new PromptRegistry();

		const convoBefore = state.nodeStates[nodeId]!.conversation.length;
		const lifecycleBefore = state.nodeStates[nodeId]!.lifecycle;

		const result = await generateAgentTurn(
			state,
			nodeId,
			profile,
			mock,
			registry,
		);

		expect(result.ok).toBe(false);

		// State should be completely unchanged.
		expect(state.nodeStates[nodeId]!.conversation.length).toBe(convoBefore);
		expect(state.nodeStates[nodeId]!.lifecycle).toBe(lifecycleBefore);
	});

	// ── Provider exception — no repair attempted ──────────────────

	it('returns an error immediately when the provider throws', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();

		const throwingMock: LlmProvider = {
			async generateStructuredOutput(_request) {
				throw new Error('Network timeout');
			},
		};
		const registry = new PromptRegistry();

		const result = await generateAgentTurn(
			state,
			nodeId,
			profile,
			throwingMock,
			registry,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;

		expect(result.error).toContain('LLM provider failed');
		expect(result.error).toContain('Network timeout');
	});

	// ── Repair request includes validation errors ──────────────────

	it('sends a repair request with validation errors on the second call', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([INVALID_OUTPUT, VALID_OUTPUT]);
		const registry = new PromptRegistry();

		await generateAgentTurn(state, nodeId, profile, mock, registry);

		expect(mock.requests.length).toBe(2);

		// The second request should be a repair request.
		const repairRequest = mock.requests[1]!;

		// Repair mode indicators.
		expect(repairRequest.systemPrompt).toContain('Repair Mode');
		expect(repairRequest.systemPrompt).toContain(
			'Your previous output failed validation. Fix these errors:',
		);

		// Should contain the specific validation error (empty userFacingMessage).
		expect(repairRequest.systemPrompt).toContain('too_small');
		expect(repairRequest.systemPrompt).toContain('userFacingMessage');

		// Repair guard rules.
		const repairMsg =
			repairRequest.messages[repairRequest.messages.length - 1]!;
		expect(repairMsg.content).toContain('Do not re-ask the original task.');
		expect(repairMsg.content).toContain(
			'Return only a corrected structured output conforming to the schema.',
		);

		// Repair metadata.
		expect(repairRequest.metadata?.repairAttempt).toBe(1);
	});

	// ── Repair request preserves original context ──────────────────

	it('preserves the original system prompt in the repair request', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([INVALID_OUTPUT, VALID_OUTPUT]);
		const registry = new PromptRegistry();

		await generateAgentTurn(state, nodeId, profile, mock, registry);

		const firstRequest = mock.requests[0]!;
		const repairRequest = mock.requests[1]!;

		// The repair request should still contain the original system prompt.
		expect(repairRequest.systemPrompt).toContain(firstRequest.systemPrompt);
	});

	// ── Repair request preserves original messages ─────────────────

	it('preserves the original messages in the repair request and appends repair instruction', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		const mock = new CallSequenceMockProvider([INVALID_OUTPUT, VALID_OUTPUT]);
		const registry = new PromptRegistry();

		await generateAgentTurn(state, nodeId, profile, mock, registry);

		const firstRequest = mock.requests[0]!;
		const repairRequest = mock.requests[1]!;

		// Original messages are preserved.
		expect(repairRequest.messages.length).toBe(
			firstRequest.messages.length + 1,
		);

		for (let i = 0; i < firstRequest.messages.length; i++) {
			expect(repairRequest.messages[i]).toEqual(firstRequest.messages[i]);
		}

		// The last message is the repair instruction.
		const lastMsg = repairRequest.messages[repairRequest.messages.length - 1]!;
		expect(lastMsg.role).toBe('user');
		expect(lastMsg.content).toContain('Your previous output failed validation');
	});

	// ── Multiple repair attempts accumulate metadata ───────────────

	it('increments repairAttempt metadata across multiple repair calls', async () => {
		const { profile, nodeId, state } = setupActiveNodeState();
		// Invalid twice, then valid on third.
		const mock = new CallSequenceMockProvider([
			INVALID_OUTPUT,
			INVALID_OUTPUT,
			VALID_OUTPUT,
		]);
		const registry = new PromptRegistry();

		const result = await generateAgentTurn(
			state,
			nodeId,
			profile,
			mock,
			registry,
		);

		expect(result.ok).toBe(true);
		expect(mock.requests.length).toBe(3);

		// Second request (first repair).
		expect(mock.requests[1]!.metadata?.repairAttempt).toBe(1);

		// Third request (second repair).
		expect(mock.requests[2]!.metadata?.repairAttempt).toBe(2);
	});
});
