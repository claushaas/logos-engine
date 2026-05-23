/**
 * Step 11.4 — Quality Gates Contract Test.
 *
 * Proves that the package quality gate infrastructure is sound:
 *
 *  1. Every package.json script referenced in manual/quality gate docs exists.
 *  2. Active scripts do not reference missing files.
 *  3. Active scripts do not reference deferred CLI/TUI smoke gates.
 *  4. Active scripts do not require network or credentials (text-level check).
 *  5. `check:validation` exists and points to a valid test file or pattern.
 *  6. Contract matrix tests exist under tests/contracts/.
 *  7. Core E2E test exists.
 *  8. Pi extension E2E harness tests exist.
 *  9. Smoke package, security, and NFR scripts exist when package scripts
 *     reference them.
 * 10. No active quality gate exposes forbidden command-first workflows.
 *
 * Boundary: file-system and text-scanning only.  No production, Pi, CLI,
 * TUI, or network imports.  No real Pi runtime required.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

/**
 * Scripts that MUST exist because package.json quality-gate chain
 * references them.  Derived from `pnpm check` transcript in package.json.
 */
const REQUIRED_SCRIPT_NAMES = [
	'lint',
	'lint:biome',
	'lint:md',
	'typecheck',
	'test',
	'check:validation',
	'build',
	'smoke:package',
	'security:check',
	'nfr:evidence',
	'check',
];

/**
 * Forbidden command names — these must NOT appear as valid workflow
 * commands in script names, documentation, or package.json commands.
 */
