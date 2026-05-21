/**
 * Performance — deterministic local performance baseline module.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 */
export type {
	BaselineOperation,
	WorkspacePerformanceBaseline,
	WorkspacePerformanceMeasurement,
	WorkspacePerformanceResult,
} from './performance-baseline.js';
export {
	BASELINE_OPERATIONS,
	createBaseline,
	createMeasurement,
	evaluateMeasurement,
	getDefaultThreshold,
	measureDuration,
	measureDurationSync,
} from './performance-baseline.js';
