/** Proposal Lifecycle tests — Step 4.3 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	acceptProposal,
	createProposal,
	getProposal,
	type ReviewableProposal,
	rejectProposal,
	reviseProposal,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);
	mkdirSync(dir, { recursive: true });
	// Initialize .logos/workspace.json
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
			workspaceId: 'test-lifecycle',
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
	return `prop-t-${String(idCounter).padStart(3, '0')}`;
}

function deterministicClock(): { now(): string } {
	return { now: () => '2024-06-01T00:00:00.000Z' };
}

function makeProposal(
	overrides: Partial<ReviewableProposal> = {},
): ReviewableProposal {
	return {
		body: 'Test body content.',
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
		title: 'Test Decision',
		updatedAt: '2024-01-15T00:00:00.000Z',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposal-lifecycle', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
		idCounter = 0;
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	describe('accept', () => {
		it('accepting proposed decision creates confirmed decision record', async () => {
			const proposal = makeProposal({ kind: 'decision' });
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-001',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('accepted');
			expect(result.proposal?.targetConfirmedRecordId).toBe('rec-001');
			expect(result.changedPaths.length).toBeGreaterThan(0);
		});

		it('accepting proposed assumption creates confirmed assumption record', async () => {
			const proposal = makeProposal({ kind: 'assumption' });
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-002',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('accepted');
		});

		it('accepting proposed open question creates confirmed open question record', async () => {
			const proposal = makeProposal({
				kind: 'open_question',
				title: 'What about testing?',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-003',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('accepted');
		});

		it('accepting proposed risk creates confirmed risk record', async () => {
			const proposal = makeProposal({ kind: 'risk' });
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-004',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('accepted');
		});

		it('accepting document content hint does not generate Markdown', async () => {
			const proposal = makeProposal({ kind: 'document_content_hint' });
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-005',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('accepted');
			expect(
				result.diagnostics.some((d) => d.code === 'I_CONTENT_HINT_ACCEPTED'),
			).toBe(true);
			// No target record created for content hints
			expect(result.proposal?.targetConfirmedRecordId).toBeUndefined();
		});

		it('proposal status becomes accepted after accept', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-006',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			const retrieved = await getProposal({
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});
			expect(retrieved.success).toBe(true);
			expect(retrieved.proposal?.status).toBe('accepted');
		});

		it('repeated accept does not duplicate confirmed records', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-007',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			// Second accept should be idempotent
			const result2 = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-008',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result2.success).toBe(true);
			expect(
				result2.diagnostics.some((d) => d.code === 'W_ALREADY_ACCEPTED'),
			).toBe(true);
		});

		it('accepting non-existent proposal fails with diagnostic', async () => {
			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				projectRoot: tempDir,
				proposalId: 'nonexistent',
			});

			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'E_PROPOSAL_NOT_FOUND'),
			).toBe(true);
		});

		it('accepting rejected/superseded proposal fails with diagnostic', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'E_INVALID_TRANSITION'),
			).toBe(true);
		});

		it('dry-run accept writes nothing', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				dryRun: true,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result.dryRun).toBe(true);
			// Proposal should still be proposed after dry-run
			const retrieved = await getProposal({
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});
			expect(retrieved.proposal?.status).toBe('proposed');
		});
	});

	describe('reject', () => {
		it('rejecting proposed proposal marks it rejected', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				reason: 'Not needed',
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('rejected');
			expect(result.proposal?.rejectionReason).toBe('Not needed');
		});

		it('rejection reason is stored when supplied', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				reason: 'Duplicate information',
			});

			const retrieved = await getProposal({
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});
			expect(retrieved.proposal?.rejectionReason).toBe('Duplicate information');
		});

		it('rejecting does not create confirmed records', async () => {
			const proposal = makeProposal({ kind: 'decision' });
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			// List decisions — should still be empty (no confirmed decision created)
			const { readWorkspaceState } = await import(
				'../../src/state/workspace-state-repository.js'
			);
			const readResult = await readWorkspaceState({ projectRoot: tempDir });
			expect(readResult.state?.decisions).toHaveLength(0);
		});

		it('repeated reject is non-destructive and deterministic', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			const result2 = await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			expect(result2.success).toBe(true);
			expect(
				result2.diagnostics.some((d) => d.code === 'W_ALREADY_REJECTED'),
			).toBe(true);
		});

		it('dry-run reject writes nothing', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await rejectProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				dryRun: true,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});

			const retrieved = await getProposal({
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});
			expect(retrieved.proposal?.status).toBe('proposed');
		});
	});

	describe('revise', () => {
		it('revising proposed proposal preserves original source/evidence', async () => {
			const proposal = makeProposal({
				body: 'Original body.',
				title: 'Original Title',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await reviseProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				body: 'Revised body content.',
				clock: deterministicClock(),
				idFactory: deterministicId,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				reason: 'Needed more detail',
				title: 'Revised Title',
			});

			expect(result.success).toBe(true);
			expect(result.proposal?.status).toBe('proposed');
			expect(result.proposal?.source.answerId).toBe('ans-001');
			expect(result.proposal?.source.sessionId).toBe('session-001');
		});

		it('revised content remains proposed until accepted', async () => {
			const proposal = makeProposal({
				body: 'Original body.',
				title: 'Original Title',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await reviseProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				body: 'Revised body.',
				clock: deterministicClock(),
				idFactory: deterministicId,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				title: 'Revised Title',
			});

			expect(result.proposal?.status).toBe('proposed');
		});

		it('old proposal is marked revised', async () => {
			const proposal = makeProposal({
				body: 'Original body.',
				title: 'Original Title',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await reviseProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				body: 'Revised body.',
				clock: deterministicClock(),
				idFactory: deterministicId,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				title: 'Revised Title',
			});

			const retrieved = await getProposal({
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});
			expect(retrieved.proposal?.status).toBe('revised');
		});

		it('accepting revised proposal creates confirmed record only after explicit accept', async () => {
			const proposal = makeProposal({
				body: 'Original body.',
				kind: 'decision',
				title: 'Original Title',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const reviseResult = await reviseProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				body: 'Revised body.',
				clock: deterministicClock(),
				idFactory: deterministicId,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				title: 'Revised Title',
			});

			const newProposalId = reviseResult.proposal?.proposalId;

			// Accept the new revised proposal
			const acceptResult = await acceptProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				clock: deterministicClock(),
				idFactory: () => 'rec-revised',
				projectRoot: tempDir,
				proposalId: newProposalId,
			});

			expect(acceptResult.success).toBe(true);
			expect(acceptResult.proposal?.status).toBe('accepted');
		});

		it('dry-run revise writes nothing', async () => {
			const proposal = makeProposal({
				body: 'Original body.',
				title: 'Original Title',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			await reviseProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				body: 'Revised body.',
				clock: deterministicClock(),
				dryRun: true,
				idFactory: deterministicId,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				title: 'Revised Title',
			});

			const retrieved = await getProposal({
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
			});
			expect(retrieved.proposal?.status).toBe('proposed');
		});

		it('invalid revision content fails validation', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await reviseProposal({
				_testTimestamp: '2024-06-01T00:00:00.000Z',
				body: '  ',
				clock: deterministicClock(),
				idFactory: deterministicId,
				projectRoot: tempDir,
				proposalId: proposal.proposalId,
				title: '  ',
			});

			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'E_EMPTY_REVISION'),
			).toBe(true);
		});
	});
});
