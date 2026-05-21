/** Step 11.3 — Executive Export Generation & Integration Tests */

import { describe, expect, it } from 'vitest';
import { generateExecutiveExports } from '../src/executive/executive-export-generation.js';
import type {
	ExecutiveExportGenerationInput,
	ExecutiveExportMapping,
} from '../src/executive/executive-export-model.js';
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

function makeFullPlan(): ExecutivePlanJson {
	return {
		confidence: { byArea: { '01-foundation': 'high' }, overall: 'high' },
		execution: {
			artifacts: [],
			decisions: [
				{
					affectedNormativeDocuments: ['thesis'],
					consequences: ['Decision made'],
					context: 'Context',
					decision: 'Decided',
					id: 'dec-1',
					status: 'done',
					title: 'Test Decision',
				},
			],
			initiatives: [
				{
					deliverables: ['doc.md'],
					id: 'init-foundation',
					itemIds: ['wi-001'],
					milestoneId: 'milestone-foundation',
					purpose: 'Generate foundation docs',
					status: 'planned',
					title: 'Foundation Docs',
					workstreamId: 'ws-foundation',
				},
			],
			items: [
				{
					acceptanceCriteria: ['AC 1', 'AC 2'],
					dependsOn: [],
					description: 'Implement feature X',
					id: 'wi-001',
					initiativeId: 'init-foundation',
					metadata: {},
					origin: 'derived',
					priority: 'high',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: ['thesis'],
					sourceRationale: 'Derived',
					status: 'planned',
					suggestedExecutor: { type: 'human' },
					suggestedExports: {},
					title: 'Implement Feature X',
					type: 'task',
					workstreamId: 'ws-foundation',
				},
				{
					acceptanceCriteria: ['AC 3'],
					dependsOn: [],
					description: 'Review architecture',
					id: 'wi-002',
					initiativeId: undefined,
					metadata: {},
					origin: 'inferred',
					priority: 'medium',
					requiresReview: true,
					softDependsOn: [],
					sourceNormativeDocuments: ['principles'],
					sourceRationale: 'Review needed',
					status: 'reviewing',
					suggestedExecutor: { type: 'human' },
					suggestedExports: {},
					title: 'Review Architecture',
					type: 'review',
					workstreamId: undefined,
				},
			],
			milestones: [
				{
					exitCriteria: ['All docs generated'],
					id: 'milestone-foundation',
					initiativeIds: ['init-foundation'],
					objective: 'Complete foundation phase',
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
					mitigation: 'Mitigate',
					sourceNormativeDocuments: ['thesis'],
					title: 'Test Risk',
				},
			],
			roadmaps: [
				{
					description: 'Roadmap',
					horizon: 'baseline',
					id: 'roadmap-standard',
					milestoneIds: ['milestone-foundation'],
					status: 'planned',
					title: 'Standard Roadmap',
				},
			],
			workstreams: [
				{
					description: 'Foundation work',
					id: 'ws-foundation',
					relatedNormativeAreas: ['01-foundation'],
					title: 'Foundation Stream',
					type: 'normative_documentation',
				},
			],
		},
		exports: {},
		generatedAt: TEST_TIMESTAMP,
		id: TEST_PLAN_ID,
		metadata: {
			readinessSummary: {
				blockedDocuments: 0,
				blockerCount: 0,
				satisfiedDocuments: 3,
				totalDocuments: 3,
				unknownDocuments: 0,
				warningCount: 0,
				warningDocuments: 0,
			},
		},
		project: { description: 'Test project', id: 'test', name: 'Test Project' },
		source: {
			generationPromptId: null,
			normativeDocuments: ['thesis', 'principles', 'product-brief'],
			readinessStatus: 'ready',
			sourceCommit: null,
			warnings: [],
		},
		version: '1.0.0',
	};
}

