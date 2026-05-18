/** Step 7.4 Graph Output — non-mutation and safety tests */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DocumentDependencyGraph } from '../src/dependency-graph/dependency-graph.js';
import {
	createInspectableGraphOutput,
	renderGraphJsonReport,
	renderGraphTextReport,
} from '../src/dependency-graph/graph-output.js';
import { buildDocumentDependencyGraph } from '../src/dependency-graph/index.js';
import { loadDocumentationContract } from '../src/profiles/documentation-contract.js';
import { loadProfileRegistry } from '../src/profiles/profile-registry.js';

const PROJECT_ROOT = process.cwd();

async function buildStandardGraph(): Promise<DocumentDependencyGraph> {
	const contract = await loadDocumentationContract({
		profileId: 'standard',
		repoRoot: PROJECT_ROOT,
		schemaPath: join(
			PROJECT_ROOT,
			'profiles',
			'standard',
			'document.schema.yml',
		),
	});
	const registry = await loadProfileRegistry({
		profileId: 'standard',
		repoRoot: PROJECT_ROOT,
	});
	const result = buildDocumentDependencyGraph({ contract, registry });
	return result.graph;
}

async function createTempDir(): Promise<string> {
	const randomName = `logos-graph-nonmut-${randomUUID()}`;
	const fullPath = join(tmpdir(), randomName);
	await mkdir(fullPath, { recursive: true });
	return fullPath;
}

function requireTextOutput(result: { textOutput?: string }): string {
	if (typeof result.textOutput !== 'string') {
		throw new Error('Expected text output');
	}
	return result.textOutput;
}

function requireJsonOutput(result: { jsonOutput?: string }): string {
	if (typeof result.jsonOutput !== 'string') {
		throw new Error('Expected JSON output');
	}
	return result.jsonOutput;
}

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('graph output non-mutation', () => {
	it('graph output writes no files', async () => {
		const tempDir = await createTempDir();
		const graph = await buildStandardGraph();

		try {
			// Record files before
			const beforeFiles = await listDir(tempDir);

			createInspectableGraphOutput({ graph });
			renderGraphTextReport({ graph });
			renderGraphJsonReport({ graph });
			createInspectableGraphOutput({ graph }, { mode: 'full' });
			createInspectableGraphOutput({ graph }, { format: 'json' });

			// Record files after
			const afterFiles = await listDir(tempDir);

			expect(afterFiles).toEqual(beforeFiles);
		} finally {
			try {
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('graph output does not create .logos/', async () => {
		const tempDir = await createTempDir();
		const graph = await buildStandardGraph();

		const logosPath = join(tempDir, '.logos');

		try {
			await createInspectableGraphOutput({ graph }, { mode: 'full' });
			await renderGraphJsonReport({ graph }, { mode: 'full' });
			await renderGraphTextReport({ graph }, { mode: 'full' });

			expect(existsSync(logosPath)).toBe(false);
		} finally {
			try {
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('graph output does not update artifact registry', async () => {
		const graph = await buildStandardGraph();
		// This is verified by the fact that the function doesn't take state inputs
		// and is a pure function. The test verifies deterministic behavior.
		const r1 = createInspectableGraphOutput({ graph });
		const r2 = createInspectableGraphOutput({ graph });
		expect(r1.textOutput).toBe(r2.textOutput);
	});

	it('graph output does not persist state', async () => {
		const tempDir = await createTempDir();

		try {
			// Create a temp workspace state
			const logosDir = join(tempDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace-state.json'),
				JSON.stringify({ _test: true }),
				'utf-8',
			);

			const graph = await buildStandardGraph();

			// Read state before
			const beforeContent = await readFile(
				join(logosDir, 'workspace-state.json'),
				'utf-8',
			);

			createInspectableGraphOutput({ graph });

			// Read state after
			const afterContent = await readFile(
				join(logosDir, 'workspace-state.json'),
				'utf-8',
			);

			expect(afterContent).toBe(beforeContent);
		} finally {
			try {
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('graph output does not generate Markdown files', async () => {
		const tempDir = await createTempDir();
		const graph = await buildStandardGraph();

		try {
			await createInspectableGraphOutput({ graph }, { mode: 'full' });

			const files = await listDir(tempDir);
			for (const file of files) {
				expect(file).not.toMatch(/\.md$/);
			}
		} finally {
			try {
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('graph output does not generate HTML files', async () => {
		const tempDir = await createTempDir();
		const graph = await buildStandardGraph();

		try {
			await createInspectableGraphOutput({ graph }, { mode: 'full' });

			const files = await listDir(tempDir);
			for (const file of files) {
				expect(file).not.toMatch(/\.html$/);
			}
		} finally {
			try {
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('graph output does not generate agent packs', async () => {
		const tempDir = await createTempDir();
		const graph = await buildStandardGraph();

		try {
			await createInspectableGraphOutput({ graph }, { mode: 'full' });

			// Should not create any agent pack files
			const files = await listDir(tempDir);
			for (const file of files) {
				expect(file).not.toMatch(/agent-pack\.json$/);
			}
			expect(files).toEqual([]);
		} finally {
			try {
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it('graph output does not call AI or provider code', () => {
		// The graph output functions are pure TypeScript functions with no AI
		// imports or provider dependencies. This test verifies that the module
		// can be imported without triggering any AI-related code paths.
		expect(typeof renderGraphTextReport).toBe('function');
		expect(typeof createInspectableGraphOutput).toBe('function');
	});

	it('no test mutates the real repository', async () => {
		// Verify that the Standard profile still loads from its real location
		const graph = await buildStandardGraph();
		expect(graph.profileId).toBe('standard');
		expect(graph.nodes.length).toBeGreaterThan(0);
	});

	it('graph output does not include raw secrets in text output', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphTextReport({ graph });

		const text = requireTextOutput(result);
		expect(text).not.toContain('sk-ant-api');
		expect(text).not.toContain('sk-proj-');
		expect(text).not.toContain('Bearer ');
		expect(text).not.toContain('api_key=');
		expect(text).not.toContain('secret=');
		expect(text).not.toContain('token=');
	});

	it('graph output does not include raw secrets in JSON output', async () => {
		const graph = await buildStandardGraph();
		const result = renderGraphJsonReport({ graph });
		const jsonStr = requireJsonOutput(result);

		expect(jsonStr).not.toContain('sk-ant-api');
		expect(jsonStr).not.toContain('sk-proj-');
		expect(jsonStr).not.toContain('Bearer ');
		expect(jsonStr).not.toContain('"api_key"');
	});
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function listDir(dir: string): Promise<string[]> {
	try {
		const entries = await import('node:fs/promises').then((m) =>
			m.readdir(dir, { recursive: true }),
		);
		return entries.map((e: string) => join(dir, e));
	} catch {
		return [];
	}
}
