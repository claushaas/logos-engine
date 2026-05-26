import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ─── Boundary Rules ─────────────────────────────────────────────────────────

interface BoundaryRule {
	name: string;
	sourceModules: string[];
	forbiddenModules: string[];
}

const BOUNDARY_RULES: BoundaryRule[] = [
	{
		forbiddenModules: ['llm'],
		name: 'TUI must not import LLM adapter directly',
		sourceModules: ['tui'],
	},
	{
		forbiddenModules: ['tui', 'llm', 'persistence'],
		name: 'State engine must not import TUI, LLM, or persistence',
		sourceModules: ['state-engine'],
	},
	{
		forbiddenModules: ['state-engine', 'tui'],
		name: 'LLM must not import state engine or TUI',
		sourceModules: ['llm'],
	},
	{
		forbiddenModules: ['prompt-orchestration'],
		name: 'Persistence must not import prompt orchestration',
		sourceModules: ['persistence'],
	},
	{
		forbiddenModules: ['conversation-runtime'],
		name: 'Materialization must not import raw conversation runtime',
		sourceModules: ['materialization'],
	},
];

// ─── Scanner ────────────────────────────────────────────────────────────────

interface ImportViolation {
	sourceFile: string;
	importPath: string;
	line: number;
	rule: string;
}

/**
 * Extract import paths from a single line of source code.
 * Handles:
 * - `import ... from '...'` and `export ... from '...'`
 * - Side-effect imports: `import '...'`
 * - Dynamic imports: `await import('...')` or `import('...')`
 */
function extractImportPath(line: string): string | null {
	// Side-effect import: import '...' or import "..."
	const sideEffectMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]\s*;?/);
	if (sideEffectMatch?.[1]) return sideEffectMatch[1];

	// Dynamic import: import('...') or await import('...')
	const dynamicMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
	if (dynamicMatch?.[1]) return dynamicMatch[1];

	// Must contain 'from' keyword for declaration imports/exports
	if (!line.includes('from')) return null;

	// Extract the string literal after 'from'
	const fromIdx = line.lastIndexOf('from');
	if (fromIdx === -1) return null;

	const afterFrom = line.slice(fromIdx + 4).trim();
	const match = afterFrom.match(/^['"]([^'"]+)['"]/);
	if (!match) return null;

	// biome-ignore lint/style/noNonNullAssertion: regex guaranteed capture group
	return match[1]!;
}

function scanImports(
	srcDir: string,
): Array<{ file: string; importPath: string; line: number }> {
	const results: Array<{ file: string; importPath: string; line: number }> = [];

	function walk(dir: string): void {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
				const content = fs.readFileSync(fullPath, 'utf-8');
				const lines = content.split('\n');
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (!line) continue;
					const importPath = extractImportPath(line);
					if (importPath) {
						results.push({
							file: path.relative(srcDir, fullPath),
							importPath,
							line: i + 1,
						});
					}
				}
			}
		}
	}

	walk(srcDir);
	return results;
}

function resolveModule(importPath: string): string | null {
	const aliasMatch = importPath.match(/^@logos\/([^/]+)/);
	if (aliasMatch?.[1]) return aliasMatch[1];

	const relativeMatch = importPath.match(/^\.\.\/([^/]+)/);
	if (relativeMatch?.[1]) return relativeMatch[1];

	return null;
}

function sourceModule(filePath: string): string | null {
	const parts = filePath.split(path.sep);
	return parts[0] ?? null;
}

