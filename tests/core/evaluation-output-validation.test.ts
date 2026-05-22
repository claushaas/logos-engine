import { describe, expect, it } from 'vitest';
import type { AnswerEvaluation } from '../../src/core/evaluation/answer-evaluation.js';
import {
	validateAnswerEvaluation,
	validateEvaluationAdvancementConsistency,
} from '../../src/core/evaluation/evaluation-validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEval(overrides: Partial<AnswerEvaluation> = {}): AnswerEvaluation {
	return {
		completenessScore: 0.9,
		extractedAssumptions: [],
		extractedDecisions: [],
		extractedFacts: [{ text: 'Example fact.' }],
		extractedRisks: [],
		missingAspects: [],
		questionId: 'q-1',
		shouldAdvance: true,
		status: 'sufficient',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Consistency rule tests
// ---------------------------------------------------------------------------

describe('evaluation advancement consistency', () => {
	// 1. sufficient with shouldAdvance: true and high score passes
	it('sufficient with shouldAdvance: true and high score passes', () => {
		const ev = makeEval({
			completenessScore: 0.95,
			shouldAdvance: true,
			status: 'sufficient',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(true);
	});

	// 2. sufficient with low score fails
	it('sufficient with shouldAdvance: true and low score fails', () => {
		const ev = makeEval({
			completenessScore: 0.5,
			shouldAdvance: true,
			status: 'sufficient',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.errors.some((e) => e.includes('completenessScore >= 0.8')),
			).toBe(true);
		}
	});

	it('sufficient with low score but shouldAdvance: false passes (no conflict)', () => {
		const ev = makeEval({
			completenessScore: 0.3,
			shouldAdvance: false,
			status: 'sufficient',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(true);
	});

	// 3. partial with shouldAdvance: true fails
	it('partial with shouldAdvance: true fails', () => {
		const ev = makeEval({
			missingAspects: ['budget'],
			shouldAdvance: true,
			status: 'partial',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('partial'))).toBe(true);
		}
	});

	// 4. insufficient with shouldAdvance: true fails
	it('insufficient with shouldAdvance: true fails', () => {
		const ev = makeEval({
			shouldAdvance: true,
			status: 'insufficient',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('insufficient'))).toBe(true);
		}
	});

	// 5. needs_clarification with shouldAdvance: true fails
	it('needs_clarification with shouldAdvance: true fails', () => {
		const ev = makeEval({
			shouldAdvance: true,
			status: 'needs_clarification',
			suggestedFollowUp: 'What do you mean?',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('needs_clarification'))).toBe(
				true,
			);
		}
	});

	// 6. contradictory with shouldAdvance: true fails
	it('contradictory with shouldAdvance: true fails', () => {
		const ev = makeEval({
			shouldAdvance: true,
			status: 'contradictory',
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('contradictory'))).toBe(true);
		}
	});

	// 7. partial without missing aspects and without suggested follow-up — warns
	it('partial without missingAspects and without suggestedFollowUp warns', () => {
		const ev = makeEval({
			missingAspects: [],
			shouldAdvance: false,
			status: 'partial',
			suggestedFollowUp: undefined,
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(
				result.warnings.some(
					(w) =>
						w.includes('missingAspects') || w.includes('suggestedFollowUp'),
				),
			).toBe(true);
		}
	});

	// 8. needs_clarification without suggested follow-up — warns
	it('needs_clarification without suggestedFollowUp warns', () => {
		const ev = makeEval({
			shouldAdvance: false,
			status: 'needs_clarification',
			suggestedFollowUp: undefined,
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.warnings.some((w) => w.includes('suggestedFollowUp'))).toBe(
				true,
			);
		}
	});

	// 9. contradictory without missing aspects, follow-up, or risks — warns
	it('contradictory without missingAspects, suggestedFollowUp, or extractedRisks warns', () => {
		const ev = makeEval({
			extractedRisks: [],
			missingAspects: [],
			shouldAdvance: false,
			status: 'contradictory',
			suggestedFollowUp: undefined,
		});
		const result = validateAnswerEvaluation(ev);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(
				result.warnings.some(
					(w) => w.includes('contradictory') || w.includes('missingAspects'),
				),
			).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Standalone validateEvaluationAdvancementConsistency
// ---------------------------------------------------------------------------

describe('validateEvaluationAdvancementConsistency', () => {
	it('returns empty array for a fully consistent evaluation', () => {
		const ev = makeEval({
			completenessScore: 0.9,
			shouldAdvance: true,
			status: 'sufficient',
		});
		const issues = validateEvaluationAdvancementConsistency(ev);
		expect(issues).toEqual([]);
	});

	it('returns errors for partial with shouldAdvance: true', () => {
		const ev = makeEval({
			missingAspects: ['x'],
			shouldAdvance: true,
			status: 'partial',
		});
		const issues = validateEvaluationAdvancementConsistency(ev);
		expect(
			issues.some((i) => i.includes('[error]') && i.includes('partial')),
		).toBe(true);
	});

	it('returns warnings for partial without missing aspects', () => {
		const ev = makeEval({
			missingAspects: [],
			shouldAdvance: false,
			status: 'partial',
			suggestedFollowUp: undefined,
		});
		const issues = validateEvaluationAdvancementConsistency(ev);
		expect(issues.some((i) => !i.includes('[error]'))).toBe(true);
	});

	it('handles sufficient with shouldAdvance: false (no errors or warnings)', () => {
		const ev = makeEval({
			completenessScore: 0.5,
			shouldAdvance: false,
			status: 'sufficient',
		});
		const issues = validateEvaluationAdvancementConsistency(ev);
		expect(issues.some((i) => i.includes('[error]'))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Structured error output (never throws)
// ---------------------------------------------------------------------------

describe('validation returns structured errors and does not throw', () => {
	it('returns ok: false with errors for invalid status', () => {
		const result = validateAnswerEvaluation(
			makeEval({ status: 'unexpected' as 'sufficient' }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	it('returns ok: false with errors for missing required field', () => {
		const result = validateAnswerEvaluation({ status: 'sufficient' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	it('returns ok: true with warnings for advisory issues', () => {
		const result = validateAnswerEvaluation(
			makeEval({
				missingAspects: [],
				shouldAdvance: false,
				status: 'needs_clarification',
				suggestedFollowUp: undefined,
			}),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.warnings.length).toBeGreaterThan(0);
		}
	});

	it('never throws for null', () => {
		expect(() => validateAnswerEvaluation(null)).not.toThrow();
	});

	it('never throws for undefined', () => {
		expect(() => validateAnswerEvaluation(undefined)).not.toThrow();
	});

	it('never throws for empty object', () => {
		expect(() => validateAnswerEvaluation({})).not.toThrow();
	});

	it('never throws for array', () => {
		expect(() => validateAnswerEvaluation([1, 2, 3])).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Validated output is JSON-serializable
// ---------------------------------------------------------------------------

describe('validated output is JSON-serializable', () => {
	it('valid output round-trips through JSON', () => {
		const result = validateAnswerEvaluation(
			makeEval({
				completenessScore: 0.9,
				extractedFacts: [{ confidence: 0.9, id: 'f1', text: 'Fact A' }],
				shouldAdvance: true,
				status: 'sufficient',
				suggestedFollowUp: undefined,
			}),
		);
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const restored = JSON.parse(json) as typeof result;
		expect(restored.ok).toBe(result.ok);
	});

	it('error output round-trips through JSON', () => {
		const result = validateAnswerEvaluation({
			completenessScore: -1,
			questionId: '',
			shouldAdvance: 'yes',
			status: 'nope',
		});
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const restored = JSON.parse(json) as typeof result;
		expect(restored.ok).toBe(false);
		expect(Array.isArray(restored.errors)).toBe(true);
	});

	it('warnings output round-trips through JSON', () => {
		const result = validateAnswerEvaluation(
			makeEval({
				missingAspects: [],
				shouldAdvance: false,
				status: 'needs_clarification',
				suggestedFollowUp: undefined,
			}),
		);
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const restored = JSON.parse(json) as typeof result;
		expect(restored.ok).toBe(true);
		expect(Array.isArray(restored.warnings)).toBe(true);
	});
});
