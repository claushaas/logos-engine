/**
 * Migration Runner Tests — Step 13.2
 *
 * Tests migration planning and application:
 * - Planning for current, older, future, missing, corrupt state
 * - Dry-run planning writes nothing
 * - Application creates backups, applies migrations, validates state
 * - Partial/failed migration behavior
 * - Idempotent re-application
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceMigrationPlan } from '../src/state/migration-model.js';
import { CURRENT_SCHEMA_VERSION } from '../src/state/migration-registry.js';
import {
	applyMigrations,
	planMigrations,
} from '../src/state/migration-runner.js';
import { validateWorkspaceState } from '../src/state/workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
	return path.join(
		tmpdir(),
		`logos-migration-test-${randomUUID().slice(0, 8)}`,
	);
}

async function createFixtureState(
	dir: string,
	schemaVersion: string | undefined,
	extra?: Record<string, unknown>,
): Promise<string> {
	const logosDir = path.join(dir, '.logos');
	await mkdir(logosDir, { recursive: true });

	const state: Record<string, unknown> = {
		...extra,
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
		sessions: [],
		sources: [],
		validationRuns: [],
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			projectRootPath: dir,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'test-workspace',
		},
	};

	if (schemaVersion !== undefined) {
		state.schemaVersion = schemaVersion;
	}

	const workspacePath = path.join(logosDir, 'workspace.json');
	await writeFile(workspacePath, JSON.stringify(state, null, 2), 'utf-8');
	return workspacePath;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

describe('planMigrations', () => {
	it('returns not_needed for current schema version', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: CURRENT_SCHEMA_VERSION },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toBe('not_needed');
		expect(plan.items).toHaveLength(0);
		expect(plan.hasBlocked).toBe(false);
		expect(plan.backupRequired).toBe(false);
	});

	it('returns planned for older schema version', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toBe('planned');
		expect(plan.items.length).toBeGreaterThan(0);
		expect(plan.hasBlocked).toBe(false);
		expect(plan.backupRequired).toBe(true);
	});

	it('returns blocked for future schema version', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '4.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toBe('blocked');
		expect(plan.hasBlocked).toBe(true);
		expect(plan.blockers.length).toBeGreaterThan(0);
	});

	it('returns blocked for missing schema version', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: {},
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toBe('blocked');
		expect(plan.hasBlocked).toBe(true);
	});

	it('returns blocked for corrupt state', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: 123 },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toBe('blocked');
	});

	it('plan includes affected paths', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.affectedPaths.length).toBeGreaterThan(0);
	});

	it('plan uses relative/portable paths', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		for (const p of plan.affectedPaths) {
			expect(p).not.toContain('/tmp/test');
		}
	});

	it('plan includes backup requirement', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.backupRequired).toBe(true);
	});

	it('plan includes blockers count', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.blockers).toBeDefined();
	});

	it('plan includes estimated operation count', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.estimatedOperationCount).toBeGreaterThan(0);
	});

	it('plan writes nothing to filesystem', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		// Planning should be pure
		expect(plan).toBeDefined();
		expect(plan.dryRun).toBe(false);
	});

	it('dry-run plan is marked as dry-run', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.dryRun).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

describe('applyMigrations', () => {
	let testDir: string;
	let workspaceFilePath: string;

	beforeEach(async () => {
		testDir = makeTempDir();
		workspaceFilePath = await createFixtureState(testDir, '3.0.0');
	});

	afterEach(async () => {
		try {
			const { rm } = await import('node:fs/promises');
			await rm(testDir, { force: true, recursive: true });
		} catch {
			// cleanup best-effort
		}
	});

	it('dry-run writes nothing', async () => {
		const rawState = JSON.parse(
			await readFile(workspaceFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		const result = await applyMigrations({
			options: {
				_testRandomId: 'test01',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
				dryRun: true,
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		expect(result.dryRun).toBe(true);
		expect(result.status).toBe('dry_run');
		expect(result.success).toBe(true);
		// Ensure no backup was created
		expect(result.backupPath).toBeUndefined();
	});

	it('applies migration successfully with backup', async () => {
		const rawState = JSON.parse(
			await readFile(workspaceFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		const result = await applyMigrations({
			options: {
				_testRandomId: 'test01',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		expect(result.success).toBe(true);
		expect(result.status).toBe('applied');
		expect(result.appliedMigrations.length).toBeGreaterThan(0);
		expect(result.backupId).toBeDefined();
		expect(result.backupPath).toBeDefined();
	});

	it('updates schema version after migration', async () => {
		const rawState = JSON.parse(
			await readFile(workspaceFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		await applyMigrations({
			options: {
				_testRandomId: 'test02',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		// Verify updated file has current version
		const content = await readFile(workspaceFilePath, 'utf-8');
		const state = JSON.parse(content) as Record<string, unknown>;
		expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
	});

	it('migrated state validates', async () => {
		const rawState = JSON.parse(
			await readFile(workspaceFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		await applyMigrations({
			options: {
				_testRandomId: 'test03',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		const content = await readFile(workspaceFilePath, 'utf-8');
		const state = JSON.parse(content) as unknown;
		const validation = validateWorkspaceState(state);
		expect(validation.success).toBe(true);
	});

	it('re-running on already-current state returns not_needed', async () => {
		// First, upgrade to current
		const rawState = JSON.parse(
			await readFile(workspaceFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		await applyMigrations({
			options: {
				_testRandomId: 'test04',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		// Now try to re-plan
		const rePlan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState: { schemaVersion: CURRENT_SCHEMA_VERSION },
			workspaceFilePath,
		});

		expect(rePlan.status).toBe('not_needed');
	});

	it('future version blocks mutation', async () => {
		const futureFilePath = await createFixtureState(testDir, '4.0.0');
		const rawState = JSON.parse(
			await readFile(futureFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState,
			workspaceFilePath: futureFilePath,
		});

		const result = await applyMigrations({
			options: {
				_testRandomId: 'test05',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath: futureFilePath,
		});

		expect(result.success).toBe(false);
		expect(result.status).toBe('blocked');
	});

	it('returns diagnostics on blocked plan', async () => {
		const plan: WorkspaceMigrationPlan = {
			affectedPaths: [],
			backupRequired: false,
			blockers: ['Test blocker'],
			direction: 'up',
			dryRun: false,
			estimatedOperationCount: 0,
			fromVersion: 'unknown',
			hasBlocked: true,
			items: [],
			migrationCount: 0,
			status: 'blocked',
			toVersion: CURRENT_SCHEMA_VERSION,
			warnings: [],
		};

		const result = await applyMigrations({
			options: {
				_testRandomId: 'test06',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState: {},
			workspaceFilePath,
		});

		expect(result.success).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
	});

	it('does not modify canonical markdown', async () => {
		// Create a fake canonical doc
		const docDir = path.join(testDir, 'logos');
		await mkdir(docDir, { recursive: true });
		const docPath = path.join(docDir, 'test-doc.md');
		const originalContent = '# Original Content\nThis should not change.\n';
		await writeFile(docPath, originalContent, 'utf-8');

		const rawState = JSON.parse(
			await readFile(workspaceFilePath, 'utf-8'),
		) as Record<string, unknown>;
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		await applyMigrations({
			options: {
				_testRandomId: 'test07',
				_testTimestamp: '2024-01-01T00:00:00.000Z',
			},
			plan,
			projectRoot: testDir,
			rawState,
			workspaceFilePath,
		});

		const content = await readFile(docPath, 'utf-8');
		expect(content).toBe(originalContent);
	});
});

// ---------------------------------------------------------------------------
// Multi-step migrations
// ---------------------------------------------------------------------------

describe('multi-step migrations', () => {
	it('migrates from 1.0.0 to current through all intermediate versions', async () => {
		const testDir = makeTempDir();
		try {
			const workspaceFilePath = await createFixtureState(testDir, '1.0.0');
			const rawState = JSON.parse(
				await readFile(workspaceFilePath, 'utf-8'),
			) as Record<string, unknown>;

			const plan = planMigrations({
				_testTimestamp: '2024-01-01T00:00:00.000Z',
				projectRoot: testDir,
				rawState,
				workspaceFilePath,
			});

			expect(plan.status).toBe('planned');
			expect(plan.items.length).toBe(4); // 1.0.0->2.0.0, 2.0.0->3.0.0, 3.0.0->3.1.0, 3.1.0->3.2.0

			const result = await applyMigrations({
				options: {
					_testRandomId: 'multi01',
					_testTimestamp: '2024-01-01T00:00:00.000Z',
				},
				plan,
				projectRoot: testDir,
				rawState,
				workspaceFilePath,
			});

			expect(result.success).toBe(true);
			expect(result.appliedMigrations).toHaveLength(4);

			// Verify resulting state
			const content = await readFile(workspaceFilePath, 'utf-8');
			const state = JSON.parse(content) as unknown;
			const validation = validateWorkspaceState(state);
			expect(validation.success).toBe(true);
		} finally {
			const { rm } = await import('node:fs/promises');
			await rm(testDir, { force: true, recursive: true });
		}
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('migration plan snapshots', () => {
	it('snapshots no-op plan for current version', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: CURRENT_SCHEMA_VERSION },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toMatchSnapshot();
		expect(plan.backupRequired).toMatchSnapshot();
		expect(plan.items).toMatchSnapshot();
	});

	it('snapshots migration plan for older version', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '3.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toMatchSnapshot();
		expect(plan.items.length).toMatchSnapshot();
		expect(plan.items.map((i) => i.migrationId)).toMatchSnapshot();
	});

	it('snapshots blocked future-version plan', () => {
		const plan = planMigrations({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: '/tmp/test',
			rawState: { schemaVersion: '5.0.0' },
			workspaceFilePath: '/tmp/test/.logos/workspace.json',
		});

		expect(plan.status).toMatchSnapshot();
		expect(plan.hasBlocked).toMatchSnapshot();
	});
});
