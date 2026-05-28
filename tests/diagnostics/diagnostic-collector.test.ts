/**
 * Unit tests for `DiagnosticCollector` — accumulation of diagnostics
 * during state engine operations and enrichment with recovery actions.
 *
 * Tests both the collector in isolation and integrated with the
 * actual `dispatch` function from the state engine.
 */
import { describe, expect, it } from 'vitest';

import type { RuntimeDiagnostic } from '../../src/contracts/index.js';
import {
	DiagnosticCollector,
	type DiagnosticReport,
} from '../../src/diagnostics/index.js';
import { LogosError, type NodeId } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ─── Isolated collector tests ───────────────────────────────────────────────

describe('DiagnosticCollector (isolated)', () => {
	it('starts with zero diagnostics', () => {
		const collector = new DiagnosticCollector();
		expect(collector.count).toBe(0);
		expect(collector.hasErrors()).toBe(false);
		expect(collector.hasWarnings()).toBe(false);
	});

	it('adds a single diagnostic and enriches it on ingestion', () => {
		const collector = new DiagnosticCollector();
		collector.add({
			code: 'TEST_01',
			message: 'test',
			severity: 'warning',
		});
		expect(collector.count).toBe(1);
		expect(collector.hasWarnings()).toBe(true);

		const reports = collector.getReports();
		expect(reports).toHaveLength(1);
		const report = reports[0];
		expect(report.code).toBe('TEST_01');
		expect(report.severity).toBe('warning');
		expect(report.recoveryActions).toEqual([]); // unknown code
		expect(report.recoverable).toBe(false);
		expect(report.timestamp).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
		);
	});

	it('adds a diagnostic with error severity', () => {
		const collector = new DiagnosticCollector();
		collector.add({ code: 'TEST_ERR', message: 'fail', severity: 'error' });
		expect(collector.hasErrors()).toBe(true);
	});

	it('adds multiple diagnostics at once', () => {
		const collector = new DiagnosticCollector();
		collector.addMany([
			{ code: 'A', message: 'a', severity: 'info' },
			{ code: 'B', message: 'b', severity: 'warning' },
			{ code: 'C', message: 'c', severity: 'error' },
		]);
		expect(collector.count).toBe(3);
		expect(collector.hasErrors()).toBe(true);
		expect(collector.hasWarnings()).toBe(true);
	});

	it('clears all diagnostics', () => {
		const collector = new DiagnosticCollector();
		collector.add({ code: 'X', message: 'x', severity: 'error' });
		expect(collector.count).toBe(1);
		collector.clear();
		expect(collector.count).toBe(0);
	});

	it('getAll returns a shallow copy of down-converted RuntimeDiagnostic[]', () => {
		const collector = new DiagnosticCollector();
		collector.add({
			code: 'ORIG',
			message: 'original',
			severity: 'info',
		});
		const copy = collector.getAll();
		expect(copy).toHaveLength(1);
		expect(copy[0].code).toBe('ORIG');
		// Different array references on successive calls
		expect(copy).not.toBe(collector.getAll());
	});

	it('toRuntimeDiagnostics returns contract-compatible array', () => {
		const collector = new DiagnosticCollector();
		collector.add({
			code: 'RT',
			message: 'runtime',
			severity: 'warning',
		});
		const diags: RuntimeDiagnostic[] = collector.toRuntimeDiagnostics();
		expect(diags).toHaveLength(1);
		expect(diags[0].code).toBe('RT');
		expect(diags[0].message).toBe('runtime');
		expect(diags[0].severity).toBe('warning');
		// Should not leak DiagnosticReport fields
		expect((diags[0] as Record<string, unknown>).recoveryActions).toBeUndefined();
	});

	it('getReports enriches diagnostics with recovery actions', () => {
		const collector = new DiagnosticCollector();
		collector.add({
			code: 'LOGOS_DISPATCH_NO_PROFILE',
			message: 'No profile selected',
			severity: 'error',
		});

		const reports = collector.getReports();
		expect(reports).toHaveLength(1);
		const report = reports[0];
		expect(report.code).toBe('LOGOS_DISPATCH_NO_PROFILE');
		expect(report.severity).toBe('error');
		expect(report.recoveryActions).toEqual(['open_settings']);
		expect(report.recoverable).toBe(true);
		expect(report.timestamp).toBeTruthy();
	});

	it('getReports includes sourceId when present', () => {
		const collector = new DiagnosticCollector();
		collector.add({
			code: 'LOGOS_STATE_UNRESOLVED_BLOCKERS',
			message: 'Node has blockers',
			severity: 'warning',
			sourceId: 'node-b',
		});

		const reports = collector.getReports();
		expect(reports[0].sourceId).toBe('node-b');
	});

	it('getReports produces empty recovery actions for unknown codes', () => {
		const collector = new DiagnosticCollector();
		collector.add({
			code: 'SOME_RANDOM_CODE',
			message: 'unknown',
			severity: 'info',
		});

		const reports = collector.getReports();
		expect(reports[0].recoveryActions).toEqual([]);
		expect(reports[0].recoverable).toBe(false);
	});

	// ── addError preserves category, recoverable, details ────────────────

	it('addError preserves category in the report', () => {
		const collector = new DiagnosticCollector();
		const err = new LogosError(
			'LOGOS_PROFILE_SCHEMA_INVALID',
			'profile_schema',
			'Profile schema is invalid',
			{ userFacingMessage: 'The profile file is malformed. Check the schema.' },
		);
		collector.addError(err);

		const reports = collector.getReports();
		expect(reports).toHaveLength(1);
		expect(reports[0].category).toBe('profile_schema');
	});

	it('addError preserves recoverable flag in the report', () => {
		const collector = new DiagnosticCollector();
		const recoverableErr = new LogosError(
			'LOGOS_LLM_TIMEOUT',
			'llm_provider',
			'timeout',
			{ recoverable: true },
		);
		collector.addError(recoverableErr);

		const reports = collector.getReports();
		expect(reports[0].recoverable).toBe(true);
	});

	it('addError marks recoverable=true when recovery actions exist', () => {
		const collector = new DiagnosticCollector();
		// Even a non-recoverable error gets recoverable=true if actions exist
		const err = new LogosError(
			'LOGOS_STATE_INVALID_LIFECYCLE_TRANSITION',
			'invalid_state',
			'bad transition',
			{ recoverable: false },
		);
		collector.addError(err);

		const reports = collector.getReports();
		// Code has retry + clear_invalid_active_node → recoverable should be true
		expect(reports[0].recoverable).toBe(true);
		expect(reports[0].recoveryActions).toContain('retry');
	});

	it('addError preserves details in the report', () => {
		const collector = new DiagnosticCollector();
		const err = new LogosError(
			'LOGOS_PERSISTENCE_WRITE_FAILED',
			'persistence',
			'write failed',
			{
				details: { path: '/tmp/snap.json', errno: 28 },
			},
		);
		collector.addError(err);

		const reports = collector.getReports();
		expect(reports[0].details).toEqual({ path: '/tmp/snap.json', errno: 28 });
	});

	it('addError uses userFacingMessage over message', () => {
		const collector = new DiagnosticCollector();
		const err = new LogosError(
			'LOGOS_LLM_RATE_LIMITED',
			'llm_provider',
			'rate limited (internal)',
			{ userFacingMessage: 'Too many requests. Please wait a moment.' },
		);
		collector.addError(err);

		const reports = collector.getReports();
		expect(reports[0].message).toBe(
			'Too many requests. Please wait a moment.',
		);
	});

	it('addError resolves recovery actions from code + category', () => {
		const collector = new DiagnosticCollector();
		const err = new LogosError(
			'LOGOS_PROFILE_SCHEMA_INVALID',
			'profile_schema',
			'invalid schema',
		);
		collector.addError(err);

		const reports = collector.getReports();
		expect(reports[0].recoveryActions).toEqual(['open_settings']);
	});

	it('addError with custom severity and sourceId', () => {
		const collector = new DiagnosticCollector();
		const err = new LogosError('LOGOS_LLM_TIMEOUT', 'llm_provider', 'timeout', {
			recoverable: true,
		});
		collector.addError(err, 'warning', 'node-1');

		const report = collector.getReports()[0];
		expect(report.severity).toBe('warning');
		expect(report.sourceId).toBe('node-1');
	});
});

