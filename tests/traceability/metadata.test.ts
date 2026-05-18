/** Step 8.4 — Traceability metadata tests */
import { describe, expect, it } from 'vitest';
import type {
	ClaimRecord,
	SourceRecord,
} from '../../src/provenance/provenance-types.js';
import type { RegisterCollections } from '../../src/registers/register-types.js';
import {
	buildAgentPackTraceabilityMetadata,
	buildCanonicalMarkdownTraceabilityMetadata,
	buildDiagnosticReportTraceabilityMetadata,
	buildExecutiveExportTraceabilityMetadata,
	buildHtmlArtifactTraceabilityMetadata,
	buildValidationReportTraceabilityMetadata,
} from '../../src/traceability/traceability-metadata.js';
import {
	buildTraceabilityResult,
	getBoundaryLabel,
	getOutputKindLabel,
} from '../../src/traceability/traceability-renderer.js';
import type { OutputTraceabilityInput } from '../../src/traceability/traceability-types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TEST_TIMESTAMP = '2025-06-01T12:00:00.000Z';
const TEST_PROJECT_ROOT = '/tmp/logos-test-project';

function makeSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
	return {
		confidence: 'explicit',
		location: { path: 'logos/01-foundation/thesis.md' },
		metadata: {},
		orderIndex: 0,
		sourceId: 'src-001',
		sourceType: 'document',
		status: 'confirmed',
		timestamp: { createdAt: TEST_TIMESTAMP },
		title: 'Test Document Source',
		...overrides,
	} as SourceRecord;
}

function makeClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
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

function makeInferredClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
	return makeClaim({
		claimId: 'claim-inferred-001',
		claimType: 'assumption',
		confidence: 'inferred',
		isInferred: true,
		reviewState: 'required',
		sourceCount: 0,
		status: 'requires_review',
		summary: 'Inferred assumption claim',
		...overrides,
	});
}

