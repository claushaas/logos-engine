/** Step 8.2 — Register Impact: read-only impact computation for affected documents and staleness */

import type { CanonicalDocumentId } from '../profiles/documentation-contract.js';
import type {
	AnyRegisterItem,
	RegisterCollections,
	RegisterGenerationImpact,
	RegisterOperationDiagnostic,
} from './register-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _createDiagnostic(
	code: string,
	severity: RegisterOperationDiagnostic['severity'],
	message: string,
	overrides?: Partial<RegisterOperationDiagnostic>,
): RegisterOperationDiagnostic {
	return { code, message, severity, ...overrides };
}

function allItems(collections: RegisterCollections): AnyRegisterItem[] {
	return [
		...collections.decisions,
		...collections.assumptions,
		...collections.hypotheses,
		...collections.risks,
		...collections.openQuestions,
	];
}

// ---------------------------------------------------------------------------
// Impact computation
// ---------------------------------------------------------------------------

export interface RegisterImpactContext {
	collections: RegisterCollections;
	graph?:
		| {
				getDownstreamNodes?: (documentId: string) => string[] | undefined;
				getNodeByCanonicalId?: (id: string) => unknown;
		  }
		| undefined;
	staleness?:
		| {
				isStale?: (documentId: string) => boolean;
		  }
		| undefined;
}

export function computeRegisterImpact(
	registerItem: AnyRegisterItem,
	context: RegisterImpactContext,
): {
	directlyAffectedDocuments: CanonicalDocumentId[];
	downstreamAffectedDocuments: CanonicalDocumentId[];
	shouldReevaluateStaleness: boolean;
	shouldReevaluateGeneration: boolean;
	diagnostics: RegisterOperationDiagnostic[];
} {
	const diagnostics: RegisterOperationDiagnostic[] = [];
	const directlyAffected = registerItem.affectedDocumentLinks.map(
		(dl) => dl.documentCanonicalId,
	);

	const downstreamSet = new Set<CanonicalDocumentId>();
	const downstreamFn = context.graph?.getDownstreamNodes;
	if (downstreamFn) {
		for (const docId of directlyAffected) {
			const downstream = downstreamFn(docId);
			if (downstream) {
				for (const ds of downstream) {
					downstreamSet.add(ds as CanonicalDocumentId);
				}
			}
		}
	}

	return {
		diagnostics,
		directlyAffectedDocuments: directlyAffected,
		downstreamAffectedDocuments: [...downstreamSet],
		shouldReevaluateGeneration: directlyAffected.length > 0,
		shouldReevaluateStaleness: true,
	};
}

export function computeRegisterImpactSummary(
	collections: RegisterCollections,
	_graph?: RegisterImpactContext['graph'],
	_staleness?: RegisterImpactContext['staleness'],
): RegisterGenerationImpact {
	const all = allItems(collections);
	const diagnostics: RegisterOperationDiagnostic[] = [];

	const relevantDecisions = all.filter((i) => i.kind === 'decision').length;
	const relevantAssumptions = all.filter((i) => i.kind === 'assumption').length;
	const relevantHypotheses = all.filter((i) => i.kind === 'hypothesis').length;
	const relevantRisks = all.filter((i) => i.kind === 'risk').length;
	const relevantOpenQuestions = all.filter(
		(i) => i.kind === 'open_question',
	).length;

	const blockingQuestions = collections.openQuestions.filter(
		(q) => q.isBlocking && q.status === 'open',
	).length;

	const reviewRequired = all.filter(
		(i) => i.reviewState === 'requires_review',
	).length;

	return {
		affectedRegisterIds: all.map((i) => i.id),
		diagnostics,
		relevantAssumptionCount: relevantAssumptions,
		relevantDecisionCount: relevantDecisions,
		relevantHypothesisCount: relevantHypotheses,
		relevantOpenQuestionCount: relevantOpenQuestions,
		relevantRiskCount: relevantRisks,
		reviewRequiredInferredItemCount: reviewRequired,
		unresolvedBlockingQuestionCount: blockingQuestions,
	};
}

export function getAffectedDocumentsForRegisterItem(
	registerItem: AnyRegisterItem,
): CanonicalDocumentId[] {
	return registerItem.affectedDocumentLinks.map((dl) => dl.documentCanonicalId);
}

export function getRegisterItemsAffectingDocument(
	documentId: CanonicalDocumentId,
	collections: RegisterCollections,
): AnyRegisterItem[] {
	return allItems(collections).filter((i) =>
		i.affectedDocumentLinks.some((dl) => dl.documentCanonicalId === documentId),
	);
}
