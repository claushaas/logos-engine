import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMockLlmProvider } from '../../src/ai/mock-provider.js';
import {
	type ConversationTurnInterpretation,
	interpretConversationTurn,
} from '../../src/application/conversation-interpreter.js';
import {
	receiveAiDecisionProposals,
	reviewProposedDecision,
} from '../../src/application/decision-service.js';
import {
	addConversationTurn,
	createConversationSession,
} from '../../src/domain/conversation-model.js';
import { createEmptyDecisionStore } from '../../src/domain/decision-registry.js';
import { loadProfileById } from '../../src/domain/profile-loader.js';
import type { WorkspaceState } from '../../src/domain/workspace-state.js';
import { readWorkspaceState } from '../../src/domain/workspace-state.js';
import {
	createEmptyAnswersState,
	createEmptyDecisionsState,
	writeAnswersState,
	writeDecisionsState,
} from '../../src/index.js';
import { atomicWriteJsonFile } from '../../src/storage/safe-file-writes.js';

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-interp-'));
	mkdirSync(join(projectRoot, '.git'));
	mkdirSync(join(projectRoot, '.logos', 'sessions'), { recursive: true });
	return projectRoot;
}

function createMinimalWorkspace(projectRoot: string): WorkspaceState {
	const answers = createEmptyAnswersState();
	const decisions = createEmptyDecisionsState();

	writeAnswersState(projectRoot, answers);
	writeDecisionsState(projectRoot, decisions);

	const projectJson = {
		createdAt: '2026-05-08T12:00:00.000Z',
		profileId: 'app-business',
		projectName: 'test-project',
		projectRoot: '.',
		schemaVersion: '0.1.0',
		updatedAt: '2026-05-08T12:00:00.000Z',
	};

	const profileLockJson = {
		documentCount: 26,
		lockedAt: '2026-05-08T12:00:00.000Z',
		profileId: 'app-business',
		profileName: 'App Business',
		profileVersion: '0.2.0',
		schemaVersion: '0.1.0',
	};

	const configJson = {
		ai: {
			enabled: true,
			endpoint: null,
			model: null,
			provider: 'mock' as const,
			remoteContextDisclosureAccepted: true,
			timeoutMs: null,
			tokenSource: null,
		},
		schemaVersion: '0.1.0',
	};

	const diagnosticsJson = {
		diagnostics: [],
		generatedAt: '2026-05-08T12:00:00.000Z',
		schemaVersion: '0.1.0',
	};

	atomicWriteJsonFile(join(projectRoot, '.logos', 'project.json'), projectJson);
	atomicWriteJsonFile(
		join(projectRoot, '.logos', 'profile.lock.json'),
		profileLockJson,
	);
	atomicWriteJsonFile(join(projectRoot, '.logos', 'config.json'), configJson);
	atomicWriteJsonFile(
		join(projectRoot, '.logos', 'diagnostics.json'),
		diagnosticsJson,
	);

	return readWorkspaceState(projectRoot);
}

