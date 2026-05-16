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

const defaultContext = makeContext();

describe('routeSlashCommand', () => {
	it('/help returns available command help', () => {
		const result = routeSlashCommand(
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

	it('/status returns non-mutating bootstrap status', () => {
		const result = routeSlashCommand(
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

	it('/status returns recovery hint when uninitialized', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'status', raw: '/status' },
			defaultContext,
		);
		expect(result.messages.join('\n')).toContain('Recovery');
	});

	it('/exit returns exit intent', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'exit', raw: '/exit' },
			defaultContext,
		);
		expect(result.kind).toBe('success');
		expect(result.command).toBe('exit');
		expect(result.shouldExit).toBe(true);
		expect(result.messages).toContain('Goodbye.');
	});

	it('unknown slash command returns graceful error', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'unknown', raw: '/unknown' },
			defaultContext,
		);
		expect(result.kind).toBe('error');
		expect(result.command).toBe('unknown');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('Unknown command');
		expect(result.messages.join('\n')).toContain('/help');
	});

	it('unprefixed text returns future intake placeholder', () => {
		const result = routeSlashCommand(
			{ kind: 'free-form', text: 'hello world' },
			defaultContext,
		);
		expect(result.kind).toBe('info');
		expect(result.command).toBe('intake');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('hello world');
		expect(result.messages.join('\n')).toContain('later phase');
	});

	it('/init returns non-mutating stub', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'init', raw: '/init' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('init');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not yet implemented');
	});

	it('/continue returns non-mutating stub', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'continue', raw: '/continue' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('continue');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not yet implemented');
	});

	it('/generate returns non-mutating stub', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'generate', raw: '/generate' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('generate');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not yet implemented');
	});

	it('/diagnose returns non-mutating stub', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'diagnose', raw: '/diagnose' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('diagnose');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not yet implemented');
	});

	it('/validate returns non-mutating stub', () => {
		const result = routeSlashCommand(
			{ args: [], kind: 'slash', name: 'validate', raw: '/validate' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('validate');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not yet implemented');
	});

	it('/config ai returns non-mutating stub', () => {
		const result = routeSlashCommand(
			{ args: ['ai'], kind: 'slash', name: 'config', raw: '/config ai' },
			defaultContext,
		);
		expect(result.kind).toBe('warning');
		expect(result.command).toBe('config ai');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not yet implemented');
	});

	it('empty input returns empty info result', () => {
		const result = routeSlashCommand({ kind: 'empty' }, defaultContext);
		expect(result.kind).toBe('info');
		expect(result.command).toBe('');
		expect(result.shouldExit).toBe(false);
		expect(result.messages).toEqual([]);
	});
});
