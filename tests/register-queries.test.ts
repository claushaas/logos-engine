/** Step 8.2 — Register Queries Tests */

import { describe, expect, it } from 'vitest';
import {
	getAssumptionRegister,
	getBlockingOpenQuestions,
	getDecisionRegister,
	getHypothesisRegister,
	getOpenQuestionRegister,
	getRegisterItemsByDocument,
	getRegisterItemsBySource,
	getRegisterItemsByStatus,
	getReviewRequiredRegisterItems,
	getRiskRegister,
	queryRegisters,
	summarizeRegisters,
	summarizeRegistersForDocument,
	summarizeRegistersForStatus,
} from '../src/registers/register-queries.js';
import type {
	AnyRegisterItem,
	RegisterCollections,
} from '../src/registers/register-types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = '2024-01-15T00:00:00.000Z';

function makeItem(
	id: string,
	kind: string,
	status: string,
	reviewState: string,
	confidence: string,
	docLinks: string[] = [],
	sourceLinks: string[] = [],
): AnyRegisterItem {
	const base = {
		affectedDocumentLinks: docLinks.map((d) => ({
			documentCanonicalId: d,
			linkedAt: now,
		})),
		body: `Body for ${id}`,
		confidence: confidence as AnyRegisterItem['confidence'],
		createdAt: now,
		diagnostics: [],
		id,
		kind: kind as AnyRegisterItem['kind'],
		lifecycleHistory: [],
		reviewState: reviewState as AnyRegisterItem['reviewState'],
		sourceLinks: sourceLinks.map((s) => ({
			linkedAt: now,
			sourceId: s,
		})),
		status: status as AnyRegisterItem['status'],
		title: `Title for ${id}`,
		updatedAt: now,
	};

	switch (kind) {
		case 'decision':
			return {
				...base,
				decisionStatement: base.title,
				kind: 'decision',
			} as AnyRegisterItem;
		case 'assumption':
			return {
				...base,
				assumptionStatement: base.title,
				kind: 'assumption',
			} as AnyRegisterItem;
		case 'hypothesis':
			return {
				...base,
				hypothesisStatement: base.title,
				kind: 'hypothesis',
			} as AnyRegisterItem;
		case 'risk':
			return {
				...base,
				kind: 'risk',
				riskStatement: base.title,
			} as AnyRegisterItem;
		case 'open_question':
			return {
				...base,
				isBlocking: id === 'q-blocking',
				kind: 'open_question',
				questionText: base.title,
			} as AnyRegisterItem;
		default:
			return base as AnyRegisterItem;
	}
}

function makeCollections(): RegisterCollections {
	return {
		assumptions: [],
		decisions: [],
		hypotheses: [],
		lifecycleEvents: [],
		openQuestions: [],
		risks: [],
	};
}

function populatedCollections(): RegisterCollections {
	const c = makeCollections();
	c.decisions = [
		makeItem(
			'd-1',
			'decision',
			'confirmed',
			'approved',
			'explicit',
			['doc-1'],
			['src-1'],
		),
		makeItem(
			'd-2',
			'decision',
			'proposed',
			'requires_review',
			'inferred',
			[],
			[],
		),
		makeItem(
			'd-3',
			'decision',
			'rejected',
			'rejected',
			'inferred',
			['doc-2'],
			[],
		),
	] as AnyRegisterItem[];
	c.assumptions = [
		makeItem(
			'a-1',
			'assumption',
			'confirmed',
			'approved',
			'explicit',
			['doc-1'],
			['src-1'],
		),
		makeItem(
			'a-2',
			'assumption',
			'proposed',
			'requires_review',
			'derived',
			[],
			[],
		),
	] as AnyRegisterItem[];
	c.hypotheses = [
		makeItem('h-1', 'hypothesis', 'active', 'in_review', 'explicit', [], []),
		makeItem(
			'h-2',
			'hypothesis',
			'validated',
			'approved',
			'explicit',
			[],
			['src-2'],
		),
	] as AnyRegisterItem[];
	c.risks = [
		makeItem('r-1', 'risk', 'accepted', 'approved', 'explicit', ['doc-1'], []),
		makeItem('r-2', 'risk', 'proposed', 'requires_review', 'inferred', [], []),
	] as AnyRegisterItem[];
	c.openQuestions = [
		makeItem(
			'q-1',
			'open_question',
			'open',
			'requires_review',
			'unknown',
			['doc-1'],
			[],
		),
		makeItem(
			'q-blocking',
			'open_question',
			'open',
			'requires_review',
			'unknown',
			['doc-1'],
			[],
		),
		makeItem(
			'q-2',
			'open_question',
			'resolved',
			'approved',
			'explicit',
			[],
			[],
		),
	] as AnyRegisterItem[];
	return c;
}

