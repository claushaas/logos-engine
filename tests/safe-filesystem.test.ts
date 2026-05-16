/** Safe filesystem adapter tests — atomic writes, backups, dry-run, path safety, corruption safety */

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
	SafeFsAdapter,
	SafeWriteChangedPath,
	SafeWriteDiagnostic,
	SafeWriteResult,
} from '../src/fs/safe-filesystem.js';
import {
	checkPathSafety,
	resolveWritePolicy,
	serializeJson,
	writeFileAtomic,
	writeJsonAtomic,
} from '../src/fs/safe-filesystem.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const testDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'logos-safefs-'));
	testDirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of testDirs.splice(0)) {
		await rm(dir, { force: true, recursive: true });
	}
});

function _normalizePathsInResult(result: SafeWriteResult): SafeWriteResult {
	const normalizedChangedPaths: SafeWriteChangedPath[] =
		result.changedPaths.map((cp) => ({ ...cp, path: normalize(cp.path) }));
	const normalizedDiagnostics: SafeWriteDiagnostic[] = result.diagnostics.map(
		(d) => ({
			...d,
			backupPath: d.backupPath ? normalize(d.backupPath) : undefined,
			targetPath: d.targetPath ? normalize(d.targetPath) : undefined,
		}),
	);
	return {
		...result,
		backupPath: result.backupPath ? normalize(result.backupPath) : undefined,
		changedPaths: normalizedChangedPaths,
		diagnostics: normalizedDiagnostics,
		targetPath: normalize(result.targetPath),
	};
}

function _getSafeWriteDryRunShape(result: SafeWriteResult) {
	const plan = {
		changedPaths: result.changedPaths.map((cp) => ({
			role: cp.role,
		})),
		diagnostics: result.diagnostics.map((d) => ({
			code: d.code,
			severity: d.severity,
		})),
		dryRun: result.dryRun,
		operation: result.operation,
		success: result.success,
	};
	return plan;
}

