import { describe, expect, it } from 'vitest';
import {
	redactAndRelativize,
	redactString,
	redactValue,
	relativizePaths,
} from '../src/runtime/redaction.js';

describe('redactValue', () => {
	it('redacts token-like object keys', () => {
		const input = {
			name: 'test',
			token: 'sk-abc123',
		};
		const result = redactValue(input) as Record<string, unknown>;
		expect(result.name).toBe('test');
		expect(result.token).toBe('[REDACTED]');
	});

	it('redacts authorization/bearer-like strings', () => {
		const input = {
			auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
		};
		const result = redactValue(input) as Record<string, unknown>;
		expect(result.auth).toBe('[REDACTED]');
	});

	it('redacts nested secrets', () => {
		const input = {
			config: {
				apiKey: 'gsk_supersecret',
				nested: {
					password: 'hunter2',
				},
			},
		};
		const result = redactValue(input) as Record<string, unknown>;
		expect((result.config as Record<string, unknown>).apiKey).toBe(
			'[REDACTED]',
		);
		expect(
			(
				(result.config as Record<string, unknown>).nested as Record<
					string,
					unknown
				>
			).password,
		).toBe('[REDACTED]');
	});

	it('preserves non-secret diagnostic fields', () => {
		const input = {
			code: 'E1',
			path: '/tmp/test',
			severity: 'error',
		};
		const result = redactValue(input);
		expect(result).toEqual(input);
	});

	it('does not expose raw provider tokens in JSON output', () => {
		const input = {
			provider: {
				providerId: 'openai',
				token: 'sk-verylongsecrettoken1234567890',
			},
		};
		const result = redactValue(input);
		const json = JSON.stringify(result);
		expect(json).not.toContain('sk-verylong');
		expect(json).toContain('[REDACTED]');
	});
});

describe('redactString', () => {
	it('redacts authorization headers', () => {
		const input = 'Authorization: Bearer supersecrettoken';
		const result = redactString(input);
		expect(result).not.toContain('supersecret');
		expect(result).toContain('[REDACTED]');
	});

	it('redacts bearer tokens', () => {
		const input = 'Bearer sk-abcdefghijklmnopqrstuvwxyz';
		const result = redactString(input);
		expect(result).not.toContain('sk-abc');
		expect(result).toContain('[REDACTED]');
	});

	it('preserves non-secret text', () => {
		const input = 'Hello world, path is /tmp/test';
		const result = redactString(input);
		expect(result).toBe(input);
	});
});

describe('relativizePaths', () => {
	it('relativizes absolute paths against project root', () => {
		const input = {
			path: '/home/user/project/src/file.ts',
		};
		const result = relativizePaths(input, '/home/user/project') as Record<
			string,
			unknown
		>;
		expect(result.path).toBe('src/file.ts');
	});

	it('leaves relative paths unchanged', () => {
		const input = {
			path: 'src/file.ts',
		};
		const result = relativizePaths(input, '/home/user/project');
		expect(result).toEqual(input);
	});
});

describe('redactAndRelativize', () => {
	it('combines redaction and path relativization', () => {
		const input = {
			path: '/home/user/project/src/file.ts',
			secret: 'shh',
		};
		const result = redactAndRelativize(input, {
			projectRoot: '/home/user/project',
		}) as Record<string, unknown>;
		expect(result.path).toBe('src/file.ts');
		expect(result.secret).toBe('[REDACTED]');
	});
});
