/** Step 11.3 — Executive Markdown Export Adapter Tests */

import { describe, expect, it } from 'vitest';
import type { ExecutiveExportMapping } from '../src/executive/executive-export-model.js';
import { executiveMarkdownExportAdapter } from '../src/executive/executive-markdown-export.js';
import type { ExecutivePlanJson } from '../src/executive/executive-plan-model.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_TIMESTAMP = '2026-05-19T00:00:00.000Z';
const TEST_PROFILE_ID = 'standard';
const TEST_PLAN_ID = 'exec-plan-standard-abc12345';
const TEST_FINGERPRINT = 'abc123def4567890';

function deterministicClock(): string {
	return TEST_TIMESTAMP;
}

function makeMinimalPlan(
	overrides?: Partial<ExecutivePlanJson>,
): ExecutivePlanJson {
	return {
		confidence: { byArea: { '01-foundation': 'high' }, overall: 'high' },
		execution: {
			artifacts: [],
			decisions: [],
			initiatives: [],
			items: [],
			milestones: [],
			risks: [],
			roadmaps: [
				{
					description: 'Test roadmap',
					horizon: 'normative_baseline',
					id: 'roadmap-standard',
					milestoneIds: ['milestone-01-foundation'],
					status: 'planned',
					title: 'Standard Profile Roadmap',
				},
			],
			workstreams: [],
		},
		exports: {
			markdown: {
				enabled: true,
				mappingProfile: 'executive/mappings/markdown.mapping.yml',
				supportStatus: 'supported_now',
			},
		},
		generatedAt: TEST_TIMESTAMP,
		id: TEST_PLAN_ID,
		metadata: {
			readinessSummary: {
				blockedDocuments: 0,
				blockerCount: 0,
				satisfiedDocuments: 3,
				totalDocuments: 5,
				unknownDocuments: 0,
				warningCount: 1,
				warningDocuments: 2,
			},
		},
		project: {
			description: 'A test project for executive exports',
			id: 'test-project',
			name: 'Test Project',
		},
		source: {
			generationPromptId: null,
			normativeDocuments: ['thesis', 'principles', 'product-brief'],
			readinessStatus: 'ready',
			sourceCommit: null,
			warnings: ['Warning: stale document detected'],
		},
		version: '1.0.0',
		...overrides,
	};
}

