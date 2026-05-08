import { createMockLlmProvider } from '../ai/mock-provider.js';
import {
	createDecision,
	type DecisionStore,
	getDecisionById,
	upsertDecision,
} from '../domain/decision-registry.js';
import { loadProfileById } from '../domain/profile-loader.js';
import {
	acceptProposedFollowUps,
	addProposedFollowUpsToSession,
	createAnswerRecord,
	createIntakeSession,
	deriveAssumptions,
	deriveOpenQuestions,
	generateProposedFollowUpQuestions,
	getQuestionById,
	markQuestionSkipped,
	parseAnswerValue,
	type ResolvedQuestion,
	recommendNextQuestionGroup,
	refreshSessionSelection,
	saveIntakeSession,
	selectNextQuestionGroup,
	summarizeIntakeAnswer,
	upsertAnswer,
} from '../domain/question-engine.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import {
	readCurrentIntakeSession,
	writeAnswersState,
	writeCurrentIntakeSession,
	writeDecisionsState,
} from '../storage/intake-state.js';
import type { ApplicationCommandResult } from './logos-application-service.js';

export async function continueGuidedIntake(
	projectRoot: string,
	args: readonly string[],
): Promise<ApplicationCommandResult> {
	const action = args[0] ?? 'show';

	try {
		switch (action) {
			case 'show':
				return await showNextQuestionGroup(projectRoot);
			case 'answer':
				return await recordAnsweredQuestion(projectRoot, args);
			case 'unknown':
				return recordUnknownQuestion(projectRoot, args);
			case 'assume':
				return await recordAssumptionQuestion(projectRoot, args);
			case 'skip':
				return recordSkippedQuestion(projectRoot, args);
			case 'save':
				return saveCurrentIntake(projectRoot);
			case 'propose-followups':
				return await proposeFollowUps(projectRoot);
			case 'accept-followups':
				return acceptFollowUps(projectRoot, args.slice(1));
			default:
				return {
					body: [
						`Unknown /continue action: ${action}`,
						'Use /continue, /continue answer <question-id> <answer>, /continue unknown <question-id>, /continue assume <question-id> <answer>, /continue skip <question-id>, /continue propose-followups, /continue accept-followups --all, or /continue save.',
					],
					status: 'error',
					title: 'Intake command failed',
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			body: [
				message,
				'No AI proposal was confirmed. Confirmed decisions remain unchanged.',
			],
			status: 'error',
			title: 'Guided intake failed',
		};
	}
}

async function showNextQuestionGroup(
	projectRoot: string,
): Promise<ApplicationCommandResult> {
	const { profile, session, workspace } = loadIntakeContext(projectRoot);
	const selection = selectNextQuestionGroup({ profile, session, workspace });
	const nextSession = session
		? refreshSessionSelection({ selection, session })
		: createIntakeSession({
				profileId: profile.id,
				schemaVersion: workspace.project.schemaVersion,
				selection,
			});
	const provider = createMockLlmProvider();
	const recommendation = await recommendNextQuestionGroup({
		profile,
		provider,
		workspace,
	});

	writeCurrentIntakeSession(projectRoot, nextSession);

	if (selection.questions.length === 0) {
		return {
			body: [
				'No unanswered profile questions remain.',
				`Session status: ${nextSession.status}`,
			],
			status: 'ok',
			title: 'Intake complete',
		};
	}

	return {
		body: [
			`Phase: ${selection.phaseId}`,
			`Question group: ${selection.questionSet?.title ?? 'Unknown'}`,
			`Selection reason: ${selection.reason}`,
			`AI recommended next group: ${recommendation.questionSetId} (${recommendation.priority}) - ${recommendation.rationale}`,
			'',
			...selection.questions.flatMap(formatQuestion),
			'',
			'Answer with /continue answer <question-id> <answer>.',
			'Other actions: /continue unknown <question-id>, /continue assume <question-id> <answer>, /continue skip <question-id>, /continue propose-followups, /continue save.',
		],
		status: 'ok',
		title: 'Guided intake',
	};
}

async function recordAnsweredQuestion(
	projectRoot: string,
	args: readonly string[],
): Promise<ApplicationCommandResult> {
	const questionId = requireArg(args, 1, 'question id');
	const rawText = requireRest(args, 2, 'answer');
	const { profile, workspace } = loadIntakeContext(projectRoot);
	const question = requireQuestion(profile, questionId);
	const rawAnswer = parseAnswerValue(question, rawText);
	const provider = createMockLlmProvider();
	const summary = await summarizeIntakeAnswer({
		profile,
		provider,
		question,
		rawAnswer,
		workspace,
	});
	const answer = createAnswerRecord({
		question,
		rawAnswer,
		status: 'answered',
		summary,
	});
	const answers = upsertAnswer(workspace.answers.answers, answer);

	writeAnswersState(projectRoot, {
		...workspace.answers,
		answers: [...answers],
	});

	return {
		body: [
			`Stored answer for ${question.id}.`,
			`Raw answer remains in .logos/answers.json; summary: ${summary}`,
			'No confirmed decisions were changed.',
		],
		status: 'ok',
		title: 'Answer stored',
	};
}

function recordUnknownQuestion(
	projectRoot: string,
	args: readonly string[],
): ApplicationCommandResult {
	const questionId = requireArg(args, 1, 'question id');
	const { profile, workspace } = loadIntakeContext(projectRoot);
	const question = requireQuestion(profile, questionId);

	if (!question.allowUnknown) {
		throw new Error(`Question ${question.id} does not allow unknown answers.`);
	}

	const answer = createAnswerRecord({
		question,
		rawAnswer: null,
		status: 'unknown',
		summary: 'Unknown answer recorded for later clarification.',
	});
	const answers = upsertAnswer(workspace.answers.answers, answer);
	const openQuestions = deriveOpenQuestions({ answers, profile });
	const decisionStore = upsertMappedDecisions({
		decisionIds: question.mapsToDecisionIds,
		existing: { decisions: workspace.decisions.decisions },
		rationale: `User marked ${question.id} as unknown during guided intake.`,
		status: 'unknown',
		value: null,
	});

	writeAnswersState(projectRoot, {
		...workspace.answers,
		answers: [...answers],
	});
	writeDecisionsState(projectRoot, {
		...workspace.decisions,
		decisions: decisionStore.decisions,
	});

	return {
		body: [
			`Stored unknown answer for ${question.id}.`,
			`Open questions now derived from answers: ${openQuestions.length}`,
			'Related decisions remain unresolved until the user confirms them later.',
		],
		status: 'ok',
		title: 'Open question created',
	};
}

async function recordAssumptionQuestion(
	projectRoot: string,
	args: readonly string[],
): Promise<ApplicationCommandResult> {
	const questionId = requireArg(args, 1, 'question id');
	const rawText = requireRest(args, 2, 'assumption');
	const { profile, workspace } = loadIntakeContext(projectRoot);
	const question = requireQuestion(profile, questionId);

	if (!question.allowAssumption) {
		throw new Error(`Question ${question.id} does not allow assumptions.`);
	}

	const rawAnswer = parseAnswerValue(question, rawText);
	const provider = createMockLlmProvider();
	const summary = await summarizeIntakeAnswer({
		profile,
		provider,
		question,
		rawAnswer,
		workspace,
	});
	const answer = createAnswerRecord({
		question,
		rawAnswer,
		status: 'assumption',
		summary,
	});
	const answers = upsertAnswer(workspace.answers.answers, answer);
	const assumptions = deriveAssumptions({ answers, profile });
	const decisionStore = upsertMappedDecisions({
		decisionIds: question.mapsToDecisionIds,
		existing: { decisions: workspace.decisions.decisions },
		rationale: `User marked ${question.id} as an assumption during guided intake.`,
		status: 'assumed',
		value: rawAnswer,
	});

	writeAnswersState(projectRoot, {
		...workspace.answers,
		answers: [...answers],
	});
	writeDecisionsState(projectRoot, {
		...workspace.decisions,
		decisions: decisionStore.decisions,
	});

	return {
		body: [
			`Stored assumption for ${question.id}.`,
			`Assumptions now derived from answers: ${assumptions.length}`,
			`Summary: ${summary}`,
			'The assumption is not a confirmed decision.',
		],
		status: 'ok',
		title: 'Assumption stored',
	};
}

function recordSkippedQuestion(
	projectRoot: string,
	args: readonly string[],
): ApplicationCommandResult {
	const questionId = requireArg(args, 1, 'question id');
	const { profile, session, workspace } = loadIntakeContext(projectRoot);
	const question = requireQuestion(profile, questionId);
	const answer = createAnswerRecord({
		question,
		rawAnswer: null,
		status: 'skipped',
		summary: 'Skipped during this intake round.',
	});
	const answers = upsertAnswer(workspace.answers.answers, answer);
	const currentSession =
		session ??
		createIntakeSession({
			profileId: profile.id,
			schemaVersion: workspace.project.schemaVersion,
			selection: selectNextQuestionGroup({ profile, workspace }),
		});
	const nextSession = markQuestionSkipped({
		questionId,
		session: currentSession,
	});

	writeAnswersState(projectRoot, {
		...workspace.answers,
		answers: [...answers],
	});
	writeCurrentIntakeSession(projectRoot, nextSession);

	return {
		body: [
			`Skipped ${question.id} for this intake session.`,
			'The skipped answer is stored separately from unknown and assumption answers.',
		],
		status: 'ok',
		title: 'Question skipped',
	};
}

function saveCurrentIntake(projectRoot: string): ApplicationCommandResult {
	const { profile, session, workspace } = loadIntakeContext(projectRoot);
	const currentSession =
		session ??
		createIntakeSession({
			profileId: profile.id,
			schemaVersion: workspace.project.schemaVersion,
			selection: selectNextQuestionGroup({ profile, workspace }),
		});
	const nextSession = saveIntakeSession({ session: currentSession });

	writeCurrentIntakeSession(projectRoot, nextSession);

	return {
		body: [
			`Saved intake session ${nextSession.id}.`,
			'Run /continue to resume from structured state.',
		],
		status: 'ok',
		title: 'Intake saved',
	};
}

async function proposeFollowUps(
	projectRoot: string,
): Promise<ApplicationCommandResult> {
	const { profile, session, workspace } = loadIntakeContext(projectRoot);
	const provider = createMockLlmProvider();
	const followUps = await generateProposedFollowUpQuestions({
		profile,
		provider,
		workspace,
	});
	const currentSession =
		session ??
		createIntakeSession({
			profileId: profile.id,
			schemaVersion: workspace.project.schemaVersion,
			selection: selectNextQuestionGroup({ profile, workspace }),
		});
	const nextSession = addProposedFollowUpsToSession({
		followUps,
		session: currentSession,
	});

	writeCurrentIntakeSession(projectRoot, nextSession);

	return {
		body: [
			'AI-generated follow-up questions were stored as proposed.',
			'They are not canonical profile questions and are not active until accepted.',
			...followUps.map(
				(question) =>
					`- ${question.id}: ${question.text} (${question.rationale})`,
			),
			'Accept them with /continue accept-followups --all or /continue accept-followups <id>.',
		],
		status: 'ok',
		title: 'Follow-ups proposed',
	};
}

function acceptFollowUps(
	projectRoot: string,
	args: readonly string[],
): ApplicationCommandResult {
	const { profile, session, workspace } = loadIntakeContext(projectRoot);

	if (!session) {
		throw new Error('No intake session exists. Run /continue first.');
	}

	const ids = args.includes('--all') ? [] : args;
	const nextSession = acceptProposedFollowUps({
		followUpIds: ids,
		session,
	});
	const accepted = nextSession.proposedFollowUpQuestions.filter(
		(question) => question.status === 'accepted',
	);

	writeCurrentIntakeSession(projectRoot, nextSession);

	return {
		body: [
			`Accepted follow-up questions: ${accepted.length}`,
			...accepted.map((question) => `- ${question.id}: ${question.text}`),
			`Profile ${profile.id} remains the canonical question source; accepted follow-ups are session-scoped.`,
			`Current saved answers: ${workspace.answers.answers.length}`,
		],
		status: 'ok',
		title: 'Follow-ups accepted',
	};
}

function loadIntakeContext(projectRoot: string) {
	const workspace = readWorkspaceState(projectRoot);
	const profile = loadProfileById(workspace.project.profileId);
	const session = readCurrentIntakeSession(projectRoot);

	return {
		profile,
		session,
		workspace,
	};
}

function requireQuestion(
	profile: ReturnType<typeof loadProfileById>,
	questionId: string,
): ResolvedQuestion {
	const question = getQuestionById(profile, questionId);

	if (!question) {
		throw new Error(`Unknown profile question: ${questionId}`);
	}

	return question;
}

function requireArg(
	args: readonly string[],
	index: number,
	label: string,
): string {
	const value = args[index];

	if (!value) {
		throw new Error(`Missing ${label}.`);
	}

	return value;
}

function requireRest(
	args: readonly string[],
	index: number,
	label: string,
): string {
	const value = args.slice(index).join(' ').trim();

	if (!value) {
		throw new Error(`Missing ${label}.`);
	}

	return value;
}

function formatQuestion(question: ResolvedQuestion): readonly string[] {
	return [
		`[${question.id}] ${question.text}`,
		`  Help: ${question.helpText}`,
		...(question.examples && question.examples.length > 0
			? ['  Examples:', ...question.examples.map((example) => `  - ${example}`)]
			: []),
		...(question.options && question.options.length > 0
			? [
					'  Options:',
					...question.options.map(
						(option) =>
							`  - ${option.value}: ${option.label} - ${option.description}`,
					),
				]
			: []),
	];
}

function upsertMappedDecisions(input: {
	readonly decisionIds: readonly string[];
	readonly existing: DecisionStore;
	readonly rationale: string;
	readonly status: 'unknown' | 'assumed';
	readonly value: unknown;
}): DecisionStore {
	const mappedIds = new Set(input.decisionIds);
	const confirmedIds = new Set(
		input.existing.decisions
			.filter((decision) => decision.status === 'confirmed')
			.map((decision) => decision.id),
	);
	let store = input.existing;

	for (const decisionId of input.decisionIds) {
		if (confirmedIds.has(decisionId)) {
			continue;
		}

		const existing = getDecisionById(store, decisionId);

		if (existing) {
			store = upsertDecision(
				store,
				createDecision({
					...existing,
					rationale: input.rationale,
					status: input.status,
					value: input.value,
				}),
			);
		} else {
			store = upsertDecision(
				store,
				createDecision({
					id: decisionId,
					rationale: input.rationale,
					status: input.status,
					title: decisionId,
					value: input.value,
				}),
			);
		}
	}

	return {
		decisions: store.decisions
			.filter(
				(decision) =>
					!mappedIds.has(decision.id) ||
					decision.status === 'confirmed' ||
					decision.status === input.status,
			)
			.sort((left, right) => left.id.localeCompare(right.id)),
	};
}
