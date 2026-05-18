/** Step 10.2 — Bounded Context Bundle model, types, and contracts */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { AgentPackKind, AgentPackPlanItem } from './agent-pack-types.js';

// ---------------------------------------------------------------------------
// Bundle status
// ---------------------------------------------------------------------------

export type ContextBundleStatus =
	| 'ready'
	| 'requires_review'
	| 'blocked'
	| 'unknown';

// ---------------------------------------------------------------------------
// Section kinds
// ---------------------------------------------------------------------------

export type ContextBundleSectionKind =
	| 'objective'
	| 'source_documents'
	| 'source_paths'
	| 'constraints'
	| 'requirements'
	| 'required_changes'
	| 'acceptance_criteria'
	| 'non_goals'
	| 'decisions'
	| 'assumptions'
	| 'hypotheses'
	| 'risks'
	| 'open_questions'
	| 'validation_findings'
	| 'consistency_findings'
	| 'traceability'
	| 'readiness'
	| 'expected_outputs'
	| 'blocked_items'
	| 'out_of_scope'
	| 'diagnostics';

// ---------------------------------------------------------------------------
// Bundle source kinds
// ---------------------------------------------------------------------------

export type ContextBundleSourceKind =
	| 'canonical_markdown'
	| 'profile_descriptor'
	| 'document_descriptor'
	| 'confirmed_decision'
	| 'assumption'
	| 'hypothesis'
	| 'risk'
	| 'open_question'
	| 'validation_finding'
	| 'consistency_finding'
	| 'traceability_source'
	| 'provenance_claim'
	| 'artifact_metadata'
	| 'executive_declaration'
	| 'generated_metadata';

// ---------------------------------------------------------------------------
// Scope policy
// ---------------------------------------------------------------------------

export type ContextBundleScopePolicy =
	| 'strict'
	| 'include_upstream'
	| 'include_transitive';

export interface ContextBundleSizeBudget {
	/** Maximum items in any section (0 = unlimited) */
	maxSectionItemCount: number;
	/** Maximum character length of any content excerpt */
	maxExcerptLength: number;
	/** Maximum approximate total character count (0 = unlimited) */
	maxTotalCharacterCount: number;
}

export interface ContextBundleScopeOptions {
	policy: ContextBundleScopePolicy;
	includeContentExcerpts: boolean;
	includeFullCanonicalContent: boolean;
	includeTransitiveDependencies: boolean;
	transitiveDependencyLimit: number;
}

// ---------------------------------------------------------------------------
// Bundle source reference
// ---------------------------------------------------------------------------

export interface ContextBundleSource {
	sourceId: string;
	sourceKind: ContextBundleSourceKind;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	/** Relative portable path */
	sourcePath: string | undefined;
	title: string | undefined;
	label: string | undefined;
	/** Staleness status if available */
	stalenessStatus: string | undefined;
	/** Validation status if available */
	validationStatus: string | undefined;
	/** Redacted content excerpt (only if allowed and within budget) */
	contentExcerpt: string | undefined;
	/** Whether the excerpt was truncated */
	excerptTruncated: boolean;
	required: boolean;
}

// ---------------------------------------------------------------------------
// Bundle sections
// ---------------------------------------------------------------------------

export interface ContextBundleSection {
	kind: ContextBundleSectionKind;
	title: string;
	/** Ordered items in this section */
	items: ContextBundleSectionItem[];
	/** Whether the section was truncated due to budget */
	truncated: boolean;
	/** How many items were omitted if truncated */
	omittedCount: number;
}

export interface ContextBundleSectionItem {
	id: string;
	label: string;
	summary: string;
	/** Rich structured detail, may be any section-specific data */
	detail: unknown;
	sourceIds: string[];
	sourcePaths: string[];
	confidence: string | undefined;
	reviewRequired: boolean;
	blocking: boolean;
}

// ---------------------------------------------------------------------------
// Section-specific structured item types
// ---------------------------------------------------------------------------

export interface ContextBundleObjective {
	purpose: string;
	packKind: AgentPackKind;
	targetArtifact: string;
	outputPurpose: string | undefined;
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
	intent:
		| 'review'
		| 'implementation'
		| 'task'
		| 'documentation'
		| 'research'
		| 'follow_up'
		| 'executive_task'
		| 'custom'
		| 'unknown';
	objectiveMissing: boolean;
}

export interface ContextBundleConstraint {
	id: string;
	label: string;
	description: string;
	sourceKind: ContextBundleSourceKind | undefined;
	sourceId: string | undefined;
}

export interface ContextBundleRequirement {
	id: string;
	label: string;
	description: string;
	sourceDocumentId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	blocked: boolean;
	missing: boolean;
}

export interface ContextBundleRequiredChange {
	id: string;
	label: string;
	description: string;
	sourceId: string | undefined;
	blocked: boolean;
	unknown: boolean;
}

export interface ContextBundleAcceptanceCriterion {
	id: string;
	label: string;
	description: string;
	sourceDocumentId: CanonicalDocumentId | undefined;
	sourceKind: ContextBundleSourceKind | undefined;
	linkedSourceId: string | undefined;
}