function makeMapping(
	overrides?: Partial<ExecutiveExportMapping>,
): ExecutiveExportMapping {
	return {
		adapterKind: 'markdown',
		exportType: 'file_export',
		mappingId: 'markdown',
		name: 'markdown',
		outputFormat: 'markdown',
		outputPath: 'outcomes/executive/exports/markdown/implementation-plan.md',
		purpose: 'Generate human-readable execution snapshots',
		sourcePath: 'profiles/standard/executive/mappings/markdown.mapping.yml',
		supportStatus: 'supported_file_export',
		version: '1.0.0',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Executive Markdown Export Adapter', () => {
	it('renders complete Markdown executive snapshot', () => {
		const plan = makeMinimalPlan();
		const mapping = makeMapping();

		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping,
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.adapterKind).toBe('markdown');
		expect(result.supportStatus).toBe('supported_file_export');
		expect(result.title).toContain('Test Project');
		expect(result.renderedFiles.length).toBe(1);

		const content = result.renderedFiles[0]?.content;
		expect(content.length).toBeGreaterThan(100);
	});

	it('includes metadata block with artifactType', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('artifactType: executive_markdown_export');
		expect(content).toContain('canonical: false');
		expect(content).toContain('derived: true');
		expect(content).toContain('snapshot: true');
		expect(content).toContain('sourcePlanId:');
		expect(content).toContain('sourcePlanFingerprint:');
	});

	it('includes derived/non-canonical warning', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('DERIVED / NON-CANONICAL SNAPSHOT');
		expect(content).toContain('canonical source of truth');
	});

	it('includes summary section', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('## Summary');
		expect(content).toContain('Test Project');
		expect(content).toContain(TEST_PLAN_ID);
	});

	it('includes readiness section', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('## Readiness Snapshot');
	});

	it('includes roadmap/milestones/work items sections', () => {
		const plan = makeMinimalPlan({
			execution: {
				artifacts: [],
				decisions: [
					{
						affectedNormativeDocuments: ['thesis'],
						consequences: ['Decision recorded'],
						context: 'Test context',
						decision: 'Test decision',
						id: 'decision-1',
						status: 'done',
						title: 'Test Decision',
					},
				],
				initiatives: [
					{
						deliverables: ['test.md'],
						id: 'init-1',
						itemIds: ['wi-1'],
						milestoneId: 'milestone-1',
						purpose: 'Test initiative purpose',
						status: 'planned',
						title: 'Foundation Docs',
						workstreamId: 'ws-1',
					},
				],
				items: [
					{
						acceptanceCriteria: ['AC 1', 'AC 2'],
						dependsOn: ['wi-2'],
						description: 'A test work item description',
						id: 'wi-1',
						initiativeId: 'init-1',
						metadata: {},
						origin: 'derived',
						priority: 'high',
						requiresReview: false,
						softDependsOn: [],
						sourceNormativeDocuments: ['thesis'],
						sourceRationale: 'Derived from readiness',
						status: 'blocked',
						suggestedExecutor: { type: 'human' },
						suggestedExports: {},
						title: 'Blocked Work Item',
						type: 'blocker',
						workstreamId: 'ws-1',
					},
					{
						acceptanceCriteria: ['AC 3'],
						dependsOn: ['wi-1'],
						description: 'Another work item',
						id: 'wi-2',
						initiativeId: undefined,
						metadata: {},
						origin: 'derived',
						priority: 'medium',
						requiresReview: true,
						softDependsOn: [],
						sourceNormativeDocuments: ['principles'],
						sourceRationale: 'Derived from warnings',
						status: 'reviewing',
						suggestedExecutor: { type: 'human' },
						suggestedExports: {},
						title: 'Review Work Item',
						type: 'review',
						workstreamId: undefined,
					},
				],
				milestones: [
					{
						exitCriteria: ['All docs generated'],
						id: 'milestone-1',
						initiativeIds: ['init-1'],
						objective: 'Complete foundation docs',
						status: 'planned',
						title: 'Foundation Phase',
					},
				],
				risks: [
					{
						description: 'Risk description',
						id: 'risk-1',
						impact: 'high',
						likelihood: 'medium',
						mitigation: 'Mitigation plan',
						sourceNormativeDocuments: ['thesis'],
						title: 'Test Risk',
					},
				],
				roadmaps: [
					{
						description: 'Test roadmap',
						horizon: 'normative_baseline',
						id: 'roadmap-standard',
						milestoneIds: ['milestone-1'],
						status: 'planned',
						title: 'Standard Roadmap',
					},
				],
				workstreams: [
					{
						description: 'Test workstream',
						id: 'ws-1',
						relatedNormativeAreas: ['01-foundation'],
						title: 'Foundation Stream',
						type: 'normative_documentation',
					},
				],
			},
		});

		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready_with_warnings',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('## Roadmap');
		expect(content).toContain('## Milestones');
		expect(content).toContain('## Initiatives');
		expect(content).toContain('## Work Items');
		expect(content).toContain('## Dependencies');
		expect(content).toContain('## Blockers');
		expect(content).toContain('## Risks');
		expect(content).toContain('## Decisions');
		expect(content).toContain('## Acceptance Criteria');
		expect(content).toContain('## Traceability');
		expect(content).toContain('## Export Metadata');
	});

	it('marks blocked/requires-review items visibly', () => {
		const plan = makeMinimalPlan({
			execution: {
				artifacts: [],
				decisions: [],
				initiatives: [],
				items: [
					{
						acceptanceCriteria: [],
						dependsOn: [],
						description: 'Blocked',
						id: 'wi-blocked',
						initiativeId: undefined,
						metadata: {},
						origin: 'derived',
						priority: 'critical',
						requiresReview: false,
						softDependsOn: [],
						sourceNormativeDocuments: [],
						sourceRationale: '',
						status: 'blocked',
						suggestedExecutor: { type: 'human' },
						suggestedExports: {},
						title: 'Blocked Item',
						type: 'blocker',
						workstreamId: undefined,
					},
					{
						acceptanceCriteria: [],
						dependsOn: [],
						description: 'Needs review',
						id: 'wi-review',
						initiativeId: undefined,
						metadata: {},
						origin: 'inferred',
						priority: 'high',
						requiresReview: true,
						softDependsOn: [],
						sourceNormativeDocuments: [],
						sourceRationale: '',
						status: 'reviewing',
						suggestedExecutor: { type: 'human' },
						suggestedExports: {},
						title: 'Review Item',
						type: 'review',
						workstreamId: undefined,
					},
				],
				milestones: [],
				risks: [],
				roadmaps: [],
				workstreams: [],
			},
		});

		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'blocked',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('BLOCKED');
		expect(content).toContain('REQUIRES REVIEW');
	});

	it('preserves source references and relative paths', () => {
		const plan = makeMinimalPlan();
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('thesis');
		expect(content).toContain('principles');
		expect(content).toContain('logos/');
	});

	it('does not claim live task management', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		// Should contain a disclaimer, not a claim of live task management
		expect(content).toContain('does **not** represent live task management');
	});

	it('result metadata has required fields', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.metadata.sourcePlanId).toBe(TEST_PLAN_ID);
		expect(result.metadata.sourcePlanFingerprint).toBe(TEST_FINGERPRINT);
		expect(result.metadata.profileId).toBe(TEST_PROFILE_ID);
		expect(result.metadata.generatedAt).toBeDefined();
		expect(result.metadata.derivedSnapshot).toBe(true);
		expect(result.metadata.nonCanonical).toBe(true);
		expect(result.metadata.externalApiExecution).toBe(false);
	});

	it('changedPaths is empty for pure render', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.changedPaths).toEqual([]);
	});

	it('readOnly is true', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.readOnly).toBe(true);
	});

	it('rendered file has checksum', () => {
		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan: makeMinimalPlan(),
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.renderedFiles[0]?.checksum).toBeDefined();
		expect(result.renderedFiles[0]?.checksum.length).toBe(16);
	});

	it('uses injectTimestamp when provided', () => {
		const result = executiveMarkdownExportAdapter.render(
			{
				clock: deterministicClock,
				documentationRoot: 'logos/',
				mapping: makeMapping(),
				plan: makeMinimalPlan(),
				planFingerprint: TEST_FINGERPRINT,
				planId: TEST_PLAN_ID,
				profileId: TEST_PROFILE_ID,
				readinessStatus: 'ready',
			},
			{ injectTimestamp: '2025-01-01T00:00:00.000Z' },
		);

		expect(result.metadata.generatedAt).toBe('2025-01-01T00:00:00.000Z');
	});

	it('renders without items gracefully', () => {
		const plan = makeMinimalPlan({
			execution: {
				artifacts: [],
				decisions: [],
				initiatives: [],
				items: [],
				milestones: [],
				risks: [],
				roadmaps: [],
				workstreams: [],
			},
		});

		const result = executiveMarkdownExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'unknown',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('No roadmaps defined');
		expect(content).toContain('No milestones defined');
		expect(content).toContain('No initiatives defined');
		expect(content).toContain('No work items defined');
		expect(content).toContain('No dependencies recorded');
		expect(content).toContain('No decisions recorded');
	});
});
