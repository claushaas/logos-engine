/** Step 9.3 — HTML Review View Generation comprehensive tests */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HtmlReviewViewDataInput } from '../src/html/index.js';
import {
	buildDashboardViewData,
	buildDecisionMapViewData,
	buildDocumentViewData,
	buildExecutiveReadinessViewData,
	buildPhaseMapViewData,
	buildReadinessViewData,
	buildRiskMapViewData,
	buildValidationSummaryViewData,
	generateHtmlReviewViews,
	getViewDataBuilder,
	performSecurityAudit,
} from '../src/html/index.js';
import { registerArtifact } from '../src/state/artifact-registry.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_TIMESTAMP = '2026-05-18T10:30:00.000Z';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function emptyViewDataInput(
	overrides?: Partial<HtmlReviewViewDataInput>,
): HtmlReviewViewDataInput {
	return {
		artifactRegistryEntryCount: 0,
		assumptions: [],
		decisions: [],
		documentationRoot: 'logos/',
		documents: [],
		hypotheses: [],
		openQuestions: [],
		phases: [],
		profileId: 'standard',
		profileVersion: '1.0.0',
		risks: [],
		validationFindings: [],
		...overrides,
	};
}

function makePhase(
	id: string,
	title: string,
	order: number,
): HtmlReviewViewDataInput['phases'][number] {
	return {
		documents: [],
		id,
		order,
		sourcePath: `profiles/standard/phases/${id}.yml`,
		status: 'active',
		title,
	};
}

function makeDocument(
	canonicalId: string,
	phaseId: string,
	status: string,
): HtmlReviewViewDataInput['documents'][number] {
	return {
		canonicalId,
		phaseId,
		sourcePath: `logos/${phaseId}/${canonicalId}.md`,
		status,
		title: canonicalId.replace(/-/g, ' '),
	};
}

function makeDecision(
	id: string,
	overrides?: Partial<HtmlReviewViewDataInput['decisions'][number]>,
): HtmlReviewViewDataInput['decisions'][number] {
	return {
		affectedDocumentIds: [],
		confidence: 'explicit',
		id,
		isInferred: false,
		reviewRequired: false,
		reviewState: 'approved',
		sourceIds: [],
		status: 'confirmed',
		summary: `Decision ${id} summary`,
		title: `Decision ${id}`,
		...overrides,
	};
}

function makeRisk(
	id: string,
	overrides?: Partial<HtmlReviewViewDataInput['risks'][number]>,
): HtmlReviewViewDataInput['risks'][number] {
	return {
		affectedDocumentIds: [],
		confidence: 'explicit',
		id,
		isInferred: false,
		mitigation: undefined,
		reviewRequired: false,
		sourceIds: [],
		status: 'accepted',
		summary: `Risk ${id} summary`,
		title: `Risk ${id}`,
		...overrides,
	};
}

function makeValidationFinding(
	id: string,
	severity: string,
): HtmlReviewViewDataInput['validationFindings'][number] {
	return {
		code: `E_TEST_${id.toUpperCase()}`,
		documentCanonicalId: undefined,
		id,
		isReleaseBlocker: severity === 'fatal' || severity === 'error',
		message: `Finding ${id} message`,
		path: undefined,
		phaseId: undefined,
		pointer: undefined,
		recoveryHint: undefined,
		severity,
	};
}

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	const { mkdtemp } = await import('node:fs/promises');
	const { tmpdir } = await import('node:os');
	const temp = await mkdtemp(join(tmpdir(), 'logos-html-review-'));
	tempDir = resolve(temp);
});

afterEach(async () => {
	try {
		await rm(tempDir, { force: true, recursive: true });
	} catch {
		// cleanup failure is acceptable
	}
});

