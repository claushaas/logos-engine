/** AI Provider Port — typed contracts for AI-assisted intake operations */

// ---------------------------------------------------------------------------
// Provider identity
// ---------------------------------------------------------------------------

export type AiProviderId = string;

export type AiProviderKind = 'local' | 'remote' | 'fake';

export type AiProviderOperation =
	| 'conversation'
	| 'structured_extraction'
	| 'suggestion'
	| 'startup_briefing';

export type AiProviderExecutionMode = 'inline' | 'async' | 'dry_run';

// ---------------------------------------------------------------------------
// Provider capabilities
// ---------------------------------------------------------------------------

export interface AiProviderCapabilities {
	supportsConversation: boolean;
	supportsStructuredExtraction: boolean;
	supportsSuggestion: boolean;
	supportsStartupBriefing: boolean;
	estimatedMaxContextTokens: number | undefined;
	estimatedMaxResponseTokens: number | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface AiProviderDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Request envelope
// ---------------------------------------------------------------------------

export interface AiProviderRequest {
	operation: AiProviderOperation;
	providerId: AiProviderId | undefined;
	providerKind: AiProviderKind;
	executionMode: AiProviderExecutionMode;
}

// ---------------------------------------------------------------------------
// Operation-specific requests
// ---------------------------------------------------------------------------

export interface ConversationMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ConversationOperationRequest extends AiProviderRequest {
	operation: 'conversation';
	messages: ConversationMessage[];
	contextCategorySummary: Record<string, number> | undefined;
}

export interface StructuredExtractionRequest extends AiProviderRequest {
	operation: 'structured_extraction';
	context: Record<string, unknown> | undefined;
	schemaDescription: string;
	contextCategorySummary: Record<string, number> | undefined;
}

export interface SuggestionRequest extends AiProviderRequest {
	operation: 'suggestion';
	context: Record<string, unknown> | undefined;
	prompt: string;
	contextCategorySummary: Record<string, number> | undefined;
}

export interface StartupBriefingRequest extends AiProviderRequest {
	operation: 'startup_briefing';
	context: Record<string, unknown> | undefined;
	contextCategorySummary: Record<string, number> | undefined;
}

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

export type AiProviderResponseStatus = 'success' | 'failure' | 'blocked';

export interface AiProviderResponse {
	operation: AiProviderOperation;
	status: AiProviderResponseStatus;
	diagnostics: AiProviderDiagnostic[];
}

// ---------------------------------------------------------------------------
// Operation-specific responses
// ---------------------------------------------------------------------------

export interface ConversationOperationResponse extends AiProviderResponse {
	operation: 'conversation';
	messages: ConversationMessage[];
}

export interface StructuredExtractionRecord {
	recordId: string;
	recordType: string;
	fields: Record<string, unknown>;
	confidence: 'low' | 'medium' | 'high' | 'advisory' | undefined;
	isProposed: boolean;
}

export interface StructuredExtractionResponse extends AiProviderResponse {
	operation: 'structured_extraction';
	extractions: StructuredExtractionRecord[];
}

export interface SuggestionItem {
	id: string;
	text: string;
	category: string | undefined;
	confidence: 'low' | 'medium' | 'high' | 'advisory' | undefined;
	isProposed: boolean;
}

export interface SuggestionResponse extends AiProviderResponse {
	operation: 'suggestion';
	suggestions: SuggestionItem[];
}

export interface StartupBriefingItem {
	id: string;
	text: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	category: string | undefined;
}

export interface StartupBriefingResponse extends AiProviderResponse {
	operation: 'startup_briefing';
	briefingItems: StartupBriefingItem[];
	summary: string | undefined;
}

// ---------------------------------------------------------------------------
// Provider port interface
// ---------------------------------------------------------------------------

export interface AiProviderPort {
	readonly providerId: AiProviderId;
	readonly providerKind: AiProviderKind;
	readonly capabilities: AiProviderCapabilities;

	conversation(
		request: ConversationOperationRequest,
	): Promise<ConversationOperationResponse>;

	structuredExtraction(
		request: StructuredExtractionRequest,
	): Promise<StructuredExtractionResponse>;

	suggestion(request: SuggestionRequest): Promise<SuggestionResponse>;

	startupBriefing(
		request: StartupBriefingRequest,
	): Promise<StartupBriefingResponse>;

	diagnostic(): AiProviderDiagnostic;
}

// ---------------------------------------------------------------------------
// Disclosure and consent
// ---------------------------------------------------------------------------

export interface AiProviderDisclosure {
	providerId: AiProviderId;
	providerKind: AiProviderKind;
	contextCategories: string[];
	contextCategorySummary: Record<string, number>;
	estimatedTokenBudget: number | undefined;
	acceptedAt: string | undefined;
	declinedAt: string | undefined;
}

export type AiProviderConsent = 'accepted' | 'declined' | 'absent';

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

export interface AiProviderResponseValidationResult {
	valid: boolean;
	diagnostics: AiProviderDiagnostic[];
}
