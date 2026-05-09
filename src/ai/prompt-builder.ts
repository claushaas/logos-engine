import { z } from 'zod';
import {
	type AiOperationId,
	aiOperationOutputSchemas,
	getAiOperationMetadata,
} from './ai-operations.js';
import type { LlmRequest } from './llm-provider.js';
import {
	type BuildPromptContextInput,
	buildPromptContext,
	groupPromptContextItems,
	type PromptContextBundle,
	type PromptContextCategory,
	promptContextCategories,
	serializeContext,
} from './prompt-context.js';

export const promptBuilderVersion = 'logos.prompt-builder.v1';

export type PromptContract = {
	readonly operationId: AiOperationId;
	readonly outputSchemaName: string;
	readonly promptVersion: string;
	readonly task: string;
};

export type BuiltPrompt = {
	readonly context: PromptContextBundle;
	readonly contract: PromptContract;
	readonly outputSchema: unknown;
	readonly request: LlmRequest;
};

export type BuildPromptInput = BuildPromptContextInput & {
	readonly input?: Record<string, unknown>;
};

const operationPromptTasks = {
	classify_assumptions:
		'Identify claims that should remain assumptions. Preserve uncertainty and explain why each assumption needs validation.',
	draft_document_section:
		'Draft the requested document section for user review using only the provided context and the target document contract.',
	extract_decision_proposals:
		'Extract proposed decisions from user-provided context. Do not convert proposals into confirmed decisions.',
	generate_follow_up_questions:
		'Generate a small set of necessary follow-up questions that clarify intent and unblock downstream documents.',
	identify_gaps:
		'Identify missing, unclear, or contradictory project context against profile and document requirements.',
	identify_risks:
		'Identify risks implied by current facts, assumptions, open questions, validation findings, and profile requirements.',
	lead_intake_turn:
		'Lead one conversational intake turn. Respond naturally to user input, synthesize context from the current project and profile, and propose a next conversational move. Do not invent facts or confirm decisions.',
	recommend_next_conversation_move:
		'Recommend the next conversational move based on current conversation history, project coverage, profile requirements, and missing document inputs.',
	recommend_next_question_group:
		'Recommend the next useful profile question group and explain why it should be asked now.',
	summarize_answer:
		'Summarize user-provided answer context without inventing facts or creating confirmed decisions.',
} as const satisfies Record<AiOperationId, string>;

const categoryHeadings = {
	assumption: 'Assumptions',
	confirmed_decision: 'Confirmed Decisions',
	conversation_history: 'Conversation History',
	document_completion_criteria: 'Document Completion Criteria',
	open_question: 'Open Questions',
	profile_requirement: 'Profile Requirements',
	proposed_decision: 'Proposed Decisions',
	user_fact: 'Confirmed User Facts',
	validation_finding: 'Validation Findings',
} as const satisfies Record<PromptContextCategory, string>;

export function buildPromptForAiOperation(
	input: BuildPromptInput,
): BuiltPrompt {
	const context = buildPromptContext(input);
	const contract = createPromptContract(input.operationId);
	const outputSchema = createAiOperationOutputJsonSchema(input.operationId);
	const requestInput = {
		...(input.input ?? {}),
		contextVersion: context.version,
		promptBuilderVersion,
		promptVersion: contract.promptVersion,
	};

	return {
		context,
		contract,
		outputSchema,
		request: {
			contextDisclosure: {
				items: [...context.disclosure.items],
				summary: context.disclosure.summary,
			},
			input: requestInput,
			messages: [
				{
					content: buildSystemPrompt(contract),
					role: 'system',
				},
				{
					content: buildUserPrompt(contract, context, outputSchema),
					role: 'user',
				},
			],
			operationId: input.operationId,
			responseFormat: {
				format: 'json',
				name: contract.outputSchemaName,
			},
		},
	};
}

export function createPromptContract(
	operationId: AiOperationId,
): PromptContract {
	return {
		operationId,
		outputSchemaName: `logos_${operationId}_output`,
		promptVersion: `${promptBuilderVersion}.${operationId}.v1`,
		task: operationPromptTasks[operationId],
	};
}

export function createStructuredOutputInstructions(
	operationId: AiOperationId,
	outputSchema = createAiOperationOutputJsonSchema(operationId),
): string {
	const operationMetadata = getAiOperationMetadata(operationId);

	return [
		'Return only one JSON object. Do not wrap the JSON in Markdown.',
		`The JSON object must match response format "${operationId}".`,
		`Use status "${operationMetadata.outputStatus}" unless the result is incomplete, uncertain, or unsafe; then use "needs_review" or "rejected" as appropriate.`,
		'Never return status "confirmed"; confirmation belongs to the user-controlled application flow.',
		'If the context is insufficient, preserve uncertainty in notes, gaps, open questions, or risks instead of inventing facts.',
		'Output schema:',
		JSON.stringify(outputSchema, null, 2),
	].join('\n');
}

export function createAiOperationOutputJsonSchema(
	operationId: AiOperationId,
): unknown {
	const schema = z.toJSONSchema(aiOperationOutputSchemas[operationId]);

	return {
		$id: `logos_${operationId}_output`,
		...schema,
	};
}

function buildSystemPrompt(contract: PromptContract): string {
	return [
		'You are LOGOS Engine, a structured intent externalization system.',
		'Your job is to help transform unclear intent into complete, consistent, auditable documentation.',
		'Separate confirmed user facts, assumptions, open questions, proposed decisions, confirmed decisions, profile requirements, and document completion criteria.',
		'Do not invent market facts, user decisions, validation results, or external research.',
		'Do not silently resolve ambiguity. Preserve uncertainty and explain blockers.',
		'AI output may be draft, proposed, needs_review, or rejected; confirmed decisions require explicit user confirmation outside the model.',
		`Prompt version: ${contract.promptVersion}`,
	].join('\n');
}

function buildUserPrompt(
	contract: PromptContract,
	context: PromptContextBundle,
	outputSchema: unknown,
): string {
	return [
		`Operation: ${contract.operationId}`,
		`Task: ${contract.task}`,
		`Context selection rationale: ${context.selectionRule.rationale}`,
		`Context disclosure: ${context.disclosure.summary}`,
		'',
		'Selected context:',
		formatContextSections(context),
		'',
		'Structured output instructions:',
		createStructuredOutputInstructions(contract.operationId, outputSchema),
	].join('\n');
}

function formatContextSections(context: PromptContextBundle): string {
	const groupedItems = groupPromptContextItems(context.items);
	const sections = promptContextCategories
		.map((category) => {
			const items = groupedItems[category];

			if (items.length === 0) {
				return null;
			}

			const serializedItems = items
				.map(
					(item) =>
						`- ${item.label} (${item.source}; ${item.reason})\n${indentBlock(
							serializeContext(item),
						)}`,
				)
				.join('\n');

			return `## ${categoryHeadings[category]}\n${serializedItems}`;
		})
		.filter((section): section is string => section !== null);

	if (sections.length === 0) {
		return 'No project context was selected for this operation.';
	}

	return sections.join('\n\n');
}

function indentBlock(value: string): string {
	return value
		.split('\n')
		.map((line) => `  ${line}`)
		.join('\n');
}
