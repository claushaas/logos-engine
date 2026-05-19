/** Step 11.3 — Executive Export Adapter contracts and types */

import type { CanonicalDocumentId } from '../profiles/documentation-contract.js';
import type { ValidationFindingSeverity } from '../validation/validation-finding.js';

// ---------------------------------------------------------------------------
// Adapter kind
// ---------------------------------------------------------------------------

export type ExecutiveExportAdapterKind =
	| 'markdown'
	| 'html'
	| 'github_issue_file'
	| 'agent_pack_file'
	| 'linear_mapping'
	| 'notion_mapping'
	| 'custom';

export const ADAPTER_KIND_ORDER: Record<ExecutiveExportAdapterKind, number> = {
	agent_pack_file: 3,
	custom: 6,
	github_issue_file: 2,
	html: 1,
	linear_mapping: 4,
	markdown: 0,
	notion_mapping: 5,
};

// ---------------------------------------------------------------------------
// Export support status
// ---------------------------------------------------------------------------

export type ExecutiveExportSupportStatus =
	| 'supported_file_export'
	| 'planned_adapter_contract'
	| 'unsupported'
	| 'blocked'
	| 'unknown';

// ---------------------------------------------------------------------------
// Generation status
// ---------------------------------------------------------------------------

export type ExecutiveExportGenerationStatus =
	| 'created'
	| 'updated'
	| 'skipped'
	| 'blocked'
	| 'requires_review'
	| 'failed';

// ---------------------------------------------------------------------------
// Write policy
// ---------------------------------------------------------------------------

export type ExecutiveExportWritePolicy =
	| 'skip_existing'
	| 'fail_on_collision'
	| 'backup_and_write'
	| 'explicit_overwrite';

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export interface ExecutiveExportMapping {
	readonly mappingId: string;
	readonly adapterKind: ExecutiveExportAdapterKind;
	readonly supportStatus: ExecutiveExportSupportStatus;
	readonly name: string;
	readonly version: string;
	readonly exportType: string;
	readonly outputFormat: string;
	readonly purpose: string;
	readonly sourcePath: string;
	readonly outputPath?: string | undefined;
	readonly templatePath?: string | undefined;
	readonly outputs?: ReadonlyArray<ExecutiveExportMappingOutput> | undefined;
	readonly rules?: Record<string, unknown> | undefined;
	readonly labels?: Record<string, unknown> | undefined;
	readonly metadata?: Record<string, unknown> | undefined;
	readonly unsupportedStrategy?: string | undefined;
	readonly maps?: Record<string, string> | undefined;
	readonly fields?: Record<string, string> | undefined;
	readonly targets?: ReadonlyArray<ExecutiveExportMappingTarget> | undefined;
	readonly promptRules?: Record<string, unknown> | undefined;
	readonly pointer?: string | undefined;
}

export interface ExecutiveExportMappingOutput {
	readonly id: string;
	readonly path: string;
	readonly templatePath?: string | undefined;
	readonly includes?: readonly string[] | undefined;
}

export interface ExecutiveExportMappingTarget {
	readonly id: string;
	readonly outputPath: string;
	readonly supportedItemTypes?: readonly string[] | undefined;
}

// ---------------------------------------------------------------------------
// Export target
// ---------------------------------------------------------------------------

export interface ExecutiveExportTarget {
	readonly targetId: string;
	readonly adapterKind: ExecutiveExportAdapterKind;
	readonly supportStatus: ExecutiveExportSupportStatus;
	readonly name: string;
	readonly outputPath?: string | undefined;
	readonly mapping: ExecutiveExportMapping;
	readonly enabled: boolean;
}

// ---------------------------------------------------------------------------
// Export input
// ---------------------------------------------------------------------------

export interface ExecutiveExportInput {
	readonly plan: import('./executive-plan-model.js').ExecutivePlanJson;
	readonly mapping: ExecutiveExportMapping;
	readonly profileId: string;
	readonly profileVersion?: string | undefined;
	readonly documentationRoot: string;
	readonly clock: () => string;
	readonly readinessStatus: string;
	readonly planFingerprint: string;
	readonly planId: string;
}

// ---------------------------------------------------------------------------
// Export options
// ---------------------------------------------------------------------------

export interface ExecutiveExportOptions {
	readonly injectTimestamp?: string | undefined;
	readonly injectTargetId?: string | undefined;
	readonly writePolicy?: ExecutiveExportWritePolicy | undefined;
}

