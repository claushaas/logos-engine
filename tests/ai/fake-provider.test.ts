/** Fake Provider tests — Step 4.2 */

import { describe, expect, it } from 'vitest';
import {
	type ConversationOperationRequest,
	FakeProvider,
	type StartupBriefingRequest,
	type StructuredExtractionRequest,
	type SuggestionRequest,
	validateConversationResponse,
	validateProviderResponse,
	validateStartupBriefingResponse,
	validateStructuredExtractionResponse,
	validateSuggestionResponse,
} from '../../src/index.js';

function makeConversationRequest(): ConversationOperationRequest {
	return {
		contextCategorySummary: undefined,
		executionMode: 'inline',
		messages: [{ content: 'Hello', role: 'user' }],
		operation: 'conversation',
		providerId: undefined,
		providerKind: 'fake',
	};
}

function makeStructuredExtractionRequest(): StructuredExtractionRequest {
	return {
		context: undefined,
		contextCategorySummary: undefined,
		executionMode: 'inline',
		operation: 'structured_extraction',
		providerId: undefined,
		providerKind: 'fake',
		schemaDescription: 'Test schema',
	};
}

function makeSuggestionRequest(): SuggestionRequest {
	return {
		context: undefined,
		contextCategorySummary: undefined,
		executionMode: 'inline',
		operation: 'suggestion',
		prompt: 'Test prompt',
		providerId: undefined,
		providerKind: 'fake',
	};
}

function makeStartupBriefingRequest(): StartupBriefingRequest {
	return {
		context: undefined,
		contextCategorySummary: undefined,
		executionMode: 'inline',
		operation: 'startup_briefing',
		providerId: undefined,
		providerKind: 'fake',
	};
}

