/**
 * Documentation Root Policy tests — path safety, normalization, and validation.
 *
 * Phase 6: Documentation Root Configuration — Root policy tests.
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DOCUMENTATION_ROOT,
	hasTraversal,
	matchesReservedDir,
	normalizeDocumentationRootPath,
	normalizeSeparators,
	pathOverlaps,
	validateDocumentationRootPath,
} from '../src/workspace/documentation-root-policy.js';

describe('documentation root policy', () => {
	const projectRoot = '/home/user/my-project';

	describe('normalizeSeparators', () => {
		it('converts backslashes to forward slashes', () => {
			expect(normalizeSeparators('docs\\output')).toBe('docs/output');
		});

		it('collapses multiple slashes', () => {
			expect(normalizeSeparators('docs//output')).toBe('docs/output');
		});

		it('preserves forward slashes', () => {
			expect(normalizeSeparators('docs/output')).toBe('docs/output');
		});

		it('removes trailing slash', () => {
			expect(normalizeSeparators('docs/output/')).toBe('docs/output');
		});

		it('handles Windows-style paths', () => {
			expect(normalizeSeparators('C:\\Users\\project\\docs')).toBe(
				'C:/Users/project/docs',
			);
		});
	});

	describe('normalizeDocumentationRootPath', () => {
		it('resolves a relative path inside project', () => {
			const result = normalizeDocumentationRootPath('docs', projectRoot);
			expect(result.isInsideProject).toBe(true);
			expect(result.normalized).toBe('docs');
		});

		it('detects path outside project', () => {
			const result = normalizeDocumentationRootPath('../outside', projectRoot);
			expect(result.isInsideProject).toBe(false);
		});

		it('handles absolute path inside project', () => {
			const result = normalizeDocumentationRootPath(
				'/home/user/my-project/docs',
				projectRoot,
			);
			expect(result.isInsideProject).toBe(true);
			expect(result.normalized).toBe('docs');
		});

		it('resolves default logos/ path', () => {
			const result = normalizeDocumentationRootPath('logos/', projectRoot);
			expect(result.isInsideProject).toBe(true);
			expect(result.normalized).toBe('logos');
		});

		it('handles current directory', () => {
			const result = normalizeDocumentationRootPath('.', projectRoot);
			expect(result.normalized).toBe('.');
		});
	});

	describe('hasTraversal', () => {
		it('detects ../ traversal', () => {
			expect(hasTraversal('../outside')).toBe(true);
		});

		it('detects ..\\ traversal', () => {
			expect(hasTraversal('..\\outside')).toBe(true);
		});

		it('detects deep traversal', () => {
			expect(hasTraversal('docs/../../etc')).toBe(true);
		});

		it('rejects safe paths', () => {
			expect(hasTraversal('docs/output')).toBe(false);
		});

		it('rejects normal relative paths', () => {
			expect(hasTraversal('logos/')).toBe(false);
		});
	});

	describe('matchesReservedDir', () => {
		it('detects .git overlap', () => {
			const result = matchesReservedDir('.git', projectRoot);
			expect(result.matches).toBe(true);
			expect(result.dir).toBe('.git');
		});

		it('detects .logos overlap', () => {
			const result = matchesReservedDir('.logos', projectRoot);
			expect(result.matches).toBe(true);
			expect(result.dir).toBe('.logos');
		});

		it('detects node_modules overlap', () => {
			const result = matchesReservedDir('node_modules', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('detects src overlap', () => {
			const result = matchesReservedDir('src', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('detects tests overlap', () => {
			const result = matchesReservedDir('tests', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('detects profiles overlap', () => {
			const result = matchesReservedDir('profiles', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('detects package.json overlap', () => {
			const result = matchesReservedDir('package.json', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('detects README.md overlap', () => {
			const result = matchesReservedDir('README.md', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('detects project root itself', () => {
			const result = matchesReservedDir('.', projectRoot);
			expect(result.matches).toBe(true);
		});

		it('allows safe custom path', () => {
			const result = matchesReservedDir('my-docs', projectRoot);
			expect(result.matches).toBe(false);
		});

		it('allows nested safe path', () => {
			const result = matchesReservedDir('output/docs', projectRoot);
			expect(result.matches).toBe(false);
		});
	});

	describe('pathOverlaps', () => {
		it('detects same path', () => {
			const result = pathOverlaps('docs', 'docs');
			expect(result.isSame).toBe(true);
			expect(result.isChild).toBe(false);
			expect(result.isParent).toBe(false);
		});

		it('detects parent relationship', () => {
			const result = pathOverlaps('docs', 'docs/output');
			expect(result.isSame).toBe(false);
			expect(result.isChild).toBe(false);
			expect(result.isParent).toBe(true);
		});

		it('detects child relationship', () => {
			const result = pathOverlaps('docs/output', 'docs');
			expect(result.isSame).toBe(false);
			expect(result.isChild).toBe(true);
			expect(result.isParent).toBe(false);
		});

		it('detects no overlap', () => {
			const result = pathOverlaps('docs', 'src');
			expect(result.isSame).toBe(false);
			expect(result.isChild).toBe(false);
			expect(result.isParent).toBe(false);
		});
	});

	describe('validateDocumentationRootPath', () => {
		it('accepts safe custom root inside project', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'my-docs',
				projectRoot,
			});
			expect(result.safe).toBe(true);
		});

		it('accepts default logos/', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: DEFAULT_DOCUMENTATION_ROOT,
				projectRoot,
			});
			expect(result.safe).toBe(true);
		});

		it('rejects path traversal', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: false,
				normalizedPath: '../outside',
				projectRoot,
			});
			expect(result.safe).toBe(false);
			expect(
				result.checks.some(
					(c) => c.code === 'LOGOS_ROOT_PATH_TRAVERSAL' && !c.passed,
				),
			).toBe(true);
		});

		it('rejects path outside project', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: false,
				normalizedPath: 'outside-project',
				projectRoot,
			});
			expect(result.safe).toBe(false);
			expect(
				result.checks.some(
					(c) => c.code === 'LOGOS_ROOT_OUTSIDE_PROJECT' && !c.passed,
				),
			).toBe(true);
		});

		it('rejects .git overlap', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: '.git',
				projectRoot,
			});
			expect(result.safe).toBe(false);
			expect(
				result.checks.some(
					(c) => c.code === 'LOGOS_ROOT_RESERVED_PATH' && !c.passed,
				),
			).toBe(true);
		});

		it('rejects .logos overlap', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: '.logos',
				projectRoot,
			});
			expect(result.safe).toBe(false);
		});

		it('rejects node_modules overlap', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'node_modules',
				projectRoot,
			});
			expect(result.safe).toBe(false);
		});

		it('rejects src overlap', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'src',
				projectRoot,
			});
			expect(result.safe).toBe(false);
			expect(
				result.checks.some(
					(c) => c.code === 'LOGOS_ROOT_OVERLAPS_SOURCE' && !c.passed,
				),
			).toBe(true);
		});

		it('rejects tests overlap', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'tests',
				projectRoot,
			});
			expect(result.safe).toBe(false);
		});

		it('rejects package.json overlap', () => {
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'package.json',
				projectRoot,
			});
			expect(result.safe).toBe(false);
		});

		it('rejects active profile root overlap', () => {
			const result = validateDocumentationRootPath({
				activeProfileRoot: 'custom-profiles/my-profile',
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'custom-profiles/my-profile',
				projectRoot,
			});
			expect(result.safe).toBe(false);
		});

		it('warns on current root overlap (parent/child)', () => {
			const result = validateDocumentationRootPath({
				currentDocumentationRoot: 'docs',
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'docs/subdir',
				projectRoot,
			});
			// Overlap is a warning, not an error — so it should still be safe
			expect(result.safe).toBe(true);
			expect(
				result.checks.some(
					(c) =>
						c.code === 'LOGOS_ROOT_CURRENT_OVERLAP' && c.severity === 'warning',
				),
			).toBe(true);
		});

		it('normalizes Windows-style separators', () => {
			// After normalization, 'docs\\output' becomes 'docs/output'
			// which is a safe path
			const result = validateDocumentationRootPath({
				isAbsoluteInput: false,
				isInsideProject: true,
				normalizedPath: 'docs/output',
				projectRoot,
			});
			expect(result.safe).toBe(true);
		});
	});
});
