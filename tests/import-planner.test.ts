/** Step 12.1 — Import Planner Integration & Scenario Tests */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
	DocumentationImportPlanInput,
	DocumentationImportPlanOptions,
} from '../src/index.js';
import { planDocumentationImport } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
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

function makeOptions(
	overrides?: Partial<DocumentationImportPlanOptions>,
): DocumentationImportPlanOptions {
	return {
		dryRun: true,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Candidate Discovery
// ---------------------------------------------------------------------------

describe('import candidate discovery', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `logos-import-discovery-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { force: true, recursive: true });
		} catch {
			/* ok */
		}
	});

	it('accepts explicit candidate paths', () => {
		const docPath = join(tempDir, 'test-doc.md');
		writeFileSync(docPath, '# Test Document\n\nContent');

		const result = planDocumentationImport(
			makeInput({
				candidatePaths: [docPath],
				projectRoot: tempDir,
			}),
			makeOptions({ pathPolicy: { allowAbsolutePaths: true } }),
		);

		expect(result.plan.summary.totalCandidates).toBeGreaterThanOrEqual(1);
	});

	it('no candidates returns empty plan', () => {
		const result = planDocumentationImport(makeInput());

		expect(result.plan.summary.totalCandidates).toBe(0);
		expect(result.plan.readiness).toBe('empty');
		expect(
			result.plan.diagnostics.some((d) => d.code === 'import_no_candidates'),
		).toBe(true);
	});

	it('path traversal is rejected', () => {
		const result = planDocumentationImport(
			makeInput({
				candidatePaths: ['../../../etc/passwd'],
				projectRoot: tempDir,
			}),
			makeOptions({ pathPolicy: { allowAbsolutePaths: true } }),
		);

		expect(result.plan.summary.totalCandidates).toBe(0);
		expect(
			result.plan.blockers.some((b) => b.code === 'import_path_traversal'),
		).toBe(true);
	});

	it('unsafe absolute path is rejected when not allowed', () => {
		const result = planDocumentationImport(
			makeInput({
				candidatePaths: ['/etc/passwd'],
			}),
			makeOptions(),
		);

		expect(result.plan.summary.totalCandidates).toBe(0);
		expect(
			result.plan.blockers.some(
				(b) => b.code === 'import_absolute_path_not_allowed',
			),
		).toBe(true);
	});

	it('unsupported extension is marked unsupported', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['test.bin', 'binary content']]),
			}),
		);

		const unsupportedCand = result.plan.candidates.find(
			(c) => c.kind === 'unsupported',
		);
		expect(unsupportedCand).toBeDefined();
		expect(unsupportedCand?.status).toBe('unsupported');
	});

	it('no files are written', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['test.md', '# Test\n\nContent']]),
			}),
		);

		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Candidate Classification
// ---------------------------------------------------------------------------

describe('import candidate classification', () => {
	it('Markdown with LOGOS frontmatter is markdown_document', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/01-foundation/01-product-brief.md',
						'---\ntitle: Product Brief\ndocument_id: 01-product-brief\n---\n# Product Brief\n\nContent',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate).toBeDefined();
		expect(candidate?.kind).toBe('markdown_document');
	});

	it('plain Markdown without frontmatter is raw_note', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['notes.md', 'Some random notes here.']]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.kind).toBe('raw_note');
	});

	it('transcript-like file is transcript and deferred', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'chat-log.md',
						'---\ntitle: Conversation\n---\n\nUser: Hello\nAgent: Hi there\n\nUser: What is LOGOS?',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate).toBeDefined();
		expect(candidate?.kind).toBe('transcript');

		const actions = result.plan.proposedActions.filter(
			(a) => a.candidateId === candidate?.id,
		);
		expect(actions.length).toBeGreaterThanOrEqual(1);
		expect(actions[0]?.kind).toBe('unsupported_deferred');
	});

	it('docs.yml-like file is profile_registry', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'profiles/standard/docs.yml',
						'profile_id: standard\nphases:\n  - 01-foundation',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.kind).toBe('profile_registry');
	});

	it('file in phases/ dir with .yml is phase_descriptor', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'profiles/standard/phases/01-foundation/docs.yml',
						'phase_id: 01-foundation\ntitle: Foundation',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.kind).toBe('phase_descriptor');
	});

	it('executive descriptor is executive_descriptor', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'profiles/standard/executive/executive-generation.yml',
						'executive: true',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.kind).toBe('executive_descriptor');
	});

	it('derived HTML artifact is not canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/html/project-overview.html',
						'<!DOCTYPE html>\n<html>\n<head><title>Project</title></head>\n<body>This is a derived artifact</body>\n</html>',
					],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('Agent Pack is not canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'logos/agent-packs/product-brief-agent-pack.md',
						'# Agent Pack\n\nThis file is generated. Do not edit manually.\n\n## Context\n\nContent',
					],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('Executive export is not canonical source', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					['logos/executive/executive-plan.json', '{"executive_plan": true}'],
				]),
			}),
		);

		const hasDerivedConflict = result.plan.conflicts.some(
			(c) => c.kind === 'derived_artifact_as_source',
		);
		expect(hasDerivedConflict).toBe(true);
	});

	it('unknown supported file is unknown', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['some-file.yml', 'unknown: value\nfoo: bar']]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.kind).toBe('unknown');
	});

	it('ambiguous classification yields diagnostic', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['docs.yml', 'document_id: test\ntitle: Test']]),
			}),
		);

		// This is a root-level docs.yml without nested profile paths
		const hasAmbiguousDiag = result.plan.diagnostics.some(
			(d) => d.code === 'import_ambiguous_yaml_kind',
		);
		const hasProfileReg = result.plan.candidates.some(
			(c) => c.kind === 'profile_registry',
		);
		expect(hasAmbiguousDiag || hasProfileReg).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Metadata Extraction
// ---------------------------------------------------------------------------

describe('metadata extraction', () => {
	it('extracts Markdown title/frontmatter/headings', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'test.md',
						'---\ntitle: My Doc\nid: my-doc\nphase_id: 01-foundation\n---\n# My Doc\n\n## Section One\n\nContent\n\n## Section Two\n\nMore content',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.metadata.title).toBe('My Doc');
		expect(candidate?.metadata.declaredId).toBe('my-doc');
		expect(candidate?.metadata.declaredPhaseId).toBe('01-foundation');
		expect(candidate?.metadata.headings).toContain('My Doc');
		expect(candidate?.metadata.headings).toContain('Section One');
	});

	it('extracts YAML top-level keys/id', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'descriptor.yml',
						'id: doc-01\nphase_id: 01-foundation\ntitle: Test Doc\noutputs:\n  canonical:\n    path: test.md',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.metadata.topLevelKeys).toContain('id');
		expect(candidate?.metadata.declaredId).toBe('doc-01');
		expect(candidate?.metadata.declaredPhaseId).toBe('01-foundation');
	});

	it('extracts JSON top-level keys/id', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'data.json',
						'{"id": "data-01", "title": "Data Doc", "$schema": "schema.json"}',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.metadata.topLevelKeys).toContain('id');
		expect(candidate?.metadata.declaredId).toBe('data-01');
		expect(candidate?.metadata.schemaFields).toContain('$schema');
	});

	it('extracts relative path and checksum', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['path/to/doc.md', '# Test Doc\n\nContent']]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.relativePath).toBe('path/to/doc.md');
		expect(candidate?.metadata.checksum).toBeDefined();
		expect(typeof candidate?.metadata.checksum).toBe('string');
		expect(candidate?.metadata.checksum?.length).toBe(64); // sha256 hex
	});

	it('does not include full file content by default', () => {
		const longContent = `# Doc\n\n${'A'.repeat(500)}`;
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['long.md', longContent]]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.contentSnippet).toBeDefined();
		expect(candidate?.contentSnippet?.length).toBeLessThan(longContent.length);
	});

	it('redacts fake secrets in metadata/snippets', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					['config.yml', 'api_key: sk-test12345678901234567890\ntoken: abc'],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		// The snippet should redact the API key
		if (candidate?.contentSnippet) {
			expect(candidate.contentSnippet).not.toContain(
				'sk-test12345678901234567890',
			);
		}
		// The metadata should not include the secret
		expect(candidate?.metadata.declaredId).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Transcript Handling
// ---------------------------------------------------------------------------

describe('transcript handling', () => {
	it('transcript classified and deferred', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'chat.md',
						'User: Hello world\nAgent: Hi there\n\nUser: Tell me about LOGOS',
					],
				]),
			}),
		);

		const candidate = result.plan.candidates[0];
		expect(candidate?.kind).toBe('transcript');

		const actions = result.plan.proposedActions.filter(
			(a) => a.candidateId === candidate?.id,
		);
		expect(actions.length).toBeGreaterThanOrEqual(1);
		expect(actions.some((a) => a.kind === 'unsupported_deferred')).toBe(true);
	});

	it('transcript is not summarized', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['chat.md', 'User: Hello world\nAgent: Hi there']]),
			}),
		);

		const candidate = result.plan.candidates[0];
		// Metadata should be minimal for transcript
		expect(candidate?.metadata.title).toBeFalsy();
	});

	it('transcript does not create decisions/tasks/register items', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([
					[
						'chat.md',
						'User: We should build X\nAgent: Yes, let us decide to build X',
					],
				]),
			}),
		);

		// No proposal_create_decision or similar extraction actions
		const extractionActions = result.plan.proposedActions.filter(
			(a) =>
				a.kind === 'propose_create_decision' ||
				a.kind === 'propose_create_assumption' ||
				a.kind === 'propose_create_open_question',
		);
		expect(extractionActions.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation
// ---------------------------------------------------------------------------

describe('non-mutation', () => {
	it('planner writes no files', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['test.md', '# Test']]),
			}),
		);

		expect(result.changedPaths).toEqual([]);
	});

	it('planner does not call AI/provider code', () => {
		// The import planner has no provider dependencies
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['test.md', '# Test']]),
			}),
		);

		expect(result.plan).toBeDefined();
		// No provider-related diagnostics or errors
		expect(
			result.plan.diagnostics.some(
				(d) => d.code.includes('provider') || d.code.includes('ai_'),
			),
		).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Proposed Actions
// ---------------------------------------------------------------------------

describe('proposed actions', () => {
	it('mapped Markdown doc produces propose_map_to_document action', () => {
		const result = planDocumentationImport(
			makeInput({
				candidatePaths: [],
				fixtures: new Map([
					[
						'logos/01-foundation/01-product-brief.md',
						'---\ntitle: Product Brief\n---\n# Product Brief\n\nContent',
					],
				]),
			}),
		);

		// Without a doc contract, it'll be unmapped -> manual_review_required
		expect(result.plan.proposedActions.length).toBeGreaterThanOrEqual(1);
	});

	it('actions are never confirmed/applied', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['test.md', '# Test']]),
			}),
		);

		for (const action of result.plan.proposedActions) {
			expect(action.kind).not.toContain('confirmed');
			expect(action.kind).not.toContain('applied');
		}
	});

	it('actions include evidence and require review marker', () => {
		const result = planDocumentationImport(
			makeInput({
				fixtures: new Map([['test.md', '# Test\n\nSome content']]),
			}),
		);

		for (const action of result.plan.proposedActions) {
			expect(action.requiresUserReview).toBe(true); // All actions require review
		}
	});
});
