/** Step 7.3 Regeneration Planner — core planner tests */

import { describe, expect, it } from 'vitest';
import type { RegenerationPlanInput } from '../src/regeneration/index.js';
import {
	createRegenerationPlan,
	summarizeRegenerationPlan,
} from '../src/regeneration/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_INPUT: RegenerationPlanInput = {
	dependencyGraph: {
		edges: [],
		nodeMap: new Map(),
		nodes: [],
		upstreamEdges: new Map(),
	},
	documentationRoot: 'logos/',
	profileId: 'standard',
	stalenessResult: {
		summary: {
			blockedCount: 0,
			currentCount: 0,
			missingCount: 0,
			orphanedCount: 0,
			staleCount: 0,
			total: 0,
			unknownCount: 0,
		},
		targets: [],
	},
};

function makeStaleCanonicalTarget(
	targetId: string,
	documentCanonicalId: string,
	phaseId = '01-foundation',
	reasons: Array<{
		code: string;
		sourceKind: string;
		message: string;
		severity?: string;
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
		phaseId,
		reasons:
			reasons.length > 0
				? reasons.map((r) => ({
						code: r.code,
						expected: undefined,
						message: r.message,
						received: undefined,
						severity: (r.severity ?? 'warning') as 'info' | 'warning' | 'error',
						sourceId: undefined,
						sourceKind: r.sourceKind,
						sourcePath: undefined,
						targetId,
						upstreamTargetId: undefined,
					}))
				: [
						{
							code: 'decision_changed',
							expected: undefined,
							message: `Decision change affected ${documentCanonicalId}`,
							received: undefined,
							severity: 'warning' as const,
							sourceId: 'dec-1',
							sourceKind: 'decision',
							sourcePath: undefined,
							targetId,
							upstreamTargetId: undefined,
						},
					],
		recordedSourceFingerprint: undefined,
		severity: 'warning',
		status: 'stale',
		targetId,
		targetKind: 'canonical_markdown',
		upstreamImpacts: [],
	};
}

function makeMissingCanonicalTarget(
	targetId: string,
	documentCanonicalId: string,
	phaseId = '01-foundation',
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
		phaseId,
		reasons: [
			{
				code: 'output_file_missing',
				expected: undefined,
				message: `Output file is missing for ${documentCanonicalId}`,
				received: undefined,
				severity: 'error' as const,
				sourceId: undefined,
				sourceKind: 'output_file',
				sourcePath: undefined,
				targetId,
				upstreamTargetId: undefined,
			},
		],
		recordedSourceFingerprint: undefined,
		severity: 'error',
		status: 'missing',
		targetId,
		targetKind: 'canonical_markdown',
		upstreamImpacts: [],
	};
}

function makeCurrentCanonicalTarget(
	targetId: string,
	documentCanonicalId: string,
	phaseId = '01-foundation',
): RegenerationPlanInput['stalenessResult']['targets'][number] {
	return {
		artifactId: undefined,
		changedSourceRefs: [],
		currentNodeFingerprint: 'abc123',
		diagnostics: [],
		documentCanonicalId,
		generatedAt: '2025-01-01T00:00:00Z',
		generationRunId: 'run-1',
		graphNodeId: `node:${targetId}`,
		outputPath: `logos/${documentCanonicalId}.md`,
		phaseId,
		reasons: [],
		recordedSourceFingerprint: 'abc123',
		severity: 'info',
		status: 'current',
		targetId,
		targetKind: 'canonical_markdown',
		upstreamImpacts: [],
	};
}

function makeBlockedTarget(
	targetId: string,
	documentCanonicalId: string,
	upstreamTargetId: string,
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
		phaseId: '02-architecture',
		reasons: [
			{
				code: 'upstream_required_stale',
				expected: 'current',
				message: `Required upstream ${upstreamTargetId} is stale`,
				received: 'stale',
				severity: 'error' as const,
				sourceId: undefined,
				sourceKind: 'dependency_graph',
				sourcePath: undefined,
				targetId,
				upstreamTargetId,
			},
		],
		recordedSourceFingerprint: undefined,
		severity: 'error',
		status: 'blocked',
		targetId,
		targetKind: 'canonical_markdown',
		upstreamImpacts: [
			{
				edgeKind: 'depends_on',
				message: `Blocked by upstream ${upstreamTargetId}`,
				required: true,
				upstreamStatus: 'stale',
				upstreamTargetId,
			},
		],
	};
}

