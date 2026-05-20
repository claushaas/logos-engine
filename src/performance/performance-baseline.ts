/**
 * Performance Baseline — deterministic local performance measurements for critical operations.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 *
 * All measurements are local-only, deterministic, provider-free, and non-telemetry.
 * Baseline uses fixtures/temp directories and never mutates the real repository.
 * No network, AI, external APIs, or platform-specific tools are used.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspacePerformanceMeasurement {
	/** Operation name */
	operation: string;
	/** Measured duration in milliseconds */
	durationMs: number;
	/** Threshold in milliseconds */
	thresholdMs: number;
	/** Status: pass, warn, fail */
	status: 'pass' | 'warn' | 'fail';
	/** Notes about the measurement */
	notes?: string | undefined;
}

export interface WorkspacePerformanceBaseline {
	/** ISO timestamp of measurement */
	measuredAt: string;
	/** Node.js version */
	nodeVersion: string;
	/** Individual operation results */
	operations: WorkspacePerformanceMeasurement[];
	/** Summary status */
	status: 'pass' | 'warn' | 'fail';
	/** Skipped operations and reasons */
	skipped: Array<{ operation: string; reason: string }>;
	/** Environment note */
	environmentNote: string;
}

export interface WorkspacePerformanceResult {
	baseline: WorkspacePerformanceBaseline;
	/** Raw timings for programmatic use */
	timings: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Thresholds (generous to avoid flaky CI)
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: Record<string, number> = {
	'dependency-graph': 10000,
	'docs-code-consistency': 10000,
	'executive-compile': 30000,
	'executive-readiness': 10000,
	'extraction-fixture': 10000,
	'import-planner': 5000,
	'profile-loading': 5000,
	'scanner-fixture': 30000,
	staleness: 5000,
	'state-read': 1000,
	'state-write': 2000,
	validation: 10000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Measure the duration of an async function.
 */
export async function measureDuration(
	fn: () => Promise<void>,
): Promise<number> {
	const start = performance.now();
	await fn();
	const end = performance.now();
	return end - start;
}

/**
 * Measure the duration of a sync function.
 */
export function measureDurationSync(fn: () => void): number {
	const start = performance.now();
	fn();
	const end = performance.now();
	return end - start;
}

/**
 * Evaluate a measurement against a threshold.
 */
export function evaluateMeasurement(
	durationMs: number,
	thresholdMs: number,
): 'pass' | 'warn' | 'fail' {
	if (durationMs <= thresholdMs) return 'pass';
	if (durationMs <= thresholdMs * 2) return 'warn';
	return 'fail';
}

/**
 * Create a performance measurement.
 */
export function createMeasurement(
	operation: string,
	durationMs: number,
	thresholdMs?: number | undefined,
	notes?: string | undefined,
): WorkspacePerformanceMeasurement {
	const threshold = thresholdMs ?? DEFAULT_THRESHOLDS[operation] ?? 10000;
	return {
		durationMs: Math.round(durationMs * 100) / 100,
		notes,
		operation,
		status: evaluateMeasurement(durationMs, threshold),
		thresholdMs: threshold,
	};
}

/**
 * Create a performance baseline report.
 */
export function createBaseline(
	operations: WorkspacePerformanceMeasurement[],
	skipped: Array<{ operation: string; reason: string }> = [],
): WorkspacePerformanceBaseline {
	const worstStatus = operations.reduce<'pass' | 'warn' | 'fail'>((acc, op) => {
		if (op.status === 'fail') return 'fail';
		if (op.status === 'warn' && acc !== 'fail') return 'warn';
		return acc;
	}, 'pass');

	return {
		environmentNote:
			'Results are local and approximate. No telemetry is collected. Variations across machines and loads are expected.',
		measuredAt: new Date().toISOString(),
		nodeVersion: process.version,
		operations,
		skipped,
		status: worstStatus,
	};
}

/**
 * Get the default threshold for an operation.
 */
export function getDefaultThreshold(operation: string): number {
	return DEFAULT_THRESHOLDS[operation] ?? 10000;
}

/** All known baseline operations */
export const BASELINE_OPERATIONS = [
	'profile-loading',
	'state-read',
	'state-write',
	'validation',
	'dependency-graph',
	'staleness',
	'import-planner',
	'scanner-fixture',
	'docs-code-consistency',
	'extraction-fixture',
	'executive-readiness',
	'executive-compile',
] as const;

export type BaselineOperation = (typeof BASELINE_OPERATIONS)[number];
