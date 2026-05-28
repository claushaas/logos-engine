/**
 * Tests for Step 18.3 — DiagnosticsPanel component.
 *
 * Uses ink-testing-library for render output assertions.
 * Tests cover: error grouping by severity, warning grouping,
 * info grouping, affected source display, recovery action
 * derivation, and empty state.
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { RuntimeDiagnostic } from '../../src/contracts/index.js';
import { DiagnosticsPanel } from '../../src/tui/components/DiagnosticsPanel.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const BASE_INPUT = { enabled: false };
const BASE_ACTION_BAR = { actions: [] };

function renderPanel(diagnostics: RuntimeDiagnostic[]) {
	const { lastFrame } = render(
		<DiagnosticsPanel
			actionBar={BASE_ACTION_BAR}
			diagnostics={diagnostics}
			focusedActionIndex={-1}
			focusedRegion={null}
			input={BASE_INPUT}
		/>,
	);
	return lastFrame() ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('DiagnosticsPanel', () => {
	// ── Empty state ─────────────────────────────────────────────────────

	it('shows empty state when no diagnostics are present', () => {
		const output = renderPanel([]);
		expect(output).toContain('No diagnostics reported');
		expect(output).toContain('Diagnostics');
	});

	// ── Error grouping ──────────────────────────────────────────────────

	it('groups errors under an Errors header', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_STATE_NO_PROFILE_SELECTED',
				message: 'No profile',
				severity: 'error',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Errors');
		expect(output).toContain('LOGOS_STATE_NO_PROFILE_SELECTED');
		expect(output).toContain('No profile');
	});

	// ── Warning grouping ────────────────────────────────────────────────

	it('groups warnings under a Warnings header', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_STALE_CASCADE',
				message: 'Stale nodes detected',
				severity: 'warning',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Warnings');
		expect(output).toContain('LOGOS_STALE_CASCADE');
		expect(output).toContain('Stale nodes detected');
	});

	// ── Info grouping ───────────────────────────────────────────────────

	it('groups info entries under an Info header', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_RESUME_MIGRATION_APPLIED',
				message: 'Migration applied',
				severity: 'info',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Info');
		expect(output).toContain('LOGOS_RESUME_MIGRATION_APPLIED');
		expect(output).toContain('Migration applied');
	});

	// ── Multiple severity groups ────────────────────────────────────────

	it('renders all severity groups present', () => {
		const diags: RuntimeDiagnostic[] = [
			{ code: 'ERR_1', message: 'Error message', severity: 'error' },
			{ code: 'WARN_1', message: 'Warning message', severity: 'warning' },
			{ code: 'INFO_1', message: 'Info message', severity: 'info' },
		];
		const output = renderPanel(diags);
		expect(output).toContain('Errors');
		expect(output).toContain('Warnings');
		expect(output).toContain('Info');
		expect(output).toContain('Error message');
		expect(output).toContain('Warning message');
		expect(output).toContain('Info message');
	});

	// ── Affected source display ─────────────────────────────────────────

	it('shows affected node/document when sourceId is present', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_STALE_CASCADE',
				message: 'Cascade triggered',
				severity: 'warning',
				sourceId: 'node-123',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Affected: node-123');
	});

	it('does not show affected line when sourceId is absent', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_STALE_CASCADE',
				message: 'Cascade triggered',
				severity: 'warning',
			},
		];
		const output = renderPanel(diags);
		expect(output).not.toContain('Affected:');
	});

	// ── Recovery actions ────────────────────────────────────────────────

	it('shows recovery actions for known error codes', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_LLM_TIMEOUT',
				message: 'LLM request timed out',
				severity: 'error',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Recovery:');
		// LOGOS_LLM_TIMEOUT maps to ['retry', 'open_settings']
		expect(output).toContain('Retry');
		expect(output).toContain('Open settings');
	});

	it('shows recovery actions for invalid state errors', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_STATE_NO_PROFILE_SELECTED',
				message: 'No profile selected',
				severity: 'error',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Recovery:');
		expect(output).toContain('Open settings');
	});

	it('does not show recovery section when no actions are available', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'UNKNOWN_CODE_XYZ',
				message: 'Unknown issue',
				severity: 'error',
			},
		];
		const output = renderPanel(diags);
		expect(output).not.toContain('Recovery:');
	});

	// ── Category display ────────────────────────────────────────────────

	it('shows inferred category for known code patterns', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'LOGOS_LLM_UNAVAILABLE',
				message: 'Provider unavailable',
				severity: 'error',
			},
		];
		const output = renderPanel(diags);
		expect(output).toContain('Category:');
		expect(output).toContain('llm_provider');
	});

	it('does not show category when code has no known pattern', () => {
		const diags: RuntimeDiagnostic[] = [
			{
				code: 'UNKNOWN_CODE_XYZ',
				message: 'Unknown issue',
				severity: 'error',
			},
		];
		const output = renderPanel(diags);
		expect(output).not.toContain('Category:');
	});

	// ── Total count ─────────────────────────────────────────────────────

	it('shows total diagnostic count in header', () => {
		const diags: RuntimeDiagnostic[] = [
			{ code: 'A', message: 'First', severity: 'error' },
			{ code: 'B', message: 'Second', severity: 'warning' },
			{ code: 'C', message: 'Third', severity: 'info' },
		];
		const output = renderPanel(diags);
		expect(output).toContain('(3 total)');
	});

	// ── Dismiss hint ────────────────────────────────────────────────────

	it('shows dismiss hint', () => {
		const diags: RuntimeDiagnostic[] = [
			{ code: 'X', message: 'Something', severity: 'error' },
		];
		const output = renderPanel(diags);
		expect(output).toContain('Press Escape or Ctrl+D to close');
	});

	// ── Count badge per group ───────────────────────────────────────────

	it('shows count badge per severity group', () => {
		const diags: RuntimeDiagnostic[] = [
			{ code: 'E1', message: 'Err 1', severity: 'error' },
			{ code: 'E2', message: 'Err 2', severity: 'error' },
			{ code: 'W1', message: 'Warn 1', severity: 'warning' },
		];
		const output = renderPanel(diags);

		// Errors group should show (2), Warnings group should show (1)
		// The count badge is rendered as " (N)" adjacent to the severity header
		expect(output).toMatch(/─── Errors\s+\(2\)/);
		expect(output).toMatch(/─── Warnings\s+\(1\)/);
	});
});
