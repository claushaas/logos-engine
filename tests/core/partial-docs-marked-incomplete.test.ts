/**
 * Step 6.4 — Partial docs marked incomplete tests.
 *
 * Tests:
 * 1. Incomplete draft header includes INCOMPLETE DRAFT.
 * 2. Header includes generatedBy: logos-engine.
 * 3. Header includes generationMode: partial_draft.
 * 4. Header includes incomplete: true.
 * 5. Header includes blocker and warning codes when present.
 * 6. Placeholder renderer includes header markers.
 * 7. Placeholder renderer includes blocker/warning codes.
 * 8. Placeholder renderer includes output metadata.
 * 9. Partial draft content does not claim final status.
 * 10. Marker is deterministic (same input → same output).
 */

import { describe, expect, it } from 'vitest';

import {
	createIncompleteDraftHeader,
	renderPartialDraftPlaceholder,
} from '../../src/core/generation/index.js';
import type { GenerationPreflightIssue } from '../../src/core/generation/preflight-result.js';
import type {
	GenerationWriteOperationKind,
	WritePlanOperation,
} from '../../src/core/generation/write-plan.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHECKED_AT = '2026-05-22T00:00:00.000Z';

function blocker(
	code: GenerationPreflightIssue['code'],
	message: string,
	questionIds?: string[],
): GenerationPreflightIssue {
	const issue: GenerationPreflightIssue = { code, message };
	if (questionIds !== undefined) issue.questionIds = questionIds;
	return issue;
}

function warning(
	code: GenerationPreflightIssue['code'],
	message: string,
): GenerationPreflightIssue {
	return { code, message };
}

function makeOperation(
	overrides?: Partial<WritePlanOperation>,
): WritePlanOperation {
	return {
		authority: 'canonical',
		id: 'test:01-foundation:01-thesis:docs/01-foundation/01-thesis.md',
		kind: 'create' as GenerationWriteOperationKind,
		outputKind: 'canonical_markdown',
		path: '/project/docs/01-foundation/01-thesis.md',
		relativePath: 'docs/01-foundation/01-thesis.md',
		risks: [],
		...(overrides ?? {}),
	} as WritePlanOperation;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createIncompleteDraftHeader', () => {
	it('includes INCOMPLETE DRAFT heading', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test reason.',
			warnings: [],
		});

		expect(header).toContain('# INCOMPLETE DRAFT');
	});

	it('includes generatedBy: logos-engine in YAML frontmatter', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test reason.',
			warnings: [],
		});

		expect(header).toContain('generatedBy: logos-engine');
	});

	it('includes generationMode: partial_draft in YAML frontmatter', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test reason.',
			warnings: [],
		});

		expect(header).toContain('generationMode: partial_draft');
	});

	it('includes incomplete: true in YAML frontmatter', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test reason.',
			warnings: [],
		});

		expect(header).toContain('incomplete: true');
	});

	it('does not claim final status', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test reason.',
			warnings: [],
		});

		// Must not claim to be the final / production-ready doc.
		// "not final" phrasing is OK.
		expect(header).not.toMatch(/\bis (the )?final documentation\b/i);
		expect(header).not.toMatch(/\bproduction[- ]ready\b/i);
		expect(header).not.toMatch(/\bis complete\b/i);
	});

	it('includes the reason message', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Critical information is missing.',
			warnings: [],
		});

		expect(header).toContain('Critical information is missing.');
	});

	it('includes blocker codes when blockers are present', () => {
		const header = createIncompleteDraftHeader({
			blockers: [
				blocker('missing_critical_questions', 'Critical Q missing.'),
				blocker('unresolved_contradictions', 'Contradiction exists.'),
			],
			checkedAt: CHECKED_AT,
			reason: 'Test.',
			warnings: [],
		});

		expect(header).toContain('missing_critical_questions');
		expect(header).toContain('Critical Q missing.');
		expect(header).toContain('unresolved_contradictions');
		expect(header).toContain('Contradiction exists.');
	});

	it('includes warning codes when warnings are present', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test.',
			warnings: [
				warning('important_questions_missing', 'Important Q missing.'),
			],
		});

		expect(header).toContain('important_questions_missing');
		expect(header).toContain('Important Q missing.');
	});

	it('does not include blocker section when no blockers exist', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test.',
			warnings: [],
		});

		// When there are no blockers, the Blocker section should not appear.
		expect(header).not.toContain('# Blockers');
	});

	it('does not include warning section when no warnings exist', () => {
		const header = createIncompleteDraftHeader({
			blockers: [],
			checkedAt: CHECKED_AT,
			reason: 'Test.',
			warnings: [],
		});

		expect(header).not.toContain('# Warnings');
	});

	it('is deterministic (same input → same output)', () => {
		const header1 = createIncompleteDraftHeader({
			blockers: [blocker('missing_critical_questions', 'Missing Q.')],
			checkedAt: CHECKED_AT,
			reason: 'Test.',
			warnings: [warning('important_questions_missing', 'Important missing.')],
		});

		const header2 = createIncompleteDraftHeader({
			blockers: [blocker('missing_critical_questions', 'Missing Q.')],
			checkedAt: CHECKED_AT,
			reason: 'Test.',
			warnings: [warning('important_questions_missing', 'Important missing.')],
		});

		expect(header1).toBe(header2);
	});
});

