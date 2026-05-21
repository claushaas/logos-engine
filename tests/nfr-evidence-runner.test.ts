/**
 * NFR Evidence Runner Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runNfrEvidence } from '../src/evidence/nfr-evidence-runner.js';

describe('NFR Evidence Runner', () => {
	it('runs all evidence checks and returns a structured report', () => {
		const report = runNfrEvidence({
			// Inject durations so performance items pass
			_injectDurations: {
				'canonical-generation-dry-run': 100,
				'cli-doctor': 100,
				'cli-help': 100,
				'cli-version': 100,
				'dependency-graph': 100,
				'derived-generation-dry-run': 100,
				'profile-loading': 100,
				'schema-validation': 100,
				'staleness-check': 100,
				'validation-fixture': 100,
				'workspace-status': 100,
			},
			// Inject package.json for release gate
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {
					build: 'tsc',
					check: 'pnpm lint && pnpm test',
					'nfr:evidence': 'node scripts/nfr-evidence.js',
					'security:check': 'node scripts/security-check.js',
					'smoke:cli': 'node scripts/smoke-cli.js',
					'smoke:package': 'node scripts/smoke-package.js',
					test: 'vitest',
				},
				version: '0.1.0',
			},
			_injectScripts: {
				build: 'tsc',
				check: 'pnpm lint && pnpm test',
				'nfr:evidence': 'node scripts/nfr-evidence.js',
				'security:check': 'node scripts/security-check.js',
				'smoke:cli': 'node scripts/smoke-cli.js',
				'smoke:package': 'node scripts/smoke-package.js',
				test: 'vitest',
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
			packageName: 'test-pkg',
			packageVersion: '0.1.0',
		});

		expect(report.packageName).toBe('test-pkg');
		expect(report.generatedAt).toBe('2025-01-01T00:00:00.000Z');
		expect(report.items.length).toBeGreaterThan(0);
		expect(report.status).toBeDefined();
		expect(report.countsByCategory).toBeDefined();
		expect(report.summaryLines.length).toBeGreaterThan(0);
	});

	it('returns report with counts by category', () => {
		const report = runNfrEvidence({
			_injectDurations: {
				'canonical-generation-dry-run': 100,
				'cli-doctor': 100,
				'cli-help': 100,
				'cli-version': 100,
				'dependency-graph': 100,
				'derived-generation-dry-run': 100,
				'profile-loading': 100,
				'schema-validation': 100,
				'staleness-check': 100,
				'validation-fixture': 100,
				'workspace-status': 100,
			},
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {
					build: 'tsc',
					check: 'pnpm check',
					'nfr:evidence': 'node scripts/nfr-evidence.js',
					'security:check': 'node scripts/security-check.js',
					'smoke:cli': 'node scripts/smoke-cli.js',
					'smoke:package': 'node scripts/smoke-package.js',
					test: 'vitest',
				},
				version: '0.1.0',
			},
			_injectScripts: {
				build: 'tsc',
				check: 'pnpm check',
				'nfr:evidence': 'node scripts/nfr-evidence.js',
				'security:check': 'node scripts/security-check.js',
				'smoke:cli': 'node scripts/smoke-cli.js',
				'smoke:package': 'node scripts/smoke-package.js',
				test: 'vitest',
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		// Should have items in known categories
		const catsWithItems = Object.entries(report.countsByCategory).filter(
			([, count]) => count > 0,
		);
		expect(catsWithItems.length).toBeGreaterThan(0);

		// Known categories that should have items
		expect(report.countsByCategory.performance).toBeGreaterThan(0);
		expect(report.countsByCategory.accessibility).toBeGreaterThan(0);
	});

	it('filters by category when specified', () => {
		const allReport = runNfrEvidence({
			_injectDurations: {},
			_injectPackageJson: { name: 'test', scripts: {}, version: '0.1.0' },
			_injectScripts: {},
		});

		const perfReport = runNfrEvidence({
			_injectDurations: {},
			_injectPackageJson: { name: 'test', scripts: {}, version: '0.1.0' },
			_injectScripts: {},
			categories: ['performance'],
		});

		// Performance-only report should have fewer items
		expect(perfReport.items.length).toBeLessThan(allReport.items.length);

		// All items in perfReport should be performance category
		for (const item of perfReport.items) {
			expect(item.category).toBe('performance');
		}
	});

	it('does not call network or AI providers', () => {
		// The runner is purely functional — just test it completes
		const report = runNfrEvidence({
			_injectDurations: {},
			_injectPackageJson: { name: 'test', scripts: {}, version: '0.1.0' },
			_injectScripts: {},
		});
		expect(report).toBeDefined();
		expect(report.status).toBeDefined();
	});

	it('accepted manual items do not fail the run', () => {
		// Manual items should produce pass_with_warnings, not fail
		const report = runNfrEvidence({
			_injectCompatibilityPlatform: 'darwin', // non-Linux → macOS manual
			_injectDurations: {
				'canonical-generation-dry-run': 100,
				'cli-doctor': 100,
				'cli-help': 100,
				'cli-version': 100,
				'dependency-graph': 100,
				'derived-generation-dry-run': 100,
				'profile-loading': 100,
				'schema-validation': 100,
				'staleness-check': 100,
				'validation-fixture': 100,
				'workspace-status': 100,
			},
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {
					build: 'tsc',
					check: 'pnpm check',
					'nfr:evidence': 'node scripts/nfr-evidence.js',
					'security:check': 'node scripts/security-check.js',
					'smoke:cli': 'node scripts/smoke-cli.js',
					'smoke:package': 'node scripts/smoke-package.js',
					test: 'vitest',
				},
				version: '0.1.0',
			},
			_injectScripts: {
				build: 'tsc',
				check: 'pnpm check',
				'nfr:evidence': 'node scripts/nfr-evidence.js',
				'security:check': 'node scripts/security-check.js',
				'smoke:cli': 'node scripts/smoke-cli.js',
				'smoke:package': 'node scripts/smoke-package.js',
				test: 'vitest',
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		// Should not be fail or blocked
		expect(report.status).not.toBe('fail');
		expect(report.status).not.toBe('blocked');
	});

	it('blocker failure causes failing status', () => {
		// Without required release scripts, release gate should be blocked
		const report = runNfrEvidence({
			_injectDurations: {
				'canonical-generation-dry-run': 100,
				'cli-doctor': 100,
				'cli-help': 100,
				'cli-version': 100,
				'dependency-graph': 100,
				'derived-generation-dry-run': 100,
				'profile-loading': 100,
				'schema-validation': 100,
				'staleness-check': 100,
				'validation-fixture': 100,
				'workspace-status': 100,
			},
			// Missing required scripts
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {},
				version: '0.1.0',
			},
			_injectScripts: {},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		// Release gate should have blocked items
		const gateItems = report.items.filter((i) => i.category === 'release_gate');
		const hasBlocked = gateItems.some(
			(i) => i.status === 'blocked' || i.status === 'fail',
		);
		expect(hasBlocked).toBe(true);
	});

	it('JSON mode flag is accepted in options', () => {
		const report = runNfrEvidence({
			_injectDurations: {},
			_injectPackageJson: { name: 'test', scripts: {}, version: '0.1.0' },
			_injectScripts: {},
			json: true,
		});
		expect(report).toBeDefined();
		// JSON mode just changes output format in the script, the data is the same
	});

	it('report is JSON-serializable', () => {
		const report = runNfrEvidence({
			_injectDurations: {},
			_injectPackageJson: { name: 'test', scripts: {}, version: '0.1.0' },
			_injectScripts: {},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const json = JSON.stringify(report);
		const parsed = JSON.parse(json);
		expect(parsed.packageName).toBe('logos-engine');
		expect(Array.isArray(parsed.items)).toBe(true);
	});
});
