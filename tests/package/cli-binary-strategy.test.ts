/**
 * Step 10.1 — CLI Binary Strategy tests.
 *
 * Proves that:
 * 1. package.json does not expose a stale/non-buildable `logos` binary.
 * 2. No `src/cli/` source directory exists to build a CLI.
 * 3. No `src/tui/` source directory exists.
 * 4. The package description reflects Pi-extension-first MVP, not TUI-first.
 * 5. The deferred strategy is explicitly documented in the roadmap.
 * 6. Missing script files are recorded as known gaps.
 * 7. Forbidden and allowed command lists remain disjoint.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	LOGOS_LIFECYCLE_COMMANDS,
} from '../../src/core/index.js';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPackageJson(): Record<string, unknown> {
	const raw = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8');
	return JSON.parse(raw) as Record<string, unknown>;
}

function loadRoadmapText(): string {
	return readFileSync(
		join(PROJECT_ROOT, 'docs', 'LOGOS_PI_EXTENSION_ROADMAP.md'),
		'utf-8',
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLI binary strategy (Step 10.1)', () => {
	describe('package.json binary entry', () => {
		it('does not expose a stale logos binary (bin field absent or empty)', () => {
			const pkg = loadPackageJson();

			// Strategy A (Defer CLI): bin must not exist or not contain "logos"
			if ('bin' in pkg) {
				const bin = pkg.bin;
				if (bin !== undefined && bin !== null) {
					// If bin is a string, it's the binary path
					if (typeof bin === 'string') {
						throw new Error(
							`package.json "bin" is a string "${bin}" — expected no logos binary entry`,
						);
					}
					// If bin is an object, "logos" must not be present
					if (typeof bin === 'object') {
						const hasLogos = 'logos' in (bin as Record<string, unknown>);
						expect(
							hasLogos,
							'package.json "bin" must not contain a "logos" key (Strategy A: Defer CLI)',
						).toBe(false);
					}
				}
			}

			// If bin is absent entirely, that's the correct deferred state.
			expect(true).toBe(true);
		});

		it('has no bin.logos entry', () => {
			const pkg = loadPackageJson();
			const bin = pkg.bin;
			const hasLogosInBin =
				typeof bin === 'object' &&
				bin !== null &&
				'logos' in (bin as Record<string, unknown>);
			expect(hasLogosInBin).toBe(false);
		});
	});

	describe('source tree reality', () => {
		it('does not have a src/cli/ directory', () => {
			const cliDir = join(PROJECT_ROOT, 'src', 'cli');
			expect(
				existsSync(cliDir),
				'src/cli/ must not exist under deferred CLI strategy',
			).toBe(false);
		});

		it('does not have a src/tui/ directory', () => {
			const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
			expect(
				existsSync(tuiDir),
				'src/tui/ must not exist under deferred CLI strategy',
			).toBe(false);
		});
	});

	describe('package description reflects Pi-extension-first MVP', () => {
		it('does not claim to be a TUI engine', () => {
			const pkg = loadPackageJson();
			const description = String(pkg.description ?? '');
			expect(description).not.toMatch(/TUI engine/i);
		});

		it('mentions Pi extension MVP', () => {
			const pkg = loadPackageJson();
			const description = String(pkg.description ?? '');
			expect(description).toMatch(/Pi extension/i);
		});
	});

	describe('deferred strategy is documented in roadmap', () => {
		it('roadmap Step 10.1 records the deferred CLI binary decision', () => {
			const roadmap = loadRoadmapText();
			expect(roadmap).toMatch(/Strategy A.*Defer CLI/i);
			expect(roadmap).toContain(
				'stale `bin.logos` entry pointing to `./dist/cli.js` has been removed',
			);
		});

		it('roadmap Step 10.1 links to the strategy enforcement tests', () => {
			const roadmap = loadRoadmapText();
			expect(roadmap).toContain('tests/package/cli-binary-strategy.test.ts');
			expect(roadmap).toContain('tests/cli/cli-boundary.test.ts');
			expect(roadmap).toContain('tests/cli/forbidden-cli-commands.test.ts');
		});
	});

	describe('missing script files are recorded as known gaps', () => {
		it('smoke:cli script is missing (known gap for Phase 12)', () => {
			expect(existsSync(join(PROJECT_ROOT, 'scripts', 'smoke-cli.js'))).toBe(
				false,
			);
		});

		it('smoke:package script is missing (known gap for Phase 12)', () => {
			expect(
				existsSync(join(PROJECT_ROOT, 'scripts', 'smoke-package.js')),
			).toBe(false);
		});

		it('security:check script is missing (known gap for Phase 12)', () => {
			expect(
				existsSync(join(PROJECT_ROOT, 'scripts', 'security-check.js')),
			).toBe(false);
		});

		it('nfr:evidence script is missing (known gap for Phase 12)', () => {
			expect(existsSync(join(PROJECT_ROOT, 'scripts', 'nfr-evidence.js'))).toBe(
				false,
			);
		});
	});

	describe('forbidden and allowed command lists', () => {
		it('allowed lifecycle commands are exactly the five MVP commands', () => {
			expect(LOGOS_LIFECYCLE_COMMANDS).toEqual([
				'logos-init',
				'logos-start',
				'logos-stop',
				'logos-status',
				'logos-generate',
			]);
		});

		it('forbidden commands are exactly the nine banned patterns', () => {
			expect(FORBIDDEN_LOGOS_COMMANDS).toEqual([
				'logos-next',
				'logos-answer',
				'logos-continue',
				'logos-question',
				'logos-phase',
				'logos-doc',
				'logos-set-answer',
				'logos-skip',
				'logos-followup',
			]);
		});

		it('forbidden and allowed command lists are disjoint', () => {
			const allowedSet = new Set<string>(LOGOS_LIFECYCLE_COMMANDS);
			for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
				expect(
					allowedSet.has(cmd as string),
					`"${cmd}" is forbidden but appears in LOGOS_LIFECYCLE_COMMANDS`,
				).toBe(false);
			}
		});
	});
});