// ─── Integration with state engine dispatch ─────────────────────────────────

describe('DiagnosticCollector with state engine dispatch', () => {
	it('collects diagnostics from a failed dispatch (no profile selected)', () => {
		const state = createSession();
		const collector = new DiagnosticCollector();

		const result = dispatch(state, {
			type: 'SELECT_NODE',
			nodeId: 'nonexistent' as NodeId,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			collector.addMany(result.diagnostics);
		}

		expect(collector.count).toBeGreaterThanOrEqual(1);
		expect(collector.hasErrors()).toBe(true);

		// Verify that the collector enriches with recovery actions
		const reports = collector.getReports();
		expect(reports.length).toBeGreaterThanOrEqual(1);

		// The diagnostics should include LOGOS_DISPATCH_NO_PROFILE
		const noProfileReport = reports.find(
			(r) => r.code === 'LOGOS_DISPATCH_NO_PROFILE',
		);
		expect(noProfileReport).toBeDefined();
		expect(noProfileReport!.recoveryActions).toContain('open_settings');
	});

	it('all reports have required enrichment fields', () => {
		const state = createSession();
		const collector = new DiagnosticCollector();

		const result = dispatch(state, {
			type: 'SELECT_NODE',
			nodeId: 'nonexistent' as NodeId,
		});

		if (!result.ok) {
			collector.addMany(result.diagnostics);
		}

		const reports = collector.getReports();
		expect(reports.length).toBeGreaterThanOrEqual(1);

		for (const report of reports) {
			expect(Array.isArray(report.recoveryActions)).toBe(true);
			expect(typeof report.recoverable).toBe('boolean');
			expect(typeof report.timestamp).toBe('string');
			expect(typeof report.code).toBe('string');
			expect(typeof report.message).toBe('string');
			expect(
				['info', 'warning', 'error'].includes(report.severity),
			).toBe(true);
		}
	});

	it('accumulates diagnostics across multiple failed dispatches', () => {
		const state = createSession();
		const collector = new DiagnosticCollector();

		// First failure
		const result1 = dispatch(state, {
			type: 'SELECT_NODE',
			nodeId: 'node-x' as NodeId,
		});
		if (!result1.ok) collector.addMany(result1.diagnostics);

		// Second failure (same state, different event)
		const result2 = dispatch(state, {
			type: 'USER_MESSAGE',
			nodeId: 'node-y' as NodeId,
			content: 'Hello',
		});
		if (!result2.ok) collector.addMany(result2.diagnostics);

		// Should have accumulated diagnostics from both failures
		expect(collector.count).toBeGreaterThanOrEqual(2);
		expect(collector.hasErrors()).toBe(true);

		const reports = collector.getReports();
		expect(reports.length).toBeGreaterThanOrEqual(2);
	});

	it('clear resets the collector between operations', () => {
		const state = createSession();
		const collector = new DiagnosticCollector();

		const result = dispatch(state, {
			type: 'SELECT_NODE',
			nodeId: 'node-x' as NodeId,
		});
		if (!result.ok) collector.addMany(result.diagnostics);

		expect(collector.count).toBeGreaterThan(0);

		collector.clear();
		expect(collector.count).toBe(0);
		expect(collector.hasErrors()).toBe(false);
	});
});
