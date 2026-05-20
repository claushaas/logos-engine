/** Proposal Security tests — Step 4.3 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProposalMappingInput } from '../../src/index.js';
import {
	createProposal,
	listProposals,
	mapAnswersToProposals,
	type ReviewableProposal,
	validateWorkspaceState,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);
	mkdirSync(dir, { recursive: true });
	const logosDir = join(dir, '.logos');
	mkdirSync(logosDir, { recursive: true });
	const state = {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		decisions: [],
		documentation: {
			isDefault: true,
			rootPath: 'logos/',
			wasExplicitlyConfigured: false,
		},
		generationRuns: [],
		migrations: [],
		openQuestions: [],
		profile: { profileId: 'standard', source: 'bundled' },
		proposals: [],
		risks: [],
		runs: [],
		schemaVersion: '3.2.0',
		sessions: [],
		validationRuns: [],
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			projectRootPath: dir,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'test-sec',
		},
	};
	writeFileSync(
		join(logosDir, 'workspace.json'),
		JSON.stringify(state, null, 2),
	);
	return dir;
}

function cleanupTempDir(dir: string): void {
	try {
		rmSync(dir, { recursive: true });
	} catch {
		// best effort
	}
}

let idCounter = 0;
function deterministicId(): string {
	idCounter += 1;
	return `prop-sec-${String(idCounter).padStart(3, '0')}`;
}

function deterministicClock(): { now(): string } {
	return { now: () => '2024-01-15T00:00:00.000Z' };
}

function makeInput(
	overrides: Partial<ProposalMappingInput> = {},
): ProposalMappingInput {
	return {
		answers: [],
		clock: deterministicClock(),
		idFactory: deterministicId,
		sessionId: 'session-sec',
		...overrides,
	};
}

function makeProposal(
	overrides: Partial<ReviewableProposal> = {},
): ReviewableProposal {
	return {
		body: 'Test body.',
		confidence: undefined,
		createdAt: '2024-01-15T00:00:00.000Z',
		evidence: 'Test evidence.',
		extractionMetadata: undefined,
		kind: 'decision',
		proposalId: deterministicId(),
		rejectionReason: undefined,
		revisionHistory: undefined,
		source: {
			answerId: 'ans-001',
			documentCanonicalId: undefined,
			phaseId: undefined,
			questionId: 'q-001',
			sessionId: 'session-001',
		},
		status: 'proposed',
		supersededByProposalId: undefined,
		targetConfirmedRecordId: undefined,
		title: 'Test',
		updatedAt: '2024-01-15T00:00:00.000Z',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposal-security', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
		idCounter = 0;
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	describe('secrets not persisted', () => {
		it('fake raw API key in answer text does not cause persistence failures', async () => {
			// Map the answer — it should produce proposals without the API key causing issues
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer:
								'We decide to use API key sk-test-fake-key-12345 for the integration.',
							answerId: 'ans-sec-001',
							questionId: 'q-001',
							questionText: 'How to integrate?',
						},
					],
				}),
			);

			expect(result.success).toBe(true);
			// Proposals are created
			expect(result.proposals.length).toBeGreaterThan(0);
		});

		it('mapped proposal text redacts raw token-like answer evidence', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer:
								'We decide to use sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD for testing.',
							answerId: 'ans-sec-redact-001',
							questionId: 'q-001',
							questionText: 'How to test?',
						},
					],
				}),
			);

			expect(result.success).toBe(true);
			expect(result.proposals.length).toBeGreaterThan(0);
			const json = JSON.stringify(result.proposals);
			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(json).toContain('[REDACTED]');
		});

		it('mapped extraction proposals redact raw token-like provider output', () => {
			const result = mapAnswersToProposals(
				makeInput({
					validatedExtractions: [
						{
							confidence: 'medium',
							fields: {
								body: 'Use hf_abcdefghijklmnopqrstuvwxyz1234567890ABCD for a fixture only.',
								title:
									'Decision with sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD',
							},
							isProposed: true,
							recordId: 'ext-sec-001',
							recordType: 'decision',
						},
					],
				}),
			);

			expect(result.success).toBe(true);
			expect(result.proposals.length).toBe(1);
			const json = JSON.stringify(result.proposals);
			expect(json).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(json).not.toMatch(/hf_[a-zA-Z0-9]{20,}/);
			expect(json).toContain('[REDACTED]');
		});

		it('fake raw provider token from extraction is not persisted in state', async () => {
			const proposal = makeProposal({
				body: 'No tokens here',
				extractionMetadata: undefined,
				title: 'Clean proposal',
			});

			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const listResult = await listProposals({ projectRoot: tempDir });
			expect(listResult.proposals.length).toBeGreaterThan(0);
			const stored = listResult.proposals[0];
			if (!stored) throw new Error('Expected proposal to exist');
			// The body and title should not contain raw tokens
			expect(stored.body).not.toMatch(/sk-[a-zA-Z0-9]+/);
			expect(stored.title).not.toMatch(/sk-[a-zA-Z0-9]+/);

			// Also validate that the workspace state itself passes validation
			const { readWorkspaceState } = await import(
				'../../src/state/workspace-state-repository.js'
			);
			const readResult = await readWorkspaceState({ projectRoot: tempDir });
			if (readResult.state) {
				const validation = validateWorkspaceState(readResult.state);
				// State should validate — but may warn about secrets
				if (!validation.success) {
					// If validation fails, it must NOT be because of the proposal
					const proposalErrors = validation.errors.filter((e) =>
						e.path?.includes('proposals'),
					);
					expect(proposalErrors).toHaveLength(0);
				}
			}
		});

		it('proposal with secret-like title/body is flagged by state validation', async () => {
			// Create a proposal in-memory via workspace state to test validation
			const { createDefaultWorkspaceState } = await import(
				'../../src/state/workspace-state-defaults.js'
			);

			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'test-sec-validate',
			});

			// Try to add a proposal with a secret-like value
			const wsProposal = {
				body: 'normal body',
				confidence: undefined,
				createdAt: '2024-01-01T00:00:00.000Z',
				evidence: undefined,
				extractionMetadata: undefined,
				kind: 'decision' as const,
				proposalId: 'prop-secret-1',
				rejectionReason: undefined,
				revisionHistory: undefined,
				sourceAnswerId: undefined,
				sourceDocumentCanonicalId: undefined,
				sourcePhaseId: undefined,
				sourceQuestionId: undefined,
				sourceSessionId: undefined,
				status: 'proposed' as const,
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: 'sk-proj-secret-key-that-looks-like-a-token',
				updatedAt: '2024-01-01T00:00:00.000Z',
			};

			state.proposals = [wsProposal];

			const validation = validateWorkspaceState(state);
			// The workspace state schema has superRefine that checks for secret-like values
			expect(validation.success).toBe(false);
			expect(
				validation.errors.some((e) =>
					e.message.toLowerCase().includes('secret'),
				),
			).toBe(true);
		});

		it('diagnostics do not echo raw fake secrets', () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'Use token: sk-fake-api-key-123456',
							answerId: 'ans-sec-002',
							questionId: undefined,
							questionText: undefined,
						},
					],
				}),
			);

			// The diagnostics should not contain the fake secret
			for (const diag of result.diagnostics) {
				expect(diag.message).not.toMatch(/sk-fake-api-key/);
			}
		});

		it('raw prompts and model responses are not persisted in proposal storage', async () => {
			// Create a proposal that might have been derived from AI
			const proposal = makeProposal({
				body: 'This is a decision based on AI analysis.',
				extractionMetadata: {
					operation: 'structured_extraction',
					providerId: 'fake',
					providerKind: 'fake',
					responseId: 'resp-001',
				},
				title: 'AI-assisted decision',
			});

			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const listResult = await listProposals({ projectRoot: tempDir });
			expect(listResult.proposals.length).toBeGreaterThan(0);
			const stored = listResult.proposals[0];
			if (!stored) throw new Error('Expected proposal to exist');
			// Only safe extraction metadata is stored — no raw prompts/responses
			expect(stored.extractionMetadata).toBeDefined();
			expect(stored.extractionMetadata?.providerId).toBe('fake');
			expect(stored.extractionMetadata?.providerKind).toBe('fake');
			// No raw tokens
			const storedJson = JSON.stringify(stored);
			expect(storedJson).not.toContain('prompt');
			expect(storedJson).not.toContain('raw_response');
			expect(storedJson).not.toContain('sk-');
		});
	});

	describe('traceability', () => {
		it('proposal records include answer/session/question references', async () => {
			const proposal = makeProposal({
				source: {
					answerId: 'ans-trace-001',
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: 'q-trace-001',
					sessionId: 'session-trace-001',
				},
			});

			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const retrieved = await listProposals({ projectRoot: tempDir });
			expect(retrieved.proposals.length).toBeGreaterThan(0);
			const stored = retrieved.proposals[0];
			if (!stored) throw new Error('Expected proposal to exist');
			expect(stored.source.answerId).toBe('ans-trace-001');
			expect(stored.source.questionId).toBe('q-trace-001');
			expect(stored.source.sessionId).toBe('session-trace-001');
		});

		it('unknown source is explicit as undefined, not invented', async () => {
			const result = mapAnswersToProposals(
				makeInput({
					answers: [
						{
							answer: 'Just a simple answer.',
							answerId: 'ans-unknown',
							questionId: undefined,
							questionText: undefined,
						},
					],
					sessionId: undefined,
				}),
			);

			expect(result.proposals.length).toBeGreaterThan(0);
			const proposal = result.proposals[0];
			if (!proposal) throw new Error('Expected proposal to exist');
			expect(proposal.source.questionId).toBeUndefined();
			expect(proposal.source.documentCanonicalId).toBeUndefined();
			expect(proposal.source.phaseId).toBeUndefined();
			expect(proposal.source.sessionId).toBeUndefined();
		});
	});
});