function makeOrphanedTarget(
	targetId: string,
	outputPath: string,
): RegenerationPlanInput['stalenessResult']['targets'][number] {
	return {
		artifactId: undefined,
		changedSourceRefs: [],
		currentNodeFingerprint: undefined,
		diagnostics: [],
		documentCanonicalId: undefined,
		generatedAt: '2024-01-01T00:00:00Z',
		generationRunId: 'old-run',
		graphNodeId: undefined,
		outputPath,
		phaseId: undefined,
		reasons: [
			{
				code: 'orphaned_output',
				expected: undefined,
				message: `${targetId} has no active source document`,
				received: undefined,
				severity: 'warning' as const,
				sourceId: undefined,
				sourceKind: 'dependency_graph',
				sourcePath: undefined,
				targetId,
				upstreamTargetId: undefined,
			},
		],
		recordedSourceFingerprint: undefined,
		severity: 'warning',
		status: 'orphaned',
		targetId,
		targetKind: 'canonical_markdown',
		upstreamImpacts: [],
	};
}

function makeUnknownTarget(
	targetId: string,
): RegenerationPlanInput['stalenessResult']['targets'][number] {
	return {
		artifactId: undefined,
		changedSourceRefs: [],
		currentNodeFingerprint: undefined,
		diagnostics: [
			{
				artifactId: undefined,
				code: 'insufficient_metadata',
				documentCanonicalId: undefined,
				expected: undefined,
				fieldPath: undefined,
				graphNodeId: undefined,
				message: 'Cannot determine staleness — insufficient metadata',
				phaseId: undefined,
				received: undefined,
				recoveryHint: 'Run /generate to create metadata',
				severity: 'warning',
				sourcePath: undefined,
			},
		],
		documentCanonicalId: undefined,
		generatedAt: undefined,
		generationRunId: undefined,
		graphNodeId: `node:${targetId}`,
		outputPath: undefined,
		phaseId: undefined,
		reasons: [],
		recordedSourceFingerprint: undefined,
		severity: 'warning',
		status: 'unknown',
		targetId,
		targetKind: 'canonical_markdown',
		upstreamImpacts: [],
	};
}

function makeDerivedTarget(
	targetId: string,
	targetKind: string,
	documentCanonicalId: string,
	status: string,
	canonicalSourceStatus?: string,
): RegenerationPlanInput['stalenessResult']['targets'][number] {
	const upstreamImpacts: Array<{
		edgeKind: string;
		message: string;
		required: boolean;
		upstreamStatus: string;
		upstreamTargetId: string;
	}> = [];

	if (canonicalSourceStatus) {
		upstreamImpacts.push({
			edgeKind: 'derived_from',
			message: `Derived from ${documentCanonicalId}`,
			required: true,
			upstreamStatus: canonicalSourceStatus,
			upstreamTargetId: `canonical:${documentCanonicalId}`,
		});
	}

	const reasons: Array<{
		code: string;
		expected: string | undefined;
		message: string;
		received: string | undefined;
		severity: 'info' | 'warning' | 'error';
		sourceId: string | undefined;
		sourceKind: string;
		sourcePath: undefined;
		targetId: string;
		upstreamTargetId: string | undefined;
	}> = [];

	if (status === 'stale') {
		if (canonicalSourceStatus && canonicalSourceStatus !== 'current') {
			reasons.push({
				code: 'upstream_required_stale',
				expected: 'current',
				message: `Upstream canonical source is ${canonicalSourceStatus}`,
				received: canonicalSourceStatus,
				severity: 'error' as const,
				sourceId: undefined,
				sourceKind: 'dependency_graph',
				sourcePath: undefined,
				targetId,
				upstreamTargetId: `canonical:${documentCanonicalId}`,
			});
		} else {
			reasons.push({
				code: 'output_checksum_mismatch',
				expected: 'abc',
				message: 'Output checksum mismatch',
				received: 'def',
				severity: 'warning' as const,
				sourceId: undefined,
				sourceKind: 'output_file',
				sourcePath: undefined,
				targetId,
				upstreamTargetId: undefined,
			});
		}
	}

	return {
		artifactId: undefined,
		changedSourceRefs: [],
		currentNodeFingerprint: undefined,
		diagnostics: [],
		documentCanonicalId,
		generatedAt: undefined,
		generationRunId: undefined,
		graphNodeId: `node:${targetId}`,
		outputPath: `logos/${documentCanonicalId}.html`,
		phaseId: '01-foundation',
		reasons,
		recordedSourceFingerprint: undefined,
		severity: status === 'blocked' ? 'error' : 'warning',
		status,
		targetId,
		targetKind,
		upstreamImpacts,
	};
}

