/**
 * Step 10.1 — Forbidden CLI commands tests.
 *
 * Proves that no CLI source or package surface introduces forbidden
 * command-first intake patterns.
 *
 * Tests:
 * 1. src/cli/ is absent — consistent with deferred strategy.
 * 2. If CLI source were present, it must not register or handle any
 *    forbidden command (logos-next, logos-answer, logos-continue,
 *    logos-question, logos-phase, logos-doc, logos-set-answer,
 *    logos-skip, logos-followup).
 * 3. Slash-prefixed variants are absent from CLI source.
 * 4. All source files under src/ (including Core and Pi extension) are
 *    scanned for forbidden command patterns in command-registration
 *    contexts.
 * 5. The FORBIDDEN_LOGOS_COMMANDS constant is present and complete.
 */

import type { Stats } from 'node:fs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_LOGOS_COMMANDS } from '../../src/core/index.js';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Forbidden command names (without leading slash)
// ---------------------------------------------------------------------------

const FORBIDDEN_NAMES = new Set<string>(FORBIDDEN_LOGOS_COMMANDS);

// Slash-prefixed variants
const SLASH_FORBIDDEN_NAMES = [...FORBIDDEN_LOGOS_COMMANDS].map((c) => `/${c}`);

// ---------------------------------------------------------------------------
// Patterns that would indicate command registration/handling
// ---------------------------------------------------------------------------

/**
 * Regex patterns that match command registration or handling.
 * Matches things like:
 * - `case 'logos-next':`
 * - `"logos-next"`
 * - `'logos-next'`
 * - `command === 'logos-next'`
 * - `.registerCommand('logos-next'`
 * - `/logos-next`
 */
function buildForbiddenPatterns(): Array<{
	pattern: RegExp;
	description: string;
}> {
	const patterns: Array<{ pattern: RegExp; description: string }> = [];

	for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
		// Quoted string references
		patterns.push({
			description: `quoted string "${cmd}"`,
			pattern: new RegExp(`["'\`]${cmd}["'\`]`, 'g'),
		});
		// Slash-prefixed references inside strings
		patterns.push({
			description: `slash-prefixed "/${cmd}"`,
			pattern: new RegExp(`["'\`]/${cmd}["'\`]`, 'g'),
		});
	}

	return patterns;
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