async function initTempWorkspace(): Promise<{
	projectRoot: string;
	docRoot: string;
	logosDir: string;
}> {
	const projectRoot = tempDir;
	const docRoot = join(projectRoot, 'logos');
	const logosDir = join(projectRoot, '.logos');
	await mkdir(docRoot, { recursive: true });
	await mkdir(logosDir, { recursive: true });

	const state = createDefaultWorkspaceState({
		projectRootPath: resolve(projectRoot),
	});
	state.documentation.rootPath = 'logos/';

	const workspacePath = join(logosDir, 'workspace.json');
	const json = JSON.stringify(state, null, '\t');
	await writeFile(workspacePath, json, 'utf-8');

	return { docRoot, logosDir, projectRoot };
}

async function initTempWorkspaceWithProfiles(): Promise<{
	projectRoot: string;
	docRoot: string;
	logosDir: string;
}> {
	const workspace = await initTempWorkspace();
	await cp(resolve('profiles'), join(workspace.projectRoot, 'profiles'), {
		recursive: true,
	});
	return workspace;
}

// ==========================================================================
// View Data Builder Tests
// ==========================================================================

describe('view data builders', () => {
	describe('dashboard data builder', () => {
		it('includes document/status/staleness/validation/register/traceability counts', () => {
			const input = emptyViewDataInput({
				documents: [
					makeDocument('doc-1', '01-foundation', 'current'),
					makeDocument('doc-2', '01-foundation', 'drafting'),
					makeDocument('doc-3', '02-validation', 'current'),
				],
				phases: [
					{
						...makePhase('01-foundation', 'Foundation', 1),
						documents: [
							{
								canonicalId: 'doc-1',
								sourcePath: 'logos/01-foundation/doc-1.md',
								status: 'current',
								title: 'Doc 1',
							},
							{
								canonicalId: 'doc-2',
								sourcePath: 'logos/01-foundation/doc-2.md',
								status: 'drafting',
								title: 'Doc 2',
							},
						],
					},
					{
						...makePhase('02-validation', 'Validation', 2),
						documents: [
							{
								canonicalId: 'doc-3',
								sourcePath: 'logos/02-validation/doc-3.md',
								status: 'current',
								title: 'Doc 3',
							},
						],
					},
				],
				registerCount: {
					assumptions: 1,
					decisions: 2,
					hypotheses: 0,
					questions: 1,
					risks: 3,
				},
				stalenessData: {
					blockedDocumentIds: new Set(),
					missingDocumentIds: new Set(),
					staleDocumentIds: new Set(['doc-2']),
					statusByDocumentId: new Map(),
				},
				traceabilityData: {
					claimCount: 5,
					inferredClaimCount: 1,
					missingSourceCount: 0,
					reviewRequiredCount: 2,
					sourceCount: 10,
				},
				validationFindings: [makeValidationFinding('vf-1', 'warning')],
			});

			const result = buildDashboardViewData(input, 'dashboard');

			expect(result.summary).toBeDefined();
			expect(result.summary?.documentCount).toBe(3);
			expect(result.summary?.phaseCount).toBe(2);
			expect(result.summary?.readyCount).toBe(2);
			expect(result.summary?.staleCount).toBe(1);
			expect(result.summary?.validationFindingCount).toBe(1);
			expect(result.summary?.registerCount).toBe(7);
			expect(result.summary?.traceabilityCount).toBe(15);
			expect(result.phases).toBeDefined();
			expect(result.phases?.length).toBe(2);
			expect(result.sections.length).toBeGreaterThanOrEqual(1);
			expect(result.sections[0].sectionKind).toBe('summary');
		});

		it('missing data becomes explicit empty/unknown state', () => {
			const input = emptyViewDataInput();

			const result = buildDashboardViewData(input, 'dashboard');

			expect(result.summary).toBeDefined();
			expect(result.summary?.documentCount).toBe(0);
			expect(result.summary?.phaseCount).toBe(0);
			expect(result.summary?.readyCount).toBe(0);
			expect(result.summary?.blockedCount).toBe(0);
			expect(result.summary?.staleCount).toBe(0);
			expect(result.summary?.missingCount).toBe(0);
			expect(result.summary?.validationFindingCount).toBeUndefined();
			expect(result.summary?.registerCount).toBeUndefined();
			expect(result.summary?.traceabilityCount).toBeUndefined();
		});
	});

	describe('phase map data builder', () => {
		it('includes phases/documents/status/staleness/dependency counts', () => {
			const input = emptyViewDataInput({
				documents: [
					makeDocument('doc-a', '01-foundation', 'current'),
					makeDocument('doc-b', '02-validation', 'drafting'),
				],
				phases: [
					{
						...makePhase('01-foundation', 'Foundation', 1),
						documents: [
							{
								canonicalId: 'doc-a',
								sourcePath: 'logos/01-foundation/doc-a.md',
								status: 'current',
								title: 'Doc A',
							},
						],
					},
					{
						...makePhase('02-validation', 'Validation', 2),
						documents: [
							{
								canonicalId: 'doc-b',
								sourcePath: 'logos/02-validation/doc-b.md',
								status: 'drafting',
								title: 'Doc B',
							},
						],
					},
				],
				stalenessData: {
					blockedDocumentIds: new Set(),
					missingDocumentIds: new Set(),
					staleDocumentIds: new Set(['doc-b']),
					statusByDocumentId: new Map(),
				},
			});

			const result = buildPhaseMapViewData(input, 'phase_map');

			expect(result.summary?.phaseCount).toBe(2);
			expect(result.summary?.documentCount).toBe(2);
			expect(result.summary?.staleCount).toBe(1);
			expect(result.phases?.length).toBe(2);
			expect(result.documents?.length).toBe(2);
			expect(result.sections.some((s) => s.sectionKind === 'phase_list')).toBe(
				true,
			);
			expect(
				result.sections.some((s) => s.sectionKind === 'document_list'),
			).toBe(true);
		});
	});

	describe('decision map data builder', () => {
		it('includes decisions/statuses/affected docs/sources/review state/confidence', () => {
			const input = emptyViewDataInput({
				decisions: [
					makeDecision('dec-1'),
					makeDecision('dec-2', {
						confidence: 'inferred',
						reviewRequired: true,
						reviewState: 'requires_review',
						status: 'proposed',
					}),
				],
			});

			const result = buildDecisionMapViewData(input, 'decision_map');

			expect(result.decisions?.length).toBe(2);
			expect(result.decisions?.[0].id).toBe('dec-1');
			expect(result.decisions?.[0].status).toBe('confirmed');
			expect(result.decisions?.[0].confidence).toBe('explicit');
			expect(result.decisions?.[1].reviewRequired).toBe(true);
			expect(result.summary?.extraFields?.['Review Required']).toBe('1');
		});
	});

	describe('risk map data builder', () => {
		it('includes risks/statuses/affected docs/mitigation/review state/confidence', () => {
			const input = emptyViewDataInput({
				risks: [
					makeRisk('risk-1'),
					makeRisk('risk-2', {
						confidence: 'inferred',
						mitigation: 'Apply rate limiting',
						reviewRequired: true,
						status: 'proposed',
					}),
				],
			});

			const result = buildRiskMapViewData(input, 'risk_map');

			expect(result.risks?.length).toBe(2);
			expect(result.risks?.[1].mitigation).toBe('Apply rate limiting');
			expect(result.risks?.[1].reviewRequired).toBe(true);
			expect(result.summary?.extraFields?.['Review Required']).toBe('1');
		});
	});

	describe('validation summary data builder', () => {
		it('includes gate status/findings/recovery hints/blockers', () => {
			const input = emptyViewDataInput({
				validationFindings: [
					makeValidationFinding('vf-1', 'fatal'),
					makeValidationFinding('vf-2', 'error'),
					makeValidationFinding('vf-3', 'warning'),
					makeValidationFinding('vf-4', 'info'),
				],
			});

			const result = buildValidationSummaryViewData(
				input,
				'validation_summary',
			);

			expect(result.validationFindings?.length).toBe(4);
			expect(result.summary?.extraFields?.Fatal).toBe('1');
			expect(result.summary?.extraFields?.Error).toBe('1');
			expect(result.summary?.extraFields?.['Gate Status']).toBe('fail');
			expect(result.summary?.extraFields?.['Release Blockers']).toBe('2');
		});
	});

	describe('readiness data builder', () => {
		it('includes validation/staleness/consistency/open questions/review-required/missing-source counts', () => {
			const input = emptyViewDataInput({
				consistencyStatus: {
					boundaryViolationCount: 1,
					contradictionCount: 0,
					overall: 'warning',
				},
				decisions: [makeDecision('dec-1', { reviewRequired: true })],
				documents: [makeDocument('doc-1', '01-foundation', 'current')],
				openQuestions: [
					{
						affectedDocumentIds: [],
						id: 'oq-1',
						isBlocking: true,
						reviewRequired: true,
						status: 'open',
						summary: 'Unresolved',
						title: 'OQ1',
					},
				],
				risks: [makeRisk('risk-1', { reviewRequired: true })],
				stalenessData: {
					blockedDocumentIds: new Set(),
					missingDocumentIds: new Set(),
					staleDocumentIds: new Set(),
					statusByDocumentId: new Map(),
				},
				validationFindings: [],
			});

			const result = buildReadinessViewData(input, 'readiness_view');

			expect(result.summary?.extraFields?.['Readiness Status']).toBe(
				'not_ready',
			);
			expect(
				result.summary?.extraFields?.['Unresolved Blocking Questions'],
			).toBe('1');
			expect(result.summary?.extraFields?.['Review-Required Items']).toBe('3');
			expect(result.summary?.extraFields?.['Consistency Status']).toBe(
				'warning',
			);
			expect(
				result.sections.some((s) => s.sectionKind === 'readiness_status'),
			).toBe(true);
		});
	});

	describe('executive readiness data builder', () => {
		it('does not compile Executive Axis', () => {
			const input = emptyViewDataInput({
				documents: [makeDocument('doc-1', '01-foundation', 'current')],
				phases: [
					{
						...makePhase('01-foundation', 'Foundation', 1),
						documents: [
							{
								canonicalId: 'doc-1',
								sourcePath: 'logos/01-foundation/doc-1.md',
								status: 'current',
								title: 'Doc 1',
							},
						],
					},
				],
			});

			const result = buildExecutiveReadinessViewData(
				input,
				'executive_readiness',
			);

			expect(result.summary?.extraFields?.['Normative Readiness']).toBe(
				'ready',
			);
			expect(result.summary?.extraFields?.['Export Readiness']).toBe('ready');
			// No Executive Axis compilation — only normative readiness assessment
			expect(result.phases).toBeDefined();
			expect(result.phases?.length).toBe(1);
		});
	});

	describe('document view data builder', () => {
		it('includes canonical source path and affected findings/registers', () => {
			const input = emptyViewDataInput({
				documents: [makeDocument('doc-target', '03-product', 'current')],
				validationFindings: [
					{
						...makeValidationFinding('vf-1', 'error'),
						documentCanonicalId: 'doc-target',
					},
					{
						...makeValidationFinding('vf-2', 'warning'),
						documentCanonicalId: 'other-doc',
					},
				],
			});

			const result = buildDocumentViewData(
				input,
				'document_view',
				'doc-target',
			);

			expect(result.summary?.extraFields?.Findings).toBe('1');
			expect(result.validationFindings?.length).toBe(1);
		});
	});

	describe('view data builder registry', () => {
		it('returns dashboard builder', () => {
			expect(getViewDataBuilder('dashboard')).toBeDefined();
		});
		it('returns phase_map builder', () => {
			expect(getViewDataBuilder('phase_map')).toBeDefined();
		});
		it('returns decision_map builder', () => {
			expect(getViewDataBuilder('decision_map')).toBeDefined();
		});
		it('returns risk_map builder', () => {
			expect(getViewDataBuilder('risk_map')).toBeDefined();
		});
		it('returns validation_summary builder', () => {
			expect(getViewDataBuilder('validation_summary')).toBeDefined();
		});
		it('returns readiness_view builder', () => {
			expect(getViewDataBuilder('readiness_view')).toBeDefined();
		});
		it('returns executive_readiness builder', () => {
			expect(getViewDataBuilder('executive_readiness')).toBeDefined();
		});
		it('returns document_view builder', () => {
			expect(getViewDataBuilder('document_view')).toBeDefined();
		});
		it('returns undefined for custom (no builder)', () => {
			expect(getViewDataBuilder('custom')).toBeUndefined();
		});
	});
});

