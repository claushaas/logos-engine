/**
 * NFR Compatibility Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runCompatibilityEvidence } from '../src/evidence/compatibility-evidence.js';

describe('Compatibility Evidence', () => {
	it('produces evidence for Linux automated status', () => {
		const items = runCompatibilityEvidence({
			_injectPlatform: 'linux',
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const linuxItem = items.find((i) => i.id === 'compat-linux-automated');
		expect(linuxItem).toBeDefined();
		expect(linuxItem?.status).toBe('pass');
		expect(linuxItem?.source.kind).toBe('test');
		expect(linuxItem?.nfrIds).toContain('NFR-COMP-001');
	});

	it('marks Linux as manual when platform is not Linux', () => {
		const items = runCompatibilityEvidence({
			_injectPlatform: 'darwin',
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const linuxItem = items.find((i) => i.id === 'compat-linux-automated');
		expect(linuxItem).toBeDefined();
		expect(linuxItem?.status).toBe('manual');
	});

	it('produces evidence for macOS manual checklist', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const macItem = items.find((i) => i.id === 'compat-macos-manual');
		expect(macItem).toBeDefined();
		expect(macItem?.status).toBe('manual');
		expect(macItem?.source.kind).toBe('manual_checklist');
		expect(macItem?.nextActions.length).toBeGreaterThan(0);
	});

	it('produces evidence for Windows WSL manual checklist', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const wslItem = items.find((i) => i.id === 'compat-windows-wsl-manual');
		expect(wslItem).toBeDefined();
		expect(wslItem?.status).toBe('manual');
		expect(wslItem?.source.kind).toBe('manual_checklist');
	});

	it('produces evidence for Node.js baseline', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const nodeItem = items.find((i) => i.id === 'compat-node-baseline');
		expect(nodeItem).toBeDefined();
		expect(nodeItem?.status).toBe('pass');
		expect(nodeItem?.nfrIds).toContain('NFR-COMP-002');
	});

	it('produces evidence for pnpm baseline', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const pnpmItem = items.find((i) => i.id === 'compat-pnpm-baseline');
		expect(pnpmItem).toBeDefined();
		expect(pnpmItem?.status).toBe('pass');
	});

	it('produces evidence for terminal assumptions', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const termItem = items.find((i) => i.id === 'compat-terminal-assumptions');
		expect(termItem).toBeDefined();
		expect(termItem?.status).toBe('pass_with_warnings');
		expect(termItem?.nfrIds).toContain('NFR-COMP-005');
	});

	it('produces evidence for path separator behavior', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const pathItem = items.find((i) => i.id === 'compat-path-separators');
		expect(pathItem).toBeDefined();
		expect(pathItem?.status).toBe('pass_with_warnings');
	});

	it('produces evidence for symlink behavior', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const symItem = items.find((i) => i.id === 'compat-symlink-behavior');
		expect(symItem).toBeDefined();
		expect(symItem?.status).toBe('pass_with_warnings');
	});

	it('produces evidence for package smoke', () => {
		const items = runCompatibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const smokeItem = items.find((i) => i.id === 'compat-package-smoke');
		expect(smokeItem).toBeDefined();
		expect(smokeItem?.status).toBe('pass');
	});

	it('does not claim automated macOS/Windows support', () => {
		const items = runCompatibilityEvidence();

		const macItem = items.find((i) => i.id === 'compat-macos-manual');
		expect(macItem?.status).toBe('manual');
		expect(macItem?.source.kind).toBe('manual_checklist');

		const wslItem = items.find((i) => i.id === 'compat-windows-wsl-manual');
		expect(wslItem?.status).toBe('manual');
		expect(wslItem?.source.kind).toBe('manual_checklist');
	});
});
