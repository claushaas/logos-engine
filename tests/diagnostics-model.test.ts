import { describe, expect, it } from 'vitest';
import {
	CHANGED_PATH_ACTION_ORDER,
	compareSeverity,
	createDiagnostic,
	DIAGNOSTIC_AREAS,
	DIAGNOSTIC_SEVERITY_ORDER,
	diagnosticCode,
	diagnosticToJson,
	formatDiagnosticForTerminal,
	formatDiagnosticsForTerminal,
	type LogosChangedPathAction,
	type LogosDiagnosticSeverity,
	type LogosOperationStatus,
	OPERATION_STATUS_ORDER,
	RECOVERY_HINT_CATEGORIES,
	RecoveryHints,
	recoveryHint,
	sortChangedPaths,
	sortDiagnostics,
	sortNextActions,
	wrapUnknownError,
} from '../src/runtime/diagnostics.js';

// ---------------------------------------------------------------------------
// Diagnostic code convention
// ---------------------------------------------------------------------------

describe('diagnosticCode', () => {
	it('produces namespaced stable codes', () => {
		expect(diagnosticCode('CLI', 'UNKNOWN_COMMAND')).toBe(
			'LOGOS_CLI_UNKNOWN_COMMAND',
		);
		expect(diagnosticCode('FS', 'PATH_TRAVERSAL')).toBe(
			'LOGOS_FS_PATH_TRAVERSAL',
		);
		expect(diagnosticCode('STATE', 'MISSING')).toBe('LOGOS_STATE_MISSING');
		expect(diagnosticCode('PROFILE', 'INVALID_YAML')).toBe(
			'LOGOS_PROFILE_INVALID_YAML',
		);
	});

	it('supports all defined areas', () => {
		for (const area of DIAGNOSTIC_AREAS) {
			const code = diagnosticCode(area, 'TEST');
			expect(code).toBe(`LOGOS_${area}_TEST`);
		}
	});

	it('codes are deterministic', () => {
		const a = diagnosticCode('CLI', 'TEST');
		const b = diagnosticCode('CLI', 'TEST');
		expect(a).toBe(b);
	});
});

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

describe('compareSeverity', () => {
	it('orders fatal < error < warning < info', () => {
		const severities: LogosDiagnosticSeverity[] = [
			'fatal',
			'error',
			'warning',
			'info',
		];
		for (let i = 0; i < severities.length - 1; i++) {
			expect(compareSeverity(severities[i], severities[i + 1])).toBeLessThan(0);
			expect(compareSeverity(severities[i + 1], severities[i])).toBeGreaterThan(
				0,
			);
		}
	});

	it('equal severities compare equal', () => {
		expect(compareSeverity('error', 'error')).toBe(0);
	});

	it('DIAGNOSTIC_SEVERITY_ORDER reflects severity ranking', () => {
		expect(DIAGNOSTIC_SEVERITY_ORDER.fatal).toBeLessThan(
			DIAGNOSTIC_SEVERITY_ORDER.error,
		);
		expect(DIAGNOSTIC_SEVERITY_ORDER.error).toBeLessThan(
			DIAGNOSTIC_SEVERITY_ORDER.warning,
		);
		expect(DIAGNOSTIC_SEVERITY_ORDER.warning).toBeLessThan(
			DIAGNOSTIC_SEVERITY_ORDER.info,
		);
	});
});

// ---------------------------------------------------------------------------
// Diagnostic shape
// ---------------------------------------------------------------------------

