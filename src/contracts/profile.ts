/**
 * LogosProfile and node definition types — the structural map that the runtime navigates.
 *
 * These types define the static contract between the profile definition (YAML/JSON)
 * and every runtime module: state engine, sidebar, prompt orchestrator, and materializer.
 *
 * All domain ID fields use branded types (`NodeId`, `DocumentId`, `ProfileId`,
 * `PromptId`) from `@logos/shared` to prevent accidental interchange.
 */
import type {
	DocumentId,
	NodeId,
	ProfileId,
	PromptId,
} from '../shared/index.js';

// ─── LogosProfile ───────────────────────────────────────────────────────────

/**
 * A profile defines the complete structural map for a documentation workspace.
 *
 * Phases, documents, nodes, and materialization rules are all defined here.
 * Runtime progress is stored separately in `LogosRuntimeState` (Step 1.2).
 */
export type LogosProfile = {
	/** Unique profile identifier (branded). */
	readonly id: ProfileId;

	/** Human-readable profile title. */
	readonly title: string;

	/** Optional description of the profile's purpose. */
	readonly description?: string;

	/** Schema version string (e.g., "1.0.0"). */
	readonly version: string;

	/** Ordered phases that group documents and nodes. */
	readonly phases: PhaseDefinition[];

	/** Document definitions — the output targets for materialization. */
	readonly documents: DocumentDefinition[];

	/** Node definitions — the atomic semantic units that users answer. */
	readonly nodes: NodeDefinition[];

	/** Rules that control how documents are assembled from accepted answers. */
	readonly materializationRules: DocumentMaterializationRule[];
};

// ─── PhaseDefinition ────────────────────────────────────────────────────────

/**
 * A phase groups related documents and nodes under a common purpose.
 *
 * Phases enforce ordering boundaries (e.g., Foundation before GTM) and
 * provide the top-level sidebar grouping.
 */
export type PhaseDefinition = {
	/** Phase identifier (e.g., "01-foundation"). Not branded — freeform string. */
	readonly id: string;

	/** Human-readable phase title. */
	readonly title: string;

	/** Display/sort order within the profile. */
	readonly order: number;

	/** Why this phase exists and what it produces. */
	readonly purpose: string;
};

// ─── DocumentDefinition ─────────────────────────────────────────────────────

/**
 * A document is an output target materialized from one or more accepted nodes.
 *
 * Documents map to concrete files (e.g., Markdown) and depend on a set of
 * required and optional source nodes.
 */
export type DocumentDefinition = {
	/** Unique document identifier (branded). */
	readonly id: DocumentId;

	/** The phase this document belongs to. */
	readonly phaseId: string;

	/** Human-readable document title. */
	readonly title: string;

	/** Display/sort order within the phase. */
	readonly order: number;

	/** Why this document exists. */
	readonly purpose: string;

	/** Filesystem path where the materialized document will be written. */
	readonly outputPath: string;

	/** Nodes that must be accepted before the document is ready. */
	readonly requiredNodeIds: NodeId[];

	/** Nodes that enhance the document but are not required for readiness. */
	readonly optionalNodeIds: NodeId[];
};

// ─── NodeDefinition ─────────────────────────────────────────────────────────

/**
 * A node is an atomic semantic unit — a single canonical question that the user
 * answers through conversation with the agent.
 *
 * Each node has its own lifecycle, conversation history, and canonical answer.
 * Nodes depend on other nodes and feed into documents.
 */
export type NodeDefinition = {
	/** Unique node identifier (branded). */
	readonly id: NodeId;

	/** The phase this node belongs to. */
	readonly phaseId: string;

	/** The primary document this node contributes to. */
	readonly documentId: DocumentId;

	/** Human-readable node title. */
	readonly title: string;

	/** Display/sort order within the document. */
	readonly order: number;

	/** The single canonical question that anchors the node's semantic intent. */
	readonly canonicalQuestion: string;

	/** Topics the answer must cover for the node to be considered complete. */
	readonly coverageTopics: string[];

	/** Criteria that define when the node answer is sufficient. */
	readonly sufficiencyCriteria: string[];

	/** Node-level dependency constraints. */
	readonly dependencies?: NodeDependencyDefinition;

	/** Prompt references keyed by prompt state (initial, clarification, etc.). */
	readonly promptRefs: NodePromptRefs;

	/** Optional reference to an output validation schema. */
	readonly outputSchemaRef?: string;
};

// ─── NodeDependencyDefinition ───────────────────────────────────────────────

/**
 * Defines which nodes must be completed before this node can be worked on,
 * and which nodes are recommended for richer context.
 */
export type NodeDependencyDefinition = {
	/** Nodes that must be accepted before this node unlocks. */
	readonly requiredNodeIds?: NodeId[];

	/** Nodes that are recommended for better context but not required. */
	readonly recommendedNodeIds?: NodeId[];
};

// ─── NodePromptRefs ─────────────────────────────────────────────────────────

/**
 * Maps lifecycle/prompt states to specific prompt templates.
 *
 * Each reference is a `PromptId` (branded string) that the prompt registry
 * resolves to a concrete template.
 */
export type NodePromptRefs = {
	/** Prompt for the initial question when the node is first activated. */
	readonly initial?: PromptId;

	/** Prompt for generic follow-up questions. */
	readonly followUp?: PromptId;

	/** Prompt when the answer needs clarification. */
	readonly clarification?: PromptId;

	/** Prompt when the answer needs refinement (more depth/specificity). */
	readonly refinement?: PromptId;

	/** Prompt for synthesizing the canonical answer from the conversation. */
	readonly synthesis?: PromptId;

	/** Prompt for reviewing the synthesized answer before acceptance. */
	readonly review?: PromptId;

	/** Prompt shown when the node is blocked by unmet dependencies. */
	readonly blocked?: PromptId;

	/** Prompt for repairing malformed structured output from the LLM. */
	readonly repair?: PromptId;
};

// ─── DocumentMaterializationRule ────────────────────────────────────────────

/**
 * A materialization rule controls how a document is assembled from its
 * source nodes' accepted canonical answers.
 */
export type DocumentMaterializationRule = {
	/** The document this rule applies to (branded). */
	readonly documentId: DocumentId;

	/** Human-readable title for the rule (shown in export UI). */
	readonly title: string;

	/** Filesystem path where the materialized output will be written. */
	readonly outputPath: string;

	/** All nodes that contribute content to this document. */
	readonly sourceNodeIds: NodeId[];

	/** Nodes that must be accepted before the document can be generated. */
	readonly requiredNodeIds: NodeId[];

	/** Nodes that are optional contributors. */
	readonly optionalNodeIds: NodeId[];

	/** Section-level assembly rules. */
	readonly sections: DocumentMaterializationSectionDefinition[];
};

// ─── DocumentMaterializationSectionDefinition ───────────────────────────────

/**
 * A section-level rule that maps source nodes to a specific section
 * within the materialized document.
 */
export type DocumentMaterializationSectionDefinition = {
	/** Section identifier (unique within the rule). */
	readonly id: string;

	/** Section title as it appears in the output document. */
	readonly title: string;

	/** Nodes whose canonical answers feed into this section. */
	readonly sourceNodeIds: NodeId[];

	/** Whether this section is required for the document to be considered complete. */
	readonly required: boolean;
};
