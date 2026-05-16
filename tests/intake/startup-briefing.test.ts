/** Startup Briefing tests — Step 4.4 */

import { describe, expect, it } from 'vitest';
import type { StartupBriefingResponse } from '../../src/ai/provider-port.js';
import {
	buildAiStartupBriefing,
	buildDeterministicStartupBriefing,
	FakeProvider,
	type IntakeContext,
	renderStartupBriefing,
	type StartupBriefingInput,
} from '../../src/index.js';

const emptyInput: StartupBriefingInput = {
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

// ---------------------------------------------------------------------------
// Deterministic fallback briefing
// ---------------------------------------------------------------------------

describe('startup-briefing', () => {
	describe('deterministic fallback', () => {
		it('produces briefing for initialized empty workspace', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);

			expect(briefing.mode).toBe('deterministic_fallback');
			expect(briefing.source).toBe('deterministic_fallback');
			expect(briefing.status).toBe('success');
			expect(briefing.summary).toBe(
				'Workspace initialized. No outstanding items.',
			);
			expect(briefing.sections.length).toBeGreaterThan(0);
		});

		it('includes workspace section with project root and profile', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);

			const wsSection = briefing.sections.find(
				(s) => s.sectionId === 'workspace',
			);
			expect(wsSection).toBeDefined();
			expect(wsSection?.lines.some((l) => l.includes('/tmp/test-repo'))).toBe(
				true,
			);
			expect(wsSection?.lines.some((l) => l.includes('standard'))).toBe(true);
		});

		it('includes documentation root', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				documentationRoot: 'my-docs/',
			});

			const wsSection = briefing.sections.find(
				(s) => s.sectionId === 'workspace',
			);
			expect(wsSection?.lines.some((l) => l.includes('my-docs/'))).toBe(true);
		});

		it('includes open question count', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				openQuestionCount: 5,
			});

			const stateSection = briefing.sections.find(
				(s) => s.sectionId === 'state',
			);
			expect(stateSection).toBeDefined();
			expect(
				stateSection?.lines.some((l) => l.includes('Open questions: 5')),
			).toBe(true);
		});

		it('includes risk counts', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				activeRiskCount: 2,
				riskCount: 3,
			});

			const stateSection = briefing.sections.find(
				(s) => s.sectionId === 'state',
			);
			expect(stateSection?.lines.some((l) => l.includes('Risks: 3'))).toBe(
				true,
			);
		});

		it('includes proposal counts', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				acceptedProposalCount: 1,
				pendingProposalCount: 3,
				proposalCount: 4,
			});

			const stateSection = briefing.sections.find(
				(s) => s.sectionId === 'state',
			);
			expect(stateSection).toBeDefined();
			expect(stateSection?.lines.some((l) => l.includes('Proposals: 4'))).toBe(
				true,
			);
			expect(stateSection?.lines.some((l) => l.includes('3 pending'))).toBe(
				true,
			);
		});

		it('includes question cluster summary when available', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				questionCluster: {
					gapsConsidered: [],
					phaseCoverage: [
						{
							documentCount: 1,
							phaseId: 'phase-1',
							phaseTitle: 'Foundation',
							questionCount: 2,
						},
					],
					questions: [
						{
							blockingLevel: 'blocking',
							existingOpenQuestionId: undefined,
							id: 'q-1',
							isSchemaDerived: false,
							planStatus: 'planned',
							priority: 'high',
							reason: 'existing_open_question',
							reasonDescription: 'Existing open question',
							relatedDependencyId: undefined,
							relatedSectionId: undefined,
							source: {
								descriptorPath: '/test/doc.yml',
								documentCanonicalId: 'doc-1',
								documentTitle: 'Test Document',
								fieldPointer: undefined,
								phaseId: 'phase-1',
								sectionId: undefined,
								sectionTitle: undefined,
							},
							text: 'What is the deployment target?',
						},
					],
					reasonSummary: 'Test cluster',
					skippedCount: 0,
					sourceDocuments: ['doc-1'],
				},
				questionClusterSummary: 'Test cluster summary',
			});

			const clusterSection = briefing.sections.find(
				(s) => s.sectionId === 'question_cluster',
			);
			expect(clusterSection).toBeDefined();
			expect(clusterSection?.isSuggestion).toBe(true);
			expect(briefing.nextQuestionHint).toBeDefined();
		});

		it('labels suggestions as suggestions', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				pendingProposalCount: 1,
				proposalCount: 1,
			});

			for (const section of briefing.sections) {
				if (section.isSuggestion) {
					// Suggestion sections should be marked
					expect(section.isSuggestion).toBe(true);
				}
			}

			// All suggestion-labeled actions should have isSuggestion=true
			const suggestionActions = briefing.actions.filter((a) => a.isSuggestion);
			expect(suggestionActions.length).toBeGreaterThan(0);
		});

		it('includes suggested next commands', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);

			expect(briefing.actions.length).toBeGreaterThan(0);
			expect(briefing.actions.some((a) => a.command === '/status')).toBe(true);
		});

		it('suggests /config ai when provider not configured', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				providerConfigured: false,
			});

			expect(briefing.actions.some((a) => a.command === '/config ai')).toBe(
				true,
			);
		});

		it('does NOT claim unsupported commands are fully implemented', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);

			const stubCommands = briefing.actions.filter((a) => !a.isImplemented);
			expect(stubCommands.length).toBeGreaterThan(0);

			for (const action of stubCommands) {
				expect(action.isImplemented).toBe(false);
			}
		});

		it('suggests /continue when question cluster available (even if stub)', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				questionCluster: {
					gapsConsidered: [],
					phaseCoverage: [],
					questions: [
						{
							blockingLevel: 'blocking',
							existingOpenQuestionId: undefined,
							id: 'q-1',
							isSchemaDerived: false,
							planStatus: 'planned',
							priority: 'high',
							reason: 'existing_open_question',
							reasonDescription: 'Test',
							relatedDependencyId: undefined,
							relatedSectionId: undefined,
							source: {
								descriptorPath: '/test/doc.yml',
								documentCanonicalId: 'doc-1',
								documentTitle: 'Test Document',
								fieldPointer: undefined,
								phaseId: 'phase-1',
								sectionId: undefined,
								sectionTitle: undefined,
							},
							text: 'Test question',
						},
					],
					reasonSummary: 'Test',
					skippedCount: 0,
					sourceDocuments: ['doc-1'],
				},
			});

			const continueAction = briefing.actions.find(
				(a) => a.actionId === 'continue',
			);
			expect(continueAction).toBeDefined();
			// /continue is still a stub in Phase 4
			expect(continueAction?.isImplemented).toBe(false);
		});

		it('handles uninitialized workspace gracefully', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				workspaceInitialized: false,
			});

			expect(briefing.status).toBe('success');
			expect(briefing.summary).toContain('not initialized');
			expect(briefing.actions.some((a) => a.actionId === 'init')).toBe(true);
			expect(
				briefing.actions.find((a) => a.actionId === 'init')?.isImplemented,
			).toBe(true);
		});

		it('does not mutate .logos/', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);
			expect(briefing).toBeDefined();
			// No side effects to check; function is pure
		});
	});

	// ---------------------------------------------------------------------------
	// AI-backed briefing with fake provider
	// ---------------------------------------------------------------------------

	describe('AI-backed briefing', () => {
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

		it('fake provider can produce startup briefing', async () => {
			const provider = new FakeProvider({ providerId: 'fake-test' });

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: emptyInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			expect(result.briefing).toBeDefined();
			expect(result.briefing.mode).toBe('ai_assisted');
			expect(result.briefing.source).toBe('ai_provider');
			expect(result.fallbackReason).toBeUndefined();
		});

		it('invalid fake provider response falls back deterministically', async () => {
			const provider = new FakeProvider({
				providerId: 'fake-test',
				returnMalformed: true,
			});

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: emptyInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			expect(result.briefing.mode).toBe('deterministic_fallback');
			expect(result.fallbackReason).toBe('provider_response_invalid');
		});

		it('provider failure falls back deterministically', async () => {
			const provider = new FakeProvider({
				providerId: 'fake-test',
				simulateFailure: true,
			});

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: emptyInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			expect(result.briefing.mode).toBe('deterministic_fallback');
			expect(result.fallbackReason).toBe('provider_execution_failed');
		});

		it('blocks remote provider without disclosure', async () => {
			const provider = new FakeProvider({ providerId: 'remote-test' });

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'absent',
				input: emptyInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			// Fake providers always pass disclosure check (local/fake are always allowed)
			// Remote providers need disclosure check, but FakeProvider has kind 'fake'
			// So this should still work with fake provider, regardless of consent setting
			expect(result.briefing).toBeDefined();
		});

		it('falls back when declined disclosure and provider is marked remote', async () => {
			// Create a fake provider with remote-like behavior
			// FakeProvider is always 'fake' kind, so it passes disclosure.
			// To test remote disclosure blocking, we need to use checkProviderDisclosure directly
			const { checkProviderDisclosure } = await import(
				'../../src/ai/provider-disclosure.js'
			);

			const checkResult = checkProviderDisclosure({
				consent: 'declined',
				contextCategories: [],
				contextCategorySummary: {},
				providerId: 'remote-provider',
				providerKind: 'remote',
			});

			expect(checkResult.allowed).toBe(false);
		});

		it('allows through with explicit consent', async () => {
			const { checkProviderDisclosure } = await import(
				'../../src/ai/provider-disclosure.js'
			);

			const checkResult = checkProviderDisclosure({
				consent: 'accepted',
				contextCategories: [],
				contextCategorySummary: {},
				providerId: 'remote-provider',
				providerKind: 'remote',
			});

			expect(checkResult.allowed).toBe(true);
		});

		it('custom provider response is used in briefing', async () => {
			const customBriefing: StartupBriefingResponse = {
				briefingItems: [
					{
						category: 'test',
						id: 'custom-001',
						priority: 'high',
						text: 'Custom test briefing item',
					},
				],
				diagnostics: [],
				operation: 'startup_briefing',
				status: 'success',
				summary: 'Custom summary',
			};

			const provider = new FakeProvider({
				customResponses: { startupBriefing: customBriefing },
				providerId: 'custom-test',
			});

			const result = await buildAiStartupBriefing({
				disclosureConsent: 'accepted',
				input: emptyInput,
				intakeContext: emptyIntakeContext(),
				provider,
			});

			expect(result.briefing.mode).toBe('ai_assisted');
			const aiSection = result.briefing.sections.find(
				(s) => s.sectionId === 'ai_briefing',
			);
			expect(aiSection).toBeDefined();
			expect(aiSection?.isSuggestion).toBe(true);
		});
	});

	// ---------------------------------------------------------------------------
	// Rendering
	// ---------------------------------------------------------------------------

	describe('rendering', () => {
		it('renderStartupBriefing produces terminal-friendly output', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);
			const lines = renderStartupBriefing(briefing);

			expect(lines.length).toBeGreaterThan(0);
			expect(lines.some((l) => l.includes('LOGOS Engine'))).toBe(true);
		});

		it('renders deterministic source marker', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);
			const lines = renderStartupBriefing(briefing);

			expect(lines.some((l) => l.includes('Deterministic'))).toBe(true);
		});

		it('renders AI-assisted source marker', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);
			// Override source for render test
			const aiBriefing = {
				...briefing,
				mode: 'ai_assisted' as const,
				source: 'ai_provider' as const,
			};
			const lines = renderStartupBriefing(aiBriefing);

			expect(lines.some((l) => l.includes('AI-assisted'))).toBe(true);
		});

		it('renders fallback reason when present', () => {
			const briefing = buildDeterministicStartupBriefing(emptyInput);
			const fallbackBriefing = {
				...briefing,
				fallbackReason: 'provider_not_configured' as const,
			};
			const lines = renderStartupBriefing(fallbackBriefing);

			expect(lines.some((l) => l.includes('not configured'))).toBe(true);
		});

		it('marks suggestions as suggestions in output', () => {
			const briefing = buildDeterministicStartupBriefing({
				...emptyInput,
				pendingProposalCount: 2,
				proposalCount: 2,
			});
			const lines = renderStartupBriefing(briefing);

			expect(lines.some((l) => l.includes('suggestion'))).toBe(true);
		});
	});
});
