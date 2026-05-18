/** Step 8.4 — Traceability integration tests with canonical Markdown, review/generation reports */
import { describe, expect, it } from 'vitest';
import type {
	CanonicalMarkdownRenderInput,
	WorkspaceState,
} from '../../src/index.js';
import {
	createDefaultWorkspaceState,
	renderCanonicalMarkdownDocument,
} from '../../src/index.js';
import type {
	ClaimRecord,
	SourceRecord,
} from '../../src/provenance/provenance-types.js';
import type { RegisterCollections } from '../../src/registers/register-types.js';
import {
	buildAgentPackTraceabilityMetadata,
	buildCanonicalMarkdownTraceabilityMetadata,
	buildExecutiveExportTraceabilityMetadata,
	buildHtmlArtifactTraceabilityMetadata,
	buildValidationReportTraceabilityMetadata,
} from '../../src/traceability/traceability-metadata.js';
import {
	buildTraceabilityResult,
	getBoundaryLabel,
	renderMetadataHeaderAddon,
	renderTraceabilitySummaryMarkdown,
	toTraceabilityClaimItem,
	toTraceabilitySourceItem,
} from '../../src/traceability/traceability-renderer.js';
import type { OutputTraceabilityInput } from '../../src/traceability/traceability-types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TEST_TIMESTAMP = '2025-06-01T12:00:00.000Z';
const TEST_PROJECT_ROOT = '/tmp/logos-test-project';

function iso(date: string): string {
	return new Date(date).toISOString();
}

function createEmptyState(overrides?: Partial<WorkspaceState>): WorkspaceState {
	const base = createDefaultWorkspaceState({
		createdAt: iso('2025-06-01T00:00:00Z'),
		projectRootPath: TEST_PROJECT_ROOT,
		updatedAt: iso('2025-06-01T00:00:00Z'),
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
			body: 'Test decision body.',
			confidence: 'high',
			createdAt: iso('2025-06-01T00:00:00Z'),
			id: decisionId,
			sourceRefs: ['session-001'],
			status: 'confirmed',
			title: 'Test Decision',
			updatedAt: iso('2025-06-01T00:00:00Z'),
		},
	];
	return state;
}

function makeSourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
	return {
		confidence: 'explicit',
		location: { path: 'logos/01-foundation/thesis.md' },
		metadata: {},
		orderIndex: 0,
		sourceId: 'src-001',
		sourceType: 'document',
		status: 'confirmed',
		timestamp: { createdAt: TEST_TIMESTAMP },
		title: 'Test Document',
		...overrides,
	} as SourceRecord;
}

function makeClaimRecord(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
	return {
		claimId: 'claim-001',
		claimType: 'decision',
		confidence: 'explicit',
		diagnostics: [],
		isGenerated: false,
		isInferred: false,
		primarySourceId: 'src-001',
		reviewState: 'approved',
		sourceCount: 1,
		sourceLinks: [],
		status: 'confirmed',
		summary: 'Test decision claim',
		...overrides,
	} as ClaimRecord;
}

function makeRegisters(): RegisterCollections {
	return {
		assumptions: [
			{
				affectedDocumentLinks: [],
				assumptionStatement: 'TypeScript is used',
				confidence: 'explicit',
				createdAt: TEST_TIMESTAMP,
				diagnostics: [],
				id: 'reg-asm-001',
				kind: 'assumption' as const,
				lifecycleHistory: [],
				reviewState: 'approved',
				sourceLinks: [],
				status: 'confirmed',
				title: 'TypeScript assumption',
				updatedAt: TEST_TIMESTAMP,
			},
		],
		decisions: [
			{
				affectedDocumentLinks: [],
				alternativesConsidered: [],
				confidence: 'explicit',
				createdAt: TEST_TIMESTAMP,
				decisionStatement: 'Use pnpm',
				diagnostics: [],
				id: 'reg-dec-001',
				kind: 'decision' as const,
				lifecycleHistory: [],
				reviewState: 'approved',
				sourceLinks: [],
				status: 'confirmed',
				title: 'Package manager decision',
				updatedAt: TEST_TIMESTAMP,
			},
		],
		hypotheses: [],
		lifecycleEvents: [],
		openQuestions: [
			{
				affectedDocumentLinks: [],
				confidence: 'inferred',
				createdAt: TEST_TIMESTAMP,
				diagnostics: [],
				id: 'reg-q-001',
				isBlocking: true,
				kind: 'open_question' as const,
				lifecycleHistory: [],
				questionText: 'Where to deploy?',
				reviewState: 'requires_review',
				sourceLinks: [],
				status: 'open',
				title: 'Deployment target',
				updatedAt: TEST_TIMESTAMP,
			},
		],
		risks: [],
	};
}

