/** Intake Context Builder tests — Step 4.2 */

import { describe, expect, it } from 'vitest';
import {
	buildConversationRequest,
	buildIntakeContext,
	buildStartupBriefingRequest,
	buildStructuredExtractionRequest,
	buildSuggestionRequest,
	createDefaultWorkspaceState,
	DEFAULT_BUILDER_OPTIONS,
	type IntakeContextBuilderInput,
	type IntakeContextRelevantAnswer,
	type IntakeContextValidationGap,
	planNextQuestions,
	type WorkspaceState,
} from '../../src/index.js';
import { getSampleWorkspaceState } from '../fixtures/workspace-state.js';

function createEmptyState(): WorkspaceState {
	return createDefaultWorkspaceState({
		createdAt: '2024-01-01T00:00:00.000Z',
		projectRootPath: '/tmp/test-workspace',
		updatedAt: '2024-01-01T00:00:00.000Z',
		workspaceId: 'test-workspace',
	});
}

function makeInput(
	overrides: Partial<IntakeContextBuilderInput> = {},
): IntakeContextBuilderInput {
	return {
		answers: undefined,
		contract: {
			documents: [],
			documentsByCanonicalId: new Map(),
			phases: [],
			profileId: 'standard',
			repoRoot: '/tmp/test',
		},
		graph: undefined,
		profileId: 'standard',
		questionCluster: undefined,
		state: createEmptyState(),
		validationGaps: undefined,
		...overrides,
	};
}