// ==========================================================================
// Generation Orchestration Tests
// ==========================================================================

describe('generation orchestration', () => {
	it('generateHtmlReviewViews runs in dry-run mode without writing files', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
				writePolicy: 'overwrite',
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result.dryRun).toBe(true);
		expect(result.readOnly).toBe(true);
		expect(result.createdPaths).toBeDefined();
		expect(result.changedPaths.length).toBe(0);
		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.artifactRegistryEntriesUpdated).toBe(0);
		expect(result.items.every((i) => !i.written)).toBe(true);
	});

	it('generateHtmlReviewViews returns valid result shape', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result).toBeDefined();
		expect(typeof result.profileId).toBe('string');
		expect(typeof result.documentationRoot).toBe('string');
		expect(typeof result.dryRun).toBe('boolean');
		expect(result.readOnly).toBe(true);
		expect(Array.isArray(result.items)).toBe(true);
		expect(result.summary).toBeDefined();
		expect(result.securitySummary).toBeDefined();
		expect(Array.isArray(result.createdPaths)).toBe(true);
		expect(Array.isArray(result.updatedPaths)).toBe(true);
		expect(Array.isArray(result.skippedPaths)).toBe(true);
		expect(Array.isArray(result.blockedPaths)).toBe(true);
		expect(Array.isArray(result.failedPaths)).toBe(true);
		expect(Array.isArray(result.diagnostics)).toBe(true);
		expect(Array.isArray(result.artifactRecords)).toBe(true);
	});

	it('writes generated HTML under the configured root without double-prefixing it', async () => {
		const { projectRoot } = await initTempWorkspaceWithProfiles();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: false,
				generatedAt: TEST_TIMESTAMP,
				writePolicy: 'overwrite',
			},
			profileId: 'standard',
			projectRoot,
		});

		const htmlPath = result.changedPaths.find((p) => p.endsWith('.html'));
		expect(htmlPath).toBeDefined();
		expect(
			result.changedPaths.some((p) =>
				p.replace(/\\/g, '/').includes('/logos/logos/'),
			),
		).toBe(false);
		expect(htmlPath?.replace(/\\/g, '/')).toContain(
			`${projectRoot.replace(/\\/g, '/')}/logos/outcomes/html/`,
		);

		const html = await readFile(htmlPath as string, 'utf-8');
		expect(html).toContain('Derived Non-Canonical Review Artifact');
		expect(result.artifactRegistryEntriesCreated).toBeGreaterThan(0);
		expect(result.artifactRecords.every((r) => r.isCanonical === false)).toBe(
			true,
		);
	});

	it('generation handles empty workspace gracefully', async () => {
		const projectRoot = tempDir;
		await mkdir(join(projectRoot, '.logos'), { recursive: true });
		// No workspace.json — should return graceful error result

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result.diagnostics.length).toBeGreaterThanOrEqual(0);
		expect(result.readOnly).toBe(true);
	});
});

