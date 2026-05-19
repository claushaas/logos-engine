/** Step 12.4 — Candidate Extraction Model: types, contracts, and statuses */

import type { DocsCodeConsistencyResult } from '../consistency/docs-code-consistency-model.js';
import type { RepositoryScanResult } from '../scanner/repository-scan-model.js';
import type {
	DocumentationImportCandidate,
	DocumentationImportPlan,
} from './import-model.js';

// ---------------------------------------------------------------------------
// Source kinds
// ---------------------------------------------------------------------------

export type CandidateExtractionSourceKind =
	| 'import_candidate'
	| 'markdown_frontmatter'
	| 'markdown_heading'
	| 'markdown_bounded_snippet'
	| 'yaml_descriptor'
	| 'json_descriptor'
	| 'repository_scan_fact'
	| 'docs_code_consistency_finding'
	| 'profile_contract'
	| 'existing_register_item'
	| 'validation_finding'
	| 'unknown';

export const CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER: Record<
	CandidateExtractionSourceKind,
	number
> = {
	docs_code_consistency_finding: 7,
	existing_register_item: 9,
	import_candidate: 0,
	json_descriptor: 5,
	markdown_bounded_snippet: 3,
	markdown_frontmatter: 1,
	markdown_heading: 2,
	profile_contract: 8,
	repository_scan_fact: 6,
	unknown: 11,
	validation_finding: 10,
	yaml_descriptor: 4,
};

// ---------------------------------------------------------------------------
// Source reference
// ---------------------------------------------------------------------------

export interface CandidateExtractionSource {
	candidateId?: string | undefined;
	candidatePath?: string | undefined;
	kind: CandidateExtractionSourceKind;
	/** e.g., frontmatter key, heading text, descriptor path, finding id */
	pointer?: string | undefined;
	/** Bounded/redacted evidence snippet */
	evidence?: string | undefined;
	/** 0-1 confidence value */
	confidence: number;
}

// ---------------------------------------------------------------------------
// Extracted item kinds
// ---------------------------------------------------------------------------

export type CandidateExtractedItemKind =
	| 'fact'
	| 'decision'
	| 'assumption'
	| 'hypothesis'
	| 'risk'
	| 'open_question'
	| 'constraint'
	| 'requirement'
	| 'acceptance_criterion'
	| 'non_goal'
	| 'evidence_reference'
	| 'unknown';

export const CANDIDATE_EXTRACTED_ITEM_KIND_ORDER: Record<
	CandidateExtractedItemKind,
	number
> = {
	acceptance_criterion: 8,
	assumption: 2,
	constraint: 6,
	decision: 1,
	evidence_reference: 10,
	fact: 0,
	hypothesis: 3,
	non_goal: 9,
	open_question: 5,
	requirement: 7,
	risk: 4,
	unknown: 11,
};

// ---------------------------------------------------------------------------
// Item statuses
// ---------------------------------------------------------------------------

export type CandidateExtractedItemStatus =
	| 'candidate'
	| 'requires_review'
	| 'ambiguous'
	| 'conflicting'
	| 'unsupported'
	| 'blocked'
	| 'duplicate'
	| 'unknown';

export const CANDIDATE_EXTRACTED_ITEM_STATUS_ORDER: Record<
	CandidateExtractedItemStatus,
	number
> = {
	ambiguous: 2,
	blocked: 5,
	candidate: 0,
	conflicting: 4,
	duplicate: 6,
	requires_review: 1,
	unknown: 7,
	unsupported: 3,
};

// ---------------------------------------------------------------------------
// Confidence values
// ---------------------------------------------------------------------------

export type CandidateExtractedItemConfidence =
	| 'high'
	| 'medium'
	| 'low'
	| 'unknown';

export const CANDIDATE_EXTRACTED_ITEM_CONFIDENCE_ORDER: Record<
	CandidateExtractedItemConfidence,
	number
