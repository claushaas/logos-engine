import { describe, expect, it } from 'vitest';
import {
	formatValidationResult,
	type ValidationCommandOptions,
} from '../../src/application/validation-service.js';
import type {
	ValidationFinding,
	ValidationResult,
} from '../../src/validation/validation-engine.js';

function createTestFinding(
	overrides: Partial<ValidationFinding>,
): ValidationFinding {
	return {
		affectedDecisionIds: [],
		affectedDocuments: ['doc.test'],
		description: 'Test finding description',
		id: 'test.finding',
		phaseId: '00-test',
		ruleType: 'required_decision',
		severity: 'error',
		suggestedNextAction: 'Take action',
		title: 'Test Finding',
		...overrides,
	};
}

function createTestResult(findings: ValidationFinding[]): ValidationResult {
	return {
		byPhase: new Map(),
		findings,
		summary: {
			criticalCount: findings.filter((f) => f.severity === 'critical').length,
			errorCount: findings.filter((f) => f.severity === 'error').length,
			infoCount: findings.filter((f) => f.severity === 'info').length,
			totalCount: findings.length,
			warningCount: findings.filter((f) => f.severity === 'warning').length,
		},
	};
}

describe('validation service - formatValidationResult', () => {
	it('formats empty results', () => {
		const result = createTestResult([]);
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(result, options);

		expect(lines).toContain('Findings: 0 total');
		expect(lines).toContain('No issues found.');
	});

	it('formats findings by severity', () => {
		const result = createTestResult([
			createTestFinding({
				description: 'This is an error',
				id: 'error.1',
				severity: 'error',
				title: 'Error Finding',
			}),
			createTestFinding({
				description: 'This is a warning',
				id: 'warning.1',
				severity: 'warning',
				title: 'Warning Finding',
			}),
		]);
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(result, options);

		expect(lines).toContain('Findings: 2 total');
		expect(lines).toContain('  Error: 1');
		expect(lines).toContain('  Warning: 1');
		expect(lines).toContain('ERROR (1):');
		expect(lines).toContain('  Error Finding');
		expect(lines).toContain('    This is an error');
		expect(lines).toContain('WARNING (1):');
		expect(lines).toContain('  Warning Finding');
	});

	it('includes affected decisions in output', () => {
		const result = createTestResult([
			createTestFinding({
				affectedDecisionIds: ['decision.a', 'decision.b'],
				description: 'Some decisions are missing',
				id: 'test.1',
				title: 'Missing Decisions',
			}),
		]);
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(result, options);

		expect(lines).toContain('    Missing decisions: decision.a, decision.b');
	});

	it('includes affected documents in output', () => {
		const result = createTestResult([
			createTestFinding({
				affectedDocuments: ['doc.a', 'doc.b'],
				description: 'Some documents are affected',
				id: 'test.1',
				title: 'Affected Docs',
			}),
		]);
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(result, options);

		expect(lines).toContain('    Affected documents: doc.a, doc.b');
	});

	it('includes suggested next actions in output', () => {
		const result = createTestResult([
			createTestFinding({
				description: 'This needs action',
				id: 'test.1',
				suggestedNextAction: 'Define the missing decision first.',
				title: 'Actionable Finding',
			}),
		]);
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(result, options);

		expect(lines).toContain(
			'    Next action: Define the missing decision first.',
		);
	});

	it('includes phase breakdown when --all flag is set', () => {
		const findings = [
			createTestFinding({ id: 'test.1', phaseId: '01-phase' }),
			createTestFinding({ id: 'test.2', phaseId: '01-phase' }),
			createTestFinding({ id: 'test.3', phaseId: '02-phase' }),
		];
		const result = createTestResult(findings);
		const byPhase = new Map<string, ValidationFinding[]>();
		byPhase.set('01-phase', findings.slice(0, 2));
		byPhase.set('02-phase', findings.slice(2));
		const fullResult = { ...result, byPhase };
		const options: ValidationCommandOptions = { all: true };

		const lines = formatValidationResult(fullResult, options);

		expect(lines).toContain('By phase:');
		expect(lines).toContain('  01-phase: 2 finding(s)');
		expect(lines).toContain('  02-phase: 1 finding(s)');
	});

	it('omits phase breakdown when --all flag is not set', () => {
		const findings = [
			createTestFinding({ id: 'test.1', phaseId: '01-phase' }),
			createTestFinding({ id: 'test.2', phaseId: '02-phase' }),
		];
		const result = createTestResult(findings);
		const byPhase = new Map<string, ValidationFinding[]>();
		byPhase.set('01-phase', findings.slice(0, 1));
		byPhase.set('02-phase', findings.slice(1));
		const fullResult = { ...result, byPhase };
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(fullResult, options);

		expect(lines).not.toContain('By phase:');
	});

	it('orders severity groups correctly', () => {
		const result = createTestResult([
			createTestFinding({ id: 'info.1', severity: 'info', title: 'Info' }),
			createTestFinding({
				id: 'warning.1',
				severity: 'warning',
				title: 'Warning',
			}),
			createTestFinding({
				id: 'critical.1',
				severity: 'critical',
				title: 'Critical',
			}),
			createTestFinding({ id: 'error.1', severity: 'error', title: 'Error' }),
		]);
		const options: ValidationCommandOptions = {};

		const lines = formatValidationResult(result, options);

		const criticalIndex = lines.findIndex((l) => l.includes('CRITICAL'));
		const errorIndex = lines.findIndex((l) => l.includes('ERROR'));
		const warningIndex = lines.findIndex((l) => l.includes('WARNING'));
		const infoIndex = lines.findIndex((l) => l.includes('INFO'));

		expect(criticalIndex).toBeLessThan(errorIndex);
		expect(errorIndex).toBeLessThan(warningIndex);
		expect(warningIndex).toBeLessThan(infoIndex);
	});
});

import { validateWorkspace } from '../../src/application/validation-service.js';

describe('validation service - validateWorkspace edge cases', () => {
	it('returns error when workspace state cannot be read', () => {
		const result = validateWorkspace('/nonexistent/path');

		expect(result.status).toBe('error');
		expect(result.title).toBe('Validation failed');
		expect(result.lines).toContain(
			'Ensure the workspace is initialized with /init before validating.',
		);
	});
});
