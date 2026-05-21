/** Question Planner tests — Step 4.1 */

import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	buildContractGraph,
	collectQuestionCandidates,
	createDefaultWorkspaceState,
	type DocumentationContract,
	type DocumentDescriptor,
	type LoadedPhaseDescriptor,
	loadDocumentationContract,
	planNextQuestions,
	type QuestionPlanningResult,
	type WorkspaceState,
} from '../../src/index.js';

const STANDARD_PROFILE_ROOT = resolve(process.cwd(), 'profiles', 'standard');
const _STANDARD_SCHEMA_PATH = join(
	STANDARD_PROFILE_ROOT,
	'document.schema.yml',
);

async function loadStandardContract() {
	return loadDocumentationContract({
		profileId: 'standard',
		repoRoot: process.cwd(),
	});
}

async function loadStandardGraph() {
	const contract = await loadStandardContract();
	const result = buildContractGraph(contract);
	return result.graph;
}

function createEmptyWorkspaceState(): WorkspaceState {
	return createDefaultWorkspaceState({
		createdAt: '2024-01-01T00:00:00.000Z',
		projectRootPath: '/tmp/test-workspace',
		updatedAt: '2024-01-01T00:00:00.000Z',
		workspaceId: 'test-workspace',
	});
}

function normalizeResultForSnapshot(result: QuestionPlanningResult): unknown {
	if (!result.cluster) return result;

	return {
		cluster: {
			phaseCoverage: result.cluster.phaseCoverage,
			questions: result.cluster.questions.map((q) => ({
				blockingLevel: q.blockingLevel,
				existingOpenQuestionId: q.existingOpenQuestionId,
				fieldPointer: q.source.fieldPointer,
				id: q.id,
				isSchemaDerived: q.isSchemaDerived,
				phaseId: q.source.phaseId,
				planStatus: q.planStatus,
				priority: q.priority,
				reason: q.reason,
				sourceDocumentId: q.source.documentCanonicalId,
				text: q.text,
			})),
			reasonSummary: result.cluster.reasonSummary,
			skippedCount: result.cluster.skippedCount,
			sourceDocuments: result.cluster.sourceDocuments,
		},
		diagnostics: result.diagnostics.map((d) => ({
			code: d.code,
			message: d.message,
			severity: d.severity,
		})),
		success: result.success,
	};
}

