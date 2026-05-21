/**
 * TUI Report Rendering Tests
 *
 * Phase 5: TUI Workbench Redesign — Outcome 7 (report views).
 */

import { describe, expect, it } from 'vitest';
import {
	buildDecisionReport,
	buildDiagnosticReport,
	buildExecutiveCompileReport,
	buildGenerationReport,
	buildProposalReport,
	buildProviderConfigReport,
	buildRecoveryReport,
	buildReportCounts,
	buildReportData,
	buildValidationReport,
	renderReport,
	truncateReportForDisplay,
} from '../src/tui/report-renderers.js';
import type {
	TuiReportGroup,
	TuiReportItem,
} from '../src/tui/workbench-model.js';

// ---------------------------------------------------------------------------
// Report count builder
// ---------------------------------------------------------------------------

describe('buildReportCounts', () => {
	it('counts items by severity', () => {
		const groups: TuiReportGroup[] = [
			{
				items: [{ text: 'a' }, { text: 'b' }],
				label: 'Errors',
				severity: 'error',
			},
			{ items: [{ text: 'c' }], label: 'Warnings', severity: 'warning' },
		];
		const counts = buildReportCounts(groups);
		expect(counts.total).toBe(3);
		expect(counts.error).toBe(2);
		expect(counts.warning).toBe(1);
		expect(counts.critical).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Validation report
// ---------------------------------------------------------------------------

describe('validation report', () => {
	it('groups findings by severity', () => {
		const report = buildValidationReport({
			findingCounts: { error: 2, fatal: 0, info: 1, total: 6, warning: 3 },
			findings: [
				{ message: 'Missing required input', path: 'doc-1', severity: 'error' },
				{ message: 'Invalid state', path: 'doc-2', severity: 'error' },
				{ message: 'Unused assumption', severity: 'warning' },
				{ message: 'Stale output', severity: 'warning' },
				{ message: 'Low evidence', severity: 'warning' },
				{ message: 'Optional check passed', severity: 'info' },
			],
			gateStatus: 'fail',
		});

		expect(report.groups.length).toBeGreaterThan(0);
		const errorGroup = report.groups.find((g) => g.severity === 'error');
		expect(errorGroup).toBeDefined();
		expect(errorGroup?.items.length).toBe(2);

		const warningGroup = report.groups.find((g) => g.severity === 'warning');
		expect(warningGroup).toBeDefined();
		expect(warningGroup?.items.length).toBe(3);
	});

	it('renders report as text lines', () => {
		const report = buildValidationReport({
			findingCounts: { error: 1, fatal: 1, info: 0, total: 2, warning: 0 },
			findings: [
				{ message: 'Critical issue', severity: 'fatal' },
				{ message: 'Error issue', severity: 'error' },
			],
			gateStatus: 'fail',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('Validation Report');
		expect(text).toContain('[failed]');
		expect(text).toContain('Critical issue');
		expect(text).toContain('Error issue');
		expect(text).toContain('Next actions');
	});

	it('shows report path when available', () => {
		const report = buildValidationReport({
			findingCounts: { error: 0, fatal: 0, info: 0, total: 0, warning: 0 },
			findings: [],
			gateStatus: 'pass',
			reportPath: 'logos/reports/validation.md',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('logos/reports/validation.md');
	});
});

// ---------------------------------------------------------------------------
// Diagnostic report
// ---------------------------------------------------------------------------

describe('diagnostic report', () => {
	it('groups findings', () => {
		const report = buildDiagnosticReport({
			explanations: [{ text: 'The project has some issues.' }],
			findingCounts: { error: 1, fatal: 0, info: 1, total: 4, warning: 2 },
			gateStatus: 'pass_with_warnings',
			groupedFindings: [
				{ label: 'Missing decisions', reason: '3 documents need decisions' },
			],
			suggestedActions: [
				{ category: 'intake', priority: 'high', text: 'Continue intake' },
			],
		});

		expect(report.groups.length).toBeGreaterThan(0);
	});

	it('renders as text lines', () => {
		const report = buildDiagnosticReport({
			findingCounts: { error: 0, fatal: 0, info: 0, total: 1, warning: 1 },
			gateStatus: 'pass',
			groupedFindings: [{ label: 'Test', reason: 'One warning' }],
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('Diagnostic Report');
	});
});

// ---------------------------------------------------------------------------
// Generation report
// ---------------------------------------------------------------------------

describe('generation report', () => {
	it('shows created/updated/skipped/blocked/failed', () => {
		const report = buildGenerationReport({
			collisionPaths: ['docs/g.md'],
			createdPaths: ['docs/a.md', 'docs/b.md', 'docs/c.md'],
			documentationRoot: 'logos/',
			documentCounts: {
				blocked: 1,
				failed: 1,
				generate: 3,
				incomplete: 1,
				skip: 1,
				stale: 0,
				update: 2,
			},
			profileId: 'standard',
			skippedPaths: ['docs/f.md'],
			updatedPaths: ['docs/d.md', 'docs/e.md'],
		});

		expect(report.groups.length).toBeGreaterThan(0);
		// Should have groups for created, updated, skipped, collisions, blocked, failed, incomplete, stale
		const created = report.groups.find((g) => g.label === 'Created');
		expect(created).toBeDefined();
		expect(created?.items.length).toBe(3);

		const blocked = report.groups.find((g) => g.label === 'Blocked');
		expect(blocked).toBeDefined();
	});

	it('renders canonical label', () => {
		const report = buildGenerationReport({
			createdPaths: ['docs/a.md'],
			documentationRoot: 'logos/',
			documentCounts: {
				blocked: 0,
				failed: 0,
				generate: 1,
				incomplete: 0,
				skip: 0,
				stale: 0,
				update: 0,
			},
			profileId: 'standard',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('[canonical]');
	});

	it('shows dry-run context', () => {
		const report = buildGenerationReport({
			createdPaths: ['docs/a.md', 'docs/b.md'],
			documentationRoot: 'logos/',
			documentCounts: {
				blocked: 0,
				failed: 0,
				generate: 2,
				incomplete: 0,
				skip: 0,
				stale: 0,
				update: 0,
			},
			isDryRun: true,
			profileId: 'standard',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('/generate --confirm to execute writes');
	});
});

// ---------------------------------------------------------------------------
// Executive compile report
// ---------------------------------------------------------------------------

describe('executive compile report', () => {
	it('shows readiness and blockers', () => {
		const report = buildExecutiveCompileReport({
			blockers: ['Missing profile executive config'],
			executiveRoot: 'profiles/standard/executive',
			outputCount: 0,
			ready: false,
			warnings: [],
		});

		expect(report.groups.length).toBeGreaterThan(0);
		expect(report.summary).toContain('Blocked');
	});

	it('shows ready state with export targets', () => {
		const report = buildExecutiveCompileReport({
			blockers: [],
			executiveRoot: 'profiles/standard/executive',
			exportTargets: ['markdown', 'json', 'html'],
			outputCount: 5,
			ready: true,
			warnings: [],
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('[ready]');
	});
});

// ---------------------------------------------------------------------------
// Provider config report
// ---------------------------------------------------------------------------

describe('provider config report', () => {
	it('renders configuration without raw token', () => {
		const report = buildProviderConfigReport({
			disclosureStatus: 'accepted',
			endpointDisplay: 'https://api.example.com',
			mode: 'remote',
			modelId: 'test-model',
			providerId: 'test-provider',
			status: 'configured',
			timeoutMs: 60000,
			tokenEnvVar: 'TEST_TOKEN',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');

		// Shows env var name, not value
		expect(text).toContain('$TEST_TOKEN');
		expect(text).toContain('(configured)');

		// Does NOT show raw token
		expect(text).not.toContain('sk-abc123');
		expect(text).not.toContain('Bearer');
	});

	it('shows unconfigured state', () => {
		const report = buildProviderConfigReport({
			mode: 'no_provider',
			status: 'not configured',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('[provider-unconfigured]');
	});

	it('shows provider-ready state', () => {
		const report = buildProviderConfigReport({
			lastTestStatus: 'success',
			mode: 'remote',
			providerId: 'openai',
			status: 'configured',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('[provider-ready]');
	});
});

// ---------------------------------------------------------------------------
// Proposal report
// ---------------------------------------------------------------------------

describe('proposal report', () => {
	it('groups by status and shows confidence labels', () => {
		const report = buildProposalReport({
			proposals: [
				{
					confidence: 'high',
					id: 'p-001',
					kind: 'decision',
					sourceLabel: 'intake-turn-3',
					status: 'proposed',
					title: 'Use TypeScript',
				},
				{
					confidence: 'low',
					id: 'p-002',
					kind: 'assumption',
					sourceLabel: 'intake-turn-4',
					status: 'proposed',
					title: 'Target audience is developers',
				},
				{
					id: 'p-003',
					kind: 'decision',
					status: 'accepted',
					title: 'Use Node.js',
				},
			],
			totalCount: 3,
		});

		expect(report.groups.length).toBeGreaterThan(0);
	});

	it('renders proposal report text', () => {
		const report = buildProposalReport({
			proposals: [
				{
					id: 'p-001',
					kind: 'decision',
					status: 'proposed',
					title: 'Use TypeScript',
				},
			],
			totalCount: 1,
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('Proposal Review');
		expect(text).toContain('Use TypeScript');
	});
});

// ---------------------------------------------------------------------------
// Decision report
// ---------------------------------------------------------------------------

describe('decision report', () => {
	it('groups by status and shows affected docs', () => {
		const report = buildDecisionReport({
			decisions: [
				{
					affectedDocuments: ['docs/03-product/01-product-vision.md'],
					id: 'd-001',
					status: 'confirmed',
					title: 'Use TypeScript',
				},
				{ id: 'd-002', status: 'superseded', title: 'Use JavaScript' },
			],
			totalCount: 2,
		});

		expect(report.groups.length).toBeGreaterThan(0);
	});

	it('renders decision report text', () => {
		const report = buildDecisionReport({
			decisions: [
				{ id: 'd-001', status: 'confirmed', title: 'Use TypeScript' },
			],
			totalCount: 1,
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('Decision Detail');
	});
});

// ---------------------------------------------------------------------------
// Recovery report
// ---------------------------------------------------------------------------

describe('recovery report', () => {
	it('shows what failed and preserved state', () => {
		const report = buildRecoveryReport({
			backupAvailable: false,
			errorType: 'Unknown command',
			preservedState: 'Workspace state is intact',
			recoveryActions: ['Run /help', 'Run /status'],
			retrySafe: true,
			whatFailed: 'Command /foo was not recognized',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('[failed]');
		expect(text).toContain('Command /foo was not recognized');
		expect(text).toContain('Workspace state is intact');
	});

	it('shows changed paths if any', () => {
		const report = buildRecoveryReport({
			backupAvailable: true,
			changedPaths: ['logos/docs/test.md'],
			errorType: 'Generation failure',
			partialState: '2 of 5 files written',
			preservedState: 'Some files written',
			recoveryActions: ['Run /generate again'],
			retrySafe: true,
			whatFailed: 'Generation incomplete',
		});

		const lines = renderReport(report);
		const text = lines.join('\n');
		expect(text).toContain('logos/docs/test.md');
		expect(text).toContain('2 of 5 files written');
	});
});

// ---------------------------------------------------------------------------
// Large report truncation
// ---------------------------------------------------------------------------

describe('large report truncation', () => {
	it('truncates large reports safely', () => {
		const items: TuiReportItem[] = Array.from({ length: 100 }, (_, i) => ({
			text: `Finding ${i + 1}`,
		}));

		const report = buildReportData({
			groups: [{ items, label: 'Large', severity: 'warning' }],
			nextActions: ['Review all findings'],
			summary: 'Large report',
		});

		const truncated = truncateReportForDisplay(report, 20);
		expect(truncated.groups[0]?.items.length).toBe(20);
		expect(truncated.groups.length).toBeLessThanOrEqual(2); // original + truncation notice
	});

	it('does not truncate small reports', () => {
		const report = buildReportData({
			groups: [
				{ items: [{ text: 'Only finding' }], label: 'Small', severity: 'info' },
			],
			nextActions: [],
			summary: 'Small report',
		});

		const truncated = truncateReportForDisplay(report, 50);
		expect(truncated.groups[0]?.items.length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Canonical/derived visibility
// ---------------------------------------------------------------------------

describe('canonical/derived labels', () => {
	it('canonical label appears on generation reports', () => {
		const report = buildGenerationReport({
			createdPaths: ['docs/test.md'],
			documentationRoot: 'logos/',
			documentCounts: {
				blocked: 0,
				failed: 0,
				generate: 1,
				incomplete: 0,
				skip: 0,
				stale: 0,
				update: 0,
			},
			profileId: 'standard',
		});

		expect(report.outputType).toBe('canonical');
		const lines = renderReport(report);
		expect(lines.join('\n')).toContain('[canonical]');
	});

	it('derived label appears on executive reports', () => {
		const report = buildExecutiveCompileReport({
			blockers: [],
			executiveRoot: 'profiles/standard/executive',
			outputCount: 1,
			ready: true,
			warnings: [],
		});

		expect(report.outputType).toBe('derived');
		const lines = renderReport(report);
		expect(lines.join('\n')).toContain('[derived]');
	});

	it('canonical vs derived labels are text-visible', () => {
		// Both labels must be present in their rendering
		const genReport = buildGenerationReport({
			createdPaths: ['docs/test.md'],
			documentationRoot: 'logos/',
			documentCounts: {
				blocked: 0,
				failed: 0,
				generate: 1,
				incomplete: 0,
				skip: 0,
				stale: 0,
				update: 0,
			},
			profileId: 'standard',
		});
		expect(renderReport(genReport).join('\n')).toContain('[canonical]');

		const execReport = buildExecutiveCompileReport({
			blockers: [],
			executiveRoot: 'profiles/standard/executive',
			outputCount: 1,
			ready: true,
			warnings: [],
		});
		expect(renderReport(execReport).join('\n')).toContain('[derived]');
	});
});

// ---------------------------------------------------------------------------
// Report rendering non-mutation
// ---------------------------------------------------------------------------

describe('report rendering is pure', () => {
	it('buildReportData does not mutate inputs', () => {
		const groups: TuiReportGroup[] = [
			{ items: [{ text: 'test' }], label: 'Test', severity: 'info' },
		];
		const before = JSON.stringify(groups);
		buildReportData({ groups, nextActions: [], summary: 'Test' });
		expect(JSON.stringify(groups)).toBe(before);
	});

	it('renderReport does not mutate its input', () => {
		const report = buildValidationReport({
			findingCounts: { error: 0, fatal: 0, info: 0, total: 0, warning: 0 },
			findings: [],
			gateStatus: 'pass',
		});
		const before = JSON.stringify(report);
		renderReport(report);
		expect(JSON.stringify(report)).toBe(before);
	});
});
