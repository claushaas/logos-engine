import { z } from 'zod';
import type { AiOperationOutput } from '../ai/ai-operations.js';
import { type LlmProvider, runAiOperation } from '../ai/llm-provider.js';
import { buildPromptForAiOperation } from '../ai/prompt-builder.js';
import type {
	ProfileContract,
	Question,
	QuestionOption,
	QuestionSet,
} from './profile-loader.js';
import type { WorkspaceState } from './workspace-state.js';

export const answerStatuses = [
	'answered',
	'unknown',
	'assumption',
	'skipped',
] as const;

export const intakeSessionStatuses = ['active', 'saved', 'completed'] as const;

export const answerRecordSchema = z.object({
	answer: z.unknown().optional(),
	answeredAt: z.string().datetime(),
	answerType: z
		.enum(['boolean', 'choice', 'multi_choice', 'number', 'text'])
		.optional(),
	id: z.string().min(1),
	mapsToDecisionIds: z.array(z.string().min(1)).optional().default([]),
	phaseId: z.string().min(1).optional(),
	questionId: z.string().min(1),
	questionSetId: z.string().min(1).optional(),
	rawAnswer: z.unknown().optional(),
	status: z.enum(answerStatuses),
	summary: z.string().min(1).nullable().optional(),
});

export const openQuestionSchema = z.object({
	createdAt: z.string().datetime(),
	decisionIds: z.array(z.string().min(1)),
	id: z.string().min(1),
	questionId: z.string().min(1),
	sourceAnswerId: z.string().min(1),
	status: z.literal('open'),
	text: z.string().min(1),
});

export const assumptionSchema = z.object({
	createdAt: z.string().datetime(),
	decisionIds: z.array(z.string().min(1)),
	id: z.string().min(1),
	questionId: z.string().min(1),
	sourceAnswerId: z.string().min(1),
	status: z.literal('active'),
	text: z.string().min(1),
	value: z.unknown(),
});

export const proposedFollowUpQuestionSchema = z.object({
	createdAt: z.string().datetime(),
	id: z.string().min(1),
	rationale: z.string().min(1),
	source: z.literal('ai'),
	status: z.enum(['proposed', 'accepted', 'rejected']),
	text: z.string().min(1),
});

export const intakeSessionSchema = z.object({
	acceptedFollowUpQuestionIds: z.array(z.string().min(1)).default([]),
	activeQuestionIds: z.array(z.string().min(1)).default([]),
	currentPhaseId: z.string().min(1).nullable(),
	currentQuestionSetId: z.string().min(1).nullable(),
	id: z.string().min(1),
	profileId: z.string().min(1),
	proposedFollowUpQuestions: z
		.array(proposedFollowUpQuestionSchema)
		.default([]),
	schemaVersion: z.string().min(1),
	skippedQuestionIds: z.array(z.string().min(1)).default([]),
	startedAt: z.string().datetime(),
	status: z.enum(intakeSessionStatuses),
	updatedAt: z.string().datetime(),
});

export type AnswerStatus = (typeof answerStatuses)[number];
export type AnswerRecord = z.infer<typeof answerRecordSchema>;
export type OpenQuestion = z.infer<typeof openQuestionSchema>;
export type Assumption = z.infer<typeof assumptionSchema>;
export type ProposedFollowUpQuestion = z.infer<
	typeof proposedFollowUpQuestionSchema
>;
export type IntakeSession = z.infer<typeof intakeSessionSchema>;

export type ResolvedQuestion = Question & {
	readonly allowAssumption: boolean;
	readonly allowUnknown: boolean;
	readonly phaseId: string;
	readonly questionSetId: string;
	readonly questionSetTitle: string;
};

export type QuestionSelection = {
	readonly phaseId: string | null;
	readonly questionSet: QuestionSet | null;
	readonly questions: readonly ResolvedQuestion[];
	readonly reason: string;
};

export type QuestionEngineDefaults = {
	readonly allowAssumption: boolean;
	readonly allowUnknown: boolean;
	readonly maxQuestionsPerRound: number;
};

const defaultQuestionEngineDefaults = {
	allowAssumption: true,
	allowUnknown: true,
	maxQuestionsPerRound: 8,
} satisfies QuestionEngineDefaults;

