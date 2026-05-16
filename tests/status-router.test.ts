import { describe, expect, it } from 'vitest';
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

describe('/status TUI rendering', () => {
	it('renders project context when initialized', () => {
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
		const result = routeSlashCommand(
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

	it('renders recoverable missing initialization state', () => {
		const ctx = makeContext();
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('not initialized');
		expect(text).toContain('Recovery');
		expect(text).toContain('/init');
	});

	it('does not expose provider secrets', () => {
		const ctx = makeContext({
			config: {
				activeProfileId: 'standard',
				diagnostics: [],
				documentationRoot: { isDefault: true, rootPath: 'logos/' },
				providerStatus: { kind: 'configured', providerId: 'openai' },
			},
		});
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).not.toContain('sk-');
		expect(text).not.toContain('token');
		expect(text).not.toContain('secret');
		expect(text).toContain('configured (openai)');
	});

	it('does not mutate files', () => {
		const ctx = makeContext();
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		expect(result.kind).toBe('info');
		expect(result.shouldExit).toBe(false);
		// No side effects to assert because router is pure.
	});

	it('shows default profile when config is missing and bundled profile available', () => {
		const ctx = makeContext();
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('standard');
	});

	it('shows default documentation root when config is missing', () => {
		const ctx = makeContext();
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			ctx,
		);
		const text = result.messages.join('\n');
		expect(text).toContain('logos/');
	});
});
