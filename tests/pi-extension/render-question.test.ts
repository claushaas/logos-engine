/**
 * Step 9.1 — Question message renderer tests.
 *
 * Proves that `renderAssistantMessage` correctly renders Core question
 * messages as `LogosRenderedMessage` payloads:
 * 1. Question message renders as kind: "question".
 * 2. Rendered body includes the question text.
 * 3. Metadata preserves questionId.
 * 4. Metadata preserves phase/document/section ids when present
 *    (via the Core message metadata).
 * 5. Renderer does not call Core APIs (it's a pure function).
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderAssistantMessage } from '../../src/pi-extension/rendering/render-assistant-message.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function questionMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'What is the central thesis that justifies this project existing?',
		kind: 'question',
		metadata: {
			documentId: '01-thesis',
			phaseId: '01-foundation',
			sectionId: 'core-thesis',
		},
		questionId: 'q1',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — question renderer', () => {
	it('renders question message as kind "question"', () => {
		const message = questionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('question');
	});

	it('rendered body includes the question text', () => {
		const message = questionMessage({
			body: 'Who is the primary audience for this project?',
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.body).toBe('Who is the primary audience for this project?');
	});

	it('metadata preserves questionId', () => {
		const message = questionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.questionId).toBe('q1');
	});

	it('metadata preserves phaseId, documentId, and sectionId via Core message metadata', () => {
		const message = questionMessage({
			metadata: {
				documentId: '02-scope',
				phaseId: '02-scoping',
				sectionId: 'scope-boundaries',
			},
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.metadata).toEqual({
			documentId: '02-scope',
			phaseId: '02-scoping',
			sectionId: 'scope-boundaries',
		});
	});

	it('title defaults to "LOGOS question"', () => {
		const message = questionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.title).toBe('LOGOS question');
	});

	it('respects explicit title from Core message', () => {
		const message = questionMessage({ title: 'Custom Title' });
		const rendered = renderAssistantMessage({ message });

		expect(rendered.title).toBe('Custom Title');
	});

	it('renderer is pure — does not mutate input', () => {
		const message = questionMessage();
		const frozen = structuredClone(message);

		renderAssistantMessage({ message });

		expect(message).toEqual(frozen);
	});

	it('renderer is deterministic — same input produces same output', () => {
		const message = questionMessage();

		const a = renderAssistantMessage({ message });
		const b = renderAssistantMessage({ message });

		expect(a).toEqual(b);
	});

	it('preserves blockers when supplied', () => {
		const message = questionMessage();
		const blockers = [
			{ code: 'profile_not_found', message: 'Profile missing.' },
		];

		const rendered = renderAssistantMessage({ blockers, message });

		expect(rendered.blockers).toEqual(blockers);
	});

	it('preserves warnings when supplied', () => {
		const message = questionMessage();
		const warnings = [
			{ code: 'missing_optional', message: 'Optional skipped.' },
		];

		const rendered = renderAssistantMessage({ message, warnings });

		expect(rendered.warnings).toEqual(warnings);
	});

	it('does not include blockers when none supplied', () => {
		const message = questionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.blockers).toBeUndefined();
	});

	it('does not include warnings when none supplied', () => {
		const message = questionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.warnings).toBeUndefined();
	});

	it('does not include undefined fields in output', () => {
		const message: AssistantMessage = {
			body: 'Minimal question.',
			kind: 'question',
		};
		const rendered = renderAssistantMessage({ message });

		expect(rendered.questionId).toBeUndefined();
		expect(rendered.metadata).toBeUndefined();
		expect(rendered.blockers).toBeUndefined();
		expect(rendered.warnings).toBeUndefined();
	});
});
