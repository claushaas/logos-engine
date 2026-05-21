/**
 * Documentation Root Collision Scanner tests.
 *
 * Phase 6: Documentation Root Configuration — Collision scanner tests.
 */

import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanForCollisions } from '../src/workspace/documentation-root-collision.js';

describe('documentation root collision scanner', () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			try {
				const { rm } = await import('node:fs/promises');
				await rm(tempDir, { force: true, recursive: true });
			} catch {
				// cleanup failure is ok in test
			}
		}
	});

	async function setupTempProject(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), 'logos-root-collision-test-'));
		tempDir = dir;
		return dir;
	}

	it('empty target root has no collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'my-docs');
		await mkdir(targetDir, { recursive: true });

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(result.directoryExists).toBe(true);
		expect(result.directoryEmpty).toBe(true);
		expect(result.collisions).toHaveLength(0);
		expect(result.containsNonLogosFiles).toBe(false);
	});

	it('non-empty target root reports collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'my-docs');
		await mkdir(targetDir, { recursive: true });
		await writeFile(join(targetDir, 'README.md'), '# My Docs');

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(result.directoryEmpty).toBe(false);
		expect(result.containsNonLogosFiles).toBe(true);
		expect(result.collisions.length).toBeGreaterThan(0);
	});

	it('non-LOGOS file reports collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'my-docs');
		await mkdir(targetDir, { recursive: true });
		await writeFile(join(targetDir, 'notes.txt'), 'some notes');

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(result.containsNonLogosFiles).toBe(true);
		expect(result.collisions.some((c) => c.kind === 'non_logos_files')).toBe(
			true,
		);
	});

	it('existing LOGOS output reports collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'my-docs');
		await mkdir(targetDir, { recursive: true });
		await writeFile(join(targetDir, 'LOGOS_test.md'), '# Logos doc');

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(result.containsLogosFiles).toBe(true);
		expect(
			result.collisions.some((c) => c.kind === 'existing_logos_outputs'),
		).toBe(true);
	});

	it('parent/child overlap with current root reports collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'logos');
		await mkdir(targetDir, { recursive: true });

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(
			result.collisions.some((c) => c.kind === 'current_root_overlap'),
		).toBe(true);
	});

	it('.logos overlap reports collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, '.logos');
		await mkdir(targetDir, { recursive: true });

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(
			result.collisions.some((c) => c.kind === 'workspace_state_overlap'),
		).toBe(true);
	});

	it('.env contents are not read', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'my-docs');
		await mkdir(targetDir, { recursive: true });
		await writeFile(join(targetDir, '.env'), 'SECRET=abc123');

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		// .env is skipped, so directory should appear empty
		expect(result.directoryEmpty).toBe(true);
	});

	it('nonexistent directory shows no collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'does-not-exist');

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(result.directoryExists).toBe(false);
		expect(result.directoryEmpty).toBe(true);
		expect(result.collisions).toHaveLength(0);
	});

	it('profile root overlap reports collision', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'custom-profiles', 'my-profile');
		await mkdir(targetDir, { recursive: true });

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			activeProfileRoot: 'custom-profiles/my-profile',
			currentDocumentationRoot: 'logos',
		});

		expect(
			result.collisions.some((c) => c.kind === 'profile_root_overlap'),
		).toBe(true);
	});

	it('symlink escape is detected', async () => {
		const projectRoot = await setupTempProject();
		const targetDir = join(projectRoot, 'docs-link');

		// Create a symlink that points outside the project
		try {
			await symlink('/tmp', targetDir, 'dir');
		} catch {
			// Symlink creation may fail on some platforms
			return;
		}

		const result = await scanForCollisions({
			absoluteProjectRoot: projectRoot,
			absoluteTargetPath: targetDir,
			currentDocumentationRoot: 'logos',
		});

		expect(result.collisions.some((c) => c.kind === 'symlink_escape')).toBe(
			true,
		);
	});
});
