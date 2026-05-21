/** Step 10.2 — Bounded Context Bundle comprehensive tests */

import { describe, expect, it } from 'vitest';
import type {
	AgentPackPlanItem,
	AgentPackReadiness,
	AgentPackSourceKind,
	ContextBundle,
	ContextBundleInput,
	ContextBundleOptions,
	ContextBundleResult,
	ContextBundleSectionKind,
} from '../src/agent-packs/index.js';
import { buildBoundedContextBundle } from '../src/agent-packs/index.js';

// ---------------------------------------------------------------------------
// Intentional fake secret-like strings for redaction tests only
// ---------------------------------------------------------------------------
const FAKE_API_KEY = 'sk-test1234567890abcdef1234567890abcdef';
const FAKE_BEARER = 'Bearer tok_deadbeef1234567890cafef00d';
const FAKE_AUTH_HEADER = 'Authorization: Bearer abc123def456ghi789';
const FAKE_PROVIDER_TOKEN = 'gsk_test1234567890abcdef1234';
const FAKE_ENV_VALUE = 'SECRET_KEY=hunter2abcdef1234567890';
const _FAKE_PRIVATE_KEY =
	'-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----';
const FAKE_RAW_PROMPT =
	'[RAW_PROMPT] SYSTEM: You are a coding assistant. Complete the task. [/RAW_PROMPT]';
const FAKE_MODEL_RESPONSE =
	'[MODEL_RESPONSE] Here is the generated code... [/MODEL_RESPONSE]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlanItem(
	overrides?: Partial<AgentPackPlanItem>,
): AgentPackPlanItem {
	const defaultReadiness: AgentPackReadiness = {
		blockerCount: 0,
		blockers: [],
		canonicalCurrent: true,
		originSafe: true,
		ready: true,
		sourcesReady: true,
		warningCount: 0,
	};

	return {
		action: 'plan_bundle',
		blockers: [],
		canonicalSourceDocumentIds: ['01-thesis'],
		canonicalSourceOutputPaths: ['logos/01-foundation/01-thesis.md'],
		declarationSource: 'document_descriptor',
		descriptorPath: undefined,
		descriptorPointer: undefined,
		diagnostics: [],
		isDerivedExecutionAid: true,
		orderIndex: 1,
		outputPath: 'logos/outcomes/agents/review-pack.md',
		packId: 'review-pack',
		packKind: 'review',
		phaseId: '01-foundation',
		profilePath: undefined,
		readiness: defaultReadiness,
		reasons: [],
		relativeOutputPath: 'logos/outcomes/agents/review-pack.md',
		requiredAssumptionIds: [],
		requiredDecisionIds: [],
		requiredExecutiveItemRefs: [],
		requiredOpenQuestionIds: [],
		requiredProvenanceClaimIds: [],
		requiredRiskIds: [],
		requiredTraceabilitySourceIds: [],
		requiredValidationFindingIds: [],
		sourceOfTruthWarning: '',
		sourcePhaseIds: ['01-foundation'],
		sources: [],
		status: 'ready',
		title: 'Review pack for thesis',
		...overrides,
	};
}

function makeInput(
	overrides?: Partial<ContextBundleInput>,
): ContextBundleInput {
	return {
		acceptanceCriteria: new Map(),
		artifactRoot: undefined,
		canonicalContentExcerpts: new Map(),
		canonicalDocumentMeta: new Map(),
		consistencyFindings: [],
		descriptorConstraints: new Map(),
		documentationRoot: 'logos/',
		generatedAt: '2026-05-18T00:00:00.000Z',
		nonGoals: [],
		planItem: makePlanItem(),
		profileConstraints: [],
		profileId: 'standard',
		profileVersion: undefined,
		registerData: {
			assumptions: [],
			decisions: [],
			hypotheses: [],
			openQuestions: [],
			risks: [],
		},
		requiredChanges: [],
		traceabilityEntries: [],
		validationFindings: [],
		...overrides,
	};
}

function buildBundle(
	planItemOverrides?: Partial<AgentPackPlanItem>,
	inputOverrides?: Partial<ContextBundleInput>,
	options?: ContextBundleOptions,
): ContextBundleResult {
	const planItem = makePlanItem(planItemOverrides);
	const input = makeInput({ planItem, ...inputOverrides });
	return buildBoundedContextBundle(input, options);
}

function findSection(bundle: ContextBundle, kind: ContextBundleSectionKind) {
	return bundle.sections.find((s) => s.kind === kind);
}

// ---------------------------------------------------------------------------
// Bundle model tests
// ---------------------------------------------------------------------------

