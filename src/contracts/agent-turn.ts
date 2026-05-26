/**
 * Agent turn output contract — the structured output every LLM-generated
 * turn must produce so the state engine can validate and apply
 * deterministic transitions.
 *
 * The LLM proposes structured data; the state engine disposes — it validates,
 * accepts, rejects, or overrides every proposal before mutating state.
 *
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md}
 */
import type { CanonicalAnswerDraft } from './canonical-answer.js';
import type { CompletenessState, ExtractedNodeData } from './completeness.js';
import type { NodeAction, NodeLifecycle, PromptState } from './node-state.js';

// ─── TransitionEvent ────────────────────────────────────────────────────────

/**
 * Events the LLM may propose as a transition intent.
 *
 * The state engine validates whether the proposed event is legal given the
 * current node lifecycle and may accept, reject, or override it.
 *
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md §8}
 */
export type TransitionEvent =
	| 'ASKED_INITIAL'
	| 'USER_ANSWER_EVALUATED'
	| 'CLARIFICATION_REQUESTED'
	| 'REFINEMENT_REQUESTED'
	| 'SYNTHESIS_PROPOSED'
	| 'REVIEW_REQUESTED'
	| 'NODE_BLOCKED'
	| 'NODE_READY_FOR_ACCEPTANCE';

// ─── TransitionIntent ───────────────────────────────────────────────────────

/**
 * A proposed lifecycle transition from the LLM.
 *
 * The event is validated against the current node lifecycle by the state
 * engine. `reason` provides a human-readable justification for diagnostics
 * and audit.
 */
export type TransitionIntent = {
	/** The transition event the LLM proposes. */
	readonly event: TransitionEvent;

	/** Human-readable justification for the transition. */
	readonly reason: string;
};

// ─── AgentDiagnostic ────────────────────────────────────────────────────────

/**
 * Optional diagnostic information attached to an agent turn.
 *
 * Used for tracing, debugging, and error reporting. The full diagnostic
 * reporting system is defined in Phase 14.
 */
export type AgentDiagnostic = {
	/** Machine-readable diagnostic code. */
	readonly code: string;

	/** Human-readable diagnostic message. */
	readonly message: string;

	/** Severity level. */
	readonly severity: 'info' | 'warning' | 'error';

	/** Optional structured details (e.g., fragment offsets, token counts). */
	readonly details?: Record<string, unknown>;
};

// ─── AgentTurnOutput ────────────────────────────────────────────────────────

/**
 * The structured output returned by every LLM agent turn.
 *
 * `userFacingMessage` is the only required field — all other fields are
 * optional and context-dependent. The state engine validates the proposal
 * before applying any effects.
 *
 * Validation rules (enforced by the state engine, not the type system):
 * - `userFacingMessage` MUST be non-empty for a valid turn.
 * - `proposedLifecycle` MUST be a legal transition from the current lifecycle.
 * - `canonicalAnswerDraft` MUST only be proposed during synthesis/review states.
 * - `suggestedActions` MUST be compatible with the proposed lifecycle.
 *
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md §3}
 */
export type AgentTurnOutput = {
	/**
	 * The conversational message displayed to the user.
	 *
	 * REQUIRED. Must be non-empty for valid output.
	 */
	readonly userFacingMessage: string;

	/**
	 * The lifecycle state the LLM proposes for the node after this turn.
	 *
	 * Must be a valid transition from the current lifecycle.
	 */
	readonly proposedLifecycle?: NodeLifecycle;

	/**
	 * The prompt state the LLM proposes for the next turn.
	 */
	readonly proposedPromptState?: PromptState;

	/**
	 * A draft canonical answer, proposed during synthesis/review states.
	 *
	 * `null` indicates the LLM has not produced an answer draft.
	 */
	readonly canonicalAnswerDraft?: CanonicalAnswerDraft | null;

	/**
	 * Completeness evaluation against the node's coverage topics.
	 */
	readonly completenessEvaluation?: CompletenessState;

	/**
	 * Structured semantic data extracted from the conversation
	 * (facts, assumptions, decisions, risks, open questions).
	 */
	readonly extracted?: ExtractedNodeData;

	/**
	 * Actions the LLM suggests the user may take next.
	 *
	 * The state engine filters these and is the final authority on
	 * which actions are actually allowed.
	 */
	readonly suggestedActions?: NodeAction[];

	/**
	 * A proposed lifecycle transition event and rationale.
	 */
	readonly transitionIntent?: TransitionIntent | null;

	/**
	 * Optional diagnostic information for tracing and debugging.
	 */
	readonly diagnostics?: AgentDiagnostic[];
};