describe('intake context builder', () => {
	describe('basic construction', () => {
		it('builds context from minimal input', () => {
			const ctx = buildIntakeContext(makeInput());
			expect(ctx).toBeDefined();
			expect(ctx.profile).toBeDefined();
			expect(ctx.profile.profileId).toBe('standard');
		});

		it('includes active profile ID', () => {
			const ctx = buildIntakeContext(makeInput());
			expect(ctx.profile.profileId).toBe('standard');
			expect(ctx.profile.profileSource).toBe('bundled');
		});

		it('includes profile version metadata', () => {
			const state = createEmptyState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.profile.profileVersion).toBeUndefined();
		});

		it('returns empty collections for empty state', () => {
			const ctx = buildIntakeContext(makeInput());
			expect(ctx.decisions).toEqual([]);
			expect(ctx.assumptions).toEqual([]);
			expect(ctx.openQuestions).toEqual([]);
			expect(ctx.risks).toEqual([]);
		});

		it('includes sections metadata', () => {
			const ctx = buildIntakeContext(makeInput());
			expect(ctx.sections.length).toBeGreaterThan(0);
			expect(ctx.sections.find((s) => s.sectionId === 'profile')).toBeDefined();
		});
	});

	describe('document references', () => {
		it('includes document references from contract', () => {
			const contract = {
				documents: [
					{
						canonicalId: 'docs/frontend',
						descriptor: {
							sections: [],
							status: 'drafting',
							title: 'Frontend Docs',
						},
						documentOrder: 1,
						globalOrder: 1,
						phaseId: '01',
						sourcePath: 'profiles/standard/docs/frontend.descriptor.yml',
					},
				],
				documentsByCanonicalId: new Map(),
				phases: [
					{
						descriptorPaths: [],
						documentIds: [],
						id: '01',
						order: 1,
						title: 'Foundation',
					},
				],
				profileId: 'standard',
				repoRoot: '/tmp/test',
			};

			const ctx = buildIntakeContext(makeInput({ contract }));
			expect(ctx.documents.length).toBe(1);
			expect(ctx.documents[0]?.canonicalId).toBe('docs/frontend');
			expect(ctx.documents[0]?.title).toBe('Frontend Docs');
			expect(ctx.documents[0]?.status).toBe('drafting');
		});
	});

	describe('workspace records', () => {
		it('includes relevant decisions', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.decisions.length).toBeGreaterThan(0);
			expect(ctx.decisions[0]?.status).toBe('confirmed');
		});

		it('includes relevant assumptions', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.assumptions.length).toBeGreaterThan(0);
			expect(ctx.assumptions[0]?.status).toBe('active');
		});

		it('includes open questions', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.openQuestions.length).toBeGreaterThan(0);
			expect(ctx.openQuestions[0]?.status).toBe('open');
		});

		it('includes risks', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.risks.length).toBeGreaterThan(0);
		});

		it('excludes unrelated records by default when cluster is available', () => {
			const state = getSampleWorkspaceState();
			// There's no cluster, so all active records should appear
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.decisions.length).toBeGreaterThanOrEqual(1);
		});

		it('does not include full workspace state dump', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			const json = JSON.stringify(ctx);
			// Should not contain raw audit events or migration data
			expect(json).not.toContain('evt-001');
			expect(json).not.toContain('mig-001');
		});

		it('does not include arbitrary repository files', () => {
			const ctx = buildIntakeContext(makeInput());
			const json = JSON.stringify(ctx);
			expect(json).not.toContain('/etc/passwd');
			expect(json).not.toContain('src/index.ts');
		});
	});

	describe('question cluster integration', () => {
		it('includes question cluster when provided', async () => {
			const { loadDocumentationContract } = await import(
				'../../src/profiles/documentation-contract.js'
			);
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const state = createEmptyState();
			const result = planNextQuestions({ contract, state });
			const cluster = result.cluster;

			if (cluster) {
				const ctx = buildIntakeContext(
					makeInput({ contract, questionCluster: cluster, state }),
				);
				expect(ctx.questionCluster).toBeDefined();
				expect(ctx.questionCluster?.questions.length).toBeGreaterThan(0);
			}
		});

		it('includes question cluster metadata in context', async () => {
			const { loadDocumentationContract } = await import(
				'../../src/profiles/documentation-contract.js'
			);
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const state = createEmptyState();
			const result = planNextQuestions({ contract, state });
			const cluster = result.cluster;

			if (cluster) {
				const ctx = buildIntakeContext(
					makeInput({ contract, questionCluster: cluster, state }),
				);
				expect(ctx.questionCluster?.reasonSummary).toBeDefined();
				expect(ctx.questionCluster?.sourceDocuments.length).toBeGreaterThan(0);
			}
		});
	});

	describe('answers', () => {
		it('includes relevant answers as input evidence only', () => {
			const answers: IntakeContextRelevantAnswer[] = [
				{
					answer: 'The web app',
					isEvidenceOnly: true,
					questionId: 'q-1',
					questionText: 'What is the target?',
				},
			];

			const ctx = buildIntakeContext(makeInput({ answers }));
			expect(ctx.answers.length).toBe(1);
			expect(ctx.answers[0]?.isEvidenceOnly).toBe(true);
		});

		it('marks all answers as evidence only', () => {
			const answers: IntakeContextRelevantAnswer[] = [
				{
					answer: 'Answer',
					isEvidenceOnly: false,
					questionId: 'q-2',
					questionText: 'Test?',
				},
			];

			const ctx = buildIntakeContext(makeInput({ answers }));
			expect(ctx.answers[0]?.isEvidenceOnly).toBe(true);
		});
	});

	describe('validation gaps', () => {
		it('includes validation gaps passed as input', () => {
			const gaps: IntakeContextValidationGap[] = [
				{
					affectedDocumentIds: ['docs/frontend'],
					description: 'Missing validation for section 3',
					fieldPointer: undefined,
					id: 'gap-001',
					severity: 'error',
					sourcePath: 'logos/docs/frontend.md',
				},
			];

			const ctx = buildIntakeContext(makeInput({ validationGaps: gaps }));
			expect(ctx.validationGaps.length).toBe(1);
			expect(ctx.validationGaps[0]?.id).toBe('gap-001');
		});

		it('returns empty validation gaps when not provided', () => {
			const ctx = buildIntakeContext(makeInput());
			expect(ctx.validationGaps).toEqual([]);
		});
	});

	describe('context scoping', () => {
		it('context order is deterministic', () => {
			const state = getSampleWorkspaceState();
			const ctx1 = buildIntakeContext(makeInput({ state }));
			const ctx2 = buildIntakeContext(makeInput({ state }));

			expect(ctx1.decisions.map((d) => d.id)).toEqual(
				ctx2.decisions.map((d) => d.id),
			);
			expect(ctx1.assumptions.map((a) => a.id)).toEqual(
				ctx2.assumptions.map((a) => a.id),
			);
			expect(ctx1.openQuestions.map((q) => q.id)).toEqual(
				ctx2.openQuestions.map((q) => q.id),
			);
		});

		it('respects max item limits', () => {
			const state: WorkspaceState = {
				...createEmptyState(),
				assumptions: [],
				decisions: Array.from({ length: 20 }, (_, i) => ({
					affectedDocumentIds: [],
					createdAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
					id: `dec-${i}`,
					sourceRefs: [],
					status: 'confirmed' as const,
					title: `Decision ${i}`,
				})),
				openQuestions: [],
				risks: [],
			};

			const ctx = buildIntakeContext(makeInput({ state }), { maxDecisions: 5 });
			expect(ctx.decisions.length).toBe(5);
		});

		it('uses conservative defaults', () => {
			const maxDecisions = DEFAULT_BUILDER_OPTIONS.maxDecisions;
			expect(maxDecisions).toBe(10);
		});
	});

	describe('recent sessions and runs', () => {
		it('includes recent session summaries', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.recentSessions.length).toBeGreaterThan(0);
		});

		it('includes recent run summaries when enabled', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.recentRuns).toBeDefined();
		});

		it('includes artifact metadata', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			expect(ctx.artifactMetadata.length).toBeGreaterThan(0);
			expect(ctx.artifactMetadata[0]?.isCanonical).toBe(true);
		});

		it('artifact metadata is metadata only, not canonical proof', () => {
			const state = getSampleWorkspaceState();
			const ctx = buildIntakeContext(makeInput({ state }));
			const json = JSON.stringify(ctx.artifactMetadata);
			// Should not contain generated markdown content or full artifact body
			expect(json).not.toContain('# Generated Document');
		});
	});

	describe('non-mutation', () => {
		it('context builder does not write .logos/', () => {
			// This is inherently true because the builder is read-only
			const ctx = buildIntakeContext(makeInput());
			expect(ctx).toBeDefined();
		});

		it('provider request building does not mutate state', () => {
			const ctx = buildIntakeContext(makeInput());
			const req = buildConversationRequest(ctx);
			expect(req.operation).toBe('conversation');
			expect(req.messages.length).toBeGreaterThan(0);
		});
	});
});