describe('conversation interpreter — AI response schemas and validation', () => {
	it('interprets a user turn into structured records', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content:
				'I want to build a subscription tracking app for small businesses. The app should be mobile-first and help users track recurring costs.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [
					{
						assumptionId: 'assumption.conv.test.1',
						confidence: 0.7,
						relatedDecisionIds: ['business.model'],
						text: 'Assuming the revenue model will be subscription-based.',
					},
				],
				decisionProposals: [
					{
						confidence: 0.9,
						decisionId: 'product.platform',
						rationale: 'User explicitly stated mobile-first.',
						suggestedTitle: 'Platform is mobile-first',
						suggestedValue: 'mobile',
					},
					{
						confidence: 0.8,
						decisionId: 'product.target_audience',
						rationale: 'User mentioned small businesses.',
						suggestedTitle: 'Target audience is small businesses',
						suggestedValue: 'small_businesses',
					},
				],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.conv.test.1',
						relatedDecisionIds: ['business.pricing'],
						text: 'What pricing tier structure should the app use?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.conv.test.1',
						confidence: 0.95,
						normalizedSummary:
							'User wants a mobile-first subscription tracking app for small businesses.',
					},
				],
				notes: ['Interpretation from mock provider.'],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('ok');
		expect(result.turnId).toBe(userTurn.id);
		expect(result.interpretation).not.toBeNull();

		const interp = result.interpretation as ConversationTurnInterpretation;

		expect(interp.answerRecords).toHaveLength(1);
		expect(interp.answerRecords[0].status).toBe('answered');
		expect(interp.answerRecords[0].rawAnswer).toBe(userTurn.content);
		expect(interp.answerRecords[0].summary).toBe(
			'User wants a mobile-first subscription tracking app for small businesses.',
		);

		expect(interp.decisionProposals).toHaveLength(2);
		expect(interp.decisionProposals[0].decisionId).toBe('product.platform');
		expect(interp.decisionProposals[0].suggestedValue).toBe('mobile');

		expect(interp.assumptions).toHaveLength(1);
		expect(interp.assumptions[0].id).toBe('assumption.conv.test.1');
		expect(interp.assumptions[0].status).toBe('active');

		expect(interp.openQuestions).toHaveLength(1);
		expect(interp.openQuestions[0].id).toBe('open.conv.test.1');
		expect(interp.openQuestions[0].status).toBe('open');
	});

	it('preserves raw user text separately from normalized summaries', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const rawMessage =
			'I think maybe something like a project management tool but I am not sure about the specifics yet.';
		const withTurn = addConversationTurn({
			content: rawMessage,
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [],
				decisionProposals: [],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.uncertain.1',
						relatedDecisionIds: [],
						text: 'What specific problem does the project management tool solve?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.vague.1',
						confidence: 0.4,
						normalizedSummary:
							'User is considering a project management tool but is uncertain about specifics.',
					},
				],
				status: 'needs_review',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: rawMessage, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('ok');
		expect(result.interpretation).not.toBeNull();

		const interp = result.interpretation as ConversationTurnInterpretation;

		expect(interp.answerRecords[0].rawAnswer).toBe(rawMessage);
		expect(interp.answerRecords[0].summary).not.toBe(rawMessage);
		expect(interp.answerRecords[0].summary).toBe(
			'User is considering a project management tool but is uncertain about specifics.',
		);
	});

	it('filters out confirmed AI status from interpretation output', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'My app will use React Native.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [],
				decisionProposals: [],
				identifiedOpenQuestions: [],
				interpretedAnswers: [],
				status: 'confirmed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('malformed');
		expect(result.interpretation).toBeNull();
	});
});

describe('conversation interpreter — decision proposals and confirmation gating', () => {
	it('AI-generated decisions enter as proposed, never confirmed', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'We should use AWS for hosting and PostgreSQL for the database.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [],
				decisionProposals: [
					{
						confidence: 0.85,
						decisionId: 'tech.hosting',
						rationale: 'User mentioned AWS hosting.',
						suggestedTitle: 'Hosting is AWS',
						suggestedValue: 'aws',
					},
					{
						confidence: 0.85,
						decisionId: 'tech.database',
						rationale: 'User mentioned PostgreSQL.',
						suggestedTitle: 'Database is PostgreSQL',
						suggestedValue: 'postgresql',
					},
				],
				identifiedOpenQuestions: [],
				interpretedAnswers: [
					{
						answerId: 'answer.tech.1',
						confidence: 0.9,
						normalizedSummary: 'User specified AWS hosting and PostgreSQL.',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('ok');
		expect(result.interpretation).not.toBeNull();

		const interp = result.interpretation as ConversationTurnInterpretation;

		const decisionStore = createEmptyDecisionStore();
		const { store: updatedStore } = receiveAiDecisionProposals(
			decisionStore,
			interp.decisionProposals,
		);

		for (const decision of updatedStore.decisions) {
			expect(decision.status).toBe('proposed');
			expect(decision.status).not.toBe('confirmed');
		}
	});

	it('confirmed decisions require explicit user confirmation via the decision service', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'The app should be offline-first.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [],
				decisionProposals: [
					{
						confidence: 0.9,
						decisionId: 'tech.offline_first',
						rationale: 'User stated offline-first.',
						suggestedTitle: 'Offline-first strategy',
						suggestedValue: true,
					},
				],
				identifiedOpenQuestions: [],
				interpretedAnswers: [
					{
						answerId: 'answer.offline.1',
						confidence: 0.95,
						normalizedSummary: 'User wants offline-first app.',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		const interp = result.interpretation as ConversationTurnInterpretation;

		let store = createEmptyDecisionStore();
		const { store: withProposals } = receiveAiDecisionProposals(
			store,
			interp.decisionProposals,
		);
		store = withProposals;

		expect(store.decisions[0].status).toBe('proposed');

		reviewProposedDecision(
			store,
			'tech.offline_first',
			'confirm',
			'User explicitly confirmed.',
		);

		expect(store.decisions[0].status).toBe('confirmed');
	});

	it('does not create decisions when AI provides none', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'I am just exploring ideas. Nothing decided yet.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [],
				decisionProposals: [],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.explore.1',
						relatedDecisionIds: [],
						text: 'What problem domain is most interesting?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.explore.1',
						confidence: 0.5,
						normalizedSummary: 'User is in exploration phase.',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('ok');
		expect(result.interpretation).not.toBeNull();

		const interp = result.interpretation as ConversationTurnInterpretation;
		expect(interp.decisionProposals).toHaveLength(0);
	});
});

describe('conversation interpreter — assumptions and unknowns', () => {
	it('classifies assumptions from user statements', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content:
				'I assume most users will be on Android, but I have not validated that.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [
					{
						assumptionId: 'assumption.android.1',
						confidence: 0.4,
						relatedDecisionIds: ['product.target_platform'],
						text: 'Most users will be on Android — needs validation.',
					},
				],
				decisionProposals: [],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.platform.1',
						relatedDecisionIds: ['product.target_platform'],
						text: 'What is the actual platform distribution of the target audience?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.platform.1',
						confidence: 0.3,
						normalizedSummary:
							'User assumes Android dominance but acknowledges uncertainty.',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('ok');
		expect(result.interpretation).not.toBeNull();

		const interp = result.interpretation as ConversationTurnInterpretation;

		expect(interp.assumptions.length).toBeGreaterThanOrEqual(1);
		expect(interp.assumptions[0].status).toBe('active');
		expect(interp.assumptions[0].text).toContain('Android');

		expect(interp.openQuestions.length).toBeGreaterThanOrEqual(1);
		expect(interp.openQuestions[0].status).toBe('open');
	});

	it('assumptions and unknowns remain separate from confirmed decisions', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'I do not know the pricing yet. I assume freemium could work.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [
					{
						assumptionId: 'assumption.pricing.1',
						confidence: 0.4,
						relatedDecisionIds: ['business.pricing'],
						text: 'Freemium model assumed without validation.',
					},
				],
				decisionProposals: [],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.pricing.1',
						relatedDecisionIds: ['business.pricing'],
						text: 'What pricing model should the app use?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.pricing.1',
						confidence: 0.3,
						normalizedSummary:
							'User assumes freemium pricing but does not know the specific model.',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		const interp = result.interpretation as ConversationTurnInterpretation;

		expect(interp.assumptions.length).toBeGreaterThanOrEqual(1);
		expect(interp.openQuestions.length).toBeGreaterThanOrEqual(1);
		expect(interp.decisionProposals).toHaveLength(0);
	});
});

