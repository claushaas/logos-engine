/** Step 8.3 — Consistency detection type contracts */

import type {
	ClaimRecord,
	ProvenanceGraph,
	SourceRecord,
} from '../provenance/provenance-types.js';
import type {
	RegisterCollections,
	RegisterItemId,
} from '../registers/register-types.js';
import type {
	ValidationFinding,
	ValidationFindingSeverity,
	ValidationGateStatus,
} from '../validation/validation-finding.js';

// ---------------------------------------------------------------------------
// Rule identity
// ---------------------------------------------------------------------------

export type ConsistencyRuleId =
	| 'root_path_consistency'
	| 'profile_identity_consistency'
	| 'canonical_source_of_truth_boundary'
	| 'derived_artifact_boundary'
	| 'validation_overclaim_boundary'
	| 'hosted_saas_scope_boundary'
	| 'external_sync_scope_boundary'
	| 'token_storage_boundary'
	| 'ai_authority_boundary'
	| 'unresolved_question_visibility'
	| 'register_lifecycle_consistency'
	| 'risk_acceptance_consistency'
	| 'hypothesis_evidence_consistency'
	| 'executive_axis_scope_boundary'
	| 'provenance_consistency'
	| 'readme_profile_drift'
	| 'generated_output_metadata_consistency';

export type ConsistencyRuleCategory =
	| 'root_path'
	| 'profile_identity'
	| 'scope_boundary'
	| 'source_of_truth'
	| 'validation_claim'
	| 'security_boundary'
	| 'register_state'
	| 'provenance'
	| 'artifact_boundary'
	| 'executive_scope'
	| 'generation_readiness';

// ---------------------------------------------------------------------------
// Violation kinds
// ---------------------------------------------------------------------------

export type ContradictionKind =
	| 'contradiction'
	| 'unsupported_claim'
	| 'source_of_truth_confusion'
	| 'scope_creep'
	| 'profile_drift'
	| 'root_mismatch'
	| 'hidden_unresolved_question'
	| 'invalid_register_state'
	| 'export_blocker';

export type BoundaryViolationKind =
	| 'boundary_violation'
	| 'security_violation'
	| 'scope_creep'
	| 'source_of_truth_confusion'
	| 'invalid_register_state';

// ---------------------------------------------------------------------------
// Evidence / diagnostics
// ---------------------------------------------------------------------------

export interface ConsistencyEvidenceLink {
	sourceId?: string;
	claimId?: string;
	registerItemId?: string;
	artifactId?: string;
	documentCanonicalId?: string;
	phaseId?: string;
	pointer?: string;
	path?: string;
}

export interface ConsistencyEvidence {
	message: string;
	links: ConsistencyEvidenceLink[];
}

