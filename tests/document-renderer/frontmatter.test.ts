import { describe, expect, it } from 'vitest';
import {
	type DocumentFrontmatter,
	generateFrontmatter,
	parseFrontmatter,
} from '../../src/document-renderer/frontmatter.js';

describe('frontmatter', () => {
	describe('generateFrontmatter', () => {
		it('generates YAML frontmatter with document metadata', () => {
			const frontmatter: DocumentFrontmatter = {
				documentId: 'test.document',
				generatedAt: '2026-01-01T00:00:00Z',
				profile: 'app-business',
				status: 'generated',
			};

			const result = generateFrontmatter(frontmatter);

			expect(result).toContain('---');
			expect(result).toContain('document_id: test.document');
			expect(result).toContain('profile: app-business');
			expect(result).toContain('generated_at: 2026-01-01T00:00:00Z');
			expect(result).toContain('status: generated');
		});
	});

	describe('parseFrontmatter', () => {
		it('parses valid frontmatter', () => {
			const content = `---\nlogos:\n  document_id: test.doc\n  profile: app-business\n  generated_at: 2026-01-01T00:00:00Z\n  status: draft\n---\n\n# Title`;

			const result = parseFrontmatter(content);

			expect(result).not.toBeNull();
			expect(result?.documentId).toBe('test.doc');
			expect(result?.profile).toBe('app-business');
			expect(result?.status).toBe('draft');
		});

		it('returns null when no frontmatter exists', () => {
			const result = parseFrontmatter('# Just a title');
			expect(result).toBeNull();
		});

		it('returns null when required fields are missing', () => {
			const result = parseFrontmatter(
				'---\nlogos:\n  profile: app-business\n---',
			);
			expect(result).toBeNull();
		});
	});
});
