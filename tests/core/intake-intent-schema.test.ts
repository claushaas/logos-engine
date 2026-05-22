import { describe, expect, it } from 'vitest';
import {
	INTAKE_USER_INTENT_VALUES,
	type IntakeIntentClassification,
	type IntakeUserIntent,
	intakeIntentClassificationSchema,
	validateIntakeIntentClassification,
} from '../../src/core/intake/intake-user-intent.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidClassification(
	overrides: Partial<IntakeIntentClassification> = {},
): IntakeIntentClassification {
	return {
		confidence: 0.9,
		intent: 'answer_current_question',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntakeUserIntent', () => {
	it('contains all expected values', () => {
		expect(INTAKE_USER_INTENT_VALUES).toEqual([
			'answer_current_question',
			'ask_question_about_current_question',
			'revise_previous_answer',
			'pause_intake',
			'skip_current_question',
			'request_status',
			'request_generation',
			'out_of_scope',
		]);
	});

	it('every allowed value is a valid IntakeUserIntent', () => {
		for (const intent of INTAKE_USER_INTENT_VALUES) {
			const classification = makeValidClassification({ intent });
			const result = validateIntakeIntentClassification(classification);
			expect(result.ok, `intent "${intent}" should be valid`).toBe(true);
		}
	});
});

describe('validateIntakeIntentClassification', () => {
	// --- valid input ---

	it('accepts a valid classification with all required fields', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification(),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.classification.intent).toBe('answer_current_question');
			expect(result.classification.confidence).toBe(0.9);
		}
	});

	it('accepts a valid classification with optional fields', () => {
		const classification = makeValidClassification({
			metadata: { source: 'classifier-v1' },
			reason: 'User answered clearly.',
			targetQuestionId: 'q-1',
		});
		const result = validateIntakeIntentClassification(classification);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.classification.reason).toBe('User answered clearly.');
			expect(result.classification.targetQuestionId).toBe('q-1');
			expect(result.classification.metadata).toEqual({
				source: 'classifier-v1',
			});
		}
	});

	it('preserves valid optional targetQuestionId', () => {
		const classification = makeValidClassification({
			targetQuestionId: 'q-42',
		});
		const result = validateIntakeIntentClassification(classification);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.classification.targetQuestionId).toBe('q-42');
		}
	});

	it('accepts confidence at the lower boundary (0)', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({ confidence: 0 }),
		);
		expect(result.ok).toBe(true);
	});

	it('accepts confidence at the upper boundary (1)', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({ confidence: 1 }),
		);
		expect(result.ok).toBe(true);
	});

	it('accepts missing optional fields', () => {
		// Only required fields present
		const classification = { confidence: 0.5, intent: 'skip_current_question' };
		const result = validateIntakeIntentClassification(classification);
		expect(result.ok).toBe(true);
	});

	// --- invalid: intent ---

	it('rejects an unknown intent value', () => {
		const result = validateIntakeIntentClassification({
			confidence: 0.8,
			intent: 'not_a_valid_intent',
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
			expect(
				result.errors.some((e) => e.toLowerCase().includes('invalid')),
			).toBe(true);
		}
	});

	it('rejects missing intent field', () => {
		const result = validateIntakeIntentClassification({
			confidence: 0.8,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	it('rejects a null intent', () => {
		const result = validateIntakeIntentClassification({
			confidence: 0.8,
			intent: null,
		});
		expect(result.ok).toBe(false);
	});

	// --- invalid: confidence ---

	it('rejects confidence below 0', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({ confidence: -0.1 }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('confidence'))).toBe(true);
		}
	});

	it('rejects confidence above 1', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({ confidence: 1.5 }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.includes('confidence'))).toBe(true);
		}
	});

	it('rejects non-number confidence', () => {
		const result = validateIntakeIntentClassification({
			confidence: 'high',
			intent: 'answer_current_question',
		});
		expect(result.ok).toBe(false);
	});

	// --- invalid: metadata ---

	it('rejects non-object metadata (string)', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({
				metadata: 'not-an-object' as unknown as Record<string, unknown>,
			}),
		);
		expect(result.ok).toBe(false);
	});

	it('rejects non-object metadata (array)', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({
				metadata: ['a', 'b'] as unknown as Record<string, unknown>,
			}),
		);
		expect(result.ok).toBe(false);
	});

	it('rejects non-object metadata (number)', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({
				metadata: 42 as unknown as Record<string, unknown>,
			}),
		);
		expect(result.ok).toBe(false);
	});

	// --- unknown fields ---

	it('strips unknown top-level fields (strict canonical output)', () => {
		const classification = makeValidClassification({
			// @ts-expect-error testing runtime stripping
			extraField: 'should-be-removed',
		} as IntakeIntentClassification);
		const result = validateIntakeIntentClassification(classification);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.classification).not.toHaveProperty('extraField');
		}
	});

	// --- non-object input ---

	it('rejects null input', () => {
		const result = validateIntakeIntentClassification(null);
		expect(result.ok).toBe(false);
	});

	it('rejects string input', () => {
		const result = validateIntakeIntentClassification('hello');
		expect(result.ok).toBe(false);
	});

	it('rejects number input', () => {
		const result = validateIntakeIntentClassification(42);
		expect(result.ok).toBe(false);
	});

	it('rejects array input', () => {
		const result = validateIntakeIntentClassification([1, 2, 3]);
		expect(result.ok).toBe(false);
	});

	// --- does not throw ---

	it('never throws for normal invalid input', () => {
		expect(() => validateIntakeIntentClassification(null)).not.toThrow();
		expect(() => validateIntakeIntentClassification(undefined)).not.toThrow();
		expect(() =>
			validateIntakeIntentClassification({ intent: 'invalid' }),
		).not.toThrow();
	});

	// --- JSON serializability ---

	it('returns JSON-serializable output', () => {
		const result = validateIntakeIntentClassification(
			makeValidClassification({ reason: 'test' }),
		);
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(result.ok);
	});

	it('returns JSON-serializable error output', () => {
		const result = validateIntakeIntentClassification({
			confidence: 2,
			intent: 'unknown',
		});
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.ok).toBe(false);
		expect(Array.isArray(parsed.errors)).toBe(true);
	});

	// --- zod schema ---

	it('zod schema parses a valid classification', () => {
		const parsed = intakeIntentClassificationSchema.safeParse(
			makeValidClassification(),
		);
		expect(parsed.success).toBe(true);
	});

	it('zod schema rejects an invalid intent at parse time', () => {
		const parsed = intakeIntentClassificationSchema.safeParse({
			confidence: 0.5,
			intent: 'not-allowed',
		});
		expect(parsed.success).toBe(false);
	});
});

describe('IntakeUserIntent type exhaustiveness', () => {
	it('covers all union members in the values array', () => {
		// If a value is in the array it must also be assignable to the type.
		for (const v of INTAKE_USER_INTENT_VALUES) {
			const _intent: IntakeUserIntent = v;
			expect(_intent).toBe(v);
		}
	});
});
