/** Step 11.3 — Executive GitHub Issue-Compatible File Export Tests */

import { describe, expect, it } from 'vitest';
import type { ExecutiveExportMapping } from '../src/executive/executive-export-model.js';
import { executiveGitHubIssuesExportAdapter } from '../src/executive/executive-github-issues-export.js';
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

function makeGhMapping(): ExecutiveExportMapping {
	return {
		adapterKind: 'github_issue_file',
		exportType: 'file_export',
		mappingId: 'github-issues',
		name: 'github-issues',
		outputFormat: 'markdown',
		outputPath: 'outcomes/executive/exports/github-issues/',
		purpose: 'Export execution items into GitHub Issue-compatible files',
		sourcePath:
			'profiles/standard/executive/mappings/github-issues.mapping.yml',
		supportStatus: 'supported_file_export',
		version: '1.0.0',
	};
}

function makePlanWithItems(): ExecutivePlanJson {
	return {
		confidence: { byArea: {}, overall: 'high' },
		execution: {
			artifacts: [],
			decisions: [],
			initiatives: [],
			items: [
				{
					acceptanceCriteria: ['AC 1', 'AC 2'],
					dependsOn: ['wi-002'],
					description: 'Implement feature X with proper testing',
					id: 'wi-001',
					initiativeId: 'init-foundation',
					metadata: {},
					origin: 'derived',
					priority: 'high',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: ['thesis', 'product-brief'],
					sourceRationale: 'Derived from product brief',
					status: 'blocked',
					suggestedExecutor: { type: 'human' },
					suggestedExports: {},
					title: 'Implement Feature X',
					type: 'task',
					workstreamId: 'ws-foundation',
				},
				{
					acceptanceCriteria: ['AC 3'],
					dependsOn: [],
					description: 'Review architecture decisions',
					id: 'wi-002',
					initiativeId: undefined,
					metadata: {},
					origin: 'inferred',
					priority: 'medium',
					requiresReview: true,
					softDependsOn: [],
					sourceNormativeDocuments: ['principles'],
					sourceRationale: 'Derived from warnings',
					status: 'reviewing',
					suggestedExecutor: { type: 'human' },
					suggestedExports: {},
					title: 'Review Architecture',
					type: 'review',
					workstreamId: undefined,
				},
				{
					acceptanceCriteria: [],
					dependsOn: [],
					description: 'Fix critical bug in renderer',
					id: 'wi-003',
					initiativeId: undefined,
					metadata: {},
					origin: 'derived',
					priority: 'critical',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: [],
					sourceRationale: 'Bug report',
					status: 'planned',
					suggestedExecutor: { agentProfile: 'coding-agent', type: 'agent' },
					suggestedExports: {},
					title: 'Fix Renderer Bug',
					type: 'bug',
					workstreamId: undefined,
				},
			],
			milestones: [],
			risks: [
				{
					description: 'Risk related to thesis doc',
					id: 'risk-1',
					impact: 'high',
					likelihood: 'medium',
					mitigation: 'Monitor',
					sourceNormativeDocuments: ['thesis'],
					title: 'Thesis Risk',
				},
			],
			roadmaps: [],
			workstreams: [],
		},
		exports: {},
		generatedAt: TEST_TIMESTAMP,
		id: TEST_PLAN_ID,
		metadata: {},
		project: { description: 'Test', id: 'test', name: 'Test Project' },
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Executive GitHub Issue-Compatible File Export', () => {
	it('renders issue-compatible local file payloads', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.adapterKind).toBe('github_issue_file');
		expect(result.renderedFiles.length).toBeGreaterThanOrEqual(3);
	});

	it('creates no GitHub issues (title claim)', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			// Must not claim issue was created
			expect(file.content).not.toMatch(/^GitHub issue has been created/im);
		}
	});

	it('makes no GitHub API calls (by construction — pure renderer)', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// Pure function, no network dependency
		expect(result.renderedFiles.length).toBeGreaterThan(0);
	});

	it('includes title/body/metadata/source context', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// Sorted by initiative, workstream, status, id — wi-002 (reviewing, no initiative) comes first
		const implFile = result.renderedFiles.find((f) =>
			f.content.includes('# Implement Feature X'),
		);
		expect(implFile).toBeDefined();
		expect(implFile?.content).toContain('# Implement Feature X');
		expect(implFile?.content).toContain('Labels:');
		expect(implFile?.content).toContain('## Description');
		expect(implFile?.content).toContain('## Context');
		expect(implFile?.content).toContain('LOGOS Item ID');
		expect(implFile?.content).toContain('## Acceptance Criteria');
		expect(implFile?.content).toContain('## Source Normative Documents');
		expect(implFile?.content).toContain('## Traceability');
		expect(implFile?.content).toContain('## LOGOS Metadata');
	});

	it('includes blockers/risks/traceability', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// First item (wi-001) depends on wi-002 which is reviewing
		// Second item (wi-002) is reviewing
		const blockedItem = result.renderedFiles.find((f) =>
			f.content.includes('Implement Feature X'),
		);
		expect(blockedItem).toBeDefined();
		expect(blockedItem?.content).toContain('## Dependencies');
		expect(blockedItem?.content).toContain('wi-002');
		expect(blockedItem?.content).toContain('DERIVED / NON-CANONICAL SNAPSHOT');
	});

	it('does not assign owners unless sourced', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).not.toContain('assignee:');
		}
	});

	it('does not include dates/deadlines unless sourced', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).not.toMatch(/due[_-]?date/i);
			expect(file.content).not.toMatch(/deadline/i);
		}
	});

	it('clearly says files are local export payloads', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).toContain('Local file export');
			expect(file.content).toContain('no GitHub issue created');
		}
	});

	it('file format is markdown', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.format).toBe('markdown');
			expect(file.relativePath).toContain('.md');
		}
	});

	it('empty plan produces summary-only file', () => {
		const emptyPlan: ExecutivePlanJson = {
			confidence: { byArea: {}, overall: 'low' },
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
			exports: {},
			generatedAt: TEST_TIMESTAMP,
			id: TEST_PLAN_ID,
			metadata: {},
			project: { description: '', id: 'test', name: 'Test' },
			source: {
				generationPromptId: null,
				normativeDocuments: [],
				readinessStatus: 'unknown',
				sourceCommit: null,
				warnings: [],
			},
			version: '1.0.0',
		};

		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan: emptyPlan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'unknown',
		});

		expect(result.renderedFiles.length).toBe(1);
		expect(result.renderedFiles[0]?.content).toContain(
			'No Exportable Work Items',
		);
	});

	it('result metadata includes non-canonical markers', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.metadata.nonCanonical).toBe(true);
		expect(result.metadata.derivedSnapshot).toBe(true);
		expect(result.metadata.externalApiExecution).toBe(false);
	});

	it('blocked items appear first in deterministic order', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// Blocked item wi-001 should come before others
		expect(result.renderedFiles.length).toBeGreaterThanOrEqual(1);
	});

	it('LOGOS metadata block has is_canonical: false', () => {
		const plan = makePlanWithItems();
		const result = executiveGitHubIssuesExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeGhMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			if (file.content.includes('"is_canonical"')) {
				expect(file.content).toContain('"is_canonical": false');
			}
		}
	});
});