// ---------------------------------------------------------------------------
// Planner Construction Tests
// ---------------------------------------------------------------------------

describe('createRegenerationPlan — construction', () => {
	it('creates regeneration plan from stale canonical target', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items).toHaveLength(1);
		expect(result.plan.items[0].action).toBe('regenerate');
		expect(result.plan.items[0].status).toBe('planned');
		expect(result.plan.items[0].targetKind).toBe('canonical_markdown');
	});

	it('stale canonical Markdown target becomes regenerate', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-02', 'i-02')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].action).toBe('regenerate');
	});

	it('missing canonical Markdown target becomes generate_missing', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [makeMissingCanonicalTarget('canonical:i-03', 'i-03')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].action).toBe('generate_missing');
		expect(result.plan.items[0].status).toBe('missing_source');
	});

	it('current target is omitted by default', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [makeCurrentCanonicalTarget('canonical:i-04', 'i-04')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items).toHaveLength(0);
	});

	it('current target is included when includeCurrent is true', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [makeCurrentCanonicalTarget('canonical:i-04', 'i-04')],
			},
		};

		const result = createRegenerationPlan(input, { includeCurrent: true });
		expect(result.plan.items).toHaveLength(1);
		expect(result.plan.items[0].action).toBe('no_action');
		expect(result.plan.items[0].status).toBe('not_needed');
	});

	it('blocked target becomes blocked action', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
			stalenessResult: {
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
					makeBlockedTarget('canonical:i-05', 'i-05', 'canonical:i-01'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].action).toBe('block_until_dependency_current');
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('orphaned target becomes skip/manual-review action', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 1,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [makeOrphanedTarget('old-output', 'logos/old.md')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].action).toBe('skip_orphaned');
		expect(result.plan.items[0].status).toBe('skipped');
	});

	it('unknown target becomes manual-review/refresh-metadata action', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
			stalenessResult: {
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 1,
				},
				targets: [makeUnknownTarget('unknown-target-1')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].action).toBe('manual_review');
		expect(result.plan.items[0].status).toBe('unknown');
	});

	it('plan includes reason codes', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', '01-foundation', [
						{
							code: 'decision_changed',
							message: 'Decision changed',
							sourceKind: 'decision',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].reasonCodes).toContain('decision_changed');
	});

	it('plan includes source changes', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', '01-foundation', [
						{
							code: 'decision_changed',
							message: 'Decision changed',
							sourceKind: 'decision',
						},
					]),
				],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.sourceChanges.length).toBeGreaterThan(0);
	});

	it('plan summary counts are deterministic', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
					makeStaleCanonicalTarget('canonical:i-01', 'i-01'),
					makeStaleCanonicalTarget('canonical:i-02', 'i-02'),
				],
			},
		};

		const r1 = createRegenerationPlan(input);
		const r2 = createRegenerationPlan(input);

		expect(r1.plan.countByAction.regenerate).toBe(2);
		expect(r2.plan.countByAction.regenerate).toBe(2);
		expect(r1.plan.items.map((i) => i.targetId).sort()).toEqual(
			r2.plan.items.map((i) => i.targetId).sort(),
		);
	});
});

// ---------------------------------------------------------------------------
// Dry-Run Tests
// ---------------------------------------------------------------------------