describe('conversation interpreter — malformed AI output handling', () => {
	it('returns malformed status for incomplete AI output', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'Build a todo app.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				status: 'draft',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('malformed');
		expect(result.interpretation).toBeNull();
	});

	it('returns malformed when AI output has missing required arrays', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'Build a todo app.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				decisionProposals: [
					{
						confidence: 0.9,
						decisionId: 'product.type',
						rationale: 'User wants a todo app.',
						suggestedTitle: 'App type is todo',
						suggestedValue: 'todo',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('malformed');
		expect(result.interpretation).toBeNull();
	});
});

describe('conversation interpreter — provider failure handling', () => {
	it('returns provider_failure when provider throws', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'Test message.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = {
			...createMockLlmProvider(),
			complete: async () => {
				throw new Error('Network error');
			},
		};

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('provider_failure');
		expect(result.interpretation).toBeNull();
		expect(result.turnId).toBe(userTurn.id);
	});

	it('does not corrupt workspace state on provider failure', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'Test message.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const originalDecisionCount = workspace.decisions.decisions.length;

		const provider = {
			...createMockLlmProvider(),
			complete: async () => {
				throw new Error('Connection refused');
			},
		};

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('provider_failure');

		const updatedWorkspace = readWorkspaceState(projectRoot);

		expect(updatedWorkspace.decisions.decisions).toHaveLength(
			originalDecisionCount,
		);
	});
});