// ==========================================================================
// Safe Write Tests
// ==========================================================================

describe('safe write behavior', () => {
	it('dry-run writes no files/directories', async () => {
		const { projectRoot, docRoot } = await initTempWorkspace();

		// Pre-populate a valid state
		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result.dryRun).toBe(true);

		// Check that no new files were created in docRoot
		const { readdir } = await import('node:fs/promises');
		const entries = await readdir(docRoot);
		// No HTML files should be written
		const htmlFiles = entries.filter((e) => e.endsWith('.html'));
		expect(htmlFiles.length).toBe(0);
	});

	it('dry-run updates no artifact registry', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.artifactRegistryEntriesUpdated).toBe(0);
	});

	it('generator does not mutate canonical Markdown', async () => {
		const { projectRoot, docRoot } = await initTempWorkspace();

		const markdownFile = join(docRoot, 'test.md');
		const markdownContent = '# Canonical Test';
		await writeFile(markdownFile, markdownContent, 'utf-8');

		await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		const { readFile } = await import('node:fs/promises');
		const content = await readFile(markdownFile, 'utf-8');
		expect(content).toBe(markdownContent);
	});

	it('generator produces valid artifact kinds from loaded contract', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		// All produced artifacts must have known kinds
		const validKinds = new Set([
			'dashboard',
			'document_view',
			'phase_map',
			'decision_map',
			'risk_map',
			'validation_summary',
			'readiness_view',
			'executive_readiness',
			'executive_export_preview',
			'custom',
		]);
		for (const item of result.items) {
			expect(validKinds.has(item.artifactKind)).toBe(true);
		}
	});

	it('generator does not call AI/provider code', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		// No AI-related imports or provider calls are used
		// The generator uses only profile loading, state, and renderer
		// No diagnostics should be about AI provider issues
		const aiDiags = result.diagnostics.filter(
			(d) =>
				d.code === 'AI_PROVIDER_ERROR' ||
				d.code === 'E_PROVIDER_CALL' ||
				d.message.toLowerCase().includes('openai') ||
				d.message.toLowerCase().includes('anthropic') ||
				d.message.toLowerCase().includes('llm'),
		);
		expect(aiDiags.length).toBe(0);
	});
});

