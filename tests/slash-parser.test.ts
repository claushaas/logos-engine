import { describe, expect, it } from 'vitest';
import { parseSlashCommand } from '../src/tui/slash-parser.js';

describe('parseSlashCommand', () => {
	it('parses /help', () => {
		const result = parseSlashCommand('/help');
		expect(result).toEqual({
			args: [],
			kind: 'slash',
			name: 'help',
			raw: '/help',
		});
	});

	it('parses /status', () => {
		const result = parseSlashCommand('/status');
		expect(result).toEqual({
			args: [],
			kind: 'slash',
			name: 'status',
			raw: '/status',
		});
	});

	it('parses /exit', () => {
		const result = parseSlashCommand('/exit');
		expect(result).toEqual({
			args: [],
			kind: 'slash',
			name: 'exit',
			raw: '/exit',
		});
	});

	it('parses /config ai', () => {
		const result = parseSlashCommand('/config ai');
		expect(result).toEqual({
			args: ['ai'],
			kind: 'slash',
			name: 'config',
			raw: '/config ai',
		});
	});

	it('parses /generate', () => {
		const result = parseSlashCommand('/generate');
		expect(result).toEqual({
			args: [],
			kind: 'slash',
			name: 'generate',
			raw: '/generate',
		});
	});

	it('trims whitespace', () => {
		const result = parseSlashCommand('  /help  ');
		expect(result).toEqual({
			args: [],
			kind: 'slash',
			name: 'help',
			raw: '/help',
		});
	});

	it('treats unprefixed text as free-form input', () => {
		const result = parseSlashCommand('hello world');
		expect(result).toEqual({
			kind: 'free-form',
			text: 'hello world',
		});
	});

	it('handles unknown slash command', () => {
		const result = parseSlashCommand('/unknown');
		expect(result).toEqual({
			args: [],
			kind: 'slash',
			name: 'unknown',
			raw: '/unknown',
		});
	});

	it('handles empty input', () => {
		const result = parseSlashCommand('');
		expect(result).toEqual({ kind: 'empty' });
	});

	it('handles whitespace-only input', () => {
		const result = parseSlashCommand('   ');
		expect(result).toEqual({ kind: 'empty' });
	});
});
