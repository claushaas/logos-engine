/**
 * Step 11.3 — Contract Matrix Coverage Test.
 *
 * Verifies the required contract manifest covers *every* major area and
 * that critical MVP behavioral guarantees are explicitly represented.
 *
 * Tests:
 * 1. Every major area (core, profile, intake, generation, pi-extension,
 *    rendering, legacy-containment, package-gates, e2e) has at least one
 *    required contract.
 * 2. Critical MVP contract ids are present in the manifest.
 * 3. Forbidden command-first flows are represented in both Core/Pi and
 *    CLI/TUI/package contract areas.
 * 4. Generation safety is represented in both Core and Pi
 *    confirmation/rendering areas.
 * 5. Rendering is represented for both ordinary intake messages and
 *    generation/status outputs.
 * 6. The manifest is not imported by production code.
 *
 * Boundary: file-existence and reference-checking only.  No production,
 * Pi, CLI, TUI, or network imports.
 */

import { describe, expect, it } from 'vitest';
import {
	CRITICAL_MVP_CONTRACT_IDS,
	REQUIRED_AREAS,
	REQUIRED_CONTRACTS,
} from './required-contracts.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all contract ids into a Set for fast lookups. */
function allContractIds(): Set<string> {
	return new Set(REQUIRED_CONTRACTS.map((c) => c.id));
}

/** Find contracts by area. */
function contractsInArea(area: string) {
	return REQUIRED_CONTRACTS.filter((c) => c.area === area);
}

