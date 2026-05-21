#!/usr/bin/env node

/**
 * Release Candidate Package Smoke Script
 *
 * Step 13.4 — Package and Release Candidate Smoke
 *
 * Non-interactive, deterministic, provider-free, network-free smoke
 * validation for the release candidate package.
 *
 * Does NOT publish, upload, or require credentials.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ---------------------------------------------------------------------------
// Load package.json
// ---------------------------------------------------------------------------

let pkg;
try {
	pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
} catch {
	console.error('ERROR: Cannot read package.json. Is this the project root?');
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Build file existence map
// ---------------------------------------------------------------------------

function buildFileExists() {
	const files = {};

	// dist files
	const distExpected = ['dist/cli.js', 'dist/index.js', 'dist/index.d.ts'];
	for (const f of distExpected) {
		files[f] = existsSync(join(root, f));
	}

	// profile files
	const profileFiles = [
		'profiles/standard/docs.yml',
		'profiles/standard/document.schema.yml',
		'profiles/standard/README.md',
		'profiles/standard/phases',
		'profiles/standard/executive',
	];
	for (const f of profileFiles) {
		files[f] = existsSync(join(root, f));
	}

	// Phase directories and YAML files
	const phases = [
		'01-foundation',
		'02-validation',
		'03-product',
		'04-engineering',
		'05-go-to-market',
		'06-operations',
	];
	for (const phase of phases) {
		const dir = `profiles/standard/phases/${phase}`;
		files[dir] = existsSync(join(root, dir));
		files[`profiles/standard/phases/${phase}.yml`] = existsSync(
			join(root, `profiles/standard/phases/${phase}.yml`),
		);
	}

	// Binary
	const binPath = pkg.bin?.logos ? pkg.bin.logos : '';
	if (binPath) {
		files[binPath] = existsSync(join(root, binPath));
	}

	return files;
}

// ---------------------------------------------------------------------------
// Simulate package files (from "files" field + defaults)
// ---------------------------------------------------------------------------

function simulatePackageFiles() {
	const filesField = pkg.files ?? [];
	const result = [...filesField, 'package.json', 'README.md', 'LICENSE'];

	// npm/pnpm always include these if present
	if (existsSync(join(root, 'SECURITY.md'))) {
		result.push('SECURITY.md');
	}

	return result;
}

// ---------------------------------------------------------------------------
// Run CLI command smoke
// ---------------------------------------------------------------------------

const DIST_CLI = join(root, 'dist', 'cli.js');

function runCliSmoke(argv) {
	if (!existsSync(DIST_CLI)) {
		return {
			args: argv,
			command: 'logos',
			diagnostics: [],
			error: 'dist/cli.js not found. Run "pnpm build" first.',
			exitCode: 1,
			isJsonOutput: false,
			passed: false,
			redactedOutput: '',
			signal: null,
			stderr: '',
			stdout: '',
		};
	}

	const result = spawnSync(process.execPath, [DIST_CLI, ...argv], {
		encoding: 'utf-8',
		stdio: ['pipe', 'pipe', 'pipe'],
		timeout: 30_000,
	});

	const stdout = (result.stdout ?? '').trim();
	const stderr = (result.stderr ?? '').trim();
	const exitCode = result.status ?? (result.signal ? 1 : 0);
	const signal = result.signal ?? null;

	let isJsonOutput = false;
	let error;

	// Check if expecting JSON
	if (argv.includes('--json')) {
		try {
			JSON.parse(stdout);
			isJsonOutput = true;
		} catch {
			isJsonOutput = false;
			error = 'Expected JSON output was not valid JSON.';
		}
	}

	const passed = exitCode === 0 && error === undefined;

	// Redact any potential secrets in output (double-check)
	const redactedOutput = stdout
		.replace(
			/-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
			'[REDACTED:PRIVATE_KEY]',
		)
		.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED:API_KEY]')
		.replace(/Bearer\s+[A-Za-z0-9\-._~+/=]{20,}/gi, '[REDACTED:AUTH_HEADER]')
		.replace(/xox[bp]-[A-Za-z0-9-]{20,}/g, '[REDACTED:SLACK_TOKEN]');

	return {
		args: argv,
		command: 'logos',
		diagnostics: [],
		error,
		exitCode,
		isJsonOutput,
		passed,
		redactedOutput,
		signal,
		stderr,
		stdout: redactedOutput,
	};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { runReleaseCandidateSmoke, buildReleaseCandidateSmokeReport } =
		await import('../dist/release/release-candidate-smoke.js');

	const fileExists = buildFileExists();
	const packageFiles = simulatePackageFiles();
	const allDeps = [
		...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
		...(pkg.devDependencies ? Object.keys(pkg.devDependencies) : []),
	];
	const scripts = pkg.scripts ?? {};

	// Run CLI command smoke
	const cliCommands = [
		['--help'],
		['--version'],
		['doctor'],
		['doctor', '--json'],
		['doctor', '--dry-run'],
		['doctor', '--json', '--dry-run'],
	];

	const commandResults = {};
	for (const args of cliCommands) {
		const key = args.join(' ');
		commandResults[key] = runCliSmoke(args);
	}

	// Run security/privacy check first
	let securityResult;
	try {
		const { runSecurityPrivacyReleaseCheck } = await import(
			'../dist/security/security-release-checks.js'
		);
		const secResult = runSecurityPrivacyReleaseCheck({
			_dependencyNames: allDeps,
			_packageFiles: packageFiles,
			_packageJson: pkg,
			_scripts: scripts,
			checkedAt: new Date().toISOString(),
			packageName: pkg.name ?? 'logos-engine',
			packageVersion: pkg.version ?? '0.0.0',
			profileId: 'standard',
			strict: true,
		});
		securityResult = {
			status: secResult.status,
			totalFindings: secResult.totalFindings,
		};
	} catch (e) {
		console.warn('Security/privacy check unavailable:', e.message);
	}

	// Run release candidate smoke
	const smokeResult = runReleaseCandidateSmoke({
		_commandResults: commandResults,
		_fileExists: fileExists,
		_packageFiles: packageFiles,
		_packageJson: pkg,
		_securityResult: securityResult,
		checkedAt: new Date().toISOString(),
		dryRun: true,
		projectRoot: root,
		strict: false,
	});

	// Build report
	const report = buildReleaseCandidateSmokeReport(smokeResult);

	// Print report
	for (const line of report.summaryLines) {
		console.log(line);
	}
	for (const line of report.checkLines) {
		console.log(line);
	}
	console.log('');
	for (const line of report.recommendationLines) {
		console.log(line);
	}
	console.log('');

	// JSON output if requested
	if (process.argv.includes('--json')) {
		console.log(JSON.stringify(smokeResult, null, 2));
	}

	// Exit with status
	if (smokeResult.status === 'blocked' || smokeResult.status === 'failed') {
		process.exit(1);
	}

	console.log('Release candidate package smoke passed.');
	process.exit(0);
}

main().catch((err) => {
	console.error('Package smoke failed:', err.message);
	process.exit(1);
});
