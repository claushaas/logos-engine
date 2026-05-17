/** Logo Engine — package metadata and scaffold types */

export const PACKAGE_NAME = 'logos-engine';
export const PACKAGE_VERSION = '0.1.0';
export const LOGOS_BINARY_NAME = 'logos';

export type LogosRuntimeMode = 'cli' | 'tui' | 'api';

export interface LogosPackageMetadata {
	name: string;
	version: string;
	binaryName: string;
}

export function getPackageMetadata(): LogosPackageMetadata {
	return {
		binaryName: LOGOS_BINARY_NAME,
		name: PACKAGE_NAME,
		version: PACKAGE_VERSION,
	};
}

// Step 4.2 — AI Provider Port
export type {
	AiProviderCapabilities,
	AiProviderConsent,
	AiProviderDiagnostic,
	AiProviderDisclosure,
	AiProviderExecutionMode,
	AiProviderId,
	AiProviderKind,
	AiProviderOperation,
	AiProviderPort,
	AiProviderRequest,
	AiProviderResponse,
	AiProviderResponseValidationResult,
	ConversationMessage,
	ConversationOperationRequest,
	ConversationOperationResponse,
	DisclosureContextCategory,
	DisclosureGuardOptions,
	DisclosureGuardResult,
	FakeProviderOptions,
	ProviderConsentRecord,
	StartupBriefingItem,
	StartupBriefingRequest,
	StartupBriefingResponse,
	StructuredExtractionRecord,
	StructuredExtractionRequest,
	StructuredExtractionResponse,
	SuggestionItem,
	SuggestionRequest,
	SuggestionResponse,
} from './ai/index.js';
export {
	assertAllRecordsProposed,
	assertDisclosureConsent,
	checkProviderDisclosure,
	DISCLOSURE_CONTEXT_CATEGORIES,
	FakeProvider,
	validateConversationResponse,
	validateProviderResponse,
	validateStartupBriefingResponse,
	validateStructuredExtractionResponse,
	validateSuggestionResponse,
} from './ai/index.js';
// Step 3.2 — Safe Filesystem Writes
export type {
	AtomicJsonWriteOptions,
	BackupOptions,
	BackupResult,
	DryRunWritePlan,
	PathSafetyOptions,
	SafeFsAdapter,
	SafeWriteChangedPath,
	SafeWriteChangedPathRole,
	SafeWriteDiagnostic,
	SafeWriteOptions,
	SafeWritePolicy,
	SafeWriteResult,
} from './fs/safe-filesystem.js';
export {
	checkPathSafety,
	createBackup,
	resolveWritePolicy,
	serializeJson,
	writeFileAtomic,
	writeJsonAtomic,
} from './fs/safe-filesystem.js';
// Step 3.3 — Init Workspace Creation
export type {
	InitWorkspaceChangedPath,
	InitWorkspaceCollision,
	InitWorkspaceCollisionKind,
	InitWorkspaceDiagnostic,
	InitWorkspaceDocumentationRootSelection,
	InitWorkspaceMode,
	InitWorkspaceOptions,
	InitWorkspacePlan,
	InitWorkspacePreflightResult,
	InitWorkspaceProfileSelection,
	InitWorkspaceResult,
	InitWorkspaceTargetPaths,
} from './init/index.js';
export {
	initWorkspace,
	planInitWorkspace,
	preflightInit,
} from './init/index.js';
// Step 4.1 — Question Planning from Profile Contracts
// Step 4.2 — Intake Context Builder, Redaction, and Provider Request Builders
// Step 4.3 — Proposal Mapping, Lifecycle, and Repository
// Step 4.4 — Startup Briefing and Contextual Suggestions
export type {
	AcceptProposalOptions,
	BuildAiStartupBriefingOptions,
	BuildConversationRequestOptions,
	BuildStructuredExtractionRequestOptions,
	BuildSuggestionRequestOptions,
	ContextualSuggestion,
	ContextualSuggestionDiagnostic,
	ContextualSuggestionInput,
	ContextualSuggestionKind,
	ContextualSuggestionReason,
	ContextualSuggestionRenderOptions,
	ContextualSuggestionResult,
	ContextualSuggestionSource,
	ContextualSuggestionStatus,
	CreateProposalOptions,
	CreateProposalResult,
	GetProposalOptions,
	GetProposalResult,
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
	ListProposalsOptions,
	ListProposalsResult,
	PlannedQuestion,
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
	ProposalRiskType,
	ProposalSource,
	ProposalStatus,
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
	RejectProposalOptions,
	ReviewableProposal,
	ReviseProposalOptions,
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
	UpdateProposalStatusOptions,
	UpdateProposalStatusResult,
} from './intake/index.js';
export {
	acceptProposal,
	buildAiStartupBriefing,
	buildConversationRequest,
	buildDeterministicStartupBriefing,
	buildIntakeContext,
	buildStartupBriefingRequest,
	buildStructuredExtractionRequest,
	buildSuggestionRequest,
	collectQuestionCandidates,
	createProposal,
	createProposals,
	DEFAULT_BRIEFING_RENDER_OPTIONS,
	DEFAULT_BUILDER_OPTIONS,
	DEFAULT_SUGGESTION_RENDER_OPTIONS,
	generateContextualSuggestions,
	getProposal,
	isSecretKey,
	isTokenLike,
	listProposals,
	listProposalsFromState,
	mapAnswersToProposals,
	planNextQuestions,
	redactIntakeContext,
	rejectProposal,
	renderContextualSuggestions,
	renderStartupBriefing,
	resetSuggestionCounter,
	reviseProposal,
	updateProposalStatus,
} from './intake/index.js';
export type {
	AgentPackOutputDeclaration,
	ArtifactOutputDeclaration,
	BuildContractGraphOptions,
	BuildContractGraphResult,
	CanonicalOutputDeclaration,
	ContractGraph,
	ContractGraphDiagnostic,
	ContractGraphEdge,
	ContractGraphNode,
	DataOutputDeclaration,
	DependencyReference,
	DependencyReferenceKind,
	DependencyTargetKind,
	ExecutiveOutputDeclaration,
	OutputDeclaration,
	OutputDeclarationKind,
	OutputDeclarationRole,
	StatusTransition,
	StatusTransitionResult,
	StatusValue,
	StatusWorkflow,
} from './profiles/contract-graph.js';
export {
	buildContractGraph,
	buildStatusWorkflow,
	ContractGraphError,
	canTransitionStatus,
} from './profiles/contract-graph.js';
export type {
	DocumentDescriptor,
	DocumentDescriptorDependency,
	DocumentDescriptorId,
	DocumentDescriptorOutput,
	DocumentDescriptorOutputAgentPack,
	DocumentDescriptorOutputArtifact,
	DocumentDescriptorOutputCanonical,
	DocumentDescriptorOutputData,
	DocumentDescriptorOutputExecutive,
	DocumentDescriptorSection,
	DocumentDescriptorStatus,
	DocumentDescriptorValidationError,
	DocumentDescriptorValidationOptions,
	DocumentDescriptorValidationResult,
	DocumentSchema,
	LoadAndValidateDocumentDescriptorOptions,
	SchemaFieldDef,
} from './profiles/document-descriptor.js';
export {
	DocumentDescriptorValidationErrorClass,
	loadAndValidateDocumentDescriptor,
	loadDocumentSchema,
	setDocumentSchemaForValidation,
	validateDocumentDescriptor,
} from './profiles/document-descriptor.js';
export type {
	CanonicalDocumentId,
	DocumentationContract,
	DocumentationContractDiagnostic,
	DocumentationContractIndexEntry,
	DocumentationContractPaths,
	DocumentDescriptorPath,
	LoadDocumentationContractOptions,
	LoadedDocumentDescriptor,
	LoadedPhaseDescriptor,
	PhaseDocumentRef,
	PhaseId,
} from './profiles/documentation-contract.js';
export {
	DocumentationContractError,
	listDocumentationContractIndex,
	loadDocumentationContract,
	relativizeIndexPaths,
} from './profiles/documentation-contract.js';
export type {
	LoadProfileRegistryOptions,
	ProfileAgentPolicy,
	ProfileAxis,
	ProfileDependencyPolicy,
	ProfileGlobalRules,
	ProfileId,
	ProfileOutputModel,
	ProfileOutputModelEntry,
	ProfilePhaseRegistry,
	ProfilePhaseRegistryEntry,
	ProfileQualityModel,
	ProfileRegistry,
	ProfileRegistryDiagnostic,
	ProfileRegistryPaths,
	ProfileRoadmapIntegration,
	ProfileStatusWorkflow,
} from './profiles/profile-registry.js';
export {
	loadProfileRegistry,
	ProfileRegistryError,
	validateProfileRegistry,
} from './profiles/profile-registry.js';
// Step 2.4 — Error, Logging, Dry-Run, and JSON Result Conventions
export type {
	CommandChangedPath,
	CommandError,
	CommandExecutionMode,
	CommandMessage,
	CommandResult,
	CommandResultMetadata,
	CommandStatus,
	CommandWarning,
	CreateCommandResultOptions,
	JsonSerializableCommandResult,
	LoggerOptions,
	LogLevel,
	LogSink,
	MemoryLogSink,
	RedactionOptionsType,
	StructuredError,
	StructuredErrorOptions,
} from './runtime/index.js';
export {
	ConsoleLogSink,
	createCommandResult,
	createStructuredError,
	defaultLogger,
	formatCommandResultForHuman,
	formatStructuredError,
	formatStructuredErrors,
	Logger,
	redactAndRelativize,
	redactString,
	redactValue,
	relativizePaths,
	statusToExitCode,
	toCommandError,
	toJsonSerializable,
} from './runtime/index.js';
export type {
	DetectProjectContextOptions,
	DocumentationRootConfig,
	ProjectContext,
	ProjectContextDiagnostic,
	ProjectContextError,
	ProjectRootDetectionResult,
	ProjectRootKind,
	ProviderConfigStatus,
	WorkspaceConfigDetectionResult,
	WorkspaceDetectionResult,
	WorkspaceInitializationState,
} from './runtime/project-context.js';
export {
	detectProjectContext,
	detectProjectRoot,
	detectWorkspace,
	detectWorkspaceConfig,
	formatInitializationState,
	formatProjectContextLines,
	formatProviderStatus,
} from './runtime/project-context.js';
// Step 3.4 — Artifact Registry
export type {
	ArtifactRegistryEntryInput,
	ArtifactSummary,
	ListArtifactsOptions,
	RegisterArtifactOptions,
	UpdateArtifactRecordOptions,
} from './state/artifact-registry.js';
export {
	isArtifactCanonical,
	listArtifacts,
	registerArtifact,
	summarizeArtifacts,
	updateArtifactRecord,
} from './state/artifact-registry.js';
// Step 3.4 — Run Repository
export type {
	CreateRunRecordOptions,
	ListRunRecordsOptions,
	RunRecordInput,
	RunSummary,
	UpdateRunRecordOptions,
} from './state/run-repository.js';
export {
	createRunRecord,
	listRunRecords,
	summarizeRuns,
	updateRunRecord,
} from './state/run-repository.js';
// Step 3.4 — Session Repository
export type {
	CreateSessionRecordOptions,
	ListSessionRecordsOptions,
	SessionRecordInput,
	SessionSummary,
	UpdateSessionRecordOptions,
} from './state/session-repository.js';
export {
	createSessionRecord,
	getCurrentSessionSummary,
	listSessionRecords,
	updateSessionRecord,
} from './state/session-repository.js';
// Step 3.1 — Workspace State Schemas
export type {
	WorkspaceArtifact,
	WorkspaceAssumption,
	WorkspaceAuditEvent,
	WorkspaceDecision,
	WorkspaceDocumentationRootConfig,
	WorkspaceGenerationRun,
	WorkspaceMigrationRecord,
	WorkspaceOpenQuestion,
	WorkspaceProfileLock,
	WorkspaceProposal,
	WorkspaceProviderConfigReference,
	WorkspaceRisk,
	WorkspaceSession,
	WorkspaceState,
	WorkspaceValidationRun,
} from './state/workspace-state.schema.js';
export {
	ArtifactStatusSchema,
	ArtifactTypeSchema,
	AssumptionStatusSchema,
	DecisionStatusSchema,
	DocumentationRootConfigSchema,
	GenerationRunStatusSchema,
	MigrationStatusSchema,
	OpenQuestionStatusSchema,
	ProfileSourceSchema,
	ProposalKindSchema,
	ProposalStatusSchema,
	RiskSeveritySchema,
	RiskStatusSchema,
	SessionStatusSchema,
	SessionTypeSchema,
	TokenSourceSchema,
	ValidationRunStatusSchema,
	WORKSPACE_STATE_SCHEMA_VERSION,
	WorkspaceArtifactSchema,
	WorkspaceAssumptionSchema,
	WorkspaceAuditEventSchema,
	WorkspaceDecisionSchema,
	WorkspaceGenerationRunSchema,
	WorkspaceMetadataSchema,
	WorkspaceMigrationRecordSchema,
	WorkspaceOpenQuestionSchema,
	WorkspaceProfileLockSchema,
	WorkspaceProposalSchema,
	WorkspaceProviderConfigReferenceSchema,
	WorkspaceRiskSchema,
	WorkspaceSessionSchema,
	WorkspaceStateSchema,
	WorkspaceValidationRunSchema,
} from './state/workspace-state.schema.js';
export type { CreateDefaultWorkspaceStateOptions } from './state/workspace-state-defaults.js';
export { createDefaultWorkspaceState } from './state/workspace-state-defaults.js';
// Step 3.4 — Workspace State Repository
export type {
	Clock,
	WorkspaceStateReadOptions,
	WorkspaceStateReadResult,
	WorkspaceStateRepositoryDiagnostic,
	WorkspaceStateUpdateOptions,
	WorkspaceStateUpdateResult,
	WorkspaceStateWriteOptions,
	WorkspaceStateWriteResult,
} from './state/workspace-state-repository.js';
export {
	readWorkspaceState,
	requireWorkspaceState,
	updateWorkspaceState,
	writeWorkspaceState,
} from './state/workspace-state-repository.js';
export type {
	WorkspaceStateValidationError,
	WorkspaceStateValidationResult,
} from './state/workspace-state-validation.js';
export {
	isLikelyRawSecret,
	parseWorkspaceState,
	redactSecretValue,
	safeParseWorkspaceState,
	validateWorkspaceState,
} from './state/workspace-state-validation.js';
// Step 3.4 — Workspace Status
export type {
	WorkspaceStatusQueryOptions,
	WorkspaceStatusSummary,
} from './state/workspace-status.js';
export { getWorkspaceStatusSummary } from './state/workspace-status.js';