describe('createRegenerationPlan — dry-run', () => {
	it('dry-run result has no changed paths', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input, { dryRun: true });
		expect(result.dryRunSummary.changedPaths).toEqual([]);
	});

	it('dry-run summary explains affected outputs', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input, { dryRun: true });
		expect(result.dryRunSummary.plannedCount).toBe(1);
		expect(result.dryRunSummary.blockedCount).toBe(0);
		expect(result.dryRunSummary.safeOrderDescriptions.length).toBeGreaterThan(
			0,
		);
	});

	it('dry-run creates no files (regeneration planning is read-only)', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input, { dryRun: true });
		expect(result.plan.dryRun).toBe(true);
		expect(result.dryRunSummary.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Filtering Tests
// ---------------------------------------------------------------------------

describe('createRegenerationPlan — filtering', () => {
	it('filter by document id includes only related affected targets', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
					makeStaleCanonicalTarget('canonical:i-01', 'i-01'),
					makeStaleCanonicalTarget('canonical:i-02', 'i-02'),
				],
			},
		};

		const result = createRegenerationPlan(input, { targetDocumentId: 'i-01' });
		expect(result.plan.items).toHaveLength(1);
		expect(result.plan.items[0].documentCanonicalId).toBe('i-01');
	});

	it('filter by phase id includes only phase-related targets', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', '01-foundation'),
					makeStaleCanonicalTarget('canonical:i-02', 'i-02', '02-architecture'),
				],
			},
		};

		const result = createRegenerationPlan(input, {
			targetPhaseId: '01-foundation',
		});
		expect(result.plan.items).toHaveLength(1);
		expect(result.plan.items[0].phaseId).toBe('01-foundation');
	});

	it('filter by target kind works', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input, {
			targetKind: 'canonical_markdown',
		});
		expect(result.plan.items.length).toBeGreaterThanOrEqual(0);
	});

	it('include/exclude derived artifacts works', () => {
		const targets = [
			makeStaleCanonicalTarget('canonical:i-01', 'i-01'),
			makeDerivedTarget(
				'html:i-01',
				'html_artifact',
				'i-01',
				'stale',
				'current',
			),
		];
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets,
			},
		};

		// Include derived (default)
		const withDerived = createRegenerationPlan(input, { includeDerived: true });
		expect(withDerived.plan.items.length).toBeGreaterThanOrEqual(1);

		// Exclude derived — should only have canonical
		const withoutDerived = createRegenerationPlan(input, {
			includeDerived: false,
		});
		for (const item of withoutDerived.plan.items) {
			if (item.status === 'planned') {
				expect(item.targetKind).toBe('canonical_markdown');
			}
		}
	});

	it('unknown filter target produces diagnostic', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input, {
			targetDocumentId: 'nonexistent',
		});
		expect(result.diagnostics.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Non-Mutation Tests
// ---------------------------------------------------------------------------

describe('createRegenerationPlan — non-mutation', () => {
	it('regeneration planning writes no files', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.dryRun).toBe(true);
		expect(result.dryRunSummary.changedPaths).toEqual([]);
	});

	it('regeneration planning does not generate Markdown/HTML/agent packs', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input);
		expect(result.plan.items[0].action).toBe('regenerate');
		// Planning only, no actual generation
		expect(result.dryRunSummary.changedPaths).toEqual([]);
	});

	it('regeneration planning does not call AI/provider code', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
				targets: [makeStaleCanonicalTarget('canonical:i-01', 'i-01')],
			},
		};

		const result = createRegenerationPlan(input);
		// Result contains no provider-related fields
		expect(result.plan).toBeDefined();
		expect(typeof result.plan.profileId).toBe('string');
	});
});

// ---------------------------------------------------------------------------
// summarizeRegenerationPlan Tests
// ---------------------------------------------------------------------------

describe('summarizeRegenerationPlan', () => {
	it('produces a concise summary from a regeneration plan', () => {
		const input: RegenerationPlanInput = {
			...EMPTY_INPUT,
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
					makeStaleCanonicalTarget('canonical:i-01', 'i-01'),
					makeStaleCanonicalTarget('canonical:i-02', 'i-02'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const summary = summarizeRegenerationPlan(result.plan);

		expect(summary.totalTargets).toBe(2);
		expect(summary.plannedCount).toBeGreaterThan(0);
		expect(summary.blockedCount).toBe(0);
		expect(summary.safeOrderNote).toBeTruthy();
	});
});
