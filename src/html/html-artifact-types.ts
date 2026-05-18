/** Step 9.1 — HTML Artifact Planner types, contracts, and statuses */

import type { DependencyGraphNodeId } from '../dependency-graph/dependency-graph.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Artifact Kinds
// ---------------------------------------------------------------------------

export type HtmlArtifactKind =
	| 'dashboard'
	| 'phase_map'
	| 'document_view'
	| 'decision_map'
	| 'risk_map'
	| 'validation_summary'
	| 'readiness_view'
	| 'executive_readiness'
	| 'executive_export_preview'
	| 'custom';

export const HTML_ARTIFACT_KIND_ORDER: Record<HtmlArtifactKind, number> = {
	custom: 9,
	dashboard: 0,
	decision_map: 3,
	document_view: 2,
	executive_export_preview: 8,
	executive_readiness: 7,
	phase_map: 1,
	readiness_view: 6,
	risk_map: 4,
	validation_summary: 5,
};

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type HtmlArtifactStatus =
	| 'ready'
	| 'blocked'
	| 'stale'
	| 'missing_source'
	| 'requires_review'
	| 'skipped'
	| 'unknown';

export const HTML_ARTIFACT_STATUS_ORDER: Record<HtmlArtifactStatus, number> = {
	blocked: 2,
	missing_source: 3,
	ready: 0,
	requires_review: 4,
	skipped: 5,
	stale: 1,
	unknown: 6,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type HtmlArtifactAction =
	| 'plan_render'
	| 'skip_current'
	| 'block_until_canonical_current'
	| 'block_until_source_available'
	| 'manual_review'
	| 'no_action';

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface HtmlArtifactReadiness {
	ready: boolean;
	sourcesReady: boolean;
	canonicalCurrent: boolean;
	originSafe: boolean;
	blockers: HtmlArtifactBlocker[];
	blockerCount: number;
	warningCount: number;
}

// ---------------------------------------------------------------------------
// Source Kinds and Sources
// ---------------------------------------------------------------------------

export type HtmlArtifactSourceKind =
	| 'canonical_markdown'
	| 'decision_register'
	| 'assumption_register'
	| 'hypothesis_register'
	| 'risk_register'
	| 'open_question_register'
	| 'validation_finding'
	| 'validation_report'
	| 'staleness_report'
	| 'consistency_report'
	| 'traceability_metadata'
	| 'executive_declaration'
	| 'executive_metadata'
	| 'artifact_registry'
	| 'generation_run_metadata'
	| 'workspace_state'
	| 'unknown';

export interface HtmlArtifactSource {
	sourceId: string;
	sourceKind: HtmlArtifactSourceKind;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	outputPath: string | undefined;
	required: boolean;
	label: string | undefined;
	status: string | undefined;
}

// ---------------------------------------------------------------------------
// Blocker and Reason
// ---------------------------------------------------------------------------

export type HtmlArtifactReasonCode =
	| 'canonical_source_missing'
	| 'canonical_source_stale'
	| 'canonical_source_blocked'
	| 'canonical_source_unknown'
	| 'required_source_path_unsafe'
	| 'required_register_source_missing'
	| 'release_blocking_validation_finding'
	| 'release_blocking_consistency_finding'
	| 'unresolved_blocking_open_question'
	| 'output_path_unsafe'
	| 'declaration_malformed'
	| 'manual_edit_collision'
	| 'optional_source_stale'
	| 'optional_dependency_missing'
	| 'review_required_inferred_source'
	| 'non_blocking_validation_warning'
	| 'incomplete_source_document'
	| 'no_generated_canonical_file'
	| 'executive_not_compiled'
	| 'insufficient_metadata';

export interface HtmlArtifactBlocker {
	code: HtmlArtifactReasonCode;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourceKind: HtmlArtifactSourceKind | undefined;
	sourceDocumentId: CanonicalDocumentId | undefined;
	sourcePath: string | undefined;
	artifactKind: HtmlArtifactKind | undefined;
	relatedPhaseId: PhaseId | undefined;
	graphNodeId: DependencyGraphNodeId | undefined;
	expected: string | undefined;
	received: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Declaration types
// ---------------------------------------------------------------------------

export type HtmlArtifactDeclarationSource =
	| 'profile_output_model'
	| 'phase_descriptor'
	| 'document_descriptor'
	| 'executive_html_mapping';

export interface HtmlArtifactDeclaration {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	title: string;
	declarationSource: HtmlArtifactDeclarationSource;
	profilePath: string | undefined;
	descriptorPath: string | undefined;
	descriptorPointer: string | undefined;
	phaseId: PhaseId | undefined;
	documentCanonicalId: CanonicalDocumentId | undefined;
	outputPath: string;
	relativeOutputPath: string;
	format: string;
	purpose: string | undefined;
	includes: string[] | undefined;
	generationMode: string | undefined;
	audience: string | undefined;
	optional: boolean;
	deferred: boolean;
	orderIndex: number;
}

// ---------------------------------------------------------------------------
// Dependency
// ---------------------------------------------------------------------------

export interface HtmlArtifactDependency {
	sourceId: string;
	sourceKind: HtmlArtifactSourceKind;
	documentCanonicalId: CanonicalDocumentId | undefined;
	outputPath: string | undefined;
	required: boolean;
	status: string | undefined;
}

// ---------------------------------------------------------------------------
// Plan Item
// ---------------------------------------------------------------------------

export interface HtmlArtifactPlanItem {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	title: string;
	status: HtmlArtifactStatus;
	action: HtmlArtifactAction;
	readiness: HtmlArtifactReadiness;
	outputPath: string;
	relativeOutputPath: string;
	declarationSource: HtmlArtifactDeclarationSource;
	profilePath: string | undefined;
	descriptorPath: string | undefined;
	descriptorPointer: string | undefined;
	phaseId: PhaseId | undefined;
	documentCanonicalId: CanonicalDocumentId | undefined;
	canonicalSourceDocumentIds: CanonicalDocumentId[];
	canonicalSourceOutputPaths: string[];
	sourcePhaseIds: PhaseId[];
	sources: HtmlArtifactSource[];
	blockers: HtmlArtifactBlocker[];
	reasons: HtmlArtifactBlocker[];
	isDerivedNonCanonical: boolean;
	traceabilityBoundary: string;
	orderIndex: number;
	diagnostics: HtmlArtifactDiagnostic[];
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface HtmlArtifactDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath: string | undefined;
	fieldPath: string | undefined;
	relatedArtifactId: string | undefined;
	relatedArtifactKind: HtmlArtifactKind | undefined;
	relatedSourceDocumentId: CanonicalDocumentId | undefined;
	relatedPhaseId: PhaseId | undefined;
	relatedGraphNodeId: DependencyGraphNodeId | undefined;
	expected: string | undefined;
	received: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface HtmlArtifactPlan {
	profileId: string;
	documentationRoot: string;
	artifactRoot: string | undefined;
	declarationCount: number;
	items: HtmlArtifactPlanItem[];
	countByStatus: Record<string, number>;
	countByAction: Record<string, number>;
	countByKind: Record<string, number>;
	blockerCount: number;
	warningCount: number;
	missingSourceCount: number;
	staleCount: number;
	requiresReviewCount: number;
	unsafePathCount: number;
	diagnostics: HtmlArtifactDiagnostic[];
	readOnly: true;
	dryRun: boolean;
	declaredArtifactPaths: string[];
}

// ---------------------------------------------------------------------------
// Input and Options
// ---------------------------------------------------------------------------

export interface HtmlArtifactPlanInput {
	profileId: string;
	documentationRoot: string;
	artifactRoot: string | undefined;
	contract: {
		phases: readonly {
			id: PhaseId;
			title: string;
			order: number;
			sourcePath: string;
			documents: readonly {
				canonicalId: CanonicalDocumentId;
				phaseId: PhaseId;
				sourcePath: string;
				title: string;
				status: string;
			}[];
			generatedOutputs: Record<string, unknown>;
		}[];
		documents: readonly {
			canonicalId: CanonicalDocumentId;
			phaseId: PhaseId;
			sourcePath: string;
			descriptorId: string;
			title: string;
			status: string;
			outputArtifacts: readonly {
				id: string | undefined;
				path: string;
				format: string;
				purpose: string | undefined;
				audience: string | undefined;
				includes: string[] | undefined;
				generationMode: string | undefined;
			}[];
		}[];
	};
	contractGraph: {
		outputs: readonly {
			documentCanonicalId: CanonicalDocumentId;
			phaseId: string;
			sourcePath: string;
			fieldPath: string;
			kind: string;
			path: string;
			format: string;
			purpose: string | undefined;
			isCanonical: boolean;
			outputId: string | undefined;
			role: string | undefined;
		}[];
		getOutputsByDocumentId(id: CanonicalDocumentId): readonly {
			documentCanonicalId: CanonicalDocumentId;
			phaseId: string;
			sourcePath: string;
			fieldPath: string;
			kind: string;
			path: string;
			format: string;
			purpose: string | undefined;
			isCanonical: boolean;
			outputId: string | undefined;
			role: string | undefined;
		}[];
	};
	dependencyGraph: {
		nodes: readonly {
			id: DependencyGraphNodeId;
			kind: string;
			documentCanonicalId: CanonicalDocumentId | undefined;
			phaseId: PhaseId | undefined;
			isCanonical: boolean | undefined;
			outputTargetPath: string | undefined;
			orderIndex: number;
		}[];
	};
	stalenessResult:
		| {
				targets: readonly {
					targetId: string;
					targetKind: string;
					status: string;
					severity: string;
					documentCanonicalId: CanonicalDocumentId | undefined;
					phaseId: PhaseId | undefined;
					outputPath: string | undefined;
					artifactId: string | undefined;
					reasons: readonly {
						code: string;
						severity: string;
						message: string;
						sourceKind: string;
						sourceId: string | undefined;
						sourcePath: string | undefined;
						targetId: string;
						upstreamTargetId: string | undefined;
					}[];
					diagnostics: readonly {
						code: string;
						severity: string;
						message: string;
						sourcePath: string | undefined;
						fieldPath: string | undefined;
						documentCanonicalId: CanonicalDocumentId | undefined;
						phaseId: PhaseId | undefined;
						artifactId: string | undefined;
						graphNodeId: DependencyGraphNodeId | undefined;
					}[];
					graphNodeId: DependencyGraphNodeId | undefined;
				}[];
				summary: {
					currentCount: number;
					staleCount: number;
					missingCount: number;
					blockedCount: number;
					orphanedCount: number;
					unknownCount: number;
					total: number;
				};
				diagnostics: readonly {
					code: string;
					severity: string;
					message: string;
					sourcePath: string | undefined;
					fieldPath: string | undefined;
					documentCanonicalId: CanonicalDocumentId | undefined;
					phaseId: PhaseId | undefined;
					artifactId: string | undefined;
					graphNodeId: DependencyGraphNodeId | undefined;
				}[];
		  }
		| undefined;
	regenerationPlan:
		| {
				items: readonly {
					targetId: string;
					targetKind: string;
					status: string;
					action: string;
					safeOrderIndex: number;
					documentCanonicalId: CanonicalDocumentId | undefined;
					phaseId: PhaseId | undefined;
					outputPath: string | undefined;
					artifactId: string | undefined;
					canonicalPrerequisites: readonly string[];
					blockers: readonly {
						code: string;
						message: string;
						blockingTargetId: string | undefined;
						recoveryHint: string | undefined;
					}[];
				}[];
				diagnostics: readonly {
					code: string;
					severity: string;
					message: string;
					sourcePath: string | undefined;
					fieldPath: string | undefined;
					documentCanonicalId: CanonicalDocumentId | undefined;
					phaseId: PhaseId | undefined;
					artifactId: string | undefined;
				}[];
		  }
		| undefined;
	artifactRegistryEntries: readonly {
		artifactId: string;
		artifactType: string;
		path: string;
		status: string;
		checksum: string | undefined;
		generatedAt: string | undefined;
		runId: string | undefined;
		isCanonical: boolean;
		sourceDocumentIds: readonly string[];
		metadata: Record<string, unknown> | undefined;
	}[];
	executiveConfig:
		| {
				exports: {
					html:
						| {
								path: string;
								mapping: string;
								status: string;
						  }
						| undefined;
				};
				readinessStatus: string | undefined;
		  }
		| undefined;
	traceabilityMetadata:
		| {
				outputKind: string;
				boundary: string;
				sourceCount: number;
				claimCount: number;
				reviewRequiredCount: number;
		  }
		| undefined;
	validationFindings: readonly {
		id: string;
		code: string;
		severity: string;
		message: string;
		documentCanonicalId: string | undefined;
		phaseId: string | undefined;
	}[];
	registerSummary:
		| {
				blockingOpenQuestionCount: number;
				reviewRequiredCount: number;
				missingSourceCount: number;
		  }
		| undefined;
	manualEditCollisions: readonly string[] | undefined;
}

export interface HtmlArtifactPlanOptions {
	dryRun?: boolean;
	documentationRootOverride?: string;
	artifactRootOverride?: string;
	generatedAt?: string;
}

export interface HtmlArtifactPlanResult {
	plan: HtmlArtifactPlan;
	diagnostics: HtmlArtifactDiagnostic[];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface HtmlArtifactSummary {
	declaredCount: number;
	readyCount: number;
	blockedCount: number;
	staleCount: number;
	missingSourceCount: number;
	requiresReviewCount: number;
	unknownCount: number;
	skippedCount: number;
	unsafePathCount: number;
	plannedPaths: string[];
	blockerSummary: string[];
}

// ---------------------------------------------------------------------------
// Output path
// ---------------------------------------------------------------------------

export interface HtmlArtifactOutputPath {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	outputPath: string;
	relativeOutputPath: string;
}