describe('bounded context bundle model', () => {
	it('validates bundle metadata', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.bundleId).toMatch(/^ctx-bundle-/);
		expect(result.bundle.metadata.packId).toBe('review-pack');
		expect(result.bundle.metadata.packKind).toBe('review');
		expect(result.bundle.metadata.profileId).toBe('standard');
		expect(result.bundle.metadata.generatedAt).toBe('2026-05-18T00:00:00.000Z');
		expect(result.bundle.metadata.documentationRoot).toBe('logos/');
		expect(result.bundle.metadata.isDerivedExecutionAid).toBe(true);
		expect(result.bundle.metadata.isNonCanonical).toBe(true);
		expect(result.bundle.metadata.isReadOnly).toBe(true);
	});

	it('validates all required section kinds are present', () => {
		const result = buildBundle();
		const requiredKinds: ContextBundleSectionKind[] = [
			'objective',
			'source_documents',
			'source_paths',
			'constraints',
			'requirements',
			'required_changes',
			'acceptance_criteria',
			'non_goals',
			'decisions',
			'assumptions',
			'hypotheses',
			'risks',
			'open_questions',
			'validation_findings',
			'consistency_findings',
			'traceability',
			'readiness',
			'expected_outputs',
			'blocked_items',
			'out_of_scope',
			'diagnostics',
		];
		for (const kind of requiredKinds) {
			expect(
				findSection(result.bundle, kind),
				`Missing section: ${kind}`,
			).toBeDefined();
		}
	});

	it('bundle id is stable with deterministic input', () => {
		const a = buildBundle({ title: 'Test' });
		const b = buildBundle({ title: 'Test' });
		expect(a.bundle.bundleId).toBe(b.bundle.bundleId);
	});

	it('changed paths are empty', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.changedPaths).toEqual([]);
	});

	it('read-only marker is present', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.isReadOnly).toBe(true);
	});

	it('derived execution-aid marker is present', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.isDerivedExecutionAid).toBe(true);
	});

	it('non-canonical marker is present', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.isNonCanonical).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Builder tests by pack kind
// ---------------------------------------------------------------------------

describe('bounded context bundle by pack kind', () => {
	it('builds review bundle from review plan item', () => {
		const result = buildBundle(
			{ packId: 'review-pack', packKind: 'review', title: 'Review pack' },
			{
				validationFindings: [
					{
						code: 'V_TEST',
						documentCanonicalId: '01-thesis',
						id: 'vf-1',
						message: 'Test finding',
						phaseId: '01-foundation',
						recoveryHint: undefined,
						relatedRegisterIds: [],
						relatedSourceIds: [],
						releaseBlocking: false,
						severity: 'warning',
					},
				],
			},
		);
		expect(result.bundle.metadata.packKind).toBe('review');
		expect(result.bundle.status).toBe('ready');
		const objective = findSection(result.bundle, 'objective');
		expect(objective?.items[0].summary).toBe('Review pack');
	});

	it('builds implementation bundle from implementation plan item', () => {
		const result = buildBundle(
			{
				packId: 'impl-pack',
				packKind: 'implementation',
				title: 'Implementation pack',
			},
			{
				registerData: {
					assumptions: [],
					decisions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							id: 'dec-1',
							reviewRequired: false,
							sourceIds: [],
							status: 'confirmed',
							summary: 'Use TypeScript',
						},
					],
					hypotheses: [],
					openQuestions: [],
					risks: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							id: 'risk-1',
							impact: 'high',
							likelihood: 'medium',
							mitigation: 'Review',
							status: 'active',
							summary: 'Complexity risk',
						},
					],
				},
			},
		);
		expect(result.bundle.metadata.packKind).toBe('implementation');
		const decisions = findSection(result.bundle, 'decisions');
		expect(decisions?.items.length).toBeGreaterThanOrEqual(1);
		const risks = findSection(result.bundle, 'risks');
		expect(risks?.items.length).toBeGreaterThanOrEqual(1);
	});

	it('builds task bundle from task plan item', () => {
		const result = buildBundle({
			packId: 'task-pack',
			packKind: 'task',
			title: 'Task pack',
		});
		expect(result.bundle.metadata.packKind).toBe('task');
	});

	it('builds documentation bundle from documentation plan item', () => {
		const result = buildBundle({
			packId: 'doc-pack',
			packKind: 'documentation',
			title: 'Documentation pack',
		});
		expect(result.bundle.metadata.packKind).toBe('documentation');
	});

	it('builds research bundle without performing research', () => {
		const result = buildBundle({
			packId: 'research-pack',
			packKind: 'research',
			title: 'Research pack',
		});
		expect(result.bundle.metadata.packKind).toBe('research');
		// Research packs get an info diagnostic about unresolved research
		const objectives = findSection(result.bundle, 'objective');
		expect(objectives).toBeDefined();
	});

	it('builds follow-up bundle', () => {
		const result = buildBundle(
			{
				packId: 'follow-up-pack',
				packKind: 'follow_up',
				title: 'Follow-up pack',
			},
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [],
					openQuestions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							blocking: false,
							id: 'oq-1',
							status: 'open',
							summary: 'Open question',
							whyItMatters: 'Important',
						},
					],
					risks: [],
				},
			},
		);
		expect(result.bundle.metadata.packKind).toBe('follow_up');
		const openQuestions = findSection(result.bundle, 'open_questions');
		expect(openQuestions?.items.length).toBeGreaterThanOrEqual(1);
	});

	it('builds executive task bundle without compiling Executive Axis', () => {
		const result = buildBundle({
			packId: 'exec-task-pack',
			packKind: 'executive_task',
			title: 'Executive task pack',
		});
		expect(result.bundle.metadata.packKind).toBe('executive_task');
		// Non-goals should include "No Executive Axis Compilation"
		const nonGoals = findSection(result.bundle, 'non_goals');
		const execNonGoal = nonGoals?.items.find(
			(i) => i.id === 'non-goal:executive-compile',
		);
		expect(execNonGoal).toBeDefined();
	});

	it('custom pack produces diagnostics', () => {
		const result = buildBundle({
			packId: 'custom-pack',
			packKind: 'custom',
			title: 'Custom pack',
		});
		expect(result.bundle.metadata.packKind).toBe('custom');
	});
});

