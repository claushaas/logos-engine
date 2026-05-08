import { describe, expect, it } from 'vitest';
import {
	extractManualSections,
	mergeManualSections,
	wrapManualSection,
} from '../../src/document-renderer/manual-notes.js';

describe('manual-notes', () => {
	describe('extractManualSections', () => {
		it('extracts manual sections from content', () => {
			const content = `
# Title

## Section 1

<!-- logos:manual-section:start:section_1 -->
Custom content here
<!-- logos:manual-section:end:section_1 -->

## Section 2

Some generated content.
`;

			const sections = extractManualSections(content);

			expect(sections).toHaveLength(1);
			expect(sections[0].sectionId).toBe('section_1');
			expect(sections[0].body).toBe('Custom content here');
		});

		it('returns empty array when no manual sections exist', () => {
			const sections = extractManualSections('# Title\n\nSome content');
			expect(sections).toHaveLength(0);
		});

		it('skips unclosed manual sections', () => {
			const content = `
<!-- logos:manual-section:start:unclosed -->
This has no end marker.
`;

			const sections = extractManualSections(content);
			expect(sections).toHaveLength(0);
		});
	});

	describe('wrapManualSection', () => {
		it('wraps content in manual section markers', () => {
			const wrapped = wrapManualSection('my_section', 'My content');

			expect(wrapped).toContain(
				'<!-- logos:manual-section:start:my_section -->',
			);
			expect(wrapped).toContain('My content');
			expect(wrapped).toContain('<!-- logos:manual-section:end:my_section -->');
		});
	});

	describe('mergeManualSections', () => {
		it('preserves manual sections in generated content', () => {
			const generated = `# Title

## Section 1

_Awaiting input._

<!-- logos:section:manual:section_1 -->

## Section 2

_Awaiting input._

<!-- logos:section:manual:section_2 -->
`;

			const manualSections = [
				{ body: 'Preserved content', sectionId: 'section_1' },
			];

			const result = mergeManualSections(generated, manualSections);

			expect(result).toContain('Preserved content');
			expect(result).toContain('## Section 1');
		});
	});
});
