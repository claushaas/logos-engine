import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	detectProjectContext,
	detectProjectRoot,
	detectWorkspace,
	detectWorkspaceConfig,
	formatInitializationState,
	formatProviderStatus,
} from '../src/runtime/project-context.js';

function makeTempDir(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

describe('detectProjectRoot', () => {
	it('detects Git root from a nested directory', () => {
		const root = makeTempDir('logos-git-');
		mkdirSync(join(root, '.git'));
		const nested = join(root, 'src', 'deep');
		mkdirSync(nested, { recursive: true });

		const result = detectProjectRoot({ cwd: nested });
		expect(result.rootPath).toBe(root);
		expect(result.rootKind).toBe('git');
		expect(result.inferred).toBe(true);
		expect(result.cwd).toBe(nested);
	});

	it('detects package root from a nested directory when no Git marker exists', () => {
		const root = makeTempDir('logos-pkg-');
		writeFileSync(join(root, 'package.json'), '{}');
		const nested = join(root, 'lib', 'deep');
		mkdirSync(nested, { recursive: true });

		const result = detectProjectRoot({ cwd: nested });
		expect(result.rootPath).toBe(root);
		expect(result.rootKind).toBe('package');
		expect(result.inferred).toBe(true);
	});

	it('prefers Git root when both Git and package markers exist', () => {
		const root = makeTempDir('logos-both-');
		mkdirSync(join(root, '.git'));
		writeFileSync(join(root, 'package.json'), '{}');

		const result = detectProjectRoot({ cwd: root });
		expect(result.rootPath).toBe(root);
		expect(result.rootKind).toBe('git');
	});

	it('returns recoverable none when no marker exists', () => {
		const root = makeTempDir('logos-none-');
		const result = detectProjectRoot({ cwd: root });
		expect(result.rootPath).toBeNull();
		expect(result.rootKind).toBe('none');
		expect(result.inferred).toBe(true);
		expect(result.cwd).toBe(root);
	});

	it('supports explicit projectRoot option', () => {
		const root = makeTempDir('logos-explicit-');
		const result = detectProjectRoot({ cwd: root, projectRoot: root });
		expect(result.rootPath).toBe(root);
		expect(result.rootKind).toBe('explicit');
		expect(result.inferred).toBe(false);
	});

	it('supports pnpm-workspace.yaml as package marker', () => {
		const root = makeTempDir('logos-pnpm-');
		writeFileSync(join(root, 'pnpm-workspace.yaml'), '');
		const result = detectProjectRoot({ cwd: root });
		expect(result.rootPath).toBe(root);
		expect(result.rootKind).toBe('package');
	});
});

describe('detectWorkspace', () => {
	it('missing .logos/ reports missing initialization state', () => {
		const root = makeTempDir('logos-missing-');
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		expect(ws.exists).toBe(false);
		expect(ws.initializationState).toBe('missing');
		expect(ws.diagnostics.some((d) => d.code === 'workspace_missing')).toBe(
			true,
		);
	});

	it('existing .logos/ without config reports partial', () => {
		const root = makeTempDir('logos-partial-');
		mkdirSync(join(root, '.logos'));
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		expect(ws.exists).toBe(true);
		expect(ws.initializationState).toBe('partial');
		expect(ws.diagnostics.some((d) => d.code === 'workspace_partial')).toBe(
			true,
		);
	});

	it('invalid config reports invalid with path-aware diagnostic', () => {
		const root = makeTempDir('logos-invalid-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(join(root, '.logos', 'workspace.json'), 'not-json');
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		expect(ws.exists).toBe(true);
		expect(ws.initializationState).toBe('invalid');
		expect(ws.diagnostics.some((d) => d.code === 'workspace_invalid')).toBe(
			true,
		);
	});

	it('valid minimal config reports initialized', () => {
		const root = makeTempDir('logos-init-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(join(root, '.logos', 'workspace.json'), JSON.stringify({}));
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		expect(ws.exists).toBe(true);
		expect(ws.initializationState).toBe('initialized');
	});

	it('resolves .logos/ under cwd when no root detected', () => {
		const root = makeTempDir('logos-no-root-');
		const rootResult = detectProjectRoot({ cwd: root });
		expect(rootResult.rootKind).toBe('none');
		const ws = detectWorkspace(rootResult);
		expect(ws.logosPath).toBe(join(root, '.logos'));
	});
});

describe('detectWorkspaceConfig', () => {
	it('configured documentation root is detected when present', () => {
		const root = makeTempDir('logos-docroot-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(
			join(root, '.logos', 'workspace.json'),
			JSON.stringify({ documentationRoot: 'docs-custom/' }),
		);
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.documentationRoot.rootPath).toBe('docs-custom/');
		expect(cfg.documentationRoot.isDefault).toBe(false);
	});

	it('active profile is detected when present', () => {
		const root = makeTempDir('logos-profile-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(
			join(root, '.logos', 'workspace.json'),
			JSON.stringify({ activeProfile: 'custom' }),
		);
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.activeProfileId).toBe('custom');
	});

	it('default documentation root remains logos/ when config is missing', () => {
		const root = makeTempDir('logos-defaults-');
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.documentationRoot.rootPath).toBe('logos/');
		expect(cfg.documentationRoot.isDefault).toBe(true);
	});

	it('default profile remains standard when config is missing', () => {
		const root = makeTempDir('logos-default-profile-');
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.activeProfileId).toBe('standard');
	});

	it('provider status never exposes token values', () => {
		const root = makeTempDir('logos-provider-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(
			join(root, '.logos', 'workspace.json'),
			JSON.stringify({
				provider: { providerId: 'openai', token: 'sk-secret123' },
			}),
		);
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.providerStatus.kind).toBe('configured');
		if (cfg.providerStatus.kind === 'configured') {
			expect(cfg.providerStatus.providerId).toBe('openai');
		}
		const formatted = formatProviderStatus(cfg.providerStatus);
		expect(formatted).not.toContain('secret');
		expect(formatted).not.toContain('sk-');
		expect(formatted).not.toContain('token');
	});

	it('detects documented ai provider config shape from config.json', () => {
		const root = makeTempDir('logos-ai-provider-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(
			join(root, '.logos', 'config.json'),
			JSON.stringify({
				ai: { provider: 'openai', tokenEnv: 'LOGOS_LLM_API_KEY' },
			}),
		);
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.providerStatus.kind).toBe('configured');
		if (cfg.providerStatus.kind === 'configured') {
			expect(cfg.providerStatus.providerId).toBe('openai');
		}
	});

	it('falls back to config.json when workspace.json is absent', () => {
		const root = makeTempDir('logos-alt-config-');
		mkdirSync(join(root, '.logos'));
		writeFileSync(
			join(root, '.logos', 'config.json'),
			JSON.stringify({ profileId: 'alt' }),
		);
		const rootResult = detectProjectRoot({ cwd: root });
		const ws = detectWorkspace(rootResult);
		const cfg = detectWorkspaceConfig(ws);
		expect(cfg.activeProfileId).toBe('alt');
	});
});

