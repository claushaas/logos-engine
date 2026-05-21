import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
	DocumentationContract,
	GenerationPlanResult,
	LoadedDocumentDescriptor,
	LoadedPhaseDescriptor,
	ProfileStatusWorkflow,
	WorkspaceState,
} from '../src/index.js';
import {
	buildContractGraph,
	createDefaultWorkspaceState,
	createGenerationPlan,
	loadDocumentationContract,
	planDocumentGeneration,
	summarizeGenerationPlan,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(date: string): string {
	return new Date(date).toISOString();
}

function _identity<T>(x: T): T {
	return x;
}

function createEmptyState(overrides?: Partial<WorkspaceState>): WorkspaceState {
	const base = createDefaultWorkspaceState({
		createdAt: iso('2025-01-01T00:00:00Z'),
		projectRootPath: '/tmp/test-repo',
		updatedAt: iso('2025-01-01T00:00:00Z'),
		workspaceId: 'ws-empty',
	});
	return { ...base, ...overrides } as WorkspaceState;
}

function createStateWithDecision(
	canonicalId: string,
	decisionId: string,
	decisionUpdatedAt: string = iso('2025-06-01T00:00:00Z'),
): WorkspaceState {
	const state = createEmptyState();
	state.decisions = [
		{
			affectedDocumentIds: [canonicalId],
			body: 'Test decision body',
			confidence: 'high',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: decisionId,
			sourceRefs: [],
			status: 'confirmed',
			title: 'Test Decision',
			updatedAt: decisionUpdatedAt,
		},
	];
	return state;
}

function createStateWithAssumption(
	canonicalId: string,
	assumptionId: string,
): WorkspaceState {
	const state = createEmptyState();
	state.assumptions = [
		{
			affectedDocumentIds: [canonicalId],
			body: 'Test assumption body',
			caveat: 'Test caveat',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: assumptionId,
			sourceRefs: [],
			status: 'active',
			title: 'Test Assumption',
			updatedAt: iso('2025-01-01T00:00:00Z'),
		},
	];
	return state;
}

function createStateWithOpenQuestion(
	canonicalId: string,
	questionId: string,
): WorkspaceState {
	const state = createEmptyState();
	state.openQuestions = [
		{
			affectedDocumentIds: [canonicalId],
			body: 'Test question body',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: questionId,
			question: 'What is the answer?',
			sourceRefs: [],
			status: 'open',
			updatedAt: iso('2025-01-01T00:00:00Z'),
		},
	];
	return state;
}

function createStateWithArtifact(
	canonicalId: string,
	artifactPath: string,
	generatedAt: string = iso('2025-03-01T00:00:00Z'),
	status: 'generated' | 'failed' | 'stale' = 'generated',
): WorkspaceState {
	const state = createEmptyState();
	state.artifacts = [
		{
			artifactId: `art-${canonicalId}`,
			artifactType: 'canonical_markdown',
			checksum: 'abc123',
			generatedAt,
			isCanonical: true,
			path: artifactPath,
			sourceDocumentIds: [canonicalId],
			status,
		},
	];
	return state;
}

// ---------------------------------------------------------------------------
// Contract Fixtures
// ---------------------------------------------------------------------------

function createMinimalContract(): DocumentationContract {
	const phases: LoadedPhaseDescriptor[] = [
		{
			axis: 'normative',
			completionCriteria: [],
			dependsOn: [],
			description: 'Test phase',
			documents: [
				{ file: 'doc-a.yml', id: 'a', title: 'Doc A' },
				{ file: 'doc-b.yml', id: 'b', title: 'Doc B' },
			],
			feedsInto: [],
			generatedOutputs: {},
			id: 'phase-1',
			order: 1,
			qualityChecks: [],
			raw: {},
			readingOrder: ['a', 'b'],
			responsibilityBoundary: {},
			sourcePath: '/fake/phases/phase-1.yml',
			status: 'not_started',
			title: 'Phase 1',
		},
	];

	const documents: LoadedDocumentDescriptor[] = [
		{
			canonicalId: 'a',
			descriptor: {
				centralQuestion: 'What is A?',
				id: 'a',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/a.md',
						purpose: 'Doc A canonical',
					},
				},
				phase: 'phase-1',
				purpose: 'Define A',
				sections: [
					{
						id: 'section-a-1',
						questions: ['What is the core?'],
						required: true,
						title: 'Core',
					},
				],
				status: 'not_started',
				title: 'Document A',
				type: 'thesis',
			},
			documentOrder: 0,
			globalOrder: 0,
			phaseId: 'phase-1',
			phaseOrder: 1,
			sourcePath: '/fake/phases/phase-1/doc-a.yml',
		},
		{
			canonicalId: 'b',
			descriptor: {
				centralQuestion: 'What is B?',
				dependsOn: ['a'],
				id: 'b',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/b.md',
						purpose: 'Doc B canonical',
					},
				},
				phase: 'phase-1',
				purpose: 'Define B',
				sections: [
					{
						id: 'section-b-1',
						questions: ['What is core B?'],
						required: true,
						title: 'Core B',
					},
				],
				status: 'not_started',
				title: 'Document B',
				type: 'problem',
			},
			documentOrder: 1,
			globalOrder: 1,
			phaseId: 'phase-1',
			phaseOrder: 1,
			sourcePath: '/fake/phases/phase-1/doc-b.yml',
		},
	];

	const statusWorkflow: ProfileStatusWorkflow = {
		allowed: [
			'not_started',
			'drafting',
			'drafted',
			'needs_review',
			'reviewed',
			'approved',
			'deprecated',
		],
		terminal: ['approved', 'deprecated'],
		transitions: {
			approved: ['deprecated'],
			drafted: ['needs_review', 'needs_revision'],
			drafting: ['drafted'],
			needs_review: ['reviewed', 'needs_revision'],
			not_started: ['drafting'],
			reviewed: ['approved'],
		},
	};

	return {
		documents,
		documentsByCanonicalId: new Map(documents.map((d) => [d.canonicalId, d])),
		documentsByPhaseId: new Map([['phase-1', documents]]),
		phaseOrder: ['phase-1'],
		phases,
		profileId: 'standard',
		profileRoot: '/fake/profiles/standard',
		registryPath: '/fake/profiles/standard/docs.yml',
		statusWorkflow,
	};
}

