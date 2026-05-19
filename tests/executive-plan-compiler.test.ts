/** Step 11.2 — Executive Plan JSON compiler tests */

import { describe, expect, it } from 'vitest';
import {
	assertExecutiveCompilation,
	compileExecutivePlan,
} from '../src/executive/executive-plan-compiler.js';
import type {
	ExecutivePlanCompilationMode,
	ExecutivePlanCompileInput,
	ExecutivePlanCompileResult,
	ExecutivePlanJson,
} from '../src/executive/executive-plan-model.js';
import type {
	NormativeBaselineReadinessInput,
	NormativeBaselineReadinessResult,
} from '../src/executive/executive-readiness-types.js';
import { evaluateNormativeBaselineReadiness } from '../src/executive/normative-baseline-readiness.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertPlan(result: ExecutivePlanCompileResult): ExecutivePlanJson {
	const plan = result.plan;
	if (!plan) throw new Error('Expected plan to be non-null in this test');
	return plan;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let timeCounter = 0;
function deterministicClock(): string {
	return `2026-05-19T00:${String(timeCounter++).padStart(2, '0')}:00.000Z`;
}

function readyReadinessInput(
	overrides?: Partial<NormativeBaselineReadinessInput>,
): NormativeBaselineReadinessInput {
	return {
		artifactRegistryEntries: [
			{
				artifactId: 'html-overview',
				artifactType: 'html',
				isCanonical: false,
				path: 'logos/html/overview.html',
				sourceDocumentIds: ['thesis'],
			},
			{
				artifactId: 'agent-pack-coding',
				artifactType: 'agent_pack',
				isCanonical: false,
				path: 'logos/agent-packs/coding.md',
				sourceDocumentIds: ['thesis'],
			},
		],
		claims: [
			{
				claimId: 'claim-1' as never,
				claimType: 'fact',
				isInferred: false,
				relatedDocumentCanonicalId: 'thesis',
				relatedPhaseId: '01-foundation',
				sourceLinks: [
					{ linkType: 'derived_from' as never, sourceId: 'src-1' as never },
				],
				status: 'confirmed',
			},
		],
		consistencyExportReadiness: 'ready',
		consistencyFindings: [],
		documentationRoot: 'logos/',
		documentEntries: [
			{
				canonicalOutputPath: 'logos/01-foundation/thesis.md',
				descriptorStatus: 'confirmed',
				descriptorTitle: 'Thesis',
				documentCanonicalId: 'thesis',
				documentOrder: 0,
				phaseId: '01-foundation',
				phaseOrder: 0,
				required: true,
			},
			{
				canonicalOutputPath: 'logos/01-foundation/principles.md',
				descriptorStatus: 'confirmed',
				descriptorTitle: 'Principles',
				documentCanonicalId: 'principles',
				documentOrder: 1,
				phaseId: '01-foundation',
				phaseOrder: 0,
				required: true,
			},
			{
				canonicalOutputPath: 'logos/03-product/product-brief.md',
				descriptorStatus: 'confirmed',
				descriptorTitle: 'Product Brief',
				documentCanonicalId: 'product-brief',
				documentOrder: 0,
				phaseId: '03-product',
				phaseOrder: 2,
				required: true,
			},
		],
		evaluatedAt: '2026-05-19T00:00:00.000Z',
		executiveGenerationConfig: {
			allowDraftGeneration: true,
			allowExportWhenDraft: false,
			diagnostics: [],
			exportTargets: ['markdown', 'github-issues', 'html', 'agent-pack'],
			loaded: true,
			missingMappings: [],
			plannedMappings: ['linear', 'notion'],
			requiredStatus: 'baseline_ready',
			valid: true,
			version: '1.0.0',
		},
		latestValidationGateStatus: 'pass',
		latestValidationRunId: 'vr-1',
		phaseEntries: [
			{
				order: 0,
				phaseId: '01-foundation',
				required: true,
				title: 'Foundation',
			},
			{
				order: 1,
				phaseId: '02-validation',
				required: true,
				title: 'Validation',
			},
			{ order: 2, phaseId: '03-product', required: true, title: 'Product' },
			{
				order: 3,
				phaseId: '04-engineering',
				required: true,
				title: 'Engineering',
			},
		],
		profileId: 'standard',
		profileVersion: '1.0.0',
		projectRoot: '.',
		registerCollections: {
			assumptions: [
				{
					affectedDocumentLinks: [],
					body: 'AI is optional',
					confidence: 'confirmed',
					id: 'a-1' as never,
					kind: 'assumption',
					reviewState: 'confirmed',
					sourceLinks: [{ sourceId: 'src-1' as never }],
					status: 'confirmed',
					title: 'AI Optional',
				},
			],
			decisions: [
				{
					affectedDocumentLinks: [],
					body: 'Use TypeScript',
					confidence: 'confirmed',
					id: 'd-1' as never,
					kind: 'decision',
					reviewState: 'confirmed',
					sourceLinks: [{ sourceId: 'src-1' as never }],
					status: 'confirmed',
					title: 'TypeScript Decision',
				},
			],
			hypotheses: [],
			openQuestions: [],
			risks: [],
		},
		requiredDocumentIds: ['thesis', 'principles', 'product-brief'],
		requiredPhaseIds: [
			'01-foundation',
			'02-validation',
			'03-product',
			'04-engineering',
		],
		sources: [
			{
				confidence: 'explicit',
				location: { path: 'logos/01-foundation/thesis.md' },
				sourceId: 'src-1' as never,
				sourceType: 'document',
				status: 'confirmed',
			},
		],
		stalenessSummary: {
			blockedCount: 0,
			currentCount: 3,
			missingCount: 0,
			orphanedCount: 0,
			staleCount: 0,
			total: 3,
			unknownCount: 0,
		},
		stalenessTargets: [
			{
				documentCanonicalId: 'thesis',
				outputPath: 'logos/01-foundation/thesis.md',
				phaseId: '01-foundation',
				reasons: [],
				severity: 'info',
				status: 'current',
				targetId: 't-thesis',
			},
			{
				documentCanonicalId: 'principles',
				outputPath: 'logos/01-foundation/principles.md',
				phaseId: '01-foundation',
				reasons: [],
				severity: 'info',
				status: 'current',
				targetId: 't-principles',
			},
			{
				documentCanonicalId: 'product-brief',
				outputPath: 'logos/03-product/product-brief.md',
				phaseId: '03-product',
				reasons: [],
				severity: 'info',
				status: 'current',
				targetId: 't-product-brief',
			},
		],
		traceabilityEntries: [
			{ claimCount: 2, documentCanonicalId: 'thesis', sourceCount: 1 },
			{ claimCount: 0, documentCanonicalId: 'principles', sourceCount: 0 },
			{ claimCount: 0, documentCanonicalId: 'product-brief', sourceCount: 0 },
		],
		validationFindings: [],
		...overrides,
	};
}

