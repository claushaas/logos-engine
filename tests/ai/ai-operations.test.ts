import { describe, expect, it } from 'vitest';
import {
	AiResponseValidationError,
	aiOperationIds,
	aiOperationRegistry,
	createMockLlmProvider,
	runAiOperation,
	validateAiOperationOutput,
} from '../../src/index.js';

describe('AI operation contracts', () => {
	it('registers all Phase 15 V1 operations as non-mutating operations', () => {
		expect(aiOperationIds).toEqual([
			'generate_follow_up_questions',
			'summarize_answer',
			'extract_decision_proposals',
			'classify_assumptions',
			'identify_gaps',
			'identify_risks',
			'draft_document_section',
			'recommend_next_question_group',
			'lead_intake_turn',
			'recommend_next_conversation_move',
			'interpret_conversation_turn',
		]);
		expect(
			aiOperationRegistry.every((operation) => !operation.mutatesProjectState),
		).toBe(true);
	});

	it('includes lead_intake_turn and recommend_next_conversation_move in the operation registry', () => {
		const leadOp = aiOperationRegistry.find(
			(op) => op.id === 'lead_intake_turn',
		);
		const moveOp = aiOperationRegistry.find(
			(op) => op.id === 'recommend_next_conversation_move',
		);

		expect(leadOp).toBeDefined();
		expect(leadOp?.outputStatus).toBe('proposed');
		expect(leadOp?.mutatesProjectState).toBe(false);

		expect(moveOp).toBeDefined();
		expect(moveOp?.outputStatus).toBe('proposed');
		expect(moveOp?.mutatesProjectState).toBe(false);
	});

	it('rejects malformed AI output before use', () => {
		expect(() =>
			validateAiOperationOutput('summarize_answer', {
				status: 'draft',
			}),
		).toThrow(AiResponseValidationError);
	});

	it('rejects AI output that attempts to become confirmed', () => {
		expect(() =>
			validateAiOperationOutput('extract_decision_proposals', {
				proposals: [],
				status: 'confirmed',
			}),
		).toThrow(AiResponseValidationError);
	});

	it('validates lead_intake_turn output requires suggestedQuestion when asking a question', () => {
		expect(() =>
			validateAiOperationOutput('lead_intake_turn', {
				nextMove: 'ask_question',
				rationale: 'testing',
				response: 'What is your idea?',
				status: 'proposed',
			}),
		).toThrow(AiResponseValidationError);
	});

	it('accepts valid lead_intake_turn output', () => {
		const result = validateAiOperationOutput('lead_intake_turn', {
			nextMove: 'resume',
			rationale: 'User wants to continue.',
			response: 'Welcome back! Where would you like to continue?',
			status: 'proposed',
		});

		expect(result).toMatchObject({
			nextMove: 'resume',
			status: 'proposed',
		});
	});

	it('accepts valid recommend_next_conversation_move output', () => {
		const result = validateAiOperationOutput(
			'recommend_next_conversation_move',
			{
				move: 'ask_foundation_question',
				phaseId: '00-intake',
				priority: 'high',
				rationale: 'Best to start with the basics.',
				status: 'proposed',
			},
		);

		expect(result).toMatchObject({
			move: 'ask_foundation_question',
			priority: 'high',
			status: 'proposed',
		});
	});

	it('mock provider returns valid output for conversation-first operations', async () => {
		const provider = createMockLlmProvider();

		const leadResult = await runAiOperation(provider, {
			input: {},
			messages: [{ content: 'test', role: 'user' }],
			operationId: 'lead_intake_turn',
		});

		expect(leadResult).toMatchObject({
			nextMove: 'ask_question',
			status: 'proposed',
		});

		const moveResult = await runAiOperation(provider, {
			input: {},
			messages: [{ content: 'test', role: 'user' }],
			operationId: 'recommend_next_conversation_move',
		});

		expect(moveResult).toMatchObject({
			move: 'ask_foundation_question',
			status: 'proposed',
		});
	});

	it('includes interpret_conversation_turn in the operation registry', () => {
		const interpOp = aiOperationRegistry.find(
			(op) => op.id === 'interpret_conversation_turn',
		);

		expect(interpOp).toBeDefined();
		expect(interpOp?.outputStatus).toBe('proposed');
		expect(interpOp?.mutatesProjectState).toBe(false);
		expect(interpOp?.description).toContain('Interpret');
	});

	it('validates interpret_conversation_turn output schema', () => {
		const result = validateAiOperationOutput('interpret_conversation_turn', {
			classifiedAssumptions: [
				{
					assumptionId: 'assumption.1',
					confidence: 0.6,
					relatedDecisionIds: ['product.target_audience'],
					text: 'Assuming the target audience is college students.',
				},
			],
			decisionProposals: [
				{
					confidence: 0.9,
					decisionId: 'product.platform',
					rationale: 'User mentioned mobile focus.',
					suggestedTitle: 'Platform is mobile-first',
					suggestedValue: 'mobile',
				},
			],
			identifiedOpenQuestions: [
				{
					openQuestionId: 'open.1',
					relatedDecisionIds: ['business.pricing'],
					text: 'How will the app generate revenue?',
				},
			],
			interpretedAnswers: [
				{
					answerId: 'answer.conv.1.0',
					confidence: 0.9,
					normalizedSummary: 'User wants to build a study tool for mobile.',
					phaseId: '00-intake',
				},
			],
			notes: ['Interpretation complete.'],
			status: 'proposed',
		});

		expect(result.status).toBe('proposed');
		expect(result.interpretedAnswers).toHaveLength(1);
		expect(result.decisionProposals).toHaveLength(1);
		expect(result.classifiedAssumptions).toHaveLength(1);
		expect(result.identifiedOpenQuestions).toHaveLength(1);
	});

	it('rejects interpret_conversation_turn output with confirmed status', () => {
		expect(() =>
			validateAiOperationOutput('interpret_conversation_turn', {
				classifiedAssumptions: [],
				decisionProposals: [],
				identifiedOpenQuestions: [],
				interpretedAnswers: [],
				status: 'confirmed',
			}),
		).toThrow(AiResponseValidationError);
	});

	it('rejects malformed interpret_conversation_turn output', () => {
		expect(() =>
			validateAiOperationOutput('interpret_conversation_turn', {
				status: 'proposed',
			}),
		).toThrow(AiResponseValidationError);
	});
});
