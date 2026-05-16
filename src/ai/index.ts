/** AI module exports */

export type { FakeProviderOptions } from './fake-provider.js';

// Fake provider
export { FakeProvider } from './fake-provider.js';
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
// Provider response validation
export {
	assertAllRecordsProposed,
	validateConversationResponse,
	validateProviderResponse,
	validateStartupBriefingResponse,
	validateStructuredExtractionResponse,
	validateSuggestionResponse,
} from './provider-responses.js';
