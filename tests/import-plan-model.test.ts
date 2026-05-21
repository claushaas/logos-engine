/** Step 12.1 — Import Plan Model Tests */

import { describe, expect, it } from 'vitest';
import type { DocumentationImportPlanInput } from '../src/index.js';
import {
	DEFAULT_IMPORT_PATH_POLICY,
	IMPORT_ACTION_KIND_ORDER,
	IMPORT_CANDIDATE_KIND_ORDER,
	IMPORT_CANDIDATE_STATUS_ORDER,
	IMPORT_CONFLICT_KIND_ORDER,
	IMPORT_READINESS_ORDER,
	planDocumentationImport,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeInput(
	overrides?: Partial<DocumentationImportPlanInput>,
): DocumentationImportPlanInput {
	return {
		documentationRoot: 'logos/',
		profileId: 'standard',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Model validation
// ---------------------------------------------------------------------------

describe('import plan model', () => {
	it('validates import plan input with required fields', () => {
		const input = makeInput();
		expect(input.profileId).toBe('standard');
		expect(input.documentationRoot).toBe('logos/');
	});

	it('validates import plan result shape', () => {
		const input = makeInput();
		const result = planDocumentationImport(input);

		expect(result).toBeDefined();
		expect(result.changedPaths).toEqual([]);
		expect(result.plan).toBeDefined();
	});

	it('changed paths are empty', () => {
		const input = makeInput({
			candidatePaths: ['test.md'],
		});
		const result = planDocumentationImport(input);
		expect(result.changedPaths).toEqual([]);
	});

	it('read-only marker is present', () => {
		const input = makeInput();
		const result = planDocumentationImport(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('dry-run is enabled by default', () => {
		const input = makeInput();
		const result = planDocumentationImport(input);
		expect(result.plan.dryRun).toBe(true);
	});

	it('supports all candidate kinds', () => {
		const kinds = Object.keys(IMPORT_CANDIDATE_KIND_ORDER);
		expect(kinds).toContain('markdown_document');
		expect(kinds).toContain('profile_registry');
		expect(kinds).toContain('phase_descriptor');
		expect(kinds).toContain('document_descriptor');
		expect(kinds).toContain('executive_descriptor');
		expect(kinds).toContain('raw_note');
		expect(kinds).toContain('transcript');
		expect(kinds).toContain('unknown');
		expect(kinds).toContain('unsupported');
	});

	it('supports all candidate statuses', () => {
		const statuses = Object.keys(IMPORT_CANDIDATE_STATUS_ORDER);
		expect(statuses).toContain('mapped');
		expect(statuses).toContain('ambiguous');
		expect(statuses).toContain('unmapped');
		expect(statuses).toContain('duplicate');
		expect(statuses).toContain('conflicting');
		expect(statuses).toContain('blocked');
		expect(statuses).toContain('unsupported');
		expect(statuses).toContain('unsafe');
		expect(statuses).toContain('unknown');
	});

	it('supports all action kinds', () => {
		const actions = Object.keys(IMPORT_ACTION_KIND_ORDER);
		expect(actions).toContain('propose_import_as_canonical_source');
		expect(actions).toContain('propose_import_as_reference');
		expect(actions).toContain('propose_map_to_document');
		expect(actions).toContain('propose_create_open_question');
		expect(actions).toContain('propose_create_assumption');
		expect(actions).toContain('propose_create_decision');
		expect(actions).toContain('skip_existing_current');
		expect(actions).toContain('manual_review_required');
		expect(actions).toContain('unsupported_deferred');
		expect(actions).toContain('blocked_no_action');
	});

	it('supports all conflict kinds', () => {
		const confTypes = Object.keys(IMPORT_CONFLICT_KIND_ORDER);
		expect(confTypes).toContain('existing_canonical_output');
		expect(confTypes).toContain('multiple_candidates_same_document');
		expect(confTypes).toContain('candidate_maps_to_multiple_documents');
		expect(confTypes).toContain('unsafe_path');
		expect(confTypes).toContain('unsupported_format');
		expect(confTypes).toContain('profile_mismatch');
		expect(confTypes).toContain('schema_mismatch');
		expect(confTypes).toContain('derived_artifact_as_source');
		expect(confTypes).toContain('secret_or_sensitive_content');
		expect(confTypes).toContain('manual_edit_collision');
		expect(confTypes).toContain('unknown_conflict');
	});

	it('supports all readiness statuses', () => {
		const readinesses = Object.keys(IMPORT_READINESS_ORDER);
		expect(readinesses).toContain('ready_for_review');
		expect(readinesses).toContain('blocked');
		expect(readinesses).toContain('requires_manual_review');
		expect(readinesses).toContain('empty');
		expect(readinesses).toContain('unknown');
	});

	it('default path policy has correct values', () => {
		expect(DEFAULT_IMPORT_PATH_POLICY.allowAbsolutePaths).toBe(false);
		expect(DEFAULT_IMPORT_PATH_POLICY.disallowPathTraversal).toBe(true);
		expect(DEFAULT_IMPORT_PATH_POLICY.maxFileSizeBytes).toBe(1024 * 1024);
		expect(DEFAULT_IMPORT_PATH_POLICY.allowedExtensions).toContain('.md');
		expect(DEFAULT_IMPORT_PATH_POLICY.allowedExtensions).toContain('.yml');
		expect(DEFAULT_IMPORT_PATH_POLICY.allowedExtensions).toContain('.json');
	});
});

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

describe('import readiness', () => {
	it('no candidates => empty', () => {
		const result = planDocumentationImport(makeInput());
		expect(result.plan.readiness).toBe('empty');
		expect(result.plan.summary.totalCandidates).toBe(0);
	});

	it('clean proposed mappings => ready_for_review', () => {
		const result = planDocumentationImport(
			makeInput({
				documentationContract: {
					documents: [
						{
							canonicalId: '01-product-brief',
							descriptor: {
								centralQuestion: 'Test',
								id: '01-product-brief',
								order: 1,
								outputs: {
									canonical: {
										format: 'markdown',
										path: 'logos/01-foundation/01-product-brief.md',
									},
								},
								phase: '01-foundation',
								purpose: 'Test',
								sections: [],
								status: 'drafted',
								title: 'Product Brief',
								type: 'canonical',
							},
							documentOrder: 0,
							globalOrder: 0,
							phaseId: '01-foundation',
							phaseOrder: 0,
							sourcePath: '/fake/phases/01-foundation/docs.yml',
						},
					],
					documentsByCanonicalId: new Map(),
					documentsByPhaseId: new Map(),
					phaseOrder: ['01-foundation'],
					phases: [],
					profileId: 'standard',
					profileRoot: '/fake',
					registryPath: '/fake/docs.yml',
					statusWorkflow: { states: [], transitions: [] },
				},
				fixtures: new Map([
					[
						'logos/01-foundation/01-product-brief.md',
						'---\ntitle: Test\n---\n# Test\n\nContent',
					],
				]),
			}),
		);

		expect(result.plan.readiness).toBe('ready_for_review');
	});

	it('ambiguous mappings => requires_manual_review', () => {
		// Ambiguous: no documentation contract means all candidates are unmapped
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['some-doc.md', '# Test\n\nContent']]),
			}),
		);

		expect(result.plan.readiness).toBe('requires_manual_review');
		expect(result.plan.summary.unmappedCandidates).toBeGreaterThanOrEqual(1);
	});
});
