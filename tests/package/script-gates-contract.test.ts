/**
 * Step 10.4 — Script gates contract tests.
 *
 * Proves that script gates follow the contract:
 * 1. No script imports Core internals.
 * 2. No script imports Pi runtime.
 * 3. No script requires credentials.
 * 4. No script performs network calls.
 * 5. No script imports forbidden packages (ink, react, commander, etc.).
 *
 * These are static text-level checks; they do not execute the scripts.
 * Uses simple string matching to avoid regex catastrophic backtracking.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SCRIPT_FILES = [
	'scripts/smoke-package.js',
	'scripts/security-check.js',
	'scripts/nfr-evidence.js',
];

// Forbidden packages that scripts must not import
const FORBIDDEN_PACKAGES = [
	'@earendil-works/pi-coding-agent',
	'@earendil-works/pi-tui',
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
	'commander',
];

// Forbidden local dirs
const FORBIDDEN_LOCAL_DIRS = [
	'src/core',
	'src/pi-extension',
	'src/cli',
	'src/tui',
	'src/commands',
];

// Network-related patterns (simple string checks — no complex regex)
const NETWORK_PATTERNS = ['fetch(', 'http.request(', 'https.request('];

// ---------------------------------------------------------------------------
// Helpers — simple string checks (no backtracking regex)
// ---------------------------------------------------------------------------

/** Check if any forbidden package name appears as a bare specifier in imports. */
function sourceContainsForbiddenPackageImport(
	source: string,
	scriptRel: string,
): string[] {
	const violations: string[] = [];
	for (const pkg of FORBIDDEN_PACKAGES) {
		// Check for actual import statements, not string literals in arrays/variables.
		// Matches: import ... from "<pkg>" or import ... from '<pkg>' or require("<pkg>")
		// or import("<pkg>") or from "<pkg>/sub" or from '<pkg>/sub'
		const importPatterns = [
			`from "${pkg}"`,
			`from '${pkg}'`,
			`from "${pkg}/`,
			`from '${pkg}/`,
			`import("${pkg}")`,
			`import('${pkg}')`,
			`require("${pkg}")`,
			`require('${pkg}')`,
		];
		for (const pat of importPatterns) {
			if (source.includes(pat)) {
				violations.push(`${scriptRel}: imports forbidden package "${pkg}"`);
				break;
			}
		}
	}
	return violations;
}

/** Check if any forbidden local directory path appears as a relative import target. */
function sourceContainsForbiddenLocalImport(
	source: string,
	scriptRel: string,
): string[] {
	const violations: string[] = [];
	for (const dir of FORBIDDEN_LOCAL_DIRS) {
		// Check for actual relative import/require statements targeting forbidden dirs
		const patterns = [
			`from "../${dir}/`,
			`from '../${dir}/`,
			`require("../${dir}/`,
			`require('../${dir}/`,
		];
		for (const pat of patterns) {
			if (source.includes(pat)) {
				violations.push(`${scriptRel}: imports from forbidden dir "${dir}"`);
				break;
			}
		}
	}
	return violations;
}

/** Check for network call patterns. */
function sourceContainsNetworkCalls(
	source: string,
	scriptRel: string,
): string[] {
	const violations: string[] = [];
	for (const pattern of NETWORK_PATTERNS) {
		if (source.includes(pattern)) {
			// Skip lines that are regex pattern definitions or comments in security-check.js
			// For security-check.js, network patterns appear in regex definitions
			if (scriptRel === 'scripts/security-check.js') {
				// Allow pattern definitions in security-check.js
				const idx = source.indexOf(pattern);
				const lineStart = source.lastIndexOf('\n', idx) + 1;
				const lineEnd = source.indexOf('\n', idx);
				const line = source.substring(
					lineStart,
					lineEnd === -1 ? source.length : lineEnd,
				);
				if (
					line.trimStart().startsWith('//') ||
					line.trimStart().startsWith('*') ||
					line.includes('= new RegExp') ||
					line.includes('networkPatterns')
				) {
					continue;
				}
			}
			violations.push(`${scriptRel}: contains network pattern "${pattern}"`);
		}
	}
	return violations;
}

