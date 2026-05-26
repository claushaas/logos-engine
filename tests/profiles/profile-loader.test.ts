/**
 * Tests for the profiles module — profile-loader and profile-registry.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadProfile } from '../../src/profiles/index.js';
import {
	getProfile,
	listProfiles,
} from '../../src/profiles/profile-registry.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEST_FIXTURES_DIR = resolve(process.cwd(), 'tests/profiles/__fixtures__');

/**
 * Write a fixture file and return its absolute path.
 */
function writeFixture(name: string, content: string): string {
	const filePath = join(TEST_FIXTURES_DIR, name);
	writeFileSync(filePath, content, 'utf-8');
	return filePath;
}

/**
 * Remove the fixtures directory.
 */
function cleanFixtures(): void {
	try {
		rmSync(TEST_FIXTURES_DIR, { force: true, recursive: true });
	} catch {
		// ok if dir doesn't exist
	}
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────

beforeEach(() => {
	cleanFixtures();
	mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
});

afterEach(() => {
	cleanFixtures();
});

// ─── Minimal valid profile fixture (YAML) ──────────────────────────────────

const MINIMAL_VALID_YAML = `\
id: test-minimal
title: Minimal Test Profile
version: '1.0.0'
description: A minimal valid profile for testing.

phases:
  - id: 01-foundation
    title: Foundation
    order: 1
    purpose: Define the foundation.

documents:
  - id: doc-thesis
    phaseId: 01-foundation
    title: Thesis
    order: 1
    purpose: The core thesis.
    outputPath: docs/thesis.md
    requiredNodeIds:
      - node-thesis
    optionalNodeIds: []

nodes:
  - id: node-thesis
    phaseId: 01-foundation
    documentId: doc-thesis
    title: Core Thesis Node
    order: 1
    canonicalQuestion: What is the core thesis?
    coverageTopics:
      - central conviction
    sufficiencyCriteria:
      - explicit and non-generic
    promptRefs:
      initial: prompts/thesis/initial.md

materializationRules:
  - documentId: doc-thesis
    title: Thesis Document Rule
    outputPath: docs/thesis.md
    sourceNodeIds:
      - node-thesis
    requiredNodeIds:
      - node-thesis
    optionalNodeIds: []
    sections:
      - id: core
        title: Core Section
        sourceNodeIds:
          - node-thesis
        required: true
`;

// ─── Profile loader tests ──────────────────────────────────────────────────

describe('loadProfile', () => {
	it('loads a minimal valid YAML profile without errors', () => {
		const path = writeFixture('minimal.yaml', MINIMAL_VALID_YAML);
		const result = loadProfile(path);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.value.id).toBe('test-minimal');
		expect(result.value.title).toBe('Minimal Test Profile');
		expect(result.value.version).toBe('1.0.0');
		expect(result.value.phases).toHaveLength(1);
		expect(result.value.documents).toHaveLength(1);
		expect(result.value.nodes).toHaveLength(1);
		expect(result.value.materializationRules).toHaveLength(1);
	});

	it('handles JSON profile files', () => {
		const jsonProfile = JSON.stringify({
			documents: [],
			id: 'json-profile',
			materializationRules: [],
			nodes: [],
			phases: [{ id: 'p1', order: 1, purpose: 'Test.', title: 'Phase 1' }],
			title: 'JSON Profile',
			version: '1.0.0',
		});
		const path = writeFixture('json-profile.json', jsonProfile);
		const result = loadProfile(path);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.value.id).toBe('json-profile');
	});

	it('returns error for non-existent file', () => {
		const result = loadProfile('/nonexistent/profile.yaml');

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_FILE_NOT_FOUND');
	});

	it('returns error for invalid YAML', () => {
		const path = writeFixture('broken.yaml', '{ this: is: broken: yaml: }');
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_PARSE_ERROR');
	});

	it('returns error for missing required top-level field', () => {
		const path = writeFixture(
			'missing-title.yaml',
			'id: foo\nversion: "1.0.0"\nphases: []\ndocuments: []\nnodes: []\nmaterializationRules: []\n',
		);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_SCHEMA_INVALID');
		expect(result.error.message).toContain('title');
	});

	it('returns error for wrong type on a required field', () => {
		const path = writeFixture(
			'wrong-type.yaml',
			'id: foo\ntitle: ok\nversion: "1.0.0"\nphases: "not-an-array"\ndocuments: []\nnodes: []\nmaterializationRules: []\n',
		);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_SCHEMA_INVALID');
		expect(result.error.message).toContain('phases');
	});

	// ─── Cross-reference tests ──────────────────────────────────────────

	it('returns error when node references non-existent document', () => {
		const yaml = `\
id: bad-ref
title: Bad Reference Profile
version: '1.0.0'
phases: []
documents: []
nodes:
  - id: lonely-node
    phaseId: p1
    documentId: nonexistent-doc
    title: Lonely
    order: 1
    canonicalQuestion: What?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
materializationRules: []
`;
		const path = writeFixture('bad-ref-node.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_REFERENCE_INVALID');
		expect(result.error.message).toContain('nonexistent-doc');
	});

	it('returns error when materialization rule references non-existent node', () => {
		const yaml = `\
id: bad-rule-ref
title: Bad Rule Ref
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: Node
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
materializationRules:
  - documentId: d1
    title: Rule
    outputPath: out.md
    sourceNodeIds:
      - nonexistent-node
    requiredNodeIds: []
    optionalNodeIds: []
    sections: []
`;
		const path = writeFixture('bad-rule-ref.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_REFERENCE_INVALID');
		expect(result.error.message).toContain('nonexistent-node');
	});

	it('returns error when requiredNodeIds is not a subset of sourceNodeIds', () => {
		const yaml = `\
id: bad-subset
title: Bad Subset
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: N1
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
  - id: n2
    phaseId: p1
    documentId: d1
    title: N2
    order: 2
    canonicalQuestion: Q2?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
materializationRules:
  - documentId: d1
    title: Rule
    outputPath: out.md
    sourceNodeIds:
      - n1
    requiredNodeIds:
      - n2
    optionalNodeIds: []
    sections: []
`;
		const path = writeFixture('bad-subset.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_REFERENCE_INVALID');
		expect(result.error.message).toContain('not in sourceNodeIds');
	});

	it('returns error when section references non-existent node', () => {
		const yaml = `\
id: bad-section
title: Bad Section
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: N1
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
materializationRules:
  - documentId: d1
    title: Rule
    outputPath: out.md
    sourceNodeIds:
      - n1
    requiredNodeIds:
      - n1
    optionalNodeIds: []
    sections:
      - id: sec1
        title: Section
        required: true
        sourceNodeIds:
          - nonexistent-node
`;
		const path = writeFixture('bad-section.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_REFERENCE_INVALID');
		expect(result.error.message).toContain('nonexistent-node');
	});

	it('validates optional fields like node dependencies correctly', () => {
		const yaml = `\
id: with-deps
title: With Dependencies
version: '1.0.0'
phases:
  - id: p1
    title: Phase 1
    order: 1
    purpose: test
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: N1
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs:
      initial: p1
    dependencies:
      requiredNodeIds: []
      recommendedNodeIds: []
    outputSchemaRef: schema.json
materializationRules: []
`;
		const path = writeFixture('with-deps.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.value.nodes[0]?.outputSchemaRef).toBe('schema.json');
	});

	it('returns error when document is missing optionalNodeIds', () => {
		const yaml = `\
id: no-optional
title: Missing Optional
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
nodes: []
materializationRules: []
`;
		const path = writeFixture('no-optional.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_SCHEMA_INVALID');
		expect(result.error.message).toContain('optionalNodeIds');
	});

	it('returns error when materialization rule is missing optionalNodeIds', () => {
		const yaml = `\
id: rule-no-optional
title: Rule No Optional
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: N1
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
materializationRules:
  - documentId: d1
    title: Rule
    outputPath: out.md
    sourceNodeIds:
      - n1
    requiredNodeIds:
      - n1
    sections: []
`;
		const path = writeFixture('rule-no-optional.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_SCHEMA_INVALID');
		expect(result.error.message).toContain('optionalNodeIds');
	});

	it('returns error when section is missing required field', () => {
		const yaml = `\
id: section-no-required
title: No Required
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: N1
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
materializationRules:
  - documentId: d1
    title: Rule
    outputPath: out.md
    sourceNodeIds:
      - n1
    requiredNodeIds:
      - n1
    optionalNodeIds: []
    sections:
      - id: sec1
        title: Section
        sourceNodeIds:
          - n1
`;
		const path = writeFixture('section-no-required.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_SCHEMA_INVALID');
		expect(result.error.message).toContain('required');
	});

	it('returns error when document requiredNodeIds references non-existent node', () => {
		const yaml = `\
id: doc-bad-node
title: Doc Bad Node
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds:
      - nonexistent-node
    optionalNodeIds: []
nodes: []
materializationRules: []
`;
		const path = writeFixture('doc-bad-node.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_REFERENCE_INVALID');
		expect(result.error.message).toContain('nonexistent-node');
	});

	it('returns error when node dependency references non-existent node', () => {
		const yaml = `\
id: dep-bad-node
title: Dep Bad Node
version: '1.0.0'
phases: []
documents:
  - id: d1
    phaseId: p1
    title: Doc
    order: 1
    purpose: test
    outputPath: out.md
    requiredNodeIds: []
    optionalNodeIds: []
nodes:
  - id: n1
    phaseId: p1
    documentId: d1
    title: N1
    order: 1
    canonicalQuestion: Q?
    coverageTopics: []
    sufficiencyCriteria: []
    promptRefs: {}
    dependencies:
      requiredNodeIds:
        - nonexistent-node
materializationRules: []
`;
		const path = writeFixture('dep-bad-node.yaml', yaml);
		const result = loadProfile(path);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected err');
		expect(result.error.code).toBe('LOGOS_PROFILE_REFERENCE_INVALID');
		expect(result.error.message).toContain('nonexistent-node');
	});
});

