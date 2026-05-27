/**
 * Shared agent-turn generator — orchestrates prompt selection, LLM call,
 * validation, and state application for a single agent turn.
 *
 * Extracted from `submit-user-message.ts` so synthesis/regeneration use
 * cases can reuse the same pipeline without duplicating 150+ lines of
 * orchestration logic.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.1, §4.4}
 */
import type { AgentTurnOutput } from '../contracts/agent-turn.js';
import type {
	LogosProfile,
	LogosRuntimeState,
} from '../contracts/index.js';
import type { LlmProvider } from '../llm/index.js';
import {
	assemblePromptRequest,
	type LlmRequest,
} from '../prompt-orchestration/prompt-assembler.js';
import type { PromptRegistry } from '../prompt-orchestration/prompt-registry.js';
import { selectPrompt } from '../prompt-orchestration/prompt-selector.js';
import type { NodeId } from '../shared/index.js';
import { getAllowedActions } from '../state-engine/allowed-actions.js';
import { validateAgentTurnOutput } from '../validation/agent-turn-validator.js';
import { applyAgentTurn } from './apply-agent-turn.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an agent turn — the full pipeline from prompt selection through
 * LLM generation, validation, and state application.
 *
 * Pipeline:
 * 1. Select prompt based on node lifecycle.
 * 2. Gather accepted dependency answers for context.
 * 3. Count clarification/refinement rounds.
 * 4. Assemble LLM request with conversation context.
 * 5. Call LLM provider.
 * 6. Validate `AgentTurnOutput`.
 * 7. Apply agent turn (append message, apply lifecycle, store drafts).
 *
 * @param state           - The current runtime state (not mutated).
 * @param nodeId          - The target node for the agent turn.
 * @param profile         - The loaded `LogosProfile`.
 * @param llmProvider     - LLM provider for generation.
 * @param promptRegistry  - Prompt registry for selection + assembly.
 * @returns Updated state on success, or error on failure.
 */
export async function generateAgentTurn(
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
	let clarificationRound = 0;
	let refinementRound = 0;

	for (const msg of nodeState.conversation) {
		if (msg.role !== 'assistant') continue;
		const ps = msg.metadata?.promptState;
		if (ps === 'clarification') clarificationRound++;
		if (ps === 'refinement') refinementRound++;
	}

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
