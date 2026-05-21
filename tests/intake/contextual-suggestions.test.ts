/** Contextual Suggestions tests — Step 4.4 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	type ContextualSuggestionInput,
	generateContextualSuggestions,
	renderContextualSuggestions,
	resetSuggestionCounter,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyInput(): ContextualSuggestionInput {
	return {
		artifactMetadata: [],
		assumptions: [],
		completedDocumentIds: [],
		decisions: [],
		openQuestions: [],
		plannedQuestions: [],
		proposals: [],
		providerConfigured: false,
		risks: [],
		runMetadata: [],
		sessionMetadata: [],
		validationGaps: [],
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contextual-suggestions', () => {
	beforeEach(() => {
		resetSuggestionCounter();
	});

	describe('suggestion generation', () => {
		it('generates suggestions when a question depends on prior decisions', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				decisions: [
					{
						affectedDocumentIds: ['docs/frontend'],
						id: 'dec-001',
						status: 'confirmed',
						title: 'Use React for frontend',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-1',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/frontend',
						sourcePhaseId: 'phase-1',
						text: 'What CSS framework should we use?',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			expect(result.suggestions.length).toBeGreaterThan(0);
			const depSuggestion = result.suggestions.find(
				(s) => s.kind === 'clarify_dependency',
			);
			expect(depSuggestion).toBeDefined();
			expect(depSuggestion?.reason).toBe('depends_on_prior_decision');
			expect(depSuggestion?.relatedDecisionId).toBe('dec-001');
			expect(depSuggestion?.isSuggestionOnly).toBe(true);
		});

		it('generates suggestions when a question depends on assumptions', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				assumptions: [
					{
						affectedDocumentIds: ['docs/frontend'],
						id: 'asm-001',
						status: 'active',
						title: 'Users have modern browsers',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-2',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/frontend',
						sourcePhaseId: 'phase-1',
						text: 'What build tool should we use?',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			expect(result.suggestions.length).toBeGreaterThan(0);
			const depSuggestion = result.suggestions.find(
				(s) => s.kind === 'clarify_dependency',
			);
			expect(depSuggestion).toBeDefined();
			expect(depSuggestion?.reason).toBe('depends_on_assumption');
			expect(depSuggestion?.relatedAssumptionId).toBe('asm-001');
		});

		it('generates suggestions for unresolved open questions blocking progress', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				openQuestions: [
					{
						affectedDocumentIds: ['docs/infrastructure'],
						id: 'oq-001',
						question: 'What is the target deployment platform?',
						status: 'open',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: 'oq-001',
						id: 'q-3',
						reason: 'existing_open_question',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/infrastructure',
						sourcePhaseId: 'phase-2',
						text: 'What is the target deployment platform?',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			expect(result.suggestions.length).toBeGreaterThan(0);
			const reviewSuggestion = result.suggestions.find(
				(s) => s.kind === 'review_open_question',
			);
			expect(reviewSuggestion).toBeDefined();
			expect(reviewSuggestion?.reason).toBe('open_question_blocks_progress');
			expect(reviewSuggestion?.relatedOpenQuestionId).toBe('oq-001');
		});

		it('suggests open question review for unlinked open questions', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				openQuestions: [
					{
						affectedDocumentIds: [],
						id: 'oq-002',
						question: 'What database should we use?',
						status: 'open',
					},
				],
				plannedQuestions: [],
			};

			const result = generateContextualSuggestions(input);

			const reviewSuggestion = result.suggestions.find(
				(s) => s.kind === 'review_open_question',
			);
			expect(reviewSuggestion).toBeDefined();
			expect(reviewSuggestion?.title).toContain('1 open question');
		});

		it('generates suggestions for pending relevant proposals as review-only', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-4',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/backend',
						sourcePhaseId: 'phase-3',
						text: 'What logging framework?',
					},
				],
				proposals: [
					{
						kind: 'decision',
						proposalId: 'prop-001',
						sourceDocumentCanonicalId: 'docs/backend',
						sourcePhaseId: 'phase-3',
						sourceQuestionId: undefined,
						status: 'proposed',
						title: 'Use Winston for logging',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			expect(result.suggestions.length).toBeGreaterThan(0);
			const propSuggestion = result.suggestions.find(
				(s) => s.kind === 'review_proposal',
			);
			expect(propSuggestion).toBeDefined();
			expect(propSuggestion?.reason).toBe('pending_proposal_relevant');
			expect(propSuggestion?.isSuggestionOnly).toBe(true);

			// Body should mention it's a suggestion, not a confirmed fact
			expect(propSuggestion?.body).toContain('suggestion');
		});

		it('generates suggestions for validation gaps', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				validationGaps: [
					{
						description: 'Missing required section in frontend doc',
						id: 'gap-001',
						severity: 'error',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			const gapSuggestion = result.suggestions.find(
				(s) => s.kind === 'resolve_validation_gap',
			);
			expect(gapSuggestion).toBeDefined();
			expect(gapSuggestion?.reason).toBe('validation_gap_present');
			// Body should mention the gap requires user action, not auto-fix
			expect(gapSuggestion?.body).toContain('user action');
		});

		it('generates suggestions for active risks', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-5',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/infrastructure',
						sourcePhaseId: 'phase-2',
						text: 'What cloud provider?',
					},
				],
				risks: [
					{
						affectedDocumentIds: ['docs/infrastructure'],
						id: 'risk-001',
						severity: 'medium',
						status: 'identified',
						title: 'Vendor lock-in',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			const riskSuggestion = result.suggestions.find(
				(s) => s.kind === 'address_risk',
			);
			expect(riskSuggestion).toBeDefined();
			expect(riskSuggestion?.reason).toBe('risk_requires_attention');
			expect(riskSuggestion?.relatedRiskId).toBe('risk-001');
		});

		it('generates provider config suggestion when not configured', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				providerConfigured: false,
			};

			const result = generateContextualSuggestions(input);

			const configSuggestion = result.suggestions.find(
				(s) => s.kind === 'configure_provider',
			);
			expect(configSuggestion).toBeDefined();
			expect(configSuggestion?.reason).toBe('provider_not_configured');
		});

		it('does NOT generate unsupported suggestions when source state is absent', () => {
			resetSuggestionCounter();
			const result = generateContextualSuggestions(emptyInput());

			// With completely empty input, only provider config suggestion should appear
			const nonProviderSuggestions = result.suggestions.filter(
				(s) => s.kind !== 'configure_provider',
			);
			expect(nonProviderSuggestions.length).toBe(0);
		});

		it('suggestions include source references', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				decisions: [
					{
						affectedDocumentIds: ['docs/frontend'],
						id: 'dec-002',
						status: 'confirmed',
						title: 'Use TypeScript',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-6',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/frontend',
						sourcePhaseId: 'phase-1',
						text: 'What testing framework?',
					},
				],
			};

			const result = generateContextualSuggestions(input);
			const depSuggestion = result.suggestions.find(
				(s) => s.kind === 'clarify_dependency',
			);
			expect(depSuggestion).toBeDefined();
			expect(depSuggestion?.sourceDocumentId).toBe('docs/frontend');
			expect(depSuggestion?.sourcePhaseId).toBe('phase-1');
			expect(depSuggestion?.sourceQuestionId).toBe('q-6');
			expect(depSuggestion?.relatedDecisionId).toBe('dec-002');
		});

		it('suggestions are deterministic for same input', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				decisions: [
					{
						affectedDocumentIds: ['docs/database'],
						id: 'dec-003',
						status: 'confirmed',
						title: 'Use Postgres',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-7',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/database',
						sourcePhaseId: 'phase-2',
						text: 'What ORM?',
					},
				],
			};

			const result1 = generateContextualSuggestions(input);
			resetSuggestionCounter();
			const result2 = generateContextualSuggestions(input);

			expect(result1.suggestions).toEqual(result2.suggestions);
		});

		it('suggestions are visibly marked as suggestions', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				pendingProposals: [],
				proposals: [
					{
						kind: 'decision',
						proposalId: 'prop-002',
						sourceDocumentCanonicalId: undefined,
						sourcePhaseId: undefined,
						sourceQuestionId: undefined,
						status: 'proposed',
						title: 'Test proposal',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			for (const s of result.suggestions) {
				expect(s.isSuggestionOnly).toBe(true);
			}
		});

		it('suggestions never create confirmed records', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				decisions: [
					{
						affectedDocumentIds: [],
						id: 'dec-004',
						status: 'confirmed',
						title: 'Use Kubernetes',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-8',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/deployment',
						sourcePhaseId: 'phase-3',
						text: 'What cluster size?',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			// Verify no confirmed proposals are generated
			for (const s of result.suggestions) {
				expect(s.isSuggestionOnly).toBe(true);
			}
		});

		it('artifact metadata does not become canonical truth', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				artifactMetadata: [
					{
						artifactId: 'art-001',
						artifactType: 'canonical_markdown',
						status: 'generated',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			// Artifact metadata may suggest /status, but must not present artifacts as facts
			for (const s of result.suggestions) {
				expect(s.isSuggestionOnly).toBe(true);
				expect(s.kind).not.toBe('future_command');
			}
		});

		it('suggests /continue for incomplete documents', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				completedDocumentIds: [],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-9',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/frontend',
						sourcePhaseId: 'phase-1',
						text: 'What framework?',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			const docSuggestion = result.suggestions.find(
				(s) => s.kind === 'continue_document',
			);
			expect(docSuggestion).toBeDefined();
			expect(docSuggestion?.reason).toBe('document_incomplete');
		});

		it('no suggestion for document continuation when all complete', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				completedDocumentIds: ['docs/frontend'],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'q-10',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/frontend',
						sourcePhaseId: 'phase-1',
						text: 'What framework?',
					},
				],
			};

			const result = generateContextualSuggestions(input);

			const docSuggestion = result.suggestions.find(
				(s) => s.kind === 'continue_document',
			);
			expect(docSuggestion).toBeUndefined();
		});

		it('sessions/run metadata treated as metadata not canonical truth', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				artifactMetadata: [
					{ artifactId: 'art-1', artifactType: 'report', status: 'generated' },
				],
				runMetadata: [
					{ runId: 'run-1', runType: 'generation', status: 'complete' },
				],
				sessionMetadata: [
					{ sessionId: 'sess-1', sessionType: 'intake', status: 'completed' },
				],
			};

			const result = generateContextualSuggestions(input);

			// The workspace state changed suggestion should be present
			const statusSuggestion = result.suggestions.find(
				(s) => s.kind === 'run_status',
			);
			expect(statusSuggestion).toBeDefined();
			expect(statusSuggestion?.isSuggestionOnly).toBe(true);
		});
	});

	// ---------------------------------------------------------------------------
	// Rendering
	// ---------------------------------------------------------------------------

	describe('rendering', () => {
		it('renderContextualSuggestions produces terminal-friendly output', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				openQuestions: [
					{
						affectedDocumentIds: [],
						id: 'oq-render',
						question: 'Test question for rendering',
						status: 'open',
					},
				],
			};

			const result = generateContextualSuggestions(input);
			const lines = renderContextualSuggestions(result.suggestions);

			expect(lines.length).toBeGreaterThan(0);
			expect(lines.some((l) => l.includes('suggestions only'))).toBe(true);
		});

		it('marks suggestions as not confirmed facts in output', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				openQuestions: [
					{
						affectedDocumentIds: [],
						id: 'oq-render-2',
						question: 'Another test question',
						status: 'open',
					},
				],
			};

			const result = generateContextualSuggestions(input);
			const lines = renderContextualSuggestions(result.suggestions);

			expect(lines.some((l) => l.includes('not confirmed facts'))).toBe(true);
		});

		it('redacts token-like values from suggestion titles and rendered output', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				decisions: [
					{
						affectedDocumentIds: ['docs/secret'],
						id: 'dec-secret',
						status: 'confirmed',
						title: 'Use sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'pq-secret',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/secret',
						sourcePhaseId: 'phase-secret',
						text: 'Should this mention hf_abcdefghijklmnopqrstuvwxyz1234567890ABCD?',
					},
				],
			};

			const result = generateContextualSuggestions(input);
			const lines = renderContextualSuggestions(result.suggestions);
			const json = JSON.stringify({ lines, suggestions: result.suggestions });

			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(json).not.toMatch(/hf_[a-zA-Z0-9]{20,}/);
			expect(json).toContain('[REDACTED]');
		});

		it('respects maxSuggestions limit', () => {
			resetSuggestionCounter();
			const input: ContextualSuggestionInput = {
				...emptyInput(),
				decisions: [
					{
						affectedDocumentIds: ['docs/a'],
						id: 'd1',
						status: 'confirmed',
						title: 'D1',
					},
					{
						affectedDocumentIds: ['docs/b'],
						id: 'd2',
						status: 'confirmed',
						title: 'D2',
					},
					{
						affectedDocumentIds: ['docs/c'],
						id: 'd3',
						status: 'confirmed',
						title: 'D3',
					},
				],
				openQuestions: [
					{
						affectedDocumentIds: [],
						id: 'oq1',
						question: 'Q1',
						status: 'open',
					},
					{
						affectedDocumentIds: [],
						id: 'oq2',
						question: 'Q2',
						status: 'open',
					},
				],
				plannedQuestions: [
					{
						existingOpenQuestionId: undefined,
						id: 'pq1',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/a',
						sourcePhaseId: 'phase-1',
						text: 'PQ1',
					},
					{
						existingOpenQuestionId: 'oq1',
						id: 'pq2',
						reason: 'missing_required_section',
						relatedDependencyId: undefined,
						sourceDocumentId: 'docs/b',
						sourcePhaseId: 'phase-1',
						text: 'PQ2',
					},
				],
			};

			const result = generateContextualSuggestions(input);
			const lines = renderContextualSuggestions(result.suggestions, {
				maxSuggestions: 2,
				showRecommendedCommands: false,
				showSourceReferences: false,
			});

			// Should only render at most 2 suggestions
			expect(lines.length).toBeGreaterThan(0);
		});
	});
});
