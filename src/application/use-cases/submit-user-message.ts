/**
 * Submit-user-message use case — orchestrates user message submission
 * and the full agent turn pipeline.
 *
 * When a user submits an answer in the conversation panel:
 * 1. Dispatch `USER_MESSAGE_ADDED` — appends user message, transitions
 *    lifecycle (e.g., `not_started` → `active`).
 * 2. Select the appropriate prompt for the new lifecycle.
 * 3. Assemble `LlmRequest` with conversation context.
 * 4. Generate `AgentTurnOutput` via the LLM provider.
 * 5. Validate the output via `validateAgentTurnOutput`.
 * 6. Apply the agent turn (append assistant message, apply lifecycle
 *    transitions, store canonical drafts, etc.).
 * 7. Build a `TuiRenderSnapshot` for the TUI.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.3, §4.1}
 */
import type { AgentTurnOutput } from '../../contracts/agent-turn.js';
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import type { LlmProvider } from '../../llm/index.js';
import {
	assemblePromptRequest,
	type LlmRequest,
} from '../../prompt-orchestration/prompt-assembler.js';
import type { PromptRegistry } from '../../prompt-orchestration/prompt-registry.js';
import { selectPrompt } from '../../prompt-orchestration/prompt-selector.js';
import type { NodeId } from '../../shared/index.js';
import { getAllowedActions } from '../../state-engine/allowed-actions.js';
import { dispatch } from '../../state-engine/dispatch.js';
import { buildSnapshot } from '../../state-engine/snapshot-builder.js';
import type { StateDiagnostic } from '../../state-engine/types.js';
import { validateAgentTurnOutput } from '../../validation/agent-turn-validator.js';
import { applyAgentTurn } from '../apply-agent-turn.js';
import { buildRenderSnapshot } from '../render-model-builder.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of the submit-user-message use case.
 */
export type SubmitUserMessageResult =
	| {
			readonly ok: true;
			readonly state: LogosRuntimeState;
			readonly snapshot: TuiRenderSnapshot;
			readonly diagnostics: StateDiagnostic[];
	  }
	| {
			readonly ok: false;
			readonly error: string;
			readonly diagnostics: StateDiagnostic[];
	  };

/**
 * Options for `submitUserMessageUseCase`.
 */
