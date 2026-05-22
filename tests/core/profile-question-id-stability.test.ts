/**
 * Tests for question id stability and normalization (Step 3.2).
 *
 * Covers:
 * - createQuestionId returns stable id for same input.
 * - Id includes normalized phase id, document id, section id, and padded question index.
 * - Id does not include timestamps or random data.
 * - Unsafe characters are normalized.
 * - Different question indexes produce different ids.
 * - Question id for a representative Standard profile question remains stable.
 */

import { describe, expect, it } from 'vitest';
import { loadProfileContracts } from '../../src/core/profiles/load-profile-contracts.js';
import {
	createQuestionId,
	slugify,
} from '../../src/core/questions/question-id.js';
import {
	addStandardProfileToFs,
	createFakeFilesystem,
} from './helpers/fake-filesystem.js';

describe('createQuestionId stability', () => {
	it('returns stable id for same input', () => {
		const input = {
			documentId: '01-thesis',
			phaseId: '01-foundation',
			questionIndex: 0,
			sectionId: 'core-thesis',
		};
		const id1 = createQuestionId(input);
		const id2 = createQuestionId(input);
		expect(id1).toBe(id2);
	});

	it('includes normalized phase id, document id, section id, and padded question index', () => {
		const id = createQuestionId({
			documentId: 'My Document',
			phaseId: 'Phase 1',
			questionIndex: 4,
			sectionId: 'Core Section!',
		});

		// All parts should be normalized to lowercase kebab-case
		expect(id).toBe('phase-1.my-document.core-section.q05');
		expect(id.split('.')).toHaveLength(4);
		expect(id).toMatch(/\.q\d{2}$/);
	});

	it('does not include timestamps or random data', () => {
		const id = createQuestionId({
			documentId: 'doc',
			phaseId: 'phase',
			questionIndex: 0,
			sectionId: 'sec',
		});

		expect(id).not.toMatch(/[0-9]{4}-[0-9]{2}-[0-9]{2}/);
		expect(id).not.toMatch(/[0-9]{10,}/);
		expect(id).not.toMatch(/[0-9a-f]{8,}/);
	});

	it('normalizes unsafe characters', () => {
		const id = createQuestionId({
			documentId: 'Doc!!!Name',
			phaseId: 'Phase@#$%One',
			questionIndex: 0,
			sectionId: 'Sec^\u0026*()tion',
		});

		expect(id).toBe('phase-one.doc-name.sec-tion.q01');
	});

	it('produces different ids for different question indexes within same section', () => {
		const base = {
			documentId: 'doc',
			phaseId: 'phase',
			sectionId: 'sec',
		};

		const id0 = createQuestionId({ ...base, questionIndex: 0 });
		const id1 = createQuestionId({ ...base, questionIndex: 1 });
		const id2 = createQuestionId({ ...base, questionIndex: 2 });

		expect(id0).toBe('phase.doc.sec.q01');
		expect(id1).toBe('phase.doc.sec.q02');
		expect(id2).toBe('phase.doc.sec.q03');
		expect(id0).not.toBe(id1);
		expect(id1).not.toBe(id2);
	});

	it('produces zero-padded question indexes', () => {
		const base = {
			documentId: 'doc',
			phaseId: 'phase',
			sectionId: 'sec',
		};

		expect(createQuestionId({ ...base, questionIndex: 0 })).toMatch(/\.q01$/);
		expect(createQuestionId({ ...base, questionIndex: 9 })).toMatch(/\.q10$/);
		expect(createQuestionId({ ...base, questionIndex: 99 })).toMatch(/\.q100$/);
	});
});

describe('slugify', () => {
	it('converts to lowercase', () => {
		expect(slugify('HELLO')).toBe('hello');
	});

	it('replaces spaces with hyphens', () => {
		expect(slugify('hello world')).toBe('hello-world');
	});

	it('removes special characters', () => {
		expect(slugify('hello!@#world')).toBe('hello-world');
	});

	it('collapses multiple hyphens', () => {
		expect(slugify('hello---world')).toBe('hello-world');
	});

	it('trims leading and trailing hyphens', () => {
		expect(slugify('-hello-')).toBe('hello');
	});

	it('handles empty string', () => {
		expect(slugify('')).toBe('');
	});

	it('handles input with only special chars', () => {
		expect(slugify('!@#')).toBe('');
	});
});

describe('Standard profile question id stability', () => {
	it('question ids remain stable for a representative standard profile question', async () => {
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

			// Pick the first question and assert its id is stable.
			const first = reg.questions[0];
			expect(first).toBeDefined();
			expect(first?.id).toMatch(
				/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+\.q\d{2,}$/,
			);

			// Rebuild and verify the same id.
			if (first !== undefined) {
				const rebuiltId = createQuestionId({
					documentId: first.documentId,
					phaseId: first.phaseId,
					questionIndex: Number(first.metadata?.questionIndex ?? 0),
					sectionId: first.sectionId,
				});
				expect(rebuiltId).toBe(first.id);
			}
		}
	});
});
