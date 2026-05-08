import { describe, expect, it } from 'vitest';
import {
	AiResponseValidationError,
	aiOperationIds,
	aiOperationRegistry,
	validateAiOperationOutput,
} from '../../src/index.js';

describe('AI operation contracts', () => {
	it('registers all Phase 4 V1 operations as non-mutating operations', () => {
		expect(aiOperationIds).toEqual([
			'generate_follow_up_questions',
			'summarize_answer',
			'extract_decision_proposals',
			'classify_assumptions',
			'identify_gaps',
			'identify_risks',
			'draft_document_section',
			'recommend_next_question_group',
		]);
		expect(
			aiOperationRegistry.every((operation) => !operation.mutatesProjectState),
		).toBe(true);
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
});