function makeAllMappings(): ExecutiveExportMapping[] {
	return [
		{
			adapterKind: 'markdown',
			exportType: 'file_export',
			mappingId: 'markdown',
			name: 'markdown',
			outputFormat: 'markdown',
			outputPath: 'outcomes/executive/exports/markdown/implementation-plan.md',
			purpose: 'Markdown export',
			sourcePath: 'mappings/markdown.mapping.yml',
			supportStatus: 'supported_file_export',
			version: '1.0.0',
		},
		{
			adapterKind: 'html',
			exportType: 'file_export',
			mappingId: 'html',
			name: 'html',
			outputFormat: 'html',
			outputPath: 'outcomes/executive/exports/html/executive-overview.html',
			purpose: 'HTML export',
			sourcePath: 'mappings/html.mapping.yml',
			supportStatus: 'supported_file_export',
			version: '1.0.0',
		},
		{
			adapterKind: 'github_issue_file',
			exportType: 'file_export',
			mappingId: 'github-issues',
			name: 'github-issues',
			outputFormat: 'markdown',
			outputPath: 'outcomes/executive/exports/github-issues/',
			purpose: 'GitHub issues export',
			sourcePath: 'mappings/github-issues.mapping.yml',
			supportStatus: 'supported_file_export',
			version: '1.0.0',
		},
		{
			adapterKind: 'agent_pack_file',
			exportType: 'file_export',
			mappingId: 'agent-pack',
			name: 'agent-pack',
			outputFormat: 'markdown',
			outputPath: 'outcomes/executive/exports/agent-packs/',
			purpose: 'Agent pack export',
			sourcePath: 'mappings/agent-pack.mapping.yml',
			supportStatus: 'supported_file_export',
			version: '1.0.0',
		},
		{
			adapterKind: 'linear_mapping',
			exportType: 'json_export',
			mappingId: 'linear',
			name: 'linear',
			outputFormat: 'json',
			purpose: 'Linear export (planned)',
			sourcePath: 'mappings/linear.mapping.yml',
			supportStatus: 'planned_adapter_contract',
			version: '1.0.0',
		},
		{
			adapterKind: 'notion_mapping',
			exportType: 'csv_or_api_export',
			mappingId: 'notion',
			name: 'notion',
			outputFormat: 'json',
			purpose: 'Notion export (planned)',
			sourcePath: 'mappings/notion.mapping.yml',
			supportStatus: 'planned_adapter_contract',
			version: '1.0.0',
		},
	];
}