describe('createDiagnostic', () => {
	it('creates a diagnostic with required fields', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('CLI', 'TEST'),
			message: 'Something went wrong',
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_CLI_TEST');
		expect(diag.message).toBe('Something went wrong');
		expect(diag.severity).toBe('error');
		expect(diag.recoveryHints).toEqual([]);
	});

	it('supports all optional fields', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('FS', 'TEST'),
			documentationRef: 'https://example.com',
			expectedValue: 'x',
			message: 'File error',
			path: 'src/test.ts',
			pointer: 'config.key',
			receivedValue: 'y',
			recoveryHints: [
				recoveryHint('check_path', 'Check the file', { path: 'src/test.ts' }),
			],
			redactionSummary: 'token redacted',
			relatedIds: { documentId: 'doc1' },
			severity: 'warning',
		});
		expect(diag.path).toBe('src/test.ts');
		expect(diag.pointer).toBe('config.key');
		expect(diag.recoveryHints).toHaveLength(1);
		expect(diag.relatedIds?.documentId).toBe('doc1');
		expect(diag.expectedValue).toBe('x');
		expect(diag.receivedValue).toBe('y');
		expect(diag.documentationRef).toBe('https://example.com');
		expect(diag.redactionSummary).toBe('token redacted');
	});

	it('is JSON serializable', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('CLI', 'TEST'),
			message: 'Test',
			severity: 'error',
		});
		const json = JSON.stringify(diag);
		const parsed = JSON.parse(json);
		expect(parsed.code).toBe('LOGOS_CLI_TEST');
		expect(parsed.message).toBe('Test');
		expect(parsed.severity).toBe('error');
	});
});

// ---------------------------------------------------------------------------
// Recovery hints
// ---------------------------------------------------------------------------

describe('recoveryHint', () => {
	it('creates a recovery hint with category and message', () => {
		const hint = recoveryHint('run_command', 'Run /init to initialize');
		expect(hint.category).toBe('run_command');
		expect(hint.message).toBe('Run /init to initialize');
	});

	it('includes optional command, path, and configKey', () => {
		const hint = recoveryHint('run_command', 'Run the command', {
			command: '/init',
			configKey: 'provider',
			path: '.logos',
		});
		expect(hint.command).toBe('/init');
		expect(hint.path).toBe('.logos');
		expect(hint.configKey).toBe('provider');
	});

	it('all recovery hint categories are actionable and local-first', () => {
		for (const cat of RECOVERY_HINT_CATEGORIES) {
			const hint = recoveryHint(cat, `Action for ${cat}`);
			expect(hint.category).toBe(cat);
			expect(hint.message).toBeTruthy();
		}
	});
});

describe('RecoveryHints shortcuts', () => {
	it('runCommand creates valid hint', () => {
		const hint = RecoveryHints.runCommand('Initialize workspace', '/init');
		expect(hint.category).toBe('run_command');
		expect(hint.command).toBe('/init');
	});

	it('restoreBackup creates valid hint', () => {
		const hint = RecoveryHints.restoreBackup(
			'Restore from backup',
			'.logos/workspace.json',
		);
		expect(hint.category).toBe('restore_backup');
	});

	it('removeSecret creates valid hint', () => {
		const hint = RecoveryHints.removeSecret('Remove secret from config');
		expect(hint.category).toBe('remove_secret');
	});

	it('reportBug creates valid hint', () => {
		const hint = RecoveryHints.reportBug('This is unexpected');
		expect(hint.category).toBe('report_bug');
	});
});

// ---------------------------------------------------------------------------
// Diagnostic formatting
// ---------------------------------------------------------------------------

describe('formatDiagnosticForTerminal', () => {
	it('formats without exposing raw cause', () => {
		const diag = createDiagnostic({
			cause: new Error('internal stack'),
			code: diagnosticCode('CLI', 'TEST'),
			message: 'Failed',
			severity: 'error',
		});
		const lines = formatDiagnosticForTerminal(diag);
		const text = lines.join('\n');
		expect(text).toContain('Failed');
		expect(text).toContain('LOGOS_CLI_TEST');
		expect(text).not.toContain('internal stack');
		expect(text).not.toContain('stack');
	});

	it('includes all present optional fields', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('FS', 'TEST'),
			documentationRef: 'docs/help.md',
			expectedValue: 'foo',
			message: 'Path error',
			path: 'src/test.ts',
			pointer: 'some.field',
			receivedValue: 'bar',
			recoveryHints: [
				recoveryHint('check_path', 'Inspect the path', { path: 'src/test.ts' }),
			],
			redactionSummary: 'secrets redacted',
			severity: 'warning',
		});
		const lines = formatDiagnosticForTerminal(diag);
		const text = lines.join('\n');
		expect(text).toContain('Path: src/test.ts');
		expect(text).toContain('Pointer: some.field');
		expect(text).toContain('Expected: foo');
		expect(text).toContain('Received: bar');
		expect(text).toContain('Docs: docs/help.md');
		expect(text).toContain('Inspect the path');
		expect(text).toContain('secrets redacted');
	});

	it('terminal output is readable without color', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('STATE', 'MISSING'),
			message: 'State file missing',
			severity: 'warning',
		});
		const lines = formatDiagnosticForTerminal(diag);
		// No ANSI color codes
		const text = lines.join('\n');
		expect(text).not.toContain('\x1b[');
		expect(text).toContain('[WARNING]');
	});
});

