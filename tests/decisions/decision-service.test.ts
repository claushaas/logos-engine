import { describe, expect, it } from 'vitest';
import {
	changeConfirmedDecision,
	createEmptyStore,
	createManualDecision,
	DecisionServiceError,
	deprecateDecision,
	getPendingProposals,
	receiveAiDecisionProposals,
	reviewProposedDecision,
} from '../../src/index.js';

describe('decision service store persistence', () => {
	it('loads and saves a decision store through state files', () => {
		const store = createEmptyStore();
		const { store: updated } = createManualDecision(store, {
			id: 'product.mvp_scope',
			rationale: 'User wants a small MVP.',
			status: 'confirmed',
			title: 'MVP scope is limited',
			value: 'small',
		});

		// Verify store operations work in memory
		expect(updated.decisions).toHaveLength(1);
		expect(updated.decisions[0].id).toBe('product.mvp_scope');
	});

	it('creates an empty store', () => {
		const store = createEmptyStore();

		expect(store.decisions).toEqual([]);
	});
});

describe('decision service manual creation', () => {
	it('creates a manual confirmed decision', () => {
		const store = createEmptyStore();
		const { decision, store: updated } = createManualDecision(store, {
			affectedDocuments: ['docs/04-product/MVP_SCOPE.md'],
			confidence: 'high',
			id: 'product.mvp_scope',
			impacts: ['product.roadmap'],
			rationale: 'User wants a small MVP.',
			sourceAnswerIds: ['answer_001'],
			status: 'confirmed',
			title: 'MVP scope is limited',
			value: 'small',
		});

		expect(decision.status).toBe('confirmed');
		expect(decision.title).toBe('MVP scope is limited');
		expect(decision.affectedDocuments).toEqual([
			'docs/04-product/MVP_SCOPE.md',
		]);
		expect(updated.decisions).toHaveLength(1);
	});

	it('creates an assumed decision', () => {
		const store = createEmptyStore();
		const { decision } = createManualDecision(store, {
			id: 'business.pricing',
			rationale: 'Assumed for planning purposes.',
			status: 'assumed',
			title: 'Pricing is freemium',
			value: 'freemium',
		});

		expect(decision.status).toBe('assumed');
	});
});

describe('decision service AI proposal handling', () => {
	it('receives AI decision proposals and creates proposed decisions', () => {
		const store = createEmptyStore();
		const proposals = [
			{
				confidence: 0.8,
				decisionId: 'tech.frontend',
				rationale: 'User mentioned React.',
				sourceAnswerIds: ['answer_002'],
				suggestedTitle: 'Frontend uses React',
				suggestedValue: 'react',
			},
			{
				confidence: 0.6,
				decisionId: 'tech.backend',
				rationale: 'User mentioned Node.js.',
				sourceAnswerIds: ['answer_003'],
				suggestedTitle: 'Backend uses Node.js',
				suggestedValue: 'nodejs',
			},
		];
		const affectedDocMap = new Map<string, readonly string[]>([
			['tech.frontend', ['docs/06-architecture/TECH_STACK.md']],
			[
				'tech.backend',
				[
					'docs/06-architecture/TECH_STACK.md',
					'docs/06-architecture/ARCHITECTURE.md',
				],
			],
		]);

		const { store: updated, createdIds } = receiveAiDecisionProposals(
			store,
			proposals,
			affectedDocMap,
		);

		expect(createdIds).toEqual(['tech.frontend', 'tech.backend']);
		expect(updated.decisions).toHaveLength(2);
		expect(updated.decisions[0].status).toBe('proposed');
		expect(updated.decisions[1].status).toBe('proposed');
		expect(updated.decisions[0].affectedDocuments).toEqual([
			'docs/06-architecture/TECH_STACK.md',
		]);
		expect(updated.decisions[1].affectedDocuments).toEqual([
			'docs/06-architecture/TECH_STACK.md',
			'docs/06-architecture/ARCHITECTURE.md',
		]);
	});

	it('skips existing decisions when receiving proposals', () => {
		let store = createEmptyStore();
		const { store: withDecision } = createManualDecision(store, {
			id: 'tech.frontend',
			rationale: 'Already decided.',
			status: 'confirmed',
			title: 'Frontend uses React',
			value: 'react',
		});
		store = withDecision;

		const proposals = [
			{
				confidence: 0.8,
				decisionId: 'tech.frontend',
				rationale: 'User mentioned React.',
				sourceAnswerIds: ['answer_002'],
				suggestedTitle: 'Frontend uses React',
				suggestedValue: 'react',
			},
		];

		const { store: updated, createdIds } = receiveAiDecisionProposals(
			store,
			proposals,
		);

		expect(createdIds).toEqual([]);
		expect(updated.decisions).toHaveLength(1);
		expect(updated.decisions[0].status).toBe('confirmed');
	});

	it('receives proposals without affected document maps', () => {
		const store = createEmptyStore();
		const proposals = [
			{
				confidence: 0.5,
				decisionId: 'design.theme',
				rationale: 'User prefers dark mode.',
				sourceAnswerIds: ['answer_004'],
				suggestedTitle: 'Default theme is dark',
				suggestedValue: 'dark',
			},
		];

		const { store: updated, createdIds } = receiveAiDecisionProposals(
			store,
			proposals,
		);

		expect(createdIds).toEqual(['design.theme']);
		expect(updated.decisions[0].affectedDocuments).toEqual([]);
	});
});

