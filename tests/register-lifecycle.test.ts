/** Step 8.2 — Register Lifecycle Tests */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	acceptRisk,
	activateHypothesis,
	confirmRegisterItem,
	createRegisterItem,
	getRegisterItem,
	invalidateHypothesis,
	linkRegisterItemToAffectedDocument,
	linkRegisterItemToSource,
	listRegisterItems,
	markHypothesisInconclusive,
	mitigateRisk,
	proposeRegisterItem,
	rejectRegisterItem,
	reopenOpenQuestion,
	resolveOpenQuestion,
	resolveRisk,
	reviseRegisterItem,
	supersedeRegisterItem,
	validateHypothesis,
} from '../src/index.js';
import type {
	RegisterAffectedDocumentLink,
	RegisterSourceLink,
} from '../src/registers/register-types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-reg-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);
	mkdirSync(dir, { recursive: true });
	const logosDir = join(dir, '.logos');
	mkdirSync(logosDir, { recursive: true });
	const state = {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		claimSourceLinks: [],
		claims: [],
		decisions: [],
		documentation: {
			isDefault: true,
			rootPath: 'logos/',
			wasExplicitlyConfigured: false,
		},
		generationRuns: [],
		migrations: [],
		openQuestions: [],
		profile: { profileId: 'standard', source: 'bundled' as const },
		proposals: [],
		registers: {
			assumptions: [],
			decisions: [],
			hypotheses: [],
			lifecycleEvents: [],
			openQuestions: [],
			risks: [],
		},
		risks: [],
		runs: [],
		schemaVersion: '3.2.0' as const,
		sessions: [],
		sources: [],
		validationRuns: [],
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized' as const,
			initializedBy: undefined,
			projectRootPath: dir,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'test-reg-lifecycle',
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
	return `reg-t-${String(idCounter).padStart(4, '0')}`;
}

function deterministicClock(): { now(): string } {
	return { now: () => '2024-06-01T00:00:00.000Z' };
}

// ---------------------------------------------------------------------------