export interface ContextBundleNonGoal {
	id: string;
	label: string;
	description: string;
	reason: string | undefined;
}

export interface ContextBundleDecision {
	id: string;
	status: string;
	summary: string;
	sourceIds: string[];
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
	reviewRequired: boolean;
}

export interface ContextBundleAssumption {
	id: string;
	status: string;
	confidence: string | undefined;
	summary: string;
	sourceIds: string[];
	reviewRequired: boolean;
}

export interface ContextBundleHypothesis {
	id: string;
	status: string;
	expectedSignal: string | undefined;
	evidenceSourceIds: string[];
	summary: string;
}

export interface ContextBundleRisk {
	id: string;
	status: string;
	impact: string | undefined;
	likelihood: string | undefined;
	mitigation: string | undefined;
	summary: string;
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
}

export interface ContextBundleOpenQuestion {
	id: string;
	status: string;
	blocking: boolean;
	whyItMatters: string | undefined;
	summary: string;
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
}

export interface ContextBundleValidationFinding {
	id: string;
	code: string;
	severity: string;
	message: string;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	relatedSourceIds: string[];
	relatedRegisterIds: string[];
	recoveryHint: string | undefined;
	releaseBlocking: boolean;
}

export interface ContextBundleConsistencyFinding {
	id: string;
	code: string;
	severity: string;
	message: string;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	recoveryHint: string | undefined;
	releaseBlocking: boolean;
}

export interface ContextBundleTraceabilityEntry {
	id: string;
	sourceReference: string | undefined;
	claimReference: string | undefined;
	confidence: string | undefined;
	reviewRequired: boolean;
	missingSource: boolean;
	boundary: 'canonical' | 'derived' | 'inferred' | 'unknown';
	sourceId: string | undefined;
	sourcePath: string | undefined;
}

// ---------------------------------------------------------------------------
// Redaction summary
// ---------------------------------------------------------------------------

export interface ContextBundleRedactionSummary {
	redactedCount: number;
	sectionsAffected: ContextBundleSectionKind[];
	kinds: string[];
}

// ---------------------------------------------------------------------------
// Bundle metadata
// ---------------------------------------------------------------------------

export interface ContextBundleMetadata {
	bundleId: string;
	planItemId: string;
	packId: string;
	packKind: AgentPackKind;
	profileId: string;
	profileVersion: string | undefined;
	generatedAt: string;
	documentationRoot: string;
	artifactRoot: string | undefined;
	canonicalSourceDocumentIds: CanonicalDocumentId[];
	canonicalSourcePaths: string[];
	sourcePhaseIds: PhaseId[];
	affectedDocumentIds: CanonicalDocumentId[];
	sourceCount: number;
	registerItemCount: number;
	validationFindingCount: number;
	consistencyFindingCount: number;
	unresolvedQuestionCount: number;
	reviewRequiredCount: number;
	missingSourceCount: number;
	redactionSummary: ContextBundleRedactionSummary;
	sizeSummary: ContextBundleSizeSummary;
	isDerivedExecutionAid: boolean;
	isNonCanonical: boolean;
	isReadOnly: boolean;
	changedPaths: never[];
}

export interface ContextBundleSizeSummary {
	sectionCount: number;
	totalItemCount: number;
	approximateCharacterCount: number;
	sectionsTruncated: ContextBundleSectionKind[];
	totalOmittedItems: number;
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export interface ContextBundle {
	bundleId: string;
	status: ContextBundleStatus;
	metadata: ContextBundleMetadata;
	sections: ContextBundleSection[];
	sources: ContextBundleSource[];
	diagnostics: ContextBundleDiagnostic[];
	blockers: ContextBundleBlocker[];
}

// ---------------------------------------------------------------------------
// Builder types
// ---------------------------------------------------------------------------

export interface ContextBundleInput {
	planItem: AgentPackPlanItem;
	profileId: string;
	profileVersion: string | undefined;
	documentationRoot: string;
	artifactRoot: string | undefined;
	generatedAt: string;

	/** Canonical document metadata map (canonicalId → metadata) */
	canonicalDocumentMeta: ReadonlyMap<
		CanonicalDocumentId,
		ContextBundleCanonicalDocMeta
	>;

	/** Full content excerpts for source documents (only if scope allows) */
	canonicalContentExcerpts: ReadonlyMap<CanonicalDocumentId, string>;

	/** Decisions, assumptions, hypotheses, risks, open questions from registers */
	registerData: ContextBundleRegisterData;

	/** Validation findings */
	validationFindings: readonly ContextBundleValidationFindingInput[];

	/** Consistency findings */
	consistencyFindings: readonly ContextBundleConsistencyFindingInput[];

	/** Traceability entries */
	traceabilityEntries: readonly ContextBundleTraceabilityEntryInput[];

	/** Document descriptor constraints (optional) */
	descriptorConstraints: ReadonlyMap<CanonicalDocumentId, readonly string[]>;

	/** Profile-level constraints */
	profileConstraints: readonly string[];

