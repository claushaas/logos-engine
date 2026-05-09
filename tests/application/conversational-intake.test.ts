import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	endConversation,
	handleConversationMessage,
	initializeWorkspace,
	readConversationSession,
	resumeConversation,
} from '../../src/index.js';

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-conv-svc-'));
	mkdirSync(join(projectRoot, '.git'));
	return projectRoot;
}

describe('conversational intake service', () => {
	it('creates a conversation turn from a user message', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = await handleConversationMessage(
			projectRoot,
			'I want to build a note-taking app.',
		);

		expect(result.status).toMatch(/ok|no_provider/);
		expect(result.aiMessages.length).toBeGreaterThan(0);
		expect(result.turnCount).toBe(2);

		const session = readConversationSession(projectRoot);
		expect(session).not.toBeNull();
		expect(session?.turns).toHaveLength(2);
		expect(session?.turns[0]).toMatchObject({
			content: 'I want to build a note-taking app.',
			role: 'user',
		});
	});

	it('resumes an existing conversation with history', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		await handleConversationMessage(projectRoot, 'First message about my app.');

		const resumeResult = resumeConversation(projectRoot);

		expect(resumeResult.status).toMatch(/ok|no_provider/);
		expect(resumeResult.turnCount).toBe(2);

		const result = await handleConversationMessage(
			projectRoot,
			'Another detail about the app.',
		);

		expect(result.turnCount).toBe(4);
		const session = readConversationSession(projectRoot);
		expect(session?.turns).toHaveLength(4);
		expect(session?.turns[2]).toMatchObject({
			content: 'Another detail about the app.',
			role: 'user',
		});
	});

	it('handles session persistence between calls', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		await handleConversationMessage(projectRoot, 'Message 1.');

		const sessionPath = join(
			projectRoot,
			'.logos',
			'sessions',
			'conversation.json',
		);
		expect(existsSync(sessionPath)).toBe(true);

		const result = await handleConversationMessage(projectRoot, 'Message 2.');
		expect(result.turnCount).toBeGreaterThanOrEqual(4);
	});

	it('responds gracefully when no workspace exists', async () => {
		const projectRoot = createProjectRoot();

		const result = await handleConversationMessage(
			projectRoot,
			'Message with no workspace.',
		);

		expect(result.status).toBe('no_provider');
		expect(result.aiMessages.length).toBeGreaterThan(0);
	});

	it('saves and ends a conversation', () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const result = endConversation(projectRoot);

		expect(result.status).toBe('ok');
		expect(result.aiMessage).toContain('saved');
	});
});

describe('conversation input routing through slash command handler', () => {
	it('routes /continue to conversation resume', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const {
			createLogosApplicationServices,
			handleSlashCommand,
			loadCommandContext,
			parseSlashCommand,
		} = await import('../../src/index.js');

		const parsed = parseSlashCommand('/continue');
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) {
			throw new Error(parsed.error.message);
		}

		const result = await handleSlashCommand(
			parsed.command,
			loadCommandContext(projectRoot),
			createLogosApplicationServices(),
		);

		expect(result.title).toBe('Conversation resumed');
		expect(result.status).toBe('ok');
		expect(result.body.join('\n')).toContain('Conversation:');
	});

	it('slash command parser still rejects non-slash input', async () => {
		const { parseSlashCommand } = await import('../../src/index.js');

		const result = parseSlashCommand('hello world');
		expect(result.ok).toBe(false);
	});

	it('slash commands for operational actions work after router change', async () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);

		const {
			createLogosApplicationServices,
			handleSlashCommand,
			loadCommandContext,
			parseSlashCommand,
		} = await import('../../src/index.js');

		for (const cmd of ['/help', '/status']) {
			const parsed = parseSlashCommand(cmd);
			expect(parsed.ok).toBe(true);
			if (!parsed.ok) {
				throw new Error(parsed.error.message);
			}

			const result = await handleSlashCommand(
				parsed.command,
				loadCommandContext(projectRoot),
				createLogosApplicationServices(),
			);

			expect(result.status).toBe('ok');
		}
	});
});
