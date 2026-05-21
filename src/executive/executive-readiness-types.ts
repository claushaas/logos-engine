/** Step 11.1 — Executive readiness gate type contracts */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	ClaimId,
	ClaimRecord,
	SourceId,
	SourceRecord,
} from '../provenance/provenance-types.js';
import type {
	RegisterItemId,
	RegisterKind,
} from '../registers/register-types.js';
import type { StalenessStatus } from '../staleness/staleness-types.js';
import type {
	ValidationFinding,
	ValidationFindingSeverity,
	ValidationGateStatus,
} from '../validation/validation-finding.js';

// ---------------------------------------------------------------------------
// Readiness statuses
// ---------------------------------------------------------------------------

export type NormativeBaselineReadinessStatus =
	| 'ready'
	| 'ready_with_warnings'
	| 'blocked'
	| 'unknown';

export type ExecutiveCompilationGateStatus =
	| 'allowed'
	| 'allowed_with_warnings'
	| 'blocked'
	| 'unknown';

export type ExecutiveReadinessRequirementStatus =
	| 'satisfied'
	| 'warning'
	| 'blocked'
	| 'unknown'
	| 'not_applicable';

// ---------------------------------------------------------------------------
// Blocker kinds
// ---------------------------------------------------------------------------

export type NormativeBaselineBlockerKind =
	| 'missing_canonical_document'
	| 'stale_canonical_document'
	| 'blocked_canonical_document'
	| 'invalid_canonical_document'
	| 'missing_required_section'
	| 'missing_required_source'
	| 'unresolved_blocking_question'
	| 'release_blocking_validation_finding'
	| 'release_blocking_consistency_finding'
	| 'unresolved_contradiction'
	| 'unsupported_validation_claim'
	| 'profile_contract_invalid'
	| 'executive_profile_invalid'
	| 'unsafe_path'
	| 'secret_leak'
	| 'unknown_readiness';

// ---------------------------------------------------------------------------
// Warning kinds
// ---------------------------------------------------------------------------

export type NormativeBaselineWarningKind =
	| 'review_required_claim'
	| 'inferred_source'
	| 'optional_source_missing'
	| 'optional_dependency_stale'
	| 'non_blocking_validation_finding'
	| 'non_blocking_consistency_finding'
	| 'incomplete_optional_section'
	| 'derived_artifact_out_of_date'
	| 'traceability_incomplete'
	| 'manual_review_recommended';

// ---------------------------------------------------------------------------
// Blocker / Warning records
// ---------------------------------------------------------------------------

export interface NormativeBaselineReadinessBlocker {
	readonly kind: NormativeBaselineBlockerKind;
	readonly severity: ValidationFindingSeverity;
	readonly message: string;
	readonly documentCanonicalId?: CanonicalDocumentId | undefined;
	readonly phaseId?: PhaseId | undefined;
	readonly sourcePath?: string | undefined;
	readonly pointer?: string | undefined;
	readonly registerItemId?: RegisterItemId | undefined;
	readonly claimId?: ClaimId | undefined;
	readonly sourceId?: SourceId | undefined;
	readonly validationFindingId?: string | undefined;
	readonly consistencyFindingId?: string | undefined;
	readonly executiveDeclarationId?: string | undefined;
	readonly expected?: unknown | undefined;
	readonly received?: unknown | undefined;
	readonly recoveryHint?: string | undefined;
	readonly order: number;
}

