/**
 * Completeness and extracted data types.
 *
 * Completeness evaluation determines whether a node conversation has produced
 * sufficient quality to synthesise a canonical answer.
 *
 * Extracted data captures facts, assumptions, decisions, risks, and open
 * questions surfaced during the conversation.
 *
 * @see {@link https://logos-engine/docs/11-conversation-quality-and-completeness.md}
 */

// ─── CompletenessState ──────────────────────────────────────────────────────

/**
 * Evaluates whether a node's conversation meets the coverage and quality
 * threshold required for synthesis.
 *
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §9}
 */
export type CompletenessState = {
	/** `true` only when all required coverage topics are `"sufficient"`. */
	readonly complete: boolean;

	/** Per-topic coverage evaluation. */
	readonly coverage: Record<string, 'missing' | 'weak' | 'sufficient'>;

	/** Topics that have not been addressed at all. */
	readonly missing: string[];

	/** Topics addressed vaguely, generically, or inconsistently. */
	readonly weak: string[];

	/**
	 * Issues that block synthesis regardless of coverage —
	 * contradictions, unresolved ambiguity, missing prerequisites.
	 */
	readonly blockingIssues: string[];
};

// ─── ExtractedNodeData ──────────────────────────────────────────────────────

/**
 * Semantic data extracted from the node conversation by the LLM or
 * deterministic heuristics.
 *
 * This structured metadata supports staleness detection, downstream
 * dependency evaluation, and document cross-referencing.
 */
export type ExtractedNodeData = {
	/** Factual statements surfaced during the conversation. */
	readonly facts: string[];

	/** Claims marked as assumptions (unverified). */
	readonly assumptions: string[];

	/** Decisions explicitly made by the user during this node's conversation. */
	readonly decisions: string[];

	/** Risks identified during the conversation. */
	readonly risks: string[];

	/** Questions that remain open and may need resolution. */
	readonly openQuestions: string[];
};
