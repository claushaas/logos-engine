/** Step 7.3 Regeneration Planning — types, statuses, reason codes, and contracts */

import type { DependencyGraphNodeId } from '../dependency-graph/dependency-graph.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { StalenessDiagnostic } from '../staleness/staleness-types.js';

// ---------------------------------------------------------------------------
// Target Kinds (aligned with StalenessTargetKind)
// ---------------------------------------------------------------------------

export type RegenerationPlanTargetKind =
	| 'canonical_markdown'
	| 'html_artifact'
	| 'agent_pack'
	| 'data_artifact'
	| 'report_artifact'
	| 'executive_json'
	| 'executive_markdown'
	| 'executive_html';

// ---------------------------------------------------------------------------
// Plan Statuses
// ---------------------------------------------------------------------------

export type RegenerationPlanStatus =
	| 'planned'
	| 'not_needed'
	| 'blocked'
	| 'skipped'
	| 'missing_source'
	| 'unsafe'
	| 'unknown';

// ---------------------------------------------------------------------------
// Plan Actions
// ---------------------------------------------------------------------------

export type RegenerationPlanAction =
	| 'regenerate'
	| 'generate_missing'
	| 'refresh_metadata'
	| 'skip_current'
	| 'skip_orphaned'
	| 'block_until_canonical_current'
	| 'block_until_dependency_current'
	| 'manual_review'
	| 'no_action';

// ---------------------------------------------------------------------------
// Reason Codes
// ---------------------------------------------------------------------------

export type RegenerationPlanReasonCode =
	| 'target_stale'
	| 'target_missing'
	| 'target_unknown'
	| 'target_orphaned'
	| 'profile_contract_changed'
	| 'document_descriptor_changed'
	| 'dependency_graph_changed'
	| 'workspace_state_changed'
	| 'decision_changed'
	| 'assumption_changed'
	| 'open_question_changed'
	| 'risk_changed'
	| 'accepted_proposal_changed'
	| 'generated_metadata_missing'
	| 'generated_metadata_invalid'
	| 'artifact_registry_mismatch'
	| 'output_checksum_mismatch'
	| 'upstream_required_stale'
	| 'upstream_required_missing'
	| 'upstream_required_blocked'
	| 'upstream_optional_changed'
	| 'canonical_source_not_current'
	| 'derived_artifact_after_canonical'
	| 'executive_requires_normative_current'
	| 'manual_edit_collision'
	| 'unsafe_output_path'
	| 'insufficient_metadata'
	| 'no_declared_output'
	| 'not_stale';

// ---------------------------------------------------------------------------
// Source Change Record
// ---------------------------------------------------------------------------

