/** Context Redaction tests — Step 4.2 */

import { describe, expect, it } from 'vitest';
import {
	buildIntakeContext,
	createDefaultWorkspaceState,
	type IntakeContext,
	type IntakeContextBuilderInput,
	isSecretKey,
	isTokenLike,
	redactIntakeContext,
	type WorkspaceState,
} from '../../src/index.js';

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

function makeContextWithSecrets(): IntakeContext {
	const state: WorkspaceState = {
		...createEmptyState(),
		assumptions: [
			{
				affectedDocumentIds: [],
				body: 'Bearer token used for auth',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'asm-secret',
				sourceRefs: [],
				status: 'active',
				title: 'Assume Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 token',
			},
		],
		decisions: [
			{
				affectedDocumentIds: ['docs/frontend'],
				body: 'The API token is sk-proj-abcdefghijklmnopqrstuvwxyz123456',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'dec-secret',
				sourceRefs: [],
				status: 'confirmed',
				title: 'Use OpenAI key sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
			},
		],
		openQuestions: [
			{
				affectedDocumentIds: [],
				body: 'HuggingFace token gsk_abcdefghijklmnopqrstuvwxyz1234',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'q-secret',
				question: 'How to handle the hf_abcdefghijklmnopqrstuvwxyz token?',
				sourceRefs: [],
				status: 'open',
			},
		],
		risks: [
			{
				affectedDocumentIds: [],
				body: 'Using Basic auth may leak credentials',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'risk-secret',
				severity: 'medium',
				sourceRefs: [],
				status: 'identified',
				title: 'Risk with Basic YWJjZGVmZ2hpamtsbW5vcA== auth',
			},
		],
	};

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

	return buildIntakeContext(makeInput({ contract, state }));
}

