import { describe, expect, it } from 'vitest';
import {
	assertValidStatusTransition,
	confirmDecision,
	createDecision,
	createDecisionFromProposal,
	createEmptyDecisionStore,
	getAffectedDocumentsOnChange,
	getConfirmedDecisions,
	getDecisionById,
	getDecisionsByStatus,
	getDownstreamImpacts,
	getProposedDecisions,
	InvalidStatusTransitionError,
	isValidStatusTransition,
	rejectDecision,
	removeDecision,
	transitionDecisionStatus,
	updateDecisionValue,
	upsertDecision,
} from '../../src/index.js';

describe('decision schema and creation', () => {
	it('creates a decision with required fields and defaults', () => {
		const decision = createDecision({
			id: 'product.target_platform',
			rationale: 'User stated they want a mobile-first experience.',
			status: 'confirmed',
			title: 'Target platform is mobile-first',
			value: 'mobile',
		});

		expect(decision.id).toBe('product.target_platform');
		expect(decision.title).toBe('Target platform is mobile-first');
		expect(decision.value).toBe('mobile');
		expect(decision.status).toBe('confirmed');
		expect(decision.confidence).toBe('medium');
		expect(decision.sourceAnswerIds).toEqual([]);
		expect(decision.affectedDocuments).toEqual([]);
		expect(decision.impacts).toEqual([]);
		expect(decision.revisionHistory).toEqual([]);
		expect(decision.createdAt).toBeTypeOf('string');
		expect(decision.updatedAt).toBeTypeOf('string');
	});

	it('creates a decision with all optional fields', () => {
		const decision = createDecision({
			affectedDocuments: ['docs/04-product/PRODUCT_THESIS.md'],
			confidence: 'high',
			id: 'business.model',
			impacts: ['business.pricing_strategy'],
			rationale: 'SaaS is the most common model for this product type.',
			sourceAnswerIds: ['answer_001'],
			status: 'assumed',
			title: 'Business model is SaaS',
			value: 'saas',
		});

		expect(decision.confidence).toBe('high');
		expect(decision.sourceAnswerIds).toEqual(['answer_001']);
		expect(decision.affectedDocuments).toEqual([
			'docs/04-product/PRODUCT_THESIS.md',
		]);
		expect(decision.impacts).toEqual(['business.pricing_strategy']);
	});

	it('creates a decision from an AI proposal', () => {
		const proposal = {
			confidence: 0.85,
			decisionId: 'tech.stack',
			rationale: 'The user mentioned TypeScript and React Native.',
			sourceAnswerIds: ['answer_003'],
			suggestedTitle: 'Tech stack uses TypeScript',
			suggestedValue: 'typescript',
		};
		const decision = createDecisionFromProposal(proposal, [
			'docs/06-architecture/TECH_STACK.md',
		]);

		expect(decision.id).toBe('tech.stack');
		expect(decision.status).toBe('proposed');
		expect(decision.confidence).toBe('high');
		expect(decision.title).toBe('Tech stack uses TypeScript');
		expect(decision.value).toBe('typescript');
		expect(decision.sourceProposalId).toBe('tech.stack');
		expect(decision.affectedDocuments).toEqual([
			'docs/06-architecture/TECH_STACK.md',
		]);
	});

	it('maps numeric confidence correctly', () => {
		const high = createDecisionFromProposal({
			confidence: 0.8,
			decisionId: 'high',
			rationale: 'test',
			suggestedTitle: 'High',
			suggestedValue: true,
		});
		const medium = createDecisionFromProposal({
			confidence: 0.5,
			decisionId: 'medium',
			rationale: 'test',
			suggestedTitle: 'Medium',
			suggestedValue: true,
		});
		const low = createDecisionFromProposal({
			confidence: 0.2,
			decisionId: 'low',
			rationale: 'test',
			suggestedTitle: 'Low',
			suggestedValue: true,
		});

		expect(high.confidence).toBe('high');
		expect(medium.confidence).toBe('medium');
		expect(low.confidence).toBe('low');
	});
});