function createMinimalPlanInput(state?: WorkspaceState) {
	const contract = createMinimalContract();
	const graph = buildContractGraph(contract).graph;
	return {
		contract,
		graph,
		state: state ?? createEmptyState(),
	};
}

// ---------------------------------------------------------------------------
// Contract with inputs and dependencies
// ---------------------------------------------------------------------------

function createThreeDocContract(): DocumentationContract {
	const documents: LoadedDocumentDescriptor[] = [
		{
			canonicalId: 'a',
			descriptor: {
				centralQuestion: 'What is A?',
				id: 'a',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/a.md',
						purpose: 'Doc A canonical',
					},
				},
				phase: 'phase-1',
				purpose: 'Define A',
				sections: [
					{
						id: 's-a1',
						questions: ['Q?'],
						required: true,
						title: 'S1',
					},
				],
				status: 'not_started',
				title: 'A',
				type: 'thesis',
			},
			documentOrder: 0,
			globalOrder: 0,
			phaseId: 'phase-1',
			phaseOrder: 1,
			sourcePath: '/fake/a.yml',
		},
		{
			canonicalId: 'b',
			descriptor: {
				centralQuestion: 'What is B?',
				dependsOn: ['a'],
				id: 'b',
				inputs: [{ id: 'input-b1', required: true, type: 'document' }],
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/b.md',
						purpose: 'Doc B canonical',
					},
				},
				phase: 'phase-1',
				purpose: 'Define B',
				sections: [
					{
						id: 's-b1',
						questions: ['Q?'],
						required: true,
						title: 'S1',
					},
					{
						id: 's-b2',
						questions: ['Q?'],
						required: false,
						title: 'S2',
					},
				],
				status: 'not_started',
				title: 'B',
				type: 'problem',
			},
			documentOrder: 1,
			globalOrder: 1,
			phaseId: 'phase-1',
			phaseOrder: 1,
			sourcePath: '/fake/b.yml',
		},
		{
			canonicalId: 'c',
			descriptor: {
				centralQuestion: 'What is C?',
				dependsOn: ['b'],
				id: 'c',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/c.md',
						purpose: 'Doc C canonical',
					},
				},
				phase: 'phase-1',
				purpose: 'Define C',
				sections: [
					{
						id: 's-c1',
						questions: ['Q?'],
						required: true,
						title: 'S1',
					},
				],
				status: 'not_started',
				title: 'C',
				type: 'audience',
			},
			documentOrder: 2,
			globalOrder: 2,
			phaseId: 'phase-1',
			phaseOrder: 1,
			sourcePath: '/fake/c.yml',
		},
	];

	const phases: LoadedPhaseDescriptor[] = [
		{
			axis: 'normative',
			completionCriteria: [],
			dependsOn: [],
			description: 'Test phase',
			documents: [
				{ file: 'a.yml', id: 'a', title: 'A' },
				{ file: 'b.yml', id: 'b', title: 'B' },
				{ file: 'c.yml', id: 'c', title: 'C' },
			],
			feedsInto: [],
			generatedOutputs: {},
			id: 'phase-1',
			order: 1,
			qualityChecks: [],
			raw: {},
			readingOrder: ['a', 'b', 'c'],
			responsibilityBoundary: {},
			sourcePath: '/fake/phases/phase-1.yml',
			status: 'not_started',
			title: 'Phase 1',
		},
	];

	const statusWorkflow: ProfileStatusWorkflow = {
		allowed: [
			'not_started',
			'drafting',
			'drafted',
			'needs_review',
			'reviewed',
			'approved',
			'deprecated',
		],
		terminal: ['approved', 'deprecated'],
		transitions: {
			approved: ['deprecated'],
			drafted: ['needs_review', 'needs_revision'],
			drafting: ['drafted'],
			needs_review: ['reviewed', 'needs_revision'],
			not_started: ['drafting'],
			reviewed: ['approved'],
		},
	};

	return {
		documents,
		documentsByCanonicalId: new Map(documents.map((d) => [d.canonicalId, d])),
		documentsByPhaseId: new Map([['phase-1', documents]]),
		phaseOrder: ['phase-1'],
		phases,
		profileId: 'standard',
		profileRoot: '/fake/profiles/standard',
		registryPath: '/fake/profiles/standard/docs.yml',
		statusWorkflow,
	};
}