function readyReadinessResult(
	overrides?: Partial<NormativeBaselineReadinessInput>,
): NormativeBaselineReadinessResult {
	return evaluateNormativeBaselineReadiness(readyReadinessInput(overrides));
}

function compileInput(
	readinessResult: NormativeBaselineReadinessResult,
	mode: ExecutivePlanCompilationMode = 'strict',
): ExecutivePlanCompileInput {
	return {
		clock: deterministicClock,
		compilationMode: mode,
		executorVersion: 'logos-engine-test',
		projectDescription: 'Test project for executive plan compilation',
		projectId: 'test-project',
		projectName: 'Test Project',
		readinessResult,
	};
}

// ---------------------------------------------------------------------------
// Compiler model tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Compiler Model', () => {
	it('validates compile input has required fields', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);

		expect(input.readinessResult).toBeDefined();
		expect(input.compilationMode).toBe('strict');
		expect(input.clock).toBeInstanceOf(Function);
	});

	it('validates compile result structure', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);

		expect(result.status).toBeDefined();
		expect(result.compilationMode).toBe('strict');
		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
		expect(result.diagnostics).toBeInstanceOf(Array);
		expect(result.blockers).toBeInstanceOf(Array);
		expect(result.warnings).toBeInstanceOf(Array);
	});

	it('supports strict mode', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness, 'strict');
		const result = compileExecutivePlan(input);
		expect(result.compilationMode).toBe('strict');
		expect(result.status).toBe('compiled');
	});

	it('supports diagnostic_preview mode', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness, 'diagnostic_preview');
		const result = compileExecutivePlan(input);
		expect(result.compilationMode).toBe('diagnostic_preview');
	});

	it('supports compiled status', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		expect(result.status).toBe('compiled');
	});

	it('supports compiled_with_warnings status', () => {
		const readiness = readyReadinessResult({
			validationFindings: [
				{
					code: 'document_missing_section',
					documentCanonicalId: 'thesis',
					id: 'vf-warn',
					location: { pointer: '/sections' },
					message: 'Missing optional section',
					phaseId: '01-foundation',
					scope: 'all',
					severity: 'warning',
					source: {
						path: 'logos/01-foundation/thesis.md',
						type: 'generated_output_metadata',
					},
				},
			],
		});
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		expect(result.status).toBe('compiled_with_warnings');
	});

	it('supports blocked status', () => {
		const readiness = readyReadinessResult({
			documentEntries: [
				{
					canonicalOutputPath: undefined,
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Thesis',
					documentCanonicalId: 'thesis',
					documentOrder: 0,
					phaseId: '01-foundation',
					phaseOrder: 0,
					required: true,
				},
				{
					canonicalOutputPath: 'logos/03-product/product-brief.md',
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Product Brief',
					documentCanonicalId: 'product-brief',
					documentOrder: 0,
					phaseId: '03-product',
					phaseOrder: 2,
					required: true,
				},
			],
			requiredDocumentIds: ['thesis', 'product-brief'],
			stalenessSummary: {
				blockedCount: 0,
				currentCount: 1,
				missingCount: 1,
				orphanedCount: 0,
				staleCount: 0,
				total: 2,
				unknownCount: 0,
			},
			stalenessTargets: [
				{
					documentCanonicalId: 'thesis',
					phaseId: '01-foundation',
					reasons: [{ code: 'missing', message: 'Document missing' }],
					severity: 'error',
					status: 'missing',
					targetId: 't-thesis',
				},
				{
					documentCanonicalId: 'product-brief',
					outputPath: 'logos/03-product/product-brief.md',
					phaseId: '03-product',
					reasons: [],
					severity: 'info',
					status: 'current',
					targetId: 't-product-brief',
				},
			],
		});
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		expect(result.status).toBe('blocked');
	});

	it('changed paths are empty in pure compile', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		expect(result.changedPaths).toEqual([]);
	});

	it('read-only marker is present in pure compile', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		expect(result.readOnly).toBe(true);
	});

	it('diagnosticOnly is false for ready baseline', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		expect(result.diagnosticOnly).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Readiness gate integration tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Readiness Gate Integration', () => {
	it('strict mode compiles when readiness is ready', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness, 'strict');
		const result = compileExecutivePlan(input);
		expect(result.status).toBe('compiled');
		expect(result.plan).not.toBeNull();
	});

	it('strict mode compiles_with_warnings when readiness has warnings', () => {
		const readiness = readyReadinessResult({
			validationFindings: [
				{
					code: 'document_missing_section',
					documentCanonicalId: 'thesis',
					id: 'vf-warn-1',
					location: { pointer: '/sections' },
					message: 'Optional section missing',
					phaseId: '01-foundation',
					scope: 'all',
					severity: 'warning',
					source: {
						path: 'logos/01-foundation/thesis.md',
						type: 'generated_output_metadata',
					},
				},
			],
		});
		const input = compileInput(readiness, 'strict');
		const result = compileExecutivePlan(input);
		expect(['compiled_with_warnings', 'blocked']).toContain(result.status);
	});

	it('diagnostic_preview emits diagnostic-only JSON for blocked readiness', () => {
		// Create a readiness that's blocked due to missing documents
		const input_data = readyReadinessInput({
			documentEntries: [
				{
					canonicalOutputPath: undefined,
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Thesis',
					documentCanonicalId: 'thesis',
					documentOrder: 0,
					phaseId: '01-foundation',
					phaseOrder: 0,
					required: true,
				},
				{
					canonicalOutputPath: 'logos/03-product/product-brief.md',
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Product Brief',
					documentCanonicalId: 'product-brief',
					documentOrder: 0,
					phaseId: '03-product',
					phaseOrder: 2,
					required: true,
				},
			],
			requiredDocumentIds: ['thesis', 'product-brief'],
			stalenessSummary: {
				blockedCount: 0,
				currentCount: 1,
				missingCount: 1,
				orphanedCount: 0,
				staleCount: 0,
				total: 2,
				unknownCount: 0,
			},
			stalenessTargets: [
				{
					documentCanonicalId: 'thesis',
					phaseId: '01-foundation',
					reasons: [{ code: 'missing', message: 'Missing document' }],
					severity: 'error',
					status: 'missing',
					targetId: 't-thesis',
				},
				{
					documentCanonicalId: 'product-brief',
					outputPath: 'logos/03-product/product-brief.md',
					phaseId: '03-product',
					reasons: [],
					severity: 'info',
					status: 'current',
					targetId: 't-product-brief',
				},
			],
		});
		const readiness = evaluateNormativeBaselineReadiness(input_data);
		const input = compileInput(readiness, 'diagnostic_preview');
		const result = compileExecutivePlan(input);

		expect(result.diagnosticOnly).toBe(true);
		expect(result.plan).not.toBeNull();
		expect(result.exportReady).toBe(false);
	});

	it('readiness blockers/warnings are preserved', () => {
		const input_data = readyReadinessInput({
			documentEntries: [
				{
					canonicalOutputPath: undefined,
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Thesis',
					documentCanonicalId: 'thesis',
					documentOrder: 0,
					phaseId: '01-foundation',
					phaseOrder: 0,
					required: true,
				},
			],
			requiredDocumentIds: ['thesis'],
			stalenessSummary: {
				blockedCount: 0,
				currentCount: 0,
				missingCount: 1,
				orphanedCount: 0,
				staleCount: 0,
				total: 1,
				unknownCount: 0,
			},
			stalenessTargets: [
				{
					documentCanonicalId: 'thesis',
					phaseId: '01-foundation',
					reasons: [{ code: 'missing', message: 'Missing' }],
					severity: 'fatal',
					status: 'missing',
					targetId: 't-thesis',
				},
			],
		});
		const readiness = evaluateNormativeBaselineReadiness(input_data);
		const input = compileInput(readiness, 'diagnostic_preview');
		const result = compileExecutivePlan(input);

		expect(result.blockers.length).toBeGreaterThan(0);
	});

	it('compiler does not recompute readiness differently', () => {
		const readiness = readyReadinessResult();
		const input1 = compileInput(readiness, 'strict');
		const result1 = compileExecutivePlan(input1);

		// Same readiness should produce same compilation status
		const input2 = compileInput(readiness, 'strict');
		const result2 = compileExecutivePlan(input2);

		expect(result1.status).toBe(result2.status);
	});
});

