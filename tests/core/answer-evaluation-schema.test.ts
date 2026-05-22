import { describe, expect, it } from 'vitest';
import {
	ANSWER_EVALUATION_STATUS_VALUES,
	type AnswerEvaluation,
	type AnswerEvaluationStatus,
	answerEvaluationSchema,
	type ExtractedIntakeItem,
} from '../../src/core/evaluation/answer-evaluation.js';
import { validateAnswerEvaluation } from '../../src/core/evaluation/evaluation-validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidItem(
	overrides: Partial<ExtractedIntakeItem> = {},
): ExtractedIntakeItem {
	return {
		text: 'Example extracted fact.',
		...overrides,
	};
}

function makeValidEvaluation(
	overrides: Partial<AnswerEvaluation> = {},
): AnswerEvaluation {
	return {
		completenessScore: 0.9,
		extractedAssumptions: [],
		extractedDecisions: [],
		extractedFacts: [
			makeValidItem({ text: 'User stated scope is mobile-first.' }),
		],
		extractedRisks: [],
		missingAspects: [],
		questionId: 'q-1',
		shouldAdvance: true,
		status: 'sufficient',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnswerEvaluationStatus', () => {
	it('contains all expected values', () => {
		expect(ANSWER_EVALUATION_STATUS_VALUES).toEqual([
			'sufficient',
			'partial',
			'insufficient',
			'contradictory',
			'needs_clarification',
		]);
	});

	it('every allowed status is a valid AnswerEvaluationStatus', () => {
		for (const s of ANSWER_EVALUATION_STATUS_VALUES) {
			const _status: AnswerEvaluationStatus = s;
			expect(_status).toBe(s);
		}
	});
});