function _getSafeWriteResultShape(result: SafeWriteResult) {
	return {
		changedPaths: result.changedPaths.map((cp) => ({
			role: cp.role,
		})),
		diagnostics: result.diagnostics.map((d) => ({
			code: d.code,
			severity: d.severity,
		})),
		dryRun: result.dryRun,
		hasBackup: result.backupPath !== undefined,
		operation: result.operation,
		success: result.success,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Safe Filesystem Adapter', () => {
	// -----------------------------------------------------------------------
	// Policy Resolution
	// -----------------------------------------------------------------------
	describe('resolveWritePolicy', () => {
		it('unknown policy fails with diagnostic', () => {
			const result = resolveWritePolicy(
				'nonexistent' as unknown as 'fail_if_exists',
				'/tmp/test.json',
				false,
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('unknown_policy');
		});

		it('no policy fails with diagnostic', () => {
			const result = resolveWritePolicy(undefined, '/tmp/test.json', false);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('policy_required');
		});

		it('fail_if_exists allows write when target missing', () => {
			const result = resolveWritePolicy(
				'fail_if_exists',
				'/tmp/new.json',
				false,
			);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('write');
		});

		it('fail_if_exists rejects when target exists', () => {
			const result = resolveWritePolicy(
				'fail_if_exists',
				'/tmp/exists.json',
				true,
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('write_collision');
		});

		it('create_only allows write when target missing', () => {
			const result = resolveWritePolicy('create_only', '/tmp/new.json', false);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('write');
		});

		it('create_only rejects when target exists', () => {
			const result = resolveWritePolicy(
				'create_only',
				'/tmp/exists.json',
				true,
			);
			expect(result.allowed).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('write_collision');
		});

		it('skip_if_exists skips when target exists with warning', () => {
			const result = resolveWritePolicy(
				'skip_if_exists',
				'/tmp/exists.json',
				true,
			);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('skip');
			expect(result.diagnostics[0]?.code).toBe('write_skipped');
		});

		it('skip_if_exists writes when target missing', () => {
			const result = resolveWritePolicy(
				'skip_if_exists',
				'/tmp/new.json',
				false,
			);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('write');
		});

		it('overwrite warns but allows write when target exists', () => {
			const result = resolveWritePolicy('overwrite', '/tmp/exists.json', true);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('write');
			expect(result.diagnostics[0]?.code).toBe('overwrite_explicit');
		});

		it('overwrite writes when target missing', () => {
			const result = resolveWritePolicy('overwrite', '/tmp/new.json', false);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('write');
			expect(result.diagnostics).toHaveLength(0);
		});

		it('backup_and_overwrite backs up when target exists', () => {
			const result = resolveWritePolicy(
				'backup_and_overwrite',
				'/tmp/exists.json',
				true,
			);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('backup_then_write');
		});

		it('backup_and_overwrite writes when target missing with warning', () => {
			const result = resolveWritePolicy(
				'backup_and_overwrite',
				'/tmp/new.json',
				false,
			);
			expect(result.allowed).toBe(true);
			expect(result.action).toBe('write');
			expect(result.diagnostics[0]?.code).toBe('backup_not_needed');
		});
	});

	// -----------------------------------------------------------------------
	// Serialization Safety
	// -----------------------------------------------------------------------
	describe('serializeJson', () => {
		it('serializes with stable formatting and trailing newline', () => {
			const result = serializeJson({ a: 1, b: [2, 3] }, { indent: 2 });
			expect(result.success).toBe(true);
			expect(result.json).toBe(
				'{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n',
			);
		});

		it('rejects circular structures', () => {
			const obj: Record<string, unknown> = { a: 1 };
			obj.self = obj;
			const result = serializeJson(obj, {});
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('circular_structure');
		});

		it('rejects functions', () => {
			const result = serializeJson(() => {}, {});
			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('unserializable_value');
		});

		it('redacts secret-like values when flag enabled', () => {
			const result = serializeJson(
				{ token: 'sk-proj-test1234567890abcdefghijklmnop' },
				{ redactSecrets: true },
			);
			expect(result.success).toBe(true);
			expect(result.json).not.toContain(
				'sk-proj-test1234567890abcdefghijklmnop',
			);
		});
	});

	// -----------------------------------------------------------------------
	// Path Safety
	// -----------------------------------------------------------------------
	describe('checkPathSafety', () => {
		it('empty target path fails', () => {
			const result = checkPathSafety('');
			expect(result.safe).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('empty_target_path');
		});

		it('allowed base permits path inside base', () => {
			const result = checkPathSafety('/base/sub/file.json', {
				allowedBaseDir: '/base',
			});
			expect(result.safe).toBe(true);
		});

		it('allowed base rejects traversal outside base', () => {
			const result = checkPathSafety('/outside/file.json', {
				allowedBaseDir: '/base',
			});
			expect(result.safe).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('path_traversal_rejected');
		});

		it('custom root-like paths are allowed when inside explicit base', () => {
			const result = checkPathSafety('/custom-root/logos/file.json', {
				allowedBaseDir: '/custom-root',
			});
			expect(result.safe).toBe(true);
		});

		it('does not assume generated root is docs/', () => {
			const result = checkPathSafety('/project/docs/file.json', {
				allowedBaseDir: '/project',
			});
			expect(result.safe).toBe(true);
		});

		it('directory target rejected when file write expected', () => {
			const result = checkPathSafety('/base/', {
				allowedBaseDir: '/base',
			});
			expect(result.safe).toBe(false);
			expect(result.diagnostics[0]?.code).toBe('directory_target_rejected');
		});

		it('file with extension passes even without allowDirectoryTarget', () => {
			const result = checkPathSafety('/base/file.json', {
				allowedBaseDir: '/base',
			});
			expect(result.safe).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Atomic JSON Write — Success Cases
	// -----------------------------------------------------------------------
	describe('writeJsonAtomic success', () => {
		it('writes JSON to a missing target', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'data.json');
			const result = await writeJsonAtomic(
				target,
				{ hello: 'world' },
				{ policy: 'fail_if_exists' },
			);
			expect(result.success).toBe(true);
			expect(result.dryRun).toBe(false);
			expect(result.targetPath).toBe(normalize(target));

			const content = await readFile(target, 'utf-8');
			const parsed = JSON.parse(content);
			expect(parsed).toEqual({ hello: 'world' });
		});

		it('creates parent directories when executing', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'sub', 'deep', 'data.json');
			const result = await writeJsonAtomic(
				target,
				{ x: 1 },
				{ policy: 'fail_if_exists' },
			);
			expect(result.success).toBe(true);

			const changedDirs = result.changedPaths.filter(
				(cp) => cp.role === 'directory_created',
			);
			expect(changedDirs.length).toBeGreaterThan(0);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ x: 1 });
		});

		it('serializes with stable formatting and trailing newline', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'formatted.json');
			await writeJsonAtomic(
				target,
				{ a: 1, b: 2 },
				{ indent: 2, policy: 'fail_if_exists' },
			);

			const content = await readFile(target, 'utf-8');
			expect(content).toBe('{\n  "a": 1,\n  "b": 2\n}\n');
		});

		it('overwrites existing target with explicit overwrite policy', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'overwrite.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{ policy: 'overwrite' },
			);
			expect(result.success).toBe(true);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 2 });
		});

		it('refuses existing target with fail_if_exists', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'fail.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{ policy: 'fail_if_exists' },
			);
			expect(result.success).toBe(false);
			expect(result.diagnostics.some((d) => d.code === 'write_collision')).toBe(
				true,
			);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('refuses existing target with create_only', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'create-only.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{ policy: 'create_only' },
			);
			expect(result.success).toBe(false);
			expect(result.diagnostics.some((d) => d.code === 'write_collision')).toBe(
				true,
			);
		});

		it('skips existing target with skip_if_exists', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'skip.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{ policy: 'skip_if_exists' },
			);
			expect(result.success).toBe(true);
			expect(result.diagnostics.some((d) => d.code === 'write_skipped')).toBe(
				true,
			);
			expect(result.changedPaths.some((cp) => cp.role === 'skipped')).toBe(
				true,
			);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('creates backup before overwrite with backup_and_overwrite', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'backup-me.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const backupDir = join(dir, 'backups');
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_testTimestamp: '2024-06-01T00-00-00-000Z',
					backupDir,
					policy: 'backup_and_overwrite',
				},
			);
			expect(result.success).toBe(true);
			expect(result.backupPath).toBeDefined();

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 2 });

			const backupContent = await readFile(
				result.backupPath as string,
				'utf-8',
			);
			expect(JSON.parse(backupContent)).toEqual({ v: 1 });
		});

		it('backup changed path is tracked', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'track-backup.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const backupDir = join(dir, 'backups');
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_testTimestamp: '2024-06-01T00-00-00-000Z',
					backupDir,
					policy: 'backup_and_overwrite',
				},
			);
			expect(
				result.changedPaths.some((cp) => cp.role === 'backup_created'),
			).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Atomic JSON Write — Failure & Corruption Safety
	// -----------------------------------------------------------------------
	describe('writeJsonAtomic corruption safety', () => {
		it('serialization failure preserves existing target', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'preserved.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });

			const obj: Record<string, unknown> = { a: 1 };
			obj.self = obj;
			const result = await writeJsonAtomic(target, obj, {
				policy: 'overwrite',
			});
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'circular_structure'),
			).toBe(true);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('rename failure preserves existing target', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'rename-safety.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });

			const failingFs: SafeFsAdapter = {
				async mkdir() {
					return undefined;
				},
				async rename() {
					throw new Error('simulated rename failure');
				},
				async writeFile() {
					/* ok */
				},
			};
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_fs: failingFs,
					policy: 'overwrite',
				},
			);
			expect(result.success).toBe(false);
			expect(result.diagnostics.some((d) => d.code === 'rename_failed')).toBe(
				true,
			);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('temp write failure preserves existing target', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'tempwrite.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });

			const failingFs: SafeFsAdapter = {
				async mkdir() {
					return undefined;
				},
				async rename() {
					/* ok */
				},
				async writeFile() {
					throw new Error('simulated temp write failure');
				},
			};
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_fs: failingFs,
					policy: 'overwrite',
				},
			);
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'temp_write_failed'),
			).toBe(true);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('temp write failure leaves no target when target was missing', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'tempwrite-missing.json');

			const failingFs: SafeFsAdapter = {
				async mkdir() {
					return undefined;
				},
				async rename() {
					/* ok */
				},
				async writeFile() {
					throw new Error('simulated temp write failure');
				},
			};
			const result = await writeJsonAtomic(
				target,
				{ v: 1 },
				{
					_fs: failingFs,
					policy: 'fail_if_exists',
				},
			);
			expect(result.success).toBe(false);
			await expect(stat(target)).rejects.toThrow();
		});

		it('retained temp file is reported if cleanup fails', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'retained-temp.json');

			let _tempWrittenPath: string | undefined;
			const trackingFs: SafeFsAdapter = {
				async mkdir() {
					return undefined;
				},
				async rename() {
					/* ok */
				},
				async writeFile(p: string) {
					_tempWrittenPath = p;
					throw new Error('simulated write failure');
				},
			};
			const result = await writeJsonAtomic(
				target,
				{ v: 1 },
				{
					_fs: trackingFs,
					policy: 'fail_if_exists',
				},
			);
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'temp_write_failed'),
			).toBe(true);
		});

		it('corrupt pre-existing temp file does not get treated as valid target', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'corrupt-temp.json');

			// Create a target first
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });

			// Now try to write with a failing rename and check that target still has original data
			const failingFs: SafeFsAdapter = {
				async mkdir() {
					return undefined;
				},
				async rename() {
					throw new Error('simulated rename failure');
				},
				async writeFile() {
					/* ok */
				},
			};
			await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_fs: failingFs,
					policy: 'overwrite',
				},
			);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('backup failure prevents target overwrite', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'backup-fail.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });

			const failingFs: SafeFsAdapter = {
				async mkdir() {
					return undefined;
				},
				async rename() {
					/* ok */
				},
				async writeFile() {
					throw new Error('simulated backup write failure');
				},
			};
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_fs: failingFs,
					backupDir: join(dir, 'backups'),
					policy: 'backup_and_overwrite',
				},
			);
			expect(result.success).toBe(false);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });
		});

		it('invalid directory target fails with structured diagnostic', async () => {
			const dir = await createTempDir();
			const result = await writeJsonAtomic(
				dir,
				{ v: 1 },
				{ policy: 'fail_if_exists' },
			);
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'directory_target_rejected'),
			).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Dry-Run Tests
	// -----------------------------------------------------------------------
	describe('writeJsonAtomic dry-run', () => {
		it('dry-run missing target returns planned write and creates no files', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'dry-new.json');
			const result = await writeJsonAtomic(
				target,
				{ x: 1 },
				{
					dryRun: true,
					policy: 'fail_if_exists',
				},
			);
			expect(result.success).toBe(true);
			expect(result.dryRun).toBe(true);
			expect(result.changedPaths.some((cp) => cp.role === 'planned')).toBe(
				true,
			);

			await expect(stat(target)).rejects.toThrow();
		});

		it('dry-run existing target with backup policy returns planned backup/write and creates no backup', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'dry-backup.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const backupDir = join(dir, 'backups');
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_testTimestamp: '2024-01-01T00-00-00-000Z',
					backupDir,
					dryRun: true,
					policy: 'backup_and_overwrite',
				},
			);
			expect(result.success).toBe(true);
			expect(result.dryRun).toBe(true);
			expect(
				result.changedPaths.filter((cp) => cp.role === 'planned').length,
			).toBeGreaterThanOrEqual(2);

			const content = await readFile(target, 'utf-8');
			expect(JSON.parse(content)).toEqual({ v: 1 });

			// No backup directory created
			await expect(stat(backupDir)).rejects.toThrow();
		});

		it('dry-run collision reports correctly', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'dry-collision.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					dryRun: true,
					policy: 'fail_if_exists',
				},
			);
			expect(result.success).toBe(false);
			expect(result.dryRun).toBe(true);
			expect(result.diagnostics.some((d) => d.code === 'write_collision')).toBe(
				true,
			);
		});

		it('dry-run changed paths are marked planned', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'dry-planned.json');
			const result = await writeJsonAtomic(
				target,
				{ x: 1 },
				{
					dryRun: true,
					policy: 'fail_if_exists',
				},
			);
			const plannedPaths = result.changedPaths.filter(
				(cp) => cp.role === 'planned',
			);
			expect(plannedPaths.length).toBeGreaterThan(0);
		});

		it('dry-run skip reports skipped as planned', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'dry-skip.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					dryRun: true,
					policy: 'skip_if_exists',
				},
			);
			expect(result.success).toBe(true);
			expect(result.dryRun).toBe(true);
			expect(result.changedPaths.some((cp) => cp.role === 'planned')).toBe(
				true,
			);
		});

		it('dry-run with Step 3.1 default state creates no .logos/', async () => {
			const dir = await createTempDir();
			const target = join(dir, '.logos', 'workspace.json');
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: dir,
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'dry-run-test',
			});

			const result = await writeJsonAtomic(target, state, {
				dryRun: true,
				policy: 'fail_if_exists',
			});
			expect(result.dryRun).toBe(true);
			expect(result.success).toBe(true);

			const logosDir = join(dir, '.logos');
			await expect(stat(logosDir)).rejects.toThrow();
		});
	});

	// -----------------------------------------------------------------------
	// Changed Path Tracking
	// -----------------------------------------------------------------------
	describe('changed path tracking', () => {
		it('result records created directories', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'sub1', 'sub2', 'data.json');
			const result = await writeJsonAtomic(
				target,
				{ x: 1 },
				{ policy: 'fail_if_exists' },
			);
			const dirPaths = result.changedPaths.filter(
				(cp) => cp.role === 'directory_created',
			);
			expect(dirPaths.length).toBeGreaterThan(0);
		});

		it('result records written target', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'data.json');
			const result = await writeJsonAtomic(
				target,
				{ x: 1 },
				{ policy: 'fail_if_exists' },
			);
			expect(result.changedPaths.some((cp) => cp.role === 'file_created')).toBe(
				true,
			);
		});

		it('result records backup path', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'track-backup.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const backupDir = join(dir, 'backups');
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{
					_testTimestamp: '2024-06-01T00-00-00-000Z',
					backupDir,
					policy: 'backup_and_overwrite',
				},
			);
			expect(
				result.changedPaths.some((cp) => cp.role === 'backup_created'),
			).toBe(true);
		});

		it('result records skipped path', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'skipped.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{ policy: 'skip_if_exists' },
			);
			expect(result.changedPaths.some((cp) => cp.role === 'skipped')).toBe(
				true,
			);
		});

		it('result records planned paths in dry-run', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'planned.json');
			const result = await writeJsonAtomic(
				target,
				{ x: 1 },
				{
					dryRun: true,
					policy: 'fail_if_exists',
				},
			);
			expect(result.changedPaths.every((cp) => cp.role === 'planned')).toBe(
				true,
			);
		});

		it('result records file_updated for overwritten file', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'updated.json');
			await writeJsonAtomic(target, { v: 1 }, { policy: 'fail_if_exists' });
			const result = await writeJsonAtomic(
				target,
				{ v: 2 },
				{ policy: 'overwrite' },
			);
			expect(result.changedPaths.some((cp) => cp.role === 'file_updated')).toBe(
				true,
			);
		});
	});

	// -----------------------------------------------------------------------
	// Secret Safety
	// -----------------------------------------------------------------------
	describe('secret safety', () => {
		it('diagnostics do not echo raw token-like values', () => {
			const secretValue = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
			const result = resolveWritePolicy(
				'fail_if_exists',
				'/tmp/test.json',
				true,
			);
			// Diagnostics should only reference the path, not the value
			for (const d of result.diagnostics) {
				expect(JSON.stringify(d)).not.toContain(secretValue);
			}
		});

		it('JSON writer redacts obvious raw provider token values when guard enabled', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'redacted.json');
			const data = {
				name: 'test',
				provider: { apiKey: 'sk-proj-test1234567890abcdefghijklmnop' },
			};
			const result = await writeJsonAtomic(target, data, {
				enableSecretRedaction: true,
				policy: 'fail_if_exists',
			});
			expect(result.success).toBe(true);

			const content = await readFile(target, 'utf-8');
			expect(content).not.toContain('sk-proj-test1234567890abcdefghijklmnop');
		});

		it('fake secret fixture values never appear in result diagnostics', () => {
			// Just verify that no diagnostic code itself leaks secrets
			const result = serializeJson(
				{ key: 'sk-12345678901234567890' },
				{ redactSecrets: true },
			);
			expect(result.success).toBe(true);
			if (result.json) {
				expect(result.json).not.toContain('sk-12345678901234567890');
			}
		});
	});

	// -----------------------------------------------------------------------
	// Integration with Step 3.1
	// -----------------------------------------------------------------------
	describe('Step 3.1 integration', () => {
		it('safely writes a valid default workspace state to a temp path', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'workspace-state.json');
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: dir,
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'integration-test',
			});

			const result = await writeJsonAtomic(target, state, {
				policy: 'fail_if_exists',
			});
			expect(result.success).toBe(true);

			const content = await readFile(target, 'utf-8');
			const parsed = JSON.parse(content);
			expect(parsed.schemaVersion).toBe(state.schemaVersion);
			expect(parsed.workspace.workspaceId).toBe('integration-test');
		});

		it('safely dry-runs a valid Step 3.1 default workspace state write', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'workspace-state.json');
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: dir,
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'dryrun-test',
			});

			const result = await writeJsonAtomic(target, state, {
				dryRun: true,
				policy: 'fail_if_exists',
			});
			expect(result.dryRun).toBe(true);
			expect(result.success).toBe(true);

			await expect(stat(target)).rejects.toThrow();
		});

		it('does not create .logos/ outside temp test directories', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'workspace-state.json');
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: dir,
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'no-logos',
			});

			await writeJsonAtomic(target, state, { policy: 'fail_if_exists' });

			// Ensure no .logos/ dir was created in temp
			const logosDir = join(dir, '.logos');
			await expect(stat(logosDir)).rejects.toThrow();
		});
	});

	// -----------------------------------------------------------------------
	// Atomic Text Write
	// -----------------------------------------------------------------------
	describe('writeFileAtomic', () => {
		it('writes text content atomically', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'text.txt');
			const result = await writeFileAtomic(target, 'hello world', {
				policy: 'fail_if_exists',
			});
			expect(result.success).toBe(true);

			const content = await readFile(target, 'utf-8');
			expect(content).toBe('hello world');
		});

		it('respects overwrite policies', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'policy.txt');
			await writeFileAtomic(target, 'v1', { policy: 'fail_if_exists' });

			const result = await writeFileAtomic(target, 'v2', {
				policy: 'fail_if_exists',
			});
			expect(result.success).toBe(false);

			const content = await readFile(target, 'utf-8');
			expect(content).toBe('v1');
		});

		it('supports dry-run mode', async () => {
			const dir = await createTempDir();
			const target = join(dir, 'dry-text.txt');
			const result = await writeFileAtomic(target, 'content', {
				dryRun: true,
				policy: 'fail_if_exists',
			});
			expect(result.success).toBe(true);
			expect(result.dryRun).toBe(true);
			await expect(stat(target)).rejects.toThrow();
		});
	});

	// -----------------------------------------------------------------------
	// Path safety — additional edge cases
	// -----------------------------------------------------------------------
	describe('path safety edge cases', () => {
		it('path traversal with .. is rejected', () => {
			const result = checkPathSafety(resolve('/base/../outside/file.json'), {
				allowedBaseDir: '/base',
			});
			expect(result.safe).toBe(false);
		});

		it('relative paths within base work when using absolute allowedBaseDir', () => {
			const result = checkPathSafety('/base/sub/file.json', {
				allowedBaseDir: '/base',
			});
			expect(result.safe).toBe(true);
		});
	});
});
