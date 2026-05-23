/**
 * Step 10.3 — Forbidden command surface tests (package surface).
 *
 * Proves that package.json scripts, bin entries, and package metadata
 * do not expose forbidden command-first intake workflows.
 *
 * Tests:
 * 1. No package.json script name or value contains forbidden command names.
 * 2. No bin entry exposes a forbidden command.
 * 3. No script file under scripts/ (if present) invokes forbidden commands.
 * 4. Package metadata does not advertise command-first intake progression.
 * 5. Package description does not claim command-driven intake.
 */

import type { Stats } from 'node:fs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_LOGOS_COMMANDS } from '../../src/core/index.js';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPackageJson(): Record<string, unknown> {
	const raw = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8');
	return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Check if a script value (the command string) contains a forbidden command
 * name.  This catches cases like `"logos-next"` or `"/logos-skip"` appearing
 * in script definitions.
 */
function scriptValueContainsForbiddenCommand(value: string): string[] {
	const found: string[] = [];
	const lower = value.toLowerCase();
	for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
		if (lower.includes(cmd)) {
			found.push(cmd);
		}
	}
	return found;
}

/**
 * Check if a script name contains a forbidden command name.
 */
function scriptNameContainsForbiddenCommand(name: string): string[] {
	const found: string[] = [];
	const lower = name.toLowerCase();
	for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
		if (lower.includes(cmd)) {
			found.push(cmd);
		}
	}
	return found;
}

function findScriptFiles(dir: string): string[] {
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
			files.push(...findScriptFiles(fullPath));
		} else if (
			stat.isFile() &&
			/\.(?:[cm]?[jt]s|jsx|tsx|sh|bash|zsh)$/.test(entry)
		) {
			files.push(fullPath);
		}
	}

	return files;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forbidden command surface (Step 10.3 — package)', () => {
	describe('package.json scripts', () => {
		it('no script name contains a forbidden command name', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const violations: string[] = [];

			for (const [name, value] of Object.entries(scripts)) {
				const found = scriptNameContainsForbiddenCommand(name);
				if (found.length > 0) {
					violations.push(
						`script name "${name}" contains forbidden command(s): ${found.join(', ')}`,
					);
				}
				// Also check value for completeness
				const foundInValue = scriptValueContainsForbiddenCommand(value);
				if (foundInValue.length > 0) {
					violations.push(
						`script "${name}" value "${value}" contains forbidden command(s): ${foundInValue.join(', ')}`,
					);
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Forbidden command patterns in package scripts:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('no script value contains a forbidden command name', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const violations: string[] = [];

			for (const [name, value] of Object.entries(scripts)) {
				const found = scriptValueContainsForbiddenCommand(value);
				for (const cmd of found) {
					violations.push(
						`script "${name}" = "${value}" references forbidden command "${cmd}"`,
					);
				}
			}

			expect(violations).toEqual([]);
		});

		it('no script claims to be a command-driven intake workflow', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, value] of Object.entries(scripts)) {
				// Scripts should not be named like forbidden commands
				expect(
					name,
					`Script "${name}" should not be a forbidden command name`,
				).not.toMatch(
					/^logos-(?:next|answer|continue|question|phase|doc|set-answer|skip|followup)$/,
				);
				// Script values should not invoke forbidden command workflows
				expect(
					value,
					`Script "${name}" value should not invoke forbidden commands`,
				).not.toMatch(
					/logos-(?:next|answer|continue|question|phase|doc|set-answer|skip|followup)/,
				);
			}
		});
	});

	describe('package.json bin entries', () => {
		it('no bin entry name is a forbidden command name', () => {
			const pkg = loadPackageJson();
			const bin = pkg.bin;

			if (bin !== undefined && bin !== null) {
				if (typeof bin === 'object') {
					const binObj = bin as Record<string, unknown>;
					for (const key of Object.keys(binObj)) {
						expect(FORBIDDEN_LOGOS_COMMANDS as readonly string[]).not.toContain(
							key,
						);
					}
				}
			}

			expect(true).toBe(true);
		});

		it('no bin entry path implies command-first intake', () => {
			const pkg = loadPackageJson();
			const bin = pkg.bin;

			if (bin !== undefined && bin !== null && typeof bin === 'object') {
				const binObj = bin as Record<string, string>;
				for (const [key, path] of Object.entries(binObj)) {
					const lowerPath = path.toLowerCase();
					for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
						expect(
							lowerPath.includes(cmd),
							`bin "${key}" path "${path}" should not reference forbidden command "${cmd}"`,
						).toBe(false);
					}
				}
			}

			expect(true).toBe(true);
		});
	});

	describe('scripts/ directory', () => {
		it('scripts/ does not contain files that invoke forbidden commands', () => {
			const scriptsDir = join(PROJECT_ROOT, 'scripts');
			if (!existsSync(scriptsDir)) {
				// scripts/ directory absent — deferred strategy (known gap)
				expect(true).toBe(true);
				return;
			}

			const files = findScriptFiles(scriptsDir);
			const violations: string[] = [];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const fileRel = relative(PROJECT_ROOT, file);

				// Skip test files and definition files
				if (fileRel.includes('/tests/') || fileRel.includes('test.')) {
					continue;
				}

				for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
					if (source.includes(cmd)) {
						violations.push(
							`${fileRel}: references forbidden command "${cmd}"`,
						);
					}
					// Also check slash-prefixed variant
					const slashCmd = `/${cmd}`;
					if (source.includes(slashCmd)) {
						violations.push(
							`${fileRel}: references forbidden slash command "${slashCmd}"`,
						);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Forbidden command patterns in scripts/:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});
	});

	describe('package description and keywords', () => {
		it('package description does not claim command-driven intake', () => {
			const pkg = loadPackageJson();
			const description = String(pkg.description ?? '').toLowerCase();

			expect(description).not.toMatch(/command-first/);
			expect(description).not.toMatch(/command-driven intake/);
			expect(description).not.toMatch(/logos-next|logos-skip|logos-continue/);
		});

		it('package keywords do not include forbidden command names', () => {
			const pkg = loadPackageJson();
			const keywords = (pkg.keywords ?? []) as string[];

			for (const keyword of keywords) {
				const lower = keyword.toLowerCase();
				for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
					expect(
						lower === cmd,
						`keyword "${keyword}" must not be a forbidden command name`,
					).toBe(false);
				}
			}

			expect(true).toBe(true);
		});
	});

	describe('package.json name and version fields', () => {
		it('package name does not imply a forbidden command', () => {
			const pkg = loadPackageJson();
			const name = String(pkg.name ?? '').toLowerCase();

			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(name).not.toContain(cmd);
			}
		});

		it('no top-level package field references forbidden command-first workflows', () => {
			const pkg = loadPackageJson();
			const pkgStr = JSON.stringify(pkg).toLowerCase();

			// The only safe place for forbidden command strings in source
			// is the FORBIDDEN_LOGOS_COMMANDS constant definition in Core.
			// package.json should never contain them.
			const violations: string[] = [];
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				if (pkgStr.includes(cmd)) {
					violations.push(cmd);
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Forbidden command names found in package.json: ${violations.join(', ')}`
					: undefined,
			).toEqual([]);
		});
	});
});