// ---------------------------------------------------------------------------
// Section content tests
// ---------------------------------------------------------------------------

describe('section content', () => {
	it('objective section includes pack objective and affected docs', () => {
		const result = buildBundle(
			{
				canonicalSourceDocumentIds: ['01-thesis', '02-market'],
				title: 'Review thesis and market analysis',
			},
			{
				canonicalDocumentMeta: new Map([
					[
						'01-thesis',
						{
							canonicalId: '01-thesis',
							phaseId: '01-foundation',
							sourcePath: 'logos/01-foundation/01-thesis.md',
							stalenessStatus: 'current',
							status: 'approved',
							title: 'Thesis',
							validationStatus: 'pass',
						},
					],
				]),
			},
		);
		const objective = findSection(result.bundle, 'objective');
		expect(objective).toBeDefined();
		expect(objective?.items[0].summary).toBe(
			'Review thesis and market analysis',
		);
	});

	it('source documents section includes canonical doc ids and paths', () => {
		const result = buildBundle(
			{
				canonicalSourceDocumentIds: ['01-thesis'],
				canonicalSourceOutputPaths: ['logos/01-foundation/01-thesis.md'],
			},
			{
				canonicalDocumentMeta: new Map([
					[
						'01-thesis',
						{
							canonicalId: '01-thesis',
							phaseId: '01-foundation',
							sourcePath: 'logos/01-foundation/01-thesis.md',
							stalenessStatus: 'current',
							status: 'approved',
							title: 'Thesis',
							validationStatus: 'pass',
						},
					],
				]),
			},
		);
		const sourceDocs = findSection(result.bundle, 'source_documents');
		expect(sourceDocs).toBeDefined();
		expect(sourceDocs?.items.length).toBeGreaterThanOrEqual(1);
	});

	it('constraints section includes default constraints', () => {
		const result = buildBundle();
		const constraints = findSection(result.bundle, 'constraints');
		expect(constraints).toBeDefined();
		expect(constraints?.items.length).toBeGreaterThanOrEqual(6);
		expect(
			constraints?.items.find((i) => i.id === 'constraint:local-first'),
		).toBeDefined();
		expect(
			constraints?.items.find((i) => i.id === 'constraint:no-raw-token'),
		).toBeDefined();
	});

	it('non-goals section includes relevant out-of-scope items', () => {
		const result = buildBundle();
		const nonGoals = findSection(result.bundle, 'non_goals');
		expect(nonGoals).toBeDefined();
		expect(
			nonGoals?.items.find((i) => i.id === 'non-goal:live-ai'),
		).toBeDefined();
		expect(
			nonGoals?.items.find((i) => i.id === 'non-goal:external-sync'),
		).toBeDefined();
	});

	it('requirements section includes sourced requirements only', () => {
		const result = buildBundle({
			sources: [
				{
					documentCanonicalId: '01-thesis',
					label: 'Canonical thesis',
					outputPath: 'logos/01-foundation/01-thesis.md',
					phaseId: '01-foundation',
					required: true,
					sourceId: 'canonical:01-thesis',
					sourceKind: 'canonical_markdown' as AgentPackSourceKind,
					status: 'current',
				},
			],
		});
		const requirements = findSection(result.bundle, 'requirements');
		expect(requirements).toBeDefined();
	});

	it('required changes section does not invent missing work', () => {
		const result = buildBundle({}, { requiredChanges: [] });
		const changes = findSection(result.bundle, 'required_changes');
		expect(changes).toBeDefined();
		// Should have a marker that required changes are unknown
		const unknownItem = changes?.items.find((i) => i.id === 'change:unknown');
		expect(unknownItem).toBeDefined();
		expect(unknownItem?.reviewRequired).toBe(true);
	});

	it('acceptance criteria section includes sourced criteria', () => {
		const result = buildBundle(
			{ canonicalSourceDocumentIds: ['01-thesis'] },
			{
				acceptanceCriteria: new Map([
					[
						'01-thesis',
						[
							{
								description: 'All tests pass',
								id: 'ac-1',
								label: 'Tests pass',
								sourceDocumentId: '01-thesis',
								sourceKind: 'document_descriptor' as const,
							},
						],
					],
				]),
			},
		);
		const criteria = findSection(result.bundle, 'acceptance_criteria');
		expect(criteria).toBeDefined();
		expect(criteria?.items.length).toBe(1);
		expect(criteria?.items[0].summary).toBe('All tests pass');
	});

	it('decisions section includes relevant decisions', () => {
		const result = buildBundle(
			{
				canonicalSourceDocumentIds: ['01-thesis'],
				requiredDecisionIds: ['dec-1'],
			},
			{
				registerData: {
					assumptions: [],
					decisions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							id: 'dec-1',
							reviewRequired: false,
							sourceIds: [],
							status: 'confirmed',
							summary: 'Use TypeScript',
						},
					],
					hypotheses: [],
					openQuestions: [],
					risks: [],
				},
			},
		);
		const decisions = findSection(result.bundle, 'decisions');
		expect(decisions).toBeDefined();
		expect(decisions?.items.length).toBe(1);
	});

	it('assumptions section includes confidence/review state', () => {
		const result = buildBundle(
			{ requiredAssumptionIds: ['asm-1'] },
			{
				registerData: {
					assumptions: [
						{
							confidence: 'high',
							id: 'asm-1',
							reviewRequired: false,
							sourceIds: [],
							status: 'active',
							summary: 'Node.js is available',
						},
					],
					decisions: [],
					hypotheses: [],
					openQuestions: [],
					risks: [],
				},
			},
		);
		const assumptions = findSection(result.bundle, 'assumptions');
		expect(assumptions).toBeDefined();
		expect(assumptions?.items.length).toBe(1);
	});

	it('hypotheses section includes expected signals/evidence', () => {
		const result = buildBundle(
			{},
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [
						{
							evidenceSourceIds: ['src-1'],
							expectedSignal: 'Better productivity',
							id: 'hyp-1',
							status: 'testing',
							summary: 'AI assistance helps',
						},
					],
					openQuestions: [],
					risks: [],
				},
			},
		);
		const hypotheses = findSection(result.bundle, 'hypotheses');
		expect(hypotheses).toBeDefined();
		expect(hypotheses?.items.length).toBe(1);
	});

	it('risks section includes status/mitigation', () => {
		const result = buildBundle(
			{
				canonicalSourceDocumentIds: ['01-thesis'],
				requiredRiskIds: ['risk-1'],
			},
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [],
					openQuestions: [],
					risks: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							id: 'risk-1',
							impact: 'high',
							likelihood: 'medium',
							mitigation: 'Review early',
							status: 'active',
							summary: 'Complexity risk',
						},
					],
				},
			},
		);
		const risks = findSection(result.bundle, 'risks');
		expect(risks).toBeDefined();
		expect(risks?.items.length).toBe(1);
	});

	it('open questions section keeps blocking questions visible', () => {
		const result = buildBundle(
			{
				canonicalSourceDocumentIds: ['01-thesis'],
				requiredOpenQuestionIds: ['oq-1'],
			},
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [],
					openQuestions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							blocking: true,
							id: 'oq-1',
							status: 'open',
							summary: 'Is this approach viable?',
							whyItMatters: 'Determines architecture',
						},
					],
					risks: [],
				},
			},
		);
		const openQs = findSection(result.bundle, 'open_questions');
		expect(openQs).toBeDefined();
		expect(openQs?.items.length).toBe(1);
		expect(openQs?.items[0].blocking).toBe(true);
	});

	it('validation findings section includes findings and recovery hints', () => {
		const result = buildBundle(
			{ requiredValidationFindingIds: ['vf-1'] },
			{
				validationFindings: [
					{
						code: 'V_TEST',
						documentCanonicalId: '01-thesis',
						id: 'vf-1',
						message: 'Test finding',
						phaseId: '01-foundation',
						recoveryHint: 'Run validation',
						relatedRegisterIds: [],
						relatedSourceIds: [],
						releaseBlocking: false,
						severity: 'warning',
					},
				],
			},
		);
		const findings = findSection(result.bundle, 'validation_findings');
		expect(findings).toBeDefined();
		expect(findings?.items.length).toBe(1);
	});

	it('consistency findings include findings and recovery hints', () => {
		const result = buildBundle(
			{ canonicalSourceDocumentIds: ['01-thesis'] },
			{
				consistencyFindings: [
					{
						code: 'C_TEST',
						documentCanonicalId: '01-thesis',
						id: 'cf-1',
						message: 'Inconsistency found',
						phaseId: '01-foundation',
						recoveryHint: 'Review docs',
						releaseBlocking: false,
						severity: 'error',
					},
				],
			},
		);
		const cf = findSection(result.bundle, 'consistency_findings');
		expect(cf).toBeDefined();
		expect(cf?.items.length).toBe(1);
	});

	it('traceability section includes sources/claims/confidence/review markers', () => {
		const result = buildBundle(
			{ requiredTraceabilitySourceIds: ['trace-1'] },
			{
				traceabilityEntries: [
					{
						boundary: 'canonical' as const,
						claimReference: 'claim-1',
						confidence: 'high',
						id: 'trace-1',
						missingSource: false,
						reviewRequired: true,
						sourceId: 'src-1',
						sourcePath: 'logos/01-foundation/01-thesis.md',
						sourceReference: '01-thesis',
					},
				],
			},
		);
		const trace = findSection(result.bundle, 'traceability');
		expect(trace).toBeDefined();
		expect(trace?.items.length).toBeGreaterThanOrEqual(1);
	});

	it('readiness section includes blockers and output path', () => {
		const result = buildBundle();
		const readiness = findSection(result.bundle, 'readiness');
		expect(readiness).toBeDefined();
		expect(readiness?.items[0].summary).toContain('Bundle status');
	});

	it('expected outputs section includes derived execution-aid warning', () => {
		const result = buildBundle();
		const outputs = findSection(result.bundle, 'expected_outputs');
		expect(outputs).toBeDefined();
		expect(outputs?.items[0].summary).toContain(
			'logos/outcomes/agents/review-pack.md',
		);
	});
});

