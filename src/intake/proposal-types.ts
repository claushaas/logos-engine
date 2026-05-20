/** Proposal Types — typed contracts for proposal mapping and review lifecycle */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Proposal identity
// ---------------------------------------------------------------------------

export type ProposalId = string;

export type ProposalKind =
	| 'decision'
	| 'assumption'
	| 'hypothesis'
	| 'open_question'
	| 'risk'
	| 'document_content_hint';

export type ProposalStatus =
	| 'proposed'
	| 'accepted'
	| 'rejected'
	| 'revised'
	| 'superseded'
	| 'deferred'
	| 'unknown';

// ---------------------------------------------------------------------------
// Proposal source evidence
// ---------------------------------------------------------------------------

export interface ProposalEvidence {
	/** Evidence text or reference */
	text: string | undefined;
	/** Source answer ID */
	sourceAnswerId: string | undefined;
}

export interface ProposalSource {
	/** Source answer ID */
	answerId: string | undefined;
	/** Source session ID */
	sessionId: string | undefined;
	/** Source question ID when available */
	questionId: string | undefined;
	/** Source document canonical ID when available */
	documentCanonicalId: CanonicalDocumentId | undefined;
	/** Source phase ID when available */
	phaseId: PhaseId | undefined;
}

// ---------------------------------------------------------------------------
// Extraction metadata (safe subset only)
// ---------------------------------------------------------------------------

export interface ProposalExtractionMetadata {
	providerId?: string | undefined;
	providerKind?: string | undefined;
	responseId?: string | undefined;
	operation?: string | undefined;
}

// ---------------------------------------------------------------------------
// Proposal revision
// ---------------------------------------------------------------------------

export interface ProposalRevision {
	revisedAt: string;
	previousTitle: string;
	previousBody: string;
	reason?: string | undefined;
}

// ---------------------------------------------------------------------------
// Reviewable proposal (internal/service representation)
// ---------------------------------------------------------------------------

export interface ReviewableProposal {
	proposalId: ProposalId;
	kind: ProposalKind;
	status: ProposalStatus;
	title: string;
	body: string;
	source: ProposalSource;
	evidence: string | undefined;
	extractionMetadata: ProposalExtractionMetadata | undefined;
	confidence: 'low' | 'medium' | 'high' | 'advisory' | 'unknown' | undefined;
	sourceTurnId: string | undefined;
	sourceLabel:
		| 'user-authored'
		| 'deterministic'
		| 'AI-interpreted'
		| 'imported'
		| 'unknown'
		| undefined;
	affectedDocumentIds: string[];
	diagnostics: ProposalDiagnostic[];
	auditEvents: ProposalAuditEvent[] | undefined;
	caveat: string | undefined;
	createdAt: string;
	updatedAt: string;
	revisionHistory: ProposalRevision[] | undefined;
	supersededByProposalId: ProposalId | undefined;
	targetConfirmedRecordId: string | undefined;
	rejectionReason: string | undefined;
}

// ---------------------------------------------------------------------------
// Kinds with stronger types
// ---------------------------------------------------------------------------

export interface ProposalDecision extends ReviewableProposal {
	kind: 'decision';
}

export interface ProposalAssumption extends ReviewableProposal {
	kind: 'assumption';
}

export interface ProposalHypothesis extends ReviewableProposal {
	kind: 'hypothesis';
}

export interface ProposalOpenQuestion extends ReviewableProposal {
	kind: 'open_question';
}

export interface ProposalRisk extends ReviewableProposal {
	kind: 'risk';
}

export interface ProposalDocumentContentHint extends ReviewableProposal {
	kind: 'document_content_hint';
}

// ---------------------------------------------------------------------------
// Proposal diagnostic
// ---------------------------------------------------------------------------

export interface ProposalDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path?: string | undefined;
	recoveryHint?: string | undefined;
}

export interface ProposalAuditEvent {
	eventId: string;
	eventType: string;
	summary: string;
	timestamp: string;
	actor: string;
	sessionRef: string | undefined;
}

// ---------------------------------------------------------------------------
// Proposal mapping input / result
// ---------------------------------------------------------------------------

export interface ProposalMappingInput {
	/** User answers as input evidence */
	answers: ProposalMappingAnswer[];
	/** Source question cluster from Step 4.1 (optional) */
	questionCluster?:
		| {
				questions: Array<{
					id: string;
					text: string;
					source: {
						documentCanonicalId: CanonicalDocumentId;
						phaseId: PhaseId;
						documentTitle: string;
					};
				}>;
				sourceDocuments: CanonicalDocumentId[];
		  }
		| undefined;
	/** Validated structured extraction output from Step 4.2 (optional) */
	validatedExtractions?:
		| Array<{
				recordId: string;
				recordType: string;
				fields: Record<string, unknown>;
				confidence: 'low' | 'medium' | 'high' | 'advisory' | undefined;
				isProposed: boolean;
		  }>
		| undefined;
	/** Session id for traceability */
	sessionId: string | undefined;
	/** Provider operation metadata (safe subset) */
	providerMetadata?: ProposalExtractionMetadata | undefined;
	/** Deterministic proposal id factory */
	idFactory?: (() => string) | undefined;
	/** Deterministic clock */
	clock?: { now(): string } | undefined;
}

export interface ProposalMappingAnswer {
	answerId: string;
	questionId: string | undefined;
	questionText: string | undefined;
	answer: string;
}

export interface ProposalMappingResult {
	success: boolean;
	proposals: ReviewableProposal[];
	diagnostics: ProposalDiagnostic[];
	unmappableItems: ProposalDiagnostic[];
}

// ---------------------------------------------------------------------------
// Proposal lifecycle options / results
// ---------------------------------------------------------------------------

export interface AcceptProposalOptions {
	proposalId: ProposalId;
	projectRoot: string;
	dryRun?: boolean | undefined;
	clock?: { now(): string } | undefined;
	idFactory?: (() => string) | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface RejectProposalOptions {
	proposalId: ProposalId;
	projectRoot: string;
	reason?: string | undefined;
	dryRun?: boolean | undefined;
	clock?: { now(): string } | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface ReviseProposalOptions {
	proposalId: ProposalId;
	projectRoot: string;
	title: string;
	body: string;
	reason?: string | undefined;
	dryRun?: boolean | undefined;
	clock?: { now(): string } | undefined;
	idFactory?: (() => string) | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface ProposalLifecycleResult {
	success: boolean;
	proposalId: ProposalId;
	proposal: ReviewableProposal | undefined;
	changedPaths: string[];
	diagnostics: ProposalDiagnostic[];
	dryRun: boolean;
}

export type ProposalReviewAction = 'accept' | 'reject' | 'revise';