// ---------------------------------------------------------------------------

describe('Register query APIs', () => {
	const collections = populatedCollections();

	describe('getDecisionRegister', () => {
		it('returns all decisions sorted', () => {
			const items = getDecisionRegister(collections);
			expect(items.length).toBe(3);
			expect(items.every((i) => i.kind === 'decision')).toBe(true);
			// Confirmed should come before proposed before rejected in sort order
			expect(items[0]?.status).toBe('confirmed');
		});
	});

	describe('getAssumptionRegister', () => {
		it('returns all assumptions', () => {
			const items = getAssumptionRegister(collections);
			expect(items.length).toBe(2);
			expect(items.every((i) => i.kind === 'assumption')).toBe(true);
		});
	});

	describe('getHypothesisRegister', () => {
		it('returns all hypotheses', () => {
			const items = getHypothesisRegister(collections);
			expect(items.length).toBe(2);
		});
	});

	describe('getRiskRegister', () => {
		it('returns all risks', () => {
			const items = getRiskRegister(collections);
			expect(items.length).toBe(2);
		});
	});

	describe('getOpenQuestionRegister', () => {
		it('returns all open questions', () => {
			const items = getOpenQuestionRegister(collections);
			expect(items.length).toBe(3);
		});
	});

	describe('getRegisterItemsByDocument', () => {
		it('returns items linked to a document', () => {
			const items = getRegisterItemsByDocument(collections, 'doc-1');
			// d-1, a-1, r-1, q-1, q-blocking
			expect(items.length).toBe(5);
		});

		it('returns empty for unknown document', () => {
			const items = getRegisterItemsByDocument(collections, 'unknown-doc');
			expect(items.length).toBe(0);
		});
	});

	describe('getRegisterItemsBySource', () => {
		it('returns items linked to a source', () => {
			const items = getRegisterItemsBySource(collections, 'src-1');
			expect(items.length).toBe(2); // d-1, a-1
		});

		it('returns empty for unknown source', () => {
			const items = getRegisterItemsBySource(collections, 'unknown-src');
			expect(items.length).toBe(0);
		});
	});

	describe('getRegisterItemsByStatus', () => {
		it('filters by kind and status', () => {
			const items = getRegisterItemsByStatus(
				collections,
				'decision',
				'confirmed',
			);
			expect(items.length).toBe(1);
			expect(items[0]?.id).toBe('d-1');
		});
	});

	describe('getBlockingOpenQuestions', () => {
		it('returns blocking open questions', () => {
			const items = getBlockingOpenQuestions(collections);
			expect(items.length).toBe(1);
			expect(items[0]?.id).toBe('q-blocking');
		});

		it('filters by document', () => {
			const items = getBlockingOpenQuestions(collections, 'doc-1');
			expect(items.length).toBe(1);
			expect(items[0]?.id).toBe('q-blocking');
		});

		it('returns empty for document with no blocking questions', () => {
			const items = getBlockingOpenQuestions(collections, 'doc-2');
			expect(items.length).toBe(0);
		});
	});

	describe('getReviewRequiredRegisterItems', () => {
		it('returns items requiring review', () => {
			const items = getReviewRequiredRegisterItems(collections);
			// d-2, a-2, r-2, q-1, q-blocking
			expect(items.length).toBe(5);
			expect(items.every((i) => i.reviewState === 'requires_review')).toBe(
				true,
			);
		});
	});

	describe('queryRegisters', () => {
		it('queries by kind', () => {
			const { items } = queryRegisters(collections, { kind: 'risk' });
			expect(items.length).toBe(2);
		});

		it('queries by status', () => {
			const { items } = queryRegisters(collections, { status: 'open' });
			expect(items.length).toBe(2); // q-1, q-blocking
		});

		it('queries by reviewState', () => {
			const { items } = queryRegisters(collections, {
				reviewState: 'approved',
			});
			expect(items.length).toBe(5); // d-1, a-1, h-2, r-1, q-2
		});

		it('queries by document', () => {
			const { items } = queryRegisters(collections, { documentId: 'doc-2' });
			expect(items.length).toBe(1); // d-3
		});

		it('returns empty for unknown itemId', () => {
			const { items } = queryRegisters(collections, { itemId: 'nonexistent' });
			expect(items.length).toBe(0);
		});
	});
});

