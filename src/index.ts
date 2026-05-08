export {
	type AiOperationId,
	type AiOperationOutput,
	AiResponseValidationError,
	aiOperationIds,
	aiOperationOutputSchemas,
	aiOperationRegistry,
	getAiOperationMetadata,
	validateAiOperationOutput,
} from './ai/ai-operations.js';
export {
	createFixtureResponseProvider,
	type FixtureResponse,
	type FixtureResponseMap,
} from './ai/fixture-provider.js';
export {
	createAnthropicCompatibleProvider,
	createOllamaProvider,
	createOpenAiCompatibleProvider,
} from './ai/http-adapters.js';
export {
	type LlmMessage,
	type LlmProvider,
	LlmProviderError,
	type LlmProviderFactory,
	type LlmProviderMetadata,
	type LlmRequest,
	type LlmResponse,
	llmMessageSchema,
	llmRequestSchema,
	llmResponseSchema,
	runAiOperation,
} from './ai/llm-provider.js';
export { createMockLlmProvider } from './ai/mock-provider.js';
export {
	type BuildPromptInput,
	type BuiltPrompt,
	buildPromptForAiOperation,
	createAiOperationOutputJsonSchema,
	createPromptContract,
	createStructuredOutputInstructions,
	type PromptContract,
	promptBuilderVersion,
} from './ai/prompt-builder.js';
export {
	type BuildPromptContextInput,
	buildPromptContext,
	type ContextSelectionRule,
	contextSelectionRules,
	estimatePromptContextCharacters,
	groupPromptContextItems,
	type PromptContextBundle,
	type PromptContextCategory,
	type PromptContextDisclosure,
	PromptContextError,
	type PromptContextItem,
	promptContextCategories,
	promptContextVersion,
	serializeContext,
} from './ai/prompt-context.js';
export {
	type AiProviderConfig,
	aiProviderConfigSchema,
	assertConfigDoesNotContainRawToken,
	defaultAiProviderConfig,
	getGlobalAiDefaultsPath,
	getProviderPreset,
	type ProviderAdapterId,
	type ProviderCapability,
	ProviderConfigurationError,
	type ProviderPreset,
	type ProviderPresetId,
	type ProviderTransmission,
	providerAdapterIds,
	providerPresetIds,
	providerPresetRegistry,
	type ResolvedToken,
	redactAiProviderConfig,
	redactSecret,
	resolveProviderConfigDefaults,
	resolveTokenFromEnvironment,
	type TokenSource,
	tokenSourceSchema,
} from './ai/provider-config.js';
export {
	type AiConfigCommandResult,
	disableAiConfiguration,
	showAiConfiguration,
	testAiConfiguration,
	updateAiConfiguration,
} from './application/ai-configuration.js';
export {
	changeConfirmedDecision,
	createEmptyStore,
	createManualDecision,
	type DecisionChangeResult,
	DecisionServiceError,
	deprecateDecision,
	getPendingProposals,
	loadDecisionStore,
	type ProposalReviewResult,
	receiveAiDecisionProposals,
	reviewProposedDecision,
	saveDecisionStore,
} from './application/decision-service.js';
export {
	type DiagnosticsCommandOptions,
	type DiagnosticsCommandResult,
	diagnoseWorkspace,
	formatDiagnosticsResult,
} from './application/diagnostics-service.js';
export {
	type GenerateOptions,
	generateDocuments,
	generateDocumentsForCwd,
} from './application/document-generation.js';
export { continueGuidedIntake } from './application/guided-intake.js';
export {
	type ApplicationCommandResult,
	type ApplicationServiceContext,
	createLogosApplicationServices,
	type LogosApplicationServices,
} from './application/logos-application-service.js';
export {
	initializeWorkspace,
	type WorkspaceInitializationResult,
} from './application/workspace-initialization.js';
export { type ExitCode, exitCodes } from './cli/exit-codes.js';
export { createCliProgram, runCli } from './cli/run-cli.js';
export {
	type CommandContext,
	loadCommandContext,
} from './commands/command-context.js';
export {
	getSlashCommandCompletions,
	type SlashCommandCompletion,
} from './commands/slash-command-autocomplete.js';
export {
	handleSlashCommand,
	type SlashCommandHandlerResult,
} from './commands/slash-command-handlers.js';
export {
	isKnownSlashCommand,
	type ParsedSlashCommand,
	parseSlashCommand,
	type SlashCommandParseError,
	type SlashCommandParseResult,
} from './commands/slash-command-parser.js';
export {
	getSlashCommandDefinition,
	type SlashCommandDefinition,
	type SlashCommandId,
	slashCommandDefinitions,
} from './commands/slash-command-registry.js';
export {
	type AiDiagnosticContribution,
	buildDiagnosticsContext,
	convertValidationFindingToDiagnostic,
	createEmptyDiagnosticsResult,
	type DiagnosticCategory,
	type DiagnosticFinding,
	type DiagnosticSource,
	type DiagnosticsContext,
	type DiagnosticsOptions,
	type DiagnosticsResult,
	runDeterministicDiagnostics,
	runDiagnostics,
} from './diagnostics/diagnostics-engine.js';
export {
	buildTemplateContext,
	collectMissingInputs,
	collectMissingRequiredSections,
	DocumentRenderError,
	generateDocumentContent,
	renderDocument,
	renderDocuments,
} from './document-renderer/document-renderer.js';
export {
	type DocumentFrontmatter,
	generateFrontmatter,
	parseFrontmatter,
} from './document-renderer/frontmatter.js';
export {
	extractManualSections,
	type ManualSection,
	mergeManualSections,
	wrapManualSection,
} from './document-renderer/manual-notes.js';
export {
	createRenderSummary,
	type DocumentRenderResult,
	type DocumentRenderStatus,
	formatRenderSummary,
	type RenderSummary,
} from './document-renderer/render-result.js';
export {
	generateDefaultTemplate,
	loadTemplate,
	renderSection,
	renderTemplate,
	resolveTemplatePath,
	type TemplateContext,
	TemplateRenderError,
} from './document-renderer/template-renderer.js';
export {
	assertValidStatusTransition,
	confirmDecision,
	createDecision,
	createDecisionFromProposal,
	createEmptyDecisionStore,
	type Decision,
	type DecisionChange,
	type DecisionConfidence,
	type DecisionProposal,
	DecisionRegistryError,
	DecisionStore,
	decisionChangeSchema,
	decisionConfidenceLevels,
	decisionProposalSchema,
	decisionSchema,
	getAffectedDocumentsOnChange,
	getConfirmedDecisions,
	getDecisionById,
	getDecisionsByStatus,
	getDownstreamImpacts,
	getProposedDecisions,
	InvalidStatusTransitionError,
	isValidStatusTransition,
	rejectDecision,
	removeDecision,
	transitionDecisionStatus,
	updateDecisionValue,
	upsertDecision,
} from './domain/decision-registry.js';
export {
	type CanonicalDocument,
	createProfileVersionLock,
	type DependencyMapping,
	getDefaultProfileDirectory,
	getDefaultProfilesDirectory,
	loadAvailableProfileContracts,
	loadProfileById,
	loadProfileContract,
	loadProfileContracts,
	type ProfileContract,
	type ProfilePhase,
	ProfileValidationError,
	type ProfileVersionLock,
	type PromptContextRequirement,
	type Question,
	type QuestionOption,
	type QuestionSet,
	type QuestionSetFile,
	questionOptionSchema,
	questionSchema,
	questionSetFileSchema,
	questionSetSchema,
	type RiskPattern,
	type ValidationRule,
} from './domain/profile-loader.js';
export {
	type AnswerRecord,
	type AnswerStatus,
	type Assumption,
	answerRecordSchema,
	answerStatuses,
	assumptionSchema,
	createAnswerRecord,
	createIntakeSession,
	deriveAssumptions,
	deriveOpenQuestions,
	generateProposedFollowUpQuestions,
	getQuestionById,
	type IntakeSession,
	intakeSessionSchema,
	intakeSessionStatuses,
	type OpenQuestion,
	openQuestionSchema,
	type ProposedFollowUpQuestion,
	parseAnswerValue,
	proposedFollowUpQuestionSchema,
	type ResolvedQuestion,
	recommendNextQuestionGroup,
	saveIntakeSession,
	selectNextQuestionGroup,
	summarizeIntakeAnswer,
	upsertAnswer,
} from './domain/question-engine.js';
export {
	type AnswersState,
	answersStateSchema,
	type ConfigState,
	configStateSchema,
	type DecisionsState,
	type DiagnosticsState,
	decisionsStateSchema,
	diagnosticsStateSchema,
	type ProfileLockState,
	type ProjectState,
	profileLockStateSchema,
	projectStateSchema,
	readWorkspaceState,
	type WorkspaceState,
	WorkspaceStateReadError,
	workspaceSchemaVersion,
} from './domain/workspace-state.js';
export {
	type AiOutputStatus,
	aiOutputStatuses,
	type DecisionStatus,
	decisionStatuses,
	type RenderMode,
	renderModes,
	statusContracts,
	type ValidationSeverity,
	validationSeverities,
} from './foundation/status-contracts.js';
export { defaultTestPolicy } from './foundation/test-policy.js';
export {
	createEmptyAnswersState,
	createEmptyDecisionsState,
	getCurrentSessionPath,
	IntakeStateError,
	readAnswersState,
	readCurrentIntakeSession,
	readDecisionsState,
	writeAnswersState,
	writeCurrentIntakeSession,
	writeDecisionsState,
} from './storage/intake-state.js';
export { detectProjectRoot } from './storage/project-root.js';
export {
	atomicReplaceJsonFile,
	atomicWriteJsonFile,
	ensureDirectory,
	SafeWriteError,
	safeWriteTextFile,
} from './storage/safe-file-writes.js';
export {
	evaluateCondition,
	evaluateRiskPattern,
	evaluateValidationRule,
	runValidation,
	type ValidationCondition,
	type ValidationContext,
	type ValidationFinding,
	type ValidationResult,
} from './validation/validation-engine.js';
