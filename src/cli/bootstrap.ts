import { Command, CommanderError } from 'commander';
import { getPackageMetadata } from '../index.js';
import { startTui } from '../tui/index.js';
import { doctorCommand } from './commands.js';
import {
	EXIT_STARTUP_FAILURE,
	EXIT_SUCCESS,
	EXIT_USAGE_ERROR,
} from './exit-codes.js';

const { binaryName, version } = getPackageMetadata();

export async function bootstrap(argv: string[]): Promise<number> {
	const program = new Command(binaryName);
	program.exitOverride();

	let actionExitCode = EXIT_SUCCESS;

	program
		.description(
			'Local-first TUI engine for AI-structured documentation and intent clarification',
		)
		.version(version, '-v, --version', 'Show version number')
		.helpOption('-h, --help', 'Display help for command')
		.action(async () => {
			if (process.stdin.isTTY) {
				await startTui();
			} else {
				console.log(`${binaryName} v${version}`);
				console.log('');
				console.log(
					'The TUI shell is the primary entrypoint for LOGOS Engine.',
				);
				console.log(
					'Run this command in an interactive terminal to start the TUI.',
				);
			}
			actionExitCode = EXIT_SUCCESS;
		});

	program
		.command('doctor')
		.description('Run non-mutating local diagnostics')
		.option('--json', 'Emit structured JSON output to stdout')
		.option(
			'--dry-run',
			'Show diagnostics without making any changes (default for doctor)',
		)
		.action(async (options) => {
			actionExitCode = await doctorCommand({
				dryRun: options.dryRun ?? false,
				json: options.json ?? false,
			});
		});

	try {
		await program.parseAsync(argv);
		return actionExitCode;
	} catch (err) {
		if (err instanceof CommanderError) {
			if (err.code === 'commander.help' || err.code === 'commander.version') {
				return EXIT_SUCCESS;
			}
			return err.exitCode ?? EXIT_USAGE_ERROR;
		}
		process.stderr.write(`Unexpected error: ${String(err)}\n`);
		return EXIT_STARTUP_FAILURE;
	}
}
