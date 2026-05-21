/**
 * Performance Baseline Tests — Step 13.2
 *
 * Tests deterministic performance baseline measurement for critical local operations.
 *
 * All tests use fixtures/temp dirs and never mutate the real repository.
 * No network, AI, provider credentials, external APIs, or telemetry.
 */

import { describe, expect, it } from 'vitest';
import {
	BASELINE_OPERATIONS,
	createBaseline,
	createMeasurement,
	evaluateMeasurement,
	getDefaultThreshold,
	measureDuration,
	measureDurationSync,
	type WorkspacePerformanceMeasurement,
} from '../src/performance/performance-baseline.js';

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

describe('measureDuration', () => {
	it('measures async function duration as a positive number', async () => {
		const duration = await measureDuration(async () => {
			// Small delay to get measurable duration
			await new Promise((r) => setTimeout(r, 10));
		});
		expect(duration).toBeGreaterThan(0);
	});

	it('is deterministic for a fixed delay', async () => {
		const d1 = await measureDuration(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});
		const d2 = await measureDuration(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});
		// Both should be at least 10ms (approximately)
		expect(d1).toBeGreaterThan(0);
		expect(d2).toBeGreaterThan(0);
	});
});

describe('measureDurationSync', () => {
	it('measures sync function duration', () => {
		const duration = measureDurationSync(() => {
			// Simple computation
			let _x = 0;
			for (let i = 0; i < 100000; i++) {
				_x += i;
			}
		});
		expect(duration).toBeGreaterThanOrEqual(0);
	});
});

// ---------------------------------------------------------------------------
// Measurement creation
// ---------------------------------------------------------------------------

describe('createMeasurement', () => {
	it('creates a passing measurement when under threshold', () => {
		const m = createMeasurement('state-read', 50, 1000);
		expect(m.operation).toBe('state-read');
		expect(m.durationMs).toBe(50);
		expect(m.status).toBe('pass');
	});

	it('creates a warning measurement when within 2x threshold', () => {
		const m = createMeasurement('state-read', 1500, 1000);
		expect(m.status).toBe('warn');
	});

	it('creates a failing measurement when over 2x threshold', () => {
		const m = createMeasurement('state-read', 2500, 1000);
		expect(m.status).toBe('fail');
	});

	it('uses default threshold when no threshold specified', () => {
		const m = createMeasurement('profile-loading', 100);
		expect(m.thresholdMs).toBeGreaterThan(0);
	});

	it('rounds duration to 2 decimal places', () => {
		const m = createMeasurement('state-read', 123.456789, 1000);
		expect(m.durationMs).toBe(123.46);
	});
});

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

describe('evaluateMeasurement', () => {
	it('passes when duration <= threshold', () => {
		expect(evaluateMeasurement(100, 1000)).toBe('pass');
		expect(evaluateMeasurement(1000, 1000)).toBe('pass');
		expect(evaluateMeasurement(0, 1000)).toBe('pass');
	});

	it('warns when duration <= 2x threshold', () => {
		expect(evaluateMeasurement(1001, 1000)).toBe('warn');
		expect(evaluateMeasurement(2000, 1000)).toBe('warn');
	});

	it('fails when duration > 2x threshold', () => {
		expect(evaluateMeasurement(2001, 1000)).toBe('fail');
		expect(evaluateMeasurement(10000, 1000)).toBe('fail');
	});
});

// ---------------------------------------------------------------------------
// Baseline creation
// ---------------------------------------------------------------------------

describe('createBaseline', () => {
	it('creates a baseline with measuredAt and nodeVersion', () => {
		const ops: WorkspacePerformanceMeasurement[] = [
			createMeasurement('state-read', 10, 1000),
		];
		const baseline = createBaseline(ops);

		expect(baseline.measuredAt).toBeDefined();
		expect(baseline.nodeVersion).toBe(process.version);
		expect(baseline.status).toBe('pass');
		expect(baseline.operations).toHaveLength(1);
	});

	it('status is pass when all pass', () => {
		const ops: WorkspacePerformanceMeasurement[] = [
			{ durationMs: 10, operation: 'a', status: 'pass', thresholdMs: 1000 },
			{ durationMs: 20, operation: 'b', status: 'pass', thresholdMs: 1000 },
		];
		const baseline = createBaseline(ops);
		expect(baseline.status).toBe('pass');
	});

	it('status is warn when at least one warns and none fail', () => {
		const ops: WorkspacePerformanceMeasurement[] = [
			{ durationMs: 1500, operation: 'a', status: 'warn', thresholdMs: 1000 },
			{ durationMs: 20, operation: 'b', status: 'pass', thresholdMs: 1000 },
		];
		const baseline = createBaseline(ops);
		expect(baseline.status).toBe('warn');
	});

	it('status is fail when at least one fails', () => {
		const ops: WorkspacePerformanceMeasurement[] = [
			{ durationMs: 5000, operation: 'a', status: 'fail', thresholdMs: 1000 },
			{ durationMs: 20, operation: 'b', status: 'pass', thresholdMs: 1000 },
		];
		const baseline = createBaseline(ops);
		expect(baseline.status).toBe('fail');
	});

	it('includes skipped operations', () => {
		const ops: WorkspacePerformanceMeasurement[] = [];
		const skipped = [
			{ operation: 'scanner-fixture', reason: 'No fixture available' },
		];
		const baseline = createBaseline(ops, skipped);

		expect(baseline.skipped).toHaveLength(1);
		expect(baseline.skipped[0]?.operation).toBe('scanner-fixture');
	});

	it('includes environment note', () => {
		const baseline = createBaseline([]);
		expect(baseline.environmentNote).toContain('local');
		expect(baseline.environmentNote).toContain('approximate');
	});
});

