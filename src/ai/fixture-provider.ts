import type { AiOperationId } from './ai-operations.js';
import {
	type LlmProvider,
	LlmProviderError,
	type LlmRequest,
	type LlmResponse,
} from './llm-provider.js';
import { getProviderPreset } from './provider-config.js';

export type FixtureResponse = {
	readonly finishReason?: string | null;
	readonly model?: string | null;
	readonly output: unknown;
	readonly rawText?: string | null;
};

export type FixtureResponseMap = Partial<
	Record<AiOperationId, FixtureResponse>
>;

export function createFixtureResponseProvider(
	fixtures: FixtureResponseMap,
): LlmProvider {
	const preset = getProviderPreset('fixture');

	return {
		complete: async (request: LlmRequest): Promise<LlmResponse> => {
			const fixture = fixtures[request.operationId];

			if (!fixture) {
				throw new LlmProviderError(
					`No fixture response registered for ${request.operationId}.`,
					'unsupported_operation',
					false,
				);
			}

			return {
				finishReason: fixture.finishReason ?? 'stop',
				model: fixture.model ?? 'fixture-responses',
				operationId: request.operationId,
				output: fixture.output,
				providerId: 'fixture',
				rawText: fixture.rawText ?? null,
				usage: null,
			};
		},
		metadata: {
			capabilities: preset.capabilities,
			preset,
			providerId: 'fixture',
			transmission: preset.transmission,
		},
	};
}
