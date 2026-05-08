import { z } from 'zod';
import { decisionStatuses } from '../foundation/status-contracts.js';

export const decisionConfidenceLevels = ['low', 'medium', 'high'] as const;
export type DecisionConfidence = (typeof decisionConfidenceLevels)[number];

export const decisionChangeSchema = z.object({
	changedAt: z.string().datetime(),
	newStatus: z.enum(decisionStatuses),
	newValue: z.unknown().optional(),
	previousStatus: z.enum(decisionStatuses),
	previousValue: z.unknown().optional(),
	reason: z.string().optional(),
});

export type DecisionChange = z.infer<typeof decisionChangeSchema>;

export const decisionSchema = z.object({
	affectedDocuments: z.array(z.string().min(1)),
	confidence: z.enum(decisionConfidenceLevels).default('medium'),
	createdAt: z.string().datetime(),
	id: z.string().min(1),
	impacts: z.array(z.string().min(1)),
	rationale: z.string().min(1),
	revisionHistory: z.array(decisionChangeSchema).default([]),
	sourceAnswerIds: z.array(z.string().min(1)),
	sourceProposalId: z.string().min(1).optional(),
	status: z.enum(decisionStatuses),
	title: z.string().min(1),
	updatedAt: z.string().datetime(),
	value: z.unknown(),
});

export type Decision = z.infer<typeof decisionSchema>;

export const decisionProposalSchema = z.object({
	confidence: z.number().min(0).max(1),
	decisionId: z.string().min(1),
	rationale: z.string().min(1),
	sourceAnswerIds: z.array(z.string().min(1)).default([]),
	suggestedTitle: z.string().min(1),
	suggestedValue: z.unknown(),
});

export type DecisionProposal = z.infer<typeof decisionProposalSchema>;

export class DecisionRegistryError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'DecisionRegistryError';
	}
}

export class InvalidStatusTransitionError extends DecisionRegistryError {
	public constructor(decisionId: string, fromStatus: string, toStatus: string) {
		super(
			`Invalid status transition for decision ${decisionId}: ${fromStatus} -> ${toStatus}`,
		);
		this.name = 'InvalidStatusTransitionError';
	}
}

type DecisionStatusTransition = {
	readonly from: readonly (typeof decisionStatuses)[number][];
	readonly to: (typeof decisionStatuses)[number];
};

const validStatusTransitions: readonly DecisionStatusTransition[] = [
	{ from: ['unknown'], to: 'assumed' },
	{ from: ['unknown'], to: 'proposed' },
	{ from: ['unknown'], to: 'confirmed' },
	{ from: ['assumed'], to: 'proposed' },
	{ from: ['assumed'], to: 'confirmed' },
	{ from: ['assumed'], to: 'deprecated' },
	{ from: ['proposed'], to: 'confirmed' },
	{ from: ['proposed'], to: 'rejected' },
	{ from: ['proposed'], to: 'deprecated' },
	{ from: ['confirmed'], to: 'deprecated' },
	{ from: ['confirmed'], to: 'assumed' },
	{ from: ['confirmed'], to: 'proposed' },
	{ from: ['deprecated'], to: 'proposed' },
	{ from: ['deprecated'], to: 'assumed' },
	{ from: ['deprecated'], to: 'unknown' },
];

const validTransitionMap = new Map<
	string,
	Set<(typeof decisionStatuses)[number]>
>();

for (const transition of validStatusTransitions) {
	for (const from of transition.from) {
		const key = from;
		const existing = validTransitionMap.get(key);

		if (existing) {
			existing.add(transition.to);
		} else {
			validTransitionMap.set(key, new Set([transition.to]));
		}
	}
}

export function isValidStatusTransition(
	from: (typeof decisionStatuses)[number],
	to: (typeof decisionStatuses)[number],
): boolean {
	if (from === to) {
		return true;
	}

	const allowed = validTransitionMap.get(from);

	return allowed ? allowed.has(to) : false;
}

export function assertValidStatusTransition(
	decisionId: string,
	from: (typeof decisionStatuses)[number],
	to: (typeof decisionStatuses)[number],
): void {
	if (!isValidStatusTransition(from, to)) {
		throw new InvalidStatusTransitionError(decisionId, from, to);
	}
}

export type DecisionStore = {
	readonly decisions: readonly Decision[];
};

