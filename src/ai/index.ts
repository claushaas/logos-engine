/** AI module exports */

export type { FakeProviderOptions } from './fake-provider.js';
// Fake provider
export { FakeProvider } from './fake-provider.js';
export type {
	AiProviderConfig,
	AiProviderDisclosureContextCategory,
	AiProviderDisclosureState,
	AiProviderMode,
	AiProviderTestSummary,
} from './provider-config-model.js';
// Provider config model
export {
	AI_PROVIDER_DISCLOSURE_CONTEXT_CATEGORIES,
	AI_PROVIDER_DISCLOSURE_VERSION,
	AI_PROVIDER_MODES,
	DEFAULT_AI_PROVIDER_TIMEOUT_MS,
	defaultAiProviderConfig,
	defaultAiProviderDisclosureState,
	endpointOrigin,
	formatAiProviderStatusText,
	isValidAiProviderMode,
	isValidEndpoint,
	isValidTokenEnvVarName,
	looksLikeRawSecret,
	MAX_AI_PROVIDER_TIMEOUT_MS,
	normalizeAiProviderConfig,
	redactEndpointUrl,
	redactProviderConfigForDisplay,
	redactSecretValue,
	validateTimeout,
} from './provider-config-model.js';
export type {
	AiProviderConfigResult,
	AiProviderConfigServiceOptions,
	DisclosurePreview,
} from './provider-config-service.js';
// Provider config service
export {
	acceptAiProviderDisclosure,
	declineAiProviderDisclosure,
	disableAiProvider,
	getAiProviderStatus,
	getDisclosurePreview,
	resetAiProviderConfig,
	setAiProvider,
	setAiProviderEndpoint,
	setAiProviderMode,
	setAiProviderModel,
	setAiProviderTimeout,
	setAiProviderTokenEnvVar,
	storeAiProviderTestResult,
	testAiProvider,
} from './provider-config-service.js';
export type {
	DisclosureContextCategory,
	DisclosureGuardOptions,
	DisclosureGuardResult,
	ProviderConsentRecord,
} from './provider-disclosure.js';
// Disclosure guard
export {
	assertDisclosureConsent,
	checkProviderDisclosure,
	DISCLOSURE_CONTEXT_CATEGORIES,
} from './provider-disclosure.js';
export type {
	AiProviderExecutionPolicyResult,
	TimeoutExecutionOptions,
	TimeoutExecutionResult,
} from './provider-execution-policy.js';
// Provider execution policy
export {
	evaluateAiProviderExecutionPolicy,
	executeWithTimeout,
	getBlockedAiRecoveryHint,
	isAiProviderExecutionBlocked,
} from './provider-execution-policy.js';
// Provider port types
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
	StartupBriefingItem,
	StartupBriefingRequest,
	StartupBriefingResponse,
	StructuredExtractionRecord,
	StructuredExtractionRequest,
	StructuredExtractionResponse,
	SuggestionItem,
	SuggestionRequest,
	SuggestionResponse,
} from './provider-port.js';
export type { ProviderRegistryEntry } from './provider-registry.js';
// Provider registry
export {
	formatProviderListForDisplay,
	getProviderEntry,
	isKnownProvider,
	listProviderIds,
	listProvidersByMode,
	PROVIDER_REGISTRY,
} from './provider-registry.js';
// Provider response validation
export {
	assertAllRecordsProposed,
	validateConversationResponse,
	validateProviderResponse,
	validateStartupBriefingResponse,
	validateStructuredExtractionResponse,
	validateSuggestionResponse,
} from './provider-responses.js';
export type { ProviderTestOptions } from './provider-test.js';
// Provider connectivity test
export { formatTestSummary, runProviderTest } from './provider-test.js';
