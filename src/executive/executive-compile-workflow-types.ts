/** Step 11.4 — Executive Compile Workflow types */

import type {
	ExecutiveExportAdapterKind,
	ExecutiveExportSecuritySummary,
	ExecutiveExportWritePolicy,
} from './executive-export-model.js';
import type { NormativeBaselineReadinessStatus } from './executive-readiness-types.js';

// ---------------------------------------------------------------------------
// Compile workflow mode
// ---------------------------------------------------------------------------

export type ExecutiveCompileMode = 'strict' | 'diagnostic_preview';

// ---------------------------------------------------------------------------
// Compile workflow status (overall)
// ---------------------------------------------------------------------------

export type ExecutiveCompileStatus =
	| 'compiled'
	| 'compiled_with_warnings'
	| 'blocked'
	| 'failed'
	| 'dry_run'
	| 'unknown';

// ---------------------------------------------------------------------------
// Compile target
// ---------------------------------------------------------------------------

export type ExecutiveCompileTargetKind =
	| 'executive_plan_json'
	| 'markdown_export'
	| 'html_export'
	| 'github_issue_file_export'
	| 'agent_pack_file_export'
	| 'linear_mapping'
	| 'notion_mapping';

export type ExecutiveCompileTargetStatus =
	| 'planned'
	| 'created'
	| 'updated'
	| 'skipped'
	| 'blocked'
	| 'unsupported'
	| 'planned_adapter_contract'
	| 'failed';

// ---------------------------------------------------------------------------
// Target kind → adapter kind mapping
// ---------------------------------------------------------------------------

export const COMPILE_TARGET_TO_ADAPTER: Record<
	ExecutiveCompileTargetKind,
	ExecutiveExportAdapterKind | undefined
> = {
	agent_pack_file_export: 'agent_pack_file',
	executive_plan_json: undefined,
	github_issue_file_export: 'github_issue_file',
	html_export: 'html',
	linear_mapping: 'linear_mapping',
	markdown_export: 'markdown',
	notion_mapping: 'notion_mapping',
};

// ---------------------------------------------------------------------------
// Compile target description
// ---------------------------------------------------------------------------

export interface ExecutiveCompileTarget {
	readonly targetKind: ExecutiveCompileTargetKind;
	readonly status: ExecutiveCompileTargetStatus;
	readonly adapterKind?: ExecutiveExportAdapterKind | undefined;
	readonly name: string;
	readonly outputPath?: string | undefined;
	readonly outputPaths?: readonly string[] | undefined;
	readonly checksums?: readonly string[] | undefined;
	readonly artifactIds?: readonly string[] | undefined;
	readonly diagnostics: readonly ExecutiveCompileDiagnostic[];
}

// ---------------------------------------------------------------------------
// Compile diagnostic
// ---------------------------------------------------------------------------

