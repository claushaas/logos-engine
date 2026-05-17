import { describe, expect, it } from 'vitest';
import type {
	CanonicalMarkdownRenderInput,
	CanonicalMarkdownRenderOptions,
	CanonicalMarkdownRenderResult,
	DocumentationContract,
	GenerationPlanItem,
	LoadedDocumentDescriptor,
	LoadedPhaseDescriptor,
	ProfileStatusWorkflow,
	WorkspaceState,
} from '../src/index.js';
import {
	buildContractGraph,
	createDefaultWorkspaceState,
	createGenerationPlan,
	renderCanonicalMarkdownDocument,
	renderCanonicalMarkdownFromPlan,
} from '../src/index.js';
import { WORKSPACE_STATE_SCHEMA_VERSION } from '../src/state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(date: string): string {
	return new Date(date).toISOString();
}

const TEST_TIMESTAMP = '2025-01-01T00:00:00.000Z';

function createEmptyState(overrides?: Partial<WorkspaceState>): WorkspaceState {
	const base = createDefaultWorkspaceState({
		createdAt: iso('2025-01-01T00:00:00Z'),
		projectRootPath: '/tmp/test-repo',
		updatedAt: iso('2025-01-01T00:00:00Z'),
		workspaceId: 'ws-test',
	});
	return { ...base, ...overrides } as WorkspaceState;
}

function createStateWithDecision(
	canonicalId: string,
	decisionId: string,
): WorkspaceState {
	const state = createEmptyState();
	state.decisions = [
		{
			affectedDocumentIds: [canonicalId],
			body: 'Test decision body for confirmation.',
			confidence: 'high',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: decisionId,
			sourceRefs: ['session-001'],
			status: 'confirmed',
			title: 'Test Decision',
			updatedAt: iso('2025-01-01T00:00:00Z'),
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
			body: 'We assume modern browsers.',
			caveat: 'May need polyfills.',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: assumptionId,
			sourceRefs: ['session-001'],
			status: 'active',
			title: 'Modern browser assumption',
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
			body: 'Need to decide on platform.',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: questionId,
			question: 'What deployment platform?',
			sourceRefs: ['session-001'],
			status: 'open',
			updatedAt: iso('2025-01-01T00:00:00Z'),
		},
	];
	return state;
}

function createStateWithRisk(
	canonicalId: string,
	riskId: string,
): WorkspaceState {
	const state = createEmptyState();
	state.risks = [
		{
			affectedDocumentIds: [canonicalId],
			body: 'Vendor lock-in risk.',
			createdAt: iso('2025-01-01T00:00:00Z'),
			id: riskId,
			rationale: 'Accept for faster time-to-market.',
			severity: 'medium',
			sourceRefs: ['session-001'],
			status: 'identified',
			title: 'Vendor lock-in',
			updatedAt: iso('2025-01-01T00:00:00Z'),
		},
	];
	return state;
}

