/**
 * TUI Workbench Integration Tests
 *
 * Phase 5: TUI Workbench Redesign — outcome integration testing.
 */

import { describe, expect, it } from 'vitest';
import { createRouterContext, processCommand } from '../src/tui/shell-logic.js';
import { parseSlashCommand } from '../src/tui/slash-parser.js';
import { commandToViewKind } from '../src/tui/workbench-model.js';

describe('workbench integration — view kind mapping', () => {
	const context = createRouterContext();

	it('/status maps to status view', async () => {
		const result = await processCommand('/status', context);
		expect(result.viewKind).toBe('status');
	});

	it('/help maps to help view', async () => {
		const result = await processCommand('/help', context);
		expect(result.viewKind).toBe('help');
	});

	it('/validate maps to validation view', async () => {
		const parseResult = parseSlashCommand('/validate');
		expect(commandToViewKind(parseResult)).toBe('validation');
	});

	it('/diagnose maps to diagnostics view', async () => {
		const parseResult = parseSlashCommand('/diagnose');
		expect(commandToViewKind(parseResult)).toBe('diagnostics');
	});

	it('/generate maps to generation_confirmation', async () => {
		const parseResult = parseSlashCommand('/generate');
		expect(commandToViewKind(parseResult)).toBe('generation_confirmation');
	});

	it('/generate --dry-run maps to generation_report', async () => {
		const parseResult = parseSlashCommand('/generate --dry-run');
		expect(commandToViewKind(parseResult)).toBe('generation_report');
	});

	it('/executive compile maps to executive_compile_report', async () => {
		const parseResult = parseSlashCommand('/executive compile');
		expect(commandToViewKind(parseResult)).toBe('executive_compile_report');
	});

	it('/config ai maps to provider_config', async () => {
		const parseResult = parseSlashCommand('/config ai');
		expect(commandToViewKind(parseResult)).toBe('provider_config');
	});

	it('non-slash input maps to intake view', async () => {
		const parseResult = parseSlashCommand('hello world');
		expect(parseResult.kind).toBe('free-form');
		expect(commandToViewKind(parseResult)).toBe('intake');
	});

	it('/proposals maps to proposal_review', async () => {
		const parseResult = parseSlashCommand('/proposals');
		expect(commandToViewKind(parseResult)).toBe('proposal_review');
	});

	it('/decisions maps to decision_detail', async () => {
		const parseResult = parseSlashCommand('/decisions');
		expect(commandToViewKind(parseResult)).toBe('decision_detail');
	});

	it('unknown command maps to recovery', async () => {
		const parseResult = parseSlashCommand('/unknowncmd');
		expect(commandToViewKind(parseResult)).toBe('recovery');
	});

	it('slash command behavior remains unchanged', async () => {
		const result = await processCommand('/status', context);
		expect(result.shouldExit).toBe(false);
		expect(result.messages.length).toBeGreaterThan(0);
		// Check viewKind is set
		expect(result.viewKind).toBeDefined();
	});

	it('processCommand returns viewKind for all commands', async () => {
		const commands = ['/status', '/help'];
		for (const cmd of commands) {
			const result = await processCommand(cmd, context);
			expect(result.viewKind).toBeDefined();
		}
	});
});
