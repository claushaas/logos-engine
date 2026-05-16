import { describe, expect, it } from 'vitest';
import { bootstrap } from '../src/cli/bootstrap.js';
import { PACKAGE_VERSION } from '../src/index.js';

function captureOutput() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const originalStdoutWrite = process.stdout.write.bind(process.stdout);
	const originalStderrWrite = process.stderr.write.bind(process.stderr);
	const originalLog = console.log;
	const originalError = console.error;

	process.stdout.write = ((chunk: string | Uint8Array, ..._args: unknown[]) => {
		stdout.push(
			typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(),
		);
		return true;
	}) as typeof process.stdout.write;

	process.stderr.write = ((chunk: string | Uint8Array, ..._args: unknown[]) => {
		stderr.push(
			typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(),
		);
		return true;
	}) as typeof process.stderr.write;

	console.log = (...args: unknown[]) => {
		stdout.push(`${args.map(String).join(' ')}\n`);
	};
	console.error = (...args: unknown[]) => {
		stderr.push(`${args.map(String).join(' ')}\n`);
	};

	return {
		restore: () => {
			process.stdout.write = originalStdoutWrite;
			process.stderr.write = originalStderrWrite;
			console.log = originalLog;
			console.error = originalError;
		},
		stderr,
		stdout,
	};
}

describe('CLI bootstrap', () => {
	it('logos with no args returns 0 and prints TUI placeholder', async () => {
		const { stdout, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js']);
		restore();
		expect(code).toBe(0);
		const output = stdout.join('\n');
		expect(output).toContain('logos');
		expect(output).toContain('TUI');
		expect(output).toContain('interactive terminal');
	});

	it('logos --help returns 0 and prints help with doctor command', async () => {
		const { stdout, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', '--help']);
		restore();
		expect(code).toBe(0);
		const output = stdout.join('\n');
		expect(output).toContain('logos');
		expect(output).toContain('doctor');
		expect(output).not.toContain('init');
		expect(output).not.toContain('generate');
		expect(output).not.toContain('validate');
		expect(output).not.toContain('diagnose');
		expect(output).not.toContain('status');
		expect(output).not.toContain('config');
		expect(output).not.toContain('continue');
	});

	it('logos -h returns 0', async () => {
		const { restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', '-h']);
		restore();
		expect(code).toBe(0);
	});

	it('logos --version returns 0 and prints package version', async () => {
		const { stdout, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', '--version']);
		restore();
		expect(code).toBe(0);
		const output = stdout.join('').trim();
		expect(output).toBe(PACKAGE_VERSION);
	});

	it('logos -v returns 0 and prints package version', async () => {
		const { stdout, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', '-v']);
		restore();
		expect(code).toBe(0);
		const output = stdout.join('').trim();
		expect(output).toBe(PACKAGE_VERSION);
	});

	it('logos doctor returns 0 without initialized workspace', async () => {
		const { stdout, stderr, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', 'doctor']);
		restore();
		expect(code).toBe(0);
		const output = stdout.join('\n');
		expect(output).toContain('Node.js:');
		expect(output).toContain('Package:');
		expect(output).toContain('CWD:');
		expect(output).toContain('Bootstrap: operational');
		expect(output).toContain('Profile:   standard (loaded successfully)');
		expect(stderr.join('\n')).not.toContain('failed');
	});

	it('unknown external command returns non-zero', async () => {
		const { stderr, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', 'unknown-command']);
		restore();
		expect(code).not.toBe(0);
		const output = stderr.join('');
		expect(output).toContain('error:');
	});

	it('unknown option returns non-zero', async () => {
		const { stderr, restore } = captureOutput();
		const code = await bootstrap(['node', 'dist/cli.js', '--unknown']);
		restore();
		expect(code).not.toBe(0);
		const output = stderr.join('\n');
		expect(output).toContain('unknown');
		expect(output).toContain('option');
	});
});
