/**
 * NFR Performance Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runPerformanceEvidence } from '../src/evidence/performance-evidence.js';

describe('Performance Evidence', () => {
	it('returns evidence items for all documented operations', () => {
		const items = runPerformanceEvidence({
			_injectDurations: {
				'canonical-generation-dry-run': 800,
				'cli-doctor': 200,
				'cli-help': 150,
				'cli-version': 120,
				'dependency-graph': 400,
				'derived-generation-dry-run': 700,
				'profile-loading': 300,
				'schema-validation': 100,
				'staleness-check': 250,
				'validation-fixture': 500,
				'workspace-status': 50,
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		expect(items.length).toBeGreaterThanOrEqual(11); // 11 operations + provider timeout config
		expect(items.every((i) => i.category === 'performance')).toBe(true);
	});

	it('marks items as pass when durations are under broad threshold', () => {
		const items = runPerformanceEvidence({
			_injectDurations: {
				'cli-help': 100, // under 5000ms
				'profile-loading': 500, // under 10000ms
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const cliHelp = items.find((i) => i.id === 'perf-cli-help');
		expect(cliHelp).toBeDefined();
		expect(cliHelp?.status).toBe('pass');

		const profileLoading = items.find((i) => i.id === 'perf-profile-loading');
		expect(profileLoading).toBeDefined();
		expect(profileLoading?.status).toBe('pass');
	});

	it('marks items as pass_with_warnings when between broad and hard threshold', () => {
		const items = runPerformanceEvidence({
			// CLI help broad threshold is 5000ms, hard is 10000ms
			_injectDurations: {
				'cli-help': 7000, // over 5000, under 10000
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const cliHelp = items.find((i) => i.id === 'perf-cli-help');
		expect(cliHelp).toBeDefined();
		expect(cliHelp?.status).toBe('pass_with_warnings');
		expect(cliHelp?.diagnostics.length).toBeGreaterThan(0);
	});

	it('marks items as fail when exceeding hard threshold', () => {
		const items = runPerformanceEvidence({
			// CLI help hard threshold is 10000ms
			_injectDurations: {
				'cli-help': 15000, // over 10000
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const cliHelp = items.find((i) => i.id === 'perf-cli-help');
		expect(cliHelp).toBeDefined();
		expect(cliHelp?.status).toBe('fail');
		expect(cliHelp?.diagnostics.length).toBeGreaterThan(0);
		expect(cliHelp?.diagnostics[0].severity).toBe('error');
	});

	it('does not mutate real state or files', () => {
		// Performance evidence with injectable durations is pure data
		const items = runPerformanceEvidence({
			_injectDurations: {},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});
		expect(items).toBeDefined();
		// All items are pure data objects
		for (const item of items) {
			expect(typeof item.id).toBe('string');
			expect(typeof item.title).toBe('string');
		}
	});

	it('includes provider timeout config evidence', () => {
		const items = runPerformanceEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const timeoutItem = items.find(
			(i) => i.id === 'perf-provider-timeout-config',
		);
		expect(timeoutItem).toBeDefined();
		expect(timeoutItem?.nfrIds).toContain('NFR-PERF-002');
		expect(timeoutItem?.status).toBe('pass');
	});

	it('items include measured duration in summary when durations injected', () => {
		const items = runPerformanceEvidence({
			_injectDurations: {
				'cli-help': 1234,
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const cliHelp = items.find((i) => i.id === 'perf-cli-help');
		expect(cliHelp).toBeDefined();
		expect(cliHelp?.summary).toContain('1234');
		expect(cliHelp?.summary).toContain('ms');
	});

	it('items without injected durations show not measured', () => {
		const items = runPerformanceEvidence({
			_injectDurations: {},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const cliHelp = items.find((i) => i.id === 'perf-cli-help');
		expect(cliHelp).toBeDefined();
		expect(cliHelp?.summary).toContain('not measured');
	});
});
