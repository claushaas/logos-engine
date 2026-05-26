/**
 * Tests for `Result<T, E>` discriminated union and helpers.
 */
import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, type Result } from '../../src/shared/index.js';

describe('Result', () => {
	describe('ok() constructor', () => {
		it('creates a success result with ok: true', () => {
			const result = ok(42);
			expect(result.ok).toBe(true);
			expect(result).toHaveProperty('value', 42);
		});

		it('wraps any value type', () => {
			const obj = { name: 'test' };
			const result = ok(obj);
			expect(result.ok).toBe(true);
			expect((result as { value: typeof obj }).value).toBe(obj);
		});
	});

	describe('err() constructor', () => {
		it('creates a failure result with ok: false', () => {
			const result = err('something went wrong');
			expect(result.ok).toBe(false);
			expect(result).toHaveProperty('error', 'something went wrong');
		});

		it('wraps any error type', () => {
			const result = err({ code: 404, message: 'Not Found' });
			expect(result.ok).toBe(false);
			expect(
				(result as { error: { code: number; message: string } }).error.code,
			).toBe(404);
		});
	});

	describe('isOk() type guard', () => {
		it('returns true for ok results', () => {
			const result: Result<number, string> = ok(10);
			expect(isOk(result)).toBe(true);
		});

		it('returns false for err results', () => {
			const result: Result<number, string> = err('fail');
			expect(isOk(result)).toBe(false);
		});

		it('narrows the type so value is accessible', () => {
			const result: Result<number, string> = ok(10);
			if (isOk(result)) {
				// This line narrows — value should be number without cast
				const doubled: number = result.value * 2;
				expect(doubled).toBe(20);
			} else {
				expect.fail('expected ok result');
			}
		});

		it('narrows to the error variant in the else branch', () => {
			const result: Result<number, string> = err('fail');
			if (isOk(result)) {
				expect.fail('expected err result');
			} else {
				expect(result.error).toBe('fail');
			}
		});
	});

	describe('isErr() type guard', () => {
		it('returns true for err results', () => {
			const result: Result<number, string> = err('fail');
			expect(isErr(result)).toBe(true);
		});

		it('returns false for ok results', () => {
			const result: Result<number, string> = ok(10);
			expect(isErr(result)).toBe(false);
		});

		it('narrows the type so error is accessible', () => {
			const result: Result<number, string> = err('fail');
			if (isErr(result)) {
				expect(result.error).toBe('fail');
			} else {
				expect.fail('expected err result');
			}
		});
	});

	describe('discriminated union behavior', () => {
		it('ok property discriminates in switch', () => {
			const process = (r: Result<number, string>): string => {
				if (r.ok) return `value: ${r.value}`;
				return `error: ${r.error}`;
			};

			expect(process(ok(7))).toBe('value: 7');
			expect(process(err('boom'))).toBe('error: boom');
		});
	});
});