function checkBoundaries(srcDir: string): {
	violations: ImportViolation[];
	totalImports: number;
} {
	const imports = scanImports(srcDir);
	const violations: ImportViolation[] = [];

	for (const imp of imports) {
		const srcMod = sourceModule(imp.file);
		const targetMod = resolveModule(imp.importPath);

		if (!srcMod || !targetMod) continue;
		if (srcMod === targetMod) continue;

		for (const rule of BOUNDARY_RULES) {
			if (
				rule.sourceModules.includes(srcMod) &&
				rule.forbiddenModules.includes(targetMod)
			) {
				violations.push({
					importPath: imp.importPath,
					line: imp.line,
					rule: rule.name,
					sourceFile: imp.file,
				});
			}
		}
	}

	return { totalImports: imports.length, violations };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../../src');

describe('Module Boundaries', () => {
	it('should find source files to scan', () => {
		const files = fs.readdirSync(SRC_DIR);
		expect(files.length).toBeGreaterThan(0);
	});

	it('should detect no violations in the current codebase', () => {
		const { violations, totalImports } = checkBoundaries(SRC_DIR);

		if (violations.length > 0) {
			const report = violations
				.map(
					(v) =>
						`  ${v.sourceFile}:${v.line} imports "${v.importPath}" — ${v.rule}`,
				)
				.join('\n');
			expect.fail(
				`Found ${violations.length} boundary violation(s) out of ${totalImports} imports:\n${report}`,
			);
		}

		expect(violations).toHaveLength(0);
	});

	it('should detect TUI importing LLM as a violation', () => {
		const fixtureDir = path.resolve(__dirname, '__fixtures__');
		fs.mkdirSync(fixtureDir, { recursive: true });

		const tuiDir = path.join(fixtureDir, 'tui');
		fs.mkdirSync(tuiDir, { recursive: true });
		fs.writeFileSync(
			path.join(tuiDir, 'BadImport.tsx'),
			`import { createLlmClient } from '@logos/llm';\n`,
			'utf-8',
		);

		const { violations } = checkBoundaries(fixtureDir);

		fs.rmSync(fixtureDir, { force: true, recursive: true });

		expect(violations.length).toBeGreaterThanOrEqual(1);
		expect(violations[0]?.rule).toBe(
			'TUI must not import LLM adapter directly',
		);
	});

	it('should detect relative imports crossing boundaries', () => {
		const fixtureDir = path.resolve(__dirname, '__fixtures_rel__');
		fs.mkdirSync(fixtureDir, { recursive: true });

		const tuiDir = path.join(fixtureDir, 'tui');
		fs.mkdirSync(tuiDir, { recursive: true });
		fs.writeFileSync(
			path.join(tuiDir, 'BadRelative.tsx'),
			`import { createLlmClient } from '../llm/client.js';\n`,
			'utf-8',
		);

		const { violations } = checkBoundaries(fixtureDir);

		fs.rmSync(fixtureDir, { force: true, recursive: true });

		expect(violations.length).toBeGreaterThanOrEqual(1);
		expect(violations[0]?.rule).toBe(
			'TUI must not import LLM adapter directly',
		);
	});

	it('should detect side-effect imports crossing boundaries', () => {
		const fixtureDir = path.resolve(__dirname, '__fixtures_side__');
		fs.mkdirSync(fixtureDir, { recursive: true });

		const tuiDir = path.join(fixtureDir, 'tui');
		fs.mkdirSync(tuiDir, { recursive: true });
		fs.writeFileSync(
			path.join(tuiDir, 'BadSideEffect.tsx'),
			`import '@logos/llm';\n`,
			'utf-8',
		);

		const { violations } = checkBoundaries(fixtureDir);

		fs.rmSync(fixtureDir, { force: true, recursive: true });

		expect(violations.length).toBeGreaterThanOrEqual(1);
		expect(violations[0]?.rule).toBe(
			'TUI must not import LLM adapter directly',
		);
	});

	it('should detect dynamic imports crossing boundaries', () => {
		const fixtureDir = path.resolve(__dirname, '__fixtures_dyn__');
		fs.mkdirSync(fixtureDir, { recursive: true });

		const tuiDir = path.join(fixtureDir, 'tui');
		fs.mkdirSync(tuiDir, { recursive: true });
		fs.writeFileSync(
			path.join(tuiDir, 'BadDynamic.tsx'),
			`const mod = await import('@logos/llm');\n`,
			'utf-8',
		);

		const { violations } = checkBoundaries(fixtureDir);

		fs.rmSync(fixtureDir, { force: true, recursive: true });

		expect(violations.length).toBeGreaterThanOrEqual(1);
		expect(violations[0]?.rule).toBe(
			'TUI must not import LLM adapter directly',
		);
	});
});
