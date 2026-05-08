import { describe, expect, it } from 'vitest';
import {
	generateDocuments,
	generateDocumentsForCwd,
} from '../../src/application/document-generation.js';

describe('document-generation', () => {
	describe('generateDocuments', () => {
		it('returns error when workspace does not exist', () => {
			const result = generateDocuments('/nonexistent/path');

			expect(result.status).toBe('error');
			expect(result.title).toBe('Document generation failed');
		});
	});

	describe('generateDocumentsForCwd', () => {
		it('returns error when no workspace is found in cwd', () => {
			const result = generateDocumentsForCwd('/nonexistent/path', []);

			expect(result.status).toBe('error');
			expect(result.title).toBe('Document generation failed');
		});

		it('parses --force flag', () => {
			const result = generateDocumentsForCwd('/nonexistent/path', ['--force']);

			expect(result.status).toBe('error');
			expect(result.title).toBe('Document generation failed');
		});
	});
});
