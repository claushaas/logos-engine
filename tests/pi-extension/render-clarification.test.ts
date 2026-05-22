/**
 * Step 9.1 — Clarification message renderer tests.
 *
 * Proves that `renderAssistantMessage` correctly renders Core clarification
 * messages:
 * 1. Clarification message renders as kind: "clarification".
 * 2. Rendered body includes clarification text.
 * 3. Metadata is preserved.
 * 4. Renderer does not advance or call Core.
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderAssistantMessage } from '../../src/pi-extension/rendering/render-assistant-message.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function clarificationMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'Could you be more specific? Your answer was too vague to determine if it covers the required aspects.',
		kind: 'clarification',
		metadata: { phaseId: '01-foundation', questionId: 'q1' },
		questionId: 'q1',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — clarification renderer', () => {
	it('renders clarification message as kind "clarification"', () => {
		const message = clarificationMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('clarification');
	});

	it('rendered body includes clarification text', () => {
		const message = clarificationMessage({
			body: 'Your scope answer was too broad. Could you narrow it to specific deliverables?',
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.body).toBe(
			'Your scope answer was too broad. Could you narrow it to specific deliverables?',
		);
	});

	it('metadata is preserved', () => {
		const message = clarificationMessage({
			metadata: { phaseId: '02-scoping', questionId: 'q5' },
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.metadata).toEqual({
			phaseId: '02-scoping',
			questionId: 'q5',
		});
	});

	it('title defaults to "LOGOS clarification"', () => {
		const message = clarificationMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.title).toBe('LOGOS clarification');
	});

	it('does not advance or call Core — renderer is pure', () => {
		const message = clarificationMessage();
		const frozen = structuredClone(message);

		// Call twice to prove determinism.
		const a = renderAssistantMessage({ message });
		const b = renderAssistantMessage({ message });

		expect(a).toEqual(b);
		expect(message).toEqual(frozen);
	});

	it('respects explicit Core title over default', () => {
		const message = clarificationMessage({ title: 'Please clarify' });
		const rendered = renderAssistantMessage({ message });

		expect(rendered.title).toBe('Please clarify');
	});

	it('preserves questionId from Core message', () => {
		const message = clarificationMessage({ questionId: 'q7' });
		const rendered = renderAssistantMessage({ message });

		expect(rendered.questionId).toBe('q7');
	});
});
