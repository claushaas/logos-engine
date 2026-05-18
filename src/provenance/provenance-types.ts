/** Step 8.1 — Provenance Types: source, claim, and link contracts */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export type SourceId = string & { __brand?: 'SourceId' };

export type SourceType =
	| 'conversation_answer'
	| 'confirmed_decision'
	| 'assumption'
	| 'document'
	| 'profile_descriptor'
	| 'validation_finding'
	| 'manual_note'
	| 'repository_scan'
	| 'external_reference';

export type SourceStatus =
	| 'proposed'
	| 'confirmed'
	| 'inferred'
	| 'requires_review'
	| 'superseded'
	| 'rejected'
	| 'unknown';

export type SourceConfidence = 'explicit' | 'derived' | 'inferred' | 'unknown';

export interface SourceTimestamp {
	createdAt?: string | undefined;
	updatedAt?: string | undefined;
	observedAt?: string | undefined;
	generatedAt?: string | undefined;
}

export interface SourceLocation {
	path?: string | undefined;
	pointer?: string | undefined;
	line?: number | undefined;
	section?: string | undefined;
}

export interface SourceMetadata {
	label?: string | undefined;
	notes?: string | undefined;
	[key: string]: unknown;
}

export interface SourceRecord {
	sourceId: SourceId;
	sourceType: SourceType;
	status: SourceStatus;
	confidence: SourceConfidence;
	title: string;
	location: SourceLocation;
	timestamp: SourceTimestamp;
	relatedWorkspaceRecordId?: string | undefined;
	relatedDocumentCanonicalId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relatedProposalId?: string | undefined;
	relatedValidationFindingId?: string | undefined;
	relatedArtifactId?: string | undefined;
	externalUri?: string | undefined;
	metadata: SourceMetadata;
	orderIndex: number;
}

export interface SourceReference {
	sourceId: SourceId;
	sourceType: SourceType;
	label?: string | undefined;
	path?: string | undefined;
	pointer?: string | undefined;
}

export type SourceResolutionStatus =
	| 'resolved'
	| 'unresolved'
	| 'ambiguous'
	| 'unknown';

export interface SourceResolutionDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	relatedSourceId?: SourceId | undefined;
	relatedClaimId?: string | undefined;
	relatedDocumentId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relatedWorkspaceRecordId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}

export interface SourceResolutionResult {
	status: SourceResolutionStatus;
	sources: SourceRecord[];
	diagnostics: SourceResolutionDiagnostic[];
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export type ClaimId = string & { __brand?: 'ClaimId' };

export type ClaimType =
	| 'fact'
	| 'decision'
	| 'assumption'
	| 'hypothesis'
	| 'risk'
	| 'open_question'
	| 'requirement'
	| 'constraint'
	| 'generated_section'
	| 'executive_item'
	| 'validation_claim'
	| 'external_claim'
	| 'unknown';

export type ClaimStatus =
	| 'proposed'
	| 'confirmed'
	| 'inferred'
	| 'requires_review'
	| 'superseded'
	| 'rejected'
	| 'unknown';

export type ClaimConfidence = 'explicit' | 'derived' | 'inferred' | 'unknown';

export type ClaimReviewState =
	| 'not_required'
	| 'required'
	| 'in_review'
	| 'approved'
	| 'rejected'
	| 'blocked';

export interface ClaimEvidence {
	snippet: string;
	sourcePointer?: string | undefined;
	bounded?: boolean | undefined;
}

export interface ClaimLocation {
	path?: string | undefined;
	pointer?: string | undefined;
	line?: number | undefined;
	section?: string | undefined;
}

export interface ClaimResolutionDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	relatedClaimId?: ClaimId | undefined;
	relatedSourceId?: SourceId | undefined;
	relatedDocumentId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relatedWorkspaceRecordId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}

export interface ClaimResolutionResult {
	sources: SourceRecord[];
	links: ClaimSourceLink[];
	diagnostics: ClaimResolutionDiagnostic[];
}

export interface ClaimRecord {
	claimId: ClaimId;
	claimType: ClaimType;
	status: ClaimStatus;
	confidence: ClaimConfidence;
	reviewState: ClaimReviewState;
	summary: string;
	body?: string | undefined;
	sourceLinks: ClaimSourceLink[];
	sourceCount: number;
	primarySourceId?: SourceId | undefined;
	relatedDocumentCanonicalId?: CanonicalDocumentId | undefined;
	relatedPhaseId?: PhaseId | undefined;
	relatedSectionId?: string | undefined;
	relatedSectionPath?: string | undefined;
	relatedWorkspaceRecordId?: string | undefined;
	relatedArtifactId?: string | undefined;
	isGenerated: boolean;
	isInferred: boolean;
	createdAt?: string | undefined;
	updatedAt?: string | undefined;
	diagnostics: ClaimResolutionDiagnostic[];
}

