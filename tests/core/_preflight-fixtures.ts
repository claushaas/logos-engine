/**
 * Shared test fixtures for generation preflight tests.
 *
 * Provides a fake filesystem with standard profile setup, config,
 * and intake state helpers.  Avoids duplicating fake filesystem logic
 * across the Step 6.2 test files.
 */

import path from 'node:path';

import type {
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../src/core/ports/filesystem.js';
import { PROFILES_DIR_NAME } from '../../src/core/profiles/profile-resolver.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

// ---------------------------------------------------------------------------
// YAML fixtures
// ---------------------------------------------------------------------------

export const STANDARD_DOCS_YML = `schemaVersion: 1
contentVersion: 0.1.0
registryType: documentation_registry
phaseRegistry:
  01-foundation:
    title: Foundation
    documents:
      - 01-thesis
`;

export function standardPhaseYml(): string {
	return `phase:
  id: 01-foundation
  title: Foundation
  documents:
    - id: 01-thesis
      file: phases/01-foundation/01-thesis.yml
`;
}

export function standardDocumentYml(): string {
	return `document:
  id: 01-thesis
  phase: 01-foundation
  title: Thesis
  centralQuestion: "What is the central thesis that justifies this project existing?"
  completionCriteria:
    - "A clear thesis statement exists"
  qualityChecks:
    - "The thesis is specific and non-generic"
  sections:
    - id: core-thesis
      title: Core Thesis
      questions:
        - "What is the central thesis that justifies this project existing?"
      required: true
`;
}

// ---------------------------------------------------------------------------
// Standard profile file/directory list
// ---------------------------------------------------------------------------

const STANDARD_REQUIRED_FILES = [
	{ content: '# docs', path: 'docs.yml' },
	{ content: '# schema', path: 'document.schema.yml' },
	{ content: '# gen', path: 'executive/executive-generation.yml' },
	{ content: '{}', path: 'executive/executive-plan.schema.json' },
];

const STANDARD_REQUIRED_DIRS = [
	'phases',
	'executive',
	'executive/mappings',
	'executive/templates',
];

// ---------------------------------------------------------------------------
// Fake filesystem factory
// ---------------------------------------------------------------------------

export type PreflightTestFilesystem = LogosFilesystem & {
	addDirectory(dir: string): void;
	addFile(filePath: string, content: string): void;
	addStandardProfile(): void;
	addLogosConfig(activeProfileId?: string): void;
	addIntakeState(intakeState: LogosIntakeState): void;
};

export function createPreflightTestFilesystem(): PreflightTestFilesystem {
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

	function addStandardProfile(): void {
		const root = `/project/${PROFILES_DIR_NAME}/standard`;
		addDirectory(root);
		for (const d of STANDARD_REQUIRED_DIRS) {
			addDirectory(path.join(root, d));
		}
		for (const f of STANDARD_REQUIRED_FILES) {
			addFile(path.join(root, f.path), f.content);
		}
		// Override with real YAML content.
		addFile(path.join(root, 'docs.yml'), STANDARD_DOCS_YML);
		addFile(path.join(root, 'phases/01-foundation.yml'), standardPhaseYml());
		addFile(
			path.join(root, 'phases/01-foundation/01-thesis.yml'),
			standardDocumentYml(),
		);
	}

	function addLogosConfig(activeProfileId = 'standard'): void {
		addDirectory(`/project/.logos`);
		addFile(
			`/project/.logos/config.yml`,
			`version: 1
activeProfileId: ${activeProfileId}
createdAt: "2026-01-01T00:00:00.000Z"
updatedAt: "2026-01-01T00:00:00.000Z"
`,
		);
	}

	function addIntakeState(state: LogosIntakeState): void {
		addDirectory(`/project/.logos`);
		addFile(
			`/project/.logos/intake-state.json`,
			JSON.stringify(state, null, 2),
		);
	}

	const fs: LogosFilesystem = {
		async ensureDirectory(p: string): Promise<void> {
			addDirectory(p);
		},

		async fileExists(input: FileExistsInput): Promise<boolean> {
			return files.has(input.path);
		},

		async listDirectory(
			input: DirectoryListInput,
		): Promise<Array<{ path: string; kind: 'file' | 'directory' }>> {
			const prefix = input.path.replace(/\/$/, '');
			if (!dirs.has(prefix)) {
				throw new Error(`ENOENT: no such directory "${prefix}"`);
			}
			const entries: Array<{ path: string; kind: 'file' | 'directory' }> = [];
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
			if (content === undefined) {
				throw new Error(`ENOENT: ${p}`);
			}
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

	return {
		...fs,
		addDirectory,
		addFile,
		addIntakeState,
		addLogosConfig,
		addStandardProfile,
	};
}

// ---------------------------------------------------------------------------
// Constant fixtures
// ---------------------------------------------------------------------------

export const NOW = '2026-05-22T00:00:00.000Z';

/**
 * The stable question ID for the single core-thesis question
 * generated from the standard profile fixture above.
 *
 * Format: `<phaseId>.<documentId>.<sectionId>.q<index+1>`
 */
export const CRITICAL_Q_ID = '01-foundation.01-thesis.core-thesis.q01';

export function createEmptyIntakeState(): LogosIntakeState {
	return {
		answeredQuestions: {},
		contradictions: {},
		initializedAt: '2026-01-01T00:00:00.000Z',
		mode: 'idle',
		partialQuestions: {},
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 0,
			partial: 0,
			skipped: 0,
			sufficient: 0,
			total: 0,
		},
		projectRoot: '/project',
		skippedQuestions: {},
		updatedAt: '2026-01-01T00:00:00.000Z',
		version: 1,
	};
}