describe('formatDiagnosticsForTerminal', () => {
	it('sorts by severity then code', () => {
		const diags = [
			createDiagnostic({
				code: diagnosticCode('CLI', 'C'),
				message: 'Third',
				severity: 'info',
			}),
			createDiagnostic({
				code: diagnosticCode('CLI', 'A'),
				message: 'First',
				severity: 'fatal',
			}),
			createDiagnostic({
				code: diagnosticCode('CLI', 'B'),
				message: 'Second',
				severity: 'error',
			}),
		];
		const lines = formatDiagnosticsForTerminal(diags);
		const text = lines.join('\n');

		const fatalIdx = text.indexOf('First');
		const errorIdx = text.indexOf('Second');
		const infoIdx = text.indexOf('Third');

		expect(fatalIdx).toBeGreaterThan(-1);
		expect(errorIdx).toBeGreaterThan(-1);
		expect(infoIdx).toBeGreaterThan(-1);
		expect(fatalIdx).toBeLessThan(errorIdx);
		expect(errorIdx).toBeLessThan(infoIdx);
	});
});

// ---------------------------------------------------------------------------
// Unknown error wrapping
// ---------------------------------------------------------------------------

describe('wrapUnknownError', () => {
	it('wraps an Error instance', () => {
		const diag = wrapUnknownError(new Error('Something broke'));
		expect(diag.code).toBe('LOGOS_UNKNOWN_UNEXPECTED_ERROR');
		expect(diag.message).toBe('Something broke');
		expect(diag.severity).toBe('fatal');
		expect(diag.recoveryHints).toHaveLength(1);
		expect(diag.recoveryHints[0].category).toBe('report_bug');
	});

	it('wraps a string', () => {
		const diag = wrapUnknownError('a string error');
		expect(diag.message).toBe('a string error');
		expect(diag.severity).toBe('fatal');
	});

	it('wraps an object', () => {
		const diag = wrapUnknownError({ custom: 'error' });
		expect(diag.message).toContain('object');
		expect(diag.severity).toBe('fatal');
	});

	it('wraps null/undefined with a default message', () => {
		const diag = wrapUnknownError(null);
		expect(diag.message).toBe('An unexpected error occurred.');
		expect(diag.severity).toBe('fatal');
	});

	it('does not expose stack traces in message', () => {
		const err = new Error('Something');
		err.stack = 'Error: Something\n    at file.ts:1:2';
		const diag = wrapUnknownError(err);
		expect(diag.message).toBe('Something');
		expect(diag.message).not.toContain('at file.ts');
	});

	it('respects area parameter', () => {
		const diag = wrapUnknownError(new Error('Oops'), { area: 'CLI' });
		expect(diag.code).toBe('LOGOS_CLI_UNEXPECTED_ERROR');
	});

	it('includes path in diagnostic when provided', () => {
		const diag = wrapUnknownError(new Error('Oops'), { path: 'src/test.ts' });
		expect(diag.path).toBe('src/test.ts');
	});
});

// ---------------------------------------------------------------------------
// Diagnostic to JSON
// ---------------------------------------------------------------------------