// ---------------------------------------------------------------------------
// Rendered file
// ---------------------------------------------------------------------------

export interface ExecutiveExportRenderedFile {
	readonly relativePath: string;
	readonly content: string;
	readonly checksum: string;
	readonly format: string;
	readonly targetId: string;
}

// ---------------------------------------------------------------------------
// Export result
// ---------------------------------------------------------------------------

export interface ExecutiveExportResult {
	readonly targetId: string;
	readonly adapterKind: ExecutiveExportAdapterKind;
	readonly supportStatus: ExecutiveExportSupportStatus;
	readonly title: string;
	readonly renderedFiles: readonly ExecutiveExportRenderedFile[];
	readonly metadata: ExecutiveExportResultMetadata;
	readonly diagnostics: readonly ExecutiveExportDiagnostic[];
	readonly securitySummary: ExecutiveExportSecuritySummary;
	readonly changedPaths: readonly [];
	readonly readOnly: true;
}

export interface ExecutiveExportResultMetadata {
	readonly sourcePlanId: string;
	readonly sourcePlanFingerprint: string;
	readonly profileId: string;
	readonly profileVersion: string | undefined;
	readonly generatedAt: string;
	readonly sourceCanonicalDocumentIds: readonly CanonicalDocumentId[];
	readonly sourceCanonicalPaths: readonly string[];
	readonly readinessStatus: string;
	readonly schemaValidationStatus: string;
	readonly derivedSnapshot: true;
	readonly nonCanonical: true;
	readonly externalApiExecution: false;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface ExecutiveExportDiagnostic {
	readonly code: string;
	readonly severity: ValidationFindingSeverity;
	readonly message: string;
	readonly sourcePath?: string | undefined;
	readonly pointer?: string | undefined;
	readonly targetId?: string | undefined;
	readonly adapterKind?: ExecutiveExportAdapterKind | undefined;
	readonly outputPath?: string | undefined;
	readonly planId?: string | undefined;
	readonly workItemId?: string | undefined;
	readonly documentCanonicalId?: CanonicalDocumentId | undefined;
	readonly mappingPath?: string | undefined;
	readonly expected?: unknown | undefined;
	readonly received?: unknown | undefined;
	readonly recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Security summary
// ---------------------------------------------------------------------------

export interface ExecutiveExportSecuritySummary {
	readonly passed: boolean;
	readonly checks: readonly ExecutiveExportSecurityCheck[];
}

export interface ExecutiveExportSecurityCheck {
	readonly checkId: string;
	readonly name: string;
	readonly passed: boolean;
	readonly details?: string | undefined;
}

// ---------------------------------------------------------------------------
// Changed path
// ---------------------------------------------------------------------------

export interface ExecutiveExportChangedPath {
	readonly path: string;
	readonly role: 'created' | 'updated' | 'skipped' | 'blocked' | 'failed';
	readonly checksum?: string | undefined;
}

// ---------------------------------------------------------------------------
// Generation input
// ---------------------------------------------------------------------------

export interface ExecutiveExportGenerationInput {
	readonly plan: import('./executive-plan-model.js').ExecutivePlanJson;
	readonly mappings: readonly ExecutiveExportMapping[];
	readonly profileId: string;
	readonly profileVersion?: string | undefined;
	readonly documentationRoot: string;
	readonly artifactRoot?: string | undefined;
	readonly clock: () => string;
	readonly readinessStatus: string;
	readonly planFingerprint: string;
	readonly planId: string;
	readonly selectedAdapterKinds?:
		| readonly ExecutiveExportAdapterKind[]
		| undefined;
}

// ---------------------------------------------------------------------------
// Generation options
// ---------------------------------------------------------------------------

export interface ExecutiveExportGenerationOptions {
	readonly dryRun?: boolean | undefined;
	readonly strictMode?: boolean | undefined;
	readonly writePolicy?: ExecutiveExportWritePolicy | undefined;
	readonly injectRunId?: string | undefined;
	readonly injectArtifactIds?: readonly string[] | undefined;
}

// ---------------------------------------------------------------------------
// Generation item
// ---------------------------------------------------------------------------

export interface ExecutiveExportGenerationItem {
	readonly targetId: string;
	readonly adapterKind: ExecutiveExportAdapterKind;
	readonly supportStatus: ExecutiveExportSupportStatus;
	readonly status: ExecutiveExportGenerationStatus;
	readonly title: string;
	readonly outputPaths: readonly string[];
	readonly checksums: readonly string[];
	readonly artifactIds: readonly string[];
	readonly diagnostics: readonly ExecutiveExportDiagnostic[];
}

// ---------------------------------------------------------------------------
// Generation result
// ---------------------------------------------------------------------------

export interface ExecutiveExportGenerationResult {
	readonly profileId: string;
	readonly documentationRoot: string;
	readonly artifactRoot: string | undefined;
	readonly planId: string;
	readonly dryRun: boolean;
	readonly readOnly: boolean;
	readonly items: readonly ExecutiveExportGenerationItem[];
	readonly summaryCountsByStatus: Record<
		ExecutiveExportGenerationStatus,
		number
	>;
	readonly summaryCountsByAdapterKind: Partial<
		Record<ExecutiveExportAdapterKind, number>
	>;
	readonly createdPaths: readonly string[];
	readonly updatedPaths: readonly string[];
	readonly skippedPaths: readonly string[];
	readonly blockedPaths: readonly string[];
	readonly failedPaths: readonly string[];
	readonly artifactRegistryEntriesCreated: number;
	readonly artifactRegistryEntriesUpdated: number;
	readonly changedPaths: readonly ExecutiveExportChangedPath[];
	readonly diagnostics: readonly ExecutiveExportDiagnostic[];
	readonly securitySummary: ExecutiveExportSecuritySummary;
	readonly report: ExecutiveExportReport;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ExecutiveExportReport {
	readonly selectedTargets: readonly string[];
	readonly supportedFileExports: readonly string[];
	readonly plannedAdapterContracts: readonly string[];
	readonly unsupportedTargets: readonly string[];
	readonly createdCount: number;
	readonly updatedCount: number;
	readonly skippedCount: number;
	readonly blockedCount: number;
	readonly requiresReviewCount: number;
	readonly failedCount: number;
	readonly outputPaths: readonly string[];
	readonly planId: string;
	readonly planFingerprint: string;
	readonly externalApiExecution: false;
	readonly derivedSnapshot: true;
	readonly nonCanonical: true;
	readonly securitySummary: ExecutiveExportSecuritySummary;
	readonly noExternalRecordsCreated: true;
	readonly plannedMappingsNote: string;
}

// ---------------------------------------------------------------------------
// Artifact record
// ---------------------------------------------------------------------------

export interface ExecutiveExportArtifactRecord {
	readonly artifactId: string;
	readonly artifactType:
		| 'executive_markdown'
		| 'executive_html'
		| 'data'
		| 'agent_pack';
	readonly path: string;
	readonly adapterKind: ExecutiveExportAdapterKind;
	readonly sourcePlanId: string;
	readonly sourcePlanFingerprint: string;
	readonly sourceWorkItemId?: string | undefined;
	readonly sourceCanonicalDocumentIds: readonly CanonicalDocumentId[];
	readonly sourceCanonicalPaths: readonly string[];
	readonly profileId: string;
	readonly profileVersion: string | undefined;
	readonly generatedAt: string;
	readonly checksum: string;
	readonly runId?: string | undefined;
	readonly isCanonical: false;
	readonly derivedSnapshot: true;
	readonly externalApiExecution: false;
	readonly status: 'generated';
	readonly traceabilitySummary: string;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface ExecutiveExportAdapter {
	readonly kind: ExecutiveExportAdapterKind;
	readonly supportStatus: ExecutiveExportSupportStatus;
	render(
		input: ExecutiveExportInput,
		options?: ExecutiveExportOptions,
	): ExecutiveExportResult;
}

// ---------------------------------------------------------------------------
// Deterministic ordering helpers
// ---------------------------------------------------------------------------

export function sortExportTargets(
	targets: readonly ExecutiveExportTarget[],
): readonly ExecutiveExportTarget[] {
	return [...targets].sort((a, b) => {
		const kindOrderA = ADAPTER_KIND_ORDER[a.adapterKind] ?? 99;
		const kindOrderB = ADAPTER_KIND_ORDER[b.adapterKind] ?? 99;
		if (kindOrderA !== kindOrderB) return kindOrderA - kindOrderB;
		return a.targetId.localeCompare(b.targetId);
	});
}

export function isSupportedFileExport(
	status: ExecutiveExportSupportStatus,
): boolean {
	return status === 'supported_file_export';
}

export function isPlannedAdapterContract(
	status: ExecutiveExportSupportStatus,
): boolean {
	return status === 'planned_adapter_contract';
}
