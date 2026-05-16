/** TUI shell logic — extracted for testability */

import { parseSlashCommand } from './slash-parser.js';
import { routeSlashCommand } from './slash-router.js';
import type { RouterContext } from './types.js';

export interface Message {
	id: number;
	sender: 'user' | 'system';
	text: string;
}

export function createRouterContext(): RouterContext {
	return {
		cwd: process.cwd(),
		docRoot: 'logos/',
		profile: 'standard',
		providerStatus: 'not configured',
		workspaceInitialized: false,
	};
}

export function processCommand(
	input: string,
	context: RouterContext,
): { messages: Message[]; shouldExit: boolean } {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { messages: [], shouldExit: false };
	}

	const messages: Message[] = [{ id: 0, sender: 'user', text: trimmed }];
	const parsed = parseSlashCommand(trimmed);
	const result = routeSlashCommand(parsed, context);

	for (const msg of result.messages) {
		messages.push({ id: messages.length, sender: 'system', text: msg });
	}

	return { messages, shouldExit: result.shouldExit };
}