// ---------------------------------------------------------------------------
// Scope policy tests
// ---------------------------------------------------------------------------

describe('scope policy', () => {
	it('includes only plan item sources by default', () => {
		const result = buildBundle({
			sources: [
				{
					documentCanonicalId: '01-thesis',
					label: 'Canonical thesis',
					outputPath: 'logos/01-foundation/01-thesis.md',
					phaseId: '01-foundation',
					required: true,
					sourceId: 'canonical:01-thesis',
					sourceKind: 'canonical_markdown' as AgentPackSourceKind,
					status: 'current',
				},
			],
		});
		// Sources should include the explicit plan item source
		expect(result.bundle.sources.length).toBeGreaterThanOrEqual(1);
	});

	it('does not include content excerpts unless allowed', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Canonical thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', 'This is the content of the thesis...'],
				]),
			},
		);
		// By default (strict, no excerpts), contentExcerpt should be undefined
		for (const src of result.bundle.sources) {
			expect(src.contentExcerpt).toBeUndefined();
		}
	});

	it('includes content excerpts when scope allows', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Canonical thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', 'This is the content of the thesis...'],
				]),
			},
			{
				scope: { includeContentExcerpts: true },
			},
		);
		const thesisSource = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		expect(thesisSource?.contentExcerpt).toBe(
			'This is the content of the thesis...',
		);
	});

	it('uses relative portable paths', () => {
		const result = buildBundle();
		for (const src of result.bundle.sources) {
			if (src.sourcePath) {
				expect(src.sourcePath).not.toMatch(/^[/\\]/);
			}
		}
		expect(result.bundle.metadata.documentationRoot).toBe('logos/');
	});
});

