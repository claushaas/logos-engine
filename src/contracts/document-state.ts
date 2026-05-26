/**
 * Document runtime state, status, draft, and section rule types.
 *
 * Document materialization is a core output path. The document state model
 * defines readiness, staleness, and export eligibility — concepts referenced
 * by the state engine and TUI.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 */
import type { DocumentId, NodeId } from '../shared/index.js';

// ─── DocumentStatus ─────────────────────────────────────────────────────────

/**
 * The 6 possible document readiness states.
 *
 * - `not_ready` — no source nodes are accepted yet.
 * - `partially_ready` — at least one source node is accepted but some
 *   required nodes are still missing, deferred, blocked, or stale.
 * - `ready` — all required source nodes are accepted and non-stale.
 * - `drafted` — a materialized draft has been generated.
 * - `accepted` — the user has accepted the materialized draft.
 * - `stale` — at least one accepted source node's canonical answer is stale
 *   or has been reopened.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md §3}
 */
export type DocumentStatus =
	| 'not_ready'
	| 'partially_ready'
	| 'ready'
	| 'drafted'
	| 'accepted'
	| 'stale';

// ─── DocumentRuntimeState ───────────────────────────────────────────────────

/**
 * Per-document runtime state — tracks readiness, staleness, and the
 * current materialized draft (if any).
 *
 * The state engine recomputes this after every node lifecycle change
 * that affects document sources.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md §3}
 */
export type DocumentRuntimeState = {
	/** Unique document identifier (branded). */
	readonly documentId: DocumentId;

	/** Current readiness status. */
	readonly status: DocumentStatus;

	/** All nodes that contribute content to this document. */
	readonly sourceNodeIds: NodeId[];

	/** Nodes that must be accepted before the document is ready. */
	readonly requiredNodeIds: NodeId[];

	/** Nodes that enhance the document but are not required. */
	readonly optionalNodeIds: NodeId[];

	/** Required nodes that are not yet accepted (subset of `requiredNodeIds`). */
	readonly missingRequiredNodeIds: NodeId[];

	/** Source nodes whose canonical answers are stale. */
	readonly staleSourceNodeIds: NodeId[];

	/** The current materialized draft, or `null` if not yet generated. */
	readonly draft: MaterializedDocumentDraft | null;

	/** ISO-8601 timestamp of the last state mutation for this document. */
	readonly updatedAt: string;
};

// ─── MaterializedDocumentDraft ──────────────────────────────────────────────

/**
 * A materialized draft of a document — generated from accepted canonical
 * answers and assembly rules.
 *
 * Drafts are cachable and mark themselves as stale when source material
 * changes.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md §6}
 */
export type MaterializedDocumentDraft = {
	/** The document this draft belongs to (branded). */
	readonly documentId: DocumentId;

	/** The assembled document content as a string. */
	readonly content: string;

	/** Output format of the draft. */
	readonly format: 'markdown';

	/** ISO-8601 timestamp of when the draft was generated. */
	readonly generatedAt: string;

	/** Nodes whose canonical answers were used to generate this draft. */
	readonly sourceNodeIds: NodeId[];

	/** Section identifiers that could not be filled because source nodes were not ready. */
	readonly missingSections: string[];

	/** Whether the draft is stale (source nodes changed since generation). */
	readonly stale: boolean;
};

// ─── DocumentSectionRule ────────────────────────────────────────────────────

/**
 * A section-level rule that maps source nodes to a specific section
 * within the materialized document.
 *
 * Used at materialization time to determine section ordering, which
 * nodes feed each section, and whether the section is required for
 * document completeness.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md §4}
 */
export type DocumentSectionRule = {
	/** Section identifier (unique within the document's materialization rule). */
	readonly sectionId: string;

	/** Section title as it appears in the output document. */
	readonly title: string;

	/** Nodes whose canonical answers feed into this section. */
	readonly sourceNodeIds: NodeId[];

	/** Whether this section is required for the document to be considered complete. */
	readonly required: boolean;
};