/** Check for credential-requiring patterns. */
function sourceRequiresCredentials(
	source: string,
	scriptRel: string,
): string[] {
	const violations: string[] = [];
	// Check for process.env.API_KEY, process.env.TOKEN, etc.
	if (
		source.includes('process.env.API') ||
		source.includes('process.env.KEY') ||
		source.includes('process.env.TOKEN') ||
		source.includes('process.env.SECRET') ||
		source.includes('process.env.PASS')
	) {
		violations.push(`${scriptRel}: accesses credential env vars`);
	}
	if (
		source.includes('dotenv') &&
		(source.includes('require(') || source.includes('import '))
	) {
		violations.push(`${scriptRel}: imports dotenv`);
	}
	return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('script gates contract (Step 10.4)', () => {
	describe('script file existence', () => {
		for (const scriptPath of SCRIPT_FILES) {
			it(`${scriptPath} exists`, () => {
				expect(
					existsSync(resolve(PROJECT_ROOT, scriptPath)),
					`${scriptPath} does not exist`,
				).toBe(true);
			});
		}
	});

	describe('no forbidden package imports', () => {
		for (const scriptPath of SCRIPT_FILES) {
			it(`${scriptPath} does not import forbidden packages`, () => {
				const fullPath = resolve(PROJECT_ROOT, scriptPath);
				if (!existsSync(fullPath)) return;
				const source = readFileSync(fullPath, 'utf-8');
				const violations = sourceContainsForbiddenPackageImport(
					source,
					scriptPath,
				);
				expect(
					violations,
					violations.length > 0
						? `Forbidden imports:\n${violations.join('\n')}`
						: undefined,
				).toEqual([]);
			});
		}
	});

	describe('no forbidden local directory imports', () => {
		for (const scriptPath of SCRIPT_FILES) {
			it(`${scriptPath} does not import from forbidden local dirs`, () => {
				const fullPath = resolve(PROJECT_ROOT, scriptPath);
				if (!existsSync(fullPath)) return;
				const source = readFileSync(fullPath, 'utf-8');
				const violations = sourceContainsForbiddenLocalImport(
					source,
					scriptPath,
				);
				expect(
					violations,
					violations.length > 0
						? `Forbidden local imports:\n${violations.join('\n')}`
						: undefined,
				).toEqual([]);
			});
		}
	});

	describe('no network call patterns', () => {
		for (const scriptPath of SCRIPT_FILES) {
			it(`${scriptPath} has no network call patterns`, () => {
				const fullPath = resolve(PROJECT_ROOT, scriptPath);
				if (!existsSync(fullPath)) return;
				const source = readFileSync(fullPath, 'utf-8');
				const violations = sourceContainsNetworkCalls(source, scriptPath);
				expect(
					violations,
					violations.length > 0
						? `Network calls detected:\n${violations.join('\n')}`
						: undefined,
				).toEqual([]);
			});
		}
	});

	describe('no credential / env requirements', () => {
		for (const scriptPath of SCRIPT_FILES) {
			it(`${scriptPath} does not require credentials`, () => {
				const fullPath = resolve(PROJECT_ROOT, scriptPath);
				if (!existsSync(fullPath)) return;
				const source = readFileSync(fullPath, 'utf-8');
				const violations = sourceRequiresCredentials(source, scriptPath);
				expect(
					violations,
					violations.length > 0
						? `Credential requirements:\n${violations.join('\n')}`
						: undefined,
				).toEqual([]);
			});
		}
	});

	describe('script structure', () => {
		it('smoke-package.js is a valid ESM script', () => {
			const source = readFileSync(
				resolve(PROJECT_ROOT, 'scripts/smoke-package.js'),
				'utf-8',
			);
			// Must not use require()
			expect(source).not.toMatch(/\brequire\s*\(/);
			// Must have at least one check
			expect(source).toContain('process.exit(1)');
			expect(source).toContain('OK:');
		});

		it('security-check.js is a valid ESM script', () => {
			const source = readFileSync(
				resolve(PROJECT_ROOT, 'scripts/security-check.js'),
				'utf-8',
			);
			expect(source).not.toMatch(/\brequire\s*\(/);
			expect(source).toContain('process.exit(1)');
		});

		it('nfr-evidence.js is a valid ESM script', () => {
			const source = readFileSync(
				resolve(PROJECT_ROOT, 'scripts/nfr-evidence.js'),
				'utf-8',
			);
			expect(source).not.toMatch(/\brequire\s*\(/);
			expect(source).toContain('JSON.stringify');
		});
	});
});