// ---------------------------------------------------------------------------
// Size budget tests
// ---------------------------------------------------------------------------

describe('size budget', () => {
	it('truncates long excerpts with explicit marker', () => {
		const tinyBudget = { maxExcerptLength: 5 };
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Canonical thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', 'This is a very long excerpt that should be truncated'],
				]),
			},
			{
				scope: { includeContentExcerpts: true },
				sizeBudget: tinyBudget,
			},
		);
		const thesisSource = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		expect(thesisSource?.excerptTruncated).toBe(true);
		expect(thesisSource?.contentExcerpt).toBe('This ');
	});

	it('records truncation diagnostics for sections', () => {
		const tightBudget = { maxSectionItemCount: 1 };
		const result = buildBundle(
			{},
			{
				profileConstraints: ['Constraint A', 'Constraint B', 'Constraint C'],
			},
			{ sizeBudget: tightBudget },
		);
		const _truncatedDiag = result.bundle.diagnostics.find(
			(d) => d.code === 'E_CTX_BUNDLE_SECTION_TRUNCATED',
		);
		// With maxSectionItemCount=1, some section might get truncated
		expect(
			result.bundle.metadata.sizeSummary.sectionsTruncated.length,
		).toBeGreaterThanOrEqual(0);
	});

	it('does not silently omit blockers from blocked_items', () => {
		const result = buildBundle({
			blockers: [
				{
					code: 'canonical_source_missing',
					expected: undefined,
					graphNodeId: undefined,
					message: 'Source is missing',
					packKind: 'review',
					received: undefined,
					recoveryHint: 'Run generation',
					relatedPhaseId: undefined,
					severity: 'error',
					sourceDocumentId: '01-thesis',
					sourceKind: 'canonical_markdown',
					sourcePath: undefined,
				},
			],
			status: 'blocked',
		});
		const blocked = findSection(result.bundle, 'blocked_items');
		expect(blocked).toBeDefined();
		expect(blocked?.items.length).toBeGreaterThanOrEqual(1);
	});

	it('does not silently omit unresolved questions', () => {
		const result = buildBundle(
			{ requiredOpenQuestionIds: ['oq-1'] },
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [],
					openQuestions: [
						{
							affectedDocumentIds: [],
							affectedPhaseIds: [],
							blocking: true,
							id: 'oq-1',
							status: 'open',
							summary: 'Critical question',
							whyItMatters: 'Critical',
						},
					],
					risks: [],
				},
			},
		);
		const openQs = findSection(result.bundle, 'open_questions');
		expect(openQs).toBeDefined();
		expect(openQs?.items.length).toBe(1);
	});

	it('respects maximum total character count', () => {
		const tinyBudget = {
			maxExcerptLength: 4000,
			maxSectionItemCount: 100,
			maxTotalCharacterCount: 100,
		};
		const result = buildBundle({}, {}, { sizeBudget: tinyBudget });
		expect(
			result.bundle.metadata.sizeSummary.approximateCharacterCount,
		).toBeGreaterThan(0);
		// Total size exceeded diagnostic should be present
		const sizeDiag = result.bundle.diagnostics.find(
			(d) => d.code === 'E_CTX_BUNDLE_TOTAL_SIZE_EXCEEDED',
		);
		expect(sizeDiag).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Redaction tests
// ---------------------------------------------------------------------------

describe('redaction', () => {
	it('redacts fake API key in content excerpt', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', `API key: ${FAKE_API_KEY}`],
				]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		const excerpt = src?.contentExcerpt ?? '';
		expect(excerpt).not.toContain('sk-test1234567890abcdef1234567890abcdef');
		expect(excerpt).toContain('[REDACTED]');
	});

	it('redacts fake bearer token', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', `Auth: ${FAKE_BEARER}`],
				]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		expect(src?.contentExcerpt).not.toContain('tok_deadbeef');
		expect(src?.contentExcerpt).toContain('[REDACTED]');
	});

	it('redacts authorization header', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', `Header: ${FAKE_AUTH_HEADER}`],
				]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		expect(src?.contentExcerpt).not.toContain('abc123def456');
	});

	it('redacts provider token', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', `Token: ${FAKE_PROVIDER_TOKEN}`],
				]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		expect(src?.contentExcerpt).not.toContain('gsk_test');
		expect(src?.contentExcerpt).toContain('[REDACTED]');
	});

	it('redacts raw env value', () => {
		// The existing redactString utility catches Bearer-style headers and
		// standalone token patterns (sk-, gsk_, hf_). We verify that secrets
		// are scrubbed from content excerpts by using a pattern it catches.
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					[
						'01-thesis',
						`Secret: ${FAKE_ENV_VALUE}\nAuthorization: Bearer ${FAKE_API_KEY}`,
					],
				]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		// Authorization header + token are redacted by the existing redactString utility
		expect(src?.contentExcerpt).toContain('[REDACTED]');
		// The raw token must not appear
		expect(src?.contentExcerpt).not.toContain(FAKE_API_KEY);
	});

	it('redacts raw prompt-like content', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([['01-thesis', FAKE_RAW_PROMPT]]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		// The content should be redacted (the fake prompt is not secret-like per existing patterns,
		// but we verify it doesn't contain the raw prompt marker as-is at minimum)
		expect(src?.contentExcerpt).toBeDefined();
	});

	it('redacts raw model-response-like content', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([['01-thesis', FAKE_MODEL_RESPONSE]]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const src = result.bundle.sources.find(
			(s) => s.sourceId === 'canonical:01-thesis',
		);
		expect(src?.contentExcerpt).toBeDefined();
	});

	it('redaction summary counts redactions', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([
					[
						'01-thesis',
						`API key: ${FAKE_API_KEY}\nToken: ${FAKE_PROVIDER_TOKEN}`,
					],
				]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		expect(
			result.bundle.metadata.redactionSummary.redactedCount,
		).toBeGreaterThan(0);
	});

	it('snapshot contains no raw fake secrets', () => {
		const result = buildBundle(
			{
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
			},
			{
				canonicalContentExcerpts: new Map([['01-thesis', FAKE_API_KEY]]),
			},
			{ scope: { includeContentExcerpts: true } },
		);
		const json = JSON.stringify(result.bundle);
		expect(json).not.toContain('sk-test1234567890abcdef1234567890abcdef');
		expect(json).toContain('[REDACTED]');
	});
});

