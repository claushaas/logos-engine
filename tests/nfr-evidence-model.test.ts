/**
 * NFR Evidence Model Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import {
	compareNfrEvidenceItem,
	createNfrEvidenceEnvironment,
	createNfrEvidenceItem,
	createNfrEvidenceReport,
	type NfrEvidenceCategory,
	type NfrEvidenceItem,
	type NfrEvidenceStatus,
	nfrEvidenceDiagnostic,
	rollupNfrEvidenceStatus,
	sortNfrEvidenceItems,
} from '../src/evidence/nfr-evidence-model.js';

describe('NfrEvidenceItem', () => {
	it('creates evidence item with all fields', () => {
		const item = createNfrEvidenceItem({
			category: 'performance',
			checkedAt: '2025-01-01T00:00:00.000Z',
			id: 'perf-test-001',
			nfrIds: ['NFR-PERF-001'],
			status: 'pass',
			summary: 'Performance check passed.',
			title: 'Test performance check',
		});

		expect(item.id).toBe('perf-test-001');
		expect(item.category).toBe('performance');
		expect(item.nfrIds).toEqual(['NFR-PERF-001']);
		expect(item.title).toBe('Test performance check');
		expect(item.status).toBe('pass');
		expect(item.checkedAt).toBe('2025-01-01T00:00:00.000Z');
		expect(item.summary).toBe('Performance check passed.');
		expect(item.environment.nodeVersion).toBeTruthy();
		expect(item.environment.platform).toBeTruthy();
		expect(item.diagnostics).toEqual([]);
		expect(item.limitations).toEqual([]);
		expect(item.nextActions).toEqual([]);
		expect(item.source.kind).toBe('unknown');
	});

	it('supports all categories', () => {
		const categories: NfrEvidenceCategory[] = [
			'performance',
			'accessibility',
			'compatibility',
			'scalability',
			'reliability',
			'availability',
			'observability',
			'privacy',
			'security',
			'html_accessibility',
			'release_gate',
		];

		for (const cat of categories) {
			const item = createNfrEvidenceItem({
				category: cat,
				id: `test-${cat}`,
				nfrIds: [],
				status: 'pass',
				title: cat,
			});
			expect(item.category).toBe(cat);
		}
	});

	it('supports all statuses', () => {
		const statuses: NfrEvidenceStatus[] = [
			'pass',
			'pass_with_warnings',
			'fail',
			'blocked',
			'skipped',
			'manual',
			'unknown',
		];

		for (const st of statuses) {
			const item = createNfrEvidenceItem({
				category: 'unknown',
				id: `test-${st}`,
				nfrIds: [],
				status: st,
				title: st,
			});
			expect(item.status).toBe(st);
		}
	});

	it('is JSON serializable', () => {
		const item = createNfrEvidenceItem({
			category: 'performance',
			id: 'perf-json',
			nfrIds: ['NFR-PERF-001'],
			status: 'pass',
			summary: 'summary',
			title: 'JSON test',
		});

		const json = JSON.stringify(item);
		const parsed = JSON.parse(json);
		expect(parsed.id).toBe('perf-json');
		expect(parsed.category).toBe('performance');
	});

	it('has deterministic ordering by category', () => {
		const perf = createNfrEvidenceItem({
			category: 'performance',
			id: 'a',
			nfrIds: [],
			status: 'pass',
			title: 'A',
		});
		const acc = createNfrEvidenceItem({
			category: 'accessibility',
			id: 'b',
			nfrIds: [],
			status: 'pass',
			title: 'B',
		});

		// performance comes before accessibility in category order
		expect(compareNfrEvidenceItem(perf, acc)).toBeLessThan(0);
		expect(compareNfrEvidenceItem(acc, perf)).toBeGreaterThan(0);
	});

	it('sorts same category items by id', () => {
		const a = createNfrEvidenceItem({
			category: 'performance',
			id: 'perf-a',
			nfrIds: [],
			status: 'pass',
			title: 'A',
		});
		const b = createNfrEvidenceItem({
			category: 'performance',
			id: 'perf-b',
			nfrIds: [],
			status: 'pass',
			title: 'B',
		});

		expect(compareNfrEvidenceItem(a, b)).toBeLessThan(0);
		expect(compareNfrEvidenceItem(b, a)).toBeGreaterThan(0);
	});

	it('sortNfrEvidenceItems returns sorted array without mutating input', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'release_gate',
				id: 'gate-1',
				nfrIds: [],
				status: 'pass',
				title: 'Gate',
			}),
			createNfrEvidenceItem({
				category: 'performance',
				id: 'perf-1',
				nfrIds: [],
				status: 'pass',
				title: 'Perf',
			}),
			createNfrEvidenceItem({
				category: 'accessibility',
				id: 'acc-1',
				nfrIds: [],
				status: 'pass',
				title: 'Acc',
			}),
		];

		const original = [...items];
		const sorted = sortNfrEvidenceItems(items);

		// Original unchanged
		expect(items).toEqual(original);

		// Sorted: performance first, then accessibility, then release_gate
		expect(sorted[0].category).toBe('performance');
		expect(sorted[1].category).toBe('accessibility');
		expect(sorted[2].category).toBe('release_gate');
	});
});

describe('NfrEvidenceEnvironment', () => {
	it('creates redacted environment without hostname or username', () => {
		const env = createNfrEvidenceEnvironment();
		expect(env.nodeVersion).toBeTruthy();
		expect(env.platform).toBeTruthy();
		expect(env.arch).toBeTruthy();
		expect(env.summary).toBeTruthy();
		expect(env.summary).not.toContain('hostname');
		expect(env.summary).not.toContain('username');
		// Does not contain private paths
		expect(env.summary).not.toContain('/Users/');
		expect(env.summary).not.toContain('/home/');
	});
});

describe('rollupNfrEvidenceStatus', () => {
	it('returns unknown for empty items', () => {
		expect(rollupNfrEvidenceStatus([])).toBe('unknown');
	});

	it('returns blocked if any item is blocked', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p1',
				nfrIds: [],
				status: 'pass',
				title: 'pass',
			}),
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p2',
				nfrIds: [],
				status: 'blocked',
				title: 'blocked',
			}),
		];
		expect(rollupNfrEvidenceStatus(items)).toBe('blocked');
	});

	it('returns fail if any item fails (and none blocked)', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p1',
				nfrIds: [],
				status: 'pass',
				title: 'pass',
			}),
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p2',
				nfrIds: [],
				status: 'fail',
				title: 'fail',
			}),
		];
		expect(rollupNfrEvidenceStatus(items)).toBe('fail');
	});

	it('returns pass_with_warnings if manual items exist', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p1',
				nfrIds: [],
				status: 'pass',
				title: 'pass',
			}),
			createNfrEvidenceItem({
				category: 'compatibility',
				id: 'c1',
				nfrIds: [],
				status: 'manual',
				title: 'manual',
			}),
		];
		expect(rollupNfrEvidenceStatus(items)).toBe('pass_with_warnings');
	});

	it('returns pass if all items pass', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p1',
				nfrIds: [],
				status: 'pass',
				title: 'pass',
			}),
		];
		expect(rollupNfrEvidenceStatus(items)).toBe('pass');
	});
});

describe('NfrEvidenceDiagnostic', () => {
	it('creates diagnostic with stable code', () => {
		const diag = nfrEvidenceDiagnostic({
			code: 'LOGOS_NFR_PERFORMANCE_THRESHOLD_EXCEEDED',
			evidenceId: 'perf-test',
			message: 'Threshold exceeded.',
			nfrId: 'NFR-PERF-003',
			recoveryHint: 'Check performance.',
			severity: 'warning',
		});

		expect(diag.code).toBe('LOGOS_NFR_PERFORMANCE_THRESHOLD_EXCEEDED');
		expect(diag.severity).toBe('warning');
		expect(diag.message).toBe('Threshold exceeded.');
		expect(diag.evidenceId).toBe('perf-test');
		expect(diag.nfrId).toBe('NFR-PERF-003');
		expect(diag.recoveryHint).toBe('Check performance.');
	});
});

describe('NfrEvidenceReport', () => {
	it('creates report with items, counts, and summary', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'performance',
				id: 'perf-1',
				nfrIds: ['NFR-PERF-001'],
				status: 'pass',
				title: 'Performance 1',
			}),
			createNfrEvidenceItem({
				category: 'accessibility',
				id: 'acc-1',
				nfrIds: ['NFR-ACC-001'],
				status: 'pass_with_warnings',
				title: 'Accessibility 1',
			}),
		];

		const report = createNfrEvidenceReport({
			generatedAt: '2025-01-01T00:00:00.000Z',
			items,
			packageName: 'test-pkg',
			packageVersion: '1.0.0',
		});

		expect(report.packageName).toBe('test-pkg');
		expect(report.packageVersion).toBe('1.0.0');
		expect(report.generatedAt).toBe('2025-01-01T00:00:00.000Z');
		expect(report.status).toBe('pass_with_warnings');
		expect(report.items).toHaveLength(2);
		expect(report.countsByCategory.performance).toBe(1);
		expect(report.countsByCategory.accessibility).toBe(1);
		expect(report.countsByStatus.pass).toBe(1);
		expect(report.countsByStatus.pass_with_warnings).toBe(1);
		expect(report.summaryLines.length).toBeGreaterThan(0);
		expect(report.limitations.length).toBeGreaterThan(0);
		expect(report.nextActions.length).toBeGreaterThan(0);
	});

	it('report items are sorted by category', () => {
		const items: NfrEvidenceItem[] = [
			createNfrEvidenceItem({
				category: 'release_gate',
				id: 'g1',
				nfrIds: [],
				status: 'pass',
				title: 'G',
			}),
			createNfrEvidenceItem({
				category: 'performance',
				id: 'p1',
				nfrIds: [],
				status: 'pass',
				title: 'P',
			}),
		];

		const report = createNfrEvidenceReport({ items });
		expect(report.items[0].category).toBe('performance');
		expect(report.items[1].category).toBe('release_gate');
	});
});
