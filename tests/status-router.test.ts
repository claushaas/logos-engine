import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerArtifact } from '../src/state/artifact-registry.js';
import { createRunRecord } from '../src/state/run-repository.js';
import { createSessionRecord } from '../src/state/session-repository.js';
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
	const os = await import('node:os');
	const crypto = await import('node:crypto');
	const tmpDir = os.tmpdir();
	const randomName = `logos-status-test-${crypto.randomUUID()}`;
	const fullPath = join(tmpDir, randomName);
	await mkdir(fullPath, { recursive: true });
	return fullPath;
}

describe('/status TUI rendering', () => {
	it('renders project context when initialized', async () => {
		const ctx = makeContext({
			config: {
				activeProfileId: 'custom',
				diagnostics: [],
				documentationRoot: { isDefault: false, rootPath: 'my-docs/' },
				providerStatus: { kind: 'configured', providerId: 'anthropic' },
			},
			workspace: {
				diagnostics: [],
				exists: true,
				initializationState: 'initialized',
				logosPath: '/test/project/.logos',
			},
		});
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('/test/project');
		expect(text).toContain('my-docs/');
		expect(text).toContain('custom');
		expect(text).toContain('configured (anthropic)');
		expect(text).toContain('initialized');
	});

	it('renders recoverable missing initialization state', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('not initialized');
		expect(text).toContain('Recovery');
		expect(text).toContain('/init');
	});

	it('does not expose provider secrets', async () => {
		const ctx = makeContext({
			config: {
				activeProfileId: 'standard',
				diagnostics: [],
				documentationRoot: { isDefault: true, rootPath: 'logos/' },
				providerStatus: { kind: 'configured', providerId: 'openai' },
			},
		});
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).not.toContain('sk-');
		expect(text).not.toContain('token');
		expect(text).not.toContain('secret');
		expect(text).toContain('configured (openai)');
	});

	it('does not mutate files', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		expect(result.kind).toBe('info');
		expect(result.shouldExit).toBe(false);
	});

	it('shows default profile when config is missing and bundled profile available', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('standard');
	});

	it('shows default documentation root when config is missing', async () => {
		const ctx = makeContext();
		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('logos/');
	});

	it('includes sessions/runs/artifact summary after records exist', async () => {
		const tmpDir = await createTempDir();
		let state = createDefaultWorkspaceState({
			projectRootPath: tmpDir,
			workspaceId: 'status-test',
		});
		state.workspace.initializationState = 'initialized';
		state = createSessionRecord({
			input: { sessionType: 'intake', status: 'completed' },
			state,
		}).state;
		state = createRunRecord({
			input: { runType: 'validation', status: 'completed' },
			state,
		}).state;
		state = registerArtifact({
			input: { artifactType: 'canonical_markdown', path: 'a.md' },
			state,
		}).state;

		const logosDir = join(tmpDir, '.logos');
		await mkdir(logosDir, { recursive: true });
		await writeFile(
			join(logosDir, 'workspace.json'),
			JSON.stringify(state, null, 2),
			'utf-8',
		);

		const ctx = makeContext({
			root: {
				cwd: tmpDir,
				inferred: true,
				rootKind: 'git' as const,
				rootPath: tmpDir,
			},
			workspace: {
				diagnostics: [],
				exists: true,
				initializationState: 'initialized',
				logosPath: join(tmpDir, '.logos'),
			},
		});

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('Session summary');
		expect(text).toContain('Total sessions');
		expect(text).toContain('Run summary');
		expect(text).toContain('Total runs');
		expect(text).toContain('Artifact summary');
		expect(text).toContain('Total artifacts');
	});
});