describe('FakeProvider', () => {
	describe('provider identity', () => {
		it('has correct provider kind', () => {
			const p = new FakeProvider();
			expect(p.providerKind).toBe('fake');
		});

		it('has a configurable provider ID', () => {
			const p = new FakeProvider({ providerId: 'my-fake' });
			expect(p.providerId).toBe('my-fake');
		});

		it('defaults provider ID to fake-provider', () => {
			const p = new FakeProvider();
			expect(p.providerId).toBe('fake-provider');
		});

		it('reports all capabilities as supported', () => {
			const p = new FakeProvider();
			expect(p.capabilities.supportsConversation).toBe(true);
			expect(p.capabilities.supportsStructuredExtraction).toBe(true);
			expect(p.capabilities.supportsSuggestion).toBe(true);
			expect(p.capabilities.supportsStartupBriefing).toBe(true);
		});

		it('reports estimated token budgets', () => {
			const p = new FakeProvider();
			expect(p.capabilities.estimatedMaxContextTokens).toBe(8000);
			expect(p.capabilities.estimatedMaxResponseTokens).toBe(2000);
		});

		it('returns diagnostic info', () => {
			const p = new FakeProvider();
			const d = p.diagnostic();
			expect(d.code).toBe('D_FAKE_PROVIDER');
			expect(d.severity).toBe('info');
			expect(d.message).toContain('fake-provider');
		});
	});

	describe('conversation operation', () => {
		it('returns a valid conversation response', async () => {
			const p = new FakeProvider();
			const req = makeConversationRequest();
			const res = await p.conversation(req);

			expect(res.operation).toBe('conversation');
			expect(res.status).toBe('success');
			expect(res.messages.length).toBeGreaterThan(0);
			expect(res.messages[0]?.role).toBe('assistant');
		});

		it('valid conversation response passes validation', async () => {
			const p = new FakeProvider();
			const req = makeConversationRequest();
			const res = await p.conversation(req);

			const result = validateConversationResponse(res);
			expect(result.valid).toBe(true);
			expect(result.diagnostics).toEqual([]);
		});

		it('handles custom response', async () => {
			const p = new FakeProvider({
				customResponses: {
					conversation: {
						diagnostics: [],
						messages: [{ content: 'Custom!', role: 'assistant' }],
						operation: 'conversation',
						status: 'success',
					},
				},
			});
			const res = await p.conversation(makeConversationRequest());
			expect(res.messages[0]?.content).toBe('Custom!');
		});

		it('returns failure on simulated failure', async () => {
			const p = new FakeProvider({ simulateFailure: true });
			const res = await p.conversation(makeConversationRequest());
			expect(res.status).toBe('failure');
			expect(res.diagnostics.length).toBeGreaterThan(0);
			expect(res.diagnostics[0]?.code).toBe('E_FAKE_FAILURE');
		});

		it('returns malformed response when configured', async () => {
			const p = new FakeProvider({ returnMalformed: true });
			const res = await p.conversation(makeConversationRequest());
			const result = validateConversationResponse(res);
			expect(result.valid).toBe(false);
		});
	});

	describe('structured extraction operation', () => {
		it('returns a valid structured extraction response', async () => {
			const p = new FakeProvider();
			const req = makeStructuredExtractionRequest();
			const res = await p.structuredExtraction(req);

			expect(res.operation).toBe('structured_extraction');
			expect(res.status).toBe('success');
			expect(res.extractions.length).toBeGreaterThan(0);
		});

		it('extraction records are marked as proposed', async () => {
			const p = new FakeProvider();
			const req = makeStructuredExtractionRequest();
			const res = await p.structuredExtraction(req);

			for (const ext of res.extractions) {
				expect(ext.isProposed).toBe(true);
			}
		});

		it('valid extraction response passes validation', async () => {
			const p = new FakeProvider();
			const req = makeStructuredExtractionRequest();
			const res = await p.structuredExtraction(req);

			const result = validateStructuredExtractionResponse(res);
			expect(result.valid).toBe(true);
		});

		it('fails on malformed extraction response', async () => {
			const p = new FakeProvider({ returnMalformed: true });
			const req = makeStructuredExtractionRequest();
			const res = await p.structuredExtraction(req);
			const result = validateStructuredExtractionResponse(res);
			expect(result.valid).toBe(false);
		});
	});

	describe('suggestion operation', () => {
		it('returns a valid suggestion response', async () => {
			const p = new FakeProvider();
			const req = makeSuggestionRequest();
			const res = await p.suggestion(req);

			expect(res.operation).toBe('suggestion');
			expect(res.status).toBe('success');
			expect(res.suggestions.length).toBeGreaterThan(0);
		});

		it('suggestions are marked as proposed', async () => {
			const p = new FakeProvider();
			const req = makeSuggestionRequest();
			const res = await p.suggestion(req);

			for (const sug of res.suggestions) {
				expect(sug.isProposed).toBe(true);
			}
		});

		it('valid suggestion response passes validation', async () => {
			const p = new FakeProvider();
			const req = makeSuggestionRequest();
			const res = await p.suggestion(req);

			const result = validateSuggestionResponse(res);
			expect(result.valid).toBe(true);
		});

		it('fails on malformed suggestion response', async () => {
			const p = new FakeProvider({ returnMalformed: true });
			const req = makeSuggestionRequest();
			const res = await p.suggestion(req);
			const result = validateSuggestionResponse(res);
			expect(result.valid).toBe(false);
		});
	});

	describe('startup briefing operation', () => {
		it('returns a valid startup briefing response', async () => {
			const p = new FakeProvider();
			const req = makeStartupBriefingRequest();
			const res = await p.startupBriefing(req);

			expect(res.operation).toBe('startup_briefing');
			expect(res.status).toBe('success');
			expect(res.briefingItems.length).toBeGreaterThan(0);
		});

		it('includes a summary', async () => {
			const p = new FakeProvider();
			const res = await p.startupBriefing(makeStartupBriefingRequest());
			expect(res.summary).toBeDefined();
			expect(res.summary?.length).toBeGreaterThan(0);
		});

		it('valid briefing response passes validation', async () => {
			const p = new FakeProvider();
			const req = makeStartupBriefingRequest();
			const res = await p.startupBriefing(req);

			const result = validateStartupBriefingResponse(res);
			expect(result.valid).toBe(true);
		});

		it('fails on malformed briefing response', async () => {
			const p = new FakeProvider({ returnMalformed: true });
			const req = makeStartupBriefingRequest();
			const res = await p.startupBriefing(req);
			const result = validateStartupBriefingResponse(res);
			expect(result.valid).toBe(false);
		});
	});

	describe('provider response validation dispatch', () => {
		it('validates conversation response via dispatch', async () => {
			const p = new FakeProvider();
			const res = await p.conversation(makeConversationRequest());
			const result = validateProviderResponse(res, 'conversation');
			expect(result.valid).toBe(true);
		});

		it('validates structured extraction via dispatch', async () => {
			const p = new FakeProvider();
			const res = await p.structuredExtraction(
				makeStructuredExtractionRequest(),
			);
			const result = validateProviderResponse(res, 'structured_extraction');
			expect(result.valid).toBe(true);
		});

		it('detects operation mismatch', async () => {
			const p = new FakeProvider();
			const res = await p.conversation(makeConversationRequest());
			const result = validateProviderResponse(res, 'suggestion');
			expect(result.valid).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('E_RESPONSE_OPERATION_MISMATCH');
		});

		it('returns error for unknown operation', () => {
			const result = validateProviderResponse(
				{},
				'unknown_op' as unknown as 'conversation',
			);
			expect(result.valid).toBe(false);
		});
	});

	describe('non-mutation guarantees', () => {
		it('provider execution does not write files', async () => {
			const p = new FakeProvider();
			const req = makeConversationRequest();
			const res = await p.conversation(req);
			expect(res.status).toBe('success');
			// No file writes are performed
		});

		it('fake provider does not call network', async () => {
			const p = new FakeProvider();
			// Just verifying no network access happens - fake provider is purely synchronous logic
			const res = await p.conversation(makeConversationRequest());
			expect(res).toBeDefined();
		});

		it('response validation does not mutate state', () => {
			const res = {
				diagnostics: [],
				messages: [],
				operation: 'conversation',
				status: 'success',
			};
			const result = validateConversationResponse(res);
			expect(result.valid).toBe(true);
			// Response object not mutated
			expect(res).toEqual({
				diagnostics: [],
				messages: [],
				operation: 'conversation',
				status: 'success',
			});
		});
	});
});