export function selectNextQuestionGroup(input: {
	readonly maxQuestions?: number;
	readonly profile: ProfileContract;
	readonly session?: IntakeSession | null;
	readonly workspace: WorkspaceState;
}): QuestionSelection {
	const defaults = getQuestionEngineDefaults(input.profile);
	const maxQuestions = Math.min(
		input.maxQuestions ?? defaults.maxQuestionsPerRound,
		12,
	);
	const answeredQuestionIds = getAnsweredQuestionIds(input.workspace);
	const skippedQuestionIds = new Set(input.session?.skippedQuestionIds ?? []);
	const missingDecisionIds = getMissingDecisionIds(
		input.profile,
		input.workspace,
	);
	const phaseOrder = input.profile.phases.map((phase) => phase.id);
	const startingPhaseIndex = input.session?.currentPhaseId
		? Math.max(0, phaseOrder.indexOf(input.session.currentPhaseId))
		: 0;
	const orderedPhaseIds = [
		...phaseOrder.slice(startingPhaseIndex),
		...phaseOrder.slice(0, startingPhaseIndex),
	];

	for (const phaseId of orderedPhaseIds) {
		const questionSet = input.profile.questionSets.find(
			(candidate) => candidate.phaseId === phaseId,
		);

		if (!questionSet) {
			continue;
		}

		const candidates = questionSet.questions
			.filter((question) => !answeredQuestionIds.has(question.id))
			.filter((question) => !skippedQuestionIds.has(question.id));

		if (candidates.length === 0) {
			continue;
		}

		const prioritizedQuestions = [
			...candidates.filter((question) =>
				question.mapsToDecisionIds.some((decisionId) =>
					missingDecisionIds.has(decisionId),
				),
			),
			...candidates.filter(
				(question) =>
					!question.mapsToDecisionIds.some((decisionId) =>
						missingDecisionIds.has(decisionId),
					),
			),
		];

		return {
			phaseId,
			questionSet,
			questions: prioritizedQuestions
				.slice(0, maxQuestions)
				.map((question) => resolveQuestion(question, questionSet, defaults)),
			reason:
				'Selected the earliest incomplete phase and prioritized questions mapped to missing decisions.',
		};
	}

	return {
		phaseId: null,
		questionSet: null,
		questions: [],
		reason: 'No unanswered profile questions remain.',
	};
}

export function getQuestionById(
	profile: ProfileContract,
	questionId: string,
): ResolvedQuestion | null {
	const defaults = getQuestionEngineDefaults(profile);

	for (const questionSet of profile.questionSets) {
		const question = questionSet.questions.find(
			(candidate) => candidate.id === questionId,
		);

		if (question) {
			return resolveQuestion(question, questionSet, defaults);
		}
	}

	return null;
}

export function createAnswerRecord(input: {
	readonly now?: Date;
	readonly question: ResolvedQuestion;
	readonly rawAnswer: unknown;
	readonly status: AnswerStatus;
	readonly summary?: string | null;
}): AnswerRecord {
	const answeredAt = (input.now ?? new Date()).toISOString();

	return {
		answer: input.rawAnswer,
		answeredAt,
		answerType: input.question.answerType,
		id: createAnswerId(input.question.id, answeredAt),
		mapsToDecisionIds: [...input.question.mapsToDecisionIds],
		phaseId: input.question.phaseId,
		questionId: input.question.id,
		questionSetId: input.question.questionSetId,
		rawAnswer: input.rawAnswer,
		status: input.status,
		summary: input.summary ?? null,
	};
}

export function upsertAnswer(
	answers: readonly AnswerRecord[],
	answer: AnswerRecord,
): readonly AnswerRecord[] {
	return [
		...answers.filter(
			(candidate) => candidate.questionId !== answer.questionId,
		),
		answer,
	].sort((left, right) => left.answeredAt.localeCompare(right.answeredAt));
}

export function deriveOpenQuestions(input: {
	readonly answers: readonly AnswerRecord[];
	readonly profile: ProfileContract;
}): readonly OpenQuestion[] {
	return input.answers
		.filter((answer) => answer.status === 'unknown')
		.map((answer) => {
			const question = getQuestionById(input.profile, answer.questionId);

			return {
				createdAt: answer.answeredAt,
				decisionIds: answer.mapsToDecisionIds ?? [],
				id: `open.${answer.questionId}`,
				questionId: answer.questionId,
				sourceAnswerId: answer.id,
				status: 'open',
				text:
					question?.text ??
					`User marked ${answer.questionId} as unknown during intake.`,
			};
		});
}

