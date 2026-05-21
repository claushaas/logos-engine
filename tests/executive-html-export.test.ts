/** Step 11.3 — Executive HTML Export Adapter Tests */

import { describe, expect, it } from 'vitest';
import type { ExecutiveExportMapping } from '../src/executive/executive-export-model.js';
import { executiveHtmlExportAdapter } from '../src/executive/executive-html-export.js';
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

function makeHtmlMapping(): ExecutiveExportMapping {
	return {
		adapterKind: 'html',
		exportType: 'file_export',
		mappingId: 'html',
		name: 'html',
		outputFormat: 'html',
		outputPath: 'outcomes/executive/exports/html/executive-overview.html',
		purpose: 'Generate navigable HTML review artifacts',
		sourcePath: 'profiles/standard/executive/mappings/html.mapping.yml',
		supportStatus: 'supported_file_export',
		version: '1.0.0',
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Executive HTML Export Adapter', () => {
	const plan: ExecutivePlanJson = {
		confidence: { byArea: {}, overall: 'high' },
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
					id: 'init-1',
					itemIds: ['wi-1'],
					milestoneId: 'milestone-1',
					purpose: 'Purpose text',
					status: 'planned',
					title: 'Foundation Docs',
					workstreamId: 'ws-1',
				},
			],
			items: [
				{
					acceptanceCriteria: ['AC 1'],
					dependsOn: ['wi-2'],
					description: 'Work item description',
					id: 'wi-1',
					initiativeId: 'init-1',
					metadata: {},
					origin: 'derived',
					priority: 'high',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: ['thesis'],
					sourceRationale: 'rationale',
					status: 'blocked',
					suggestedExecutor: { type: 'human' },
					suggestedExports: {},
					title: 'Blocked Item',
					type: 'blocker',
					workstreamId: 'ws-1',
				},
				{
					acceptanceCriteria: ['AC 2'],
					dependsOn: [],
					description: 'Review desc',
					id: 'wi-2',
					initiativeId: undefined,
					metadata: {},
					origin: 'inferred',
					priority: 'medium',
					requiresReview: true,
					softDependsOn: [],
					sourceNormativeDocuments: ['principles'],
					sourceRationale: 'rationale',
					status: 'reviewing',
					suggestedExecutor: { type: 'human' },
					suggestedExports: {},
					title: 'Review Item',
					type: 'review',
					workstreamId: undefined,
				},
			],
			milestones: [
				{
					exitCriteria: ['Done'],
					id: 'milestone-1',
					initiativeIds: ['init-1'],
					objective: 'Complete',
					status: 'planned',
					title: 'Foundation',
				},
			],
			risks: [
				{
					description: 'Risk',
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
					id: 'roadmap-1',
					milestoneIds: ['milestone-1'],
					status: 'planned',
					title: 'Roadmap',
				},
			],
			workstreams: [],
		},
		exports: {
			html: {
				enabled: true,
				mappingProfile: 'executive/mappings/html.mapping.yml',
				supportStatus: 'supported_now',
			},
		},
		generatedAt: TEST_TIMESTAMP,
		id: TEST_PLAN_ID,
		metadata: {},
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

	it('renders complete static HTML executive snapshot', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.adapterKind).toBe('html');
		expect(result.renderedFiles.length).toBe(1);

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('<!DOCTYPE html>');
		expect(content).toContain('<html lang="en">');
		expect(content).toContain('</html>');
		expect(content).toContain('Test Project');
	});

	it('includes no script tags', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).not.toMatch(/<script/i);
	});

	it('includes no external stylesheet links', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).not.toMatch(/<link\s+rel=["']stylesheet/i);
	});

	it('includes no remote fonts/assets/images', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).not.toMatch(
			/https?:\/\/.*\.(woff|otf|ttf|png|jpg|gif|svg)/i,
		);
	});

	it('includes no iframes or forms', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).not.toMatch(/<iframe/i);
		expect(content).not.toMatch(/<form/i);
	});

	it('escapes unsafe content', () => {
		const xssPlan: ExecutivePlanJson = {
			...plan,
			project: {
				...plan.project,
				name: '<script>alert("xss")</script>',
			},
		};

		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan: xssPlan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).not.toContain('<script>alert');
		expect(content).toContain('&lt;script&gt;');
	});

	it('includes derived/non-canonical warning', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('DERIVED / NON-CANONICAL SNAPSHOT');
		expect(content).toContain('canonical source of truth');
	});

	it('includes metadata and source references', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('Export Metadata');
		expect(content).toContain(TEST_PLAN_ID);
		expect(content).toContain(TEST_PROFILE_ID);
	});

	it('uses accessible headings and readable status labels', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const content = result.renderedFiles[0]?.content;
		expect(content).toContain('<h2>Summary</h2>');
		expect(content).toContain('<h2>Work Items</h2>');
		expect(content).toContain('BLOCKED');
		expect(content).toContain('REQUIRES REVIEW');
	});

	it('result is read-only', () => {
		const result = executiveHtmlExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeHtmlMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});
});