describe('diagnosticToJson', () => {
	it('converts to JSON-serializable shape without cause', () => {
		const diag = createDiagnostic({
			cause: new Error('internal'),
			code: diagnosticCode('CLI', 'TEST'),
			message: 'Test',
			severity: 'error',
		});
		const json = diagnosticToJson(diag);
		expect(json.cause).toBeUndefined();
		expect(json.code).toBe('LOGOS_CLI_TEST');
		expect(json.message).toBe('Test');
		expect(json.severity).toBe('error');
	});
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('sortDiagnostics', () => {
	it('sorts by severity, then code, then path, then pointer', () => {
		const a = createDiagnostic({
			code: 'LOGOS_A',
			message: 'A',
			path: 'a.ts',
			severity: 'error',
		});
		const b = createDiagnostic({
			code: 'LOGOS_A',
			message: 'B',
			path: 'b.ts',
			severity: 'error',
		});
		expect(sortDiagnostics(a, b)).toBeLessThan(0);
	});

	it('fatal sorted before error', () => {
		const a = createDiagnostic({
			code: 'LOGOS_F',
			message: 'F',
			severity: 'fatal',
		});
		const b = createDiagnostic({
			code: 'LOGOS_E',
			message: 'E',
			severity: 'error',
		});
		expect(sortDiagnostics(a, b)).toBeLessThan(0);
	});
});

describe('sortChangedPaths', () => {
	it('sorts by action order, then path', () => {
		const a = { action: 'created' as LogosChangedPathAction, path: 'a.md' };
		const b = { action: 'updated' as LogosChangedPathAction, path: 'a.md' };
		expect(sortChangedPaths(a, b)).toBeLessThan(0);
	});

	it('would_create sorted after actual actions', () => {
		const a = { action: 'created' as LogosChangedPathAction, path: 'a.md' };
		const b = {
			action: 'would_create' as LogosChangedPathAction,
			path: 'b.md',
		};
		expect(sortChangedPaths(a, b)).toBeLessThan(0);
	});

	it('sorts by kind then id as tiebreakers', () => {
		const a = {
			action: 'created' as LogosChangedPathAction,
			id: '1',
			kind: 'canonical',
			path: 'a.md',
		};
		const b = {
			action: 'created' as LogosChangedPathAction,
			id: '2',
			kind: 'canonical',
			path: 'a.md',
		};
		expect(sortChangedPaths(a, b)).toBeLessThan(0);
	});
});

describe('sortNextActions', () => {
	it('sorts by severity then category', () => {
		const a = {
			category: 'run_command' as const,
			message: 'Fix',
			severity: 'error' as LogosDiagnosticSeverity,
		};
		const b = {
			category: 'review_output' as const,
			message: 'Review',
			severity: 'warning' as LogosDiagnosticSeverity,
		};
		expect(sortNextActions(a, b)).toBeLessThan(0);
	});
});

// ---------------------------------------------------------------------------
// Operation status
// ---------------------------------------------------------------------------

describe('OPERATION_STATUS_ORDER', () => {
	it('contains all expected statuses', () => {
		const statuses: LogosOperationStatus[] = [
			'ok',
			'ok_with_warnings',
			'blocked',
			'failed',
			'partial',
			'dry_run',
			'unknown',
		];
		for (const s of statuses) {
			expect(OPERATION_STATUS_ORDER[s]).toBeDefined();
		}
	});

	it('has failed as most severe and unknown as least', () => {
		expect(OPERATION_STATUS_ORDER.failed).toBeLessThan(
			OPERATION_STATUS_ORDER.ok,
		);
		expect(OPERATION_STATUS_ORDER.failed).toBeLessThan(
			OPERATION_STATUS_ORDER.dry_run,
		);
	});
});

describe('CHANGED_PATH_ACTION_ORDER', () => {
	it('contains all expected actions', () => {
		const actions: LogosChangedPathAction[] = [
			'created',
			'updated',
			'skipped',
			'backed_up',
			'deleted',
			'would_create',
			'would_update',
			'would_skip',
			'failed',
		];
		for (const a of actions) {
			expect(CHANGED_PATH_ACTION_ORDER[a]).toBeDefined();
		}
	});
});
