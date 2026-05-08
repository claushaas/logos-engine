import { describe, expect, it } from 'vitest';
import {
	AiResponseValidationError,
	createFixtureResponseProvider,
	createMockLlmProvider,
	LlmProviderError,
	type LlmRequest,
	runAiOperation,
} from '../../src/index.js';

describe('deterministic LLM providers', () => {
	it('runs a mock provider response through the provider abstraction', async () => {
		await expect(
			runAiOperation(
				createMockLlmProvider(),
				createRequest('summarize_answer'),
			),
		).resolves.toEqual({
			notes: [],
			status: 'draft',
			summary: 'Deterministic mock summary.',
		});
	});

	it('supports fixture responses for deterministic operation tests', async () => {
		const provider = createFixtureResponseProvider({
			identify_gaps: {
				output: {
					gaps: [
						{
							description: 'Pricing is unknown.',
							id: 'gap.pricing',
							severity: 'warning',
						},
					],
					status: 'needs_review',
				},
			},
		});

		await expect(
			runAiOperation(provider, createRequest('identify_gaps')),
		).resolves.toMatchObject({
			gaps: [
				{
					id: 'gap.pricing',
				},
			],
			status: 'needs_review',
		});
	});

	it('fails safely when fixture output is missing or malformed', async () => {
		await expect(
			runAiOperation(
				createFixtureResponseProvider({}),
				createRequest('identify_risks'),
			),
		).rejects.toBeInstanceOf(LlmProviderError);

		await expect(
			runAiOperation(
				createFixtureResponseProvider({
					summarize_answer: {
						output: {
							status: 'draft',
						},
					},
				}),
				createRequest('summarize_answer'),
			),
		).rejects.toBeInstanceOf(AiResponseValidationError);
	});
});

function createRequest(operationId: LlmRequest['operationId']): LlmRequest {
	return {
		input: {},
		messages: [
			{
				content: 'Return deterministic JSON.',
				role: 'user',
			},
		],
		operationId,
		responseFormat: {
			format: 'json',
			name: 'logos_test',
		},
	};
}
