/**
 * Regenerate canonical answer use case — marks the existing draft stale
 * and runs the full agent-turn pipeline to produce a replacement draft.
 *
 * Pipeline:
 * 1. Guard: active node exists, lifecycle is `synthesized`, canonical
 *    answer exists.
 * 2. Call `regenerateCanonicalAnswer()` to mark existing draft stale.
 * 3. Run the shared `generateAgentTurn()` pipeline → LLM produces a new
 *    draft via the `synthesis`/`review` prompt.
 * 4. Build `TuiRenderSnapshot` for the TUI.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.7, §4.4 step 3}
 */
import type {
	LogosProfile,
	LogosRuntimeState,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import { regenerateCanonicalAnswer } from '../../conversation-runtime/canonical-answers.js';
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
 * Result of the regenerate-canonical-answer use case.
 */
export type RegenerateCanonicalAnswerResult =
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
 * Options for `regenerateCanonicalAnswerUseCase`.
 */
export type RegenerateCanonicalAnswerOptions = {
	/** The node whose canonical answer to regenerate (defaults to active node). */
	readonly nodeId?: NodeId;

	/** The loaded profile. */
	readonly profile: LogosProfile;

	/** LLM provider for generating the new draft. */
	readonly llmProvider: LlmProvider;

	/** Prompt registry for prompt selection + assembly. */
	readonly promptRegistry: PromptRegistry;
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Regenerate a canonical answer — mark the existing draft stale and
 * produce a new draft via the LLM.
 *
 * Guards:
 * - An active node must be selected.
 * - The node lifecycle must be `synthesized`.
 * - The node must have an existing canonical answer (not null).
 *
 * Effects:
 * - The existing canonical answer is marked stale (preserved for audit).
 * - A new agent turn is generated (LLM pipeline → new draft).
 * - The node stays in `synthesized` lifecycle.
 * - Allowed actions remain the review set.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Target node ID, profile, LLM provider, and prompt registry.
 * @returns A `RegenerateCanonicalAnswerResult` with updated state and snapshot.
 */
export async function regenerateCanonicalAnswerUseCase(
	state: LogosRuntimeState,
	options: RegenerateCanonicalAnswerOptions,
): Promise<RegenerateCanonicalAnswerResult> {
	const { profile, llmProvider, promptRegistry } = options;
	const targetNodeId: NodeId | null = options.nodeId ?? state.activeNodeId;

	if (targetNodeId === null) {
		return {
			diagnostics: [],
			error: 'No active node selected for regenerate.',
			ok: false as const,
		};
	}

	// ── Step 1: Mark existing canonical answer stale ───────────────
	const staleResult = regenerateCanonicalAnswer(state, targetNodeId);
	if (!staleResult.ok) {
		return {
			diagnostics: staleResult.diagnostics ?? [],
			error: staleResult.error,
			ok: false as const,
		};
	}

	const afterStale = staleResult.state;

	// ── Step 2: Run agent turn pipeline to produce new draft ───────
	const agentResult = await generateAgentTurn(
		afterStale,
		targetNodeId,
		profile,
		llmProvider,
		promptRegistry,
	);

	if (!agentResult.ok) {
		return {
			diagnostics: [
				{
					code: 'LOGOS_REGENERATE_AGENT_FAIL',
					message: agentResult.error,
					severity: 'warning' as const,
				},
			],
			error: agentResult.error,
			ok: false as const,
		};
	}

	const finalState = agentResult.state;

	// ── Step 3: Build render snapshot ──────────────────────────────
	const snapshot = buildRenderSnapshot(
		buildSnapshot(finalState, profile),
		profile,
	);

	return {
		diagnostics: [],
		ok: true as const,
		snapshot,
		state: finalState,
	};
}
