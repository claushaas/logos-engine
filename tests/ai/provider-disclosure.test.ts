/** Provider Disclosure Guard tests — Step 4.2 */

import { describe, expect, it } from 'vitest';
import {
	assertDisclosureConsent,
	checkProviderDisclosure,
	type DisclosureGuardOptions,
} from '../../src/index.js';

function makeOptions(
	overrides: Partial<DisclosureGuardOptions> = {},
): DisclosureGuardOptions {
	return {
		consent: 'absent',
		contextCategories: ['profile_contract', 'workspace_decisions'],
		contextCategorySummary: {
			profile_contract: 1,
			workspace_decisions: 3,
		},
		providerId: 'test-provider',
		providerKind: 'remote',
		...overrides,
	};
}

describe('provider disclosure guard', () => {
	describe('local/fake providers', () => {
		it('allows local provider without disclosure', () => {
			const result = checkProviderDisclosure(
				makeOptions({ providerKind: 'local' }),
			);
			expect(result.allowed).toBe(true);
			expect(result.diagnostics).toEqual([]);
		});

		it('allows fake provider without disclosure', () => {
			const result = checkProviderDisclosure(
				makeOptions({ providerKind: 'fake' }),
			);
			expect(result.allowed).toBe(true);
			expect(result.diagnostics).toEqual([]);
		});

		it('allows fake provider even with absent consent', () => {
			const result = checkProviderDisclosure(
				makeOptions({ consent: 'absent', providerKind: 'fake' }),
			);
			expect(result.allowed).toBe(true);
		});
	});

	describe('remote provider blocking', () => {
		it('blocks remote provider without disclosure', () => {
			const result = checkProviderDisclosure(
				makeOptions({ consent: 'absent', providerKind: 'remote' }),
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics.length).toBeGreaterThan(0);
			expect(result.diagnostics[0]?.code).toBe('E_DISCLOSURE_ABSENT');
		});

		it('blocks remote provider when disclosure is declined', () => {
			const result = checkProviderDisclosure(
				makeOptions({ consent: 'declined', providerKind: 'remote' }),
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('E_DISCLOSURE_DECLINED');
		});

		it('allows remote provider when explicit consent is present', () => {
			const result = checkProviderDisclosure(
				makeOptions({ consent: 'accepted', providerKind: 'remote' }),
			);
			expect(result.allowed).toBe(true);
			expect(result.diagnostics).toEqual([]);
		});

		it('absent disclosure diagnostic includes recovery hint', () => {
			const result = checkProviderDisclosure(
				makeOptions({ consent: 'absent', providerKind: 'remote' }),
			);
			expect(result.diagnostics[0]?.recoveryHint).toBeDefined();
			expect(result.diagnostics[0]?.recoveryHint?.length).toBeGreaterThan(0);
		});

		it('declined disclosure diagnostic includes recovery hint', () => {
			const result = checkProviderDisclosure(
				makeOptions({ consent: 'declined', providerKind: 'remote' }),
			);
			expect(result.diagnostics[0]?.recoveryHint).toBeDefined();
		});

		it('includes provider ID in blocked diagnostics', () => {
			const result = checkProviderDisclosure(
				makeOptions({
					consent: 'absent',
					providerId: 'specific-provider',
					providerKind: 'remote',
				}),
			);
			expect(result.diagnostics[0]?.message).toContain('specific-provider');
		});
	});

	describe('assertDisclosureConsent', () => {
		it('does not throw for local provider', () => {
			expect(() =>
				assertDisclosureConsent(
					makeOptions({ consent: 'absent', providerKind: 'local' }),
				),
			).not.toThrow();
		});

		it('does not throw for fake provider', () => {
			expect(() =>
				assertDisclosureConsent(
					makeOptions({ consent: 'absent', providerKind: 'fake' }),
				),
			).not.toThrow();
		});

		it('throws for remote provider without consent', () => {
			expect(() =>
				assertDisclosureConsent(
					makeOptions({ consent: 'absent', providerKind: 'remote' }),
				),
			).toThrow('Provider disclosure blocked');
		});

		it('throws for remote provider with declined consent', () => {
			expect(() =>
				assertDisclosureConsent(
					makeOptions({ consent: 'declined', providerKind: 'remote' }),
				),
			).toThrow('Provider disclosure blocked');
		});

		it('does not throw for remote provider with accepted consent', () => {
			expect(() =>
				assertDisclosureConsent(
					makeOptions({ consent: 'accepted', providerKind: 'remote' }),
				),
			).not.toThrow();
		});
	});
});
