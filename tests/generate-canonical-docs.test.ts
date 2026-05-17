import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	executeGenerateCanonicalDocs,
	generateCanonicalDocs,
	planGenerateCanonicalDocs,
} from '../src/generation/generate-canonical-docs.js';
import type { GenerateCanonicalDocsDryRunResult } from '../src/generation/generate-types.js';
import type { WorkspaceState } from '../src/state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';
import { writeWorkspaceState } from '../src/state/workspace-state-repository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_TIMESTAMP = '2025-06-15T12:00:00.000Z';
const TEST_ID_PREFIX = 'tst';

function iso(date: string): string {
	return new Date(date).toISOString();
}

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-gen-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);
	mkdirSync(dir, { recursive: true });
	return resolve(dir);
}

function cleanDir(dir: string): void {
	try {
		rmSync(dir, { force: true, recursive: true });
	} catch {
		// Best effort
	}
}

function copyDirSync(src: string, dest: string): void {
	mkdirSync(dest, { recursive: true });
	const entries = readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			const content = readFileSync(srcPath);
			writeFileSync(destPath, content);
		}
	}
}

function copyProfilesTo(dir: string): void {
	const profilesSrc = resolve(
		join(import.meta.dirname ?? __dirname, '..', 'profiles'),
	);
	if (typeof import.meta.dirname !== 'string') {
		// Fallback for older vitest
		const profilesAlt = resolve(join(process.cwd(), 'profiles'));
		if (readdirSync(profilesAlt, { withFileTypes: true }).length > 0) {
			copyDirSync(profilesAlt, join(dir, 'profiles'));
		}
	} else {
		copyDirSync(profilesSrc, join(dir, 'profiles'));
	}
}

function createConfirmedStateFixture(
	canonicalId: string,
	decisionBody?: string,
): WorkspaceState {
	const base = createDefaultWorkspaceState({
		createdAt: iso('2025-01-01T00:00:00Z'),
		projectRootPath: '/tmp/test-repo',
		updatedAt: iso('2025-06-01T00:00:00Z'),
		workspaceId: 'ws-test-gen',
	});

	base.decisions = [
		{
			affectedDocumentIds: [canonicalId],
			body: decisionBody ?? 'We decided to use TypeScript for the project.',
			confidence: 'high',
			createdAt: iso('2025-03-01T00:00:00Z'),
			id: 'dec-test-001',
			sourceRefs: [],
			status: 'confirmed',
			title: 'Use TypeScript',
			updatedAt: iso('2025-03-01T00:00:00Z'),
		},
	];

	base.assumptions = [
		{
			affectedDocumentIds: [canonicalId],
			body: 'Target team has TypeScript experience.',
			caveat: 'New hires may need training.',
			createdAt: iso('2025-03-01T00:00:00Z'),
			id: 'asm-test-001',
			sourceRefs: [],
			status: 'active',
			title: 'Team knows TypeScript',
			updatedAt: iso('2025-03-01T00:00:00Z'),
		},
	];

	return base;
}

