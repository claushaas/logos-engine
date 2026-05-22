/**
 * Tests for question registry metadata preservation (Step 3.2).
 *
 * Covers:
 * - Question preserves original source question text.
 * - Question preserves phase/document/section metadata.
 * - Question derives purpose from section title or document metadata.
 * - Question gets default follow-up policy.
 * - Question derives acceptance/completion metadata from document completion
 *   criteria or quality checks where available.
 * - Question dependencies are either represented safely or preserved in metadata.
 */

import { describe, expect, it } from 'vitest';
import { loadProfileContracts } from '../../src/core/profiles/load-profile-contracts.js';
import type { ProfileDocumentContract } from '../../src/core/profiles/profile-contracts.js';
import { buildQuestionRegistry } from '../../src/core/questions/question-registry.js';
import { DEFAULT_FOLLOW_UP_POLICY } from '../../src/core/questions/question-types.js';
import {
	addStandardProfileToFs,
	createFakeFilesystem,
} from './helpers/fake-filesystem.js';

function makeDocContract(
	overrides?: Partial<ProfileDocumentContract>,
): ProfileDocumentContract {
	return {
		id: '01-thesis',
		path: '/project/profiles/standard/phases/01-foundation/01-thesis.yml',
		phaseId: '01-foundation',
		raw: {},
		sections: [
			{
				id: 'core-thesis',
				questions: ['What is the central thesis?'],
				required: true,
				title: 'Core Thesis',
			},
		],
		...overrides,
	};
}

describe('question registry metadata', () => {
	it('preserves original source question text', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'sec-a',
					questions: ['Original question text?'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.questions[0]?.question).toBe(
				'Original question text?',
			);
		}
	});

	it('preserves phase, document, and section metadata', () => {
		const doc = makeDocContract({
			id: '01-thesis',
			phaseId: '01-foundation',
			sections: [
				{
					id: 'core-thesis',
					questions: ['Q1'],
					required: true,
					title: 'Core Thesis',
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.phaseId).toBe('01-foundation');
			expect(q?.documentId).toBe('01-thesis');
			expect(q?.sectionId).toBe('core-thesis');
			expect(q?.metadata?.sectionTitle).toBe('Core Thesis');
			expect(q?.metadata?.documentTitle).toBeUndefined();
		}
	});

	it('derives purpose from section title when available', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
					title: 'Section Title Here',
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.questions[0]?.purpose).toBe('Section Title Here');
		}
	});

	it('derives purpose from document central question when section title is absent', () => {
		const doc = makeDocContract({
			centralQuestion: 'What justifies this project?',
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
					// no title
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.questions[0]?.purpose).toBe(
				'What justifies this project?',
			);
		}
	});

	it('derives purpose from document title when section title and central question are absent', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
					// no title
				},
			],
			title: 'Founding Thesis',
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.questions[0]?.purpose).toBe('Founding Thesis');
		}
	});

	it('falls back to clarify message when no purpose source is available', () => {
		const doc = makeDocContract({
			id: '01-thesis',
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
					// no title
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.questions[0]?.purpose).toBe(
				'Clarify 01-thesis.sec-a',
			);
		}
	});

	it('assigns default follow-up policy to every question', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1', 'Q2'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			for (const q of result.registry.questions) {
				expect(q.followUpPolicy).toEqual(DEFAULT_FOLLOW_UP_POLICY);
				expect(q.followUpPolicy.maxFollowUps).toBe(3);
				expect(q.followUpPolicy.askForExamples).toBe(true);
				expect(q.followUpPolicy.askForTradeoffs).toBe(true);
			}
		}
	});

	it('derives acceptance criteria from document completion criteria', () => {
		const doc = makeDocContract({
			completionCriteria: ['The thesis is explicit', 'The tension is named'],
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.acceptanceCriteria).toEqual([
				'The thesis is explicit',
				'The tension is named',
			]);
		}
	});

	it('derives completion signals from document quality checks', () => {
		const doc = makeDocContract({
			qualityChecks: [
				'Avoid vague claims',
				'Prefer decision-useful statements',
			],
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.completionSignals).toEqual([
				'Avoid vague claims',
				'Prefer decision-useful statements',
			]);
		}
	});

	it('uses empty arrays when document has no completion criteria or quality checks', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.acceptanceCriteria).toEqual([]);
			expect(q?.completionSignals).toEqual([]);
		}
	});

	it('propagates document dependsOn to question dependsOn', () => {
		const doc = makeDocContract({
			dependsOn: ['01-foundation/01-thesis'],
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.dependsOn).toEqual(['01-foundation/01-thesis']);
		}
	});

	it('preserves raw dependency info in metadata when dependsOn is present', () => {
		const doc = makeDocContract({
			dependsOn: ['01-foundation/01-thesis', '02-validation/01-strategy'],
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.metadata?.rawDependsOn).toEqual([
				'01-foundation/01-thesis',
				'02-validation/01-strategy',
			]);
		}
	});

	it('preserves raw outputs in metadata', () => {
		const outputs = {
			canonical: { format: 'markdown', path: 'docs/thesis.md' },
		};
		const doc = makeDocContract({
			outputs,
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q = result.registry.questions[0];
			expect(q).toBeDefined();
			expect(q?.metadata?.rawOutputs).toEqual(outputs);
		}
	});

	it('preserves source indexes in metadata', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'sec-a',
					questions: ['Q1', 'Q2'],
					required: true,
				},
			],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const q0 = result.registry.questions[0];
			const q1 = result.registry.questions[1];
			expect(q0).toBeDefined();
			expect(q1).toBeDefined();
			expect(q0?.metadata?.questionIndex).toBe(0);
			expect(q1?.metadata?.questionIndex).toBe(1);
			expect(q0?.metadata?.sectionQuestionCount).toBe(2);
		}
	});
});

describe('Standard profile metadata integration', () => {
	it('loads metadata for real standard profile questions', async () => {
		const fs = createFakeFilesystem();
		addStandardProfileToFs(fs);

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const reg = result.contracts.questionRegistry;
			expect(reg.questions.length).toBeGreaterThan(0);

			for (const q of reg.questions) {
				expect(q.question.length).toBeGreaterThan(0);
				expect(q.purpose.length).toBeGreaterThan(0);
				expect(q.followUpPolicy).toEqual(DEFAULT_FOLLOW_UP_POLICY);
				expect(q.metadata).toBeDefined();
				expect(q.metadata?.sectionQuestionCount).toBeGreaterThan(0);
			}
		}
	});
});
