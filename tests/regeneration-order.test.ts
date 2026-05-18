/** Step 7.3 Regeneration Planning — safe ordering tests */

import { describe, expect, it } from 'vitest';
import type { RegenerationPlanItem } from '../src/regeneration/index.js';
import {
	assignSafeOrderIndices,
	compareRegenerationOrder,
	mustPrecede,
} from '../src/regeneration/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(
	overrides: Partial<RegenerationPlanItem> = {},
): RegenerationPlanItem {
	return {
		action: 'regenerate',
		artifactId: undefined,
		blockers: [],
		canonicalPrerequisites: [],
		derivedOutputPrerequisites: [],
		diagnostics: [],
		documentCanonicalId: undefined,
		downstreamDependents: [],
		dryRun: true,
		graphNodeId: undefined,
		outputPath: undefined,
		phaseId: undefined,
		reasonCodes: [],
		reasons: [],
		safeOrderIndex: 0,
		skippedReasons: [],
		sourceChangeRefs: [],
		stalenessStatus: 'stale',
		status: 'planned',
		targetId: 'target-default',
		targetKind: 'canonical_markdown',
		upstreamDependencies: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Ordering Rules
// ---------------------------------------------------------------------------

describe('assignSafeOrderIndices', () => {
	it('canonical Markdown appears before HTML artifact', () => {
		const items = [
			makeItem({ targetId: 'html-1', targetKind: 'html_artifact' }),
			makeItem({ targetId: 'canonical-1', targetKind: 'canonical_markdown' }),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('canonical_markdown');
		expect(ordered[1].targetKind).toBe('html_artifact');
	});

	it('canonical Markdown appears before agent pack', () => {
		const items = [
			makeItem({ targetId: 'agent-1', targetKind: 'agent_pack' }),
			makeItem({ targetId: 'canonical-1', targetKind: 'canonical_markdown' }),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('canonical_markdown');
		expect(ordered[1].targetKind).toBe('agent_pack');
	});

	it('canonical baseline appears before executive JSON', () => {
		const items = [
			makeItem({ targetId: 'exec-json-1', targetKind: 'executive_json' }),
			makeItem({ targetId: 'canonical-1', targetKind: 'canonical_markdown' }),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('canonical_markdown');
		expect(ordered[1].targetKind).toBe('executive_json');
	});

	it('executive JSON appears before executive Markdown', () => {
		const items = [
			makeItem({ targetId: 'exec-md-1', targetKind: 'executive_markdown' }),
			makeItem({ targetId: 'exec-json-1', targetKind: 'executive_json' }),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('executive_json');
		expect(ordered[1].targetKind).toBe('executive_markdown');
	});

	it('executive JSON appears before executive HTML', () => {
		const items = [
			makeItem({ targetId: 'exec-html-1', targetKind: 'executive_html' }),
			makeItem({ targetId: 'exec-json-1', targetKind: 'executive_json' }),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('executive_json');
		expect(ordered[1].targetKind).toBe('executive_html');
	});

	it('blocked derived artifact does not appear before actionable canonical source', () => {
		const items = [
			makeItem({
				action: 'block_until_canonical_current',
				status: 'blocked',
				targetId: 'html-1',
				targetKind: 'html_artifact',
			}),
			makeItem({
				action: 'regenerate',
				status: 'planned',
				targetId: 'canonical-1',
				targetKind: 'canonical_markdown',
			}),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('canonical_markdown');
		expect(ordered[0].action).toBe('regenerate');
	});

	it('order is deterministic across repeated runs', () => {
		const items = [
			makeItem({ targetId: 'c', targetKind: 'canonical_markdown' }),
			makeItem({ targetId: 'a', targetKind: 'canonical_markdown' }),
			makeItem({ targetId: 'b', targetKind: 'canonical_markdown' }),
			makeItem({ targetId: 'h-1', targetKind: 'html_artifact' }),
		];

		const r1 = assignSafeOrderIndices(items).map((i) => i.targetId);
		const r2 = assignSafeOrderIndices(items).map((i) => i.targetId);
		const r3 = assignSafeOrderIndices(items).map((i) => i.targetId);

		expect(r1).toEqual(r2);
		expect(r2).toEqual(r3);
	});

	it('data/report artifacts appear after canonical', () => {
		const items = [
			makeItem({ targetId: 'data-1', targetKind: 'data_artifact' }),
			makeItem({ targetId: 'report-1', targetKind: 'report_artifact' }),
			makeItem({ targetId: 'canonical-1', targetKind: 'canonical_markdown' }),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].targetKind).toBe('canonical_markdown');
	});

	it('manual-review items appear after actionable items', () => {
		const items = [
			makeItem({
				action: 'manual_review',
				status: 'unknown',
				targetId: 'review-1',
				targetKind: 'canonical_markdown',
			}),
			makeItem({
				action: 'regenerate',
				status: 'planned',
				targetId: 'canonical-1',
				targetKind: 'canonical_markdown',
			}),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].action).toBe('regenerate');
	});

	it('skip_orphaned items appear after actionable items', () => {
		const items = [
			makeItem({
				action: 'skip_orphaned',
				status: 'skipped',
				targetId: 'orphan-1',
				targetKind: 'canonical_markdown',
			}),
			makeItem({
				action: 'regenerate',
				status: 'planned',
				targetId: 'canonical-1',
				targetKind: 'canonical_markdown',
			}),
		];

		const ordered = assignSafeOrderIndices(items);
		expect(ordered[0].action).toBe('regenerate');
	});
});

// ---------------------------------------------------------------------------
// mustPrecede
// ---------------------------------------------------------------------------

describe('mustPrecede', () => {
	it('canonical must precede HTML', () => {
		const canonical = makeItem({
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const html = makeItem({ targetId: 'h-1', targetKind: 'html_artifact' });
		expect(mustPrecede(canonical, html)).toBe(true);
	});

	it('HTML does not need to precede canonical', () => {
		const html = makeItem({ targetId: 'h-1', targetKind: 'html_artifact' });
		const canonical = makeItem({
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		expect(mustPrecede(html, canonical)).toBe(false);
	});

	it('canonical must precede agent pack', () => {
		const canonical = makeItem({
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const agent = makeItem({ targetId: 'a-1', targetKind: 'agent_pack' });
		expect(mustPrecede(canonical, agent)).toBe(true);
	});

	it('canonical must precede executive JSON', () => {
		const canonical = makeItem({
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const execJson = makeItem({
			targetId: 'e-1',
			targetKind: 'executive_json',
		});
		expect(mustPrecede(canonical, execJson)).toBe(true);
	});

	it('executive JSON must precede executive Markdown', () => {
		const execJson = makeItem({
			targetId: 'e-1',
			targetKind: 'executive_json',
		});
		const execMd = makeItem({
			targetId: 'e-2',
			targetKind: 'executive_markdown',
		});
		expect(mustPrecede(execJson, execMd)).toBe(true);
	});

	it('canonical must precede executive Markdown', () => {
		const canonical = makeItem({
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const execMd = makeItem({
			targetId: 'e-1',
			targetKind: 'executive_markdown',
		});
		expect(mustPrecede(canonical, execMd)).toBe(true);
	});

	it('non-blocked actions precede blocked', () => {
		const active = makeItem({
			action: 'regenerate',
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const blocked = makeItem({
			action: 'block_until_dependency_current',
			targetId: 'c-2',
			targetKind: 'canonical_markdown',
		});
		expect(mustPrecede(active, blocked)).toBe(true);
	});

	it('data artifacts preceded by canonical', () => {
		const canonical = makeItem({
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const data = makeItem({ targetId: 'd-1', targetKind: 'data_artifact' });
		expect(mustPrecede(canonical, data)).toBe(true);
	});

	it('same kind, same action items do not force ordering (stable tie-break works)', () => {
		const a = makeItem({
			action: 'regenerate',
			targetId: 'a',
			targetKind: 'canonical_markdown',
		});
		const b = makeItem({
			action: 'regenerate',
			targetId: 'b',
			targetKind: 'canonical_markdown',
		});
		expect(mustPrecede(a, b)).toBe(false);
		expect(mustPrecede(b, a)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// compareRegenerationOrder
// ---------------------------------------------------------------------------

describe('compareRegenerationOrder', () => {
	it('sorts actionable canonical before HTML', () => {
		const canonical = makeItem({
			action: 'regenerate',
			targetId: 'c-1',
			targetKind: 'canonical_markdown',
		});
		const html = makeItem({
			action: 'regenerate',
			targetId: 'h-1',
			targetKind: 'html_artifact',
		});
		expect(compareRegenerationOrder(canonical, html)).toBeLessThan(0);
	});

	it('sorts regenerate before no_action', () => {
		const active = makeItem({ action: 'regenerate', targetId: 'c-1' });
		const inactive = makeItem({ action: 'no_action', targetId: 'c-2' });
		expect(compareRegenerationOrder(active, inactive)).toBeLessThan(0);
	});

	it('uses targetId as tie-breaker', () => {
		const a = makeItem({
			action: 'regenerate',
			targetId: 'aaa',
			targetKind: 'canonical_markdown',
		});
		const b = makeItem({
			action: 'regenerate',
			targetId: 'bbb',
			targetKind: 'canonical_markdown',
		});
		expect(compareRegenerationOrder(a, b)).toBeLessThan(0);
	});
});