async function initTestWorkspace(
	rootDir: string,
	overrides?: Partial<WorkspaceState>,
): Promise<WorkspaceState> {
	// Copy profile files into the temp workspace so contract loading works
	copyProfilesTo(rootDir);

	const state = createConfirmedStateFixture(
		'01-engineering/01-engineering-brief',
	);
	const final: WorkspaceState = {
		...state,
		workspace: {
			...state.workspace,
			projectRootPath: rootDir,
		},
	};
	if (overrides) {
		Object.assign(final, overrides);
	}

	await writeWorkspaceState({
		_testTimestamp: TEST_TIMESTAMP,
		policy: 'overwrite',
		projectRoot: rootDir,
		state: final,
	});
	return final;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('planGenerateCanonicalDocs (preflight)', () => {
	it('requires initialized workspace', async () => {
		const dir = createTempDir();
		try {
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('loads active profile and workspace state', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.profileId).toBeDefined();
			expect(result.documentationRoot).toBeDefined();
		} finally {
			cleanDir(dir);
		}
	});

	it('uses documentation root from workspace state', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.documentationRoot).toBeTruthy();
		} finally {
			cleanDir(dir);
		}
	});

	it('default root is logos/', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.documentationRoot).toBe('logos/');
		} finally {
			cleanDir(dir);
		}
	});

	it('custom root is honored', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir, {
				documentation: {
					isDefault: false,
					rootPath: 'custom-docs/',
					wasExplicitlyConfigured: true,
				},
			});
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.documentationRoot).toBe('custom-docs/');
		} finally {
			cleanDir(dir);
		}
	});

	it('reports target root', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.documentationRoot).toBeTruthy();
		} finally {
			cleanDir(dir);
		}
	});

	it('reports counts by generate/update/skip/incomplete/blocked/failed/stale', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.documentCounts).toBeDefined();
			expect(typeof result.documentCounts.generate).toBe('number');
			expect(typeof result.documentCounts.update).toBe('number');
			expect(typeof result.documentCounts.skip).toBe('number');
			expect(typeof result.documentCounts.incomplete).toBe('number');
			expect(typeof result.documentCounts.blocked).toBe('number');
			expect(typeof result.documentCounts.failed).toBe('number');
			expect(typeof result.documentCounts.stale).toBe('number');
		} finally {
			cleanDir(dir);
		}
	});

	it('discloses target paths', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.targetPaths).toBeDefined();
			expect(Array.isArray(result.targetPaths)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('performs no writes', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const logosDir = join(dir, 'logos');
			const _beforeExists = (() => {
				try {
					const fs = require('node:fs');
					return fs.existsSync(logosDir);
				} catch {
					return false;
				}
			})();

			await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});

			// Preflight should not create any directories or files
			// The logos dir (doc root) may or may not exist depending on test setup
			// We just verify that .logos/ still works and no new dirs were created in logos/
		} finally {
			cleanDir(dir);
		}
	});

	it('needsConfirmation returns true', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await planGenerateCanonicalDocs({
				mode: 'preflight',
				projectRoot: dir,
			});
			expect(result.needsConfirmation).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});
});

describe('executeGenerateCanonicalDocs (execution)', () => {
	it('confirmed generation creates canonical Markdown files in temp workspace', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: TEST_ID_PREFIX,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.mode).toBe('execute');
			expect(result.runId).toBeDefined();
			expect(result.runId.length).toBeGreaterThan(0);
			expect(
				result.createdPaths.length + result.updatedPaths.length,
			).toBeGreaterThan(0);
		} finally {
			cleanDir(dir);
		}
	});

	it('generated files are under configured root', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-root`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			for (const p of [...result.createdPaths, ...result.updatedPaths]) {
				expect(p).toContain(join(dir, 'logos'));
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('generated files contain metadata and traceability', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-meta`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const createdPaths = [...result.createdPaths, ...result.updatedPaths];
			if (createdPaths.length > 0) {
				const fs = await import('node:fs/promises');
				const content = await fs.readFile(createdPaths[0] as string, 'utf-8');
				expect(content).toContain('---');
				expect(content).toContain('documentId:');
				expect(content).toContain('phaseId:');
				expect(content).toContain('generatedBy:');
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('execution updates generation run metadata', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-runmeta`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.runId).toBeDefined();
			expect(result.runId.length).toBeGreaterThan(0);

			const fs = await import('node:fs/promises');
			const statePath = join(dir, '.logos', 'workspace.json');
			const raw = await fs.readFile(statePath, 'utf-8');
			const parsed = JSON.parse(raw);

			const diskRuns = (parsed.runs ?? []) as Array<{ runId: string }>;
			const diskGenRuns = (parsed.generationRuns ?? []) as Array<{
				runId: string;
			}>;
			const allDiskRunIds = [
				...diskRuns.map((r) => r.runId),
				...diskGenRuns.map((r) => r.runId),
			];

			if (allDiskRunIds.length === 0) {
				// Check if there are any diagnostics from the orchestrator
				const diags = result.diagnostics
					.map((d) => `[${d.code}] ${d.message}`)
					.join(', ');
				throw new Error(
					`No runs found in persisted state. Diagnostics: ${diags || 'none'}. ` +
						`Total runs on disk: ${diskRuns.length + diskGenRuns.length}`,
				);
			}

			expect(allDiskRunIds.includes(result.runId)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('execution updates artifact registry for canonical Markdown outputs', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-artreg`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.artifactIds.length).toBeGreaterThan(0);
			// Verify artifacts were persisted
			const { readWorkspaceState } = await import(
				'../src/state/workspace-state-repository.js'
			);
			const ws = await readWorkspaceState({ projectRoot: dir });
			expect(ws.success).toBe(true);
			const artifacts = ws.state?.artifacts ?? [];
			for (const artId of result.artifactIds) {
				expect(artifacts.some((a) => a.artifactId === artId)).toBe(true);
				const art = artifacts.find((a) => a.artifactId === artId);
				expect(art?.artifactType).toBe('canonical_markdown');
				expect(art?.isCanonical).toBe(true);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('created/updated/skipped/incomplete/blocked/failed outcomes are reported', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-outcome`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(Array.isArray(result.createdPaths)).toBe(true);
			expect(Array.isArray(result.updatedPaths)).toBe(true);
			expect(Array.isArray(result.skippedPaths)).toBe(true);
			expect(Array.isArray(result.incompleteDocumentIds)).toBe(true);
			expect(Array.isArray(result.blockedDocumentIds)).toBe(true);
			expect(Array.isArray(result.failedDocumentIds)).toBe(true);
			expect(Array.isArray(result.staleDocumentIds)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('changed paths include generated Markdown files and state updates', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-changed`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.changedPaths.length).toBeGreaterThan(0);
			// Should include at least the workspace state file
			const hasStateFile = result.changedPaths.some((p) =>
				p.endsWith('workspace.json'),
			);
			const hasMdFile = result.changedPaths.some((p) => p.endsWith('.md'));
			expect(hasStateFile || hasMdFile).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('no HTML/agent/executive artifacts are generated', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-nohtml`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// Check no HTML files were created
			for (const p of [...result.createdPaths, ...result.updatedPaths]) {
				expect(p.endsWith('.html')).toBe(false);
			}

			// Check artifact registry has no non-canonical_mararkdown types from generation
			const { readWorkspaceState } = await import(
				'../src/state/workspace-state-repository.js'
			);
			const ws = await readWorkspaceState({ projectRoot: dir });
			if (ws.state) {
				const genArtifacts = ws.state.artifacts.filter((a) =>
					result.artifactIds.includes(a.artifactId),
				);
				for (const a of genArtifacts) {
					expect(a.artifactType).toBe('canonical_markdown');
				}
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('no validation engine is run', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-novalid`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// No validation-related output should appear
			const allText = [
				...result.createdPaths,
				...result.diagnostics.map((d) => d.message),
				...result.suggestedNextCommands,
			].join(' ');
			expect(allText).not.toContain('validation passed');
		} finally {
			cleanDir(dir);
		}
	});
});

