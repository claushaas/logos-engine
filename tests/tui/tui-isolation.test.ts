/**
 * Step 10.2 — TUI isolation tests.
 *
 * Proves that:
 * 1. src/tui/** does not exist (Strategy A: Defer TUI).
 * 2. Core does not import src/tui/**.
 * 3. Core does not import ink, react, or ink-testing-library.
 * 4. Pi extension does not import src/tui/**.
 * 5. Pi extension does not import ink, react, or ink-testing-library.
 * 6. If TUI were present, it would only import Core through public exports.
 * 7. If TUI were present, it would not import Pi extension internals.
 * 8. If TUI were present, it would not be registered by extension factory.
 *
 * Since `src/tui/` does not exist in the current repository (Strategy A),
 * the source-scanning assertions are conditional. This file remains in
 * place to enforce the boundary if TUI source is ever added.
 */

import type { Stats } from 'node:fs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Boundary constants
// ---------------------------------------------------------------------------

/**
 * Packages forbidden for TUI to import (in addition to Pi/Core boundary rules).
 * TUI may not import Pi extension internals or commander-style CLI tooling.
 */
const TUI_FORBIDDEN_PACKAGES = [
	'@earendil-works/pi-coding-agent',
	'@earendil-works/pi-tui',
	'commander',
];

/**
 * Local directories forbidden for TUI imports.
 * TUI must not import Pi extension internals.
 */
const TUI_FORBIDDEN_LOCAL_DIRS = ['src/pi-extension', 'src/cli'];

/**
 * Core internal directories that TUI must not import.
 * TUI may only import public Core exports (src/core/index.ts, src/core/api.ts).
 */
const CORE_INTERNAL_DIRS = [
	'src/core/intake',
	'src/core/generation',
	'src/core/profiles',
	'src/core/state',
	'src/core/fs',
	'src/core/evaluation',
	'src/core/questions',
	'src/core/config',
	'src/core/ports',
	'src/core/validation',
	'src/core/artifacts',
];

/**
 * Core packages forbidden to import (proving Core remains TUI-free).
 */
const CORE_FORBIDDEN_TUI_PACKAGES = [
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
	'commander',
];

/**
 * Pi extension packages forbidden to import (proving Pi extension is TUI-free).
 */
const PI_EXTENSION_FORBIDDEN_TUI_PACKAGES = [
	'ink',
	'ink-testing-library',
	'react',
	'@types/react',
	'commander',
];

type BoundaryViolation = {
	file: string;
	specifier: string;
	reason: string;
};

// ---------------------------------------------------------------------------
// File scanning helpers
// ---------------------------------------------------------------------------

function findTsFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		let stat: Stats;
		try {
			stat = statSync(fullPath);
		} catch {
			continue;
		}
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

	const importFromRegex =
		/^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	const sideEffectImportRegex = /^\s*import\s+['"]([^'"]+)['"];?/gm;
	const exportFromRegex =
		/^\s*export\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];?/gm;
	const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

	let match: RegExpExecArray | null;

	match = importFromRegex.exec(source);
	while (match !== null) {
		specifiers.push(match[1]);
		match = importFromRegex.exec(source);
	}

	match = sideEffectImportRegex.exec(source);
	while (match !== null) {
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

function isForbiddenPackage(
	specifier: string,
	packages: string[],
	label: string,
): string | null {
	for (const pkg of packages) {
		if (specifier === pkg || specifier.startsWith(`${pkg}/`)) {
			return `${label} must not import ${pkg}`;
		}
	}
	return null;
}

function isForbiddenLocalPath(
	resolvedPath: string,
	projectRoot: string,
	forbiddenDirs: string[],
	coreInternalDirs: string[] | null,
	label: string,
): string | null {
	const relPath = relative(projectRoot, resolvedPath).replace(/\\/g, '/');

	for (const dir of forbiddenDirs) {
		if (relPath === dir || relPath.startsWith(`${dir}/`)) {
			return `${label} must not import from ${dir}`;
		}
	}

	if (coreInternalDirs) {
		for (const dir of coreInternalDirs) {
			if (relPath === dir || relPath.startsWith(`${dir}/`)) {
				return `${label} must not import Core internals (${dir}). Use public API only.`;
			}
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// TUI source scan (if present)
// ---------------------------------------------------------------------------

function scanTuiViolations(): BoundaryViolation[] {
	const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
	if (!existsSync(tuiDir)) return [];

	const files = findTsFiles(tuiDir);
	const violations: BoundaryViolation[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(PROJECT_ROOT, file);

		for (const specifier of specifiers) {
			const pkgReason = isForbiddenPackage(
				specifier,
				TUI_FORBIDDEN_PACKAGES,
				'TUI',
			);
			if (pkgReason) {
				violations.push({ file: fileRel, reason: pkgReason, specifier });
				continue;
			}

			if (specifier.startsWith('.')) {
				const resolved = resolve(dirname(file), specifier);
				const pathReason = isForbiddenLocalPath(
					resolved,
					PROJECT_ROOT,
					TUI_FORBIDDEN_LOCAL_DIRS,
					CORE_INTERNAL_DIRS,
					'TUI',
				);
				if (pathReason) {
					violations.push({ file: fileRel, reason: pathReason, specifier });
				}
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Core TUI-package scan
// ---------------------------------------------------------------------------

function scanCoreTuiPackageViolations(): BoundaryViolation[] {
	const coreDir = join(PROJECT_ROOT, 'src', 'core');
	if (!existsSync(coreDir)) return [];

	const files = findTsFiles(coreDir);
	const violations: BoundaryViolation[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(PROJECT_ROOT, file);

		for (const specifier of specifiers) {
			const reason = isForbiddenPackage(
				specifier,
				CORE_FORBIDDEN_TUI_PACKAGES,
				'Core',
			);
			if (reason) {
				violations.push({ file: fileRel, reason, specifier });
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Pi extension TUI-package scan
// ---------------------------------------------------------------------------

function scanPiExtensionTuiPackageViolations(): BoundaryViolation[] {
	const piExtDir = join(PROJECT_ROOT, 'src', 'pi-extension');
	if (!existsSync(piExtDir)) return [];

	const files = findTsFiles(piExtDir);
	const violations: BoundaryViolation[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(PROJECT_ROOT, file);

		for (const specifier of specifiers) {
			const reason = isForbiddenPackage(
				specifier,
				PI_EXTENSION_FORBIDDEN_TUI_PACKAGES,
				'Pi extension',
			);
			if (reason) {
				violations.push({ file: fileRel, reason, specifier });
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Core TUI local-path scan
// ---------------------------------------------------------------------------

function scanCoreTuiLocalPathViolations(): BoundaryViolation[] {
	const coreDir = join(PROJECT_ROOT, 'src', 'core');
	if (!existsSync(coreDir)) return [];

	const files = findTsFiles(coreDir);
	const violations: BoundaryViolation[] = [];
	const FORBIDDEN = ['src/tui'];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(PROJECT_ROOT, file);

		for (const specifier of specifiers) {
			if (!specifier.startsWith('.')) continue;

			const resolved = resolve(dirname(file), specifier);
			const reason = isForbiddenLocalPath(
				resolved,
				PROJECT_ROOT,
				FORBIDDEN,
				null, // no core internal check for core itself
				'Core',
			);
			if (reason) {
				violations.push({ file: fileRel, reason, specifier });
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Pi extension TUI local-path scan
// ---------------------------------------------------------------------------

function scanPiExtensionTuiLocalPathViolations(): BoundaryViolation[] {
	const piExtDir = join(PROJECT_ROOT, 'src', 'pi-extension');
	if (!existsSync(piExtDir)) return [];

	const files = findTsFiles(piExtDir);
	const violations: BoundaryViolation[] = [];
	const FORBIDDEN = ['src/tui'];

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const specifiers = getImportSpecifiers(source);
		const fileRel = relative(PROJECT_ROOT, file);

		for (const specifier of specifiers) {
			if (!specifier.startsWith('.')) continue;

			const resolved = resolve(dirname(file), specifier);
			const reason = isForbiddenLocalPath(
				resolved,
				PROJECT_ROOT,
				FORBIDDEN,
				null,
				'Pi extension',
			);
			if (reason) {
				violations.push({ file: fileRel, reason, specifier });
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Extension factory TUI-reference scan
// ---------------------------------------------------------------------------

function scanExtensionFactoryForTuiReferences(): string[] {
	const piExtDir = join(PROJECT_ROOT, 'src', 'pi-extension');
	if (!existsSync(piExtDir)) return [];

	const files = findTsFiles(piExtDir);
	const references: string[] = [];
	const tuiPattern = /src\/tui|['"]tui['"]/i;

	for (const file of files) {
		const source = readFileSync(file, 'utf-8');
		const fileRel = relative(PROJECT_ROOT, file);

		if (tuiPattern.test(source)) {
			references.push(`${fileRel}: references "tui" string or path`);
		}
	}

	return references;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TUI isolation (Step 10.2)', () => {
	describe('source directory existence', () => {
		it('src/tui/ is absent — consistent with Strategy A (Defer TUI)', () => {
			const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
			expect(
				existsSync(tuiDir),
				'src/tui/ must not exist under Strategy A (Defer TUI). TUI is not part of the Pi-extension-first MVP.',
			).toBe(false);
		});

		it('src/tui/README.md is absent — no TUI classification file exists', () => {
			const tuiReadme = join(PROJECT_ROOT, 'src', 'tui', 'README.md');
			expect(
				existsSync(tuiReadme),
				'src/tui/README.md must not exist when no TUI source directory exists',
			).toBe(false);
		});
	});

	describe('Core does not import TUI packages', () => {
		it('Core source files do not import ink, react, ink-testing-library, @types/react, or commander', () => {
			const violations = scanCoreTuiPackageViolations();

			if (violations.length > 0) {
				const messages = violations.map(
					(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
				);
				throw new Error(
					`Core must not import TUI/CLI packages:\n${messages.join('\n')}`,
				);
			}

			expect(violations).toEqual([]);
		});
	});

	describe('Core does not import TUI local paths', () => {
		it('Core source files do not import from src/tui/', () => {
			const violations = scanCoreTuiLocalPathViolations();

			if (violations.length > 0) {
				const messages = violations.map(
					(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
				);
				throw new Error(
					`Core must not import from src/tui/:\n${messages.join('\n')}`,
				);
			}

			expect(violations).toEqual([]);
		});
	});

	describe('Pi extension does not import TUI packages', () => {
		it('Pi extension source files do not import ink, react, ink-testing-library, @types/react, or commander', () => {
			const violations = scanPiExtensionTuiPackageViolations();

			if (violations.length > 0) {
				const messages = violations.map(
					(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
				);
				throw new Error(
					`Pi extension must not import TUI/CLI packages:\n${messages.join('\n')}`,
				);
			}

			expect(violations).toEqual([]);
		});
	});

	describe('Pi extension does not import TUI local paths', () => {
		it('Pi extension source files do not import from src/tui/', () => {
			const violations = scanPiExtensionTuiLocalPathViolations();

			if (violations.length > 0) {
				const messages = violations.map(
					(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
				);
				throw new Error(
					`Pi extension must not import from src/tui/:\n${messages.join('\n')}`,
				);
			}

			expect(violations).toEqual([]);
		});
	});

	describe('Extension factory does not reference TUI', () => {
		it('Pi extension source does not reference src/tui or "tui" string patterns', () => {
			const references = scanExtensionFactoryForTuiReferences();

			if (references.length > 0) {
				throw new Error(
					`Pi extension must not reference TUI in factory/command/input routing:\n${references.join('\n')}`,
				);
			}

			expect(references).toEqual([]);
		});
	});

	describe('TUI import boundary (if TUI source is ever added)', () => {
		it('TUI does not import Pi extension, commander, or Core internals', () => {
			const violations = scanTuiViolations();

			if (violations.length > 0) {
				const messages = violations.map(
					(v) => `${v.file}: imports "${v.specifier}" (${v.reason})`,
				);
				throw new Error(
					`Forbidden imports found in TUI:\n${messages.join('\n')}`,
				);
			}

			// If no TUI source exists, this passes with zero violations
			expect(violations).toEqual([]);
		});

		it('TUI may only import public Core exports', () => {
			const tuiDir = join(PROJECT_ROOT, 'src', 'tui');
			if (!existsSync(tuiDir)) {
				// No TUI source: test passes
				expect(true).toBe(true);
				return;
			}

			const files = findTsFiles(tuiDir);
			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				const specifiers = getImportSpecifiers(source);
				const fileRel = relative(PROJECT_ROOT, file);

				for (const specifier of specifiers) {
					if (!specifier.startsWith('.')) continue;
					const resolved = resolve(dirname(file), specifier);
					const relPath = relative(PROJECT_ROOT, resolved).replace(/\\/g, '/');

					for (const internalDir of CORE_INTERNAL_DIRS) {
						if (
							relPath === internalDir ||
							relPath.startsWith(`${internalDir}/`)
						) {
							throw new Error(
								`${fileRel}: imports "${specifier}" → Core internal "${internalDir}". TUI must only use public Core API.`,
							);
						}
					}
				}
			}

			expect(true).toBe(true);
		});
	});

	describe('boundary detection helpers', () => {
		it('detects ink as forbidden for Core', () => {
			const reason = isForbiddenPackage(
				'ink',
				CORE_FORBIDDEN_TUI_PACKAGES,
				'Core',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('ink');
		});

		it('detects react as forbidden for Core', () => {
			const reason = isForbiddenPackage(
				'react',
				CORE_FORBIDDEN_TUI_PACKAGES,
				'Core',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('react');
		});

		it('detects ink-testing-library as forbidden for Core', () => {
			const reason = isForbiddenPackage(
				'ink-testing-library',
				CORE_FORBIDDEN_TUI_PACKAGES,
				'Core',
			);
			expect(reason).not.toBeNull();
		});

		it('detects @types/react as forbidden for Core', () => {
			const reason = isForbiddenPackage(
				'@types/react',
				CORE_FORBIDDEN_TUI_PACKAGES,
				'Core',
			);
			expect(reason).not.toBeNull();
		});

		it('detects commander as forbidden for Core', () => {
			const reason = isForbiddenPackage(
				'commander',
				CORE_FORBIDDEN_TUI_PACKAGES,
				'Core',
			);
			expect(reason).not.toBeNull();
		});

		it('detects ink as forbidden for Pi extension', () => {
			const reason = isForbiddenPackage(
				'ink',
				PI_EXTENSION_FORBIDDEN_TUI_PACKAGES,
				'Pi extension',
			);
			expect(reason).not.toBeNull();
		});

		it('detects react as forbidden for Pi extension', () => {
			const reason = isForbiddenPackage(
				'react',
				PI_EXTENSION_FORBIDDEN_TUI_PACKAGES,
				'Pi extension',
			);
			expect(reason).not.toBeNull();
		});

		it('detects commander as forbidden for Pi extension', () => {
			const reason = isForbiddenPackage(
				'commander',
				PI_EXTENSION_FORBIDDEN_TUI_PACKAGES,
				'Pi extension',
			);
			expect(reason).not.toBeNull();
		});

		it('detects src/pi-extension relative import as forbidden for TUI', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/tui', '../pi-extension/index.js'),
				'/project',
				TUI_FORBIDDEN_LOCAL_DIRS,
				CORE_INTERNAL_DIRS,
				'TUI',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/pi-extension');
		});

		it('detects Core internals import as forbidden for TUI', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/tui', '../core/intake/something.js'),
				'/project',
				TUI_FORBIDDEN_LOCAL_DIRS,
				CORE_INTERNAL_DIRS,
				'TUI',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('Core internals');
		});

		it('allows public Core API import for TUI', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/tui', '../core/index.js'),
				'/project',
				TUI_FORBIDDEN_LOCAL_DIRS,
				CORE_INTERNAL_DIRS,
				'TUI',
			);
			expect(reason).toBeNull();
		});

		it('detects src/tui relative import as forbidden for Core', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/core', '../tui/component.js'),
				'/project',
				['src/tui'],
				null,
				'Core',
			);
			expect(reason).not.toBeNull();
			expect(reason).toContain('src/tui');
		});

		it('allows sibling relative import inside Core', () => {
			const reason = isForbiddenLocalPath(
				resolve('/project/src/core', './api.js'),
				'/project',
				['src/tui'],
				null,
				'Core',
			);
			expect(reason).toBeNull();
		});
	});
});
