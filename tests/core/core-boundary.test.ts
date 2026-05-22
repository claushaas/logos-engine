import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const CORE_DIR = join(PROJECT_ROOT, 'src', 'core');

const FORBIDDEN_PATTERNS = [
	'@earendil-works/pi-coding-agent',
	'@earendil-works/pi-tui',
	'ink',
	'react',
	'src/pi-extension',
	'../pi-extension',
	'../../pi-extension',
	'src/tui',
	'../tui',
	'../../tui',
	'src/cli',
	'../cli',
	'../../cli',
];

function findTsFiles(dir: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			files.push(...findTsFiles(fullPath));
		} else if (stat.isFile() && entry.endsWith('.ts')) {
			files.push(fullPath);
		}
	}

	return files;
}

function getImportSpecifiers(source: string): string[] {
	const specifiers: string[] = [];

	// Match ES module imports: import ... from "..." or import ... from '...'
	const importRegex =
		/import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g;
	// Match dynamic imports: import("...")
	const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	// Match export ... from "..."
	const exportRegex =
		/export\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g;

	let match: RegExpExecArray | null;

	match = importRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = importRegex.exec(source);
	}

	match = dynamicImportRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = dynamicImportRegex.exec(source);
	}

	match = exportRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = exportRegex.exec(source);
	}

	return specifiers;
}

describe('core boundary', () => {
	it('does not import Pi, TUI, CLI, Ink, or React dependencies', () => {
		const coreFiles = findTsFiles(CORE_DIR);
		expect(coreFiles.length).toBeGreaterThan(0);

		const violations: { file: string; specifier: string; pattern: string }[] =
			[];

		for (const file of coreFiles) {
			const source = readFileSync(file, 'utf-8');
			const specifiers = getImportSpecifiers(source);

			for (const specifier of specifiers) {
				for (const pattern of FORBIDDEN_PATTERNS) {
					if (specifier === pattern || specifier.startsWith(`${pattern}/`)) {
						violations.push({
							file: relative(PROJECT_ROOT, file),
							pattern,
							specifier,
						});
					}
				}
			}
		}

		if (violations.length > 0) {
			const messages = violations.map(
				(v) =>
					`${v.file}: imports "${v.specifier}" (matched forbidden pattern "${v.pattern}")`,
			);
			throw new Error(
				`Forbidden imports found in Core:\n${messages.join('\n')}`,
			);
		}

		expect(violations).toHaveLength(0);
	});
});
