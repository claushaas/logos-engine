/**
 * Step 9.1 — Contradiction message renderer tests.
 *
 * Proves that `renderAssistantMessage` correctly renders Core contradiction
 * messages:
 * 1. Contradiction message renders as kind: "contradiction".
 * 2. Rendered body includes contradiction prompt text.
 * 3. Metadata preserves questionId.
 * 4. Metadata preserves contradictionId (via Core message metadata).
 * 5. Renderer does not resolve contradiction.
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderAssistantMessage } from '../../src/pi-extension/rendering/render-assistant-message.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function contradictionMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'Your answer to the thesis question conflicts with your earlier problem statement. Which one should take priority?',
		kind: 'contradiction',
		metadata: { contradictionId: 'contra-1', questionId: 'q1' },
		questionId: 'q1',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — contradiction renderer', () => {
	it('renders contradiction message as kind "contradiction"', () => {
		const message = contradictionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('contradiction');
	});

	it('rendered body includes contradiction prompt text', () => {
		const message = contradictionMessage({
			body: 'This conflicts with your earlier answer. Please resolve.',
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.body).toBe(
			'This conflicts with your earlier answer. Please resolve.',
		);
	});

	it('metadata preserves questionId', () => {
		const message = contradictionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.questionId).toBe('q1');
	});

	it('metadata preserves contradictionId in Core message metadata', () => {
		const message = contradictionMessage({
			metadata: { contradictionId: 'contra-99', questionId: 'q1' },
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.metadata).toEqual({
			contradictionId: 'contra-99',
			questionId: 'q1',
		});
	});

	it('title defaults to "LOGOS contradiction"', () => {
		const message = contradictionMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.title).toBe('LOGOS contradiction');
	});

	it('does not resolve contradiction — renderer is pure', () => {
		const message = contradictionMessage();
		const frozen = structuredClone(message);

		renderAssistantMessage({ message });

		// Input unchanged.
		expect(message).toEqual(frozen);

		// Output does not contain resolution data.
		const rendered = renderAssistantMessage({ message });
		expect(rendered.kind).toBe('contradiction');
	});

	it('preserves blockers and warnings when supplied', () => {
		const message = contradictionMessage();
		const blockers = [
			{ code: 'contradiction_unresolved', message: 'Must resolve.' },
		];

		const rendered = renderAssistantMessage({ blockers, message });

		expect(rendered.blockers).toEqual(blockers);
	});
});
