/** Canonical Markdown Renderer Types — deterministic render contracts */

import type { DocumentDescriptorSection } from '../profiles/document-descriptor.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	WorkspaceAssumption,
	WorkspaceDecision,
	WorkspaceOpenQuestion,
	WorkspaceProposal,
	WorkspaceRisk,
	WorkspaceState,
} from '../state/workspace-state.schema.js';
import type {
	GenerationAction,
	GenerationPlanItem,
} from './generation-planner-types.js';

// ---------------------------------------------------------------------------
// Render status
// ---------------------------------------------------------------------------

export type MarkdownSectionRenderStatus =
	| 'rendered'
	| 'incomplete'
	| 'missing_input'
	| 'blocked'
	| 'skipped'
	| 'gap_only';

// ---------------------------------------------------------------------------
// Gap marker
// ---------------------------------------------------------------------------

export interface MarkdownGapMarker {
	code: string;
	message: string;
	sectionId?: string | undefined;
	inputId?: string | undefined;
	sourceDocumentId?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Source reference
// ---------------------------------------------------------------------------

export interface MarkdownSourceReference {
	recordId: string;
	recordType: 'decision' | 'assumption' | 'open_question' | 'risk' | 'proposal';
	sourceProposalId?: string;
	sourceAnswerId?: string;
	sourceSessionId?: string;
	sourceQuestionId?: string;
	sourceDocumentId?: string;
	sourcePhaseId?: string;
}

// ---------------------------------------------------------------------------
// Traceability reference
// ---------------------------------------------------------------------------

export interface MarkdownTraceabilityReference {
	workspaceRecordId: string;
	recordType: string;
	sourceProposalId?: string;
	sourceAnswerId?: string;
	sourceSessionId?: string;
	sourceQuestionId?: string;
	sourceDocumentId?: string;
	sourcePhaseId?: string;
}

// ---------------------------------------------------------------------------
// Quality note
// ---------------------------------------------------------------------------

export interface MarkdownQualityNote {
	criterion: string;
	status:
		| 'satisfied'
		| 'incomplete'
		| 'blocked'
		| 'not_evaluated'
		| 'missing_input';
	detail?: string;
}

// ---------------------------------------------------------------------------
// Metadata header
// ---------------------------------------------------------------------------

export interface MarkdownMetadataHeader {
	documentId: string;
	phaseId: string;
	profileId: string;
	canonicalOutput: string;
	generatedBy: string;
	generatedAt: string;
	generationStatus: GenerationAction;
	sourceStateSchemaVersion: string;
	traceability: MarkdownTraceabilityReference[];
	nonCanonicalArtifacts?: string[];
}

// ---------------------------------------------------------------------------
// Language policy
// ---------------------------------------------------------------------------

export interface MarkdownLanguagePolicy {
	language: string;
	enforceEnglish: boolean;
}

// ---------------------------------------------------------------------------
// Rendered section
// ---------------------------------------------------------------------------

export interface RenderedMarkdownSection {
	sectionId: string;
	title: string;
	status: MarkdownSectionRenderStatus;
	markdown: string;
	sources: MarkdownSourceReference[];
	gaps: MarkdownGapMarker[];
	descriptorOrder: number;
	required: boolean;
}

// ---------------------------------------------------------------------------
// Render diagnostic
// ---------------------------------------------------------------------------

export interface CanonicalMarkdownRenderDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	documentId?: string;
	sourcePath?: string;
	fieldPointer?: string;
	recoveryHint?: string;
}

// ---------------------------------------------------------------------------
// Render input
// ---------------------------------------------------------------------------

export interface CanonicalMarkdownRenderInput {
	documentDescriptor: {
		id: string;
		title: string;
		phaseId: string;
		purpose: string;
		centralQuestion: string;
		sections: DocumentDescriptorSection[];
		completionCriteria?: string[];
		qualityChecks?: string[];
		antiPatterns?: string[];
		reviewRules?: string[];
		status: string;
		type: string;
	};
	planItem: GenerationPlanItem;
	state: WorkspaceState;
	profileId: string;
	schemaVersion: string;
}

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export interface CanonicalMarkdownRenderOptions {
	generatedAt?: string;
	renderedBy?: string;
	allowBlockedPreview?: boolean;
	allowFailedPreview?: boolean;
	allowSkipPreview?: boolean;
	languagePolicy?: MarkdownLanguagePolicy;
}

// ---------------------------------------------------------------------------
// Render result
// ---------------------------------------------------------------------------

export interface CanonicalMarkdownRenderResult {
	status: GenerationAction;
	markdown: string;
	documentCanonicalId: CanonicalDocumentId;
	phaseId: PhaseId;
	canonicalOutputPath: string;
	sections: RenderedMarkdownSection[];
	metadata: MarkdownMetadataHeader;
	sources: MarkdownSourceReference[];
	gaps: MarkdownGapMarker[];
	diagnostics: CanonicalMarkdownRenderDiagnostic[];
	renderedAt: string;
}

// ---------------------------------------------------------------------------
// Document-level type (re-export convenience)
// ---------------------------------------------------------------------------

export interface CanonicalMarkdownDocument {
	canonicalId: CanonicalDocumentId;
	phaseId: PhaseId;
	markdown: string;
	outputPath: string;
	metadata: MarkdownMetadataHeader;
	sections: RenderedMarkdownSection[];
}

// ---------------------------------------------------------------------------
// Confirmed state collections (internal)
// ---------------------------------------------------------------------------

export interface ConfirmedStateCollections {
	confirmedDecisions: WorkspaceDecision[];
	confirmedAssumptions: WorkspaceAssumption[];
	unresolvedQuestions: WorkspaceOpenQuestion[];
	relatedRisks: WorkspaceRisk[];
	acceptedProposals: WorkspaceProposal[];
	proposedProposals: WorkspaceProposal[];
}

// ---------------------------------------------------------------------------
// Section render input (internal)
// ---------------------------------------------------------------------------

export interface SectionRenderContext {
	section: DocumentDescriptorSection;
	descriptorOrder: number;
	confirmedDecisions: WorkspaceDecision[];
	confirmedAssumptions: WorkspaceAssumption[];
	unresolvedQuestions: WorkspaceOpenQuestion[];
	relatedRisks: WorkspaceRisk[];
	acceptedProposals: WorkspaceProposal[];
	gaps: MarkdownGapMarker[];
	sources: MarkdownSourceReference[];
}