	/** Explicit document-level acceptance criteria */
	acceptanceCriteria: ReadonlyMap<
		CanonicalDocumentId,
		readonly ContextBundleAcceptanceCriterionInput[]
	>;

	/** Explicit required changes (from executive task template or plan item) */
	requiredChanges: readonly ContextBundleRequiredChangeInput[];

	/** Explicit non-goals from profile/descriptor */
	nonGoals: readonly ContextBundleNonGoalInput[];
}

export interface ContextBundleCanonicalDocMeta {
	canonicalId: CanonicalDocumentId;
	title: string;
	phaseId: PhaseId;
	sourcePath: string;
	status: string;
	stalenessStatus: string | undefined;
	validationStatus: string | undefined;
}

export interface ContextBundleRegisterData {
	decisions: readonly ContextBundleDecisionInput[];
	assumptions: readonly ContextBundleAssumptionInput[];
	hypotheses: readonly ContextBundleHypothesisInput[];
	risks: readonly ContextBundleRiskInput[];
	openQuestions: readonly ContextBundleOpenQuestionInput[];
}

export interface ContextBundleDecisionInput {
	id: string;
	status: string;
	summary: string;
	sourceIds: string[];
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
	reviewRequired: boolean;
}

export interface ContextBundleAssumptionInput {
	id: string;
	status: string;
	confidence: string | undefined;
	summary: string;
	sourceIds: string[];
	reviewRequired: boolean;
}

export interface ContextBundleHypothesisInput {
	id: string;
	status: string;
	expectedSignal: string | undefined;
	evidenceSourceIds: string[];
	summary: string;
}

export interface ContextBundleRiskInput {
	id: string;
	status: string;
	impact: string | undefined;
	likelihood: string | undefined;
	mitigation: string | undefined;
	summary: string;
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
}

export interface ContextBundleOpenQuestionInput {
	id: string;
	status: string;
	blocking: boolean;
	whyItMatters: string | undefined;
	summary: string;
	affectedDocumentIds: CanonicalDocumentId[];
	affectedPhaseIds: PhaseId[];
}

export interface ContextBundleValidationFindingInput {
	id: string;
	code: string;
	severity: string;
	message: string;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	relatedSourceIds: string[];
	relatedRegisterIds: string[];
	recoveryHint: string | undefined;
	releaseBlocking: boolean;
}

export interface ContextBundleConsistencyFindingInput {
	id: string;
	code: string;
	severity: string;
	message: string;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	recoveryHint: string | undefined;
	releaseBlocking: boolean;
}

export interface ContextBundleTraceabilityEntryInput {
	id: string;
	sourceReference: string | undefined;
	claimReference: string | undefined;
	confidence: string | undefined;
	reviewRequired: boolean;
	missingSource: boolean;
	boundary: 'canonical' | 'derived' | 'inferred' | 'unknown';
	sourceId: string | undefined;
	sourcePath: string | undefined;
}

export interface ContextBundleAcceptanceCriterionInput {
	id: string;
	label: string;
	description: string;
	sourceDocumentId: CanonicalDocumentId | undefined;
	sourceKind: ContextBundleSourceKind | undefined;
}

export interface ContextBundleRequiredChangeInput {
	id: string;
	label: string;
	description: string;
	sourceId: string | undefined;
	blocked: boolean;
	unknown: boolean;
}

export interface ContextBundleNonGoalInput {
	id: string;
	label: string;
	description: string;
	reason: string | undefined;
}

// ---------------------------------------------------------------------------
// Builder options
// ---------------------------------------------------------------------------

export interface ContextBundleOptions {
	bundleId?: string;
	scope?: Partial<ContextBundleScopeOptions>;
	sizeBudget?: Partial<ContextBundleSizeBudget>;
	/** Inject deterministic timestamp for testing */
	generatedAtOverride?: string;
}

export const DEFAULT_SCOPE_OPTIONS: ContextBundleScopeOptions = {
	includeContentExcerpts: false,
	includeFullCanonicalContent: false,
	includeTransitiveDependencies: false,
	policy: 'strict',
	transitiveDependencyLimit: 10,
};

export const DEFAULT_SIZE_BUDGET: ContextBundleSizeBudget = {
	maxExcerptLength: 4000,
	maxSectionItemCount: 100,
	maxTotalCharacterCount: 100_000,
};

// ---------------------------------------------------------------------------
// Bundle diagnostic and blocker
// ---------------------------------------------------------------------------

export interface ContextBundleDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sectionKind: ContextBundleSectionKind | undefined;
	sourcePath: string | undefined;
	fieldPath: string | undefined;
	recoveryHint: string | undefined;
}

export interface ContextBundleBlocker {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sectionKind: ContextBundleSectionKind | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Builder result
// ---------------------------------------------------------------------------

export interface ContextBundleResult {
	bundle: ContextBundle;
	diagnostics: ContextBundleDiagnostic[];
}

// ---------------------------------------------------------------------------
// Builder function signature
// ---------------------------------------------------------------------------

export type ContextBundleBuilder = (
	input: ContextBundleInput,
	options?: ContextBundleOptions,
) => ContextBundleResult;
