import { z } from 'zod';
import { aiOutputStatuses } from '../foundation/status-contracts.js';

export const conversationSessionStatuses = [
	'active',
	'saved',
	'completed',
] as const;

export const conversationTurnRoles = ['user', 'ai'] as const;

const emptySourceLinks = {
	answerIds: [],
	assumptionIds: [],
	openQuestionIds: [],
	proposalIds: [],
};

const sourceLinksSchema = z.object({
	answerIds: z.array(z.string().min(1)).default([]),
	assumptionIds: z.array(z.string().min(1)).default([]),
	openQuestionIds: z.array(z.string().min(1)).default([]),
	proposalIds: z.array(z.string().min(1)).default([]),
});

export const conversationTurnSchema = z.object({
	content: z.string().min(1),
	id: z.string().min(1),
	metadata: z
		.object({
			operationId: z.string().min(1).optional(),
			status: z.enum(aiOutputStatuses).optional(),
		})
		.optional(),
	role: z.enum(conversationTurnRoles),
	sessionId: z.string().min(1),
	sourceLinks: sourceLinksSchema.default(emptySourceLinks),
	timestamp: z.string().datetime(),
});

export const conversationSessionSchema = z.object({
	currentPhaseId: z.string().min(1).nullable().default(null),
	id: z.string().min(1),
	profileId: z.string().min(1),
	schemaVersion: z.string().min(1),
	startedAt: z.string().datetime(),
	status: z.enum(conversationSessionStatuses),
	turns: z.array(conversationTurnSchema).default([]),
	updatedAt: z.string().datetime(),
});

export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
export type ConversationSession = z.infer<typeof conversationSessionSchema>;
export type ConversationTurnRole = (typeof conversationTurnRoles)[number];
export type ConversationSessionStatus =
	(typeof conversationSessionStatuses)[number];
export type ConversationSourceLinks = z.infer<typeof sourceLinksSchema>;

export function createConversationSession(input: {
	readonly now?: Date;
	readonly profileId: string;
	readonly schemaVersion: string;
	readonly phaseId?: string | null;
}): ConversationSession {
	const now = (input.now ?? new Date()).toISOString();

	return {
		currentPhaseId: input.phaseId ?? null,
		id: `conv.${now.replaceAll(/[:.]/g, '-')}`,
		profileId: input.profileId,
		schemaVersion: input.schemaVersion,
		startedAt: now,
		status: 'active',
		turns: [],
		updatedAt: now,
	};
}

export function addConversationTurn(input: {
	readonly content: string;
	readonly now?: Date;
	readonly role: ConversationTurnRole;
	readonly session: ConversationSession;
	readonly sourceLinks?: ConversationSourceLinks;
	readonly metadata?: ConversationTurn['metadata'];
}): ConversationSession {
	const now = (input.now ?? new Date()).toISOString();
	const turnNumber = input.session.turns.length + 1;
	const turn: ConversationTurn = {
		content: input.content,
		id: `${input.session.id}.turn.${turnNumber}`,
		metadata: input.metadata,
		role: input.role,
		sessionId: input.session.id,
		sourceLinks: input.sourceLinks ?? emptySourceLinks,
		timestamp: now,
	};

	return {
		...input.session,
		status: 'active',
		turns: [...input.session.turns, turn],
		updatedAt: now,
	};
}

export function saveConversationSession(input: {
	readonly now?: Date;
	readonly session: ConversationSession;
}): ConversationSession {
	return {
		...input.session,
		status: 'saved',
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export function completeConversationSession(input: {
	readonly now?: Date;
	readonly session: ConversationSession;
}): ConversationSession {
	return {
		...input.session,
		status: 'completed',
		updatedAt: (input.now ?? new Date()).toISOString(),
	};
}

export class ConversationModelError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ConversationModelError';
	}
}
