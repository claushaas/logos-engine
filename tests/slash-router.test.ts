import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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

const defaultContext = makeContext();

function makeContextWithRoot(root: string): RouterContext {
	return makeContext({
		config: {
			activeProfileId: 'standard',
			diagnostics: [],
			documentationRoot: { isDefault: false, rootPath: 'docs/' },
			providerStatus: { kind: 'not_configured' },
		},
		cwd: root,
		root: {
			cwd: root,
			inferred: false,
			rootKind: 'explicit',
			rootPath: root,
		},
		workspace: {
			diagnostics: [],
			exists: true,
			initializationState: 'initialized',
			logosPath: join(root, '.logos'),
		},
	});
}

async function createInitializedWorkspace(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'logos-exec-router-'));
	await symlink(join(process.cwd(), 'profiles'), join(root, 'profiles'), 'dir');
	await mkdir(join(root, '.logos'), { recursive: true });
	const state = createDefaultWorkspaceState({
		documentationRoot: 'docs/',
		projectRootPath: root,
	});
	state.workspace.initializationState = 'initialized';
	state.workspace.initializedBy = '/init';
	await writeFile(
		join(root, '.logos', 'workspace.json'),
		JSON.stringify(state, null, 2),
		'utf-8',
	);
	return root;
}

describe('routeSlashCommand', () => {
	it('/help returns available command help', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'help', raw: '/help' },
			defaultContext,
		);
		expect(result.kind).toBe('success');
		expect(result.command).toBe('help');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('/init');
		expect(result.messages.join('\n')).toContain('/status');
		expect(result.messages.join('\n')).toContain('/exit');
	});

	it('/status returns non-mutating bootstrap status', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			defaultContext,
		);
		expect(result.kind).toBe('info');
		expect(result.command).toBe('status');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('/test/project');
		expect(result.messages.join('\n')).toContain('logos/');
		expect(result.messages.join('\n')).toContain('standard');
		expect(result.messages.join('\n')).toContain('not configured');
		expect(result.messages.join('\n')).toContain('not initialized');
	});

	it('/status returns recovery hint when uninitialized', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			defaultContext,
		);
		expect(result.messages.join('\n')).toContain('Recovery');
	});

	it('/exit returns exit intent', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'exit', raw: '/exit' },
			defaultContext,
		);
		expect(result.kind).toBe('success');
		expect(result.command).toBe('exit');
		expect(result.shouldExit).toBe(true);
		expect(result.messages).toContain('Goodbye.');
	});

	it('unknown slash command returns graceful error', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'unknown', raw: '/unknown' },
			defaultContext,
		);
		expect(result.kind).toBe('error');
		expect(result.command).toBe('unknown');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('Unknown command');
		expect(result.messages.join('\n')).toContain('/help');
	});

	it('unprefixed text returns future intake placeholder', async () => {
		const result = await routeSlashCommand(
			{ kind: 'free-form', text: 'hello world' },
			defaultContext,
		);
		expect(result.kind).toBe('info');
		expect(result.command).toBe('intake');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('hello world');
		expect(result.messages.join('\n')).toContain('later phase');
	});

	it('/init shows preflight plan and requires confirmation', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'init', raw: '/init' },
			defaultContext,
		);
		expect(result.command).toBe('init');
		expect(result.shouldExit).toBe(false);
		const text = result.messages.join('\n');
		expect(text).toContain('preflight');
		expect(text).toContain('/test/project');
		expect(text).toContain('.logos');
		expect(text).toContain('No files have been written');
		expect(text).toContain('/init --confirm');
	});

	it('/init --dry-run returns planned paths without writing', async () => {
		const result = await routeSlashCommand(
			{
				args: ['--dry-run'],
				kind: 'slash',
				name: 'init',
				raw: '/init --dry-run',
			},
			defaultContext,
		);
		expect(result.command).toBe('init');
		expect(result.shouldExit).toBe(false);
		const text = result.messages.join('\n');
		expect(text).toContain('dry-run');
		expect(text).toContain('/test/project');
		expect(text).toContain('.logos');
		expect(text).toContain('no files were written');
	});

	it('/init --root custom-docs shows custom root in preflight', async () => {
		const result = await routeSlashCommand(
			{
				args: ['--root', 'custom-docs'],
				kind: 'slash',
				name: 'init',
				raw: '/init --root custom-docs',
			},
			defaultContext,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('custom-docs');
		expect(text).toContain('No files have been written');
	});

	it('/init --profile standard shows standard profile', async () => {
		const result = await routeSlashCommand(
			{
				args: ['--profile', 'standard'],
				kind: 'slash',
				name: 'init',
				raw: '/init --profile standard',
			},
			defaultContext,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('standard');
	});

	it('/init uses project root from context for preflight path display', async () => {
		const initializedContext = makeContext({
			workspace: {
				diagnostics: [],
				exists: true,
				initializationState: 'initialized',
				logosPath: '/test/project/.logos',
			},
		});
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'init', raw: '/init' },
			initializedContext,
		);
		expect(result.command).toBe('init');
		expect(result.shouldExit).toBe(false);
		const text = result.messages.join('\n');
		expect(text).toContain('preflight');
		expect(text).toContain('/test/project');
	});

	it('/continue returns recovery guidance when workspace is uninitialized', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'continue', raw: '/continue' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('continue');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not initialized');
		expect(result.messages.join('\n')).toContain('/init');
	});

	it('/generate returns workspace-not-initialized when no state', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'generate', raw: '/generate' },
			defaultContext,
		);
		expect(result.command).toBe('generate');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not initialized');
		expect(result.messages.join('\n')).toContain('/init');
	});

	it('/diagnose fails gracefully without workspace', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'diagnose', raw: '/diagnose' },
			defaultContext,
		);
		expect(result.kind).toBe('error');
		expect(result.command).toBe('diagnose');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('Cannot run diagnosis');
		expect(result.messages.join('\n')).toContain('initialized');
	});

	it('/validate fails gracefully without workspace', async () => {
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'validate', raw: '/validate' },
			defaultContext,
		);
		expect(result.kind).toBe('error');
		expect(result.command).toBe('validate');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('Cannot run full validation');
		expect(result.messages.join('\n')).toContain('initialized');
	});

	it('/config ai is no longer a stub and returns configuration info', async () => {
		const result = await routeSlashCommand(
			{ args: ['ai'], kind: 'slash', name: 'config', raw: '/config ai' },
			defaultContext,
		);
		expect(result.command).toBe('config ai');
		expect(result.shouldExit).toBe(false);
		// No longer a stub — returns status/help
		expect(result.messages.join('\n')).toContain('AI Provider');
		expect(result.messages.join('\n')).not.toContain('not yet implemented');
	});

	it('/config ai status returns redacted status', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'status'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai status',
				},
				ctx,
			);
			expect(result.command).toBe('config ai status');
			expect(result.messages.join('\n')).toContain('no_provider');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai mode disabled works', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'mode', 'disabled'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode disabled',
				},
				ctx,
			);
			expect(result.command).toBe('config ai mode');
			expect(result.kind).toBe('success');
			expect(result.messages.join('\n')).toContain('disabled');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai mode remote works', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'mode', 'remote'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode remote',
				},
				ctx,
			);
			expect(result.command).toBe('config ai mode');
			expect(result.kind).toBe('success');
			expect(result.messages.join('\n')).toContain('remote');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai mode invalid rejected', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'mode', 'cloud'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode cloud',
				},
				ctx,
			);
			expect(result.kind).toBe('error');
			expect(result.messages.join('\n')).toContain('Invalid');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai provider unknown rejected', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'provider', 'unknown'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai provider unknown',
				},
				ctx,
			);
			expect(result.kind).toBe('error');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai timeout too high rejected', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			// 200001 ms (exceeds 180000 max)
			const result = await routeSlashCommand(
				{
					args: ['ai', 'timeout', '200001'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai timeout 200001',
				},
				ctx,
			);
			expect(result.kind).toBe('error');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai disclosure shows preview', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			await routeSlashCommand(
				{
					args: ['ai', 'mode', 'remote'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode remote',
				},
				ctx,
			);
			await routeSlashCommand(
				{
					args: ['ai', 'provider', 'openai'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai provider openai',
				},
				ctx,
			);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'disclosure'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai disclosure',
				},
				ctx,
			);
			expect(result.messages.join('\n')).toContain('Disclosure');
			expect(result.messages.join('\n')).not.toContain('sk-');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai disclosure accept works', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			await routeSlashCommand(
				{
					args: ['ai', 'mode', 'remote'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode remote',
				},
				ctx,
			);
			await routeSlashCommand(
				{
					args: ['ai', 'provider', 'openai'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai provider openai',
				},
				ctx,
			);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'disclosure', 'accept'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai disclosure accept',
				},
				ctx,
			);
			expect(result.kind).toBe('success');
			expect(result.messages.join('\n')).toContain('accepted');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai test blocked without disclosure', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			await routeSlashCommand(
				{
					args: ['ai', 'mode', 'remote'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode remote',
				},
				ctx,
			);
			await routeSlashCommand(
				{
					args: ['ai', 'provider', 'openai'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai provider openai',
				},
				ctx,
			);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'test'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai test',
				},
				ctx,
			);
			expect(result.kind).toBe('warning');
			expect(result.messages.join('\n')).toContain('disclosure');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai disable works', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			await routeSlashCommand(
				{
					args: ['ai', 'mode', 'remote'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai mode remote',
				},
				ctx,
			);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'disable'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai disable',
				},
				ctx,
			);
			expect(result.kind).toBe('success');
			expect(result.messages.join('\n')).toContain('disabled');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai reset works', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'reset'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai reset',
				},
				ctx,
			);
			expect(result.kind).toBe('success');
			expect(result.messages.join('\n')).toContain('reset');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai unknown subcommand returns stable diagnostic', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'bogus'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai bogus',
				},
				ctx,
			);
			expect(result.kind).toBe('error');
			expect(result.messages.join('\n')).toContain('Unknown');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/config ai token-env accepts env var name only', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContextWithRoot(root);
			const result = await routeSlashCommand(
				{
					args: ['ai', 'token-env', 'OPENAI_API_KEY'],
					kind: 'slash',
					name: 'config',
					raw: '/config ai token-env OPENAI_API_KEY',
				},
				ctx,
			);
			expect(result.kind).toBe('success');
			expect(result.messages.join('\n')).toContain('OPENAI_API_KEY');
			expect(result.messages.join('\n')).not.toContain('sk-');
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('/executive compile defaults to preflight and writes nothing without --confirm', async () => {
		const root = await createInitializedWorkspace();
		try {
			const ctx = makeContext({
				config: {
					activeProfileId: 'standard',
					diagnostics: [],
					documentationRoot: { isDefault: false, rootPath: 'docs/' },
					providerStatus: { kind: 'not_configured' },
				},
				cwd: root,
				root: {
					cwd: root,
					inferred: false,
					rootKind: 'git',
					rootPath: root,
				},
				workspace: {
					diagnostics: [],
					exists: true,
					initializationState: 'initialized',
					logosPath: join(root, '.logos'),
				},
			});

			const result = await routeSlashCommand(
				{
					args: ['compile'],
					kind: 'slash',
					name: 'executive',
					raw: '/executive compile',
				},
				ctx,
			);

			const text = result.messages.join('\n');
			expect(text).toContain('No files have been written');
			expect(text).toContain('/executive compile --confirm');
			expect(existsSync(join(root, 'docs', 'executive'))).toBe(false);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});

	it('empty input returns empty info result', async () => {
		const result = await routeSlashCommand({ kind: 'empty' }, defaultContext);
		expect(result.kind).toBe('info');
		expect(result.command).toBe('');
		expect(result.shouldExit).toBe(false);
		expect(result.messages).toEqual([]);
	});
});