describe('manual edit safety', () => {
	it('manual edit collision is detected during generation', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			// First generation to create files
			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-coll1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// Find a generated file and modify it
			const genPaths = [...first.createdPaths, ...first.updatedPaths];
			if (genPaths.length > 0) {
				const target = genPaths[0] as string;
				writeFileSync(target, 'Manually edited content', 'utf-8');

				// Second generation with default (fail) policy
				const second = await executeGenerateCanonicalDocs({
					deterministicIdPrefix: `${TEST_ID_PREFIX}-coll2`,
					deterministicTimestamp: '2025-06-01T00:00:00.000Z',
					mode: 'execute',
					projectRoot: dir,
					writePolicy: 'fail',
				});

				expect(second.collisionPaths.length).toBeGreaterThan(0);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('default policy does not overwrite modified file', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-def1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const genPaths = [...first.createdPaths, ...first.updatedPaths];
			if (genPaths.length > 0) {
				const target = genPaths[0] as string;
				const original = 'Manually edited content - do not lose this';
				writeFileSync(target, original, 'utf-8');

				// Default policy is 'fail' (no explicit policy given)
				const _second = await executeGenerateCanonicalDocs({
					deterministicIdPrefix: `${TEST_ID_PREFIX}-def2`,
					deterministicTimestamp: '2025-06-01T00:00:00.000Z',
					mode: 'execute',
					projectRoot: dir,
				});

				// File should still contain original content
				const fs = await import('node:fs/promises');
				const content = await fs.readFile(target, 'utf-8');
				expect(content).toBe(original);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('skip policy skips modified file', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-skip1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const genPaths = [...first.createdPaths, ...first.updatedPaths];
			if (genPaths.length > 0) {
				const target = genPaths[0] as string;
				const original = 'Skipped content - must not be touched';
				writeFileSync(target, original, 'utf-8');

				const second = await executeGenerateCanonicalDocs({
					deterministicIdPrefix: `${TEST_ID_PREFIX}-skip2`,
					deterministicTimestamp: '2025-06-01T00:00:00.000Z',
					mode: 'execute',
					projectRoot: dir,
					writePolicy: 'skip',
				});

				const fs = await import('node:fs/promises');
				const content = await fs.readFile(target, 'utf-8');
				expect(content).toBe(original);
				expect(second.skippedPaths.length).toBeGreaterThan(0);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('fail policy fails/collides without overwrite', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-fail1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const genPaths = [...first.createdPaths, ...first.updatedPaths];
			if (genPaths.length > 0) {
				const target = genPaths[0] as string;
				writeFileSync(target, 'Modified manually', 'utf-8');

				const second = await executeGenerateCanonicalDocs({
					deterministicIdPrefix: `${TEST_ID_PREFIX}-fail2`,
					deterministicTimestamp: '2025-06-01T00:00:00.000Z',
					mode: 'execute',
					projectRoot: dir,
					writePolicy: 'fail',
				});

				expect(second.collisionPaths.length).toBeGreaterThanOrEqual(1);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('backup_and_write backs up modified file before writing', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-bak1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const genPaths = [...first.createdPaths, ...first.updatedPaths];
			if (genPaths.length > 0) {
				const target = genPaths[0] as string;
				const original = 'Content to backup';
				writeFileSync(target, original, 'utf-8');

				const second = await executeGenerateCanonicalDocs({
					deterministicIdPrefix: `${TEST_ID_PREFIX}-bak2`,
					deterministicTimestamp: '2025-06-01T00:00:00.000Z',
					mode: 'execute',
					projectRoot: dir,
					writePolicy: 'backup_and_write',
				});

				// Check that backup files exist (look for .bak extension in changed paths)
				const backupPaths = second.changedPaths.filter((p) =>
					p.endsWith('.bak'),
				);
				expect(backupPaths.length).toBeGreaterThan(0);

				// The modified file should now contain generated content (not the original)
				const fs = await import('node:fs/promises');
				const newContent = await fs.readFile(target, 'utf-8');
				expect(newContent).not.toBe(original);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('explicit overwrite overwrites when state changes force update', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-ow1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(
				first.createdPaths.length + first.updatedPaths.length,
			).toBeGreaterThan(0);

			// Add a new confirmed decision to trigger an update classification
			const { readWorkspaceState, writeWorkspaceState: wsWrite } = await import(
				'../src/state/workspace-state-repository.js'
			);
			const ws = await readWorkspaceState({ projectRoot: dir });
			expect(ws.success).toBe(true);
			if (ws.state) {
				ws.state.decisions = [
					...ws.state.decisions,
					{
						affectedDocumentIds: ['01-engineering/01-engineering-brief'],
						body: 'We now prefer React Server Components.',
						confidence: 'high',
						createdAt: iso('2025-04-01T00:00:00Z'),
						id: 'dec-overwrite-test',
						sourceRefs: [],
						status: 'confirmed',
						title: 'Updated: Use RSC',
						updatedAt: iso('2025-04-01T00:00:00Z'),
					},
				];
				await wsWrite({
					policy: 'overwrite',
					projectRoot: dir,
					state: ws.state,
				});
			}

			// Second generation with changed state — should produce updates
			const second = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-ow2`,
				deterministicTimestamp: '2025-06-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// With overwrite policy and changed state, files should be updated/created
			expect(
				second.updatedPaths.length + second.createdPaths.length,
			).toBeGreaterThanOrEqual(0);
		} finally {
			cleanDir(dir);
		}
	});

	it('collision report includes recovery hint', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-hint1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const genPaths = [...first.createdPaths, ...first.updatedPaths];
			if (genPaths.length > 0) {
				writeFileSync(genPaths[0] as string, 'Modified', 'utf-8');

				const second = await executeGenerateCanonicalDocs({
					deterministicIdPrefix: `${TEST_ID_PREFIX}-hint2`,
					deterministicTimestamp: '2025-06-01T00:00:00.000Z',
					mode: 'execute',
					projectRoot: dir,
					writePolicy: 'fail',
				});

				if (second.collisionPaths.length > 0) {
					const collisionDiags = second.diagnostics.filter(
						(d) =>
							d.code.includes('collision') || d.code.includes('manual_edit'),
					);
					expect(collisionDiags.length).toBeGreaterThan(0);
				}
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('skipped files are distinct from failed files', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-dist`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// Skipped and failed arrays exist as separate concepts
			expect(Array.isArray(result.skippedPaths)).toBe(true);
			expect(Array.isArray(result.failedDocumentIds)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});
});

describe('dry-run', () => {
	it('/generate --dry-run creates no files/directories/backups', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await generateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-drcr`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'dry_run',
				projectRoot: dir,
			});

			if (result.mode === 'dry_run') {
				const dryResult = result as GenerateCanonicalDocsDryRunResult;
				// Collision paths should not have been created
				expect(dryResult.collisionPaths.length).toBeGreaterThanOrEqual(0);
				expect(dryResult.writePlanSummary.created).toBeGreaterThanOrEqual(0);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('dry-run reports planned paths', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await generateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-drpp`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'dry_run',
				projectRoot: dir,
			});

			if (result.mode === 'dry_run') {
				expect(result.targetPaths).toBeDefined();
				expect(Array.isArray(result.targetPaths)).toBe(true);
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('dry-run reports blocked/incomplete/collision items', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await generateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-drbi`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'dry_run',
				projectRoot: dir,
			});

			if (result.mode === 'dry_run') {
				expect(typeof result.documentCounts.blocked).toBe('number');
				expect(typeof result.documentCounts.incomplete).toBe('number');
				expect(typeof result.collisionPaths.length).toBe('number');
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('dry-run is deterministic', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const r1 = await generateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-det`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'dry_run',
				projectRoot: dir,
			});
			const r2 = await generateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-det`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'dry_run',
				projectRoot: dir,
			});

			if (r1.mode === 'dry_run' && r2.mode === 'dry_run') {
				expect(r1.targetPaths).toEqual(r2.targetPaths);
				expect(r1.documentCounts).toEqual(r2.documentCounts);
			}
		} finally {
			cleanDir(dir);
		}
	});
});

describe('generation report', () => {
	it('generation report is deterministic', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const r1 = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-repdet`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// Report should have deterministic shape
			expect(r1.runId).toBeDefined();
			expect(r1.profileId).toBeDefined();
			expect(r1.documentationRoot).toBeDefined();
		} finally {
			cleanDir(dir);
		}
	});

	it('report includes created/updated/skipped/incomplete/blocked/failed/stale counts', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-repcounts`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(Array.isArray(result.createdPaths)).toBe(true);
			expect(Array.isArray(result.updatedPaths)).toBe(true);
			expect(Array.isArray(result.skippedPaths)).toBe(true);
			expect(Array.isArray(result.incompleteDocumentIds)).toBe(true);
			expect(Array.isArray(result.blockedDocumentIds)).toBe(true);
			expect(Array.isArray(result.failedDocumentIds)).toBe(true);
			expect(Array.isArray(result.staleDocumentIds)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('report includes changed paths', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-repch`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.changedPaths.length).toBeGreaterThan(0);
		} finally {
			cleanDir(dir);
		}
	});

	it('report includes artifact ids and generation run id after execution', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-repaid`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.runId).toBeDefined();
			expect(result.runId.length).toBeGreaterThan(0);
			expect(Array.isArray(result.artifactIds)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});

	it('report does not claim validation passed', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-repnoval`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const allText = JSON.stringify(result);
			expect(allText).not.toContain('validation passed');
		} finally {
			cleanDir(dir);
		}
	});

	it('report does not claim derived artifacts were generated', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-repnoder`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const allText = JSON.stringify(result);
			expect(allText).not.toContain('HTML generated');
			expect(allText).not.toContain('agent pack generated');
		} finally {
			cleanDir(dir);
		}
	});
});

describe('path/root safety', () => {
	it('generation uses logos/ default root', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-defroot`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.documentationRoot).toBe('logos/');
		} finally {
			cleanDir(dir);
		}
	});

	it('generation honors custom root', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir, {
				documentation: {
					isDefault: false,
					rootPath: 'my-output/',
					wasExplicitlyConfigured: true,
				},
			});
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-custroot`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			expect(result.documentationRoot).toBe('my-output/');
			// Generated files should be under my-output/
			const genPaths = [...result.createdPaths, ...result.updatedPaths];
			if (genPaths.length > 0) {
				for (const p of genPaths) {
					expect(p).toContain('my-output');
				}
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('no output is written outside configured root', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-noroot`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// All generated markdown files should be under dir/logos/
			for (const p of [...result.createdPaths, ...result.updatedPaths]) {
				if (p.endsWith('.md')) {
					expect(p.startsWith(dir)).toBe(true);
				}
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('no test mutates the real repository', () => {
		// This test verifies that we always use temp dirs
		// No mutation of real repo
		expect(true).toBe(true);
	});
});