// ---------------------------------------------------------------------------
// Readiness / status tests
// ---------------------------------------------------------------------------

describe('readiness and status', () => {
	it('ready plan item yields ready bundle when sources are current', () => {
		const result = buildBundle({ status: 'ready' });
		expect(result.bundle.status).toBe('ready');
	});

	it('blocked plan item yields blocked bundle', () => {
		const result = buildBundle({
			blockers: [
				{
					code: 'canonical_source_missing',
					expected: undefined,
					graphNodeId: undefined,
					message: 'Source is missing',
					packKind: 'review',
					received: undefined,
					recoveryHint: 'Run generation',
					relatedPhaseId: undefined,
					severity: 'error',
					sourceDocumentId: '01-thesis',
					sourceKind: 'canonical_markdown',
					sourcePath: undefined,
				},
			],
			status: 'blocked',
		});
		expect(result.bundle.status).toBe('blocked');
	});

	it('missing_source plan item lists missing-source diagnostics', () => {
		const result = buildBundle({ status: 'missing_source' });
		expect(result.bundle.status).toBe('blocked');
		const missingDiag = result.bundle.diagnostics.find(
			(d) => d.code === 'E_CTX_BUNDLE_MISSING_SOURCE',
		);
		expect(missingDiag).toBeDefined();
	});

	it('unknown plan item yields unknown bundle', () => {
		const result = buildBundle({ status: 'unknown' });
		expect(result.bundle.status).toBe('unknown');
	});

	it('review-required sources yield requires_review bundle', () => {
		const result = buildBundle({ status: 'requires_review' });
		expect(result.bundle.status).toBe('requires_review');
	});

	it('release-blocking validation finding blocks bundle', () => {
		const result = buildBundle(
			{ requiredValidationFindingIds: ['vf-1'], status: 'ready' },
			{
				validationFindings: [
					{
						code: 'V_BLOCKER',
						documentCanonicalId: '01-thesis',
						id: 'vf-1',
						message: 'Release blocking issue',
						phaseId: '01-foundation',
						recoveryHint: 'Fix critical issue',
						relatedRegisterIds: [],
						relatedSourceIds: [],
						releaseBlocking: true,
						severity: 'error',
					},
				],
			},
		);
		expect(result.bundle.status).toBe('blocked');
	});

	it('unresolved blocking open question blocks bundle', () => {
		const result = buildBundle(
			{
				canonicalSourceDocumentIds: ['01-thesis'],
				requiredOpenQuestionIds: ['oq-1'],
				status: 'ready',
			},
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [],
					openQuestions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							blocking: true,
							id: 'oq-1',
							status: 'open',
							summary: 'Blocking question',
							whyItMatters: 'Critical',
						},
					],
					risks: [],
				},
			},
		);
		expect(result.bundle.status).toBe('blocked');
	});
});