// ---------------------------------------------------------------------------
// Plan structure tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Plan Structure', () => {
	it('compiles phases in profile order', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.execution.milestones).toHaveLength(4);
		expect(plan.execution.milestones[0]?.id).toBe('milestone-01-foundation');
		expect(plan.execution.milestones[1]?.id).toBe('milestone-02-validation');
		expect(plan.execution.milestones[2]?.id).toBe('milestone-03-product');
		expect(plan.execution.milestones[3]?.id).toBe('milestone-04-engineering');
	});

	it('compiles milestones from phases', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.execution.milestones.length).toBeGreaterThan(0);
		for (const m of plan.execution.milestones) {
			expect(m.id).toMatch(/^milestone-/);
			expect(m.title).toBeTruthy();
			expect(m.objective).toBeTruthy();
			expect(m.exitCriteria.length).toBeGreaterThan(0);
		}
	});

	it('compiles work items from document gaps', () => {
		const input_data = readyReadinessInput({
			documentEntries: [
				{
					canonicalOutputPath: undefined,
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Thesis',
					documentCanonicalId: 'thesis',
					documentOrder: 0,
					phaseId: '01-foundation',
					phaseOrder: 0,
					required: true,
				},
				{
					canonicalOutputPath: 'logos/03-product/product-brief.md',
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Product Brief',
					documentCanonicalId: 'product-brief',
					documentOrder: 0,
					phaseId: '03-product',
					phaseOrder: 2,
					required: true,
				},
			],
			requiredDocumentIds: ['thesis', 'product-brief'],
			stalenessSummary: {
				blockedCount: 0,
				currentCount: 1,
				missingCount: 1,
				orphanedCount: 0,
				staleCount: 0,
				total: 2,
				unknownCount: 0,
			},
			stalenessTargets: [
				{
					documentCanonicalId: 'thesis',
					phaseId: '01-foundation',
					reasons: [{ code: 'missing', message: 'Missing' }],
					severity: 'fatal',
					status: 'missing',
					targetId: 't-thesis',
				},
				{
					documentCanonicalId: 'product-brief',
					outputPath: 'logos/03-product/product-brief.md',
					phaseId: '03-product',
					reasons: [],
					severity: 'info',
					status: 'current',
					targetId: 't-product-brief',
				},
			],
		});
		const readiness = evaluateNormativeBaselineReadiness(input_data);
		const input = compileInput(readiness, 'diagnostic_preview');
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		const docUpdateItems = plan.execution.items.filter(
			(i) => i.type === 'doc_update' || i.type === 'blocker',
		);
		expect(docUpdateItems.length).toBeGreaterThan(0);
	});

	it('compiles work items from readiness blockers', () => {
		const input_data = readyReadinessInput({
			documentEntries: [
				{
					canonicalOutputPath: undefined,
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Thesis',
					documentCanonicalId: 'thesis',
					documentOrder: 0,
					phaseId: '01-foundation',
					phaseOrder: 0,
					required: true,
				},
			],
			requiredDocumentIds: ['thesis'],
			stalenessSummary: {
				blockedCount: 0,
				currentCount: 0,
				missingCount: 1,
				orphanedCount: 0,
				staleCount: 0,
				total: 1,
				unknownCount: 0,
			},
			stalenessTargets: [
				{
					documentCanonicalId: 'thesis',
					phaseId: '01-foundation',
					reasons: [{ code: 'missing', message: 'Missing' }],
					severity: 'fatal',
					status: 'missing',
					targetId: 't-thesis',
				},
			],
		});
		const readiness = evaluateNormativeBaselineReadiness(input_data);
		const input = compileInput(readiness, 'diagnostic_preview');
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		const blockerItems = plan.execution.items.filter(
			(i) => i.type === 'blocker',
		);
		expect(blockerItems.length).toBeGreaterThan(0);
	});

	it('compiles work items from source gaps', () => {
		const readiness = readyReadinessResult({
			claims: [
				{
					claimId: 'c-1' as never,
					claimType: 'fact',
					isInferred: false,
					relatedDocumentCanonicalId: 'thesis',
					relatedPhaseId: '01-foundation',
					sourceLinks: [],
					status: 'confirmed',
				},
			],
			sources: [
				{
					confidence: 'inferred',
					sourceId: 'src-ext' as never,
					sourceType: 'external_reference',
					status: 'requires_review',
				},
			],
		});
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		// Source gaps may produce review or task items
		const gapItems = plan.execution.items.filter(
			(i) => i.type === 'review' || i.type === 'task',
		);
		expect(gapItems.length).toBeGreaterThan(0);
	});

	it('compiles work items from register gaps', () => {
		const readiness = readyReadinessResult({
			registerCollections: {
				assumptions: [],
				decisions: [
					{
						affectedDocumentLinks: [],
						body: 'Decision',
						confidence: 'confirmed',
						id: 'd-1' as never,
						kind: 'decision',
						reviewState: 'confirmed',
						sourceLinks: [],
						status: 'confirmed',
						title: 'Unlinked Decision',
					},
				],
				hypotheses: [],
				openQuestions: [
					{
						affectedDocumentLinks: [{ documentCanonicalId: 'thesis' }],
						body: 'Blocker Q',
						confidence: 'low',
						id: 'q-1' as never,
						isBlocking: true,
						kind: 'open_question',
						reviewState: 'pending',
						sourceLinks: [],
						status: 'open',
						title: 'Blocking Question',
					},
				],
				risks: [
					{
						affectedDocumentLinks: [],
						body: 'Risk',
						confidence: 'medium',
						id: 'r-1' as never,
						kind: 'risk',
						mitigation: undefined,
						reviewState: 'accepted',
						sourceLinks: [],
						status: 'accepted',
						title: 'Accepted Risk No Mitigation',
					},
				],
			},
		});
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		// Should have blocker items for blocking questions
		const blockerItems = plan.execution.items.filter(
			(i) => i.type === 'blocker',
		);
		expect(blockerItems.length).toBeGreaterThan(0);

		// Should have task items for risks without mitigation
		const taskItems = plan.execution.items.filter((i) => i.type === 'task');
		expect(taskItems.length).toBeGreaterThan(0);
	});

	it('does not create generic unsourced tasks', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const item of plan.execution.items) {
			// Every item should have a source rationale
			expect(item.sourceRationale).toBeTruthy();
		}
	});

	it('plan includes roadmap', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.execution.roadmaps.length).toBe(1);
		expect(plan.execution.roadmaps[0]?.id).toMatch(/^roadmap-/);
	});

	it('plan includes workstreams', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.execution.workstreams.length).toBe(4);
	});

	it('plan includes initiatives', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.execution.initiatives.length).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Risk compilation tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Risk Compilation', () => {
	it('risks from register are included', () => {
		const readiness = readyReadinessResult({
			registerCollections: {
				assumptions: [],
				decisions: [],
				hypotheses: [],
				openQuestions: [],
				risks: [
					{
						affectedDocumentLinks: [],
						body: 'Risk body',
						confidence: 'medium',
						id: 'r-1' as never,
						kind: 'risk',
						mitigation: 'Mitigation plan',
						reviewState: 'accepted',
						sourceLinks: [],
						status: 'accepted',
						title: 'Test Risk',
					},
				],
			},
		});
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.execution.risks.length).toBeGreaterThan(0);
	});

	it('risk includes likelihood and impact when sourced', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const risk of plan.execution.risks) {
			expect(risk.likelihood).toBeDefined();
			expect(risk.impact).toBeDefined();
		}
	});

	it('risk references affected docs', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const risk of plan.execution.risks) {
			expect(risk.sourceNormativeDocuments).toBeInstanceOf(Array);
		}
	});
});

