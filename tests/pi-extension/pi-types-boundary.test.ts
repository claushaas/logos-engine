/**
 * Step 7.1 — Pi Types Boundary Tests.
 *
 * Proves that Pi package imports are isolated to `src/pi-extension/**`
 * and that Core remains free of Pi, legacy TUI/Ink/React imports.
 *
 * Tests:
 * 1. Pi package imports appear only under `src/pi-extension/**`.
 * 2. Core has no Pi package imports.
 * 3. Core has no direct imports from `src/pi-extension/**`.
 * 4. The Pi type boundary file (`src/pi-extension/pi-types.ts`) exists.
 * 5. The Pi type boundary does not import Core implementation internals.
 * 6. src/pi-extension/** does not import legacy TUI/Ink/React unless
 *    explicitly needed and justified.
 */

import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

/** The Pi package name that must only be imported from src/pi-extension/**. */
const PI_PACKAGE_NAME = '@earendil-works/pi-coding-agent';

/**
 * Packages that `src/pi-extension/**` should NOT import.
 * These are legacy TUI/CLI concerns that do not belong in Pi extension code.
 */
const LEGACY_TUI_PACKAGES = [
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
	'commander',
];

/**
 * Packages that are absolutely forbidden everywhere (including pi-extension).
 * The pi-extension should only import Pi APIs (and Core).
 */
const FORBIDDEN_PI_EXTENSION_PACKAGES = ['@earendil-works/pi-tui'];

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

type ImportRecord = {
	file: string;
	specifier: string;
};

function getImportSpecifiers(source: string): string[] {
	const specifiers: string[] = [];

	// import ... from "..." (including import type)
	const importFromRegex =
		/^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	// side-effect imports: import "..."
	const sideEffectImportRegex = /^\s*import\s+['"]([^'"]+)['"];?/gm;
	// export ... from "..." (including export type)
	const exportFromRegex =
		/^\s*export\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	// dynamic import("...")
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

function collectPiImports(projectRoot: string): ImportRecord[] {
	const files = findTsSourceFiles(projectRoot);
	const records: ImportRecord[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		for (const specifier of specifiers) {
			if (
				specifier === PI_PACKAGE_NAME ||
				specifier.startsWith(`${PI_PACKAGE_NAME}/`)
			) {
				records.push({ file, specifier });
			}
		}
	}

	return records;
}

function collectLegacyTuiImports(dir: string): ImportRecord[] {
	const files = findTsSourceFilesInDir(dir);
	const records: ImportRecord[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		for (const specifier of specifiers) {
			for (const pkg of LEGACY_TUI_PACKAGES) {
				if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
					records.push({ file, specifier });
				}
			}
			for (const pkg of FORBIDDEN_PI_EXTENSION_PACKAGES) {
				if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
					records.push({ file, specifier });
				}
			}
		}
	}

	return records;
}

/** Collect imports from `src/pi-extension/**` into any path. Used to find
 *  forbidden Core-internal imports from the Pi extension. */
