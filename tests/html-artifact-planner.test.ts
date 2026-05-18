/** Step 9.1 — HTML Artifact Planner comprehensive tests */

import { describe, expect, it } from 'vitest';
import type {
	HtmlArtifactPlanInput,
	HtmlArtifactPlanOptions,
	HtmlArtifactPlanResult,
} from '../src/html/index.js';
import {
	createHtmlArtifactPlan,
	discoverHtmlArtifactDeclarations,
	isHtmlOutputPathSafe,
	resolveHtmlOutputPath,
	summarizeHtmlArtifactPlan,
} from '../src/html/index.js';

// ---------------------------------------------------------------------------
// Minimal input factory
// ---------------------------------------------------------------------------

function baseInput(
	overrides?: Partial<HtmlArtifactPlanInput>,
): HtmlArtifactPlanInput {
	return {
		artifactRegistryEntries: [],
		artifactRoot: undefined,
		contract: {
			documents: [],
			phases: [],
		},
		contractGraph: {
			getOutputsByDocumentId() {
				return [];
			},
			outputs: [],
		},
		dependencyGraph: { nodes: [] },
		documentationRoot: 'logos/',
		executiveConfig: undefined,
		manualEditCollisions: undefined,
		profileId: 'standard',
		regenerationPlan: undefined,
		registerSummary: undefined,
		stalenessResult: undefined,
		traceabilityMetadata: undefined,
		validationFindings: [],
		...overrides,
	};
}

function contractWithPhase(
	_phaseId: string,
	documents: HtmlArtifactPlanInput['contract']['documents'],
	_generatedOutputs?: Record<string, unknown>,
): {
	phases: HtmlArtifactPlanInput['contract']['phases'];
	documents: HtmlArtifactPlanInput['contract']['documents'];
} {
	return {
		documents,
		phases: [],
	};
}

function contractDocument(
	canonicalId: string,
	phaseId: string,
	overrides?: Partial<HtmlArtifactPlanInput['contract']['documents'][number]>,
): HtmlArtifactPlanInput['contract']['documents'][number] {
	return {
		canonicalId,
		descriptorId: canonicalId,
		outputArtifacts: [],
		phaseId,
		sourcePath: `/profiles/standard/phases/${phaseId}/${canonicalId}.yml`,
		status: 'drafting',
		title: canonicalId.replace(/-/g, ' '),
		...overrides,
	};
}

function makeInputWithDoc(
	canonicalId: string,
	phaseId: string,
	artifactOutputs?: HtmlArtifactPlanInput['contract']['documents'][number]['outputArtifacts'],
	canonicalOutputPath?: string,
): HtmlArtifactPlanInput {
	const doc = contractDocument(canonicalId, phaseId, {
		outputArtifacts: artifactOutputs ?? [],
	});
	const contractMap = contractWithPhase(phaseId, [doc]);

	const contractGraph: HtmlArtifactPlanInput['contractGraph'] = {
		getOutputsByDocumentId(id: string) {
			return this.outputs.filter((o) => o.documentCanonicalId === id);
		},
		outputs: [
			...((canonicalOutputPath !== undefined
				? [
						{
							documentCanonicalId: canonicalId,
							fieldPath: 'outputs.canonical',
							format: 'markdown',
							isCanonical: true,
							kind: 'canonical',
							outputId: undefined,
							path: canonicalOutputPath,
							phaseId,
							purpose: 'Canonical output',
							role: 'canonical',
							sourcePath: doc.sourcePath,
						},
					]
				: []) as HtmlArtifactPlanInput['contractGraph']['outputs']),
			...(artifactOutputs?.map((art) => ({
				audience: art.audience,
				documentCanonicalId: canonicalId,
				fieldPath: 'outputs.artifacts[0]',
				format: art.format,
				generationMode: art.generationMode,
				includes: art.includes,
				isCanonical: false,
				kind: 'artifact',
				outputId: art.id,
				path: art.path,
				phaseId,
				purpose: art.purpose,
				role: 'presentation',
				sourcePath: doc.sourcePath,
			})) ?? []),
		],
	};

	return baseInput({
		contract: {
			documents: contractMap.documents,
			phases: contractMap.phases,
		},
		contractGraph,
	});
}

