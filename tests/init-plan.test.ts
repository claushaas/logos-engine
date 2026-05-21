import { existsSync, mkdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planInitWorkspace, preflightInit } from '../src/init/init-plan.js';
import { validateWorkspaceState } from '../src/state/workspace-state-validation.js';

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-init-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanupTempDir(dir: string): void {
	try {
		rmdirSync(dir, { recursive: true });
	} catch {
		// best effort
	}
}

describe('planInitWorkspace', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('plans default init with documentation root logos/', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.executable).toBe(true);
		expect(plan.collision.kind).toBe('none');
		expect(plan.targetPaths.documentationRoot).toBe('logos/');
		expect(plan.targetPaths.logosDir).toBe(join(tempDir, '.logos'));
		expect(plan.targetPaths.workspaceStateFile).toBe(
			join(tempDir, '.logos', 'workspace.json'),
		);
		expect(plan.documentationRoot.isDefault).toBe(true);
		expect(plan.documentationRoot.rootPath).toBe('logos/');
	});

	it('plans selected profile standard', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'standard',
			projectRoot: tempDir,
		});
		expect(plan.profile.profileId).toBe('standard');
		expect(plan.profile.source).toBe('bundled');
		expect(plan.profile.validated).toBe(true);
		expect(plan.state.profile.profileId).toBe('standard');
	});

	it('plan includes .logos/ target paths', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.targetPaths.logosDir).toContain('.logos');
		expect(plan.targetPaths.workspaceStateFile).toContain('workspace.json');
	});

	it('plan validates default workspace state', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		const validation = validateWorkspaceState(plan.state);
		expect(validation.success).toBe(true);
		expect(validation.errors).toEqual([]);
	});

	it('plan does not write files', async () => {
		await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(existsSync(join(tempDir, '.logos'))).toBe(false);
	});

	it('custom documentation root is accepted when inside project root', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			documentationRoot: 'my-docs/',
			projectRoot: tempDir,
		});
		expect(plan.documentationRoot.rootPath).toBe('my-docs');
		expect(plan.documentationRoot.isDefault).toBe(false);
		expect(plan.documentationRoot.wasExplicitlyConfigured).toBe(true);
		expect(plan.documentationRoot.valid).toBe(true);
	});

	it('custom documentation root rejects traversal outside project root', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			documentationRoot: '../../../outside',
			projectRoot: tempDir,
		});
		expect(plan.documentationRoot.valid).toBe(false);
		expect(plan.executable).toBe(false);
		expect(
			plan.diagnostics.some((d) => d.code === 'doc_root_traversal_rejected'),
		).toBe(true);
	});

	it('empty documentation root is rejected', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			documentationRoot: '',
			projectRoot: tempDir,
		});
		expect(plan.executable).toBe(false);
		expect(
			plan.diagnostics.some((d) => d.code === 'empty_documentation_root'),
		).toBe(true);
	});

	it('unknown profile fails with structured diagnostic', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'nonexistent-profile',
			projectRoot: tempDir,
		});
		expect(plan.profile.validated).toBe(false);
		expect(
			plan.diagnostics.some(
				(d) =>
					d.code === 'LOGOS_PROFILE_REGISTRY_MISSING' ||
					d.code === 'unknown_profile',
			),
		).toBe(true);
	});

	it('existing .logos/ valid state reports already initialized', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });
		const state = {
			artifacts: [],
			assumptions: [],
			auditEvents: [],
			decisions: [],
			documentation: {
				isDefault: true,
				rootPath: 'logos/',
				wasExplicitlyConfigured: false,
			},
			generationRuns: [],
			migrations: [],
			openQuestions: [],
			profile: {
				lockedAt: '2024-01-01T00:00:00.000Z',
				profileId: 'standard',
				source: 'bundled',
			},
			risks: [],
			schemaVersion: '3.2.0',
			sessions: [],
			validationRuns: [],
			workspace: {
				createdAt: '2024-01-01T00:00:00.000Z',
				initializationState: 'initialized',
				projectRootPath: tempDir,
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'existing-workspace',
			},
		};
		writeFileSync(
			join(logosDir, 'workspace.json'),
			JSON.stringify(state, null, 2),
		);

		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.collision.kind).toBe('workspace_state_exists');
		expect(plan.executable).toBe(false);
	});

	it('existing .logos/ partial state reports partial collision', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });

		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.collision.kind).toBe('partial_logos_dir');
	});

	it('existing invalid state reports invalid collision', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });
		writeFileSync(join(logosDir, 'workspace.json'), 'not valid json{{{');

		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.collision.kind).toBe('invalid_existing_state');
		expect(plan.executable).toBe(false);
	});

	it('persisted state records active profile standard', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'standard',
			projectRoot: tempDir,
		});
		expect(plan.state.profile.profileId).toBe('standard');
		expect(plan.state.profile.source).toBe('bundled');
	});

	it('persisted state records documentation root logos/ by default', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.state.documentation.rootPath).toBe('logos/');
		expect(plan.state.documentation.isDefault).toBe(true);
	});

	it('created timestamp is deterministic when test clock is injected', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-06-15T12:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.state.workspace.createdAt).toBe('2024-06-15T12:00:00.000Z');
		expect(plan.state.workspace.updatedAt).toBe('2024-06-15T12:00:00.000Z');
		expect(plan.state.profile.lockedAt).toBe('2024-06-15T12:00:00.000Z');
	});

	it('state initializes with initialised state', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.state.workspace.initializationState).toBe('initialized');
	});

	it('paths are disclosed in plan', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.pathsDisclosed).toBe(true);
	});

	it('state includes schema version', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(plan.state.schemaVersion).toBe('3.2.0');
	});
});

describe('preflightInit', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('returns safe preflight for valid project', async () => {
		const result = await preflightInit({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(result.safe).toBe(true);
		expect(result.targetPaths.projectRoot).toBe(tempDir);
		expect(result.profile.profileId).toBe('standard');
	});

	it('preflight returns mode normal by default', async () => {
		const result = await preflightInit({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(result.mode).toBe('normal');
	});

	it('preflight returns mode dry_run when dryRun is set', async () => {
		const result = await preflightInit({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: tempDir,
		});
		expect(result.mode).toBe('dry_run');
	});
});
