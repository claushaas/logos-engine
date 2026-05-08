import { describe, expect, it } from 'vitest';
import {
	createMockLlmProvider,
	defaultAiProviderConfig,
	deriveAssumptions,
	deriveOpenQuestions,
	generateProposedFollowUpQuestions,
	loadProfileById,
	recommendNextQuestionGroup,
	selectNextQuestionGroup,
	type WorkspaceState,
	workspaceSchemaVersion,
} from '../../src/index.js';

describe('question engine', () => {
	it('selects foundation questions first and respects the maximum group size', () => {
		const profile = loadProfileById('app-business');
		const selection = selectNextQuestionGroup({
			maxQuestions: 3,
			profile,
			workspace: createWorkspaceState(),
		});

		expect(selection.phaseId).toBe('00-intake');
		expect(selection.questionSet?.id).toBe('foundation');
		expect(selection.questions.map((question) => question.id)).toEqual([
			'foundation.idea',
			'foundation.primary_user',
			'foundation.problem',
		]);
		expect(selection.questions[0]).toMatchObject({
			allowAssumption: false,
			allowUnknown: false,
			helpText: expect.stringContaining('plain language'),
		});
	});

	it('moves to missing-decision-aware questions after answered foundation items', () => {
		const profile = loadProfileById('app-business');
		const workspace = createWorkspaceState({
			answers:
				profile.questionSets
					.find((set) => set.id === 'foundation')
					?.questions.map((question, index) => ({
						answer: `answer ${index}`,
						answeredAt: `2026-05-08T12:00:0${index}.000Z`,
						answerType: question.answerType,
						id: `answer.${question.id}`,
						mapsToDecisionIds: question.mapsToDecisionIds,
						phaseId: '00-intake',
						questionId: question.id,
						questionSetId: 'foundation',
						rawAnswer: `answer ${index}`,
						status: 'answered' as const,
						summary: `summary ${index}`,
					})) ?? [],
		});
		const selection = selectNextQuestionGroup({ profile, workspace });

		expect(selection.questionSet?.id).toBe('market');
		expect(selection.questions[0]?.id).toBe('market.category');
	});

	it('derives open questions and assumptions from explicit answer statuses', () => {
		const profile = loadProfileById('app-business');
		const workspace = createWorkspaceState({
			answers: [
				{
					answer: null,
					answeredAt: '2026-05-08T12:00:00.000Z',
					answerType: 'text',
					id: 'answer.unknown',
					mapsToDecisionIds: ['foundation.target_user'],
					phaseId: '00-intake',
					questionId: 'foundation.primary_user',
					questionSetId: 'foundation',
					rawAnswer: null,
					status: 'unknown',
					summary: 'Unknown.',
				},
				{
					answer: 'Solo founders',
					answeredAt: '2026-05-08T12:01:00.000Z',
					answerType: 'text',
					id: 'answer.assumption',
					mapsToDecisionIds: ['foundation.target_user'],
					phaseId: '00-intake',
					questionId: 'foundation.primary_user',
					questionSetId: 'foundation',
					rawAnswer: 'Solo founders',
					status: 'assumption',
					summary: 'Solo founders.',
				},
			],
		});

		expect(
			deriveOpenQuestions({
				answers: workspace.answers.answers,
				profile,
			}),
		).toMatchObject([
			{
				decisionIds: ['foundation.target_user'],
				questionId: 'foundation.primary_user',
				status: 'open',
			},
		]);
		expect(
			deriveAssumptions({
				answers: workspace.answers.answers,
				profile,
			}),
		).toMatchObject([
			{
				decisionIds: ['foundation.target_user'],
				questionId: 'foundation.primary_user',
				status: 'active',
				value: 'Solo founders',
			},
		]);
	});

	it('uses mocked AI operations for follow-up proposals and group recommendations', async () => {
		const profile = loadProfileById('app-business');
		const workspace = createWorkspaceState();
		const provider = createMockLlmProvider();

		await expect(
			generateProposedFollowUpQuestions({
				profile,
				provider,
				workspace,
			}),
		).resolves.toMatchObject([
			{
				id: 'mock.follow_up_1',
				source: 'ai',
				status: 'proposed',
			},
		]);
		await expect(
			recommendNextQuestionGroup({
				profile,
				provider,
				workspace,
			}),
		).resolves.toMatchObject({
			priority: 'medium',
			questionSetId: 'foundation',
		});
	});
});

const timestamp = '2026-05-08T12:00:00.000Z';

function createWorkspaceState(
	overrides: Partial<WorkspaceState['answers']> = {},
): WorkspaceState {
	return {
		answers: {
			answers: [],
			schemaVersion: workspaceSchemaVersion,
			...overrides,
		},
		config: {
			ai: defaultAiProviderConfig,
			schemaVersion: workspaceSchemaVersion,
		},
		decisions: {
			decisions: [],
			schemaVersion: workspaceSchemaVersion,
		},
		diagnostics: {
			diagnostics: [],
			generatedAt: timestamp,
			schemaVersion: workspaceSchemaVersion,
		},
		profileLock: {
			documentCount: 32,
			lockedAt: timestamp,
			profileId: 'app-business',
			profileName: 'App Business',
			profileVersion: '0.1.0',
			schemaVersion: workspaceSchemaVersion,
		},
		project: {
			createdAt: timestamp,
			profileId: 'app-business',
			projectName: 'Test Project',
			projectRoot: '.',
			schemaVersion: workspaceSchemaVersion,
			updatedAt: timestamp,
		},
	};
}
