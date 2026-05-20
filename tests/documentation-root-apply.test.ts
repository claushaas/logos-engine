/**
 * Documentation Root Apply tests.
 *
 * Phase 6: Documentation Root Configuration — Apply tests.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyDocumentationRootChange } from '../src/workspace/documentation-root-apply.js';

describe('documentation root apply', () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			try {
				const { rm } = await import('node:fs/promises');
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// cleanup failure is ok
			}
		}
	});

	async function setupTempProject(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), 'logos-root-apply-test-'));
		tempDir = dir;
		return dir;
	}

	async function createMinimalWorkspace(projectRoot: string): Promise<void> {
		const logosDir = join(projectRoot, '.logos');
		await mkdir(logosDir, { recursive: true });
		const state = {
			artifacts: [],
			assumptions: [],
			auditEvents: [],
			claimSourceLinks: [],
			claims: [],
			decisions: [],
			documentation: {
				isDefault: true,
				rootPath: 'logos/',
				wasExplicitlyConfigured: false,
			},
			generationRuns: [],
			intakeTurns: [],
			migrations: [],
			openQuestions: [],
			profile: {
				profileId: 'standard',
				source: 'bundled',
			},
			proposals: [],
			risks: [],
			runs: [],
			schemaVersion: '3.2.0',
			sessions: [],
			sources: [],
			validationRuns: [],
			workspace: {
				createdAt: new Date().toISOString(),
				initializationState: 'initialized',
				projectRootPath: projectRoot,
				updatedAt: new Date().toISOString(),
				workspaceId: 'test-workspace-id',
			},
		};
		await writeFile(
			join(logosDir, 'workspace.json'),
			JSON.stringify(state, null, 2),
		);
	}

	it('dry-run writes nothing to state', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		const result = await applyDocumentationRootChange({
			confirmed: true,
			dryRun: true,
			projectRoot,
			proposedPath: 'my-docs',
		});

		expect(result.applied).toBe(false);
		expect(result.dryRun).toBe(true);
		expect(result.changedPaths).toHaveLength(0);
	});

	it('blocked preview writes nothing', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		const result = await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: '.git',
		});

		expect(result.applied).toBe(false);
	});

	it('unconfirmed mutation writes nothing', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		const result = await applyDocumentationRootChange({
			confirmed: false,
			dryRun: false,
			projectRoot,
			proposedPath: 'my-docs',
		});

		expect(result.applied).toBe(false);
		expect(
			result.messages.some((m) => m.includes('Confirmation required')),
		).toBe(true);
	});

	it('confirmed safe root updates workspace state', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		const result = await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: 'my-docs',
		});

		expect(result.applied).toBe(true);
		expect(result.changedPaths.length).toBeGreaterThan(0);
		expect(result.messages.some((m) => m.includes('my-docs'))).toBe(true);

		// Verify state file was actually updated
		const { readFileSync } = await import('node:fs');
		const stateRaw = readFileSync(
			join(projectRoot, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(stateRaw);
		expect(state.documentation.rootPath).toBe('my-docs');
		expect(state.documentation.isDefault).toBe(false);
		expect(state.documentation.wasExplicitlyConfigured).toBe(true);
	});

	it('confirmed reset returns to logos/', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		// First change to custom
		await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: 'custom-docs',
		});

		// Then reset
		const result = await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: 'logos/',
		});

		expect(result.applied).toBe(true);

		const { readFileSync } = await import('node:fs');
		const stateRaw = readFileSync(
			join(projectRoot, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(stateRaw);
		expect(state.documentation.rootPath).toBe('logos');
	});

	it('state write changes only workspace state', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		const result = await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: 'changed-root',
		});

		// Changed paths should only be the workspace state file
		expect(result.changedPaths.every((p) => p.endsWith('workspace.json'))).toBe(
			true,
		);
	});

	it('no canonical Markdown files are mutated', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);
		await mkdir(join(projectRoot, 'logos'), { recursive: true });
		await writeFile(
			join(projectRoot, 'logos', 'test.md'),
			'# Original content',
		);

		await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: 'my-docs',
		});

		// Old logos/ directory and its files should remain untouched
		const { readFileSync, existsSync } = await import('node:fs');
		expect(existsSync(join(projectRoot, 'logos', 'test.md'))).toBe(true);
		expect(readFileSync(join(projectRoot, 'logos', 'test.md'), 'utf-8')).toBe(
			'# Original content',
		);
	});

	it('cancel writes nothing', async () => {
		const projectRoot = await setupTempProject();
		await createMinimalWorkspace(projectRoot);

		const result = await applyDocumentationRootChange({
			confirmed: false,
			dryRun: false,
			projectRoot,
			proposedPath: 'cancel-test',
		});

		expect(result.applied).toBe(false);

		// State should be unchanged
		const { readFileSync } = await import('node:fs');
		const stateRaw = readFileSync(
			join(projectRoot, '.logos', 'workspace.json'),
			'utf-8',
		);
		const state = JSON.parse(stateRaw);
		expect(state.documentation.rootPath).toBe('logos/');
	});

	it('workspace not initialized returns error', async () => {
		const projectRoot = await setupTempProject();
		// Don't create workspace

		const result = await applyDocumentationRootChange({
			confirmed: true,
			dryRun: false,
			projectRoot,
			proposedPath: 'docs',
		});

		expect(result.applied).toBe(false);
		expect(result.messages.some((m) => m.includes('not initialized'))).toBe(
			true,
		);
	});
});
