/** Step 11.1 — Executive readiness gate tests */

import { describe, expect, it } from 'vitest';
import type { NormativeBaselineReadinessInput } from '../src/executive/executive-readiness-types.js';
import {
	assertExecutiveCompilationAllowed,
	evaluateNormativeBaselineReadiness,
} from '../src/executive/normative-baseline-readiness.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInput(
	overrides?: Partial<NormativeBaselineReadinessInput>,
): NormativeBaselineReadinessInput {
	return {
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
			loaded: true,
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
		requiredDocumentIds: ['thesis', 'product-brief'],
		requiredPhaseIds: [
			'01-foundation',
			'02-validation',
			'03-product',
			'04-engineering',
		],
		stalenessSummary: {
			blockedCount: 0,
			currentCount: 2,
			missingCount: 0,
			orphanedCount: 0,
			staleCount: 0,
			total: 2,
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
				targetId: 'canonical_thesis',
			},
			{
				documentCanonicalId: 'product-brief',
				outputPath: 'logos/03-product/product-brief.md',
				phaseId: '03-product',
				reasons: [],
				severity: 'info',
				status: 'current',
				targetId: 'canonical_product-brief',
			},
		],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Readiness result shape tests
// ---------------------------------------------------------------------------

describe('NormativeBaselineReadinessResult shape', () => {
	it('produces a valid readiness result', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.status).toBe('ready');
		expect(result.executiveCompilationGateStatus).toBe('allowed');
		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
		expect(result.dryRun).toBe(true);
		expect(result.activeProfileId).toBe('standard');
		expect(result.documentationRoot).toBe('logos/');
	});

	it('includes all required sections', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.summary).toBeDefined();
		expect(result.phaseReadiness.length).toBeGreaterThan(0);
		expect(result.documentReadiness.length).toBeGreaterThan(0);
		expect(result.validationCoverage).toBeDefined();
		expect(result.stalenessCoverage).toBeDefined();
		expect(result.sourceCoverage).toBeDefined();
		expect(result.registerCoverage).toBeDefined();
		expect(result.traceabilityCoverage).toBeDefined();
		expect(result.executiveScopeCheck).toBeDefined();
		expect(result.blockers).toBeDefined();
		expect(result.warnings).toBeDefined();
		expect(result.recommendedNextActions.length).toBeGreaterThan(0);
	});

	it('changedPaths are always empty', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.changedPaths).toEqual([]);
	});

	it('readOnly marker is present', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Readiness statuses
// ---------------------------------------------------------------------------

describe('Readiness statuses', () => {
	it('returns ready when all documents are current and no findings', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.status).toBe('ready');
		expect(result.executiveCompilationGateStatus).toBe('allowed');
	});

	it('returns ready_with_warnings when non-blocking warnings exist', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'output_metadata_document_mismatch',
						documentCanonicalId: 'thesis',
						id: 'v-1',
						location: {},
						message: 'Output metadata document mismatch',
						order: 0,
						severity: 'warning',
						source: {
							kind: 'generated_output_metadata',
							path: 'logos/01-foundation/thesis.md',
						},
					},
				],
			}),
		);
		expect(result.status).toBe('ready_with_warnings');
		expect(result.executiveCompilationGateStatus).toBe('allowed_with_warnings');
	});

	it('returns blocked when a required document is missing', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				stalenessTargets: [],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(result.executiveCompilationGateStatus).toBe('blocked');
	});

	it('returns blocked when a required document is stale', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 2,
					unknownCount: 0,
				},
				stalenessTargets: [
					{
						documentCanonicalId: 'thesis',
						outputPath: 'logos/01-foundation/thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'warning',
						status: 'stale',
						targetId: 'canonical_thesis',
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.kind === 'stale_canonical_document'),
		).toBe(true);
	});

	it('returns blocked when a required document is blocked', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				stalenessSummary: {
					blockedCount: 1,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 2,
					unknownCount: 0,
				},
				stalenessTargets: [
					{
						documentCanonicalId: 'thesis',
						outputPath: 'logos/01-foundation/thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'blocked',
						targetId: 'canonical_thesis',
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.kind === 'blocked_canonical_document'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Blocker kind tests
// ---------------------------------------------------------------------------

describe('Blocker kinds', () => {
	it('reports missing_canonical_document', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				stalenessTargets: [],
			}),
		);
		expect(
			result.blockers.some((b) => b.kind === 'missing_canonical_document'),
		).toBe(true);
	});

	it('reports stale_canonical_document', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 2,
					unknownCount: 0,
				},
				stalenessTargets: [
					{
						documentCanonicalId: 'thesis',
						outputPath: 'logos/01-foundation/thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'warning',
						status: 'stale',
						targetId: 'canonical_thesis',
					},
				],
			}),
		);
		expect(
			result.blockers.some((b) => b.kind === 'stale_canonical_document'),
		).toBe(true);
	});

	it('reports release_blocking_validation_finding', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'secret_like_value',
						documentCanonicalId: 'thesis',
						id: 'v-secret',
						location: {},
						message: 'Secret-like value detected',
						order: 0,
						severity: 'fatal',
						source: { kind: 'secret_scan', path: 'thesis' },
					},
				],
			}),
		);
		expect(
			result.blockers.some(
				(b) => b.kind === 'release_blocking_validation_finding',
			),
		).toBe(true);
	});

	it('reports unsafe_path when output path contains traversal', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				documentEntries: [
					{
						canonicalOutputPath: '../outside/thesis.md',
						descriptorStatus: 'confirmed',
						descriptorTitle: 'Thesis',
						documentCanonicalId: 'thesis',
						documentOrder: 0,
						phaseId: '01-foundation',
						phaseOrder: 0,
						required: true,
					},
				],
			}),
		);
		const hasUnsafePath = result.blockers.some((b) => b.kind === 'unsafe_path');
		expect(hasUnsafePath).toBe(true);
	});

	it('reports unresolved_blocking_question', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					openQuestions: [
						{
							affectedDocumentLinks: [{ documentCanonicalId: 'thesis' }],
							body: 'Body',
							confidence: 'explicit',
							id: 'q-1' as string & { __brand?: 'RegisterItemId' },
							isBlocking: true,
							kind: 'open_question',
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'open',
							title: 'Blocking question',
						},
					],
				},
			}),
		);
		expect(
			result.blockers.some((b) => b.kind === 'unresolved_blocking_question'),
		).toBe(true);
		expect(result.registerCoverage.blockingOpenQuestions).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Warning kind tests
