/**
 * Documentation Root Preview tests.
 *
 * Phase 6: Documentation Root Configuration — Preview tests.
 */

import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { previewDocumentationRootChange } from '../src/workspace/documentation-root-preview.js';

describe('documentation root preview', () => {
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
		const dir = await mkdtemp(join(tmpdir(), 'logos-root-preview-test-'));
		tempDir = dir;
		return dir;
	}

	it('preview writes nothing', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'my-docs',
		});

		expect(preview.dryRun).toBe(true);
		expect(preview.current.normalizedRelativePath).toBe('logos');
		expect(preview.proposed.normalizedRelativePath).toBe('my-docs');
		expect(preview.confirmationRequired).toBe(true);
	});

	it('preview shows current and proposed root', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'custom-docs',
		});

		expect(preview.current.kind).toBe('default');
		expect(preview.current.normalizedRelativePath).toBe('logos');
		expect(preview.proposed.kind).toBe('custom');
		expect(preview.proposed.normalizedRelativePath).toBe('custom-docs');
	});

	it('preview shows default/custom state', async () => {
		const projectRoot = await setupTempProject();

		const previewDefault = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'docs',
		});
		expect(previewDefault.current.kind).toBe('default');

		const previewCustom = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: false,
				rootPath: 'output',
				wasExplicitlyConfigured: true,
			},
			projectRoot,
			proposedPath: 'new-output',
		});
		expect(previewCustom.current.kind).toBe('custom');
	});

	it('preview shows inside-project status', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'docs',
		});

		expect(preview.proposed.insideProjectRoot).toBe(true);
	});

	it('preview shows existing/missing status', async () => {
		const projectRoot = await setupTempProject();

		// Missing directory
		const previewMissing = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'nonexistent',
		});
		expect(previewMissing.proposed.exists).toBe(false);
		expect(previewMissing.proposed.isEmpty).toBe(true);

		// Existing empty directory
		const emptyDir = join(projectRoot, 'empty-dir');
		await mkdir(emptyDir, { recursive: true });

		const previewEmpty = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'empty-dir',
		});
		expect(previewEmpty.proposed.exists).toBe(true);
		expect(previewEmpty.proposed.isEmpty).toBe(true);
	});

	it('preview reports collision list', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'populated');
		await mkdir(targetDir, { recursive: true });
		const { writeFile } = await import('node:fs/promises');
		await writeFile(join(targetDir, 'README.md'), '# Readme');

		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'populated',
		});

		expect(preview.collisions.length).toBeGreaterThan(0);
	});

	it('preview reports affected outputs (none when no artifacts)', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'docs',
		});

		expect(preview.affectedOutputs.canonicalOutputs).toHaveLength(0);
		expect(preview.affectedOutputs.staleCount).toBe(0);
	});

	it('preview reports affected outputs when artifacts provided', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			artifacts: [
				{
					artifactId: 'doc-1',
					artifactType: 'canonical_markdown',
					isCanonical: true,
					path: '/home/user/my-project/logos/01-foundation/test.md',
					status: 'generated',
				},
			],
			canonicalOutputDeclarations: [],
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'docs',
		});

		expect(preview.affectedOutputs.canonicalOutputs.length).toBeGreaterThan(0);
	});

	it('preview requires confirmation for mutation', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'custom-root',
		});

		expect(preview.confirmationRequired).toBe(true);
	});

	it('preview avoids unsafe absolute path in display', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'docs',
		});

		// safeDisplayPath should be a relative path, not an absolute one
		expect(preview.proposed.safeDisplayPath).not.toContain(projectRoot);
		expect(preview.current.safeDisplayPath).not.toContain(projectRoot);
	});

	it('preview is JSON-serializable', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: 'docs',
		});

		const json = JSON.stringify(preview);
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it('preview for unsafe path shows safety errors', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: '.git',
		});

		expect(preview.safety.safe).toBe(false);
		expect(preview.health).toBe('unsafe');
	});

	it('preview for out-of-project path reports error', async () => {
		const projectRoot = await setupTempProject();
		const preview = await previewDocumentationRootChange({
			currentRootConfig: {
				isDefault: true,
				rootPath: 'logos/',
			},
			projectRoot,
			proposedPath: '../outside',
		});

		expect(preview.safety.safe).toBe(false);
	});
});
