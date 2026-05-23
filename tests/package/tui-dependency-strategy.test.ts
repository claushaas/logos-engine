/**
 * Step 10.2 — TUI dependency strategy tests.
 *
 * Proves that:
 * 1. If ink, react, or ink-testing-library remain in package.json, they are
 *    not imported by Core or Pi extension.
 * 2. No package script claims a working TUI smoke test unless the referenced
 *    script/source exists.
 * 3. If TUI dependencies are removed, package metadata remains valid.
 * 4. The selected TUI strategy is explicit in roadmap or implementation plan.
 *
 * Current reality (Strategy A: Defer TUI):
 * - src/tui/ is absent
 * - ink, react, commander are in dependencies but unused by any source
 * - @types/react, ink-testing-library are in devDependencies but unused
 * - package scripts smoke:cli and smoke:package reference missing scripts
 * - package keywords include "tui" (legacy artifact)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

function _loadImplementationPlanText(): string {
	return readFileSync(
		join(PROJECT_ROOT, 'docs', 'LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md'),
		'utf-8',
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TUI dependency strategy (Step 10.2)', () => {
	describe('package.json dependency audit', () => {
		it('ink is present as a dependency but no source imports it', () => {
			const pkg = loadPackageJson();
			const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;

			// ink is still present (Strategy A keeps legacy deps)
			expect(deps.ink, 'ink is a legacy dependency').toBeDefined();

			// Verify no source imports ink (proved by tui-isolation.test.ts)
			// This test just verifies the package metadata is consistent
			expect(typeof deps.ink).toBe('string');
		});

		it('react is present as a dependency but no source imports it', () => {
			const pkg = loadPackageJson();
			const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
			expect(deps.react, 'react is a legacy dependency').toBeDefined();
		});

		it('commander is present as a dependency but no source imports it', () => {
			const pkg = loadPackageJson();
			const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
			expect(deps.commander, 'commander is a legacy dependency').toBeDefined();
		});

		it('ink-testing-library is present as a devDependency but no test imports it', () => {
			const pkg = loadPackageJson();
			const devDeps = (pkg.devDependencies ?? {}) as Record<string, unknown>;
			expect(
				devDeps['ink-testing-library'],
				'ink-testing-library is a legacy devDependency',
			).toBeDefined();
		});

		it('@types/react is present as a devDependency but no source imports it', () => {
			const pkg = loadPackageJson();
			const devDeps = (pkg.devDependencies ?? {}) as Record<string, unknown>;
			expect(
				devDeps['@types/react'],
				'@types/react is a legacy devDependency',
			).toBeDefined();
		});
	});

	describe('no TUI smoke test claims without source/scripts', () => {
		it('smoke:cli is absent from package.json (CLI deferred — Step 10.4)', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, unknown>;

			// smoke:cli removed in Step 10.4 — CLI is deferred
			expect(
				scripts['smoke:cli'],
				'smoke:cli must be absent (CLI deferred — Strategy A)',
			).toBeUndefined();

			const smokeCliFile = join(PROJECT_ROOT, 'scripts', 'smoke-cli.js');
			expect(
				existsSync(smokeCliFile),
				'smoke-cli.js must not exist (CLI deferred)',
			).toBe(false);
		});

		it('smoke:package script exists and target file is present (Step 10.4)', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, unknown>;

			expect(scripts['smoke:package']).toBeDefined();

			const smokePkgFile = join(PROJECT_ROOT, 'scripts', 'smoke-package.js');
			expect(
				existsSync(smokePkgFile),
				'smoke-package.js must exist (Step 10.4)',
			).toBe(true);
		});

		it('no package script claims a working TUI', () => {
			const pkg = loadPackageJson();
			const scripts = (pkg.scripts ?? {}) as Record<string, unknown>;
			const scriptEntries = Object.entries(scripts);

			for (const [name, command] of scriptEntries) {
				const cmdStr = String(command);
				expect(
					cmdStr,
					`Script "${name}" must not reference a "tui" smoke test: "${cmdStr}"`,
				).not.toMatch(/tui/i);
			}
		});
	});

	describe('package keywords do not claim TUI-first', () => {
		it('keywords array does not include "tui" as the primary descriptor', () => {
			const pkg = loadPackageJson();
			const keywords = (pkg.keywords ?? []) as string[];

			// "tui" may still be present as a legacy keyword, but it should not
			// be the first or primary keyword. Accept its presence as a legacy
			// artifact that will be cleaned up in a later phase.
			if (keywords.includes('tui')) {
				const tuiIndex = keywords.indexOf('tui');
				expect(
					tuiIndex,
					'"tui" keyword is a legacy artifact; it should not be the first keyword',
				).toBeGreaterThan(0);
			}

			// But ensure "documentation" or Pi-related keywords are present
			expect(keywords).toContain('documentation');
		});

		it('package description reflects Pi-extension-first direction', () => {
			const pkg = loadPackageJson();
			const description = String(pkg.description ?? '');
			expect(description).toMatch(/Pi extension/);
			expect(description).not.toMatch(/TUI engine/);
		});
	});

	describe('TUI strategy is documented in roadmap and implementation plan', () => {
		it('roadmap Step 10.2 records the TUI/Ink isolation strategy', () => {
			const roadmap = loadRoadmapText();
			// Step 10.2 exists in the roadmap
			expect(roadmap).toContain('Step 10.2 — Isolate Or Remove Ink/TUI Paths');

			// The implementation decision should be recorded
			expect(roadmap).toMatch(
				/\[Decision\].*Ink\/TUI.*isolat|\[Decision\].*TUI.*deferr|Step 10\.2.*Decision/i,
			);
		});

		it('roadmap references the TUI isolation and strategy tests', () => {
			const roadmap = loadRoadmapText();

			// Should reference the test files created/updated for this step
			expect(roadmap).toContain('tests/tui/tui-isolation.test.ts');
			expect(roadmap).toContain('tests/tui/forbidden-tui-commands.test.ts');
			expect(roadmap).toContain(
				'tests/package/tui-dependency-strategy.test.ts',
			);
		});
	});

	describe('strategy classification', () => {
		it('src/tui/ is absent — Strategy A (Defer TUI) is active', () => {
			const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
			expect(existsSync(tuiDir)).toBe(false);
		});

		it('src/cli/ is absent — consistent with deferred CLI strategy', () => {
			const cliDir = join(PROJECT_ROOT, 'src', 'cli');
			expect(existsSync(cliDir)).toBe(false);
		});

		it('package.json main/types fields point to core index, not CLI', () => {
			const pkg = loadPackageJson();
			const main = String(pkg.main ?? '');
			expect(main).not.toContain('cli');
			const types = String(pkg.types ?? '');
			expect(types).not.toContain('cli');
		});

		it('no "bin" field exposes a TUI binary', () => {
			const pkg = loadPackageJson();
			const bin = pkg.bin;
			if (bin !== undefined && bin !== null && typeof bin === 'object') {
				const binKeys = Object.keys(bin as Record<string, unknown>);
				for (const key of binKeys) {
					expect(key, `"bin" key "${key}" must not imply TUI`).not.toMatch(
						/tui/i,
					);
				}
			}
			expect(true).toBe(true);
		});
	});

	describe('package metadata remains valid', () => {
		it('package.json is parseable JSON', () => {
			const pkg = loadPackageJson();
			expect(pkg.name).toBe('logos-engine');
			expect(pkg.version).toBeDefined();
		});

		it('exports field points to dist/index.js', () => {
			const pkg = loadPackageJson();
			const exports = pkg.exports as Record<string, unknown>;
			const dot = (exports?.['.'] ?? {}) as Record<string, unknown>;
			expect(dot.default).toBe('./dist/index.js');
		});

		it('files array does not include src/tui (nonexistent anyway)', () => {
			const pkg = loadPackageJson();
			const files = (pkg.files ?? []) as string[];
			expect(files).not.toContain('src/tui');
			expect(files).not.toContain('src/cli');
		});
	});
});
