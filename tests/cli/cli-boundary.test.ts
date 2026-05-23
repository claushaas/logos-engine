/**
 * Step 10.1 — CLI boundary tests.
 *
 * Proves that:
 * 1. The `src/cli/` directory is absent, consistent with the deferred strategy.
 * 2. If CLI source were present, it would not import Pi extension internals,
 *    TUI/Ink/React, or Core internals.
 * 3. Core does not import CLI code.
 *
 * Since `src/cli/` does not exist in the current repository (Strategy A:
 * Defer CLI), the import-scanning assertions are conditional. This file
 * remains in place to enforce the boundary if CLI source is ever added.
 */

import type { Stats } from 'node:fs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Boundary constants
// ---------------------------------------------------------------------------

/**
 * Packages forbidden for CLI code:
 * - Pi extension internals (CLI is not Pi)
 * - TUI rendering libraries (CLI does not render TUI)
 */
const CLI_FORBIDDEN_PACKAGES = [
	'@earendil-works/pi-coding-agent',
	'@earendil-works/pi-tui',
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
];

/**
 * Local directories forbidden for CLI imports.
 * CLI must not import Pi extension internals or TUI components.
 */
const CLI_FORBIDDEN_LOCAL_DIRS = ['src/pi-extension', 'src/tui'];

/**
 * Core internal directories that CLI must not import.
 * CLI may only import public Core exports (src/core/index.ts, src/core/api.ts).
 */
const CORE_INTERNAL_DIRS = [
	'src/core/intake',
	'src/core/generation',
	'src/core/profiles',
	'src/core/state',
	'src/core/fs',
	'src/core/evaluation',
	'src/core/questions',
	'src/core/config',
	'src/core/ports',
	'src/core/validation',
];

type BoundaryViolation = {
	file: string;
	specifier: string;
	reason: string;
};

// ---------------------------------------------------------------------------
// File scanning helpers
// ---------------------------------------------------------------------------

function findTsFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		let stat: Stats;
		try {
			stat = statSync(fullPath);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			files.push(...findTsFiles(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx'))
		) {
			files.push(fullPath);
		}
	}

	return files;
}

function getImportSpecifiers(source: string): string[] {
	const specifiers: string[] = [];

	const importFromRegex =
		/^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	const sideEffectImportRegex = /^\s*import\s+['"]([^'"]+)['"];?/gm;
	const exportFromRegex =
		/^\s*export\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

	let match: RegExpExecArray | null;

	match = importFromRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = importFromRegex.exec(source);
	}

	match = sideEffectImportRegex.exec(source);
	while (match !== null) {
		if (!specifiers.includes(match[1])) {
			specifiers.push(match[1]);
		}
		match = sideEffectImportRegex.exec(source);
	}

	match = exportFromRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = exportFromRegex.exec(source);
	}

	match = dynamicImportRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = dynamicImportRegex.exec(source);
	}

	return specifiers;
}

function isForbiddenPackage(specifier: string): string | null {
	for (const pkg of CLI_FORBIDDEN_PACKAGES) {
		if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
			return `CLI must not import ${pkg}`;
		}
	}
	return null;
}

function isForbiddenLocalPath(
	resolvedPath: string,
	projectRoot: string,
): string | null {
	const relPath = relative(projectRoot, resolvedPath).replace(/\\/g, '/');

	for (const dir of CLI_FORBIDDEN_LOCAL_DIRS) {
		if (relPath === dir || relPath.startsWith(`${dir}/`)) {
			return `CLI must not import from ${dir}`;
		}
	}

	// Also check Core internals — CLI may only use public API
	for (const dir of CORE_INTERNAL_DIRS) {
		if (relPath === dir || relPath.startsWith(`${dir}/`)) {
			return `CLI must not import Core internals (${dir}). Use public API only.`;
		}
	}

	return null;
}

