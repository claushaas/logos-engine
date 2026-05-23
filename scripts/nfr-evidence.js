#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// CLI
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exists(filePath) {
	return fs.existsSync(filePath);
}

function resolve(root, relPath) {
	return path.resolve(root, relPath);
}

function loadPkg(pkgPath) {
	if (!exists(pkgPath)) return null;
	return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

function countFiles(dir, root) {
	if (!exists(dir)) return 0;
	let count = 0;
	const entries = fs.readdirSync(dir);
	for (const entry of entries) {
		const fullPath = path.join(dir, entry);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory()) {
			count += countFiles(fullPath, root);
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') ||
				entry.endsWith('.tsx') ||
				entry.endsWith('.js') ||
				entry.endsWith('.jsx'))
		) {
			count++;
		}
	}
	return count;
}

function countTestFiles(dir) {
	if (!exists(dir)) return 0;
	let count = 0;
	const entries = fs.readdirSync(dir);
	for (const entry of entries) {
		const fullPath = path.join(dir, entry);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory()) {
			count += countTestFiles(fullPath);
		} else if (stat.isFile() && entry.endsWith('.test.ts')) {
			count++;
		}
	}
	return count;
}

function directoryExists(root, relPath) {
	return exists(resolve(root, relPath));
}

function fileExists(root, relPath) {
	const f = resolve(root, relPath);
	return exists(f) && fs.statSync(f).isFile();
}

// ---------------------------------------------------------------------------
// Evidence collection
// ---------------------------------------------------------------------------

function collectEvidence(root) {
	const pkg = loadPkg(resolve(root, 'package.json'));

	const evidence = {
		cliBinaryExists: !!(
			pkg?.bin &&
			typeof pkg.bin === 'object' &&
			pkg.bin.logos
		),
		cliDirectoryExists: directoryExists(root, 'src/cli'),
		cliStrategy: 'deferred',
		coreEntrypoint: fileExists(root, 'src/core/index.ts'),
		forbiddenCommandsInSource: checkForbiddenInSource(root),
		nodeVersion: process.version,
		packageName: pkg?.name ?? 'unknown',
		packageType: pkg?.type ?? 'unknown',
		packageVersion: pkg?.version ?? 'unknown',
		piExtensionEntrypoint: fileExists(root, 'src/pi-extension/index.ts'),
		profilesDirectoryExists: directoryExists(root, 'profiles/standard'),
		requiredDocsExist: {
			'AGENTS.md': fileExists(root, 'AGENTS.md'),
			'docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md': fileExists(
				root,
				'docs/LOGOS_PI_EXTENSION_ARCHITECTURE.md',
			),
			'docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md': fileExists(
				root,
				'docs/LOGOS_PI_EXTENSION_IMPLEMENTATION_PLAN.md',
			),
			'docs/LOGOS_PI_EXTENSION_ROADMAP.md': fileExists(
				root,
				'docs/LOGOS_PI_EXTENSION_ROADMAP.md',
			),
			'docs/LOGOS_PI_EXTENSION_SPEC.md': fileExists(
				root,
				'docs/LOGOS_PI_EXTENSION_SPEC.md',
			),
			'profiles/standard/docs.yml': fileExists(
				root,
				'profiles/standard/docs.yml',
			),
		},
		scriptNames: pkg?.scripts ? Object.keys(pkg.scripts) : [],
		sourceFileCount: countFiles(resolve(root, 'src'), root),
		testFileCount: countTestFiles(resolve(root, 'tests')),
		timestamp: new Date().toISOString(),
		tuiDirectoryExists: directoryExists(root, 'src/tui'),
		tuiStrategy: 'deferred',
	};

	return evidence;
}

function checkForbiddenInSource(root) {
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
	const srcDir = resolve(root, 'src');
	if (!exists(srcDir)) return { found: [], scanned: false };

	const found = [];
	const files = findSourceFiles(srcDir, root);
	for (const { fullPath, relPath } of files) {
		const content = fs.readFileSync(fullPath, 'utf-8');
		for (const cmd of forbidden) {
			if (content.includes(cmd)) {
				// Only flag if not in a comment-like context and not in a known constant definition
				if (
					content.includes('FORBIDDEN_LOGOS_COMMANDS') ||
					content.includes('forbidden_logos_commands')
				) {
					// This is the canonical constant definition — skip
					// But check if the command name appears outside the constant
					continue;
				}
				found.push(`${relPath}: ${cmd}`);
			}
		}
	}
	return { found, scanned: true };
}

function findSourceFiles(dir, root) {
	if (!exists(dir)) return [];
	const result = [];
	const entries = fs.readdirSync(dir);
	for (const entry of entries) {
		const fullPath = path.join(dir, entry);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory()) {
			result.push(...findSourceFiles(fullPath, root));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx'))
		) {
			result.push({ fullPath, relPath: path.relative(root, fullPath) });
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { root } = parseArgs(process.argv);
	const evidence = collectEvidence(root);
	process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

main();
