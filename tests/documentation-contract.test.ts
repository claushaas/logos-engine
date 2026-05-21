import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DocumentationContractError,
	listDocumentationContractIndex,
	loadDocumentationContract,
	relativizeIndexPaths,
} from '../src/index.js';

const FIXTURES_ROOT = resolve(process.cwd(), 'tests', 'fixtures', 'profiles');
const STANDARD_PROFILE_ROOT = resolve(process.cwd(), 'profiles', 'standard');
const STANDARD_SCHEMA_PATH = join(STANDARD_PROFILE_ROOT, 'document.schema.yml');

describe('loadDocumentationContract', () => {
	describe('Standard profile success', () => {
		it('loads the Standard documentation contract successfully', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			expect(contract).toBeDefined();
			expect(contract.profileId).toBe('standard');
			expect(contract.phases.length).toBeGreaterThan(0);
			expect(contract.documents.length).toBeGreaterThan(0);
		});

		it('loaded contract includes the standard profile id', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			expect(contract.profileId).toBe('standard');
			expect(contract.profileRoot).toBe(STANDARD_PROFILE_ROOT);
		});

		it('loaded phases are listed in deterministic registry order', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const phaseIds = contract.phases.map((p) => p.id);
			expect(phaseIds).toEqual([
				'01-foundation',
				'02-validation',
				'03-product',
				'04-engineering',
				'05-go-to-market',
				'06-operations',
			]);
			expect(contract.phaseOrder).toEqual(phaseIds);
		});

		it('loaded documents are listed in deterministic phase/document order', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			// Documents should be ordered by phase order, then document order within phase
			const firstPhaseDocs = contract.documents.filter(
				(d) => d.phaseId === '01-foundation',
			);
			expect(firstPhaseDocs.length).toBeGreaterThan(0);
			expect(firstPhaseDocs[0].documentOrder).toBe(0);

			// Global order should be monotonically increasing
			for (let i = 1; i < contract.documents.length; i++) {
				expect(contract.documents[i].globalOrder).toBe(
					contract.documents[i - 1].globalOrder + 1,
				);
			}
		});

		it('every loaded document has required metadata', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			for (const doc of contract.documents) {
				expect(doc.canonicalId).toBeTruthy();
				expect(doc.phaseId).toBeTruthy();
				expect(doc.sourcePath).toContain('.yml');
				expect(typeof doc.globalOrder).toBe('number');
				expect(typeof doc.phaseOrder).toBe('number');
				expect(typeof doc.documentOrder).toBe('number');
				expect(doc.descriptor).toBeDefined();
				expect(doc.descriptor.id).toBe(doc.canonicalId);
			}
		});

		it('Standard contract index matches snapshot', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const index = listDocumentationContractIndex(contract);
			const relativeIndex = relativizeIndexPaths(index, contract.profileRoot);

			expect(relativeIndex).toMatchSnapshot();
		});
	});

	describe('Descriptor preservation', () => {
		it('preserves dependencies from descriptors', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			// Find a document with dependencies (e.g., 01-thesis feeds into others)
			const thesisDoc = contract.documentsByCanonicalId.get('01-thesis');
			expect(thesisDoc).toBeDefined();
			expect(thesisDoc?.descriptor.feeds).toBeDefined();
			expect(thesisDoc?.descriptor.feeds?.length).toBeGreaterThan(0);
		});

		it('preserves inputs from descriptors', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const thesisDoc = contract.documentsByCanonicalId.get('01-thesis');
			expect(thesisDoc).toBeDefined();
			expect(thesisDoc?.descriptor.inputs).toBeDefined();
			expect(thesisDoc?.descriptor.inputs?.length).toBeGreaterThan(0);
			expect(thesisDoc?.descriptor.inputs?.[0]?.id).toBeDefined();
		});

		it('preserves outputs from descriptors', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const thesisDoc = contract.documentsByCanonicalId.get('01-thesis');
			expect(thesisDoc).toBeDefined();
			expect(thesisDoc?.descriptor.outputs).toBeDefined();
			expect(thesisDoc?.descriptor.outputs.canonical).toBeDefined();
			expect(thesisDoc?.descriptor.outputs.canonical.path).toBeDefined();
		});

		it('preserves completion criteria from descriptors', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const thesisDoc = contract.documentsByCanonicalId.get('01-thesis');
			expect(thesisDoc).toBeDefined();
			expect(thesisDoc?.descriptor.completionCriteria).toBeDefined();
			expect(thesisDoc?.descriptor.completionCriteria?.length).toBeGreaterThan(
				0,
			);
		});

		it('preserves questions from descriptors', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const thesisDoc = contract.documentsByCanonicalId.get('01-thesis');
			expect(thesisDoc).toBeDefined();
			expect(thesisDoc?.descriptor.sections).toBeDefined();
			expect(thesisDoc?.descriptor.sections.length).toBeGreaterThan(0);
			expect(thesisDoc?.descriptor.sections[0]?.questions).toBeDefined();
			expect(
				thesisDoc?.descriptor.sections[0]?.questions.length,
			).toBeGreaterThan(0);
		});
	});

	describe('Failure fixtures', () => {
		it('fails when phase descriptor file is missing', async () => {
			try {
				await loadDocumentationContract({
					profileId: 'missing-phase',
					profileRoot: join(FIXTURES_ROOT, 'missing-phase'),
					schemaPath: STANDARD_SCHEMA_PATH,
				});
				expect.fail('Expected loadDocumentationContract to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(DocumentationContractError);
				const error = err as DocumentationContractError;
				const diag = error.diagnostics.find(
					(d) => d.code === 'E_PHASE_MISSING_FILE',
				);
				expect(diag).toBeDefined();
				expect(diag?.message).toContain('not found');
				expect(diag?.fieldPath).toContain('phaseRegistry.files');
				expect(diag?.path).toContain('docs.yml');
				expect(diag?.expected).toContain('phases/01-test.yml');
			}
		});

		it('fails when document descriptor file is missing', async () => {
			try {
				await loadDocumentationContract({
					profileId: 'missing-document',
					profileRoot: join(FIXTURES_ROOT, 'missing-document'),
					schemaPath: STANDARD_SCHEMA_PATH,
				});
				expect.fail('Expected loadDocumentationContract to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(DocumentationContractError);
				const error = err as DocumentationContractError;
				const diag = error.diagnostics.find(
					(d) => d.code === 'E_DOCUMENT_MISSING_FILE',
				);
				expect(diag).toBeDefined();
				expect(diag?.message).toContain('not found');
				expect(diag?.fieldPath).toBe('phase.documents[0].file');
				expect(diag?.expected).toContain('phases/01-test/01-doc.yml');
			}
		});

		it('fails when duplicate document IDs are detected', async () => {
			try {
				await loadDocumentationContract({
					profileId: 'duplicate-document-id',
					profileRoot: join(FIXTURES_ROOT, 'duplicate-document-id'),
					schemaPath: STANDARD_SCHEMA_PATH,
				});
				expect.fail('Expected loadDocumentationContract to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(DocumentationContractError);
				const error = err as DocumentationContractError;
				const diag = error.diagnostics.find(
					(d) => d.code === 'E_DOCUMENT_DUPLICATE_ID',
				);
				expect(diag).toBeDefined();
				expect(diag?.message).toContain('Duplicate document ID');
				expect(diag?.message).toContain('test-doc');
				// Should mention both source paths
				expect(diag?.message).toContain('01-doc.yml');
				expect(diag?.message).toContain('02-doc.yml');
				expect(diag?.sourcePaths).toHaveLength(2);
			}
		});

		it('fails when phase descriptor is malformed', async () => {
			try {
				await loadDocumentationContract({
					profileId: 'malformed-phase',
					profileRoot: join(FIXTURES_ROOT, 'malformed-phase'),
					schemaPath: STANDARD_SCHEMA_PATH,
				});
				expect.fail('Expected loadDocumentationContract to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(DocumentationContractError);
				const error = err as DocumentationContractError;
				const diag = error.diagnostics.find(
					(d) => d.code === 'E_PHASE_FIELD_TYPE' && d.fieldPath === 'phase.id',
				);
				expect(diag).toBeDefined();
				expect(diag?.message).toContain('phase.id');
				expect(diag?.message).toContain('non-empty string');
			}
		});

		it('fails when document descriptor is invalid (Step 1.2 validator)', async () => {
			try {
				await loadDocumentationContract({
					profileId: 'invalid-document',
					profileRoot: join(FIXTURES_ROOT, 'invalid-document'),
					schemaPath: STANDARD_SCHEMA_PATH,
				});
				expect.fail('Expected loadDocumentationContract to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(DocumentationContractError);
				const error = err as DocumentationContractError;
				// Should contain a Step 1.2 validation error (e.g., missing canonical path)
				const diag = error.diagnostics.find(
					(d) =>
						d.code === 'E_FIELD_MISSING' &&
						d.fieldPath === 'outputs.canonical.path',
				);
				expect(diag).toBeDefined();
				expect(diag?.message).toContain('outputs.canonical.path');
			}
		});
	});

	describe('Determinism', () => {
		it('returns the same ordered index when loaded twice', async () => {
			const contract1 = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});
			const contract2 = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const index1 = listDocumentationContractIndex(contract1);
			const index2 = listDocumentationContractIndex(contract2);

			expect(index1.length).toBe(index2.length);
			for (let i = 0; i < index1.length; i++) {
				expect(index1[i].canonicalDocumentId).toBe(
					index2[i].canonicalDocumentId,
				);
				expect(index1[i].globalOrder).toBe(index2[i].globalOrder);
				expect(index1[i].phaseOrder).toBe(index2[i].phaseOrder);
				expect(index1[i].documentOrder).toBe(index2[i].documentOrder);
			}
		});

		it('does not let absolute paths affect canonical IDs', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			for (const doc of contract.documents) {
				// Canonical ID should not contain path separators or absolute path prefixes
				expect(doc.canonicalId).not.toContain('/');
				expect(doc.canonicalId).not.toContain('\\');
				expect(doc.canonicalId).not.toContain(STANDARD_PROFILE_ROOT);
			}
		});
	});

	describe('Public API queries', () => {
		it('can query documents by canonical ID', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const doc = contract.documentsByCanonicalId.get('01-thesis');
			expect(doc).toBeDefined();
			expect(doc?.descriptor.id).toBe('01-thesis');
		});

		it('can query documents by phase ID', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const foundationDocs = contract.documentsByPhaseId.get('01-foundation');
			expect(foundationDocs).toBeDefined();
			expect(foundationDocs?.length).toBeGreaterThan(0);
			for (const doc of foundationDocs ?? []) {
				expect(doc.phaseId).toBe('01-foundation');
			}
		});

		it('can access source path for any descriptor', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			for (const phase of contract.phases) {
				expect(phase.sourcePath).toContain('.yml');
			}
			for (const doc of contract.documents) {
				expect(doc.sourcePath).toContain('.yml');
			}
		});

		it('can access raw validated descriptor data', async () => {
			const contract = await loadDocumentationContract({
				profileId: 'standard',
				repoRoot: process.cwd(),
			});

			const doc = contract.documentsByCanonicalId.get('01-thesis');
			expect(doc).toBeDefined();
			expect(doc?.descriptor.sections).toBeDefined();
			expect(doc?.descriptor.outputs).toBeDefined();
		});
	});
});
