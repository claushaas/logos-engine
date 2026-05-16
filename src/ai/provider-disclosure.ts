/** Provider Disclosure Guard — blocks remote provider execution without explicit consent */

import type {
	AiProviderConsent,
	AiProviderDiagnostic,
	AiProviderKind,
} from './provider-port.js';

// ---------------------------------------------------------------------------
// Disclosure context categories
// ---------------------------------------------------------------------------

export const DISCLOSURE_CONTEXT_CATEGORIES = [
	'profile_contract',
	'document_descriptors',
	'workspace_decisions',
	'workspace_assumptions',
	'workspace_open_questions',
	'workspace_risks',
	'workspace_validation_gaps',
	'question_cluster',
	'user_answers',
	'artifact_metadata',
	'run_summaries',
	'session_summaries',
	'project_context',
] as const;

export type DisclosureContextCategory =
	(typeof DISCLOSURE_CONTEXT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Consent record
// ---------------------------------------------------------------------------

export interface ProviderConsentRecord {
	providerId: string;
	providerKind: AiProviderKind;
	consent: AiProviderConsent;
	contextCategories: string[];
	contextCategorySummary: Record<string, number>;
	acceptedAt: string | undefined;
	declinedAt: string | undefined;
}

// ---------------------------------------------------------------------------
// Guard function
// ---------------------------------------------------------------------------

export interface DisclosureGuardOptions {
	providerKind: AiProviderKind;
	providerId: string;
	consent: AiProviderConsent;
	contextCategories: string[];
	contextCategorySummary: Record<string, number>;
}

export interface DisclosureGuardResult {
	allowed: boolean;
	diagnostics: AiProviderDiagnostic[];
}

export function checkProviderDisclosure(
	options: DisclosureGuardOptions,
): DisclosureGuardResult {
	// Local/fake providers do not require remote disclosure
	if (options.providerKind === 'local' || options.providerKind === 'fake') {
		return { allowed: true, diagnostics: [] };
	}

	// Remote providers require explicit consent
	if (options.consent === 'absent') {
		return {
			allowed: false,
			diagnostics: [
				{
					code: 'E_DISCLOSURE_ABSENT',
					message: `Remote provider "${options.providerId}" requires disclosure and consent before execution`,
					path: undefined,
					pointer: '/provider/disclosure',
					recoveryHint:
						'Review the context categories that will be shared, then explicitly accept the disclosure to continue',
					severity: 'error',
				},
			],
		};
	}

	if (options.consent === 'declined') {
		return {
			allowed: false,
			diagnostics: [
				{
					code: 'E_DISCLOSURE_DECLINED',
					message: `Remote provider execution was declined for "${options.providerId}"`,
					path: undefined,
					pointer: '/provider/disclosure',
					recoveryHint:
						'You declined to share context with the remote provider. Re-run with explicit consent to continue.',
					severity: 'error',
				},
			],
		};
	}

	// Explicit consent is present
	return { allowed: true, diagnostics: [] };
}

// ---------------------------------------------------------------------------
// Convenience: assert consent before executing
// ---------------------------------------------------------------------------

export function assertDisclosureConsent(options: DisclosureGuardOptions): void {
	const result = checkProviderDisclosure(options);
	if (!result.allowed) {
		const msgs = result.diagnostics.map((d) => d.message).join('\n');
		throw new Error(`Provider disclosure blocked:\n${msgs}`);
	}
}
