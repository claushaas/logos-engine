import { describe, expect, it } from 'vitest';
import {
	changedPathsFromLogos,
	createCommandResult,
	ErrorCodes,
	formatCommandResultForHuman,
	type LogosOperationStatus,
	operationStatusToCommandStatus,
	statusToExitCode,
	toJsonSerializable,
} from '../src/runtime/index.js';

// ---------------------------------------------------------------------------
// Command result with next actions
// ---------------------------------------------------------------------------

describe('createCommandResult with next actions', () => {
	it('includes nextActions in result', () => {
		const result = createCommandResult<string>({
			command: 'validate',
			data: 'test',
			nextActions: [
				{
					category: 'run_command',
					command: '/diagnose',
					message: 'Run diagnosis for interpretation',
					severity: 'info',
				},
			],
		});
		expect(result.nextActions).toBeDefined();
		expect(result.nextActions).toHaveLength(1);
		expect(result.nextActions?.[0].command).toBe('/diagnose');
	});

	it('nextActions serialized in JSON output', () => {
		const result = createCommandResult<string>({
			command: 'test',
			data: 'data',
			nextActions: [
				{
					category: 'resolve_blocker',
					message: 'Accept open questions first',
					severity: 'warning',
				},
			],
		});
		const json = toJsonSerializable(result);
		expect(json.nextActions).toBeDefined();
		expect(json.nextActions).toHaveLength(1);
		expect(json.nextActions?.[0].category).toBe('resolve_blocker');
	});
});

// ---------------------------------------------------------------------------
// Partial failure status
// ---------------------------------------------------------------------------

describe('partial failure status', () => {
	it('partial status is a valid CommandStatus', () => {
		const result = createCommandResult({
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.GENERATION_WRITE_FAILED,
					message: 'One file failed to write',
					recoveryHint: 'Check permissions',
					severity: 'error',
				},
			],
			status: 'partial',
		});
		expect(result.status).toBe('partial');
		expect(result.errors).toHaveLength(1);
	});

	it('partial status maps to exit code 0 (non-fatal)', () => {
		expect(statusToExitCode('partial')).toBe(0);
	});

	it('partial result includes changed paths for completed targets', () => {
		const result = createCommandResult({
			changedPaths: [
				{ action: 'created', path: 'logos/doc1.md' },
				{ action: 'failed', path: 'logos/doc2.md' },
			],
			command: 'generate',
			status: 'partial',
		});
		expect(result.changedPaths).toHaveLength(2);
		expect(result.changedPaths[0].action).toBe('created');
		expect(result.changedPaths[1].action).toBe('failed');
	});
});

// ---------------------------------------------------------------------------
// Operation status adapter
// ---------------------------------------------------------------------------

describe('operationStatusToCommandStatus', () => {
	it.each<
		[LogosOperationStatus, ReturnType<typeof operationStatusToCommandStatus>]
	>([
		['ok', 'success'],
		['ok_with_warnings', 'warning'],
		['blocked', 'error'],
		['failed', 'error'],
		['partial', 'partial'],
		['dry_run', 'dry_run'],
		['unknown', 'error'],
	])('maps %s to %s', (op, expected) => {
		expect(operationStatusToCommandStatus(op)).toBe(expected);
	});
});

// ---------------------------------------------------------------------------
// Changed paths from Logos
// ---------------------------------------------------------------------------

describe('changedPathsFromLogos', () => {
	it('converts LogosChangedPath to CommandChangedPath', () => {
		const paths = changedPathsFromLogos([
			{ action: 'created', kind: 'canonical', path: 'logos/doc.md' },
			{ action: 'would_create', kind: 'html', path: 'logos/index.html' },
		]);
		expect(paths).toHaveLength(2);
		expect(paths[0].action).toBe('created');
		expect(paths[0].kind).toBe('canonical');
		expect(paths[1].action).toBe('would_create');
	});
});

// ---------------------------------------------------------------------------
// Dry-run behavior
// ---------------------------------------------------------------------------

