/**
 * Tests for the profile-driven question registry builder (Step 3.2).
 *
 * Covers:
 * - Registry builds from loaded profile contracts.
 * - Registry has at least one question.
 * - Registry includes questions, byId, byPhase, byDocument, and bySection.
 * - Every question id exists in byId.
 * - Every question has required fields.
 * - Registry output is deterministic when built twice from the same contracts.
 * - Duplicate ids produce a structured error.
 * - Standard profile produces a non-empty question registry.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LogosFilesystem } from '../../src/core/ports/filesystem.js';
import { loadProfileContracts } from '../../src/core/profiles/load-profile-contracts.js';
import type { ProfileDocumentContract } from '../../src/core/profiles/profile-contracts.js';
import { buildQuestionRegistry } from '../../src/core/questions/question-registry.js';
import {
	addStandardProfileToFs,
	createFakeFilesystem,
} from './helpers/fake-filesystem.js';

// ---------------------------------------------------------------------------
// Node filesystem adapter for integration tests
// ---------------------------------------------------------------------------

function createNodeFilesystemAdapter(): LogosFilesystem {
	return {
		async ensureDirectory(p: string): Promise<void> {
			await fs.mkdir(p, { recursive: true });
		},
		async fileExists(input): Promise<boolean> {
			try {
				const stat = await fs.stat(input.path);
				return stat.isFile();
			} catch {
				return false;
			}
		},
		async listDirectory(input) {
			const entries = await fs.readdir(input.path, { withFileTypes: true });
			return entries.map((e) => ({
				kind: e.isDirectory() ? ('directory' as const) : ('file' as const),
				path: path.join(input.path, e.name),
			}));
		},
		async readTextFile(p: string) {
			const content = await fs.readFile(p, 'utf-8');
			return { content, path: p };
		},
		async writeTextFile(input) {
			await fs.writeFile(input.path, input.content, 'utf-8');
		},
	};
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildQuestionRegistry', () => {
	it('builds a registry from loaded profile contracts', () => {
		const doc = makeDocContract();
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.profileId).toBe('standard');
			expect(result.registry.questions.length).toBe(1);
		}
	});

	it('registry has at least one question for non-empty documents', () => {
		const doc = makeDocContract();
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.registry.questions.length).toBeGreaterThan(0);
		}
	});

	it('registry includes questions, byId, byPhase, byDocument, and bySection', () => {
		const doc = makeDocContract();
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const reg = result.registry;
			expect(reg.questions).toBeDefined();
			expect(reg.byId).toBeDefined();
			expect(reg.byPhase).toBeDefined();
			expect(reg.byDocument).toBeDefined();
			expect(reg.bySection).toBeDefined();
		}
	});

	it('every question id exists in byId', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'core-thesis',
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
				expect(result.registry.byId[q.id]).toBeDefined();
				expect(result.registry.byId[q.id]).toBe(q);
			}
		}
	});

	it('every question has profileId, phaseId, documentId, sectionId, question, purpose, required, priority, followUpPolicy, and sourcePath', () => {
		const doc = makeDocContract();
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			for (const q of result.registry.questions) {
				expect(q.profileId).toBe('standard');
				expect(q.phaseId.length).toBeGreaterThan(0);
				expect(q.documentId.length).toBeGreaterThan(0);
				expect(q.sectionId.length).toBeGreaterThan(0);
				expect(q.question.length).toBeGreaterThan(0);
				expect(q.purpose.length).toBeGreaterThan(0);
				expect(typeof q.required).toBe('boolean');
				expect(['critical', 'important', 'optional']).toContain(q.priority);
				expect(q.followUpPolicy).toBeDefined();
				expect(q.sourcePath.length).toBeGreaterThan(0);
			}
		}
	});

	it('registry output is deterministic when built twice from the same contracts', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'core-thesis',
					questions: ['Q1', 'Q2'],
					required: true,
				},
				{
					id: 'context',
					questions: ['Q3'],
					required: true,
				},
			],
		});

		const run1 = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});
		const run2 = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(run1.ok).toBe(true);
		expect(run2.ok).toBe(true);
		if (run1.ok && run2.ok) {
			expect(run1.registry.questions.map((q) => q.id)).toEqual(
				run2.registry.questions.map((q) => q.id),
			);
			expect(run1.registry.byPhase).toEqual(run2.registry.byPhase);
			expect(run1.registry.byDocument).toEqual(run2.registry.byDocument);
			expect(run1.registry.bySection).toEqual(run2.registry.bySection);
		}
	});

	it('detects duplicate ids and returns a structured error', () => {
		// Create two documents with the same phase/document/section structure
		// so that question ids collide.
		const doc1 = makeDocContract({
			id: '01-thesis',
			phaseId: '01-foundation',
			sections: [
				{
					id: 'core-thesis',
					questions: ['Q1'],
					required: true,
				},
			],
		});
		const doc2 = makeDocContract({
			id: '01-thesis',
			path: '/project/profiles/standard/phases/01-foundation/02-problem.yml',
			phaseId: '01-foundation',
			sections: [
				{
					id: 'core-thesis',
					questions: ['Q2'],
					required: true,
				},
			],
		});

		const result = buildQuestionRegistry({
			documents: [doc1, doc2],
			profileId: 'standard',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain('Duplicate question id');
		}
	});

	it('indexes byPhase contain question ids for the correct phase', () => {
		const doc = makeDocContract({
			phaseId: '01-foundation',
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
			const phaseIds = result.registry.byPhase['01-foundation'];
			expect(phaseIds).toBeDefined();
			expect(phaseIds.length).toBe(2);
			for (const qid of phaseIds) {
				const q = result.registry.byId[qid];
				expect(q).toBeDefined();
				expect(q.phaseId).toBe('01-foundation');
			}
		}
	});

	it('indexes byDocument contain question ids for the correct document', () => {
		const doc = makeDocContract({
			id: '01-thesis',
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
			const docIds = result.registry.byDocument['01-thesis'];
			expect(docIds).toBeDefined();
			expect(docIds.length).toBe(1);
			const firstDocId = docIds[0];
			expect(firstDocId).toBeDefined();
			if (firstDocId !== undefined) {
				expect(result.registry.byId[firstDocId].documentId).toBe('01-thesis');
			}
		}
	});

	it('indexes bySection contain question ids for the correct section', () => {
		const doc = makeDocContract({
			id: '01-thesis',
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
			const secIds = result.registry.bySection['01-thesis.sec-a'];
			expect(secIds).toBeDefined();
			expect(secIds.length).toBe(2);
			for (const qid of secIds) {
				const q = result.registry.byId[qid];
				expect(q.sectionId).toBe('sec-a');
			}
		}
	});

	it('returns warnings for documents with no questions', () => {
		const doc = makeDocContract({
			sections: [],
		});
		const result = buildQuestionRegistry({
			documents: [doc],
			profileId: 'standard',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]).toContain('no sections');
			expect(result.registry.questions.length).toBe(0);
		}
	});

	it('returns warnings for sections with no questions', () => {
		const doc = makeDocContract({
			sections: [
				{
					id: 'empty-sec',
					questions: [],
					required: true,
				},
				{
					id: 'filled-sec',
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
			expect(result.warnings.some((w) => w.includes('empty-sec'))).toBe(true);
			expect(result.registry.questions.length).toBe(1);
		}
	});
});

// ---------------------------------------------------------------------------
// Standard profile integration test
// ---------------------------------------------------------------------------

describe('Standard profile question registry', () => {
	it('produces a non-empty question registry from the real standard profile', async () => {
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
			expect(reg).toBeDefined();
			expect(reg.questions.length).toBeGreaterThan(0);
			expect(reg.profileId).toBe('standard');
			expect(Object.keys(reg.byId).length).toBe(reg.questions.length);
		}
	});
});

// ---------------------------------------------------------------------------
// Real filesystem integration test
// ---------------------------------------------------------------------------

describe('Real filesystem integration — profiles/standard', () => {
	it('loads the repository-local standard profile and produces a non-empty registry', async () => {
		const projectRoot = process.cwd();
		const nodeFs = createNodeFilesystemAdapter();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: nodeFs,
			projectRoot,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const reg = result.contracts.questionRegistry;
			expect(reg.questions.length).toBeGreaterThan(0);
			expect(reg.profileId).toBe('standard');
			expect(Object.keys(reg.byId).length).toBe(reg.questions.length);

			// Verify every question has the required fields.
			for (const q of reg.questions) {
				expect(q.id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+\.q\d{2,}$/);
				expect(q.profileId).toBe('standard');
				expect(q.phaseId.length).toBeGreaterThan(0);
				expect(q.documentId.length).toBeGreaterThan(0);
				expect(q.sectionId.length).toBeGreaterThan(0);
				expect(q.question.length).toBeGreaterThan(0);
				expect(q.purpose.length).toBeGreaterThan(0);
				expect(typeof q.required).toBe('boolean');
				expect(['critical', 'important', 'optional']).toContain(q.priority);
				expect(q.followUpPolicy).toBeDefined();
				expect(q.sourcePath.length).toBeGreaterThan(0);
			}
		}
	});
});
