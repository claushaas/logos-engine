import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

const FORBIDDEN_PACKAGES = [
	'@earendil-works/pi-coding-agent',
	'@earendil-works/pi-tui',
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
];

const FORBIDDEN_LOCAL_DIRS = [
	'src/pi-extension',
	'src/tui',
	'src/cli',
	'src/commands',
];

type DependencyBoundaryViolation = {
	file: string;
	specifier: string;
	reason: string;
};

function findTsFiles(dir: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			files.push(...findTsFiles(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx'))
		) {
			files.push(fullPath);
		}
	}

	return files;
}

function getImportSpecifiers(source: string): string[] {
	const specifiers: string[] = [];

	// import ... from "..." (including import type)
	const importFromRegex =
		/^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	// side-effect imports: import "..."
	const sideEffectImportRegex = /^\s*import\s+['"]([^'"]+)['"];?/gm;
	// export ... from "..." (including export type)
	const exportFromRegex =
		/^\s*export\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	// dynamic import("...")
	const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

	let match: RegExpExecArray | null;

	match = importFromRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = importFromRegex.exec(source);
	}

	match = sideEffectImportRegex.exec(source);
	while (match !== null) {
		// Avoid double-counting lines already matched by importFromRegex
		// by checking if this specifier was already captured.
		if (!specifiers.includes(match[1])) {
			specifiers.push(match[1]);
		}
		match = sideEffectImportRegex.exec(source);
	}

	match = exportFromRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = exportFromRegex.exec(source);
	}

	match = dynamicImportRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = dynamicImportRegex.exec(source);
	}

	return specifiers;
}

function getForbiddenPackageReason(specifier: string): string | null {
	for (const pkg of FORBIDDEN_PACKAGES) {
		if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
			return `Core must not import ${pkg}`;
		}
	}
	return null;
}

function getForbiddenLocalPathReason(
	resolvedPath: string,
	projectRoot: string,
): string | null {
	const relPath = relative(projectRoot, resolvedPath);
	const normalizedRel = normalize(relPath).replace(/\\/g, '/');

	for (const dir of FORBIDDEN_LOCAL_DIRS) {
		if (normalizedRel === dir || normalizedRel.startsWith(`${dir}/`)) {
			return `Core must not import from ${dir}`;
		}
	}

	return null;
}

function scanCoreDependencyViolations(
	projectRoot: string,
): DependencyBoundaryViolation[] {
	const coreDir = join(projectRoot, 'src', 'core');
	const files = findTsFiles(coreDir);
	const violations: DependencyBoundaryViolation[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(projectRoot, file);

		for (const specifier of specifiers) {
			const packageReason = getForbiddenPackageReason(specifier);
			if (packageReason) {
				violations.push({
					file: fileRel,
					reason: packageReason,
					specifier,
				});
				continue;
			}

			if (specifier.startsWith('.')) {
				const importingDir = dirname(file);
				const resolved = resolve(importingDir, specifier);
				const pathReason = getForbiddenLocalPathReason(resolved, projectRoot);
				if (pathReason) {
					violations.push({
						file: fileRel,
						reason: pathReason,
						specifier,
					});
				}
			}
		}
	}

	return violations;
}