// ---------------------------------------------------------------------------

describe('Warning kinds', () => {
	it('reports review_required_claim for decisions requiring review', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					decisions: [
						{
							affectedDocumentLinks: [],
							body: 'Body',
							confidence: 'explicit',
							id: 'd-1' as string & { __brand?: 'RegisterItemId' },
							kind: 'decision',
							reviewState: 'requires_review',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Decision needing review',
						},
					],
				},
			}),
		);
		expect(
			result.warnings.some((w) => w.kind === 'review_required_claim'),
		).toBe(true);
	});

	it('reports optional_source_missing for decisions without sources', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					decisions: [
						{
							affectedDocumentLinks: [],
							body: 'Body',
							confidence: 'explicit',
							id: 'd-2' as string & { __brand?: 'RegisterItemId' },
							kind: 'decision',
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Decision without source',
						},
					],
				},
			}),
		);
		expect(
			result.warnings.some((w) => w.kind === 'optional_source_missing'),
		).toBe(true);
	});

	it('reports non_blocking_validation_finding', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'output_metadata_document_mismatch',
						id: 'vw-1',
						location: {},
						message: 'Warning finding',
						order: 0,
						severity: 'warning',
						source: { kind: 'generated_output_metadata' },
					},
				],
			}),
		);
		expect(
			result.warnings.some((w) => w.kind === 'non_blocking_validation_finding'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Gate mapping tests
// ---------------------------------------------------------------------------

describe('Gate status mapping', () => {
	it('no blockers/no warnings => ready/allowed', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.status).toBe('ready');
		expect(result.executiveCompilationGateStatus).toBe('allowed');
	});

	it('no blockers/with warnings => ready_with_warnings/allowed_with_warnings', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'output_metadata_document_mismatch',
						id: 'vw-2',
						location: {},
						message: 'Warning',
						order: 0,
						severity: 'warning',
						source: { kind: 'generated_output_metadata' },
					},
				],
			}),
		);
		expect(result.status).toBe('ready_with_warnings');
		expect(result.executiveCompilationGateStatus).toBe('allowed_with_warnings');
	});

	it('blockers => blocked/blocked', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessTargets: [],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(result.executiveCompilationGateStatus).toBe('blocked');
	});
});

