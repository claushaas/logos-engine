import { z } from 'zod';
import {
	aiOutputStatuses,
	validationSeverities,
} from '../foundation/status-contracts.js';

export const aiOperationIds = [
	'generate_follow_up_questions',
	'summarize_answer',
	'extract_decision_proposals',
	'classify_assumptions',
	'identify_gaps',
	'identify_risks',
	'draft_document_section',
	'recommend_next_question_group',
] as const;

export type AiOperationId = (typeof aiOperationIds)[number];

const aiOutputStatusSchema = z.enum(aiOutputStatuses);

const operationMetadataSchema = z.object({
	description: z.string().min(1),
	id: z.enum(aiOperationIds),
	mutatesProjectState: z.literal(false),
	outputStatus: aiOutputStatusSchema,
});

export const aiOperationRegistry = [
	{
		description: 'Generate contextual follow-up questions for intake.',
		id: 'generate_follow_up_questions',
		mutatesProjectState: false,
		outputStatus: 'proposed',
	},
	{
		description: 'Summarize a user answer without confirming decisions.',
		id: 'summarize_answer',
		mutatesProjectState: false,
		outputStatus: 'draft',
	},
	{
		description: 'Extract decision proposals from user-provided answers.',
		id: 'extract_decision_proposals',
		mutatesProjectState: false,
		outputStatus: 'proposed',
	},
	{
		description: 'Classify possible assumptions from incomplete input.',
		id: 'classify_assumptions',
		mutatesProjectState: false,
		outputStatus: 'proposed',
	},
	{
		description: 'Identify missing or contradictory project context.',
		id: 'identify_gaps',
		mutatesProjectState: false,
		outputStatus: 'needs_review',
	},
	{
		description: 'Identify risks implied by current project context.',
		id: 'identify_risks',
		mutatesProjectState: false,
		outputStatus: 'needs_review',
	},
	{
		description: 'Draft one canonical document section for review.',
		id: 'draft_document_section',
		mutatesProjectState: false,
		outputStatus: 'draft',
	},
	{
		description: 'Recommend the next useful profile question group.',
		id: 'recommend_next_question_group',
		mutatesProjectState: false,
		outputStatus: 'proposed',
	},
] as const satisfies readonly z.infer<typeof operationMetadataSchema>[];

const outputBaseSchema = z.object({
	notes: z.array(z.string().min(1)).optional().default([]),
	status: aiOutputStatusSchema,
});

const questionSchema = z.object({
	id: z.string().min(1),
	rationale: z.string().min(1),
	text: z.string().min(1),
});

const decisionProposalSchema = z.object({
	confidence: z.number().min(0).max(1),
	decisionId: z.string().min(1),
	rationale: z.string().min(1),
	value: z.unknown(),
});

const assumptionSchema = z.object({
	confidence: z.number().min(0).max(1),
	id: z.string().min(1),
	rationale: z.string().min(1),
	text: z.string().min(1),
});

const gapSchema = z.object({
	description: z.string().min(1),
	id: z.string().min(1),
	severity: z.enum(validationSeverities),
});

const riskSchema = z.object({
	description: z.string().min(1),
	id: z.string().min(1),
	severity: z.enum(validationSeverities),
	title: z.string().min(1),
});

export const aiOperationOutputSchemas = {
	classify_assumptions: outputBaseSchema.extend({
		assumptions: z.array(assumptionSchema),
	}),
	draft_document_section: outputBaseSchema.extend({
		section: z.object({
			assumptions: z.array(z.string().min(1)).default([]),
			body: z.string().min(1),
			documentId: z.string().min(1),
			openQuestions: z.array(z.string().min(1)).default([]),
			sectionId: z.string().min(1),
			title: z.string().min(1),
		}),
	}),
	extract_decision_proposals: outputBaseSchema.extend({
		proposals: z.array(decisionProposalSchema),
	}),
	generate_follow_up_questions: outputBaseSchema.extend({
		questions: z.array(questionSchema),
	}),
	identify_gaps: outputBaseSchema.extend({
		gaps: z.array(gapSchema),
	}),
	identify_risks: outputBaseSchema.extend({
		risks: z.array(riskSchema),
	}),
	recommend_next_question_group: outputBaseSchema.extend({
		recommendation: z.object({
			priority: z.enum(['high', 'medium', 'low']),
			questionSetId: z.string().min(1),
			rationale: z.string().min(1),
		}),
	}),
	summarize_answer: outputBaseSchema.extend({
		summary: z.string().min(1),
	}),
} as const satisfies Record<AiOperationId, z.ZodType>;

export type AiOperationOutput<TOperation extends AiOperationId> = z.infer<
	(typeof aiOperationOutputSchemas)[TOperation]
>;

export class AiResponseValidationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'AiResponseValidationError';
	}
}

export function validateAiOperationOutput<TOperation extends AiOperationId>(
	operationId: TOperation,
	output: unknown,
): AiOperationOutput<TOperation> {
	const result = aiOperationOutputSchemas[operationId].safeParse(output);

	if (!result.success) {
		throw new AiResponseValidationError(
			`Malformed AI response for ${operationId}: ${z.prettifyError(result.error)}`,
		);
	}

	if (result.data.status === 'confirmed') {
		throw new AiResponseValidationError(
			`AI response for ${operationId} attempted to use confirmed status without user confirmation.`,
		);
	}

	return result.data as AiOperationOutput<TOperation>;
}

export function getAiOperationMetadata(operationId: AiOperationId) {
	const operation = aiOperationRegistry.find((item) => item.id === operationId);

	if (!operation) {
		throw new AiResponseValidationError(`Unknown AI operation: ${operationId}`);
	}

	return operation;
}