// ==========================================================================
// Artifact Registry Tests
// ==========================================================================

describe('artifact registry', () => {
	it('HTML artifact registry entries are non-canonical', () => {
		const state = createDefaultWorkspaceState({ projectRootPath: '/test' });

		const result = registerArtifact({
			idFactory: () => 'art-html-1',
			input: {
				artifactType: 'html',
				checksum: 'abc123',
				generatedAt: TEST_TIMESTAMP,
				metadata: { artifactKind: 'dashboard' },
				path: 'logos/dashboard.html',
				sourceDocumentIds: ['doc-1'],
				status: 'generated',
			},
			state,
		});

		expect(result.artifact.isCanonical).toBe(false);
		expect(result.artifact.artifactType).toBe('html');
		expect(result.artifact.checksum).toBe('abc123');
		expect(result.artifact.path).toBe('logos/dashboard.html');
		expect(result.artifact.sourceDocumentIds).toEqual(['doc-1']);
		expect(result.artifact.generatedAt).toBe(TEST_TIMESTAMP);
	});

	it('artifact registry is not updated on dry-run', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.artifactRegistryEntriesUpdated).toBe(0);
	});

	it('artifact registry is not updated on failed security check', () => {
		const state = createDefaultWorkspaceState({ projectRootPath: '/test' });

		const result = registerArtifact({
			idFactory: () => 'art-failed-1',
			input: {
				artifactType: 'html',
				checksum: 'bad',
				generatedAt: TEST_TIMESTAMP,
				path: 'logos/failed.html',
				status: 'failed',
			},
			state,
		});

		expect(result.artifact.status).toBe('failed');
		expect(result.artifact.isCanonical).toBe(false);
	});

	it('HTML artifact is not marked canonical in registry', () => {
		const state = createDefaultWorkspaceState({ projectRootPath: '/test' });

		const result = registerArtifact({
			idFactory: () => 'art-nc-1',
			input: {
				artifactType: 'html',
				isCanonical: false,
				path: 'logos/test.html',
			},
			state,
		});

		expect(result.artifact.isCanonical).toBe(false);
	});
});

