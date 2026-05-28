/**
 * Unit tests for error categorization — `RuntimeErrorCategory` and
 * compatibility between `RuntimeError` interface and `LogosError` class.
 */
import { describe, expect, it } from 'vitest';
import type { RuntimeError, RuntimeErrorCategory } from '../../src/diagnostics/index.js';
import { LogosError } from '../../src/shared/index.js';

// ─── RuntimeErrorCategory coverage ─────────────────────────────────────────

describe('RuntimeErrorCategory', () => {
	const allCategories: RuntimeErrorCategory[] = [
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

	it('includes all 9 specified categories', () => {
		expect(allCategories).toHaveLength(9);
	});

	for (const category of allCategories) {
		it(`accepts LogosError with category "${category}"`, () => {
			const err = new LogosError('TEST', category, 'test');
			// Verify the LogosError satisfies RuntimeError shape
			const runtimeErr: RuntimeError = err;
			expect(runtimeErr.category).toBe(category);
			expect(runtimeErr.code).toBe('TEST');
			expect(runtimeErr.message).toBe('test');
		});
	}
});

// ─── RuntimeError interface compatibility ──────────────────────────────────

describe('RuntimeError interface', () => {
	it('is satisfied by LogosError instances', () => {
		const err = new LogosError('ERR_001', 'validation', 'bad input', {
			recoverable: true,
			userFacingMessage: 'Please check your input.',
			details: { field: 'title' },
		});

		const runtimeErr: RuntimeError = err;
		expect(runtimeErr.code).toBe('ERR_001');
		expect(runtimeErr.category).toBe('validation');
		expect(runtimeErr.message).toBe('bad input');
		expect(runtimeErr.recoverable).toBe(true);
		expect(runtimeErr.userFacingMessage).toBe('Please check your input.');
		expect(runtimeErr.details).toEqual({ field: 'title' });
	});

	it('is satisfied by plain objects with the required shape', () => {
		const plainErr: RuntimeError = {
			code: 'PLAIN_ERR',
			category: 'persistence',
			message: 'disk full',
			recoverable: false,
		};

		expect(plainErr.code).toBe('PLAIN_ERR');
		expect(plainErr.category).toBe('persistence');
		expect(plainErr.recoverable).toBe(false);
		expect(plainErr.userFacingMessage).toBeUndefined();
		expect(plainErr.details).toBeUndefined();
	});

	it('LogosError defaults recoverable to false', () => {
		const err = new LogosError('ERR_002', 'export', 'export failed');
		expect(err.recoverable).toBe(false);
	});

	it('LogosError defaults userFacingMessage to message', () => {
		const err = new LogosError('ERR_003', 'materialization', 'stale source');
		expect(err.userFacingMessage).toBe('stale source');
	});

	it('LogosError with distinct userFacingMessage', () => {
		const err = new LogosError('ERR_004', 'llm_provider', 'timeout', {
			userFacingMessage: 'The AI service is taking too long. Please try again.',
		});
		expect(err.userFacingMessage).toBe(
			'The AI service is taking too long. Please try again.',
		);
	});

	it('LogosError stores details', () => {
		const err = new LogosError('ERR_005', 'profile_schema', 'invalid profile', {
			details: { path: '/tmp/broken.yaml', reason: 'missing title' },
		});
		expect(err.details).toEqual({
			path: '/tmp/broken.yaml',
			reason: 'missing title',
		});
	});

	it('LogosError stores cause (ES2022)', () => {
		const cause = new Error('root');
		const err = new LogosError('ERR_006', 'tui_rendering', 'render crash', {
			cause,
		});
		expect(err.cause).toBe(cause);
	});
});