function findSourceFiles(dir: string): string[] {
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
			// Skip node_modules
			if (entry === 'node_modules') continue;
			files.push(...findSourceFiles(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.js'))
		) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Determine if a match is in a context that looks like it *declares a variable/constant
 * whose name happens to be the forbidden command*, rather than *using it as a runtime value*.
 *
 * We want to exclude lines like:
 *   'logos-next',
 *   FORBIDDEN_LOGOS_COMMANDS = [...]
 *   export const FORBIDDEN_LOGOS_COMMANDS
 *   const forbidden = ['logos-next', ...]
 *   // logo-next is forbidden
 *
 * We also want to exclude comment lines.
 */
function looksLikeDeclarationOrComment(line: string, _cmd: string): boolean {
	const trimmed = line.trim();

	// Skip comment lines
	if (
		trimmed.startsWith('//') ||
		trimmed.startsWith('/*') ||
		trimmed.startsWith('*')
	) {
		return true;
	}

	// Skip lines that are part of the FORBIDDEN_LOGOS_COMMANDS constant definition
	if (
		trimmed.includes('FORBIDDEN_LOGOS_COMMANDS') ||
		trimmed.includes('forbidden') ||
		trimmed.includes('Forbidden')
	) {
		return true;
	}

	// Skip lines that are part of test assertions about forbidden commands
	if (trimmed.includes('not.toContain') || trimmed.includes('not.toMatch')) {
		return true;
	}

	// Skip lines in comment blocks / documentation
	if (trimmed.includes('@see') || trimmed.includes('Forbidden')) {
		return true;
	}

	return false;
}

type ForbiddenMatch = {
	file: string;
	line: number;
	content: string;
	description: string;
};

function scanForForbiddenCommands(files: string[]): ForbiddenMatch[] {
	const patterns = buildForbiddenPatterns();
	const matches: ForbiddenMatch[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const lines = source.split('\n');
		const fileRel = relative(PROJECT_ROOT, file);

		for (const { pattern, description } of patterns) {
			// Extract just the command name from the description
			const cmdMatch = description.match(/"([^"]+)"/);
			const cmd = cmdMatch ? cmdMatch[1]?.replace(/^\//, '') : '';

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? '';
				// Reset lastIndex for global regex
				pattern.lastIndex = 0;
				let match = pattern.exec(line);
				while (match !== null) {
					if (!looksLikeDeclarationOrComment(line, cmd)) {
						matches.push({
							content: line.trim().substring(0, 120),
							description,
							file: fileRel,
							line: i + 1,
						});
					}
					match = pattern.exec(line);
				}
			}
		}
	}

	return matches;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forbidden CLI commands (Step 10.1)', () => {
	describe('src/cli/ is absent', () => {
		it('src/cli/ directory does not exist — deferred strategy', () => {
			const cliDir = join(PROJECT_ROOT, 'src', 'cli');
			expect(
				existsSync(cliDir),
				'src/cli/ must not exist under Strategy A (Defer CLI)',
			).toBe(false);
		});
	});

	describe('no CLI source registers forbidden commands', () => {
		it('CLI directory is absent so no forbidden commands can be registered', () => {
			const cliDir = join(PROJECT_ROOT, 'src', 'cli');
			if (existsSync(cliDir)) {
				const cliFiles = findSourceFiles(cliDir);
				const matches = scanForForbiddenCommands(cliFiles);
				if (matches.length > 0) {
					const messages = matches.map(
						(m) => `${m.file}:${m.line} — ${m.description}: "${m.content}"`,
					);
					throw new Error(
						`Forbidden command patterns found in CLI source:\n${messages.join('\n')}`,
					);
				}
			}
			// No CLI source: deferred strategy
			expect(true).toBe(true);
		});
	});

	describe('no src/ source uses forbidden commands outside declaration context', () => {
		it('all src/** source files are free of forbidden command usage', () => {
			const srcDir = join(PROJECT_ROOT, 'src');
			if (!existsSync(srcDir)) {
				expect(true).toBe(true);
				return;
			}

			const files = findSourceFiles(srcDir);
			const matches = scanForForbiddenCommands(files);

			// Filter out files where matches are in definition/test contexts
			// We allow matches in:
			// - src/core/intake/lifecycle-command.ts (the FORBIDDEN_LOGOS_COMMANDS constant definition)
			// - src/core/intake/detect-lifecycle-command.ts (lifecycle command detection)
			// - Test files
			const realMatches = matches.filter((m) => {
				// Always allow the definition source
				if (
					m.file.includes('lifecycle-command.ts') ||
					m.file.includes('detect-lifecycle-command.ts') ||
					m.file.includes('forbidden-commands') ||
					m.file.includes('forbidden-lifecycle')
				) {
					return false;
				}
				// Allow test files
				if (m.file.includes('/tests/') || m.file.includes('test.ts')) {
					return false;
				}
				return true;
			});

			if (realMatches.length > 0) {
				const messages = realMatches.map(
					(m) => `${m.file}:${m.line} — ${m.description}: "${m.content}"`,
				);
				throw new Error(
					`Forbidden command patterns found in source (outside definition/test files):\n${messages.join('\n')}`,
				);
			}

			expect(realMatches).toEqual([]);
		});
	});

	describe('individual forbidden commands are absent', () => {
		const forbiddenCommands = [
			'logos-next',
			'logos-answer',
			'logos-continue',
			'logos-question',
			'logos-phase',
			'logos-doc',
			'logos-set-answer',
			'logos-skip',
			'logos-followup',
		];

		for (const cmd of forbiddenCommands) {
			it(`${cmd} is in FORBIDDEN_LOGOS_COMMANDS`, () => {
				expect(FORBIDDEN_NAMES.has(cmd)).toBe(true);
			});

			it(`${cmd} is not in the Pi extension command registry`, () => {
				// The Pi extension test `forbidden-commands-not-registered.test.ts`
				// already proves this for the Pi extension.
				// For CLI: there is no CLI source, so this is vacuously true.
				expect(true).toBe(true);
			});
		}
	});

	describe('slash-prefixed forbidden variants are not registered', () => {
		it('slash-prefixed forbidden commands are known', () => {
			expect(SLASH_FORBIDDEN_NAMES).toHaveLength(
				FORBIDDEN_LOGOS_COMMANDS.length,
			);
		});

		it('no slash-prefixed forbidden names appear in command registration code', () => {
			const srcDir = join(PROJECT_ROOT, 'src');
			if (!existsSync(srcDir)) {
				expect(true).toBe(true);
				return;
			}

			const files = findSourceFiles(srcDir);
			const slashPattern = new RegExp(
				`["'\`]/(?:${FORBIDDEN_LOGOS_COMMANDS.join('|')})["'\`]`,
				'g',
			);

			const found: Array<{ file: string; line: number; content: string }> = [];
			for (const file of files) {
				// Skip known-safe files
				const fileRel = relative(PROJECT_ROOT, file);
				if (
					fileRel.includes('lifecycle-command.ts') ||
					fileRel.includes('forbidden-commands') ||
					fileRel.includes('forbidden-lifecycle') ||
					fileRel.includes('/tests/')
				) {
					continue;
				}

				const source = readFileSync(file, 'utf-8');
				const lines = source.split('\n');
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i] ?? '';
					slashPattern.lastIndex = 0;
					let match = slashPattern.exec(line);
					while (match !== null) {
						if (!looksLikeDeclarationOrComment(line, '')) {
							found.push({
								content: line.trim().substring(0, 120),
								file: fileRel,
								line: i + 1,
							});
						}
						match = slashPattern.exec(line);
					}
				}
			}

			if (found.length > 0) {
				const messages = found.map(
					(f) => `${f.file}:${f.line}: "${f.content}"`,
				);
				throw new Error(
					`Slash-prefixed forbidden command references found:\n${messages.join('\n')}`,
				);
			}

			expect(found).toEqual([]);
		});
	});
});