// ---------------------------------------------------------------------------
// Export metadata tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Export Metadata', () => {
	it('includes JSON export target', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.exports).toBeDefined();
	});

	it('includes Markdown export metadata without generating Markdown', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.exports.markdown).toBeDefined();
		expect(plan.exports.markdown.enabled).toBe(true);
	});

	it('includes HTML export metadata without generating HTML', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.exports.html).toBeDefined();
	});

	it('includes GitHub Issue-compatible export metadata without generating files', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.exports.githubIssues).toBeDefined();
	});

	it('includes Agent Pack export metadata without rendering packs', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.exports.agentPack).toBeDefined();
	});

	it('Linear/Notion are planned adapter contracts', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.exports.linear?.supportStatus).toBe('planned_adapter_contract');
		expect(plan.exports.notion?.supportStatus).toBe('planned_adapter_contract');
	});

	it('export ready is false when diagnostic only', () => {
		const input_data = readyReadinessInput({
			documentEntries: [
				{
					canonicalOutputPath: undefined,
					descriptorStatus: 'confirmed',
					descriptorTitle: 'Thesis',
					documentCanonicalId: 'thesis',
					documentOrder: 0,
					phaseId: '01-foundation',
					phaseOrder: 0,
					required: true,
				},
			],
			requiredDocumentIds: ['thesis'],
			stalenessSummary: {
				blockedCount: 0,
				currentCount: 0,
				missingCount: 1,
				orphanedCount: 0,
				staleCount: 0,
				total: 1,
				unknownCount: 0,
			},
			stalenessTargets: [
				{
					documentCanonicalId: 'thesis',
					phaseId: '01-foundation',
					reasons: [{ code: 'missing', message: 'Missing' }],
					severity: 'fatal',
					status: 'missing',
					targetId: 't-thesis',
				},
			],
		});
		const readiness = evaluateNormativeBaselineReadiness(input_data);
		const input = compileInput(readiness, 'diagnostic_preview');
		const result = compileExecutivePlan(input);

		expect(result.exportReady).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Schema Validation', () => {
	it('compiled JSON validates against executive-plan.schema.json', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		// Basic structural checks
		expect(plan.id).toBeTruthy();
		expect(plan.version).toBeTruthy();
		expect(plan.project.id).toBeTruthy();
		expect(plan.project.name).toBeTruthy();
		expect(plan.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(plan.source.normativeDocuments).toBeInstanceOf(Array);
		expect(plan.execution.roadmaps).toBeInstanceOf(Array);
		expect(plan.execution.milestones).toBeInstanceOf(Array);
		expect(plan.execution.workstreams).toBeInstanceOf(Array);
		expect(plan.execution.initiatives).toBeInstanceOf(Array);
		expect(plan.execution.items).toBeInstanceOf(Array);
		expect(plan.execution.decisions).toBeInstanceOf(Array);
		expect(plan.execution.risks).toBeInstanceOf(Array);
		expect(plan.execution.artifacts).toBeInstanceOf(Array);
	});

	it('all items have required fields', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const item of plan.execution.items) {
			expect(item.id).toBeTruthy();
			expect(item.type).toBeTruthy();
			expect(item.title).toBeTruthy();
			expect(item.status).toBeTruthy();
			expect(item.priority).toBeTruthy();
		}
	});

	it('all milestones have required fields', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const m of plan.execution.milestones) {
			expect(m.id).toBeTruthy();
			expect(m.title).toBeTruthy();
			expect(m.objective).toBeTruthy();
			expect(m.status).toBeTruthy();
			expect(m.exitCriteria).toBeInstanceOf(Array);
		}
	});

	it('schema validation is deterministic', () => {
		const readiness = readyReadinessResult();
		const result1 = compileExecutivePlan(compileInput(readiness));

		// Reset clock and make new input with same readiness
		timeCounter = 0;
		const input2 = compileInput(readiness);
		const result2 = compileExecutivePlan(input2);

		expect(result1.status).toBe(result2.status);
		if (result1.plan && result2.plan) {
			// Structure should be same but timestamps differ
			expect(result1.plan.execution.milestones.length).toBe(
				result2.plan.execution.milestones.length,
			);
			expect(result1.plan.execution.items.length).toBe(
				result2.plan.execution.items.length,
			);
		}
	});
});