export interface NormativeBaselineReadinessWarning {
	readonly kind: NormativeBaselineWarningKind;
	readonly message: string;
	readonly documentCanonicalId?: CanonicalDocumentId | undefined;
	readonly phaseId?: PhaseId | undefined;
	readonly sourcePath?: string | undefined;
	readonly pointer?: string | undefined;
	readonly registerItemId?: RegisterItemId | undefined;
	readonly claimId?: ClaimId | undefined;
	readonly sourceId?: SourceId | undefined;
	readonly validationFindingId?: string | undefined;
	readonly consistencyFindingId?: string | undefined;
	readonly recoveryHint?: string | undefined;
	readonly order: number;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface NormativeBaselineReadinessDiagnostic {
	readonly code: string;
	readonly severity: ValidationFindingSeverity;
	readonly message: string;
	readonly sourcePath?: string | undefined;
	readonly pointer?: string | undefined;
	readonly documentCanonicalId?: CanonicalDocumentId | undefined;
	readonly phaseId?: PhaseId | undefined;
	readonly registerItemId?: RegisterItemId | undefined;
	readonly sourceId?: SourceId | undefined;
	readonly claimId?: ClaimId | undefined;
	readonly validationFindingId?: string | undefined;
	readonly consistencyFindingId?: string | undefined;
	readonly executiveDeclarationId?: string | undefined;
	readonly expected?: unknown | undefined;
	readonly received?: unknown | undefined;
	readonly recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Per-phase readiness
// ---------------------------------------------------------------------------

export interface NormativeBaselinePhaseReadiness {
	readonly phaseId: PhaseId;
	readonly phaseTitle: string;
	readonly phaseOrder: number;
	readonly required: boolean;
	readonly status: ExecutiveReadinessRequirementStatus;
	readonly documentIds: CanonicalDocumentId[];
	readonly satisfiedCount: number;
	readonly warningCount: number;
	readonly blockedCount: number;
	readonly unknownCount: number;
}

// ---------------------------------------------------------------------------
// Per-document readiness
// ---------------------------------------------------------------------------

export interface NormativeBaselineDocumentReadiness {
	readonly documentCanonicalId: CanonicalDocumentId;
	readonly phaseId: PhaseId;
	readonly descriptorTitle: string;
	readonly descriptorStatus: string | undefined;
	readonly status: ExecutiveReadinessRequirementStatus;
	readonly stalenessStatus: StalenessStatus | undefined;
	readonly hasCanonicalOutput: boolean;
	readonly canonicalOutputPath: string | undefined;
	readonly pathIsSafe: boolean;
	readonly requiredSectionsPresent: boolean;
	readonly hasReleaseBlockingFindings: boolean;
	readonly blockerCount: number;
	readonly warningCount: number;
}

// ---------------------------------------------------------------------------
// Coverage summaries
// ---------------------------------------------------------------------------

export interface NormativeBaselineValidationCoverage {
	readonly totalValidationsRun: number;
	readonly latestValidationRunId: string | undefined;
	readonly latestValidationGateStatus: ValidationGateStatus | undefined;
	readonly fatalCount: number;
	readonly errorCount: number;
	readonly warningCount: number;
	readonly infoCount: number;
	readonly releaseBlockingCount: number;
	readonly tokenLeakCount: number;
}

export interface NormativeBaselineStalenessCoverage {
	readonly totalTargets: number;
	readonly currentCount: number;
	readonly staleCount: number;
	readonly missingCount: number;
	readonly blockedCount: number;
	readonly orphanedCount: number;
	readonly unknownCount: number;
}

export interface NormativeBaselineSourceCoverage {
	readonly totalSources: number;
	readonly confirmedCount: number;
	readonly inferredCount: number;
	readonly reviewRequiredCount: number;
	readonly externalCount: number;
	readonly missingSourceClaimCount: number;
}

export interface NormativeBaselineRegisterCoverage {
	readonly totalDecisions: number;
	readonly confirmedDecisions: number;
	readonly decisionsWithoutSource: number;
	readonly totalAssumptions: number;
	readonly activeAssumptions: number;
	readonly totalHypotheses: number;
	readonly validatedHypotheses: number;
	readonly totalRisks: number;
	readonly acceptedRisks: number;
	readonly risksWithoutMitigation: number;
	readonly totalOpenQuestions: number;
	readonly blockingOpenQuestions: number;
	readonly unresolvedOpenQuestions: number;
	readonly reviewRequiredItems: number;
}

export interface NormativeBaselineTraceabilityCoverage {
	readonly trackedDocuments: number;
	readonly trackedArtifacts: number;
	readonly documentsWithSources: number;
	readonly documentsMissingSources: number;
}

// ---------------------------------------------------------------------------
// Executive scope check
// ---------------------------------------------------------------------------

export interface NormativeBaselineExecutiveScopeCheck {
	readonly status: ExecutiveReadinessRequirementStatus;
	readonly executiveConfigLoaded: boolean;
	readonly executiveConfigValid: boolean;
	readonly executiveSchemaParsed: boolean;
	readonly requiredMappingsPresent: boolean;
	readonly missingMappingIds: string[];
	readonly plannedMappings: string[];
	readonly claimsLiveTaskManager: boolean;
	readonly claimsBidirectionalSync: boolean;
	readonly claimsHosted: boolean;
}

// ---------------------------------------------------------------------------
// Readiness input
// ---------------------------------------------------------------------------

export interface NormativeBaselineDocumentEntry {
	readonly documentCanonicalId: CanonicalDocumentId;
	readonly phaseId: PhaseId;
	readonly descriptorTitle: string;
	readonly descriptorStatus: string | undefined;
	readonly canonicalOutputPath: string | undefined;
	readonly required: boolean;
	readonly phaseOrder: number;
	readonly documentOrder: number;
}

export interface NormativeBaselineReadinessInput {
	readonly profileId: string;
	readonly profileVersion: string | undefined;
	readonly documentationRoot: string;
	readonly projectRoot: string;
	readonly evaluatedAt: string;
	readonly requiredDocumentIds: readonly CanonicalDocumentId[];
	readonly requiredPhaseIds: readonly PhaseId[];
	readonly documentEntries: readonly NormativeBaselineDocumentEntry[];
	readonly phaseEntries: readonly {
		readonly phaseId: PhaseId;
		readonly title: string;
		readonly order: number;
		readonly required: boolean;
	}[];
	readonly validationFindings?: readonly ValidationFinding[] | undefined;
	readonly latestValidationGateStatus?: ValidationGateStatus | undefined;
	readonly latestValidationRunId?: string | undefined;
	readonly stalenessTargets?:
		| readonly {
				readonly targetId: string;
				readonly status: StalenessStatus;
				readonly severity: string;
				readonly documentCanonicalId: CanonicalDocumentId | undefined;
				readonly phaseId: PhaseId | undefined;
				readonly outputPath: string | undefined;
				readonly reasons: readonly {
					readonly code: string;
					readonly message: string;
				}[];
		  }[]
		| undefined;
	readonly stalenessSummary?:
		| {
				readonly currentCount: number;
				readonly staleCount: number;
				readonly missingCount: number;
				readonly blockedCount: number;
				readonly orphanedCount: number;
				readonly unknownCount: number;
				readonly total: number;
		  }
		| undefined;
	readonly registerCollections?:
		| {
				readonly decisions?:
					| readonly {
							readonly id: RegisterItemId;
							readonly kind: RegisterKind;
							readonly status: string;
							readonly title: string;
							readonly body: string | undefined;
							readonly reviewState: string | undefined;
							readonly confidence: string | undefined;
							readonly sourceLinks?:
								| readonly { readonly sourceId: string }[]
								| undefined;
							readonly affectedDocumentLinks?:
								| readonly {
										readonly documentCanonicalId: CanonicalDocumentId;
								  }[]
								| undefined;
					  }[]
					| undefined;
				readonly assumptions?:
					| readonly {
							readonly id: RegisterItemId;
							readonly kind: RegisterKind;
							readonly status: string;
							readonly title: string;
							readonly body: string | undefined;
							readonly reviewState: string | undefined;
							readonly confidence: string | undefined;
							readonly sourceLinks?:
								| readonly { readonly sourceId: string }[]
								| undefined;
							readonly affectedDocumentLinks?:
								| readonly {
										readonly documentCanonicalId: CanonicalDocumentId;
								  }[]
								| undefined;
					  }[]
					| undefined;
				readonly hypotheses?:
					| readonly {
							readonly id: RegisterItemId;
							readonly kind: RegisterKind;
							readonly status: string;
							readonly title: string;
							readonly body: string | undefined;
							readonly reviewState: string | undefined;
							readonly confidence: string | undefined;
							readonly sourceLinks?:
								| readonly { readonly sourceId: string }[]
								| undefined;
							readonly affectedDocumentLinks?:
								| readonly {
										readonly documentCanonicalId: CanonicalDocumentId;
								  }[]
								| undefined;
					  }[]
					| undefined;
				readonly risks?:
					| readonly {
							readonly id: RegisterItemId;
							readonly kind: RegisterKind;
							readonly status: string;
							readonly title: string;
							readonly body: string | undefined;
							readonly reviewState: string | undefined;
							readonly confidence: string | undefined;
							readonly sourceLinks?:
								| readonly { readonly sourceId: string }[]
								| undefined;
							readonly affectedDocumentLinks?:
								| readonly {
										readonly documentCanonicalId: CanonicalDocumentId;
								  }[]
								| undefined;
							readonly mitigation: string | undefined;
					  }[]
					| undefined;
				readonly openQuestions?:
					| readonly {
							readonly id: RegisterItemId;
							readonly kind: RegisterKind;
							readonly status: string;
							readonly title: string;
							readonly body: string | undefined;
							readonly reviewState: string | undefined;
							readonly confidence: string | undefined;
							readonly sourceLinks?:
								| readonly { readonly sourceId: string }[]
								| undefined;
							readonly affectedDocumentLinks?:
								| readonly {
										readonly documentCanonicalId: CanonicalDocumentId;
								  }[]
								| undefined;
							readonly isBlocking: boolean | undefined;
					  }[]
					| undefined;
		  }
		| undefined;
	readonly sources?: readonly SourceRecord[] | undefined;
	readonly claims?: readonly ClaimRecord[] | undefined;
	readonly consistencyFindings?:
		| readonly {
				readonly id: string;
				readonly code: string;
				readonly severity: ValidationFindingSeverity;
				readonly message: string;
				readonly documentCanonicalId?: CanonicalDocumentId | undefined;
				readonly phaseId?: PhaseId | undefined;
				readonly registerItemId?: RegisterItemId | undefined;
				readonly sourcePath?: string | undefined;
		  }[]
		| undefined;
	readonly consistencyExportReadiness?: string | undefined;
	readonly executiveGenerationConfig?:
		| {
				readonly loaded: boolean;
				readonly valid: boolean;
				readonly version: string | undefined;
				readonly requiredStatus: string | undefined;
				readonly allowDraftGeneration: boolean;
				readonly allowExportWhenDraft: boolean;
				readonly minimumCoverage?:
					| {
							readonly [phaseKey: string]:
								| {
										readonly required: boolean;
										readonly requiredDocuments: string[];
								  }
								| undefined;
					  }
					| undefined;
				readonly exportTargets?: readonly string[] | undefined;
				readonly missingMappings?: readonly string[] | undefined;
				readonly plannedMappings?: readonly string[] | undefined;
				readonly diagnostics?:
					| readonly {
							readonly code: string;
							readonly message: string;
					  }[]
					| undefined;
		  }
		| undefined;
	readonly executiveConfigSourcePath?: string | undefined;
	readonly traceabilityEntries?:
		| readonly {
				readonly documentCanonicalId: CanonicalDocumentId | undefined;
				readonly sourceCount: number;
				readonly claimCount: number;
		  }[]
		| undefined;
	readonly artifactRegistryEntries?:
		| readonly {
				readonly artifactId: string;
				readonly artifactType: string;
				readonly isCanonical: boolean;
				readonly path: string;
				readonly sourceDocumentIds?: readonly string[] | undefined;
		  }[]
		| undefined;
}

// ---------------------------------------------------------------------------
// Readiness options
// ---------------------------------------------------------------------------

export interface NormativeBaselineReadinessOptions {
	readonly strictMode?: boolean | undefined;
	readonly allowNotApplicablePhases?: boolean | undefined;
	readonly treatOptionalMissingAsBlocking?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Readiness summary
// ---------------------------------------------------------------------------

export interface NormativeBaselineReadinessSummary {
	readonly readinessStatus: NormativeBaselineReadinessStatus;
	readonly executiveCompilationGateStatus: ExecutiveCompilationGateStatus;
	readonly totalDocuments: number;
	readonly satisfiedDocuments: number;
	readonly warningDocuments: number;
	readonly blockedDocuments: number;
	readonly unknownDocuments: number;
	readonly totalPhases: number;
	readonly satisfiedPhases: number;
	readonly warningPhases: number;
	readonly blockedPhases: number;
	readonly unknownPhases: number;
	readonly blockerCount: number;
	readonly warningCount: number;
	readonly staleNormativeDocCount: number;
	readonly blockingOpenQuestionCount: number;
}

// ---------------------------------------------------------------------------
// Readiness result
// ---------------------------------------------------------------------------

export interface NormativeBaselineReadinessResult {
	readonly status: NormativeBaselineReadinessStatus;
	readonly executiveCompilationGateStatus: ExecutiveCompilationGateStatus;
	readonly summary: NormativeBaselineReadinessSummary;
	readonly activeProfileId: string;
	readonly profileVersion: string | undefined;
	readonly executiveProfileVersion: string | undefined;
	readonly documentationRoot: string;
	readonly evaluatedAt: string;
	readonly requiredDocumentIds: readonly CanonicalDocumentId[];
	readonly requiredPhaseIds: readonly PhaseId[];
	readonly phaseReadiness: readonly NormativeBaselinePhaseReadiness[];
	readonly documentReadiness: readonly NormativeBaselineDocumentReadiness[];
	readonly validationCoverage: NormativeBaselineValidationCoverage;
	readonly stalenessCoverage: NormativeBaselineStalenessCoverage;
	readonly sourceCoverage: NormativeBaselineSourceCoverage;
	readonly registerCoverage: NormativeBaselineRegisterCoverage;
	readonly traceabilityCoverage: NormativeBaselineTraceabilityCoverage;
	readonly executiveScopeCheck: NormativeBaselineExecutiveScopeCheck;
	readonly blockers: readonly NormativeBaselineReadinessBlocker[];
	readonly warnings: readonly NormativeBaselineReadinessWarning[];
	readonly diagnostics: readonly NormativeBaselineReadinessDiagnostic[];
	readonly derivedArtifactBoundaryViolations: readonly string[];
	readonly securityFindings: readonly string[];
	readonly recommendedNextActions: readonly string[];
	readonly readOnly: true;
	readonly changedPaths: readonly [];
	readonly dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Readiness requirement (for individual checks)
// ---------------------------------------------------------------------------

export interface ExecutiveReadinessRequirement {
	readonly id: string;
	readonly title: string;
	readonly category: string;
	readonly status: ExecutiveReadinessRequirementStatus;
	readonly message: string;
	readonly recoveryHint: string | undefined;
	readonly order: number;
}

// ---------------------------------------------------------------------------
// Full report (optional, for display/render)
// ---------------------------------------------------------------------------

export interface ExecutiveReadinessReport {
	readonly result: NormativeBaselineReadinessResult;
	readonly requirements: readonly ExecutiveReadinessRequirement[];
	readonly textReport: string;
	readonly nonCanonical: true;
}

// ---------------------------------------------------------------------------
// Deterministic ordering constants
// ---------------------------------------------------------------------------

export const READINESS_STATUS_ORDER: Record<
	NormativeBaselineReadinessStatus,
	number
> = {
	blocked: 0,
	ready: 3,
	ready_with_warnings: 2,
	unknown: 1,
};

export const COMPILATION_GATE_ORDER: Record<
	ExecutiveCompilationGateStatus,
	number
> = {
	allowed: 3,
	allowed_with_warnings: 2,
	blocked: 0,
	unknown: 1,
};

export const BLOCKER_KIND_ORDER: Record<NormativeBaselineBlockerKind, number> =
	{
		blocked_canonical_document: 4,
		executive_profile_invalid: 13,
		invalid_canonical_document: 3,
		missing_canonical_document: 0,
		missing_required_section: 5,
		missing_required_source: 6,
		profile_contract_invalid: 12,
		release_blocking_consistency_finding: 8,
		release_blocking_validation_finding: 7,
		secret_leak: 14,
		stale_canonical_document: 2,
		unknown_readiness: 15,
		unresolved_blocking_question: 9,
		unresolved_contradiction: 10,
		unsafe_path: 1,
		unsupported_validation_claim: 11,
	};

export const WARNING_KIND_ORDER: Record<NormativeBaselineWarningKind, number> =
	{
		derived_artifact_out_of_date: 7,
		incomplete_optional_section: 6,
		inferred_source: 1,
		manual_review_recommended: 9,
		non_blocking_consistency_finding: 5,
		non_blocking_validation_finding: 4,
		optional_dependency_stale: 3,
		optional_source_missing: 2,
		review_required_claim: 0,
		traceability_incomplete: 8,
	};

export const SEVERITY_ORDER: Record<ValidationFindingSeverity, number> = {
	error: 1,
	fatal: 0,
	info: 3,
	warning: 2,
};

export const REQUIREMENT_CATEGORY_ORDER: Record<string, number> = {
	artifact_boundary: 10,
	canonical_output: 1,
	consistency: 6,
	contract: 0,
	executive_profile: 7,
	provenance: 3,
	registers: 4,
	security: 8,
	source_coverage: 5,
	staleness: 2,
	traceability: 9,
	validation: 8,
};

// ---------------------------------------------------------------------------
// Derived artifact types (from consistency detector)
// ---------------------------------------------------------------------------

export const DERIVED_ARTIFACT_TYPES = new Set([
	'html',
	'agent_pack',
	'executive_json',
	'executive_markdown',
	'executive_html',
	'report',
]);

// ---------------------------------------------------------------------------
// Executive Phase -> PhaseId mapping from executive-generation.yml
// ---------------------------------------------------------------------------

export const EXECUTIVE_PHASE_TO_STANDARD: Record<string, string> = {
	engineering: '04-engineering',
	foundation: '01-foundation',
	goToMarket: '05-go-to-market',
	operations: '06-operations',
	product: '03-product',
	validation: '02-validation',
};
