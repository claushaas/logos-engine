/** Step 7.2 Staleness Detection — types, statuses, reason codes, and contracts */

import type { DependencyGraphNodeId } from '../dependency-graph/dependency-graph.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type StalenessStatus =
	| 'current'
	| 'stale'
	| 'missing'
	| 'blocked'
	| 'orphaned'
	| 'unknown';

// ---------------------------------------------------------------------------
// Target kinds
// ---------------------------------------------------------------------------

export type StalenessTargetKind =
	| 'canonical_markdown'
	| 'html_artifact'
	| 'agent_pack'
	| 'data_artifact'
	| 'report_artifact'
	| 'executive_json'
	| 'executive_markdown'
	| 'executive_html';

// ---------------------------------------------------------------------------
// Source kinds
// ---------------------------------------------------------------------------

export type StalenessSourceKind =
	| 'profile_contract'
	| 'document_descriptor'
	| 'dependency_graph'
	| 'workspace_state'
	| 'decision'
	| 'assumption'
	| 'open_question'
	| 'risk'
	| 'accepted_proposal'
	| 'generation_run'
	| 'artifact_registry'
	| 'generated_metadata'
	| 'output_file';

// ---------------------------------------------------------------------------
// Reason codes
// ---------------------------------------------------------------------------

export type StalenessReasonCode =
	| 'profile_contract_changed'
	| 'document_descriptor_changed'
	| 'dependency_graph_changed'
	| 'workspace_state_changed'
	| 'decision_changed'
	| 'assumption_changed'
	| 'open_question_changed'
	| 'risk_changed'
	| 'accepted_proposal_changed'
	| 'generation_metadata_missing'
	| 'generation_metadata_invalid'
	| 'artifact_registry_missing'
	| 'artifact_registry_mismatch'
	| 'output_file_missing'
	| 'output_checksum_mismatch'
	| 'upstream_required_stale'
	| 'upstream_required_missing'
	| 'upstream_required_blocked'
	| 'upstream_optional_changed'
	| 'orphaned_document'
	| 'orphaned_output'
	| 'unsafe_output_path'
	| 'insufficient_metadata';

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type StalenessSeverity = 'info' | 'warning' | 'error';

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

export interface StalenessTarget {
	readonly targetId: string;
	readonly targetKind: StalenessTargetKind;
	readonly status: StalenessStatus;
	readonly severity: StalenessSeverity;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly outputPath: string | undefined;
	readonly artifactId: string | undefined;
	readonly generationRunId: string | undefined;
	readonly generatedAt: string | undefined;
	readonly currentNodeFingerprint: string | undefined;
	readonly recordedSourceFingerprint: string | undefined;
	readonly changedSourceRefs: readonly string[];
	readonly upstreamImpacts: readonly StalenessDependencyImpact[];
	readonly reasons: readonly StalenessReason[];
	readonly diagnostics: readonly StalenessDiagnostic[];
	readonly graphNodeId: DependencyGraphNodeId | undefined;
}

// ---------------------------------------------------------------------------
// Reason
// ---------------------------------------------------------------------------

