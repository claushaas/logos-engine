/** Generation Planner Types — read-only generation planning contracts */

import type { ContractGraph } from '../profiles/contract-graph.js';
import type {
	CanonicalDocumentId,
	DocumentationContract,
} from '../profiles/documentation-contract.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Actions & Statuses
// ---------------------------------------------------------------------------

export type GenerationAction =
	| 'generate'
	| 'update'
	| 'skip'
	| 'incomplete'
	| 'blocked'
	| 'failed'
	| 'stale';

// ---------------------------------------------------------------------------
// Blocker, Gap, Staleness
// ---------------------------------------------------------------------------

export interface GenerationBlocker {
	code: string;
	message: string;
	sourceDocumentId?: string;
	sourcePath?: string;
	fieldPath?: string;
	recoveryHint?: string;
}

export interface GenerationGap {
	code: string;
	message: string;
	sectionId?: string;
	inputId?: string;
	sourceDocumentId?: string;
	recoveryHint?: string;
}

export interface GenerationStalenessReason {
	code: string;
	message: string;
	upstreamDocumentId?: string;
	upstreamTimestamp?: string;
	artifactTimestamp?: string;
}

// ---------------------------------------------------------------------------
// Dependency State
// ---------------------------------------------------------------------------

export type DependencySatisfaction =
	| 'satisfied'
	| 'missing'
	| 'blocked'
	| 'incomplete'
	| 'stale'
	| 'failed'
	| 'unknown';

export interface GenerationDependencyState {
	dependencyRawId: string;
	dependencyCanonicalId: CanonicalDocumentId | undefined;
	satisfied: boolean;
	status: DependencySatisfaction;
	reason?: string;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface GenerationReadiness {
	ready: boolean;
	dependencyReady: boolean;
	inputsReady: boolean;
	sectionsReady: boolean;
	blockers: GenerationBlocker[];
	gaps: GenerationGap[];
}

// ---------------------------------------------------------------------------
// Plan Item
// ---------------------------------------------------------------------------

export interface GenerationPlanItem {
	documentCanonicalId: CanonicalDocumentId;
	documentId: string;
	phaseId: string;
	descriptorSourcePath: string;
	canonicalOutputPath: string;
	documentationRootRelativePath: string;
	action: GenerationAction;
	readiness: GenerationReadiness;
	blockers: GenerationBlocker[];
	gaps: GenerationGap[];
	dependencyState: GenerationDependencyState[];
	requiredInputIds: string[];
	requiredSectionIds: string[];
	confirmedDecisionIds: string[];
	confirmedAssumptionIds: string[];
	unresolvedQuestionIds: string[];
	relatedRiskIds: string[];
	staleReasons: GenerationStalenessReason[];
	dryRun: boolean;
	orderIndex: number;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface GenerationPlanSummaryCounts {
	generate: number;
	update: number;
	skip: number;
	incomplete: number;
	blocked: number;
	failed: number;
	stale: number;
}

export interface GenerationPlan {
	profileId: string;
	documentationRoot: string;
	totalDocumentCount: number;
	actionCounts: GenerationPlanSummaryCounts;
	items: GenerationPlanItem[];
	blockersSummary: GenerationBlocker[];
	gapsSummary: GenerationGap[];
	staleSummary: GenerationStalenessReason[];
	dryRun: boolean;
	diagnostics: GenerationPlanDiagnostic[];
	generatedAt: string;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface GenerationPlanDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourceDocumentId?: string;
	sourcePath?: string;
	fieldPath?: string;
	recoveryHint?: string;
}

// ---------------------------------------------------------------------------
// Input & Options
// ---------------------------------------------------------------------------

export interface GenerationPlanInput {
	contract: DocumentationContract;
	graph: ContractGraph;
	state: WorkspaceState;
}

export interface GenerationPlanOptions {
	dryRun?: boolean;
	documentationRootOverride?: string;
	generatedAt?: string;
}

export interface GenerationPlanResult {
	plan: GenerationPlan;
	diagnostics: GenerationPlanDiagnostic[];
}

// ---------------------------------------------------------------------------
// Dry-Run Summary
// ---------------------------------------------------------------------------

export interface GenerationDryRunSummary {
	plannedActions: GenerationPlanSummaryCounts;
	plannedTargetPaths: string[];
	blockers: GenerationBlocker[];
	gaps: GenerationGap[];
	warnings: string[];
	totalDocuments: number;
}

// ---------------------------------------------------------------------------
// Output Target
// ---------------------------------------------------------------------------

export interface GenerationOutputTarget {
	documentCanonicalId: CanonicalDocumentId;
	canonicalOutputPath: string;
	documentationRootRelativePath: string;
}
