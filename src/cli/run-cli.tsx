import { Command, CommanderError } from 'commander';
import { render } from 'ink';
import { LogosTuiApp } from '../tui/LogosTuiApp.js';
import { type ExitCode, exitCodes } from './exit-codes.js';

export type RunCliOptions = {
	readonly cwd?: string;
	readonly output?: NodeJS.WritableStream;
	readonly errorOutput?: NodeJS.WritableStream;
	readonly launchTui?: () => Promise<void>;
};

export async function runCli(
	argv: readonly string[],
	options: RunCliOptions = {},
): Promise<ExitCode> {
	const program = createCliProgram(options);

	try {
		await program.parseAsync([...argv], { from: 'node' });
		return exitCodes.success;
	} catch (error) {
		if (error instanceof CommanderError) {
			return error.exitCode === 0 ? exitCodes.success : exitCodes.usageError;
		}

		if (error instanceof Error) {
			const errorOutput = options.errorOutput ?? process.stderr;
			errorOutput.write(`LOGOS CLI error: ${error.message}\n`);
		}

		return exitCodes.unexpectedError;
	}
}

export function createCliProgram(options: RunCliOptions = {}): Command {
	const program = new Command();
	const output = options.output ?? process.stdout;
	const errorOutput = options.errorOutput ?? process.stderr;

	program
		.name('logos')
		.description(
			'Open the LOGOS Engine TUI for AI-structured documentation workflows.',
		)
		.version('0.1.0')
		.exitOverride()
		.configureOutput({
			writeErr: (text) => errorOutput.write(text),
			writeOut: (text) => output.write(text),
		})
		.showHelpAfterError();

	program.action(async () => {
		if (options.launchTui) {
			await options.launchTui();
			return;
		}

		const instance = render(<LogosTuiApp cwd={options.cwd ?? process.cwd()} />);
		await instance.waitUntilExit();
	});

	return program;
}