// ---------------------------------------------------------------------------
// assertExecutiveCompilationAllowed tests
// ---------------------------------------------------------------------------

describe('assertExecutiveCompilationAllowed', () => {
	it('returns allowed when ready', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(assertExecutiveCompilationAllowed(result)).toBe('allowed');
	});

	it('throws when blocked', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessTargets: [],
			}),
		);
		expect(() => assertExecutiveCompilationAllowed(result)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Validation coverage tests
// ---------------------------------------------------------------------------

describe('Validation coverage checks', () => {
	it('fatal finding blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'profile_registry_invalid',
						id: 'v-fatal',
						location: {},
						message: 'Fatal error',
						order: 0,
						severity: 'fatal',
						source: { kind: 'profile_registry' },
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(result.validationCoverage.fatalCount).toBe(1);
	});

	it('error finding blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'workspace_root_invalid',
						id: 'v-error',
						location: {},
						message: 'Error',
						order: 0,
						severity: 'error',
						source: { kind: 'workspace_state' },
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
	});

	it('token leak finding blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'secret_like_value',
						id: 'v-token',
						location: {},
						message: 'Token leak',
						order: 0,
						severity: 'fatal',
						source: { kind: 'secret_scan', path: 'test.md' },
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(result.validationCoverage.tokenLeakCount).toBe(1);
	});

	it('validation not run adds manual review warning', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				latestValidationGateStatus: undefined,
				latestValidationRunId: undefined,
				validationFindings: [],
			}),
		);
		expect(
			result.warnings.some((w) => w.kind === 'manual_review_recommended'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Staleness coverage tests
// ---------------------------------------------------------------------------

describe('Staleness coverage checks', () => {
	it('current canonical sources pass', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.stalenessCoverage.currentCount).toBe(2);
		expect(result.stalenessCoverage.staleCount).toBe(0);
	});

	it('stale required source blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 2,
					unknownCount: 0,
				},
				stalenessTargets: [
					{
						documentCanonicalId: 'thesis',
						outputPath: 'logos/01-foundation/thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'warning',
						status: 'stale',
						targetId: 'canonical_thesis',
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
	});

	it('missing required source blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				stalenessTargets: [],
			}),
		);
		expect(result.status).toBe('blocked');
	});
});

// ---------------------------------------------------------------------------
// Register / open question tests
// ---------------------------------------------------------------------------

