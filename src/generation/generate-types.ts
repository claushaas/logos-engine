/** Generate Canonical Docs Types — orchestration contracts for /generate */

import type { GenerationPlanSummaryCounts } from './generation-planner-types.js';
import type {
	MarkdownWriteStatus,
	SafeMarkdownWritePolicy,
} from './markdown-writer-types.js';

// ---------------------------------------------------------------------------
// Re-export write policy as generation write policy
// ---------------------------------------------------------------------------

export type GenerateCanonicalDocsWritePolicy = SafeMarkdownWritePolicy;

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

export type GenerateCanonicalDocsMode = 'preflight' | 'execute' | 'dry_run';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GenerateCanonicalDocsOptions {
	mode: GenerateCanonicalDocsMode;
	projectRoot: string;
	writePolicy?: GenerateCanonicalDocsWritePolicy | undefined;
	targetDocumentIds?: string[] | undefined;
	targetPhaseIds?: string[] | undefined;
	deterministicTimestamp?: string | undefined;
	deterministicIdPrefix?: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface GenerateCanonicalDocsDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	documentId?: string | undefined;
	path?: string | undefined;
	sourcePath?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export interface GenerateCanonicalDocsPreflight {
	mode: 'preflight';
	profileId: string;
	documentationRoot: string;
	documentCounts: GenerationPlanSummaryCounts;
	targetPaths: string[];
	collisionPaths: string[];
	manualEditPaths: string[];
	diagnostics: GenerateCanonicalDocsDiagnostic[];
	needsConfirmation: boolean;
}

// ---------------------------------------------------------------------------
// Dry-Run Result
// ---------------------------------------------------------------------------

export interface GenerateCanonicalDocsDryRunResult {
	mode: 'dry_run';
	profileId: string;
	documentationRoot: string;
	documentCounts: GenerationPlanSummaryCounts;
	targetPaths: string[];
	collisionPaths: string[];
	writePolicy: GenerateCanonicalDocsWritePolicy;
	writePlanSummary: {
		total: number;
		created: number;
		updated: number;
		skipped: number;
		collisions: number;
		failed: number;
	};
	diagnostics: GenerateCanonicalDocsDiagnostic[];
}

// ---------------------------------------------------------------------------
// Report Item
// ---------------------------------------------------------------------------

export interface GenerateCanonicalDocsReportItem {
	documentCanonicalId: string;
	documentId: string;
	phaseId: string;
	action: string;
	rendered: boolean;
	markdownAvailable: boolean;
	writeStatus: MarkdownWriteStatus;
	path: string;
	checksum?: string | undefined;
	diagnostics: GenerateCanonicalDocsDiagnostic[];
	collisionMessage?: string | undefined;
	manualEditStatus?: string | undefined;
	gaps: string[];
}

// ---------------------------------------------------------------------------
// Generation Result (execution)
// ---------------------------------------------------------------------------

export interface GenerateCanonicalDocsResult {
	mode: 'execute';
	profileId: string;
	documentationRoot: string;
	runId: string;
	artifactIds: string[];
	createdPaths: string[];
	updatedPaths: string[];
	skippedPaths: string[];
	incompleteDocumentIds: string[];
	blockedDocumentIds: string[];
	failedDocumentIds: string[];
	staleDocumentIds: string[];
	collisionPaths: string[];
	changedPaths: string[];
	diagnostics: GenerateCanonicalDocsDiagnostic[];
	items: GenerateCanonicalDocsReportItem[];
	writePolicy: GenerateCanonicalDocsWritePolicy;
	writePlanSummary: {
		total: number;
		created: number;
		updated: number;
		skipped: number;
		collisions: number;
		failed: number;
	};
	suggestedNextCommands: string[];
}