describe('core dependency boundary', () => {
	it('does not import Pi, TUI, CLI, Ink, or React dependencies', () => {
		const violations = scanCoreDependencyViolations(PROJECT_ROOT);

		if (violations.length > 0) {
			const messages = violations.map(
				(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
			);
			throw new Error(
				`Forbidden imports found in Core:\n${messages.join('\n')}`,
			);
		}

		expect(violations).toEqual([]);
	});

	describe('import scanner helpers', () => {
		it('extracts specifiers from various import and export forms', () => {
			const source = `
import { foo } from 'foo-pkg';
import type { Foo } from 'foo-type-pkg';
import * as bar from 'bar-pkg';
import 'side-effect-pkg';
export { baz } from 'baz-pkg';
export type { Baz } from 'baz-type-pkg';
export * from 'star-pkg';
const dynamic = await import('dynamic-pkg');
const lazy = import('lazy-pkg');
			`;

			const specifiers = getImportSpecifiers(source);
			expect(specifiers).toContain('foo-pkg');
			expect(specifiers).toContain('foo-type-pkg');
			expect(specifiers).toContain('bar-pkg');
			expect(specifiers).toContain('side-effect-pkg');
			expect(specifiers).toContain('baz-pkg');
			expect(specifiers).toContain('baz-type-pkg');
			expect(specifiers).toContain('star-pkg');
			expect(specifiers).toContain('dynamic-pkg');
			expect(specifiers).toContain('lazy-pkg');
		});

		it('does not extract from comments', () => {
			const source = `
// import { foo } from 'comment-pkg';
/* import { bar } from 'block-comment-pkg'; */
const x = 'import { baz } from "string-pkg"';
			`;

			const specifiers = getImportSpecifiers(source);
			expect(specifiers).not.toContain('comment-pkg');
			expect(specifiers).not.toContain('block-comment-pkg');
			expect(specifiers).not.toContain('string-pkg');
		});
	});

	describe('forbidden bare package detection', () => {
		it('detects @earendil-works/pi-coding-agent as forbidden', () => {
			const reason = getForbiddenPackageReason(
				'@earendil-works/pi-coding-agent',
			);
			expect(reason).not.toBeNull();
		});

		it('detects @earendil-works/pi-tui as forbidden', () => {
			const reason = getForbiddenPackageReason('@earendil-works/pi-tui');
			expect(reason).not.toBeNull();
		});

		it('detects ink as forbidden', () => {
			const reason = getForbiddenPackageReason('ink');
			expect(reason).not.toBeNull();
		});

		it('detects react as forbidden', () => {
			const reason = getForbiddenPackageReason('react');
			expect(reason).not.toBeNull();
		});

		it('detects subpath imports of react as forbidden', () => {
			const reason = getForbiddenPackageReason('react/jsx-runtime');
			expect(reason).not.toBeNull();
		});

		it('detects ink-testing-library as forbidden', () => {
			const reason = getForbiddenPackageReason('ink-testing-library');
			expect(reason).not.toBeNull();
		});

		it('detects @types/react as forbidden', () => {
			const reason = getForbiddenPackageReason('@types/react');
			expect(reason).not.toBeNull();
		});

		it('allows unrelated packages like node:fs', () => {
			const reason = getForbiddenPackageReason('node:fs');
			expect(reason).toBeNull();
		});

		it('allows packages that share a prefix with a forbidden package', () => {
			// react-dom is not react
			expect(getForbiddenPackageReason('react-dom')).toBeNull();
			// ink-foo is not ink
			expect(getForbiddenPackageReason('ink-foo')).toBeNull();
		});
	});

	describe('forbidden relative import detection', () => {
		it('allows relative imports inside src/core', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', './api.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).toBeNull();
		});

		it('allows relative imports to sibling src modules', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', '../state/config.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).toBeNull();
		});

		it('detects relative import into src/pi-extension', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', '../pi-extension/index.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/pi-extension');
		});

		it('detects relative import into src/tui', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', '../tui/component.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/tui');
		});

		it('detects relative import into src/cli', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', '../cli/command.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/cli');
		});

		it('detects relative import into src/commands', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', '../commands/action.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/commands');
		});

		it('detects deeply nested relative import into src/tui', () => {
			const projectRoot = '/project';
			const resolved = resolve(
				'/project/src/core/deep/nested',
				'../../../tui/component.js',
			);
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/tui');
		});

		it('does not flag a path outside the project root', () => {
			const projectRoot = '/project';
			const resolved = resolve('/project/src/core', '../../outside.js');
			const reason = getForbiddenLocalPathReason(resolved, projectRoot);
			expect(reason).toBeNull();
		});
	});
});
