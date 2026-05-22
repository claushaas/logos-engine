/**
 * LOGOS Core — Question ID helper.
 *
 * Produces deterministic, stable question identifiers from phase,
 * document, section, and question-index context.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

/**
 * Convert arbitrary text into a lowercase kebab-case token.
 * Strips characters that are not letters, digits, or hyphens and
 * collapses multiple hyphens.
 *
 * This is deterministic and does not use random values, timestamps,
 * or external state.
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type CreateQuestionIdInput = {
	phaseId: string;
	documentId: string;
	sectionId: string;
	/** Zero-based index of the question within its section. */
	questionIndex: number;
	/**
	 * Original question text used as a fallback when none of the
	 * structured ids produce a usable slug. This should rarely be
	 * needed if phase/document/section ids are well-formed.
	 */
	question: string;
};

// ---------------------------------------------------------------------------
// createQuestionId
// ---------------------------------------------------------------------------

/**
 * Build a stable, deterministic question id.
 *
 * Format: `<phaseId>.<documentId>.<sectionId>.q<questionIndex+1>`
 *
 * Example: `01-foundation.01-thesis.core-thesis.q01`
 *
 * The output is guaranteed to be:
 * - lowercase;
 * - alphanumeric with dots and hyphens;
 * - free of random values, timestamps, or external state;
 * - stable across runs given the same input.
 *
 * When a structured id contains characters outside of `[a-z0-9-]`,
 * it is slugified first.
 */
export function createQuestionId(input: CreateQuestionIdInput): string {
	const phaseSlug = slugify(input.phaseId);
	const docSlug = slugify(input.documentId);
	const sectionSlug = slugify(input.sectionId);
	const qIndex = `q${String(input.questionIndex + 1).padStart(2, '0')}`;

	return `${phaseSlug}.${docSlug}.${sectionSlug}.${qIndex}`;
}