describe('dry-run behavior', () => {
	it('dry-run result has would_* actions only', () => {
		const result = createCommandResult({
			changedPaths: [
				{ action: 'would_create', path: 'logos/doc.md' },
				{ action: 'would_skip', path: 'logos/existing.md' },
			],
			command: 'generate',
			dryRun: true,
			status: 'dry_run',
		});
		expect(result.dryRun).toBe(true);
		expect(result.status).toBe('dry_run');
		expect(result.changedPaths[0].action).toBe('would_create');
		expect(result.changedPaths[1].action).toBe('would_skip');
	});

	it('dry-run has empty changed paths for actual mutations', () => {
		const result = createCommandResult({
			changedPaths: [],
			command: 'generate',
			dryRun: true,
			status: 'dry_run',
		});
		expect(result.changedPaths).toEqual([]);
	});

	it('dry-run output notes no changes were made', () => {
		const result = createCommandResult({
			command: 'test',
			dryRun: true,
			status: 'dry_run',
		});
		const lines = formatCommandResultForHuman(result);
		expect(lines.some((l) => l.includes('dry-run'))).toBe(true);
		expect(lines.some((l) => l.includes('no changes'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Read-only commands have empty changed paths
// ---------------------------------------------------------------------------

describe('read-only commands', () => {
	it('doctor result has empty changed paths', () => {
		const result = createCommandResult({
			command: 'doctor',
			status: 'success',
		});
		expect(result.changedPaths).toEqual([]);
		expect(result.dryRun).toBe(false);
	});

	it('status result has empty changed paths', () => {
		const result = createCommandResult({
			command: 'status',
			status: 'success',
		});
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

describe('toJsonSerializable', () => {
	it('produces valid JSON with all fields', () => {
		const result = createCommandResult({
			changedPaths: [
				{ action: 'created', id: '1', kind: 'canonical', path: 'logos/doc.md' },
			],
			command: 'test',
			data: { key: 'value' },
			dryRun: false,
			errors: [
				{
					code: ErrorCodes.FS_COLLISION,
					message: 'Collision',
					path: 'logos/doc.md',
					recoveryHint: 'Resolve collision',
					severity: 'error',
				},
			],
			messages: [{ level: 'info', text: 'Running' }],
			nextActions: [
				{
					category: 'resolve_blocker',
					command: '/validate',
					id: 'action1',
					message: 'Run validation',
					path: 'logos/',
					severity: 'warning',
				},
			],
			status: 'error',
			warnings: [{ code: 'W1', message: 'Careful', path: 'logos/' }],
		});
		const json = toJsonSerializable(result);
		// Verify JSON serialization doesn't throw
		const str = JSON.stringify(json, null, 2);
		expect(str).toBeTruthy();
		const parsed = JSON.parse(str);
		expect(parsed.status).toBe('error');
		expect(parsed.command).toBe('test');
		expect(parsed.nextActions).toHaveLength(1);
		expect(parsed.nextActions[0].category).toBe('resolve_blocker');
	});

	it('omits nextActions when not set', () => {
		const result = createCommandResult({
			command: 'test',
		});
		const json = toJsonSerializable(result);
		expect(json.nextActions).toBeUndefined();
	});

	it('changed paths include kind and id in JSON output', () => {
		const result = createCommandResult({
			changedPaths: [
				{
					action: 'created',
					id: 'abc',
					kind: 'canonical',
					path: 'logos/doc.md',
				},
			],
			command: 'test',
		});
		const json = toJsonSerializable(result);
		expect(json.changedPaths[0].kind).toBe('canonical');
		expect(json.changedPaths[0].id).toBe('abc');
	});
});

// ---------------------------------------------------------------------------
// Error behavior in command results
// ---------------------------------------------------------------------------

describe('error handling in command results', () => {
	it('error result includes all error details', () => {
		const result = createCommandResult({
			command: 'validate',
			errors: [
				{
					code: ErrorCodes.VALIDATION_SUBSYSTEM_FAILED,
					message: 'Output validation subsystem failed',
					pointer: 'outputs.canonical',
					recoveryHint: 'Run /regenerate',
					severity: 'error',
				},
			],
			status: 'error',
		});
		expect(result.status).toBe('error');
		expect(result.errors[0].code).toBe('LOGOS_VALIDATION_SUBSYSTEM_FAILED');
	});

	it('warning result with no errors has warning status', () => {
		const result = createCommandResult({
			command: 'test',
			status: 'warning',
			warnings: [{ code: 'W1', message: 'Minor issue' }],
		});
		expect(result.status).toBe('warning');
		expect(result.errors).toEqual([]);
	});

	it('failed-before-write result has empty changed paths', () => {
		const result = createCommandResult({
			changedPaths: [],
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.GENERATION_BLOCKED,
					message: 'Generation blocked: missing dependencies',
					severity: 'error',
				},
			],
			status: 'error',
		});
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Exit code behavior
// ---------------------------------------------------------------------------

describe('statusToExitCode', () => {
	it('fatal/blocked/failed status maps to non-zero exit code', () => {
		expect(statusToExitCode('error')).toBe(1);
		expect(statusToExitCode('not_implemented')).toBe(1);
	});

	it('success/warning/partial/dry_run maps to exit code 0', () => {
		expect(statusToExitCode('success')).toBe(0);
		expect(statusToExitCode('warning')).toBe(0);
		expect(statusToExitCode('partial')).toBe(0);
		expect(statusToExitCode('dry_run')).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// formatCommandResultForHuman
// ---------------------------------------------------------------------------

describe('formatCommandResultForHuman', () => {
	it('formats messages, warnings, errors, and dry-run note', () => {
		const result = createCommandResult({
			command: 'test',
			dryRun: true,
			errors: [
				{
					code: ErrorCodes.STATE_MISSING,
					message: 'State file missing',
					recoveryHint: 'Run /init',
					severity: 'warning',
				},
			],
			messages: [{ level: 'info', text: 'Hello' }],
			status: 'dry_run',
		});
		const lines = formatCommandResultForHuman(result);
		const text = lines.join('\n');
		expect(text).toContain('Hello');
		expect(text).toContain('State file missing');
		expect(text).toContain('Run /init');
		expect(text).toContain('dry-run');
	});
});
