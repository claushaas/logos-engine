import { describe, expect, it } from 'vitest';
import {
	generateDefaultTemplate,
	renderSection,
	renderTemplate,
} from '../../src/document-renderer/template-renderer.js';
import type { CanonicalDocument } from '../../src/domain/profile-loader.js';

describe('template-renderer', () => {
	const mockDocument: CanonicalDocument = {
		completionCriteria: ['Criterion 1'],
		dependencies: { decisions: [], documents: [] },
		generatedOutputs: ['Output 1'],
		id: 'test.document',
		path: 'docs/test/DOCUMENT.md',
		phaseId: '00-intake',
		primaryQuestions: ['Question 1?'],
		promptContext: {
			includeAssumptions: true,
			includeConfirmedDecisions: true,
			includeOpenQuestions: true,
		},
		purpose: 'Test purpose',
		requiredInputs: { answers: [], assumptions: [], decisions: [] },
		sections: [
			{ id: 'purpose', required: true, title: 'Purpose' },
			{ id: 'details', required: false, title: 'Details' },
		],
		template: 'templates/test.md',
		title: 'Test Document',
		validationRules: [],
	};

	describe('renderTemplate', () => {
		it('renders template with document context', () => {
			const template = '# {{document.title}}\n\n{{document.purpose}}';
			const context = {
				assumptions: [],
				decisions: {},
				document: mockDocument,
				openQuestions: [],
			};

			const result = renderTemplate(template, context, '/tmp');

			expect(result).toContain('# Test Document');
			expect(result).toContain('Test purpose');
		});
	});

	describe('renderSection', () => {
		it('renders section with decision value', () => {
			const context = {
				assumptions: [],
				decisions: { purpose: 'This is the purpose' },
				document: mockDocument,
				openQuestions: [],
			};

			const result = renderSection('purpose', 'Purpose', context);

			expect(result).toContain('## Purpose');
			expect(result).toContain('This is the purpose');
			expect(result).toContain('<!-- logos:section:manual:purpose -->');
		});

		it('renders awaiting input when no decision exists', () => {
			const context = {
				assumptions: [],
				decisions: {},
				document: mockDocument,
				openQuestions: [],
			};

			const result = renderSection('purpose', 'Purpose', context);

			expect(result).toContain('## Purpose');
			expect(result).toContain('_Awaiting input._');
			expect(result).toContain('<!-- logos:section:manual:purpose -->');
		});
	});

	describe('generateDefaultTemplate', () => {
		it('generates a default template from document metadata', () => {
			const result = generateDefaultTemplate(mockDocument);

			expect(result).toContain('# Test Document');
			expect(result).toContain('Test purpose');
			expect(result).toContain('## Purpose');
			expect(result).toContain('## Details');
			expect(result).toContain('_Awaiting input._');
		});
	});
});
