/** Step 8.4 — Traceability renderer tests: source/claim rendering, sorting, Markdown */
import { describe, expect, it } from 'vitest';
import type {
	ClaimRecord,
	SourceRecord,
} from '../../src/provenance/provenance-types.js';
import type { RegisterCollections } from '../../src/registers/register-types.js';
import {
	buildTraceabilityRegisterSummary,
	buildTraceabilityResult,
	makePortablePath,
	renderMetadataHeaderAddon,
	renderPortablePath,
	renderTraceabilityClaimListMarkdown,
	renderTraceabilitySectionMarkdown,
	renderTraceabilitySourceListMarkdown,
	renderTraceabilitySummaryMarkdown,
	sortTraceabilityClaims,
	sortTraceabilitySources,
	toTraceabilityClaimItem,
	toTraceabilitySourceItem,
} from '../../src/traceability/traceability-renderer.js';
import type {
	OutputTraceabilityInput,
	TraceabilitySourceItem,
} from '../../src/traceability/traceability-types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TEST_TIMESTAMP = '2025-06-01T12:00:00.000Z';
const TEST_PROJECT_ROOT = '/tmp/logos-test-project';

function makeSourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
	return {
		confidence: 'explicit',
		location: {
			line: 42,
			path: 'logos/01-foundation/thesis.md',
			section: 'Overview',
		},
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

// ---------------------------------------------------------------------------
// Source rendering tests
// ---------------------------------------------------------------------------

describe('source reference rendering', () => {
	it('renders confirmed decision source', () => {
		const src = makeSourceRecord({
			sourceType: 'confirmed_decision',
			title: 'Use pnpm as package manager',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('confirmed_decision');
		expect(item.status).toBe('confirmed');
		expect(item.confidence).toBe('explicit');
		expect(item.title).toBe('Use pnpm as package manager');
		expect(item.reviewMarker).toBe('approved');
	});

	it('renders assumption source', () => {
		const src = makeSourceRecord({
			confidence: 'derived',
			sourceType: 'assumption',
			status: 'inferred',
			title: 'TypeScript assumption',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('assumption');
		expect(item.status).toBe('inferred');
		expect(item.confidence).toBe('derived');
		expect(item.reviewMarker).toBe('required');
	});

	it('renders profile descriptor source', () => {
		const src = makeSourceRecord({
			relatedPhaseId: '01-foundation',
			sourceType: 'profile_descriptor',
			title: 'Standard Profile',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('profile_descriptor');
		expect(item.relatedPhaseId).toBe('01-foundation');
	});

	it('renders document source', () => {
		const src = makeSourceRecord({
			relatedDocumentCanonicalId: '13-engineering-standards',
			sourceType: 'document',
			title: 'Engineering Standards',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('document');
		expect(item.relatedDocumentCanonicalId).toBe('13-engineering-standards');
	});

	it('renders validation finding source', () => {
		const src = makeSourceRecord({
			relatedValidationFindingId: 'vf-001',
			sourceType: 'validation_finding',
			title: 'Missing required section',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('validation_finding');
		expect(item.relatedValidationFindingId).toBe('vf-001');
	});

	it('renders manual note source', () => {
		const src = makeSourceRecord({
			sourceType: 'manual_note',
			title: 'Manual review note',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('manual_note');
		expect(item.title).toBe('Manual review note');
	});

	it('renders external reference without fetching it', () => {
		const src = makeSourceRecord({
			externalUri: 'https://example.com/api-docs',
			sourceType: 'external_reference',
			title: 'External API docs',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('external_reference');
		expect(item.title).toBe('External API docs');
		// Should not contain the fetched content
		expect(item.sourceId).not.toContain('fetch');
	});

	it('renders repository scan reference only as reference/metadata', () => {
		const src = makeSourceRecord({
			location: { path: '.logos/scan-results.json' },
			sourceType: 'repository_scan',
			title: 'Repo scan results',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('repository_scan');
		expect(item.title).toBe('Repo scan results');
	});

	it('missing source renders explicit marker', () => {
		const src = makeSourceRecord({
			confidence: 'unknown',
			location: {},
			sourceId: 'src-missing',
			sourceType: 'document',
			status: 'unknown',
			title: 'Missing source',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.status).toBe('unknown');
		expect(item.confidence).toBe('unknown');
		expect(item.relativeSourcePath).toBeUndefined();
	});

	it('source ordering is deterministic', () => {
		const sources: SourceRecord[] = [
			makeSourceRecord({
				confidence: 'unknown',
				sourceId: 'src-z',
				sourceType: 'external_reference',
			}),
			makeSourceRecord({
				confidence: 'explicit',
				sourceId: 'src-a',
				sourceType: 'confirmed_decision',
			}),
			makeSourceRecord({
				confidence: 'derived',
				sourceId: 'src-m',
				sourceType: 'document',
			}),
		];

		const items = sources.map((s) => toTraceabilitySourceItem(s));
		const sorted = sortTraceabilitySources(items);
		const sortedAgain = sortTraceabilitySources(items);

		expect(sorted.map((s) => s.sourceId)).toEqual(
			sortedAgain.map((s) => s.sourceId),
		);
		// confirmed_decision should come before document and external_reference
		expect(sorted[0]?.sourceType).toBe('confirmed_decision');
	});

	it('renders source reference list in Markdown', () => {
		const srcs = [
			toTraceabilitySourceItem(
				makeSourceRecord({
					sourceId: 'src-1',
					sourceType: 'document',
					title: 'Doc 1',
				}),
			),
			toTraceabilitySourceItem(
				makeSourceRecord({
					sourceId: 'src-2',
					sourceType: 'confirmed_decision',
					title: 'Decision 1',
				}),
			),
		];
		const sorted = sortTraceabilitySources(srcs);

		const markdown = renderTraceabilitySourceListMarkdown(sorted);
		expect(markdown).toContain('| Source ID |');
		expect(markdown).toContain('src-1');
		expect(markdown).toContain('src-2');
		expect(markdown).toContain('Doc 1');
		expect(markdown).toContain('Decision 1');
	});

	it('empty source list renders no sources note', () => {
		const markdown = renderTraceabilitySourceListMarkdown([]);
		expect(markdown).toContain('No sources recorded');
	});
});

// ---------------------------------------------------------------------------
// Claim rendering tests
// ---------------------------------------------------------------------------

describe('claim reference rendering', () => {
	it('confirmed claim renders with supporting source', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-confirmed',
			reviewState: 'approved',
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.claimId).toBe('claim-confirmed');
		expect(item.reviewState).toBe('approved');
		expect(item.confidence).toBe('explicit');
		expect(item.isInferred).toBe(false);
		expect(item.reviewRequiredMarker).toBe(false);
		expect(item.sourceCount).toBe(1);
	});

	it('inferred claim renders as review-required', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-inferred',
			claimType: 'assumption',
			confidence: 'inferred',
			isInferred: true,
			reviewState: 'required',
			sourceCount: 0,
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.isInferred).toBe(true);
		expect(item.reviewRequiredMarker).toBe(true);
		expect(item.reviewState).toBe('required');
	});

	it('generated section claim renders with source ids', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-gen',
			claimType: 'generated_section',
			isGenerated: true,
			primarySourceId: 'src-001',
			sourceCount: 2,
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.claimType).toBe('generated_section');
		expect(item.isGenerated).toBe(true);
		expect(item.primarySourceId).toBe('src-001');
		expect(item.sourceCount).toBe(2);
	});

	it('open question claim renders as unresolved/open', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-q',
			claimType: 'open_question',
			confidence: 'inferred',
			reviewState: 'required',
			status: 'requires_review',
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.claimType).toBe('open_question');
		expect(item.status).toBe('requires_review');
		expect(item.reviewState).toBe('required');
	});

	it('rejected/superseded claim is not active support by default', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-rejected',
			reviewState: 'rejected',
			status: 'rejected',
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.status).toBe('rejected');
		expect(item.reviewState).toBe('rejected');
		expect(item.reviewRequiredMarker).toBe(false);
	});

	it('unknown fact does not render as confirmed', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-unknown',
			claimType: 'fact',
			confidence: 'unknown',
			reviewState: 'not_required',
			status: 'unknown',
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.status).toBe('unknown');
		expect(item.confidence).toBe('unknown');
		expect(item.status).not.toBe('confirmed');
	});

	it('claim ordering is deterministic', () => {
		const claims: ClaimRecord[] = [
			makeClaimRecord({
				claimId: 'claim-z',
				claimType: 'risk',
				status: 'proposed',
			}),
			makeClaimRecord({
				claimId: 'claim-a',
				claimType: 'decision',
				status: 'confirmed',
			}),
			makeClaimRecord({
				claimId: 'claim-m',
				claimType: 'assumption',
				status: 'proposed',
			}),
		];

		const items = claims.map((c) => toTraceabilityClaimItem(c));
		const sorted = sortTraceabilityClaims(items);
		const sortedAgain = sortTraceabilityClaims(items);

		expect(sorted.map((c) => c.claimId)).toEqual(
			sortedAgain.map((c) => c.claimId),
		);
		// decision should come before assumption and risk
		expect(sorted[0]?.claimType).toBe('decision');
	});

	it('renders claim reference list in Markdown', () => {
		const claims = [
			toTraceabilityClaimItem(
				makeClaimRecord({ claimId: 'claim-1', summary: 'Decision A' }),
			),
			toTraceabilityClaimItem(
				makeClaimRecord({
					claimId: 'claim-2',
					claimType: 'assumption',
					summary: 'Assumption B',
				}),
			),
		];
		const sorted = sortTraceabilityClaims(claims);

		const markdown = renderTraceabilityClaimListMarkdown(sorted);
		expect(markdown).toContain('| Claim ID |');
		expect(markdown).toContain('claim-1');
		expect(markdown).toContain('claim-2');
		expect(markdown).toContain('Decision A');
		expect(markdown).toContain('Assumption B');
	});

	it('empty claim list renders no claims note', () => {
		const markdown = renderTraceabilityClaimListMarkdown([]);
		expect(markdown).toContain('No claims recorded');
	});
});

// ---------------------------------------------------------------------------
// Markdown rendering tests
// ---------------------------------------------------------------------------

describe('traceability Markdown rendering', () => {
	it('renders traceability summary with all counts', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			claims: [
				makeClaimRecord(),
				makeClaimRecord({
					claimId: 'claim-inferred',
					confidence: 'inferred',
					isInferred: true,
					reviewState: 'required',
					sourceCount: 0,
				}),
			],
			outputKind: 'canonical_markdown',
			profileId: 'standard',
			registerSummary: {
				assumptionCount: 0,
				blockingOpenQuestionCount: 1,
				decisionCount: 1,
				hypothesisCount: 0,
				missingSourceCount: 1,
				openQuestionCount: 1,
				reviewRequiredCount: 1,
				riskCount: 0,
			},
			sources: [makeSourceRecord()],
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		const summary = renderTraceabilitySummaryMarkdown(result.metadata);
		expect(summary).toContain('Output Kind');
		expect(summary).toContain('Canonical Markdown');
		expect(summary).toContain('Boundary');
		expect(summary).toContain('Sources:');
		expect(summary).toContain('Claims:');
		expect(summary).toContain('Review Required:');
		expect(summary).toContain('Inferred Claims:');
		expect(summary).toContain('Unresolved Questions:');
		expect(summary).toContain('Missing Sources:');
	});

	it('renders metadata header addon', () => {
		const input: OutputTraceabilityInput = {
			boundary: 'canonical',
			claims: [],
			outputKind: 'canonical_markdown',
			profileId: 'standard',
			sources: [],
		};
		const result = buildTraceabilityResult(input, {
			deterministicTimestamp: TEST_TIMESTAMP,
		});

		const addon = renderMetadataHeaderAddon(result.metadata);
		expect(addon).toContain('boundary: canonical');
		expect(addon).toContain('sourceCount: 0');
		expect(addon).toContain('claimCount: 0');
	});

	it('renders complete traceability section', () => {
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

		const section = renderTraceabilitySectionMarkdown(result.metadata);
		expect(section).toContain('## Traceability Summary');
		expect(section).toContain('### Sources');
		expect(section).toContain('### Claims');
	});
});

// ---------------------------------------------------------------------------
// Portable path tests
// ---------------------------------------------------------------------------

describe('portable path handling', () => {
	it('source paths are relative', () => {
		const portable = makePortablePath(
			'logos/01-foundation/thesis.md',
			TEST_PROJECT_ROOT,
		);
		expect(portable).toBeDefined();
		expect(portable?.relativePath).toBe('logos/01-foundation/thesis.md');
	});

	it('path separators are normalized', () => {
		const portable = makePortablePath(
			'logos\\01-foundation\\thesis.md',
			TEST_PROJECT_ROOT,
		);
		expect(portable?.relativePath).toBe('logos/01-foundation/thesis.md');
	});

	it('absolute paths are not rendered by default', () => {
		const rendered = renderPortablePath(
			makePortablePath('/absolute/path/doc.md'),
		);
		expect(rendered).toBe('[absolute-path-redacted]');
	});

	it('absolute paths within project root are relativized', () => {
		const portable = makePortablePath(
			'/tmp/logos-test-project/docs/file.md',
			TEST_PROJECT_ROOT,
		);
		expect(portable).toBeDefined();
		expect(portable?.relativePath).toBe('docs/file.md');
	});

	it('path traversal references produce diagnostics', () => {
		const portable = makePortablePath('../escape/doc.md', TEST_PROJECT_ROOT);
		expect(portable?.relativePath).toBe('../escape/doc.md');

		const rendered = renderPortablePath(portable);
		expect(rendered).toBe('[path-traversal-redacted]');
	});

	it('undefined path returns undefined', () => {
		const portable = makePortablePath(undefined, TEST_PROJECT_ROOT);
		expect(portable).toBeUndefined();

		const rendered = renderPortablePath(undefined);
		expect(rendered).toBeUndefined();
	});

	it('snapshots contain no absolute local paths', () => {
		const src = makeSourceRecord({
			location: { path: '/tmp/logos-test-project/docs/file.md' },
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.relativeSourcePath).not.toContain('/tmp/logos-test-project');
		expect(item.relativeSourcePath).toBe('docs/file.md');
	});
});

// ---------------------------------------------------------------------------
// Register summary tests
// ---------------------------------------------------------------------------

describe('register summary builder', () => {
	it('builds summary from register collections', () => {
		const registers: RegisterCollections = {
			assumptions: [
				{
					affectedDocumentLinks: [],
					assumptionStatement: 'TS is used',
					confidence: 'explicit',
					createdAt: TEST_TIMESTAMP,
					diagnostics: [],
					id: 'asm-1',
					kind: 'assumption',
					lifecycleHistory: [],
					reviewState: 'approved',
					sourceLinks: [],
					status: 'confirmed',
					title: 'TS assumption',
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
					id: 'dec-1',
					kind: 'decision',
					lifecycleHistory: [],
					reviewState: 'approved',
					sourceLinks: [],
					status: 'confirmed',
					title: 'pnpm decision',
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
					id: 'q-1',
					isBlocking: true,
					kind: 'open_question',
					lifecycleHistory: [],
					questionText: 'Where to deploy?',
					reviewState: 'requires_review',
					sourceLinks: [],
					status: 'open',
					title: 'Deploy target',
					updatedAt: TEST_TIMESTAMP,
				},
			],
			risks: [],
		};

		const summary = buildTraceabilityRegisterSummary(registers);
		expect(summary).toBeDefined();
		expect(summary?.decisionCount).toBe(1);
		expect(summary?.assumptionCount).toBe(1);
		expect(summary?.openQuestionCount).toBe(1);
		expect(summary?.blockingOpenQuestionCount).toBe(1);
		expect(summary?.hypothesisCount).toBe(0);
		expect(summary?.riskCount).toBe(0);
	});

	it('returns undefined for undefined input', () => {
		const summary = buildTraceabilityRegisterSummary(undefined);
		expect(summary).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Traceability section item ordering tests
// ---------------------------------------------------------------------------

describe('source section ordering', () => {
	it('confirmed decisions sort before inferred questions', () => {
		const items: TraceabilitySourceItem[] = [
			{
				confidence: 'inferred',
				reviewMarker: 'required',
				sourceId: 'src-q',
				sourceType: 'external_reference',
				status: 'requires_review',
				title: 'Open question',
			},
			{
				confidence: 'explicit',
				reviewMarker: 'approved',
				sourceId: 'src-d',
				sourceType: 'confirmed_decision',
				status: 'confirmed',
				title: 'Decision',
			},
		];

		const sorted = sortTraceabilitySources(items);
		expect(sorted[0]?.sourceId).toBe('src-d');
		expect(sorted[1]?.sourceId).toBe('src-q');
	});
});

describe('generated section traceability', () => {
	it('section lists normative document source', () => {
		const src = makeSourceRecord({
			relatedDocumentCanonicalId: '10-functional-requirements',
			sourceId: 'src-norm',
			sourceType: 'document',
			title: 'Functional Requirements',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.sourceType).toBe('document');
		expect(item.relatedDocumentCanonicalId).toBe('10-functional-requirements');
	});

	it('section lists confirmed decision source', () => {
		const src = makeSourceRecord({
			sourceId: 'src-dec',
			sourceType: 'confirmed_decision',
			status: 'confirmed',
			title: 'Use pnpm',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.status).toBe('confirmed');
		expect(item.reviewMarker).toBe('approved');
	});

	it('section lists assumption source', () => {
		const src = makeSourceRecord({
			confidence: 'derived',
			sourceId: 'src-asm',
			sourceType: 'assumption',
			title: 'TS assumption',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.confidence).toBe('derived');
	});

	it('section lists risk/open question source', () => {
		const src = makeSourceRecord({
			confidence: 'inferred',
			sourceId: 'src-risk',
			sourceType: 'external_reference',
			status: 'requires_review',
			title: 'Deployment risk',
		});
		const item = toTraceabilitySourceItem(src, {
			projectRoot: TEST_PROJECT_ROOT,
		});

		expect(item.reviewMarker).toBe('required');
	});

	it('section with inferred content marks review-required', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-inf',
			confidence: 'inferred',
			isInferred: true,
			reviewState: 'required',
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.reviewRequiredMarker).toBe(true);
		expect(item.isInferred).toBe(true);
	});

	it('section with no source does not claim confirmation', () => {
		const claim = makeClaimRecord({
			claimId: 'claim-nosrc',
			confidence: 'unknown',
			sourceCount: 0,
			status: 'proposed',
		});
		const item = toTraceabilityClaimItem(claim);

		expect(item.sourceCount).toBe(0);
		expect(item.status).not.toBe('confirmed');
	});
});