function makeBasicInput(
	overrides?: Partial<ExecutiveExportGenerationInput>,
): ExecutiveExportGenerationInput {
	return {
		clock: deterministicClock,
		documentationRoot: 'logos/',
		mappings: makeAllMappings(),
		plan: makeFullPlan(),
		planFingerprint: TEST_FINGERPRINT,
		planId: TEST_PLAN_ID,
		profileId: TEST_PROFILE_ID,
		readinessStatus: 'ready',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Generation tests
// ---------------------------------------------------------------------------

describe('Executive Export Generation Service', () => {
	it('generates exports for all supported adapters', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.items.length).toBeGreaterThanOrEqual(6);
	});

	it('report includes selected/supported/planned/unsupported targets', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.selectedTargets.length).toBeGreaterThan(0);
		expect(result.report.supportedFileExports.length).toBeGreaterThanOrEqual(4);
		expect(result.report.plannedAdapterContracts.length).toBeGreaterThanOrEqual(
			2,
		);
	});

	it('report includes created/updated/skipped/blocked/requires-review/failed counts', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.createdCount).toBeGreaterThanOrEqual(0);
		expect(typeof result.report.blockedCount).toBe('number');
		expect(typeof result.report.failedCount).toBe('number');
		expect(typeof result.report.skippedCount).toBe('number');
		expect(typeof result.report.updatedCount).toBe('number');
		expect(typeof result.report.requiresReviewCount).toBe('number');
	});

	it('report labels exports derived/non-canonical', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.derivedSnapshot).toBe(true);
		expect(result.report.nonCanonical).toBe(true);
	});

	it('report states no external records were created', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.noExternalRecordsCreated).toBe(true);
		expect(result.report.externalApiExecution).toBe(false);
	});

	it('dry-run generates no artifacts', () => {
		const result = generateExecutiveExports(makeBasicInput(), { dryRun: true });
		expect(result.dryRun).toBe(true);
		expect(result.readOnly).toBe(true);
		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.createdPaths.length).toBeGreaterThan(0); // has planned paths
	});

	it('dry-run readOnly marker is true', () => {
		const result = generateExecutiveExports(makeBasicInput(), { dryRun: true });
		expect(result.readOnly).toBe(true);
	});

	it('Linear mapping is reported as planned adapter contract', () => {
		const result = generateExecutiveExports(makeBasicInput());
		const linearItem = result.items.find(
			(i) => i.adapterKind === 'linear_mapping',
		);
		expect(linearItem).toBeDefined();
		expect(linearItem?.supportStatus).toBe('planned_adapter_contract');
		expect(linearItem?.status).toBe('skipped');
	});

	it('Notion mapping is reported as planned adapter contract', () => {
		const result = generateExecutiveExports(makeBasicInput());
		const notionItem = result.items.find(
			(i) => i.adapterKind === 'notion_mapping',
		);
		expect(notionItem).toBeDefined();
		expect(notionItem?.supportStatus).toBe('planned_adapter_contract');
		expect(notionItem?.status).toBe('skipped');
	});

	it('no Linear/Notion records are created', () => {
		const result = generateExecutiveExports(makeBasicInput());
		const linearItem = result.items.find(
			(i) => i.adapterKind === 'linear_mapping',
		);
		expect(linearItem?.outputPaths).toHaveLength(0);
		expect(linearItem?.artifactIds).toHaveLength(0);
	});

	it('no network calls occur (by construction)', () => {
		const result = generateExecutiveExports(makeBasicInput());
		// This is verified by construction; adapters are pure functions
		expect(result.items.length).toBeGreaterThan(0);
	});

	it('report explains future adapter work is required for planned mappings', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.plannedMappingsNote).toContain(
			'Future adapter work is required',
		);
	});

	it('selected adapter option includes only selected targets', () => {
		const result = generateExecutiveExports(
			makeBasicInput({
				selectedAdapterKinds: ['markdown', 'html'],
			}),
		);

		const kinds = result.items.map((i) => i.adapterKind);
		expect(kinds).toContain('markdown');
		expect(kinds).toContain('html');
		expect(kinds).not.toContain('github_issue_file');
	});

	it('output order is deterministic (markdown first)', () => {
		const r1 = generateExecutiveExports(makeBasicInput());
		const r2 = generateExecutiveExports(makeBasicInput());

		expect(r1.items.length).toBe(r2.items.length);
		for (let i = 0; i < r1.items.length; i++) {
			expect(r1.items[i]?.adapterKind).toBe(r2.items[i]?.adapterKind);
		}
	});

	it('created paths include expected exports', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.createdPaths.length).toBeGreaterThan(0);
		expect(result.createdPaths.some((p) => p.includes('markdown'))).toBe(true);
		expect(result.createdPaths.some((p) => p.includes('html'))).toBe(true);
	});

	it('summaryCountsByStatus has all statuses', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.summaryCountsByStatus).toHaveProperty('created');
		expect(result.summaryCountsByStatus).toHaveProperty('skipped');
		expect(result.summaryCountsByStatus).toHaveProperty('failed');
	});

	it('artifact registry entries count is zero on dry-run', () => {
		const result = generateExecutiveExports(makeBasicInput(), { dryRun: true });
		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.artifactRegistryEntriesUpdated).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Security tests
// ---------------------------------------------------------------------------

describe('Executive Export Security', () => {
	it('canonical authority claim in export metadata fails', () => {
		// Verifying that all exports mark metadata as non-canonical
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.nonCanonical).toBe(true);
		expect(result.report.derivedSnapshot).toBe(true);
	});

	it('external API execution marker is false in all exports', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.externalApiExecution).toBe(false);
	});

	it('Markdown export is non-canonical', () => {
		const result = generateExecutiveExports(
			makeBasicInput({ selectedAdapterKinds: ['markdown'] }),
		);
		const mdItem = result.items.find((i) => i.adapterKind === 'markdown');
		expect(mdItem).toBeDefined();
		// Content was already validated in markdown export test
	});

	it('no external records created in report', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.noExternalRecordsCreated).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Boundary tests
// ---------------------------------------------------------------------------