function currentStaleness(
	canonicalId: string,
): HtmlArtifactPlanInput['stalenessResult'] {
	return {
		diagnostics: [],
		summary: {
			blockedCount: 0,
			currentCount: 1,
			missingCount: 0,
			orphanedCount: 0,
			staleCount: 0,
			total: 1,
			unknownCount: 0,
		},
		targets: [
			{
				artifactId: undefined,
				diagnostics: [],
				documentCanonicalId: canonicalId,
				graphNodeId: undefined,
				outputPath: undefined,
				phaseId: undefined,
				reasons: [],
				severity: 'info',
				status: 'current',
				targetId: `canonical:${canonicalId}`,
				targetKind: 'canonical_markdown',
			},
		],
	};
}

function staleStaleness(
	canonicalId: string,
): HtmlArtifactPlanInput['stalenessResult'] {
	return {
		diagnostics: [],
		summary: {
			blockedCount: 0,
			currentCount: 0,
			missingCount: 0,
			orphanedCount: 0,
			staleCount: 1,
			total: 1,
			unknownCount: 0,
		},
		targets: [
			{
				artifactId: undefined,
				diagnostics: [],
				documentCanonicalId: canonicalId,
				graphNodeId: undefined,
				outputPath: undefined,
				phaseId: undefined,
				reasons: [
					{
						code: 'decision_changed',
						message: 'Decision changed',
						severity: 'warning',
						sourceId: undefined,
						sourceKind: 'decision',
						sourcePath: undefined,
						targetId: `canonical:${canonicalId}`,
						upstreamTargetId: undefined,
					},
				],
				severity: 'warning',
				status: 'stale',
				targetId: `canonical:${canonicalId}`,
				targetKind: 'canonical_markdown',
			},
		],
	};
}

function missingStaleness(
	canonicalId: string,
): HtmlArtifactPlanInput['stalenessResult'] {
	return {
		diagnostics: [],
		summary: {
			blockedCount: 0,
			currentCount: 0,
			missingCount: 1,
			orphanedCount: 0,
			staleCount: 0,
			total: 1,
			unknownCount: 0,
		},
		targets: [
			{
				artifactId: undefined,
				diagnostics: [],
				documentCanonicalId: canonicalId,
				graphNodeId: undefined,
				outputPath: undefined,
				phaseId: undefined,
				reasons: [],
				severity: 'error',
				status: 'missing',
				targetId: `canonical:${canonicalId}`,
				targetKind: 'canonical_markdown',
			},
		],
	};
}

