/** Step 9.2 — Safe Static HTML Renderer types, contracts, and interfaces */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	HtmlArtifactKind,
	HtmlArtifactStatus,
} from './html-artifact-types.js';

export type {
	HtmlArtifactKind,
	HtmlArtifactStatus,
} from './html-artifact-types.js';

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

export type HtmlRenderBoundary = 'derived' | 'non_canonical' | 'review_only';

export const HTML_RENDER_BOUNDARY_ORDER: Record<HtmlRenderBoundary, number> = {
	derived: 0,
	non_canonical: 1,
	review_only: 2,
};

// ---------------------------------------------------------------------------
// Render statuses
// ---------------------------------------------------------------------------

export type HtmlRenderStatus =
	| 'ready'
	| 'blocked'
	| 'stale'
	| 'missing_source'
	| 'requires_review'
	| 'unknown';

export const HTML_RENDER_STATUS_ORDER: Record<HtmlRenderStatus, number> = {
	blocked: 2,
	missing_source: 3,
	ready: 0,
	requires_review: 4,
	stale: 1,
	unknown: 5,
};

// ---------------------------------------------------------------------------
// Section kinds
// ---------------------------------------------------------------------------

export type HtmlRenderSectionKind =
	| 'summary'
	| 'phase_list'
	| 'document_list'
	| 'decision_list'
	| 'risk_list'
	| 'validation_findings'
	| 'readiness_status'
	| 'traceability_list'
	| 'diagnostics'
	| 'empty_state';

export const HTML_RENDER_SECTION_KIND_ORDER: Record<
	HtmlRenderSectionKind,
	number
> = {
	decision_list: 3,
	diagnostics: 8,
	document_list: 2,
	empty_state: 9,
	phase_list: 1,
	readiness_status: 6,
	risk_list: 4,
	summary: 0,
	traceability_list: 7,
	validation_findings: 5,
};

// ---------------------------------------------------------------------------
// Escaped string and trusted template
// ---------------------------------------------------------------------------

export type HtmlEscapedString = string & { __brand?: 'HtmlEscapedString' };

export type HtmlTrustedTemplate = string & { __brand?: 'HtmlTrustedTemplate' };

// ---------------------------------------------------------------------------
// Sanitised local href result
// ---------------------------------------------------------------------------

export interface SanitizedHrefResult {
	safe: boolean;
	href: string;
	reason: string | undefined;
	isExternal: boolean;
	needsTextOnly: boolean;
}

// ---------------------------------------------------------------------------
// Source reference
// ---------------------------------------------------------------------------

export interface HtmlRenderSource {
	sourceId: string;
	sourceKind: string;
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
	label: string | undefined;
	relativePath: string | undefined;
	safeForLink: boolean;
	status: string | undefined;
}

// ---------------------------------------------------------------------------
// Traceability rendering data
// ---------------------------------------------------------------------------

export interface HtmlRenderTraceabilitySourceItem {
	sourceId: string;
	sourceType: string;
	status: string;
	confidence: string;
	title: string;
	relatedDocumentCanonicalId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relativeSourcePath?: string | undefined;
	reviewMarker?: string | undefined;
	sourceTimestamp?: string | undefined;
}

export interface HtmlRenderTraceabilityClaimItem {
	claimId: string;
	claimType: string;
	status: string;
	confidence: string;
	reviewState: string;
	shortSummary: string;
	primarySourceId?: string | undefined;
	sourceCount: number;
	relatedDocumentCanonicalId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	isInferred: boolean;
	isGenerated: boolean;
	reviewRequiredMarker: boolean;
}

export interface HtmlRenderTraceabilityData {
	sourceCount: number;
	claimCount: number;
	reviewRequiredCount: number;
	inferredClaimCount: number;
	missingSourceCount: number;
	sources: HtmlRenderTraceabilitySourceItem[];
	claims: HtmlRenderTraceabilityClaimItem[];
}

// ---------------------------------------------------------------------------
// Section data
// ---------------------------------------------------------------------------

export interface HtmlRenderSummaryData {
	documentCount?: number | undefined;
	readyCount?: number | undefined;
	blockedCount?: number | undefined;
	staleCount?: number | undefined;
	missingCount?: number | undefined;
	validationFindingCount?: number | undefined;
	registerCount?: number | undefined;
	traceabilityCount?: number | undefined;
	phaseCount?: number | undefined;
	extraFields?: Readonly<Record<string, string>> | undefined;
}

export interface HtmlRenderPhaseData {
	phaseId: string;
	title: string;
	order: number;
	documentCount: number;
	readyCount: number;
	blockedCount: number;
	staleCount: number;
	status: string;
	canonicalSourcePath: string | undefined;
}

export interface HtmlRenderDocumentData {
	documentCanonicalId: CanonicalDocumentId;
	title: string;
	phaseId: PhaseId;
	status: string;
	staleStatus: string | undefined;
	canonicalSourcePath: string | undefined;
}