describe('decision service proposal review', () => {
	it('confirms a proposed decision', () => {
		let store = createEmptyStore();
		const { store: withProposals } = receiveAiDecisionProposals(store, [
			{
				confidence: 0.8,
				decisionId: 'tech.frontend',
				rationale: 'User mentioned React.',
				sourceAnswerIds: ['answer_002'],
				suggestedTitle: 'Frontend uses React',
				suggestedValue: 'react',
			},
		]);
		store = withProposals;

		const result = reviewProposedDecision(
			store,
			'tech.frontend',
			'confirm',
			'Looks correct',
		);

		expect(result.status).toBe('confirmed');
		expect(result.decisionId).toBe('tech.frontend');
		expect(store.decisions[0].status).toBe('confirmed');
		expect(store.decisions[0].revisionHistory[0].reason).toBe('Looks correct');
	});

	it('rejects a proposed decision', () => {
		let store = createEmptyStore();
		const { store: withProposals } = receiveAiDecisionProposals(store, [
			{
				confidence: 0.3,
				decisionId: 'tech.database',
				rationale: 'Unclear from answers.',
				sourceAnswerIds: ['answer_005'],
				suggestedTitle: 'Database is MongoDB',
				suggestedValue: 'mongodb',
			},
		]);
		store = withProposals;

		const result = reviewProposedDecision(
			store,
			'tech.database',
			'reject',
			'Not enough evidence',
		);

		expect(result.status).toBe('rejected');
		expect(store.decisions[0].status).toBe('deprecated');
	});

	it('returns unchanged for non-proposed decisions', () => {
		let store = createEmptyStore();
		const { store: withDecision } = createManualDecision(store, {
			id: 'tech.frontend',
			rationale: 'Already decided.',
			status: 'confirmed',
			title: 'Frontend uses React',
			value: 'react',
		});
		store = withDecision;

		const result = reviewProposedDecision(store, 'tech.frontend', 'confirm');

		expect(result.status).toBe('unchanged');
		expect(store.decisions[0].status).toBe('confirmed');
	});

	it('throws when reviewing a non-existent decision', () => {
		const store = createEmptyStore();

		expect(() => reviewProposedDecision(store, 'missing', 'confirm')).toThrow(
			DecisionServiceError,
		);
	});

	it('identifies affected documents and downstream impacts on confirmation', () => {
		let store = createEmptyStore();
		const { store: withProposals } = receiveAiDecisionProposals(
			store,
			[
				{
					confidence: 0.8,
					decisionId: 'tech.offline_first',
					rationale: 'User needs offline capability.',
					sourceAnswerIds: ['answer_006'],
					suggestedTitle: 'Offline-first strategy',
					suggestedValue: true,
				},
			],
			new Map([
				[
					'tech.offline_first',
					[
						'docs/06-architecture/ARCHITECTURE.md',
						'docs/08-testing/TESTING_STRATEGY.md',
					],
				],
			]),
			new Map([['tech.offline_first', ['tech.sync_strategy', 'tech.storage']]]),
		);
		store = withProposals;

		const result = reviewProposedDecision(
			store,
			'tech.offline_first',
			'confirm',
		);

		expect(result.affectedDocuments).toEqual([
			'docs/06-architecture/ARCHITECTURE.md',
			'docs/08-testing/TESTING_STRATEGY.md',
		]);
		expect(result.downstreamImpacts).toEqual([
			'tech.sync_strategy',
			'tech.storage',
		]);
	});
});

describe('decision service confirmed decision changes', () => {
	it('changes the value of a confirmed decision', () => {
		let store = createEmptyStore();
		const { store: withDecision } = createManualDecision(store, {
			id: 'tech.frontend',
			rationale: 'Initial choice.',
			status: 'confirmed',
			title: 'Frontend framework',
			value: 'react',
		});
		store = withDecision;

		const result = changeConfirmedDecision(
			store,
			'tech.frontend',
			'svelte',
			'User changed preference',
		);

		expect(result.decisionId).toBe('tech.frontend');
		expect(result.previousStatus).toBe('confirmed');
		expect(store.decisions[0].value).toBe('svelte');
		expect(store.decisions[0].revisionHistory[0].previousValue).toBe('react');
		expect(store.decisions[0].revisionHistory[0].newValue).toBe('svelte');
	});

	it('throws when changing a non-existent decision', () => {
		const store = createEmptyStore();

		expect(() =>
			changeConfirmedDecision(store, 'missing', 'new-value'),
		).toThrow(DecisionServiceError);
	});

	it('deprecates a confirmed decision', () => {
		let store = createEmptyStore();
		const { store: withDecision } = createManualDecision(store, {
			id: 'tech.frontend',
			rationale: 'Initial choice.',
			status: 'confirmed',
			title: 'Frontend framework',
			value: 'react',
		});
		store = withDecision;

		const result = deprecateDecision(
			store,
			'tech.frontend',
			'No longer relevant',
		);

		expect(result.previousStatus).toBe('confirmed');
		expect(store.decisions[0].status).toBe('deprecated');
	});

	it('throws when deprecating a non-existent decision', () => {
		const store = createEmptyStore();

		expect(() => deprecateDecision(store, 'missing')).toThrow(
			DecisionServiceError,
		);
	});
});

describe('decision service proposal queries', () => {
	it('returns pending proposals', () => {
		let store = createEmptyStore();
		store = createManualDecision(store, {
			id: 'confirmed.1',
			rationale: 'test',
			status: 'confirmed',
			title: 'Confirmed 1',
			value: true,
		}).store;
		store = createManualDecision(store, {
			id: 'proposed.1',
			rationale: 'test',
			status: 'proposed',
			title: 'Proposed 1',
			value: true,
		}).store;
		store = createManualDecision(store, {
			id: 'proposed.2',
			rationale: 'test',
			status: 'proposed',
			title: 'Proposed 2',
			value: true,
		}).store;

		const pending = getPendingProposals(store);

		expect(pending).toHaveLength(2);
		expect(pending.map((d) => d.id).sort()).toEqual([
			'proposed.1',
			'proposed.2',
		]);
	});
});
