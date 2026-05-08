import type { AiOperationId } from './ai-operations.js';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm-provider.js';
import { getProviderPreset } from './provider-config.js';

type MockResponseMap = Partial<Record<AiOperationId, unknown>>;

const defaultMockResponses = {
	classify_assumptions: {
		assumptions: [],
		status: 'proposed',
	},
	draft_document_section: {
		section: {
			assumptions: [],
			body: 'Draft content pending project context.',
			documentId: 'unknown-document',
			openQuestions: ['What confirmed inputs should this section use?'],
			sectionId: 'unknown-section',
			title: 'Draft Section',
		},
		status: 'draft',
	},
	extract_decision_proposals: {
		proposals: [],
		status: 'proposed',
	},
	generate_follow_up_questions: {
		questions: [
			{
				id: 'mock.follow_up_1',
				rationale: 'A deterministic placeholder question keeps tests stable.',
				text: 'What is the next missing decision?',
			},
		],
		status: 'proposed',
	},
	identify_gaps: {
		gaps: [],
		status: 'needs_review',
	},
	identify_risks: {
		risks: [],
		status: 'needs_review',
	},
	recommend_next_question_group: {
		recommendation: {
			priority: 'medium',
			questionSetId: 'foundation',
			rationale: 'The mock provider always recommends the foundation group.',
		},
		status: 'proposed',
	},
	summarize_answer: {
		status: 'draft',
		summary: 'Deterministic mock summary.',
	},
} as const satisfies Record<AiOperationId, unknown>;

export function createMockLlmProvider(
	responses: MockResponseMap = {},
): LlmProvider {
	const preset = getProviderPreset('mock');

	return {
		complete: async (request: LlmRequest): Promise<LlmResponse> => ({
			finishReason: 'stop',
			model: 'mock-deterministic',
			operationId: request.operationId,
			output:
				responses[request.operationId] ??
				defaultMockResponses[request.operationId],
			providerId: 'mock',
			rawText: null,
			usage: {
				inputTokens: null,
				outputTokens: null,
			},
		}),
		metadata: {
			capabilities: preset.capabilities,
			preset,
			providerId: 'mock',
			transmission: preset.transmission,
		},
	};
}
