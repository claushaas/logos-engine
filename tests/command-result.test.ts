import { describe, expect, it } from 'vitest';
import type { CommandStatus } from '../src/runtime/command-result.js';
import {
	createCommandResult,
	formatCommandResultForHuman,
	statusToExitCode,
	toJsonSerializable,
} from '../src/runtime/command-result.js';

describe('createCommandResult', () => {
	it('creates success result envelope', () => {
		const result = createCommandResult({
			command: 'test',
			status: 'success',
		});
		expect(result.status).toBe('success');
		expect(result.metadata.command).toBe('test');
		expect(result.changedPaths).toEqual([]);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
		expect(result.dryRun).toBe(false);
	});

	it('creates warning result envelope', () => {
		const result = createCommandResult({
			command: 'test',
			status: 'warning',
			warnings: [{ code: 'W1', message: 'watch out' }],
		});
		expect(result.status).toBe('warning');
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].message).toBe('watch out');
	});

	it('creates error result envelope', () => {
		const result = createCommandResult({
			command: 'test',
			errors: [
				{
					code: 'E1',
					message: 'something broke',
					severity: 'error',
				},
			],
			status: 'error',
		});
		expect(result.status).toBe('error');
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].code).toBe('E1');
	});

	it('creates not-implemented result envelope', () => {
		const result = createCommandResult({
			command: 'future',
			status: 'not_implemented',
		});
		expect(result.status).toBe('not_implemented');
	});

	it('creates dry-run result envelope', () => {
		const result = createCommandResult({
			command: 'test',
			dryRun: true,
			status: 'dry_run',
		});
		expect(result.status).toBe('dry_run');
		expect(result.dryRun).toBe(true);
		expect(result.metadata.mode).toBe('dry_run');
	});

	it('result envelope serializes to JSON without functions, symbols, or circular data', () => {
		const result = createCommandResult({
			command: 'test',
			data: { key: 'value' },
		});
		const json = JSON.stringify(toJsonSerializable(result));
		const parsed = JSON.parse(json);
		expect(parsed.status).toBe('success');
		expect(parsed.command).toBe('test');
		expect(parsed.data).toEqual({ key: 'value' });
		expect(parsed.changedPaths).toEqual([]);
	});

	it('changed paths default to an empty array for non-mutating commands', () => {
		const result = createCommandResult({ command: 'doctor' });
		expect(result.changedPaths).toEqual([]);
	});

	it('includes metadata fields', () => {
		const result = createCommandResult({
			command: 'doctor',
			includeTimestamp: false,
			version: '0.1.0',
		});
		expect(result.metadata.command).toBe('doctor');
		expect(result.metadata.version).toBe('0.1.0');
		expect(result.metadata.timestamp).toBeUndefined();
		expect(result.metadata.mode).toBe('normal');
	});
});

describe('formatCommandResultForHuman', () => {
	it('formats messages, warnings, and errors', () => {
		const result = createCommandResult({
			command: 'test',
			errors: [
				{
					code: 'E1',
					message: 'Oops',
					path: '/tmp',
					recoveryHint: 'Try again',
					severity: 'error',
				},
			],
			messages: [{ level: 'info', text: 'Hello' }],
			warnings: [{ code: 'W1', message: 'Careful', path: '/tmp' }],
		});
		const lines = formatCommandResultForHuman(result);
		expect(lines).toContain('Hello');
		expect(lines.some((l) => l.includes('Careful'))).toBe(true);
		expect(lines.some((l) => l.includes('Oops'))).toBe(true);
		expect(lines.some((l) => l.includes('Recovery: Try again'))).toBe(true);
	});

	it('notes dry-run mode when active', () => {
		const result = createCommandResult({
			command: 'test',
			dryRun: true,
			status: 'dry_run',
		});
		const lines = formatCommandResultForHuman(result);
		expect(lines.some((l) => l.includes('dry-run'))).toBe(true);
	});
});

describe('statusToExitCode', () => {
	it.each<[CommandStatus, number]>([
		['success', 0],
		['warning', 0],
		['dry_run', 0],
		['error', 1],
		['not_implemented', 1],
	])('maps %s to exit code %i', (status, expected) => {
		expect(statusToExitCode(status)).toBe(expected);
	});
});
