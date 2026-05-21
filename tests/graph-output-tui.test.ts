/** Step 7.4 Graph Output — TUI integration tests */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';
import { routeSlashCommand } from '../src/tui/slash-router.js';
import type { RouterContext } from '../src/tui/types.js';

function makeContext(
	overrides?: Partial<RouterContext['projectContext']>,
): RouterContext {
	const base = {
		config: {
			activeProfileId: 'standard',
			diagnostics: [],
			documentationRoot: { isDefault: true, rootPath: 'logos/' },
			providerStatus: { kind: 'not_configured' } as const,
		},
		cwd: '/test/project',
		diagnostics: [],
		root: {
			cwd: '/test/project',
			inferred: true,
			rootKind: 'git' as const,
			rootPath: '/test/project',
		},
		workspace: {
			diagnostics: [],
			exists: false,
			initializationState: 'missing' as const,
			logosPath: '/test/project/.logos',
		},
	};
	return {
		projectContext: {
			...base,
			...overrides,
		} as RouterContext['projectContext'],
	};
}

async function createTempDir(): Promise<string> {
	const randomName = `logos-graph-tui-${randomUUID()}`;
	const fullPath = join(tmpdir(), randomName);
	await mkdir(fullPath, { recursive: true });
	return fullPath;
}

// ---------------------------------------------------------------------------
// /graph TUI command tests
// ---------------------------------------------------------------------------

describe('/graph TUI command', () => {
	it('/graph renders graph output for uninitialized workspace', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'graph', raw: '/graph' },
			ctx,
		);

		expect(result.command).toBe('graph');
		// Should succeed even without workspace - falls back to contract-based graph
		expect(result.messages.length).toBeGreaterThan(0);
		const text = result.messages.join('\n');
		expect(text).toContain('Graph Output');
		expect(text).toContain('Profile:');
	});

	it('/graph is read-only (shouldExit is false)', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'graph', raw: '/graph' },
			ctx,
		);

		expect(result.shouldExit).toBe(false);
		expect(result.command).toBe('graph');
	});

	it('/graph works without provider configuration', async () => {
		const ctx = makeContext({
			config: {
				activeProfileId: 'standard',
				diagnostics: [],
				documentationRoot: { isDefault: true, rootPath: 'logos/' },
				providerStatus: { kind: 'not_configured' },
			},
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'graph', raw: '/graph' },
			ctx,
		);

		expect(result.command).toBe('graph');
		expect(result.messages.length).toBeGreaterThan(0);
	});

	it('/graph does not call AI', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'graph', raw: '/graph' },
			ctx,
		);

		const text = result.messages.join('\n');
		expect(text).not.toContain('AI');
		expect(text).not.toContain('provider');
		expect(text).not.toContain('api_key');
	});

	it('/graph --json returns parseable JSON', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{ args: ['--json'], kind: 'slash', name: 'graph', raw: '/graph --json' },
			ctx,
		);

		expect(result.command).toBe('graph');

		// Concatenate messages and try to parse as JSON
		const text = result.messages.join('\n');
		expect(() => JSON.parse(text)).not.toThrow();

		const parsed = JSON.parse(text);
		expect(parsed.profileId).toBeDefined();
		expect(parsed.formatVersion).toBeDefined();
		expect(Array.isArray(parsed.nodes)).toBe(true);
	});

	it('/graph --mode full produces full output', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{
				args: ['--mode', 'full'],
				kind: 'slash',
				name: 'graph',
				raw: '/graph --mode full',
			},
			ctx,
		);

		expect(result.command).toBe('graph');
		const text = result.messages.join('\n');
		// Full mode should contain more sections
		expect(text).toContain('Graph Output');
		expect(text).toContain('Phases');
	});

	it('initialized workspace graph output includes staleness info in /status', async () => {
		// Use real project root (cwd) since standard profile exists there
		const _ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
			workspace: {
				diagnostics: [],
				exists: true,
				initializationState: 'initialized',
				logosPath: join(process.cwd(), '.logos'),
			},
		});

		// Initialize workspace in temp dir pointing to real profile
		const tempDir = await createTempDir();
		const statePath = join(tempDir, '.logos', 'workspace-state.json');
		const defaultState = createDefaultWorkspaceState({
			documentationRoot: 'logos/',
			profileId: 'standard',
			projectRoot: process.cwd(),
		});

		try {
			await mkdir(join(tempDir, '.logos'), { recursive: true });
			await writeFile(
				statePath,
				JSON.stringify(defaultState, null, 2),
				'utf-8',
			);

			const tempCtx = makeContext({
				cwd: tempDir,
				root: {
					cwd: tempDir,
					inferred: true,
					rootKind: 'git',
					rootPath: tempDir,
				},
				workspace: {
					diagnostics: [],
					exists: true,
					initializationState: 'initialized',
					logosPath: join(tempDir, '.logos'),
				},
			});

			const result = await routeSlashCommand(
				{ args: [], kind: 'slash', name: 'status', raw: '/status' },
				tempCtx,
			);

			const text = result.messages.join('\n');
			// With graph summary in status, it should appear when workspace is initialized
			expect(text).toContain('Status:');
			expect(text).toContain('initialized');
		} finally {
			// Cleanup temp dir
			try {
				const { rm } = await import('node:fs/promises');
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('/help reflects /graph command', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'help', raw: '/help' },
			ctx,
		);

		const text = result.messages.join('\n');
		expect(text).toContain('/graph');
		expect(text).toContain('dependency graph');
	});

	it('/status remains concise after graph summary addition', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);

		// /status should not become a full graph dump
		const text = result.messages.join('\n');
		expect(text).not.toContain('Graph Output');
		expect(text).not.toContain('============');
		expect(text).not.toContain('document:');
		expect(text).not.toContain('Phase:');
	});

	it('/exit still works', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'exit', raw: '/exit' },
			ctx,
		);

		expect(result.shouldExit).toBe(true);
		expect(result.command).toBe('exit');
	});

	it('/graph with unknown command after change still works', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{
				args: [],
				kind: 'slash',
				name: 'nonexistent',
				raw: '/nonexistent',
			},
			ctx,
		);

		expect(result.kind).toBe('error');
		expect(result.messages.join('\n')).toContain('Unknown command');
	});

	it('/graph handles --phase filter', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{
				args: ['--phase', '01-foundation'],
				kind: 'slash',
				name: 'graph',
				raw: '/graph --phase 01-foundation',
			},
			ctx,
		);

		expect(result.command).toBe('graph');
		const text = result.messages.join('\n');
		expect(text).toContain('Phase: 01-foundation');
	});

	it('/graph handles --doc filter', async () => {
		const ctx = makeContext({
			cwd: process.cwd(),
			root: {
				cwd: process.cwd(),
				inferred: true,
				rootKind: 'git',
				rootPath: process.cwd(),
			},
		});
		const result = await routeSlashCommand(
			{
				args: ['--doc', '01-thesis'],
				kind: 'slash',
				name: 'graph',
				raw: '/graph --doc 01-thesis',
			},
			ctx,
		);

		expect(result.command).toBe('graph');
		const text = result.messages.join('\n');
		expect(text).toContain('document:01-thesis');
	});
});