const FORBIDDEN_LOGOS_COMMANDS = [
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

/** CLI/TUI smoke gate patterns that must NOT appear in active scripts. */
const DEFERRED_CLI_TUI_GATE_PATTERNS = [
	'smoke:cli',
	'smoke-cli',
	'smoke:tui',
	'smoke-tui',
	'cli.test',
	'tui.test',
];

/**
 * Minimal set of test files that gate the quality infrastructure itself.
 * Each of these MUST exist.
 */
const REQUIRED_GATE_TEST_FILES = [
	'tests/validation-gate.test.ts',
	'tests/contracts/required-contract-matrix.test.ts',
	'tests/contracts/contract-matrix-coverage.test.ts',
	'tests/contracts/required-contracts.ts',
	'tests/core/core-e2e-scenario.test.ts',
	'tests/pi-extension/pi-extension-e2e-harness.test.ts',
	'tests/pi-extension/pi-extension-e2e-conversation.test.ts',
	'tests/pi-extension/pi-extension-e2e-generation.test.ts',
	'tests/package/script-gates-exist.test.ts',
	'tests/package/script-gates-contract.test.ts',
	'tests/package/no-stale-script-references.test.ts',
	'tests/package/package-smoke-contract.test.ts',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectPath(relPath: string): string {
	return resolve(PROJECT_ROOT, relPath);
}

function fileExists(relPath: string): boolean {
	return existsSync(projectPath(relPath));
}

function loadPkg(): Record<string, unknown> {
	const raw = readFileSync(projectPath('package.json'), 'utf-8');
	return JSON.parse(raw) as Record<string, unknown>;
}

function getScripts(): Record<string, string> {
	const pkg = loadPkg();
	return (pkg.scripts ?? {}) as Record<string, string>;
}

/** Check a string for network-call patterns (false positives on definition strings tolerated). */
function hasNetworkPattern(cmd: string): boolean {
	const patterns = [
		/\bfetch\s*\(/,
		/\bhttp\.request\s*\(/,
		/\bhttps\.request\s*\(/,
		/\bcurl\b/,
		/\bwget\b/,
	];
	return patterns.some((p) => p.test(cmd));
}

/** Check a string for credential env-var access. */
function hasCredentialPattern(cmd: string): boolean {
	const patterns = [
		/\bprocess\.env\.API\b/i,
		/\bprocess\.env\.KEY\b/i,
		/\bprocess\.env\.TOKEN\b/i,
		/\bprocess\.env\.SECRET\b/i,
		/\bprocess\.env\.PASS\b/i,
		/\bdotenv\b/,
	];
	return patterns.some((p) => p.test(cmd));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quality gates contract (Step 11.4)', () => {
	describe('required script names', () => {
		const scripts = getScripts();
		const scriptNames = new Set(Object.keys(scripts));

		for (const required of REQUIRED_SCRIPT_NAMES) {
			it(`script "${required}" exists in package.json`, () => {
				expect(
					scriptNames.has(required),
					`Missing required script: "${required}"`,
				).toBe(true);
			});
		}
	});

	describe('no active script references missing files', () => {
		it('all "node scripts/<file>.js" references point to existing files', () => {
			const scripts = getScripts();
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				const match = cmd.match(/^node\s+(scripts\/[\w./-]+\.js)\b/);
				if (match) {
					const relPath = match[1];
					if (!fileExists(relPath)) {
						violations.push(`"${name}" → missing ${relPath}`);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Stale script file references:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('all "vitest run tests/<file>.test.ts" references point to existing files', () => {
			const scripts = getScripts();
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				// Match vitest run with explicit test file paths (no globs)
				const re = /vitest\s+run\s+(tests\/[\w./_-]+\.test\.ts)\b/g;
				const matches = cmd.matchAll(re);
				for (const m of matches) {
					const testFile = m[1];
					if (!fileExists(testFile)) {
						violations.push(`"${name}" → missing ${testFile}`);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Stale test file references:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});
	});

	describe('no deferred CLI/TUI smoke gates in active scripts', () => {
		it('package scripts do not reference smoke:cli or smoke:tui', () => {
			const scripts = getScripts();
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				const lower = cmd.toLowerCase();
				for (const pattern of DEFERRED_CLI_TUI_GATE_PATTERNS) {
					if (lower.includes(pattern)) {
						violations.push(`"${name}" references "${pattern}"`);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Deferred CLI/TUI gate references found:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('"smoke:cli" script does not exist', () => {
			const scripts = getScripts();
			expect(
				scripts['smoke:cli'],
				'smoke:cli script must not be present (CLI is deferred)',
			).toBeUndefined();
		});
	});

	describe('active scripts do not require network or credentials', () => {
		it('package script commands do not contain network call patterns', () => {
			const scripts = getScripts();
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				if (hasNetworkPattern(cmd)) {
					violations.push(`"${name}" contains network call pattern`);
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Network patterns in scripts:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('package script commands do not contain credential env-var access', () => {
			const scripts = getScripts();
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				if (hasCredentialPattern(cmd)) {
					violations.push(`"${name}" accesses credential env vars`);
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Credential patterns in scripts:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('script source files do not contain network call patterns', () => {
			const scriptFiles = [
				'scripts/smoke-package.js',
				'scripts/security-check.js',
				'scripts/nfr-evidence.js',
			];
			const violations: string[] = [];

			for (const sf of scriptFiles) {
				if (!fileExists(sf)) continue;
				const content = readFileSync(projectPath(sf), 'utf-8');
				// Only flag actual network calls, not pattern definitions
				const lines = content.split('\n');
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					// Skip comment lines and pattern definitions
					if (
						line.trimStart().startsWith('//') ||
						line.trimStart().startsWith('*') ||
						line.trimStart().startsWith('/*') ||
						line.includes('= new RegExp') ||
						line.includes('networkPatterns') ||
						line.includes('Network call patterns')
					) {
						continue;
					}
					if (
						line.includes('fetch(') ||
						line.includes('http.request(') ||
						line.includes('https.request(')
					) {
						violations.push(`${sf}:${i + 1}: network call`);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Script network calls:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});
	});

	describe('check:validation', () => {
		it('exists in package.json', () => {
			const scripts = getScripts();
			expect(
				scripts['check:validation'],
				'"check:validation" script is missing',
			).toBeDefined();
		});

		it('references a vitest run command', () => {
			const scripts = getScripts();
			expect(scripts['check:validation']).toMatch(/vitest\s+run/);
		});

		it('references an existing test file', () => {
			const scripts = getScripts();
			const cmd = scripts['check:validation'] ?? '';
			const match = cmd.match(/tests\/[\w./_-]+\.test\.ts/);
			if (match) {
				expect(
					fileExists(match[0]),
					`check:validation target "${match[0]}" does not exist`,
				).toBe(true);
			}
		});
	});

	describe('contract matrix tests', () => {
		it('required-contract-matrix.test.ts exists', () => {
			expect(
				fileExists('tests/contracts/required-contract-matrix.test.ts'),
			).toBe(true);
		});

		it('contract-matrix-coverage.test.ts exists', () => {
			expect(
				fileExists('tests/contracts/contract-matrix-coverage.test.ts'),
			).toBe(true);
		});

		it('required-contracts.ts manifest exists', () => {
			expect(fileExists('tests/contracts/required-contracts.ts')).toBe(true);
		});
	});

	describe('E2E tests', () => {
		it('Core E2E scenario test exists', () => {
			expect(fileExists('tests/core/core-e2e-scenario.test.ts')).toBe(true);
		});

		it('Pi extension E2E harness test exists', () => {
			expect(
				fileExists('tests/pi-extension/pi-extension-e2e-harness.test.ts'),
			).toBe(true);
		});

		it('Pi extension E2E conversation test exists', () => {
			expect(
				fileExists('tests/pi-extension/pi-extension-e2e-conversation.test.ts'),
			).toBe(true);
		});

		it('Pi extension E2E generation test exists', () => {
			expect(
				fileExists('tests/pi-extension/pi-extension-e2e-generation.test.ts'),
			).toBe(true);
		});
	});

	describe('smoke / security / NFR script existence', () => {
		it('smoke:package script has a corresponding script file', () => {
			const scripts = getScripts();
			const cmd = scripts['smoke:package'] ?? '';
			const match = cmd.match(/scripts\/[\w./-]+\.js/);
			if (match) {
				expect(fileExists(match[0])).toBe(true);
			}
		});

		it('security:check script has a corresponding script file', () => {
			const scripts = getScripts();
			const cmd = scripts['security:check'] ?? '';
			const match = cmd.match(/scripts\/[\w./-]+\.js/);
			if (match) {
				expect(fileExists(match[0])).toBe(true);
			}
		});

		it('nfr:evidence script has a corresponding script file', () => {
			const scripts = getScripts();
			const cmd = scripts['nfr:evidence'] ?? '';
			const match = cmd.match(/scripts\/[\w./-]+\.js/);
			if (match) {
				expect(fileExists(match[0])).toBe(true);
			}
		});
	});

	describe('no forbidden command-first workflows in quality gates', () => {
		it('package scripts do not contain forbidden command names', () => {
			const scripts = getScripts();
			const violations: string[] = [];

			for (const [name, cmd] of Object.entries(scripts)) {
				const lower = cmd.toLowerCase();
				for (const forbidden of FORBIDDEN_LOGOS_COMMANDS) {
					if (lower.includes(forbidden)) {
						violations.push(`"${name}" contains "${forbidden}"`);
					}
				}
			}

			expect(
				violations,
				violations.length > 0
					? `Forbidden commands in scripts:\n${violations.join('\n')}`
					: undefined,
			).toEqual([]);
		});

		it('script source files do not register forbidden commands', () => {
			const scriptFiles = [
				'scripts/smoke-package.js',
				'scripts/security-check.js',
				'scripts/nfr-evidence.js',
			];

			for (const sf of scriptFiles) {
				if (!fileExists(sf)) continue;
				const content = readFileSync(projectPath(sf), 'utf-8');
				for (const forbidden of FORBIDDEN_LOGOS_COMMANDS) {
					// Forbidden command names may appear in constants / arrays that
					// CHECK for their absence. We verify they are not used as positive
					// action triggers.  Check for registerCommand / handler patterns.
					const registerPattern = new RegExp(
						`registerCommand\\s*\\(\\s*['"]${forbidden}['"]`,
					);
					expect(
						registerPattern.test(content),
						`${sf} registers forbidden command "${forbidden}"`,
					).toBe(false);
				}
			}
		});
	});

	describe('required gate test files', () => {
		for (const testFile of REQUIRED_GATE_TEST_FILES) {
			it(`${testFile} exists`, () => {
				expect(
					fileExists(testFile),
					`Required gate test file "${testFile}" is missing`,
				).toBe(true);
			});
		}
	});

	describe('manual smoke documentation', () => {
		it('docs/PI_EXTENSION_MANUAL_SMOKE.md exists', () => {
			expect(fileExists('docs/PI_EXTENSION_MANUAL_SMOKE.md')).toBe(true);
		});
	});
});
