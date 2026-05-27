/**
 * Edit canonical answer use case — appends the user's correction as a
 * message, marks the existing draft stale, and regenerates via the LLM.
 *
 * Pipeline:
 * 1. Guard: active node exists, lifecycle is `synthesized`, canonical
 *    answer exists.
 * 2. Dispatch `USER_MESSAGE_ADDED` — appends the user's edit/correction
 *    as a user message (for source traceability in `generatedFromMessageIds`).
 * 3. Call `regenerateCanonicalAnswer()` to mark existing draft stale.
 * 4. Run `generateAgentTurn()` → LLM produces a new draft incorporating
 *    the edit.
 * 5. Build `TuiRenderSnapshot` for the TUI.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.7, §4.4 step 2-3}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import { regenerateCanonicalAnswer } from '../../conversation-runtime/canonical-answers.js';
import { appendUserMessage } from '../../conversation-runtime/messages.js';
import type { LlmProvider } from '../../llm/index.js';
import type { PromptRegistry } from '../../prompt-orchestration/prompt-registry.js';
import type { NodeId } from '../../shared/index.js';
import { buildSnapshot } from '../../state-engine/snapshot-builder.js';
import type { StateDiagnostic } from '../../state-engine/types.js';
import { generateAgentTurn } from '../generate-agent-turn.js';
import { buildRenderSnapshot } from '../render-model-builder.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of the edit-canonical-answer use case.
 */
export type EditCanonicalAnswerResult =
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
 * Options for `editCanonicalAnswerUseCase`.
 */
export type EditCanonicalAnswerOptions = {
	/** The user's correction/edit content. */
	readonly content: string;

	/** The node whose canonical answer to edit (defaults to active node). */
	readonly nodeId?: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;

	/** LLM provider for regenerating the draft. */
	readonly llmProvider: LlmProvider;

	/** Prompt registry for prompt selection + assembly. */
	readonly promptRegistry: PromptRegistry;
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Edit a canonical answer — append the user's correction and regenerate.
 *
 * Guards:
 * - An active node must be selected.
 * - The node lifecycle must be `synthesized`.
 * - The node must have an existing canonical answer (not null).
 *
 * Effects:
 * - The user's edit is appended as a user message for traceability.
 * - The existing canonical answer is marked stale (preserved for audit).
 * - A new agent turn is generated (LLM pipeline → new draft).
 * - The `generatedFromMessageIds` on the new draft includes the edit
 *   message ID.
 * - The node stays in `synthesized` lifecycle.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Edit content, node ID, profile, LLM provider, registry.
 * @returns An `EditCanonicalAnswerResult` with updated state and snapshot.
 */
export async function editCanonicalAnswerUseCase(
	state: LogosRuntimeState,
	options: EditCanonicalAnswerOptions,
): Promise<EditCanonicalAnswerResult> {
	const { content, profile, llmProvider, promptRegistry } = options;
	const targetNodeId: NodeId | null = options.nodeId ?? state.activeNodeId;

	if (targetNodeId === null) {
		return {
			diagnostics: [],
			error: 'No active node selected for edit.',
			ok: false as const,
		};
	}

	// ── Step 0: Pre-guards — validate lifecycle and canonical answer ─
	const nodeState = state.nodeStates[targetNodeId];
	if (!nodeState) {
		return {
			diagnostics: [],
			error: `Node "${targetNodeId}" has no runtime state.`,
			ok: false as const,
		};
	}

	if (nodeState.lifecycle !== 'synthesized') {
		return {
			diagnostics: [],
			error: `Cannot edit: lifecycle is "${nodeState.lifecycle}", must be "synthesized".`,
			ok: false as const,
		};
	}

	if (!nodeState.canonicalAnswer) {
		return {
			diagnostics: [],
			error: `Cannot edit: node "${targetNodeId}" has no canonical answer.`,
			ok: false as const,
		};
	}

	// ── Step 1: Append user edit as a user message ──────────────────
	// Use `appendUserMessage` directly (not dispatch) because
	// `USER_MESSAGE_ADDED` is guarded against `synthesized` lifecycle.
	// The edit message preserves traceability: its ID will appear in
	// the regenerated draft's `generatedFromMessageIds`.
	const userMsgResult = appendUserMessage(state, targetNodeId, content);
	if (!userMsgResult.ok) {
		return {
			diagnostics: userMsgResult.diagnostics ?? [],
			error: userMsgResult.error,
			ok: false as const,
		};
	}

	let afterUser = userMsgResult.state;
	const allDiags: StateDiagnostic[] = [];

	// ── Step 2: Mark existing canonical answer stale ───────────────
	const staleResult = regenerateCanonicalAnswer(afterUser, targetNodeId);
	if (!staleResult.ok) {
		return {
			diagnostics: staleResult.diagnostics ?? [],
			error: staleResult.error,
			ok: false as const,
		};
	}

	afterUser = staleResult.state;

	// ── Step 3: Run agent turn pipeline to produce new draft ───────
	const agentResult = await generateAgentTurn(
		afterUser,
		targetNodeId,
		profile,
		llmProvider,
		promptRegistry,
	);

	if (!agentResult.ok) {
		const snapshot = buildRenderSnapshot(
			buildSnapshot(afterUser, profile),
			profile,
		);
		return {
			diagnostics: [
				...allDiags,
				{
					code: 'LOGOS_EDIT_AGENT_FAIL',
					message: agentResult.error,
					severity: 'warning' as const,
				},
			],
			ok: true as const,
			snapshot,
			state: afterUser,
		};
	}

	const finalState = agentResult.state;

	// ── Step 4: Build render snapshot ──────────────────────────────
	const snapshot = buildRenderSnapshot(
		buildSnapshot(finalState, profile),
		profile,
	);

	return {
		diagnostics: allDiags,
		ok: true as const,
		snapshot,
		state: finalState,
	};
}