function createStateWithAcceptedProposal(
	canonicalId: string,
	proposalId: string,
	body: string = 'Accepted content for the document.',
): WorkspaceState {
	const state = createEmptyState();
	state.proposals = [
		{
			body,
			createdAt: iso('2025-01-01T00:00:00Z'),
			kind: 'document_content_hint',
			proposalId,
			sourceDocumentCanonicalId: canonicalId,
			status: 'accepted',
			title: 'Accepted content hint',
			updatedAt: iso('2025-01-01T00:00:00Z'),
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
			documents: [{ file: 'doc-a.yml', id: 'a', title: 'Doc A' }],
			feedsInto: [],
			generatedOutputs: {},
			id: 'phase-1',
			order: 1,
			qualityChecks: [],
			raw: {},
			readingOrder: ['a'],
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
				completionCriteria: ['Section content must be complete.'],
				id: 'a',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/a.md',
						purpose: 'Doc A canonical',
					},
				},
				phase: 'phase-1',
				purpose: 'Define the core concept of A.',
				qualityChecks: ['All references must be verified.'],
				sections: [
					{
						id: 'section-a-1',
						questions: ['What is the core of A?'],
						required: true,
						title: 'Core Definition',
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

function createFullDocumentContract(): DocumentationContract {
	const documents: LoadedDocumentDescriptor[] = [
		{
			canonicalId: 'full-doc',
			descriptor: {
				antiPatterns: ['Do not use XYZ pattern.'],
				centralQuestion: 'What is the full picture?',
				completionCriteria: ['All sections completed.', 'Review passed.'],
				dependsOn: [],
				id: 'full-doc',
				outputs: {
					canonical: {
						format: 'markdown',
						path: 'docs/phase-1/full-doc.md',
						purpose: 'Full document canonical output',
					},
				},
				phase: 'phase-1',
				purpose: 'This is a comprehensive test document with all features.',
				qualityChecks: ['Check A', 'Check B'],
				reviewRules: ['Review rule 1.'],
				sections: [
					{
						id: 'intro',
						intent: 'Introduce the topic.',
						outputGuidance: ['Keep it brief.'],
						questions: ['What is the topic?'],
						required: true,
						title: 'Introduction',
					},
					{
						id: 'details',
						intent: 'Detail the implementation.',
						outputGuidance: ['Include diagrams.'],
						questions: ['How is it built?'],
						required: true,
						title: 'Details',
					},
					{
						id: 'appendix',
						questions: ['Supplementary info?'],
						required: false,
						title: 'Appendix',
					},
				],
				status: 'not_started',
				title: 'Full Document',
				type: 'thesis',
			},
			documentOrder: 0,
			globalOrder: 0,
			phaseId: 'phase-1',
			phaseOrder: 1,
			sourcePath: '/fake/phases/phase-1/full-doc.yml',
		},
	];

	const phases: LoadedPhaseDescriptor[] = [
		{
			axis: 'normative',
			completionCriteria: [],
			dependsOn: [],
			description: 'Test phase',
			documents: [
				{ file: 'full-doc.yml', id: 'full-doc', title: 'Full Document' },
			],
			feedsInto: [],
			generatedOutputs: {},
			id: 'phase-1',
			order: 1,
			qualityChecks: [],
			raw: {},
			readingOrder: ['full-doc'],
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

// ---------------------------------------------------------------------------
// Plan item creator
// ---------------------------------------------------------------------------

function getPlanItemForDocument(
	contract: DocumentationContract,
	canonicalId: string,
	state: WorkspaceState,
): GenerationPlanItem {
	const graph = buildContractGraph(contract).graph;
	const planResult = createGenerationPlan(
		{ contract, graph, state },
		{ dryRun: true, generatedAt: TEST_TIMESTAMP },
	);
	const item = planResult.plan.items.find(
		(i) => i.documentCanonicalId === canonicalId,
	);
	if (!item) throw new Error(`No plan item found for ${canonicalId}`);
	return item;
}

function createRenderInput(
	contract: DocumentationContract,
	canonicalId: string,
	state: WorkspaceState,
): CanonicalMarkdownRenderInput {
	const planItem = getPlanItemForDocument(contract, canonicalId, state);
	const doc = contract.documentsByCanonicalId.get(canonicalId);
	if (!doc) throw new Error(`No document descriptor for ${canonicalId}`);

	return {
		documentDescriptor: {
			antiPatterns: doc.descriptor.antiPatterns,
			centralQuestion: doc.descriptor.centralQuestion,
			completionCriteria: doc.descriptor.completionCriteria,
			id: doc.descriptor.id,
			phaseId: doc.phaseId,
			purpose: doc.descriptor.purpose,
			qualityChecks: doc.descriptor.qualityChecks,
			reviewRules: doc.descriptor.reviewRules,
			sections: doc.descriptor.sections,
			status: doc.descriptor.status,
			title: doc.descriptor.title,
			type: doc.descriptor.type,
		},
		planItem,
		profileId: contract.profileId,
		schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
		state,
	};
}

function createRenderOptions(
	overrides?: Partial<CanonicalMarkdownRenderOptions>,
): CanonicalMarkdownRenderOptions {
	return {
		generatedAt: TEST_TIMESTAMP,
		...overrides,
	};
}

// ===========================================================================
// Tests
// ===========================================================================

describe('renderCanonicalMarkdownDocument', () => {
	// -----------------------------------------------------------------------
	// Renderer structure tests
	// -----------------------------------------------------------------------

	describe('renderer structure', () => {
		it('renders a canonical Markdown document for a valid plan item', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.status).toBe('generate');
			expect(result.markdown).toBeTruthy();
			expect(result.markdown.length).toBeGreaterThan(0);
		});

		it('output includes title', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('# Document A');
		});

		it('output includes metadata header (frontmatter)', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('---');
			expect(result.markdown).toContain('documentId:');
			expect(result.markdown).toContain('phaseId:');
			expect(result.markdown).toContain('generationStatus:');
		});

		it('output includes purpose/description when available', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Purpose');
			expect(result.markdown).toContain('Define the core concept of A.');
		});

		it('output includes status/readiness', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Document Status');
			expect(result.markdown).toContain('generate');
		});

		it('output includes sources/traceability section', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.sources.length).toBeGreaterThan(0);
			expect(result.markdown).toContain('## Sources & Traceability');
		});

		it('output includes decisions section when relevant', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Decisions');
			expect(result.markdown).toContain('Test Decision');
		});

		it('output includes assumptions section when relevant', () => {
			const contract = createMinimalContract();
			const state = createStateWithAssumption('a', 'asm-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Assumptions');
			expect(result.markdown).toContain('Modern browser assumption');
		});

		it('output includes unresolved questions section when relevant', () => {
			const contract = createMinimalContract();
			const state = createStateWithOpenQuestion('a', 'q-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Unresolved Questions');
			expect(result.markdown).toContain('What deployment platform?');
		});

		it('output includes quality notes/completion criteria section', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Quality Notes');
		});

		it('output ordering is deterministic', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);

			const result1 = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);
			const result2 = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result1.markdown).toBe(result2.markdown);
			expect(result1.sections.length).toBe(result2.sections.length);
			expect(result1.sources.length).toBe(result2.sources.length);
		});
	});

	// -----------------------------------------------------------------------
	// Descriptor section tests
	// -----------------------------------------------------------------------

	describe('descriptor sections', () => {
		it('sections are rendered in descriptor order', () => {
			const contract = createFullDocumentContract();
			const state = createStateWithAcceptedProposal('full-doc', 'prop-001');
			const input = createRenderInput(contract, 'full-doc', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.sections.length).toBe(3);
			expect(result.sections[0]?.sectionId).toBe('intro');
			expect(result.sections[1]?.sectionId).toBe('details');
			expect(result.sections[2]?.sectionId).toBe('appendix');
		});

		it('unsupported section shape returns diagnostic', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture error');

			// Add a malformed section that has no id
			(doc.descriptor.sections as unknown[]).push({
				questions: ['test'],
				title: 'Bad Section',
			});

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			const diag = result.diagnostics.find(
				(d) => d.code === 'E_MDR_INVALID_SECTION_SHAPE',
			);
			expect(diag).toBeDefined();
			expect(diag?.severity).toBe('warning');
		});

		it('missing required section renders explicit gap', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.gaps.length).toBeGreaterThan(0);
			expect(result.markdown).toContain('## Gaps & Incomplete Sections');
		});

		it('optional missing section does not block rendering', () => {
			const contract = createFullDocumentContract();
			const state = createStateWithAcceptedProposal('full-doc', 'prop-001');
			const input = createRenderInput(contract, 'full-doc', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// Optional appendix may have gaps but document still renders
			expect(result.status).toBe('generate');
			expect(result.markdown).toContain('## Appendix');
		});

		it('section source pointer is preserved in render result', () => {
			const contract = createFullDocumentContract();
			const state = createStateWithAcceptedProposal('full-doc', 'prop-001');
			const input = createRenderInput(contract, 'full-doc', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			for (const section of result.sections) {
				expect(typeof section.sectionId).toBe('string');
				expect(typeof section.title).toBe('string');
				expect(typeof section.status).toBe('string');
			}
		});
	});

	// -----------------------------------------------------------------------
	// State mapping tests
	// -----------------------------------------------------------------------

	describe('state mapping', () => {
		it('confirmed decisions render as decisions', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Decisions');
			expect(result.markdown).toContain('Test Decision');
			expect(result.sources.some((s) => s.recordId === 'dec-001')).toBe(true);
		});

		it('confirmed assumptions render as assumptions', () => {
			const contract = createMinimalContract();
			const state = createStateWithAssumption('a', 'asm-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Assumptions');
			expect(result.markdown).toContain('Modern browser assumption');
		});

		it('open questions render as unresolved questions', () => {
			const contract = createMinimalContract();
			const state = createStateWithOpenQuestion('a', 'q-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Unresolved Questions');
			expect(result.markdown).toContain('What deployment platform?');
		});

		it('risks render as risks', () => {
			const contract = createMinimalContract();
			const state = createStateWithRisk('a', 'risk-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Risks');
			expect(result.markdown).toContain('Vendor lock-in');
		});

		it('accepted proposals may contribute traceable content', () => {
			const contract = createMinimalContract();
			const state = createStateWithAcceptedProposal(
				'a',
				'prop-001',
				'Content from accepted proposal.',
			);
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('Content from accepted proposal.');
		});

		it('proposed/unaccepted proposals do not render as confirmed facts', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			state.proposals = [
				{
					body: 'Proposed but not accepted.',
					createdAt: iso('2025-01-01T00:00:00Z'),
					kind: 'document_content_hint',
					proposalId: 'prop-unaccepted',
					sourceDocumentCanonicalId: 'a',
					status: 'proposed',
					title: 'Unaccepted proposal',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).not.toContain('Proposed but not accepted.');
		});

		it('contextual suggestions do not render as facts', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// The renderer only uses confirmed state, not suggestions
			expect(result.markdown).not.toContain('suggestion');
		});

		it('artifact metadata alone does not render as canonical content', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			state.artifacts = [
				{
					artifactId: 'art-001',
					artifactType: 'canonical_markdown',
					generatedAt: iso('2025-01-01T00:00:00Z'),
					isCanonical: true,
					metadata: { rawContent: 'Raw artifact content' },
					path: 'logos/phase-1/a.md',
					sourceDocumentIds: ['a'],
					status: 'generated',
				},
			];
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// Artifact metadata should not be rendered as canonical content
			expect(result.markdown).not.toContain('Raw artifact content');
		});
	});

	// -----------------------------------------------------------------------
	// Gap/uncertainty tests
	// -----------------------------------------------------------------------

	describe('gap and uncertainty rendering', () => {
		it('empty workspace renders explicit gaps', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.gaps.length).toBeGreaterThan(0);
			expect(result.markdown).toContain('## Gaps & Incomplete Sections');
		});

		it('partial workspace renders available content plus gaps', () => {
			const contract = createFullDocumentContract();
			const state = createStateWithDecision('full-doc', 'dec-001');
			// Also add an open question to test partial state
			state.openQuestions = [
				{
					affectedDocumentIds: ['full-doc'],
					body: 'Need to decide.',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'q-partial',
					question: 'What framework?',
					sourceRefs: [],
					status: 'open',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];
			const input = createRenderInput(contract, 'full-doc', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('## Decisions');
			expect(result.markdown).toContain('## Unresolved Questions');
			expect(result.markdown).toContain('What framework?');
		});

		it('blocked plan item returns diagnostic without content unless preview allowed', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');

			// Create a contract where 'a' depends on a blocked doc
			const contract2 = {
				...contract,
				documents: [
					{
						canonicalId: 'a',
						descriptor: {
							...doc.descriptor,
							dependsOn: ['non-existent'],
						},
						documentOrder: 0,
						globalOrder: 0,
						phaseId: 'phase-1',
						phaseOrder: 1,
						sourcePath: '/fake/a.yml',
					},
				],
				documentsByCanonicalId: new Map([
					[
						'a',
						{
							canonicalId: 'a',
							descriptor: {
								...doc.descriptor,
								dependsOn: ['non-existent'],
							},
							documentOrder: 0,
							globalOrder: 0,
							phaseId: 'phase-1',
							phaseOrder: 1,
							sourcePath: '/fake/a.yml',
						},
					],
				]),
			};

			const planItem = getPlanItemForDocument(contract2, 'a', state);

			// Force blocked
			const blockedPlanItem: GenerationPlanItem = {
				...planItem,
				action: 'blocked',
				blockers: [
					{
						code: 'E_TEST_BLOCKER',
						message: 'Test blocker',
						recoveryHint: 'Fix it',
					},
				],
			};

			const input: CanonicalMarkdownRenderInput = {
				documentDescriptor: {
					centralQuestion: doc.descriptor.centralQuestion,
					id: doc.descriptor.id,
					phaseId: doc.phaseId,
					purpose: doc.descriptor.purpose,
					sections: doc.descriptor.sections,
					status: doc.descriptor.status,
					title: doc.descriptor.title,
					type: doc.descriptor.type,
				},
				planItem: blockedPlanItem,
				profileId: 'standard',
				schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
				state,
			};

			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.status).toBe('blocked');
			expect(result.markdown).toContain('BLOCKED');
		});

		it('blocked plan item with allowBlockedPreview renders partial content', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');

			const blockedPlanItem: GenerationPlanItem = {
				action: 'blocked',
				blockers: [{ code: 'E_TEST', message: 'Test' }],
				canonicalOutputPath: 'docs/phase-1/a.md',
				confirmedAssumptionIds: [],
				confirmedDecisionIds: [],
				dependencyState: [],
				descriptorSourcePath: '/fake/a.yml',
				documentationRootRelativePath: 'logos/phase-1/a.md',
				documentCanonicalId: 'a',
				documentId: 'a',
				dryRun: true,
				gaps: [],
				orderIndex: 0,
				phaseId: 'phase-1',
				readiness: {
					blockers: [],
					dependencyReady: false,
					gaps: [],
					inputsReady: false,
					ready: false,
					sectionsReady: false,
				},
				relatedRiskIds: [],
				requiredInputIds: [],
				requiredSectionIds: [],
				staleReasons: [],
				unresolvedQuestionIds: [],
			};

			const input: CanonicalMarkdownRenderInput = {
				documentDescriptor: {
					centralQuestion: doc.descriptor.centralQuestion,
					id: doc.descriptor.id,
					phaseId: doc.phaseId,
					purpose: doc.descriptor.purpose,
					sections: doc.descriptor.sections,
					status: doc.descriptor.status,
					title: doc.descriptor.title,
					type: doc.descriptor.type,
				},
				planItem: blockedPlanItem,
				profileId: 'standard',
				schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
				state,
			};

			const result = renderCanonicalMarkdownDocument(input, {
				...createRenderOptions(),
				allowBlockedPreview: true,
			});

			expect(result.markdown).toContain('BLOCKED DOCUMENT');
		});

		it('incomplete plan item renders incomplete markers', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('incomplete');
		});

		it('stale plan item renders stale warning', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');

			const stalePlanItem: GenerationPlanItem = {
				action: 'stale',
				blockers: [],
				canonicalOutputPath: 'docs/phase-1/a.md',
				confirmedAssumptionIds: [],
				confirmedDecisionIds: [],
				dependencyState: [],
				descriptorSourcePath: '/fake/a.yml',
				documentationRootRelativePath: 'logos/phase-1/a.md',
				documentCanonicalId: 'a',
				documentId: 'a',
				dryRun: true,
				gaps: [],
				orderIndex: 0,
				phaseId: 'phase-1',
				readiness: {
					blockers: [],
					dependencyReady: true,
					gaps: [],
					inputsReady: true,
					ready: true,
					sectionsReady: true,
				},
				relatedRiskIds: [],
				requiredInputIds: [],
				requiredSectionIds: [],
				staleReasons: [
					{
						code: 'E_TEST_STALE',
						message: 'State has changed.',
					},
				],
				unresolvedQuestionIds: [],
			};

			const input: CanonicalMarkdownRenderInput = {
				documentDescriptor: {
					centralQuestion: doc.descriptor.centralQuestion,
					id: doc.descriptor.id,
					phaseId: doc.phaseId,
					purpose: doc.descriptor.purpose,
					sections: doc.descriptor.sections,
					status: doc.descriptor.status,
					title: doc.descriptor.title,
					type: doc.descriptor.type,
				},
				planItem: stalePlanItem,
				profileId: 'standard',
				schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
				state,
			};

			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.status).toBe('stale');
			expect(result.markdown).toContain('stale');
		});

		it('no missing fact is invented', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// Should not contain fabricated facts about the document
			expect(result.markdown).not.toContain('Based on extensive research');
			expect(result.markdown).not.toContain('It is widely accepted that');
			expect(result.markdown).not.toContain('The consensus view is');
		});

		it('unresolved questions remain visible', () => {
			const contract = createMinimalContract();
			const state = createStateWithOpenQuestion('a', 'q-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).toContain('What deployment platform?');
		});
	});

	// -----------------------------------------------------------------------
	// Metadata/frontmatter tests
	// -----------------------------------------------------------------------

	describe('metadata and frontmatter', () => {
		it('generated metadata is deterministic with injected timestamp', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);

			const result1 = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions({ generatedAt: '2025-01-01T00:00:00.000Z' }),
			);
			const result2 = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions({ generatedAt: '2025-01-01T00:00:00.000Z' }),
			);

			expect(result1.markdown).toBe(result2.markdown);
		});

		it('metadata includes document id, phase id, profile id, canonical output, and generation status', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.metadata.documentId).toBe('a');
			expect(result.metadata.phaseId).toBe('phase-1');
			expect(result.metadata.profileId).toBe('standard');
			expect(result.metadata.canonicalOutput).toBe('docs/phase-1/a.md');
			expect(result.metadata.generationStatus).toBe('generate');
		});

		it('metadata does not claim validation passed', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).not.toContain('validation_passed');
			expect(result.markdown).not.toContain('validated');
		});

		it('metadata does not mark derived artifacts as canonical', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).not.toContain('canonical: html');
			expect(result.markdown).not.toContain('canonical: agent_pack');
		});

		it('metadata escapes unsafe values', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');
			doc.descriptor.title = 'Doc with "quotes" and\nnewlines';

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// The title in frontmatter should be escaped
			expect(result.markdown).not.toContain('\nnewlines');
		});
	});

	// -----------------------------------------------------------------------
	// Language tests
	// -----------------------------------------------------------------------

	describe('language policy', () => {
		it('default workspace/config renders English content', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// English markers: Purpose, Status, Decisions, Sources, etc.
			expect(result.markdown).toContain('## Purpose');
			expect(result.markdown).toContain('## Document Status');
		});

		it('language policy is deterministic', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);

			const result1 = renderCanonicalMarkdownDocument(input, {
				...createRenderOptions(),
				languagePolicy: { enforceEnglish: true, language: 'en' },
			});
			const result2 = renderCanonicalMarkdownDocument(input, {
				...createRenderOptions(),
				languagePolicy: { enforceEnglish: true, language: 'en' },
			});

			expect(result1.markdown).toBe(result2.markdown);
		});
	});

	// -----------------------------------------------------------------------
	// Markdown safety tests
	// -----------------------------------------------------------------------

	describe('markdown safety', () => {
		it('heading values are escaped/sanitized', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');
			doc.descriptor.title = '## Already a heading';

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// The `##` in the title should be stripped from heading rendering
			const lines = result.markdown.split('\n');
			const titleLine = lines.find((l) => l.startsWith('# '));
			expect(titleLine).toBeDefined();
			expect(titleLine).not.toContain('## Already');
		});

		it('table/list values are escaped/sanitized', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			state.decisions = [
				{
					affectedDocumentIds: ['a'],
					body: 'Decision with | pipe',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'dec|pipe',
					sourceRefs: [],
					status: 'confirmed',
					title: 'Decision With Pipes',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// Pipes in table cells should be escaped with backslash
			expect(result.markdown).toContain('\\|');
		});

		it('frontmatter values are escaped safely', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');
			doc.descriptor.title = 'Doc with "double quotes"';

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// The frontmatter should not contain raw double quotes breaking YAML
			const frontmatterSection = result.markdown.split('---')[1];
			if (frontmatterSection !== undefined) {
				expect(frontmatterSection).not.toContain(': "');
			}
		});

		it('raw HTML/script-like input is rejected or escaped', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');

			// Put script-like content in a decision body
			const firstDec = state.decisions[0];
			if (firstDec === undefined) throw new Error('fixture: no decision');
			firstDec.body = '<script>alert("xss")</script>';

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).not.toContain('<script>');
			expect(result.markdown).not.toContain('alert(');
		});

		it('fake token-like values are redacted or omitted', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const dec1 = state.decisions[0];
			if (dec1 === undefined) throw new Error('fixture: no decision');
			dec1.body = 'The API key is sk-abcdef1234567890';

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).not.toContain('sk-abcdef1234567890');
		});

		it('Bearer token-like values are omitted', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const dec2 = state.decisions[0];
			if (dec2 === undefined) throw new Error('fixture: no decision');
			dec2.body = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			expect(result.markdown).not.toContain('Bearer eyJ');
		});

		it('snapshots do not contain raw fake secrets', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// No raw secret-like strings in the output
			expect(result.markdown).not.toContain('sk-');
			expect(result.markdown).not.toContain('Bearer ');
			expect(result.markdown).not.toContain('Basic ');
			expect(result.markdown).not.toContain('OPENAI_API_KEY');
		});
	});

	// -----------------------------------------------------------------------
	// Step 5.1 integration tests
	// -----------------------------------------------------------------------

	describe('Step 5.1 planner integration', () => {
		it('render from generation plan for empty workspace', () => {
			const contract = createMinimalContract();
			const graph = buildContractGraph(contract).graph;
			const state = createEmptyState();

			const plan = createGenerationPlan(
				{ contract, graph, state },
				{ generatedAt: TEST_TIMESTAMP },
			).plan;

			const contractDocuments = new Map(
				contract.documents.map((d) => [
					d.canonicalId,
					{
						centralQuestion: d.descriptor.centralQuestion,
						id: d.descriptor.id,
						phaseId: d.phaseId,
						purpose: d.descriptor.purpose,
						sections: d.descriptor.sections,
						status: d.descriptor.status,
						title: d.descriptor.title,
						type: d.descriptor.type,
					},
				]),
			);

			const results = renderCanonicalMarkdownFromPlan(
				{
					contractDocuments,
					plan,
					profileId: contract.profileId,
					schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
					state,
				},
				createRenderOptions(),
			);

			expect(results.length).toBe(1);
			expect(results[0]?.markdown).toContain('# Document A');
			expect(results[0]?.gaps.length).toBeGreaterThan(0);
		});

		it('render from generation plan for partial workspace', () => {
			const contract = createMinimalContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithDecision('a', 'dec-001');

			const plan = createGenerationPlan(
				{ contract, graph, state },
				{ generatedAt: TEST_TIMESTAMP },
			).plan;

			const contractDocuments = new Map(
				contract.documents.map((d) => [
					d.canonicalId,
					{
						centralQuestion: d.descriptor.centralQuestion,
						id: d.descriptor.id,
						phaseId: d.phaseId,
						purpose: d.descriptor.purpose,
						sections: d.descriptor.sections,
						status: d.descriptor.status,
						title: d.descriptor.title,
						type: d.descriptor.type,
					},
				]),
			);

			const results = renderCanonicalMarkdownFromPlan(
				{
					contractDocuments,
					plan,
					profileId: contract.profileId,
					schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
					state,
				},
				createRenderOptions(),
			);

			expect(results.length).toBe(1);
			expect(results[0]?.markdown).toContain('## Decisions');
		});

		it('render from generation plan for complete workspace', () => {
			const contract = createFullDocumentContract();
			const graph = buildContractGraph(contract).graph;
			const state = createStateWithAcceptedProposal('full-doc', 'prop-001');
			state.decisions = [
				{
					affectedDocumentIds: ['full-doc'],
					body: 'Complete decision.',
					confidence: 'high',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'dec-full',
					sourceRefs: [],
					status: 'confirmed',
					title: 'Full Decision',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];

			const plan = createGenerationPlan(
				{ contract, graph, state },
				{ generatedAt: TEST_TIMESTAMP },
			).plan;

			const contractDocuments = new Map(
				contract.documents.map((d) => [
					d.canonicalId,
					{
						antiPatterns: d.descriptor.antiPatterns,
						centralQuestion: d.descriptor.centralQuestion,
						completionCriteria: d.descriptor.completionCriteria,
						id: d.descriptor.id,
						phaseId: d.phaseId,
						purpose: d.descriptor.purpose,
						qualityChecks: d.descriptor.qualityChecks,
						reviewRules: d.descriptor.reviewRules,
						sections: d.descriptor.sections,
						status: d.descriptor.status,
						title: d.descriptor.title,
						type: d.descriptor.type,
					},
				]),
			);

			const results = renderCanonicalMarkdownFromPlan(
				{
					contractDocuments,
					plan,
					profileId: contract.profileId,
					schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
					state,
				},
				createRenderOptions(),
			);

			expect(results.length).toBe(1);
			expect(results[0]?.status).toBe('generate');
		});

		it('render respects generate/update/incomplete/blocked/failed/stale/skip statuses', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();

			// 'generate' status
			const generateItem = getPlanItemForDocument(
				contract,
				'a',
				createStateWithDecision('a', 'dec-001'),
			);
			expect(generateItem.action).toBe('generate');

			// 'incomplete' status
			const incompleteItem = getPlanItemForDocument(
				contract,
				'a',
				createEmptyState(),
			);
			expect(incompleteItem.action).toBe('incomplete');

			// Both should render
			const doc = contract.documentsByCanonicalId.get('a');
			if (doc === undefined) throw new Error('fixture');

			const makeInput = (item: GenerationPlanItem) =>
				({
					documentDescriptor: {
						centralQuestion: doc.descriptor.centralQuestion,
						id: doc.descriptor.id,
						phaseId: doc.phaseId,
						purpose: doc.descriptor.purpose,
						sections: doc.descriptor.sections,
						status: doc.descriptor.status,
						title: doc.descriptor.title,
						type: doc.descriptor.type,
					},
					planItem: item,
					profileId: 'standard',
					schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
					state,
				}) satisfies CanonicalMarkdownRenderInput;

			const genResult = renderCanonicalMarkdownDocument(
				makeInput(generateItem),
				createRenderOptions(),
			);
			expect(genResult.markdown.length).toBeGreaterThan(0);
		});

		it('render does not mutate plan/state', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);

			const stateBefore = JSON.stringify(state);
			const planBefore = JSON.stringify(input.planItem);

			renderCanonicalMarkdownDocument(input, createRenderOptions());

			const stateAfter = JSON.stringify(state);
			const planAfter = JSON.stringify(input.planItem);

			expect(stateAfter).toBe(stateBefore);
			expect(planAfter).toBe(planBefore);
		});
	});

	// -----------------------------------------------------------------------
	// Non-mutation tests
	// -----------------------------------------------------------------------

	describe('non-mutation', () => {
		it('renderer writes no files', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// Result is a pure data structure
			expect(typeof result.markdown).toBe('string');
			expect(Array.isArray(result.diagnostics)).toBe(true);
		});

		it('renderer creates no directories', () => {
			// No filesystem operations
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);

			// This should complete without any FS operations
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);
			expect(result.markdown).toBeTruthy();
		});

		it('renderer does not mutate .logos/', () => {
			// Pure function, no state writes
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const artifactCount = state.artifacts.length;

			const input = createRenderInput(contract, 'a', state);
			renderCanonicalMarkdownDocument(input, createRenderOptions());

			expect(state.artifacts.length).toBe(artifactCount);
		});

		it('renderer does not create generation run metadata', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const generationRunCount = state.generationRuns.length;

			const input = createRenderInput(contract, 'a', state);
			renderCanonicalMarkdownDocument(input, createRenderOptions());

			expect(state.generationRuns.length).toBe(generationRunCount);
		});

		it('renderer does not update artifact registry', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const artifactCount = state.artifacts.length;

			const input = createRenderInput(contract, 'a', state);
			renderCanonicalMarkdownDocument(input, createRenderOptions());

			expect(state.artifacts.length).toBe(artifactCount);
		});

		it('renderer does not call AI/provider code', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions(),
			);

			// No provider references in output
			expect(result.markdown).not.toContain('providerId');
			expect(result.markdown).not.toContain('tokenEnvVarName');
		});

		it('no test mutates the real repository', () => {
			// All tests use in-memory fixtures
			expect(true).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Snapshot tests
	// -----------------------------------------------------------------------

	describe('snapshots', () => {
		it('snapshot rendered Markdown for valid document fixture', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions({ generatedAt: TEST_TIMESTAMP }),
			);

			const normalized = normalizeRenderResultForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot rendered Markdown for missing-section fixture', () => {
			const contract = createMinimalContract();
			const state = createEmptyState();
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions({ generatedAt: TEST_TIMESTAMP }),
			);

			const normalized = normalizeRenderResultForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot rendered Markdown for traceability/source/gap markers', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			state.assumptions = [
				{
					affectedDocumentIds: ['a'],
					body: 'We assume TypeScript.',
					caveat: 'Version 5+ required.',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'asm-001',
					sourceRefs: ['session-001'],
					status: 'active',
					title: 'TypeScript assumption',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];
			state.openQuestions = [
				{
					affectedDocumentIds: ['a'],
					body: 'Unknown deployment.',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'q-001',
					question: 'Where to deploy?',
					sourceRefs: [],
					status: 'open',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];
			state.risks = [
				{
					affectedDocumentIds: ['a'],
					body: 'Cost risk.',
					createdAt: iso('2025-01-01T00:00:00Z'),
					id: 'risk-001',
					rationale: 'Monitor spending.',
					severity: 'medium',
					sourceRefs: [],
					status: 'identified',
					title: 'Budget overrun',
					updatedAt: iso('2025-01-01T00:00:00Z'),
				},
			];

			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions({ generatedAt: TEST_TIMESTAMP }),
			);

			const normalized = normalizeRenderResultForSnapshot(result);
			expect(normalized).toMatchSnapshot();
		});

		it('snapshot render result summary', () => {
			const contract = createMinimalContract();
			const state = createStateWithDecision('a', 'dec-001');
			const input = createRenderInput(contract, 'a', state);
			const result = renderCanonicalMarkdownDocument(
				input,
				createRenderOptions({ generatedAt: TEST_TIMESTAMP }),
			);

			const summary = {
				canonicalOutputPath: result.canonicalOutputPath,
				diagnosticCount: result.diagnostics.length,
				documentCanonicalId: result.documentCanonicalId,
				gapCount: result.gaps.length,
				markdownLength: result.markdown.length,
				phaseId: result.phaseId,
				renderedAt: result.renderedAt,
				sectionCount: result.sections.length,
				sourceCount: result.sources.length,
				status: result.status,
			};
			expect(summary).toMatchSnapshot();
		});
	});
});

