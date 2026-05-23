/**
 * Step 10.4 — Package smoke contract tests.
 *
 * Proves that scripts/smoke-package.js behaves correctly:
 * 1. Can run successfully in the current checkout.
 * 2. Exits non-zero when a required file is missing.
 * 3. Does not mutate the repository.
 * 4. Reports stale bin/script references when present.
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const SCRIPT_PATH = path.resolve(PROJECT_ROOT, 'scripts', 'smoke-package.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runSmokePackage(
	root: string,
	timeoutMs = 10_000,
): { stdout: string; stderr: string; code: number; signal: string | null } {
	const result = childProcess.spawnSync(
		process.execPath,
		[SCRIPT_PATH, '--root', root],
		{
			encoding: 'utf-8',
			maxBuffer: 1024 * 1024,
			timeout: timeoutMs,
		},
	);

	return {
		code: result.status ?? -1,
		signal: result.signal,
		stderr: result.stderr?.toString() ?? '',
		stdout: result.stdout?.toString() ?? '',
	};
}

/**
 * Create a minimal temp fixture with just the files smoke-package.js needs.
 * Does NOT copy the entire src/ tree — copies only the files/dirs that
 * are actually checked (entrypoints, profiles/standard/docs.yml, etc.)
 */
function createTempFixture(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-smoke-test-'));

	// Copy package.json
	fs.copyFileSync(
		path.join(PROJECT_ROOT, 'package.json'),
		path.join(dir, 'package.json'),
	);

	// Copy tsconfig.json and vitest.config.ts
	for (const f of ['tsconfig.json', 'vitest.config.ts']) {
		const src = path.join(PROJECT_ROOT, f);
		if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f));
	}

	// Create minimal entrypoint stubs (just touching files is enough
	// for the smoke check which only checks existence)
	fs.mkdirSync(path.join(dir, 'src', 'core'), { recursive: true });
	fs.mkdirSync(path.join(dir, 'src', 'pi-extension'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'src', 'core', 'index.ts'), '// stub\n');
	fs.writeFileSync(
		path.join(dir, 'src', 'pi-extension', 'index.ts'),
		'// stub\n',
	);

	// Copy profiles/standard/docs.yml (checked by smoke)
	const profilesDst = path.join(dir, 'profiles', 'standard');
	fs.mkdirSync(profilesDst, { recursive: true });
	const docsYmlSrc = path.join(
		PROJECT_ROOT,
		'profiles',
		'standard',
		'docs.yml',
	);
	if (fs.existsSync(docsYmlSrc)) {
		fs.copyFileSync(docsYmlSrc, path.join(profilesDst, 'docs.yml'));
	} else {
		fs.writeFileSync(path.join(profilesDst, 'docs.yml'), '# stub\n');
	}

	return dir;
}