describe('decision status transitions', () => {
	it('allows valid transitions', () => {
		expect(isValidStatusTransition('unknown', 'assumed')).toBe(true);
		expect(isValidStatusTransition('unknown', 'proposed')).toBe(true);
		expect(isValidStatusTransition('unknown', 'confirmed')).toBe(true);
		expect(isValidStatusTransition('proposed', 'confirmed')).toBe(true);
		expect(isValidStatusTransition('proposed', 'deprecated')).toBe(true);
		expect(isValidStatusTransition('confirmed', 'deprecated')).toBe(true);
		expect(isValidStatusTransition('confirmed', 'assumed')).toBe(true);
		expect(isValidStatusTransition('confirmed', 'proposed')).toBe(true);
		expect(isValidStatusTransition('deprecated', 'unknown')).toBe(true);
		expect(isValidStatusTransition('deprecated', 'proposed')).toBe(true);
		expect(isValidStatusTransition('deprecated', 'assumed')).toBe(true);
	});

	it('rejects invalid transitions', () => {
		expect(isValidStatusTransition('confirmed', 'unknown')).toBe(false);
		expect(isValidStatusTransition('assumed', 'unknown')).toBe(false);
		expect(isValidStatusTransition('proposed', 'assumed')).toBe(false);
		expect(isValidStatusTransition('deprecated', 'confirmed')).toBe(false);
		expect(isValidStatusTransition('unknown', 'deprecated')).toBe(false);
	});

	it('always allows same-status transitions', () => {
		for (const status of [
			'unknown',
			'assumed',
			'proposed',
			'confirmed',
			'deprecated',
		] as const) {
			expect(isValidStatusTransition(status, status)).toBe(true);
		}
	});

	it('throws on invalid transition via assertValidStatusTransition', () => {
		expect(() =>
			assertValidStatusTransition('id', 'confirmed', 'unknown'),
		).toThrow(InvalidStatusTransitionError);
	});

	it('does not throw on valid transition via assertValidStatusTransition', () => {
		expect(() =>
			assertValidStatusTransition('id', 'proposed', 'confirmed'),
		).not.toThrow();
	});
});

describe('decision mutation and history', () => {
	it('transitions decision status and records change', () => {
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'proposed',
			title: 'Test',
			value: true,
		});
		const updated = transitionDecisionStatus(
			decision,
			'confirmed',
			'User accepted',
		);

		expect(updated.status).toBe('confirmed');
		expect(updated.revisionHistory).toHaveLength(1);
		expect(updated.revisionHistory[0].previousStatus).toBe('proposed');
		expect(updated.revisionHistory[0].newStatus).toBe('confirmed');
		expect(updated.revisionHistory[0].reason).toBe('User accepted');
	});

	it('confirms a decision', () => {
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'proposed',
			title: 'Test',
			value: true,
		});
		const confirmed = confirmDecision(decision);

		expect(confirmed.status).toBe('confirmed');
		expect(confirmed.revisionHistory[0].previousStatus).toBe('proposed');
	});

	it('rejects a decision by deprecating it', () => {
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'proposed',
			title: 'Test',
			value: true,
		});
		const rejected = rejectDecision(decision, 'Not applicable');

		expect(rejected.status).toBe('deprecated');
		expect(rejected.revisionHistory[0].reason).toBe('Not applicable');
	});

	it('updates decision value and records change', () => {
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'confirmed',
			title: 'Test',
			value: 'old',
		});
		const updated = updateDecisionValue(decision, 'new', 'User changed mind');

		expect(updated.value).toBe('new');
		expect(updated.revisionHistory).toHaveLength(1);
		expect(updated.revisionHistory[0].previousValue).toBe('old');
		expect(updated.revisionHistory[0].newValue).toBe('new');
		expect(updated.status).toBe('confirmed');
	});

	it('accumulates revision history across multiple changes', () => {
		let decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'unknown',
			title: 'Test',
			value: 'a',
		});
		decision = transitionDecisionStatus(decision, 'proposed');
		decision = transitionDecisionStatus(decision, 'confirmed');
		decision = updateDecisionValue(decision, 'b');

		expect(decision.revisionHistory).toHaveLength(3);
	});
});