export function deriveAssumptions(input: {
	readonly answers: readonly AnswerRecord[];
	readonly profile: ProfileContract;
}): readonly Assumption[] {
	return input.answers
		.filter((answer) => answer.status === 'assumption')
		.map((answer) => {
			const question = getQuestionById(input.profile, answer.questionId);

			return {
				createdAt: answer.answeredAt,
				decisionIds: answer.mapsToDecisionIds ?? [],
				id: `assumption.${answer.questionId}`,
				questionId: answer.questionId,
				sourceAnswerId: answer.id,
				status: 'active',
				text:
					question?.text ??
					`User provided an assumption for ${answer.questionId}.`,
				value: answer.rawAnswer ?? answer.answer,
			};
		});
}

export function createIntakeSession(input: {
	readonly now?: Date;
	readonly profileId: string;
	readonly schemaVersion: string;
	readonly selection: QuestionSelection;
}): IntakeSession {
	const now = (input.now ?? new Date()).toISOString();

	return {
		acceptedFollowUpQuestionIds: [],
		activeQuestionIds: input.selection.questions.map((question) => question.id),
		currentPhaseId: input.selection.phaseId,
		currentQuestionSetId: input.selection.questionSet?.id ?? null,
		id: `session.${now.replaceAll(/[:.]/g, '-')}`,
		profileId: input.profileId,
		proposedFollowUpQuestions: [],
		schemaVersion: input.schemaVersion,
		skippedQuestionIds: [],
		startedAt: now,
		status: 'active',
		updatedAt: now,
	};
}