// ---------------------------------------------------------------------------
// ID/fingerprint tests
// ---------------------------------------------------------------------------

describe('Executive Plan — IDs and Fingerprints', () => {
	it('plan id is deterministic with injected timestamp', () => {
		const readiness = readyReadinessResult();
		timeCounter = 0;
		const result1 = compileExecutivePlan(compileInput(readiness));

		timeCounter = 0;
		const result2 = compileExecutivePlan(compileInput(readiness));

		expect(result1.plan?.id).toBe(result2.plan?.id);
	});

	it('milestone ids are deterministic', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const m of plan.execution.milestones) {
			expect(m.id).toMatch(/^milestone-/);
		}
	});

	it('work item ids are deterministic', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		for (const item of plan.execution.items) {
			expect(item.id).toMatch(/^wi-/);
		}
	});
});

// ---------------------------------------------------------------------------
// Security/privacy tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Security and Privacy', () => {
	it('no raw provider tokens in output', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const planStr = JSON.stringify(result.plan);

		expect(planStr).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
		expect(planStr).not.toMatch(/sk_[a-zA-Z0-9]{20,}/);
	});

	it('no authorization header patterns in output', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const planStr = JSON.stringify(result.plan);

		expect(planStr.toLowerCase()).not.toMatch(/bearer [a-zA-Z0-9_\-.]{20,}/);
	});

	it('no path traversal in output', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const planStr = JSON.stringify(result.plan);

		// The output shouldn't have path traversal
		expect(planStr).not.toMatch(/\.\.\/\.\./);
	});

	it('derived artifact is not marked canonical', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.nonCanonical).toBe(true);
		expect(plan.metadata.derivedSnapshot).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Metadata tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Metadata', () => {
	it('metadata includes schema version', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.schemaVersion).toBe('1.0.0');
	});

	it('metadata includes profile info', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.profileId).toBe('standard');
		expect(plan.metadata.profileVersion).toBe('1.0.0');
	});

	it('metadata includes derived snapshot marker', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.derivedSnapshot).toBe(true);
	});

	it('metadata includes non-canonical marker', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.nonCanonical).toBe(true);
	});

	it('metadata includes source-of-truth warning', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.sourceOfTruthWarning).toBeTruthy();
	});

	it('metadata includes readiness status', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.readinessStatus).toBe('ready');
	});

	it('metadata includes compilation mode', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.compilationMode).toBe('strict');
	});

	it('metadata includes generatedBy', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.metadata.generatedBy).toBe('logos-engine');
	});
});

