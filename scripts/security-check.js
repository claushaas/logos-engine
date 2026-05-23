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

function fail(msg) {
	console.error(`FAIL: ${msg}`);
	process.exit(1);
}

function exists(filePath) {
	return fs.existsSync(filePath);
}

// Directories/files to exclude from scanning
const EXCLUDED_DIRS = new Set(
	[
		'node_modules',
		'.git',
		'dist',
		'coverage',
		'artifacts',
		'.logos',
		'.codegraph',
		'temp',
		'tmp',
	].map((d) => path.normalize(d)),
);

const EXCLUDED_FILE_EXTS = new Set([
	'.lock',
	'.log',
	'.map',
	'.json',
	'.yaml',
	'.yml',
	'.svg',
	'.png',
	'.jpg',
	'.gif',
	'.ico',
	'.woff',
	'.woff2',
	'.ttf',
	'.eot',
]);

// ---------------------------------------------------------------------------
// Pattern construction (avoids self-scan false positives)
// ---------------------------------------------------------------------------

// Secret patterns built from pieces to avoid self-detection
const _SECRET = 'SECRET';
const KEY = 'KEY';
const API = 'API';
const _TOKEN = 'TOKEN';
const _AUTH = 'AUTH';
const _BEARER = 'Bearer';
const _PRIVATE = 'PRIVATE';
const _REFRESH = 'REFRESH';
const _ACCESS = 'ACCESS';
const OPENAI = 'OPENAI';
const ANTHROPIC = 'ANTHROPIC';
const DEEPSEEK = 'DEEPSEEK';

