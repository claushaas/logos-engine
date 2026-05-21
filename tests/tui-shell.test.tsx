import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { detectProjectContext } from '../src/runtime/project-context.js';
import { App } from '../src/tui/App.js';
import {
	buildStartupBriefingInputFromContext,
	createRouterContext,
	processCommand,
} from '../src/tui/shell-logic.js';

describe('App', () => {
	it('renders initial shell with prompt and no workbench chrome', () => {
		const { lastFrame } = render(
			<React.StrictMode>
				<App />
			</React.StrictMode>,
		);
		const frame = lastFrame() ?? '';
		// Chat-style prompt
		expect(frame).toContain('〉');
		// No workbench chrome
		expect(frame).not.toContain('Actions:');
		expect(frame).not.toContain('Context:');
		expect(frame).not.toContain('[Focus:');
		expect(frame).not.toContain('Repo:');
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

describe('startup briefing integration', () => {
	function createInitializedTempWorkspace(): string {
		const tempRoot = mkdtempSync(join(tmpdir(), 'logos-tui-'));
		symlinkSync(
			resolve(process.cwd(), 'profiles'),
			join(tempRoot, 'profiles'),
			'dir',
		);
		mkdirSync(join(tempRoot, '.logos'), { recursive: true });
		writeFileSync(
			join(tempRoot, '.logos', 'workspace.json'),
			JSON.stringify(
				{
					artifacts: [],
					assumptions: [],
					auditEvents: [],
					decisions: [],
					documentation: {
						isDefault: true,
						rootPath: 'logos/',
						wasExplicitlyConfigured: false,
					},
					generationRuns: [],
					migrations: [],
					openQuestions: [],
					profile: { profileId: 'standard', source: 'bundled' },
					proposals: [],
					risks: [],
					runs: [],
					schemaVersion: '3.2.0',
					sessions: [],
					validationRuns: [],
					workspace: {
						createdAt: '2024-01-01T00:00:00.000Z',
						initializationState: 'initialized',
						projectRootPath: tempRoot,
						updatedAt: '2024-01-01T00:00:00.000Z',
						workspaceId: 'test-tui-startup',
					},
				},
				null,
				2,
			),
		);
		return tempRoot;
	}

	it('builds a next question cluster for initialized workspaces', async () => {
		const tempRoot = createInitializedTempWorkspace();
		try {
			const input = await buildStartupBriefingInputFromContext(tempRoot);

			expect(input?.workspaceInitialized).toBe(true);
			expect(input?.questionCluster).toBeDefined();
			expect(input?.questionCluster?.questions.length).toBeGreaterThan(0);
			expect(input?.questionClusterSummary).toBeDefined();
		} finally {
			rmSync(tempRoot, { force: true, recursive: true });
		}
	});

	it('/continue shows the next question cluster for initialized workspaces', async () => {
		const tempRoot = createInitializedTempWorkspace();
		try {
			const { messages, shouldExit } = await processCommand('/continue', {
				projectContext: detectProjectContext({
					cwd: tempRoot,
					projectRoot: tempRoot,
				}),
			});

			expect(shouldExit).toBe(false);
			const texts = messages.map((m) => m.text);
			expect(
				texts.some((t) => t.includes('Next intake question cluster')),
			).toBe(true);
			expect(texts.some((t) => t.includes('Source:'))).toBe(true);
			expect(
				texts.some((t) =>
					t.includes('explicit review before becoming confirmed'),
				),
			).toBe(true);
		} finally {
			rmSync(tempRoot, { force: true, recursive: true });
		}
	});
});
