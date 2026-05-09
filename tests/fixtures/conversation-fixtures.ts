import type { FixtureResponseMap } from '../../src/ai/fixture-provider.js';

export const fullConversationFixture: FixtureResponseMap = {
	interpret_conversation_turn: {
		finishReason: 'stop',
		model: 'fixture-conversation',
		output: {
			classifiedAssumptions: [],
			decisionProposals: [
				{
					confidence: 0.85,
					decisionId: 'foundation.idea',
					rationale:
						'User described a fitness scheduling app for personal trainers',
					suggestedTitle: 'App Idea: Fitness scheduling for personal trainers',
					suggestedValue:
						'Building a fitness scheduling and client management app for personal trainers',
				},
			],
			identifiedOpenQuestions: [
				{
					openQuestionId: 'open.conv.fixture.1',
					relatedDecisionIds: ['foundation.problem'],
					text: 'What specific problem does this solve that existing calendar tools do not?',
				},
			],
			interpretedAnswers: [
				{
					answerId: 'answer.conv.fixture.1',
					confidence: 0.9,
					matchedQuestionId: 'foundation.idea',
					normalizedSummary:
						'Fitness scheduling and client management app for personal trainers',
				},
			],
			notes: [],
			status: 'proposed',
		},
	},
	lead_intake_turn: {
		finishReason: 'stop',
		model: 'fixture-conversation',
		output: {
			nextMove: 'ask_question',
			rationale:
				'The project context needs a clear problem statement to help identify target users and scope.',
			response:
				"That's a great start! Let me understand the problem better. What specific pain point does your app solve for personal trainers? How do they currently handle this without your app?",
			status: 'proposed',
			suggestedQuestion:
				'What specific problem does your app solve for personal trainers? What is their current alternative?',
		},
	},
	recommend_next_conversation_move: {
		finishReason: 'stop',
		model: 'fixture-conversation',
		output: {
			move: 'ask_about_problem',
			notes: [],
			phaseId: '00-intake',
			priority: 'high',
			rationale:
				'The user has described their app idea but needs to clarify the core problem, target user, and current alternatives.',
			status: 'proposed',
		},
	},
};

export const conversationTranscript: {
	role: string;
	content: string;
}[] = [
	{
		content:
			"I'm building a scheduling app for personal trainers to manage their clients and sessions.",
		role: 'user',
	},
	{
		content:
			"That's a great start! Let me understand the problem better. What specific pain point does your app solve for personal trainers? How do they currently handle this without your app?",
		role: 'ai',
	},
	{
		content:
			"Trainers currently use a mix of Google Calendar, WhatsApp, and spreadsheets. It's messy. They waste hours on admin.",
		role: 'user',
	},
];