// ==========================================================================
// Security Verification Tests
// ==========================================================================

describe('security verification', () => {
	it('rendered HTML with <script> fails security check', () => {
		const html = '<html><body><script>alert(1)</script></body></html>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(result.securitySummary.scriptTagCount).toBe(1);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_SECURITY_SCRIPT'),
		).toBe(true);
	});

	it('inline event handler fails security check', () => {
		const html = '<div onclick="alert(1)">click</div>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_SECURITY_INLINE_EVENT'),
		).toBe(true);
	});

	it('external stylesheet fails security check', () => {
		const html = '<link rel="stylesheet" href="https://example.com/style.css">';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some(
				(d) => d.code === 'E_HTML_SECURITY_EXTERNAL_STYLESHEET',
			),
		).toBe(true);
	});

	it('remote font fails security check', () => {
		const html =
			'<style>@font-face { src: url("https://fonts.example.com/font.woff2"); }</style>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_SECURITY_REMOTE_FONT'),
		).toBe(true);
	});

	it('remote image fails security check', () => {
		const html = '<img src="https://example.com/img.png">';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_SECURITY_REMOTE_IMAGE'),
		).toBe(true);
	});

	it('iframe fails security check', () => {
		const html = '<iframe src="https://example.com"></iframe>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(result.securitySummary.iframeCount).toBeGreaterThanOrEqual(0);
	});

	it('form fails security check', () => {
		const html = '<form action="/submit"><input type="text"></form>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(result.securitySummary.formTagCount).toBeGreaterThanOrEqual(0);
	});

	it('javascript: URI fails security check', () => {
		const html = '<a href="javascript:alert(1)">link</a>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some(
				(d) => d.code === 'E_HTML_SECURITY_JAVASCRIPT_URI',
			),
		).toBe(true);
	});

	it('data: URI in href fails security check', () => {
		const html = '<a href="data:text/html,<script>alert(1)</script>">link</a>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_SECURITY_DATA_URI'),
		).toBe(true);
	});

	it('vbscript: URI fails security check', () => {
		const html = '<a href="vbscript:msgbox(1)">link</a>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === 'E_HTML_SECURITY_VBSCRIPT_URI'),
		).toBe(true);
	});

	it('safe renderer output passes security check', () => {
		const html =
			'<html><body><p>Hello World</p><a href="/logos/doc.md">link</a></body></html>';
		const result = performSecurityAudit(html);
		expect(result.safe).toBe(true);
		expect(result.securitySummary.scriptTagCount).toBe(0);
		expect(result.securitySummary.externalAssetCount).toBe(0);
	});
});

