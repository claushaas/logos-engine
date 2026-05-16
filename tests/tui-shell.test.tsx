import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/tui/App.js';
import { createRouterContext, processCommand } from '../src/tui/shell-logic.js';

describe('App', () => {
	it('renders initial shell with status line and input prompt', () => {
		const { lastFrame } = render(
			<React.StrictMode>
				<App />
			</React.StrictMode>,
		);
		const frame = lastFrame() ?? '';
		expect(frame).toContain('>');
		expect(frame).toContain(process.cwd());
		expect(frame).toContain('logos/');
		expect(frame).toContain('standard');
		expect(frame).toContain('not configured');
	});
});

describe('processCommand', () => {
	const context = createRouterContext();

	it('submitting /help returns help messages', async () => {
		const { messages, shouldExit } = await processCommand('/help', context);
		expect(shouldExit).toBe(false);
		const texts = messages.map((m) => m.text);
		expect(texts.some((t) => t.includes('/help'))).toBe(true);
		expect(texts.some((t) => t.includes('/status'))).toBe(true);
		expect(texts.some((t) => t.includes('/exit'))).toBe(true);
		expect(texts.some((t) => t.includes('/init'))).toBe(true);
	});

	it('submitting /status returns status messages', async () => {
		const { messages, shouldExit } = await processCommand('/status', context);
		expect(shouldExit).toBe(false);
		const texts = messages.map((m) => m.text);
		expect(texts.some((t) => t.includes('Status:'))).toBe(true);
		expect(texts.some((t) => t.includes(context.projectContext.cwd))).toBe(
			true,
		);
		expect(texts.some((t) => t.includes('standard'))).toBe(true);
		expect(texts.some((t) => t.includes('not configured'))).toBe(true);
	});

	it('submitting unknown command returns graceful error', async () => {
		const { messages, shouldExit } = await processCommand('/unknown', context);
		expect(shouldExit).toBe(false);
		const texts = messages.map((m) => m.text);
		expect(texts.some((t) => t.includes('Unknown command'))).toBe(true);
		expect(texts.some((t) => t.includes('/help'))).toBe(true);
	});

	it('submitting /exit returns exit intent', async () => {
		const { messages, shouldExit } = await processCommand('/exit', context);
		expect(shouldExit).toBe(true);
		const texts = messages.map((m) => m.text);
		expect(texts.some((t) => t.includes('Goodbye.'))).toBe(true);
	});

	it('submitting empty input returns empty result', async () => {
		const { messages, shouldExit } = await processCommand('', context);
		expect(messages).toEqual([]);
		expect(shouldExit).toBe(false);
	});
});
