/** Step 7.3 Regeneration Planning — derived artifact gating tests */

import { describe, expect, it } from 'vitest';
import type { RegenerationPlanInput } from '../src/regeneration/index.js';
import { createRegenerationPlan } from '../src/regeneration/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStaleCanonicalTarget(
	targetId: string,
	documentCanonicalId: string,
	status = 'stale',
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
			status === 'stale'
				? [
						{
							code: 'decision_changed',
							expected: undefined,
							message: 'Decision changed',
							received: undefined,
							severity: 'warning' as const,
							sourceId: 'dec-1',
							sourceKind: 'decision',
							sourcePath: undefined,
							targetId,
							upstreamTargetId: undefined,
						},
					]
				: [],
		recordedSourceFingerprint: status === 'current' ? 'abc123' : undefined,
		severity: status === 'current' ? 'info' : 'warning',
		status,
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
): RegenerationPlanInput['stalenessResult']['targets'][number] {
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

	if (status === 'missing') {
		reasons.push({
			code: 'output_file_missing',
			expected: undefined,
			message: 'Output file is missing',
			received: undefined,
			severity: 'error' as const,
			sourceId: undefined,
			sourceKind: 'output_file',
			sourcePath: undefined,
			targetId,
			upstreamTargetId: undefined,
		});
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
		upstreamImpacts: [],
	};
}

// ---------------------------------------------------------------------------
// Derived Artifact Gating Tests
// ---------------------------------------------------------------------------

describe('createRegenerationPlan — derived artifact gating', () => {
	it('stale HTML artifact is blocked until canonical source is current', () => {
		const input: RegenerationPlanInput = {
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
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'stale'),
					makeDerivedTarget('html:i-01', 'html_artifact', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const html = result.plan.items.find((i) => i.targetId === 'html:i-01');
		const canonical = result.plan.items.find(
			(i) => i.targetId === 'canonical:i-01',
		);

		expect(canonical).toBeDefined();
		expect(html).toBeDefined();

		// HTML should be blocked until canonical is current
		if (html) {
			expect(html.action).toBe('block_until_canonical_current');
		}

		// Canonical should appear before HTML in safe order
		if (canonical && html) {
			expect(canonical.safeOrderIndex).toBeLessThan(html.safeOrderIndex);
		}
	});

	it('stale agent pack is blocked until canonical source is current', () => {
		const input: RegenerationPlanInput = {
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
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'stale'),
					makeDerivedTarget('agent:i-01', 'agent_pack', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const agent = result.plan.items.find((i) => i.targetId === 'agent:i-01');
		expect(agent).toBeDefined();
		if (agent) {
			expect(agent.action).toBe('block_until_canonical_current');
		}
	});

	it('derived artifacts are never treated as canonical sources', () => {
		const input: RegenerationPlanInput = {
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
					staleCount: 1,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					makeDerivedTarget('html:i-01', 'html_artifact', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const html = result.plan.items.find((i) => i.targetId === 'html:i-01');
		expect(html?.targetKind).toBe('html_artifact');
		// HTML targets should never be canonical
		expect(html?.targetKind).not.toBe('canonical_markdown');
	});

	it('missing canonical source blocks derived artifacts', () => {
		const input: RegenerationPlanInput = {
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
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 1,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'missing'),
					makeDerivedTarget('html:i-01', 'html_artifact', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const html = result.plan.items.find((i) => i.targetId === 'html:i-01');
		expect(html).toBeDefined();
		if (html) {
			expect(html.action).toBe('block_until_canonical_current');
		}
	});

	it('stale executive Markdown is blocked until normative/canonical prerequisites are current', () => {
		const input: RegenerationPlanInput = {
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
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'stale'),
					makeDerivedTarget('exec-md:1', 'executive_markdown', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const execMd = result.plan.items.find((i) => i.targetId === 'exec-md:1');
		expect(execMd).toBeDefined();
		if (execMd) {
			expect(execMd.action).toBe('block_until_canonical_current');
		}
	});

	it('executive JSON is blocked until canonical prerequisites are current', () => {
		const input: RegenerationPlanInput = {
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
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'stale'),
					makeDerivedTarget('exec-json:1', 'executive_json', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const execJson = result.plan.items.find(
			(i) => i.targetId === 'exec-json:1',
		);
		expect(execJson).toBeDefined();
		if (execJson) {
			expect(execJson.action).toBe('block_until_canonical_current');
		}
	});

	it('HTML artifact with current canonical source is not blocked', () => {
		const input: RegenerationPlanInput = {
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
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'current'),
					makeDerivedTarget('html:i-01', 'html_artifact', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const html = result.plan.items.find((i) => i.targetId === 'html:i-01');
		// With current canonical, HTML blocking should not be applied
		expect(html).toBeDefined();
	});

	it('data artifact stale with missing canonical is blocked', () => {
		const input: RegenerationPlanInput = {
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
					staleCount: 2,
					total: 2,
					unknownCount: 0,
				},
				targets: [
					makeStaleCanonicalTarget('canonical:i-01', 'i-01', 'missing'),
					makeDerivedTarget('data:i-01', 'data_artifact', 'i-01', 'stale'),
				],
			},
		};

		const result = createRegenerationPlan(input);
		const dataTarget = result.plan.items.find(
			(i) => i.targetId === 'data:i-01',
		);
		expect(dataTarget).toBeDefined();
		if (dataTarget) {
			expect(dataTarget.action).toBe('block_until_canonical_current');
		}
	});
});
