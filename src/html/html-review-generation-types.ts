/** Step 9.3 — HTML Review Generation Types, contracts, and interfaces */

import type { SafeWritePolicy } from '../fs/safe-filesystem.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { HtmlArtifactKind } from './html-artifact-types.js';
import type { HtmlRenderDiagnostic } from './html-render-types.js';

// ---------------------------------------------------------------------------
// Generation Statuses
// ---------------------------------------------------------------------------

export type HtmlReviewGenerationStatus =
	| 'created'
	| 'updated'
	| 'skipped'
	| 'blocked'
	| 'stale'
	| 'requires_review'
	| 'failed';

export const HTML_REVIEW_GENERATION_STATUS_ORDER: Record<
	HtmlReviewGenerationStatus,
	number
> = {
	blocked: 3,
	created: 0,
	failed: 6,
	requires_review: 5,
	skipped: 4,
	stale: 2,
	updated: 1,
};

// ---------------------------------------------------------------------------
// Review View Kind (alias for HtmlArtifactKind in review context)
// ---------------------------------------------------------------------------

export type HtmlReviewViewKind = HtmlArtifactKind;

// ---------------------------------------------------------------------------
// Review Write Policy
// ---------------------------------------------------------------------------

export type HtmlReviewWritePolicy = SafeWritePolicy;

// ---------------------------------------------------------------------------
// Changed Path
// ---------------------------------------------------------------------------

export interface HtmlReviewChangedPath {
	path: string;
	relativePath: string;
	role: 'created' | 'updated' | 'backup_created' | 'skipped' | 'planned';
}

// ---------------------------------------------------------------------------
// Review Generation Diagnostic
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath?: string | undefined;
	fieldPath?: string | undefined;
	relatedArtifactId?: string | undefined;
	relatedArtifactKind?: HtmlArtifactKind | undefined;
	relatedSourceDocumentId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	outputPath?: string | undefined;
	expected?: string | undefined;
	received?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Review Generation Item
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationItem {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	title: string;
	status: HtmlReviewGenerationStatus;
	action: string;
	outputPath: string;
	relativeOutputPath: string;
	phaseId: PhaseId | undefined;
	documentCanonicalId: CanonicalDocumentId | undefined;
	sourceCanonicalDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	rendered: boolean;
	written: boolean;
	checksum?: string | undefined;
	registryEntryCreated: boolean;
	registryEntryUpdated: boolean;
	diagnostics: HtmlReviewGenerationDiagnostic[];
	securitySafe: boolean;
	blockers: string[];
}

// ---------------------------------------------------------------------------
// Review Artifact Record
// ---------------------------------------------------------------------------

export interface HtmlReviewArtifactRecord {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	outputPath: string;
	relativeOutputPath: string;
	sourceCanonicalDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	profileId: string;
	profileVersion?: string | undefined;
	generatedAt: string;
	checksum?: string | undefined;
	generationRunId?: string | undefined;
	isCanonical: false;
	status: HtmlReviewGenerationStatus;
	traceabilitySummary?: string | undefined;
}

// ---------------------------------------------------------------------------
// Generation Security Summary
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationSecuritySummary {
	renderedFilesCount: number;
	externalAssetCount: number;
	scriptTagCount: number;
	unsafeHrefCount: number;
	formTagCount: number;
	iframeCount: number;
	allSafe: boolean;
}