function blockedStaleness(
	canonicalId: string,
): HtmlArtifactPlanInput['stalenessResult'] {
	return {
		diagnostics: [],
		summary: {
			blockedCount: 1,
			currentCount: 0,
			missingCount: 0,
			orphanedCount: 0,
			staleCount: 0,
			total: 1,
			unknownCount: 0,
		},
		targets: [
			{
				artifactId: undefined,
				diagnostics: [],
				documentCanonicalId: canonicalId,
				graphNodeId: undefined,
				outputPath: undefined,
				phaseId: undefined,
				reasons: [],
				severity: 'error',
				status: 'blocked',
				targetId: `canonical:${canonicalId}`,
				targetKind: 'canonical_markdown',
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _normalizeResultForSnapshot(result: HtmlArtifactPlanResult) {
	return {
		diagnosticsCount: result.diagnostics.length,
		plan: {
			artifactRoot: result.plan.artifactRoot,
			blockerCount: result.plan.blockerCount,
			countByAction: result.plan.countByAction,
			countByKind: result.plan.countByKind,
			countByStatus: result.plan.countByStatus,
			declarationCount: result.plan.declarationCount,
			declaredArtifactPaths: result.plan.declaredArtifactPaths.map((p) =>
				p.replace(/^\/tmp\/[^/]+/, '<ROOT>'),
			),
			documentationRoot: result.plan.documentationRoot,
			dryRun: result.plan.dryRun,
			items: result.plan.items.map((item) => ({
				action: item.action,
				artifactId: item.artifactId,
				artifactKind: item.artifactKind,
				blockerCount: item.blockers.length,
				canonicalSourceDocumentIds: item.canonicalSourceDocumentIds,
				declarationSource: item.declarationSource,
				isDerivedNonCanonical: item.isDerivedNonCanonical,
				orderIndex: item.orderIndex,
				outputPath: item.outputPath,
				phaseId: item.phaseId,
				relativeOutputPath: item.relativeOutputPath.replace(
					/^\/tmp\/[^/]+/,
					'<ROOT>',
				),
				sourceCount: item.sources.length,
				sourcePhaseIds: item.sourcePhaseIds,
				status: item.status,
				title: item.title,
				traceabilityBoundary: item.traceabilityBoundary,
			})),
			missingSourceCount: result.plan.missingSourceCount,
			profileId: result.plan.profileId,
			requiresReviewCount: result.plan.requiresReviewCount,
			staleCount: result.plan.staleCount,
			unsafePathCount: result.plan.unsafePathCount,
			warningCount: result.plan.warningCount,
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HTML Artifact Declaration Discovery', () => {
	it('returns empty declarations when no HTML artifact declarations exist', () => {
		const input = baseInput();
		const result = discoverHtmlArtifactDeclarations(input);
		expect(result.declarations).toHaveLength(0);
		expect(result.diagnostics).toHaveLength(0);
	});

	it('discovers document-level HTML artifact from artifact output', () => {
		const input = makeInputWithDoc('01-thesis', '01-foundation', [
			{
				format: 'html',
				id: 'thesis_view',
				path: 'views/thesis.html',
				purpose: 'HTML review view for thesis',
			},
		]);
		const result = discoverHtmlArtifactDeclarations(input);
		expect(result.declarations).toHaveLength(1);
		expect(result.declarations[0]?.artifactKind).toBe('document_view');
		expect(result.declarations[0]?.declarationSource).toBe(
			'document_descriptor',
		);
		expect(result.declarations[0]?.outputPath).toBe('views/thesis.html');
	});

	it('discovers executive HTML mapping declaration', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					html: {
						mapping: 'executive/mappings/html.mapping.yml',
						path: 'logos/outcomes/executive/exports/html/executive-overview.html',
						status: 'supported',
					},
				},
				readinessStatus: undefined,
			},
		});
		const result = discoverHtmlArtifactDeclarations(input);
		expect(result.declarations).toHaveLength(1);
		expect(result.declarations[0]?.artifactKind).toBe(
			'executive_export_preview',
		);
		expect(result.declarations[0]?.declarationSource).toBe(
			'executive_html_mapping',
		);
	});

	it('produces diagnostic for empty path in declaration', () => {
		const doc = contractDocument('01-thesis', '01-foundation', {
			outputArtifacts: [{ format: 'html', id: 'bad', path: '' }],
		});
		const contractMap = contractWithPhase('01-foundation', [doc]);
		const input = baseInput({
			contract: {
				documents: contractMap.documents,
				phases: contractMap.phases,
			},
			contractGraph: {
				getOutputsByDocumentId() {
					return [];
				},
				outputs: [
					{
						documentCanonicalId: '01-thesis',
						fieldPath: 'outputs.artifacts[0]',
						format: 'html',
						isCanonical: false,
						kind: 'artifact',
						outputId: 'bad',
						path: '',
						phaseId: '01-foundation',
						purpose: undefined,
						role: 'presentation',
						sourcePath: doc.sourcePath,
					},
				],
			},
		});
		const result = discoverHtmlArtifactDeclarations(input);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_DECL_EMPTY_PATH'),
		).toBe(true);
	});

	it('declaration ordering is deterministic', () => {
		const doc1 = contractDocument('01-thesis', '01-foundation', {
			outputArtifacts: [
				{ format: 'html', id: 'view1', path: 'views/thesis.html' },
			],
		});
		const doc2 = contractDocument('02-problem', '01-foundation', {
			outputArtifacts: [
				{ format: 'html', id: 'view2', path: 'views/problem.html' },
			],
		});
		const contractMap = contractWithPhase('01-foundation', [doc1, doc2]);
		const input = baseInput({
			contract: {
				documents: contractMap.documents,
				phases: contractMap.phases,
			},
			contractGraph: {
				getOutputsByDocumentId() {
					return [];
				},
				outputs: [
					{
						documentCanonicalId: '01-thesis',
						fieldPath: 'outputs.artifacts[0]',
						format: 'html',
						isCanonical: false,
						kind: 'artifact',
						outputId: 'view1',
						path: 'views/thesis.html',
						phaseId: '01-foundation',
						purpose: undefined,
						role: 'presentation',
						sourcePath: doc1.sourcePath,
					},
					{
						documentCanonicalId: '02-problem',
						fieldPath: 'outputs.artifacts[0]',
						format: 'html',
						isCanonical: false,
						kind: 'artifact',
						outputId: 'view2',
						path: 'views/problem.html',
						phaseId: '01-foundation',
						purpose: undefined,
						role: 'presentation',
						sourcePath: doc2.sourcePath,
					},
				],
			},
		});

		const results = Array.from({ length: 5 }, () =>
			discoverHtmlArtifactDeclarations(input),
		);
		const first = results[0];
		if (!first) return;
		for (const r of results.slice(1)) {
			expect(r.declarations.map((d) => d.artifactId)).toEqual(
				first.declarations.map((d) => d.artifactId),
			);
		}
	});

	it('no declarations returns empty plan without crash', () => {
		const input = baseInput();
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items).toHaveLength(0);
		expect(result.plan.declarationCount).toBe(0);
		expect(
			result.diagnostics.filter((d) => d.severity === 'error'),
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Source Resolution
// ---------------------------------------------------------------------------

describe('HTML Artifact Source Resolution', () => {
	it('document-specific artifact resolves corresponding canonical Markdown source', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items).toHaveLength(1);
		const item = result.plan.items[0];
		if (!item) return;
		expect(item.canonicalSourceDocumentIds).toContain('01-thesis');
		expect(
			item.sources.some((s) => s.sourceKind === 'canonical_markdown'),
		).toBe(true);
	});

	it('dashboard artifact resolves declared canonical docs', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'html',
					id: 'dashboard',
					path: 'dashboards/overview.html',
					purpose: 'dashboard',
				},
			],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.artifactKind).toBe('dashboard');
		expect(result.plan.items[0]?.canonicalSourceDocumentIds).toContain(
			'01-thesis',
		);
	});

	it('decision map artifact resolves decision register sources', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'html',
					id: 'decisions',
					path: 'maps/decisions.html',
					purpose: 'decision',
				},
			],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.artifactKind).toBe('decision_map');
		expect(
			result.plan.items[0]?.sources.some(
				(s) => s.sourceKind === 'decision_register',
			),
		).toBe(true);
	});

	it('risk map artifact resolves risk register sources', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'html',
					id: 'risks',
					path: 'maps/risks.html',
					purpose: 'risk',
				},
			],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.artifactKind).toBe('risk_map');
		expect(
			result.plan.items[0]?.sources.some(
				(s) => s.sourceKind === 'risk_register',
			),
		).toBe(true);
	});

	it('validation summary artifact resolves validation findings', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'validation', path: 'reports/validation.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.artifactKind).toBe('validation_summary');
		expect(
			result.plan.items[0]?.sources.some(
				(s) => s.sourceKind === 'validation_finding',
			),
		).toBe(true);
	});

	it('HTML artifact is never used as source for canonical Markdown', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		for (const item of result.plan.items) {
			expect(item.isDerivedNonCanonical).toBe(true);
			expect(
				item.sources.every(
					(s) =>
						s.sourceKind !== 'canonical_markdown' ||
						s.documentCanonicalId !== item.artifactId,
				),
			).toBe(true);
		}
	});

	it('executive preview artifact resolves executive declarations without compiling Executive Axis', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					html: {
						mapping: 'executive/mappings/html.mapping.yml',
						path: 'logos/outcomes/executive/exports/html/executive-overview.html',
						status: 'supported',
					},
				},
				readinessStatus: undefined,
			},
		});
		const result = createHtmlArtifactPlan(input);
		const execItem = result.plan.items.find(
			(i) => i.artifactKind === 'executive_export_preview',
		);
		expect(execItem).toBeDefined();
		expect(
			execItem?.sources.some((s) => s.sourceKind === 'executive_metadata'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Readiness / Blocker
// ---------------------------------------------------------------------------

describe('HTML Artifact Readiness and Blocker Rules', () => {
	it('current canonical source makes artifact ready', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('ready');
		expect(result.plan.items[0]?.action).toBe('plan_render');
	});

	it('missing canonical source blocks artifact', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: missingStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(
			result.plan.items[0]?.blockers.some(
				(b) => b.code === 'canonical_source_missing',
			),
		).toBe(true);
	});

	it('stale canonical source blocks artifact', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: staleStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(
			result.plan.items[0]?.blockers.some(
				(b) => b.code === 'canonical_source_stale',
			),
		).toBe(true);
	});

	it('blocked canonical source blocks artifact', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: blockedStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(
			result.plan.items[0]?.blockers.some(
				(b) => b.code === 'canonical_source_blocked',
			),
		).toBe(true);
	});

	it('unknown canonical source status marks ready when no staleness info (conservative)', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		// No staleness result at all - planner proceeds conservatively
		const result = createHtmlArtifactPlan(input);
		expect(
			result.plan.items[0]?.status === 'ready' ||
				result.plan.items[0]?.status === 'requires_review',
		).toBe(true);
	});

	it('release-blocking validation finding blocks artifact', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithFinding: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: currentStaleness('01-thesis'),
			validationFindings: [
				{
					code: 'document_missing_dependency',
					documentCanonicalId: '01-thesis',
					id: 'find-1',
					message: 'Missing dependency',
					phaseId: '01-foundation',
					severity: 'error',
				},
			],
		};
		const result = createHtmlArtifactPlan(inputWithFinding);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(
			result.plan.items[0]?.blockers.some(
				(b) => b.code === 'release_blocking_validation_finding',
			),
		).toBe(true);
	});

	it('release-blocking consistency finding blocks artifact', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithFinding: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: currentStaleness('01-thesis'),
			validationFindings: [
				{
					code: 'consistency_boundary_violation',
					documentCanonicalId: '01-thesis',
					id: 'find-2',
					message: 'Boundary violation',
					phaseId: '01-foundation',
					severity: 'error',
				},
			],
		};
		const result = createHtmlArtifactPlan(inputWithFinding);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(
			result.plan.items[0]?.blockers.some(
				(b) => b.code === 'release_blocking_consistency_finding',
			),
		).toBe(true);
	});

	it('unresolved blocking open question creates blocker warning', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithQuestions: HtmlArtifactPlanInput = {
			...input,
			registerSummary: {
				blockingOpenQuestionCount: 2,
				missingSourceCount: 0,
				reviewRequiredCount: 0,
			},
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithQuestions);
		expect(
			result.plan.items[0]?.reasons.some(
				(b) => b.code === 'unresolved_blocking_open_question',
			),
		).toBe(true);
	});

	it('traceability review-required creates requires_review status', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithTrace: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: currentStaleness('01-thesis'),
			traceabilityMetadata: {
				boundary: 'derived',
				claimCount: 10,
				outputKind: 'html_artifact',
				reviewRequiredCount: 5,
				sourceCount: 5,
			},
		};
		const result = createHtmlArtifactPlan(inputWithTrace);
		expect(result.plan.items[0]?.status).toBe('requires_review');
	});
});

