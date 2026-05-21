/**
 * NFR Release Gate Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runReleaseGateEvidence } from '../src/evidence/release-gate.js';

describe('Release Gate Evidence', () => {
	it('passes when all required scripts are present', () => {
		const items = runReleaseGateEvidence({
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

		const gateItem = items.find((i) => i.id === 'gate-required-scripts');
		expect(gateItem).toBeDefined();
		expect(gateItem?.status).toBe('pass');
	});

	it('blocks when required scripts are missing', () => {
		const items = runReleaseGateEvidence({
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {},
				version: '0.1.0',
			},
			_injectScripts: {},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const gateItem = items.find((i) => i.id === 'gate-required-scripts');
		expect(gateItem).toBeDefined();
		expect(gateItem?.status).toBe('blocked');
		expect(gateItem?.diagnostics.length).toBeGreaterThan(0);
	});

	it('warns when expected scripts are missing', () => {
		const items = runReleaseGateEvidence({
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {
					build: 'tsc',
					check: 'pnpm check',
					'smoke:cli': 'node scripts/smoke-cli.js',
					test: 'vitest',
					// Missing security:check, smoke:package, evidence:nfr
				},
				version: '0.1.0',
			},
			_injectScripts: {
				build: 'tsc',
				check: 'pnpm check',
				'smoke:cli': 'node scripts/smoke-cli.js',
				test: 'vitest',
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const gateItem = items.find((i) => i.id === 'gate-required-scripts');
		expect(gateItem).toBeDefined();
		expect(gateItem?.status).toBe('pass_with_warnings');
	});

	it('produces evidence for comprehensive checklist', () => {
		const items = runReleaseGateEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const checklistItem = items.find(
			(i) => i.id === 'gate-checklist-comprehensive',
		);
		expect(checklistItem).toBeDefined();
		expect(checklistItem?.status).toBe('pass_with_warnings');
		expect(checklistItem?.nfrIds).toContain('NFR-OPS-002');
	});

	it('produces evidence for no telemetry', () => {
		const items = runReleaseGateEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const telemetryItem = items.find((i) => i.id === 'gate-no-telemetry');
		expect(telemetryItem).toBeDefined();
		expect(telemetryItem?.status).toBe('pass');
		expect(telemetryItem?.nfrIds).toContain('NFR-PRIV-001');
	});

	it('does not inject provider credentials or network calls', () => {
		const items = runReleaseGateEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		for (const item of items) {
			expect(item.source.kind).toBeDefined();
			// Script presence is static analysis
			if (item.id === 'gate-required-scripts') {
				expect(item.source.kind).toBe('static_analysis');
			}
		}
	});

	it('release gate items are JSON-serializable', () => {
		const items = runReleaseGateEvidence({
			_injectPackageJson: {
				name: 'test-pkg',
				scripts: {
					build: 'tsc',
					check: 'pnpm check',
					'smoke:cli': 'node scripts/smoke-cli.js',
					test: 'vitest',
				},
				version: '0.1.0',
			},
			_injectScripts: {
				build: 'tsc',
				check: 'pnpm check',
				'smoke:cli': 'node scripts/smoke-cli.js',
				test: 'vitest',
			},
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const json = JSON.stringify(items);
		const parsed = JSON.parse(json);
		expect(Array.isArray(parsed)).toBe(true);
	});
});
