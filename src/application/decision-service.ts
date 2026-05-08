import type {
	Decision,
	DecisionProposal,
	DecisionStore,
} from '../domain/decision-registry.js';
import {
	confirmDecision,
	createDecision,
	createDecisionFromProposal,
	createEmptyDecisionStore,
	getAffectedDocumentsOnChange,
	getDecisionById,
	getDownstreamImpacts,
	getProposedDecisions,
	rejectDecision,
	transitionDecisionStatus,
	updateDecisionValue,
	upsertDecision,
} from '../domain/decision-registry.js';
import type { DecisionsState } from '../domain/workspace-state.js';
import {
	readDecisionsState,
	writeDecisionsState,
} from '../storage/intake-state.js';

export type ProposalReviewResult = {
	readonly affectedDocuments: readonly string[];
	readonly decisionId: string;
	readonly downstreamImpacts: readonly string[];
	readonly status: 'confirmed' | 'rejected' | 'unchanged';
};

export type DecisionChangeResult = {
	readonly affectedDocuments: readonly string[];
	readonly affectedValidationRuleIds: readonly string[];
	readonly decisionId: string;
	readonly previousStatus: string;
};

export class DecisionServiceError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'DecisionServiceError';
	}
}

export function loadDecisionStore(projectRoot: string): DecisionStore {
	const state = readDecisionsState(projectRoot);

	return { decisions: state.decisions };
}

export function saveDecisionStore(
	projectRoot: string,
	store: DecisionStore,
): void {
	const state: DecisionsState = {
		decisions: [...store.decisions],
		schemaVersion: '0.1.0',
	};

	writeDecisionsState(projectRoot, state);
}

export function createManualDecision(
	store: DecisionStore,
	decision: {
		affectedDocuments?: readonly string[];
		confidence?: 'low' | 'medium' | 'high';
		id: string;
		impacts?: readonly string[];
		rationale: string;
		sourceAnswerIds?: readonly string[];
		status: 'unknown' | 'assumed' | 'confirmed';
		title: string;
		value: unknown;
	},
): { readonly store: DecisionStore; readonly decision: Decision } {
	const newDecision = createDecision(decision);
	const updatedStore = upsertDecision(store, newDecision);

	return { decision: newDecision, store: updatedStore };
}

export function receiveAiDecisionProposals(
	store: DecisionStore,
	proposals: readonly DecisionProposal[],
	affectedDocumentMap: ReadonlyMap<string, readonly string[]> = new Map(),
	impactMap: ReadonlyMap<string, readonly string[]> = new Map(),
): { readonly store: DecisionStore; readonly createdIds: readonly string[] } {
	const createdIds: string[] = [];
	let currentStore = store;

	for (const proposal of proposals) {
		const existing = getDecisionById(currentStore, proposal.decisionId);

		if (existing) {
			continue;
		}

		const affectedDocuments =
			affectedDocumentMap.get(proposal.decisionId) ?? [];
		const impacts = impactMap.get(proposal.decisionId) ?? [];
		const decision = createDecisionFromProposal(
			proposal,
			affectedDocuments,
			impacts,
		);
		currentStore = upsertDecision(currentStore, decision);
		createdIds.push(decision.id);
	}

	return { createdIds, store: currentStore };
}

export function reviewProposedDecision(
	store: DecisionStore,
	decisionId: string,
	action: 'confirm' | 'reject',
	reason?: string,
): ProposalReviewResult {
	const decision = getDecisionById(store, decisionId);

	if (!decision) {
		throw new DecisionServiceError(
			`Decision ${decisionId} not found in registry.`,
		);
	}

	if (decision.status !== 'proposed') {
		return {
			affectedDocuments: [],
			decisionId,
			downstreamImpacts: [],
			status: 'unchanged',
		};
	}

	const updatedDecision =
		action === 'confirm'
			? confirmDecision(decision, reason)
			: rejectDecision(decision, reason);
	const updatedStore = upsertDecision(store, updatedDecision);

	// Mutate store reference to reflect update
	Object.assign(store, updatedStore);

	return {
		affectedDocuments: getAffectedDocumentsOnChange(updatedDecision),
		decisionId,
		downstreamImpacts: getDownstreamImpacts(updatedDecision),
		status: action === 'confirm' ? 'confirmed' : 'rejected',
	};
}

export function changeConfirmedDecision(
	store: DecisionStore,
	decisionId: string,
	newValue: unknown,
	reason?: string,
): DecisionChangeResult {
	const decision = getDecisionById(store, decisionId);

	if (!decision) {
		throw new DecisionServiceError(
			`Decision ${decisionId} not found in registry.`,
		);
	}

	const previousStatus = decision.status;
	const updatedDecision = updateDecisionValue(decision, newValue, reason);
	const updatedStore = upsertDecision(store, updatedDecision);

	// Mutate store reference to reflect update
	Object.assign(store, updatedStore);

	return {
		affectedDocuments: getAffectedDocumentsOnChange(updatedDecision),
		affectedValidationRuleIds: [],
		decisionId,
		previousStatus,
	};
}

export function deprecateDecision(
	store: DecisionStore,
	decisionId: string,
	reason?: string,
): DecisionChangeResult {
	const decision = getDecisionById(store, decisionId);

	if (!decision) {
		throw new DecisionServiceError(
			`Decision ${decisionId} not found in registry.`,
		);
	}

	const previousStatus = decision.status;
	const updatedDecision = transitionDecisionStatus(
		decision,
		'deprecated',
		reason,
	);
	const updatedStore = upsertDecision(store, updatedDecision);

	// Mutate store reference to reflect update
	Object.assign(store, updatedStore);

	return {
		affectedDocuments: getAffectedDocumentsOnChange(updatedDecision),
		affectedValidationRuleIds: [],
		decisionId,
		previousStatus,
	};
}

export function getPendingProposals(store: DecisionStore): readonly Decision[] {
	return getProposedDecisions(store);
}

export function createEmptyStore(): DecisionStore {
	return createEmptyDecisionStore();
}
