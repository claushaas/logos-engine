/** Fake Provider — deterministic fake provider for tests and local development */

import type {
	AiProviderCapabilities,
	AiProviderDiagnostic,
	AiProviderId,
	AiProviderKind,
	AiProviderPort,
	ConversationOperationRequest,
	ConversationOperationResponse,
	StartupBriefingRequest,
	StartupBriefingResponse,
	StructuredExtractionRequest,
	StructuredExtractionResponse,
	SuggestionRequest,
	SuggestionResponse,
} from './provider-port.js';

// ---------------------------------------------------------------------------
// Fake provider options
// ---------------------------------------------------------------------------

export interface FakeProviderOptions {
	providerId?: AiProviderId | undefined;
	simulateFailure?: boolean | undefined;
	failureCode?: string | undefined;
	failureMessage?: string | undefined;
	returnMalformed?: boolean | undefined;
	customResponses?:
		| {
				conversation?: ConversationOperationResponse | undefined;
				structuredExtraction?: StructuredExtractionResponse | undefined;
				suggestion?: SuggestionResponse | undefined;
				startupBriefing?: StartupBriefingResponse | undefined;
		  }
		| undefined;
}

// ---------------------------------------------------------------------------
// Default responses
// ---------------------------------------------------------------------------

function defaultConversationResponse(
	request: ConversationOperationRequest,
): ConversationOperationResponse {
	return {
		diagnostics: [],
		messages: [
			{
				content: `Fake response to ${request.messages.length} message(s). This is a deterministic test response.`,
				role: 'assistant',
			},
		],
		operation: 'conversation',
		status: 'success',
	};
}

function defaultStructuredExtractionResponse(
	_request: StructuredExtractionRequest,
): StructuredExtractionResponse {
	return {
		diagnostics: [],
		extractions: [
			{
				confidence: 'medium',
				fields: {
					body: 'This is a fake extraction for testing purposes.',
					confidence: 'medium',
					title: 'Fake extracted decision',
				},
				isProposed: true,
				recordId: 'ext-001',
				recordType: 'decision',
			},
		],
		operation: 'structured_extraction',
		status: 'success',
	};
}

function defaultSuggestionResponse(
	_request: SuggestionRequest,
): SuggestionResponse {
	return {
		diagnostics: [],
		operation: 'suggestion',
		status: 'success',
		suggestions: [
			{
				category: 'decision',
				confidence: 'medium',
				id: 'sug-001',
				isProposed: true,
				text: 'Consider using React for the frontend framework',
			},
			{
				category: 'decision',
				confidence: 'high',
				id: 'sug-002',
				isProposed: true,
				text: 'Consider TypeScript for type safety',
			},
		],
	};
}

function defaultStartupBriefingResponse(
	_request: StartupBriefingRequest,
): StartupBriefingResponse {
	return {
		briefingItems: [
			{
				category: 'open_questions',
				id: 'brief-001',
				priority: 'high',
				text: 'You have 3 open questions that need attention',
			},
			{
				category: 'dependencies',
				id: 'brief-002',
				priority: 'critical',
				text: '2 documents have unmet prerequisites',
			},
			{
				category: 'assumptions',
				id: 'brief-003',
				priority: 'medium',
				text: '1 assumption has not been validated',
			},
		],
		diagnostics: [],
		operation: 'startup_briefing',
		status: 'success',
		summary: 'Startup briefing summary: 3 items require attention.',
	};
}

function failureResponse(operation: string, code: string, message: string) {
	return {
		diagnostics: [
			{
				code,
				message,
				path: '(provider)',
				pointer: '/provider/failure',
				recoveryHint: 'This is a simulated failure for testing',
				severity: 'error' as const,
			},
		],
		operation,
		status: 'failure' as const,
	};
}

// ---------------------------------------------------------------------------
// Fake provider implementation
// ---------------------------------------------------------------------------

