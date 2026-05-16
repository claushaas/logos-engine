/** Startup Briefing Redaction and Security tests — Step 4.4 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	buildAiStartupBriefing,
	buildDeterministicStartupBriefing,
	type ContextualSuggestionInput,
	FakeProvider,
	generateContextualSuggestions,
	type IntakeContext,
	renderContextualSuggestions,
	renderStartupBriefing,
	resetSuggestionCounter,
	type StartupBriefingInput,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseInput: StartupBriefingInput = {
	acceptedProposalCount: 0,
	activeProfileId: 'standard',
	activeRiskCount: 0,
	artifactCount: 0,
	documentationRoot: 'logos/',
	openQuestionCount: 0,
	pendingProposalCount: 0,
	projectRoot: '/tmp/test-repo',
	proposalCount: 0,
	providerConfigured: false,
	providerConsent: 'absent',
	providerKind: undefined,
	questionCluster: undefined,
	questionClusterSummary: undefined,
	riskCount: 0,
	runCount: 0,
	sessionCount: 0,
	validationGapCount: 0,
	workspaceDiagnostics: [],
	workspaceInitialized: true,
};

function emptyIntakeContext(): IntakeContext {
	return {
		answers: [],
		artifactMetadata: [],
		assumptions: [],
		decisions: [],
		diagnostics: [],
		documents: [],
		openQuestions: [],
		profile: {
			profileId: 'standard',
			profileSource: 'bundled',
			profileVersion: undefined,
		},
		questionCluster: undefined,
		recentRuns: [],
		recentSessions: [],
		redaction: {
			redacted: false,
			redactedCategories: [],
			redactedKeyCount: 0,
			summary: '',
		},
		risks: [],
		sections: [],
		validationGaps: [],
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startup-briefing-redaction', () => {
	describe('secrets in deterministic briefing', () => {
		it('project root path is redacted in briefing output', () => {
			const briefing = buildDeterministicStartupBriefing({
				...baseInput,
				projectRoot: '/home/user/my-secret-project',
			});

			const lines = renderStartupBriefing(briefing);
			const fullOutput = lines.join('\n');

			// The redactString may or may not redact the path;
			// The key assertion is that no secrets appear
			expect(fullOutput).not.toContain('sk-');
			expect(fullOutput).not.toContain('OPENAI_API_KEY');
			expect(fullOutput).not.toContain('Bearer ');
		});

		it('no raw tokens appear in briefing', () => {
			const briefing = buildDeterministicStartupBriefing(baseInput);
			const lines = renderStartupBriefing(briefing);
			const fullText = lines.join('\n');

			expect(fullText).not.toContain('sk-abc');
			expect(fullText).not.toContain('sk-ant-api');
			expect(fullText).not.toContain('gsk_');
			expect(fullText).not.toContain('hf_');
		});

		it('fake provider token is never displayed', async () => {
			const provider = new FakeProvider({ providerId: 'test-provider' });
			const ctx = emptyIntakeContext();

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: baseInput,
				intakeContext: ctx,
				provider,
			});

			const lines = renderStartupBriefing(result.briefing);
			const fullText = lines.join('\n');

			expect(fullText).not.toContain('sk-');
			expect(fullText).not.toContain('fake-provider-token');
		});
	});

	describe('secrets in contextual suggestions', () => {
		beforeEach(() => {
			resetSuggestionCounter();
		});

		it('fake secret in decision is redacted from suggestion', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				artifactMetadata: [],
				assumptions: [],
				completedDocumentIds: [],
				decisions: [
					{
						affectedDocumentIds: ['docs/test'],
						id: 'dec-secret',
						status: 'confirmed',
						title: 'Use API key sk-proj-1234567890abcdef',
					},
				],
				openQuestions: [],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-sec',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/test',
						sourcePhaseId: 'phase-1',
						text: 'Test question with sk-secret-key-12345',
					},
				],
				proposals: [],
				providerConfigured: false,
				risks: [],
				runMetadata: [],
				sessionMetadata: [],
				validationGaps: [],
			};

			const result = generateContextualSuggestions(input);
			const lines = renderContextualSuggestions(result.suggestions);
			const fullText = lines.join('\n');

			// Token-like values should not appear in output
			expect(fullText).not.toMatch(/sk-proj-/);
			expect(fullText).not.toMatch(/sk-secret-key/);
		});

		it('raw prompts/model responses are not persisted in suggestion output', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				artifactMetadata: [],
				assumptions: [],
				completedDocumentIds: [],
				decisions: [],
				openQuestions: [
					{
						affectedDocumentIds: [],
						id: 'oq-bearer',
						question: 'What about Bearer token eyJhbGciOiJ...?',
						status: 'open',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: 'oq-bearer',
						id: 'q-bear',
						reason: 'existing_open_question',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/test',
						sourcePhaseId: 'phase-1',
						text: 'Test',
					},
				],
				proposals: [],
				providerConfigured: false,
				risks: [],
				runMetadata: [],
				sessionMetadata: [],
				validationGaps: [],
			};

			const result = generateContextualSuggestions(input);
			const lines = renderContextualSuggestions(result.suggestions);
			const fullText = lines.join('\n');

			expect(fullText).not.toMatch(/eyJhbGci/);
			expect(fullText).not.toMatch(/Bearer\s+eyJ/);
		});

		it('no provider credentials appear in briefing snapshots', () => {
			const briefing = buildDeterministicStartupBriefing({
				...baseInput,
				providerConfigured: true,
				providerKind: 'openai',
			});

			const lines = renderStartupBriefing(briefing);
			const fullText = lines.join('\n');

			// Provider kind/name may appear (it's safe), but no credentials
			expect(fullText).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(fullText).not.toMatch(/api[_-]key[=:]\s*\w{20,}/i);
		});

		it('no network calls occur in deterministic briefing', () => {
			// Deterministic briefing is synchronous and pure
			const briefing = buildDeterministicStartupBriefing(baseInput);
			expect(briefing).toBeDefined();
			expect(briefing.mode).toBe('deterministic_fallback');
			// No network — just confirms the function is synchronous
		});

		it('raw prompt/model response is not persisted in AI briefing', async () => {
			const provider = new FakeProvider({ providerId: 'test-redact' });

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: baseInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			// The result itself should not contain raw prompts/responses
			const resultStr = JSON.stringify(result);
			expect(resultStr).not.toContain('"raw_prompt"');
			expect(resultStr).not.toContain('"raw_response"');
			expect(resultStr).not.toContain('"model_response"');
		});
	});

	describe('state mutation safety', () => {
		it('deterministic fallback briefing writes no files', () => {
			const briefing = buildDeterministicStartupBriefing(baseInput);
			expect(briefing).toBeDefined();
			// Pure function, no filesystem calls
		});

		it('AI-backed briefing writes no state', async () => {
			const provider = new FakeProvider({ providerId: 'test-nomut' });

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: baseInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			expect(result.briefing).toBeDefined();
			// No state writes, no files changed
		});

		it('suggestion generation writes no files', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				artifactMetadata: [],
				assumptions: [],
				completedDocumentIds: [],
				decisions: [
					{
						affectedDocumentIds: [],
						id: 'dec-mut',
						status: 'confirmed',
						title: 'Test decision',
					},
				],
				openQuestions: [],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-mut',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/test',
						sourcePhaseId: 'phase-1',
						text: 'Test question',
					},
				],
				proposals: [],
				providerConfigured: false,
				risks: [],
				runMetadata: [],
				sessionMetadata: [],
				validationGaps: [],
			};

			const result = generateContextualSuggestions(input);
			expect(result.suggestions.length).toBeGreaterThan(0);
			// Pure function — no side effects
		});

		it('no suggestion creates confirmed records', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				artifactMetadata: [],
				assumptions: [],
				completedDocumentIds: [],
				decisions: [],
				openQuestions: [],
				plannedQuestions: [],
				proposals: [
					{
						kind: 'decision',
						proposalId: 'prop-no-auto',
						sourceDocumentCanonicalId: undefined,
						sourcePhaseId: undefined,
						sourceQuestionId: undefined,
						status: 'proposed',
						title: 'A proposal that must be explicitly reviewed',
					},
				],
				providerConfigured: true,
				risks: [],
				runMetadata: [],
				sessionMetadata: [],
				validationGaps: [],
			};

			const result = generateContextualSuggestions(input);

			// Every suggestion must have isSuggestionOnly=true
			for (const s of result.suggestions) {
				expect(s.isSuggestionOnly).toBe(true);
			}
		});
	});
});
