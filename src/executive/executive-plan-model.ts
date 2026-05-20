/** Step 11.2 — Executive Plan compilation model types and contracts */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { ClaimId, SourceId } from '../provenance/provenance-types.js';
import type { RegisterItemId } from '../registers/register-types.js';
import type { ValidationFindingSeverity } from '../validation/validation-finding.js';

// ---------------------------------------------------------------------------
// Compilation mode
// ---------------------------------------------------------------------------

export type ExecutivePlanCompilationMode = 'strict' | 'diagnostic_preview';

// ---------------------------------------------------------------------------
// Compilation status
// ---------------------------------------------------------------------------

export type ExecutivePlanCompilationStatus =
	| 'compiled'
	| 'blocked'
	| 'compiled_with_warnings'
	| 'failed'
	| 'unknown';

// ---------------------------------------------------------------------------
// Work item kinds (compiler model)
// ---------------------------------------------------------------------------

export type ExecutivePlanWorkItemKind =
	| 'implementation'
	| 'documentation'
	| 'validation'
	| 'review'
	| 'research'
	| 'follow_up'
	| 'export'
	| 'custom';

// ---------------------------------------------------------------------------
// Work item statuses (compiler model)
// ---------------------------------------------------------------------------

export type ExecutivePlanWorkItemStatus =
	| 'planned'
	| 'blocked'
	| 'requires_review'
	| 'deferred'
	| 'not_applicable';

// ---------------------------------------------------------------------------
// Item type (mirrors executive-plan.schema.json itemType + executive-generation.yml itemTypes)
// ---------------------------------------------------------------------------

export type ExecutivePlanItemType =
	| 'task'
	| 'decision'
	| 'question'
	| 'blocker'
	| 'risk'
	| 'experiment'
	| 'review'
	| 'agent_prompt'
	| 'doc_update'
	| 'spike'
	| 'artifact'
	| 'bug'
	| 'follow_up';

// ---------------------------------------------------------------------------
// Item status (mirrors executive-plan.schema.json status enum)
// ---------------------------------------------------------------------------

export type ExecutivePlanItemStatus =
	| 'draft'
	| 'planned'
	| 'ready'
	| 'in_progress'
	| 'blocked'
	| 'reviewing'
	| 'done'
	| 'cancelled'
	| 'superseded';

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export type ExecutivePlanItemPriority = 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Item origin
// ---------------------------------------------------------------------------

export type ExecutivePlanItemOrigin = 'derived' | 'inferred' | 'manual';

// ---------------------------------------------------------------------------
// Suggested executor
// ---------------------------------------------------------------------------

export interface ExecutivePlanSuggestedExecutor {
	readonly type: 'human' | 'agent' | 'hybrid';
	readonly agentProfile?: string | undefined;
}

// ---------------------------------------------------------------------------
// Source reference
// ---------------------------------------------------------------------------

export interface ExecutivePlanSourceReference {
	readonly sourceId?: SourceId | undefined;
	readonly documentCanonicalId?: CanonicalDocumentId | undefined;
	readonly phaseId?: PhaseId | undefined;
	readonly path?: string | undefined;
	readonly pointer?: string | undefined;
	readonly sourceKind:
		| 'document'
		| 'profile'
		| 'register'
		| 'finding'
		| 'claim'
		| 'provenance'
		| 'graph'
		| 'artifact'
		| 'contract'
		| 'executive';
}

// ---------------------------------------------------------------------------
// Traceability reference
// ---------------------------------------------------------------------------

