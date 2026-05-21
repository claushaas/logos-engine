import { describe, expect, it } from 'vitest';
import { createDiagnostic, recoveryHint } from '../src/runtime/diagnostics.js';
import {
	createStructuredError,
	type DiagnosticArea,
	diagnosticCode,
	diagnosticToStructuredError,
	ErrorCodes,
	formatStructuredError,
	formatStructuredErrors,
	structuredErrorToDiagnostic,
	toCommandError,
	wrapUnknownCaughtValue,
} from '../src/runtime/index.js';

// ---------------------------------------------------------------------------
// Stable error codes
// ---------------------------------------------------------------------------

describe('ErrorCodes', () => {
	it('provides stable namespaced codes for all areas', () => {
		const areas: DiagnosticArea[] = [
			'CLI',
			'TUI',
			'PROFILE',
			'STATE',
			'FS',
			'GENERATION',
			'VALIDATION',
			'EXECUTIVE',
			'IMPORT',
			'SCANNER',
			'CONSISTENCY',
			'EXTRACTION',
			'SECURITY',
			'UNKNOWN',
		];

		const codeEntries = Object.entries(ErrorCodes);
		for (const area of areas) {
			const areaEntries = codeEntries.filter(([key]) => key.startsWith(area));
			expect(areaEntries.length).toBeGreaterThan(0);
		}
	});

	it('no duplicate code values', () => {
		const values = Object.values(ErrorCodes);
		const unique = new Set(values);
		expect(unique.size).toBe(values.length);
	});

	it('codes follow LOGOS_AREA_REASON convention', () => {
		for (const code of Object.values(ErrorCodes)) {
			expect(code).toMatch(/^LOGOS_[A-Z]+_[A-Z_]+$/);
		}
	});

	it('area-specific codes exist', () => {
		expect(ErrorCodes.FS_PATH_TRAVERSAL).toBe('LOGOS_FS_PATH_TRAVERSAL');
		expect(ErrorCodes.STATE_MISSING).toBe('LOGOS_STATE_MISSING');
		expect(ErrorCodes.GENERATION_BLOCKED).toBe('LOGOS_GENERATION_BLOCKED');
		expect(ErrorCodes.EXECUTIVE_READINESS_BLOCKED).toBe(
			'LOGOS_EXECUTIVE_READINESS_BLOCKED',
		);
		expect(ErrorCodes.IMPORT_UNSAFE_PATH).toBe('LOGOS_IMPORT_UNSAFE_PATH');
		expect(ErrorCodes.SCANNER_POLICY_LIMIT).toBe('LOGOS_SCANNER_POLICY_LIMIT');
		expect(ErrorCodes.SECURITY_CHECK_FAILED).toBe(
			'LOGOS_SECURITY_CHECK_FAILED',
		);
		expect(ErrorCodes.UNKNOWN_ERROR).toBe('LOGOS_UNKNOWN_ERROR');
	});
});

// ---------------------------------------------------------------------------
// Structured error tests
// ---------------------------------------------------------------------------

describe('createStructuredError', () => {
	it('creates error with all fields', () => {
		const err = createStructuredError({
			cause: new Error('raw'),
			code: ErrorCodes.FS_PATH_TRAVERSAL,
			message: 'Path outside base',
			path: 'tmp/test',
			pointer: 'target.path',
			recoveryHint: 'Check the path',
			severity: 'fatal',
		});
		expect(err.code).toBe('LOGOS_FS_PATH_TRAVERSAL');
		expect(err.message).toBe('Path outside base');
		expect(err.severity).toBe('fatal');
		expect(err.path).toBe('tmp/test');
		expect(err.pointer).toBe('target.path');
		expect(err.recoveryHint).toBe('Check the path');
	});

	it('defaults severity to error', () => {
		const err = createStructuredError({
			code: 'TEST',
			message: 'test',
		});
		expect(err.severity).toBe('error');
	});
});

describe('formatStructuredError', () => {
	it('formats without exposing raw cause or stack', () => {
		const err = createStructuredError({
			cause: new Error('internal stack trace data'),
			code: 'E_TEST',
			message: 'Failed',
		});
		const lines = formatStructuredError(err);
		const text = lines.join('\n');
		expect(text).toContain('Failed');
		expect(text).not.toContain('internal stack');
		expect(text).not.toContain('stack');
	});

	it('includes recovery hint when provided', () => {
		const err = createStructuredError({
			code: 'E_TEST',
			message: 'File missing',
			recoveryHint: 'Run /init',
		});
		const text = formatStructuredError(err).join('\n');
		expect(text).toContain('Recovery: Run /init');
	});
});

describe('formatStructuredErrors', () => {
	it('formats multiple errors deterministically', () => {
		const errors = [
			createStructuredError({ code: 'A', message: 'First' }),
			createStructuredError({ code: 'B', message: 'Second' }),
		];
		const lines = formatStructuredErrors(errors);
		expect(lines.some((l) => l.includes('First'))).toBe(true);
		expect(lines.some((l) => l.includes('Second'))).toBe(true);
		const firstIdx = lines.findIndex((l) => l.includes('First'));
		const secondIdx = lines.findIndex((l) => l.includes('Second'));
		expect(firstIdx).toBeLessThan(secondIdx);
	});
});

// ---------------------------------------------------------------------------
// Conversion between StructuredError and LogosDiagnostic
// ---------------------------------------------------------------------------

