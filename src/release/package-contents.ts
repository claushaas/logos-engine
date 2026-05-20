/**
 * Package Contents Validator
 *
 * Step 13.4 — Package and Release Candidate Smoke
 *
 * Deterministic, read-only checks for package file inclusion/exclusion.
 * Does NOT publish, upload, or require network access.
 */

import type {
	PackageContentsEntry,
	PackageContentsFinding,
	PackageContentsResult,
	PackageSmokeStatus,
} from './package-smoke-model.js';
import {
	PACKAGE_EXCLUDED_PATTERNS,
	PACKAGE_EXPECTED_FILES,
	PACKAGE_SENSITIVE_MARKERS,
} from './package-smoke-model.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackageContentsCheckerOptions {
	/** Package files listing (e.g. from npm pack --dry-run or manual listing) */
	packageFiles?: string[] | undefined;
	/** Package.json "files" field */
	packageJsonFiles?: string[] | undefined;
	/** File existence map for testing */
	_fileExists?: Record<string, boolean> | undefined;
	/** Project root */
	projectRoot?: string | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePath(p: string): string {
	return p.replace(/\\/g, '/');
}

function matchesPattern(normalized: string, pattern: string): boolean {
	const normalizedPattern = pattern.replace(/\\/g, '/');

	// Exact match
	if (normalized === normalizedPattern) return true;

	// Prefix match (e.g. "dist" matches "dist/cli.js")
	if (normalized.startsWith(`${normalizedPattern}/`)) return true;

	// Suffix match (e.g. ".env" matches "src/.env" or "path/.env")
	if (normalized.endsWith(`/${normalizedPattern}`)) return true;

	// Glob-style ** match
	if (normalizedPattern.endsWith('/**')) {
		const prefix = normalizedPattern.slice(0, -3);
		if (normalized.startsWith(prefix)) return true;
	}
	if (normalizedPattern.endsWith('**')) {
		const prefix = normalizedPattern.slice(0, -2);
		if (normalized.startsWith(prefix)) return true;
	}

	// Glob-style .env.* match
	if (normalizedPattern === '.env.*') {
		return normalized.startsWith('.env.') || normalized.endsWith('/.env.');
	}

	return false;
}

function isExcludedPattern(file: string): boolean {
	const normalized = normalizePath(file);
	for (const pattern of PACKAGE_EXCLUDED_PATTERNS) {
		if (matchesPattern(normalized, pattern)) return true;
	}
	return false;
}

