#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST_CLI = join(process.cwd(), 'dist', 'cli.js');

function run(argv) {
	const result = spawnSync(process.execPath, [DIST_CLI, ...argv], {
		encoding: 'utf-8',
		stdio: ['pipe', 'pipe', 'pipe'],
	});
	return result;
}

function assertOutput(result, argv, expectedSubstrings) {
	const output = (result.stdout ?? '') + (result.stderr ?? '');
	for (const sub of expectedSubstrings) {
		if (!output.includes(sub)) {
			console.error(
				`Smoke failed: Expected output of "node dist/cli.js ${argv.join(' ')}" to include "${sub}"`,
			);
			console.error('--- stdout ---');
			console.error(result.stdout ?? '(empty)');
			console.error('--- stderr ---');
			console.error(result.stderr ?? '(empty)');
			console.error('--- exit code ---');
			console.error(result.status ?? result.signal ?? 'unknown');
			process.exit(1);
		}
	}
	if (result.status !== 0) {
		console.error(
			`Smoke failed: "node dist/cli.js ${argv.join(' ')}" exited with code ${result.status ?? result.signal ?? 'unknown'}`,
		);
		process.exit(1);
	}
}

function main() {
	if (!existsSync(DIST_CLI)) {
		console.error(
			`Smoke failed: ${DIST_CLI} does not exist. Run "pnpm build" first.`,
		);
		process.exit(1);
	}

	// --help
	const helpResult = run(['--help']);
	assertOutput(helpResult, ['--help'], ['logos', 'Usage', 'doctor']);

	// --version
	const versionResult = run(['--version']);
	assertOutput(versionResult, ['--version'], ['0.1.0']);

	// doctor
	const doctorResult = run(['doctor']);
	assertOutput(
		doctorResult,
		['doctor'],
		['Project root:', 'Initialization state:'],
	);

	// doctor --json
	const doctorJsonResult = run(['doctor', '--json']);
	assertOutput(
		doctorJsonResult,
		['doctor', '--json'],
		['"status"', '"command"'],
	);
	// Validate it is parseable JSON
	try {
		const parsed = JSON.parse(doctorJsonResult.stdout);
		if (!parsed || typeof parsed !== 'object') {
			throw new Error('Parsed JSON is not an object');
		}
	} catch (_e) {
		console.error('Smoke failed: doctor --json did not emit valid JSON');
		console.error('--- stdout ---');
		console.error(doctorJsonResult.stdout ?? '(empty)');
		process.exit(1);
	}

	// doctor --dry-run
	const doctorDryResult = run(['doctor', '--dry-run']);
	assertOutput(doctorDryResult, ['doctor', '--dry-run'], ['dry-run']);

	console.log('Smoke passed: CLI bootstrap verified.');
	process.exit(0);
}

main();
