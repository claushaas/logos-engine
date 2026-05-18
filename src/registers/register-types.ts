/** Step 8.2 — Register Types: typed contracts for decision, assumption, hypothesis, risk, and open question registers */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { ClaimId, SourceId } from '../provenance/provenance-types.js';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export type RegisterItemId = string & { __brand?: 'RegisterItemId' };

export type RegisterKind =
	| 'decision'
	| 'assumption'
	| 'hypothesis'
	| 'risk'
	| 'open_question';

export const REGISTER_KIND_ORDER: Record<RegisterKind, number> = {
	assumption: 1,
	decision: 0,
	hypothesis: 2,
	open_question: 4,
	risk: 3,
};

export const REGISTER_KINDS: readonly RegisterKind[] = [
	'decision',
	'assumption',
	'hypothesis',
	'risk',
	'open_question',
] as const;

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type RegisterSharedStatus =
	| 'proposed'
	| 'confirmed'
	| 'rejected'
	| 'superseded';

export type OpenQuestionStatus =
	| 'open'
	| 'resolved'
	| 'rejected'
	| 'superseded';

export type RiskStatus =
	| 'proposed'
	| 'accepted'
	| 'mitigated'
	| 'resolved'
	| 'rejected'
	| 'superseded';

export type HypothesisStatus =
	| 'proposed'
	| 'active'
	| 'validated'
	| 'invalidated'
	| 'inconclusive'
	| 'superseded';

export type DecisionStatus =
	| 'proposed'
	| 'confirmed'
	| 'rejected'
	| 'superseded';

export type AssumptionStatus =
	| 'proposed'
	| 'confirmed'
	| 'rejected'
	| 'superseded';

export type RegisterStatus =
	| DecisionStatus
	| AssumptionStatus
	| OpenQuestionStatus
	| RiskStatus
	| HypothesisStatus;

// ---------------------------------------------------------------------------
// Review State
// ---------------------------------------------------------------------------

export type RegisterReviewState =
	| 'not_required'
	| 'requires_review'
	| 'in_review'
	| 'approved'
	| 'rejected'
	| 'blocked';

export const REGISTER_REVIEW_STATES: readonly RegisterReviewState[] = [
	'not_required',
	'requires_review',
	'in_review',
	'approved',
	'rejected',
	'blocked',
] as const;

export const REGISTER_REVIEW_STATE_ORDER: Record<RegisterReviewState, number> =
	{
		approved: 3,
		blocked: 5,
		in_review: 2,
		not_required: 0,
		rejected: 4,
		requires_review: 1,
	};

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export type RegisterConfidence =
	| 'explicit'
	| 'derived'
	| 'inferred'
	| 'unknown';

export const REGISTER_CONFIDENCES: readonly RegisterConfidence[] = [
	'explicit',
	'derived',
	'inferred',
	'unknown',
] as const;