function gitDiffExists(): boolean {
	try {
		childProcess.execSync('git rev-parse --git-dir', {
			cwd: PROJECT_ROOT,
			stdio: 'pipe',
		});
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('package smoke contract (Step 10.4)', () => {
	describe('smoke-package.js runs successfully in current checkout', () => {
		it('exits with code 0 on the current repo', () => {
			const result = runSmokePackage(PROJECT_ROOT);
			if (result.code !== 0) {
				console.error('stdout:', result.stdout);
				console.error('stderr:', result.stderr);
			}
			expect(result.code).toBe(0);
		});

		it('produces an OK message', () => {
			const result = runSmokePackage(PROJECT_ROOT);
			expect(result.stdout).toContain('OK:');
		});
	});

	describe('smoke-package.js exits non-zero on missing required file', () => {
		let tempDir: string | undefined;

		afterEach(() => {
			if (tempDir) {
				fs.rmSync(tempDir, { force: true, recursive: true });
				tempDir = undefined;
			}
		});

		it('exits non-zero when package.json is missing', () => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-smoke-test-'));
			const result = runSmokePackage(tempDir);
			expect(result.code).not.toBe(0);
		});

		it('exits non-zero when src/core/index.ts is missing', () => {
			tempDir = createTempFixture();
			fs.rmSync(path.join(tempDir, 'src', 'core', 'index.ts'), {
				force: true,
			});
			const result = runSmokePackage(tempDir);
			expect(result.code).not.toBe(0);
		});

		it('exits non-zero when smoke:cli script is present (CLI deferred)', () => {
			tempDir = createTempFixture();
			const pkgPath = path.join(tempDir, 'package.json');
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
			pkg.scripts['smoke:cli'] = 'node scripts/smoke-cli.js';
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
			const result = runSmokePackage(tempDir);
			expect(result.code).not.toBe(0);
		});
	});

	describe('smoke-package.js does not mutate the repository', () => {
		it('does not write files or mutate project state', () => {
			if (!gitDiffExists()) {
				// Fallback: compare file mtimes for key files
				const keyFiles = ['package.json', 'tsconfig.json', 'vitest.config.ts'];
				const before = getFileMtimes(PROJECT_ROOT, keyFiles);
				runSmokePackage(PROJECT_ROOT);
				const after = getFileMtimes(PROJECT_ROOT, keyFiles);
				expect(before).toEqual(after);
				return;
			}

			const before = childProcess
				.execSync('git status --short', {
					cwd: PROJECT_ROOT,
					encoding: 'utf-8',
				})
				.trim();
			runSmokePackage(PROJECT_ROOT);
			const after = childProcess
				.execSync('git status --short', {
					cwd: PROJECT_ROOT,
					encoding: 'utf-8',
				})
				.trim();

			// Filter to only files that changed AFTER running smoke
			const diffLines = after
				.split('\n')
				.filter((l) => l.trim())
				.filter((l) => !before.includes(l.trim()));

			// Expected new/modified files from this step
			const expectedFiles = [
				'scripts/smoke-package.js',
				'scripts/security-check.js',
				'scripts/nfr-evidence.js',
				'tests/validation-gate.test.ts',
				'tests/package/script-gates-exist.test.ts',
				'tests/package/script-gates-contract.test.ts',
				'tests/package/no-stale-script-references.test.ts',
				'tests/package/package-smoke-contract.test.ts',
			];

			const unexpected = diffLines.filter(
				(l) => !expectedFiles.some((e) => l.includes(e)),
			);

			expect(
				unexpected,
				unexpected.length > 0
					? `Unexpected mutations:\n${unexpected.join('\n')}`
					: undefined,
			).toEqual([]);
		});
	});

	describe('smoke-package.js reports stale references', () => {
		let tempDir: string | undefined;

		afterEach(() => {
			if (tempDir) {
				fs.rmSync(tempDir, { force: true, recursive: true });
				tempDir = undefined;
			}
		});

		it('reports stale script file reference', () => {
			tempDir = createTempFixture();
			const pkgPath = path.join(tempDir, 'package.json');
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
			pkg.scripts['broken:check'] = 'node scripts/nonexistent.js';
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
			const result = runSmokePackage(tempDir);
			expect(result.code).not.toBe(0);
			expect(result.stderr).toMatch(/missing/i);
		});

		it('reports stale bin.logos reference when present', () => {
			tempDir = createTempFixture();
			const pkgPath = path.join(tempDir, 'package.json');
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
			pkg.bin = { logos: './dist/cli.js' };
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
			const result = runSmokePackage(tempDir);
			expect(result.code).not.toBe(0);
		});

		it('reports missing required field', () => {
			tempDir = createTempFixture();
			const pkgPath = path.join(tempDir, 'package.json');
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
			delete pkg.name;
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
			const result = runSmokePackage(tempDir);
			expect(result.code).not.toBe(0);
		});
	});
});

// ---------------------------------------------------------------------------
// Helper: get file mtimes for mutation detection
// ---------------------------------------------------------------------------

function getFileMtimes(root: string, files: string[]): Record<string, number> {
	const result: Record<string, number> = {};
	for (const f of files) {
		const fullPath = path.join(root, f);
		try {
			result[f] = fs.statSync(fullPath).mtimeMs;
		} catch {
			result[f] = -1;
		}
	}
	return result;
}