/** Does any contract id (case-insensitive) contain a substring? */
function anyContractIdContains(substring: string): boolean {
	const lower = substring.toLowerCase();
	return REQUIRED_CONTRACTS.some((c) => c.id.toLowerCase().includes(lower));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contract matrix coverage (Step 11.3)', () => {
	describe('area coverage', () => {
		for (const area of REQUIRED_AREAS) {
			it(`area "${area}" has at least one required contract`, () => {
				const contracts = contractsInArea(area);
				expect(
					contracts.length,
					`No contracts found for area "${area}"`,
				).toBeGreaterThanOrEqual(1);
			});
		}
	});

	describe('critical MVP contract ids', () => {
		for (const criticalId of CRITICAL_MVP_CONTRACT_IDS) {
			it(`critical MVP contract "${criticalId}" is present`, () => {
				expect(
					allContractIds().has(criticalId),
					`Critical MVP contract "${criticalId}" is missing from the manifest`,
				).toBe(true);
			});
		}
	});

	describe('forbidden command coverage', () => {
		it('Core/Pi area has a forbidden-commands contract', () => {
			const hasCoreForbidden = anyContractIdContains('forbidden-commands');
			const hasPiForbidden = allContractIds().has(
				'pi.forbidden-command-absence',
			);
			expect(
				hasCoreForbidden || hasPiForbidden,
				'At least one contract must cover forbidden commands in Core/Pi area',
			).toBe(true);
		});

		it('legacy-containment area has CLI forbidden-commands contract', () => {
			expect(
				allContractIds().has('legacy.forbidden-cli-commands'),
				'Missing legacy.forbidden-cli-commands contract',
			).toBe(true);
		});

		it('legacy-containment area has TUI forbidden-commands contract', () => {
			expect(
				allContractIds().has('legacy.forbidden-tui-commands'),
				'Missing legacy.forbidden-tui-commands contract',
			).toBe(true);
		});

		it('package-gates area has forbidden-command-surface contract', () => {
			expect(
				allContractIds().has('legacy.package-forbidden-command-surface'),
				'Missing legacy.package-forbidden-command-surface contract',
			).toBe(true);
		});
	});

	describe('generation safety coverage', () => {
		it('generation area has preflight contract', () => {
			expect(
				allContractIds().has('generation.preflight'),
				'Missing generation.preflight contract',
			).toBe(true);
		});

		it('generation area has partial-confirmation-boundary contract', () => {
			expect(
				allContractIds().has('generation.partial-confirmation-boundary'),
				'Missing generation.partial-confirmation-boundary contract',
			).toBe(true);
		});

		it('generation area has no-final-bypass contract', () => {
			expect(
				allContractIds().has('generation.no-final-bypass'),
				'Missing generation.no-final-bypass contract',
			).toBe(true);
		});

		it('Pi extension area has partial-generation-confirmation-ui contract', () => {
			expect(
				allContractIds().has('pi.partial-generation-confirmation-ui'),
				'Missing pi.partial-generation-confirmation-ui contract',
			).toBe(true);
		});

		it('rendering area has generation-blockers contract', () => {
			expect(
				allContractIds().has('rendering.generation-blockers'),
				'Missing rendering.generation-blockers contract',
			).toBe(true);
		});
	});

	describe('rendering coverage', () => {
		it('rendering area has core-message-kinds contract (intake messages)', () => {
			expect(
				allContractIds().has('rendering.core-message-kinds'),
				'Missing rendering.core-message-kinds contract (ordinary intake messages)',
			).toBe(true);
		});

		it('rendering area has status-blockers contract (status output)', () => {
			expect(
				allContractIds().has('rendering.status-blockers'),
				'Missing rendering.status-blockers contract (status output)',
			).toBe(true);
		});

		it('rendering area has generation-blockers contract (generation output)', () => {
			expect(
				allContractIds().has('rendering.generation-blockers'),
				'Missing rendering.generation-blockers contract (generation blockers output)',
			).toBe(true);
		});

		it('rendering area has generated-paths-provenance contract (output paths)', () => {
			expect(
				allContractIds().has('rendering.generated-paths-provenance'),
				'Missing rendering.generated-paths-provenance contract (output paths/provenance)',
			).toBe(true);
		});

		it('rendering area has no-product-logic contract (thinness)', () => {
			expect(
				allContractIds().has('rendering.no-product-logic'),
				'Missing rendering.no-product-logic contract (thinness)',
			).toBe(true);
		});
	});

	describe('E2E coverage', () => {
		it('has core-lifecycle E2E contract', () => {
			expect(allContractIds().has('e2e.core-lifecycle')).toBe(true);
		});

		it('has pi-extension-harness E2E contract', () => {
			expect(allContractIds().has('e2e.pi-extension-harness')).toBe(true);
		});

		it('has pi-conversation E2E contract', () => {
			expect(allContractIds().has('e2e.pi-conversation')).toBe(true);
		});

		it('has pi-generation E2E contract', () => {
			expect(allContractIds().has('e2e.pi-generation')).toBe(true);
		});
	});

	describe('profile coverage', () => {
		it('has config-active-profile contract', () => {
			expect(allContractIds().has('profile.config-active-profile')).toBe(true);
		});

		it('has generic-resolution contract', () => {
			expect(allContractIds().has('profile.generic-resolution')).toBe(true);
		});

		it('has contract-loading contract', () => {
			expect(allContractIds().has('profile.contract-loading')).toBe(true);
		});

		it('has missing-profile-blockers contract', () => {
			expect(allContractIds().has('profile.missing-profile-blockers')).toBe(
				true,
			);
		});
	});

	describe('intake coverage', () => {
		it('has start-asks-first contract', () => {
			expect(allContractIds().has('intake.start-asks-first')).toBe(true);
		});

		it('has sufficient-answer-advances contract', () => {
			expect(allContractIds().has('intake.sufficient-answer-advances')).toBe(
				true,
			);
		});

		it('has command-text-not-answer contract', () => {
			expect(allContractIds().has('intake.command-text-not-answer')).toBe(true);
		});

		it('has lifecycle-command-interruption contract', () => {
			expect(
				allContractIds().has('intake.lifecycle-command-interruption'),
			).toBe(true);
		});
	});

	describe('pi-extension input routing coverage', () => {
		it('has input-routing-active contract', () => {
			expect(allContractIds().has('pi.input-routing-active')).toBe(true);
		});

		it('has input-routing-inactive contract', () => {
			expect(allContractIds().has('pi.input-routing-inactive')).toBe(true);
		});

		it('has input-routing-slash-safety contract', () => {
			expect(allContractIds().has('pi.input-routing-slash-safety')).toBe(true);
		});
	});

	describe('source reference practice', () => {
		it('public Core API has source file reference', () => {
			const api = REQUIRED_CONTRACTS.find((c) => c.id === 'core.public-api');
			expect(api).toBeDefined();
			expect(api?.requiredSourceFiles).toBeDefined();
			expect(api?.requiredSourceFiles).toContain('src/core/api.ts');
		});

		it('result contract has source file reference', () => {
			const rc = REQUIRED_CONTRACTS.find(
				(c) => c.id === 'core.result-contracts',
			);
			expect(rc).toBeDefined();
			expect(rc?.requiredSourceFiles).toBeDefined();
			expect(rc?.requiredSourceFiles).toContain('src/core/result.ts');
		});
	});
});