export function createDecision(decision: {
	affectedDocuments?: readonly string[];
	confidence?: DecisionConfidence;
	id: string;
	impacts?: readonly string[];
	rationale: string;
	sourceAnswerIds?: readonly string[];
	sourceProposalId?: string;
	status: (typeof decisionStatuses)[number];
	title: string;
	value: unknown;
}): Decision {
	const now = new Date().toISOString();

	return decisionSchema.parse({
		affectedDocuments: decision.affectedDocuments ?? [],
		confidence: decision.confidence ?? 'medium',
		createdAt: now,
		id: decision.id,
		impacts: decision.impacts ?? [],
		rationale: decision.rationale,
		revisionHistory: [],
		sourceAnswerIds: decision.sourceAnswerIds ?? [],
		sourceProposalId: decision.sourceProposalId,
		status: decision.status,
		title: decision.title,
		updatedAt: now,
		value: decision.value,
	});
}

export function createDecisionFromProposal(
	proposal: DecisionProposal,
	affectedDocuments: readonly string[] = [],
	impacts: readonly string[] = [],
): Decision {
	return createDecision({
		affectedDocuments,
		confidence: mapNumericConfidence(proposal.confidence),
		id: proposal.decisionId,
		impacts,
		rationale: proposal.rationale,
		sourceAnswerIds: proposal.sourceAnswerIds,
		sourceProposalId: proposal.decisionId,
		status: 'proposed',
		title: proposal.suggestedTitle,
		value: proposal.suggestedValue,
	});
}

function mapNumericConfidence(numericConfidence: number): DecisionConfidence {
	if (numericConfidence >= 0.7) {
		return 'high';
	}

	if (numericConfidence >= 0.4) {
		return 'medium';
	}

	return 'low';
}

export function transitionDecisionStatus(
	decision: Decision,
	newStatus: (typeof decisionStatuses)[number],
	reason?: string,
): Decision {
	assertValidStatusTransition(decision.id, decision.status, newStatus);

	const now = new Date().toISOString();
	const change: DecisionChange = {
		changedAt: now,
		newStatus,
		previousStatus: decision.status,
		reason,
	};

	return decisionSchema.parse({
		...decision,
		revisionHistory: [...decision.revisionHistory, change],
		status: newStatus,
		updatedAt: now,
	});
}

export function confirmDecision(decision: Decision, reason?: string): Decision {
	return transitionDecisionStatus(decision, 'confirmed', reason);
}

export function rejectDecision(decision: Decision, reason?: string): Decision {
	return transitionDecisionStatus(decision, 'deprecated', reason);
}

export function updateDecisionValue(
	decision: Decision,
	newValue: unknown,
	reason?: string,
): Decision {
	const now = new Date().toISOString();
	const change: DecisionChange = {
		changedAt: now,
		newStatus: decision.status,
		newValue,
		previousStatus: decision.status,
		previousValue: decision.value,
		reason,
	};

	return decisionSchema.parse({
		...decision,
		revisionHistory: [...decision.revisionHistory, change],
		updatedAt: now,
		value: newValue,
	});
}

export function getDecisionById(
	store: DecisionStore,
	decisionId: string,
): Decision | undefined {
	return store.decisions.find((decision) => decision.id === decisionId);
}

export function upsertDecision(
	store: DecisionStore,
	decision: Decision,
): DecisionStore {
	const existingIndex = store.decisions.findIndex((d) => d.id === decision.id);

	if (existingIndex >= 0) {
		const updatedDecisions = [...store.decisions];

		updatedDecisions[existingIndex] = decision;

		return { decisions: updatedDecisions };
	}

	return { decisions: [...store.decisions, decision] };
}

export function removeDecision(
	store: DecisionStore,
	decisionId: string,
): DecisionStore {
	return {
		decisions: store.decisions.filter((decision) => decision.id !== decisionId),
	};
}

export function getDecisionsByStatus(
	store: DecisionStore,
	status: (typeof decisionStatuses)[number],
): readonly Decision[] {
	return store.decisions.filter((decision) => decision.status === status);
}

export function getProposedDecisions(
	store: DecisionStore,
): readonly Decision[] {
	return getDecisionsByStatus(store, 'proposed');
}

export function getConfirmedDecisions(
	store: DecisionStore,
): readonly Decision[] {
	return getDecisionsByStatus(store, 'confirmed');
}

export function getAffectedDocumentsOnChange(
	decision: Decision,
): readonly string[] {
	return [...new Set(decision.affectedDocuments)];
}

export function getDownstreamImpacts(decision: Decision): readonly string[] {
	return [...new Set(decision.impacts)];
}

export function createEmptyDecisionStore(): DecisionStore {
	return { decisions: [] };
}