// Patterns likely to indicate committed secrets
function buildSecretPatterns() {
	return [
		// API key assignments: <PROVIDER>_API_KEY=<non-empty>
		new RegExp(
			`${OPENAI}_${API}_${KEY}\\s*=\\s*[^'"]*(?!\\s*\\b(?:your|sk-|placeholder|example|xxx|CHANGE_ME|<))\\S`,
			'gi',
		),
		new RegExp(
			`${ANTHROPIC}_${API}_${KEY}\\s*=\\s*[^'"]*(?!\\s*\\b(?:your|placeholder|example|xxx|CHANGE_ME|<))\\S`,
			'gi',
		),
		new RegExp(
			`${DEEPSEEK}_${API}_${KEY}\\s*=\\s*[^'"]*(?!\\s*\\b(?:your|placeholder|example|xxx|CHANGE_ME|<))\\S`,
			'gi',
		),
		/sk-[A-Za-z0-9]{20,}/g, // OpenAI/Groq-style key format
		/sk-ant-[A-Za-z0-9]{20,}/g, // Anthropic key format
		// Bearer token with non-placeholder value
		/Authorization:\s*Bearer\s+(?!<|your-|placeholder|xxx|CHANGE_ME)[^\s"']{8,}/g,
		// access_token / refresh_token assignments
		/access[_-]?token\s*[:=]\s*['"](?!<|your-|placeholder)[^'"]{8,}['"]/gi,
		/refresh[_-]?token\s*[:=]\s*['"](?!<|your-|placeholder)[^'"]{8,}['"]/gi,
		// private_key assignments
		/private[_-]?key\s*[:=]\s*['"]?(?!<|your-|placeholder)[A-Za-z0-9/+]{20,}['"]?/gi,
	];
}

// Forbidden package names for Core (built from pieces to avoid self-scan)
function buildCoreForbiddenPkgs() {
	return [
		'@earendil-works/pi-coding-agent',
		'@earendil-works/pi-tui',
		'ink',
		'ink-testing-library',
		'react',
		'commander',
	];
}

function buildPiExtForbiddenPkgs() {
	return [
		'ink',
		'ink-testing-library',
		'react',
		'commander',
		'@earendil-works/pi-tui',
	];
}

// Forbidden local dirs for Core
function buildCoreForbiddenDirs() {
	return ['src/pi-extension', 'src/tui', 'src/cli', 'src/commands'];
}

// Forbidden local dirs for Pi extension
function buildPiExtForbiddenDirs() {
	return ['src/tui', 'src/cli', 'src/commands'];
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

function isExcluded(relPath) {
	const parts = relPath.split(path.sep);
	for (const part of parts) {
		if (EXCLUDED_DIRS.has(part)) return true;
	}
	const ext = path.extname(relPath).toLowerCase();
	if (EXCLUDED_FILE_EXTS.has(ext)) return true;
	return false;
}

function findFiles(dir, root, files = []) {
	if (!exists(dir)) return files;
	const entries = fs.readdirSync(dir);
	for (const entry of entries) {
		const fullPath = path.join(dir, entry);
		const stat = fs.statSync(fullPath);
		const relPath = path.relative(root, fullPath);
		if (isExcluded(relPath)) continue;
		if (stat.isDirectory()) {
			findFiles(fullPath, root, files);
		} else if (stat.isFile()) {
			files.push({ fullPath, relPath });
		}
	}
	return files;
}

// ---------------------------------------------------------------------------
// Secret check
// ---------------------------------------------------------------------------

function checkSecrets(root) {
	const secretPatterns = buildSecretPatterns();
	const files = findFiles(root, root);
	const violations = [];

	for (const { fullPath, relPath } of files) {
		const content = fs.readFileSync(fullPath, 'utf-8');

		for (const pattern of secretPatterns) {
			// Reset regex state
			pattern.lastIndex = 0;
			let match = pattern.exec(content);
			while (match !== null) {
				const line = content.substring(0, match.index).split('\n').length;
				violations.push(
					`${relPath}:${line}: possible secret detected — ${match[0].substring(0, 60)}`,
				);
				match = pattern.exec(content);
			}
		}
	}
	return violations;
}

// ---------------------------------------------------------------------------
// Forbidden import check (text-level)
// ---------------------------------------------------------------------------

function extractImportSpecifiers(source) {
	const specifiers = [];
	const patterns = [
		/import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
		/import\s+['"]([^'"]+)['"]/g,
		/export\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
		/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
	];

	for (const pattern of patterns) {
		let match = pattern.exec(source);
		while (match !== null) {
			specifiers.push(match[1]);
			match = pattern.exec(source);
		}
	}
	return specifiers;
}

function checkForbiddenImports(root) {
	const coreDir = path.resolve(root, 'src', 'core');
	const piExtDir = path.resolve(root, 'src', 'pi-extension');
	const coreForbiddenPkgs = buildCoreForbiddenPkgs();
	const piExtForbiddenPkgs = buildPiExtForbiddenPkgs();

	const violations = [];

	// Scan Core
	const coreFiles = exists(coreDir) ? findTsFiles(coreDir, root) : [];
	for (const { fullPath, relPath } of coreFiles) {
		const source = fs.readFileSync(fullPath, 'utf-8');
		const specifiers = extractImportSpecifiers(source);
		for (const spec of specifiers) {
			// Check bare packages
			for (const pkg of coreForbiddenPkgs) {
				if (spec === pkg || spec.startsWith(`${pkg}/`)) {
					violations.push(
						`${relPath}: Core imports forbidden package "${spec}"`,
					);
				}
			}
			// Check local paths
			if (spec.startsWith('.')) {
				const resolved = path.resolve(path.dirname(fullPath), spec);
				const resolvedRel = path.relative(root, resolved).replace(/\\/g, '/');
				for (const dir of buildCoreForbiddenDirs()) {
					if (resolvedRel === dir || resolvedRel.startsWith(`${dir}/`)) {
						violations.push(
							`${relPath}: Core imports forbidden dir "${spec}" → ${resolvedRel}`,
						);
					}
				}
			}
		}
	}

	// Scan Pi extension
	const piFiles = exists(piExtDir) ? findTsFiles(piExtDir, root) : [];
	for (const { fullPath, relPath } of piFiles) {
		const source = fs.readFileSync(fullPath, 'utf-8');
		const specifiers = extractImportSpecifiers(source);
		for (const spec of specifiers) {
			for (const pkg of piExtForbiddenPkgs) {
				if (spec === pkg || spec.startsWith(`${pkg}/`)) {
					violations.push(
						`${relPath}: Pi extension imports forbidden package "${spec}"`,
					);
				}
			}
			if (spec.startsWith('.')) {
				const resolved = path.resolve(path.dirname(fullPath), spec);
				const resolvedRel = path.relative(root, resolved).replace(/\\/g, '/');
				for (const dir of buildPiExtForbiddenDirs()) {
					if (resolvedRel === dir || resolvedRel.startsWith(`${dir}/`)) {
						violations.push(
							`${relPath}: Pi extension imports forbidden dir "${spec}" → ${resolvedRel}`,
						);
					}
				}
			}
		}
	}

	return violations;
}

function findTsFiles(dir, root) {
	return findFiles(dir, root);
}

// ---------------------------------------------------------------------------
// Network call check in scripts
// ---------------------------------------------------------------------------

function checkScriptsForNetwork(root) {
	const scriptsDir = path.resolve(root, 'scripts');
	if (!exists(scriptsDir)) return [];

	const files = findFiles(scriptsDir, root);
	const violations = [];
	const networkPatterns = [
		/\bfetch\s*\(/g,
		/\bhttp\.request\s*\(/g,
		/\bhttps\.request\s*\(/g,
		/\bcurl\b/g,
		/\bwget\b/g,
		/child_process\.exec\s*\(\s*['"](?:curl|wget)/g,
		/spawn\s*\(\s*['"](?:curl|wget)/g,
	];

	for (const { fullPath, relPath } of files) {
		// Skip this file itself to avoid self-scan
		if (relPath === 'scripts/security-check.js') continue;
		// Skip helper libs that contain pattern definitions
		if (relPath.startsWith('scripts/lib/')) continue;

		const source = fs.readFileSync(fullPath, 'utf-8');
		for (const pattern of networkPatterns) {
			pattern.lastIndex = 0;
			if (pattern.test(source)) {
				violations.push(`${relPath}: contains network call pattern`);
				break; // Report once per file
			}
		}
	}
	return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { root } = parseArgs(process.argv);
	console.log(`Security-checking in ${root}`);

	let exitCode = 0;

	// 1. Secret scan
	const secretViolations = checkSecrets(root);
	if (secretViolations.length > 0) {
		console.error('SECRETS FOUND:');
		for (const v of secretViolations) console.error(`  ${v}`);
		exitCode = 1;
	}

	// 2. Forbidden import scan
	const importViolations = checkForbiddenImports(root);
	if (importViolations.length > 0) {
		console.error('FORBIDDEN IMPORTS:');
		for (const v of importViolations) console.error(`  ${v}`);
		exitCode = 1;
	}

	// 3. Network call check in scripts
	const networkViolations = checkScriptsForNetwork(root);
	if (networkViolations.length > 0) {
		console.error('NETWORK CALLS IN SCRIPTS:');
		for (const v of networkViolations) console.error(`  ${v}`);
		exitCode = 1;
	}

	if (exitCode === 0) {
		console.log('OK: security-check passed');
	} else {
		fail('security-check failed — see details above');
	}
}

main();