> = {
	high: 0,
	low: 2,
	medium: 1,
	unknown: 3,
};

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface CandidateExtractionDiagnostic {
	code: string;
	severity: 'info' | 'warning' | 'error' | 'fatal';
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	candidateId?: string | undefined;
	extractedItemId?: string | undefined;
	itemKind?: CandidateExtractedItemKind | undefined;
	conflictId?: string | undefined;
	existingRegisterId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Conflict kinds
// ---------------------------------------------------------------------------

export type CandidateExtractionConflictKind =
	| 'contradicts_existing_confirmed_record'
	| 'contradicts_profile_contract'
	| 'contradicts_scanner_observation'
	| 'contradicts_docs_code_consistency'
	| 'duplicate_candidate'
	| 'ambiguous_source'
	| 'missing_source_reference'
	| 'unsupported_claim'
	| 'derived_artifact_source'
	| 'secret_or_sensitive_content'
	| 'unsafe_path'
	| 'unknown_conflict';

export const CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER: Record<
	CandidateExtractionConflictKind,
	number
> = {
	ambiguous_source: 6,
	contradicts_docs_code_consistency: 3,
	contradicts_existing_confirmed_record: 0,
	contradicts_profile_contract: 1,
	contradicts_scanner_observation: 2,
	derived_artifact_source: 8,
	duplicate_candidate: 5,
	missing_source_reference: 7,
	secret_or_sensitive_content: 9,
	unknown_conflict: 11,
	unsafe_path: 10,
	unsupported_claim: 4,
};

// ---------------------------------------------------------------------------
// Conflict record
// ---------------------------------------------------------------------------

export interface CandidateExtractionConflict {
	id: string;
	kind: CandidateExtractionConflictKind;
	message: string;
	severity: 'warning' | 'error' | 'fatal';
	/** IDs of affected extracted items */
	extractedItemIds: string[];
	/** IDs of affected source candidates */
	candidateIds: string[];
	/** Related existing register item IDs */
	existingRegisterIds: string[];
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Blocker
// ---------------------------------------------------------------------------

export interface CandidateExtractionBlocker {
	code: string;
	message: string;
	sourcePath?: string | undefined;
	candidateId?: string | undefined;
	extractedItemId?: string | undefined;
	recoveryHint?: string | undefined;
	severity: 'error' | 'fatal';
}

// ---------------------------------------------------------------------------
// Warning
// ---------------------------------------------------------------------------

export interface CandidateExtractionWarning {
	code: string;
	message: string;
	sourcePath?: string | undefined;
	candidateId?: string | undefined;
	extractedItemId?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Extracted evidence
// ---------------------------------------------------------------------------

export interface CandidateExtractionEvidence {
	/** Bounded/redacted evidence snippet */
	snippet: string;
	/** Source kind */
	sourceKind: CandidateExtractionSourceKind;
	/** Source pointer */
	sourcePointer?: string | undefined;
	/** Source candidate path */
	sourcePath?: string | undefined;
	/** source candidate ID */
	candidateId?: string | undefined;
	/** Confidence of evidence */
	confidence: number;
}

// ---------------------------------------------------------------------------
// Base extracted item (shared fields)
// ---------------------------------------------------------------------------

export interface CandidateExtractedItemBase {
	id: string;
	kind: CandidateExtractedItemKind;
	status: CandidateExtractedItemStatus;
	confidence: CandidateExtractedItemConfidence;
	sources: CandidateExtractionSource[];
	/** Source candidate IDs */
	sourceCandidateIds: string[];
	/** Whether review is required */
	requiresReview: boolean;
	/** diagnostics */
	diagnostics: CandidateExtractionDiagnostic[];
	/** Duplicate group IDs if any */
	duplicateOfIds: string[];
}

// ---------------------------------------------------------------------------
// Extracted Fact
// ---------------------------------------------------------------------------

export interface CandidateExtractedFact extends CandidateExtractedItemBase {
	kind: 'fact';
	statement: string;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Decision
// ---------------------------------------------------------------------------

export interface CandidateExtractedDecision extends CandidateExtractedItemBase {
	kind: 'decision';
	title: string;
	statement: string;
	rationale?: string | undefined;
	alternatives?: string[] | undefined;
	consequences?: string[] | undefined;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Assumption
// ---------------------------------------------------------------------------

export interface CandidateExtractedAssumption
	extends CandidateExtractedItemBase {
	kind: 'assumption';
	statement: string;
	expectedSignal?: string | undefined;
	expectedEvidence?: string | undefined;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Hypothesis
// ---------------------------------------------------------------------------

export interface CandidateExtractedHypothesis
	extends CandidateExtractedItemBase {
	kind: 'hypothesis';
	statement: string;
	expectedSignal?: string | undefined;
	validationEvidence?: string | undefined;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Risk
// ---------------------------------------------------------------------------

export interface CandidateExtractedRisk extends CandidateExtractedItemBase {
	kind: 'risk';
	title: string;
	description: string;
	likelihood?: string | undefined;
	impact?: string | undefined;
	mitigation?: string | undefined;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Open Question
// ---------------------------------------------------------------------------

export interface CandidateExtractedOpenQuestion
	extends CandidateExtractedItemBase {
	kind: 'open_question';
	question: string;
	blocking?: boolean | undefined;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Constraint
// ---------------------------------------------------------------------------

export interface CandidateExtractedConstraint
	extends CandidateExtractedItemBase {
	kind: 'constraint';
	statement: string;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Requirement
// ---------------------------------------------------------------------------

export interface CandidateExtractedRequirement
	extends CandidateExtractedItemBase {
	kind: 'requirement';
	statement: string;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Acceptance Criterion
// ---------------------------------------------------------------------------

export interface CandidateExtractedAcceptanceCriterion
	extends CandidateExtractedItemBase {
	kind: 'acceptance_criterion';
	statement: string;
	satisfied?: boolean | undefined;
	satisfactionEvidence?: string | undefined;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Non-Goal
// ---------------------------------------------------------------------------

export interface CandidateExtractedNonGoal extends CandidateExtractedItemBase {
	kind: 'non_goal';
	statement: string;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Extracted Evidence Reference
// ---------------------------------------------------------------------------

export interface CandidateExtractedEvidenceReference
	extends CandidateExtractedItemBase {
	kind: 'evidence_reference';
	/** The referenced source (path, URL, document id, finding id) */
	reference: string;
	/** Type of reference */
	referenceType:
		| 'local_path'
		| 'external_url'
		| 'document_id'
		| 'claim_id'
		| 'validation_finding_id'
		| 'scanner_finding_id'
		| 'unknown';
	/** Whether the reference is verified */
	verified: boolean;
	affectedDocumentIds: string[];
	affectedPhaseIds: string[];
	evidenceItems: CandidateExtractionEvidence[];
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type CandidateExtractedItem =
	| CandidateExtractedFact
	| CandidateExtractedDecision
	| CandidateExtractedAssumption
	| CandidateExtractedHypothesis
	| CandidateExtractedRisk
	| CandidateExtractedOpenQuestion
	| CandidateExtractedConstraint
	| CandidateExtractedRequirement
	| CandidateExtractedAcceptanceCriterion
	| CandidateExtractedNonGoal
	| CandidateExtractedEvidenceReference
	| (CandidateExtractedItemBase & { kind: 'unknown' });

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type CandidateExtractionReadiness =
	| 'ready_for_review'
	| 'requires_manual_review'
	| 'blocked'
	| 'empty'
	| 'unknown';

export const CANDIDATE_EXTRACTION_READINESS_ORDER: Record<
	CandidateExtractionReadiness,
	number
> = {
	blocked: 0,
	empty: 1,
	ready_for_review: 3,
	requires_manual_review: 2,
	unknown: 4,
};

// ---------------------------------------------------------------------------
// Review action kinds
// ---------------------------------------------------------------------------

export type CandidateExtractionActionKind =
	| 'review_candidate_fact'
	| 'review_candidate_decision'
	| 'review_candidate_assumption'
	| 'review_candidate_hypothesis'
	| 'review_candidate_risk'
	| 'review_candidate_open_question'
	| 'review_candidate_constraint'
	| 'review_candidate_requirement'
	| 'review_candidate_acceptance_criterion'
	| 'review_candidate_non_goal'
	| 'review_evidence_reference'
	| 'resolve_candidate_conflict'
	| 'discard_unsupported_candidate'
	| 'defer_transcript_extraction';

export const CANDIDATE_EXTRACTION_ACTION_KIND_ORDER: Record<
	CandidateExtractionActionKind,
	number
> = {
	defer_transcript_extraction: 13,
	discard_unsupported_candidate: 12,
	resolve_candidate_conflict: 11,
	review_candidate_acceptance_criterion: 8,
	review_candidate_assumption: 2,
	review_candidate_constraint: 6,
	review_candidate_decision: 1,
	review_candidate_fact: 0,
	review_candidate_hypothesis: 3,
	review_candidate_non_goal: 9,
	review_candidate_open_question: 5,
	review_candidate_requirement: 7,
	review_candidate_risk: 4,
	review_evidence_reference: 10,
};

// ---------------------------------------------------------------------------
// Review action
// ---------------------------------------------------------------------------

export interface CandidateExtractionReviewAction {
	id: string;
	kind: CandidateExtractionActionKind;
	extractedItemId?: string | undefined;
	candidateId?: string | undefined;
	conflictId?: string | undefined;
	sourcePath?: string | undefined;
	reason: string;
	evidence?: string | undefined;
	confidence: number;
	futureMutationType?: string | undefined;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface CandidateExtractionSummary {
	sourceCount: number;
	candidateCount: number;
	extractedItemCount: number;
	countsByKind: Record<string, number>;
	countsByStatus: Record<string, number>;
	countsByConfidence: Record<string, number>;
	duplicateCount: number;
	ambiguousCount: number;
	conflictingCount: number;
	blockedCount: number;
	unsupportedCount: number;
	sourceCoverageSummary: string;
	confidenceSummary: string;
}

// ---------------------------------------------------------------------------
// Extraction result
// ---------------------------------------------------------------------------

export interface CandidateExtractionResult {
	activeProfileId: string | null;
	profileVersion: string | null;
	documentationRoot: string;
	extractedAt: string;
	dryRun: boolean;
	readOnly: true;
	sourceCount: number;
	candidateCount: number;
	extractedItemCount: number;
	countsByKind: Record<string, number>;
	countsByStatus: Record<string, number>;
	countsByConfidence: Record<string, number>;
	duplicateCount: number;
	ambiguousCount: number;
	conflictingCount: number;
	blockedCount: number;
	unsupportedCount: number;
	sourceCoverageSummary: string;
	confidenceSummary: string;
	items: CandidateExtractedItem[];
	conflicts: CandidateExtractionConflict[];
	blockers: CandidateExtractionBlocker[];
	warnings: CandidateExtractionWarning[];
	diagnostics: CandidateExtractionDiagnostic[];
	reviewActions: CandidateExtractionReviewAction[];
	summary: CandidateExtractionSummary;
	readiness: CandidateExtractionReadiness;
	changedPaths: [];
}

// ---------------------------------------------------------------------------
// Changed path (always empty)
// ---------------------------------------------------------------------------

export interface CandidateExtractionChangedPath {
	readonly _empty: true;
}

// ---------------------------------------------------------------------------
// Extraction options
// ---------------------------------------------------------------------------

export interface CandidateExtractionOptions {
	dryRun?: boolean | undefined;
	/** Allow extraction from derived artifacts (low confidence only, with warning) */
	allowDerivedArtifactExtraction?: boolean | undefined;
	/** Allow evidence references from derived artifacts */
	allowDerivedArtifactEvidence?: boolean | undefined;
	/** Allow transcript extraction */
	allowTranscriptExtraction?: boolean | undefined;
	/** Injected clock timestamp (ISO 8601) */
	extractedAt?: string | undefined;
	/** Id counter factory for deterministic testing */
	idFactory?: (() => string) | undefined;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface CandidateExtractionInput {
	/** Active profile ID */
	profileId: string;
	/** Profile version if available */
	profileVersion?: string | undefined;
	/** Documentation root */
	documentationRoot?: string | undefined;
	/** Step 12.1 import plan with bounded candidates */
	importPlan?: DocumentationImportPlan | undefined;
	/** Explicit import candidates (may be partial, from import plan) */
	candidates?: DocumentationImportCandidate[] | undefined;
	/** Bounded content snippets keyed by candidate path */
	candidateSnippets?: Map<string, string> | undefined;
	/** Step 12.2 repository scanner result */
	scannerResult?: RepositoryScanResult | undefined;
	/** Step 12.3 docs-vs-code consistency result */
	consistencyResult?: DocsCodeConsistencyResult | undefined;
	/** Existing register summaries for contradiction/duplicate detection */
	existingRegisterSummaries?:
		| Array<{
				id: string;
				kind: string;
				status: string;
				title: string;
				statement: string;
				confirmationLevel?: string | undefined;
		  }>
		| undefined;
	/** Existing validation findings */
	existingValidationFindings?:
		| Array<{
				id: string;
				code: string;
				severity: string;
				message: string;
		  }>
		| undefined;
	/** Profile/document contract metadata */
	profileContractMetadata?:
		| {
				profileId: string;
				documentIds?: string[] | undefined;
				phaseIds?: string[] | undefined;
		  }
		| undefined;
	/** Injected clock timestamp */
	extractedAt?: string | undefined;
}

// ---------------------------------------------------------------------------
// Extractor type
// ---------------------------------------------------------------------------

export type CandidateFactDecisionExtractor = (
	input: CandidateExtractionInput,
	options?: CandidateExtractionOptions,
) => CandidateExtractionResult;

// ---------------------------------------------------------------------------
// ID factory
// ---------------------------------------------------------------------------

let _extractionIdCounter = 0;

export function resetExtractionIdCounter(start?: number): void {
	_extractionIdCounter = start ?? 0;
}

export function nextExtractionId(prefix: string): string {
	_extractionIdCounter += 1;
	return `${prefix}-${_extractionIdCounter}`;
}

export function getExtractionIdCounter(): number {
	return _extractionIdCounter;
}

// ---------------------------------------------------------------------------
// Headings recognized for extraction
// ---------------------------------------------------------------------------

export const RECOGNIZED_HEADINGS: Record<string, CandidateExtractedItemKind> = {
	'Acceptance Criteria': 'acceptance_criterion',
	'Acceptance Criterion': 'acceptance_criterion',
	Assumption: 'assumption',
	Assumptions: 'assumption',
	Constraint: 'constraint',
	Constraints: 'constraint',
	Decision: 'decision',
	Decisions: 'decision',
	Evidence: 'evidence_reference',
	Hypotheses: 'hypothesis',
	Hypothesis: 'hypothesis',
	'Non-Goal': 'non_goal',
	'Non-Goals': 'non_goal',
	'Open Question': 'open_question',
	'Open Questions': 'open_question',
	Requirement: 'requirement',
	Requirements: 'requirement',
	Risk: 'risk',
	Risks: 'risk',
	Sources: 'evidence_reference',
};

// ---------------------------------------------------------------------------
// Frontmatter keys recognized for extraction
// ---------------------------------------------------------------------------

export const RECOGNIZED_FRONTMATTER_KEYS: Record<
	string,
	CandidateExtractedItemKind
> = {
	acceptanceCriteria: 'acceptance_criterion',
	assumption: 'assumption',
	assumptions: 'assumption',
	constraints: 'constraint',
	decision: 'decision',
	decisions: 'decision',
	hypotheses: 'hypothesis',
	hypothesis: 'hypothesis',
	nonGoals: 'non_goal',
	questions: 'open_question',
	requirements: 'requirement',
	risk: 'risk',
	risks: 'risk',
	sources: 'evidence_reference',
};

// ---------------------------------------------------------------------------
// Derived artifact path markers (from import model)
// ---------------------------------------------------------------------------

export const DERIVED_ARTIFACT_PATH_MARKERS_EXTRACTION: RegExp[] = [
	/html/i,
	/agent.?pack/i,
	/executive.?export/i,
	/executive.?plan/i,
	/validation.?report/i,
	/diagnostic.?report/i,
	/diagnose.?report/i,
	/review.?report/i,
	/staleness.?report/i,
	/regeneration.?report/i,
];

export const DERIVED_ARTIFACT_CONTENT_MARKERS_EXTRACTION: RegExp[] = [
	/This is a derived artifact/i,
	/This file is generated/i,
	/generated at:/i,
	/derived.*artifact/i,
	/do not edit manually/i,
	/auto-generated/i,
	/validation report/i,
	/diagnostic report/i,
	/executive plan/i,
	/agent pack/i,
];

export const TRANSCRIPT_CONTENT_MARKERS_EXTRACTION: RegExp[] = [
	/\btranscript\b/i,
	/\bconversation\s+log\b/i,
	/\bchat\s+log\b/i,
	/\bsession\s+log\b/i,
	/---\s*\n\s*\[?\d{2}:\d{2}/,
	/^\d{2}:\d{2}(:\d{2})?\s+[-–—]/m,
	/^(User|Human|Agent|Assistant|System):\s/m,
	/<message\b/i,
];

// ---------------------------------------------------------------------------
// Helper: detect derived artifact
// ---------------------------------------------------------------------------

export function pathLooksLikeDerivedArtifactExtraction(path: string): boolean {
	return DERIVED_ARTIFACT_PATH_MARKERS_EXTRACTION.some((p) => p.test(path));
}

export function contentLooksLikeDerivedArtifactExtraction(
	content: string,
): boolean {
	return DERIVED_ARTIFACT_CONTENT_MARKERS_EXTRACTION.some((p) =>
		p.test(content),
	);
}

export function contentLooksLikeTranscriptExtraction(content: string): boolean {
	return TRANSCRIPT_CONTENT_MARKERS_EXTRACTION.some((p) => p.test(content));
}
