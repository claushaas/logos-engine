/**
 * Restore Service Tests — Step 13.2
 *
 * Tests safe workspace state restoration from backups:
 * - Dry-run planning
 * - Actual restore with pre-restore backup
 * - Collision detection
 * - Path safety blocks
 * - Restored state validation
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorkspaceBackup } from '../src/state/backup-service.js';
import type { WorkspaceBackupManifest } from '../src/state/migration-model.js';
import {
	planRestore,
	restoreWorkspaceFromBackup,
} from '../src/state/restore-service.js';
import { WORKSPACE_STATE_SCHEMA_VERSION } from '../src/state/workspace-state.schema.js';
import { validateWorkspaceState } from '../src/state/workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
	return path.join(tmpdir(), `logos-restore-test-${randomUUID().slice(0, 8)}`);
}

function createMinimalState(dir: string): Record<string, unknown> {
	return {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		claimSourceLinks: [],
		claims: [],
		decisions: [],
		documentation: {
			isDefault: true,
			rootPath: 'logos/',
			wasExplicitlyConfigured: false,
		},
		generationRuns: [],
		migrations: [],
		openQuestions: [],
		profile: { profileId: 'standard', source: 'bundled' },
		proposals: [],
		registers: {
			assumptions: [],
			decisions: [],
			hypotheses: [],
			lifecycleEvents: [],
			openQuestions: [],
			risks: [],
		},
		risks: [],
		runs: [],
		schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
		sessions: [],
		sources: [],
		validationRuns: [],
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			projectRootPath: dir,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'restore-test-workspace',
		},
	};
}

async function setupFixtureWorkspace(dir: string): Promise<void> {
	const logosDir = path.join(dir, '.logos');
	await mkdir(logosDir, { recursive: true });
	const state = createMinimalState(dir);
	await writeFile(
		path.join(logosDir, 'workspace.json'),
		JSON.stringify(state, null, 2),
		'utf-8',
	);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

describe('planRestore', () => {
	it('lists target paths', () => {
		const manifest: WorkspaceBackupManifest = {
			backupId: 'test-backup',
			categories: ['state'],
			checksums: { 'workspace.json': 'abc' },
			createdAt: '2024-01-01T00:00:00.000Z',
			fileSizes: { 'workspace.json': 100 },
			includedPaths: ['workspace.json'],
			manifestVersion: '1.0.0',
			reason: 'Test',
			schemaVersion: '3.2.0',
			sourceWorkspacePath: '.',
		};

		const plan = planRestore(manifest, '/tmp/test');
		expect(plan.targetPaths.length).toBeGreaterThan(0);
		expect(plan.blocked).toBe(false);
		expect(plan.preRestoreBackupRequired).toBe(true);
	});

	it('produces deterministic plan', () => {
		const manifest: WorkspaceBackupManifest = {
			backupId: 'test-backup',
			categories: ['state'],
			checksums: {},
			createdAt: '2024-01-01T00:00:00.000Z',
			fileSizes: {},
			includedPaths: ['workspace.json'],
			manifestVersion: '1.0.0',
			reason: 'Test',
			schemaVersion: '3.2.0',
			sourceWorkspacePath: '.',
		};

		const plan1 = planRestore(manifest, '/tmp/test');
		const plan2 = planRestore(manifest, '/tmp/test');
		expect(plan1.targetPaths).toEqual(plan2.targetPaths);
		expect(plan1.operationCount).toBe(plan2.operationCount);
	});
});

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

describe('restoreWorkspaceFromBackup', () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = makeTempDir();
		await setupFixtureWorkspace(testDir);
	});

	afterEach(async () => {
		try {
			await rm(testDir, { force: true, recursive: true });
		} catch {
			/* cleanup */
		}
	});

	it('restore dry-run writes nothing', async () => {
		// Create a backup first
		const backupResult = await createWorkspaceBackup({
			_testRandomId: 'res01',
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			reason: 'Restore test',
		});

		expect(backupResult.success).toBe(true);

		// Modify state to make restore meaningful
		const modifiedState = createMinimalState(testDir);
		modifiedState.workspace = {
			createdAt: '2025-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			projectRootPath: testDir,
			updatedAt: '2025-01-01T00:00:00.000Z',
			workspaceId: 'modified-workspace',
		};
		await writeFile(
			path.join(testDir, '.logos', 'workspace.json'),
			JSON.stringify(modifiedState, null, 2),
			'utf-8',
		);

		// Dry-run restore
		const restoreResult = await restoreWorkspaceFromBackup({
			_testRandomId: 'res02',
			_testTimestamp: '2024-01-02T00:00:00.000Z',
			dryRun: true,
			manifestPath: backupResult.manifestPath as string,
			projectRoot: testDir,
		});

		expect(restoreResult.dryRun).toBe(true);
		expect(restoreResult.status).toBe('dry_run');
		expect(restoreResult.success).toBe(true);

		// Verify state was NOT modified
		const content = await readFile(
			path.join(testDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(content) as Record<string, unknown>;
		expect((state.workspace as Record<string, unknown>).workspaceId).toBe(
			'modified-workspace',
		);
	});

	it('successful restore with pre-restore backup created', async () => {
		// Create backup of original state
		const backupResult = await createWorkspaceBackup({
			_testRandomId: 'res03',
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			reason: 'Restore test',
		});

		expect(backupResult.success).toBe(true);

		// Modify state
		const modifiedState = createMinimalState(testDir);
		modifiedState.workspace = {
			createdAt: '2025-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			projectRootPath: testDir,
			updatedAt: '2025-01-01T00:00:00.000Z',
			workspaceId: 'modified-workspace',
		};
		await writeFile(
			path.join(testDir, '.logos', 'workspace.json'),
			JSON.stringify(modifiedState, null, 2),
			'utf-8',
		);

		// Restore from backup
		const restoreResult = await restoreWorkspaceFromBackup({
			_testRandomId: 'res04',
			_testTimestamp: '2024-01-02T00:00:00.000Z',
			manifestPath: backupResult.manifestPath as string,
			projectRoot: testDir,
		});

		expect(restoreResult.success).toBe(true);
		expect(restoreResult.status).toBe('restored');
		expect(restoreResult.preRestoreBackupId).toBeDefined();

		// Verify state was restored
		const content = await readFile(
			path.join(testDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(content) as Record<string, unknown>;
		expect((state.workspace as Record<string, unknown>).workspaceId).toBe(
			'restore-test-workspace',
		);
	});

	it('restored state passes validation', async () => {
		const backupResult = await createWorkspaceBackup({
			_testRandomId: 'res05',
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			reason: 'Restore test',
		});

		// Corrupt current state
		await writeFile(
			path.join(testDir, '.logos', 'workspace.json'),
			'invalid json here',
			'utf-8',
		);

		// Restore from backup
		const restoreResult = await restoreWorkspaceFromBackup({
			_testRandomId: 'res06',
			_testTimestamp: '2024-01-02T00:00:00.000Z',
			manifestPath: backupResult.manifestPath as string,
			projectRoot: testDir,
		});

		expect(restoreResult.success).toBe(true);

		// Validate restored state
		const content = await readFile(
			path.join(testDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(content) as unknown;
		const validation = validateWorkspaceState(state);
		expect(validation.success).toBe(true);
	});

	it('blocks restore with path traversal in manifest', async () => {
		// Create a backup
		const backupResult = await createWorkspaceBackup({
			_testRandomId: 'res07',
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			reason: 'Restore test',
		});

		// Corrupt the manifest with path traversal
		const manifest = JSON.parse(
			await readFile(backupResult.manifestPath as string, 'utf-8'),
		) as WorkspaceBackupManifest;
		manifest.includedPaths.push('../etc/passwd');
		await writeFile(
			backupResult.manifestPath as string,
			JSON.stringify(manifest, null, 2),
			'utf-8',
		);

		const restoreResult = await restoreWorkspaceFromBackup({
			_testRandomId: 'res08',
			_testTimestamp: '2024-01-02T00:00:00.000Z',
			manifestPath: backupResult.manifestPath as string,
			projectRoot: testDir,
		});

		expect(restoreResult.success).toBe(false);
		expect(restoreResult.status).toBe('blocked');
	});

	it('fails gracefully with missing manifest file', async () => {
		const restoreResult = await restoreWorkspaceFromBackup({
			_testRandomId: 'res09',
			_testTimestamp: '2024-01-02T00:00:00.000Z',
			manifestPath: path.join(
				testDir,
				'.logos',
				'backups',
				'nonexistent',
				'backup-manifest.json',
			),
			projectRoot: testDir,
		});

		expect(restoreResult.success).toBe(false);
		expect(restoreResult.status).toBe('failed');
		expect(restoreResult.diagnostics.length).toBeGreaterThan(0);
	});

	it('does not modify canonical markdown during restore', async () => {
		// Create a canonical doc
		const docDir = path.join(testDir, 'logos');
		await mkdir(docDir, { recursive: true });
		const docPath = path.join(docDir, 'test.md');
		await writeFile(docPath, '# Original\n', 'utf-8');

		const backupResult = await createWorkspaceBackup({
			_testRandomId: 'res10',
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			reason: 'Restore test',
		});

		const restoreResult = await restoreWorkspaceFromBackup({
			_testRandomId: 'res11',
			_testTimestamp: '2024-01-02T00:00:00.000Z',
			manifestPath: backupResult.manifestPath as string,
			projectRoot: testDir,
		});

		expect(restoreResult.success).toBe(true);

		const content = await readFile(docPath, 'utf-8');
		expect(content).toBe('# Original\n');
	});

	it('does not write outside project root', async () => {
		const backupResult = await createWorkspaceBackup({
			_testRandomId: 'res12',
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			reason: 'Restore test',
		});

		// Create a file outside project root to verify it's untouched
		const outsideFile = path.join(
			tmpdir(),
			`outside-${randomUUID().slice(0, 8)}.txt`,
		);
		await writeFile(outsideFile, 'outside', 'utf-8');

		try {
			const restoreResult = await restoreWorkspaceFromBackup({
				_testRandomId: 'res13',
				_testTimestamp: '2024-01-02T00:00:00.000Z',
				manifestPath: backupResult.manifestPath as string,
				projectRoot: testDir,
			});

			expect(restoreResult.success).toBe(true);

			// Verify outside file is untouched
			const outsideContent = await readFile(outsideFile, 'utf-8');
			expect(outsideContent).toBe('outside');
		} finally {
			try {
				await rm(outsideFile, { force: true });
			} catch {
				/* ignore */
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

describe('restore plan snapshot', () => {
	it('snapshots restore plan', () => {
		const manifest: WorkspaceBackupManifest = {
			backupId: 'test-backup',
			categories: ['state'],
			checksums: { 'workspace.json': 'abc123' },
			createdAt: '2024-01-01T00:00:00.000Z',
			fileSizes: { 'workspace.json': 1024 },
			includedPaths: ['workspace.json'],
			manifestVersion: '1.0.0',
			reason: 'Test backup',
			schemaVersion: '3.2.0',
			sourceWorkspacePath: '.',
		};

		const plan = planRestore(manifest, '/tmp/test-project');
		expect(plan.targetPaths).toMatchSnapshot();
		expect(plan.operationCount).toMatchSnapshot();
		expect(plan.preRestoreBackupRequired).toMatchSnapshot();
	});
});