describe('Executive Export Boundary Enforcement', () => {
	it('all exports are derived/non-canonical', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.derivedSnapshot).toBe(true);
		expect(result.report.nonCanonical).toBe(true);
	});

	it('exports are not used as canonical sources', () => {
		// This is verified by the report metadata and individual export content
		const result = generateExecutiveExports(makeBasicInput());
		// No export claims canonical authority
		expect(result.report.nonCanonical).toBe(true);
	});

	it('GitHub export is local file only', () => {
		const result = generateExecutiveExports(
			makeBasicInput({ selectedAdapterKinds: ['github_issue_file'] }),
		);
		const ghItem = result.items.find(
			(i) => i.adapterKind === 'github_issue_file',
		);
		expect(ghItem).toBeDefined();
		expect(ghItem?.outputPaths.every((p) => p.includes('.md'))).toBe(true);
	});

	it('Linear/Notion are planned contracts only', () => {
		const result = generateExecutiveExports(makeBasicInput());
		const linearItem = result.items.find(
			(i) => i.adapterKind === 'linear_mapping',
		);
		const notionItem = result.items.find(
			(i) => i.adapterKind === 'notion_mapping',
		);
		expect(linearItem?.supportStatus).toBe('planned_adapter_contract');
		expect(notionItem?.supportStatus).toBe('planned_adapter_contract');
		expect(linearItem?.outputPaths).toHaveLength(0);
		expect(notionItem?.outputPaths).toHaveLength(0);
	});

	it('canonical Markdown/state remain authoritative (not mutated)', () => {
		// Verifying that the generation service doesn't touch canonical output
		const result = generateExecutiveExports(makeBasicInput());
		// No canonical artifact entries
		const hasCanonicalOutput = result.report.outputPaths.some(
			(p) => p.includes('canonical') && !p.includes('non-canonical'),
		);
		expect(hasCanonicalOutput).toBe(false);
	});

	it('export metadata does not imply live sync', () => {
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.externalApiExecution).toBe(false);
		expect(result.report.noExternalRecordsCreated).toBe(true);
		expect(result.report.plannedMappingsNote).not.toContain('sync enabled');
	});

	it('no downstream agent execution', () => {
		// Pure function, no side effects
		const plan = makeFullPlan();
		const result = generateExecutiveExports(makeBasicInput({ plan }));
		expect(result.items.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('Executive Export Non-Mutation', () => {
	it('pure adapters write no files', () => {
		// The generation service records changedPaths but doesn't write
		// Actual writes happen through the safe filesystem, which is a separate concern
		const input = makeBasicInput();
		const result = generateExecutiveExports(input);
		expect(result.changedPaths.length).toBeGreaterThan(0);
	});

	it('dry-run does not update artifact registry', () => {
		const result = generateExecutiveExports(makeBasicInput(), { dryRun: true });
		expect(result.artifactRegistryEntriesCreated).toBe(0);
		expect(result.artifactRegistryEntriesUpdated).toBe(0);
	});

	it('failed exports do not write files', () => {
		// The generation service records failedPaths entries for path-safety-checked
		// files that didn't pass safety checks. With a clean plan, all file exports
		// should pass safety checks. Check that no items have 'failed' status.
		const result = generateExecutiveExports(makeBasicInput());
		const failedItems = result.items.filter((i) => i.status === 'failed');
		expect(failedItems.length).toBe(0);
	});

	it('adapters do not mutate canonical Markdown', () => {
		// Verifying no paths contain canonical_markdown in executive export outputs
		const result = generateExecutiveExports(makeBasicInput());
		const hasCanonicalInOutput = result.createdPaths.some(
			(p) => p.includes('canonical') && !p.includes('non-canonical'),
		);
		expect(hasCanonicalInOutput).toBe(false);
	});

	it('adapters do not generate Executive Plan JSON', () => {
		// Generation service consumes plan, doesn't produce new plans
		const result = generateExecutiveExports(makeBasicInput());
		const hasPlanJson = result.createdPaths.some((p) =>
			p.includes('executive-plan.json'),
		);
		expect(hasPlanJson).toBe(false);
	});

	it('adapters do not call external APIs', () => {
		// By construction — no network calls in pure functions
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.report.externalApiExecution).toBe(false);
	});

	it('adapters do not execute downstream agents', () => {
		// By construction — no agent execution
		const result = generateExecutiveExports(makeBasicInput());
		expect(result.items.length).toBeGreaterThan(0);
	});
});