describe('detectProjectContext', () => {
	it('returns full context with diagnostics for uninitialized temp project', () => {
		const root = makeTempDir('logos-ctx-');
		mkdirSync(join(root, '.git'));
		const ctx = detectProjectContext({ cwd: root });
		expect(ctx.root.rootKind).toBe('git');
		expect(ctx.workspace.initializationState).toBe('missing');
		expect(ctx.config.activeProfileId).toBe('standard');
		expect(ctx.diagnostics.some((d) => d.code === 'init_needed')).toBe(true);
	});

	it('does not create .logos/ during detection', () => {
		const root = makeTempDir('logos-no-create-');
		detectProjectContext({ cwd: root });
		expect(existsSync(join(root, '.logos'))).toBe(false);
	});

	it('does not write any files during detection', () => {
		const root = makeTempDir('logos-no-write-');
		const before = existsSync(join(root, 'workspace.json'));
		detectProjectContext({ cwd: root });
		const after = existsSync(join(root, 'workspace.json'));
		expect(before).toBe(false);
		expect(after).toBe(false);
	});
});

describe('formatProviderStatus', () => {
	it('formats configured status without exposing secrets', () => {
		const result = formatProviderStatus({
			kind: 'configured',
			providerId: 'test',
		});
		expect(result).toContain('configured');
		expect(result).toContain('test');
	});

	it('formats not_configured', () => {
		expect(formatProviderStatus({ kind: 'not_configured' })).toBe(
			'not configured',
		);
	});

	it('formats not_supported_yet', () => {
		expect(formatProviderStatus({ kind: 'not_supported_yet' })).toBe(
			'not supported yet',
		);
	});
});

describe('formatInitializationState', () => {
	it('formats all states', () => {
		expect(formatInitializationState('initialized')).toBe('initialized');
		expect(formatInitializationState('missing')).toBe('not initialized');
		expect(formatInitializationState('partial')).toBe('partial');
		expect(formatInitializationState('invalid')).toBe('invalid');
	});
});
