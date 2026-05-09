import type { AiOperationOutput } from '../ai/ai-operations.js';
import { AiResponseValidationError } from '../ai/ai-operations.js';
import { type LlmProvider, runAiOperation } from '../ai/llm-provider.js';
import { buildPromptForAiOperation } from '../ai/prompt-builder.js';
import type { ConversationTurn } from '../domain/conversation-model.js';
import type { DecisionProposal } from '../domain/decision-registry.js';
import type { ProfileContract } from '../domain/profile-loader.js';
import {
	type AnswerRecord,
	type Assumption,
	answerRecordSchema,
	type OpenQuestion,
} from '../domain/question-engine.js';
import type { WorkspaceState } from '../domain/workspace-state.js';

export type ConversationTurnInterpretation = {
	readonly answerRecords: readonly AnswerRecord[];
	readonly assumptions: readonly Assumption[];
	readonly decisionProposals: readonly DecisionProposal[];
	readonly openQuestions: readonly OpenQuestion[];
};

export type InterpretationResult = {
	readonly interpretation: ConversationTurnInterpretation | null;
	readonly status: 'ok' | 'error' | 'malformed' | 'provider_failure';
	readonly turnId: string;
};

export class InterpretationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InterpretationError';
	}
}

export async function interpretConversationTurn(input: {
	readonly conversationHistory: readonly {
		readonly content: string;
		readonly role: string;
	}[];
	readonly now?: Date;
	readonly profile: ProfileContract;
	readonly provider: LlmProvider;
	readonly turn: ConversationTurn;
	readonly workspace: WorkspaceState;
}): Promise<InterpretationResult> {
	const now = input.now ?? new Date();
	const timestamp = now.toISOString();

	try {
		const prompt = buildPromptForAiOperation({
			conversationHistory: input.conversationHistory,
			input: {
				turnContent: input.turn.content,
				turnId: input.turn.id,
			},
			operationId: 'interpret_conversation_turn',
			profile: input.profile,
			workspace: input.workspace,
		});

		const output = (await runAiOperation(
			input.provider,
			prompt.request,
		)) as AiOperationOutput<'interpret_conversation_turn'>;

		return buildInterpretationResult({
			output,
			timestamp,
			turn: input.turn,
		});
	} catch (error) {
		if (
			error instanceof InterpretationError ||
			error instanceof AiResponseValidationError
		) {
			return {
				interpretation: null,
				status: 'malformed',
				turnId: input.turn.id,
			};
		}

		return {
			interpretation: null,
			status: 'provider_failure',
			turnId: input.turn.id,
		};
	}
}

function buildInterpretationResult(input: {
	readonly output: AiOperationOutput<'interpret_conversation_turn'>;
	readonly timestamp: string;
	readonly turn: ConversationTurn;
}): InterpretationResult {
	const { output, timestamp, turn } = input;

	if (output.status === 'rejected') {
		return {
			interpretation: null,
			status: 'malformed',
			turnId: turn.id,
		};
	}

	try {
		const answerRecords = buildAnswerRecords(output, turn, timestamp);
		const assumptions = buildAssumptions(output, turn, timestamp);
		const openQuestions = buildOpenQuestions(output, turn, timestamp);
		const decisionProposals = buildProposals(output, turn);

		return {
			interpretation: {
				answerRecords,
				assumptions,
				decisionProposals,
				openQuestions,
			},
			status: 'ok',
			turnId: turn.id,
		};
	} catch (error) {
		if (error instanceof InterpretationError) {
			return {
				interpretation: null,
				status: 'malformed',
				turnId: turn.id,
			};
		}

		throw error;
	}
}

function buildAnswerRecords(
	output: AiOperationOutput<'interpret_conversation_turn'>,
	turn: ConversationTurn,
	timestamp: string,
): AnswerRecord[] {
	return output.interpretedAnswers.map((item, index) => {
		const answerId = item.answerId || `answer.conv.${turn.id}.${index}`;
		const record: AnswerRecord = {
			answer: item.normalizedSummary,
			answeredAt: timestamp,
			id: answerId,
			mapsToDecisionIds: [],
			phaseId: item.phaseId,
			questionId: item.matchedQuestionId ?? turn.id,
			rawAnswer: turn.content,
			status: 'answered',
			summary: item.normalizedSummary,
		};

		const parseResult = answerRecordSchema.safeParse(record);

		if (!parseResult.success) {
			throw new InterpretationError(
				`Invalid answer record for turn ${turn.id}: ${parseResult.error.message}`,
			);
		}

		return parseResult.data;
	});
}

function buildAssumptions(
	output: AiOperationOutput<'interpret_conversation_turn'>,
	turn: ConversationTurn,
	timestamp: string,
): Assumption[] {
	return output.classifiedAssumptions.map((item, index) => {
		const assumptionId =
			item.assumptionId || `assumption.conv.${turn.id}.${index}`;

		return {
			createdAt: timestamp,
			decisionIds: item.relatedDecisionIds,
			id: assumptionId,
			questionId: turn.id,
			sourceAnswerId: `answer.conv.${turn.id}.${index}`,
			status: 'active' as const,
			text: item.text,
			value: item.text,
		};
	});
}

function buildOpenQuestions(
	output: AiOperationOutput<'interpret_conversation_turn'>,
	turn: ConversationTurn,
	timestamp: string,
): OpenQuestion[] {
	return output.identifiedOpenQuestions.map((item, index) => {
		const openQuestionId =
			item.openQuestionId || `open.conv.${turn.id}.${index}`;

		return {
			createdAt: timestamp,
			decisionIds: item.relatedDecisionIds,
			id: openQuestionId,
			questionId: turn.id,
			sourceAnswerId: `answer.conv.${turn.id}.${index}`,
			status: 'open' as const,
			text: item.text,
		};
	});
}

function buildProposals(
	output: AiOperationOutput<'interpret_conversation_turn'>,
	turn: ConversationTurn,
): DecisionProposal[] {
	return output.decisionProposals.map((item) => ({
		confidence: item.confidence,
		decisionId: item.decisionId,
		rationale: item.rationale,
		sourceAnswerIds: [turn.id],
		suggestedTitle: item.suggestedTitle,
		suggestedValue: item.suggestedValue,
	}));
}