describe('Register summaries', () => {
	const collections = populatedCollections();

	describe('summarizeRegisters', () => {
		it('counts by kind', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.totalByKind.decision).toBe(3);
			expect(summary.totalByKind.assumption).toBe(2);
			expect(summary.totalByKind.hypothesis).toBe(2);
			expect(summary.totalByKind.risk).toBe(2);
			expect(summary.totalByKind.open_question).toBe(3);
		});

		it('counts by status', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.byKind.decision?.byStatus.confirmed).toBe(1);
			expect(summary.byKind.decision?.byStatus.proposed).toBe(1);
			expect(summary.byKind.decision?.byStatus.rejected).toBe(1);
		});

		it('counts blocking open questions', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.blockingOpenQuestionCount).toBe(1);
		});

		it('counts unresolved open questions', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.unresolvedOpenQuestionCount).toBe(2); // q-1 and q-blocking
		});

		it('counts accepted risks', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.acceptedRiskCount).toBe(1);
		});

		it('counts active hypotheses', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.activeHypothesisCount).toBe(1);
		});

		it('counts review-required items', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.reviewRequiredCount).toBe(5);
		});

		it('counts missing-source items', () => {
			const summary = summarizeRegisters(collections);
			expect(summary.missingSourceCount).toBeGreaterThan(0);
		});
	});

	describe('summarizeRegistersForDocument', () => {
		it('returns summary scoped to document', () => {
			const summary = summarizeRegistersForDocument(collections, 'doc-1');
			expect(summary.totalByKind.decision).toBe(1); // d-1
			expect(summary.totalByKind.assumption).toBe(1); // a-1
			expect(summary.totalByKind.risk).toBe(1); // r-1
			expect(summary.totalByKind.open_question).toBe(2); // q-1, q-blocking
		});

		it('returns zero counts for unrelated document', () => {
			const summary = summarizeRegistersForDocument(collections, 'doc-99');
			expect(summary.totalByKind.decision ?? 0).toBe(0);
		});
	});

	describe('summarizeRegistersForStatus', () => {
		it('returns status-oriented summary', () => {
			const result = summarizeRegistersForStatus(collections);
			expect(result.blockingCount).toBe(1);
			expect(result.unresolvedCount).toBe(2);
			expect(result.reviewRequiredCount).toBe(5);
			expect(result.countsByKind.decision.total).toBe(3);
		});
	});
});

describe('Deterministic ordering', () => {
	it('query results are deterministically ordered', () => {
		const c = makeCollections();
		c.decisions = [
			makeItem(
				'd-z',
				'decision',
				'proposed',
				'requires_review',
				'inferred',
				[],
				[],
			),
			makeItem('d-a', 'decision', 'confirmed', 'approved', 'explicit', [], []),
			makeItem('d-m', 'decision', 'rejected', 'rejected', 'inferred', [], []),
		] as AnyRegisterItem[];

		const items = getDecisionRegister(c);
		// Should be sorted: confirmed first (kind order 0), then proposed, then rejected
		expect(items[0]?.id).toBe('d-a'); // confirmed
		expect(items[1]?.id).toBe('d-z'); // proposed
		expect(items[2]?.id).toBe('d-m'); // rejected

		// Verify determinism
		const items2 = getDecisionRegister(c);
		expect(items.map((i) => i.id)).toEqual(items2.map((i) => i.id));
	});
});