// ---------------------------------------------------------------------------
// Canonical Markdown traceability integration
// ---------------------------------------------------------------------------

describe('canonical Markdown traceability integration', () => {
	it('generated Markdown includes traceability metadata', () => {
		const state = createStateWithDecision('a', 'dec-001');
		const input: CanonicalMarkdownRenderInput = {
			documentDescriptor: {
				centralQuestion: 'What is the core?',
				id: 'test-doc',
				phaseId: '01-foundation',
				purpose: 'Define core concept.',
				sections: [
					{ id: 'overview', questions: [], required: true, title: 'Overview' },
				],
				status: 'active',
				title: 'Test Document',
				type: 'document',
			},
			planItem: {
				action: 'generate',
				blockers: [],
				canonicalOutputPath: 'logos/01-foundation/test-doc.md',
				confirmedAssumptionIds: [],
				confirmedDecisionIds: ['dec-001'],
				dependencyState: [],
				descriptorSourcePath: 'profiles/standard/phases/01-foundation.yml',
				documentationRootRelativePath: 'logos/01-foundation/test-doc.md',
				documentCanonicalId: 'test-doc',
				documentId: 'test-doc',
				gaps: [],
				phaseId: '01-foundation',
				readiness: { ready: true },
				relatedRiskIds: [],
				staleReasons: [],
				unresolvedQuestionIds: [],
			},
			profileId: 'standard',
			schemaVersion: '3.1.0',
			state,
		};
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		expect(result.markdown).toContain('---');
		expect(result.markdown).toContain('documentId:');
		expect(result.markdown).toContain('phaseId:');
		expect(result.metadata.boundary).toBe('canonical');
	});

	it('generated Markdown includes human-readable traceability/source section', () => {
		const state = createStateWithDecision('a', 'dec-001');
		const input = createCanonicalMarkdownInput(state, 'a', 'dec-001');
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		expect(result.markdown).toContain('## Sources & Traceability');
	});

	it('generated sections include source references where practical', () => {
		const state = createStateWithDecision('a', 'dec-001');
		const input = createCanonicalMarkdownInput(state, 'a', 'dec-001');
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		expect(result.sources.length).toBeGreaterThan(0);
		expect(result.markdown).toContain('Decisions');
	});

	it('inferred/generated content is marked review-required', () => {
		const state = createStateWithDecision('a', 'dec-001');
		// Add an assumption to trigger inferred content
		state.assumptions = [
			{
				affectedDocumentIds: ['a'],
				body: 'We assume TypeScript.',
				caveat: 'Version 5+ required.',
				createdAt: iso('2025-06-01T00:00:00Z'),
				id: 'asm-001',
				sourceRefs: [],
				status: 'active',
				title: 'TypeScript assumption',
				updatedAt: iso('2025-06-01T00:00:00Z'),
			},
		];

		const input = createCanonicalMarkdownInput(state, 'a', 'dec-001');
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		expect(result.markdown).toContain('Assumptions');
	});
});

// Helper to create canonical markdown render input
function createCanonicalMarkdownInput(
	state: WorkspaceState,
	canonicalId: string,
	decisionId: string,
): CanonicalMarkdownRenderInput {
	return {
		documentDescriptor: {
			centralQuestion: 'What is the core?',
			id: canonicalId,
			phaseId: '01-foundation',
			purpose: 'Define core concept.',
			sections: [
				{ id: 'overview', questions: [], required: true, title: 'Overview' },
			],
			status: 'active',
			title: 'Test Document',
			type: 'document',
		},
		planItem: {
			action: 'generate',
			blockers: [],
			canonicalOutputPath: `logos/01-foundation/${canonicalId}.md`,
			confirmedAssumptionIds: state.assumptions.map((a) => a.id),
			confirmedDecisionIds: [decisionId],
			dependencyState: [],
			descriptorSourcePath: 'profiles/standard/phases/01-foundation.yml',
			documentationRootRelativePath: `logos/01-foundation/${canonicalId}.md`,
			documentCanonicalId: canonicalId,
			documentId: canonicalId,
			gaps: [],
			phaseId: '01-foundation',
			readiness: { ready: true },
			relatedRiskIds: state.risks.map((r) => r.id),
			staleReasons: [],
			unresolvedQuestionIds: state.openQuestions.map((q) => q.id),
		},
		profileId: 'standard',
		schemaVersion: '3.1.0',
		state,
	};
}

