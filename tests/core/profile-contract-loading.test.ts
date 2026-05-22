/**
 * Tests for profile contract loading (Step 2.3).
 *
 * Covers:
 * - loadProfileContracts loads the real profiles/standard through the resolver.
 * - Returned contracts include all required fields.
 * - Loaded paths include key Standard profile files.
 * - Loading invalid YAML returns profile_invalid.
 * - Loading missing required contracts still returns resolver-level errors.
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type {
	DirectoryEntry,
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../src/core/ports/filesystem.js';
import { loadProfileContracts } from '../../src/core/profiles/load-profile-contracts.js';

// ---------------------------------------------------------------------------
// Fake filesystem with profile fixture support
// ---------------------------------------------------------------------------

function createFakeFilesystem(): LogosFilesystem & {
	addDirectory(dir: string): void;
	addFile(filePath: string, content: string): void;
	addStandardProfile(options?: { omitPaths?: string[] }): void;
} {
	const files = new Map<string, string>();
	const dirs = new Set<string>();

	function addDirectory(dir: string): void {
		const normalised = dir.replace(/\/$/, '');
		dirs.add(normalised);
		let parent = path.dirname(normalised);
		while (parent !== normalised && parent !== '.' && parent !== '/') {
			dirs.add(parent);
			parent = path.dirname(parent);
		}
		if (normalised.startsWith('/')) {
			let p = path.dirname(normalised);
			while (p !== '/' && p !== '.') {
				dirs.add(p);
				p = path.dirname(p);
			}
			dirs.add('/');
		}
	}

	function addFile(filePath: string, content: string): void {
		files.set(filePath, content);
		addDirectory(path.dirname(filePath));
	}

	// -----------------------------------------------------------------------
	// Fixture YAML content
	// -----------------------------------------------------------------------

	function makeDocsYml(): string {
		return `schemaVersion: 1
contentVersion: 0.1.0
registryType: documentation_registry

project:
  id: test-project
  title: Test Project
  purpose: Testing

documentationSystem:
  id: test-docs
  title: Test Docs

axes:
  - id: normative
    title: Normative Axis
    phases:
      - 01-foundation

phaseDefinitions:
  01-foundation:
    purpose: Define why the project exists.

phaseRegistry:
  directory: phases
  files:
    - id: 01-foundation
      path: phases/01-foundation.yml
      required: true

outputModel:
  structure:
    format: yaml

globalRules:
  questionsLocation: In document sections.

qualityModel:
  requiredChecks:
    - completeness

dependencyPolicy:
  missingRequiredInput: block_generation

agentPolicy:
  defaultMode: documentation_compiler
`;
	}

	function makeDocumentSchemaYml(): string {
		return `schema:
  id: test-schema
  title: Test Schema
  version: "0.1.0"

  document:
    requiredFields:
      - id
      - title
      - phase
`;
	}

	function makePhaseYml(phaseId: string, phaseTitle: string): string {
		return `phase:
  id: ${phaseId}
  title: ${phaseTitle}
  order: 1
  axis: normative
  status: not_started
  documents:
    - id: 01-thesis
      title: Thesis
      file: phases/${phaseId}/01-thesis.yml
      purpose: "Define the thesis"
      centralQuestion: "What justifies this project?"
      required: true
    - id: 02-problem
      title: Problem
      file: phases/${phaseId}/02-problem.yml
      purpose: "Define the problem"
      centralQuestion: "What problem does this solve?"
      required: true
`;
	}

	function makeDocYml(
		docId: string,
		docTitle: string,
		phaseId: string,
		centralQuestion: string,
		sectionIds: string[],
	): string {
		const sectionsYml = sectionIds
			.map(
				(sid, idx) => `    - id: "${sid}"
      title: "Section ${idx + 1}"
      required: true
      questions:
        - "Question ${idx + 1}a for ${sid}"
        - "Question ${idx + 1}b for ${sid}"`,
			)
			.join('\n');

		return `document:
  id: "${docId}"
  title: "${docTitle}"
  phase: "${phaseId}"
  status: "not_started"
  order: 1
  type: "thesis"
  purpose: "Test document"
  centralQuestion: "${centralQuestion}"
  outputs:
    canonical:
      format: "markdown"
      path: "docs/${phaseId}/${docId}.md"
    artifacts:
      - id: "artifact.${docId}"
        format: "html"
        path: "outcomes/html/${phaseId}/${docId}.html"
  completionCriteria:
    - "Criterion 1 for ${docId}"
    - "Criterion 2 for ${docId}"
  qualityChecks:
    - "Quality check 1 for ${docId}"
  dependsOn: []
  sections:
${sectionsYml}`;
	}

	function makeExecutiveGenYml(): string {
		return `id: executive-generation
version: 1.0.0
title: Executive Axis Generation Profile
status: draft
purpose: Test executive generation.
`;
	}

	function makeMappingYml(mappingId: string): string {
		return `id: ${mappingId}
version: 1.0.0
adapter: ${mappingId}
status: supported
purpose: Test mapping.
`;
	}

	function makeTemplateContent(_name: string): string {
		return '# Template content';
	}

	// -----------------------------------------------------------------------
	// Profile population
	// -----------------------------------------------------------------------

	const STANDARD_REQUIRED_FILES = [
		{ content: makeDocsYml(), path: 'docs.yml' },
		{ content: makeDocumentSchemaYml(), path: 'document.schema.yml' },
		{
			content: makeExecutiveGenYml(),
			path: 'executive/executive-generation.yml',
		},
		{ content: '{}', path: 'executive/executive-plan.schema.json' },
	];

	const STANDARD_REQUIRED_DIRS = [
		'phases',
		'phases/01-foundation',
		'executive',
		'executive/mappings',
		'executive/templates',
	];

	const PHASE_FILES = [
		{
			content: makePhaseYml('01-foundation', 'Foundation'),
			path: 'phases/01-foundation.yml',
		},
	];

	const DOC_FILES = [
		{
			content: makeDocYml(
				'01-thesis',
				'Founding Thesis',
				'01-foundation',
				'What justifies this project?',
				['core-thesis', 'context'],
			),
			path: 'phases/01-foundation/01-thesis.yml',
		},
		{
			content: makeDocYml(
				'02-problem',
				'The Real Problem',
				'01-foundation',
				'What problem does this solve?',
				['problem-statement', 'symptoms'],
			),
			path: 'phases/01-foundation/02-problem.yml',
		},
	];

	const MAPPING_FILES = [
		{
			content: makeMappingYml('markdown'),
			path: 'executive/mappings/markdown.mapping.yml',
		},
		{
			content: makeMappingYml('html'),
			path: 'executive/mappings/html.mapping.yml',
		},
	];

	const TEMPLATE_FILES = [
		{
			content: makeTemplateContent('plan'),
			path: 'executive/templates/implementation-plan.md',
		},
		{
			content: makeTemplateContent('task'),
			path: 'executive/templates/agent-task.md',
		},
	];

	function addStandardProfile(options?: { omitPaths?: string[] }): void {
		const omit = new Set(options?.omitPaths ?? []);
		const root = '/project/profiles/standard';

		addDirectory(root);

		for (const d of STANDARD_REQUIRED_DIRS) {
			if (!omit.has(d) && !omit.has(`${d}/`)) {
				addDirectory(path.join(root, d));
			}
		}

		for (const f of STANDARD_REQUIRED_FILES) {
			if (!omit.has(f.path)) {
				addFile(path.join(root, f.path), f.content);
			}
		}

		for (const f of PHASE_FILES) {
			if (!omit.has(f.path)) {
				addFile(path.join(root, f.path), f.content);
			}
		}

		for (const f of DOC_FILES) {
			if (!omit.has(f.path)) {
				addFile(path.join(root, f.path), f.content);
			}
		}

		for (const f of MAPPING_FILES) {
			if (!omit.has(f.path)) {
				addFile(path.join(root, f.path), f.content);
			}
		}

		for (const f of TEMPLATE_FILES) {
			if (!omit.has(f.path)) {
				addFile(path.join(root, f.path), f.content);
			}
		}
	}

	const fs: LogosFilesystem = {
		async ensureDirectory(p: string): Promise<void> {
			addDirectory(p);
		},

		async fileExists(input: FileExistsInput): Promise<boolean> {
			return files.has(input.path);
		},

		async listDirectory(input: DirectoryListInput): Promise<DirectoryEntry[]> {
			const prefix = input.path.replace(/\/$/, '');
			if (!dirs.has(prefix)) {
				throw new Error(`ENOENT: no such directory "${prefix}"`);
			}
			const entries: DirectoryEntry[] = [];
			const seen = new Set<string>();

			for (const filePath of files.keys()) {
				if (filePath.startsWith(`${prefix}/`)) {
					const rel = filePath.slice(prefix.length + 1);
					const top = rel.split('/')[0];
					if (top !== undefined && !seen.has(top)) {
						seen.add(top);
						entries.push({ kind: 'file', path: path.join(prefix, top) });
					}
				}
			}

			for (const dirPath of dirs) {
				if (dirPath.startsWith(`${prefix}/`)) {
					const rel = dirPath.slice(prefix.length + 1);
					const top = rel.split('/')[0];
					if (top !== undefined && !seen.has(top)) {
						seen.add(top);
						entries.push({ kind: 'directory', path: path.join(prefix, top) });
					}
				}
			}

			return entries;
		},

		async readTextFile(p: string): Promise<FileReadResult> {
			const content = files.get(p);
			if (content === undefined) throw new Error(`ENOENT: ${p}`);
			return { content, path: p };
		},

		async writeTextFile(input: FileWriteInput): Promise<void> {
			if (!input.overwrite && files.has(input.path)) {
				throw new Error(`EEXIST: ${input.path}`);
			}
			files.set(input.path, input.content);
			addDirectory(path.dirname(input.path));
		},
	};

	return { ...fs, addDirectory, addFile, addStandardProfile };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadProfileContracts', () => {
	// ---- 1. Loads the real profiles/standard through the resolver ----
	it('loads contracts from a fully populated standard profile', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const c = result.contracts;
			expect(c.profileId).toBe('standard');
			expect(c.profileRoot).toBe('/project/profiles/standard');
		}
	});

	// ---- 2. Returned contracts include all required fields ----
	it('returned contracts include root registry, document schema, phases, documents, questions, validation, generation, artifacts, and executive', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const c = result.contracts;

			// Root registry
			expect(c.rootRegistry).toBeDefined();
			expect(c.rootRegistry.raw).toBeDefined();
			expect(c.rootRegistry.schemaVersion).toBe(1);
			expect(c.rootRegistry.registryType).toBe('documentation_registry');

			// Document schema
			expect(c.documentSchema).toBeDefined();
			expect(c.documentSchema.raw).toBeDefined();

			// Phases
			expect(c.phases.length).toBe(1);
			expect(c.phases[0]?.id).toBe('01-foundation');
			expect(c.phases[0]?.title).toBe('Foundation');

			// Documents
			expect(c.documents.length).toBe(2);
			const docIds = c.documents.map((d) => d.id);
			expect(docIds).toContain('01-thesis');
			expect(docIds).toContain('02-problem');

			// Questions
			expect(c.questions.length).toBeGreaterThan(0);

			// Validation
			expect(c.validation).toBeDefined();
			expect(c.validation.documentSchemaPath.length).toBeGreaterThan(0);

			// Generation
			expect(c.generation).toBeDefined();
			expect(c.generation.documentOutputPaths.length).toBeGreaterThan(0);

			// Artifacts
			expect(c.artifacts).toBeDefined();

			// Executive
			expect(c.executive).toBeDefined();
			expect(c.executive.generationConfigPath.length).toBeGreaterThan(0);
			expect(c.executive.planSchemaPath.length).toBeGreaterThan(0);
			expect(c.executive.mappingPaths.length).toBeGreaterThan(0);
			expect(c.executive.templatePaths.length).toBeGreaterThan(0);
		}
	});

	// ---- 3. Loaded paths include key Standard profile files ----
	it('loaded paths include key profile files', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const paths = result.contracts.loadedPaths;
			expect(paths.some((p) => p.endsWith('docs.yml'))).toBe(true);
			expect(paths.some((p) => p.endsWith('document.schema.yml'))).toBe(true);
			expect(paths.some((p) => p.endsWith('01-foundation.yml'))).toBe(true);
			expect(paths.some((p) => p.endsWith('01-thesis.yml'))).toBe(true);
			expect(paths.some((p) => p.endsWith('executive-generation.yml'))).toBe(
				true,
			);
			expect(paths.some((p) => p.endsWith('executive-plan.schema.json'))).toBe(
				true,
			);
		}
	});

	// ---- 4. Loading invalid YAML returns profile_invalid ----
	it('returns profile_invalid when docs.yml contains invalid YAML', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		// Overwrite docs.yml with invalid YAML.
		fs.addFile('/project/profiles/standard/docs.yml', '{{{ invalid: [}');

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_invalid')).toBe(
				true,
			);
		}
	});

	it('returns profile_invalid when a document descriptor contains invalid YAML', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		fs.addFile(
			'/project/profiles/standard/phases/01-foundation/01-thesis.yml',
			'::: not-yaml :::',
		);

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_invalid')).toBe(
				true,
			);
		}
	});

	// ---- 5. Missing required contracts returns resolver-level errors ----
	it('returns errors when profile does not exist (resolver level)', async () => {
		const fs = createFakeFilesystem();

		const result = await loadProfileContracts({
			activeProfileId: 'nonexistent',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_not_found')).toBe(
				true,
			);
		}
	});

	it('returns errors when docs.yml is missing (resolver level)', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['docs.yml'] });

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_invalid')).toBe(
				true,
			);
		}
	});

	// ---- Additional: generic profile id works ----
	it('works with a non-standard profile id', async () => {
		const fs = createFakeFilesystem();
		// Reuse addStandardProfile logic for a different id.
		// We need to manually set up a profile with the same structure.
		const root = '/project/profiles/custom-profile';

		fs.addDirectory(root);
		fs.addFile(
			path.join(root, 'docs.yml'),
			`schemaVersion: 2
contentVersion: 0.2.0
registryType: custom`,
		);
		fs.addFile(
			path.join(root, 'document.schema.yml'),
			'schema:\n  id: custom-schema',
		);
		fs.addDirectory(path.join(root, 'phases'));
		fs.addFile(
			path.join(root, 'phases/01-custom.yml'),
			'phase:\n  id: 01-custom\n  title: Custom Phase\n  documents: []',
		);
		fs.addDirectory(path.join(root, 'executive'));
		fs.addFile(
			path.join(root, 'executive/executive-generation.yml'),
			'id: exec\nversion: 1.0.0',
		);
		fs.addFile(path.join(root, 'executive/executive-plan.schema.json'), '{}');
		fs.addDirectory(path.join(root, 'executive/mappings'));
		fs.addDirectory(path.join(root, 'executive/templates'));

		const result = await loadProfileContracts({
			activeProfileId: 'custom-profile',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.contracts.profileId).toBe('custom-profile');
			expect(result.contracts.profileRoot).toBe(root);
			expect(result.contracts.rootRegistry.schemaVersion).toBe(2);
			expect(result.contracts.phases.length).toBe(1);
			expect(result.contracts.phases[0]?.id).toBe('01-custom');
		}
	});
});
