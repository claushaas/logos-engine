/** Question Planner Types — typed contracts for question planning service */

import type { ContractGraph } from '../profiles/contract-graph.js';
import type {
	CanonicalDocumentId,
	DocumentationContract,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

export type QuestionBlockingLevel = 'blocking' | 'non-blocking';

export type QuestionPriority = 'critical' | 'high' | 'medium' | 'low';

export type QuestionPlanStatus =
	| 'planned'
	| 'deferred'
	| 'skipped'
	| 'preserved';

export type QuestionPlanReason =
	| 'missing_required_section'
	| 'missing_required_input'
	| 'incomplete_completion_criteria'
	| 'unresolved_dependency'
	| 'document_status_incomplete'
	| 'explicit_descriptor_question'
	| 'schema_derived_gap'
	| 'existing_open_question'
	| 'downstream_blocking';

// ---------------------------------------------------------------------------
// Source reference
// ---------------------------------------------------------------------------

export interface QuestionSource {
	/** Canonical document ID where the question originates */
	documentCanonicalId: CanonicalDocumentId;
	/** Phase ID where the question originates */
	phaseId: PhaseId;
	/** Human-readable document title */
	documentTitle: string;
	/** Source descriptor file path */
	descriptorPath: string;
	/** JSON/YAML pointer within the descriptor where the question was found */
	fieldPointer: string | undefined;
	/** Related section ID if the question comes from a section */
	sectionId: string | undefined;
	/** Related section title if available */
	sectionTitle: string | undefined;
}

// ---------------------------------------------------------------------------
// Planned question
// ---------------------------------------------------------------------------

export interface PlannedQuestion {
	/** Stable question identifier */
	id: string;
	/** Question text to present to the user */
	text: string;
	/** Source information */
	source: QuestionSource;
	/** Blocking classification */
	blockingLevel: QuestionBlockingLevel;
	/** Priority for ordering */
	priority: QuestionPriority;
	/** Why this question was selected */
	reason: QuestionPlanReason;
	/** Human-readable reason description */
	reasonDescription: string;
	/** Related dependency or prerequisite document ID */
	relatedDependencyId: CanonicalDocumentId | undefined;
	/** Related section ID/key */
	relatedSectionId: string | undefined;
	/** If this came from an existing open question in workspace state */
	existingOpenQuestionId: string | undefined;
	/** Whether this is newly planned or preserved from state */
	planStatus: QuestionPlanStatus;
	/** Whether the question text was generated from schema (not explicit in descriptor) */
	isSchemaDerived: boolean;
}

// ---------------------------------------------------------------------------
// Question gap (when a gap cannot be converted to a specific question)
// ---------------------------------------------------------------------------

export interface QuestionGap {
	/** Gap identifier */
	id: string;
	/** Description of the gap */
	description: string;
	/** Source document */
	documentCanonicalId: CanonicalDocumentId;
	/** Phase ID */
	phaseId: PhaseId;
	/** Why this gap was identified */
	reason: QuestionPlanReason;
	/** Whether this gap is blocking progress */
	isBlocking: boolean;
}

// ---------------------------------------------------------------------------
// Question cluster
// ---------------------------------------------------------------------------

export interface QuestionCluster {
	/** Questions in this cluster */
	questions: PlannedQuestion[];
	/** Source documents represented */
	sourceDocuments: CanonicalDocumentId[];
	/** Phase coverage summary */
	phaseCoverage: Array<{
		phaseId: PhaseId;
		phaseTitle: string;
		documentCount: number;
		questionCount: number;
	}>;
	/** Gaps considered but not converted to questions */
	gapsConsidered: QuestionGap[];
	/** Number of questions skipped/deferred */
	skippedCount: number;
	/** Summary of why this cluster was formed */
	reasonSummary: string;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface QuestionPlanningDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	/** Source path where relevant */
	sourcePath: string | undefined;
	/** Field pointer where relevant */
	fieldPointer: string | undefined;
	/** Recovery hint */
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Input / Options / Result
// ---------------------------------------------------------------------------

export interface QuestionPlanningInput {
	/** Loaded documentation contract */
	contract: DocumentationContract;
	/** Built contract graph (optional but recommended for dependency ordering) */
	graph?: ContractGraph | undefined;
	/** Current workspace state */
	state: WorkspaceState;
}

export interface QuestionPlanningOptions {
	/** Maximum number of questions to return in the cluster (default 5) */
	maxClusterSize?: number | undefined;
	/** Whether to include schema-derived questions for required fields without explicit questions (default true) */
	includeSchemaDerivedQuestions?: boolean | undefined;
	/** Whether to include non-blocking questions (default true) */
	includeNonBlocking?: boolean | undefined;
	/** Specific phase IDs to focus on (undefined = all phases) */
	focusPhaseIds?: PhaseId[] | undefined;
	/** Specific document IDs to focus on (undefined = all documents) */
	focusDocumentIds?: CanonicalDocumentId[] | undefined;
}

export interface QuestionPlanningResult {
	success: boolean;
	/** The planned question cluster */
	cluster: QuestionCluster | undefined;
	/** All candidate questions considered (useful for debugging) */
	allCandidates: PlannedQuestion[] | undefined;
	/** Diagnostics */
	diagnostics: QuestionPlanningDiagnostic[];
}

// ---------------------------------------------------------------------------
// Question candidate (internal/pre-clustering representation)
// ---------------------------------------------------------------------------

export interface QuestionCandidate extends PlannedQuestion {
	/** Numeric sort key for deterministic ordering */
	sortKey: number;
	/** Phase order from contract */
	phaseOrder: number;
	/** Document order within phase */
	documentOrder: number;
	/** Global document order */
	globalOrder: number;
}

// ---------------------------------------------------------------------------
// Internal tracking for duplicate detection
// ---------------------------------------------------------------------------

export interface QuestionDuplicateKey {
	questionId: string;
	documentId: string;
	fieldPointer: string | undefined;
	normalizedText: string;
}
