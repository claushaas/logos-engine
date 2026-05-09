import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
	type ConversationSession,
	conversationSessionSchema,
} from '../domain/conversation-model.js';
import {
	type IntakeSession,
	intakeSessionSchema,
} from '../domain/question-engine.js';
import {
	type AnswersState,
	answersStateSchema,
	type DecisionsState,
	decisionsStateSchema,
	workspaceSchemaVersion,
} from '../domain/workspace-state.js';
import { atomicReplaceJsonFile } from './safe-file-writes.js';

export class IntakeStateError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'IntakeStateError';
	}
}

export function readAnswersState(projectRoot: string): AnswersState {
	return readJsonState(
		join(projectRoot, '.logos', 'answers.json'),
		answersStateSchema,
	);
}

export function writeAnswersState(
	projectRoot: string,
	answers: AnswersState,
): void {
	atomicReplaceJsonFile(join(projectRoot, '.logos', 'answers.json'), answers);
}

export function readDecisionsState(projectRoot: string): DecisionsState {
	return readJsonState(
		join(projectRoot, '.logos', 'decisions.json'),
		decisionsStateSchema,
	);
}

export function writeDecisionsState(
	projectRoot: string,
	decisions: DecisionsState,
): void {
	atomicReplaceJsonFile(
		join(projectRoot, '.logos', 'decisions.json'),
		decisions,
	);
}

export function readCurrentIntakeSession(
	projectRoot: string,
): IntakeSession | null {
	const path = getCurrentSessionPath(projectRoot);

	if (!existsSync(path)) {
		return null;
	}

	return readJsonState(path, intakeSessionSchema);
}

export function writeCurrentIntakeSession(
	projectRoot: string,
	session: IntakeSession,
): void {
	atomicReplaceJsonFile(getCurrentSessionPath(projectRoot), session);
}

export function getCurrentSessionPath(projectRoot: string): string {
	return join(projectRoot, '.logos', 'sessions', 'current.json');
}

export function getConversationSessionPath(projectRoot: string): string {
	return join(projectRoot, '.logos', 'sessions', 'conversation.json');
}

export function readConversationSession(
	projectRoot: string,
): ConversationSession | null {
	const path = getConversationSessionPath(projectRoot);

	if (!existsSync(path)) {
		return null;
	}

	return readJsonState(path, conversationSessionSchema);
}

export function writeConversationSession(
	projectRoot: string,
	session: ConversationSession,
): void {
	atomicReplaceJsonFile(getConversationSessionPath(projectRoot), session);
}

export function readCurrentIntakeSessionLegacy(
	projectRoot: string,
): IntakeSession | null {
	return readCurrentIntakeSession(projectRoot);
}

export function createEmptyAnswersState(): AnswersState {
	return {
		answers: [],
		schemaVersion: workspaceSchemaVersion,
	};
}

export function createEmptyDecisionsState(): DecisionsState {
	return {
		decisions: [],
		schemaVersion: workspaceSchemaVersion,
	};
}

function readJsonState<TSchema extends z.ZodType>(
	path: string,
	schema: TSchema,
): z.infer<TSchema> {
	let parsedJson: unknown;

	try {
		parsedJson = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new IntakeStateError(
			`Unable to read intake state ${path}: ${message}`,
		);
	}

	const result = schema.safeParse(parsedJson);

	if (!result.success) {
		throw new IntakeStateError(
			`Intake state ${path} failed schema validation: ${z.prettifyError(result.error)}`,
		);
	}

	return result.data;
}
