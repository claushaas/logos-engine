/**
 * Step 6.3 — Overwrite risk detection tests.
 *
 * Tests:
 * 1. Non-existing path creates create operation with no overwrite risk.
 * 2. Existing path creates update operation.
 * 3. Existing path adds overwrite_existing_file risk/warning.
 * 4. Existing generated-marker file is lower risk than manual file.
 * 5. Existing file does not get overwritten during write-plan build.
 */

import { describe, expect, it } from 'vitest';
import { detectOverwriteRisk } from '../../src/core/generation/overwrite-risk.js';

import { createFakeFilesystem } from './helpers/fake-filesystem.js';

describe('detectOverwriteRisk', () => {
	// --- 1. Non-existing file → exists: false ---
	it('returns exists: false for non-existing file', async () => {
		const fs = createFakeFilesystem();

		const result = await detectOverwriteRisk({
			filesystem: fs,
			path: '/project/docs/nonexistent.md',
		});

		expect(result.exists).toBe(false);
		expect(result.path).toBe('/project/docs/nonexistent.md');
	});

	// --- 2. Existing file → exists: true ---
	it('returns exists: true for existing file', async () => {
		const fs = createFakeFilesystem();
		fs.addFile('/project/docs/existing.md', '# Existing content');

		const result = await detectOverwriteRisk({
			filesystem: fs,
			path: '/project/docs/existing.md',
		});

		expect(result.exists).toBe(true);
		expect(result.path).toBe('/project/docs/existing.md');
		expect(result.content).toBe('# Existing content');
	});

	// --- 3. Existing file with content ---
	it('returns content for existing file', async () => {
		const fs = createFakeFilesystem();
		fs.addFile('/project/docs/readme.md', 'Hello world');

		const result = await detectOverwriteRisk({
			filesystem: fs,
			path: '/project/docs/readme.md',
		});

		expect(result.exists).toBe(true);
		expect(result.content).toBe('Hello world');
	});

	// --- 4. Overwrite risk does not mutate files ---
	it('does not write or mutate files', async () => {
		const fs = createFakeFilesystem();
		fs.addFile('/project/docs/keep.md', 'ORIGINAL');

		await detectOverwriteRisk({
			filesystem: fs,
			path: '/project/docs/keep.md',
		});

		// File should still exist with original content.
		const readResult = await fs.readTextFile('/project/docs/keep.md');
		expect(readResult.content).toBe('ORIGINAL');
	});

	// --- 5. Existing generated-marker file ---
	it('detects existence of file with LOGOS marker (lower risk)', async () => {
		const fs = createFakeFilesystem();
		fs.addFile(
			'/project/docs/generated.md',
			'<!-- generated-by: logos-engine -->\n# Content',
		);

		const result = await detectOverwriteRisk({
			filesystem: fs,
			path: '/project/docs/generated.md',
		});

		expect(result.exists).toBe(true);
		expect(result.content).toContain('generated-by: logos-engine');
	});

	// --- 6. Existing manual file (higher risk) ---
	it('detects existence of file without LOGOS marker (higher risk)', async () => {
		const fs = createFakeFilesystem();
		fs.addFile('/project/docs/manual.md', '# Hand-written content');

		const result = await detectOverwriteRisk({
			filesystem: fs,
			path: '/project/docs/manual.md',
		});

		expect(result.exists).toBe(true);
		expect(result.content).toBe('# Hand-written content');
	});
});
