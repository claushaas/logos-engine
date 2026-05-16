/** Workspace status summary tests */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerArtifact } from '../src/state/artifact-registry.js';
import { createRunRecord } from '../src/state/run-repository.js';
import { createSessionRecord } from '../src/state/session-repository.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';
import { getWorkspaceStatusSummary } from '../src/state/workspace-status.js';

async function createTempDir(): Promise<string> {
	const os = await import('node:os');
	const crypto = await import('node:crypto');
	const tmpDir = os.tmpdir();
	const randomName = `logos-test-${crypto.randomUUID()}`;
	const fullPath = join(tmpDir, randomName);
	await mkdir(fullPath, { recursive: true });
	return fullPath;
}

describe('workspace-status', () => {
	describe('getWorkspaceStatusSummary', () => {
		it('before init, status reports missing initialization as recoverable', async () => {
			const tmpDir = await createTempDir();
			const summary = await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			expect(summary.initializationState).toBe('missing');
			expect(
				summary.diagnostics.some((d) => d.code === 'workspace_missing'),
			).toBe(true);
		});

		it('after init, status reports workspace/root/profile', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'status-test',
			});
			state.workspace.initializationState = 'initialized';
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const summary = await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			expect(summary.initializationState).toBe('initialized');
			expect(summary.projectRoot).toBe(tmpDir);
			expect(summary.activeProfileId).toBe('standard');
			expect(summary.documentationRoot).toBe('logos/');
		});

		it('status reports sessions summary', async () => {
			const tmpDir = await createTempDir();
			let state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'status-test',
			});
			state = createSessionRecord({
				input: { sessionType: 'intake', status: 'open' },
				state,
			}).state;
			state = createSessionRecord({
				input: { sessionType: 'manual', status: 'completed' },
				state,
			}).state;
			state.workspace.initializationState = 'initialized';

			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const summary = await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			expect(summary.sessionSummary.totalSessions).toBe(2);
			expect(summary.sessionSummary.activeSessions).toBe(1);
		});

		it('status reports runs summary', async () => {
			const tmpDir = await createTempDir();
			let state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'status-test',
			});
			state = createRunRecord({
				input: { runType: 'validation' },
				state,
			}).state;
			state = createRunRecord({
				input: { runType: 'diagnostic' },
				state,
			}).state;
			state = createRunRecord({
				input: { runType: 'generation' },
				state,
			}).state;
			state.workspace.initializationState = 'initialized';

			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const summary = await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			expect(summary.runSummary.totalRuns).toBe(3);
			expect(summary.runSummary.totalValidationRuns).toBe(1);
			expect(summary.runSummary.totalDiagnosticRuns).toBe(1);
			expect(summary.runSummary.totalGenerationRuns).toBe(1);
		});

		it('status reports artifact summary', async () => {
			const tmpDir = await createTempDir();
			let state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'status-test',
			});
			state = registerArtifact({
				input: { artifactType: 'canonical_markdown', path: 'a.md' },
				state,
			}).state;
			state = registerArtifact({
				input: { artifactType: 'html', path: 'b.html' },
				state,
			}).state;
			state.workspace.initializationState = 'initialized';

			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const summary = await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			expect(summary.artifactSummary.totalArtifacts).toBe(2);
			expect(summary.artifactSummary.canonicalCount).toBe(1);
			expect(summary.artifactSummary.nonCanonicalCount).toBe(1);
		});

		it('status does not mutate files', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'status-test',
			});
			state.workspace.initializationState = 'initialized';
			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			const path = join(logosDir, 'workspace.json');
			await writeFile(path, JSON.stringify(state, null, 2), 'utf-8');

			const before = await import('node:fs/promises').then((m) =>
				m.readFile(path, 'utf-8'),
			);
			await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			const after = await import('node:fs/promises').then((m) =>
				m.readFile(path, 'utf-8'),
			);
			expect(after).toBe(before);
		});

		it('status does not expose secrets', async () => {
			const tmpDir = await createTempDir();
			const state = createDefaultWorkspaceState({
				projectRootPath: tmpDir,
				workspaceId: 'status-test',
			});
			state.workspace.initializationState = 'initialized';
			state.provider = {
				enabled: true,
				providerId: 'openai',
				tokenEnvVarName: 'OPENAI_API_KEY',
			};

			const logosDir = join(tmpDir, '.logos');
			await mkdir(logosDir, { recursive: true });
			await writeFile(
				join(logosDir, 'workspace.json'),
				JSON.stringify(state, null, 2),
				'utf-8',
			);

			const summary = await getWorkspaceStatusSummary({ projectRoot: tmpDir });
			// Summary should not include provider details
			expect(
				summary.diagnostics.some((d) => d.message.includes('OPENAI_API_KEY')),
			).toBe(false);
		});
	});
});