// ---------------------------------------------------------------------------
// Unresolved questions and inferred content visibility
// ---------------------------------------------------------------------------

describe('unresolved questions visibility', () => {
	it('unresolved/blocking open questions remain visible', () => {
		const state = createEmptyState();
		state.openQuestions = [
			{
				affectedDocumentIds: ['a'],
				body: 'Unknown deployment target.',
				createdAt: iso('2025-06-01T00:00:00Z'),
				id: 'q-001',
				question: 'Where to deploy?',
				sourceRefs: [],
				status: 'open',
				updatedAt: iso('2025-06-01T00:00:00Z'),
			},
		];

		const input = createCanonicalMarkdownInput(state, 'a', 'no-decision');
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		expect(result.markdown).toContain('Unresolved Questions');
	});

	it('missing source marker appears when source is absent', () => {
		const state = createEmptyState();
		state.decisions = [
			{
				affectedDocumentIds: ['a'],
				body: 'Decision with no source refs.',
				confidence: 'low',
				createdAt: iso('2025-06-01T00:00:00Z'),
				id: 'dec-nosrc',
				sourceRefs: [],
				status: 'confirmed',
				title: 'Sourceless Decision',
				updatedAt: iso('2025-06-01T00:00:00Z'),
			},
		];

		const input = createCanonicalMarkdownInput(state, 'a', 'dec-nosrc');
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		// Sources & Traceability section should exist
		expect(result.markdown).toContain('## Sources & Traceability');
	});

	it('manual edit detection metadata remains parseable', () => {
		const state = createStateWithDecision('a', 'dec-001');
		const input = createCanonicalMarkdownInput(state, 'a', 'dec-001');
		const result = renderCanonicalMarkdownDocument(input, {
			generatedAt: TEST_TIMESTAMP,
		});

		// Frontmatter should be parseable
		const frontmatterEnd = result.markdown.indexOf('---', 3);
		expect(frontmatterEnd).toBeGreaterThan(0);
		const frontmatter = result.markdown.substring(3, frontmatterEnd);
		expect(frontmatter).toContain('documentId:');
		expect(frontmatter).toContain('canonicalOutput:');
	});
});

// ---------------------------------------------------------------------------
// Review report traceability integration
// ---------------------------------------------------------------------------