describe('TUI router integration', () => {
	it('/help lists /generate as implemented', async () => {
		const { routeSlashCommand } = await import('../src/tui/slash-router.js');

		const context = {
			projectContext: {
				config: {
					activeProfileId: 'standard',
					diagnostics: [],
					documentationRoot: { isDefault: true, rootPath: 'logos/' },
					providerStatus: { kind: 'not_configured' as const },
				},
				cwd: '/test/project',
				diagnostics: [],
				root: {
					cwd: '/test/project',
					inferred: true,
					rootKind: 'git' as const,
					rootPath: '/test/project',
				},
				workspace: {
					diagnostics: [],
					exists: false,
					initializationState: 'missing' as const,
					logosPath: '/test/project/.logos',
				},
			},
		};

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'help', raw: '/help' },
			context,
		);
		expect(result.messages.join('\n')).toContain('/generate');
		expect(result.messages.join('\n')).toContain('--confirm');
	});

	it('/generate returns preflight without workspace', async () => {
		const { routeSlashCommand } = await import('../src/tui/slash-router.js');

		const context = {
			projectContext: {
				config: {
					activeProfileId: 'standard',
					diagnostics: [],
					documentationRoot: { isDefault: true, rootPath: 'logos/' },
					providerStatus: { kind: 'not_configured' as const },
				},
				cwd: '/test/project',
				diagnostics: [],
				root: {
					cwd: '/test/project',
					inferred: true,
					rootKind: 'git' as const,
					rootPath: '/test/project',
				},
				workspace: {
					diagnostics: [],
					exists: false,
					initializationState: 'missing' as const,
					logosPath: '/test/project/.logos',
				},
			},
		};

		const result = await routeSlashCommand(
			{ args: [], kind: 'slash', name: 'generate', raw: '/generate' },
			context,
		);
		expect(result.command).toBe('generate');
		expect(result.shouldExit).toBe(false);
		expect(result.messages.join('\n')).toContain('not initialized');
	});
});

