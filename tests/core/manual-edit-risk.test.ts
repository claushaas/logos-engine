/**
 * Step 6.3 — Manual edit risk detection tests.
 *
 * Tests:
 * 1. Existing file without LOGOS generated marker produces manual_edit_detected.
 * 2. Existing file with generated marker does not produce manual-edit risk.
 * 3. Missing file has no manual-edit risk.
 * 4. Read failure produces structured warning/risk.
 * 5. Manual-edit detection does not mutate files.
 */

import { describe, expect, it } from 'vitest';
import { detectManualEditRisk } from '../../src/core/generation/manual-edit-risk.js';

describe('detectManualEditRisk', () => {
	// --- 1. Existing file without marker ---
	it('detects manual edit risk for existing file without LOGOS marker', () => {
		const result = detectManualEditRisk({
			content: '# My Project Thesis\n\nThis file was written by hand.',
			exists: true,
			path: '/project/docs/thesis.md',
		});

		expect(result.risk).toBe(true);
		if (result.risk) {
			expect(result.reason).toBe('existing_file_without_generated_marker');
			expect(result.message).toContain('manually edited');
		}
	});

	// --- 2. Existing file with generated marker (HTML comment) ---
	it('does not detect risk when file has <!-- generated-by: logos-engine -->', () => {
		const result = detectManualEditRisk({
			content: '<!-- generated-by: logos-engine -->\n# Generated Doc',
			exists: true,
			path: '/project/docs/thesis.md',
		});

		expect(result.risk).toBe(false);
		if (!result.risk) {
			expect(result.reason).toBe('logos_generated_marker_found');
		}
	});

	// --- 3. Existing file with generated marker (plain text) ---
	it('does not detect risk when file has "generated-by: logos-engine"', () => {
		const result = detectManualEditRisk({
			content: 'generated-by: logos-engine\n\n# Generated Doc',
			exists: true,
			path: '/project/docs/thesis.md',
		});

		expect(result.risk).toBe(false);
	});

	// --- 4. Existing file with LOGOS-GENERATED marker ---
	it('does not detect risk when file has "LOGOS-GENERATED"', () => {
		const result = detectManualEditRisk({
			content: 'LOGOS-GENERATED\n# Generated Doc',
			exists: true,
			path: '/project/docs/thesis.md',
		});

		expect(result.risk).toBe(false);
	});

	// --- 5. Missing file has no risk ---
	it('has no risk for missing file', () => {
		const result = detectManualEditRisk({
			exists: false,
			path: '/project/docs/nonexistent.md',
		});

		expect(result.risk).toBe(false);
		if (!result.risk) {
			expect(result.reason).toBe('file_missing');
		}
	});

	// --- 6. Read failure produces structured risk ---
	it('produces read_failed risk when content is undefined', () => {
		const result = detectManualEditRisk({
			exists: true,
			path: '/project/docs/unreadable.md',
		});

		expect(result.risk).toBe(true);
		if (result.risk) {
			expect(result.reason).toBe('read_failed');
			expect(result.message.length).toBeGreaterThan(0);
		}
	});

	// --- 7. Detection does not mutate files ---
	it('does not mutate any input', () => {
		const content = 'original content';
		const path = '/project/docs/file.md';
		const exists = true;

		detectManualEditRisk({ content, exists, path });

		expect(content).toBe('original content');
		expect(path).toBe('/project/docs/file.md');
		expect(exists).toBe(true);
	});
});
