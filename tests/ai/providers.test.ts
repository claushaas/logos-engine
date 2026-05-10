import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import {
	AiResponseValidationError,
	createFixtureResponseProvider,
	createMockLlmProvider,
	createOpenAiCompatibleProvider,
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

describe('OpenAI-compatible provider response parsing', () => {
	it('accepts JSON wrapped in a Markdown code fence', async () => {
		const result = await runWithServerContent(
			'```json\n{"status":"draft","summary":"Wrapped JSON parsed."}\n```',
		);

		expect(result).toMatchObject({
			status: 'draft',
			summary: 'Wrapped JSON parsed.',
		});
	});

	it('accepts a JSON object embedded in provider prose', async () => {
		const result = await runWithServerContent(
			'Here is the structured result:\n{"status":"draft","summary":"Embedded JSON parsed."}\n',
		);

		expect(result).toMatchObject({
			status: 'draft',
			summary: 'Embedded JSON parsed.',
		});
	});

	it('still rejects provider content without a parseable JSON object', async () => {
		await expect(runWithServerContent('I cannot return JSON.')).rejects.toThrow(
			LlmProviderError,
		);
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

async function runWithServerContent(content: string) {
	const server = createServer((_request, response) => {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(
			JSON.stringify({
				choices: [
					{
						finish_reason: 'stop',
						message: { content },
					},
				],
				model: 'test-model',
			}),
		);
	});

	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve);
	});

	try {
		const { port } = server.address() as AddressInfo;
		const provider = createOpenAiCompatibleProvider(
			{
				enabled: true,
				endpoint: `http://127.0.0.1:${port}`,
				model: 'test-model',
				provider: 'openai-compatible',
				remoteContextDisclosureAccepted: true,
				timeoutMs: 60_000,
				tokenSource: {
					envVar: 'TEST_LOGOS_LLM_API_KEY',
					type: 'environment',
				},
			},
			{ TEST_LOGOS_LLM_API_KEY: 'test-token' },
		);

		return await runAiOperation(provider, createRequest('summarize_answer'));
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}
}
