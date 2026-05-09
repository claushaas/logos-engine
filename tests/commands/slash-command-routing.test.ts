import { describe, expect, it } from 'vitest';
import {
	createLogosApplicationServices,
	getSlashCommandCompletions,
	handleSlashCommand,
	loadCommandContext,
	parseSlashCommand,
	runCli,
	slashCommandDefinitions,
} from '../../src/index.js';

describe('slash command parser and router', () => {
	it('registers the Phase 1 command surface', () => {
		expect(slashCommandDefinitions.map((command) => command.id)).toEqual([
			'/init',
			'/continue',
			'/status',
			'/validate',
			'/diagnose',
			'/generate',
			'/config ai',
			'/help',
			'/exit',
		]);
	});

	it('parses multi-word slash commands with arguments', () => {
		const result = parseSlashCommand('/config ai --show');

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.error.message);
		}

		expect(result.command.definition.id).toBe('/config ai');
		expect(result.command.args).toEqual(['--show']);
	});

	it('routes core commands through handlers and services', async () => {
		const services = createLogosApplicationServices();
		const context = loadCommandContext('/tmp/logos-test');
		const result = parseSlashCommand('/help');

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.error.message);
		}

		const routed = await handleSlashCommand(result.command, context, services);

		expect(routed.title).toBe('LOGOS slash commands');
		expect(routed.exitRequested).toBe(false);
		expect(routed.body.length).toBeGreaterThan(0);
	});

	it('marks /exit as an exit request', async () => {
		const services = createLogosApplicationServices();
		const context = loadCommandContext('/tmp/logos-test');
		const result = parseSlashCommand('/exit');

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.error.message);
		}

		await expect(
			handleSlashCommand(result.command, context, services),
		).resolves.toMatchObject({
			exitRequested: true,
			status: 'ok',
		});
	});

	it('rejects non-slash input with a common command error', () => {
		const result = parseSlashCommand('status');

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error('Expected parse failure.');
		}

		expect(result.error.code).toBe('missing_slash');
	});
});

describe('slash command autocomplete', () => {
	it('suggests commands from a slash prefix', () => {
		expect(
			getSlashCommandCompletions('/con').map((item) => item.insertText),
		).toEqual(['/continue', '/config ai']);
	});

	it('does not suggest question-id subcommands for /continue', () => {
		const completions = getSlashCommandCompletions('/continue ');
		expect(completions.map((item) => item.insertText)).not.toContain(
			'/continue answer',
		);
	});

	it('suggests options for commands that define them', () => {
		expect(
			getSlashCommandCompletions('/generate --r').map(
				(item) => item.insertText,
			),
		).toEqual(['/generate --refresh']);
	});
});

describe('CLI program', () => {
	it('prints readable help without launching the TUI', async () => {
		let output = '';
		const writable = {
			write: (chunk: string) => {
				output += chunk;
				return true;
			},
		} as NodeJS.WritableStream;

		await runCli(['node', 'logos', '--help'], {
			errorOutput: writable,
			output: writable,
		});

		expect(output).toContain('Usage: logos');
		expect(output).toContain('Open the LOGOS Engine TUI');
	});

	it('opens the TUI by default through the launcher boundary', async () => {
		let launched = false;

		const exitCode = await runCli(['node', 'logos'], {
			launchTui: async () => {
				launched = true;
			},
		});

		expect(exitCode).toBe(0);
		expect(launched).toBe(true);
	});
});
