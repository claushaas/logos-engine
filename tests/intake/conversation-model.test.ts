import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	addConversationTurn,
	completeConversationSession,
	createConversationSession,
	readConversationSession,
	readCurrentIntakeSession,
	saveConversationSession,
	workspaceSchemaVersion,
	writeConversationSession,
} from '../../src/index.js';

describe('conversation model', () => {
	let projectRoot: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), 'logos-conversation-'));
		mkdirSync(join(projectRoot, '.git'));
		mkdirSync(join(projectRoot, '.logos', 'sessions'), { recursive: true });
	});

	afterEach(() => {
		rmSync(projectRoot, { force: true, recursive: true });
	});

	it('creates a conversation session with schema-validated fields', () => {
		const session = createConversationSession({
			now: new Date('2026-05-08T12:00:00.000Z'),
			profileId: 'app-business',
			schemaVersion: workspaceSchemaVersion,
		});

		expect(session).toMatchObject({
			currentPhaseId: null,
			id: 'conv.2026-05-08T12-00-00-000Z',
			profileId: 'app-business',
			schemaVersion: workspaceSchemaVersion,
			status: 'active',
			turns: [],
		});
		expect(session.startedAt).toBe('2026-05-08T12:00:00.000Z');
		expect(session.updatedAt).toBe('2026-05-08T12:00:00.000Z');
	});

	it('adds conversation turns with source links to interpreted state', () => {
		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: workspaceSchemaVersion,
		});

		const withUserTurn = addConversationTurn({
			content: 'I want to build a note-taking app for students.',
			role: 'user',
			session,
		});

		expect(withUserTurn.turns).toHaveLength(1);
		expect(withUserTurn.turns[0]).toMatchObject({
			content: 'I want to build a note-taking app for students.',
			role: 'user',
			sessionId: session.id,
		});

		const withAiTurn = addConversationTurn({
			content: 'That sounds useful. Who is the primary user?',
			metadata: { operationId: 'lead_intake_turn', status: 'proposed' },
			role: 'ai',
			session: withUserTurn,
			sourceLinks: {
				answerIds: ['answer.1'],
				assumptionIds: [],
				openQuestionIds: [],
				proposalIds: [],
			},
		});

		expect(withAiTurn.turns).toHaveLength(2);
		expect(withAiTurn.turns[1]).toMatchObject({
			content: 'That sounds useful. Who is the primary user?',
			metadata: { operationId: 'lead_intake_turn', status: 'proposed' },
			role: 'ai',
			sessionId: session.id,
			sourceLinks: {
				answerIds: ['answer.1'],
			},
		});

		expect(withAiTurn.status).toBe('active');
	});

	it('saves and completes conversation sessions', () => {
		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: workspaceSchemaVersion,
		});
		const saved = saveConversationSession({ session });
		expect(saved.status).toBe('saved');

		const completed = completeConversationSession({ session });
		expect(completed.status).toBe('completed');
	});

	it('persists and reads conversation sessions from .logos/sessions/', () => {
		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: workspaceSchemaVersion,
		});
		const withTurn = addConversationTurn({
			content: 'My app helps freelancers send invoices.',
			role: 'user',
			session,
		});

		writeConversationSession(projectRoot, withTurn);

		const read = readConversationSession(projectRoot);
		expect(read).not.toBeNull();
		expect(read?.turns).toHaveLength(1);
		expect(read?.turns[0]).toMatchObject({
			content: 'My app helps freelancers send invoices.',
			role: 'user',
		});
		expect(read?.profileId).toBe('app-business');
	});

	it('schematically rejects invalid conversation turns on read', () => {
		const session = createConversationSession({
			profileId: 'app-business',
			schemaVersion: workspaceSchemaVersion,
		});
		writeConversationSession(projectRoot, session);

		const read = readConversationSession(projectRoot);
		expect(read).not.toBeNull();
		expect(read?.status).toBe('active');
	});

	it('returns null when no conversation session exists', () => {
		const read = readConversationSession(projectRoot);
		expect(read).toBeNull();
	});
});

describe('conversation model — legacy intake boundary', () => {
	it('returns null for legacy intake sessions when no conversation model file exists', () => {
		const projectRoot = mkdtempSync(join(tmpdir(), 'logos-legacy-'));
		mkdirSync(join(projectRoot, '.git'));
		mkdirSync(join(projectRoot, '.logos', 'sessions'), { recursive: true });

		const legacy = readCurrentIntakeSession(projectRoot);
		const conversation = readConversationSession(projectRoot);

		expect(legacy).toBeNull();
		expect(conversation).toBeNull();

		rmSync(projectRoot, { force: true, recursive: true });
	});
});