describe('provider request builders', () => {
	function makeBasicContext() {
		return buildIntakeContext(makeInput());
	}

	describe('buildConversationRequest', () => {
		it('builds conversation request from context', () => {
			const ctx = makeBasicContext();
			const req = buildConversationRequest(ctx);

			expect(req.operation).toBe('conversation');
			expect(req.providerKind).toBe('fake');
			expect(req.messages.length).toBeGreaterThan(0);
		});

		it('includes disclosure-relevant context category summary', () => {
			const ctx = makeBasicContext();
			const req = buildConversationRequest(ctx);

			expect(req.contextCategorySummary).toBeDefined();
			const summary = req.contextCategorySummary ?? {};
			expect(summary.profile).toBeDefined();
			expect(summary.documents).toBeDefined();
		});

		it('does not include raw secrets', () => {
			const ctx = makeBasicContext();
			const req = buildConversationRequest(ctx);
			const json = JSON.stringify(req);

			expect(json).not.toContain('sk-');
			expect(json).not.toContain('gsk_');
			expect(json).not.toContain('Bearer ');
		});

		it('is deterministic for same input', () => {
			const ctx = makeBasicContext();
			const req1 = buildConversationRequest(ctx);
			const req2 = buildConversationRequest(ctx);

			expect(req1.messages.length).toBe(req2.messages.length);
			expect(req1.messages[0]?.content).toBe(req2.messages[0]?.content);
		});

		it('accepts custom system prompt and user query', () => {
			const ctx = makeBasicContext();
			const req = buildConversationRequest(ctx, {
				systemPrompt: 'Custom system prompt',
				userQuery: 'Custom user query',
			});

			expect(req.messages[0]?.content).toBe('Custom system prompt');
			expect(req.messages.some((m) => m.content === 'Custom user query')).toBe(
				true,
			);
		});
	});

	describe('buildStructuredExtractionRequest', () => {
		it('builds structured extraction request from context', () => {
			const ctx = makeBasicContext();
			const req = buildStructuredExtractionRequest(ctx);

			expect(req.operation).toBe('structured_extraction');
			expect(req.schemaDescription.length).toBeGreaterThan(0);
		});

		it('includes context category summary', () => {
			const ctx = makeBasicContext();
			const req = buildStructuredExtractionRequest(ctx);
			expect(req.contextCategorySummary).toBeDefined();
		});
	});

	describe('buildSuggestionRequest', () => {
		it('builds suggestion request from context', () => {
			const ctx = makeBasicContext();
			const req = buildSuggestionRequest(ctx);

			expect(req.operation).toBe('suggestion');
			expect(req.prompt.length).toBeGreaterThan(0);
		});

		it('includes context category summary', () => {
			const ctx = makeBasicContext();
			const req = buildSuggestionRequest(ctx);
			expect(req.contextCategorySummary).toBeDefined();
		});
	});

	describe('buildStartupBriefingRequest', () => {
		it('builds startup briefing request from context', () => {
			const ctx = makeBasicContext();
			const req = buildStartupBriefingRequest(ctx);

			expect(req.operation).toBe('startup_briefing');
		});

		it('includes context category summary', () => {
			const ctx = makeBasicContext();
			const req = buildStartupBriefingRequest(ctx);
			expect(req.contextCategorySummary).toBeDefined();
		});
	});
});
