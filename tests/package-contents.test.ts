/**
 * Package Contents Validator Tests
 *
 * Step 13.4 — Package and Release Candidate Smoke
 */

import { describe, expect, it } from 'vitest';
import {
	checkPackageContents,
	getExpectedIncludedFiles,
	shouldExcludeFromPackage,
} from '../src/release/package-contents.js';

describe('package contents', () => {
	describe('checkPackageContents', () => {
		it('passes with valid package files', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'dist/index.js',
					'dist/index.d.ts',
					'profiles/standard/docs.yml',
					'profiles/standard/document.schema.yml',
					'README.md',
					'LICENSE',
					'package.json',
				],
			});

			expect(result.passed).toBe(true);
			expect(result.status).toBe('pass');
			expect(
				result.findings.filter((f) => f.severity === 'error'),
			).toHaveLength(0);
		});

		it('blocks when dist is missing', () => {
			const result = checkPackageContents({
				packageFiles: [
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
				],
			});

			expect(result.passed).toBe(false);
			expect(result.status).toBe('blocked');
			const missing = result.findings.filter(
				(f) => f.kind === 'required_missing',
			);
			expect(missing.some((f) => f.path === 'dist')).toBe(true);
		});

		it('blocks when profiles/standard is missing', () => {
			const result = checkPackageContents({
				packageFiles: ['dist/cli.js', 'README.md', 'LICENSE', 'package.json'],
			});

			const missing = result.findings.filter(
				(f) => f.kind === 'required_missing',
			);
			expect(missing.some((f) => f.path === 'profiles')).toBe(true);
		});

		it('warns when README is missing', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'LICENSE',
					'package.json',
				],
			});

			const missing = result.findings.filter(
				(f) => f.kind === 'required_missing',
			);
			const readme = missing.find((f) => f.path === 'README.md');
			expect(readme).toBeDefined();
			expect(readme?.severity).toBe('warning');
		});

		it('warns when LICENSE is missing', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'package.json',
				],
			});

			const missing = result.findings.filter(
				(f) => f.kind === 'required_missing',
			);
			const license = missing.find((f) => f.path === 'LICENSE');
			expect(license).toBeDefined();
			expect(license?.severity).toBe('warning');
		});

		it('blocks when .env is included', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
					'.env',
				],
			});

			expect(result.passed).toBe(false);
			expect(result.status).toBe('blocked');
			const sensitive = result.findings.filter(
				(f) => f.kind === 'sensitive_included',
			);
			expect(sensitive.some((f) => f.path === '.env')).toBe(true);
		});

		it('blocks when .logos is included', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
					'.logos/workspace.json',
				],
			});

			expect(result.passed).toBe(false);
			const sensitive = result.findings.filter(
				(f) => f.kind === 'sensitive_included',
			);
			expect(sensitive.some((f) => f.path === '.logos/workspace.json')).toBe(
				true,
			);
		});

		it('blocks when backups are included', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
					'backups/workspace-backup.json',
				],
			});

			expect(result.passed).toBe(false);
			const sensitive = result.findings.filter(
				(f) => f.kind === 'sensitive_included',
			);
			expect(
				sensitive.some((f) => f.path === 'backups/workspace-backup.json'),
			).toBe(true);
		});

		it('blocks when .git is included', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
					'.git/config',
				],
			});

			expect(result.passed).toBe(false);
			const sensitive = result.findings.filter(
				(f) => f.kind === 'sensitive_included',
			);
			expect(sensitive.some((f) => f.path === '.git/config')).toBe(true);
		});

		it('warns when coverage is included', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
					'coverage/lcov.info',
				],
			});

			const sensitive = result.findings.filter(
				(f) => f.kind === 'sensitive_included',
			);
			const cov = sensitive.find((f) => f.path === 'coverage/lcov.info');
			expect(cov).toBeDefined();
			expect(cov?.severity).toBe('warning');
		});

		it('warns when node_modules is included', () => {
			const result = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
					'node_modules/react/index.js',
				],
			});

			const sensitive = result.findings.filter(
				(f) => f.kind === 'sensitive_included',
			);
			const nm = sensitive.find(
				(f) => f.path === 'node_modules/react/index.js',
			);
			expect(nm).toBeDefined();
			expect(nm?.severity).toBe('warning');
		});

		it('produces deterministic ordering of findings', () => {
			const result1 = checkPackageContents({
				packageFiles: [
					'.env',
					'.logos/workspace.json',
					'dist/cli.js',
					'README.md',
					'LICENSE',
					'package.json',
				],
			});

			const result2 = checkPackageContents({
				packageFiles: [
					'dist/cli.js',
					'README.md',
					'.env',
					'LICENSE',
					'package.json',
					'.logos/workspace.json',
				],
			});

			// Findings should be in deterministic order regardless of input order
			const paths1 = result1.findings.map((f) => f.path);
			const paths2 = result2.findings.map((f) => f.path);
			expect(paths1).toEqual(paths2);
		});
	});

	describe('shouldExcludeFromPackage', () => {
		it('excludes .env files', () => {
			expect(shouldExcludeFromPackage('.env')).toBe(true);
			expect(shouldExcludeFromPackage('src/.env')).toBe(true);
		});

		it('excludes .logos files', () => {
			expect(shouldExcludeFromPackage('.logos')).toBe(true);
			expect(shouldExcludeFromPackage('.logos/workspace.json')).toBe(true);
		});

		it('excludes node_modules', () => {
			expect(shouldExcludeFromPackage('node_modules')).toBe(true);
		});

		it('excludes .git', () => {
			expect(shouldExcludeFromPackage('.git')).toBe(true);
		});

		it('does not exclude regular source files', () => {
			expect(shouldExcludeFromPackage('dist/cli.js')).toBe(false);
			expect(shouldExcludeFromPackage('src/index.ts')).toBe(false);
			expect(shouldExcludeFromPackage('package.json')).toBe(false);
		});
	});

	describe('getExpectedIncludedFiles', () => {
		it('returns base expected files', () => {
			const files = getExpectedIncludedFiles();
			expect(files).toContain('package.json');
			expect(files).toContain('README.md');
			expect(files).toContain('LICENSE');
		});

		it('includes custom files from package config', () => {
			const files = getExpectedIncludedFiles(['dist', 'profiles', 'docs']);
			expect(files).toContain('dist');
			expect(files).toContain('profiles');
			expect(files).toContain('docs');
		});
	});
});