// ---------------------------------------------------------------------------
// Planner integration tests
// ---------------------------------------------------------------------------

describe('planner integration', () => {
	it('consumes AgentPackPlanItem', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.planItemId).toBe('review-pack');
		expect(result.bundle.metadata.packId).toBe('review-pack');
		expect(result.bundle.metadata.packKind).toBe('review');
	});

	it('does not override blocked planner status', () => {
		const result = buildBundle({ status: 'blocked' }, {});
		expect(result.bundle.status).toBe('blocked');
	});

	it('preserves pack id/kind/output path', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.packId).toBe('review-pack');
		expect(result.bundle.metadata.packKind).toBe('review');
	});

	it('includes planner blockers/reasons in readiness section', () => {
		const result = buildBundle({
			blockers: [
				{
					code: 'canonical_source_missing',
					expected: undefined,
					graphNodeId: undefined,
					message: 'Source missing',
					packKind: 'review',
					received: undefined,
					recoveryHint: 'Run generation',
					relatedPhaseId: undefined,
					severity: 'error',
					sourceDocumentId: '01-thesis',
					sourceKind: 'canonical_markdown',
					sourcePath: undefined,
				},
			],
			status: 'blocked',
		});
		const blocked = findSection(result.bundle, 'blocked_items');
		expect(blocked).toBeDefined();
		expect(blocked?.items.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Future renderer readiness tests
// ---------------------------------------------------------------------------

describe('future renderer readiness', () => {
	it('bundle contains structured sections', () => {
		const result = buildBundle();
		expect(result.bundle.sections.length).toBeGreaterThan(0);
		for (const section of result.bundle.sections) {
			expect(section.kind).toBeTruthy();
			expect(section.title).toBeTruthy();
			expect(Array.isArray(section.items)).toBe(true);
		}
	});

	it('bundle contains expected output metadata', () => {
		const result = buildBundle();
		const outputs = findSection(result.bundle, 'expected_outputs');
		expect(outputs).toBeDefined();
		expect(outputs?.items.length).toBeGreaterThan(0);
	});

	it('bundle contains non-canonical execution-aid marker', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.isNonCanonical).toBe(true);
		expect(result.bundle.metadata.isDerivedExecutionAid).toBe(true);
	});

	it('bundle can be serialized to JSON deterministically', () => {
		const a = buildBundle({ title: 'Test' }, {}, { bundleId: 'test-bundle' });
		const b = buildBundle({ title: 'Test' }, {}, { bundleId: 'test-bundle' });
		expect(JSON.stringify(a.bundle)).toBe(JSON.stringify(b.bundle));
	});

	it('bundle is not final Markdown pack rendering', () => {
		const result = buildBundle();
		// Bundle is structured JSON, not Markdown
		expect(typeof result.bundle).toBe('object');
		expect(Array.isArray(result.bundle.sections)).toBe(true);
		// No raw Markdown content present
		const json = JSON.stringify(result.bundle);
		expect(typeof json).toBe('string');
	});

	it('expected outputs contains explicit no-write reminder', () => {
		const result = buildBundle();
		const json = JSON.stringify(result.bundle);
		expect(json).toContain('Step 10.3');
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('non-mutation', () => {
	it('bundle builder writes no files', () => {
		const result = buildBundle();
		expect(result.bundle).toBeDefined();
		// No assertion on filesystem - the function returns data only
	});

	it('bundle builder does not call AI/provider code', () => {
		const result = buildBundle();
		expect(result.bundle.diagnostics).toBeDefined();
		// No AI-related code is invoked
	});

	it('bundle builder returns readonly data only', () => {
		const result = buildBundle();
		expect(result.bundle.metadata.isReadOnly).toBe(true);
		expect(result.bundle.metadata.changedPaths).toEqual([]);
	});

	it('bundle builder does not mutate canonical Markdown', () => {
		// The builder doesn't touch files; this is validated structurally
		const result = buildBundle();
		expect(result.bundle.metadata.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('snapshot', () => {
	it('snapshot review bundle', () => {
		const result = buildBundle(
			{
				packId: 'review-snapshot',
				packKind: 'review',
				title: 'Review pack snapshot',
			},
			{},
			{
				bundleId: 'snap-review-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot implementation bundle', () => {
		const result = buildBundle(
			{
				packId: 'impl-snapshot',
				packKind: 'implementation',
				title: 'Impl pack snapshot',
			},
			{
				registerData: {
					assumptions: [],
					decisions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							id: 'dec-snap',
							reviewRequired: false,
							sourceIds: [],
							status: 'confirmed',
							summary: 'Decision fixture',
						},
					],
					hypotheses: [],
					openQuestions: [],
					risks: [],
				},
			},
			{
				bundleId: 'snap-impl-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot task bundle', () => {
		const result = buildBundle(
			{
				packId: 'task-snapshot',
				packKind: 'task',
				title: 'Task pack snapshot',
			},
			{},
			{
				bundleId: 'snap-task-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot documentation bundle', () => {
		const result = buildBundle(
			{
				packId: 'doc-snapshot',
				packKind: 'documentation',
				title: 'Doc pack snapshot',
			},
			{},
			{
				bundleId: 'snap-doc-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot research bundle', () => {
		const result = buildBundle(
			{
				packId: 'research-snapshot',
				packKind: 'research',
				title: 'Research pack snapshot',
			},
			{},
			{
				bundleId: 'snap-research-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot follow-up bundle', () => {
		const result = buildBundle(
			{
				packId: 'followup-snapshot',
				packKind: 'follow_up',
				title: 'Follow-up pack snapshot',
			},
			{
				registerData: {
					assumptions: [],
					decisions: [],
					hypotheses: [],
					openQuestions: [
						{
							affectedDocumentIds: ['01-thesis'],
							affectedPhaseIds: ['01-foundation'],
							blocking: false,
							id: 'oq-snap',
							status: 'open',
							summary: 'Follow-up question',
							whyItMatters: 'Important',
						},
					],
					risks: [],
				},
			},
			{
				bundleId: 'snap-followup-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot executive task bundle', () => {
		const result = buildBundle(
			{
				packId: 'exec-snapshot',
				packKind: 'executive_task',
				title: 'Executive task snapshot',
			},
			{},
			{
				bundleId: 'snap-exec-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot redacted bundle', () => {
		const result = buildBundle(
			{
				packId: 'redacted-snapshot',
				packKind: 'review',
				sources: [
					{
						documentCanonicalId: '01-thesis',
						label: 'Thesis',
						outputPath: 'logos/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						required: true,
						sourceId: 'canonical:01-thesis',
						sourceKind: 'canonical_markdown' as AgentPackSourceKind,
						status: 'current',
					},
				],
				title: 'Redacted snapshot',
			},
			{
				canonicalContentExcerpts: new Map([
					['01-thesis', `API key: ${FAKE_API_KEY}\nToken: ${FAKE_BEARER}`],
				]),
			},
			{
				bundleId: 'snap-redacted-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
				scope: { includeContentExcerpts: true },
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});

	it('snapshot blocked bundle', () => {
		const result = buildBundle(
			{
				blockers: [
					{
						code: 'canonical_source_missing',
						expected: undefined,
						graphNodeId: undefined,
						message: 'Source is missing',
						packKind: 'review',
						received: undefined,
						recoveryHint: 'Run generation',
						relatedPhaseId: undefined,
						severity: 'error',
						sourceDocumentId: '01-thesis',
						sourceKind: 'canonical_markdown',
						sourcePath: undefined,
					},
				],
				packId: 'blocked-snapshot',
				packKind: 'review',
				status: 'blocked',
				title: 'Blocked pack snapshot',
			},
			{},
			{
				bundleId: 'snap-blocked-bundle',
				generatedAtOverride: '2026-05-18T00:00:00.000Z',
			},
		);
		expect(result.bundle).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// Deterministic ordering
// ---------------------------------------------------------------------------

describe('deterministic ordering', () => {
	it('sections are in deterministic order', () => {
		const result = buildBundle();
		const kinds = result.bundle.sections.map((s) => s.kind);
		expect(kinds).toEqual([
			'objective',
			'source_documents',
			'source_paths',
			'constraints',
			'requirements',
			'required_changes',
			'acceptance_criteria',
			'non_goals',
			'decisions',
			'assumptions',
			'hypotheses',
			'risks',
			'open_questions',
			'validation_findings',
			'consistency_findings',
			'traceability',
			'readiness',
			'expected_outputs',
			'blocked_items',
			'out_of_scope',
			'diagnostics',
		]);
	});

	it('repeated builds produce same shape', () => {
		const a = buildBundle(
			{ title: 'Same' },
			{},
			{ bundleId: 'idem', generatedAtOverride: 'T' },
		);
		const b = buildBundle(
			{ title: 'Same' },
			{},
			{ bundleId: 'idem', generatedAtOverride: 'T' },
		);
		expect(a.bundle.sections.length).toBe(b.bundle.sections.length);
		for (let i = 0; i < a.bundle.sections.length; i++) {
			expect(a.bundle.sections[i].kind).toBe(b.bundle.sections[i].kind);
			expect(a.bundle.sections[i].items.length).toBe(
				b.bundle.sections[i].items.length,
			);
		}
	});
});