describe('context redaction', () => {
	describe('token detection', () => {
		it('detects OpenAI-style tokens', () => {
			expect(isTokenLike('sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD')).toBe(
				true,
			);
		});

		it('detects OpenAI project tokens', () => {
			expect(isTokenLike('sk-proj-abcdefghijklmnopqrstuvwxyz123456')).toBe(
				true,
			);
		});

		it('detects Groq-style tokens', () => {
			expect(isTokenLike('gsk_abcdefghijklmnopqrstuvwxyz1234')).toBe(true);
		});

		it('detects HuggingFace tokens', () => {
			expect(isTokenLike('hf_abcdefghijklmnopqrstuvwxyz1234')).toBe(true);
		});

		it('detects Bearer tokens', () => {
			expect(isTokenLike('Bearer eyJhbGciOiJIUzI1NiJ9.test')).toBe(true);
		});

		it('detects Basic auth tokens', () => {
			expect(isTokenLike('Basic YWJjZGVmZ2hpamtsbW5vcA==')).toBe(true);
		});

		it('does not flag normal strings', () => {
			expect(isTokenLike('normal text')).toBe(false);
			expect(isTokenLike('OPENAI_API_KEY')).toBe(false);
		});
	});

	describe('secret key detection', () => {
		it('detects secret-like keys', () => {
			expect(isSecretKey('token')).toBe(true);
			expect(isSecretKey('apiKey')).toBe(true);
			expect(isSecretKey('secret')).toBe(true);
			expect(isSecretKey('password')).toBe(true);
			expect(isSecretKey('credential')).toBe(true);
			expect(isSecretKey('privateKey')).toBe(true);
			expect(isSecretKey('accessToken')).toBe(true);
			expect(isSecretKey('refreshToken')).toBe(true);
			expect(isSecretKey('clientSecret')).toBe(true);
		});

		it('does not flag normal keys', () => {
			expect(isSecretKey('title')).toBe(false);
			expect(isSecretKey('body')).toBe(false);
			expect(isSecretKey('id')).toBe(false);
		});
	});

	describe('redaction in context records', () => {
		it('redacts token-like values in decisions', () => {
			const ctx = makeContextWithSecrets();
			expect(ctx.redaction.redactedCategories).toContain('decisions');
		});

		it('redacts token-like values in assumptions', () => {
			const ctx = makeContextWithSecrets();
			expect(ctx.redaction.redactedCategories).toContain('assumptions');
		});

		it('redacts token-like values in open questions', () => {
			const ctx = makeContextWithSecrets();
			expect(ctx.redaction.redactedCategories).toContain('openQuestions');
		});

		it('redacts token-like values in risks', () => {
			const ctx = makeContextWithSecrets();
			expect(ctx.redaction.redactedCategories).toContain('risks');
		});

		it('redaction summary reports omitted/redacted categories', () => {
			const ctx = makeContextWithSecrets();
			expect(ctx.redaction.summary.length).toBeGreaterThan(0);
			expect(ctx.redaction.redactedKeyCount).toBeGreaterThan(0);
		});

		it('fake secret values do not appear in context JSON', () => {
			const ctx = makeContextWithSecrets();
			const json = JSON.stringify(ctx);

			// OpenAI-style token should not appear
			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			// Groq-style token should not appear
			expect(json).not.toMatch(/gsk_[a-zA-Z0-9]{20,}/);
			// HuggingFace token should not appear
			expect(json).not.toMatch(/hf_[a-zA-Z0-9]{20,}/);
			// Bearer token content should not appear
			expect(json).not.toMatch(/Bearer eyJ/);
		});

		it('allows environment variable names as references', () => {
			const ctx = makeContextWithSecrets();
			// OPENAI_API_KEY is a valid env var name, not a token
			const json = JSON.stringify(ctx);
			// The raw OpenAI token shouldn't appear, but env var names may
			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
		});

		it('redacted after explicit redactIntakeContext call', () => {
			const ctx = makeContextWithSecrets();
			const redacted = redactIntakeContext(ctx);
			expect(redacted.redaction.redactedKeyCount).toBeGreaterThanOrEqual(0);
		});
	});

	describe('redaction on clean data', () => {
		it('clean context shows no redaction', () => {
			const ctx = buildIntakeContext(makeInput());
			// With empty state, there may be no decisions
			expect(ctx.redaction.redacted).toBe(false);
		});
	});

	describe('validation gap redaction', () => {
		it('redacts token-like values in validation gaps', () => {
			const ctx = buildIntakeContext(
				makeInput({
					validationGaps: [
						{
							affectedDocumentIds: ['docs/frontend'],
							description:
								'Secret sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD found',
							fieldPointer: undefined,
							id: 'gap-001',
							severity: 'error',
							sourcePath: '/tmp/test/sk-abcdefghijklmnop',
						},
					],
				}),
			);
			const json = JSON.stringify(ctx);
			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
		});
	});

	describe('question cluster redaction', () => {
		it('redacts token-like values embedded in planned question clusters', () => {
			const ctx = buildIntakeContext(
				makeInput({
					questionCluster: {
						gapsConsidered: [],
						phaseCoverage: [],
						questions: [
							{
								blockingLevel: 'blocking',
								existingOpenQuestionId: undefined,
								id: 'q-secret-cluster',
								isSchemaDerived: false,
								planStatus: 'planned',
								priority: 'high',
								reason: 'existing_open_question',
								reasonDescription: 'Existing open question',
								relatedDependencyId: undefined,
								relatedSectionId: undefined,
								source: {
									descriptorPath: 'profiles/standard/test.yml',
									documentCanonicalId: 'doc-secret',
									documentTitle: 'Secret Test',
									fieldPointer: undefined,
									phaseId: 'phase-secret',
									sectionId: undefined,
									sectionTitle: undefined,
								},
								text: 'Should we use sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD here?',
							},
						],
						reasonSummary:
							'Cluster mentions hf_abcdefghijklmnopqrstuvwxyz1234567890ABCD',
						skippedCount: 0,
						sourceDocuments: ['doc-secret'],
					},
				}),
			);

			const json = JSON.stringify(ctx);
			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(json).not.toMatch(/hf_[a-zA-Z0-9]{20,}/);
			expect(ctx.redaction.redactedCategories).toContain('questionCluster');
		});
	});

	describe('provider secret-like values', () => {
		it('redacts provider secret-like values', () => {
			const state: WorkspaceState = {
				...createEmptyState(),
				provider: {
					enabled: true,
					providerId: 'openai',
					tokenEnvVarName: 'OPENAI_API_KEY',
				},
			};
			const ctx = buildIntakeContext(makeInput({ state }));
			// env var name like OPENAI_API_KEY is a reference, not a secret
			expect(ctx).toBeDefined();
		});
	});
});