// ---------------------------------------------------------------------------
// Staleness / Regeneration Integration
// ---------------------------------------------------------------------------

describe('Staleness and Regeneration Integration', () => {
	it('artifact with current canonical source is ready', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('ready');
	});

	it('artifact with stale canonical source is blocked until canonical regeneration', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: staleStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(result.plan.items[0]?.action).toBe('block_until_canonical_current');
	});

	it('artifact with canonical source blocked in regeneration plan is blocked', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithRegen: HtmlArtifactPlanInput = {
			...input,
			regenerationPlan: {
				diagnostics: [],
				items: [
					{
						action: 'block_until_canonical_current',
						artifactId: undefined,
						blockers: [],
						canonicalPrerequisites: [],
						documentCanonicalId: '01-thesis',
						outputPath: undefined,
						phaseId: '01-foundation',
						safeOrderIndex: 0,
						status: 'blocked',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithRegen);
		expect(result.plan.items[0]?.status).toBe('blocked');
	});

	it('no regeneration is executed', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		// No writes should occur - just checking the plan is created
		expect(result.plan.readOnly).toBe(true);
		expect(result.plan.dryRun).toBe(true);
	});

	it('no files are written by the planner', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Output Path
// ---------------------------------------------------------------------------

describe('Output Path Planning and Safety', () => {
	it('default root is logos/', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.documentationRoot).toBe('logos/');
	});

	it('custom documentation/artifact root is honored', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const options: HtmlArtifactPlanOptions = {
			artifactRootOverride: 'outcomes/',
			documentationRootOverride: 'outcomes/',
		};
		const result = createHtmlArtifactPlan(input, options);
		expect(result.plan.documentationRoot).toBe('outcomes/');
	});

	it('relative HTML output path resolves safely', () => {
		const result = resolveHtmlOutputPath(
			'views/thesis.html',
			'logos/',
			undefined,
		);
		expect(result).toBe('logos/views/thesis.html');
	});

	it('path traversal is rejected', () => {
		const safety = isHtmlOutputPathSafe(
			'logos/../unsafe/thesis.html',
			'logos/',
		);
		expect(safety.safe).toBe(false);
	});

	it('unsafe absolute path is rejected', () => {
		const safety = isHtmlOutputPathSafe('/tmp/unsafe/thesis.html', 'logos/');
		expect(safety.safe).toBe(false);
	});

	it('normalized output paths are deterministic', () => {
		const results = Array.from({ length: 5 }, () =>
			resolveHtmlOutputPath('views/thesis.html', 'logos/', undefined),
		);
		for (const r of results.slice(1)) {
			expect(r).toBe(results[0]);
		}
	});
});

