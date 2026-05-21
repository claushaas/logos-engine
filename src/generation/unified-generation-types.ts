/**
 * Unified Generation Types — Phase 7: Derived Artifact Generation And Browsing
 *
 * Extends canonical Markdown generation with derived HTML artifacts and
 * Agent Packs. Defines the unified plan, report, diagnostic, and mode
 * contracts used by the orchestrator and the /generate TUI command.
 *
 * All types are pure data: no side effects, no provider calls, no filesystem.
 */

import type {
	GenerateCanonicalDocsOptions,
	GenerateCanonicalDocsReportItem,
	GenerateCanonicalDocsWritePolicy,
} from './generate-types.js';

// ---------------------------------------------------------------------------
// Unified mode
// ---------------------------------------------------------------------------

export type UnifiedGenerationMode =
	| GenerateCanonicalDocsOptions['mode'] // 'preflight' | 'execute' | 'dry_run'
	| 'preflight'
	| 'execute'
	| 'dry_run';

// ---------------------------------------------------------------------------
// Scope flags for controlled generation
// ---------------------------------------------------------------------------

export interface UnifiedGenerationScope {
	/** Generate canonical Markdown (default: true) */
	canonical?: boolean | undefined;
	/** Generate derived HTML artifacts (default: true) */
	html?: boolean | undefined;
	/** Generate derived Agent Packs (default: true) */
	agentPack?: boolean | undefined;
	/** Generate only canonical, skip all derived (convenience flag) */
	canonicalOnly?: boolean | undefined;
	/** Generate only derived, skip canonical (requires current canonical sources) */
	derivedOnly?: boolean | undefined;
	/** Skip all derived, same as canonicalOnly */
	skipDerived?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Unified options (extends existing GenerateCanonicalDocsOptions)
// ---------------------------------------------------------------------------

export interface UnifiedGenerationOptions extends GenerateCanonicalDocsOptions {
	scope?: UnifiedGenerationScope | undefined;
}

// ---------------------------------------------------------------------------
// Artifact canonicality labels
// ---------------------------------------------------------------------------

export type ArtifactCanonicality = 'canonical' | 'derived';

// ---------------------------------------------------------------------------
// Unified diagnostic codes (stable, safe for snapshots)
// ---------------------------------------------------------------------------

export const UNIFIED_GENERATION_DIAGNOSTIC_CODES = {
	/** Agent Pack render step failed */
	AGENT_PACK_RENDER_FAILED: 'LOGOS_AGENT_PACK_RENDER_FAILED',

	/** Agent Pack contains unsafe content */
	AGENT_PACK_UNSAFE_CONTENT: 'LOGOS_AGENT_PACK_UNSAFE_CONTENT',

	/** Derived artifact boundary violation (e.g. derived used as canonical source) */
	ARTIFACT_DERIVED_BOUNDARY_VIOLATION:
		'LOGOS_ARTIFACT_DERIVED_BOUNDARY_VIOLATION',

	/** Artifact registry update failed after successful write */
	ARTIFACT_REGISTRY_UPDATE_FAILED: 'LOGOS_ARTIFACT_REGISTRY_UPDATE_FAILED',
	/** Derived artifact planning completed normally */
	DERIVED_PLAN_READY: 'LOGOS_DERIVED_PLAN_READY',

	/** A required canonical source is invalid or blocked */
	DERIVED_SOURCE_INVALID: 'LOGOS_DERIVED_SOURCE_INVALID',

	/** Manual edit conflict on canonical source blocks derived generation */
	DERIVED_SOURCE_MANUAL_EDIT_CONFLICT:
		'LOGOS_DERIVED_SOURCE_MANUAL_EDIT_CONFLICT',

	/** A required canonical source is missing */
	DERIVED_SOURCE_MISSING: 'LOGOS_DERIVED_SOURCE_MISSING',

	/** A required canonical source is stale */
	DERIVED_SOURCE_STALE: 'LOGOS_DERIVED_SOURCE_STALE',

	/** Generation completed with partial derived failures */
	GENERATION_PARTIAL_DERIVED_FAILURE:
		'LOGOS_GENERATION_PARTIAL_DERIVED_FAILURE',

	/** HTML artifact render step failed */
	HTML_ARTIFACT_RENDER_FAILED: 'LOGOS_HTML_ARTIFACT_RENDER_FAILED',

	/** HTML artifact contains unsafe content */
	HTML_ARTIFACT_UNSAFE_CONTENT: 'LOGOS_HTML_ARTIFACT_UNSAFE_CONTENT',

	/** Output browser has no artifacts */
	OUTPUT_BROWSER_EMPTY: 'LOGOS_OUTPUT_BROWSER_EMPTY',

	/** Invalid filter in output browser */
	OUTPUT_FILTER_INVALID: 'LOGOS_OUTPUT_FILTER_INVALID',

	/** Output not found in registry */
	OUTPUT_NOT_FOUND: 'LOGOS_OUTPUT_NOT_FOUND',

	/** Source for output unknown or unresolvable */
	OUTPUT_SOURCE_UNKNOWN: 'LOGOS_OUTPUT_SOURCE_UNKNOWN',
} as const;

export type UnifiedGenerationDiagnosticCode =
	(typeof UNIFIED_GENERATION_DIAGNOSTIC_CODES)[keyof typeof UNIFIED_GENERATION_DIAGNOSTIC_CODES];

// ---------------------------------------------------------------------------
// Unified diagnostic
// ---------------------------------------------------------------------------

export interface UnifiedDiagnostic {
	/** Stable diagnostic code */
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	documentId?: string | undefined;
	artifactId?: string | undefined;
	path?: string | undefined;
	sourcePath?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Derived plan item (extends GenerationPlanItem concepts)
// ---------------------------------------------------------------------------

export type DerivedArtifactType = 'html_artifact' | 'agent_pack';

export interface DerivedPlanItem {
	/** Unique plan item identifier */
	id: string;

