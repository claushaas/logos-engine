#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
	let root = process.cwd();
	const rest = [];
	for (let i = 2; i < argv.length; i++) {
		if (argv[i] === '--root' && i + 1 < argv.length) {
			root = path.resolve(argv[++i]);
		} else {
			rest.push(argv[i]);
		}
	}
	return { rest, root };
}

function fail(msg) {
	console.error(`FAIL: ${msg}`);
	process.exit(1);
}

function warn(msg) {
	console.warn(`WARN: ${msg}`);
}

function exists(filePath) {
	return fs.existsSync(filePath);
}

function loadPkg(pkgPath) {
	if (!exists(pkgPath)) fail(`package.json not found at ${pkgPath}`);
	return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

function resolve(root, relPath) {
	return path.resolve(root, relPath);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkPackageMetadata(pkgPath) {
	const pkg = loadPkg(pkgPath);

	// Required fields
	for (const field of ['name', 'version', 'type', 'scripts']) {
		if (!pkg[field]) fail(`package.json missing required field: ${field}`);
	}

	if (typeof pkg.scripts !== 'object' || pkg.scripts === null)
		fail('package.json scripts must be an object');

	if (pkg.type !== 'module')
		fail(`package.json type must be "module", got "${pkg.type}"`);

	return pkg;
}

function checkBinLogosAbsent(pkg) {
	if (!pkg.bin) return;
	const bin = pkg.bin;
	if (typeof bin === 'object' && bin !== null && 'logos' in bin)
		fail(
			'package.json bin.logos is present but CLI is deferred (Strategy A). Remove or replace with minimal shim.',
		);
	if (typeof bin === 'string') {
		// bin as string means single binary; check it's not logos
		warn('package.json bin is a string; verify it is intentional.');
	}
}

function checkScriptFileRefs(pkg, root) {
	const scripts = pkg.scripts;
	const violations = [];

	for (const [name, cmd] of Object.entries(scripts)) {
		if (typeof cmd !== 'string') continue;

		// Check "node scripts/<file>.js" refs
		const nodeScriptMatch = cmd.match(/^node\s+(scripts\/[\w./-]+\.js)\b/);
		if (nodeScriptMatch) {
			const scriptPath = resolve(root, nodeScriptMatch[1]);
			if (!exists(scriptPath))
				violations.push(
					`Script "${name}" references missing file: ${nodeScriptMatch[1]}`,
				);
		}

		// Check "vitest run tests/<file>.test.ts" refs
		const vitestMatch = cmd.match(/vitest\s+run\s+(tests\/[\w./,\s-]+)/);
		if (vitestMatch) {
			// Can match multiple files/globs separated by spaces
			const testRefs = vitestMatch[1].split(/\s+/).filter(Boolean);
			for (const testRef of testRefs) {
				if (testRef.includes('*') || testRef.includes('{')) continue; // glob — skip
				if (testRef.endsWith('.test.ts')) {
					const testPath = resolve(root, testRef);
					if (!exists(testPath))
						violations.push(
							`Script "${name}" references missing test file: ${testRef}`,
						);
				}
			}
		}
	}

	if (violations.length > 0) {
		fail(`Script file references are stale:\n${violations.join('\n')}`);
	}
}

function checkRequiredFiles(root) {
	const required = [
		'tsconfig.json',
		'vitest.config.ts',
		'src/core/index.ts',
		'src/pi-extension/index.ts',
		'profiles/standard/docs.yml',
	];

	const missing = [];
	for (const relPath of required) {
		if (!exists(resolve(root, relPath))) missing.push(relPath);
	}

	if (missing.length > 0)
		fail(`Required files missing:\n${missing.join('\n')}`);
}

function checkNoForbiddenCommandsInScripts(pkg) {
	const forbidden = [
		'logos-next',
		'logos-answer',
		'logos-continue',
		'logos-question',
		'logos-phase',
		'logos-doc',
		'logos-set-answer',
		'logos-skip',
		'logos-followup',
	];

	const scripts = pkg.scripts;
	const violations = [];

	for (const [name, cmd] of Object.entries(scripts)) {
		const cmdLower = String(cmd).toLowerCase();
		for (const f of forbidden) {
			if (cmdLower.includes(f))
				violations.push(`Script "${name}" references forbidden command "${f}"`);
		}
	}

	if (violations.length > 0)
		fail(
			`Forbidden command references in package scripts:\n${violations.join('\n')}`,
		);
}

function checkNoStaleSmokeCli(pkg, root) {
	const scripts = pkg.scripts;
	if (scripts['smoke:cli'])
		fail(
			'smoke:cli script is present but CLI is deferred (Strategy A). Remove smoke:cli from package.json scripts.',
		);

	if (exists(path.resolve(root, 'scripts', 'smoke-cli.js')))
		fail(
			'scripts/smoke-cli.js exists but CLI is deferred (Strategy A). Remove or reclassify it.',
		);
}

function checkNoStaleBinLogos(pkg) {
	if (pkg.bin && typeof pkg.bin === 'object' && pkg.bin.logos)
		fail(
			'package.json bin.logos is present but CLI is deferred. Remove bin.logos.',
		);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { root } = parseArgs(process.argv);
	const pkgPath = resolve(root, 'package.json');

	console.log(`Smoke-checking package in ${root}`);

	const pkg = checkPackageMetadata(pkgPath);
	checkBinLogosAbsent(pkg);
	checkNoStaleBinLogos(pkg);
	checkNoStaleSmokeCli(pkg, root);
	checkScriptFileRefs(pkg, root);
	checkRequiredFiles(root);
	checkNoForbiddenCommandsInScripts(pkg);

	console.log('OK: smoke-package passed');
}

main();