function makeRegisters(): RegisterCollections {
	return {
		assumptions: [
			{
				affectedDocumentLinks: [],
				assumptionStatement: 'TypeScript is used',
				body: 'We assume TypeScript 5+',
				confidence: 'explicit',
				createdAt: TEST_TIMESTAMP,
				diagnostics: [],
				id: 'reg-asm-001',
				kind: 'assumption',
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
				body: 'Use pnpm as package manager',
				confidence: 'explicit',
				createdAt: TEST_TIMESTAMP,
				decisionStatement: 'Use pnpm',
				diagnostics: [],
				id: 'reg-dec-001',
				kind: 'decision',
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
				body: 'We need to determine deployment target',
				confidence: 'inferred',
				createdAt: TEST_TIMESTAMP,
				diagnostics: [],
				id: 'reg-q-001',
				isBlocking: true,
				kind: 'open_question',
				lifecycleHistory: [],
				questionText: 'Where to deploy?',
				reviewState: 'requires_review',
				sourceLinks: [],
				status: 'open',
				title: 'Deployment target',
				updatedAt: TEST_TIMESTAMP,
			},
		],
		risks: [
			{
				affectedDocumentLinks: [],
				body: 'Cost may exceed budget',
				confidence: 'derived',
				createdAt: TEST_TIMESTAMP,
				diagnostics: [],
				id: 'reg-risk-001',
				kind: 'risk',
				lifecycleHistory: [],
				reviewState: 'not_required',
				riskStatement: 'Budget overrun',
				sourceLinks: [],
				status: 'accepted',
				title: 'Budget risk',
				updatedAt: TEST_TIMESTAMP,
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Metadata builder tests
// ---------------------------------------------------------------------------

describe('traceability metadata builders', () => {
	describe('buildCanonicalMarkdownTraceabilityMetadata', () => {
		it('builds metadata for canonical Markdown output', () => {
			const metadata = buildCanonicalMarkdownTraceabilityMetadata(
				{
					claims: [makeClaim()],
					documentCanonicalId: '01-thesis',
					generatedAt: TEST_TIMESTAMP,
					generationRunId: 'gen-run-001',
					outputPath: 'logos/01-foundation/01-thesis.md',
					phaseId: '01-foundation',
					profileId: 'standard',
					sources: [makeSource()],
				},
				{
					deterministicTimestamp: TEST_TIMESTAMP,
					projectRoot: TEST_PROJECT_ROOT,
				},
			);

			expect(metadata.outputKind).toBe('canonical_markdown');
			expect(metadata.boundary).toBe('canonical');
			expect(metadata.profileId).toBe('standard');
			expect(metadata.documentCanonicalId).toBe('01-thesis');
			expect(metadata.phaseId).toBe('01-foundation');
			expect(metadata.outputPath).toBe('logos/01-foundation/01-thesis.md');
			expect(metadata.generationRunId).toBe('gen-run-001');
			expect(metadata.generatedAt).toBe(TEST_TIMESTAMP);
			expect(metadata.sourceCount).toBe(1);
			expect(metadata.claimCount).toBe(1);
		});

		it('metadata includes source count, claim count, review-required count, inferred count', () => {
			const metadata = buildCanonicalMarkdownTraceabilityMetadata(
				{
					claims: [makeClaim(), makeInferredClaim()],
					documentCanonicalId: '01-thesis',
					outputPath: 'logos/01-foundation/01-thesis.md',
					phaseId: '01-foundation',
					profileId: 'standard',
					registers: makeRegisters(),
					sources: [makeSource(), makeSource({ sourceId: 'src-002' })],
				},
				{
					deterministicTimestamp: TEST_TIMESTAMP,
					projectRoot: TEST_PROJECT_ROOT,
				},
			);

			expect(metadata.sourceCount).toBe(2);
			expect(metadata.claimCount).toBe(2);
			expect(metadata.reviewRequiredCount).toBe(1);
			expect(metadata.inferredClaimCount).toBe(1);
			expect(metadata.registerSummary).toBeDefined();
			expect(metadata.registerSummary?.decisionCount).toBe(1);
			expect(metadata.registerSummary?.assumptionCount).toBe(1);
			expect(metadata.registerSummary?.riskCount).toBe(1);
			expect(metadata.registerSummary?.openQuestionCount).toBe(1);
		});

		it('metadata uses relative portable paths', () => {
			const metadata = buildCanonicalMarkdownTraceabilityMetadata(
				{
					claims: [],
					documentCanonicalId: '01-thesis',
					outputPath: 'logos/01-foundation/01-thesis.md',
					phaseId: '01-foundation',
					profileId: 'standard',
					sources: [
						makeSource({ location: { path: 'logos/01-foundation/thesis.md' } }),
					],
				},
				{
					deterministicTimestamp: TEST_TIMESTAMP,
					projectRoot: TEST_PROJECT_ROOT,
				},
			);

			for (const src of metadata.sourceReferences) {
				const relPath = src.relativeSourcePath;
				if (relPath !== undefined) {
					expect(relPath).not.toContain(TEST_PROJECT_ROOT);
					expect(relPath).not.toStrictEqual(expect.stringMatching(/^\/.+/)); // not absolute
				}
			}
		});

		it('metadata preserves canonical/derived boundary markers', () => {
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
			expect(getBoundaryLabel(canonical.boundary)).toBe(
				'Canonical editable output',
			);

			const html = buildHtmlArtifactTraceabilityMetadata(
				{
					canonicalMarkdownSources: [makeSource()],
					generatedAt: TEST_TIMESTAMP,
					profileId: 'standard',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(html.boundary).toBe('derived');
			expect(getBoundaryLabel(html.boundary)).toBe('Derived review artifact');
		});
	});

	describe('buildValidationReportTraceabilityMetadata', () => {
		it('builds metadata for validation report', () => {
			const metadata = buildValidationReportTraceabilityMetadata(
				{
					claims: [makeClaim()],
					generatedAt: TEST_TIMESTAMP,
					profileId: 'standard',
					sources: [makeSource()],
					validationRunId: 'val-run-001',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.outputKind).toBe('validation_report');
			expect(metadata.boundary).toBe('non_canonical');
			expect(metadata.validationRunId).toBe('val-run-001');
		});
	});

	describe('buildDiagnosticReportTraceabilityMetadata', () => {
		it('builds metadata for diagnostic report', () => {
			const metadata = buildDiagnosticReportTraceabilityMetadata(
				{
					generatedAt: TEST_TIMESTAMP,
					profileId: 'standard',
					validationRunId: 'diag-run-001',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.outputKind).toBe('diagnostic_report');
			expect(metadata.boundary).toBe('non_canonical');
		});
	});

	describe('buildHtmlArtifactTraceabilityMetadata', () => {
		it('builds metadata for future HTML artifact input without generating HTML', () => {
			const metadata = buildHtmlArtifactTraceabilityMetadata(
				{
					canonicalMarkdownSources: [makeSource()],
					generatedAt: TEST_TIMESTAMP,
					generationRunId: 'gen-run-001',
					outputPath: 'logos/html/overview.html',
					profileId: 'standard',
					registers: makeRegisters(),
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.outputKind).toBe('html_artifact');
			expect(metadata.boundary).toBe('derived');
			expect(metadata.sourceCount).toBe(1);
			expect(metadata.generationRunId).toBe('gen-run-001');
		});

		it('marks output as derived/non-canonical', () => {
			const metadata = buildHtmlArtifactTraceabilityMetadata(
				{
					canonicalMarkdownSources: [makeSource()],
					profileId: 'standard',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.boundary).toBe('derived');
			expect(metadata.boundary).not.toBe('canonical');
		});
	});

	describe('buildAgentPackTraceabilityMetadata', () => {
		it('builds metadata for future agent pack input without generating agent pack', () => {
			const metadata = buildAgentPackTraceabilityMetadata(
				{
					canonicalMarkdownSources: [makeSource()],
					constraintSources: [
						makeSource({ sourceId: 'src-constraint', sourceType: 'document' }),
					],
					generatedAt: TEST_TIMESTAMP,
					profileId: 'standard',
					registerSources: [
						makeSource({
							sourceId: 'src-reg',
							sourceType: 'profile_descriptor',
						}),
					],
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.outputKind).toBe('agent_pack');
			expect(metadata.boundary).toBe('execution_aid');
			expect(metadata.sourceCount).toBe(3);
		});

		it('marks output as execution aid/non-canonical', () => {
			const metadata = buildAgentPackTraceabilityMetadata(
				{
					canonicalMarkdownSources: [makeSource()],
					profileId: 'standard',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.boundary).toBe('execution_aid');
			expect(metadata.boundary).not.toBe('canonical');
			expect(getBoundaryLabel(metadata.boundary)).toBe('Derived execution aid');
		});
	});

	describe('buildExecutiveExportTraceabilityMetadata', () => {
		it('builds metadata for future executive output input without compiling Executive Axis', () => {
			const metadata = buildExecutiveExportTraceabilityMetadata(
				{
					generatedAt: TEST_TIMESTAMP,
					normativeDocumentSources: [
						makeSource(),
						makeSource({ sourceId: 'src-002' }),
					],
					profileId: 'standard',
					registerSources: [
						makeSource({
							sourceId: 'src-reg',
							sourceType: 'profile_descriptor',
						}),
					],
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.outputKind).toBe('executive_json');
			expect(metadata.boundary).toBe('derived');
			expect(metadata.sourceCount).toBe(3);
		});

		it('marks output as derived snapshot', () => {
			const metadata = buildExecutiveExportTraceabilityMetadata(
				{
					normativeDocumentSources: [makeSource()],
					profileId: 'standard',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.boundary).toBe('derived');
			expect(metadata.boundary).not.toBe('canonical');
			expect(getBoundaryLabel(metadata.boundary)).toBe(
				'Derived review artifact',
			);
		});

		it('derived artifact metadata lists canonical Markdown sources', () => {
			const metadata = buildExecutiveExportTraceabilityMetadata(
				{
					generatedAt: TEST_TIMESTAMP,
					normativeDocumentSources: [
						makeSource({
							sourceId: 'src-canonical-1',
							title: 'Canonical Doc 1',
						}),
						makeSource({
							sourceId: 'src-canonical-2',
							title: 'Canonical Doc 2',
						}),
					],
					profileId: 'standard',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.sourceReferences).toHaveLength(2);
			const titles = metadata.sourceReferences.map((s) => s.title);
			expect(titles).toContain('Canonical Doc 1');
			expect(titles).toContain('Canonical Doc 2');
		});

		it('derived artifact metadata does not mark artifact canonical', () => {
			const metadata = buildExecutiveExportTraceabilityMetadata(
				{
					normativeDocumentSources: [makeSource()],
					profileId: 'standard',
				},
				{ deterministicTimestamp: TEST_TIMESTAMP },
			);

			expect(metadata.boundary).not.toBe('canonical');
		});
	});
});

// ---------------------------------------------------------------------------
// Output kind label tests
// ---------------------------------------------------------------------------

describe('output kind labels', () => {
	it('canonical Markdown says canonical editable output', () => {
		expect(getOutputKindLabel('canonical_markdown')).toBe('Canonical Markdown');
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
		// 'derived' boundary label for executive
		expect(getBoundaryLabel('derived')).toBe('Derived review artifact');
	});

	it('artifact registry metadata is not rendered as canonical source', () => {
		expect(getBoundaryLabel('canonical')).not.toBe('Derived review artifact');
	});
});

// ---------------------------------------------------------------------------
// buildTraceabilityResult tests
// ---------------------------------------------------------------------------

describe('buildTraceabilityResult', () => {
	it('builds result for empty input', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			outputKind: 'canonical_markdown',
			profileId: 'standard',
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result.metadata).toBeDefined();
		expect(result.metadata.sourceCount).toBe(0);
		expect(result.metadata.claimCount).toBe(0);
		expect(result.renderedMarkdown).toBeDefined();
		expect(result.renderedJson).toBeDefined();
	});

	it('correctly counts review-required and inferred claims', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			claims: [
				makeClaim({
					claimId: 'c-confirmed',
					confidence: 'explicit',
					isInferred: false,
					reviewState: 'approved',
				}),
				makeInferredClaim({ claimId: 'c-inferred' }),
				makeClaim({
					claimId: 'c-review',
					claimType: 'open_question',
					confidence: 'inferred',
					isInferred: true,
					reviewState: 'required',
					sourceCount: 0,
					status: 'requires_review',
				}),
			],
			outputKind: 'canonical_markdown',
			profileId: 'standard',
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result.metadata.reviewRequiredCount).toBe(2);
		expect(result.metadata.inferredClaimCount).toBe(2);
		expect(result.metadata.missingSourceCount).toBeGreaterThan(0);
	});

	it('handles register summary', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			outputKind: 'canonical_markdown',
			profileId: 'standard',
			registers: makeRegisters(),
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		expect(result.metadata.registerSummary).toBeDefined();
		expect(result.metadata.registerSummary?.decisionCount).toBe(1);
		expect(result.metadata.registerSummary?.blockingOpenQuestionCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('traceability metadata snapshots', () => {
	it('snapshot canonical markdown traceability metadata', () => {
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaim(), makeInferredClaim()],
				documentCanonicalId: '01-thesis',
				generatedAt: TEST_TIMESTAMP,
				generationRunId: 'gen-run-001',
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				registers: makeRegisters(),
				sources: [
					makeSource(),
					makeSource({
						sourceId: 'src-002',
						sourceType: 'profile_descriptor',
						title: 'Profile Source',
					}),
				],
			},
			{
				deterministicTimestamp: TEST_TIMESTAMP,
				projectRoot: TEST_PROJECT_ROOT,
			},
		);

		expect(metadata).toMatchSnapshot();
	});

	it('snapshot derived artifact traceability metadata', () => {
		const metadata = buildHtmlArtifactTraceabilityMetadata(
			{
				canonicalMarkdownSources: [makeSource()],
				claims: [makeClaim()],
				generatedAt: TEST_TIMESTAMP,
				generationRunId: 'gen-run-001',
				profileId: 'standard',
				registers: makeRegisters(),
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata).toMatchSnapshot();
	});

	it('snapshot validation report traceability summary', () => {
		const metadata = buildValidationReportTraceabilityMetadata(
			{
				claims: [makeClaim(), makeInferredClaim()],
				generatedAt: TEST_TIMESTAMP,
				profileId: 'standard',
				sources: [makeSource()],
				validationRunId: 'val-run-001',
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata).toMatchSnapshot();
	});

	it('snapshot generation report traceability summary', () => {
		const metadata = buildCanonicalMarkdownTraceabilityMetadata(
			{
				claims: [makeClaim()],
				documentCanonicalId: '01-thesis',
				generatedAt: TEST_TIMESTAMP,
				outputPath: 'logos/01-foundation/01-thesis.md',
				phaseId: '01-foundation',
				profileId: 'standard',
				sources: [makeSource()],
			},
			{ deterministicTimestamp: TEST_TIMESTAMP },
		);

		expect(metadata).toMatchSnapshot();
	});
});