// ---------------------------------------------------------------------------
// Generation Summary
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationSummary {
	total: number;
	created: number;
	updated: number;
	skipped: number;
	blocked: number;
	stale: number;
	requiresReview: number;
	failed: number;
	countsByKind: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Review View Data (input to view data builders)
// ---------------------------------------------------------------------------

export interface HtmlReviewViewDataInput {
	profileId: string;
	profileVersion?: string | undefined;
	documentationRoot: string;
	phases: readonly {
		id: PhaseId;
		title: string;
		order: number;
		sourcePath: string;
		status?: string;
		documents: readonly {
			canonicalId: CanonicalDocumentId;
			title: string;
			status: string;
			sourcePath?: string;
		}[];
	}[];
	documents: readonly {
		canonicalId: CanonicalDocumentId;
		title: string;
		phaseId: PhaseId;
		status: string;
		sourcePath?: string;
	}[];
	stalenessData?:
		| {
				staleDocumentIds: Set<string>;
				blockedDocumentIds: Set<string>;
				missingDocumentIds: Set<string>;
				statusByDocumentId: Map<string, string>;
		  }
		| undefined;
	validationFindings: readonly {
		id: string;
		code: string;
		severity: string;
		message: string;
		documentCanonicalId?: string;
		phaseId?: string;
		path?: string;
		pointer?: string;
		recoveryHint?: string;
		isReleaseBlocker?: boolean;
	}[];
	decisions: readonly {
		id: string;
		title: string;
		summary: string;
		status: string;
		confidence: string;
		reviewState: string;
		affectedDocumentIds: string[];
		sourceIds: string[];
		isInferred: boolean;
		reviewRequired: boolean;
	}[];
	risks: readonly {
		id: string;
		title: string;
		summary: string;
		status: string;
		confidence: string;
		mitigation?: string;
		affectedDocumentIds: string[];
		sourceIds: string[];
		isInferred: boolean;
		reviewRequired: boolean;
	}[];
	assumptions: readonly {
		id: string;
		title: string;
		summary: string;
		status: string;
		confidence: string;
		reviewState: string;
		affectedDocumentIds: string[];
		reviewRequired: boolean;
	}[];
	openQuestions: readonly {
		id: string;
		title: string;
		summary: string;
		status: string;
		reviewRequired: boolean;
		affectedDocumentIds: string[];
		isBlocking: boolean;
	}[];
	hypotheses: readonly {
		id: string;
		title: string;
		status: string;
		confidence: string;
	}[];
	traceabilityData?:
		| {
				sourceCount: number;
				claimCount: number;
				reviewRequiredCount: number;
				inferredClaimCount: number;
				missingSourceCount: number;
		  }
		| undefined;
	artifactRegistryEntryCount?: number;
	registerCount?: {
		decisions: number;
		risks: number;
		assumptions: number;
		questions: number;
		hypotheses: number;
	};
	consistencyStatus?:
		| {
				overall: string;
				contradictionCount: number;
				boundaryViolationCount: number;
		  }
		| undefined;
}

// ---------------------------------------------------------------------------
// Review View Data Builder — produces renderer-safe inputs
// ---------------------------------------------------------------------------

export type HtmlReviewViewDataBuilder = (
	input: HtmlReviewViewDataInput,
	artifactKind: HtmlReviewViewKind,
) => {
	sections: { sectionKind: string; title: string; rendered: boolean }[];
	summary?: Record<string, unknown> | undefined;
	phases?: Record<string, unknown>[] | undefined;
	documents?: Record<string, unknown>[] | undefined;
	decisions?: Record<string, unknown>[] | undefined;
	risks?: Record<string, unknown>[] | undefined;
	validationFindings?: Record<string, unknown>[] | undefined;
	traceability?: Record<string, unknown> | undefined;
	diagnostics: HtmlRenderDiagnostic[];
};

// ---------------------------------------------------------------------------
// Generation Options
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationOptions {
	dryRun?: boolean | undefined;
	documentationRootOverride?: string | undefined;
	artifactRootOverride?: string | undefined;
	writePolicy?: HtmlReviewWritePolicy | undefined;
	generatedAt?: string | undefined;
	deterministicIdPrefix?: string | undefined;
	deterministicTimestamp?: string | undefined;
	renderBlockedPages?: boolean | undefined;
	renderMissingSourcePages?: boolean | undefined;
	renderReviewPages?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Generation Input
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationInput {
	profileId: string;
	projectRoot: string;
	documentationRoot: string;
	artifactRoot?: string | undefined;
	options?: HtmlReviewGenerationOptions | undefined;
}

// ---------------------------------------------------------------------------
// Generation Result
// ---------------------------------------------------------------------------

export interface HtmlReviewGenerationResult {
	profileId: string;
	documentationRoot: string;
	artifactRoot?: string | undefined;
	dryRun: boolean;
	readOnly: true;
	items: HtmlReviewGenerationItem[];
	summary: HtmlReviewGenerationSummary;
	createdPaths: string[];
	updatedPaths: string[];
	skippedPaths: string[];
	blockedPaths: string[];
	failedPaths: string[];
	artifactRegistryEntriesCreated: number;
	artifactRegistryEntriesUpdated: number;
	changedPaths: string[];
	diagnostics: HtmlReviewGenerationDiagnostic[];
	securitySummary: HtmlReviewGenerationSecuritySummary;
	artifactRecords: HtmlReviewArtifactRecord[];
}
