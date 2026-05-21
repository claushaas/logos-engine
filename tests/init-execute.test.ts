import { existsSync, mkdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initWorkspace } from '../src/init/init-execute.js';
import { validateWorkspaceState } from '../src/state/workspace-state-validation.js';

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-init-exec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('initWorkspace (execution)', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('unconfirmed init discloses paths and writes nothing', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});
		expect(result.success).toBe(false);
		expect(result.mode).toBe('confirm_only');
		expect(result.messages.join('\n')).toContain('Target paths:');
		expect(existsSync(join(tempDir, '.logos'))).toBe(false);
	});

	it('confirmed init creates .logos/ in a temp project', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(result.success).toBe(true);
		expect(result.status).toBe('success');
		expect(existsSync(join(tempDir, '.logos'))).toBe(true);
	});

	it('confirmed init writes valid workspace state', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});

		expect(result.success).toBe(true);
		const statePath = join(tempDir, '.logos', 'workspace.json');
		expect(existsSync(statePath)).toBe(true);

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(statePath, 'utf-8');
		const parsed = JSON.parse(raw);
		const validation = validateWorkspaceState(parsed);
		expect(validation.success).toBe(true);
	});

	it('persisted state records active profile standard', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			profileId: 'standard',
			projectRoot: tempDir,
		});

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(
			join(tempDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const parsed = JSON.parse(raw);
		expect(parsed.profile.profileId).toBe('standard');
		expect(parsed.profile.source).toBe('bundled');
	});

	it('persisted state records documentation root logos/ by default', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(
			join(tempDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const parsed = JSON.parse(raw);
		expect(parsed.documentation.rootPath).toBe('logos/');
		expect(parsed.documentation.isDefault).toBe(true);
	});

	it('custom root persist test persists the custom root', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			documentationRoot: 'my-project-docs/',
			projectRoot: tempDir,
		});

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(
			join(tempDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const parsed = JSON.parse(raw);
		expect(parsed.documentation.rootPath).toBe('my-project-docs');
		expect(parsed.documentation.isDefault).toBe(false);
		expect(parsed.documentation.wasExplicitlyConfigured).toBe(true);
	});

	it('created timestamp is deterministic when test clock is injected', async () => {
		await initWorkspace({
			_testTimestamp: '2024-06-15T12:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(
			join(tempDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const parsed = JSON.parse(raw);
		expect(parsed.workspace.createdAt).toBe('2024-06-15T12:00:00.000Z');
	});

	it('changed paths include .logos/ and state file', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(result.success).toBe(true);
		const paths = result.changedPaths.map((cp) => cp.path);
		expect(paths.some((p) => p.includes('.logos'))).toBe(true);
	});

	it('init does not generate canonical docs', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(existsSync(join(tempDir, 'logos'))).toBe(false);
	});

	it('init does not create documentation Markdown files', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});

		const { readdirSync } = await import('node:fs');
		const entries = readdirSync(tempDir);
		expect(entries.filter((e: string) => e.endsWith('.md')).length).toBe(0);
	});

	it('existing .logos/ valid state reports already initialized', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });
		writeFileSync(
			join(logosDir, 'workspace.json'),
			JSON.stringify({
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
					workspaceId: 'existing',
				},
			}),
		);

		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(result.status).toBe('already_initialized');
		expect(result.success).toBe(false);
	});

	it('existing .logos/ partial state reports partial collision', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });

		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(result.status).toBe('error');
		expect(result.success).toBe(false);
	});

	it('existing invalid state reports invalid collision', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });
		writeFileSync(join(logosDir, 'workspace.json'), '{invalid json here');

		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(result.status).toBe('error');
		expect(result.success).toBe(false);
	});

	it('existing state file is not overwritten by default', async () => {
		const logosDir = join(tempDir, '.logos');
		mkdirSync(logosDir, { recursive: true });
		const originalContent = JSON.stringify({
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
				workspaceId: 'original',
			},
		});
		writeFileSync(join(logosDir, 'workspace.json'), originalContent);

		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			confirm: true,
			projectRoot: tempDir,
		});
		expect(result.success).toBe(false);
		expect(result.status).toBe('already_initialized');

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(join(logosDir, 'workspace.json'), 'utf-8');
		expect(raw).toBe(originalContent);
	});

	it('dry-run init returns planned paths', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: tempDir,
		});
		expect(result.mode).toBe('dry_run');
		expect(result.status).toBe('dry_run');
		const text = result.messages.join('\n');
		expect(text).toContain('dry-run');
		expect(text).toContain(tempDir);
	});

	it('dry-run init does not create .logos/', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: tempDir,
		});
		expect(existsSync(join(tempDir, '.logos'))).toBe(false);
	});

	it('dry-run init does not write state file', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: tempDir,
		});
		expect(existsSync(join(tempDir, '.logos', 'workspace.json'))).toBe(false);
	});

	it('dry-run changed paths are marked planned', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			dryRun: true,
			projectRoot: tempDir,
		});
		expect(result.changedPaths.length).toBeGreaterThan(0);
		expect(result.changedPaths.every((cp) => cp.action === 'planned')).toBe(
			true,
		);
	});

	it('workspace id is deterministic when injected', async () => {
		await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'test-id-001',
			confirm: true,
			projectRoot: tempDir,
		});

		const { readFileSync } = await import('node:fs');
		const raw = readFileSync(
			join(tempDir, '.logos', 'workspace.json'),
			'utf-8',
		);
		const parsed = JSON.parse(raw);
		expect(parsed.workspace.workspaceId).toBe('test-id-001');
	});
});