function isSensitiveFile(file: string): boolean {
	const normalized = normalizePath(file);
	for (const marker of PACKAGE_SENSITIVE_MARKERS) {
		if (normalized.includes(marker)) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

export function checkPackageContents(
	options: PackageContentsCheckerOptions = {},
): PackageContentsResult {
	const findings: PackageContentsFinding[] = [];
	const entries: PackageContentsEntry[] = [];

	let packageFiles = options.packageFiles;

	// Simulate package files from package.json "files" + defaults if no explicit list
	if (!packageFiles && options.packageJsonFiles) {
		packageFiles = [
			...options.packageJsonFiles,
			'package.json', // npm always includes package.json
			'README.md', // npm default-includes README
		];
	}

	// If no files at all, build from package.json files field and common includes
	if (!packageFiles) {
		const pjf = options.packageJsonFiles ?? [];
		packageFiles = [...pjf, 'package.json', 'README.md', 'LICENSE'];
	}

	// Build entries and check for excluded patterns
	for (const file of packageFiles) {
		const normalized = normalizePath(file);
		const excluded = isExcludedPattern(normalized);
		const sensitive = isSensitiveFile(normalized) || excluded;

		entries.push({
			explicitlyExcluded: false,
			included: !excluded,
			path: normalized,
		});

		if (sensitive) {
			const isEnvFile =
				normalized === '.env' ||
				normalized.startsWith('.env.') ||
				normalized.endsWith('/.env') ||
				normalized.includes('/.env.');
			const isLogosWorkspace =
				normalized.startsWith('.logos') || normalized.includes('/.logos/');
			const isBackup =
				normalized.startsWith('backups') || normalized.includes('/backups/');
			const isCoverage =
				normalized.startsWith('coverage') || normalized.includes('/coverage/');
			const isGit =
				normalized.startsWith('.git') || normalized.includes('/.git/');
			const isNodeModules =
				normalized.startsWith('node_modules') ||
				normalized.includes('/node_modules/');

			let message: string;
			let severity: 'error' | 'warning' = 'error';

			if (isEnvFile) {
				message = `Sensitive file included in package: ${normalized}`;
				severity = 'error';
			} else if (isLogosWorkspace) {
				message = `Workspace state included in package: ${normalized}`;
				severity = 'error';
			} else if (isBackup) {
				message = `Backup files included in package: ${normalized}`;
				severity = 'error';
			} else if (isGit) {
				message = `Git directory included in package: ${normalized}`;
				severity = 'error';
			} else if (isNodeModules) {
				message = `node_modules included in package: ${normalized}`;
				severity = 'warning';
			} else if (isCoverage) {
				message = `Coverage output included in package: ${normalized}`;
				severity = 'warning';
			} else {
				message = `Sensitive file included in package: ${normalized}`;
				severity = 'error';
			}

			findings.push({
				kind: 'sensitive_included',
				message,
				path: normalized,
				recoveryHint: 'Exclude this file from package publication.',
				severity,
			});
		}
	}

	// Check expected files are included
	const expectedIncluded: string[] = [];
	const expectedExcluded: string[] = [];
	for (const expected of PACKAGE_EXPECTED_FILES) {
		const found = entries.some(
			(e) => e.path === expected || e.path.startsWith(`${expected}/`),
		);
		if (!found) {
			expectedIncluded.push(expected);
			findings.push({
				kind: 'required_missing',
				message: `Required file/directory not found in package: ${expected}`,
				path: expected,
				recoveryHint: `Include "${expected}" in package files.`,
				severity:
					expected === 'LICENSE' || expected === 'README.md'
						? 'warning'
						: 'error',
			});
		}
	}

	// Check expected exclusions
	for (const excludedPattern of PACKAGE_EXCLUDED_PATTERNS) {
		if (excludedPattern.includes('*') || excludedPattern === '.env.*') continue;
		const found = entries.some((e) => {
			const normalized = normalizePath(e.path);
			return matchesPattern(normalized, excludedPattern);
		});
		if (!found) {
			expectedExcluded.push(excludedPattern);
		}
	}

	// Determine status
	const errorCount = findings.filter(
		(f) => f.severity === 'error' || f.severity === 'fatal',
	).length;
	const warningCount = findings.filter((f) => f.severity === 'warning').length;
	const passed = errorCount === 0;

	let status: PackageSmokeStatus;
	if (!passed) {
		status = 'blocked';
	} else if (warningCount > 0) {
		status = 'pass_with_warnings';
	} else {
		status = 'pass';
	}

	const summary = passed
		? `Package contents check passed. ${packageFiles.length} file(s) checked, ${warningCount} warning(s).`
		: `Package contents check blocked. ${errorCount} error(s), ${warningCount} warning(s).`;

	return {
		entries,
		expectedExcluded,
		expectedIncluded,
		findings,
		passed,
		status,
		summary,
	};
}

/**
 * Build expected included files list based on package configuration.
 */
export function getExpectedIncludedFiles(
	packageJsonFiles?: string[],
): string[] {
	const base = ['package.json', 'README.md', 'LICENSE'];
	const fromConfig = packageJsonFiles ?? ['dist', 'profiles'];
	return [...new Set([...base, ...fromConfig])];
}

/**
 * Check if a file path should be excluded from the package.
 */
export function shouldExcludeFromPackage(filePath: string): boolean {
	return isExcludedPattern(filePath);
}