export const REGISTER_CONFIDENCE_ORDER: Record<RegisterConfidence, number> = {
	derived: 1,
	explicit: 0,
	inferred: 2,
	unknown: 3,
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type RegisterLifecycleEventType =
	| 'created'
	| 'proposed'
	| 'confirmed'
	| 'rejected'
	| 'revised'
	| 'superseded'
	| 'resolved'
	| 'reopened'
	| 'accepted'
	| 'mitigated'
	| 'activated'
	| 'validated'
	| 'invalidated'
	| 'inconclusive'
	| 'source_linked'
	| 'document_linked'
	| 'document_unlinked'
	| 'review_started'
	| 'review_approved'
	| 'review_rejected'
	| 'review_blocked';

export interface RegisterLifecycleEvent {
	eventId: string;
	registerItemId: RegisterItemId;
	eventType: RegisterLifecycleEventType;
	occurredAt: string;
	fromStatus?: RegisterStatus | undefined;
	toStatus?: RegisterStatus | undefined;
	fromReviewState?: RegisterReviewState | undefined;
	toReviewState?: RegisterReviewState | undefined;
	actor?: string | undefined;
	notes?: string | undefined;
	operationSource?: string | undefined;
	sessionId?: string | undefined;
	diagnostics?: RegisterOperationDiagnostic[] | undefined;
}

export interface RegisterLifecycleTransition {
	from: RegisterStatus;
	to: RegisterStatus;
	allowed: boolean;
	requiresReview?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Source and Affected Document Links
// ---------------------------------------------------------------------------

export interface RegisterSourceLink {
	sourceId: SourceId;
	sourceType?: string | undefined;
	label?: string | undefined;
	sessionId?: string | undefined;
	answerId?: string | undefined;
	proposalId?: string | undefined;
	claimId?: ClaimId | undefined;
	profileDescriptorRef?: string | undefined;
	documentDescriptorRef?: string | undefined;
	linkedAt: string;
}

export interface RegisterAffectedDocumentLink {
	documentCanonicalId: CanonicalDocumentId;
	phaseId?: PhaseId | undefined;
	graphNodeId?: string | undefined;
	linkedAt: string;
}

// ---------------------------------------------------------------------------
// Base Register Item
// ---------------------------------------------------------------------------

export interface RegisterItem {
	id: RegisterItemId;
	kind: RegisterKind;
	status: RegisterStatus;
	reviewState: RegisterReviewState;
	title: string;
	body?: string | undefined;
	details?: string | undefined;
	sourceLinks: RegisterSourceLink[];
	affectedDocumentLinks: RegisterAffectedDocumentLink[];
	confidence: RegisterConfidence;
	createdAt: string;
	updatedAt: string;
	resolvedAt?: string | undefined;
	decidedAt?: string | undefined;
	acceptedAt?: string | undefined;
	supersededAt?: string | undefined;
	lifecycleHistory: RegisterLifecycleEvent[];
	diagnostics: RegisterOperationDiagnostic[];
}

// ---------------------------------------------------------------------------
// Specialized Register Items
// ---------------------------------------------------------------------------

export interface DecisionRegisterItem extends RegisterItem {
	kind: 'decision';
	status: DecisionStatus;
	decisionStatement: string;
	rationale?: string | undefined;
	alternativesConsidered?: string[] | undefined;
	consequences?: string | undefined;
	supersedes?: RegisterItemId | undefined;
	supersededBy?: RegisterItemId | undefined;
}

export interface AssumptionRegisterItem extends RegisterItem {
	kind: 'assumption';
	status: AssumptionStatus;
	assumptionStatement: string;
	scope?: string | undefined;
	reviewDate?: string | undefined;
	reviewTrigger?: string | undefined;
	relatedRiskIds?: RegisterItemId[] | undefined;
	relatedHypothesisIds?: RegisterItemId[] | undefined;
	relatedOpenQuestionIds?: RegisterItemId[] | undefined;
}

export interface HypothesisRegisterItem extends RegisterItem {
	kind: 'hypothesis';
	status: HypothesisStatus;
	hypothesisStatement: string;
	expectedSignal?: string | undefined;
	validationMethod?: string | undefined;
	outcomeStatus?:
		| 'active'
		| 'validated'
		| 'invalidated'
		| 'inconclusive'
		| undefined;
	evidenceSourceIds?: SourceId[] | undefined;
	relatedAssumptionIds?: RegisterItemId[] | undefined;
	relatedRiskIds?: RegisterItemId[] | undefined;
}

export interface RiskRegisterItem extends RegisterItem {
	kind: 'risk';
	status: RiskStatus;
	riskStatement: string;
	likelihood?: 'low' | 'medium' | 'high' | 'critical' | undefined;
	impact?: 'low' | 'medium' | 'high' | 'critical' | undefined;
	mitigation?: string | undefined;
	owner?: string | undefined;
	acceptedRiskMarker?: boolean | undefined;
	relatedDecisionIds?: RegisterItemId[] | undefined;
	relatedAssumptionIds?: RegisterItemId[] | undefined;
	relatedHypothesisIds?: RegisterItemId[] | undefined;
	relatedOpenQuestionIds?: RegisterItemId[] | undefined;
}

export interface OpenQuestionRegisterItem extends RegisterItem {
	kind: 'open_question';
	status: OpenQuestionStatus;
	questionText: string;
	whyItMatters?: string | undefined;
	isBlocking: boolean;
	resolutionSummary?: string | undefined;
	resolvedByDecisionId?: RegisterItemId | undefined;
	resolvedByClaimId?: ClaimId | undefined;
	resolvedBySourceId?: SourceId | undefined;
}

export type AnyRegisterItem =
	| DecisionRegisterItem
	| AssumptionRegisterItem
	| HypothesisRegisterItem
	| RiskRegisterItem
	| OpenQuestionRegisterItem;

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export interface RegisterOperationInput {
	kind: RegisterKind;
	title: string;
	body?: string | undefined;
	status?: RegisterStatus | undefined;
	reviewState?: RegisterReviewState | undefined;
	confidence?: RegisterConfidence | undefined;
	sourceLinks?: RegisterSourceLink[] | undefined;
	affectedDocumentLinks?: RegisterAffectedDocumentLink[] | undefined;
	sessionId?: string | undefined;
	answerId?: string | undefined;
	proposalId?: string | undefined;
	// Decision-specific
	decisionStatement?: string | undefined;
	rationale?: string | undefined;
	alternativesConsidered?: string[] | undefined;
	consequences?: string | undefined;
	// Assumption-specific
	assumptionStatement?: string | undefined;
	scope?: string | undefined;
	reviewDate?: string | undefined;
	reviewTrigger?: string | undefined;
	// Hypothesis-specific
	hypothesisStatement?: string | undefined;
	expectedSignal?: string | undefined;
	validationMethod?: string | undefined;
	// Risk-specific
	riskStatement?: string | undefined;
	likelihood?: RiskRegisterItem['likelihood'] | undefined;
	impact?: RiskRegisterItem['impact'] | undefined;
	mitigation?: string | undefined;
	// Open question-specific
	questionText?: string | undefined;
	whyItMatters?: string | undefined;
	isBlocking?: boolean | undefined;
	resolutionSummary?: string | undefined;
	resolvedByDecisionId?: RegisterItemId | undefined;
	resolvedByClaimId?: ClaimId | undefined;
	resolvedBySourceId?: SourceId | undefined;
	// Operation control
	dryRun?: boolean | undefined;
	clock?: { now(): string } | undefined;
	idFactory?: (() => string) | undefined;
	notes?: string | undefined;
	actor?: string | undefined;
	reason?: string | undefined;
}

export interface RegisterOperationDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path?: string | undefined;
	pointer?: string | undefined;
	relatedRegisterKind?: RegisterKind | undefined;
	relatedRegisterItemId?: RegisterItemId | undefined;
	relatedSourceId?: string | undefined;
	relatedClaimId?: string | undefined;
	relatedDocumentId?: string | undefined;
	relatedPhaseId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}

export interface RegisterOperationResult {
	success: boolean;
	item: AnyRegisterItem | undefined;
	changedPaths: string[];
	diagnostics: RegisterOperationDiagnostic[];
	dryRun: boolean;
}

export interface RegisterOperationListResult {
	success: boolean;
	items: AnyRegisterItem[];
	diagnostics: RegisterOperationDiagnostic[];
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface RegisterQuery {
	kind?: RegisterKind | undefined;
	status?: RegisterStatus | undefined;
	reviewState?: RegisterReviewState | undefined;
	confidence?: RegisterConfidence | undefined;
	documentId?: CanonicalDocumentId | undefined;
	sourceId?: SourceId | undefined;
	itemId?: RegisterItemId | undefined;
}

export interface RegisterQueryResult {
	items: AnyRegisterItem[];
	diagnostics: RegisterOperationDiagnostic[];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface RegisterCountsByStatus {
	[key: string]: number;
}

export interface RegisterCountsByConfidence {
	[key: string]: number;
}

export interface RegisterCountsByReviewState {
	[key: string]: number;
}

export interface RegisterKindSummary {
	total: number;
	byStatus: RegisterCountsByStatus;
	byConfidence: RegisterCountsByConfidence;
	byReviewState: RegisterCountsByReviewState;
}

export interface RegisterSummary {
	totalByKind: Partial<Record<RegisterKind, number>>;
	byKind: Partial<Record<RegisterKind, RegisterKindSummary>>;
	blockingOpenQuestionCount: number;
	unresolvedOpenQuestionCount: number;
	acceptedRiskCount: number;
	activeHypothesisCount: number;
	reviewRequiredCount: number;
	missingSourceCount: number;
	affectedDocumentCount: number;
	updatedAfterLastGenerationCount?: number | undefined;
	diagnosticsSummary: RegisterOperationDiagnostic[];
}

export interface RegisterValidationSummary {
	registerFindingsCount: number;
	unresolvedBlockingQuestions: number;
	reviewRequiredItems: number;
	missingSourceItems: number;
	invalidStatusItems: number;
	diagnostics: RegisterOperationDiagnostic[];
}

export interface RegisterGenerationImpact {
	relevantDecisionCount: number;
	relevantAssumptionCount: number;
	relevantHypothesisCount: number;
	relevantRiskCount: number;
	relevantOpenQuestionCount: number;
	unresolvedBlockingQuestionCount: number;
	reviewRequiredInferredItemCount: number;
	affectedRegisterIds: RegisterItemId[];
	diagnostics: RegisterOperationDiagnostic[];
}

// Type alias for backward compat / summary
export type RegisterImpactSummary = RegisterGenerationImpact;

// ---------------------------------------------------------------------------
// Register Collection (workspace state integration)
// ---------------------------------------------------------------------------

export interface RegisterCollections {
	decisions: DecisionRegisterItem[];
	assumptions: AssumptionRegisterItem[];
	hypotheses: HypothesisRegisterItem[];
	risks: RiskRegisterItem[];
	openQuestions: OpenQuestionRegisterItem[];
	lifecycleEvents: RegisterLifecycleEvent[];
}

export const REGISTER_STATUS_ORDER: Record<string, number> = {
	accepted: 3,
	active: 1,
	confirmed: 0,
	inconclusive: 6,
	invalidated: 5,
	mitigated: 4,
	open: 10,
	proposed: 2,
	rejected: 8,
	resolved: 7,
	superseded: 9,
	validated: 1,
};

export const REGISTER_LIFECYCLE_EVENT_TYPE_ORDER: Record<
	RegisterLifecycleEventType,
	number
> = {
	accepted: 8,
	activated: 6,
	confirmed: 2,
	created: 0,
	document_linked: 14,
	document_unlinked: 15,
	inconclusive: 10,
	invalidated: 9,
	mitigated: 11,
	proposed: 1,
	rejected: 3,
	reopened: 13,
	resolved: 7,
	review_approved: 17,
	review_blocked: 19,
	review_rejected: 18,
	review_started: 16,
	revised: 4,
	source_linked: 12,
	superseded: 5,
	validated: 8,
};