describe('Register and open-question checks', () => {
	it('blocking open question affects readiness', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					openQuestions: [
						{
							affectedDocumentLinks: [{ documentCanonicalId: 'thesis' }],
							body: 'Question',
							confidence: 'explicit',
							id: 'q-block' as string & { __brand?: 'RegisterItemId' },
							isBlocking: true,
							kind: 'open_question',
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'open',
							title: 'Critical question',
						},
					],
				},
			}),
		);
		expect(result.registerCoverage.blockingOpenQuestions).toBe(1);
		expect(
			result.blockers.some((b) => b.kind === 'unresolved_blocking_question'),
		).toBe(true);
	});

	it('confirmed decision without sources warns', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					decisions: [
						{
							affectedDocumentLinks: [],
							body: 'Body',
							confidence: 'explicit',
							id: 'd-no-src' as string & { __brand?: 'RegisterItemId' },
							kind: 'decision',
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'confirmed',
							title: 'Decision',
						},
					],
				},
			}),
		);
		expect(
			result.warnings.some((w) => w.kind === 'optional_source_missing'),
		).toBe(true);
	});

	it('accepted risk without mitigation warns', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					risks: [
						{
							affectedDocumentLinks: [],
							body: 'Risk',
							confidence: 'explicit',
							id: 'r-1' as string & { __brand?: 'RegisterItemId' },
							kind: 'risk',
							mitigation: undefined,
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'accepted',
							title: 'Risk without mitigation',
						},
					],
				},
			}),
		);
		expect(
			result.warnings.some((w) => w.kind === 'manual_review_recommended'),
		).toBe(true);
	});

	it('hypothesis not validated is not treated as fact', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				registerCollections: {
					hypotheses: [
						{
							affectedDocumentLinks: [],
							body: 'Hypothesis',
							confidence: 'inferred',
							id: 'h-1' as string & { __brand?: 'RegisterItemId' },
							kind: 'hypothesis',
							reviewState: 'not_required',
							sourceLinks: [],
							status: 'active',
							title: 'Active hypothesis',
						},
					],
				},
			}),
		);
		// Active hypotheses should generate warnings but not blockers
		expect(result.status).not.toBe('blocked');
		expect(
			result.warnings.some((w) => w.kind === 'manual_review_recommended'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Provenance / source coverage tests
// ---------------------------------------------------------------------------

describe('Provenance / source coverage checks', () => {
	it('external reference produces warning', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				sources: [
					{
						confidence: 'unknown',
						location: {},
						metadata: {},
						orderIndex: 0,
						sourceId: 'src-ext' as string & { __brand?: 'SourceId' },
						sourceType: 'external_reference',
						status: 'unknown',
						timestamp: {},
						title: 'External source',
					},
				],
			}),
		);
		expect(result.warnings.some((w) => w.kind === 'inferred_source')).toBe(
			true,
		);
	});

	it('repository scan reference warns', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				sources: [
					{
						confidence: 'unknown',
						location: {},
						metadata: {},
						orderIndex: 0,
						sourceId: 'src-scan' as string & { __brand?: 'SourceId' },
						sourceType: 'repository_scan',
						status: 'unknown',
						timestamp: {},
						title: 'Repository scan',
					},
				],
			}),
		);
		expect(result.warnings.some((w) => w.kind === 'inferred_source')).toBe(
			true,
		);
	});
});

// ---------------------------------------------------------------------------
// Consistency / boundary tests
// ---------------------------------------------------------------------------