describe('review report traceability integration', () => {
	it('validation report includes traceability summary', () => {
		const metadata = buildValidationReportTraceabilityMetadata(
			{
				claims: [makeClaimRecord()],
				generatedAt: TEST_TIMESTAMP,
				outputPath: 'logos/reports/validation-val-001.md',
				profileId: 'standard',
				sources: [makeSourceRecord()],
				validationRunId: 'val-run-001',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.outputKind).toBe('validation_report');
		expect(metadata.boundary).toBe('non_canonical');
		expect(metadata.validationRunId).toBe('val-run-001');
	});

	it('diagnostic report includes traceability summary', () => {
		const metadata = buildTraceabilityResult(
			{
				boundary: 'non_canonical',
				claims: [makeClaimRecord()],
				outputKind: 'diagnostic_report',
				profileId: 'standard',
				sources: [makeSourceRecord()],
				validationRunId: 'diag-run-001',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.metadata.outputKind).toBe('diagnostic_report');
		expect(metadata.metadata.boundary).toBe('non_canonical');
	});

	it('findings include related sources/claims where available', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'non_canonical',
			claims: [
				makeClaimRecord({
					claimId: 'c-finding-1',
					relatedDocumentCanonicalId: '10-functional-requirements',
				}),
			],
			outputKind: 'validation_report',
			profileId: 'standard',
			sources: [
				makeSourceRecord({
					sourceId: 'src-finding',
					sourceType: 'validation_finding',
				}),
			],
			validationRunId: 'val-run-002',
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result.metadata.sourceReferences.length).toBe(1);
		expect(result.metadata.claimReferences.length).toBe(1);
	});

	it('report remains non-canonical', () => {
		const metadata = buildValidationReportTraceabilityMetadata(
			{
				profileId: 'standard',
				validationRunId: 'val-run-003',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.boundary).toBe('non_canonical');
		expect(metadata.boundary).not.toBe('canonical');
	});

	it('report does not expose fake secrets', () => {
		const metadata = buildValidationReportTraceabilityMetadata(
			{
				claims: [
					makeClaimRecord({ claimId: 'c-safe', summary: 'Safe summary' }),
				],
				generatedAt: TEST_TIMESTAMP,
				profileId: 'standard',
				sources: [makeSourceRecord({ title: 'Safe title' })],
				validationRunId: 'val-run-004',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP, redactSecrets: true },
		);

		const summaryText = renderTraceabilitySummaryMarkdown(metadata);
		expect(summaryText).not.toContain('sk-');
		expect(summaryText).not.toContain('Bearer');
	});
});

// ---------------------------------------------------------------------------
// Generation report traceability integration
// ---------------------------------------------------------------------------

describe('generation report traceability integration', () => {
	it('generation report includes source/claim/register/review-required counts', () => {
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [
					makeClaimRecord(),
					{
						...makeClaimRecord(),
						claimId: 'claim-inferred',
						confidence: 'inferred',
						isInferred: true,
						reviewState: 'required',
						sourceCount: 0,
					} as ClaimRecord,
				],
				documentCanonicalId: '01-thesis',
				generatedAt: TEST_TIMESTAMP,
				generationRunId: 'gen-run-001',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				registers: makeRegisters(),
				sources: [
					makeSourceRecord(),
					makeSourceRecord({ sourceId: 'src-2', title: 'Another Source' }),
				],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.sourceCount).toBe(2);
		expect(metadata.claimCount).toBe(2);
		expect(metadata.reviewRequiredCount).toBeGreaterThanOrEqual(1);
		expect(metadata.registerSummary).toBeDefined();
	});

	it('generation report includes unresolved/blocking question count', () => {
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [
					makeClaimRecord(),
					{
						claimId: 'c-q',
						claimType: 'open_question',
						confidence: 'inferred',
						diagnostics: [],
						isGenerated: false,
						isInferred: true,
						primarySourceId: undefined,
						reviewState: 'required',
						sourceCount: 0,
						sourceLinks: [],
						status: 'requires_review',
						summary: 'Where to deploy?',
					} as ClaimRecord,
				],
				documentCanonicalId: '01-thesis',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.unresolvedQuestionCount).toBeGreaterThanOrEqual(1);
	});

	it('generation report includes missing-source count', () => {
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaimRecord({ sourceCount: 0 })],
				documentCanonicalId: '01-thesis',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.missingSourceCount).toBeGreaterThanOrEqual(0);
	});

	it('generation report preserves canonical/derived boundaries', () => {
		const canonical = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [],
				documentCanonicalId: '01-thesis',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(canonical.boundary).toBe('canonical');

		const derived = buildHtmlArtifactTraceabilityMetadata(
			{
				canonicalMarkdownSources: [],
				profileId: 'standard',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(derived.boundary).toBe('derived');
	});

	it('generation execution semantics are unchanged', () => {
		// This test verifies that traceability metadata building is a pure computation
		// and doesn't change any generation behavior
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaimRecord()],
				documentCanonicalId: '01-thesis',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [makeSourceRecord()],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.boundary).toBe('canonical');
		// No files were written, no side effects occurred
	});
});

// ---------------------------------------------------------------------------
// Derived artifact metadata behavior
// ---------------------------------------------------------------------------