// ─── Profile registry tests ────────────────────────────────────────────────

describe('profile-registry', () => {
	describe('listProfiles', () => {
		it('returns empty array for non-existent directory', () => {
			const ids = listProfiles('/nonexistent/dir');
			expect(ids).toEqual([]);
		});

		it('returns empty array for empty directory', () => {
			const ids = listProfiles(TEST_FIXTURES_DIR);
			expect(ids).toEqual([]);
		});

		it('returns profile IDs for .yaml and .yml files', () => {
			writeFixture('profile-a.yaml', MINIMAL_VALID_YAML);
			writeFixture('profile-b.yml', MINIMAL_VALID_YAML);

			const ids = listProfiles(TEST_FIXTURES_DIR);
			expect(ids).toContain('profile-a');
			expect(ids).toContain('profile-b');
		});

		it('returns profile IDs for .json files', () => {
			writeFixture(
				'profile-c.json',
				'{"id":"c","title":"C","version":"1.0.0","phases":[],"documents":[],"nodes":[],"materializationRules":[]}',
			);

			const ids = listProfiles(TEST_FIXTURES_DIR);
			expect(ids).toContain('profile-c');
		});

		it('ignores non-profile files', () => {
			writeFixture('readme.md', '# Readme');
			writeFixture('profile-x.yaml', MINIMAL_VALID_YAML);

			const ids = listProfiles(TEST_FIXTURES_DIR);
			expect(ids).toEqual(['profile-x']);
		});

		it('returns sorted IDs', () => {
			writeFixture('zebra.yaml', MINIMAL_VALID_YAML);
			writeFixture('apple.yaml', MINIMAL_VALID_YAML);
			writeFixture('mango.yaml', MINIMAL_VALID_YAML);

			const ids = listProfiles(TEST_FIXTURES_DIR);
			expect(ids).toEqual(['apple', 'mango', 'zebra']);
		});
	});

	describe('getProfile', () => {
		it('loads a profile by ID from the fixtures directory', () => {
			writeFixture('my-profile.yaml', MINIMAL_VALID_YAML);

			const result = getProfile('my-profile', TEST_FIXTURES_DIR);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('expected ok');
			expect(result.value.id).toBe('test-minimal');
		});

		it('tries .yml extension when .yaml not found', () => {
			writeFixture('my-profile.yml', MINIMAL_VALID_YAML);

			const result = getProfile('my-profile', TEST_FIXTURES_DIR);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('expected ok');
			expect(result.value.id).toBe('test-minimal');
		});

		it('tries .json extension', () => {
			const json = JSON.stringify({
				documents: [],
				id: 'json-p',
				materializationRules: [],
				nodes: [],
				phases: [],
				title: 'JSON',
				version: '1.0.0',
			});
			writeFixture('my-profile.json', json);

			const result = getProfile('my-profile', TEST_FIXTURES_DIR);

			expect(result.ok).toBe(true);
			if (!result.ok) throw new Error('expected ok');
			expect(result.value.id).toBe('json-p');
		});

		it('returns error for non-existent profile', () => {
			const result = getProfile('nonexistent', TEST_FIXTURES_DIR);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('expected err');
			expect(result.error.code).toBe('LOGOS_PROFILE_FILE_NOT_FOUND');
			expect(result.error.message).toContain('nonexistent');
		});

		it('returns error for invalid profile content', () => {
			writeFixture('broken.yaml', '{ bad: yaml: }');

			const result = getProfile('broken', TEST_FIXTURES_DIR);

			expect(result.ok).toBe(false);
			if (result.ok) throw new Error('expected err');
			expect(result.error.code).toBe('LOGOS_PROFILE_PARSE_ERROR');
		});
	});
});
