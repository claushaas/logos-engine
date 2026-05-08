import { describe, expect, it } from 'vitest';
import {
	diagnoseWorkspace,
	formatDiagnosticsResult,
} from '../../src/application/diagnostics-service.js';
import { createEmptyDiagnosticsResult } from '../../src/diagnostics/diagnostics-engine.js';

describe('diagnostics service - formatDiagnosticsResult', () => {
	it('formats empty results', () => {
		const result = createEmptyDiagnosticsResult();
		const lines = formatDiagnosticsResult(result);

		expect(lines).toContain('Findings: 0 total');
		expect(lines).toContain('No issues found.');
		expect(lines).toContain(
			'Note: Diagnostics were generated without live AI analysis.',
		);
	});

	it('formats findings by severity', () => {
		const result = {
			...createEmptyDiagnosticsResult(),
			findings: [
				{
					affectedDecisionIds: [],
					affectedDocuments: ['doc.a'],
					category: 'gap' as const,
					description: 'This is an error',
					id: 'error.1',
					severity: 'error' as const,
					source: 'deterministic' as const,
					title: 'Error Finding',
				},
				{
					affectedDecisionIds: [],
					affectedDocuments: ['doc.b'],
					category: 'risk' as const,
					description: 'This is a warning',
					id: 'warning.1',
					severity: 'warning' as const,
					source: 'deterministic' as const,
					title: 'Warning Finding',
				},
			],
			summary: {
				criticalCount: 0,
				errorCount: 1,
				infoCount: 0,
				totalCount: 2,
				warningCount: 1,
			},
		};

		const lines = formatDiagnosticsResult(result);

		expect(lines).toContain('Findings: 2 total');
		expect(lines).toContain('  Error: 1');
		expect(lines).toContain('  Warning: 1');
		expect(lines).toContain('ERROR (1):');
		expect(lines).toContain('  Error Finding');
		expect(lines).toContain('    This is an error');
		expect(lines).toContain('WARNING (1):');
		expect(lines).toContain('  Warning Finding');
	});

	it('marks AI findings with advisory prefix', () => {
		const result = {
			...createEmptyDiagnosticsResult(),
			findings: [
				{
					affectedDecisionIds: [],
					affectedDocuments: [],
					category: 'gap' as const,
					description: 'AI identified gap',
					id: 'ai.gap.1',
					severity: 'warning' as const,
					source: 'ai' as const,
					title: 'AI Gap Finding',
				},
			],
			summary: {
				criticalCount: 0,
				errorCount: 0,
				infoCount: 0,
				totalCount: 1,
				warningCount: 1,
			},
		};

		const lines = formatDiagnosticsResult(result);

		expect(lines.some((line) => line.includes('[AI Advisory]'))).toBe(true);
	});

	it('includes affected documents in output', () => {
		const result = {
			...createEmptyDiagnosticsResult(),
			affectedDocuments: ['doc.a', 'doc.b'],
			findings: [
				{
					affectedDecisionIds: [],
					affectedDocuments: ['doc.a', 'doc.b'],
					category: 'gap' as const,
					description: 'Missing inputs',
					id: 'test.1',
					severity: 'error' as const,
					source: 'deterministic' as const,
					title: 'Missing Inputs',
				},
			],
			summary: {
				criticalCount: 0,
				errorCount: 1,
				infoCount: 0,
				totalCount: 1,
				warningCount: 0,
			},
		};

		const lines = formatDiagnosticsResult(result);

		expect(lines).toContain('    Affected documents: doc.a, doc.b');
		expect(lines).toContain('Affected documents: doc.a, doc.b');
	});

	it('includes missing decisions in output', () => {
		const result = {
			...createEmptyDiagnosticsResult(),
			findings: [
				{
					affectedDecisionIds: ['decision.a', 'decision.b'],
					affectedDocuments: ['doc.test'],
					category: 'gap' as const,
					description: 'Some decisions are missing',
					id: 'test.1',
					severity: 'error' as const,
					source: 'deterministic' as const,
					title: 'Missing Decisions',
				},
			],
			summary: {
				criticalCount: 0,
				errorCount: 1,
				infoCount: 0,
				totalCount: 1,
				warningCount: 0,
			},
		};

		const lines = formatDiagnosticsResult(result);

		expect(lines).toContain('    Missing decisions: decision.a, decision.b');
	});

	it('includes next recommended action', () => {
		const result = {
			...createEmptyDiagnosticsResult(),
			findings: [],
			nextRecommendedAction: 'Answer Economics Round 1 questions.',
			summary: {
				criticalCount: 0,
				errorCount: 0,
				infoCount: 0,
				totalCount: 0,
				warningCount: 0,
			},
		};

		const lines = formatDiagnosticsResult(result);

		expect(lines).toContain('Next step: Answer Economics Round 1 questions.');
	});

	it('shows AI contributions section when present', () => {
		const result = {
			...createEmptyDiagnosticsResult(),
			aiContributions: [
				{
					finding: {
						affectedDecisionIds: [],
						affectedDocuments: [],
						category: 'risk' as const,
						description: 'AI sees margin risk',
						id: 'ai.risk.1',
						severity: 'warning' as const,
						source: 'ai' as const,
						title: 'AI Risk: Margin',
					},
					operationId: 'identify_risks' as const,
					status: 'needs_review' as const,
				},
			],
			findings: [],
			summary: {
				criticalCount: 0,
				errorCount: 0,
				infoCount: 0,
				totalCount: 0,
				warningCount: 0,
			},
		};

		const lines = formatDiagnosticsResult(result);

		expect(lines).toContain('AI-ASSISTED INSIGHTS:');
		expect(lines).toContain(
			'The following observations were generated by AI and are advisory only.',
		);
		expect(lines).toContain(
			'  [identify_risks] AI Risk: Margin (needs_review)',
		);
	});

	it('notes when AI was requested but unavailable', () => {
		const result = createEmptyDiagnosticsResult();
		const lines = formatDiagnosticsResult(result, true);

		expect(lines).toContain(
			'Note: AI analysis was requested but no live provider is configured.',
		);
	});
});

describe('diagnostics service - diagnoseWorkspace edge cases', () => {
	it('returns error when workspace state cannot be read', () => {
		const result = diagnoseWorkspace('/nonexistent/path');

		expect(result.status).toBe('error');
		expect(result.title).toBe('Diagnostics failed');
		expect(result.lines).toContain(
			'Ensure the workspace is initialized with /init before running diagnostics.',
		);
	});
});
