/** Step 8.2 — Register Queries: read-only deterministic query functions */

import type { CanonicalDocumentId } from '../profiles/documentation-contract.js';
import type {
	AnyRegisterItem,
	RegisterCollections,
	RegisterKind,
	RegisterOperationDiagnostic,
	RegisterQuery,
	RegisterStatus,
} from './register-types.js';
import {
	REGISTER_KIND_ORDER,
	REGISTER_STATUS_ORDER,
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

function deterministicSort(items: AnyRegisterItem[]): AnyRegisterItem[] {
	return [...items].sort((a, b) => {
		const kindOrder =
			(REGISTER_KIND_ORDER[a.kind] ?? 99) - (REGISTER_KIND_ORDER[b.kind] ?? 99);
		if (kindOrder !== 0) return kindOrder;
		const statusOrder =
			(REGISTER_STATUS_ORDER[a.status] ?? 99) -
			(REGISTER_STATUS_ORDER[b.status] ?? 99);
		if (statusOrder !== 0) return statusOrder;
		const created = a.createdAt.localeCompare(b.createdAt);
		if (created !== 0) return created;
		return a.id.localeCompare(b.id);
	});
}

function filterByQuery(
	items: AnyRegisterItem[],
	query: RegisterQuery,
): AnyRegisterItem[] {
	let result = items;
	if (query.kind) {
		result = result.filter((i) => i.kind === query.kind);
	}
	if (query.status) {
		result = result.filter((i) => i.status === query.status);
	}
	if (query.reviewState) {
		result = result.filter((i) => i.reviewState === query.reviewState);
	}
	if (query.confidence) {
		result = result.filter((i) => i.confidence === query.confidence);
	}
	if (query.documentId) {
		result = result.filter((i) =>
			i.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === query.documentId,
			),
		);
	}
	if (query.sourceId) {
		result = result.filter((i) =>
			i.sourceLinks.some((sl) => sl.sourceId === query.sourceId),
		);
	}
	if (query.itemId) {
		result = result.filter((i) => i.id === query.itemId);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

export function queryRegisters(
	collections: RegisterCollections,
	query: RegisterQuery = {},
): { items: AnyRegisterItem[]; diagnostics: RegisterOperationDiagnostic[] } {
	const all = allItems(collections);
	const filtered = filterByQuery(all, query);
	const sorted = deterministicSort(filtered);
	return { diagnostics: [], items: sorted };
}

export function getDecisionRegister(
	collections: RegisterCollections,
): AnyRegisterItem[] {
	return deterministicSort(
		collections.decisions.filter((d) => d.kind === 'decision'),
	);
}

export function getAssumptionRegister(
	collections: RegisterCollections,
): AnyRegisterItem[] {
	return deterministicSort(
		collections.assumptions.filter((a) => a.kind === 'assumption'),
	);
}

export function getHypothesisRegister(
	collections: RegisterCollections,
): AnyRegisterItem[] {
	return deterministicSort(
		collections.hypotheses.filter((h) => h.kind === 'hypothesis'),
	);
}

export function getRiskRegister(
	collections: RegisterCollections,
): AnyRegisterItem[] {
	return deterministicSort(collections.risks.filter((r) => r.kind === 'risk'));
}

export function getOpenQuestionRegister(
	collections: RegisterCollections,
): AnyRegisterItem[] {
	return deterministicSort(
		collections.openQuestions.filter((q) => q.kind === 'open_question'),
	);
}

export function getRegisterItemsByDocument(
	collections: RegisterCollections,
	documentId: CanonicalDocumentId,
): AnyRegisterItem[] {
	const items = allItems(collections).filter((i) =>
		i.affectedDocumentLinks.some((dl) => dl.documentCanonicalId === documentId),
	);
	return deterministicSort(items);
}

export function getRegisterItemsBySource(
	collections: RegisterCollections,
	sourceId: string,
): AnyRegisterItem[] {
	const items = allItems(collections).filter((i) =>
		i.sourceLinks.some((sl) => sl.sourceId === sourceId),
	);
	return deterministicSort(items);
}

export function getRegisterItemsByStatus(
	collections: RegisterCollections,
	kind: RegisterKind,
	status: RegisterStatus,
): AnyRegisterItem[] {
	const items = allItems(collections).filter(
		(i) => i.kind === kind && i.status === status,
	);
	return deterministicSort(items);
}

export function getBlockingOpenQuestions(
	collections: RegisterCollections,
	documentId?: CanonicalDocumentId,
): AnyRegisterItem[] {
	let items = collections.openQuestions.filter(
		(q) => q.isBlocking && q.status === 'open',
	);
	if (documentId) {
		items = items.filter((q) =>
			q.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === documentId,
			),
		);
	}
	return deterministicSort(items);
}

export function getReviewRequiredRegisterItems(
	collections: RegisterCollections,
): AnyRegisterItem[] {
	const items = allItems(collections).filter(
		(i) => i.reviewState === 'requires_review',
	);
	return deterministicSort(items);
}

export function summarizeRegisters(collections: RegisterCollections): {
	totalByKind: Partial<Record<RegisterKind, number>>;
	byKind: Partial<
		Record<
			RegisterKind,
			{
				total: number;
				byStatus: Record<string, number>;
				byConfidence: Record<string, number>;
				byReviewState: Record<string, number>;
			}
		>
	>;
	blockingOpenQuestionCount: number;
	unresolvedOpenQuestionCount: number;
	acceptedRiskCount: number;
	activeHypothesisCount: number;
	reviewRequiredCount: number;
	missingSourceCount: number;
	affectedDocumentCount: number;
	diagnostics: RegisterOperationDiagnostic[];
} {
	const all = allItems(collections);
	const totalByKind: Record<string, number> = {};
	const byKind: Record<
		string,
		{
			total: number;
			byStatus: Record<string, number>;
			byConfidence: Record<string, number>;
			byReviewState: Record<string, number>;
		}
	> = {};

	for (const item of all) {
		totalByKind[item.kind] = (totalByKind[item.kind] ?? 0) + 1;

		const ks = byKind[item.kind] ?? {
			byConfidence: {},
			byReviewState: {},
			byStatus: {},
			total: 0,
		};
		ks.total += 1;
		ks.byStatus[item.status] = (ks.byStatus[item.status] ?? 0) + 1;
		ks.byConfidence[item.confidence] =
			(ks.byConfidence[item.confidence] ?? 0) + 1;
		ks.byReviewState[item.reviewState] =
			(ks.byReviewState[item.reviewState] ?? 0) + 1;
		byKind[item.kind] = ks;
	}

	const blockingOpenQuestions = collections.openQuestions.filter(
		(q) => q.isBlocking && q.status === 'open',
	).length;
	const unresolvedOpenQuestions = collections.openQuestions.filter(
		(q) => q.status === 'open',
	).length;
	const acceptedRisks = collections.risks.filter(
		(r) => r.status === 'accepted',
	).length;
	const activeHypotheses = collections.hypotheses.filter(
		(h) => h.status === 'active',
	).length;
	const reviewRequired = all.filter(
		(i) => i.reviewState === 'requires_review',
	).length;
	const missingSource = all.filter((i) => i.sourceLinks.length === 0).length;

	const affectedDocSet = new Set<string>();
	for (const item of all) {
		for (const dl of item.affectedDocumentLinks) {
			affectedDocSet.add(dl.documentCanonicalId);
		}
	}

	return {
		acceptedRiskCount: acceptedRisks,
		activeHypothesisCount: activeHypotheses,
		affectedDocumentCount: affectedDocSet.size,
		blockingOpenQuestionCount: blockingOpenQuestions,
		byKind,
		diagnostics: [],
		missingSourceCount: missingSource,
		reviewRequiredCount: reviewRequired,
		totalByKind,
		unresolvedOpenQuestionCount: unresolvedOpenQuestions,
	};
}

export function summarizeRegistersForDocument(
	collections: RegisterCollections,
	documentId: CanonicalDocumentId,
): ReturnType<typeof summarizeRegisters> {
	const filteredCollections: RegisterCollections = {
		assumptions: collections.assumptions.filter((a) =>
			a.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === documentId,
			),
		),
		decisions: collections.decisions.filter((d) =>
			d.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === documentId,
			),
		),
		hypotheses: collections.hypotheses.filter((h) =>
			h.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === documentId,
			),
		),
		lifecycleEvents: [],
		openQuestions: collections.openQuestions.filter((q) =>
			q.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === documentId,
			),
		),
		risks: collections.risks.filter((r) =>
			r.affectedDocumentLinks.some(
				(dl) => dl.documentCanonicalId === documentId,
			),
		),
	};
	return summarizeRegisters(filteredCollections);
}

export function summarizeRegistersForStatus(collections: RegisterCollections): {
	countsByKind: Record<
		RegisterKind,
		{ total: number; byStatus: Record<string, number> }
	>;
	blockingCount: number;
	unresolvedCount: number;
	reviewRequiredCount: number;
	diagnostics: RegisterOperationDiagnostic[];
} {
	const summary = summarizeRegisters(collections);

	const countsByKind = {} as Record<
		RegisterKind,
		{ total: number; byStatus: Record<string, number> }
	>;

	for (const kind of [
		'decision',
		'assumption',
		'hypothesis',
		'risk',
		'open_question',
	] as RegisterKind[]) {
		const ks = summary.byKind[kind];
		countsByKind[kind] = {
			byStatus: ks?.byStatus ?? {},
			total: ks?.total ?? 0,
		};
	}

	return {
		blockingCount: summary.blockingOpenQuestionCount,
		countsByKind,
		diagnostics: summary.diagnostics,
		reviewRequiredCount: summary.reviewRequiredCount,
		unresolvedCount: summary.unresolvedOpenQuestionCount,
	};
}