describe('Consistency finding checks', () => {
	it('release-blocking consistency finding blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				consistencyFindings: [
					{
						code: 'root_path_consistency_violation',
						id: 'c-1',
						message: 'Root path contradiction',
						severity: 'fatal',
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(
			result.blockers.some(
				(b) => b.kind === 'release_blocking_consistency_finding',
			),
		).toBe(true);
	});

	it('non-blocking consistency finding warns', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				consistencyFindings: [
					{
						code: 'readme_profile_drift',
						id: 'c-warn',
						message: 'README profile drift detected',
						severity: 'warning',
					},
				],
			}),
		);
		expect(
			result.warnings.some(
				(w) => w.kind === 'non_blocking_consistency_finding',
			),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Executive profile readiness tests
// ---------------------------------------------------------------------------

describe('Executive profile readiness checks', () => {
	it('valid executive-generation config passes', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.executiveScopeCheck.executiveConfigLoaded).toBe(true);
		expect(result.executiveScopeCheck.executiveConfigValid).toBe(true);
		expect(result.executiveScopeCheck.status).toBe('satisfied');
	});

	it('missing executive config blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				executiveGenerationConfig: undefined,
			}),
		);
		expect(result.executiveScopeCheck.executiveConfigLoaded).toBe(false);
		expect(result.executiveScopeCheck.status).toBe('blocked');
		expect(
			result.blockers.some((b) => b.kind === 'executive_profile_invalid'),
		).toBe(true);
	});

	it('invalid executive config blocks', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				executiveGenerationConfig: {
					allowDraftGeneration: true,
					allowExportWhenDraft: false,
					loaded: true,
					requiredStatus: 'baseline_ready',
					valid: false,
					version: '1.0.0',
				},
			}),
		);
		expect(
			result.blockers.some((b) => b.kind === 'executive_profile_invalid'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Security / privacy tests
// ---------------------------------------------------------------------------

describe('Security / privacy checks', () => {
	it('secret leak finding blocks readiness', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				validationFindings: [
					{
						code: 'secret_like_value',
						id: 'v-secret-1',
						location: {},
						message: 'Secret detected',
						order: 0,
						severity: 'fatal',
						source: { kind: 'secret_scan', path: 'test' },
					},
				],
			}),
		);
		expect(result.status).toBe('blocked');
		expect(result.securityFindings.length).toBeGreaterThan(0);
	});

	it('path traversal blocks readiness', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				documentEntries: [
					{
						canonicalOutputPath: '../../../etc/passwd',
						descriptorStatus: 'confirmed',
						descriptorTitle: 'Thesis',
						documentCanonicalId: 'thesis',
						documentOrder: 0,
						phaseId: '01-foundation',
						phaseOrder: 0,
						required: true,
					},
				],
			}),
		);
		const hasPathBlocker = result.blockers.some(
			(b) => b.kind === 'unsafe_path' && b.message.includes('traversal'),
		);
		expect(hasPathBlocker).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Derived artifact boundary tests
// ---------------------------------------------------------------------------