	/** Artifact type */
	artifactType: DerivedArtifactType;

	/** Always 'derived' for these items */
	canonicality: ArtifactCanonicality;

	/** Source canonical document IDs */
	sourceDocumentIds: string[];

	/** Source artifact IDs from the registry */
	sourceArtifactIds: string[];

	/** Expected output path under the documentation root */
	outputPath: string;

	/** Artifact kind from the HTML/Agent Pack declaration */
	artifactKind: string;

	/** Readiness status for this plan item */
	status:
		| 'ready'
		| 'skipped'
		| 'blocked'
		| 'stale'
		| 'missing_source'
		| 'incomplete'
		| 'unknown';

	/** Why this item has its status */
	reason?: string | undefined;

	/** Phase ID if applicable */
	phaseId?: string | undefined;

	/** Profile path from declaration */
	profilePath?: string | undefined;

	/** Order index for deterministic rendering */
	orderIndex: number;

	/** Diagnostics associated with this plan item */
	diagnostics: UnifiedDiagnostic[];
}

// ---------------------------------------------------------------------------
// Derived generation section results
// ---------------------------------------------------------------------------

export interface DerivedArtifactResult {
	/** Artifact ID in registry */
	artifactId?: string | undefined;

	/** Plan item ID */
	planItemId: string;

	/** Artifact type */
	artifactType: DerivedArtifactType;

	/** Canonicality */
	canonicality: ArtifactCanonicality;

	/** Write status */
	writeStatus: 'created' | 'updated' | 'skipped' | 'blocked' | 'failed';

	/** Output path */
	outputPath: string;

	/** Checksum of rendered content */
	checksum?: string | undefined;

	/** Diagnostics */
	diagnostics: UnifiedDiagnostic[];

	/** Source document IDs */
	sourceDocumentIds: string[];

	/** Generated timestamp */
	generatedAt?: string | undefined;
}

// ---------------------------------------------------------------------------
// Unified generation report
// ---------------------------------------------------------------------------

export type UnifiedGenerationOverallStatus =
	| 'ok'
	| 'ok_with_warnings'
	| 'partial'
	| 'blocked'
	| 'failed'
	| 'dry_run';

export interface UnifiedGenerationReportCounts {
	created: number;
	updated: number;
	skipped: number;
	incomplete: number;
	blocked: number;
	failed: number;
	stale: number;
	current: number;
}

export interface UnifiedGenerationReportCountsByType {
	canonicalMarkdown: UnifiedGenerationReportCounts;
	htmlArtifacts: UnifiedGenerationReportCounts;
	agentPacks: UnifiedGenerationReportCounts;
}

export interface UnifiedGenerationReport {
	/** Overall outcome */
	overallStatus: UnifiedGenerationOverallStatus;

	/** Active profile ID */
	profileId: string;

	/** Documentation root */
	documentationRoot: string;

	/** Mode (preflight, execute, dry_run) */
	mode: UnifiedGenerationMode;