function scanCliViolations(): BoundaryViolation[] {
	const cliDir = join(PROJECT_ROOT, 'src', 'cli');
	if (!existsSync(cliDir)) return [];

	const files = findTsFiles(cliDir);
	const violations: BoundaryViolation[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(PROJECT_ROOT, file);

		for (const specifier of specifiers) {
			const pkgReason = isForbiddenPackage(specifier);
			if (pkgReason) {
				violations.push({
					file: fileRel,
					reason: pkgReason,
					specifier,
				});
				continue;
			}

			if (specifier.startsWith('.')) {
				const resolved = resolve(dirname(file), specifier);
				const pathReason = isForbiddenLocalPath(resolved, PROJECT_ROOT);
				if (pathReason) {
					violations.push({
						file: fileRel,
						reason: pathReason,
						specifier,
					});
				}
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLI boundary (Step 10.1)', () => {
	describe('source directory existence', () => {
		it('src/cli/ is absent — consistent with deferred CLI strategy', () => {
			const cliDir = join(PROJECT_ROOT, 'src', 'cli');
			expect(
				existsSync(cliDir),
				'src/cli/ must not exist under Strategy A (Defer CLI)',
			).toBe(false);
		});

		it('src/tui/ is absent — consistent with deferred CLI strategy', () => {
			const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
			expect(
				existsSync(tuiDir),
				'src/tui/ must not exist under Strategy A (Defer CLI)',
			).toBe(false);
		});
	});

	describe('CLI import boundary (if CLI source is ever added)', () => {
		it('CLI does not import Pi extension, TUI, Ink, or React', () => {
			const violations = scanCliViolations();

			if (violations.length > 0) {
				const messages = violations.map(
					(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
				);
				throw new Error(
					`Forbidden imports found in CLI:\n${messages.join('\n')}`,
				);
			}

			expect(violations).toEqual([]);
		});

		it('CLI does not import Core internals', () => {
			const cliDir = join(PROJECT_ROOT, 'src', 'cli');
			if (!existsSync(cliDir)) {
				// No CLI source: test passes
				expect(true).toBe(true);
				return;
			}

			const files = findTsFiles(cliDir);
			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file);

				for (const specifier of specifiers) {
					if (!specifier.startsWith('.')) continue;
					const resolved = resolve(dirname(file), specifier);
					const relPath = relative(PROJECT_ROOT, resolved).replace(/\\/g, '/');

					for (const internalDir of CORE_INTERNAL_DIRS) {
						if (
							relPath === internalDir ||
							relPath.startsWith(`${internalDir}/`)
						) {
							throw new Error(
								`${fileRel}: imports "${specifier}" → Core internal "${internalDir}". CLI must only use public Core API.`,
							);
						}
					}
				}
			}

			expect(true).toBe(true);
		});
	});

	describe('Core does not import CLI', () => {
		it('Core source files do not reference src/cli', () => {
			const coreDir = join(PROJECT_ROOT, 'src', 'core');
			if (!existsSync(coreDir)) {
				expect(true).toBe(true);
				return;
			}

			const files = findTsFiles(coreDir);
			const cliPattern = /src\/cli/i;

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file);

				for (const specifier of specifiers) {
					if (cliPattern.test(specifier)) {
						throw new Error(
							`${fileRel}: imports "${specifier}" referencing src/cli — Core must not import CLI`,
						);
					}
				}
			}

			expect(true).toBe(true);
		});
	});

	describe('boundary detection helpers', () => {
		it('detects Pi extension as forbidden for CLI', () => {
			const reason = isForbiddenPackage('@earendil-works/pi-coding-agent');
			expect(reason).not.toBeNull();
		});

		it('detects ink as forbidden for CLI', () => {
			const reason = isForbiddenPackage('ink');
			expect(reason).not.toBeNull();
		});

		it('detects react as forbidden for CLI', () => {
			const reason = isForbiddenPackage('react');
			expect(reason).not.toBeNull();
		});

		it('detects src/pi-extension relative import as forbidden for CLI', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/cli', '../pi-extension/index.js'),
				'/project',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/pi-extension');
		});

		it('detects Core internals import as forbidden for CLI', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/cli', '../core/intake/something.js'),
				'/project',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('Core internals');
		});

		it('allows public Core API import for CLI', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/cli', '../core/index.js'),
				'/project',
			);
			expect(reason).toBeNull();
		});
	});
});