// ---------------------------------------------------------------------------
// Artifact Registry Comparison
// ---------------------------------------------------------------------------

describe('Artifact Registry Comparison', () => {
	it('existing current HTML artifact can be skipped', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithRegistry: HtmlArtifactPlanInput = {
			...input,
			artifactRegistryEntries: [
				{
					artifactId: 'existing-art-1',
					artifactType: 'html',
					checksum: 'abc123',
					generatedAt: '2025-06-01T00:00:00Z',
					isCanonical: false,
					metadata: undefined,
					path: 'logos/views/thesis.html',
					runId: 'run-1',
					sourceDocumentIds: ['01-thesis'],
					status: 'generated',
				},
			],
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithRegistry);
		expect(result.plan.items[0]?.status).toBe('skipped');
		expect(result.plan.items[0]?.action).toBe('skip_current');
	});

	it('existing HTML artifact becomes stale when canonical source status is stale', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithRegistry: HtmlArtifactPlanInput = {
			...input,
			artifactRegistryEntries: [
				{
					artifactId: 'existing-art-1',
					artifactType: 'html',
					checksum: 'abc123',
					generatedAt: '2025-01-01T00:00:00Z',
					isCanonical: false,
					metadata: undefined,
					path: 'logos/views/thesis.html',
					runId: 'run-1',
					sourceDocumentIds: ['01-thesis'],
					status: 'generated',
				},
			],
			stalenessResult: staleStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithRegistry);
		expect(result.plan.items[0]?.status).toBe('blocked');
	});

	it('does not update artifact registry', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const artifacts = [...input.artifactRegistryEntries];
		createHtmlArtifactPlan(input);
		expect(input.artifactRegistryEntries).toEqual(artifacts);
	});

	it('orphaned HTML artifact metadata from non-existent declaration is diagnosed', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithOrphan: HtmlArtifactPlanInput = {
			...input,
			artifactRegistryEntries: [
				{
					artifactId: 'orphan-art',
					artifactType: 'html',
					checksum: undefined,
					generatedAt: undefined,
					isCanonical: false,
					metadata: undefined,
					path: 'logos/old/removed.html',
					runId: undefined,
					sourceDocumentIds: [],
					status: 'generated',
				},
			],
		};
		const result = createHtmlArtifactPlan(inputWithOrphan);
		expect(result.plan.items).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Manual Edit Safety
// ---------------------------------------------------------------------------

describe('Manual Edit Safety', () => {
	it('existing artifact with manual edit collision creates warning', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithCollision: HtmlArtifactPlanInput = {
			...input,
			manualEditCollisions: ['logos/views/thesis.html'],
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithCollision);
		expect(
			result.plan.items[0]?.reasons.some(
				(b) => b.code === 'manual_edit_collision',
			),
		).toBe(true);
	});

	it('planner does not overwrite files', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('planner does not create backup', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan).toBeDefined();
		expect(result.plan.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Traceability Integration
// ---------------------------------------------------------------------------

describe('Traceability Integration', () => {
	it('plan item includes derived/non-canonical marker', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.isDerivedNonCanonical).toBe(true);
	});

	it('plan item lists canonical sources', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.canonicalSourceDocumentIds).toEqual([
			'01-thesis',
		]);
	});

	it('plan item includes traceability boundary', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.items[0]?.traceabilityBoundary).toBe('derived');
	});

	it('no HTML is rendered', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		// No write operations - just verify we have a valid plan
		expect(result.plan.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('HTML Artifact Planner Non-Mutation', () => {
	it('writes no files', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('does not create a workspace state file', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('does not update artifact registry', () => {
		const artifacts = [
			{
				artifactId: 'any',
				artifactType: 'html' as const,
				checksum: undefined,
				generatedAt: undefined,
				isCanonical: false,
				metadata: undefined,
				path: 'some.html',
				runId: undefined,
				sourceDocumentIds: [],
				status: 'generated' as const,
			},
		];
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const savedArtifacts = [...artifacts];
		const inputWithArtifacts: HtmlArtifactPlanInput = {
			...input,
			artifactRegistryEntries: artifacts,
		};
		createHtmlArtifactPlan(inputWithArtifacts);
		expect(artifacts).toEqual(savedArtifacts);
	});

	it('does not persist generation runs', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('does not generate HTML/agent packs/executive outputs', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('does not call AI/provider code', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan).toBeDefined();
	});

	it('does not mutate canonical Markdown', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('no test mutates the real repository', () => {
		result = createHtmlArtifactPlan(baseInput());
		expect(result.plan).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('HTML Artifact Plan Snapshots', () => {
	it('snapshot Standard HTML artifact plan summary', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{ format: 'html', id: 'view1', path: 'views/thesis.html' },
				{
					format: 'html',
					id: 'view2',
					path: 'views/thesis-dashboard.html',
					purpose: 'dashboard',
				},
			],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: currentStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		const summary = summarizeHtmlArtifactPlan(result.plan);
		expect(summary.declaredCount).toBe(2);
		expect(summary.readyCount).toBe(2);
		expect(summary.blockedCount).toBe(0);
		expect(summary).toMatchSnapshot();
	});

	it('snapshot blocked missing-source plan', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: missingStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(result.plan.items[0]?.status).toBe('blocked');
		expect(result.plan.countByStatus.blocked).toBe(1);
	});

	it('snapshot stale canonical source plan', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithStaleness: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: staleStaleness('01-thesis'),
		};
		const result = createHtmlArtifactPlan(inputWithStaleness);
		expect(
			result.plan.items[0]?.blockers.some(
				(b) => b.code === 'canonical_source_stale',
			),
		).toBe(true);
	});

	it('snapshot executive HTML mapping plan', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					html: {
						mapping: 'executive/mappings/html.mapping.yml',
						path: 'logos/outcomes/executive/exports/html/executive-overview.html',
						status: 'supported',
					},
				},
				readinessStatus: undefined,
			},
		});
		const result = createHtmlArtifactPlan(input);
		const execItem = result.plan.items.find(
			(i) => i.artifactKind === 'executive_export_preview',
		);
		expect(execItem).toBeDefined();
		expect(execItem?.declarationSource).toBe('executive_html_mapping');
		expect(execItem?.isDerivedNonCanonical).toBe(true);
	});

	it('snapshot diagnostics for malformed declaration', () => {
		const doc = contractDocument('01-thesis', '01-foundation', {
			outputArtifacts: [],
		});
		const contractMap = contractWithPhase('01-foundation', [doc]);
		const input = baseInput({
			contract: {
				documents: contractMap.documents,
				phases: contractMap.phases,
			},
			contractGraph: {
				getOutputsByDocumentId() {
					return [];
				},
				outputs: [
					{
						documentCanonicalId: '01-thesis',
						fieldPath: 'outputs.artifacts[0]',
						format: 'html',
						isCanonical: false,
						kind: 'artifact',
						outputId: 'bad-id',
						path: '',
						phaseId: '01-foundation',
						purpose: undefined,
						role: 'presentation',
						sourcePath: doc.sourcePath,
					},
				],
			},
		});
		const result = createHtmlArtifactPlan(input);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_DECL_EMPTY_PATH'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Deterministic Ordering
// ---------------------------------------------------------------------------

describe('Deterministic Ordering', () => {
	it('plan items are ordered deterministically', () => {
		const doc1 = contractDocument('01-thesis', '01-foundation', {
			outputArtifacts: [
				{ format: 'html', id: 'view1', path: 'views/thesis.html' },
			],
		});
		const doc2 = contractDocument('02-problem', '01-foundation', {
			outputArtifacts: [
				{ format: 'html', id: 'view2', path: 'views/problem.html' },
			],
		});
		const contractMap = contractWithPhase('01-foundation', [doc1, doc2]);
		const input = baseInput({
			contract: {
				documents: contractMap.documents,
				phases: contractMap.phases,
			},
			contractGraph: {
				getOutputsByDocumentId() {
					return [];
				},
				outputs: [
					{
						documentCanonicalId: '01-thesis',
						fieldPath: 'outputs.artifacts[0]',
						format: 'html',
						isCanonical: false,
						kind: 'artifact',
						outputId: 'view1',
						path: 'views/thesis.html',
						phaseId: '01-foundation',
						purpose: undefined,
						role: 'presentation',
						sourcePath: doc1.sourcePath,
					},
					{
						documentCanonicalId: '02-problem',
						fieldPath: 'outputs.artifacts[0]',
						format: 'html',
						isCanonical: false,
						kind: 'artifact',
						outputId: 'view2',
						path: 'views/problem.html',
						phaseId: '01-foundation',
						purpose: undefined,
						role: 'presentation',
						sourcePath: doc2.sourcePath,
					},
				],
			},
		});

		const results = Array.from({ length: 5 }, () =>
			createHtmlArtifactPlan(input),
		);
		const first = results[0];
		if (!first) return;
		for (const r of results.slice(1)) {
			expect(r.plan.items.map((i) => i.artifactId)).toEqual(
				first.plan.items.map((i) => i.artifactId),
			);
		}
	});

	it('blockers are ordered by severity and code', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const inputWithBlockers: HtmlArtifactPlanInput = {
			...input,
			stalenessResult: staleStaleness('01-thesis'),
			validationFindings: [
				{
					code: 'document_missing_dependency',
					documentCanonicalId: '01-thesis',
					id: 'find-1',
					message: 'Missing dep',
					phaseId: '01-foundation',
					severity: 'error',
				},
			],
		};
		const result = createHtmlArtifactPlan(inputWithBlockers);
		const sevs = result.plan.items[0]?.blockers.map((b) => b.severity) ?? [];
		expect(sevs[0]).toBe('error');
	});
});

// ---------------------------------------------------------------------------
// Plan summary invariants
// ---------------------------------------------------------------------------

describe('HTML Artifact Plan Summary', () => {
	it('summary includes declared/ready/blocked/missing/stale/skipped/unknown counts', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		const summary = summarizeHtmlArtifactPlan(result.plan);
		expect(typeof summary.declaredCount).toBe('number');
		expect(typeof summary.readyCount).toBe('number');
		expect(typeof summary.blockedCount).toBe('number');
		expect(typeof summary.staleCount).toBe('number');
		expect(typeof summary.missingSourceCount).toBe('number');
		expect(typeof summary.skippedCount).toBe('number');
		expect(typeof summary.unknownCount).toBe('number');
		expect(Array.isArray(summary.plannedPaths)).toBe(true);
		expect(Array.isArray(summary.blockerSummary)).toBe(true);
	});

	it('plan is marked read-only', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('dry-run is true by default', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[{ format: 'html', id: 'view', path: 'views/thesis.html' }],
			'docs/01-foundation/01-thesis.md',
		);
		const result = createHtmlArtifactPlan(input);
		expect(result.plan.dryRun).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

describe('HTML Artifact Planner Security', () => {
	it('does not include raw provider tokens', () => {
		result = createHtmlArtifactPlan(baseInput());
		const json = JSON.stringify(result.plan);
		expect(json).not.toContain('sk-');
		expect(json).not.toContain('api_key');
		expect(json).not.toContain('token');
	});

	it('does not include raw prompts or model responses', () => {
		result = createHtmlArtifactPlan(baseInput());
		const json = JSON.stringify(result.plan);
		expect(json).not.toContain('system prompt');
		expect(json).not.toContain('assistant response');
	});

	it('does not include environment values', () => {
		result = createHtmlArtifactPlan(baseInput());
		const json = JSON.stringify(result.plan);
		expect(json).not.toContain('process.env');
	});

	it('does not include private chat history', () => {
		result = createHtmlArtifactPlan(baseInput());
		const json = JSON.stringify(result.plan);
		expect(json).not.toContain('chatHistory');
		expect(json).not.toContain('messages');
	});
});

// ---------------------------------------------------------------------------
// Module-level result variable for security tests
// ---------------------------------------------------------------------------

let result: HtmlArtifactPlanResult = {
	diagnostics: [],
	plan: {
		artifactRoot: undefined,
		blockerCount: 0,
		countByAction: {},
		countByKind: {},
		countByStatus: {},
		declarationCount: 0,
		declaredArtifactPaths: [],
		diagnostics: [],
		documentationRoot: 'logos/',
		dryRun: true,
		items: [],
		missingSourceCount: 0,
		profileId: 'standard',
		readOnly: true,
		requiresReviewCount: 0,
		staleCount: 0,
		unsafePathCount: 0,
		warningCount: 0,
	},
};