	/** Canonical Markdown section */
	canonical: {
		createdPaths: string[];
		updatedPaths: string[];
		skippedPaths: string[];
		blockedDocumentIds: string[];
		failedDocumentIds: string[];
		staleDocumentIds: string[];
		incompleteDocumentIds: string[];
		collisionPaths: string[];
		items: GenerateCanonicalDocsReportItem[];
		counts: UnifiedGenerationReportCounts;
	};

	/** HTML artifact section */
	htmlArtifacts: {
		items: DerivedArtifactResult[];
		planItemCount: number;
		readyCount: number;
		blockedCount: number;
		staleCount: number;
		skippedCount: number;
		failedCount: number;
		createdCount: number;
		updatedCount: number;
		counts: UnifiedGenerationReportCounts;
	};

	/** Agent Pack section */
	agentPacks: {
		items: DerivedArtifactResult[];
		planItemCount: number;
		readyCount: number;
		blockedCount: number;
		staleCount: number;
		skippedCount: number;
		failedCount: number;
		createdCount: number;
		updatedCount: number;
		counts: UnifiedGenerationReportCounts;
	};

	/** Overall counts by type */
	countsByType: UnifiedGenerationReportCountsByType;

	/** All changed paths (canonical + derived) */
	changedPaths: string[];

	/** All diagnostics */
	diagnostics: UnifiedDiagnostic[];

	/** Suggested next commands */
	suggestedNextCommands: string[];

	/** Run IDs (canonical run) */
	runId?: string | undefined;

	/** Whether this was a dry-run */
	dryRun: boolean;

	/** Write policy used */
	writePolicy: GenerateCanonicalDocsWritePolicy;

	/** Registry update summary */
	registryUpdates: {
		created: string[];
		updated: string[];
		failed: string[];
	};

	/** Stale/orphaned outputs detected */
	staleOrphaned: {
		count: number;
		paths: string[];
	};

	/** Next actions */
	nextActions: string[];

	/** Whether confirmation was required/used */
	confirmationMarker?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Unified preflight result
// ---------------------------------------------------------------------------

export interface UnifiedGenerationPreflight {
	mode: 'preflight';
	profileId: string;
	documentationRoot: string;
	canonicalReady: boolean;
	canonicalDocumentCounts: {
		generate: number;
		update: number;
		skip: number;
		incomplete: number;
		blocked: number;
		failed: number;
		stale: number;
	};
	htmlArtifactCount: number;
	agentPackCount: number;
	derivedBlockedCount: number;
	derivedReadyCount: number;
	collisionPaths: string[];
	manualEditPaths: string[];
	targetPaths: string[];
	diagnostics: UnifiedDiagnostic[];
	needsConfirmation: boolean;
}

// ---------------------------------------------------------------------------
// Unified dry-run result
// ---------------------------------------------------------------------------

export interface UnifiedGenerationDryRunResult {
	mode: 'dry_run';
	profileId: string;
	documentationRoot: string;
	canonicalReady: boolean;
	canonicalDocumentCounts: {
		generate: number;
		update: number;
		skip: number;
		incomplete: number;
		blocked: number;
		failed: number;
		stale: number;
	};
	htmlArtifactCount: number;
	agentPackCount: number;
	derivedBlockedCount: number;
	derivedReadyCount: number;
	collisionPaths: string[];
	targetPaths: string[];
	diagnostics: UnifiedDiagnostic[];
	writePolicy: GenerateCanonicalDocsWritePolicy;
}

// ---------------------------------------------------------------------------
// Zero-counts helper
// ---------------------------------------------------------------------------

export function zeroUnifiedCounts(): UnifiedGenerationReportCounts {
	return {
		blocked: 0,
		created: 0,
		current: 0,
		failed: 0,
		incomplete: 0,
		skipped: 0,
		stale: 0,
		updated: 0,
	};
}

// ---------------------------------------------------------------------------
// Unified diagnostic factory
// ---------------------------------------------------------------------------

export function createUnifiedDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<UnifiedDiagnostic>,
): UnifiedDiagnostic {
	return {
		artifactId: undefined,
		code,
		documentId: undefined,
		message,
		path: undefined,
		recoveryHint: undefined,
		severity,
		sourcePath: undefined,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Helpers to convert agent pack / HTML status to report status
// ---------------------------------------------------------------------------

export function derivedPlanStatusToWriteStatus(
	status: DerivedPlanItem['status'],
	didWrite: boolean,
): 'created' | 'updated' | 'skipped' | 'blocked' | 'failed' {
	if (!didWrite) {
		switch (status) {
			case 'blocked':
				return 'blocked';
			case 'missing_source':
				return 'blocked';
			default:
				return 'skipped';
		}
	}
	return 'created';
}
