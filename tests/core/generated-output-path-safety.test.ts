/**
 * Step 6.3 — Generated output path safety tests.
 *
 * Tests:
 * 1. Relative path inside project root is safe.
 * 2. Absolute path inside project root is safe.
 * 3. ../outside.md is blocked.
 * 4. Sibling prefix attack is blocked.
 * 5. Empty output path is blocked.
 * 6. Unsafe paths produce structured blockers/risks.
 * 7. Unsafe paths are not silently rewritten.
 */

import { describe, expect, it } from 'vitest';
import { resolveSafeOutputPath } from '../../src/core/generation/output-paths.js';

describe('resolveSafeOutputPath', () => {
	// --- 1. Relative path inside project root is safe ---
	it('resolves relative path inside project root as safe', () => {
		const result = resolveSafeOutputPath({
			outputPath: 'docs/generated/01-thesis.md',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.relativePath).toBe('docs/generated/01-thesis.md');
		}
	});

	// --- 2. Absolute path inside project root is safe ---
	it('resolves absolute path inside project root as safe', () => {
		const result = resolveSafeOutputPath({
			outputPath: '/project/docs/generated/01-thesis.md',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.relativePath).toBe('docs/generated/01-thesis.md');
		}
	});

	// --- 3. Path traversal is blocked ---
	it('blocks ../outside.md', () => {
		const result = resolveSafeOutputPath({
			outputPath: '../outside.md',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.risk.code).toBe('outside_project_root');
			expect(result.risk.message).toContain('../outside.md');
		}
	});

	// --- 4. Sibling prefix attack is blocked ---
	it('blocks sibling prefix attack', () => {
		const result = resolveSafeOutputPath({
			outputPath: '/project-malicious/file.md',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.risk.code).toBe('outside_project_root');
			expect(result.risk.path).toBe('/project-malicious/file.md');
		}
	});

	// --- 5. Empty path is blocked ---
	it('blocks empty output path', () => {
		const result = resolveSafeOutputPath({
			outputPath: '',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.risk.code).toBe('unsafe_path');
		}
	});

	// --- 6. Home-directory reference is blocked ---
	it('blocks home-directory reference (~/outside.md)', () => {
		const result = resolveSafeOutputPath({
			outputPath: '~/outside.md',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.risk.code).toBe('path_traversal');
			expect(result.risk.path).toBe('~/outside.md');
		}
	});

	// --- 7. Unsafe path is not silently rewritten ---
	it('does not silently rewrite unsafe paths to safe paths', () => {
		const result = resolveSafeOutputPath({
			outputPath: '../../secrets.txt',
			projectRoot: '/project/app',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.risk.path).toBe('../../secrets.txt');
			// The unsafe path should be reported as-is, not rewritten.
		}
	});

	// --- 8. Nested relative path works ---
	it('supports nested relative paths', () => {
		const result = resolveSafeOutputPath({
			outputPath: 'outcomes/html/01-foundation/01-thesis.html',
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
	});
});