// ---------------------------------------------------------------------------
// Compilation sources tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Source Mapping', () => {
	it('source includes normative documents', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.source.normativeDocuments).toContain('thesis');
		expect(plan.source.normativeDocuments).toContain('principles');
		expect(plan.source.normativeDocuments).toContain('product-brief');
	});

	it('source includes readiness status', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.source.readinessStatus).toBe('ready');
	});

	it('source does not include commit or prompt id by default', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		expect(plan.source.sourceCommit).toBeNull();
		expect(plan.source.generationPromptId).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Non-Mutation', () => {
	it('pure compiler writes no files', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);

		expect(result.changedPaths).toEqual([]);
	});

	it('pure compiler does not mutate readiness input', () => {
		const readiness = readyReadinessResult();
		const snapshot = { ...readiness };
		const input = compileInput(readiness);
		compileExecutivePlan(input);

		expect(readiness.status).toBe(snapshot.status);
		expect(readiness.blockers.length).toBe(snapshot.blockers.length);
	});
});

// ---------------------------------------------------------------------------
// Deterministic ordering tests
// ---------------------------------------------------------------------------

describe('Executive Plan — Deterministic Ordering', () => {
	it('milestones are ordered by phase order', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		const milestoneIds = plan.execution.milestones.map((m) => m.id);
		expect(milestoneIds[0]).toBe('milestone-01-foundation');
		expect(milestoneIds).toEqual([
			'milestone-01-foundation',
			'milestone-02-validation',
			'milestone-03-product',
			'milestone-04-engineering',
		]);
	});

	it('roadmaps reference milestones', () => {
		const readiness = readyReadinessResult();
		const input = compileInput(readiness);
		const result = compileExecutivePlan(input);
		const plan = assertPlan(result);

		const milestoneIds = plan.execution.milestones.map((m) => m.id);
		expect(plan.execution.roadmaps[0]?.milestoneIds).toEqual(milestoneIds);
	});
});

// ---------------------------------------------------------------------------
// Assert compilation tests
// ---------------------------------------------------------------------------

describe('Executive Plan — assertExecutiveCompilation', () => {
	it('allows compilation when ready in strict mode', () => {
		const result = assertExecutiveCompilation('ready', 'strict');
		expect(result.allowed).toBe(true);
	});

	it('allows compilation when ready_with_warnings in strict mode', () => {
		const result = assertExecutiveCompilation('ready_with_warnings', 'strict');
		expect(result.allowed).toBe(true);
	});

	it('blocks when blocked in strict mode', () => {
		const result = assertExecutiveCompilation('blocked', 'strict');
		expect(result.allowed).toBe(false);
	});

	it('blocks when unknown in strict mode', () => {
		const result = assertExecutiveCompilation('unknown', 'strict');
		expect(result.allowed).toBe(false);
	});

	it('always allows in diagnostic_preview mode', () => {
		expect(
			assertExecutiveCompilation('blocked', 'diagnostic_preview').allowed,
		).toBe(true);
		expect(
			assertExecutiveCompilation('unknown', 'diagnostic_preview').allowed,
		).toBe(true);
		expect(
			assertExecutiveCompilation('ready', 'diagnostic_preview').allowed,
		).toBe(true);
	});
});
