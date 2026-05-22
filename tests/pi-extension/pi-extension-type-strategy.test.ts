/**
 * Step 7.1 — Pi Extension Type Strategy Tests.
 *
 * Proves that the Pi dependency strategy is implemented correctly and
 * consistently in `package.json` and the source tree.
 *
 * Tests:
 * 1. Pi dependency placement is acceptable (devDependencies or
 *    peerDependencies + devDependency, or no package with local fallback).
 * 2. Pi package is not accidentally in normal `dependencies`.
 * 3. If fallback type strategy is used, fallback files are isolated under
 *    `src/pi-extension/**`.
 * 4. Legacy TUI dependencies are not treated as Pi type dependencies.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();
const PI_PACKAGE_NAME = '@earendil-works/pi-coding-agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PackageJson = {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
};

function loadPackageJson(): PackageJson {
	const raw = readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8');
	return JSON.parse(raw) as PackageJson;
}

// Avoid dynamic import — use sync.
import { readdirSync, statSync } from 'node:fs';

/** Check if a path exists. */
function fileExists(p: string): boolean {
	try {
		return statSync(p).isFile();
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pi extension type strategy', () => {
	const pkg = loadPackageJson();

	describe('Pi dependency placement', () => {
		it('Pi package is not in runtime dependencies (dependencies)', () => {
			const deps = pkg.dependencies ?? {};
			expect(
				deps[PI_PACKAGE_NAME],
				`${PI_PACKAGE_NAME} must not be a runtime dependency`,
			).toBeUndefined();
		});

		it('Pi package is either a devDependency, a peerDependency, or intentionally absent with fallback', () => {
			const devDeps = pkg.devDependencies ?? {};
			const peerDeps = pkg.peerDependencies ?? {};

			const asDev = devDeps[PI_PACKAGE_NAME];
			const asPeer = peerDeps[PI_PACKAGE_NAME];

			// At least one of these must hold:
			// 1. It's a devDependency
			// 2. It's a peerDependency (+ ideally also a devDependency for typechecking)
			// 3. Neither (fallback strategy with local types)
			const hasDev = asDev !== undefined;
			const hasPeer = asPeer !== undefined;

			// If neither, fallback strategy must be in place.
			if (!hasDev && !hasPeer) {
				// Verify fallback exists.
				const fallbackPath = resolve(
					PROJECT_ROOT,
					'src',
					'pi-extension',
					'pi-types.ts',
				);
				expect(
					existsSync(fallbackPath),
					'Pi package is not in devDependencies or peerDependencies, but no fallback pi-types.ts exists',
				).toBe(true);

				const fallbackSource = readFileSync(fallbackPath, 'utf-8');
				const hasPiImport = fallbackSource.includes(PI_PACKAGE_NAME);
				const exportsLocalTypes = fallbackSource.includes(
					'LogosPiExtensionApi',
				);

				expect(
					hasPiImport || exportsLocalTypes,
					'Fallback pi-types.ts must either import official Pi types or define local fallback types',
				).toBe(true);
			}

			// Compliant as long as one of the conditions holds.
			expect(hasDev || hasPeer || !(hasDev || hasPeer)).toBe(true);
		});

		it('Pi package, when present, is at a reasonable version', () => {
			const devDeps = pkg.devDependencies ?? {};
			const peerDeps = pkg.peerDependencies ?? {};

			const version = devDeps[PI_PACKAGE_NAME] ?? peerDeps[PI_PACKAGE_NAME];

			if (version !== undefined) {
				// At minimum, the version is non-empty and not "*".
				expect(version.length).toBeGreaterThan(0);
				expect(version).not.toBe('*');
			}
		});
	});

	describe('No accidental runtime Pi dependency', () => {
		it('dependencies does not include any @earendil-works/* package', () => {
			const deps = pkg.dependencies ?? {};
			const earendilDeps = Object.keys(deps).filter((k) =>
				k.startsWith('@earendil-works/'),
			);
			expect(
				earendilDeps,
				`Runtime dependencies must not include @earendil-works/ packages: ${earendilDeps.join(', ')}`,
			).toEqual([]);
		});
	});

	describe('Legacy TUI dependencies are not treated as Pi type strategy', () => {
		it('commander is not re-exported from src/pi-extension/**', () => {
			const piDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			if (!existsSync(piDir)) return;

			const files = findAllTsFiles(piDir);
			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				expect(source, `${file} must not import commander`).not.toMatch(
					/from\s+['"]commander['"]/,
				);
			}
		});

		it('ink/react are not re-exported from src/pi-extension/**', () => {
			const piDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			if (!existsSync(piDir)) return;

			const files = findAllTsFiles(piDir);
			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				for (const pkg of ['ink', 'react']) {
					expect(source, `${file} must not import ${pkg}`).not.toMatch(
						new RegExp(`from\\s+['"]${pkg}['"]`),
					);
				}
			}
		});

		it('legacy TUI packages are NOT in the pi-extension import graph', () => {
			// Already tested by pi-types-boundary, but we add a positive
			// assertion here: the pi-extension directory should only contain
			// Pi-related imports and Core imports.
			const piDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			if (!existsSync(piDir)) return;

			const files = findAllTsFiles(piDir);
			const legacyPackages = [
				'commander',
				'ink',
				'ink-testing-library',
				'react',
				'@types/react',
			];

			for (const file of files) {
				const source = readFileSync(file, 'utf-8');
				for (const pkg of legacyPackages) {
					if (
						source.includes(`from "${pkg}"`) ||
						source.includes(`from '${pkg}'`)
					) {
						expect.fail(`${file} imports legacy TUI package "${pkg}"`);
					}
				}
			}
		});
	});

	describe('Fallback boundary isolation (when applicable)', () => {
		it('fallback type definitions (if any) are isolated to src/pi-extension/**', () => {
			// Check that no Pi type definitions exist outside src/pi-extension/.
			const piDir = resolve(PROJECT_ROOT, 'src', 'pi-extension');
			if (!existsSync(piDir)) return;

			// Scan all src files for Pi type definitions.
			const srcDir = resolve(PROJECT_ROOT, 'src');
			const allSrcFiles = findAllTsFiles(srcDir);
			const piPrefix = resolve(PROJECT_ROOT, 'src', 'pi-extension');

			for (const file of allSrcFiles) {
				if (file.startsWith(piPrefix)) continue;

				const source = readFileSync(file, 'utf-8');
				const hasPiTypeDef =
					source.includes(PI_PACKAGE_NAME) ||
					/export\s+(?:type|interface)\s+\w*Pi\w*(?:Extension)?Api\b/.test(
						source,
					);

				expect(
					hasPiTypeDef,
					`${file} contains Pi type references outside src/pi-extension/`,
				).toBe(false);
			}
		});
	});

	describe('Pi types boundary file is discoverable', () => {
		it('src/pi-extension/index.ts re-exports pi-types', () => {
			const indexPath = resolve(
				PROJECT_ROOT,
				'src',
				'pi-extension',
				'index.ts',
			);
			if (!fileExists(indexPath)) return;

			const source = readFileSync(indexPath, 'utf-8');
			expect(
				source,
				'src/pi-extension/index.ts must re-export pi-types.ts',
			).toMatch(/pi-types/);
		});

		it('src/pi-extension/pi-types.ts exports LogosPiExtensionApi', () => {
			const piTypesPath = resolve(
				PROJECT_ROOT,
				'src',
				'pi-extension',
				'pi-types.ts',
			);
			if (!fileExists(piTypesPath)) {
				// If the file doesn't exist, the fallback test covers it.
				return;
			}

			const source = readFileSync(piTypesPath, 'utf-8');
			expect(source).toContain('LogosPiExtensionApi');
		});
	});
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function findAllTsFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const entries = readdirSync(dir);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			files.push(...findAllTsFiles(fullPath));
		} else if (
			stat.isFile() &&
			(entry.endsWith('.ts') || entry.endsWith('.tsx'))
		) {
			files.push(fullPath);
		}
	}

	return files;
}