export function refreshSessionSelection(input: {
	readonly now?: Date;
	readonly selection: QuestionSelection;
	readonly session: IntakeSession;
}): IntakeSession {
	return {
		...input.session,
		activeQuestionIds: input.selection.questions.map((question) => question.id),
		currentPhaseId: input.selection.phaseId,
		currentQuestionSetId: input.selection.questionSet?.id ?? null,
		status: input.selection.questions.length === 0 ? 'completed' : 'active',
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export function markQuestionSkipped(input: {
	readonly now?: Date;
	readonly questionId: string;
	readonly session: IntakeSession;
}): IntakeSession {
	return {
		...input.session,
		skippedQuestionIds: [
			...new Set([...input.session.skippedQuestionIds, input.questionId]),
		],
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export function saveIntakeSession(input: {
	readonly now?: Date;
	readonly session: IntakeSession;
}): IntakeSession {
	return {
		...input.session,
		status: 'saved',
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export async function summarizeIntakeAnswer(input: {
	readonly profile: ProfileContract;
	readonly provider: LlmProvider;
	readonly question: ResolvedQuestion;
	readonly rawAnswer: unknown;
	readonly workspace: WorkspaceState;
}): Promise<string> {
	const prompt = buildPromptForAiOperation({
		input: {
			questionId: input.question.id,
			rawAnswer: input.rawAnswer,
		},
		operationId: 'summarize_answer',
		profile: input.profile,
		workspace: input.workspace,
	});
	const output = await runAiOperation(input.provider, prompt.request);

	return (output as AiOperationOutput<'summarize_answer'>).summary;
}

export async function generateProposedFollowUpQuestions(input: {
	readonly profile: ProfileContract;
	readonly provider: LlmProvider;
	readonly workspace: WorkspaceState;
}): Promise<readonly ProposedFollowUpQuestion[]> {
	const prompt = buildPromptForAiOperation({
		operationId: 'generate_follow_up_questions',
		profile: input.profile,
		workspace: input.workspace,
	});
	const output = await runAiOperation(input.provider, prompt.request);
	const now = new Date().toISOString();

	return (
		output as AiOperationOutput<'generate_follow_up_questions'>
	).questions.map((question) => ({
		createdAt: now,
		id: question.id,
		rationale: question.rationale,
		source: 'ai',
		status: 'proposed',
		text: question.text,
	}));
}

export async function recommendNextQuestionGroup(input: {
	readonly profile: ProfileContract;
	readonly provider: LlmProvider;
	readonly workspace: WorkspaceState;
}): Promise<
	AiOperationOutput<'recommend_next_question_group'>['recommendation']
> {
	const prompt = buildPromptForAiOperation({
		operationId: 'recommend_next_question_group',
		profile: input.profile,
		workspace: input.workspace,
	});
	const output = await runAiOperation(input.provider, prompt.request);

	return (output as AiOperationOutput<'recommend_next_question_group'>)
		.recommendation;
}

export function addProposedFollowUpsToSession(input: {
	readonly followUps: readonly ProposedFollowUpQuestion[];
	readonly now?: Date;
	readonly session: IntakeSession;
}): IntakeSession {
	const incomingIds = new Set(input.followUps.map((question) => question.id));

	return {
		...input.session,
		proposedFollowUpQuestions: [
			...input.session.proposedFollowUpQuestions.filter(
				(question) => !incomingIds.has(question.id),
			),
			...input.followUps,
		],
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export function acceptProposedFollowUps(input: {
	readonly followUpIds: readonly string[];
	readonly now?: Date;
	readonly session: IntakeSession;
}): IntakeSession {
	const requestedIds =
		input.followUpIds.length === 0
			? input.session.proposedFollowUpQuestions
					.filter((question) => question.status === 'proposed')
					.map((question) => question.id)
			: input.followUpIds;
	const requestedIdSet = new Set(requestedIds);

	return {
		...input.session,
		acceptedFollowUpQuestionIds: [
			...new Set([
				...input.session.acceptedFollowUpQuestionIds,
				...requestedIds,
			]),
		],
		proposedFollowUpQuestions: input.session.proposedFollowUpQuestions.map(
			(question) =>
				requestedIdSet.has(question.id)
					? { ...question, status: 'accepted' as const }
					: question,
		),
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export function parseAnswerValue(
	question: ResolvedQuestion,
	rawValue: string,
): unknown {
	switch (question.answerType) {
		case 'boolean':
			if (['true', 'yes', 'y'].includes(rawValue.toLowerCase())) {
				return true;
			}
			if (['false', 'no', 'n'].includes(rawValue.toLowerCase())) {
				return false;
			}
			throw new QuestionEngineError(
				`Answer for ${question.id} must be yes/no or true/false.`,
			);
		case 'choice':
			assertChoiceOption(question, rawValue);
			return rawValue;
		case 'multi_choice': {
			const values = rawValue
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean);

			if (values.length === 0) {
				throw new QuestionEngineError(
					`Answer for ${question.id} must include at least one option value.`,
				);
			}

			for (const value of values) {
				assertChoiceOption(question, value);
			}

			return values;
		}
		case 'number': {
			const parsed = Number(rawValue);

			if (!Number.isFinite(parsed)) {
				throw new QuestionEngineError(
					`Answer for ${question.id} must be a number.`,
				);
			}

			return parsed;
		}
		case 'text':
			return rawValue;
	}
}

export class QuestionEngineError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'QuestionEngineError';
	}
}

function resolveQuestion(
	question: Question,
	questionSet: QuestionSet,
	defaults: QuestionEngineDefaults,
): ResolvedQuestion {
	return {
		...question,
		allowAssumption: question.allowAssumption ?? defaults.allowAssumption,
		allowUnknown: question.allowUnknown ?? defaults.allowUnknown,
		phaseId: questionSet.phaseId,
		questionSetId: questionSet.id,
		questionSetTitle: questionSet.title,
	};
}

function getQuestionEngineDefaults(
	profile: ProfileContract,
): QuestionEngineDefaults {
	const defaults = profile.questionDefaults ?? defaultQuestionEngineDefaults;

	return {
		allowAssumption: defaults.allowAssumption,
		allowUnknown: defaults.allowUnknown,
		maxQuestionsPerRound: defaults.maxQuestionsPerRound,
	};
}

function getAnsweredQuestionIds(workspace: WorkspaceState): Set<string> {
	return new Set(workspace.answers.answers.map((answer) => answer.questionId));
}

function getMissingDecisionIds(
	profile: ProfileContract,
	workspace: WorkspaceState,
): Set<string> {
	const knownDecisionIds = new Set([
		...workspace.decisions.decisions
			.filter((decision) =>
				['assumed', 'confirmed', 'proposed'].includes(decision.status),
			)
			.map((decision) => decision.id),
		...workspace.answers.answers
			.filter((answer) => answer.status !== 'skipped')
			.flatMap((answer) => answer.mapsToDecisionIds ?? []),
	]);
	const profileDecisionIds = new Set(
		profile.questionSets.flatMap((questionSet) =>
			questionSet.questions.flatMap((question) => question.mapsToDecisionIds),
		),
	);

	return new Set(
		[...profileDecisionIds].filter(
			(decisionId) => !knownDecisionIds.has(decisionId),
		),
	);
}

function createAnswerId(questionId: string, answeredAt: string): string {
	return `answer.${questionId}.${answeredAt.replaceAll(/[:.]/g, '-')}`;
}

function assertChoiceOption(
	question: ResolvedQuestion,
	value: string,
): asserts question is ResolvedQuestion & {
	readonly options: readonly QuestionOption[];
} {
	if (!question.options?.some((option) => option.value === value)) {
		throw new QuestionEngineError(
			`Answer for ${question.id} must be one of: ${
				question.options?.map((option) => option.value).join(', ') ?? 'none'
			}.`,
		);
	}
}
