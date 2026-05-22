/**
 * Step 7.2 — Pi adapter thinness tests.
 *
 * Proves that the Pi extension stays thin:
 * 1. src/pi-extension/** imports Core only through public Core exports
 *    (src/core/index.ts or src/core/api.ts).
 * 2. src/pi-extension/** does not import Core private internals
 *    (src/core/intake/**, src/core/generation/**, src/core/profiles/**,
 *     src/core/state/**, src/core/fs/**, src/core/evaluation/**,
 *     src/core/questions/**).
 * 3. src/pi-extension/** does not import ink, react, commander,
 *    src/cli/**, or src/tui/**.
 * 4. src/core/** does not import src/pi-extension/**.
 *
 * Known exception (pre-existing from Step 5.5):
 *   src/pi-extension/commands/command-adapter-contract.ts imports
 *   LogosLifecycleCommand from ../../core/intake/lifecycle-command.js.
 *   This type IS available through the public API (src/core/index.ts)
 *   but the import goes through a Core-internal path.  It is recorded
 *   as a known thinness gap and should be cleaned up when the public
 *   re-export path is verified.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

/** Allowed Core entrypoints for pi-extension imports. */
const ALLOWED_CORE_ENTRYPOINTS = ['src/core/index.ts', 'src/core/api.ts'];

/** Core-internal directories that pi-extension must not import directly. */
const CORE_INTERNAL_DIRS = [
	'src/core/intake',
	'src/core/generation',
	'src/core/profiles',
	'src/core/state',
	'src/core/fs',
	'src/core/evaluation',
	'src/core/questions',
	'src/core/config',
	'src/core/artifacts',
	'src/core/validation',
	'src/core/ports',
];

/** Forbidden packages for pi-extension. */
const FORBIDDEN_PI_EXTENSION_PACKAGES = [
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
	'commander',
	'@earendil-works/pi-tui',
];

/** Forbidden local directories for pi-extension. */
const FORBIDDEN_PI_EXTENSION_DIRS = ['src/cli', 'src/tui', 'src/commands'];

/**
 * Known exceptions — files and their specific import specifiers that
 * are pre-existing thinness gaps.  These should be resolved in later
 * cleanup steps, not in Step 7.2.
 */
const KNOWN_EXCEPTIONS: Array<{
	filePattern: string;
	specifierPattern: string;
	reason: string;
}> = [
	{
		filePattern: 'src/pi-extension/commands/command-adapter-contract.ts',
		reason:
			'Pre-existing Step 5.5 import through Core-internal path. ' +
			'LogosLifecycleCommand is publicly exported but imported from internal module.',
		specifierPattern: '../../core/intake/lifecycle-command.js',
	},
];

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

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

function findTsFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
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

function isKnownException(fileRel: string, specifier: string): boolean {
	return KNOWN_EXCEPTIONS.some(
		(e) =>
			fileRel.endsWith(e.filePattern) && specifier.endsWith(e.specifierPattern),
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi adapter thinness', () => {
	describe('pi-extension imports Core only through public exports', () => {
		it('all pi-extension Core imports go through src/core/index.ts or src/core/api.ts', () => {
			const piExtDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			const files = findTsFiles(piExtDir);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const specifier of specifiers) {
					// Only check relative imports that go into src/core.
					if (!specifier.startsWith('..')) continue;
					if (!specifier.includes('/core/') && !specifier.includes('/core.'))
						continue;

					// Resolve to an absolute path.
					const fileDir = file.replace(/[/\\][^/\\]+$/, '');
					const resolved = resolve(fileDir, specifier);
					const resolvedRel = relative(PROJECT_ROOT, resolved).replace(
						/\\/g,
						'/',
					);

					// Check if this resolves to an allowed entrypoint.
					const isAllowed = ALLOWED_CORE_ENTRYPOINTS.some(
						(ep) =>
							resolvedRel === ep ||
							resolvedRel.startsWith(ep.replace('.ts', '')),
					);

					if (!isAllowed && !isKnownException(fileRel, specifier)) {
						violations.push(
							`${fileRel}: "${specifier}" → ${resolvedRel} (not a public Core entrypoint)`,
						);
					}
				}
			}

			expect(
				violations,
				`Pi extension must import Core only through public entrypoints. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('pi-extension does not import Core private internals', () => {
		it('no pi-extension relative import resolves into Core internal directories', () => {
			const piExtDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			const files = findTsFiles(piExtDir);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const specifier of specifiers) {
					if (!specifier.startsWith('..')) continue;

					const fileDir = file.replace(/[/\\][^/\\]+$/, '');
					const resolved = resolve(fileDir, specifier);
					const resolvedRel = relative(PROJECT_ROOT, resolved).replace(
						/\\/g,
						'/',
					);

					// Check if it's in a Core internal directory.
					const isInternal = CORE_INTERNAL_DIRS.some(
						(dir) => resolvedRel === dir || resolvedRel.startsWith(`${dir}/`),
					);

					if (isInternal && !isKnownException(fileRel, specifier)) {
						violations.push(
							`${fileRel}: "${specifier}" → ${resolvedRel} (Core internal)`,
						);
					}
				}
			}

			expect(
				violations,
				`Pi extension must not import Core internals. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('pi-extension does not import legacy TUI/CLI packages', () => {
		it('no pi-extension file imports ink, react, commander, or related packages', () => {
			const piExtDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			const files = findTsFiles(piExtDir);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const specifier of specifiers) {
					for (const pkg of FORBIDDEN_PI_EXTENSION_PACKAGES) {
						if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
							violations.push(`${fileRel}: "${specifier}" (forbidden package)`);
						}
					}
				}
			}

			expect(
				violations,
				`Pi extension must not import legacy TUI/CLI packages. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('pi-extension does not import legacy local directories', () => {
		it('no pi-extension relative import resolves into src/cli, src/tui, or src/commands', () => {
			const piExtDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			const files = findTsFiles(piExtDir);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const specifier of specifiers) {
					if (!specifier.startsWith('..')) continue;

					const fileDir = file.replace(/[/\\][^/\\]+$/, '');
					const resolved = resolve(fileDir, specifier);
					const resolvedRel = relative(PROJECT_ROOT, resolved).replace(
						/\\/g,
						'/',
					);

					for (const dir of FORBIDDEN_PI_EXTENSION_DIRS) {
						if (resolvedRel === dir || resolvedRel.startsWith(`${dir}/`)) {
							if (!isKnownException(fileRel, specifier)) {
								violations.push(
									`${fileRel}: "${specifier}" → ${resolvedRel} (forbidden local dir)`,
								);
							}
						}
					}
				}
			}

			expect(
				violations,
				`Pi extension must not import from legacy local dirs. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('Core does not import pi-extension', () => {
		it('no src/core/** file imports from src/pi-extension/**', () => {
			const coreDir = resolve(PROJECT_ROOT, 'src', 'core');
			const files = findTsFiles(coreDir);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const specifier of specifiers) {
					if (!specifier.startsWith('..')) continue;

					const fileDir = file.replace(/[/\\][^/\\]+$/, '');
					const resolved = resolve(fileDir, specifier);
					const resolvedRel = relative(PROJECT_ROOT, resolved).replace(
						/\\/g,
						'/',
					);

					if (
						resolvedRel === 'src/pi-extension' ||
						resolvedRel.startsWith('src/pi-extension/')
					) {
						violations.push(`${fileRel}: "${specifier}"`);
					}
				}
			}

			expect(
				violations,
				`Core must not import from pi-extension. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});
});