export class FakeProvider implements AiProviderPort {
	readonly providerId: AiProviderId;
	readonly providerKind: AiProviderKind = 'fake';
	readonly capabilities: AiProviderCapabilities = {
		estimatedMaxContextTokens: 8000,
		estimatedMaxResponseTokens: 2000,
		supportsConversation: true,
		supportsStartupBriefing: true,
		supportsStructuredExtraction: true,
		supportsSuggestion: true,
	};

	private readonly _simulateFailure: boolean;
	private readonly _failureCode: string;
	private readonly _failureMessage: string;
	private readonly _returnMalformed: boolean;
	private readonly _customResponses:
		| NonNullable<FakeProviderOptions['customResponses']>
		| undefined;

	constructor(options: FakeProviderOptions = {}) {
		this.providerId = options.providerId ?? 'fake-provider';
		this._simulateFailure = options.simulateFailure ?? false;
		this._failureCode = options.failureCode ?? 'E_FAKE_FAILURE';
		this._failureMessage =
			options.failureMessage ?? 'Fake provider simulated failure';
		this._returnMalformed = options.returnMalformed ?? false;
		this._customResponses = options.customResponses;
	}

	async conversation(
		request: ConversationOperationRequest,
	): Promise<ConversationOperationResponse> {
		if (this._returnMalformed) {
			return { invalid: true } as unknown as ConversationOperationResponse;
		}

		if (this._simulateFailure) {
			const base = failureResponse(
				'conversation',
				this._failureCode,
				this._failureMessage,
			) as unknown as ConversationOperationResponse;
			return { ...base, messages: [], operation: 'conversation' };
		}

		if (this._customResponses?.conversation) {
			return { ...this._customResponses.conversation };
		}

		return defaultConversationResponse(request);
	}

	async structuredExtraction(
		request: StructuredExtractionRequest,
	): Promise<StructuredExtractionResponse> {
		if (this._returnMalformed) {
			return { invalid: true } as unknown as StructuredExtractionResponse;
		}

		if (this._simulateFailure) {
			const base = failureResponse(
				'structured_extraction',
				this._failureCode,
				this._failureMessage,
			) as unknown as StructuredExtractionResponse;
			return { ...base, extractions: [], operation: 'structured_extraction' };
		}

		if (this._customResponses?.structuredExtraction) {
			return { ...this._customResponses.structuredExtraction };
		}

		return defaultStructuredExtractionResponse(request);
	}

	async suggestion(request: SuggestionRequest): Promise<SuggestionResponse> {
		if (this._returnMalformed) {
			return { invalid: true } as unknown as SuggestionResponse;
		}

		if (this._simulateFailure) {
			const base = failureResponse(
				'suggestion',
				this._failureCode,
				this._failureMessage,
			) as unknown as SuggestionResponse;
			return { ...base, operation: 'suggestion', suggestions: [] };
		}

		if (this._customResponses?.suggestion) {
			return { ...this._customResponses.suggestion };
		}

		return defaultSuggestionResponse(request);
	}

	async startupBriefing(
		request: StartupBriefingRequest,
	): Promise<StartupBriefingResponse> {
		if (this._returnMalformed) {
			return { invalid: true } as unknown as StartupBriefingResponse;
		}

		if (this._simulateFailure) {
			const base = failureResponse(
				'startup_briefing',
				this._failureCode,
				this._failureMessage,
			) as unknown as StartupBriefingResponse;
			return { ...base, briefingItems: [], operation: 'startup_briefing' };
		}

		if (this._customResponses?.startupBriefing) {
			return { ...this._customResponses.startupBriefing };
		}

		return defaultStartupBriefingResponse(request);
	}

	diagnostic(): AiProviderDiagnostic {
		return {
			code: 'D_FAKE_PROVIDER',
			message: `Fake provider "${this.providerId}" is ready for deterministic testing`,
			path: undefined,
			pointer: '/provider/fake',
			recoveryHint: undefined,
			severity: 'info',
		};
	}
}