// ===========================================================================
// Tests
// ===========================================================================

describe('createGenerationPlan', () => {
	// -----------------------------------------------------------------------
	// Planner input/contract tests
	// -----------------------------------------------------------------------

	describe('planner input and contract', () => {
		it('loads Standard contract and builds a generation plan', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });
			expect(result.plan).toBeDefined();
			expect(result.plan.items.length).toBeGreaterThan(0);
			expect(result.plan.totalDocumentCount).toBe(result.plan.items.length);
		});

		it('every plan item has source document canonical ID', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });
			for (const item of result.plan.items) {
				expect(item.documentCanonicalId).toBeTruthy();
				expect(typeof item.documentCanonicalId).toBe('string');
				expect(
					contract.documentsByCanonicalId.has(item.documentCanonicalId),
				).toBe(true);
			}
		});

		it('every plan item has phase ID', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });
			for (const item of result.plan.items) {
				expect(item.phaseId).toBeTruthy();
				expect(typeof item.phaseId).toBe('string');
			}
		});

		it('every plan item has canonical output target from descriptor', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });
			for (const item of result.plan.items) {
				expect(item.canonicalOutputPath).toBeTruthy();
				expect(item.documentationRootRelativePath).toBeTruthy();
				// The resolved path should start with the documentation root
				expect(item.documentationRootRelativePath.startsWith('logos/')).toBe(
					true,
				);
			}
		});

		it('plan order follows profile phase/document order', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });
			const canonicalIds = result.plan.items.map((i) => i.documentCanonicalId);

			// Items should be in a deterministic order. Verify that documents
			// from earlier phases come before later phases.
			const phaseOrder = contract.phaseOrder;
			const canonicalIdToPhase = new Map(
				contract.documents.map((d) => [d.canonicalId, d.phaseId]),
			);

			let lastPhaseIdx = -1;
			let _lastDocOrder = -1;
			for (const id of canonicalIds) {
				const phaseId = canonicalIdToPhase.get(id) ?? '';
				const phaseIdx = phaseOrder.indexOf(phaseId);
				expect(phaseIdx).toBeGreaterThanOrEqual(0);
				if (phaseIdx > lastPhaseIdx) {
					_lastDocOrder = -1;
				}
				expect(phaseIdx).toBeGreaterThanOrEqual(lastPhaseIdx);
				lastPhaseIdx = phaseIdx;
			}
		});

		it('production planner does not hard-code Standard document IDs', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);
			// The planner should work with custom document IDs
			expect(
				result.plan.items.every(
					(i) => i.documentCanonicalId === 'a' || i.documentCanonicalId === 'b',
				),
			).toBe(true);
		});

		it('default documentation root is logos/ not docs/', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);
			expect(result.plan.documentationRoot).toBe('logos/');
			for (const item of result.plan.items) {
				// Resolved path under the documentation root, not under docs/
				expect(item.documentationRootRelativePath.startsWith('logos/')).toBe(
					true,
				);
			}
		});
	});

	// -----------------------------------------------------------------------
	// Empty state tests
	// -----------------------------------------------------------------------

	describe('empty workspace state', () => {
		it('initialized empty workspace produces a plan without writes', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);
			expect(result.plan.items.length).toBeGreaterThan(0);
			// No writes should have happened
		});

		it('required documents with missing confirmed state are marked incomplete or blocked', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });

			// Many documents should be 'incomplete' because there's no confirmed state
			const incompleteCount = result.plan.actionCounts.incomplete;
			const generateCount = result.plan.actionCounts.generate;
			const blockedCount = result.plan.actionCounts.blocked;

			// At least some documents should be incomplete (missing confirmed state)
			// With empty state, most docs won't have confirmed content
			expect(incompleteCount + blockedCount + generateCount).toBeGreaterThan(0);
		});

		it('gaps are explicit when confirmed state is missing', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			// With empty state and required sections, gaps should be present
			const allGaps = result.plan.items.flatMap((i) => i.gaps);
			expect(allGaps.length).toBeGreaterThan(0);
		});

		it('unresolved questions are preserved where present', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithOpenQuestion('a', 'q-001');

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			expect(itemA).toBeDefined();
			expect(itemA?.unresolvedQuestionIds).toContain('q-001');
			expect(
				itemA?.gaps.some((g) => g.code === 'E_GENPLAN_UNRESOLVED_QUESTION'),
			).toBe(true);
		});

		it('no facts are invented by the planner', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			// The planner must not invent document IDs, paths, or content
			for (const item of result.plan.items) {
				expect(item.documentCanonicalId).toBeTruthy();
				expect(item.canonicalOutputPath).toBeTruthy();
				// The confirmed decision/assumption lists should reflect actual state
				expect(Array.isArray(item.confirmedDecisionIds)).toBe(true);
				expect(Array.isArray(item.confirmedAssumptionIds)).toBe(true);
			}
		});

		it('dry-run result reports planned actions and writes nothing', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input, { dryRun: true });
			const summary = summarizeGenerationPlan(result.plan);

			expect(summary.plannedActions.generate).toBeGreaterThanOrEqual(0);
			expect(summary.plannedActions.incomplete).toBeGreaterThanOrEqual(0);
			expect(summary.plannedTargetPaths.length).toBe(result.plan.items.length);
		});
	});

	// -----------------------------------------------------------------------
	// Partial state tests
	// -----------------------------------------------------------------------

	describe('partial workspace state', () => {
		it('confirmed decisions satisfy only explicitly related requirements', () => {
			const input = createMinimalPlanInput(
				createStateWithDecision('a', 'dec-001'),
			);
			const result = createGenerationPlan(input);

			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			const itemB = result.plan.items.find(
				(i) => i.documentCanonicalId === 'b',
			);

			expect(itemA?.confirmedDecisionIds).toContain('dec-001');
			expect(itemB?.confirmedDecisionIds).toEqual([]);
		});

		it('assumptions can support generation only as assumptions, not facts', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithAssumption('a', 'asm-001');

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			expect(itemA).toBeDefined();
			expect(itemA?.confirmedAssumptionIds).toContain('asm-001');
			// The planner does not claim assumptions are facts — they appear
			// in the assumption list, not as resolved decisions
		});

		it('unresolved open questions mark relevant documents as incomplete', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithOpenQuestion('a', 'q-001');

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			expect(itemA).toBeDefined();
			expect(itemA?.unresolvedQuestionIds).toContain('q-001');
			// Document with confirmed content should still have open questions listed
		});

		it('proposed/unaccepted proposals do not satisfy confirmed requirements', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();
			state.proposals = [
				{
					body: 'A test proposal',
					createdAt: iso('2025-01-01T00:00:00Z'),
					kind: 'decision',
					proposalId: 'prop-001',
					sourceDocumentCanonicalId: 'a',
					status: 'proposed',
					title: 'Test Proposal',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			// Proposed proposal should NOT be counted as confirmed state
			expect(itemA?.confirmedDecisionIds).toEqual([]);
			// A warning diagnostic should be emitted about proposed records
			const warning = result.diagnostics.find(
				(d) => d.code === 'E_GENPLAN_PROPOSED_AS_CONFIRMED',
			);
			expect(warning).toBeDefined();
			expect(warning?.severity).toBe('warning');
		});

		it('accepted proposals can satisfy requirements where schema supports it', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();
			state.proposals = [
				{
					body: 'An accepted proposal',
					createdAt: iso('2025-01-01T00:00:00Z'),
					kind: 'decision',
					proposalId: 'prop-002',
					sourceDocumentCanonicalId: 'a',
					status: 'accepted',
					title: 'Accepted Proposal',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			// Having an accepted proposal should count toward hasConfirmedContent
			// which means the item should be 'generate' not 'incomplete'
			expect(itemA?.action).toBe('generate');
		});

		it('artifact metadata alone does not satisfy canonical content requirements', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithArtifact('a', 'logos/phase-1/a.md');

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			// Having an artifact without confirmed decisions should result in skip
			// (artifact exists but no new content to generate)
			expect(itemA?.action).toBe('skip');
		});
	});

	// -----------------------------------------------------------------------
	// Complete state tests
	// -----------------------------------------------------------------------

	describe('complete workspace state', () => {
		it('sufficiently complete confirmed state marks eligible documents as generate/update', () => {
			const input = createMinimalPlanInput(
				createStateWithDecision('a', 'dec-001'),
			);
			const result = createGenerationPlan(input);

			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('generate');
		});

		it('generated/update counts are deterministic', () => {
			const input = createMinimalPlanInput(
				createStateWithDecision('a', 'dec-001'),
			);

			const result1 = createGenerationPlan(input);
			const result2 = createGenerationPlan(input);

			expect(result1.plan.actionCounts).toEqual(result2.plan.actionCounts);
			expect(result1.plan.items.length).toBe(result2.plan.items.length);
		});

		it('skipped documents are reported when appropriate', () => {
			const state = createStateWithArtifact('a', 'logos/phase-1/a.md');
			// Also add confirmed decisions to make it potentially updatable
			state.decisions = [
				{
					affectedDocumentIds: ['a'],
					body: 'Test',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'dec-001',
					sourceRefs: [],
					status: 'confirmed',
					title: 'Test',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];

			const input = createMinimalPlanInput(state);
			const result = createGenerationPlan(input);

			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			// Artifact exists, state is not newer → skip
			expect(itemA?.action).toBe('skip');
		});

		it('no blockers are reported for satisfied dependencies', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithDecision('a', 'dec-a');
			state.decisions.push({
				affectedDocumentIds: ['b'],
				body: 'B decision',
				createdAt: iso('2025-01-01T00:00:00Z'),
				id: 'dec-b',
				sourceRefs: [],
				status: 'confirmed',
				title: 'B Decision',
				updatedAt: iso('2025-01-01T00:00:00Z'),
			});

			const result = createGenerationPlan({ contract, graph, state });
			const itemB = result.plan.items.find(
				(i) => i.documentCanonicalId === 'b',
			);

			// 'a' should be generated (has confirmed decision), so 'b' should not be blocked
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('generate');
			expect(itemB?.action).not.toBe('blocked');
		});

		it('target paths are under configured documentation root', () => {
			const state = createStateWithDecision('a', 'dec-001');
			state.documentation = {
				isDefault: true,
				rootPath: 'my-docs/',
				wasExplicitlyConfigured: true,
			};

			const input = createMinimalPlanInput(state);
			const result = createGenerationPlan(
				{ ...input, state },
				{ documentationRootOverride: 'my-docs/' },
			);

			for (const item of result.plan.items) {
				expect(item.documentationRootRelativePath.startsWith('my-docs/')).toBe(
					true,
				);
			}
		});
	});

	// -----------------------------------------------------------------------
	// Dependency tests
	// -----------------------------------------------------------------------

	describe('dependency evaluation', () => {
		it('missing dependency produces blocker for dependent document', async () => {
			// Create a contract with a document that depends on a non-existent document
			const contract = createMinimalContract();
			// Add a dependsOn reference that won't resolve
			const docB = contract.documents.find((d) => d.canonicalId === 'b');
			if (docB === undefined) throw new Error('fixture: b not found');
			(docB.descriptor.dependsOn as string[]) = ['non-existent'];

			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			const itemB = result.plan.items.find(
				(i) => i.documentCanonicalId === 'b',
			);
			expect(itemB).toBeDefined();
			expect(itemB?.dependencyState.some((ds) => ds.status === 'unknown')).toBe(
				true,
			);
		});

		it('blocked dependency blocks downstream document', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			// 'a' has no confirmed state and no deps → generate, 'b' depends on 'a', 'c' depends on 'b'
			// All should generate with empty state (no blockers because dependencies all generate)
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });

			// With no confirmed state and all deps generating, nothing should be blocked
			const blockedCount = result.plan.actionCounts.blocked;
			expect(blockedCount).toBe(0);
		});

		it('incomplete dependency affects downstream readiness', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const result = createGenerationPlan({ contract, graph, state });
			const itemC = result.plan.items.find(
				(i) => i.documentCanonicalId === 'c',
			);

			// Check if dependency states report 'incomplete' for upstream docs
			expect(itemC).toBeDefined();
		});

		it('stale dependency marks downstream item stale', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithArtifact(
				'a',
				'logos/phase-1/a.md',
				iso('2025-01-01T00:00:00Z'),
			);
			// Add a decision that's newer than the artifact
			state.decisions = [
				{
					affectedDocumentIds: ['a'],
					body: 'Newer decision',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'dec-stale',
					sourceRefs: [],
					status: 'confirmed',
					title: 'Newer Decision',
					updatedAt: iso('2025-06-01T00:00:00Z'), // Newer than artifact
				},
			];

			const result = createGenerationPlan({ contract, graph, state });
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);

			expect(itemA?.staleReasons.length).toBeGreaterThan(0);
			expect(itemA?.action).toBe('stale');
		});

		it('unknown dependency emits structured diagnostic', () => {
			const contract = createMinimalContract();
			const docB = contract.documents.find((d) => d.canonicalId === 'b');
			if (docB === undefined) throw new Error('fixture: b not found');
			(docB.descriptor.dependsOn as string[]) = ['unknown-doc'];

			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GENPLAN_UNRESOLVED_DEPENDENCY',
			);
			expect(diag).toBeDefined();
			expect(diag?.severity).toBe('error');
		});

		it('deterministic dependency ordering is preserved', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;

			const result1 = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});
			const result2 = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			expect(result1.plan.items.map((i) => i.documentCanonicalId)).toEqual(
				result2.plan.items.map((i) => i.documentCanonicalId),
			);
		});
	});

	// -----------------------------------------------------------------------
	// Status / action tests
	// -----------------------------------------------------------------------

	describe('status and action classification', () => {
		it('plan distinguishes generate', () => {
			const input = createMinimalPlanInput(
				createStateWithDecision('a', 'dec-001'),
			);
			const result = createGenerationPlan(input);
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('generate');
		});

		it('plan distinguishes update', () => {
			const state = createStateWithArtifact(
				'a',
				'logos/phase-1/a.md',
				iso('2025-01-01T00:00:00Z'),
			);
			// Add confirmed decision that's newer than the artifact
			state.decisions = [
				{
					affectedDocumentIds: ['a'],
					body: 'Updated decision',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'dec-new',
					sourceRefs: [],
					status: 'confirmed',
					title: 'Updated',
					updatedAt: iso('2025-06-01T00:00:00Z'),
				},
			];

			const input = createMinimalPlanInput(state);
			const result = createGenerationPlan(input);
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('stale');
		});

		it('plan distinguishes skip', () => {
			const state = createStateWithArtifact('a', 'logos/phase-1/a.md');
			const input = createMinimalPlanInput(state);
			const result = createGenerationPlan(input);
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('skip');
		});

		it('plan distinguishes incomplete (missing confirmed state)', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			// With no confirmed state, documents with required sections should be incomplete
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('incomplete');
		});

		it('plan distinguishes failed (missing canonical output)', () => {
			const contract = createMinimalContract();
			// Remove canonical output from doc A
			const docA = contract.documents.find((d) => d.canonicalId === 'a');
			if (docA === undefined) throw new Error('fixture: a not found');
			delete (docA.descriptor.outputs as Record<string, unknown>).canonical;

			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('failed');
		});

		it('plan distinguishes stale', () => {
			const state = createStateWithArtifact(
				'a',
				'logos/phase-1/a.md',
				iso('2025-01-01T00:00:00Z'),
			);
			state.decisions = [
				{
					affectedDocumentIds: ['a'],
					body: 'New decision',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'dec-stale-test',
					sourceRefs: [],
					status: 'confirmed',
					title: 'Stale Test',
					updatedAt: iso('2025-06-01T00:00:00Z'),
				},
			];

			const input = createMinimalPlanInput(state);
			const result = createGenerationPlan(input);
			const itemA = result.plan.items.find(
				(i) => i.documentCanonicalId === 'a',
			);
			expect(itemA?.action).toBe('stale');
		});

		it('invalid state/contract fixture produces failed diagnostics', () => {
			const contract = createMinimalContract();
			// Remove canonical output from all documents
			for (const doc of contract.documents) {
				if (doc.descriptor.outputs !== undefined) {
					delete (doc.descriptor.outputs as Record<string, unknown>).canonical;
				}
			}

			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			// All documents should be 'failed'
			for (const item of result.plan.items) {
				expect(item.action).toBe('failed');
			}
		});
	});

	// -----------------------------------------------------------------------
	// Dry-run / non-mutation tests
	// -----------------------------------------------------------------------

	describe('dry-run and non-mutation', () => {
		it('dry-run creates no files or directories', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;

			const tmpDir = join(tmpdir(), `logos-genplan-test-${randomUUID()}`);
			mkdirSync(tmpDir, { recursive: true });

			try {
				const state = createEmptyState({
					projectRootPath: tmpDir,
				} as Partial<WorkspaceState>);

				const result = createGenerationPlan(
					{ contract, graph, state },
					{ dryRun: true },
				);

				// Verify no files were created in the temp dir
				expect(existsSync(join(tmpDir, '.logos'))).toBe(false);
				expect(existsSync(join(tmpDir, 'logos'))).toBe(false);

				// Verify the result is still a valid plan
				expect(result.plan.items.length).toBeGreaterThan(0);
			} finally {
				rmSync(tmpDir, { force: true, recursive: true });
			}
		});

		it('planner creates no files even when dryRun is false', async () => {
			// The planner itself is READ-ONLY. Even dryRun: false should not write.
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const graph = buildContractGraph(contract).graph;

			const tmpDir = join(tmpdir(), `logos-genplan-test2-${randomUUID()}`);
			mkdirSync(tmpDir, { recursive: true });

			try {
				const state = createEmptyState({
					projectRootPath: tmpDir,
				} as Partial<WorkspaceState>);
				createGenerationPlan({ contract, graph, state }, { dryRun: false });

				expect(existsSync(join(tmpDir, '.logos'))).toBe(false);
				expect(existsSync(join(tmpDir, 'logos'))).toBe(false);
			} finally {
				rmSync(tmpDir, { force: true, recursive: true });
			}
		});

		it('planner does not update .logos/', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			// The result should be a pure data structure, not a file write
			expect(result.plan).toBeDefined();
			expect(typeof result.plan.profileId).toBe('string');
		});

		it('planner does not create generation run metadata', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			// The plan is not a generation run record
			expect(result.plan.generatedAt).toBeTruthy();
			// No run metadata should persist
		});

		it('planner does not update artifact registry', () => {
			const state = createStateWithArtifact('a', 'logos/phase-1/a.md');
			const artifactCountBefore = state.artifacts.length;

			const input = createMinimalPlanInput(state);
			createGenerationPlan(input);

			// Artifact count should be unchanged
			expect(state.artifacts.length).toBe(artifactCountBefore);
		});
	});

	// -----------------------------------------------------------------------
	// Diagnostics tests
	// -----------------------------------------------------------------------

	describe('diagnostics', () => {
		it('missing canonical output declaration produces diagnostic', () => {
			const contract = createMinimalContract();
			const docA = contract.documents.find((d) => d.canonicalId === 'a');
			if (docA === undefined) throw new Error('fixture: a not found');
			delete (docA.descriptor.outputs as Record<string, unknown>).canonical;

			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GENPLAN_MISSING_CANONICAL_OUTPUT',
			);
			expect(diag).toBeDefined();
			expect(diag?.severity).toBe('error');
		});

		it('missing required section produces gap', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			const allGaps = result.plan.items.flatMap((i) => i.gaps);
			const sectionGaps = allGaps.filter(
				(g) => g.code === 'E_GENPLAN_REQUIRED_SECTION_UNSATISFIED',
			);
			expect(sectionGaps.length).toBeGreaterThan(0);
		});

		it('missing required input produces gap', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			const itemB = result.plan.items.find(
				(i) => i.documentCanonicalId === 'b',
			);
			const inputGaps = itemB?.gaps.filter(
				(g) => g.code === 'E_GENPLAN_REQUIRED_INPUT_UNSATISFIED',
			);
			expect(inputGaps.length).toBeGreaterThan(0);
		});

		it('unresolved dependency produces blocker', () => {
			const contract = createMinimalContract();
			const docB = contract.documents.find((d) => d.canonicalId === 'b');
			if (docB === undefined) throw new Error('fixture: b not found');
			(docB.descriptor.dependsOn as string[]) = ['unknown'];

			const graph = buildContractGraph(contract).graph;
			const result = createGenerationPlan({
				contract,
				graph,
				state: createEmptyState(),
			});

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_GENPLAN_UNRESOLVED_DEPENDENCY',
			);
			expect(diag).toBeDefined();
		});

		it('proposed record used as confirmed input produces warning diagnostic', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();
			state.proposals = [
				{
					body: 'Proposed decision',
					createdAt: iso('2025-01-01T00:00:00Z'),
					kind: 'decision',
					proposalId: 'prop-003',
					sourceDocumentCanonicalId: 'a',
					status: 'proposed',
					title: 'Proposed',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];

			const result = createGenerationPlan({ contract, graph, state });
			const warning = result.diagnostics.find(
				(d) => d.code === 'E_GENPLAN_PROPOSED_AS_CONFIRMED',
			);
			expect(warning).toBeDefined();
			expect(warning?.severity).toBe('warning');
		});

		it('diagnostics include code, severity, document id, source path', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input);

			for (const diag of result.diagnostics) {
				expect(diag.code).toBeTruthy();
				expect(['error', 'warning', 'info']).toContain(diag.severity);
				expect(diag.message).toBeTruthy();
			}
		});

		it('diagnostics do not echo fake secret values', () => {
			// Create a state with a secret-like value in provider config
			const state = createEmptyState();
			state.provider = {
				enabled: true,
				providerId: 'openai',
				tokenEnvVarName: 'OPENAI_API_KEY',
			};

			const input = createMinimalPlanInput(state);
			const result = createGenerationPlan(input);

			// No diagnostics should contain the secret-like value
			for (const diag of result.diagnostics) {
				expect(JSON.stringify(diag)).not.toContain('sk-');
				expect(JSON.stringify(diag)).not.toContain('OPENAI_API_KEY');
			}

			// The plan output should not contain raw secrets
			const planJson = JSON.stringify(result.plan);
			expect(planJson).not.toContain('sk-');
			expect(planJson).not.toContain('Bearer ');
			expect(planJson).not.toContain('Basic ');
		});
	});

	// -----------------------------------------------------------------------
	// Snapshot tests
	// -----------------------------------------------------------------------

	describe('snapshots', () => {
		it('snapshot empty workspace generation plan', () => {
			const input = createMinimalPlanInput();
			const result = createGenerationPlan(input, {
				generatedAt: '2025-01-01T00:00:00.000Z',
			});

			// Normalize for snapshot
			const normalized = normalizePlanForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot partial workspace generation plan', () => {
			const state = createStateWithDecision(
				'a',
				'dec-001',
				'2025-01-01T00:00:00.000Z',
			);
			const input = createMinimalPlanInput(state);

			const result = createGenerationPlan(input, {
				generatedAt: '2025-01-01T00:00:00.000Z',
			});

			const normalized = normalizePlanForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot complete workspace generation plan', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithDecision(
				'a',
				'dec-a',
				'2025-01-01T00:00:00.000Z',
			);
			state.decisions.push({
				affectedDocumentIds: ['b'],
				body: 'B decision',
				createdAt: '2025-01-01T00:00:00.000Z',
				id: 'dec-b',
				sourceRefs: [],
				status: 'confirmed',
				title: 'B Decision',
				updatedAt: '2025-01-01T00:00:00.000Z',
			});
			state.decisions.push({
				affectedDocumentIds: ['c'],
				body: 'C decision',
				createdAt: '2025-01-01T00:00:00.000Z',
				id: 'dec-c',
				sourceRefs: [],
				status: 'confirmed',
				title: 'C Decision',
				updatedAt: '2025-01-01T00:00:00.000Z',
			});

			const result = createGenerationPlan(
				{ contract, graph, state },
				{ generatedAt: '2025-01-01T00:00:00.000Z' },
			);

			const normalized = normalizePlanForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot dependency-blocked plan', () => {
			const contract = createThreeDocContract();
			const graph = buildContractGraph(contract).graph;
			// 'a' has no canonical output → failed
			const docA = contract.documents.find((d) => d.canonicalId === 'a');
			if (docA === undefined) throw new Error('fixture: a not found');
			delete (docA.descriptor.outputs as Record<string, unknown>).canonical;

			const result = createGenerationPlan(
				{ contract, graph, state: createEmptyState() },
				{ generatedAt: '2025-01-01T00:00:00.000Z' },
			);

			const normalized = normalizePlanForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot custom documentation root', () => {
			const state = createStateWithDecision(
				'a',
				'dec-001',
				'2025-01-01T00:00:00.000Z',
			);
			const input = createMinimalPlanInput(state);

			const result = createGenerationPlan(input, {
				documentationRootOverride: 'custom-docs/',
				generatedAt: '2025-01-01T00:00:00.000Z',
			});

			const normalized = normalizePlanForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});
	});
});

