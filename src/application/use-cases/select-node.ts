/**
 * Select-node use case — orchestrates node selection and initial question
 * generation for `not_started` nodes.
 *
 * When a node has never been opened (`not_started`, empty conversation),
 * this use case automatically generates the initial agent question from
 * the node's canonical question so the user sees it immediately after
 * selection. The node remains `not_started` until the user answers.
 *
 * Pipeline:
 * 1. Dispatch `SELECT_NODE` → state engine initialises `NodeRuntimeState`.
 * 2. If node is `not_started` and has no messages:
 *    a. Select `initial` prompt via the prompt orchestrator.
 *    b. Assemble `LlmRequest` with node context + accepted dependencies.
 *    c. Inject canonical question + node metadata into request.
 *    d. Generate raw output via the LLM provider.
 *    e. Sanitise output for initial question: preserve only
 *       `userFacingMessage` (and `diagnostics`), strip lifecycle/actions.
 *    f. Validate the sanitised output via `validateAgentTurnOutput`.
 *    g. Apply agent turn: append assistant message, keep `not_started`.
 * 3. Build a `TuiRenderSnapshot` for the TUI.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.3}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.1}
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
 * Result of the select-node use case.
 */
export type SelectNodeResult =
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
 * Options for `selectNodeUseCase`.
 */
export type SelectNodeOptions = {
	/** The node to select. */
	readonly nodeId: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;

	/** LLM provider (must be the abstraction, not mock concrete). */
	readonly llmProvider: LlmProvider;

	/** Prompt registry. */
	readonly promptRegistry: PromptRegistry;
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate the initial agent question for a `not_started` node.
 *
 * Returns the updated state on success; errors are non-fatal and
 * result in the node being selected without initial question.
 */
async function generateInitialQuestion(
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

	// ── 1. Select the `initial` prompt ───────────────────────────────
	const selectedPrompt = selectPrompt(
		nodeState,
		nodeDef,
		profile,
		promptRegistry,
	);
	if (!selectedPrompt) {
		return {
			error: `No "initial" prompt found for node "${nodeId}".`,
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

	// ── 2. Use explicit allowed actions (SELECT_NODE leaves them empty) ──
	const initialActions = getAllowedActions('not_started');

	// ── 3. Assemble the LLM request ──────────────────────────────────
	const request = assemblePromptRequest({
		acceptedDependencies: acceptedDeps,
		allowedActions: initialActions,
		conversationContext: nodeState.conversation,
		globalContext: state.globalContext,
		nodeDefinition: nodeDef,
		nodeRuntimeState: nodeState,
		selectedPrompt,
	});

	// ── 4. Inject node-specific metadata for the mock provider ───────
	const enrichedRequest: LlmRequest = {
		...request,
		metadata: {
			...(request.metadata ?? {}),
			canonicalQuestion: nodeDef.canonicalQuestion,
			lifecycle: 'not_started',
			nodeId,
			nodeTitle: nodeDef.title,
			promptState: 'initial',
		},
	};

	// ── 5. Call LLM ─────────────────────────────────────────────────
	let output: AgentTurnOutput;
	try {
		output = await llmProvider.generateStructuredOutput(enrichedRequest);
	} catch (e) {
		return {
			error: `LLM provider failed: ${e instanceof Error ? e.message : String(e)}`,
			ok: false as const,
		};
	}

	// ── 6. Sanitise for initial question: keep only userFacingMessage ─
	//    Strip lifecycle, prompt state, suggested actions, drafts, etc.
	//    The initial question must NOT transition away from not_started.
	const sanitisedOutput: AgentTurnOutput = {
		userFacingMessage: output.userFacingMessage,
		...(output.diagnostics !== undefined
			? { diagnostics: output.diagnostics }
			: {}),
	};

	// ── 7. Validate the sanitised output ─────────────────────────────
	const validationResult = validateAgentTurnOutput(sanitisedOutput, {
		currentLifecycle: 'not_started',
	});
	if (!validationResult.ok) {
		return {
			error: `LLM output validation failed: ${validationResult.error.map((e) => e.message).join('; ')}`,
			ok: false as const,
		};
	}

	// ── 8. Apply agent turn (only appends assistant message) ─────────
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

	return { ok: true as const, state: applyResult.state };
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Select a node for focused conversation.
 *
 * If the node is `not_started` and has no conversation history, this
 * function automatically generates the initial agent question so the
 * user sees it immediately. The node lifecycle remains `not_started`
 * until the user sends their first answer.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Selection options (nodeId, profile, llmProvider, promptRegistry).
 * @returns A `SelectNodeResult` with the updated state and a `TuiRenderSnapshot`.
 */
export async function selectNodeUseCase(
	state: LogosRuntimeState,
	options: SelectNodeOptions,
): Promise<SelectNodeResult> {
	const { nodeId, profile, llmProvider, promptRegistry } = options;

	// ── Step 1: Dispatch SELECT_NODE ────────────────────────────────
	const selectResult = dispatch(
		state,
		{ nodeId, type: 'SELECT_NODE' },
		profile,
	);

	if (!selectResult.ok) {
		return {
			diagnostics: selectResult.diagnostics,
			error: selectResult.error,
			ok: false as const,
		};
	}

	let nextState = selectResult.state;

	// ── Gather diagnostics from the selection result's snapshot ──────
	const selectDiags = selectResult.snapshot?.diagnostics ?? [];

	// ── Step 2: Generate initial question if not_started + empty ─────
	const nodeState = nextState.nodeStates[nodeId];
	const allDiags: StateDiagnostic[] = [...selectDiags];

	if (
		nodeState &&
		nodeState.lifecycle === 'not_started' &&
		nodeState.conversation.length === 0
	) {
		const agentResult = await generateInitialQuestion(
			nextState,
			nodeId,
			profile,
			llmProvider,
			promptRegistry,
		);

		if (!agentResult.ok) {
			// Even if agent turn fails, the node was successfully
			// selected — return the selection result with a warning.
			const snapshot = buildRenderSnapshot(
				selectResult.snapshot ?? buildSnapshot(nextState, profile),
				profile,
			);
			return {
				diagnostics: [
					...allDiags,
					{
						code: 'LOGOS_SELECT_AGENT_FAIL',
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
	}

	// ── Step 3: Build render snapshot ────────────────────────────────
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