export interface ExecutivePlanTraceability {
	readonly sourceDocuments: ExecutivePlanSourceReference[];
	readonly sourceClaims: ExecutivePlanSourceReference[];
	readonly sourceRecords: ExecutivePlanSourceReference[];
	readonly registerItems: ExecutivePlanSourceReference[];
	readonly validationFindings: ExecutivePlanSourceReference[];
	readonly consistencyFindings: ExecutivePlanSourceReference[];
	readonly readinessBlockers: ExecutivePlanSourceReference[];
	readonly readinessWarnings: ExecutivePlanSourceReference[];
	readonly artifactMetadata: ExecutivePlanSourceReference[];
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface ExecutivePlanDiagnostic {
	readonly code: string;
	readonly severity: ValidationFindingSeverity;
	readonly message: string;
	readonly sourcePath?: string | undefined;
	readonly pointer?: string | undefined;
	readonly planId?: string | undefined;
	readonly documentCanonicalId?: CanonicalDocumentId | undefined;
	readonly phaseId?: PhaseId | undefined;
	readonly milestoneId?: string | undefined;
	readonly workItemId?: string | undefined;
	readonly dependencyId?: string | undefined;
	readonly blockerId?: string | undefined;
	readonly riskId?: string | undefined;
	readonly acceptanceCriterionId?: string | undefined;
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
// Phase
// ---------------------------------------------------------------------------

export interface ExecutivePlanPhase {
	readonly phaseId: PhaseId;
	readonly title: string;
	readonly order: number;
	readonly sourceDocumentIds: CanonicalDocumentId[];
	readonly readinessStatus: string;
	readonly milestoneIds: string[];
	readonly workItemIds: string[];
	readonly blockerIds: string[];
	readonly riskIds: string[];
	readonly sourceReferences: ExecutivePlanSourceReference[];
	readonly diagnostics: ExecutivePlanDiagnostic[];
}

// ---------------------------------------------------------------------------
// Milestone
// ---------------------------------------------------------------------------

export interface ExecutivePlanMilestone {
	readonly milestoneId: string;
	readonly title: string;
	readonly phaseId: PhaseId | undefined;
	readonly scope: string;
	readonly objective: string;
	readonly sourceReferences: ExecutivePlanSourceReference[];
	readonly workItemIds: string[];
	readonly dependencyIds: string[];
	readonly readinessStatus: string;
	readonly acceptanceCriteriaIds: string[];
	readonly blockerIds: string[];
	readonly order: number;
}

// ---------------------------------------------------------------------------
// Work item
// ---------------------------------------------------------------------------

export interface ExecutivePlanWorkItem {
	readonly workItemId: string;
	readonly kind: ExecutivePlanWorkItemKind;
	readonly itemType: ExecutivePlanItemType;
	readonly title: string;
	readonly description: string;
	readonly phaseId: PhaseId | undefined;
	readonly milestoneId: string | undefined;
	readonly sourceDocumentIds: CanonicalDocumentId[];
	readonly sourceReferences: ExecutivePlanSourceReference[];
	readonly dependencyIds: string[];
	readonly blockerIds: string[];
	readonly riskIds: string[];
	readonly acceptanceCriteria: string[];
	readonly expectedOutputs: string[];
	readonly status: ExecutivePlanWorkItemStatus;
	readonly priority: ExecutivePlanItemPriority;
	readonly order: number;
	readonly nonGoals: string[];
	readonly traceabilityReferences: ExecutivePlanSourceReference[];
	readonly diagnostics: ExecutivePlanDiagnostic[];
	readonly origin: ExecutivePlanItemOrigin;
	readonly requiresReview: boolean;
}

// ---------------------------------------------------------------------------
// Dependency
// ---------------------------------------------------------------------------

export interface ExecutivePlanDependency {
	readonly dependencyId: string;
	readonly fromItemId: string;
	readonly toItemId: string;
	readonly dependencyType: string;
	readonly sourceReference: ExecutivePlanSourceReference;
	readonly reason: string;
	readonly status: ExecutivePlanWorkItemStatus;
}

// ---------------------------------------------------------------------------
// Blocker
// ---------------------------------------------------------------------------

export interface ExecutivePlanBlocker {
	readonly blockerId: string;
	readonly kind: string;
	readonly severity: ValidationFindingSeverity;
	readonly message: string;
	readonly affectedPhaseIds: PhaseId[];
	readonly affectedDocumentIds: CanonicalDocumentId[];
	readonly affectedWorkItemIds: string[];
	readonly sourceFindingId: string | undefined;
	readonly sourceRegisterId: RegisterItemId | undefined;
	readonly sourceSourceId: SourceId | undefined;
	readonly recoveryHint: string | undefined;
	readonly releaseBlocking: boolean;
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export interface ExecutivePlanRisk {
	readonly riskId: string;
	readonly title: string;
	readonly summary: string;
	readonly status: string;
	readonly likelihood: string | undefined;
	readonly impact: string | undefined;
	readonly mitigation: string | undefined;
	readonly affectedPhaseIds: PhaseId[];
	readonly affectedDocumentIds: CanonicalDocumentId[];
	readonly affectedWorkItemIds: string[];
	readonly sourceRegisterIds: RegisterItemId[];
	readonly sourceReferences: ExecutivePlanSourceReference[];
	readonly reviewState: string | undefined;
	readonly diagnostics: ExecutivePlanDiagnostic[];
}

// ---------------------------------------------------------------------------
// Acceptance criterion
// ---------------------------------------------------------------------------

export interface ExecutivePlanAcceptanceCriterion {
	readonly criterionId: string;
	readonly statement: string;
	readonly sourceDocumentId: CanonicalDocumentId | undefined;
	readonly sourceSection: string | undefined;
	readonly sourcePath: string | undefined;
	readonly relatedWorkItemIds: string[];
	readonly validationEvidence: string | undefined;
	readonly status:
		| 'planned'
		| 'satisfied'
		| 'blocked'
		| 'requires_review'
		| 'unknown';
	readonly diagnostics: ExecutivePlanDiagnostic[];
}

// ---------------------------------------------------------------------------
// Readiness snapshot
// ---------------------------------------------------------------------------

export interface ExecutivePlanReadinessSnapshot {
	readonly readinessStatus: string;
	readonly gateStatus: string;
	readonly profileId: string;
	readonly profileVersion: string | undefined;
	readonly executiveProfileVersion: string | undefined;
	readonly documentationRoot: string;
	readonly evaluatedAt: string;
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
// Export metadata
// ---------------------------------------------------------------------------

export interface ExecutivePlanExportMetadata {
	readonly exportTargetId: string;
	readonly name: string;
	readonly supportStatus:
		| 'supported_now'
		| 'planned_adapter_contract'
		| 'unsupported'
		| 'blocked';
	readonly mappingSourcePath: string | undefined;
	readonly outputPath: string | undefined;
	readonly derivedMarker: boolean;
	readonly nonCanonicalMarker: boolean;
	readonly externalApiExecution: boolean;
}

// ---------------------------------------------------------------------------
// Executive Plan JSON (schema-compliant output)
// ---------------------------------------------------------------------------

export interface ExecutivePlanJsonProject {
	id: string;
	name: string;
	description: string;
}

export interface ExecutivePlanJsonSource {
	normativeDocuments: string[];
	readinessStatus: string;
	sourceCommit: string | null;
	generationPromptId: string | null;
	warnings: string[];
}

export interface ExecutivePlanJsonRoadmap {
	id: string;
	title: string;
	description: string;
	horizon: string;
	status: ExecutivePlanItemStatus;
	milestoneIds: string[];
}

export interface ExecutivePlanJsonMilestone {
	id: string;
	title: string;
	objective: string;
	status: ExecutivePlanItemStatus;
	exitCriteria: string[];
	initiativeIds: string[];
}

export interface ExecutivePlanJsonWorkstream {
	id: string;
	title: string;
	description: string;
	type: string;
	relatedNormativeAreas: string[];
}

export interface ExecutivePlanJsonInitiative {
	id: string;
	title: string;
	status: ExecutivePlanItemStatus;
	purpose: string;
	deliverables: string[];
	itemIds: string[];
	milestoneId: string | undefined;
	workstreamId: string | undefined;
}

export interface ExecutivePlanJsonItem {
	id: string;
	type: ExecutivePlanItemType;
	title: string;
	status: ExecutivePlanItemStatus;
	priority: ExecutivePlanItemPriority;
	description: string;
	dependsOn: string[];
	softDependsOn: string[];
	acceptanceCriteria: string[];
	initiativeId: string | undefined;
	workstreamId: string | undefined;
	origin: ExecutivePlanItemOrigin;
	requiresReview: boolean;
	sourceNormativeDocuments: string[];
	sourceRationale: string;
	suggestedExecutor: ExecutivePlanSuggestedExecutor | undefined;
	suggestedExports: Record<string, unknown>;
	metadata: Record<string, unknown>;
}

export interface ExecutivePlanJsonDecision {
	id: string;
	title: string;
	status: ExecutivePlanItemStatus;
	decision: string;
	context: string;
	consequences: string[];
	affectedNormativeDocuments: string[];
}

export interface ExecutivePlanJsonRisk {
	id: string;
	title: string;
	description: string;
	likelihood: ExecutivePlanItemPriority;
	impact: ExecutivePlanItemPriority;
	mitigation: string;
	sourceNormativeDocuments: string[];
}

export interface ExecutivePlanJsonArtifact {
	id: string;
	type: string;
	title: string;
	status: ExecutivePlanItemStatus;
	path: string;
	generatedFrom: string[];
	relatedItemIds: string[];
}

export interface ExecutivePlanJsonConfidenceLevel {
	overall: 'low' | 'medium' | 'high';
	byArea: Record<string, 'low' | 'medium' | 'high'>;
}

export interface ExecutivePlanJsonExportConfig {
	enabled: boolean;
	mappingProfile: string;
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Top-level executive plan JSON
// ---------------------------------------------------------------------------

export interface ExecutivePlanJson {
	id: string;
	version: string;
	project: ExecutivePlanJsonProject;
	generatedAt: string;
	source: ExecutivePlanJsonSource;
	execution: {
		roadmaps: ExecutivePlanJsonRoadmap[];
		milestones: ExecutivePlanJsonMilestone[];
		workstreams: ExecutivePlanJsonWorkstream[];
		initiatives: ExecutivePlanJsonInitiative[];
		items: ExecutivePlanJsonItem[];
		decisions: ExecutivePlanJsonDecision[];
		risks: ExecutivePlanJsonRisk[];
		artifacts: ExecutivePlanJsonArtifact[];
	};
	confidence: ExecutivePlanJsonConfidenceLevel;
	exports: Record<string, ExecutivePlanJsonExportConfig>;
	metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Compiler input
// ---------------------------------------------------------------------------

export interface ExecutivePlanCompileInput {
	readonly readinessResult: import('./executive-readiness-types.js').NormativeBaselineReadinessResult;
	readonly compilationMode: ExecutivePlanCompilationMode;
	readonly clock: () => string;
	readonly projectId?: string | undefined;
	readonly projectName?: string | undefined;
	readonly projectDescription?: string | undefined;
	readonly executorVersion?: string | undefined;
	readonly dependencyGraph?:
		| {
				readonly nodes: readonly {
					readonly id: string;
					readonly kind: string;
					readonly label: string;
					readonly title: string;
					readonly documentCanonicalId?: string | undefined;
					readonly phaseId?: string | undefined;
				}[];
				readonly edges: readonly {
					readonly sourceId: string;
					readonly targetId: string;
					readonly kind: string;
				}[];
		  }
		| undefined;
}

// ---------------------------------------------------------------------------
// Compiler options
// ---------------------------------------------------------------------------

export interface ExecutivePlanCompileOptions {
	readonly strictMode?: boolean | undefined;
	readonly allowWarningsInStrict?: boolean | undefined;
	readonly injectPlanId?: string | undefined;
	readonly executiveSchemaPath?: string | undefined;
	readonly profileSource?: string | undefined;
}

// ---------------------------------------------------------------------------
// Compiler result
// ---------------------------------------------------------------------------

export interface ExecutivePlanCompileResult {
	readonly status: ExecutivePlanCompilationStatus;
	readonly plan: ExecutivePlanJson | null;
	readonly compilationMode: ExecutivePlanCompilationMode;
	readonly diagnosticOnly: boolean;
	readonly exportReady: boolean;
	readonly blockers: ExecutivePlanBlocker[];
	readonly warnings: ExecutivePlanDiagnostic[];
	readonly diagnostics: ExecutivePlanDiagnostic[];
	readonly readinessSnapshot: ExecutivePlanReadinessSnapshot | null;
	readonly changedPaths: readonly [];
	readonly readOnly: true;
}

// ---------------------------------------------------------------------------
// Generation result (for optional write service)
// ---------------------------------------------------------------------------

export interface ExecutivePlanChangedPath {
	readonly path: string;
	readonly role: 'executive_plan_json';
	readonly action: 'created' | 'updated' | 'skipped' | 'blocked';
	readonly checksum?: string | undefined;
}

export interface ExecutivePlanGenerationResult {
	readonly status: ExecutivePlanCompilationStatus;
	readonly compileResult: ExecutivePlanCompileResult;
	readonly changedPaths: readonly ExecutivePlanChangedPath[];
	readonly dryRun: boolean;
	readonly artifactRegistryUpdated: boolean;
	readonly schemaValidationPassed: boolean;
	readonly securityCheckPassed: boolean;
}

// ---------------------------------------------------------------------------
// Work item kind to schema item type mapping
// ---------------------------------------------------------------------------

export const WORK_ITEM_KIND_TO_SCHEMA_TYPE: Record<
	ExecutivePlanWorkItemKind,
	ExecutivePlanItemType
> = {
	custom: 'task',
	documentation: 'doc_update',
	export: 'task',
	follow_up: 'follow_up',
	implementation: 'task',
	research: 'spike',
	review: 'review',
	validation: 'review',
};

// ---------------------------------------------------------------------------
// Work item kind order for deterministic sorting
// ---------------------------------------------------------------------------

export const WORK_ITEM_KIND_ORDER: Record<ExecutivePlanWorkItemKind, number> = {
	custom: 7,
	documentation: 1,
	export: 6,
	follow_up: 5,
	implementation: 0,
	research: 4,
	review: 3,
	validation: 2,
};

// ---------------------------------------------------------------------------
// Item type order for deterministic sorting
// ---------------------------------------------------------------------------

export const ITEM_TYPE_ORDER: Record<ExecutivePlanItemType, number> = {
	agent_prompt: 10,
	artifact: 11,
	blocker: 8,
	bug: 1,
	decision: 6,
	doc_update: 2,
	experiment: 5,
	follow_up: 12,
	question: 7,
	review: 3,
	risk: 9,
	spike: 4,
	task: 0,
};
