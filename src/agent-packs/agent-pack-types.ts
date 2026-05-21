/** Step 10.1 — Agent Pack Planner types, contracts, statuses, and actions */

import type { DependencyGraphNodeId } from '../dependency-graph/dependency-graph.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Pack Kinds
// ---------------------------------------------------------------------------

export type AgentPackKind =
	| 'review'
	| 'implementation'
	| 'task'
	| 'documentation'
	| 'research'
	| 'follow_up'
	| 'executive_task'
	| 'custom';

export const AGENT_PACK_KIND_ORDER: Record<AgentPackKind, number> = {
	custom: 7,
	documentation: 3,
	executive_task: 6,
	follow_up: 5,
	implementation: 1,
	research: 4,
	review: 0,
	task: 2,
};

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type AgentPackStatus =
	| 'ready'
	| 'blocked'
	| 'stale'
	| 'missing_source'
	| 'requires_review'
	| 'skipped'
	| 'unknown';

export const AGENT_PACK_STATUS_ORDER: Record<AgentPackStatus, number> = {
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

export type AgentPackAction =
	| 'plan_bundle'
	| 'skip_current'
	| 'block_until_canonical_current'
	| 'block_until_source_available'
	| 'block_until_validation_passes'
	| 'manual_review'
	| 'no_action';

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface AgentPackReadiness {
	ready: boolean;
	sourcesReady: boolean;
	canonicalCurrent: boolean;
	originSafe: boolean;
	blockers: AgentPackBlocker[];
	blockerCount: number;
	warningCount: number;
}

// ---------------------------------------------------------------------------
// Source Kinds and Sources
// ---------------------------------------------------------------------------

export type AgentPackSourceKind =
	| 'canonical_markdown'
	| 'profile_descriptor'
	| 'document_descriptor'
	| 'decision_register'
	| 'assumption_register'
	| 'hypothesis_register'
	| 'risk_register'
	| 'open_question_register'
	| 'validation_finding'
	| 'consistency_finding'
	| 'traceability_source'
	| 'provenance_claim'
	| 'artifact_metadata'
	| 'executive_declaration'
	| 'generated_output_metadata'
	| 'unknown';

export interface AgentPackSource {
	sourceId: string;
	sourceKind: AgentPackSourceKind;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	outputPath: string | undefined;
	required: boolean;
	label: string | undefined;
	status: string | undefined;
}

// ---------------------------------------------------------------------------
// Required Context
// ---------------------------------------------------------------------------

export interface AgentPackRequiredContext {
	canonicalSourceDocumentIds: CanonicalDocumentId[];
	canonicalSourceOutputPaths: string[];
	sourcePhaseIds: PhaseId[];
	requiredDecisionIds: string[];
	requiredAssumptionIds: string[];
	requiredRiskIds: string[];
	requiredOpenQuestionIds: string[];
	requiredValidationFindingIds: string[];
	requiredTraceabilitySourceIds: string[];
	requiredProvenanceClaimIds: string[];
	requiredExecutiveItemRefs: string[];
}

// ---------------------------------------------------------------------------
// Blocker and Reason
// ---------------------------------------------------------------------------

export type AgentPackReasonCode =
	| 'canonical_source_missing'
	| 'canonical_source_stale'
	| 'canonical_source_blocked'
	| 'canonical_source_unknown'
	| 'required_source_path_unsafe'
	| 'required_decision_missing'
	| 'required_assumption_missing'
	| 'required_risk_missing'
	| 'blocking_open_question'
	| 'release_blocking_validation_finding'
	| 'release_blocking_consistency_finding'
	| 'traceability_source_missing'
	| 'output_path_unsafe'
	| 'declaration_malformed'
	| 'pack_kind_unsupported'
	| 'manual_edit_collision'
	| 'optional_source_stale'
	| 'optional_dependency_missing'
	| 'review_required_inferred_source'
	| 'non_blocking_validation_warning'
	| 'incomplete_source_document'
	| 'unresolved_non_blocking_open_question'
	| 'no_generated_canonical_file'
	| 'executive_not_compiled'
	| 'insufficient_metadata'
	| 'research_pack_unresolved';

export interface AgentPackBlocker {
	code: AgentPackReasonCode;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourceKind: AgentPackSourceKind | undefined;
	sourceDocumentId: CanonicalDocumentId | undefined;
	sourcePath: string | undefined;
	packKind: AgentPackKind | undefined;
	relatedPhaseId: PhaseId | undefined;
	graphNodeId: DependencyGraphNodeId | undefined;
	expected: string | undefined;
	received: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Dependency
// ---------------------------------------------------------------------------

export interface AgentPackDependency {
	sourceId: string;
	sourceKind: AgentPackSourceKind;
	documentCanonicalId: CanonicalDocumentId | undefined;
	outputPath: string | undefined;
	required: boolean;
	status: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface AgentPackDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath: string | undefined;
	fieldPath: string | undefined;
	relatedPackId: string | undefined;
	relatedPackKind: AgentPackKind | undefined;
	relatedSourceDocumentId: CanonicalDocumentId | undefined;
	relatedRegisterItemId: string | undefined;
	relatedSourceId: string | undefined;
	relatedClaimId: string | undefined;
	relatedValidationFindingId: string | undefined;
	relatedPhaseId: PhaseId | undefined;
	relatedGraphNodeId: DependencyGraphNodeId | undefined;
	expected: string | undefined;
	received: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Declaration types
// ---------------------------------------------------------------------------

export type AgentPackDeclarationSource =
	| 'profile_output_model'
	| 'phase_descriptor'
	| 'document_descriptor'
	| 'executive_agent_pack_mapping';

export interface AgentPackDeclaration {
	packId: string;
	packKind: AgentPackKind;
	title: string;
	declarationSource: AgentPackDeclarationSource;
	profilePath: string | undefined;
	descriptorPath: string | undefined;
	descriptorPointer: string | undefined;
	phaseId: PhaseId | undefined;
	documentCanonicalId: CanonicalDocumentId | undefined;
	outputPath: string;
	relativeOutputPath: string;
	format: string;
	purpose: string | undefined;
	agentRole: string | undefined;
	includes: string[] | undefined;
	constraints: string[] | undefined;
	templateType: string | undefined;
	optional: boolean;
	deferred: boolean;
	orderIndex: number;
}

// ---------------------------------------------------------------------------
// Plan Item
// ---------------------------------------------------------------------------

export interface AgentPackPlanItem {
	packId: string;
	packKind: AgentPackKind;
	title: string;
	status: AgentPackStatus;
	action: AgentPackAction;
	readiness: AgentPackReadiness;
	outputPath: string;
	relativeOutputPath: string;
	declarationSource: AgentPackDeclarationSource;
	profilePath: string | undefined;
	descriptorPath: string | undefined;
	descriptorPointer: string | undefined;
	phaseId: PhaseId | undefined;
	documentCanonicalId: CanonicalDocumentId | undefined;
	canonicalSourceDocumentIds: CanonicalDocumentId[];
	canonicalSourceOutputPaths: string[];
	sourcePhaseIds: PhaseId[];
	requiredDecisionIds: string[];
	requiredAssumptionIds: string[];
	requiredRiskIds: string[];
	requiredOpenQuestionIds: string[];
	requiredValidationFindingIds: string[];
	requiredTraceabilitySourceIds: string[];
	requiredProvenanceClaimIds: string[];
	requiredExecutiveItemRefs: string[];
	sources: AgentPackSource[];
	blockers: AgentPackBlocker[];
	reasons: AgentPackBlocker[];
	isDerivedExecutionAid: boolean;
	sourceOfTruthWarning: string;
	orderIndex: number;
	diagnostics: AgentPackDiagnostic[];
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface AgentPackPlan {
	profileId: string;
	documentationRoot: string;
	artifactRoot: string | undefined;
	declarationCount: number;
	items: AgentPackPlanItem[];
	countByStatus: Record<string, number>;
	countByAction: Record<string, number>;
	countByKind: Record<string, number>;
	blockerCount: number;
	warningCount: number;
	missingSourceCount: number;
	staleCount: number;
	requiresReviewCount: number;
	unsafePathCount: number;
	researchDeferredCount: number;
	diagnostics: AgentPackDiagnostic[];
	readOnly: true;
	dryRun: boolean;
	declaredPackPaths: string[];
}

// ---------------------------------------------------------------------------
// Input and Options
// ---------------------------------------------------------------------------

export interface AgentPackPlanInput {
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
				agentRole: string | undefined;
				includes: string[] | undefined;
				constraints: string[] | undefined;
			}[];
			outputAgentPacks: readonly {
				id: string | undefined;
				path: string;
				format: string;
				purpose: string | undefined;
				agentRole: string | undefined;
				includes: string[] | undefined;
				constraints: string[] | undefined;
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
			agentRole: string | undefined;
			includes: string[] | undefined;
			constraints: string[] | undefined;
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
			agentRole: string | undefined;
			includes: string[] | undefined;
			constraints: string[] | undefined;
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
					agentPack:
						| {
								path: string;
								mapping: string;
								status: string;
								targets?: Record<
									string,
									{
										outputPath: string;
										supportedItemTypes: string[];
									}
								>;
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
	consistencyFindings:
		| {
				violations: readonly {
					id: string;
					code: string;
					severity: string;
					message: string;
					documentCanonicalId: string | undefined;
					phaseId: string | undefined;
				}[];
				summary: {
					errorCount: number;
					warningCount: number;
					infoCount: number;
				};
		  }
		| undefined;
	registerSummary:
		| {
				decisionCount: number;
				assumptionCount: number;
				riskCount: number;
				openQuestionCount: number;
				hypothesisCount: number;
				blockingOpenQuestionCount: number;
				reviewRequiredCount: number;
				missingSourceCount: number;
		  }
		| undefined;
	manualEditCollisions: readonly string[] | undefined;
}

export interface AgentPackPlanOptions {
	dryRun?: boolean;
	documentationRootOverride?: string;
	artifactRootOverride?: string;
	generatedAt?: string;
}

export interface AgentPackPlanResult {
	plan: AgentPackPlan;
	diagnostics: AgentPackDiagnostic[];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface AgentPackSummary {
	declaredCount: number;
	readyCount: number;
	blockedCount: number;
	staleCount: number;
	missingSourceCount: number;
	requiresReviewCount: number;
	unknownCount: number;
	skippedCount: number;
	unsafePathCount: number;
	researchDeferredCount: number;
	plannedPaths: string[];
	blockerSummary: string[];
}

// ---------------------------------------------------------------------------
// Output path
// ---------------------------------------------------------------------------

export interface AgentPackOutputPath {
	packId: string;
	packKind: AgentPackKind;
	outputPath: string;
	relativeOutputPath: string;
}