describe('Register lifecycle operations', () => {
	let tempDir = '';

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	const defaultOpts = () => ({
		clock: deterministicClock(),
		dryRun: false,
		idFactory: deterministicId,
		projectRoot: tempDir,
	});

	// -------------------------------------------------------------------
	// Creation
	// -------------------------------------------------------------------

	describe('createRegisterItem', () => {
		it('creates a proposed decision', async () => {
			const result = await createRegisterItem(
				{
					decisionStatement: 'We will use TypeScript for all new code',
					kind: 'decision',
					rationale: 'Type safety and tooling support',
					title: 'Use TypeScript',
				},
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item).toBeDefined();
			expect(result.item?.kind).toBe('decision');
			expect(result.item?.status).toBe('proposed');
			expect(result.item?.confidence).toBe('unknown');
			expect(result.item?.reviewState).toBe('requires_review');
			expect(result.item?.lifecycleHistory.length).toBe(1);
			expect(result.item?.lifecycleHistory[0]?.eventType).toBe('proposed');
		});

		it('creates a proposed assumption', async () => {
			const result = await createRegisterItem(
				{
					assumptionStatement: 'End users have stable internet',
					kind: 'assumption',
					title: 'Stable connectivity',
				},
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.kind).toBe('assumption');
			expect(result.item?.status).toBe('proposed');
		});

		it('creates a proposed hypothesis', async () => {
			const result = await createRegisterItem(
				{
					hypothesisStatement: 'Feature X increases DAU by 20%',
					kind: 'hypothesis',
					title: 'Retention improvement',
				},
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.kind).toBe('hypothesis');
			expect(result.item?.status).toBe('proposed');
		});

		it('creates a proposed risk', async () => {
			const result = await createRegisterItem(
				{
					impact: 'high',
					kind: 'risk',
					likelihood: 'medium',
					riskStatement: 'Third-party API may throttle requests',
					title: 'API rate limiting',
				},
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.kind).toBe('risk');
			expect(result.item?.status).toBe('proposed');
		});

		it('creates an open question', async () => {
			const result = await createRegisterItem(
				{
					isBlocking: true,
					kind: 'open_question',
					questionText: 'How should we handle authentication?',
					title: 'Auth approach',
				},
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.kind).toBe('open_question');
			expect(result.item?.status).toBe('open');
		});
	});

	describe('proposeRegisterItem', () => {
		it('creates item in proposed state with requires_review', async () => {
			const result = await proposeRegisterItem(
				{
					decisionStatement: 'We should do X',
					kind: 'decision',
					title: 'A proposal',
				},
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.status).toBe('proposed');
			expect(result.item?.reviewState).toBe('requires_review');
		});
	});

	// -------------------------------------------------------------------
	// Decision transitions
	// -------------------------------------------------------------------

	describe('decision lifecycle', () => {
		it('propose → confirm decision', async () => {
			const created = await createRegisterItem(
				{
					decisionStatement: 'We will use TypeScript',
					kind: 'decision',
					title: 'Use TypeScript',
				},
				defaultOpts(),
			);
			expect(created.success).toBe(true);

			const confirmed = await confirmRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);
			expect(confirmed.success).toBe(true);
			expect(confirmed.item?.status).toBe('confirmed');
			expect(confirmed.item?.lifecycleHistory.length).toBe(2);
			expect(
				confirmed.item?.lifecycleHistory.some(
					(e) => e.eventType === 'confirmed',
				),
			).toBe(true);
		});

		it('propose → reject decision', async () => {
			const created = await createRegisterItem(
				{
					decisionStatement: 'We will use Python',
					kind: 'decision',
					title: 'Use Python',
				},
				defaultOpts(),
			);
			const rejected = await rejectRegisterItem(
				created.item?.id,
				{ kind: 'decision', notes: 'Not needed', title: '' },
				defaultOpts(),
			);
			expect(rejected.success).toBe(true);
			expect(rejected.item?.status).toBe('rejected');
		});

		it('confirm → supersede decision', async () => {
			const created = await createRegisterItem(
				{
					decisionStatement: 'Use TypeScript v4',
					kind: 'decision',
					title: 'Use TS 4',
				},
				defaultOpts(),
			);
			await confirmRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);
			const superseded = await supersedeRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);
			expect(superseded.success).toBe(true);
			expect(superseded.item?.status).toBe('superseded');
		});

		it('rejected → confirmed transition fails', async () => {
			const created = await createRegisterItem(
				{
					decisionStatement: 'Use Rust',
					kind: 'decision',
					title: 'Use Rust',
				},
				defaultOpts(),
			);
			await rejectRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);
			const attemptConfirm = await confirmRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);
			expect(attemptConfirm.success).toBe(false);
			expect(
				attemptConfirm.diagnostics.some(
					(d) => d.code === 'register_invalid_transition',
				),
			).toBe(true);
		});
	});

	// -------------------------------------------------------------------
	// Assumption transitions
	// -------------------------------------------------------------------

	describe('assumption lifecycle', () => {
		it('propose → confirm assumption', async () => {
			const created = await createRegisterItem(
				{
					assumptionStatement: 'Network is stable',
					kind: 'assumption',
					title: 'Stable network',
				},
				defaultOpts(),
			);
			const confirmed = await confirmRegisterItem(
				created.item?.id,
				{ kind: 'assumption', title: '' },
				defaultOpts(),
			);
			expect(confirmed.success).toBe(true);
			expect(confirmed.item?.status).toBe('confirmed');
		});

		it('confirm → supersede assumption', async () => {
			const created = await createRegisterItem(
				{
					assumptionStatement: 'Old assumption',
					kind: 'assumption',
					title: 'Old assumption',
				},
				defaultOpts(),
			);
			await confirmRegisterItem(
				created.item?.id,
				{ kind: 'assumption', title: '' },
				defaultOpts(),
			);
			const superseded = await supersedeRegisterItem(
				created.item?.id,
				{ kind: 'assumption', title: '' },
				defaultOpts(),
			);
			expect(superseded?.item?.status).toBe('superseded');
		});
	});

	// -------------------------------------------------------------------
	// Hypothesis transitions
	// -------------------------------------------------------------------

	describe('hypothesis lifecycle', () => {
		it('propose → activate hypothesis', async () => {
			const created = await createRegisterItem(
				{
					hypothesisStatement: 'Feature X improves retention',
					kind: 'hypothesis',
					title: 'Retention test',
				},
				defaultOpts(),
			);
			const activated = await activateHypothesis(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			expect(activated.success).toBe(true);
			expect(activated.item?.status).toBe('active');
		});

		it('activate → validate hypothesis', async () => {
			const created = await createRegisterItem(
				{
					hypothesisStatement: 'A/B test shows improvement',
					kind: 'hypothesis',
					title: 'A/B test',
				},
				defaultOpts(),
			);
			await activateHypothesis(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			const validated = await validateHypothesis(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			expect(validated.success).toBe(true);
			expect(validated.item?.status).toBe('validated');
		});

		it('activate → invalidate hypothesis', async () => {
			const created = await createRegisterItem(
				{
					hypothesisStatement: 'This will not work',
					kind: 'hypothesis',
					title: 'Failed test',
				},
				defaultOpts(),
			);
			await activateHypothesis(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			const invalidated = await invalidateHypothesis(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			expect(invalidated.success).toBe(true);
			expect(invalidated.item?.status).toBe('invalidated');
		});

		it('activate → mark inconclusive', async () => {
			const created = await createRegisterItem(
				{
					hypothesisStatement: 'Results unclear',
					kind: 'hypothesis',
					title: 'Inconclusive test',
				},
				defaultOpts(),
			);
			await activateHypothesis(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			const inconclusive = await markHypothesisInconclusive(
				created.item?.id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			expect(inconclusive.success).toBe(true);
			expect(inconclusive.item?.status).toBe('inconclusive');
		});
	});

	// -------------------------------------------------------------------
	// Open question transitions
	// -------------------------------------------------------------------

	describe('open question lifecycle', () => {
		it('resolve open question', async () => {
			const created = await createRegisterItem(
				{
					kind: 'open_question',
					questionText: 'How to handle auth?',
					title: 'Auth approach',
				},
				defaultOpts(),
			);
			const resolved = await resolveOpenQuestion(
				created.item?.id,
				{
					kind: 'open_question',
					resolutionSummary: 'Decided to use OAuth2',
					title: '',
				},
				defaultOpts(),
			);
			expect(resolved.success).toBe(true);
			expect(resolved.item?.status).toBe('resolved');
		});

		it('reopen resolved open question', async () => {
			const created = await createRegisterItem(
				{
					kind: 'open_question',
					questionText: 'How to deploy?',
					title: 'Deployment strategy',
				},
				defaultOpts(),
			);
			await resolveOpenQuestion(
				created.item?.id,
				{ kind: 'open_question', resolutionSummary: 'Blue-green', title: '' },
				defaultOpts(),
			);
			const reopened = await reopenOpenQuestion(
				created.item?.id,
				{ kind: 'open_question', notes: 'New concerns arose', title: '' },
				defaultOpts(),
			);
			expect(reopened.success).toBe(true);
			expect(reopened.item?.status).toBe('open');
		});

		it('cannot reopen non-resolved open question', async () => {
			const created = await createRegisterItem(
				{
					kind: 'open_question',
					questionText: 'Test?',
					title: 'Test question',
				},
				defaultOpts(),
			);
			const result = await reopenOpenQuestion(
				created.item?.id,
				{ kind: 'open_question', title: '' },
				defaultOpts(),
			);
			expect(result.success).toBe(false);
		});
	});

	// -------------------------------------------------------------------
	// Risk transitions
	// -------------------------------------------------------------------

	describe('risk lifecycle', () => {
		it('propose → accept risk', async () => {
			const created = await createRegisterItem(
				{
					kind: 'risk',
					likelihood: 'medium',
					riskStatement: 'API rate limiting risk',
					title: 'API rate limit',
				},
				defaultOpts(),
			);
			const accepted = await acceptRisk(
				created.item?.id,
				{ kind: 'risk', title: '' },
				defaultOpts(),
			);
			expect(accepted.success).toBe(true);
			expect(accepted.item?.status).toBe('accepted');
		});

		it('accept → mitigate risk', async () => {
			const created = await createRegisterItem(
				{
					kind: 'risk',
					likelihood: 'high',
					riskStatement: 'Network latency risk',
					title: 'Latency risk',
				},
				defaultOpts(),
			);
			await acceptRisk(
				created.item?.id,
				{ kind: 'risk', title: '' },
				defaultOpts(),
			);
			const mitigated = await mitigateRisk(
				created.item?.id,
				{
					kind: 'risk',
					mitigation: 'Added caching layer',
					title: '',
				},
				defaultOpts(),
			);
			expect(mitigated.success).toBe(true);
			expect(mitigated.item?.status).toBe('mitigated');
		});

		it('mitigate → resolve risk', async () => {
			const created = await createRegisterItem(
				{
					kind: 'risk',
					likelihood: 'low',
					riskStatement: 'Memory leak risk',
					title: 'Memory risk',
				},
				defaultOpts(),
			);
			await acceptRisk(
				created.item?.id,
				{ kind: 'risk', title: '' },
				defaultOpts(),
			);
			await mitigateRisk(
				created.item?.id,
				{ kind: 'risk', mitigation: 'Fixed', title: '' },
				defaultOpts(),
			);
			const resolved = await resolveRisk(
				created.item?.id,
				{ kind: 'risk', title: '' },
				defaultOpts(),
			);
			expect(resolved.success).toBe(true);
			expect(resolved.item?.status).toBe('resolved');
		});
	});

	// -------------------------------------------------------------------
	// Invalid transitions
	// -------------------------------------------------------------------

	describe('invalid transitions', () => {
		it('do not mutate state on invalid transition', async () => {
			const created = await createRegisterItem(
				{
					kind: 'risk',
					riskStatement: 'Test risk',
					title: 'Test risk',
				},
				defaultOpts(),
			);
			// Try to mitigate without accepting first
			const attempt = await mitigateRisk(
				created.item?.id,
				{ kind: 'risk', title: '' },
				defaultOpts(),
			);
			expect(attempt.success).toBe(false);

			// Verify item is unchanged
			const current = await getRegisterItem(created.item?.id, {
				projectRoot: tempDir,
			});
			expect(current.item?.status).toBe('proposed');
		});

		it('superseded records remain queryable', async () => {
			const created = await createRegisterItem(
				{
					decisionStatement: 'Old choice',
					kind: 'decision',
					title: 'Old decision',
				},
				defaultOpts(),
			);
			await confirmRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);
			await supersedeRegisterItem(
				created.item?.id,
				{ kind: 'decision', title: '' },
				defaultOpts(),
			);

			const found = await getRegisterItem(created.item?.id, {
				projectRoot: tempDir,
			});
			expect(found.success).toBe(true);
			expect(found.item?.status).toBe('superseded');
		});
	});

	// -------------------------------------------------------------------
	// Lifecycle history
	// -------------------------------------------------------------------

	describe('lifecycle history preservation', () => {
		it('preserves full lifecycle history', async () => {
			const created = await createRegisterItem(
				{
					hypothesisStatement: 'Testing full lifecycle',
					kind: 'hypothesis',
					title: 'Full cycle',
				},
				defaultOpts(),
			);
			const id = created.item?.id;

			await activateHypothesis(
				id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);
			await validateHypothesis(
				id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);

			const final = await getRegisterItem(id, { projectRoot: tempDir });
			expect(final.item?.lifecycleHistory.length).toBe(3);
			const eventTypes = final.item?.lifecycleHistory.map((e) => e.eventType);
			expect(eventTypes).toContain('proposed');
			expect(eventTypes).toContain('activated');
			expect(eventTypes).toContain('validated');
		});
	});

	// -------------------------------------------------------------------
	// Dry-run
	// -------------------------------------------------------------------

	describe('dry-run', () => {
		it('does not write on dry-run create', async () => {
			const opts = { ...defaultOpts(), dryRun: true as const };
			const result = await createRegisterItem(
				{
					decisionStatement: 'Should not persist',
					kind: 'decision',
					title: 'Dry-run decision',
				},
				opts,
			);
			expect(result.dryRun).toBe(true);
			// The item should not be persisted:
			const items = await listRegisterItems({ projectRoot: tempDir });
			expect(items.items.length).toBe(0);
		});

		it('does not write on dry-run transition', async () => {
			// First create for real
			const created = await createRegisterItem(
				{
					decisionStatement: 'Real',
					kind: 'decision',
					title: 'Real decision',
				},
				defaultOpts(),
			);
			const id = created.item?.id;

			// Dry-run confirm
			const result = await confirmRegisterItem(
				id,
				{ kind: 'decision', title: '' },
				{ ...defaultOpts(), dryRun: true as const },
			);
			expect(result.dryRun).toBe(true);

			// Should still be proposed
			const current = await getRegisterItem(id, { projectRoot: tempDir });
			expect(current.item?.status).toBe('proposed');
		});
	});

	// -------------------------------------------------------------------
	// Revise
	// -------------------------------------------------------------------

	describe('reviseRegisterItem', () => {
		it('revises item title and body', async () => {
			const created = await createRegisterItem(
				{
					body: 'Original body',
					decisionStatement: 'Original statement',
					kind: 'decision',
					title: 'Original title',
				},
				defaultOpts(),
			);
			const revised = await reviseRegisterItem(
				created.item?.id,
				{
					body: 'Revised body',
					kind: 'decision',
					notes: 'Needed updates',
					title: 'Revised title',
				},
				defaultOpts(),
			);
			expect(revised.success).toBe(true);
			expect(revised.item?.title).toBe('Revised title');
			expect(revised.item?.body).toBe('Revised body');
			expect(
				revised.item?.lifecycleHistory.some((e) => e.eventType === 'revised'),
			).toBe(true);
		});
	});

	// -------------------------------------------------------------------
	// Source and document linking
	// -------------------------------------------------------------------

	describe('source and document linking', () => {
		it('links source to register item', async () => {
			const created = await createRegisterItem(
				{
					decisionStatement: 'Linked decision',
					kind: 'decision',
					title: 'Decision with source',
				},
				defaultOpts(),
			);
			const id = created.item?.id;
			const sourceLink: RegisterSourceLink = {
				answerId: 'ans-001',
				linkedAt: '2024-06-01T00:00:00.000Z',
				proposalId: 'prop-001',
				sessionId: 'sess-001',
				sourceId: 'src-001',
			};
			const result = await linkRegisterItemToSource(
				id,
				sourceLink,
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.sourceLinks.length).toBe(1);
			expect(result.item?.sourceLinks[0]?.sourceId).toBe('src-001');
			expect(result.item?.sourceLinks[0]?.sessionId).toBe('sess-001');
		});

		it('links affected document to register item', async () => {
			const created = await createRegisterItem(
				{
					assumptionStatement: 'Network is stable',
					kind: 'assumption',
					title: 'Network assumption',
				},
				defaultOpts(),
			);
			const id = created.item?.id;
			const docLink: RegisterAffectedDocumentLink = {
				documentCanonicalId: 'doc-001',
				linkedAt: '2024-06-01T00:00:00.000Z',
				phaseId: 'phase-1',
			};
			const result = await linkRegisterItemToAffectedDocument(
				id,
				docLink,
				defaultOpts(),
			);
			expect(result.success).toBe(true);
			expect(result.item?.affectedDocumentLinks.length).toBe(1);
			expect(result.item?.affectedDocumentLinks[0]?.documentCanonicalId).toBe(
				'doc-001',
			);
		});
	});

	// -------------------------------------------------------------------
	// Review boundary
	// -------------------------------------------------------------------

	describe('review boundary', () => {
		it('proposed items are not automatically confirmed', async () => {
			const result = await createRegisterItem(
				{
					decisionStatement: 'Should not be confirmed',
					kind: 'decision',
					title: 'Auto-confirm test',
				},
				defaultOpts(),
			);
			expect(result.item?.status).toBe('proposed');
			expect(result.item?.reviewState).toBe('requires_review');
		});

		it('inferred content is marked requires_review', async () => {
			const result = await proposeRegisterItem(
				{
					assumptionStatement: 'Probably true',
					confidence: 'inferred',
					kind: 'assumption',
					title: 'Inferred assumption',
				},
				defaultOpts(),
			);
			expect(result.item?.status).toBe('proposed');
			expect(result.item?.reviewState).toBe('requires_review');
		});

		it('rejected records remain queryable', async () => {
			const created = await createRegisterItem(
				{
					hypothesisStatement: 'Was wrong',
					kind: 'hypothesis',
					title: 'Rejected hypothesis',
				},
				defaultOpts(),
			);
			const id = created.item?.id;
			await rejectRegisterItem(
				id,
				{ kind: 'hypothesis', title: '' },
				defaultOpts(),
			);

			const found = await getRegisterItem(id, { projectRoot: tempDir });
			expect(found.success).toBe(true);
			expect(found.item?.status).toBe('rejected');
		});
	});
});
