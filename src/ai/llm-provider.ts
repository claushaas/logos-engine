import { z } from 'zod';
import {
	type AiOperationId,
	aiOperationIds,
	validateAiOperationOutput,
} from './ai-operations.js';
import type {
	AiProviderConfig,
	ProviderCapability,
	ProviderPreset,
	ProviderTransmission,
} from './provider-config.js';

export const llmMessageSchema = z.object({
	content: z.string(),
	role: z.enum(['system', 'user', 'assistant']),
});

export const llmRequestSchema = z.object({
	contextDisclosure: z
		.object({
			items: z.array(z.string().min(1)),
			summary: z.string().min(1),
		})
		.optional(),
	input: z.record(z.string(), z.unknown()).default({}),
	messages: z.array(llmMessageSchema).min(1),
	operationId: z.enum(aiOperationIds),
	responseFormat: z
		.object({
			format: z.literal('json'),
			name: z.string().min(1),
		})
		.default({
			format: 'json',
			name: 'logos_ai_operation_output',
		}),
});

export const llmResponseSchema = z.object({
	finishReason: z.string().nullable(),
	model: z.string().min(1).nullable(),
	operationId: z.enum(aiOperationIds),
	output: z.unknown(),
	providerId: z.string().min(1),
	rawText: z.string().nullable(),
	usage: z
		.object({
			inputTokens: z.number().int().nonnegative().nullable(),
			outputTokens: z.number().int().nonnegative().nullable(),
		})
		.nullable(),
});

export type LlmMessage = z.infer<typeof llmMessageSchema>;
export type LlmRequest = z.infer<typeof llmRequestSchema>;
export type LlmResponse = z.infer<typeof llmResponseSchema>;

export type LlmProviderMetadata = {
	readonly capabilities: ProviderCapability;
	readonly preset: ProviderPreset;
	readonly providerId: string;
	readonly transmission: ProviderTransmission;
};

export type LlmProvider = {
	readonly metadata: LlmProviderMetadata;
	readonly complete: (request: LlmRequest) => Promise<LlmResponse>;
};

export type LlmProviderFactory = (config: AiProviderConfig) => LlmProvider;

export class LlmProviderError extends Error {
	public constructor(
		message: string,
		public readonly code:
			| 'authentication_failed'
			| 'configuration_error'
			| 'invalid_response'
			| 'network_error'
			| 'provider_unavailable'
			| 'rate_limited'
			| 'timeout'
			| 'unsupported_operation',
		public readonly retryable: boolean,
	) {
		super(message);
		this.name = 'LlmProviderError';
	}
}

export async function runAiOperation<TOperation extends AiOperationId>(
	provider: LlmProvider,
	request: LlmRequest & { readonly operationId: TOperation },
) {
	const parsedRequest = llmRequestSchema.parse(request);
	const response = await provider.complete(parsedRequest);
	const parsedResponse = llmResponseSchema.parse(response);

	if (parsedResponse.operationId !== parsedRequest.operationId) {
		throw new LlmProviderError(
			`Provider returned output for ${parsedResponse.operationId} while ${parsedRequest.operationId} was requested.`,
			'invalid_response',
			false,
		);
	}

	return validateAiOperationOutput(request.operationId, parsedResponse.output);
}