export interface ConsistencyCheckDiagnostic {
	code: string;
	severity: ValidationFindingSeverity;
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	ruleId?: ConsistencyRuleId | undefined;
	registerItemId?: RegisterItemId | undefined;
	claimId?: string | undefined;
	sourceId?: string | undefined;
	documentCanonicalId?: string | undefined;
	phaseId?: string | undefined;
	artifactId?: string | undefined;
	expected?: unknown | undefined;
	received?: unknown | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Rule definition
// ---------------------------------------------------------------------------

export interface ConsistencyRule {
	id: ConsistencyRuleId;
	title: string;
	category: ConsistencyRuleCategory;
	defaultSeverity: ValidationFindingSeverity;
	checks: string;
	doesNotCheck: string;
	sourceReferences?: string[];
	canBlockExport: boolean;
	canBlockGeneration: boolean;
	order: number;
}

// ---------------------------------------------------------------------------
// Violation records
// ---------------------------------------------------------------------------

export interface ConsistencyViolation {
	ruleId: ConsistencyRuleId;
	category: ConsistencyRuleCategory;
	severity: ValidationFindingSeverity;
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	documentCanonicalId?: string | undefined;
	phaseId?: string | undefined;
	registerItemId?: RegisterItemId | undefined;
	claimId?: string | undefined;
	sourceId?: string | undefined;
	artifactId?: string | undefined;
	expected?: unknown | undefined;
	received?: unknown | undefined;
	recoveryHint?: string | undefined;
	order: number;
}

export interface ContradictionRecord {
	kind: 'contradiction';
	violation: ConsistencyViolation;
	relatedItemIds: string[];
}

export interface BoundaryViolationRecord {
	kind: 'boundary_violation';
	violation: ConsistencyViolation;
	boundaryRuleSource?: string;
}

// ---------------------------------------------------------------------------
// Gate / readiness
// ---------------------------------------------------------------------------

export type ConsistencyGateStatus = ValidationGateStatus;

export type ExportReadinessStatus = 'ready' | 'ready_with_warnings' | 'blocked';

export interface ExportReadinessBlocker {
	reason: string;
	ruleId: ConsistencyRuleId;
	severity: ValidationFindingSeverity;
	documentCanonicalId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface ConsistencySummary {
	totalViolations: number;
	contradictionCount: number;
	boundaryViolationCount: number;
	releaseBlockingCount: number;
	warningCount: number;
	infoCount: number;
	byRuleId: Partial<Record<ConsistencyRuleId, number>>;
	byCategory: Partial<Record<ConsistencyRuleCategory, number>>;
	affectedDocumentIds: string[];
	blockers: ExportReadinessBlocker[];
	gateStatus: ConsistencyGateStatus;
	exportReadiness: ExportReadinessStatus;
	unresolvedBlockingQuestionCount: number;
}

// ---------------------------------------------------------------------------
// Input / options / result
// ---------------------------------------------------------------------------

export interface GeneratedOutputMetadataEntry {
	documentId?: string | undefined;
	phaseId?: string | undefined;
	profileId?: string | undefined;
	canonicalOutput?: string | undefined;
	generationStatus?: string | undefined;
	isCanonical?: boolean | undefined;
	artifactType?: string | undefined;
	path?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
}

export interface GenerationReportSummary {
	generatedAt?: string | undefined;
	runId?: string | undefined;
	blockingDocumentIds?: string[] | undefined;
	incompleteDocumentIds?: string[] | undefined;
	unresolvedBlockingQuestionCount?: number | undefined;
}

export interface ConsistencyCheckInput {
	profileId: string;
	documentationRoot: string;
	projectRoot: string;
	workspacePath?: string | undefined;
	state?:
		| {
				documentation?: { rootPath?: string | undefined } | undefined;
				profile?: { profileId?: string | undefined } | undefined;
				artifacts?:
					| Array<{
							artifactId: string;
							artifactType: string;
							isCanonical?: boolean | undefined;
							path: string;
							status?: string | undefined;
							metadata?: Record<string, unknown> | undefined;
							sourceDocumentIds?: string[] | undefined;
							checksum?: string | undefined;
							generatedAt?: string | undefined;
					  }>
					| undefined;
				registers?: RegisterCollections | undefined;
				sources?: SourceRecord[] | undefined;
				claims?: ClaimRecord[] | undefined;
				proposals?:
					| Array<{
							proposalId: string;
							status: string;
							sourceDocumentCanonicalId?: string | undefined;
							sourceSessionId?: string | undefined;
					  }>
					| undefined;
				decisions?: Array<Record<string, unknown>> | undefined;
				assumptions?: Array<Record<string, unknown>> | undefined;
				risks?: Array<Record<string, unknown>> | undefined;
				openQuestions?: Array<Record<string, unknown>> | undefined;
				generationRuns?:
					| Array<{
							runId: string;
							status: string;
					  }>
					| undefined;
				validationRuns?:
					| Array<{
							runId: string;
							status: string;
					  }>
					| undefined;
		  }
		| undefined;
	contract?:
		| {
				phases?:
					| Array<{
							id: string;
							documents?:
								| Array<{
										id: string;
										outputs?:
											| {
													canonical?: { path?: string | undefined } | undefined;
											  }
											| undefined;
								  }>
								| undefined;
					  }>
					| undefined;
				documentsByCanonicalId?:
					| Map<
							string,
							{
								phaseId?: string | undefined;
								descriptor?:
									| {
											outputs?:
												| {
														canonical?:
															| { path?: string | undefined }
															| undefined;
												  }
												| undefined;
									  }
									| undefined;
							}
					  >
					| undefined;
		  }
		| undefined;
	provenanceGraph?: ProvenanceGraph | undefined;
	registerCollections?: RegisterCollections | undefined;
	generatedOutputs?: GeneratedOutputMetadataEntry[] | undefined;
	generationReport?: GenerationReportSummary | undefined;
	readmeMetadata?:
		| {
				profileReference?: string | undefined;
				contentSnippet?: string | undefined;
		  }
		| undefined;
	existingFindings?: ValidationFinding[] | undefined;
	dependencyGraphSummary?:
		| {
				staleDocumentIds?: string[] | undefined;
				blockedDocumentIds?: string[] | undefined;
		  }
		| undefined;
}

export interface ConsistencyCheckOptions {
	includeInfo?: boolean;
	allowInfoFindingsToPass?: boolean;
	readmeCheckEnabled?: boolean;
}

export interface ConsistencyCheckResult {
	findings: ValidationFinding[];
	violations: ConsistencyViolation[];
	summary: ConsistencySummary;
	gateStatus: ConsistencyGateStatus;
	exportReadiness: ExportReadinessStatus;
	diagnostics: ConsistencyCheckDiagnostic[];
	readOnly: true;
	changedPaths: [];
}