export interface StalenessReason {
	readonly code: StalenessReasonCode;
	readonly severity: StalenessSeverity;
	readonly message: string;
	readonly sourceKind: StalenessSourceKind;
	readonly sourceId: string | undefined;
	readonly sourcePath: string | undefined;
	readonly targetId: string;
	readonly expected: string | undefined;
	readonly received: string | undefined;
	readonly upstreamTargetId: string | undefined;
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

export interface StalenessFingerprint {
	readonly kind: StalenessSourceKind;
	readonly value: string;
	readonly algorithm: string;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface StalenessComparison {
	readonly sourceKind: StalenessSourceKind;
	readonly currentFingerprint: string | undefined;
	readonly recordedFingerprint: string | undefined;
	readonly match: boolean | undefined;
	readonly reason: string | undefined;
}

// ---------------------------------------------------------------------------
// Dependency Impact
// ---------------------------------------------------------------------------

export interface StalenessDependencyImpact {
	readonly upstreamTargetId: string;
	readonly upstreamStatus: StalenessStatus;
	readonly edgeKind: string;
	readonly required: boolean;
	readonly message: string;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface StalenessDiagnostic {
	readonly code: string;
	readonly severity: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly sourcePath: string | undefined;
	readonly fieldPath: string | undefined;
	readonly phaseId: PhaseId | undefined;
	readonly documentCanonicalId: CanonicalDocumentId | undefined;
	readonly artifactId: string | undefined;
	readonly graphNodeId: DependencyGraphNodeId | undefined;
	readonly expected: string | undefined;
	readonly received: string | undefined;
	readonly recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Record types
// ---------------------------------------------------------------------------

export interface DocumentStalenessRecord {
	readonly documentCanonicalId: CanonicalDocumentId;
	readonly phaseId: PhaseId;
	readonly status: StalenessStatus;
	readonly severity: StalenessSeverity;
	readonly outputTargets: readonly StalenessTarget[];
}

export interface ArtifactStalenessRecord {
	readonly artifactId: string;
	readonly artifactType: string;
	readonly path: string;
	readonly status: StalenessStatus;
	readonly severity: StalenessSeverity;
	readonly reasons: readonly StalenessReason[];
	readonly diagnostics: readonly StalenessDiagnostic[];
}

// ---------------------------------------------------------------------------
// Input / Options
// ---------------------------------------------------------------------------

export interface StalenessDetectionInput {
	readonly profileId: string;
	readonly documentationRoot: string;
	readonly profileRoot: string;
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
	};
	readonly loadedDescriptorData: ReadonlyMap<
		CanonicalDocumentId,
		{
			readonly title: string;
			readonly phaseId: PhaseId;
			readonly canonicalOutput: string;
			readonly outputs: readonly {
				readonly kind: string;
				readonly path: string | undefined;
				readonly format: string | undefined;
			}[];
			readonly inputs: readonly {
				readonly type: string;
				readonly id: string;
				readonly required: boolean | undefined;
			}[];
			readonly status: string | undefined;
		}
	>;
	readonly phaseDescriptors: readonly {
		readonly id: PhaseId;
		readonly title: string;
		readonly sourcePath: string;
	}[];
	readonly profileRegistryFingerprint: string;
	readonly profileVersion: string | undefined;
	readonly decisions: readonly {
		readonly id: string;
		readonly title: string;
		readonly status: string;
		readonly body: string | undefined;
		readonly affectedDocumentIds: readonly string[];
		readonly createdAt: string | undefined;
		readonly updatedAt: string | undefined;
	}[];
	readonly assumptions: readonly {
		readonly id: string;
		readonly title: string;
		readonly status: string;
		readonly body: string | undefined;
		readonly affectedDocumentIds: readonly string[];
		readonly createdAt: string | undefined;
		readonly updatedAt: string | undefined;
	}[];
	readonly openQuestions: readonly {
		readonly id: string;
		readonly question: string;
		readonly status: string;
		readonly body: string | undefined;
		readonly affectedDocumentIds: readonly string[];
		readonly createdAt: string | undefined;
		readonly updatedAt: string | undefined;
	}[];
	readonly risks: readonly {
		readonly id: string;
		readonly title: string;
		readonly status: string;
		readonly severity: string;
		readonly body: string | undefined;
		readonly affectedDocumentIds: readonly string[];
		readonly createdAt: string | undefined;
		readonly updatedAt: string | undefined;
	}[];
	readonly artifactRegistryEntries: readonly {
		readonly artifactId: string;
		readonly artifactType: string;
		readonly path: string;
		readonly status: string;
		readonly checksum: string | undefined;
		readonly generatedAt: string | undefined;
		readonly runId: string | undefined;
		readonly isCanonical: boolean;
		readonly sourceDocumentIds: readonly string[];
		readonly metadata: Record<string, unknown> | undefined;
	}[];
	readonly generationRuns: readonly {
		readonly runId: string;
		readonly startedAt: string;
		readonly completedAt: string | undefined;
		readonly status: string;
		readonly relatedArtifactIds: readonly string[];
	}[];
	readonly generatedMetadataOverrides: ReadonlyMap<
		string,
		{
			readonly documentId: string;
			readonly phaseId: string;
			readonly profileId: string;
			readonly canonicalOutput: string;
			readonly generatedAt: string;
			readonly generationStatus: string;
		}
	>;
}

export interface StalenessDetectionOptions {
	readonly readGeneratedMetadata?: (
		outputPath: string,
		projectRoot: string,
	) => Promise<
		| {
				readonly metadata: {
					readonly documentId: string;
					readonly phaseId: string;
					readonly profileId: string;
					readonly canonicalOutput: string;
					readonly generatedAt: string;
					readonly generationStatus: string;
				};
				readonly checksum: string;
				readonly parsedSuccessfully: boolean;
				readonly parseErrors: string[];
		  }
		| undefined
	>;
	readonly outputFileExists?: (outputPath: string) => Promise<boolean>;
	readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface StalenessDetectionResult {
	readonly profileId: string;
	readonly documentationRoot: string;
	readonly graphSummary: {
		readonly nodeCount: number;
		readonly edgeCount: number;
		readonly outputNodeCount: number;
	};
	readonly targets: readonly StalenessTarget[];
	readonly summary: StalenessSummary;
	readonly optionalDependencyWarnings: readonly StalenessReason[];
	readonly diagnostics: readonly StalenessDiagnostic[];
	readonly readOnly: true;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface StalenessSummary {
	readonly currentCount: number;
	readonly staleCount: number;
	readonly missingCount: number;
	readonly blockedCount: number;
	readonly orphanedCount: number;
	readonly unknownCount: number;
	readonly countByTargetKind: Record<string, number>;
	readonly countByStatus: Record<string, number>;
	readonly topStaleReasons: readonly string[];
	readonly topBlockingReasons: readonly string[];
	readonly optionalDependencyWarningCount: number;
	readonly total: number;
}

// ---------------------------------------------------------------------------
// Helpers: map graph node kind to staleness target kind
// ---------------------------------------------------------------------------

const GRAPH_TO_STALENESS_KIND: Record<string, StalenessTargetKind> = {
	agent_pack: 'agent_pack',
	canonical_output: 'canonical_markdown',
	data_artifact: 'data_artifact',
	executive_html: 'executive_html',
	executive_json: 'executive_json',
	executive_markdown: 'executive_markdown',
	executive_output: 'executive_json',
	html_artifact: 'html_artifact',
	report_artifact: 'report_artifact',
};

export function graphKindToStalenessTargetKind(
	kind: string,
): StalenessTargetKind | undefined {
	return GRAPH_TO_STALENESS_KIND[kind];
}

// ---------------------------------------------------------------------------
// Status ordering
// ---------------------------------------------------------------------------

const STATUS_RANK: Record<StalenessStatus, number> = {
	blocked: 3,
	current: 0,
	missing: 2,
	orphaned: 4,
	stale: 1,
	unknown: 5,
};

export function compareStalenessStatus(
	a: StalenessStatus,
	b: StalenessStatus,
): number {
	return (STATUS_RANK[a] ?? 99) - (STATUS_RANK[b] ?? 99);
}
