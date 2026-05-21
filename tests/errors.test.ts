import { describe, expect, it } from 'vitest';
import {
	createStructuredError,
	formatStructuredError,
	formatStructuredErrors,
} from '../src/runtime/errors.js';

describe('createStructuredError', () => {
	it('includes code, message, severity, path, and recovery hint', () => {
		const error = createStructuredError({
			code: 'E1',
			message: 'Something broke',
			path: '/tmp/test',
			pointer: 'config.token',
			recoveryHint: 'Check your config',
			severity: 'error',
		});
		expect(error.code).toBe('E1');
		expect(error.message).toBe('Something broke');
		expect(error.severity).toBe('error');
		expect(error.path).toBe('/tmp/test');
		expect(error.pointer).toBe('config.token');
		expect(error.recoveryHint).toBe('Check your config');
	});

	it('defaults severity to error', () => {
		const error = createStructuredError({
			code: 'E2',
			message: 'Oops',
		});
		expect(error.severity).toBe('error');
	});
});

describe('formatStructuredError', () => {
	it('formats without exposing raw cause', () => {
		const error = createStructuredError({
			cause: new Error('internal stack trace'),
			code: 'E3',
			message: 'Failed',
		});
		const lines = formatStructuredError(error);
		const text = lines.join('\n');
		expect(text).toContain('Failed');
		expect(text).toContain('E3');
		expect(text).not.toContain('internal stack trace');
		expect(text).not.toContain('stack');
	});

	it('includes path and recovery hint when provided', () => {
		const error = createStructuredError({
			code: 'E4',
			message: 'Missing file',
			path: '/tmp/missing',
			recoveryHint: 'Create the file first',
		});
		const lines = formatStructuredError(error);
		expect(lines.some((l) => l.includes('Path: /tmp/missing'))).toBe(true);
		expect(
			lines.some((l) => l.includes('Recovery: Create the file first')),
		).toBe(true);
	});
});

describe('formatStructuredErrors', () => {
	it('formats multiple errors deterministically', () => {
		const errors = [
			createStructuredError({ code: 'A', message: 'First' }),
			createStructuredError({ code: 'B', message: 'Second' }),
		];
		const lines = formatStructuredErrors(errors);
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.some((l) => l.includes('First'))).toBe(true);
		expect(lines.some((l) => l.includes('Second'))).toBe(true);
		const firstIndex = lines.findIndex((l) => l.includes('First'));
		const secondIndex = lines.findIndex((l) => l.includes('Second'));
		expect(firstIndex).toBeGreaterThan(-1);
		expect(secondIndex).toBeGreaterThan(-1);
		expect(firstIndex).toBeLessThan(secondIndex);
	});
});