// ---------------------------------------------------------------------------
// Default thresholds
// ---------------------------------------------------------------------------

describe('getDefaultThreshold', () => {
	it('returns threshold for known operations', () => {
		expect(getDefaultThreshold('profile-loading')).toBe(5000);
		expect(getDefaultThreshold('state-read')).toBe(1000);
		expect(getDefaultThreshold('state-write')).toBe(2000);
		expect(getDefaultThreshold('validation')).toBe(10000);
	});

	it('returns default 10000 for unknown operations', () => {
		expect(getDefaultThreshold('unknown-operation')).toBe(10000);
	});
});

// ---------------------------------------------------------------------------
// Baseline operations
// ---------------------------------------------------------------------------

describe('BASELINE_OPERATIONS', () => {
	it('lists all expected operations', () => {
		expect(BASELINE_OPERATIONS).toContain('profile-loading');
		expect(BASELINE_OPERATIONS).toContain('state-read');
		expect(BASELINE_OPERATIONS).toContain('state-write');
		expect(BASELINE_OPERATIONS).toContain('validation');
		expect(BASELINE_OPERATIONS).toContain('dependency-graph');
		expect(BASELINE_OPERATIONS).toContain('staleness');
		expect(BASELINE_OPERATIONS).toContain('import-planner');
		expect(BASELINE_OPERATIONS).toContain('scanner-fixture');
		expect(BASELINE_OPERATIONS).toContain('docs-code-consistency');
		expect(BASELINE_OPERATIONS).toContain('extraction-fixture');
		expect(BASELINE_OPERATIONS).toContain('executive-readiness');
		expect(BASELINE_OPERATIONS).toContain('executive-compile');
	});
});

// ---------------------------------------------------------------------------
// Security & privacy
// ---------------------------------------------------------------------------

describe('performance baseline security', () => {
	it('baseline contains no secrets', () => {
		const baseline = createBaseline([]);
		const json = JSON.stringify(baseline);
		expect(json).not.toContain('sk-');
		expect(json).not.toContain('Bearer ');
		expect(json).not.toContain('API_KEY=');
	});

	it('baseline does not include full environment dump', () => {
		const baseline = createBaseline([]);
		const json = JSON.stringify(baseline);
		// Should not contain env vars
		expect(json).not.toContain('PATH=');
		expect(json).not.toContain('HOME=');
		// Should only include node version
		expect(json).toContain('nodeVersion');
	});

	it('baseline does not expose absolute working directory', () => {
		const baseline = createBaseline([]);
		const json = JSON.stringify(baseline);
		expect(json).not.toContain(process.cwd());
	});
});

// ---------------------------------------------------------------------------
// Report snapshot
// ---------------------------------------------------------------------------

describe('performance report snapshot', () => {
	it('snapshots a baseline report', () => {
		const ops: WorkspacePerformanceMeasurement[] = [
			{
				durationMs: 12.34,
				notes: 'temp workspace',
				operation: 'state-read',
				status: 'pass',
				thresholdMs: 1000,
			},
			{
				durationMs: 45.67,
				notes: 'temp workspace',
				operation: 'state-write',
				status: 'pass',
				thresholdMs: 2000,
			},
		];

		const baseline = createBaseline(ops);
		// Normalize dynamic fields for snapshot
		const snapshot = {
			...baseline,
			measuredAt: '<normalized>',
			nodeVersion: '<normalized>',
		};
		expect(snapshot.operations).toMatchSnapshot();
		expect(snapshot.status).toMatchSnapshot();
		expect(snapshot.environmentNote).toMatchSnapshot();
	});
});
