/** Intake module exports */

// Step 4.2 — Context Redaction
export {
	isSecretKey,
	isTokenLike,
	redactIntakeContext,
} from './context-redaction.js';
// Step 4.2 — Intake Context Builder
export { buildIntakeContext } from './intake-context-builder.js';
export type {
	IntakeContext,
	IntakeContextAssumption,
	IntakeContextBuilderInput,
	IntakeContextBuilderOptions,
	IntakeContextDecision,
	IntakeContextDiagnostic,
	IntakeContextDocumentReference,
	IntakeContextOpenQuestion,
	IntakeContextProfileReference,
	IntakeContextRedactionResult,
	IntakeContextRelevantAnswer,
	IntakeContextRisk,
	IntakeContextScope,
	IntakeContextSection,
	IntakeContextValidationGap,
} from './intake-context-types.js';
export { DEFAULT_BUILDER_OPTIONS } from './intake-context-types.js';
export {
	acceptProposal,
	rejectProposal,
	reviseProposal,
} from './proposal-lifecycle.js';
// Step 4.3 — Proposal Mapping, Lifecycle, Repository
export { mapAnswersToProposals } from './proposal-mapper.js';
export type {
	CreateProposalOptions,
	CreateProposalResult,
	GetProposalOptions,
	GetProposalResult,
	ListProposalsOptions,
	ListProposalsResult,
	UpdateProposalStatusOptions,
	UpdateProposalStatusResult,
} from './proposal-repository.js';
export {
	createProposal,
	createProposals,
	getProposal,
	listProposals,
	listProposalsFromState,
	updateProposalStatus,
} from './proposal-repository.js';
export type {
	AcceptProposalOptions,
	ProposalDiagnostic,
	ProposalDocumentContentHint,
	ProposalEvidence,
	ProposalExtractionMetadata,
	ProposalHypothesis,
	ProposalId,
	ProposalKind,
	ProposalLifecycleResult,
	ProposalMappingAnswer,
	ProposalMappingInput,
	ProposalMappingResult,
	ProposalReviewAction,
	ProposalRevision,
	ProposalRisk as ProposalRiskType,
	ProposalSource,
	ProposalStatus,
	RejectProposalOptions,
	ReviewableProposal,
	ReviseProposalOptions,
} from './proposal-types.js';
export type {
	BuildConversationRequestOptions,
	BuildStructuredExtractionRequestOptions,
	BuildSuggestionRequestOptions,
} from './provider-request-builders.js';
// Step 4.2 — Provider Request Builders
export {
	buildConversationRequest,
	buildStartupBriefingRequest,
	buildStructuredExtractionRequest,
	buildSuggestionRequest,
} from './provider-request-builders.js';
export {
	collectQuestionCandidates,
	planNextQuestions,
} from './question-planner.js';
export type {
	PlannedQuestion,
	QuestionBlockingLevel,
	QuestionCandidate,
	QuestionCluster,
	QuestionDuplicateKey,
	QuestionGap,
	QuestionPlanningDiagnostic,
	QuestionPlanningInput,
	QuestionPlanningOptions,
	QuestionPlanningResult,
	QuestionPlanReason,
	QuestionPlanStatus,
	QuestionPriority,
	QuestionSource,
} from './question-planner-types.js';
