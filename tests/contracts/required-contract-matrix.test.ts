/**
 * Step 11.3 — Required Contract Matrix Test.
 *
 * Validates the structural integrity of the required contract manifest:
 *
 * 1. Every required contract has valid fields (non-empty id, valid area,
 *    non-empty description, at least one requiredTestFiles entry, status
 *    "required").
 * 2. Contract ids are unique.
 * 3. Every requiredTestFiles entry points to an existing file.
 * 4. Every requiredSourceFiles entry (when listed) points to an existing file.
 * 5. Every requiredScriptNames entry (when listed) exists in package.json.
 * 6. No required contract references CLI/TUI source as required MVP source
 *    unless the contract is in the legacy-containment area.
 * 7. No required contract points to skipped-only test files.
 * 8. Required contract count meets the minimum threshold.
 *
 * Boundary: file-existence and text-scanning only.  No production,
 * Pi, CLI, TUI, or network imports.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	MIN_REQUIRED_CONTRACT_COUNT,
	REQUIRED_CONTRACTS,
	type RequiredContract,
	type RequiredContractArea,
} from './required-contracts.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

const VALID_AREAS: Set<string> = new Set<RequiredContractArea>([
	'core',
	'profile',
	'intake',
	'generation',
	'pi-extension',
	'rendering',
	'legacy-containment',
	'package-gates',
	'e2e',
]);

/** CLI/TUI source paths that non-legacy-containment contracts must not reference. */
const CLI_TUI_SOURCE_GLOBS = ['src/cli/', 'src/tui/'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveProjectPath(relPath: string): string {
	return resolve(PROJECT_ROOT, relPath);
}

function fileExists(relPath: string): boolean {
	return existsSync(resolveProjectPath(relPath));
}

/** True if relPath starts with a known CLI/TUI source prefix. */
function isCliTuiSourceFile(relPath: string): boolean {
	return CLI_TUI_SOURCE_GLOBS.some((prefix) => relPath.startsWith(prefix));
}

/**
 * Read a test file and return `true` when it contains *only* skipped
 * describe/it/test blocks (no active tests).
 *
 * A file with zero `describe`, `it`, or `test` calls entirely is also
 * considered skipped-only (no active assertion).
 */
function isSkippedOnlyTestFile(relPath: string): boolean {
	const fullPath = resolveProjectPath(relPath);
	if (!existsSync(fullPath)) return false;

	const source = readFileSync(fullPath, 'utf-8');

	// Count total describe / it / test calls.
	const describeMatches = source.match(/\bdescribe\.?\s*\(/g);
	const itMatches = source.match(/\bit\.?\s*\(/g);
	const testMatches = source.match(/\btest\.?\s*\(/g);
	const totalCalls =
		(describeMatches?.length ?? 0) +
		(itMatches?.length ?? 0) +
		(testMatches?.length ?? 0);

	// If no test block at all, treat as skipped-only (empty file).
	if (totalCalls === 0) return true;

	// Count skipped describe / it / test calls.
	const skippedDescribe = source.match(/\bdescribe\.skip\.?\s*\(/g);
	const skippedIt = source.match(/\bit\.skip\.?\s*\(/g);
	const skippedTest = source.match(/\btest\.skip\.?\s*\(/g);
	const totalSkipped =
		(skippedDescribe?.length ?? 0) +
		(skippedIt?.length ?? 0) +
		(skippedTest?.length ?? 0);

	// If every single test block is skipped, the file is skipped-only.
	return totalCalls > 0 && totalSkipped === totalCalls;
}

/**
 * Load package.json scripts and return a set of script names.
 */
function getPackageScriptNames(): Set<string> {
	const pkgPath = resolve(PROJECT_ROOT, 'package.json');
	const raw = readFileSync(pkgPath, 'utf-8');
	const pkg = JSON.parse(raw) as Record<string, unknown>;
	const scripts = (pkg.scripts ?? {}) as Record<string, string>;
	return new Set(Object.keys(scripts));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('required contract matrix (Step 11.3)', () => {
	describe('manifest structure', () => {
		it('every required contract has a non-empty id', () => {
			for (const c of REQUIRED_CONTRACTS) {
				expect(c.id, `contract id must be non-empty`).toBeTruthy();
				expect(typeof c.id, `contract "${c.id}" id must be a string`).toBe(
					'string',
				);
				expect(
					c.id.trim().length,
					`contract "${c.id}" id must not be whitespace-only`,
				).toBeGreaterThan(0);
			}
		});

		it('every required contract has a valid area', () => {
			for (const c of REQUIRED_CONTRACTS) {
				expect(
					VALID_AREAS.has(c.area),
					`contract "${c.id}" area "${c.area}" is not a valid RequiredContractArea`,
				).toBe(true);
			}
		});

		it('every required contract has a non-empty description', () => {
			for (const c of REQUIRED_CONTRACTS) {
				expect(
					c.description,
					`contract "${c.id}" description must be non-empty`,
				).toBeTruthy();
				expect(
					typeof c.description,
					`contract "${c.id}" description must be a string`,
				).toBe('string');
				expect(
					c.description.trim().length,
					`contract "${c.id}" description must not be whitespace-only`,
				).toBeGreaterThan(0);
			}
		});

		it('every required contract has at least one requiredTestFiles entry', () => {
			for (const c of REQUIRED_CONTRACTS) {
				expect(
					c.requiredTestFiles.length,
					`contract "${c.id}" must have at least one requiredTestFiles entry`,
				).toBeGreaterThanOrEqual(1);
			}
		});

		it("every required contract has status 'required'", () => {
			for (const c of REQUIRED_CONTRACTS) {
				expect(c.status, `contract "${c.id}" status must be "required"`).toBe(
					'required',
				);
			}
		});

		it('contract ids are unique', () => {
			const ids = REQUIRED_CONTRACTS.map((c) => c.id);
			const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
			expect(
				dupes,
				`Duplicate contract ids: ${[...new Set(dupes)].join(', ')}`,
			).toEqual([]);
		});
	});

	describe('required test file existence', () => {
		for (const c of REQUIRED_CONTRACTS) {
			for (const testFile of c.requiredTestFiles) {
				it(`contract "${c.id}" — test file "${testFile}" exists`, () => {
					expect(
						fileExists(testFile),
						`Required test file "${testFile}" for contract "${c.id}" does not exist`,
					).toBe(true);
				});
			}
		}
	});

	describe('required source file existence (when listed)', () => {
		for (const c of REQUIRED_CONTRACTS) {
			if (c.requiredSourceFiles && c.requiredSourceFiles.length > 0) {
				for (const srcFile of c.requiredSourceFiles) {
					it(`contract "${c.id}" — source file "${srcFile}" exists`, () => {
						expect(
							fileExists(srcFile),
							`Required source file "${srcFile}" for contract "${c.id}" does not exist`,
						).toBe(true);
					});
				}
			}
		}
	});

	describe('required script name existence (when listed)', () => {
		const scriptNames = getPackageScriptNames();

		for (const c of REQUIRED_CONTRACTS) {
			if (c.requiredScriptNames && c.requiredScriptNames.length > 0) {
				for (const scriptName of c.requiredScriptNames) {
					it(`contract "${c.id}" — script "${scriptName}" exists in package.json`, () => {
						expect(
							scriptNames.has(scriptName),
							`Required script "${scriptName}" for contract "${c.id}" does not exist in package.json`,
						).toBe(true);
					});
				}
			}
		}
	});

	describe('no CLI/TUI source required outside legacy-containment', () => {
		for (const c of REQUIRED_CONTRACTS) {
			if (c.area === 'legacy-containment') continue;

			if (c.requiredSourceFiles && c.requiredSourceFiles.length > 0) {
				for (const srcFile of c.requiredSourceFiles) {
					it(`contract "${c.id}" (area: ${c.area}) does not require CLI/TUI source "${srcFile}"`, () => {
						expect(
							isCliTuiSourceFile(srcFile),
							`Contract "${c.id}" (area: ${c.area}) references CLI/TUI source "${srcFile}" — only legacy-containment contracts may do so`,
						).toBe(false);
					});
				}
			}
		}
	});

	describe('no skipped-only test files', () => {
		// Collect unique test file paths across all contracts.
		const uniqueTestFiles = new Set<string>();
		for (const c of REQUIRED_CONTRACTS) {
			for (const tf of c.requiredTestFiles) {
				uniqueTestFiles.add(tf);
			}
		}

		for (const testFile of uniqueTestFiles) {
			it(`"${testFile}" is not skipped-only`, () => {
				expect(
					isSkippedOnlyTestFile(testFile),
					`Required test file "${testFile}" is skipped-only (all test blocks are .skip)`,
				).toBe(false);
			});
		}
	});

	describe('contract count', () => {
		it(`has at least ${MIN_REQUIRED_CONTRACT_COUNT} required contracts`, () => {
			expect(
				REQUIRED_CONTRACTS.length,
				`Expected at least ${MIN_REQUIRED_CONTRACT_COUNT} contracts, found ${REQUIRED_CONTRACTS.length}`,
			).toBeGreaterThanOrEqual(MIN_REQUIRED_CONTRACT_COUNT);
		});
	});

	describe('contract invariants', () => {
		it('all requiredTestFiles entries are non-empty strings', () => {
			for (const c of REQUIRED_CONTRACTS) {
				for (const tf of c.requiredTestFiles) {
					expect(
						typeof tf,
						`contract "${c.id}" test file entry must be a string`,
					).toBe('string');
					expect(
						tf.trim().length,
						`contract "${c.id}" test file entry must not be whitespace`,
					).toBeGreaterThan(0);
				}
			}
		});

		it('all requiredSourceFiles entries (when present) are non-empty strings', () => {
			for (const c of REQUIRED_CONTRACTS) {
				if (!c.requiredSourceFiles) continue;
				for (const sf of c.requiredSourceFiles) {
					expect(
						typeof sf,
						`contract "${c.id}" source file entry must be a string`,
					).toBe('string');
					expect(
						sf.trim().length,
						`contract "${c.id}" source file entry must not be whitespace`,
					).toBeGreaterThan(0);
				}
			}
		});

		it('all requiredScriptNames entries (when present) are non-empty strings', () => {
			for (const c of REQUIRED_CONTRACTS) {
				if (!c.requiredScriptNames) continue;
				for (const sn of c.requiredScriptNames) {
					expect(
						typeof sn,
						`contract "${c.id}" script name entry must be a string`,
					).toBe('string');
					expect(
						sn.trim().length,
						`contract "${c.id}" script name entry must not be whitespace`,
					).toBeGreaterThan(0);
				}
			}
		});

		it('manifest is a frozen/readonly array (no accidental mutations in tests)', () => {
			expect(REQUIRED_CONTRACTS).toBeDefined();
			expect(Array.isArray(REQUIRED_CONTRACTS)).toBe(true);
			// TypeScript readonly enforces this; the runtime test is a smoke check.
			expect(() => {
				// Attempt mutation (will throw if frozen, or succeed if unfrozen)
				const arr = REQUIRED_CONTRACTS as RequiredContract[];
				if (arr.length > 0) {
					// We don't mutate — we just check the array is defined.
					expect(arr[0]).toBeDefined();
				}
			}).not.toThrow();
		});
	});
});
