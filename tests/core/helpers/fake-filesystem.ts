/**
 * Shared fake filesystem helpers for Core tests.
 */

import path from 'node:path';
import type {
	DirectoryEntry,
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../../src/core/ports/filesystem.js';

// ---------------------------------------------------------------------------
// Fake filesystem factory
// ---------------------------------------------------------------------------

export function createFakeFilesystem(): LogosFilesystem & {
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
						entries.push({
							kind: 'directory',
							path: path.join(prefix, top),
						});
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

/**
 * Convenience helper that adds a standard profile to an existing fake filesystem.
 */
export function addStandardProfileToFs(
	fs: LogosFilesystem & {
		addStandardProfile(options?: { omitPaths?: string[] }): void;
	},
	options?: { omitPaths?: string[] },
): void {
	fs.addStandardProfile(options);
}