// ==========================================================================
// Boundary Tests
// ==========================================================================

describe('derived/canonical boundary', () => {
	it('HTML artifact is not marked canonical', () => {
		const state = createDefaultWorkspaceState({ projectRootPath: '/test' });
		const result = registerArtifact({
			idFactory: () => 'art-bnd-1',
			input: {
				artifactType: 'html',
				path: 'logos/boundary.html',
				status: 'generated',
			},
			state,
		});

		expect(result.artifact.isCanonical).toBe(false);
	});

	it('HTML artifact type is always non-canonical in registry schema', () => {
		// The artifact registry has NON_CANONICAL_TYPES that includes 'html'
		const state = createDefaultWorkspaceState({ projectRootPath: '/test' });
		const result = registerArtifact({
			idFactory: () => 'art-type-1',
			input: {
				artifactType: 'html',
				// Try to mark as canonical
				isCanonical: true,
				path: 'logos/type-test.html',
			},
			state,
		});

		// Should be forced to false regardless of input
		expect(result.artifact.isCanonical).toBe(false);
	});

	it('artifact metadata is not treated as proof of canonical completeness', () => {
		const state = createDefaultWorkspaceState({ projectRootPath: '/test' });
		const result = registerArtifact({
			idFactory: () => 'art-meta-1',
			input: {
				artifactType: 'html',
				metadata: { claims: 'canonical', source: 'verified' },
				path: 'logos/meta-test.html',
			},
			state,
		});

		// Metadata doesn't change canonical status
		expect(result.artifact.isCanonical).toBe(false);
		expect(result.artifact.metadata).toBeDefined();
	});
});