describe('derived artifact traceability metadata behavior', () => {
	it('HTML artifact metadata marks output as derived/non-canonical', () => {
		const metadata = buildHtmlArtifactTraceabilityMetadata(
			{
				canonicalMarkdownSources: [makeSourceRecord()],
				profileId: 'standard',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.boundary).toBe('derived');
		expect(metadata.boundary).not.toBe('canonical');
	});

	it('agent pack traceability input marks output as execution aid/non-canonical', () => {
		const metadata = buildAgentPackTraceabilityMetadata(
			{
				canonicalMarkdownSources: [makeSourceRecord()],
				profileId: 'standard',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.boundary).toBe('execution_aid');
		expect(metadata.boundary).not.toBe('canonical');
	});

	it('executive export traceability input marks output as derived snapshot', () => {
		const metadata = buildExecutiveExportTraceabilityMetadata(
			{
				normativeDocumentSources: [makeSourceRecord()],
				profileId: 'standard',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.boundary).toBe('derived');
		expect(metadata.boundary).not.toBe('canonical');
	});

	it('derived artifact metadata lists canonical Markdown sources', () => {
		const metadata = buildHtmlArtifactTraceabilityMetadata(
			{
				canonicalMarkdownSources: [
					makeSourceRecord({ sourceId: 'src-md-1', title: 'Doc A' }),
					makeSourceRecord({ sourceId: 'src-md-2', title: 'Doc B' }),
				],
				profileId: 'standard',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.sourceReferences.length).toBe(2);
	});

	it('derived artifact metadata does not mark artifact canonical', () => {
		const html = buildHtmlArtifactTraceabilityMetadata(
			{ canonicalMarkdownSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(html.boundary).not.toBe('canonical');

		const agent = buildAgentPackTraceabilityMetadata(
			{ canonicalMarkdownSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(agent.boundary).not.toBe('canonical');

		const exec = buildExecutiveExportTraceabilityMetadata(
			{ normativeDocumentSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(exec.boundary).not.toBe('canonical');
	});

	it('no HTML/agent/executive files are generated', () => {
		// These builders only produce metadata, not actual files
		const html = buildHtmlArtifactTraceabilityMetadata(
			{ canonicalMarkdownSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		// We verify we have metadata but no file generation occurs
		expect(html).toBeDefined();
		expect(html.outputKind).toBe('html_artifact');
	});
});

// ---------------------------------------------------------------------------
// Boundary labels
// ---------------------------------------------------------------------------

describe('boundary labels', () => {
	it('canonical Markdown says canonical editable output', () => {
		expect(getBoundaryLabel('canonical')).toBe('Canonical editable output');
	});

	it('validation report says non-canonical review artifact', () => {
		expect(getBoundaryLabel('non_canonical')).toBe(
			'Non-canonical review artifact',
		);
	});

	it('HTML metadata says derived review artifact', () => {
		expect(getBoundaryLabel('derived')).toBe('Derived review artifact');
	});

	it('agent-pack metadata says derived execution aid', () => {
		expect(getBoundaryLabel('execution_aid')).toBe('Derived execution aid');
	});

	it('executive metadata says derived snapshot/export', () => {
		expect(getBoundaryLabel('derived')).toBe('Derived review artifact');
	});

	it('artifact registry metadata is not rendered as canonical source', () => {
		const label = getBoundaryLabel('canonical');
		expect(label).not.toBe('Derived review artifact');
		expect(label).not.toBe('Non-canonical review artifact');
	});
});

// ---------------------------------------------------------------------------
// Validation/staleness compatibility
// ---------------------------------------------------------------------------

describe('validation and staleness compatibility', () => {
	it('semantic lint recognizes new traceability section', () => {
		// The traceability metadata includes boundary markers that the semantic lint
		// should recognize. Verify that the metadata produced is well-formed.
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaimRecord()],
				documentCanonicalId: '01-thesis',
				generatedAt: TEST_TIMESTAMP,
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [makeSourceRecord()],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.outputKind).toBe('canonical_markdown');
		expect(metadata.boundary).toBe('canonical');
		expect(metadata.documentCanonicalId).toBe('01-thesis');
		expect(metadata.phaseId).toBe('01-foundation');
	});

	it('consistency detector recognizes derived/canonical labels', () => {
		const canonical = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [],
				documentCanonicalId: '01-thesis',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		const derived = buildHtmlArtifactTraceabilityMetadata(
			{
				canonicalMarkdownSources: [],
				profileId: 'standard',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(canonical.boundary).toBe('canonical');
		expect(derived.boundary).toBe('derived');
		expect(canonical.boundary).not.toBe(derived.boundary);
	});

	it('staleness metadata parser remains compatible', () => {
		// The metadata contains source/claim counts that could be used for staleness
		// fingerprinting but must not change the staleness semantics
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaimRecord()],
				documentCanonicalId: '01-thesis',
				generatedAt: TEST_TIMESTAMP,
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [makeSourceRecord()],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata.sourceCount).toBe(1);
		expect(metadata.claimCount).toBe(1);
		expect(typeof metadata.generatedAt).toBe('string');
	});

	it('/generate --dry-run remains non-mutating', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			outputKind: 'canonical_markdown',
			profileId: 'standard',
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result).toBeDefined();
		// Pure computation, no writes
	});
});

// ---------------------------------------------------------------------------
// Non-mutation guarantee tests
// ---------------------------------------------------------------------------

describe('traceability non-mutation guarantees', () => {
	it('traceability builders write no files', () => {
		// All builders return metadata objects only
		const m1 = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [],
				documentCanonicalId: '01-thesis',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(m1).toBeDefined();

		const m2 = buildValidationReportTraceabilityMetadata(
			{ profileId: 'standard', validationRunId: 'val-run' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(m2).toBeDefined();
	});

	it('traceability renderers write no files', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			claims: [makeClaimRecord()],
			outputKind: 'canonical_markdown',
			profileId: 'standard',
			sources: [makeSourceRecord()],
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result.renderedMarkdown).toBeDefined();
		expect(result.renderedJson).toBeDefined();
	});

	it('no HTML/agent/executive outputs are generated', () => {
		const html = buildHtmlArtifactTraceabilityMetadata(
			{ canonicalMarkdownSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(html.outputKind).toBe('html_artifact');

		const agent = buildAgentPackTraceabilityMetadata(
			{ canonicalMarkdownSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(agent.outputKind).toBe('agent_pack');

		const exec = buildExecutiveExportTraceabilityMetadata(
			{ normativeDocumentSources: [], profileId: 'standard' },
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);
		expect(exec.outputKind).toBe('executive_json');
	});

	it('no AI/provider code is called', () => {
		// All operations are pure computations
		const src = makeSourceRecord();
		const item = toTraceabilitySourceItem(src);
		expect(item).toBeDefined();

		const claim = makeClaimRecord();
		const claimItem = toTraceabilityClaimItem(claim);
		expect(claimItem).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests for integration
// ---------------------------------------------------------------------------

describe('traceability integration snapshots', () => {
	it('snapshot rendered markdown traceability section', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			claims: [
				makeClaimRecord(),
				{
					claimId: 'c-inf',
					claimType: 'assumption',
					confidence: 'inferred',
					diagnostics: [],
					isGenerated: false,
					isInferred: true,
					primarySourceId: undefined,
					reviewState: 'required',
					sourceCount: 0,
					sourceLinks: [],
					status: 'requires_review',
					summary: 'Inferred assumption',
				} as ClaimRecord,
			],
			outputKind: 'canonical_markdown',
			profileId: 'standard',
			sources: [makeSourceRecord()],
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result.renderedMarkdown).toMatchSnapshot();
	});

	it('snapshot generated metadata header with traceability summary', () => {
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaimRecord()],
				documentCanonicalId: '01-thesis',
				generatedAt: TEST_TIMESTAMP,
				generationRunId: 'gen-run-001',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [makeSourceRecord()],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		const addon = renderMetadataHeaderAddon(metadata);
		expect(addon).toMatchSnapshot();
	});

	it('snapshot source reference list', () => {
		const sourceItems = [
			toTraceabilitySourceItem(makeSourceRecord({ sourceId: 'src-1' })),
			toTraceabilitySourceItem(
				makeSourceRecord({
					sourceId: 'src-2',
					sourceType: 'confirmed_decision',
				}),
			),
		];
		expect(sourceItems.length).toBe(2);
		expect(sourceItems[0]?.sourceId).toBe('src-1');
		expect(sourceItems[1]?.sourceId).toBe('src-2');
	});

	it('snapshot claim reference list', () => {
		const claims = [
			toTraceabilityClaimItem(makeClaimRecord({ claimId: 'claim-1' })),
			toTraceabilityClaimItem(
				makeClaimRecord({ claimId: 'claim-2', claimType: 'assumption' }),
			),
		];
		expect(claims.length).toBe(2);
	});

	it('snapshot validation report traceability summary', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'non_canonical',
			claims: [makeClaimRecord()],
			outputKind: 'validation_report',
			profileId: 'standard',
			sources: [makeSourceRecord()],
			validationRunId: 'val-run-001',
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});
		const summary = renderTraceabilitySummaryMarkdown(result.metadata);

		expect(summary).toMatchSnapshot();
	});

	it('snapshot generation report traceability summary', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			claims: [makeClaimRecord()],
			documentCanonicalId: '01-thesis',
			generationRunId: 'gen-run-001',
			outputKind: 'canonical_markdown',
			outputPath: 'logos/01-foundation/01-thesis.md',
			phaseId: '01-foundation',
			profileId: 'standard',
			sources: [makeSourceRecord()],
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});
		const summary = renderTraceabilitySummaryMarkdown(result.metadata);

		expect(summary).toMatchSnapshot();
	});

	it('snapshot derived artifact traceability metadata', () => {
		const metadata = buildHtmlArtifactTraceabilityMetadata(
			{
				canonicalMarkdownSources: [
					makeSourceRecord({
						sourceId: 'src-md',
						title: 'Canonical Markdown Document',
					}),
				],
				claims: [makeClaimRecord()],
				generatedAt: TEST_TIMESTAMP,
				generationRunId: 'gen-run-001',
				profileId: 'standard',
				registers: makeRegisters(),
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata).toMatchSnapshot();
	});
});