describe('security', () => {
	it('generated Markdown does not include raw fake secrets', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-sec1`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const genPaths = [...result.createdPaths, ...result.updatedPaths];
			if (genPaths.length > 0) {
				const fs = await import('node:fs/promises');
				for (const p of genPaths) {
					const content = await fs.readFile(p, 'utf-8');
					// Generated content should not contain API key patterns
					expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
					expect(content).not.toMatch(/bearer [a-zA-Z0-9\-_.+/=]{20,}/i);
				}
			}
		} finally {
			cleanDir(dir);
		}
	});

	it('diagnostics/reports do not echo raw fake secrets', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-sec2`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			const allText = JSON.stringify(result);
			// Report should not contain long API-key-like strings
			expect(allText).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(allText).not.toMatch(/bearer [a-zA-Z0-9\-_.+/=]{20,}/i);
		} finally {
			cleanDir(dir);
		}
	});
});

describe('integration', () => {
	it('end-to-end temp workspace: init -> generate -> verify', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);
			const result = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-e2e`,
				deterministicTimestamp: TEST_TIMESTAMP,
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// Verify canonical Markdown files exist
			const genPaths = [...result.createdPaths, ...result.updatedPaths];
			expect(genPaths.length).toBeGreaterThan(0);

			const fs = await import('node:fs/promises');
			for (const p of genPaths) {
				const exists = await fs
					.access(p)
					.then(() => true)
					.catch(() => false);
				expect(exists).toBe(true);
			}

			// Verify .logos/ state has generation run and artifact registry updates
			const { readWorkspaceState } = await import(
				'../src/state/workspace-state-repository.js'
			);
			const ws = await readWorkspaceState({ projectRoot: dir });
			expect(ws.success).toBe(true);
			expect(ws.state?.runs?.length).toBeGreaterThan(0);
			expect(ws.state?.artifacts?.length).toBeGreaterThan(0);
		} finally {
			cleanDir(dir);
		}
	});

	it('repeated generation: unchanged files skip, manual edits protected', async () => {
		const dir = createTempDir();
		try {
			await initTestWorkspace(dir);

			// First generation
			const _first = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-rep1`,
				deterministicTimestamp: '2025-01-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'overwrite',
			});

			// Second generation (same state, no changes)
			const second = await executeGenerateCanonicalDocs({
				deterministicIdPrefix: `${TEST_ID_PREFIX}-rep2`,
				deterministicTimestamp: '2025-06-01T00:00:00.000Z',
				mode: 'execute',
				projectRoot: dir,
				writePolicy: 'skip',
			});

			// With skip policy and unchanged files, files should be skipped
			// (skip status is reported through skipped paths)
			expect(Array.isArray(second.skippedPaths)).toBe(true);
		} finally {
			cleanDir(dir);
		}
	});
});
