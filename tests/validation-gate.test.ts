/**
 * Step 10.4 — Validation gate test.
 *
 * High-level structural repository gate.  Verifies:
 * 1.  package.json scripts reference existing script/test files.
 * 2.  Core entrypoint exists.
 * 3.  Pi extension entrypoint exists.
 * 4.  Core boundary test exists.
 * 5.  Pi adapter thinness test exists.
 * 6.  CLI strategy is explicit (no bin.logos, no src/cli/).
 * 7.  TUI strategy is explicit (no src/tui/).
 * 8.  Forbidden command-first commands are not active runtime commands.
 * 9.  Required LOGOS Pi extension docs exist.
 * 10. profiles/standard/docs.yml exists.
 * 11. No active package script references a missing file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPkg(): Record<string, unknown> {
	const raw = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8');
	return JSON.parse(raw) as Record<string, unknown>;
}

function exists(relPath: string): boolean {
	return existsSync(resolve(PROJECT_ROOT, relPath));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validation gate (Step 10.4)', () => {
	describe('package.json script references', () => {
		it('no active package script references a missing file', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				// "node scripts/<file>.js" refs
				const nodeMatch = cmd.match(/^node\s+(scripts\/[\w./-]+\.js)\b/);
				if (nodeMatch) {
					if (!exists(nodeMatch[1]))
						violations.push(`"${name}" → missing ${nodeMatch[1]}`);
				}

				// "vitest run tests/<file>.test.ts" refs
				const vitestMatch = cmd.match(
					/vitest\s+run\s+(tests\/[\w./_]+\.test\.ts)\b/,
				);
				if (vitestMatch) {
					if (!exists(vitestMatch[1]))
						violations.push(`"${name}" → missing ${vitestMatch[1]}`);
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Stale script references:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('smoke:cli is absent — consistent with deferred CLI strategy', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			expect(
				scripts['smoke:cli'],
				'smoke:cli script must not be present (CLI is deferred — Strategy A)',
			).toBeUndefined();
		});

		it('check:validation references an existing test file', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const cmd = scripts['check:validation'] ?? '';
			expect(cmd).toMatch(/vitest\s+run\s+/);
			// The target file must exist
			const match = cmd.match(/tests\/[\w./_-]+\.test\.ts/);
			if (match) {
				expect(
					exists(match[0]),
					`check:validation target "${match[0]}" does not exist`,
				).toBe(true);
			}
		});

		it('check script does not reference smoke:cli', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const checkCmd = scripts.check ?? '';
			expect(checkCmd).not.toMatch(/smoke:cli/);
		});

		it('smoke:package references an existing script', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const cmd = scripts['smoke:package'] ?? '';
			const match = cmd.match(/scripts\/[\w./-]+\.js/);
			if (match) {
				expect(exists(match[0])).toBe(true);
			}
		});

		it('security:check references an existing script', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const cmd = scripts['security:check'] ?? '';
			const match = cmd.match(/scripts\/[\w./-]+\.js/);
			if (match) {
				expect(exists(match[0])).toBe(true);
			}
		});

		it('nfr:evidence references an existing script', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const cmd = scripts['nfr:evidence'] ?? '';
			const match = cmd.match(/scripts\/[\w./-]+\.js/);
			if (match) {
				expect(exists(match[0])).toBe(true);
			}
		});
	});

	describe('entrypoint existence', () => {
		it('src/core/index.ts exists', () => {
			expect(exists('src/core/index.ts')).toBe(true);
		});

		it('src/pi-extension/index.ts exists', () => {
			expect(exists('src/pi-extension/index.ts')).toBe(true);
		});
	});

	describe('boundary test existence', () => {
		it('tests/core/core-boundary.test.ts exists', () => {
			expect(exists('tests/core/core-boundary.test.ts')).toBe(true);
		});

		it('tests/pi-extension/pi-adapter-thinness.test.ts exists', () => {
			expect(exists('tests/pi-extension/pi-adapter-thinness.test.ts')).toBe(
				true,
			);
		});
	});

	describe('CLI strategy (Step 10.1)', () => {
		it('no bin.logos in package.json', () => {
			const pkg = loadPkg();
			const bin = pkg.bin;
			const hasLogos =
				typeof bin === 'object' &&
				bin !== null &&
				'logos' in (bin as Record<string, unknown>);
			expect(hasLogos).toBe(false);
		});

		it('no src/cli/ directory', () => {
			expect(existsSync(join(PROJECT_ROOT, 'src', 'cli'))).toBe(false);
		});
	});

	describe('TUI strategy (Step 10.2)', () => {
		it('no src/tui/ directory', () => {
			expect(existsSync(join(PROJECT_ROOT, 'src', 'tui'))).toBe(false);
		});
	});

	describe('forbidden commands (Step 10.3)', () => {
		it('package scripts do not expose forbidden command-first flows', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			const forbidden = [
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

			const violations: string[] = [];
			for (const [name, cmd] of Object.entries(scripts)) {
				for (const f of forbidden) {
					if (cmd.toLowerCase().includes(f))
						violations.push(`"${name}" contains "${f}"`);
				}
			}
			expect(violations).toEqual([]);
		});
	});

	describe('required docs', () => {
		const requiredDocs = [
			'AGENTS.md',
			'docs/LOGOS_PI_EXTENSION_SPEC.md',
			'docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md',
			'docs/LOGOS_PI_EXTENSION_ROADMAP.md',
			'docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md',
			'profiles/standard/docs.yml',
		];

		for (const doc of requiredDocs) {
			it(`${doc} exists`, () => {
				expect(exists(doc), `${doc} is missing`).toBe(true);
			});
		}
	});

	describe('package metadata', () => {
		it('package name is logos-engine', () => {
			const pkg = loadPkg();
			expect(pkg.name).toBe('logos-engine');
		});

		it('package type is module', () => {
			const pkg = loadPkg();
			expect(pkg.type).toBe('module');
		});

		it('package description reflects Pi-extension-first direction', () => {
			const pkg = loadPkg();
			expect(String(pkg.description ?? '')).toMatch(/Pi extension/);
		});
	});
});
