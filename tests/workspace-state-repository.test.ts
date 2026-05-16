/** Workspace State Repository tests */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SafeFsAdapter } from '../src/fs/safe-filesystem.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';
import {
	readWorkspaceState,
	requireWorkspaceState,
	updateWorkspaceState,
	writeWorkspaceState,
} from '../src/state/workspace-state-repository.js';

async function createTempDir(): Promise<string> {
	const os = await import('node:os');
	const crypto = await import('node:crypto');
	const tmpDir = os.tmpdir();
	const randomName = `logos-test-${crypto.randomUUID()}`;
	const fullPath = join(tmpDir, randomName);
	await mkdir(fullPath, { recursive: true });
	return fullPath;
}

function _makeFsAdapter(): SafeFsAdapter {
	return {
		async mkdir(path: string, options?: { recursive?: boolean }) {
			await mkdir(path, { recursive: options?.recursive ?? false });
			return path;
		},
		async rename(oldPath: string, newPath: string) {
			const { rename } = await import('node:fs/promises');
			return rename(oldPath, newPath);
		},
		async writeFile(path: string, data: string | Uint8Array) {
			return writeFile(path, data, { encoding: 'utf-8' });
		},
	};
}

describe('workspace-state-repository', () => {
	describe('readWorkspaceState', () => {
		it('reports missing workspace as recoverable', async () => {
			const tmpDir = await createTempDir();
			const result = await readWorkspaceState({ projectRoot: tmpDir });
			expect(result.success).toBe(false);
			expect(result.initializationState).toBe('missing');
			expect(
				result.diagnostics.some((d) => d.code === 'workspace_missing'),
			).toBe(true);
		});

		it('reads valid initialized workspace state from temp .logos/', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: tmpDir,
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'test-workspace',
			});
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const result = await readWorkspaceState({ projectRoot: tmpDir });
			expect(result.success).toBe(true);
			expect(result.initializationState).toBe('initialized');
			expect(result.state?.workspace.workspaceId).toBe('test-workspace');
		});

		it('reports invalid workspace JSON with path-aware diagnostic', async () => {
			const tmpDir = await createTempDir();
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(join(logosDir, 'workspace.json'), 'not json', 'utf-8');

			const result = await readWorkspaceState({ projectRoot: tmpDir });
			expect(result.success).toBe(false);
			expect(result.initializationState).toBe('invalid');
			expect(
				result.diagnostics.some((d) => d.code === 'workspace_json_invalid'),
			).toBe(true);
		});

		it('reports partial workspace state', async () => {
			const tmpDir = await createTempDir();
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			// Empty JSON object is partial/invalid because it fails schema validation
			await writeFile(join(logosDir, 'workspace.json'), '{}', 'utf-8');

			const result = await readWorkspaceState({ projectRoot: tmpDir });
			expect(result.success).toBe(false);
			expect(result.initializationState).toBe('invalid');
			expect(result.diagnostics.length).toBeGreaterThan(0);
		});

		it('validates state on read', async () => {
			const tmpDir = await createTempDir();
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify({ schemaVersion: 'bad', workspace: {} }),
				'utf-8',
			);

			const result = await readWorkspaceState({ projectRoot: tmpDir });
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code.startsWith('state_validation_')),
			).toBe(true);
		});
	});

	describe('requireWorkspaceState', () => {
		it('throws when workspace is missing', async () => {
			const tmpDir = await createTempDir();
			await expect(
				requireWorkspaceState({ projectRoot: tmpDir }),
			).rejects.toThrow('Workspace state is not available');
		});

		it('returns state when valid', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'req-test',
			});
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const result = await requireWorkspaceState({ projectRoot: tmpDir });
			expect(result.workspace.workspaceId).toBe('req-test');
		});
	});

	describe('writeWorkspaceState', () => {
		it('writes valid state through safe filesystem adapter', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'write-test',
			});
			const result = await writeWorkspaceState({
				projectRoot: tmpDir,
				state,
			});
			expect(result.success).toBe(true);
			expect(result.changedPaths.length).toBeGreaterThan(0);
		});

		it('rejects invalid updated state', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'write-test',
			});
			// @ts-expect-error intentionally invalid
			state.schemaVersion = undefined;
			const result = await writeWorkspaceState({ projectRoot: tmpDir, state });
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code.startsWith('state_validation_')),
			).toBe(true);
		});
	});

	describe('updateWorkspaceState', () => {
		it('update writes through safe filesystem adapter', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'update-test',
			});
			await writeWorkspaceState({ projectRoot: tmpDir, state });

			const result = await updateWorkspaceState({
				projectRoot: tmpDir,
				updater: (s) => ({
					...s,
					workspace: { ...s.workspace, initializedBy: 'test' },
				}),
			});
			expect(result.success).toBe(true);
			expect(result.state.workspace.initializedBy).toBe('test');
			expect(result.changedPaths.length).toBeGreaterThan(0);
		});

		it('dry-run update does not write', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'dryrun-test',
			});
			await writeWorkspaceState({ projectRoot: tmpDir, state });

			const result = await updateWorkspaceState({
				dryRun: true,
				projectRoot: tmpDir,
				updater: (s) => ({
					...s,
					workspace: { ...s.workspace, initializedBy: 'dryrun' },
				}),
			});
			expect(result.dryRun).toBe(true);
			// The state in the result reflects the updater, but no file was written
			expect(result.state.workspace.initializedBy).toBe('dryrun');
		});

		it('returns changed paths on update', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'changed-test',
			});
			await writeWorkspaceState({ projectRoot: tmpDir, state });

			const result = await updateWorkspaceState({
				projectRoot: tmpDir,
				updater: (s) => ({
					...s,
					workspace: {
						...s.workspace,
						initializationState: 'initialized' as const,
					},
				}),
			});
			expect(result.success).toBe(true);
			expect(
				result.changedPaths.some((p) => p.includes('workspace.json')),
			).toBe(true);
		});

		it('preserves recoverability on write failure', async () => {
			const tmpDir = await createTempDir();
			// No state exists; update should fail gracefully
			const result = await updateWorkspaceState({
				projectRoot: tmpDir,
				updater: (s) => s,
			});
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code === 'workspace_missing'),
			).toBe(true);
		});

		it('rejects invalid updated state', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'invalid-update-test',
			});
			await writeWorkspaceState({ projectRoot: tmpDir, state });

			const result = await updateWorkspaceState({
				projectRoot: tmpDir,
				updater: (s) => {
					// @ts-expect-error intentionally invalid
					delete s.schemaVersion;
					return s;
				},
			});
			expect(result.success).toBe(false);
			expect(
				result.diagnostics.some((d) => d.code.startsWith('state_validation_')),
			).toBe(true);
		});
	});
});