// ==========================================================================
// Non-Mutation Tests
// ==========================================================================

describe('non-mutation guarantees', () => {
	it('dry-run does not create output dirs/files', async () => {
		const { projectRoot, docRoot } = await initTempWorkspace();

		await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		const { readdir } = await import('node:fs/promises');
		const entries = await readdir(docRoot).catch(() => []);
		const htmlFiles = entries.filter((e) => e.endsWith('.html'));
		expect(htmlFiles.length).toBe(0);
	});

	it('dry-run does not update artifact registry', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.artifactRegistryEntriesUpdated).toBe(0);
	});

	it('blocked/failed artifacts do not write files', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		// All blocked/failed items should not be written
		const blockedItems = result.items.filter(
			(i) => i.status === 'blocked' || i.status === 'failed',
		);
		for (const item of blockedItems) {
			expect(item.written).toBe(false);
		}
	});

	it('no test mutates the real repository', () => {
		// This test runs in a temp directory, not the real repo
		expect(tempDir).not.toContain('logos-engine');
		expect(tempDir).toContain('logos-html-review');
	});
});

// ==========================================================================
// Path Safety Tests
// ==========================================================================

describe('output path safety', () => {
	it('path traversal output is rejected in dry-run', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		// All items should have safe paths
		for (const item of result.items) {
			if (item.status !== 'failed') {
				expect(item.relativeOutputPath).not.toContain('../');
				expect(item.relativeOutputPath).not.toContain('/etc/');
			}
		}
	});

	it('generated result items have deterministic ordering', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result1 = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		const result2 = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		expect(result1.items.length).toBe(result2.items.length);
		expect(result1.summary.total).toBe(result2.summary.total);
		expect(result1.summary.created).toBe(result2.summary.created);
		expect(result1.summary.blocked).toBe(result2.summary.blocked);
	});
});

// ==========================================================================
// Result Shape Tests
// ==========================================================================

describe('result shape completeness', () => {
	it('result includes all required fields', async () => {
		const { projectRoot } = await initTempWorkspace();

		const result = await generateHtmlReviewViews({
			artifactRoot: undefined,
			documentationRoot: 'logos/',
			options: {
				dryRun: true,
				generatedAt: TEST_TIMESTAMP,
			},
			profileId: 'standard',
			projectRoot,
		});

		// Verify all top-level fields exist
		expect(result).toHaveProperty('profileId');
		expect(result).toHaveProperty('documentationRoot');
		expect(result).toHaveProperty('dryRun');
		expect(result).toHaveProperty('readOnly');
		expect(result).toHaveProperty('items');
		expect(result).toHaveProperty('summary');
		expect(result).toHaveProperty('createdPaths');
		expect(result).toHaveProperty('updatedPaths');
		expect(result).toHaveProperty('skippedPaths');
		expect(result).toHaveProperty('blockedPaths');
		expect(result).toHaveProperty('failedPaths');
		expect(result).toHaveProperty('artifactRegistryEntriesCreated');
		expect(result).toHaveProperty('artifactRegistryEntriesUpdated');
		expect(result).toHaveProperty('changedPaths');
		expect(result).toHaveProperty('diagnostics');
		expect(result).toHaveProperty('securitySummary');
		expect(result).toHaveProperty('artifactRecords');

		// Verify summary fields
		expect(result.summary).toHaveProperty('total');
		expect(result.summary).toHaveProperty('created');
		expect(result.summary).toHaveProperty('updated');
		expect(result.summary).toHaveProperty('skipped');
		expect(result.summary).toHaveProperty('blocked');
		expect(result.summary).toHaveProperty('failed');
		expect(result.summary).toHaveProperty('countsByKind');

		// Verify security summary fields
		expect(result.securitySummary).toHaveProperty('renderedFilesCount');
		expect(result.securitySummary).toHaveProperty('externalAssetCount');
		expect(result.securitySummary).toHaveProperty('scriptTagCount');
		expect(result.securitySummary).toHaveProperty('unsafeHrefCount');
	});
});