describe('diagnosticToStructuredError', () => {
	it('converts diagnostic with recovery hints', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('CLI', 'TEST'),
			message: 'Test diagnostic',
			path: 'src/file.ts',
			recoveryHints: [
				recoveryHint('run_command', 'Run /init'),
				recoveryHint('check_path', 'Inspect .logos'),
			],
			severity: 'error',
		});
		const err = diagnosticToStructuredError(diag);
		expect(err.code).toBe('LOGOS_CLI_TEST');
		expect(err.message).toBe('Test diagnostic');
		expect(err.path).toBe('src/file.ts');
		expect(err.recoveryHint).toContain('Run /init');
		expect(err.recoveryHint).toContain('Inspect .logos');
	});

	it('preserves info severity through conversion', () => {
		const diag = createDiagnostic({
			code: diagnosticCode('CLI', 'INFO'),
			message: 'Info',
			severity: 'info',
		});
		const err = diagnosticToStructuredError(diag);
		expect(err.severity).toBe('info');
	});
});

describe('structuredErrorToDiagnostic', () => {
	it('converts structured error to diagnostic', () => {
		const err = createStructuredError({
			code: ErrorCodes.STATE_MISSING,
			message: 'State file missing',
			path: '.logos/workspace.json',
			recoveryHint: 'Run /init',
		});
		const diag = structuredErrorToDiagnostic(err);
		expect(diag.code).toBe('LOGOS_STATE_MISSING');
		expect(diag.message).toBe('State file missing');
		expect(diag.path).toBe('.logos/workspace.json');
		expect(diag.recoveryHints).toHaveLength(1);
	});

	it('uses manual_review as default hint category', () => {
		const err = createStructuredError({
			code: 'TEST',
			message: 'Test',
			recoveryHint: 'Check',
		});
		const diag = structuredErrorToDiagnostic(err);
		expect(diag.recoveryHints[0].category).toBe('manual_review');
	});
});

// ---------------------------------------------------------------------------
// toCommandError
// ---------------------------------------------------------------------------

describe('toCommandError', () => {
	it('converts StructuredError to CommandError', () => {
		const err = createStructuredError({
			code: ErrorCodes.FS_COLLISION,
			message: 'Collision detected',
			path: 'output/doc.md',
			recoveryHint: 'Resolve the collision',
		});
		const cmdErr = toCommandError(err);
		expect(cmdErr.code).toBe('LOGOS_FS_COLLISION');
		expect(cmdErr.message).toBe('Collision detected');
		expect(cmdErr.path).toBe('output/doc.md');
		expect(cmdErr.recoveryHint).toBe('Resolve the collision');
	});

	it('omits undefined optional fields', () => {
		const err = createStructuredError({
			code: 'TEST',
			message: 'Test',
		});
		const cmdErr = toCommandError(err);
		expect(cmdErr.path).toBeUndefined();
		expect(cmdErr.pointer).toBeUndefined();
		expect(cmdErr.recoveryHint).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Unknown error wrapping
// ---------------------------------------------------------------------------

describe('wrapUnknownCaughtValue', () => {
	it('wraps an Error into a safe diagnostic', () => {
		const diag = wrapUnknownCaughtValue(new Error('Boom'));
		expect(diag.code).toBe('LOGOS_UNKNOWN_UNEXPECTED_ERROR');
		expect(diag.severity).toBe('fatal');
		expect(diag.message).toBe('Boom');
	});

	it('wraps a string into a safe diagnostic', () => {
		const diag = wrapUnknownCaughtValue('a string error');
		expect(diag.code).toBe('LOGOS_UNKNOWN_UNEXPECTED_ERROR');
		expect(diag.message).toBe('a string error');
	});

	it('never exposes raw stack traces', () => {
		const err = new Error('Hidden');
		err.stack = 'Error: Hidden\n    at file.ts:10:20';
		const diag = wrapUnknownCaughtValue(err);
		const json = JSON.stringify(diag);
		expect(json).not.toContain('at file.ts');
		expect(json).not.toContain('stack');
	});

	it('wraps unknown objects safely', () => {
		const diag = wrapUnknownCaughtValue({ toString: () => 'custom' });
		expect(diag.severity).toBe('fatal');
		expect(diag.recoveryHints).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Recovery hint behavior
// ---------------------------------------------------------------------------

describe('recovery hints are actionable', () => {
	it('run_command includes a command', () => {
		const hint = recoveryHint('run_command', 'Run the command', {
			command: '/init',
		});
		expect(hint.command).toBe('/init');
	});

	it('rerun_with_dry_run includes a command', () => {
		const hint = recoveryHint('rerun_with_dry_run', 'Try dry-run first', {
			command: '/generate --dry-run',
		});
		expect(hint.command).toBe('/generate --dry-run');
	});

	it('check_path includes a path', () => {
		const hint = recoveryHint('check_path', 'Check the file', {
			path: '.logos/workspace.json',
		});
		expect(hint.path).toBe('.logos/workspace.json');
	});

	it('configure_provider does not require AI availability', () => {
		const hint = recoveryHint('configure_provider', 'Configure a provider');
		expect(hint.category).toBe('configure_provider');
		expect(hint.message).toBeTruthy();
	});
});

describe('recovery hints are local-first', () => {
	it('does not suggest external upload', () => {
		for (const category of [
			'remove_secret',
			'manual_review',
			'report_bug',
		] as const) {
			const hint = recoveryHint(category, 'Fix locally');
			expect(hint.message).not.toMatch(/upload|sync|cloud|remote/i);
		}
	});

	it('does not suggest unsafe deletion without backup', () => {
		const hint = recoveryHint('resolve_collision', 'Resolve collision');
		expect(hint.message).not.toMatch(/delete|remove\s+without/i);
	});
});