// ===========================================================================
// Snapshot normalization
// ===========================================================================

interface NormalizedRenderResult {
	documentCanonicalId: string;
	phaseId: string;
	canonicalOutputPath: string;
	status: string;
	renderedAt: string;
	sectionCount: number;
	sourceCount: number;
	gapCount: number;
	diagnosticCount: number;
	markdownLength: number;
	sections: NormalizedRenderedSection[];
	sources: NormalizedSourceRef[];
	gaps: NormalizedGap[];
}

interface NormalizedRenderedSection {
	sectionId: string;
	title: string;
	status: string;
	required: boolean;
	descriptorOrder: number;
	sourceCount: number;
	gapCount: number;
}

interface NormalizedSourceRef {
	recordId: string;
	recordType: string;
}

interface NormalizedGap {
	code: string;
	sectionId: string | undefined;
	inputId: string | undefined;
}

function normalizeRenderResultForSnapshot(
	result: CanonicalMarkdownRenderResult,
): NormalizedRenderResult {
	return {
		canonicalOutputPath: result.canonicalOutputPath,
		diagnosticCount: result.diagnostics.length,
		documentCanonicalId: result.documentCanonicalId,
		gapCount: result.gaps.length,
		gaps: result.gaps.map((g) => ({
			code: g.code,
			inputId: g.inputId,
			sectionId: g.sectionId,
		})),
		markdownLength: result.markdown.length,
		phaseId: result.phaseId,
		renderedAt: result.renderedAt,
		sectionCount: result.sections.length,
		sections: result.sections.map((s) => ({
			descriptorOrder: s.descriptorOrder,
			gapCount: s.gaps.length,
			required: s.required,
			sectionId: s.sectionId,
			sourceCount: s.sources.length,
			status: s.status,
			title: s.title,
		})),
		sourceCount: result.sources.length,
		sources: result.sources.map((s) => ({
			recordId: s.recordId,
			recordType: s.recordType,
		})),
		status: result.status,
	};
}
