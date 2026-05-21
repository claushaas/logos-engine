/** Step 8.4 — Traceability rendering types and contracts */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	ClaimId,
	ClaimRecord,
	ClaimReviewState,
	ClaimStatus,
	ClaimType,
	SourceConfidence,
	SourceId,
	SourceRecord,
	SourceStatus,
	SourceType,
} from '../provenance/provenance-types.js';
import type { RegisterCollections } from '../registers/register-types.js';
import type { ValidationFinding } from '../validation/validation-finding.js';

// ---------------------------------------------------------------------------
// Kinds and boundaries
// ---------------------------------------------------------------------------

export type TraceabilityOutputKind =
	| 'canonical_markdown'
	| 'validation_report'
	| 'diagnostic_report'
	| 'html_artifact'
	| 'agent_pack'
	| 'executive_json'
	| 'executive_markdown'
	| 'executive_html';

export type TraceabilityOutputBoundary =
	| 'canonical'
	| 'derived'
	| 'non_canonical'
	| 'review_only'
	| 'execution_aid';

export type TraceabilityConfidence = SourceConfidence;

export type TraceabilityReviewMarker = ClaimReviewState;

// ---------------------------------------------------------------------------
// Portable path
// ---------------------------------------------------------------------------

export interface PortableSourcePath {
	relativePath: string;
	rootHint: 'project' | 'profile' | 'documentation' | 'artifact';
}

// ---------------------------------------------------------------------------
// Source item for rendering
// ---------------------------------------------------------------------------

export interface TraceabilitySourceItem {
	sourceId: string;
	sourceType: SourceType;
	status: SourceStatus;
	confidence: TraceabilityConfidence;
	title: string;
	relatedDocumentCanonicalId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relativeSourcePath?: string | undefined;
	pointer?: string | undefined;
	section?: string | undefined;
	lineReference?: string | undefined;
	relatedRegisterItemId?: string | undefined;
	relatedClaimId?: ClaimId | undefined;
	relatedValidationFindingId?: string | undefined;
	sourceTimestamp?: string | undefined;
	reviewMarker?: TraceabilityReviewMarker | undefined;
}

// ---------------------------------------------------------------------------
// Claim item for rendering
// ---------------------------------------------------------------------------

export interface TraceabilityClaimItem {
	claimId: ClaimId;
	claimType: ClaimType;
	status: ClaimStatus;
	confidence: TraceabilityConfidence;
	reviewState: TraceabilityReviewMarker;
	shortSummary: string;
	primarySourceId?: SourceId | undefined;
	sourceCount: number;
	relatedDocumentCanonicalId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relatedSectionId?: string | undefined;
	relatedSectionPath?: string | undefined;
	isInferred: boolean;
	isGenerated: boolean;
	reviewRequiredMarker: boolean;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface TraceabilityDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
}

// ---------------------------------------------------------------------------
// Source and claim lists
// ---------------------------------------------------------------------------

export interface TraceabilitySourceList {
	sources: TraceabilitySourceItem[];
	missingSourceCount: number;
	diagnostics: TraceabilityDiagnostic[];
}

export interface TraceabilityClaimList {
	claims: TraceabilityClaimItem[];
	reviewRequiredCount: number;
	inferredCount: number;
	missingSourceCount: number;
	diagnostics: TraceabilityDiagnostic[];
}

// ---------------------------------------------------------------------------
// Register summary
// ---------------------------------------------------------------------------

export interface TraceabilityRegisterSummary {
	decisionCount: number;
	assumptionCount: number;
	riskCount: number;
	openQuestionCount: number;
	hypothesisCount: number;
	reviewRequiredCount: number;
	missingSourceCount: number;
	blockingOpenQuestionCount: number;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export interface TraceabilityMetadata {
	outputKind: TraceabilityOutputKind;
	boundary: TraceabilityOutputBoundary;
	generatedAt: string;
	profileId: string;
	documentCanonicalId?: CanonicalDocumentId | undefined;
	phaseId?: PhaseId | undefined;
	outputPath?: string | undefined;
	artifactId?: string | undefined;
	generationRunId?: string | undefined;
	validationRunId?: string | undefined;
	sourceCount: number;
	claimCount: number;
	reviewRequiredCount: number;
	inferredClaimCount: number;
	unresolvedQuestionCount: number;
	blockingOpenQuestionCount: number;
	missingSourceCount: number;
	registerSummary?: TraceabilityRegisterSummary | undefined;
	sourceReferences: TraceabilitySourceItem[];
	claimReferences: TraceabilityClaimItem[];
	diagnostics: TraceabilityDiagnostic[];
}

// ---------------------------------------------------------------------------
// Section rendering
// ---------------------------------------------------------------------------

export interface TraceabilitySectionItem {
	label: string;
	value: string;
	marker?: string | undefined;
	confidence?: TraceabilityConfidence | undefined;
	reviewMarker?: TraceabilityReviewMarker | undefined;
}

export interface TraceabilitySection {
	title: string;
	items: TraceabilitySectionItem[];
}

// ---------------------------------------------------------------------------
// Rendered outputs
// ---------------------------------------------------------------------------

export interface RenderedTraceabilityMarkdown {
	metadataHeaderAddon: string;
	traceabilitySection: string;
}

export interface RenderedTraceabilityJson {
	metadata: TraceabilityMetadata;
}

// ---------------------------------------------------------------------------
// Input / options / result for builders
// ---------------------------------------------------------------------------

export interface OutputTraceabilityInput {
	outputKind: TraceabilityOutputKind;
	boundary: TraceabilityOutputBoundary;
	profileId: string;
	documentCanonicalId?: CanonicalDocumentId | undefined;
	phaseId?: PhaseId | undefined;
	outputPath?: string | undefined;
	artifactId?: string | undefined;
	generationRunId?: string | undefined;
	validationRunId?: string | undefined;
	generatedAt?: string | undefined;
	sources?: SourceRecord[] | undefined;
	claims?: ClaimRecord[] | undefined;
	registers?: RegisterCollections | undefined;
	findings?: ValidationFinding[] | undefined;
	diagnostics?: TraceabilityDiagnostic[] | undefined;
}

export interface OutputTraceabilityOptions {
	projectRoot?: string | undefined;
	redactSecrets?: boolean | undefined;
	includeRawProviderContext?: boolean | undefined;
	maxEvidenceSnippetLength?: number | undefined;
	deterministicTimestamp?: string | undefined;
}

export interface OutputTraceabilityResult {
	metadata: TraceabilityMetadata;
	renderedMarkdown?: RenderedTraceabilityMarkdown | undefined;
	renderedJson?: RenderedTraceabilityJson | undefined;
}