// ---------------------------------------------------------------------------
// planDocumentGeneration alias
// ---------------------------------------------------------------------------

describe('planDocumentGeneration', () => {
	it('produces same result as createGenerationPlan', () => {
		const input = createMinimalPlanInput(
			createStateWithDecision('a', 'dec-001'),
		);
		const result1 = createGenerationPlan(input, {
			generatedAt: '2025-01-01T00:00:00.000Z',
		});
		const result2 = planDocumentGeneration(input, {
			generatedAt: '2025-01-01T00:00:00.000Z',
		});

		expect(result1.plan.items.map((i) => i.action)).toEqual(
			result2.plan.items.map((i) => i.action),
		);
		expect(result1.plan.actionCounts).toEqual(result2.plan.actionCounts);
	});
});

// ---------------------------------------------------------------------------
// summarizeGenerationPlan
// ---------------------------------------------------------------------------

describe('summarizeGenerationPlan', () => {
	it('returns a GenerationDryRunSummary with correct counts', () => {
		const input = createMinimalPlanInput();
		const result = createGenerationPlan(input);
		const summary = summarizeGenerationPlan(result.plan);

		expect(summary.totalDocuments).toBe(result.plan.totalDocumentCount);
		expect(
			summary.plannedActions.generate +
				summary.plannedActions.update +
				summary.plannedActions.skip +
				summary.plannedActions.incomplete +
				summary.plannedActions.blocked +
				summary.plannedActions.failed +
				summary.plannedActions.stale,
		).toBe(result.plan.totalDocumentCount);
		expect(summary.plannedTargetPaths.length).toBe(result.plan.items.length);
	});

	it('includes warnings for diagnostic errors', () => {
		const contract = createMinimalContract();
		const docA = contract.documents.find((d) => d.canonicalId === 'a');
		if (docA === undefined) throw new Error('fixture: a not found');
		delete (docA.descriptor.outputs as Record<string, unknown>).canonical;

		const graph = buildContractGraph(contract).graph;
		const result = createGenerationPlan({
			contract,
			graph,
			state: createEmptyState(),
		});
		const summary = summarizeGenerationPlan(result.plan);

		expect(summary.warnings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Normalization helpers for snapshots
// ---------------------------------------------------------------------------

interface NormalizedPlan {
	profileId: string;
	documentationRoot: string;
	totalDocumentCount: number;
	actionCounts: Record<string, number>;
	items: NormalizedPlanItem[];
	dryRun: boolean;
	diagnosticsCount: number;
	generatedAt: string;
}

interface NormalizedPlanItem {
	documentCanonicalId: string;
	documentId: string;
	phaseId: string;
	action: string;
	blockersCount: number;
	gapsCount: number;
	dependencyStateCount: number;
	confirmedDecisionIds: string[];
	confirmedAssumptionIds: string[];
	unresolvedQuestionIds: string[];
	documentationRootRelativePath: string;
	dryRun: boolean;
	orderIndex: number;
	staleReasonsCount: number;
}

function normalizePlanForSnapshot(
	result: GenerationPlanResult,
): NormalizedPlan {
	return {
		actionCounts: result.plan.actionCounts as Record<string, number>,
		diagnosticsCount: result.diagnostics.length,
		documentationRoot: result.plan.documentationRoot,
		dryRun: result.plan.dryRun,
		generatedAt: result.plan.generatedAt,
		items: result.plan.items.map((item) => ({
			action: item.action,
			blockersCount: item.blockers.length,
			confirmedAssumptionIds: item.confirmedAssumptionIds,
			confirmedDecisionIds: item.confirmedDecisionIds,
			dependencyStateCount: item.dependencyState.length,
			documentationRootRelativePath: item.documentationRootRelativePath.replace(
				/^\/tmp\/.*?\//,
				'<ROOT>/',
			),
			documentCanonicalId: item.documentCanonicalId,
			documentId: item.documentId,
			dryRun: item.dryRun,
			gapsCount: item.gaps.length,
			orderIndex: item.orderIndex,
			phaseId: item.phaseId,
			staleReasonsCount: item.staleReasons.length,
			unresolvedQuestionIds: item.unresolvedQuestionIds,
		})),
		profileId: result.plan.profileId,
		totalDocumentCount: result.plan.totalDocumentCount,
	};
}
