/**
 * Export runtime state and generated artifact types.
 *
 * Export state tracks artifacts generated from materialized documents
 * (Markdown, HTML, Agent Packs). The state engine updates this when
 * the user triggers export.
 *
 * @see {@link https://logos-engine/docs/04-data-and-persistence-architecture.md §9}
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md}
 */
import type { DocumentId, NodeId, SessionId } from '../shared/index.js';

// ─── GeneratedArtifactType ──────────────────────────────────────────────────

/**
 * Supported export artifact formats.
 */
export type GeneratedArtifactType = 'markdown' | 'html' | 'agent_pack';

// ─── GeneratedArtifact ──────────────────────────────────────────────────────

/**
 * A generated output artifact — produced by the materialization/export
 * pipeline from one or more accepted documents.
 *
 * Each artifact records its session, source documents, source nodes,
 * and staleness status.
 *
 * @see {@link https://logos-engine/docs/04-data-and-persistence-architecture.md §9}
 */
export type GeneratedArtifact = {
	/** Unique artifact identifier. */
	readonly id: string;

	/** The session that generated this artifact (branded). */
	readonly sessionId: SessionId;

	/** Output format type. */
	readonly type: GeneratedArtifactType;

	/** Filesystem path where the artifact is written. */
	readonly path: string;

	/** Documents used as source material (branded). */
	readonly sourceDocumentIds: DocumentId[];

	/** Nodes whose canonical answers contributed to the artifact (branded). */
	readonly sourceNodeIds: NodeId[];

	/** ISO-8601 timestamp of artifact generation. */
	readonly generatedAt: string;

	/** Whether the artifact is stale (source material changed since generation). */
	readonly stale: boolean;
};

// ─── ExportRuntimeState ─────────────────────────────────────────────────────

/**
 * Global export state — owned by the state engine and surfaced in
 * `LogosRuntimeState`.
 *
 * Tracks all generated artifacts for the current session. Future
 * steps may add export progress, queue state, or format-specific
 * metadata.
 */
export type ExportRuntimeState = {
	/** All artifacts generated during this session. */
	readonly artifacts: GeneratedArtifact[];
};