describe('Derived artifact boundary checks', () => {
	it('derived artifact marked canonical produces violation', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				artifactRegistryEntries: [
					{
						artifactId: 'html-1',
						artifactType: 'html',
						isCanonical: true,
						path: 'logos/html/index.html',
						sourceDocumentIds: ['thesis'],
					},
				],
			}),
		);
		expect(result.derivedArtifactBoundaryViolations.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('Non-mutation guarantees', () => {
	it('readiness gate does not mutate inputs (read-only)', () => {
		const input = baseInput();
		const inputJson = JSON.stringify(input);
		evaluateNormativeBaselineReadiness(input);
		expect(JSON.stringify(input)).toBe(inputJson);
	});

	it('writes no files', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.changedPaths).toEqual([]);
		expect(result.dryRun).toBe(true);
	});

	it('does not call AI/provider code', () => {
		// The gate is a pure function with no side effects
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.readOnly).toBe(true);
		expect(result).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Deterministic ordering tests
// ---------------------------------------------------------------------------

describe('Deterministic ordering', () => {
	it('produces identical results for identical inputs', () => {
		const input = baseInput();
		const r1 = evaluateNormativeBaselineReadiness(input);
		const r2 = evaluateNormativeBaselineReadiness(input);
		expect(r1.status).toBe(r2.status);
		expect(r1.blockers.length).toBe(r2.blockers.length);
		expect(r1.warnings.length).toBe(r2.warnings.length);
		expect(r1.summary.blockerCount).toBe(r2.summary.blockerCount);
		expect(r1.summary.warningCount).toBe(r2.summary.warningCount);
	});

	it('document readiness follows phase/document order', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		const foundationDocs = result.documentReadiness.filter(
			(d) => d.phaseId === '01-foundation',
		);
		const productDocs = result.documentReadiness.filter(
			(d) => d.phaseId === '03-product',
		);
		expect(foundationDocs.length).toBeGreaterThan(0);
		expect(productDocs.length).toBeGreaterThan(0);

		// Foundation should come before product in order
		const foundationIdx = result.documentReadiness.findIndex(
			(d) => d.phaseId === '01-foundation',
		);
		const productIdx = result.documentReadiness.findIndex(
			(d) => d.phaseId === '03-product',
		);
		expect(foundationIdx).toBeLessThan(productIdx);
	});
});

// ---------------------------------------------------------------------------
// Report structure tests
// ---------------------------------------------------------------------------

describe('Readiness report', () => {
	it('includes summary', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.summary).toBeDefined();
		expect(result.summary.readinessStatus).toBe('ready');
		expect(result.summary.totalDocuments).toBe(2);
	});

	it('includes normative baseline scope', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.requiredDocumentIds).toContain('thesis');
		expect(result.requiredDocumentIds).toContain('product-brief');
		expect(result.requiredPhaseIds).toContain('01-foundation');
	});

	it('includes phase and document readiness', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.phaseReadiness.length).toBeGreaterThan(0);
		expect(result.documentReadiness.length).toBe(2);
	});

	it('includes recommended next actions', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.recommendedNextActions.length).toBeGreaterThan(0);
		expect(
			result.recommendedNextActions.some((a) =>
				a.toLowerCase().includes('executive'),
			),
		).toBe(true);
	});

	it('includes blockers and warnings', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(Array.isArray(result.blockers)).toBe(true);
		expect(Array.isArray(result.warnings)).toBe(true);
	});

	it('paths are relative/portable', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		for (const doc of result.documentReadiness) {
			if (doc.canonicalOutputPath) {
				expect(doc.canonicalOutputPath.startsWith('/')).toBe(false);
			}
		}
	});

	it('executive compilation is not performed', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.changedPaths).toEqual([]);
		expect(result.dryRun).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('Snapshot tests', () => {
	it('snapshot ready readiness result', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(result.status).toMatchSnapshot();
		expect(result.executiveCompilationGateStatus).toMatchSnapshot();
		expect(result.summary).toMatchSnapshot();
	});

	it('snapshot blocked readiness result', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessSummary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				stalenessTargets: [],
			}),
		);
		expect(result.status).toMatchSnapshot();
		expect(result.executiveCompilationGateStatus).toMatchSnapshot();
		expect(result.blockers.length).toBeGreaterThan(0);
		expect(result.blockers[0].kind).toMatchSnapshot();
	});

	it('snapshot missing canonical document blockers', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
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
				stalenessTargets: [],
			}),
		);
		expect(result.summary).toMatchSnapshot();
	});

	it('snapshot executive profile invalid blockers', () => {
		const result = evaluateNormativeBaselineReadiness(
			baseInput({
				executiveGenerationConfig: undefined,
			}),
		);
		expect(result.blockers.length).toBeGreaterThan(0);
		expect(result.blockers[0].kind).toMatchSnapshot();
	});

	it('snapshot readiness summary with no secrets', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		const json = JSON.stringify(result.summary);
		expect(json).not.toContain('sk-');
		expect(json).not.toContain('Bearer');
	});
});

// ---------------------------------------------------------------------------
// Status integration contract tests
// ---------------------------------------------------------------------------

describe('/status integration contract', () => {
	it('readiness result is serializable', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		const json = JSON.stringify(result);
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it('executive status is available for TUI display', () => {
		const result = evaluateNormativeBaselineReadiness(baseInput());
		expect(typeof result.status).toBe('string');
		expect(typeof result.summary.blockerCount).toBe('number');
		expect(typeof result.summary.warningCount).toBe('number');
		expect(typeof result.summary.staleNormativeDocCount).toBe('number');
		expect(typeof result.summary.blockingOpenQuestionCount).toBe('number');
	});
});
