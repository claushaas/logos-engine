/** Intake module exports */

// Step 4.2 — Context Redaction
export {
	isSecretKey,
	isTokenLike,
	redactIntakeContext,
} from './context-redaction.js';
export type {
	ContextualSuggestion,
	ContextualSuggestionDiagnostic,
	ContextualSuggestionInput,
	ContextualSuggestionKind,
	ContextualSuggestionReason,
	ContextualSuggestionRenderOptions,
	ContextualSuggestionResult,
	ContextualSuggestionSource,
	ContextualSuggestionStatus,
} from './contextual-suggestion-types.js';
export { DEFAULT_SUGGESTION_RENDER_OPTIONS } from './contextual-suggestion-types.js';
// Step 4.4 — Contextual Suggestions
export {
	generateContextualSuggestions,
	resetSuggestionCounter,
} from './contextual-suggestions.js';
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
export type { BuildAiStartupBriefingOptions } from './startup-briefing.js';
// Step 4.4 — Startup Briefing
export {
	buildAiStartupBriefing,
	buildDeterministicStartupBriefing,
} from './startup-briefing.js';
export { renderStartupBriefing } from './startup-briefing-renderer.js';
export type {
	StartupBriefing,
	StartupBriefingAction,
	StartupBriefingDiagnostic,
	StartupBriefingFallbackReason,
	StartupBriefingInput,
	StartupBriefingMode,
	StartupBriefingRenderOptions,
	StartupBriefingResult,
	StartupBriefingSection,
	StartupBriefingSource,
	StartupBriefingStatus,
} from './startup-briefing-types.js';
export { DEFAULT_RENDER_OPTIONS as DEFAULT_BRIEFING_RENDER_OPTIONS } from './startup-briefing-types.js';
export { renderContextualSuggestions } from './suggestion-renderer.js';
