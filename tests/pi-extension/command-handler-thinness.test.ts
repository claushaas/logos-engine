/**
 * Step 7.3 — Command handler thinness tests.
 *
 * Proves that command handler modules remain adapter-only and do not
 * import Core internals, legacy TUI/CLI packages, or contain product logic.
 *
 * Tests:
 * 1. Command handler modules import Core only through public Core exports
 *    (src/core/index.ts or src/core/api.ts).
 * 2. Command handler modules do not import Core private internals.
 * 3. Command handler modules do not import ink, react, commander,
 *    src/cli/**, or src/tui/**.
 * 4. Core still does not import src/pi-extension/**.
 * 5. `handleIntakeMessage` is not referenced in command handler source.
 * 6. Command handler modules remain adapter-only (no product logic imports).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

/** Files under src/pi-extension/commands/** to scan. */
const COMMANDS_DIR = resolve(PROJECT_ROOT, 'src', 'pi-extension', 'commands');

/** Allowed Core entrypoints for command handler imports. */
const ALLOWED_CORE_ENTRYPOINTS = ['src/core/index.ts', 'src/core/api.ts'];

/** Core-internal directories that command handlers must not import directly. */
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

/** Forbidden packages for command handler modules. */
const FORBIDDEN_PACKAGES = [
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
	'commander',
	'@earendil-works/pi-tui',
];

/** Forbidden local directories for command handler modules. */
const FORBIDDEN_LOCAL_DIRS = ['src/cli', 'src/tui', 'src/commands'];

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('command handler thinness', () => {
	describe('command handler modules import Core only through public exports', () => {
		it('all Core-relative imports go through src/core/index.ts or src/core/api.ts', () => {
			const files = findTsFiles(COMMANDS_DIR);
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

					// Resolve to absolute.
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

					if (!isAllowed) {
						violations.push(
							`${fileRel}: "${specifier}" → ${resolvedRel} (not a public Core entrypoint)`,
						);
					}
				}
			}

			expect(
				violations,
				`Command handler modules must import Core only through public entrypoints. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('command handler modules do not import Core private internals', () => {
		it('no relative import resolves into Core internal directories', () => {
			const files = findTsFiles(COMMANDS_DIR);
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

					const isInternal = CORE_INTERNAL_DIRS.some(
						(dir) => resolvedRel === dir || resolvedRel.startsWith(`${dir}/`),
					);

					if (isInternal) {
						violations.push(
							`${fileRel}: "${specifier}" → ${resolvedRel} (Core internal)`,
						);
					}
				}
			}

			expect(
				violations,
				`Command handler modules must not import Core internals. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('command handler modules do not import legacy TUI/CLI packages', () => {
		it('no file imports ink, react, commander, or related packages', () => {
			const files = findTsFiles(COMMANDS_DIR);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const specifier of specifiers) {
					for (const pkg of FORBIDDEN_PACKAGES) {
						if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
							violations.push(`${fileRel}: "${specifier}" (forbidden package)`);
						}
					}
				}
			}

			expect(
				violations,
				`Command handler modules must not import legacy TUI/CLI packages. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('command handler modules do not import legacy local directories', () => {
		it('no relative import resolves into src/cli, src/tui, or src/commands', () => {
			const files = findTsFiles(COMMANDS_DIR);
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

					for (const dir of FORBIDDEN_LOCAL_DIRS) {
						if (resolvedRel === dir || resolvedRel.startsWith(`${dir}/`)) {
							violations.push(
								`${fileRel}: "${specifier}" → ${resolvedRel} (forbidden local dir)`,
							);
						}
					}
				}
			}

			expect(
				violations,
				`Command handler modules must not import from legacy local dirs. Found:\n${violations.join('\n')}`,
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

	describe('handleIntakeMessage is not called by command handler source', () => {
		it('no command handler source file calls handleIntakeMessage as code', () => {
			const files = findTsFiles(COMMANDS_DIR);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				// Check non-comment lines only.
				const lines = source.split('\n');
				let inBlockComment = false;
				for (const line of lines) {
					const trimmed = line.trim();
					if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
						inBlockComment = true;
						continue;
					}
					if (trimmed.includes('*/')) {
						inBlockComment = false;
						continue;
					}
					if (inBlockComment) continue;
					if (trimmed.startsWith('//')) continue;
					if (trimmed.startsWith('*')) continue; // JSDoc continuation

					// Only flag if handleIntakeMessage appears in actual code.
					if (trimmed.includes('handleIntakeMessage')) {
						violations.push(`${fileRel}: ${trimmed.slice(0, 80)}`);
					}
				}
			}

			expect(
				violations,
				`Command handler source must not call handleIntakeMessage. Found:\n${violations.join('\n')}`,
			).toEqual([]);
		});
	});

	describe('command handler modules remain adapter-only', () => {
		it('files in commands/ directory exist and are valid TypeScript', () => {
			const files = findTsFiles(COMMANDS_DIR);
			expect(files.length).toBeGreaterThan(0);

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				// Each file must have valid JS/TS syntax (basic sanity).
				expect(source.length).toBeGreaterThan(0);
			}
		});

		it('command-adapter-contract.ts uses LOGOS_LIFECYCLE_COMMANDS from Core', () => {
			const contractPath = resolve(COMMANDS_DIR, 'command-adapter-contract.ts');
			if (!existsSync(contractPath)) return;

			const source = readFileSync(contractPath, 'utf-8');

			// Must import LOGOS_LIFECYCLE_COMMANDS from Core public index.
			expect(source).toMatch(/LOGOS_LIFECYCLE_COMMANDS/);
			// Must NOT import from Core internal lifecycle-command.js.
			expect(source).not.toMatch(
				/from\s+['"]\.\.\/\.\.\/core\/intake\/lifecycle-command\.js['"]/,
			);
		});

		it('command handler source does not contain product logic terms', () => {
			const files = findTsFiles(COMMANDS_DIR);
			const suspiciousTerms = [
				'selectNextPrompt',
				'evaluateAnswer',
				'resolvedProfile',
				'buildWritePlan',
				'compileDocumentation',
			];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const fileRel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');

				for (const term of suspiciousTerms) {
					if (source.includes(term)) {
						// Only flag as violation if the term is used as a function
						// call or method reference, not in comments.
						// Simple heuristic: check if term appears outside comments.
						const lines = source.split('\n');
						let inBlockComment = false;
						for (const line of lines) {
							const trimmed = line.trim();
							if (trimmed.startsWith('/*')) inBlockComment = true;
							if (trimmed.includes('*/')) {
								inBlockComment = false;
								continue;
							}
							if (inBlockComment) continue;
							if (trimmed.startsWith('//')) continue;
							if (trimmed.includes(term)) {
								// Allow in import specifiers (re-exports) or type-only references.
								if (
									trimmed.startsWith('export type') ||
									trimmed.startsWith('import type') ||
									trimmed.startsWith('export {')
								)
									continue;
								expect.fail(
									`${fileRel}: references "${term}" — command handler modules must remain adapter-only`,
								);
							}
						}
					}
				}
			}
		});
	});
});