function _collectPiExtensionImports(projectRoot: string): ImportRecord[] {
	const piDir = resolve(projectRoot, 'src', 'pi-extension');
	const files = findTsSourceFilesInDir(piDir);
	const records: ImportRecord[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		for (const specifier of specifiers) {
			records.push({ file, specifier });
		}
	}

	return records;
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Recursively find .ts and .tsx files under a root directory. */
function findTsSourceFilesInDir(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			files.push(...findTsSourceFilesInDir(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx'))
		) {
			files.push(fullPath);
		}
	}

	return files;
}

/** Recursively find .ts and .tsx files under project src. */
function findTsSourceFiles(projectRoot: string): string[] {
	const srcDir = resolve(projectRoot, 'src');
	return findTsSourceFilesInDir(srcDir);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi types boundary', () => {
	describe('Pi package import isolation', () => {
		it('all Pi package imports come from src/pi-extension/**', () => {
			const piImports = collectPiImports(PROJECT_ROOT);

			for (const imp of piImports) {
				const relPath = relative(PROJECT_ROOT, imp.file).replace(/\\/g, '/');
				expect(
					relPath,
					`File "${relPath}" imports "${imp.specifier}" but is not under src/pi-extension/`,
				).toMatch(/^src\/pi-extension\//);
			}
		});

		it('at least one Pi type import exists in src/pi-extension/**', () => {
			const piImports = collectPiImports(PROJECT_ROOT);
			expect(
				piImports.length,
				'No Pi package imports found — type boundary may be missing',
			).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Core has no Pi imports', () => {
		it('no file under src/core/** imports the Pi package', () => {
			const piImports = collectPiImports(PROJECT_ROOT);
			const corePiImports = piImports.filter((imp) => {
				const relPath = relative(PROJECT_ROOT, imp.file).replace(/\\/g, '/');
				return relPath.startsWith('src/core/');
			});

			expect(
				corePiImports,
				`Core files must not import ${PI_PACKAGE_NAME}. Found in: ${corePiImports.map((i) => relative(PROJECT_ROOT, i.file)).join(', ')}`,
			).toEqual([]);
		});
	});

	describe('Core has no imports from src/pi-extension/**', () => {
		it('no file under src/core/** relative-imports src/pi-extension', () => {
			// Use the existing core-boundary logic: scan core files for
			// relative imports that resolve to src/pi-extension.
			const coreDir = resolve(PROJECT_ROOT, 'src', 'core');
			const piExtDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			const coreFiles = findTsSourceFilesInDir(coreDir);
			const violations: ImportRecord[] = [];

			for (const file of coreFiles) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				for (const specifier of specifiers) {
					if (specifier.startsWith('.')) {
						const resolved = resolve(
							file.split('/').slice(0, -1).join('/'),
							specifier,
						);
						// Remove .js extension for comparison
						const normalized = resolved.replace(/\.js$/, '.ts');
						if (
							normalized.startsWith(piExtDir) ||
							(piExtDir.endsWith('.ts') && normalized === piExtDir)
						) {
							violations.push({ file, specifier });
						}
					}
				}
			}

			expect(
				violations,
				`Core files must not import from src/pi-extension/. Found: ${violations.map((v) => `${relative(PROJECT_ROOT, v.file)} → ${v.specifier}`).join(', ')}`,
			).toEqual([]);
		});
	});

	describe('Pi type boundary file', () => {
		const PI_TYPES_PATH = resolve(
			PROJECT_ROOT,
			'src',
			'pi-extension',
			'pi-types.ts',
		);

		it('exists at src/pi-extension/pi-types.ts', () => {
			expect(
				existsSync(PI_TYPES_PATH),
				'src/pi-extension/pi-types.ts must exist',
			).toBe(true);
		});

		it('exports LogosPiExtensionApi type', () => {
			const source = readFileSync(PI_TYPES_PATH, 'utf-8');
			expect(source).toContain('LogosPiExtensionApi');
		});

		it('uses import type for Pi package imports', () => {
			const source = readFileSync(PI_TYPES_PATH, 'utf-8');
			// Each Pi package import statement must use `import type`.
			// Multiline imports span several lines, so we find every
			// `from "@earendil-works/pi-coding-agent"` and walk backwards
			// to find the statement start keyword.
			const lines = source.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line === undefined) continue;
				if (line.includes(`from "${PI_PACKAGE_NAME}"`)) {
					// Walk backwards to find the start of this import/export statement.
					let startLine = line;
					for (let j = i - 1; j >= 0; j--) {
						const prev = lines[j];
						if (prev === undefined) continue;
						const trimmed = prev.trim();
						if (
							trimmed.startsWith('import ') ||
							trimmed.startsWith('export ')
						) {
							startLine = trimmed;
							break;
						}
						// Stop if we hit a blank line or a comment.
						if (
							trimmed === '' ||
							trimmed.startsWith('//') ||
							trimmed.startsWith('/*')
						) {
							break;
						}
					}
					expect(
						startLine,
						`Pi package import must use "import type": found "${startLine.trim()}"`,
					).toMatch(/^(?:import\s+type|export\s+type)/);
				}
			}
		});
	});

	describe('Pi type boundary does not import Core implementation internals', () => {
		const PI_TYPES_PATH = resolve(
			PROJECT_ROOT,
			'src',
			'pi-extension',
			'pi-types.ts',
		);

		it('pi-types.ts does not import from src/core/**', () => {
			if (!existsSync(PI_TYPES_PATH)) {
				// This test is only meaningful when the file exists.
				// The "exists" test above already asserts existence.
				return;
			}

			const source = readFileSync(PI_TYPES_PATH, 'utf-8');
			const specifiers = getImportSpecifiers(source);

			for (const specifier of specifiers) {
				expect(
					specifier,
					'pi-types.ts must not import from Core',
				).not.toContain('core');
			}
		});

		it('pi-types.ts does not define product behavior', () => {
			if (!existsSync(PI_TYPES_PATH)) return;

			const source = readFileSync(PI_TYPES_PATH, 'utf-8');

			// The pi-types.ts file should be type-only.  It should not:
			// - export functions with runtime behavior (export function)
			// - export classes
			// - contain state mutations
			const hasRuntimeExports =
				/\bexport\s+(function|class|const|let|var)\b/.test(source);

			expect(
				hasRuntimeExports,
				'pi-types.ts should be type-only (no runtime exports)',
			).toBe(false);
		});
	});

	describe('Pi extension does not import legacy TUI/Ink/React', () => {
		it('src/pi-extension/** has no legacy TUI package imports', () => {
			const piDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			if (!existsSync(piDir)) return;

			const legacyImports = collectLegacyTuiImports(piDir);

			expect(
				legacyImports,
				`src/pi-extension/** must not import legacy TUI packages. Found: ${legacyImports.map((i) => `${relative(PROJECT_ROOT, i.file)} → ${i.specifier}`).join(', ')}`,
			).toEqual([]);
		});
	});
});