export interface RegenerationPlanSourceChange {
	readonly sourceKind: string;
	readonly sourceId: string | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly graphNodeId: DependencyGraphNodeId | undefined;
	readonly reasonCode: RegenerationPlanReasonCode;
	readonly changedTimestamp: string | undefined;
	readonly changedFingerprint: string | undefined;
	readonly affectedTargetIds: readonly string[];
	readonly severity: 'info' | 'warning' | 'error';
	readonly recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Reason
// ---------------------------------------------------------------------------

export interface RegenerationPlanReason {
	readonly code: RegenerationPlanReasonCode;
	readonly severity: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly sourceKind: string | undefined;
	readonly sourceId: string | undefined;
	readonly sourcePath: string | undefined;
	readonly targetId: string;
	readonly upstreamTargetId: string | undefined;
	readonly expected: string | undefined;
	readonly received: string | undefined;
}

// ---------------------------------------------------------------------------
// Dependency Reference
// ---------------------------------------------------------------------------

export interface RegenerationPlanDependency {
	readonly targetId: string;
	readonly targetKind: RegenerationPlanTargetKind;
	readonly graphNodeId: DependencyGraphNodeId | undefined;
	readonly status: RegenerationPlanStatus;
	readonly required: boolean;
	readonly message: string;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface RegenerationPlanDiagnostic {
	readonly code: string;
	readonly severity: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly sourcePath: string | undefined;
	readonly fieldPath: string | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly artifactId: string | undefined;
	readonly graphNodeId: DependencyGraphNodeId | undefined;
	readonly stalenessTargetId: string | undefined;
	readonly expected: string | undefined;
	readonly received: string | undefined;
	readonly recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Blocked / Skipped Reasons
// ---------------------------------------------------------------------------

export interface RegenerationPlanBlockedReason {
	readonly code: string;
	readonly message: string;
	readonly blockingTargetId: string | undefined;
	readonly blockingReasonCode: RegenerationPlanReasonCode | undefined;
	readonly recoveryHint: string | undefined;
}

export interface RegenerationPlanSkippedReason {
	readonly code: string;
	readonly message: string;
	readonly reason: string;
}

// ---------------------------------------------------------------------------
// Plan Item
// ---------------------------------------------------------------------------

export interface RegenerationPlanItem {
	readonly targetId: string;
	readonly targetKind: RegenerationPlanTargetKind;
	readonly status: RegenerationPlanStatus;
	readonly action: RegenerationPlanAction;
	readonly safeOrderIndex: number;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly graphNodeId: DependencyGraphNodeId | undefined;
	readonly outputPath: string | undefined;
	readonly artifactId: string | undefined;
	readonly stalenessStatus: string;
	readonly upstreamDependencies: readonly RegenerationPlanDependency[];
	readonly downstreamDependents: readonly RegenerationPlanDependency[];
	readonly sourceChangeRefs: readonly string[];
	readonly reasonCodes: readonly RegenerationPlanReasonCode[];
	readonly reasons: readonly RegenerationPlanReason[];
	readonly blockers: readonly RegenerationPlanBlockedReason[];
	readonly skippedReasons: readonly RegenerationPlanSkippedReason[];
	readonly canonicalPrerequisites: readonly string[];
	readonly derivedOutputPrerequisites: readonly string[];
	readonly dryRun: boolean;
	readonly diagnostics: readonly RegenerationPlanDiagnostic[];
}

// ---------------------------------------------------------------------------
// Plan — overall summary
// ---------------------------------------------------------------------------

export interface RegenerationPlan {
	readonly profileId: string;
	readonly documentationRoot: string;
	readonly dryRun: boolean;
	readonly graphNodeCount: number;
	readonly graphEdgeCount: number;
	readonly items: readonly RegenerationPlanItem[];
	readonly countByAction: Record<string, number>;
	readonly countByStatus: Record<string, number>;
	readonly countByTargetKind: Record<string, number>;
	readonly countByReasonCode: Record<string, number>;
	readonly sourceChanges: readonly RegenerationPlanSourceChange[];
	readonly dependencyImpactSummary: readonly string[];
	readonly blockedSummary: readonly string[];
	readonly orphanedManualReviewSummary: readonly string[];
	readonly diagnostics: readonly RegenerationPlanDiagnostic[];
}

// ---------------------------------------------------------------------------
// Dry-Run Summary
// ---------------------------------------------------------------------------

export interface RegenerationPlanDryRunSummary {
	readonly totalTargets: number;
	readonly plannedCount: number;
	readonly notNeededCount: number;
	readonly blockedCount: number;
	readonly skippedCount: number;
	readonly missingCount: number;
	readonly unknownCount: number;
	readonly manualReviewCount: number;
	readonly safeOrderDescriptions: readonly string[];
	readonly topReasons: readonly string[];
	readonly changedPaths: readonly string[];
}

// ---------------------------------------------------------------------------
// Summary (shorter, for integration)
// ---------------------------------------------------------------------------

export interface RegenerationPlanSummary {
	readonly totalTargets: number;
	readonly plannedCount: number;
	readonly blockedCount: number;
	readonly skippedCount: number;
	readonly missingCount: number;
	readonly staleCanonicalDocIds: readonly string[];
	readonly outOfScopeTargetKinds: readonly string[];
	readonly safeOrderNote: string;
	readonly futurePhasesNeeded: readonly string[];
}

// ---------------------------------------------------------------------------
// Input / Options
// ---------------------------------------------------------------------------

export interface RegenerationPlanInput {
	readonly profileId: string;
	readonly documentationRoot: string;
	readonly dependencyGraph: {
		readonly nodeMap: ReadonlyMap<
			DependencyGraphNodeId,
			{
				readonly id: DependencyGraphNodeId;
				readonly kind: string;
				readonly label: string;
				readonly title: string;
				readonly profileId: string;
				readonly phaseId: PhaseId | undefined;
				readonly documentCanonicalId: CanonicalDocumentId | undefined;
				readonly sourcePath: string | undefined;
				readonly outputTargetPath: string | undefined;
				readonly isCanonical: boolean | undefined;
				readonly orderIndex: number;
			}
		>;
		readonly nodes: readonly {
			readonly id: DependencyGraphNodeId;
			readonly kind: string;
			readonly documentCanonicalId: CanonicalDocumentId | undefined;
			readonly phaseId: PhaseId | undefined;
			readonly orderIndex: number;
		}[];
		readonly edges: readonly {
			readonly id: string;
			readonly kind: string;
			readonly fromNodeId: DependencyGraphNodeId;
			readonly toNodeId: DependencyGraphNodeId;
			readonly required: boolean | undefined;
		}[];
		readonly upstreamEdges: ReadonlyMap<
			DependencyGraphNodeId,
			readonly {
				readonly fromNodeId: string;
				readonly kind: string;
				readonly required: boolean | undefined;
			}[]
		>;
		readonly downstreamEdges?: ReadonlyMap<
			DependencyGraphNodeId,
			readonly {
				readonly toNodeId: string;
				readonly kind: string;
				readonly required: boolean | undefined;
			}[]
		>;
	};
	readonly stalenessResult: {
		readonly targets: readonly {
			readonly targetId: string;
			readonly targetKind: string;
			readonly status: string;
			readonly severity: string;
			readonly documentCanonicalId: CanonicalDocumentId | undefined;
			readonly phaseId: PhaseId | undefined;
			readonly outputPath: string | undefined;
			readonly artifactId: string | undefined;
			readonly generationRunId: string | undefined;
			readonly generatedAt: string | undefined;
			readonly currentNodeFingerprint: string | undefined;
			readonly recordedSourceFingerprint: string | undefined;
			readonly changedSourceRefs: readonly string[];
			readonly upstreamImpacts: readonly {
				readonly upstreamTargetId: string;
				readonly upstreamStatus: string;
				readonly edgeKind: string;
				readonly required: boolean;
				readonly message: string;
			}[];
			readonly reasons: readonly {
				readonly code: string;
				readonly severity: string;
				readonly message: string;
				readonly sourceKind: string;
				readonly sourceId: string | undefined;
				readonly sourcePath: string | undefined;
				readonly targetId: string;
				readonly expected: string | undefined;
				readonly received: string | undefined;
				readonly upstreamTargetId: string | undefined;
			}[];
			readonly diagnostics: readonly StalenessDiagnostic[];
			readonly graphNodeId: DependencyGraphNodeId | undefined;
		}[];
		readonly summary: {
			readonly currentCount: number;
			readonly staleCount: number;
			readonly missingCount: number;
			readonly blockedCount: number;
			readonly orphanedCount: number;
			readonly unknownCount: number;
			readonly total: number;
		};
	};
	readonly generationPlanSummary?:
		| {
				readonly totalDocumentCount: number;
				readonly actionCounts: Record<string, number>;
		  }
		| undefined;
	readonly manualEditCollisions?: readonly string[] | undefined;
}

export interface RegenerationPlanOptions {
	readonly dryRun?: boolean;
	readonly includeCurrent?: boolean;
	readonly includeDerived?: boolean;
	readonly includeOrphaned?: boolean;
	readonly includeUnknown?: boolean;
	readonly targetDocumentId?: string;
	readonly targetPhaseId?: string;
	readonly targetKind?: RegenerationPlanTargetKind;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface RegenerationPlanResult {
	readonly plan: RegenerationPlan;
	readonly dryRunSummary: RegenerationPlanDryRunSummary;
	readonly diagnostics: readonly RegenerationPlanDiagnostic[];
}
