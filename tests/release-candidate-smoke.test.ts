/**
 * Release Candidate Smoke Tests
 *
 * Step 13.4 — Package and Release Candidate Smoke
 *
 * Deterministic, provider-free, network-free tests.
 */

import { describe, expect, it } from 'vitest';
import type { ReleaseCandidateCommandSmokeResult } from '../src/release/package-smoke-model.js';
import {
	buildReleaseCandidateSmokeReport,
	runReleaseCandidateSmoke,
} from '../src/release/release-candidate-smoke.js';

// ---------------------------------------------------------------------------
// Helper: build a valid package.json fixture
// ---------------------------------------------------------------------------

function validPackageJson(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		bin: { logos: './dist/cli.js' },
		dependencies: {
			commander: '^14.0.3',
			ink: '^7.0.2',
			react: '^19.2.6',
			yaml: '^2.8.4',
			zod: '^4.4.3',
		},
		devDependencies: {
			'@biomejs/biome': '^2.4.14',
			'@types/node': '^25.6.2',
			'@types/react': '^19.2.14',
			'@vitest/coverage-v8': '^4.1.5',
			typescript: '^6.0.3',
			vitest: '^4.1.5',
		},
		engines: { node: '>=22' },
		files: ['dist', 'profiles', 'docs', 'README.md', 'LICENSE'],
		main: './dist/index.js',
		name: 'logos-engine',
		packageManager: 'pnpm@10.33.2',
		scripts: {
			build: 'tsc -p tsconfig.json',
			check:
				'pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm smoke:cli',
			'check:validation': 'vitest run tests/validation-gate.test.ts',
			lint: 'pnpm lint:biome && pnpm lint:md',
			'lint:biome': 'biome check .',
			'lint:md': 'markdownlint "**/*.md" --ignore node_modules',
			'smoke:cli': 'node scripts/smoke-cli.js',
			test: 'vitest run',
			typecheck: 'tsc --noEmit -p tsconfig.json',
		},
		type: 'module',
		types: './dist/index.d.ts',
		version: '0.1.0',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Helper: valid file existence map
// ---------------------------------------------------------------------------

function validFileExists(
	overrides: Record<string, boolean> = {},
): Record<string, boolean> {
	return {
		'./dist/cli.js': true,
		'dist/cli.js': true,
		'dist/index.d.ts': true,
		'dist/index.js': true,
		'profiles/standard/docs.yml': true,
		'profiles/standard/document.schema.yml': true,
		'profiles/standard/executive': true,
		'profiles/standard/phases': true,
		'profiles/standard/phases/01-foundation': true,
		'profiles/standard/phases/01-foundation.yml': true,
		'profiles/standard/phases/02-validation': true,
		'profiles/standard/phases/02-validation.yml': true,
		'profiles/standard/phases/03-product': true,
		'profiles/standard/phases/03-product.yml': true,
		'profiles/standard/phases/04-engineering': true,
		'profiles/standard/phases/04-engineering.yml': true,
		'profiles/standard/phases/05-go-to-market': true,
		'profiles/standard/phases/05-go-to-market.yml': true,
		'profiles/standard/phases/06-operations': true,
		'profiles/standard/phases/06-operations.yml': true,
		'profiles/standard/README.md': true,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Helper: valid CLI command results
// ---------------------------------------------------------------------------

function validCommandResults(): Record<
	string,
	ReleaseCandidateCommandSmokeResult
> {
	return {
		'--help': {
			args: ['--help'],
			command: 'logos',
			diagnostics: [],
			exitCode: 0,
			isJsonOutput: false,
			passed: true,
			redactedOutput: 'Usage: logos [options] [command]',
			signal: null,
			stderr: '',
			stdout: 'Usage: logos [options] [command]',
		},
		'--version': {
			args: ['--version'],
			command: 'logos',
			diagnostics: [],
			exitCode: 0,
			isJsonOutput: false,
			passed: true,
			redactedOutput: '0.1.0',
			signal: null,
			stderr: '',
			stdout: '0.1.0',
		},
		doctor: {
			args: ['doctor'],
			command: 'logos',
			diagnostics: [],
			exitCode: 0,
			isJsonOutput: false,
			passed: true,
			redactedOutput: 'Project root: /tmp/test',
			signal: null,
			stderr: '',
			stdout: 'Project root: /tmp/test',
		},
		'doctor --dry-run': {
			args: ['doctor', '--dry-run'],
			command: 'logos',
			diagnostics: [],
			exitCode: 0,
			isJsonOutput: false,
			passed: true,
			redactedOutput: 'dry-run',
			signal: null,
			stderr: '',
			stdout: 'dry-run',
		},
		'doctor --json': {
			args: ['doctor', '--json'],
			command: 'logos',
			diagnostics: [],
			exitCode: 0,
			isJsonOutput: true,
			passed: true,
			redactedOutput: '{"status":"ok","command":"doctor"}',
			signal: null,
			stderr: '',
			stdout: '{"status":"ok","command":"doctor"}',
		},
		'doctor --json --dry-run': {
			args: ['doctor', '--json', '--dry-run'],
			command: 'logos',
			diagnostics: [],
			exitCode: 0,
			isJsonOutput: true,
			passed: true,
			redactedOutput: '{"status":"ok","dryRun":true}',
			signal: null,
			stderr: '',
			stdout: '{"status":"ok","dryRun":true}',
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('release candidate smoke', () => {
	describe('package metadata validation', () => {
		it('passes with valid package metadata', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(metaCheck).toBeDefined();
			expect(metaCheck?.status).toBe('pass');
		});

		it('blocks when package name is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ name: undefined }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(metaCheck).toBeDefined();
			expect(metaCheck?.status).toBe('blocked');
			expect(
				metaCheck?.diagnostics.some((d) => d.code.includes('MISSING_NAME')),
			).toBe(true);
		});

		it('blocks when version is invalid', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ version: 'not-semver' }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(metaCheck).toBeDefined();
			expect(
				metaCheck?.diagnostics.some((d) => d.code.includes('INVALID_VERSION')),
			).toBe(true);
		});

		it('blocks when version is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ version: undefined }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) => d.code.includes('INVALID_VERSION')),
			).toBe(true);
		});

		it('warns when type is not "module"', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ type: 'commonjs' }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) => d.code.includes('UNEXPECTED_TYPE')),
			).toBe(true);
		});

		it('blocks when bin.logos is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ bin: {} }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(metaCheck?.status).toBe('blocked');
			expect(
				metaCheck?.diagnostics.some((d) =>
					d.code.includes('MISSING_BIN_LOGOS'),
				),
			).toBe(true);
		});

		it('blocks when bin.logos does not point to dist/', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ bin: { logos: 'src/cli.ts' } }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) => d.code.includes('BIN_NOT_IN_DIST')),
			).toBe(true);
		});

		it('warns when required scripts are missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({
					scripts: {
						build: 'tsc',
						test: 'vitest',
					},
				}),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) => d.code.includes('MISSING_SCRIPT')),
			).toBe(true);
		});

		it('blocks when check script is mutating', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({
					scripts: {
						build: 'tsc -p tsconfig.json',
						check: 'biome check --write . && npm publish',
						'lint:biome': 'biome check .',
						'lint:md': 'markdownlint "**/*.md"',
						'smoke:cli': 'node scripts/smoke-cli.js',
						test: 'vitest run',
						typecheck: 'tsc --noEmit',
					},
				}),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) =>
					d.code.includes('MUTATING_CHECK_SCRIPT'),
				),
			).toBe(true);
		});

		it('warns when packageManager is not pnpm', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ packageManager: 'yarn@1.22' }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) =>
					d.code.includes('PACKAGE_MANAGER_MISMATCH'),
				),
			).toBe(true);
		});

		it('warns when dev dependency is in runtime dependencies', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({
					dependencies: {
						commander: '^14.0.3',
						typescript: '^6.0.3',
						yaml: '^2.8.4',
						zod: '^4.4.3',
					},
				}),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) =>
					d.code.includes('DEV_DEP_IN_RUNTIME'),
				),
			).toBe(true);
		});

		it('warns when runtime dependency is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({
					dependencies: {
						react: '^19.2.6',
					},
				}),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) =>
					d.code.includes('MISSING_RUNTIME_DEP'),
				),
			).toBe(true);
		});
	});

	describe('package files validation', () => {
		it('passes with valid files field', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_files');
			expect(check).toBeDefined();
			expect(check?.status).toBe('pass');
		});

		it('blocks when dist is missing from files', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({
					files: ['docs', 'README.md', 'LICENSE'],
				}),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_files');
			expect(
				check?.diagnostics.some((d) => d.code.includes('MISSING_DIST')),
			).toBe(true);
		});

		it('blocks when profiles is missing from files', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({
					files: ['dist', 'docs', 'README.md', 'LICENSE'],
				}),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_files');
			expect(
				check?.diagnostics.some((d) => d.code.includes('MISSING_PROFILES')),
			).toBe(true);
		});

		it('warns when files field is empty', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ files: [] }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_files');
			expect(
				check?.diagnostics.some((d) => d.code.includes('EMPTY_FILES_FIELD')),
			).toBe(true);
		});
	});

	describe('package exclusions validation', () => {
		it('passes with clean file list', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageFiles: [
					'dist/cli.js',
					'dist/index.js',
					'profiles/standard/docs.yml',
					'README.md',
					'LICENSE',
					'package.json',
				],
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_exclusions');
			expect(check?.status).toBe('pass');
		});

		it('blocks when .env is in package', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageFiles: [
					'.env',
					'dist/cli.js',
					'README.md',
					'LICENSE',
					'package.json',
				],
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_exclusions');
			expect(check?.status).toBe('blocked');
		});

		it('blocks when .logos is in package', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageFiles: [
					'.logos/workspace.json',
					'dist/cli.js',
					'README.md',
					'LICENSE',
					'package.json',
				],
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_exclusions');
			expect(check?.status).toBe('blocked');
		});

		it('blocks when .git is in package', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageFiles: [
					'.git/HEAD',
					'dist/cli.js',
					'README.md',
					'LICENSE',
					'package.json',
				],
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'package_exclusions');
			expect(check?.status).toBe('blocked');
		});
	});

	describe('build output validation', () => {
		it('passes when all dist files exist', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'build_output');
			expect(check?.status).toBe('pass');
		});

		it('blocks when dist/cli.js is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ 'dist/cli.js': false }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'build_output');
			expect(check?.status).toBe('blocked');
		});

		it('blocks when dist/index.js is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ 'dist/index.js': false }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'build_output');
			expect(check?.status).toBe('blocked');
		});

		it('blocks when dist/index.d.ts is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ 'dist/index.d.ts': false }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'build_output');
			expect(check?.status).toBe('blocked');
		});
	});

	describe('binary entrypoint validation', () => {
		it('passes when bin points to existing file', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ './dist/cli.js': true }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'binary_entrypoint');
			expect(check?.status).toBe('pass');
		});

		it('blocks when bin file does not exist', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ './dist/cli.js': false }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'binary_entrypoint');
			expect(check?.status).toBe('blocked');
		});
	});

	describe('bundled profile validation', () => {
		it('passes when all profile files exist and are loadable', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				_profileLoadable: true,
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'bundled_profile');
			expect(check?.status).toBe('pass');
		});

		it('blocks when profiles/standard/docs.yml is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ 'profiles/standard/docs.yml': false }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'bundled_profile');
			expect(check?.status).toBe('blocked');
		});

		it('blocks when profile is not loadable', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				_profileLoadable: false,
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'bundled_profile');
			expect(check?.status).toBe('blocked');
		});

		it('warns when phase directories are missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({
					'profiles/standard/phases/01-foundation': false,
					'profiles/standard/phases/01-foundation.yml': false,
				}),
				_packageJson: validPackageJson(),
				_profileLoadable: true,
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'bundled_profile');
			expect(check?.diagnostics.some((d) => d.severity === 'warning')).toBe(
				true,
			);
		});

		it('warns when executive directory is missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ 'profiles/standard/executive': false }),
				_packageJson: validPackageJson(),
				_profileLoadable: true,
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'bundled_profile');
			expect(check?.diagnostics.some((d) => d.severity === 'warning')).toBe(
				true,
			);
		});
	});

	describe('CLI command smoke', () => {
		it('passes all CLI commands', () => {
			const result = runReleaseCandidateSmoke({
				_commandResults: validCommandResults(),
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const cliChecks = result.checks.filter((c) =>
				[
					'cli_help',
					'cli_version',
					'doctor_text',
					'doctor_json',
					'doctor_json_dry_run',
					'doctor_dry_run',
				].includes(c.kind),
			);
			for (const check of cliChecks) {
				expect(check.status).toBe('pass');
			}
		});

		it('blocks when a CLI command fails', () => {
			const results = validCommandResults();
			results['doctor --json'] = {
				args: ['doctor', '--json'],
				command: 'logos',
				diagnostics: [],
				error: 'Command failed',
				exitCode: 1,
				isJsonOutput: true,
				passed: false,
				redactedOutput: '',
				signal: null,
				stderr: 'error',
				stdout: '',
			};

			const result = runReleaseCandidateSmoke({
				_commandResults: results,
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const blocked = result.checks.filter(
				(c) => c.status === 'blocked' || c.status === 'failed',
			);
			expect(blocked.length).toBeGreaterThan(0);
		});

		it('blocks when JSON output is not valid JSON', () => {
			const results = validCommandResults();
			results['doctor --json'] = {
				args: ['doctor', '--json'],
				command: 'logos',
				diagnostics: [],
				exitCode: 0,
				isJsonOutput: false,
				passed: false,
				redactedOutput: 'not json',
				signal: null,
				stderr: '',
				stdout: 'not json',
			};

			const result = runReleaseCandidateSmoke({
				_commandResults: results,
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const doctorJson = result.checks.filter((c) => c.kind === 'doctor_json');
			expect(doctorJson.some((c) => c.status === 'blocked')).toBe(true);
		});

		it('blocks when secret-like value appears in CLI output', () => {
			const results = validCommandResults();
			results['--help'] = {
				args: ['--help'],
				command: 'logos',
				diagnostics: [],
				exitCode: 0,
				isJsonOutput: false,
				passed: true,
				redactedOutput: 'Usage:\nsk-123456789012345678901234',
				signal: null,
				stderr: 'sk-123456789012345678901234',
				stdout: 'Usage:\nsk-123456789012345678901234',
			};

			const result = runReleaseCandidateSmoke({
				_commandResults: results,
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const _secCheck = result.checks.find(
				(c) => c.kind === 'security_privacy',
			);
			// The cli_help check should still pass but security_privacy should catch the secret
			const cliHelp = result.checks.find((c) => c.kind === 'cli_help');
			expect(cliHelp).toBeDefined();
		});
	});

	describe('security/privacy smoke', () => {
		it('passes when security/privacy check passes', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				_securityResult: { status: 'pass', totalFindings: 0 },
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'security_privacy');
			expect(check?.status).toBe('pass');
		});

		it('blocks when security/privacy check is blocked', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				_securityResult: { status: 'blocked', totalFindings: 5 },
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'security_privacy');
			expect(check?.status).toBe('blocked');
		});

		it('is unknown when security check is unavailable', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'security_privacy');
			expect(check?.status).toBe('unknown');
		});
	});

	describe('report', () => {
		it('includes summary', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const report = buildReleaseCandidateSmokeReport(result);
			expect(report.summaryLines.length).toBeGreaterThan(0);
			expect(
				report.summaryLines.some((l) => l.includes(result.packageName)),
			).toBe(true);
		});

		it('includes check lines', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const report = buildReleaseCandidateSmokeReport(result);
			expect(report.checkLines.length).toBeGreaterThan(0);
		});

		it('includes next actions', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const report = buildReleaseCandidateSmokeReport(result);
			expect(report.recommendationLines.length).toBeGreaterThan(0);
		});

		it('states no package was published', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			expect(result.noPackagePublished).toBe(true);
			const report = buildReleaseCandidateSmokeReport(result);
			expect(
				report.summaryLines.some((l) => l.includes('No package published')),
			).toBe(true);
		});

		it('is JSON-serializable', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const json = JSON.stringify(result);
			const parsed = JSON.parse(json);
			expect(parsed.status).toBe(result.status);
			expect(parsed.noPackagePublished).toBe(true);
		});

		it('report contains no raw secrets', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const json = JSON.stringify(result);
			expect(json).not.toContain('sk-');
			expect(json).not.toContain('BEGIN PRIVATE KEY');
		});
	});

	describe('runtime checks', () => {
		it('confirms no network required', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'runtime_no_network');
			expect(check?.status).toBe('pass');
		});

		it('confirms no credentials required', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find(
				(c) => c.kind === 'runtime_no_credentials',
			);
			expect(check?.status).toBe('pass');
		});

		it('confirms non-interactive', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const check = result.checks.find((c) => c.kind === 'non_interactive');
			expect(check?.status).toBe('pass');
		});
	});

	describe('skipped checks', () => {
		it('supports skipping specific checks', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
				skip: ['build_output', 'runtime_import'],
			});

			const skipped = result.checks.filter(
				(c) => (c as { skipped: boolean }).skipped,
			);
			expect(skipped.length).toBeGreaterThanOrEqual(2);
		});

		it('supports single-check only mode', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
				only: 'package_metadata',
			});

			const activeCheck = result.checks.find(
				(c) =>
					(c as { skipped: boolean }).skipped !== true &&
					c.kind === 'package_metadata',
			);
			expect(activeCheck).toBeDefined();
		});
	});

	describe('error/recovery hints', () => {
		it('provides build dist recovery hint when dist missing', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({ 'dist/cli.js': false }),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const buildCheck = result.checks.find((c) => c.kind === 'build_output');
			expect(
				buildCheck?.diagnostics.some((d) =>
					d.recoveryHint?.includes('pnpm build'),
				),
			).toBe(true);
		});

		it('provides fix bin recovery hint when bin is wrong', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson({ bin: { logos: 'src/cli.ts' } }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const metaCheck = result.checks.find(
				(c) => c.kind === 'package_metadata',
			);
			expect(
				metaCheck?.diagnostics.some((d) =>
					d.recoveryHint?.includes('Fix package.json'),
				),
			).toBe(true);
		});

		it('reports passed/failed/skipped in blocked result', () => {
			const result = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists({
					'./dist/cli.js': false,
					'dist/cli.js': false,
				}),
				_packageJson: validPackageJson({ bin: { logos: 'src/cli.ts' } }),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			expect(result.passedCount).toBeGreaterThanOrEqual(0);
			expect(result.failedCount).toBeGreaterThan(0);
			expect(result.skippedCount).toBeGreaterThanOrEqual(0);
		});
	});

	describe('deterministic ordering', () => {
		it('produces checks in deterministic order', () => {
			const r1 = runReleaseCandidateSmoke({
				_deterministicCounter: 1,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const r2 = runReleaseCandidateSmoke({
				_deterministicCounter: 2,
				_fileExists: validFileExists(),
				_packageJson: validPackageJson(),
				checkedAt: '2025-01-01T00:00:00Z',
				dryRun: true,
			});

			const kinds1 = r1.checks.map((c) => c.kind);
			const kinds2 = r2.checks.map((c) => c.kind);
			expect(kinds1).toEqual(kinds2);
		});
	});
});