export interface ExecutiveCompileDiagnostic {
	readonly code: string;
	readonly severity: 'error' | 'warning' | 'info';
	readonly message: string;
	readonly sourcePath?: string | undefined;
	readonly pointer?: string | undefined;
	readonly fieldPath?: string | undefined;
	readonly targetKind?: ExecutiveCompileTargetKind | undefined;
	readonly adapterKind?: ExecutiveExportAdapterKind | undefined;
	readonly outputPath?: string | undefined;
	readonly readinessBlockerMessage?: string | undefined;
	readonly recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Compile workflow input
// ---------------------------------------------------------------------------

export interface ExecutiveCompileInput {
	readonly projectRoot: string;
	readonly mode?: ExecutiveCompileMode;
	readonly dryRun?: boolean;
	readonly selectedTargets?: readonly ExecutiveCompileTargetKind[] | undefined;
	readonly writePolicy?: ExecutiveExportWritePolicy;
	readonly deterministicTimestamp?: string | undefined;
	readonly deterministicIdPrefix?: string | undefined;
}

// ---------------------------------------------------------------------------
// Compile workflow options (internal)
// ---------------------------------------------------------------------------

export interface ExecutiveCompileOptions {
	readonly mode: ExecutiveCompileMode;
	readonly dryRun: boolean;
	readonly selectedTargets: readonly ExecutiveCompileTargetKind[];
	readonly writePolicy: ExecutiveExportWritePolicy;
}

// ---------------------------------------------------------------------------
// Compile plan (preflight)
// ---------------------------------------------------------------------------

export interface ExecutiveCompilePlan {
	readonly readinessStatus: NormativeBaselineReadinessStatus;
	readonly compilationGateStatus: string;
	readonly canCompile: boolean;
	readonly canDiagnosticPreview: boolean;
	readonly planId: string;
	readonly planFingerprint: string;
	readonly targets: readonly ExecutiveCompileTarget[];
	readonly outputPaths: readonly string[];
	readonly blockerCount: number;
	readonly warningCount: number;
	readonly plannedAdapterContracts: readonly string[];
	readonly unsupportedTargets: readonly string[];
	readonly diagnostics: readonly ExecutiveCompileDiagnostic[];
}

// ---------------------------------------------------------------------------
// Compile preflight
// ---------------------------------------------------------------------------

export interface ExecutiveCompilePreflight {
	readonly mode: ExecutiveCompileMode;
	readonly dryRun: boolean;
	readonly plan: ExecutiveCompilePlan;
	readonly readinessReport: string;
	readonly blockersShown: readonly string[];
	readonly warningsShown: readonly string[];
	readonly nextActions: readonly string[];
}

// ---------------------------------------------------------------------------
// Compile action
// ---------------------------------------------------------------------------

export interface ExecutiveCompileAction {
	readonly target: ExecutiveCompileTarget;
	readonly willWrite: boolean;
	readonly outputPath?: string | undefined;
	readonly writePolicy: string;
}

// ---------------------------------------------------------------------------
// Compile changed path
// ---------------------------------------------------------------------------

export interface ExecutiveCompileChangedPath {
	readonly path: string;
	readonly role: 'created' | 'updated' | 'skipped' | 'blocked' | 'failed';
	readonly checksum?: string | undefined;
	readonly targetKind?: ExecutiveCompileTargetKind | undefined;
}

// ---------------------------------------------------------------------------
// Compile run metadata
// ---------------------------------------------------------------------------

export interface ExecutiveCompileRunMetadata {
	readonly runId: string;
	readonly runKind: 'executive_compile';
	readonly startedAt: string;
	readonly completedAt: string;
	readonly compileMode: ExecutiveCompileMode;
	readonly readinessStatus: NormativeBaselineReadinessStatus;
	readonly compileStatus: ExecutiveCompileStatus;
	readonly selectedTargets: readonly ExecutiveCompileTargetKind[];
	readonly outputPaths: readonly string[];
	readonly changedPaths: readonly string[];
	readonly blockerCount: number;
	readonly warningCount: number;
	readonly artifactIdsCreated: readonly string[];
	readonly artifactIdsUpdated: readonly string[];
	readonly externalApiExecution: false;
}

// ---------------------------------------------------------------------------
// Compile report
// ---------------------------------------------------------------------------

export interface ExecutiveCompileReport {
	readonly summary: string;
	readonly readinessStatus: NormativeBaselineReadinessStatus;
	readonly compileStatus: ExecutiveCompileStatus;
	readonly selectedTargets: readonly string[];
	readonly targetResults: readonly {
		targetKind: ExecutiveCompileTargetKind;
		name: string;
		status: ExecutiveCompileTargetStatus;
		outputPaths: readonly string[];
		diagnostics: readonly ExecutiveCompileDiagnostic[];
	}[];

	readonly createdCount: number;
	readonly updatedCount: number;
	readonly skippedCount: number;
	readonly blockedCount: number;
	readonly failedCount: number;
	readonly unsupportedCount: number;

	readonly outputPaths: readonly string[];
	readonly changedPaths: readonly ExecutiveCompileChangedPath[];
	readonly artifactRegistryUpdates: number;

	readonly plannedAdapterContracts: readonly string[];
	readonly unsupportedTargets: readonly string[];

	readonly blockers: readonly string[];
	readonly warnings: readonly string[];
	readonly nextActions: readonly string[];
	readonly securitySummary: ExecutiveExportSecuritySummary;

	readonly noExternalApiCalls: true;
	readonly noExternalRecordsCreated: true;
	readonly outputsDerivedNonCanonical: true;
}

// ---------------------------------------------------------------------------
// Compile result
// ---------------------------------------------------------------------------

export interface ExecutiveCompileResult {
	readonly status: ExecutiveCompileStatus;
	readonly mode: ExecutiveCompileMode;
	readonly dryRun: boolean;
	readonly profileId: string;
	readonly documentationRoot: string;
	readonly report: ExecutiveCompileReport;
	readonly diagnostics: readonly ExecutiveCompileDiagnostic[];
	readonly runId?: string | undefined;

	// For TUI display
	readonly readyForDisplay: string[];
}
