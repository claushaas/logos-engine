/**
 * Documentation Root TUI Command tests — slash router integration.
 *
 * Phase 6: Documentation Root Configuration — TUI command tests.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { routeSlashCommand } from '../src/tui/slash-router.js';
import type { RouterContext } from '../src/tui/types.js';

describe('root TUI command', () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			try {
				const { rm } = await import('node:fs/promises');
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ok
			}
		}
	});

	function makeContext(projectRoot: string): RouterContext {
		return {
			interactive: false,
			projectContext: {
				config: {
					activeProfileId: 'standard',
					diagnostics: [],
					documentationRoot: {
						isDefault: true,
						rootPath: 'logos/',
					},
					providerStatus: { kind: 'not_configured' },
				},
				cwd: projectRoot,
				diagnostics: [],
				root: {
					cwd: projectRoot,
					inferred: false,
					rootKind: 'explicit',
					rootPath: projectRoot,
				},
				workspace: {
					diagnostics: [],
					exists: true,
					initializationState: 'initialized',
					logosPath: join(projectRoot, '.logos'),
				},
			},
		};
	}

	async function setupProject(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), 'logos-root-cmd-test-'));
		tempDir = dir;

		const logosDir = join(dir, '.logos');
		await mkdir(logosDir, { recursive: true });
		const state = {
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
			intakeTurns: [],
			migrations: [],
			openQuestions: [],
			profile: {
				profileId: 'standard',
				source: 'bundled',
			},
			proposals: [],
			risks: [],
			runs: [],
			schemaVersion: '3.2.0',
			sessions: [],
			sources: [],
			validationRuns: [],
			workspace: {
				createdAt: new Date().toISOString(),
				initializationState: 'initialized',
				projectRootPath: dir,
				updatedAt: new Date().toISOString(),
				workspaceId: 'test-ws-id',
			},
		};
		await writeFile(
			join(logosDir, 'workspace.json'),
			JSON.stringify(state, null, 2),
		);

		return dir;
	}

	it('/root shows root status', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'root', raw: '/root' },
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.kind).toBe('info');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.some((m) => m.includes('Documentation Root'))).toBe(
			true,
		);
	});

	it('/root status shows root status', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{ args: ['status'], kind: 'slash', name: 'root', raw: '/root status' },
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.kind).toBe('info');
		expect(result.messages.some((m) => m.includes('logos'))).toBe(true);
	});

	it('/root preview <path> shows preview without mutation', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['preview', 'my-docs'],
				kind: 'slash',
				name: 'root',
				raw: '/root preview my-docs',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.kind).toBe('info');
		expect(result.messages.some((m) => m.includes('Preview'))).toBe(true);
		expect(result.messages.some((m) => m.includes('my-docs'))).toBe(true);
	});

	it('/root preview without path returns error', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['preview'],
				kind: 'slash',
				name: 'root',
				raw: '/root preview',
			},
			ctx,
		);

		expect(result.kind).toBe('error');
	});

	it('/root set <path> creates confirmation', async () => {
		const projectRoot = await setupProject();
		const ctx = { ...makeContext(projectRoot), interactive: true };

		const result = await routeSlashCommand(
			{
				args: ['set', 'my-docs'],
				kind: 'slash',
				name: 'root',
				raw: '/root set my-docs',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		// With interactive=true, we should get a confirmation request
		expect(result.confirmationRequest).toBeDefined();
		if (result.confirmationRequest) {
			expect(result.confirmationRequest.actionKind).toBe('config_change');
		}
	});

	it('/root set <path> --dry-run shows dry-run', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['set', 'my-docs', '--dry-run'],
				kind: 'slash',
				name: 'root',
				raw: '/root set my-docs --dry-run',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.messages.some((m) => m.includes('Dry-run'))).toBe(true);
	});

	it('/root set <path> --confirm applies change', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['set', 'custom-root', '--confirm'],
				kind: 'slash',
				name: 'root',
				raw: '/root set custom-root --confirm',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.kind).toBe('success');

		// Verify state was updated
		const { readFileSync } = await import('node:fs');
		const stateRaw = readFileSync(
			join(projectRoot, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(stateRaw);
		expect(state.documentation.rootPath).toBe('custom-root');
	});

	it('canceling confirmation writes nothing', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		// Without --confirm and without interactive, nothing should be written
		const result = await routeSlashCommand(
			{
				args: ['set', 'should-not-apply'],
				kind: 'slash',
				name: 'root',
				raw: '/root set should-not-apply',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		// Verify state is unchanged
		const { readFileSync } = await import('node:fs');
		const stateRaw = readFileSync(
			join(projectRoot, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(stateRaw);
		expect(state.documentation.rootPath).toBe('logos/');
	});

	it('/root reset --dry-run previews reset', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['reset', '--dry-run'],
				kind: 'slash',
				name: 'root',
				raw: '/root reset --dry-run',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.kind).toBe('info');
	});

	it('/root reset creates confirmation when interactive', async () => {
		const projectRoot = await setupProject();
		// First set to custom
		await routeSlashCommand(
			{
				args: ['set', 'custom-root', '--confirm'],
				kind: 'slash',
				name: 'root',
				raw: '/root set custom-root --confirm',
			},
			makeContext(projectRoot),
		);

		const ctx = { ...makeContext(projectRoot), interactive: true };
		const result = await routeSlashCommand(
			{
				args: ['reset'],
				kind: 'slash',
				name: 'root',
				raw: '/root reset',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.confirmationRequest).toBeDefined();
	});

	it('/root reset --confirm applies reset', async () => {
		const projectRoot = await setupProject();
		// First set to custom
		await routeSlashCommand(
			{
				args: ['set', 'custom-root', '--confirm'],
				kind: 'slash',
				name: 'root',
				raw: '/root set custom-root --confirm',
			},
			makeContext(projectRoot),
		);

		const result = await routeSlashCommand(
			{
				args: ['reset', '--confirm'],
				kind: 'slash',
				name: 'root',
				raw: '/root reset --confirm',
			},
			makeContext(projectRoot),
		);

		expect(result.command).toBe('root');

		const { readFileSync } = await import('node:fs');
		const stateRaw = readFileSync(
			join(projectRoot, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(stateRaw);
		expect(state.documentation.rootPath).toBe('logos');
	});

	it('unknown root subcommand returns stable error', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['invalid-subcommand'],
				kind: 'slash',
				name: 'root',
				raw: '/root invalid-subcommand',
			},
			ctx,
		);

		expect(result.command).toBe('root');
		expect(result.kind).toBe('error');
	});

	it('/help includes root commands', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'help', raw: '/help' },
			ctx,
		);

		expect(result.messages.some((m) => m.includes('/root'))).toBe(true);
		expect(result.messages.some((m) => m.includes('Documentation root'))).toBe(
			true,
		);
	});

	it('rejects unsafe paths', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{
				args: ['set', '.git'],
				kind: 'slash',
				name: 'root',
				raw: '/root set .git',
			},
			ctx,
		);

		expect(result.kind).toBe('error');
	});

	it('view kind is root_config', async () => {
		const projectRoot = await setupProject();
		const ctx = makeContext(projectRoot);

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'root', raw: '/root' },
			ctx,
		);

		expect(result.viewKind).toBe('root_config');
	});
});
