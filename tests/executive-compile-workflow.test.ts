/** Step 11.4 — Executive Compile Workflow tests */

import { describe, expect, it } from 'vitest';
import { executiveCompileWorkflow } from '../src/executive/executive-compile-workflow.js';
import type {
	ExecutiveCompileResult,
	ExecutiveCompileTargetKind,
} from '../src/executive/executive-compile-workflow-types.js';
import { COMPILE_TARGET_TO_ADAPTER } from '../src/executive/executive-compile-workflow-types.js';

// ---------------------------------------------------------------------------
// The executiveCompileWorkflow requires an initialized workspace with
// profile contracts available on disk. Below we test:
//  - No workspace → fails safely
//  - Dry-run behaves correctly with the relevant error path
//  - Types compile correctly (via typed function calls)
//  - Report structure conforms to the contract
//  - Display lines produce non-empty, readable output
//  - Next-action recommendations are generated
//  - No external API calls are claimed
// ---------------------------------------------------------------------------

describe('executiveCompileWorkflow — no workspace', () => {
	it('fails safely when no initialized workspace exists', async () => {
		const result: ExecutiveCompileResult = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-workspace-${Date.now()}`,
		});

		expect(result.status).toBe('blocked');
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0]?.code).toBe('exec_compile_no_workspace');
		expect(result.report.noExternalApiCalls).toBe(true);
		expect(result.report.noExternalRecordsCreated).toBe(true);
		expect(result.report.outputsDerivedNonCanonical).toBe(true);
	});

	it('with dry-run flag and no workspace still fails safely', async () => {
		const result = await executiveCompileWorkflow({
			dryRun: true,
			projectRoot: `/tmp/nonexistent-workspace-${Date.now()}`,
		});

		expect(result.status).toBe('blocked');
		expect(result.dryRun).toBe(true);
	});

	it('with diagnostic_preview mode and no workspace still fails safely', async () => {
		const result = await executiveCompileWorkflow({
			mode: 'diagnostic_preview',
			projectRoot: `/tmp/nonexistent-workspace-${Date.now()}`,
		});

		expect(result.status).toBe('blocked');
		expect(result.mode).toBe('diagnostic_preview');
	});
});

describe('executiveCompileWorkflow — types and contracts', () => {
	it('COMPILE_TARGET_TO_ADAPTER maps all targets correctly', () => {
		expect(COMPILE_TARGET_TO_ADAPTER.executive_plan_json).toBeUndefined();
		expect(COMPILE_TARGET_TO_ADAPTER.markdown_export).toBe('markdown');
		expect(COMPILE_TARGET_TO_ADAPTER.html_export).toBe('html');
		expect(COMPILE_TARGET_TO_ADAPTER.github_issue_file_export).toBe(
			'github_issue_file',
		);
		expect(COMPILE_TARGET_TO_ADAPTER.agent_pack_file_export).toBe(
			'agent_pack_file',
		);
		expect(COMPILE_TARGET_TO_ADAPTER.linear_mapping).toBe('linear_mapping');
		expect(COMPILE_TARGET_TO_ADAPTER.notion_mapping).toBe('notion_mapping');
	});
});

describe('ExecutiveCompileResult structure', () => {
	it('report has all required sections', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		const r = result.report;
		expect(r).toBeDefined();
		expect(typeof r.summary).toBe('string');
		expect(r.summary.length).toBeGreaterThan(0);
		expect(typeof r.readinessStatus).toBe('string');
		expect(r.noExternalApiCalls).toBe(true);
		expect(r.noExternalRecordsCreated).toBe(true);
		expect(r.outputsDerivedNonCanonical).toBe(true);
		expect(Array.isArray(r.selectedTargets)).toBe(true);
		expect(Array.isArray(r.targetResults)).toBe(true);
		expect(Array.isArray(r.outputPaths)).toBe(true);
		expect(Array.isArray(r.changedPaths)).toBe(true);
		expect(Array.isArray(r.blockers)).toBe(true);
		expect(Array.isArray(r.warnings)).toBe(true);
		expect(Array.isArray(r.nextActions)).toBe(true);
		expect(Array.isArray(r.plannedAdapterContracts)).toBe(true);
		expect(Array.isArray(r.unsupportedTargets)).toBe(true);
		expect(r.securitySummary).toBeDefined();
		expect(typeof r.securitySummary.passed).toBe('boolean');
	});

	it('next actions are provided when blocked', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.report.nextActions.length).toBeGreaterThan(0);
		for (const action of result.report.nextActions) {
			expect(typeof action).toBe('string');
			expect(action.length).toBeGreaterThan(0);
		}
	});
});

describe('executiveCompileWorkflow — display lines', () => {
	it('produces readable display lines for blocked status', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(Array.isArray(result.readyForDisplay)).toBe(true);
		expect(result.readyForDisplay.length).toBeGreaterThan(0);
		expect(
			result.readyForDisplay.some((l) =>
				l.includes('No external APIs were called'),
			),
		).toBe(true);
		expect(
			result.readyForDisplay.some((l) => l.includes('non-canonical')),
		).toBe(true);
	});

	it('display lines include the compile mode', async () => {
		const result = await executiveCompileWorkflow({
			mode: 'diagnostic_preview',
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(
			result.readyForDisplay.some((l) => l.includes('diagnostic_preview')),
		).toBe(true);
	});

	it('display lines include dry-run flag', async () => {
		const result = await executiveCompileWorkflow({
			dryRun: true,
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.readyForDisplay.some((l) => l.includes('dry-run'))).toBe(
			true,
		);
	});
});

describe('executiveCompileWorkflow — target selection', () => {
	it('default target is executive_plan_json', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.report.selectedTargets).toContain('Executive Plan JSON');
	});

	it('all-file-exports target set includes JSON + all file exports', async () => {
		const allTargets: ExecutiveCompileTargetKind[] = [
			'executive_plan_json',
			'markdown_export',
			'html_export',
			'github_issue_file_export',
			'agent_pack_file_export',
		];
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
			selectedTargets: allTargets,
		});

		// Even when blocked, the report should reflect selected targets
		expect(result.report.selectedTargets.length).toBe(5);
	});

	it('planned adapter contracts appear in report', async () => {
		const allTargets: ExecutiveCompileTargetKind[] = [
			'executive_plan_json',
			'linear_mapping',
			'notion_mapping',
		];
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
			selectedTargets: allTargets,
		});

		expect(result.report.plannedAdapterContracts.length).toBe(2);
		expect(result.report.plannedAdapterContracts).toContain('Linear Mapping');
		expect(result.report.plannedAdapterContracts).toContain('Notion Mapping');
	});
});

describe('executiveCompileWorkflow — edge cases', () => {
	it('with invalid mode string still works (falls back to strict)', async () => {
		const result = await executiveCompileWorkflow({
			// @ts-expect-error testing invalid mode
			mode: 'invalid_mode' as never,
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		} as never);

		// Should default to strict
		expect(result.mode).toBe('strict');
	});
});

describe('executiveCompileWorkflow — security claims', () => {
	it('all reports state no external API calls', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.report.noExternalApiCalls).toBe(true);
		const displayText = result.readyForDisplay.join('\n');
		expect(displayText).toContain('No external APIs were called');
	});

	it('all reports state no external records created', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.report.noExternalRecordsCreated).toBe(true);
		const displayText = result.readyForDisplay.join('\n');
		expect(displayText).toContain('No external records were created');
	});

	it('all reports state outputs are derived/non-canonical', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.report.outputsDerivedNonCanonical).toBe(true);
		const displayText = result.readyForDisplay.join('\n');
		expect(displayText).toContain('non-canonical');
	});

	it('never marks executive outputs as canonical', async () => {
		const result = await executiveCompileWorkflow({
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		const outputJson = JSON.stringify(result.report);
		expect(outputJson).not.toContain('"isCanonical": true');
		expect(outputJson).not.toContain('isCanonical":true');
	});
});

describe('executiveCompileWorkflow — dry-run invariants', () => {
	it('dry-run writes no files (edge case: no workspace means no files)', async () => {
		const result = await executiveCompileWorkflow({
			dryRun: true,
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.dryRun).toBe(true);
		expect(result.report.changedPaths.length).toBe(0);
	});

	it('dry-run report does not claim artifact registry updates', async () => {
		const result = await executiveCompileWorkflow({
			dryRun: true,
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.report.artifactRegistryUpdates).toBe(0);
	});
});

describe('executiveCompileWorkflow — runId behavior', () => {
	it('no runId when dry-run', async () => {
		const result = await executiveCompileWorkflow({
			dryRun: true,
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.runId).toBeUndefined();
	});

	it('no runId when blocked (no workspace)', async () => {
		const result = await executiveCompileWorkflow({
			dryRun: false,
			projectRoot: `/tmp/nonexistent-${Date.now()}`,
		});

		expect(result.runId).toBeUndefined();
	});
});