describe('renderPartialDraftPlaceholder', () => {
	const blockers = [
		blocker('missing_critical_questions', 'Missing Q.', ['q1']),
	];
	const warningsList = [
		warning('important_questions_missing', 'Important Q missing.'),
	];

	it('includes incomplete draft header', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers,
				checkedAt: CHECKED_AT,
				completenessScore: 0.42,
				warnings: warningsList,
			},
		});

		expect(content).toContain('# INCOMPLETE DRAFT');
		expect(content).toContain('generatedBy: logos-engine');
		expect(content).toContain('generationMode: partial_draft');
		expect(content).toContain('incomplete: true');
	});

	it('includes output kind', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation({ outputKind: 'canonical_markdown' }),
			preflight: {
				blockers,
				checkedAt: CHECKED_AT,
				completenessScore: 0.42,
				warnings: warningsList,
			},
		});

		expect(content).toContain('canonical_markdown');
	});

	it('includes phase and document ids', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation({
				documentId: '01-thesis',
				phaseId: '01-foundation',
			}),
			preflight: {
				blockers,
				checkedAt: CHECKED_AT,
				completenessScore: 0.42,
				warnings: warningsList,
			},
		});

		expect(content).toContain('01-foundation');
		expect(content).toContain('01-thesis');
	});

	it('includes completeness score as percentage', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers,
				checkedAt: CHECKED_AT,
				completenessScore: 0.75,
				warnings: [],
			},
		});

		expect(content).toContain('75%');
	});

	it('includes blocker codes', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers: [
					blocker('missing_critical_questions', 'Missing.'),
					blocker('unresolved_contradictions', 'Contra.'),
				],
				checkedAt: CHECKED_AT,
				completenessScore: 0.5,
				warnings: [],
			},
		});

		expect(content).toContain('missing_critical_questions');
		expect(content).toContain('unresolved_contradictions');
	});

	it('includes warning codes', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers: [],
				checkedAt: CHECKED_AT,
				completenessScore: 0.5,
				warnings: [
					warning('optional_questions_missing', 'Optional Q missing.'),
				],
			},
		});

		expect(content).toContain('optional_questions_missing');
	});

	it('shows (none) when no blockers', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers: [],
				checkedAt: CHECKED_AT,
				completenessScore: 0.5,
				warnings: [],
			},
		});

		expect(content).toContain('(none)');
	});

	it('does not claim final status', () => {
		const content = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers: [],
				checkedAt: CHECKED_AT,
				completenessScore: 1.0,
				warnings: [],
			},
		});

		// Must not claim to be the final / production-ready doc.
		// "not final documentation" phrasing is OK.
		expect(content).not.toMatch(/\bis (the )?final documentation\b/i);
		expect(content).not.toMatch(/\bproduction[- ]ready\b/i);
	});

	it('is deterministic', () => {
		const a1 = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers,
				checkedAt: CHECKED_AT,
				completenessScore: 0.42,
				warnings: warningsList,
			},
		});
		const a2 = renderPartialDraftPlaceholder({
			now: CHECKED_AT,
			operation: makeOperation(),
			preflight: {
				blockers,
				checkedAt: CHECKED_AT,
				completenessScore: 0.42,
				warnings: warningsList,
			},
		});

		expect(a1).toBe(a2);
	});
});