// ---------------------------------------------------------------------------
// Step 5.1 — Generation Planner
// ---------------------------------------------------------------------------

export type {
	DependencySatisfaction,
	GenerationAction,
	GenerationBlocker,
	GenerationDependencyState,
	GenerationDryRunSummary,
	GenerationGap,
	GenerationOutputTarget,
	GenerationPlan,
	GenerationPlanDiagnostic,
	GenerationPlanInput,
	GenerationPlanItem,
	GenerationPlanOptions,
	GenerationPlanResult,
	GenerationPlanSummaryCounts,
	GenerationReadiness,
	GenerationStalenessReason,
} from './generation/index.js';
export {
	createGenerationPlan,
	planDocumentGeneration,
	summarizeGenerationPlan,
} from './generation/index.js';

// ---------------------------------------------------------------------------
// Step 5.2 — Canonical Markdown Renderer
// ---------------------------------------------------------------------------

export type {
	CanonicalMarkdownDocument,
	CanonicalMarkdownRenderDiagnostic,
	CanonicalMarkdownRenderInput,
	CanonicalMarkdownRenderOptions,
	CanonicalMarkdownRenderResult,
	ConfirmedStateCollections,
	MarkdownGapMarker,
	MarkdownLanguagePolicy,
	MarkdownMetadataHeader,
	MarkdownQualityNote,
	MarkdownSectionRenderStatus,
	MarkdownSourceReference,
	MarkdownTraceabilityReference,
	RenderedMarkdownSection,
	RenderFromPlanInput,
	SectionRenderContext,
} from './generation/index.js';
export {
	renderCanonicalMarkdownDocument,
	renderCanonicalMarkdownFromPlan,
} from './generation/index.js';
