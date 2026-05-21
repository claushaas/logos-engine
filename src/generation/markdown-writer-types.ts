/** Safe Markdown Writer Types — write contracts, policies, manual edit detection */

import type { GenerationPlanItem } from './generation-planner-types.js';
import type { CanonicalMarkdownRenderResult } from './markdown-renderer-types.js';

// ---------------------------------------------------------------------------
// Write policy
// ---------------------------------------------------------------------------

export type SafeMarkdownWritePolicy =
	| 'skip'
	| 'fail'
	| 'backup_and_write'
	| 'overwrite';

// ---------------------------------------------------------------------------
// Write status
// ---------------------------------------------------------------------------

export type MarkdownWriteStatus =
	| 'created'
	| 'updated'
	| 'skipped'
	| 'collision'
	| 'failed'
	| 'dry_run';

// ---------------------------------------------------------------------------
// Manual edit status
// ---------------------------------------------------------------------------

export type ManualEditStatus =
	| 'new_file'
	| 'unchanged_generated'
	| 'modified_since_generation'
	| 'metadata_missing'
	| 'metadata_invalid'
	| 'registry_mismatch'
	| 'unknown';

// ---------------------------------------------------------------------------
// Metadata types
// ---------------------------------------------------------------------------

export interface MarkdownFileMetadata {
	documentId: string;
	phaseId: string;
	profileId: string;
	canonicalOutput: string;
	generatedBy: string;
	generatedAt: string;
	generationStatus: string;
	sourceStateSchemaVersion: string;
	traceability: MarkdownFileTraceabilityRef[];
	nonCanonicalArtifacts?: string[];
}

export interface MarkdownFileTraceabilityRef {
	workspaceRecordId: string;
	recordType: string;
	sourceProposalId?: string | undefined;
	sourceAnswerId?: string | undefined;
	sourceSessionId?: string | undefined;
	sourceQuestionId?: string | undefined;
	sourceDocumentId?: string | undefined;
	sourcePhaseId?: string | undefined;
}

export interface GeneratedMarkdownMetadata {
	metadata: MarkdownFileMetadata;
	checksum: string;
	parsedSuccessfully: boolean;
	parseErrors: string[];
	frontmatterRaw: string;
	contentAfterFrontmatter: string;
}

export interface MarkdownChecksum {
	algorithm: string;
	hash: string;
	includesFrontmatter: boolean;
}

// ---------------------------------------------------------------------------
// Manual edit detection
// ---------------------------------------------------------------------------

export interface ManualEditDetectionInput {
	targetPath: string;
	renderResult: CanonicalMarkdownRenderResult;
	artifactRecord?:
		| {
				checksum?: string;
				generatedAt?: string;
				status?: string;
		  }
		| undefined;
	fs?: ManualEditFsAdapter | undefined;
	resolvedBaseDir?: string | undefined;
}

export interface ManualEditDetectionResult {
	status: ManualEditStatus;
	diagnostics: ManualEditDiagnostic[];
	parsedMetadata?: GeneratedMarkdownMetadata | undefined;
	currentChecksum?: string | undefined;
	previousChecksum?: string | undefined;
	targetPath: string;
	targetExists: boolean;
}

export interface ManualEditDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Filesystem adapter for markdown reads (test injection)
// ---------------------------------------------------------------------------

export interface ManualEditFsAdapter {
	readFile(path: string, encoding: 'utf-8'): Promise<string>;
	stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
}

// ---------------------------------------------------------------------------
// Write collision
// ---------------------------------------------------------------------------

export interface MarkdownWriteCollision {
	targetPath: string;
	documentCanonicalId: string;
	manualEditStatus: ManualEditStatus;
	selectedPolicy: SafeMarkdownWritePolicy;
	recoveryHint: string;
	suggestedActions: SafeMarkdownWritePolicy[];
}

// ---------------------------------------------------------------------------
// Write diagnostic
// ---------------------------------------------------------------------------

export interface MarkdownWriteDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	targetPath?: string | undefined;
	documentCanonicalId?: string | undefined;
	manualEditStatus?: ManualEditStatus | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Changed path (extends safe-filesystem conventions)
// ---------------------------------------------------------------------------

export type MarkdownWriteChangedPathRole =
	| 'directory_created'
	| 'file_created'
	| 'file_updated'
	| 'backup_created'
	| 'skipped'
	| 'planned';

export interface MarkdownWriteChangedPath {
	path: string;
	role: MarkdownWriteChangedPathRole;
}

// ---------------------------------------------------------------------------
// Write plan
// ---------------------------------------------------------------------------

export interface MarkdownWritePlanItem {
	documentCanonicalId: string;
	targetPath: string;
	status: MarkdownWriteStatus;
	checksum?: string | undefined;
	manualEditStatus?: ManualEditStatus | undefined;
	backupPath?: string | undefined;
	diagnostics: MarkdownWriteDiagnostic[];
	collision?: MarkdownWriteCollision | undefined;
	renderResult: CanonicalMarkdownRenderResult;
	planItem?: GenerationPlanItem | undefined;
}

export interface MarkdownWritePlan {
	items: MarkdownWritePlanItem[];
	documentationRoot: string;
	policy: SafeMarkdownWritePolicy;
	dryRun: boolean;
	plannedDirectories: string[];
	changedPaths: MarkdownWriteChangedPath[];
	diagnostics: MarkdownWriteDiagnostic[];
	summary: MarkdownWritePlanSummary;
}

export interface MarkdownWritePlanSummary {
	total: number;
	created: number;
	updated: number;
	skipped: number;
	collisions: number;
	failed: number;
	dryRun: number;
}

// ---------------------------------------------------------------------------
// Write input / options / result
// ---------------------------------------------------------------------------

export interface SafeMarkdownWriteInput {
	renderResults: CanonicalMarkdownRenderResult[];
	planItems?: GenerationPlanItem[] | undefined;
}

export interface SafeMarkdownWriteOptions {
	policy?: SafeMarkdownWritePolicy | undefined;
	dryRun?: boolean | undefined;
	documentationRoot?: string | undefined;
	projectRoot?: string | undefined;
	backupDir?: string | undefined;
	deterministicTimestamp?: string | undefined;
	deterministicRandomId?: string | undefined;
	fsOverride?: ManualEditFsAdapter | undefined;
	artifactRecords?:
		| Map<string, { checksum?: string; generatedAt?: string; status?: string }>
		| undefined;
}

export interface SafeMarkdownWriteResult {
	success: boolean;
	status: MarkdownWriteStatus;
	changedPaths: MarkdownWriteChangedPath[];
	diagnostics: MarkdownWriteDiagnostic[];
	dryRun: boolean;
	items: MarkdownWritePlanItem[];
	documentationRoot: string;
	policy: SafeMarkdownWritePolicy;
	summary: MarkdownWritePlanSummary;
}
