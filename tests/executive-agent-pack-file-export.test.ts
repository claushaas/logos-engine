/** Step 11.3 — Executive Agent Pack File Export Tests */

import { describe, expect, it } from 'vitest';
import { executiveAgentPackExportAdapter } from '../src/executive/executive-agent-pack-export.js';
import type { ExecutiveExportMapping } from '../src/executive/executive-export-model.js';
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

function makeApMapping(): ExecutiveExportMapping {
	return {
		adapterKind: 'agent_pack_file',
		exportType: 'file_export',
		mappingId: 'agent-pack',
		name: 'agent-pack',
		outputFormat: 'markdown',
		outputPath: 'outcomes/executive/exports/agent-packs/',
		purpose: 'Generate task-specific prompts for agents',
		sourcePath: 'profiles/standard/executive/mappings/agent-pack.mapping.yml',
		supportStatus: 'supported_file_export',
		version: '1.0.0',
	};
}

function makePlanWithAgentItems(): ExecutivePlanJson {
	return {
		confidence: { byArea: {}, overall: 'high' },
		execution: {
			artifacts: [],
			decisions: [
				{
					affectedNormativeDocuments: ['thesis'],
					consequences: ['Decided'],
					context: 'Context',
					decision: 'Decision text',
					id: 'dec-1',
					status: 'done',
					title: 'Decision',
				},
			],
			initiatives: [
				{
					deliverables: ['doc.md'],
					id: 'init-1',
					itemIds: ['wi-001'],
					milestoneId: 'milestone-1',
					purpose: 'Purpose',
					status: 'planned',
					title: 'Foundation',
					workstreamId: 'ws-1',
				},
			],
			items: [
				{
					acceptanceCriteria: ['AC 1', 'AC 2'],
					dependsOn: ['wi-002'],
					description: 'Implement feature X',
					id: 'wi-001',
					initiativeId: 'init-1',
					metadata: {
						nonGoals: ['Do not change API', 'Do not modify DB schema'],
					},
					origin: 'derived',
					priority: 'high',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: ['thesis', 'product-brief'],
					sourceRationale: 'Derived from requirements',
					status: 'blocked',
					suggestedExecutor: { agentProfile: 'coding-agent', type: 'agent' },
					suggestedExports: { html: {}, markdown: {} },
					title: 'Implement Feature X',
					type: 'task',
					workstreamId: 'ws-1',
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
					sourceRationale: 'Review needed',
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
					description: 'Fix bug in renderer',
					id: 'wi-003',
					initiativeId: undefined,
					metadata: {},
					origin: 'derived',
					priority: 'critical',
					requiresReview: false,
					softDependsOn: [],
					sourceNormativeDocuments: [],
					sourceRationale: 'Bug',
					status: 'ready',
					suggestedExecutor: { agentProfile: 'coding-agent', type: 'agent' },
					suggestedExports: {},
					title: 'Fix Renderer Bug',
					type: 'bug',
					workstreamId: undefined,
				},
			],
			milestones: [
				{
					exitCriteria: ['All docs done'],
					id: 'milestone-1',
					initiativeIds: ['init-1'],
					objective: 'Complete foundation',
					status: 'planned',
					title: 'Foundation',
				},
			],
			risks: [
				{
					description: 'Risk related to thesis',
					id: 'risk-1',
					impact: 'high',
					likelihood: 'medium',
					mitigation: 'Monitor',
					sourceNormativeDocuments: ['thesis'],
					title: 'Thesis Risk',
				},
			],
			roadmaps: [],
			workstreams: [
				{
					description: 'Foundation stream',
					id: 'ws-1',
					relatedNormativeAreas: ['01-foundation'],
					title: 'Foundation Stream',
					type: 'normative_documentation',
				},
			],
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

describe('Executive Agent Pack-Compatible File Export', () => {
	it('renders executive work item pack file content', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		expect(result.adapterKind).toBe('agent_pack_file');
		expect(result.renderedFiles.length).toBeGreaterThanOrEqual(3);
	});

	it('does not execute downstream agents (by construction)', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// Pure function, no agent execution
		expect(result.renderedFiles.length).toBeGreaterThan(0);
	});

	it('does not send packs externally', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).not.toMatch(/send|upload|publish|deploy/i);
		}
	});

	it('includes objective/source info', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const taskFile = result.renderedFiles.find((f) =>
			f.content.includes('Implement Feature X'),
		);
		expect(taskFile?.content).toContain('# Agent Task:');
		expect(taskFile?.content).toContain('## Objective');
		expect(taskFile?.content).toContain('## Execution Context');
		expect(taskFile?.content).toContain('LOGOS Item ID');
		expect(taskFile?.content).toContain('## Source Normative Documents');
		expect(taskFile?.content).toContain('thesis');
	});

	it('includes constraints/acceptance criteria/blockers/risks', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// Find blocked item
		const blockedFile = result.renderedFiles.find((f) =>
			f.content.includes('Implement Feature X'),
		);
		expect(blockedFile).toBeDefined();
		expect(blockedFile?.content).toContain('## Acceptance Criteria');
		// wi-001 depends on wi-002 (reviewing, not blocked), so Blockers section is not rendered
		expect(blockedFile?.content).toContain('## Dependencies');
		expect(blockedFile?.content).toContain('## Constraints');
		expect(blockedFile?.content).toContain('## Related Risks');
	});

	it('includes expected output/traceability', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const taskFile = result.renderedFiles.find((f) =>
			f.content.includes('Implement Feature X'),
		);
		expect(taskFile?.content).toContain('## Expected Outputs');
		expect(taskFile?.content).toContain('## Traceability');
	});

	it('includes derived execution-aid warning', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).toContain('DERIVED / NON-CANONICAL EXECUTION AID');
			expect(file.content).toContain('execution aid');
			expect(file.content).toContain('canonical source of truth');
		}
	});

	it('forbids unrelated changes', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).toContain('Do **not** change unrelated files');
		}
	});

	it('preserves unresolved questions and requires-review markers', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		// Review item (wi-002) should mention requires review
		const reviewFile = result.renderedFiles.find((f) =>
			f.content.includes('Review Architecture'),
		);
		expect(reviewFile).toBeDefined();
		expect(reviewFile?.content).toContain('REQUIRES REVIEW');
	});

	it('includes response requirements section', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		for (const file of result.renderedFiles) {
			expect(file.content).toContain('## Response Requirements');
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

		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan: emptyPlan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'unknown',
		});

		expect(result.renderedFiles.length).toBe(1);
		expect(result.renderedFiles[0]?.content).toContain(
			'No Agent Pack-Compatible Work Items',
		);
	});

	it('non-goals from metadata are rendered', () => {
		const plan = makePlanWithAgentItems();
		const result = executiveAgentPackExportAdapter.render({
			clock: deterministicClock,
			documentationRoot: 'logos/',
			mapping: makeApMapping(),
			plan,
			planFingerprint: TEST_FINGERPRINT,
			planId: TEST_PLAN_ID,
			profileId: TEST_PROFILE_ID,
			readinessStatus: 'ready',
		});

		const taskFile = result.renderedFiles.find((f) =>
			f.content.includes('Implement Feature X'),
		);
		expect(taskFile?.content).toContain('### Non-Goals');
		expect(taskFile?.content).toContain('Do not change API');
	});
});
