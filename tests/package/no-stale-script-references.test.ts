/**
 * Step 10.4 — No stale script references tests.
 *
 * Proves that package.json scripts are consistent with current strategy:
 * 1. No reference to absent CLI/TUI smoke files.
 * 2. No reference to stale README-described gates.
 * 3. No forbidden command-first workflows in scripts.
 * 4. Package scripts consistent with CLI deferred decision (no smoke:cli).
 * 5. Package scripts consistent with TUI deferred decision (no TUI scripts).
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('no stale script references (Step 10.4)', () => {
	describe('no absent CLI/TUI smoke file references', () => {
		it('no script references scripts/smoke-cli.js', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				expect(
					cmd,
					`Script "${name}" must not reference scripts/smoke-cli.js`,
				).not.toContain('scripts/smoke-cli.js');
			}
		});

		it('no script references src/cli/ or src/tui/', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				expect(
					cmd,
					`Script "${name}" must not reference src/cli/ or src/tui/`,
				).not.toMatch(/src\/(?:cli|tui)\//);
			}
		});
	});

	describe('no stale README-described gate references', () => {
		it('no script references scripts that were only described in stale README', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			// Known stale README script paths (from Phase 0 audit)
			const staleScripts = [
				'scripts/smoke-cli.js',
				'scripts/validate.js',
				'scripts/diagnose.js',
			];

			for (const [name, cmd] of Object.entries(scripts)) {
				for (const stale of staleScripts) {
					expect(
						cmd,
						`Script "${name}" must not reference stale script "${stale}"`,
					).not.toContain(stale);
				}
			}
		});
	});

	describe('no forbidden command-first workflows in scripts', () => {
		it('package scripts do not expose forbidden command names', () => {
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

	describe('CLI deferred strategy consistency', () => {
		it('smoke:cli is absent from package.json', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			expect(scripts['smoke:cli']).toBeUndefined();
		});

		it('check script does not reference smoke:cli', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			expect(scripts.check ?? '').not.toMatch(/smoke:cli/);
		});

		it('no bin.logos in package.json', () => {
			const pkg = loadPkg();
			const bin = pkg.bin;
			if (bin && typeof bin === 'object') {
				expect('logos' in (bin as Record<string, unknown>)).toBe(false);
			}
		});

		it('src/cli/ does not exist', () => {
			expect(existsSync(join(PROJECT_ROOT, 'src', 'cli'))).toBe(false);
		});
	});

	describe('TUI deferred strategy consistency', () => {
		it('no TUI-related script names', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const name of Object.keys(scripts)) {
				expect(name).not.toMatch(/tui/i);
			}
		});

		it('src/tui/ does not exist', () => {
			expect(existsSync(join(PROJECT_ROOT, 'src', 'tui'))).toBe(false);
		});

		it('no script command references tui', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				expect(
					cmd.toLowerCase(),
					`Script "${name}" command contains "tui"`,
				).not.toMatch(/tui/);
			}
		});
	});

	describe('all active script references are honest', () => {
		it('every node scripts/*.js target exists', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				const match = cmd.match(/^node\s+(scripts\/[\w./-]+\.js)\b/);
				if (match) {
					const target = match[1];
					if (!existsSync(resolve(PROJECT_ROOT, target))) {
						violations.push(`"${name}" → "${target}" (missing)`);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Script targets are missing:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});
	});
});
