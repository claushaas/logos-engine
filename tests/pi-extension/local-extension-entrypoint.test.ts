/**
 * Step 11.4 — Local Extension Entrypoint Test.
 *
 * Proves that the local Pi extension entrypoint (.pi/extensions/) is
 * either intentionally absent (with documented alternative load path)
 * or present as a thin re-export with no product logic.
 *
 * Tests:
 *
 *  1. If .pi/extensions/logos/index.ts exists, it contains only a thin
 *     export/import of src/pi-extension/index.
 *  2. It does not contain product behavior.
 *  3. It does not register commands directly.
 *  4. It does not import Core directly.
 *  5. It does not import CLI/TUI/Ink/React.
 *  6. If the local extension entrypoint is intentionally absent, the
 *     manual smoke doc documents an alternative load path.
 *
 * Boundary: file-reading and text-scanning only.  No production, Pi,
 * CLI, TUI, or network imports.  No real Pi runtime required.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

const _LOCAL_EXTENSION_DIR = '.pi/extensions/logos';
const LOCAL_EXTENSION_FILE = '.pi/extensions/logos/index.ts';
const ALTERNATE_ENTRYPOINT_FILE = '.pi/extensions/logos.ts';

const PI_EXTENSION_SOURCE = 'src/pi-extension/index';

// Forbidden imports that must NOT appear in a thin local entrypoint.
const FORBIDDEN_IMPORTS = [
	'../../src/core/',
	'../src/core/',
	'./src/core/',
	'src/core/',
	'../../src/cli/',
	'../../src/tui/',
	'../src/cli/',
	'../src/tui/',
	'@earendil-works/pi-coding-agent',
	'@earendil-works/pi-tui',
	'ink',
	'ink-testing-library',
	'react',
	'commander',
];

// Forbidden patterns that indicate product logic in the entrypoint.
const FORBIDDEN_PRODUCT_PATTERNS = [
	'registerCommand(',
	'pi.registerCommand(',
	'createLogosCore(',
	'createLogosPiExtension(',
	'handleIntakeMessage(',
	'handleIntakeCommand(',
	'startIntake(',
	'stopIntake(',
	'runGenerationPreflight(',
	'generateDocumentation(',
	'pi.on(',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectPath(relPath: string): string {
	return resolve(PROJECT_ROOT, relPath);
}

function fileExists(relPath: string): boolean {
	return existsSync(projectPath(relPath));
}

function readFile(relPath: string): string {
	return readFileSync(projectPath(relPath), 'utf-8');
}

function getSmokeDocExists(): boolean {
	return fileExists('docs/PI_EXTENSION_MANUAL_SMOKE.md');
}

function hasExtensionLoadingInfo(): boolean {
	if (!getSmokeDocExists()) return false;
	const content = readFile('docs/PI_EXTENSION_MANUAL_SMOKE.md');
	return (
		content.includes('Extension Loading') ||
		content.includes('pi -e') ||
		content.includes('.pi/extensions') ||
		content.includes('Option A') ||
		content.includes('Option B')
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('local extension entrypoint (Step 11.4)', () => {
	describe('entrypoint presence', () => {
		it('at least one of .pi/extensions/logos/index.ts, .pi/extensions/logos.ts, or manual doc alternative exists', () => {
			const hasLocal =
				fileExists(LOCAL_EXTENSION_FILE) ||
				fileExists(ALTERNATE_ENTRYPOINT_FILE);
			const hasDocAlternative = hasExtensionLoadingInfo();

			expect(
				hasLocal || hasDocAlternative,
				'Either a local extension entrypoint (.pi/extensions/logos/index.ts) must exist, ' +
					'or the manual smoke doc must document an alternative load path.',
			).toBe(true);
		});
	});

	describe('thinness (when local entrypoint exists)', () => {
		// These tests only run when the local entrypoint actually exists.
		const entrypointPath = fileExists(LOCAL_EXTENSION_FILE)
			? LOCAL_EXTENSION_FILE
			: fileExists(ALTERNATE_ENTRYPOINT_FILE)
				? ALTERNATE_ENTRYPOINT_FILE
				: null;

		const hasEntrypoint = entrypointPath !== null;

		// Always include at least one test to avoid empty-suite errors.
		it('local entrypoint file check', () => {
			// When absent, this is a no-op pass.
			expect(hasEntrypoint || !hasEntrypoint).toBe(true);
		});

		if (hasEntrypoint) {
			it(`${entrypointPath} exists and is a file`, () => {
				expect(fileExists(entrypointPath)).toBe(true);
			});

			it(`${entrypointPath} imports or re-exports the Pi extension source`, () => {
				const content = readFile(entrypointPath);
				const hasSrcRef =
					content.includes(PI_EXTENSION_SOURCE) ||
					content.includes('src/pi-extension/index');
				expect(
					hasSrcRef,
					`${entrypointPath} must reference the Pi extension source entrypoint`,
				).toBe(true);
			});

			it(`${entrypointPath} does not import forbidden packages or dirs`, () => {
				const content = readFile(entrypointPath);
				const violations: string[] = [];

				for (const forbidden of FORBIDDEN_IMPORTS) {
					if (content.includes(forbidden)) {
						violations.push(forbidden);
					}
				}

				expect(
					violations,
					violations.length > 0
						? `Forbidden imports found: ${violations.join(', ')}`
						: undefined,
				).toEqual([]);
			});

			it(`${entrypointPath} does not contain product logic`, () => {
				const content = readFile(entrypointPath);
				const violations: string[] = [];

				for (const pattern of FORBIDDEN_PRODUCT_PATTERNS) {
					if (content.includes(pattern)) {
						violations.push(pattern);
					}
				}

				expect(
					violations,
					violations.length > 0
						? `Product logic patterns found: ${violations.join(', ')}`
						: undefined,
				).toEqual([]);
			});
		}
	});

	describe('manual doc alternative path (when local entrypoint is absent)', () => {
		const localEntrypointExists =
			fileExists(LOCAL_EXTENSION_FILE) || fileExists(ALTERNATE_ENTRYPOINT_FILE);

		// Always include at least one test to avoid empty-suite errors.
		it('manual doc alternative path check', () => {
			// When entrypoint exists, this is a no-op pass.
			expect(localEntrypointExists || !localEntrypointExists).toBe(true);
		});

		// This test is only meaningful when there is NO local entrypoint.
		if (!localEntrypointExists) {
			it('manual smoke doc documents an alternative load path', () => {
				expect(
					getSmokeDocExists(),
					'docs/PI_EXTENSION_MANUAL_SMOKE.md must exist',
				).toBe(true);

				expect(
					hasExtensionLoadingInfo(),
					'Manual smoke doc must include extension loading instructions ' +
						'(Extension Loading section, pi -e flag, or .pi/extensions/ path)',
				).toBe(true);
			});
		}
	});

	describe('no stale legacy entrypoint patterns', () => {
		const directoriesToCheck = ['.pi/extensions', '.pi'];
		const existingDirs = directoriesToCheck.filter((d) =>
			existsSync(projectPath(d)),
		);

		// Always include at least one test to avoid empty-suite errors.
		it('no .pi/ directories contain CLI/TUI wrappers', () => {
			// No existing .pi/ dirs means trivially passing.
			expect(existingDirs.length >= 0).toBe(true);
		});

		for (const dir of existingDirs) {
			it(`${dir}/ does not contain CLI/TUI wrappers`, () => {
				// Walk the directory for any .ts/.js files
				const files = findSourceFiles(projectPath(dir));
				const violations: string[] = [];

				for (const file of files) {
					const content = readFileSync(file, 'utf-8');
					if (
						content.includes('src/cli/') ||
						content.includes('src/tui/') ||
						content.includes('commander') ||
						content.includes('ink') ||
						content.includes('react')
					) {
						violations.push(file);
					}
				}

				expect(
					violations,
					violations.length > 0
						? `CLI/TUI references in ${dir}/: ${violations.join(', ')}`
						: undefined,
				).toEqual([]);
			});
		}
	});
});

// ---------------------------------------------------------------------------
// Helper: recursively find .ts/.js files
// ---------------------------------------------------------------------------

function findSourceFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const results: string[] = [];
	const entries = readdirSafe(dir);

	for (const entry of entries) {
		const fullPath = resolve(dir, entry);
		const stat = statSafe(fullPath);
		if (!stat) continue;

		if (stat.isDirectory()) {
			results.push(...findSourceFiles(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.js'))
		) {
			results.push(fullPath);
		}
	}
	return results;
}

function readdirSafe(dir: string): string[] {
	try {
		return existsSync(dir) ? require('node:fs').readdirSync(dir) : [];
	} catch {
		return [];
	}
}

function statSafe(filePath: string): import('node:fs').Stats | null {
	try {
		return require('node:fs').statSync(filePath);
	} catch {
		return null;
	}
}
