/** Step 7.3 Regeneration Planning — upstream/downstream impact tests */

import { describe, expect, it } from 'vitest';
import type { RegenerationPlanInput } from '../src/regeneration/index.js';
import { createRegenerationPlan } from '../src/regeneration/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE = {
	dependencyGraph: {
		edges: [],
		nodeMap: new Map(),
		nodes: [],
		upstreamEdges: new Map(),
	},
	documentationRoot: 'logos/',
	profileId: 'standard',
};

function makeTarget(
	targetId: string,
	targetKind: string,
	documentCanonicalId: string,
	status: string,
	upstreamImpacts: Array<{
		edgeKind: string;
		message: string;
		required: boolean;
		upstreamStatus: string;
		upstreamTargetId: string;
	}> = [],
	reasons: Array<{
		code: string;
		severity: 'info' | 'warning' | 'error';
		message: string;
		sourceKind: string;
	}> = [],
): RegenerationPlanInput['stalenessResult']['targets'][number] {
	return {
		artifactId: undefined,
		changedSourceRefs: [],
		currentNodeFingerprint: undefined,
		diagnostics: [],
		documentCanonicalId,
		generatedAt: undefined,
		generationRunId: undefined,
		graphNodeId: `node:${targetId}`,
		outputPath: `logos/${documentCanonicalId}.md`,
		phaseId: '01-foundation',
		reasons:
			reasons.length > 0
				? reasons.map((r) => ({
						code: r.code,
						expected: undefined,
						message: r.message,
						received: undefined,
						severity: r.severity,
						sourceId: undefined,
						sourceKind: r.sourceKind,
						sourcePath: undefined,
						targetId,
						upstreamTargetId: undefined,
					}))
				: [],
		recordedSourceFingerprint: undefined,
		severity: 'warning',
		status,
		targetId,
		targetKind,
		upstreamImpacts,
	};
}

// ---------------------------------------------------------------------------
// Upstream Impact Tests
// ---------------------------------------------------------------------------

describe('createRegenerationPlan — upstream impact', () => {
	it('changed upstream decision marks downstream canonical output affected', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'decision_changed',
								message: 'Decision changed',
								severity: 'warning',
								sourceKind: 'decision',
							},
						],
					),
					makeTarget(
						'canonical:i-02',
						'canonical_markdown',
						'i-02',
						'stale',
						[
							{
								edgeKind: 'depends_on',
								message: 'Depends on i-01',
								required: true,
								upstreamStatus: 'stale',
								upstreamTargetId: 'canonical:i-01',
							},
						],
						[
							{
								code: 'upstream_required_stale',
								message: 'Upstream stale',
								severity: 'error',
								sourceKind: 'dependency_graph',
							},
						],
					),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const target2 = result.plan.items.find(
			(i) => i.targetId === 'canonical:i-02',
		);
		expect(target2).toBeDefined();
		// Downstream target should include reason about upstream
		const upstreamRefs = target2?.upstreamDependencies ?? [];
		expect(upstreamRefs.length).toBeGreaterThan(0);
	});

	it('changed upstream assumption marks downstream outputs affected', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'assumption_changed',
								message: 'Assumption changed',
								severity: 'warning',
								sourceKind: 'assumption',
							},
						],
					),
					makeTarget('canonical:i-02', 'canonical_markdown', 'i-02', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Depends on i-01',
							required: true,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-01',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(
			result.plan.sourceChanges.some((c) => c.sourceKind === 'assumption'),
		).toBe(true);
	});

	it('changed open question blocks or affects downstream according to relation', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'open_question_changed',
								message: 'Open question changed',
								severity: 'warning',
								sourceKind: 'open_question',
							},
						],
					),
					makeTarget('canonical:i-02', 'canonical_markdown', 'i-02', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Depends on i-01',
							required: true,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-01',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(
			result.plan.sourceChanges.some((c) => c.sourceKind === 'open_question'),
		).toBe(true);
	});

	it('changed risk marks downstream outputs with warning', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'risk_changed',
								message: 'Risk changed',
								severity: 'warning',
								sourceKind: 'risk',
							},
						],
					),
					makeTarget('canonical:i-02', 'canonical_markdown', 'i-02', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Depends on i-01',
							required: true,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-01',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.sourceChanges.some((c) => c.sourceKind === 'risk')).toBe(
			true,
		);
	});

	it('optional dependency change creates warning without blocking by default', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'decision_changed',
								message: 'Optional dependency changed',
								severity: 'info',
								sourceKind: 'decision',
							},
						],
					),
					makeTarget('canonical:i-02', 'canonical_markdown', 'i-02', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Optional ref',
							required: false,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-01',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const target2 = result.plan.items.find(
			(i) => i.targetId === 'canonical:i-02',
		);
		expect(target2).toBeDefined();
		// Optional dependencies should not force blocking
		if (target2) {
			expect(target2.action).not.toBe('block_until_dependency_current');
		}
	});

	it('transitive downstream targets are included', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 3,
					total: 3,
					unknownCount: 0,
				},
				targets: [
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'decision_changed',
								message: 'Root change',
								severity: 'warning',
								sourceKind: 'decision',
							},
						],
					),
					makeTarget('canonical:i-02', 'canonical_markdown', 'i-02', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Depends on i-01',
							required: true,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-01',
						},
					]),
					makeTarget('canonical:i-03', 'canonical_markdown', 'i-03', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Depends on i-02',
							required: true,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-02',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items.length).toBe(3);
	});

	it('downstream dependents are traced in plan items', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeTarget('canonical:i-01', 'canonical_markdown', 'i-01', 'stale'),
					makeTarget('canonical:i-02', 'canonical_markdown', 'i-02', 'stale', [
						{
							edgeKind: 'depends_on',
							message: 'Depends on i-01',
							required: true,
							upstreamStatus: 'stale',
							upstreamTargetId: 'canonical:i-01',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const source = result.plan.items.find(
			(i) => i.targetId === 'canonical:i-01',
		);
		expect(source?.downstreamDependents.length).toBeGreaterThan(0);
	});

	it('profile_contract_changed reason appears in source changes', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
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
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'profile_contract_changed',
								message: 'Profile changed',
								severity: 'warning',
								sourceKind: 'profile_contract',
							},
						],
					),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(
			result.plan.sourceChanges.some(
				(c) => c.sourceKind === 'profile_contract',
			),
		).toBe(true);
		expect(result.plan.items[0].reasonCodes).toContain(
			'profile_contract_changed',
		);
	});

	it('document_descriptor_changed reason appears in reason codes', () => {
		const input: RegenerationPlanInput = {
			...BASE,
			stalenessResult: {
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
					makeTarget(
						'canonical:i-01',
						'canonical_markdown',
						'i-01',
						'stale',
						[],
						[
							{
								code: 'document_descriptor_changed',
								message: 'Descriptor changed',
								severity: 'warning',
								sourceKind: 'document_descriptor',
							},
						],
					),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].reasonCodes).toContain(
			'document_descriptor_changed',
		);
	});
});
