import { Command, CommanderError } from 'commander';
import { getPackageMetadata } from '../index.js';
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
		.action(() => {
			console.log(`${binaryName} v${version}`);
			console.log('');
			console.log('The TUI shell is the primary entrypoint for LOGOS Engine.');
			console.log('Interactive mode will be implemented in Step 2.2.');
			actionExitCode = EXIT_SUCCESS;
		});

	program
		.command('doctor')
		.description('Run non-mutating local diagnostics')
		.action(async () => {
			actionExitCode = await doctorCommand();
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
