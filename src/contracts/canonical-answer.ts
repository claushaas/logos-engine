/**
 * Canonical answer types — the clean, structured output of a node conversation.
 *
 * A canonical answer is distinct from raw conversation messages. It is the
 * synthesised, reviewable, citable content that feeds into document materialization.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §8}
 */

// ─── CanonicalAnswer ────────────────────────────────────────────────────────

/**
 * A canonical answer that has been synthesised from the node conversation.
 *
 * Once `accepted`, the answer becomes eligible for document materialization.
 * If `stale`, it must be regenerated or explicitly accepted before export.
 */
export type CanonicalAnswer = {
	/** The synthesised content in the specified format. */
	readonly content: string;

	/** Output format — Markdown or machine-readable structured output. */
	readonly format: 'markdown' | 'structured';

	/** ISO-8601 timestamp of when this answer was generated. */
	readonly generatedAt: string;

	/** Source message IDs that this answer was derived from. */
	readonly generatedFromMessageIds: string[];

	/** Confidence level of the synthesis (low / medium / high). */
	readonly confidence: 'low' | 'medium' | 'high';

	/** Whether the user has explicitly accepted this answer. */
	readonly accepted: boolean;

	/**
	 * Whether this answer is stale (outdated due to new information,
	 * reopened node, or upstream dependency changes).
	 */
	readonly stale: boolean;
};

// ─── CanonicalAnswerDraft ───────────────────────────────────────────────────

/**
 * A draft canonical answer proposed by the LLM before user acceptance.
 *
 * Lacks `accepted` and `stale` — those are state-engine-level properties
 * applied when the draft is promoted to a full `CanonicalAnswer`.
 */
export type CanonicalAnswerDraft = {
	/** The proposed content. */
	readonly content: string;

	/** Output format. */
	readonly format: 'markdown' | 'structured';

	/** ISO-8601 timestamp of when this draft was generated. */
	readonly generatedAt: string;

	/** Source message IDs that this draft was derived from. */
	readonly generatedFromMessageIds: string[];

	/** Confidence level of the draft synthesis. */
	readonly confidence: 'low' | 'medium' | 'high';
};
