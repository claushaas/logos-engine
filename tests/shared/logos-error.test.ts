/**
 * Tests for `LogosError` base class.
 */
import { describe, expect, it } from 'vitest';
import { LogosError } from '../../src/shared/index.js';
import type { ErrorCategory } from '../../src/shared/index.js';

describe('LogosError', () => {
	it('is an instance of Error', () => {
		const err = new LogosError('TEST_ERR', 'validation', 'test message');
		expect(err).toBeInstanceOf(Error);
	});

	it('is an instance of LogosError', () => {
		const err = new LogosError('TEST_ERR', 'validation', 'test message');
		expect(err).toBeInstanceOf(LogosError);
	});

	it('has name "LogosError"', () => {
		const err = new LogosError('TEST_ERR', 'validation', 'test message');
		expect(err.name).toBe('LogosError');
	});

	it('stores the code', () => {
		const err = new LogosError('MY_CODE', 'validation', 'test message');
		expect(err.code).toBe('MY_CODE');
	});

	it('stores the category', () => {
		const err = new LogosError('MY_CODE', 'persistence', 'test message');
		expect(err.category).toBe('persistence');
	});

	it('stores the message (inherited from Error)', () => {
		const err = new LogosError('MY_CODE', 'validation', 'descriptive message');
		expect(err.message).toBe('descriptive message');
	});

	it('defaults recoverable to false', () => {
		const err = new LogosError('MY_CODE', 'validation', 'test');
		expect(err.recoverable).toBe(false);
	});

	it('accepts recoverable: true', () => {
		const err = new LogosError('MY_CODE', 'llm_provider', 'timeout', {
			recoverable: true,
		});
		expect(err.recoverable).toBe(true);
	});

	it('defaults userFacingMessage to the message', () => {
		const err = new LogosError('MY_CODE', 'validation', 'internal message');
		expect(err.userFacingMessage).toBe('internal message');
	});

	it('accepts a distinct userFacingMessage', () => {
		const err = new LogosError('MY_CODE', 'validation', 'internal', {
			userFacingMessage: 'Something went wrong. Please try again.',
		});
		expect(err.userFacingMessage).toBe(
			'Something went wrong. Please try again.',
		);
	});

	it('defaults details to an empty object', () => {
		const err = new LogosError('MY_CODE', 'validation', 'test');
		expect(err.details).toEqual({});
	});

	it('stores details', () => {
		const err = new LogosError('MY_CODE', 'materialization', 'stale source', {
			details: { documentId: 'doc-1', staleNodes: ['node-a'] },
		});
		expect(err.details).toEqual({
			documentId: 'doc-1',
			staleNodes: ['node-a'],
		});
	});

	it('accepts cause (ES2022 Error.cause)', () => {
		const cause = new Error('root cause');
		const err = new LogosError('WRAP', 'llm_provider', 'wrapped', {
			cause,
		});
		expect(err.cause).toBe(cause);
	});

	it('covers all specified categories', () => {
		const categories: ErrorCategory[] = [
			'validation',
			'invalid_state',
			'llm_provider',
			'structured_output',
			'persistence',
			'profile_schema',
			'materialization',
			'tui_rendering',
			'export',
		];

		for (const cat of categories) {
			const err = new LogosError('TEST', cat, 'test');
			expect(err.category).toBe(cat);
		}
	});
});