describe('validateAnswerEvaluation — valid evaluations', () => {
	// 1. sufficient
	it('accepts a valid sufficient evaluation', () => {
		const evaln = makeValidEvaluation({
			completenessScore: 0.9,
			shouldAdvance: true,
			status: 'sufficient',
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	// 2. partial
	it('accepts a valid partial evaluation', () => {
		const evaln = makeValidEvaluation({
			completenessScore: 0.5,
			missingAspects: ['budget constraints'],
			shouldAdvance: false,
			status: 'partial',
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	// 3. insufficient
	it('accepts a valid insufficient evaluation', () => {
		const evaln = makeValidEvaluation({
			completenessScore: 0.2,
			missingAspects: ['thesis', 'audience'],
			shouldAdvance: false,
			status: 'insufficient',
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	// 4. contradictory
	it('accepts a valid contradictory evaluation', () => {
		const evaln = makeValidEvaluation({
			completenessScore: 0.3,
			extractedRisks: [
				makeValidItem({ text: 'Conflicts with prior decision D1.' }),
			],
			missingAspects: ['resolution'],
			shouldAdvance: false,
			status: 'contradictory',
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	// 5. needs_clarification
	it('accepts a valid needs_clarification evaluation', () => {
		const evaln = makeValidEvaluation({
			completenessScore: 0.1,
			shouldAdvance: false,
			status: 'needs_clarification',
			suggestedFollowUp: 'Could you clarify what you mean by "scalable"?',
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	it('accepts evaluation with all optional fields included', () => {
		const evaln = makeValidEvaluation({
			extractedAssumptions: [
				makeValidItem({ confidence: 0.7, text: 'Assumes web-first.' }),
			],
			extractedDecisions: [makeValidItem({ text: 'Decided on TypeScript.' })],
			extractedFacts: [makeValidItem({ text: 'Team size is 3.' })],
			extractedRisks: [makeValidItem({ text: 'Risk: tight deadline.' })],
			metadata: { model: 'gpt-4' },
			missingAspects: ['budget'],
			suggestedFollowUp: 'What is the budget?',
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	it('accepts extracted items with optional fields', () => {
		const evaln = makeValidEvaluation({
			extractedFacts: [
				{
					confidence: 0.95,
					id: 'fact-1',
					metadata: { sourceLine: 3 },
					source: 'user-statement',
					text: 'The project targets mobile first.',
				},
			],
		});
		const result = validateAnswerEvaluation(evaln);
		expect(result.ok).toBe(true);
	});

	it('accepts completeness scores at boundaries (0 and 1)', () => {
		expect(
			validateAnswerEvaluation(
				makeValidEvaluation({
					completenessScore: 0,
					shouldAdvance: false,
					status: 'insufficient',
				}),
			).ok,
		).toBe(true);
		expect(
			validateAnswerEvaluation(makeValidEvaluation({ completenessScore: 1 }))
				.ok,
		).toBe(true);
	});
});

describe('validateAnswerEvaluation — invalid evaluations', () => {
	// 6. unknown status
	it('rejects an unknown status', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({ status: 'excellent' as AnswerEvaluationStatus }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.errors.some((e) => e.toLowerCase().includes('invalid')),
			).toBe(true);
		}
	});

	// 7. missing questionId
	it('rejects missing questionId', () => {
		const { questionId: _, ...rest } = makeValidEvaluation();
		const result = validateAnswerEvaluation(rest);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('questionId'))).toBe(true);
		}
	});

	it('rejects empty questionId', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({ questionId: '' }),
		);
		expect(result.ok).toBe(false);
	});

	// 8. completeness score below 0
	it('rejects completeness score below 0', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({ completenessScore: -0.1 }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('completenessScore'))).toBe(
				true,
			);
		}
	});

	// 9. completeness score above 1
	it('rejects completeness score above 1', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({ completenessScore: 1.5 }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('completenessScore'))).toBe(
				true,
			);
		}
	});

	// 10. missing shouldAdvance
	it('rejects missing shouldAdvance', () => {
		const { shouldAdvance: _, ...rest } = makeValidEvaluation({
			shouldAdvance: true,
		});
		const result = validateAnswerEvaluation(rest);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('shouldAdvance'))).toBe(true);
		}
	});

	// 11. extracted item without text
	it('rejects extracted item without text', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({
				extractedFacts: [{ confidence: 0.8 } as ExtractedIntakeItem],
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('text'))).toBe(true);
		}
	});

	it('rejects extracted item with empty text', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({
				extractedFacts: [makeValidItem({ text: '' })],
			}),
		);
		expect(result.ok).toBe(false);
	});

	// 12. non-array extracted fields
	it('rejects non-array extractedFacts', () => {
		const result = validateAnswerEvaluation(
			// @ts-expect-error testing runtime
			{ ...makeValidEvaluation(), extractedFacts: 'not-an-array' },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('extractedFacts'))).toBe(
				true,
			);
		}
	});

	it('rejects non-array extractedAssumptions', () => {
		const result = validateAnswerEvaluation(
			// @ts-expect-error testing runtime
			{ ...makeValidEvaluation(), extractedAssumptions: 'not-an-array' },
		);
		expect(result.ok).toBe(false);
	});

	it('rejects non-array extractedDecisions', () => {
		const result = validateAnswerEvaluation(
			// @ts-expect-error testing runtime
			{ ...makeValidEvaluation(), extractedDecisions: 123 },
		);
		expect(result.ok).toBe(false);
	});

	it('rejects non-array extractedRisks', () => {
		const result = validateAnswerEvaluation(
			// @ts-expect-error testing runtime
			{ ...makeValidEvaluation(), extractedRisks: null },
		);
		expect(result.ok).toBe(false);
	});

	// 13. non-object metadata
	it('rejects non-object metadata', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({
				metadata: 'not-an-object' as unknown as Record<string, unknown>,
			}),
		);
		expect(result.ok).toBe(false);
	});

	// --- non-object input ---
	it('rejects null input', () => {
		const result = validateAnswerEvaluation(null);
		expect(result.ok).toBe(false);
	});

	it('rejects string input', () => {
		const result = validateAnswerEvaluation('hello');
		expect(result.ok).toBe(false);
	});

	// --- missing required arrays ---
	it('rejects missing extractedFacts array', () => {
		const { extractedFacts: _, ...rest } = makeValidEvaluation();
		const result = validateAnswerEvaluation(rest);
		expect(result.ok).toBe(false);
	});

	it('rejects missing missingAspects array', () => {
		const { missingAspects: _, ...rest } = makeValidEvaluation();
		const result = validateAnswerEvaluation(rest);
		expect(result.ok).toBe(false);
	});

	// --- suggestedFollowUp must be non-empty ---
	it('rejects empty suggestedFollowUp', () => {
		const result = validateAnswerEvaluation(
			makeValidEvaluation({ suggestedFollowUp: '' }),
		);
		expect(result.ok).toBe(false);
	});

	// --- does not throw ---
	it('never throws for normal invalid input', () => {
		expect(() => validateAnswerEvaluation(null)).not.toThrow();
		expect(() => validateAnswerEvaluation(undefined)).not.toThrow();
		expect(() => validateAnswerEvaluation({})).not.toThrow();
	});
});

describe('validateAnswerEvaluation — JSON serializability', () => {
	it('returns JSON-serializable valid output', () => {
		const result = validateAnswerEvaluation(makeValidEvaluation());
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(true);
	});

	it('returns JSON-serializable error output', () => {
		const result = validateAnswerEvaluation({ status: 'nope' });
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(false);
		expect(Array.isArray(parsed.errors)).toBe(true);
	});
});

describe('answerEvaluationSchema (zod)', () => {
	it('parses a valid sufficient evaluation', () => {
		const parsed = answerEvaluationSchema.safeParse(makeValidEvaluation());
		expect(parsed.success).toBe(true);
	});

	it('rejects an unknown status', () => {
		const parsed = answerEvaluationSchema.safeParse(
			makeValidEvaluation({ status: 'great' as AnswerEvaluationStatus }),
		);
		expect(parsed.success).toBe(false);
	});

	it('strips unknown top-level fields', () => {
		const parsed = answerEvaluationSchema.safeParse({
			...makeValidEvaluation(),
			extra: 'should-be-removed',
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data).not.toHaveProperty('extra');
		}
	});
});
