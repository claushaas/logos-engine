/** Pure slash command parser */

import type { ParsedInput } from './types.js';

export function parseSlashCommand(input: string): ParsedInput {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { kind: 'empty' };
	}
	if (!trimmed.startsWith('/')) {
		return { kind: 'free-form', text: trimmed };
	}

	// Simple whitespace split; does not over-engineer quoted strings
	const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
	const name = parts[0] ?? '';
	const args = parts.slice(1);

	return { args, kind: 'slash', name, raw: trimmed };
}