export type SubmitUserMessageOptions = {
	/** The content of the user's message. */
	readonly content: string;

	/** The node the message belongs to (defaults to `state.activeNodeId`). */
	readonly nodeId?: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;

	/** LLM provider for generating the agent response. */
	readonly llmProvider: LlmProvider;

	/** Prompt registry for prompt selection + assembly. */
	readonly promptRegistry: PromptRegistry;
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an agent turn after the user message has been processed.
 *
 * Builds the LLM request based on the node's current state, calls the
 * provider, validates the output, and applies it to state.
 */
async function generateAgentTurn(
	state: LogosRuntimeState,
	nodeId: NodeId,
	profile: LogosProfile,
	llmProvider: LlmProvider,
	promptRegistry: PromptRegistry,
): Promise<
	{ ok: true; state: LogosRuntimeState } | { ok: false; error: string }
> {
	const nodeState = state.nodeStates[nodeId];
	if (!nodeState) {
		return {
			error: `Node "${nodeId}" has no runtime state.`,
			ok: false as const,
		};
	}

	const nodeDef = profile.nodes.find((n) => n.id === nodeId);
	if (!nodeDef) {
		return {
			error: `Node "${nodeId}" not found in profile "${profile.id}".`,
			ok: false as const,
		};
	}

	// ── 1. Select prompt based on current lifecycle ──────────────────
	const selectedPrompt = selectPrompt(
		nodeState,
		nodeDef,
		profile,
		promptRegistry,
	);
	if (!selectedPrompt) {
		return {
			error: `No prompt found for node "${nodeId}" in lifecycle "${nodeState.lifecycle}".`,
			ok: false as const,
		};
	}

	// ── Gather accepted dependency answers for context ───────────────
	const acceptedDeps = [];
	for (const depId of nodeState.dependencies.requiredNodeIds) {
		const depState = state.nodeStates[depId];
		if (depState?.canonicalAnswer && depState.lifecycle === 'accepted') {
			acceptedDeps.push(depState.canonicalAnswer);
		}
	}

	// ── 2. Use explicit allowed actions (consistent with select-node) ──
	const currentActions =
		nodeState.allowedActions.length > 0
			? nodeState.allowedActions
			: getAllowedActions(nodeState.lifecycle);

	// ── 2.5 Count clarification/refinement rounds (Step 10.2) ──────
	//
	// Derive round counts from assistant message metadata.
	// These inform the LLM when it's time to offer fallback options
	// (after 3+ rounds without resolution).
	let clarificationRound = 0;
	let refinementRound = 0;

	for (const msg of nodeState.conversation) {
		if (msg.role !== 'assistant') continue;
		const ps = msg.metadata?.promptState;
		if (ps === 'clarification') clarificationRound++;
		if (ps === 'refinement') refinementRound++;
	}

	// If the current lifecycle is needs_clarification/needs_refinement,
	// this turn is the next round (the engine already transitioned there).
	if (nodeState.lifecycle === 'needs_clarification') clarificationRound++;
	if (nodeState.lifecycle === 'needs_refinement') refinementRound++;

	// ── 3. Assemble the LLM request ──────────────────────────────────
	const request = assemblePromptRequest({
		acceptedDependencies: acceptedDeps,
		allowedActions: currentActions,
		conversationContext: nodeState.conversation,
		globalContext: state.globalContext,
		nodeDefinition: nodeDef,
		nodeRuntimeState: nodeState,
		selectedPrompt,
	});

	// ── 3. Inject node + lifecycle metadata ─────────────────────────
	const enrichedRequest: LlmRequest = {
		...request,
		metadata: {
			...(request.metadata ?? {}),
			canonicalQuestion: nodeDef.canonicalQuestion,
			clarificationRound,
			lifecycle: nodeState.lifecycle,
			nodeId,
			nodeTitle: nodeDef.title,
			promptState: nodeState.promptState,
			refinementRound,
		},
	};

	// ── 4. Call LLM ─────────────────────────────────────────────────
	let output: AgentTurnOutput;
	try {
		output = await llmProvider.generateStructuredOutput(enrichedRequest);
	} catch (e) {
		return {
			error: `LLM provider failed: ${e instanceof Error ? e.message : String(e)}`,
			ok: false as const,
		};
	}

	// ── 5. Validate ─────────────────────────────────────────────────
	const validationResult = validateAgentTurnOutput(output, {
		currentLifecycle: nodeState.lifecycle,
	});
	if (!validationResult.ok) {
		return {
			error: `LLM output validation failed: ${validationResult.error.map((e) => e.message).join('; ')}`,
			ok: false as const,
		};
	}

	// ── 6. Apply agent turn (full pipeline — lifecycle transitions
	//    are allowed here, unlike the initial question case) ─────────
	const applyResult = applyAgentTurn(
		state,
		nodeId,
		validationResult.value,
		profile,
	);

	if (!applyResult.ok) {
		return {
			error: `Failed to apply agent turn: ${applyResult.error}`,
			ok: false as const,
		};
	}

	return {
		ok: true as const,
		state: applyResult.state,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Submit a user message and generate the agent's response.
 *
 * Pipeline:
 * 1. Dispatch `USER_MESSAGE_ADDED` → appends user message, transitions
 *    lifecycle (`not_started` → `active`, etc.).
 * 2. Select prompt, assemble request, call LLM, validate, apply turn.
 * 3. Build `TuiRenderSnapshot`.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Message content, node ID, profile, LLM provider, registry.
 * @returns A `SubmitUserMessageResult` with updated state and render snapshot.
 */
export async function submitUserMessageUseCase(
	state: LogosRuntimeState,
	options: SubmitUserMessageOptions,
): Promise<SubmitUserMessageResult> {
	const { content, profile, llmProvider, promptRegistry } = options;
	const rawTarget = options.nodeId ?? state.activeNodeId;

	if (rawTarget === null) {
		return {
			diagnostics: [],
			error: 'No active node selected for user message.',
			ok: false as const,
		};
	}

	// ── Step 1: Dispatch USER_MESSAGE_ADDED ────────────────────────
	const targetNodeId: NodeId = rawTarget as NodeId;

	const userResult = dispatch(
		state,
		{
			content,
			nodeId: targetNodeId,
			type: 'USER_MESSAGE_ADDED',
		},
		profile,
	);

	if (!userResult.ok) {
		return {
			diagnostics: userResult.diagnostics,
			error: userResult.error,
			ok: false as const,
		};
	}

	let nextState = userResult.state;
	const userDiags = userResult.snapshot?.diagnostics ?? [];
	const allDiags: StateDiagnostic[] = [...userDiags];

	// ── Step 2: Generate agent turn ─────────────────────────────────
	const agentResult = await generateAgentTurn(
		nextState,
		targetNodeId,
		profile,
		llmProvider,
		promptRegistry,
	);

	if (!agentResult.ok) {
		// User message was processed but agent turn failed.
		// Return the state with user message appended.
		const snapshot = buildRenderSnapshot(
			userResult.snapshot ?? buildSnapshot(nextState, profile),
			profile,
		);
		return {
			diagnostics: [
				...allDiags,
				{
					code: 'LOGOS_SUBMIT_AGENT_FAIL',
					message: agentResult.error,
					severity: 'warning' as const,
				},
			],
			ok: true as const,
			snapshot,
			state: nextState,
		};
	}

	nextState = agentResult.state;

	// ── Step 3: Build render snapshot ───────────────────────────────
	const snapshot = buildRenderSnapshot(
		buildSnapshot(nextState, profile),
		profile,
	);

	return {
		diagnostics: allDiags,
		ok: true as const,
		snapshot,
		state: nextState,
	};
}
