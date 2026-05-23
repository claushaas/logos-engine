/**
 * Step 10.4 — Script gates existence tests.
 *
 * Proves that:
 * 1. Every active package.json script that invokes "node scripts/*.js"
 *    references an existing file.
 * 2. Every active package.json script that invokes "vitest run tests/*.test.ts"
 *    references an existing test file or valid test glob.
 * 3. No active package script references missing scripts/smoke-cli.js
 *    (CLI is deferred).
 * 4. No active package script references missing validation gate files.
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

describe('script gates existence (Step 10.4)', () => {
	describe('node scripts/*.js references', () => {
		it('all scripts/smoke-package.js references resolve to an existing file', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				const match = cmd.match(/^node\s+scripts\/smoke-package\.js\b/);
				if (match) {
					expect(
						exists('scripts/smoke-package.js'),
						`Script "${name}" references scripts/smoke-package.js which does not exist`,
					).toBe(true);
				}
			}
		});

		it('all scripts/security-check.js references resolve to an existing file', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				const match = cmd.match(/^node\s+scripts\/security-check\.js\b/);
				if (match) {
					expect(
						exists('scripts/security-check.js'),
						`Script "${name}" references scripts/security-check.js which does not exist`,
					).toBe(true);
				}
			}
		});

		it('all scripts/nfr-evidence.js references resolve to an existing file', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				const match = cmd.match(/^node\s+scripts\/nfr-evidence\.js\b/);
				if (match) {
					expect(
						exists('scripts/nfr-evidence.js'),
						`Script "${name}" references scripts/nfr-evidence.js which does not exist`,
					).toBe(true);
				}
			}
		});
	});

	describe('vitest run tests/*.test.ts references', () => {
		it('all vitest run targets that name a specific .test.ts file resolve', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				const match = cmd.match(
					/vitest\s+run\s+(tests\/[\w./_-]+\.test\.ts)\b/,
				);
				if (match) {
					const testFile = match[1];
					// Skip glob patterns
					if (testFile.includes('*') || testFile.includes('{')) continue;
					expect(
						exists(testFile),
						`Script "${name}" references "${testFile}" which does not exist`,
					).toBe(true);
				}
			}
		});

		it('check:validation references tests/validation-gate.test.ts', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			const cmd = scripts['check:validation'] ?? '';
			expect(cmd).toContain('tests/validation-gate.test.ts');
			expect(exists('tests/validation-gate.test.ts')).toBe(true);
		});
	});

	describe('no stale CLI smoke references', () => {
		it('no package script references scripts/smoke-cli.js', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				expect(
					cmd,
					`Script "${name}" must not reference scripts/smoke-cli.js (CLI is deferred)`,
				).not.toContain('scripts/smoke-cli.js');
			}
		});

		it('smoke:cli is absent from package.json scripts', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;
			expect(
				scripts['smoke:cli'],
				'smoke:cli must not be present (CLI deferred — Strategy A)',
			).toBeUndefined();
		});
	});

	describe('no stale TUI smoke references', () => {
		it('no package script references src/tui/', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const [name, cmd] of Object.entries(scripts)) {
				expect(
					cmd,
					`Script "${name}" must not reference src/tui/`,
				).not.toContain('src/tui');
			}
		});

		it('no package script references tui in name', () => {
			const pkg = loadPkg();
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			for (const name of Object.keys(scripts)) {
				expect(
					name,
					`Script name "${name}" must not contain "tui"`,
				).not.toMatch(/tui/i);
			}
		});
	});

	describe('all smoke/security/nfr scripts point to existing files', () => {
		it('smoke:package target exists', () => {
			expect(exists('scripts/smoke-package.js')).toBe(true);
		});

		it('security:check target exists', () => {
			expect(exists('scripts/security-check.js')).toBe(true);
		});

		it('nfr:evidence target exists', () => {
			expect(exists('scripts/nfr-evidence.js')).toBe(true);
		});
	});
});