export interface ClaimSourceLink {
	claimId: ClaimId;
	sourceId: SourceId;
	linkType: ClaimSourceLinkType;
	confidence: SourceConfidence;
	status: SourceStatus;
	evidence?: ClaimEvidence | undefined;
	sourcePointer?: string | undefined;
	sourcePath?: string | undefined;
	explanation?: string | undefined;
	createdAt?: string | undefined;
	observedAt?: string | undefined;
}

export type ClaimSourceLinkType =
	| 'supports'
	| 'contradicts'
	| 'qualifies'
	| 'derived_from'
	| 'mentions'
	| 'requires_review'
	| 'unknown';

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

export interface ClaimQuery {
	claimId?: ClaimId | undefined;
	claimType?: ClaimType | undefined;
	claimStatus?: ClaimStatus | undefined;
	claimConfidence?: ClaimConfidence | undefined;
	reviewState?: ClaimReviewState | undefined;
	sourceId?: SourceId | undefined;
	documentId?: CanonicalDocumentId | undefined;
	phaseId?: PhaseId | undefined;
	sectionId?: string | undefined;
	artifactFilter?: string | undefined;
}

export interface ClaimQueryResult {
	claims: ClaimRecord[];
	sources: SourceRecord[];
	links: ClaimSourceLink[];
	diagnostics: ClaimResolutionDiagnostic[];
}

export interface ProvenanceSummary {
	sourceCountByType: Partial<Record<SourceType, number>>;
	claimCountByType: Partial<Record<ClaimType, number>>;
	claimCountByStatus: Partial<Record<ClaimStatus, number>>;
	claimCountByConfidence: Partial<Record<ClaimConfidence, number>>;
	reviewRequiredClaimCount: number;
	missingSourceClaimCount: number;
	unsupportedSourceCount: number;
	topDocumentsMissingSources: { documentId: string; missingCount: number }[];
	diagnostics: SourceResolutionDiagnostic[];
}

// ---------------------------------------------------------------------------
// Builder context (shared)
// ---------------------------------------------------------------------------

