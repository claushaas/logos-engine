/** Proposal Repository tests — Step 4.3 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewableProposal } from '../../src/index.js';
import {
	createProposal,
	createProposals,
	getProposal,
	listProposals,
	listProposalsFromState,
} from '../../src/index.js';
import { createDefaultWorkspaceState } from '../../src/state/workspace-state-defaults.js';
import { readWorkspaceState } from '../../src/state/workspace-state-repository.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-repo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
		schemaVersion: '3.1.0',
		sessions: [],
		validationRuns: [],
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			projectRootPath: dir,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'test-repo',
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
	return `prop-r-${String(idCounter).padStart(3, '0')}`;
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
		title: 'Test Decision',
		updatedAt: '2024-01-15T00:00:00.000Z',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposal-repository', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
		idCounter = 0;
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	describe('createProposal', () => {
		it('persists a proposal to workspace state', async () => {
			const proposal = makeProposal();
			const result = await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			expect(result.success).toBe(true);
			expect(result.changedPaths.length).toBeGreaterThan(0);
		});

		it('stores proposals separately from confirmed records', async () => {
			// Store a proposal
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal: makeProposal({ kind: 'decision' }),
			});

			const readResult = await readWorkspaceState({ projectRoot: tempDir });
			expect(readResult.state?.proposals).toHaveLength(1);
			expect(readResult.state?.decisions).toHaveLength(0);
		});

		it('dry-run proposal creation writes nothing', async () => {
			const proposal = makeProposal();
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				dryRun: true,
				projectRoot: tempDir,
				proposal,
			});

			const readResult = await readWorkspaceState({ projectRoot: tempDir });
			expect(readResult.state?.proposals).toHaveLength(0);
		});

		it('state validates after proposal creation', async () => {
			const proposal = makeProposal({ title: 'Valid proposal' });
			const result = await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			expect(result.success).toBe(true);
			const readResult = await readWorkspaceState({ projectRoot: tempDir });
			expect(readResult.success).toBe(true);
		});

		it('missing initialized workspace returns recoverable diagnostic', async () => {
			const noInitDir = join(
				tmpdir(),
				`logos-noinit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			);
			mkdirSync(noInitDir, { recursive: true });

			try {
				const proposal = makeProposal();
				const result = await createProposal({
					projectRoot: noInitDir,
					proposal,
				});

				expect(result.success).toBe(false);
				expect(
					result.diagnostics.some((d) => d.code === 'workspace_missing'),
				).toBe(true);
			} finally {
				try {
					rmSync(noInitDir, { recursive: true });
				} catch {
					// best effort
				}
			}
		});
	});

	describe('listProposals', () => {
		it('lists proposals deterministically', async () => {
			const p1 = makeProposal({ proposalId: 'prop-list-1', title: 'First' });
			const p2 = makeProposal({ proposalId: 'prop-list-2', title: 'Second' });

			await createProposals(tempDir, [p1, p2], {
				_testTimestamp: '2024-01-15T00:00:00.000Z',
			});

			const result = await listProposals({ projectRoot: tempDir });
			expect(result.success).toBe(true);
			expect(result.proposals).toHaveLength(2);
			expect(result.proposals[0]?.title).toBe('First');
			expect(result.proposals[1]?.title).toBe('Second');
		});

		it('filters proposals by kind', async () => {
			const p1 = makeProposal({ kind: 'decision', proposalId: 'prop-f1' });
			const p2 = makeProposal({ kind: 'risk', proposalId: 'prop-f2' });

			await createProposals(tempDir, [p1, p2], {
				_testTimestamp: '2024-01-15T00:00:00.000Z',
			});

			const result = await listProposals({
				kind: 'risk',
				projectRoot: tempDir,
			});
			expect(result.proposals).toHaveLength(1);
			expect(result.proposals[0]?.kind).toBe('risk');
		});

		it('filters proposals by status', async () => {
			const p1 = makeProposal({ proposalId: 'prop-s1', status: 'proposed' });

			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal: p1,
			});

			const result = await listProposals({
				projectRoot: tempDir,
				status: 'proposed',
			});
			expect(result.proposals).toHaveLength(1);
		});
	});

	describe('getProposal', () => {
		it('retrieves proposal by id', async () => {
			const proposal = makeProposal({
				proposalId: 'prop-get-1',
				title: 'Find Me',
			});
			await createProposal({
				_testTimestamp: '2024-01-15T00:00:00.000Z',
				projectRoot: tempDir,
				proposal,
			});

			const result = await getProposal({
				projectRoot: tempDir,
				proposalId: 'prop-get-1',
			});
			expect(result.success).toBe(true);
			expect(result.proposal?.title).toBe('Find Me');
		});

		it('returns error for unknown proposal id', async () => {
			const result = await getProposal({
				projectRoot: tempDir,
				proposalId: 'nonexistent-proposal',
			});
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'E_PROPOSAL_NOT_FOUND'),
			).toBe(true);
		});
	});

	describe('listProposalsFromState', () => {
		it('reads proposals from in-memory state', () => {
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: '/tmp/test',
				workspaceId: 'test',
			});

			expect(listProposalsFromState(state)).toHaveLength(0);
		});
	});
});