describe('conversation interpreter — source linking', () => {
	it('links answer records, proposals, assumptions, and open questions to conversation turns', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content:
				'We will target enterprise customers with a SaaS model on web and mobile.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [
					{
						assumptionId: 'assumption.link.1',
						confidence: 0.6,
						relatedDecisionIds: ['business.model'],
						text: 'Assuming SaaS is the right model for enterprise.',
					},
				],
				decisionProposals: [
					{
						confidence: 0.9,
						decisionId: 'product.target_audience',
						rationale: 'User stated enterprise customers.',
						suggestedTitle: 'Target audience is enterprise',
						suggestedValue: 'enterprise',
					},
				],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.link.1',
						relatedDecisionIds: [],
						text: 'What specific enterprise vertical?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.link.1',
						confidence: 0.9,
						normalizedSummary: 'User wants enterprise SaaS on web and mobile.',
					},
				],
				status: 'proposed',
			},
		});

		const result = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(result.status).toBe('ok');
		expect(result.interpretation).not.toBeNull();

		const interp = result.interpretation as ConversationTurnInterpretation;

		expect(interp.answerRecords).toHaveLength(1);
		expect(interp.answerRecords[0].id).toBe('answer.link.1');

		expect(interp.decisionProposals).toHaveLength(1);
		expect(interp.decisionProposals[0].sourceAnswerIds).toContain(userTurn.id);

		expect(interp.assumptions).toHaveLength(1);
		expect(interp.assumptions[0].id).toBe('assumption.link.1');

		expect(interp.openQuestions).toHaveLength(1);
		expect(interp.openQuestions[0].id).toBe('open.link.1');
	});

	it('conversation turn stores sourceLinks with interpreted record ids', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'Build a privacy-focused messaging app.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [
					{
						assumptionId: 'assumption.src.1',
						confidence: 0.5,
						relatedDecisionIds: [],
						text: 'Assuming end-to-end encryption is required.',
					},
				],
				decisionProposals: [
					{
						confidence: 0.9,
						decisionId: 'product.type',
						rationale: 'User wants a messaging app.',
						suggestedTitle: 'App type is messaging',
						suggestedValue: 'messaging',
					},
				],
				identifiedOpenQuestions: [
					{
						openQuestionId: 'open.src.1',
						relatedDecisionIds: [],
						text: 'What compliance requirements apply?',
					},
				],
				interpretedAnswers: [
					{
						answerId: 'answer.src.1',
						confidence: 0.9,
						normalizedSummary: 'User wants privacy-focused messaging.',
					},
				],
				status: 'proposed',
			},
		});

		const interpResult = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		expect(interpResult.status).toBe('ok');

		const interp =
			interpResult.interpretation as ConversationTurnInterpretation;

		const sourceLinks = {
			answerIds: interp.answerRecords.map((a) => a.id),
			assumptionIds: interp.assumptions.map((a) => a.sourceAnswerId),
			openQuestionIds: interp.openQuestions.map((o) => o.sourceAnswerId),
			proposalIds: [] as string[],
		};

		const decisionStore = createEmptyDecisionStore();
		const { createdIds } = receiveAiDecisionProposals(
			decisionStore,
			interp.decisionProposals,
		);
		sourceLinks.proposalIds = [...createdIds];

		expect(sourceLinks.answerIds).toHaveLength(1);
		expect(sourceLinks.assumptionIds).toHaveLength(1);
		expect(sourceLinks.openQuestionIds).toHaveLength(1);
		expect(sourceLinks.proposalIds).toHaveLength(1);

		const updatedTurns = withTurn.turns.map((turn) =>
			turn.id === userTurn.id ? { ...turn, sourceLinks } : turn,
		);

		const updatedSession = { ...withTurn, turns: updatedTurns };
		const updatedUserTurn = updatedSession.turns[0];

		expect(updatedUserTurn.sourceLinks.answerIds).toHaveLength(1);
		expect(updatedUserTurn.sourceLinks.assumptionIds).toHaveLength(1);
		expect(updatedUserTurn.sourceLinks.openQuestionIds).toHaveLength(1);
		expect(updatedUserTurn.sourceLinks.proposalIds).toHaveLength(1);
	});
});

describe('conversation interpreter — confirms no auto-confirmation', () => {
	it('AI proposals never become confirmed without explicit user action', async () => {
		const projectRoot = createProjectRoot();
		const workspace = createMinimalWorkspace(projectRoot);
		const profile = loadProfileById('app-business');

		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: '0.1.0',
		});

		const withTurn = addConversationTurn({
			content: 'We must support iOS and Android.',
			role: 'user',
			session,
		});

		const userTurn = withTurn.turns[0];

		const provider = createMockLlmProvider({
			interpret_conversation_turn: {
				classifiedAssumptions: [],
				decisionProposals: [
					{
						confidence: 0.95,
						decisionId: 'product.platforms',
						rationale: 'User explicitly stated iOS and Android.',
						suggestedTitle: 'Platforms are iOS and Android',
						suggestedValue: ['ios', 'android'],
					},
				],
				identifiedOpenQuestions: [],
				interpretedAnswers: [
					{
						answerId: 'answer.auto.1',
						confidence: 0.95,
						normalizedSummary: 'User wants iOS and Android support.',
					},
				],
				status: 'proposed',
			},
		});

		const interpResult = await interpretConversationTurn({
			conversationHistory: [{ content: userTurn.content, role: 'user' }],
			profile,
			provider,
			turn: userTurn,
			workspace,
		});

		const interp =
			interpResult.interpretation as ConversationTurnInterpretation;

		let store = createEmptyDecisionStore();
		const { store: withProposals } = receiveAiDecisionProposals(
			store,
			interp.decisionProposals,
		);
		store = withProposals;

		expect(store.decisions[0].status).toBe('proposed');
		expect(store.decisions[0].status).not.toBe('confirmed');

		reviewProposedDecision(
			store,
			'product.platforms',
			'confirm',
			'Confirmed by user.',
		);

		expect(store.decisions[0].status).toBe('confirmed');
	});
});