export interface ProvenanceBuilderContext {
	projectRoot?: string | undefined;
	profileId?: string | undefined;
	generatedAt?: string | undefined;
	orderIndex?: number | undefined;
	strictSources?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// External reference (type-placeholder for Phase 12)
// ---------------------------------------------------------------------------

export interface ExternalReference {
	uri: string;
	label?: string | undefined;
	description?: string | undefined;
	retrievedAt?: string | undefined;
}

export interface RepositoryScanReference {
	sourceType: 'repository_scan';
	label?: string | undefined;
	description?: string | undefined;
}

// ---------------------------------------------------------------------------
// Specific sub-types for documentation purposes
// ---------------------------------------------------------------------------

export interface ConversationAnswerSourceReference {
	sourceType: 'conversation_answer';
	answerId: string;
	sessionId?: string | undefined;
	questionId?: string | undefined;
	label?: string | undefined;
}

export interface DecisionSourceReference {
	sourceType: 'confirmed_decision';
	decisionId: string;
	title?: string | undefined;
}

export interface AssumptionSourceReference {
	sourceType: 'assumption';
	assumptionId: string;
	title?: string | undefined;
}

export interface DocumentSourceReference {
	sourceType: 'document';
	documentCanonicalId: CanonicalDocumentId;
	phaseId?: PhaseId | undefined;
	label?: string | undefined;
}

export interface ProfileDescriptorReference {
	sourceType: 'profile_descriptor';
	profileId: string;
	descriptorPath?: string | undefined;
	label?: string | undefined;
}

export interface ValidationFindingSourceReference {
	sourceType: 'validation_finding';
	findingId: string;
	label?: string | undefined;
}

export interface ManualNoteSourceReference {
	sourceType: 'manual_note';
	noteId: string;
	label?: string | undefined;
}

// ---------------------------------------------------------------------------
// Generated content claim
// ---------------------------------------------------------------------------

export interface GeneratedContentClaim {
	claimId: ClaimId;
	sectionTitle?: string | undefined;
	documentCanonicalId?: CanonicalDocumentId | undefined;
	phaseId?: PhaseId | undefined;
	sectionId?: string | undefined;
	body: string;
	sources: SourceReference[];
	isInferred: boolean;
	reviewState: ClaimReviewState;
	diagnostics: ClaimResolutionDiagnostic[];
}

export interface DocumentSectionClaim {
	claimId: ClaimId;
	documentCanonicalId: CanonicalDocumentId;
	phaseId?: PhaseId | undefined;
	sectionId: string;
	sectionTitle?: string | undefined;
	sectionPath?: string | undefined;
	body: string;
	sources: SourceReference[];
	isInferred: boolean;
	reviewState: ClaimReviewState;
	diagnostics: ClaimResolutionDiagnostic[];
}

export interface ExecutiveItemClaim {
	claimId: ClaimId;
	itemId: string;
	itemTitle?: string | undefined;
	body: string;
	sources: SourceReference[];
	normativeDocuments: DocumentSourceReference[];
	profileDescriptors: ProfileDescriptorReference[];
	confirmedDecisions: DecisionSourceReference[];
	assumptions: AssumptionSourceReference[];
	risks: SourceReference[];
	findings: ValidationFindingSourceReference[];
	isInferred: boolean;
	reviewState: ClaimReviewState;
	diagnostics: ClaimResolutionDiagnostic[];
}

// ---------------------------------------------------------------------------
// Provenance graph — a read-only snapshot for a scope
// ---------------------------------------------------------------------------

export interface ProvenanceGraph {
	sources: SourceRecord[];
	claims: ClaimRecord[];
	links: ClaimSourceLink[];
	diagnostics: SourceResolutionDiagnostic[];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export const SOURCE_TYPES: readonly SourceType[] = [
	'conversation_answer',
	'confirmed_decision',
	'assumption',
	'document',
	'profile_descriptor',
	'validation_finding',
	'manual_note',
	'repository_scan',
	'external_reference',
] as const;

export const SOURCE_STATUSES: readonly SourceStatus[] = [
	'proposed',
	'confirmed',
	'inferred',
	'requires_review',
	'superseded',
	'rejected',
	'unknown',
] as const;

export const SOURCE_CONFIDENCES: readonly SourceConfidence[] = [
	'explicit',
	'derived',
	'inferred',
	'unknown',
] as const;

export const CLAIM_TYPES: readonly ClaimType[] = [
	'fact',
	'decision',
	'assumption',
	'hypothesis',
	'risk',
	'open_question',
	'requirement',
	'constraint',
	'generated_section',
	'executive_item',
	'validation_claim',
	'external_claim',
	'unknown',
] as const;

export const CLAIM_STATUSES: readonly ClaimStatus[] = [
	'proposed',
	'confirmed',
	'inferred',
	'requires_review',
	'superseded',
	'rejected',
	'unknown',
] as const;

export const CLAIM_CONFIDENCES: readonly ClaimConfidence[] = [
	'explicit',
	'derived',
	'inferred',
	'unknown',
] as const;

export const CLAIM_REVIEW_STATES: readonly ClaimReviewState[] = [
	'not_required',
	'required',
	'in_review',
	'approved',
	'rejected',
	'blocked',
] as const;

export const CLAIM_SOURCE_LINK_TYPES: readonly ClaimSourceLinkType[] = [
	'supports',
	'contradicts',
	'qualifies',
	'derived_from',
	'mentions',
	'requires_review',
	'unknown',
] as const;

// ---------------------------------------------------------------------------
// Deterministic ordering indices
// ---------------------------------------------------------------------------

export const SOURCE_TYPE_ORDER: Record<SourceType, number> = {
	assumption: 2,
	confirmed_decision: 1,
	conversation_answer: 0,
	document: 3,
	external_reference: 8,
	manual_note: 6,
	profile_descriptor: 4,
	repository_scan: 7,
	validation_finding: 5,
};

export const CLAIM_TYPE_ORDER: Record<ClaimType, number> = {
	assumption: 2,
	constraint: 7,
	decision: 1,
	executive_item: 9,
	external_claim: 11,
	fact: 0,
	generated_section: 8,
	hypothesis: 3,
	open_question: 5,
	requirement: 6,
	risk: 4,
	unknown: 12,
	validation_claim: 10,
};

export const CLAIM_STATUS_ORDER: Record<ClaimStatus, number> = {
	confirmed: 0,
	inferred: 2,
	proposed: 1,
	rejected: 5,
	requires_review: 3,
	superseded: 4,
	unknown: 6,
};

export const CLAIM_CONFIDENCE_ORDER: Record<ClaimConfidence, number> = {
	derived: 1,
	explicit: 0,
	inferred: 2,
	unknown: 3,
};

export const LINK_TYPE_ORDER: Record<ClaimSourceLinkType, number> = {
	contradicts: 1,
	derived_from: 3,
	mentions: 4,
	qualifies: 2,
	requires_review: 5,
	supports: 0,
	unknown: 6,
};
