/**
 * Tests for `invariant()`.
 */
import { describe, expect, it } from 'vitest';
import { invariant, LogosError } from '../../src/shared/index.js';

describe('invariant', () => {
	it('does not throw when condition is true', () => {
		expect(() => invariant(true, 'should not throw')).not.toThrow();
	});

	it('does not throw when condition is truthy', () => {
		expect(() => invariant(1, 'should not throw')).not.toThrow();
		expect(() => invariant('hello', 'should not throw')).not.toThrow();
		expect(() => invariant({}, 'should not throw')).not.toThrow();
	});

	it('throws LogosError when condition is false', () => {
		expect(() => invariant(false, 'condition was false')).toThrow(LogosError);
	});

	it('throws LogosError when condition is falsy (0, "", null, undefined)', () => {
		expect(() => invariant(0, 'zero')).toThrow(LogosError);
		expect(() => invariant('', 'empty string')).toThrow(LogosError);
		expect(() => invariant(null, 'null')).toThrow(LogosError);
		expect(() => invariant(undefined, 'undefined')).toThrow(LogosError);
	});

	it('uses code LOGOS_INVARIANT_VIOLATION', () => {
		try {
			invariant(false, 'broken invariant');
			expect.fail('should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(LogosError);
			expect((e as LogosError).code).toBe('LOGOS_INVARIANT_VIOLATION');
		}
	});

	it('uses category invalid_state', () => {
		try {
			invariant(false, 'broken invariant');
			expect.fail('should have thrown');
		} catch (e) {
			expect((e as LogosError).category).toBe('invalid_state');
		}
	});

	it('sets recoverable to false', () => {
		try {
			invariant(false, 'broken invariant');
			expect.fail('should have thrown');
		} catch (e) {
			expect((e as LogosError).recoverable).toBe(false);
		}
	});

	it('includes the message in the error', () => {
		try {
			invariant(false, 'node must have a profile');
			expect.fail('should have thrown');
		} catch (e) {
			expect((e as LogosError).message).toContain('node must have a profile');
		}
	});

	it('includes condition and message in details', () => {
		try {
			invariant(false, 'node must have a profile');
			expect.fail('should have thrown');
		} catch (e) {
			expect((e as LogosError).details).toEqual({
				condition: 'false',
				message: 'node must have a profile',
			});
		}
	});

	it('narrows the type after a successful assertion (TypeScript)', () => {
		const value: string | null = 'hello';
		invariant(value !== null, 'should not be null');
		// After assert, value is narrowed to string — no cast needed.
		const _length: number = value.length;
		expect(_length).toBe(5);
	});
});
