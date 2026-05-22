/**
 * Tests for profile-driven generation and executive contracts (Step 2.3).
 *
 * Covers:
 * - Document output contracts are derived from document descriptor outputs.
 * - Executive mapping paths are loaded from executive/mappings/.
 * - Executive template paths are loaded from executive/templates/.
 * - Generation contracts are associated with the active profile.
 * - No actual generation or file writing occurs.
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
	addGenerationFixtureProfile(): void;
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

	function addGenerationFixtureProfile(): void {
		const root = '/project/profiles/standard';

		// Required root files
		addFile(
			path.join(root, 'docs.yml'),
			`schemaVersion: 1
contentVersion: 0.1.0
registryType: documentation_registry`,
		);
		addFile(path.join(root, 'document.schema.yml'), 'schema:\n  id: test');

		// Phase directory and descriptor
		addDirectory(path.join(root, 'phases'));
		addDirectory(path.join(root, 'phases/01-foundation'));
		addFile(
			path.join(root, 'phases/01-foundation.yml'),
			`phase:
  id: 01-foundation
  title: Foundation
  documents:
    - id: 01-thesis
      file: phases/01-foundation/01-thesis.yml
    - id: 02-problem
      file: phases/01-foundation/02-problem.yml`,
		);

		// Document descriptors with outputs
		addFile(
			path.join(root, 'phases/01-foundation/01-thesis.yml'),
			`document:
  id: "01-thesis"
  title: "Founding Thesis"
  phase: "01-foundation"
  centralQuestion: "What justifies this project?"
  outputs:
    canonical:
      format: "markdown"
      path: "docs/01-foundation/01-thesis.md"
      purpose: "Store the canonical founding thesis."
    artifacts:
      - id: "foundation.thesis_map"
        format: "html"
        path: "outcomes/html/01-foundation/thesis-map.html"
        purpose: "A navigable map of the thesis."
      - id: "foundation.thesis_summary"
        format: "html"
        path: "outcomes/html/01-foundation/thesis-summary.html"
        purpose: "Summary view."
    agentPacks:
      - id: "foundation.thesis_review"
        format: "markdown"
        path: "outcomes/agents/01-foundation/thesis-review.md"
  completionCriteria:
    - "Thesis is explicit"
  qualityChecks:
    - "Avoid vague claims"
  dependsOn: []
  sections:
    - id: "core-thesis"
      title: "Core Thesis"
      required: true
      questions:
        - "What is the central thesis?"
        - "What tension does this resolve?"`,
		);

		addFile(
			path.join(root, 'phases/01-foundation/02-problem.yml'),
			`document:
  id: "02-problem"
  title: "The Real Problem"
  phase: "01-foundation"
  centralQuestion: "What problem does this solve?"
  outputs:
    canonical:
      format: "markdown"
      path: "docs/01-foundation/02-problem.md"
  completionCriteria:
    - "Problem is concrete"
  sections:
    - id: "problem-statement"
      title: "Problem Statement"
      required: true
      questions:
        - "What problem is being solved?"`,
		);

		// Executive files
		addDirectory(path.join(root, 'executive'));
		addDirectory(path.join(root, 'executive/mappings'));
		addDirectory(path.join(root, 'executive/templates'));

		addFile(
			path.join(root, 'executive/executive-generation.yml'),
			`id: executive-generation
version: 1.0.0
title: Executive Generation
status: draft
purpose: Generate executive model from normative docs.
exports:
  enabled:
    - markdown
    - html
    - githubIssues
  targets:
    markdown:
      mapping: executive/mappings/markdown.mapping.yml
      outputPath: outcomes/executive/exports/markdown/
    html:
      mapping: executive/mappings/html.mapping.yml
      outputPath: outcomes/executive/exports/html/
`,
		);

		addFile(
			path.join(root, 'executive/executive-plan.schema.json'),
			'{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"LOGOS Executive Plan","type":"object"}',
		);

		addFile(
			path.join(root, 'executive/mappings/markdown.mapping.yml'),
			`id: markdown
version: 1.0.0
adapter: markdown
status: supported
purpose: Generate markdown execution snapshots.`,
		);

		addFile(
			path.join(root, 'executive/mappings/html.mapping.yml'),
			`id: html
version: 1.0.0
adapter: html
status: supported
purpose: Generate HTML views.`,
		);

		addFile(
			path.join(root, 'executive/mappings/github-issues.mapping.yml'),
			`id: githubIssues
version: 1.0.0
adapter: github
status: supported
purpose: Export to GitHub Issues.`,
		);

		addFile(
			path.join(root, 'executive/templates/implementation-plan.md'),
			'# Implementation Plan\n\n<!-- template -->',
		);

		addFile(
			path.join(root, 'executive/templates/agent-task.md'),
			'# Agent Task\n\n<!-- template -->',
		);

		addFile(
			path.join(root, 'executive/templates/executive-overview.html'),
			'<html><body><!-- template --></body></html>',
		);
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

	return { ...fs, addDirectory, addFile, addGenerationFixtureProfile };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('profile-driven generation contracts', () => {
	// ---- 1. Document output contracts are derived from document descriptor outputs ----
	it('derives document output paths from document descriptor outputs', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const gen = result.contracts.generation;
			expect(gen.documentOutputPaths.length).toBe(2);

			const thesisOutput = gen.documentOutputPaths.find(
				(o) => o.documentId === '01-thesis',
			);
			expect(thesisOutput).toBeDefined();
			expect(thesisOutput?.phaseId).toBe('01-foundation');
			expect(thesisOutput?.path).toBe('docs/01-foundation/01-thesis.md');

			const problemOutput = gen.documentOutputPaths.find(
				(o) => o.documentId === '02-problem',
			);
			expect(problemOutput).toBeDefined();
			expect(problemOutput?.path).toBe('docs/01-foundation/02-problem.md');
		}
	});

	// ---- 2. Executive mapping paths are loaded from executive/mappings/ ----
	it('loads executive mapping paths from executive/mappings/', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const exec = result.contracts.executive;
			expect(exec.mappingPaths.length).toBe(3);

			const endsWith = (suffix: string) =>
				exec.mappingPaths.some((p) => p.endsWith(suffix));

			expect(endsWith('markdown.mapping.yml')).toBe(true);
			expect(endsWith('html.mapping.yml')).toBe(true);
			expect(endsWith('github-issues.mapping.yml')).toBe(true);

			// Mapping paths should be sorted
			const sorted = [...exec.mappingPaths].sort();
			expect(exec.mappingPaths).toEqual(sorted);
		}
	});

	// ---- 3. Executive template paths are loaded from executive/templates/ ----
	it('loads executive template paths from executive/templates/', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const exec = result.contracts.executive;
			expect(exec.templatePaths.length).toBe(3);

			const endsWith = (suffix: string) =>
				exec.templatePaths.some((p) => p.endsWith(suffix));

			expect(endsWith('implementation-plan.md')).toBe(true);
			expect(endsWith('agent-task.md')).toBe(true);
			expect(endsWith('executive-overview.html')).toBe(true);

			// Template paths should be sorted
			const sorted = [...exec.templatePaths].sort();
			expect(exec.templatePaths).toEqual(sorted);
		}
	});

	// ---- 4. Generation contracts are associated with the active profile ----
	it('generation contracts use the active profile id and root', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.contracts.profileId).toBe('standard');
			expect(result.contracts.profileRoot).toBe('/project/profiles/standard');
		}
	});

	// ---- 5. No actual generation or file writing occurs ----
	it('does not write any files during loading', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		// Track writes
		const writtenPaths: string[] = [];
		const originalWriteTextFile = fs.writeTextFile.bind(fs);
		fs.writeTextFile = async (input: FileWriteInput): Promise<void> => {
			writtenPaths.push(input.path);
			return originalWriteTextFile(input);
		};

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		expect(writtenPaths).toEqual([]);
	});

	// ---- Additional: Executive generation config is loaded ----
	it('loads executive generation config', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const exec = result.contracts.executive;
			expect(exec.generationConfig).toBeDefined();
			expect(exec.generationConfig?.id).toBe('executive-generation');
			expect(exec.generationConfig?.version).toBe('1.0.0');

			// Paths are preserved
			expect(exec.generationConfigPath).toContain('executive-generation.yml');
			expect(exec.planSchemaPath).toContain('executive-plan.schema.json');
		}
	});

	// ---- Additional: Mapping configs are parsed ----
	it('parses mapping config files into raw records', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const exec = result.contracts.executive;
			expect(exec.mappingConfigs.length).toBe(3);

			const markdownMap = exec.mappingConfigs.find((m) =>
				m.path.endsWith('markdown.mapping.yml'),
			);
			expect(markdownMap).toBeDefined();
			expect(markdownMap?.raw.id).toBe('markdown');
			expect(markdownMap?.raw.adapter).toBe('markdown');
		}
	});

	// ---- Additional: Artifact contracts are derived ----
	it('derives artifact contracts from document descriptor outputs', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const artifacts = result.contracts.artifacts;
			// One document (01-thesis) has 2 artifacts, 02-problem has 0.
			expect(artifacts.artifacts.length).toBe(2);

			const thesisArtifacts = artifacts.artifacts.filter(
				(a) => a.documentId === '01-thesis',
			);
			expect(thesisArtifacts.length).toBe(2);
		}
	});

	// ---- Additional: Validation contracts are derived ----
	it('derives validation contracts from document completion criteria and quality checks', async () => {
		const fs = createFakeFilesystem();
		fs.addGenerationFixtureProfile();

		const result = await loadProfileContracts({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const validation = result.contracts.validation;
			expect(validation.documentSchemaPath.length).toBeGreaterThan(0);

			// Both docs have completion criteria
			expect(validation.completionCriteria.length).toBe(2);

			// Only 01-thesis has quality checks in our fixture
			const thesisQC = validation.qualityChecks.find(
				(qc) => qc.documentId === '01-thesis',
			);
			expect(thesisQC).toBeDefined();
			expect(Array.isArray(thesisQC?.raw)).toBe(true);
			if (Array.isArray(thesisQC?.raw)) {
				expect(thesisQC.raw).toContain('Avoid vague claims');
			}
		}
	});
});