describe('decision store operations', () => {
	it('creates an empty store', () => {
		const store = createEmptyDecisionStore();

		expect(store.decisions).toEqual([]);
	});

	it('upserts a new decision into the store', () => {
		let store = createEmptyDecisionStore();
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'confirmed',
			title: 'Test',
			value: true,
		});
		store = upsertDecision(store, decision);

		expect(store.decisions).toHaveLength(1);
		expect(store.decisions[0].id).toBe('test');
	});

	it('updates an existing decision in the store', () => {
		let store = createEmptyDecisionStore();
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'proposed',
			title: 'Test',
			value: true,
		});
		store = upsertDecision(store, decision);
		const confirmed = confirmDecision(store.decisions[0]);
		store = upsertDecision(store, confirmed);

		expect(store.decisions).toHaveLength(1);
		expect(store.decisions[0].status).toBe('confirmed');
	});

	it('removes a decision from the store', () => {
		let store = createEmptyDecisionStore();
		store = upsertDecision(
			store,
			createDecision({
				id: 'a',
				rationale: 'test',
				status: 'confirmed',
				title: 'A',
				value: true,
			}),
		);
		store = upsertDecision(
			store,
			createDecision({
				id: 'b',
				rationale: 'test',
				status: 'confirmed',
				title: 'B',
				value: true,
			}),
		);
		store = removeDecision(store, 'a');

		expect(store.decisions).toHaveLength(1);
		expect(store.decisions[0].id).toBe('b');
	});

	it('retrieves a decision by id', () => {
		const store = createEmptyDecisionStore();
		const decision = createDecision({
			id: 'test',
			rationale: 'test',
			status: 'confirmed',
			title: 'Test',
			value: true,
		});
		const withDecision = upsertDecision(store, decision);

		expect(getDecisionById(withDecision, 'test')?.id).toBe('test');
		expect(getDecisionById(withDecision, 'missing')).toBeUndefined();
	});

	it('filters decisions by status', () => {
		let store = createEmptyDecisionStore();
		store = upsertDecision(
			store,
			createDecision({
				id: 'a',
				rationale: 'test',
				status: 'confirmed',
				title: 'A',
				value: true,
			}),
		);
		store = upsertDecision(
			store,
			createDecision({
				id: 'b',
				rationale: 'test',
				status: 'proposed',
				title: 'B',
				value: true,
			}),
		);
		store = upsertDecision(
			store,
			createDecision({
				id: 'c',
				rationale: 'test',
				status: 'confirmed',
				title: 'C',
				value: true,
			}),
		);

		expect(getDecisionsByStatus(store, 'confirmed')).toHaveLength(2);
		expect(getDecisionsByStatus(store, 'proposed')).toHaveLength(1);
		expect(getProposedDecisions(store)).toHaveLength(1);
		expect(getConfirmedDecisions(store)).toHaveLength(2);
	});
});

describe('decision impact and affected documents', () => {
	it('returns affected documents', () => {
		const decision = createDecision({
			affectedDocuments: ['docs/a.md', 'docs/b.md'],
			id: 'test',
			rationale: 'test',
			status: 'confirmed',
			title: 'Test',
			value: true,
		});

		expect(getAffectedDocumentsOnChange(decision)).toEqual([
			'docs/a.md',
			'docs/b.md',
		]);
	});

	it('returns downstream impacts', () => {
		const decision = createDecision({
			id: 'test',
			impacts: ['decision.a', 'decision.b'],
			rationale: 'test',
			status: 'confirmed',
			title: 'Test',
			value: true,
		});

		expect(getDownstreamImpacts(decision)).toEqual([
			'decision.a',
			'decision.b',
		]);
	});

	it('deduplicates affected documents', () => {
		const decision = createDecision({
			affectedDocuments: ['docs/a.md', 'docs/a.md', 'docs/b.md'],
			id: 'test',
			rationale: 'test',
			status: 'confirmed',
			title: 'Test',
			value: true,
		});

		expect(getAffectedDocumentsOnChange(decision)).toEqual([
			'docs/a.md',
			'docs/b.md',
		]);
	});
});

describe('decision registry error types', () => {
	it('throws InvalidStatusTransitionError for bad transitions', () => {
		expect(() =>
			transitionDecisionStatus(
				createDecision({
					id: 'test',
					rationale: 'test',
					status: 'confirmed',
					title: 'Test',
					value: true,
				}),
				'unknown',
			),
		).toThrow(InvalidStatusTransitionError);
	});

	it('includes decision id in InvalidStatusTransitionError message', () => {
		try {
			transitionDecisionStatus(
				createDecision({
					id: 'test-id',
					rationale: 'test',
					status: 'confirmed',
					title: 'Test',
					value: true,
				}),
				'unknown',
			);
		} catch (error) {
			expect(error).toBeInstanceOf(InvalidStatusTransitionError);
			expect((error as Error).message).toContain('test-id');
			expect((error as Error).message).toContain('confirmed');
			expect((error as Error).message).toContain('unknown');
		}
	});
});
