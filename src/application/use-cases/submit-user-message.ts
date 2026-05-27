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
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import type { LlmProvider } from '../../llm/index.js';
import type { PromptRegistry } from '../../prompt-orchestration/prompt-registry.js';
import type { NodeId } from '../../shared/index.js';
import { dispatch } from '../../state-engine/dispatch.js';
import { buildSnapshot } from '../../state-engine/snapshot-builder.js';
import type { StateDiagnostic } from '../../state-engine/types.js';
import { generateAgentTurn } from '../generate-agent-turn.js';
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