export interface HtmlRenderDecisionData {
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
}

export interface HtmlRenderRiskData {
	id: string;
	title: string;
	summary: string;
	status: string;
	confidence: string;
	mitigation: string | undefined;
	affectedDocumentIds: string[];
	sourceIds: string[];
	isInferred: boolean;
	reviewRequired: boolean;
}

export interface HtmlRenderValidationFindingData {
	id: string;
	code: string;
	severity: string;
	message: string;
	documentCanonicalId: string | undefined;
	phaseId: string | undefined;
	path: string | undefined;
	pointer: string | undefined;
	recoveryHint: string | undefined;
	isReleaseBlocker: boolean;
}

// ---------------------------------------------------------------------------
// Render section
// ---------------------------------------------------------------------------

export interface HtmlRenderSection {
	sectionKind: HtmlRenderSectionKind;
	title: string;
	rendered: boolean;
}

// ---------------------------------------------------------------------------
// Render diagnostic
// ---------------------------------------------------------------------------

export interface HtmlRenderDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath: string | undefined;
	fieldPath: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface HtmlRendererTheme {
	fontFamily: string;
	backgroundColor: string;
	textColor: string;
	headerColor: string;
	borderColor: string;
	warningColor: string;
	errorColor: string;
	infoColor: string;
	successColor: string;
	linkColor: string;
	mutedColor: string;
}

export const DEFAULT_HTML_RENDERER_THEME: HtmlRendererTheme = {
	backgroundColor: '#ffffff',
	borderColor: '#d1d5db',
	errorColor: '#dc2626',
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	headerColor: '#1f2937',
	infoColor: '#3b82f6',
	linkColor: '#1d4ed8',
	mutedColor: '#6b7280',
	successColor: '#16a34a',
	textColor: '#111827',
	warningColor: '#d97706',
};

// ---------------------------------------------------------------------------
// Renderer metadata
// ---------------------------------------------------------------------------

export interface HtmlRendererMetadata {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	outputBoundary: HtmlRenderBoundary;
	profileId: string;
	profileVersion: string | undefined;
	generatedAt: string;
	renderedAt: string;
	sourceCanonicalDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	status: HtmlArtifactStatus;
	traceabilityBoundary: string;
	traceabilitySummary: string | undefined;
}

// ---------------------------------------------------------------------------
// Security summary
// ---------------------------------------------------------------------------

export interface HtmlRenderSecuritySummary {
	escapedContentCount: number;
	rejectedUnsafeUrlCount: number;
	externalAssetCount: number;
	scriptTagCount: number;
	formTagCount: number;
	iframeCount: number;
	isSafe: boolean;
}

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export interface HtmlRenderOptions {
	generatedAt: string;
	renderedAt: string;
	profileVersion?: string | undefined;
	theme?: HtmlRendererTheme | undefined;
}

// ---------------------------------------------------------------------------
// Render input
// ---------------------------------------------------------------------------

export interface HtmlRenderInput {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	title: string;
	status: HtmlRenderStatus;
	outputBoundary: HtmlRenderBoundary;
	profileId: string;
	isDerivedNonCanonical: boolean;
	traceabilityBoundary: string;
	sourceCanonicalDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	sources: HtmlRenderSource[];
	phaseId: PhaseId | undefined;
	documentCanonicalId: CanonicalDocumentId | undefined;
	sections: HtmlRenderSection[];
	diagnostics: HtmlRenderDiagnostic[];
	summary?: HtmlRenderSummaryData | undefined;
	phases?: HtmlRenderPhaseData[] | undefined;
	documents?: HtmlRenderDocumentData[] | undefined;
	decisions?: HtmlRenderDecisionData[] | undefined;
	risks?: HtmlRenderRiskData[] | undefined;
	validationFindings?: HtmlRenderValidationFindingData[] | undefined;
	traceability?: HtmlRenderTraceabilityData | undefined;
}

// ---------------------------------------------------------------------------
// Render artifact
// ---------------------------------------------------------------------------

export interface HtmlRenderArtifact {
	artifactId: string;
	artifactKind: HtmlArtifactKind;
	title: string;
	outputBoundary: HtmlRenderBoundary;
	html: string;
	metadata: HtmlRendererMetadata;
	diagnostics: HtmlRenderDiagnostic[];
	securitySummary: HtmlRenderSecuritySummary;
	changedPaths: [];
	readOnly: true;
}

export type HtmlRenderResult = HtmlRenderArtifact;

// ---------------------------------------------------------------------------
// Static HTML renderer interface
// ---------------------------------------------------------------------------

export interface StaticHtmlRenderer {
	renderStaticHtmlArtifact(
		input: HtmlRenderInput,
		options: HtmlRenderOptions,
	): HtmlRenderResult;

	renderHtmlDocument(
		input: HtmlRenderInput,
		options: HtmlRenderOptions,
	): HtmlRenderResult;
}