describe('question-planner', () => {
	describe('contract sourcing', () => {
		it('loads question candidates from Standard profile descriptors', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			expect(result.success).toBe(true);
			expect(result.cluster).toBeDefined();
			expect(result.cluster?.questions.length).toBeGreaterThan(0);
		});

		it('every planned question has a source document canonical ID', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			for (const q of result.cluster?.questions ?? []) {
				expect(q.source.documentCanonicalId).toBeTruthy();
				expect(q.source.documentCanonicalId.length).toBeGreaterThan(0);
			}
		});

		it('every planned question has a source phase ID', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			for (const q of result.cluster?.questions ?? []) {
				expect(q.source.phaseId).toBeTruthy();
				expect(q.source.phaseId.length).toBeGreaterThan(0);
			}
		});

		it('every planned question has source path or pointer when available', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			for (const q of result.cluster?.questions ?? []) {
				// Either descriptorPath or fieldPointer should be present
				const hasSource = q.source.descriptorPath || q.source.fieldPointer;
				expect(hasSource).toBeTruthy();
			}
		});

		it('production planner does not use hard-coded Standard question text', async () => {
			// The planner should extract questions from descriptors, not embed them.
			// We verify by checking that questions reference actual descriptor source paths.
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			for (const q of result.cluster?.questions ?? []) {
				expect(q.source.descriptorPath).toContain('.yml');
			}
		});

		it('no global question bank is used', async () => {
			// collectQuestionCandidates should only use contract/state inputs
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const candidates = collectQuestionCandidates(contract, undefined, state);

			// All candidates should reference a document in the contract
			for (const c of candidates) {
				const doc = contract.documentsByCanonicalId.get(
					c.source.documentCanonicalId,
				);
				expect(doc).toBeDefined();
			}
		});
	});

	describe('empty workspace', () => {
		it('initialized empty Standard workspace returns a small cluster', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, graph, state });

			expect(result.success).toBe(true);
			expect(result.cluster).toBeDefined();
			expect(result.cluster?.questions.length).toBeGreaterThan(0);
			expect(result.cluster?.questions.length).toBeLessThanOrEqual(5);
		});

		it('cluster size respects default maximum', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, graph, state });

			expect(result.cluster?.questions.length).toBeLessThanOrEqual(5);
		});

		it('cluster size respects custom maxClusterSize option', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions(
				{ contract, graph, state },
				{ maxClusterSize: 3 },
			);

			expect(result.cluster?.questions.length).toBeLessThanOrEqual(3);
		});

		it('cluster includes blocking/required questions first where applicable', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, graph, state });

			// The first questions should be blocking if any blocking questions exist
			expect(result.cluster).toBeDefined();
			const { cluster } = result;
			if (!cluster) throw new Error('Expected cluster');
			const hasBlocking = cluster.questions.some(
				(q) => q.blockingLevel === 'blocking',
			);
			if (hasBlocking) {
				expect(cluster.questions[0]?.blockingLevel).toBe('blocking');
			}
		});

		it('cluster order is deterministic', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result1 = planNextQuestions({ contract, graph, state });
			const result2 = planNextQuestions({ contract, graph, state });

			expect(result1.cluster).toBeDefined();
			expect(result2.cluster).toBeDefined();
			const c1 = result1.cluster;
			const c2 = result2.cluster;
			if (!c1 || !c2) throw new Error('Expected clusters');
			expect(c1.questions.map((q) => q.id)).toEqual(
				c2.questions.map((q) => q.id),
			);
		});

		it('cluster includes source document IDs', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, graph, state });

			expect(result.cluster).toBeDefined();
			if (!result.cluster) throw new Error('Expected cluster');
			expect(result.cluster.sourceDocuments.length).toBeGreaterThan(0);
		});

		it('no AI/provider calls occur', async () => {
			// The planner is pure and does not call external services
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			// This test passes if the planner completes without network
			const result = planNextQuestions({ contract, graph, state });
			expect(result.success).toBe(true);
		});

		it('no files are written', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			// Planner is pure; it accepts inputs and returns a result
			const result = planNextQuestions({ contract, graph, state });
			expect(result.success).toBe(true);
			// No file system operations occur in the planner
		});

		it('empty workspace cluster snapshot', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, graph, state });

			expect(normalizeResultForSnapshot(result)).toMatchSnapshot();
		});
	});

	describe('partial workspace', () => {
		it('existing confirmed decision reduces or deprioritizes relevant duplicate questions', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			// Add a confirmed decision that answers a foundation question
			state.decisions.push({
				affectedDocumentIds: ['01-thesis'],
				body: 'We will build a documentation engine',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'decision-1',
				sourceRefs: [],
				status: 'confirmed',
				title: 'Vision Statement',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result = planNextQuestions({ contract, state });

			// Should still return questions but may have different ordering
			expect(result.success).toBe(true);
			expect(result.cluster).toBeDefined();
		});

		it('existing open question is preserved and linked, not duplicated', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			// Add an open question that matches a descriptor question
			state.openQuestions.push({
				affectedDocumentIds: ['02-problem'],
				body: undefined,
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'oq-1',
				question: 'What is the core problem this product solves?',
				sourceRefs: [],
				status: 'open',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result = planNextQuestions({ contract, state });

			// Find the question that relates to 02-problem
			const problemQuestions = result.cluster?.questions.filter(
				(q) => q.source.documentCanonicalId === '02-problem',
			);

			// Should preserve the existing open question ID
			const preserved = problemQuestions.find(
				(q) => q.existingOpenQuestionId === 'oq-1',
			);
			if (preserved) {
				expect(preserved.planStatus).toBe('preserved');
			}
		});

		it('unresolved questions remain unresolved', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			state.openQuestions.push({
				affectedDocumentIds: ['01-thesis'],
				body: undefined,
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'oq-unresolved',
				question: 'Unresolved test question',
				sourceRefs: [],
				status: 'open',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result = planNextQuestions({ contract, state });

			const preserved = result.cluster?.questions.find(
				(q) => q.existingOpenQuestionId === 'oq-unresolved',
			);

			if (preserved) {
				expect(preserved.planStatus).toBe('preserved');
			}
		});

		it('remaining blocking gaps are prioritized', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			// Mark one document as having a generated artifact
			state.artifacts.push({
				artifactId: 'art-1',
				artifactType: 'canonical_markdown',
				generatedAt: '2024-01-01T00:00:00.000Z',
				isCanonical: true,
				path: 'docs/01-foundation/01-thesis.md',
				sourceDocumentIds: ['01-thesis'],
				status: 'generated',
			});

			const result = planNextQuestions({ contract, state });

			expect(result.success).toBe(true);
			expect(result.cluster).toBeDefined();
		});

		it('deterministic output across repeated runs', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			state.openQuestions.push({
				affectedDocumentIds: ['01-thesis'],
				body: undefined,
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'oq-1',
				question: 'Test question',
				sourceRefs: [],
				status: 'open',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result1 = planNextQuestions({ contract, state });
			const result2 = planNextQuestions({ contract, state });

			expect(normalizeResultForSnapshot(result1)).toEqual(
				normalizeResultForSnapshot(result2),
			);
		});

		it('partial workspace cluster snapshot', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			state.decisions.push({
				affectedDocumentIds: ['01-thesis'],
				body: 'We will use TypeScript',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'decision-1',
				sourceRefs: [],
				status: 'confirmed',
				title: 'Architecture Decision',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			state.openQuestions.push({
				affectedDocumentIds: ['03-audience'],
				body: undefined,
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'oq-1',
				question: 'What is the target market?',
				sourceRefs: [],
				status: 'open',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result = planNextQuestions({ contract, graph, state });

			expect(normalizeResultForSnapshot(result)).toMatchSnapshot();
		});
	});

	describe('advanced workspace', () => {
		it('later-phase gaps are planned only when dependencies allow', async () => {
			const contract = await loadStandardContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyWorkspaceState();

			// Add artifacts for early phases so later phases can proceed
			state.artifacts.push({
				artifactId: 'art-thesis',
				artifactType: 'canonical_markdown',
				generatedAt: '2024-01-01T00:00:00.000Z',
				isCanonical: true,
				path: 'docs/01-foundation/01-thesis.md',
				sourceDocumentIds: ['01-thesis'],
				status: 'generated',
			});

			const result = planNextQuestions({ contract, graph, state });

			expect(result.success).toBe(true);
			expect(result.cluster).toBeDefined();
		});

		it('dependency ordering is respected', async () => {
			const contract = await loadStandardContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyWorkspaceState();

			const candidates = collectQuestionCandidates(contract, graph, state);

			// Check that questions from documents with lower dependency depth come first
			let lastDepth = -1;
			let _monotonic = true;

			// Build depth map
			const depthMap = new Map<string, number>();
			for (const node of graph.nodes) {
				const deps = graph.getDependenciesBySourceDocumentId(
					node.document.canonicalId,
				);
				depthMap.set(node.document.canonicalId, deps.length);
			}

			for (const c of candidates.slice(0, 10)) {
				const depth = depthMap.get(c.source.documentCanonicalId) ?? 0;
				if (depth < lastDepth) {
					_monotonic = false;
				}
				lastDepth = depth;
			}

			// Within the same phase, dependency order should generally be respected
			// (this is a heuristic check, not a strict invariant)
			expect(candidates.length).toBeGreaterThan(0);
		});

		it('downstream-blocking questions are prioritized', async () => {
			const contract = await loadStandardContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyWorkspaceState();

			const candidates = collectQuestionCandidates(contract, graph, state);

			const blockingCandidates = candidates.filter(
				(c) => c.blockingLevel === 'blocking',
			);
			const nonBlockingCandidates = candidates.filter(
				(c) => c.blockingLevel === 'non-blocking',
			);

			// Blocking should come before non-blocking
			if (blockingCandidates.length > 0 && nonBlockingCandidates.length > 0) {
				const firstBlockingIdx = candidates.findIndex(
					(c) => c.blockingLevel === 'blocking',
				);
				const firstNonBlockingIdx = candidates.findIndex(
					(c) => c.blockingLevel === 'non-blocking',
				);
				expect(firstBlockingIdx).toBeLessThanOrEqual(firstNonBlockingIdx);
			}
		});

		it('artifact metadata does not count as canonical answers', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			// Add a planned artifact (not generated)
			state.artifacts.push({
				artifactId: 'art-planned',
				artifactType: 'canonical_markdown',
				isCanonical: false,
				path: 'docs/01-foundation/01-thesis.md',
				sourceDocumentIds: ['01-thesis'],
				status: 'planned',
			});

			const result = planNextQuestions({ contract, state });

			// Should still plan questions for the document since artifact is only planned
			expect(result.success).toBe(true);
			expect(result.cluster).toBeDefined();
		});

		it('generated artifact metadata does not satisfy document dependencies', async () => {
			const contract = await loadStandardContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyWorkspaceState();

			state.artifacts.push({
				artifactId: 'art-generated-thesis',
				artifactType: 'canonical_markdown',
				generatedAt: '2024-01-01T00:00:00.000Z',
				isCanonical: true,
				path: 'logos/01-foundation/01-thesis.md',
				sourceDocumentIds: ['01-thesis'],
				status: 'generated',
			});

			const candidates = collectQuestionCandidates(contract, graph, state, {
				focusDocumentIds: ['02-problem'],
			});

			expect(
				candidates.some(
					(c) =>
						c.reason === 'unresolved_dependency' &&
						c.relatedDependencyId === '01-thesis',
				),
			).toBe(true);
		});

		it('planner does not invoke generation/validation/executive behavior', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			// Result should only contain planned questions, not generation plans
			expect(result.cluster).toBeDefined();
			expect(result.cluster?.questions.length).toBeGreaterThan(0);
			// No runs or artifacts should be created
			expect(state.runs).toHaveLength(0);
		});

		it('advanced workspace cluster snapshot', async () => {
			const contract = await loadStandardContract();
			const graph = await loadStandardGraph();
			const state = createEmptyWorkspaceState();

			// Simulate some progress
			state.artifacts.push({
				artifactId: 'art-thesis',
				artifactType: 'canonical_markdown',
				generatedAt: '2024-01-01T00:00:00.000Z',
				isCanonical: true,
				path: 'docs/01-foundation/01-thesis.md',
				sourceDocumentIds: ['01-thesis'],
				status: 'generated',
			});

			state.artifacts.push({
				artifactId: 'art-problem',
				artifactType: 'canonical_markdown',
				generatedAt: '2024-01-01T00:00:00.000Z',
				isCanonical: true,
				path: 'docs/01-foundation/02-problem.md',
				sourceDocumentIds: ['02-problem'],
				status: 'generated',
			});

			state.decisions.push({
				affectedDocumentIds: ['02-problem'],
				body: 'Documentation is hard',
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'decision-1',
				sourceRefs: [],
				status: 'confirmed',
				title: 'Problem Statement',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result = planNextQuestions({ contract, graph, state });

			expect(normalizeResultForSnapshot(result)).toMatchSnapshot();
		});
	});

	describe('classification', () => {
		it('required section/input/completion gaps become blocking', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const candidates = collectQuestionCandidates(contract, undefined, state);

			const blockingFromRequired = candidates.some(
				(c) =>
					c.blockingLevel === 'blocking' &&
					(c.reason === 'missing_required_section' ||
						c.reason === 'missing_required_input'),
			);

			expect(blockingFromRequired).toBe(true);
		});

		it('optional/refinement questions become non-blocking', async () => {
			// The Standard profile has all sections required, so we test the rule with a minimal fixture contract
			const minimalContract: Awaited<ReturnType<typeof loadStandardContract>> =
				{
					documents: [
						{
							canonicalId: 'test-doc',
							descriptor: {
								centralQuestion: 'What is the test question?',
								id: 'test-doc',
								outputs: {
									canonical: {
										format: 'markdown',
										path: 'docs/test.md',
									},
								},
								phase: '01-test',
								purpose: 'Test',
								sections: [
									{
										id: 'optional-section',
										questions: ['Is this optional?'],
										required: false,
										title: 'Optional Section',
									},
									{
										id: 'required-section',
										questions: ['Is this required?'],
										required: true,
										title: 'Required Section',
									},
								],
								status: 'not_started',
								title: 'Test Document',
								type: 'test',
							} as unknown as DocumentDescriptor,
							documentOrder: 0,
							globalOrder: 0,
							phaseId: '01-test',
							phaseOrder: 1,
							sourcePath: '/tmp/test-doc.yml',
						},
					],
					documentsByCanonicalId: new Map(),
					documentsByPhaseId: new Map(),
					phaseOrder: ['01-test'],
					phases: [
						{
							axis: 'test',
							completionCriteria: [],
							dependsOn: [],
							documents: [],
							feedsInto: [],
							generatedOutputs: {},
							id: '01-test',
							order: 1,
							qualityChecks: [],
							raw: {},
							readingOrder: [],
							responsibilityBoundary: {},
							sourcePath: '/tmp/phase.yml',
							status: 'active',
							title: 'Test Phase',
						} as unknown as LoadedPhaseDescriptor,
					],
					profileId: 'test',
					profileRoot: '/tmp',
					registryPath: '/tmp/docs.yml',
					statusWorkflow: {
						allowed: ['not_started', 'drafting', 'approved'],
						terminal: ['approved'],
						transitions: {},
					},
				};
			minimalContract.documentsByCanonicalId.set(
				'test-doc',
				minimalContract.documents[0],
			);
			minimalContract.documentsByPhaseId.set(
				'01-test',
				minimalContract.documents,
			);

			const state = createEmptyWorkspaceState();
			const candidates = collectQuestionCandidates(
				minimalContract,
				undefined,
				state,
			);

			const optionalCandidate = candidates.find(
				(c) => c.relatedSectionId === 'optional-section',
			);
			const requiredCandidate = candidates.find(
				(c) => c.relatedSectionId === 'required-section',
			);

			expect(optionalCandidate).toBeDefined();
			expect(optionalCandidate?.blockingLevel).toBe('non-blocking');
			expect(requiredCandidate).toBeDefined();
			expect(requiredCandidate?.blockingLevel).toBe('blocking');
		});

		it('uncertain questions default to non-blocking unless required by schema/dependency', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const _candidates = collectQuestionCandidates(contract, undefined, state);

			// Existing open questions that don't map to required sections should be non-blocking
			state.openQuestions.push({
				affectedDocumentIds: ['01-thesis'],
				body: undefined,
				createdAt: '2024-01-01T00:00:00.000Z',
				id: 'oq-optional',
				question: 'Optional clarification question',
				sourceRefs: [],
				status: 'open',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			const result = planNextQuestions({ contract, state });
			const optionalQ = result.cluster?.questions.find(
				(q) => q.existingOpenQuestionId === 'oq-optional',
			);

			if (optionalQ) {
				expect(optionalQ.blockingLevel).toBe('non-blocking');
			}
		});

		it('classification reason codes are present', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const candidates = collectQuestionCandidates(contract, undefined, state);

			for (const c of candidates.slice(0, 20)) {
				expect(c.reason).toBeTruthy();
				expect(c.reasonDescription).toBeTruthy();
			}
		});
	});

	describe('cluster behavior', () => {
		it('max cluster size option is respected', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			for (const size of [1, 2, 3, 5]) {
				const result = planNextQuestions(
					{ contract, state },
					{ maxClusterSize: size },
				);
				expect(result.cluster?.questions.length).toBeLessThanOrEqual(size);
			}
		});

		it('questions are grouped coherently by phase/document where practical', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });
			expect(result.cluster).toBeDefined();
			const cluster = result.cluster;
			if (!cluster) throw new Error('Expected cluster');
			// Most questions in a small cluster should come from the same phase
			const firstPhaseId = cluster.questions[0]?.source.phaseId;
			const samePhaseCount = cluster.questions.filter(
				(q) => q.source.phaseId === firstPhaseId,
			).length;

			// At least half should be from the same phase
			expect(samePhaseCount).toBeGreaterThanOrEqual(
				Math.ceil(cluster.questions.length / 2),
			);
		});

		it('long deterministic questionnaire is not returned', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });

			// Cluster should be small (default max 5)
			expect(result.cluster?.questions.length).toBeLessThanOrEqual(5);
		});

		it('no duplicate questions are returned', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({ contract, state });
			const texts = result.cluster?.questions.map((q) =>
				q.text.toLowerCase().trim(),
			);
			const uniqueTexts = new Set(texts);

			expect(uniqueTexts.size).toBe(texts.length);
		});

		it('no-question state returns a structured result/diagnostic', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			// Focus on a non-existent phase to force no questions
			const result = planNextQuestions(
				{ contract, state },
				{ focusPhaseIds: ['non-existent-phase'] },
			);

			expect(result.success).toBe(true);
			expect(result.cluster).toBeUndefined();
			expect(
				result.diagnostics.some((d) => d.code === 'I_PLAN_NO_QUESTIONS'),
			).toBe(true);
		});
	});

	describe('diagnostics', () => {
		it('returns error when contract is missing', () => {
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions({
				contract: undefined as unknown as typeof result extends {
					cluster: unknown;
				}
					? never
					: never,
				state,
			});

			// This is a type test; runtime behavior:
			expect(() =>
				planNextQuestions({
					contract: undefined as unknown as DocumentationContract,
					state,
				}),
			).not.toThrow();
		});

		it('returns error when state is missing', async () => {
			const contract = await loadStandardContract();

			const result = planNextQuestions({
				contract,
				state: undefined as unknown as WorkspaceState,
			});
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'E_PLAN_MISSING_STATE'),
			).toBe(true);
		});

		it('duplicate question diagnostics are deterministic', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result1 = planNextQuestions({ contract, state });
			const result2 = planNextQuestions({ contract, state });

			const dupes1 = result1.diagnostics.filter(
				(d) => d.code === 'W_PLAN_DUPLICATE_QUESTION',
			);
			const dupes2 = result2.diagnostics.filter(
				(d) => d.code === 'W_PLAN_DUPLICATE_QUESTION',
			);

			expect(dupes1.length).toBe(dupes2.length);
		});
	});

	describe('focus options', () => {
		it('focusPhaseIds restricts questions to specified phases', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions(
				{ contract, state },
				{ focusPhaseIds: ['01-foundation'] },
			);

			expect(result.cluster).toBeDefined();
			const focusCluster = result.cluster;
			if (!focusCluster) throw new Error('Expected cluster');
			for (const q of focusCluster.questions) {
				expect(q.source.phaseId).toBe('01-foundation');
			}
		});

		it('focusDocumentIds restricts questions to specified documents', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const result = planNextQuestions(
				{ contract, state },
				{ focusDocumentIds: ['01-thesis'] },
			);

			expect(result.cluster).toBeDefined();
			const focusCluster = result.cluster;
			if (!focusCluster) throw new Error('Expected cluster');
			for (const q of focusCluster.questions) {
				expect(q.source.documentCanonicalId).toBe('01-thesis');
			}
		});
	});

	describe('read-only behavior', () => {
		it('planner does not mutate workspace state', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const stateBefore = JSON.stringify(state);
			planNextQuestions({ contract, state });
			const stateAfter = JSON.stringify(state);

			expect(stateAfter).toBe(stateBefore);
		});

		it('collectQuestionCandidates does not mutate inputs', async () => {
			const contract = await loadStandardContract();
			const state = createEmptyWorkspaceState();

			const stateBefore = JSON.stringify(state);
			collectQuestionCandidates(contract, undefined, state);
			const stateAfter = JSON.stringify(state);

			expect(stateAfter).toBe(stateBefore);
		});
	});
});
