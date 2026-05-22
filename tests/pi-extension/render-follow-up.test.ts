/**
 * Step 9.1 — Follow-up message renderer tests.
 *
 * Proves that `renderAssistantMessage` correctly renders Core follow-up
 * messages:
 * 1. Follow-up message renders as kind: "follow_up".
 * 2. Rendered body includes follow-up text.
 * 3. Metadata preserves questionId.
 * 4. Metadata preserves followUpId (via Core message metadata).
 * 5. Renderer does not decide advancement.
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderAssistantMessage } from '../../src/pi-extension/rendering/render-assistant-message.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function followUpMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'You mentioned the thesis applies to software teams. Can you be more specific about which type of team?',
		kind: 'follow_up',
		metadata: { followUpId: 'fu-1', questionId: 'q1' },
		questionId: 'q1',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — follow-up renderer', () => {
	it('renders follow-up message as kind "follow_up"', () => {
		const message = followUpMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('follow_up');
	});

	it('rendered body includes follow-up text', () => {
		const message = followUpMessage({
			body: 'Could you elaborate on the budget details?',
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.body).toBe('Could you elaborate on the budget details?');
	});

	it('metadata preserves questionId', () => {
		const message = followUpMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.questionId).toBe('q1');
	});

	it('metadata preserves followUpId in Core message metadata', () => {
		const message = followUpMessage({
			metadata: { followUpId: 'fu-42', questionId: 'q1' },
		});
		const rendered = renderAssistantMessage({ message });

		expect(rendered.metadata).toEqual({
			followUpId: 'fu-42',
			questionId: 'q1',
		});
	});

	it('title defaults to "LOGOS follow-up"', () => {
		const message = followUpMessage();
		const rendered = renderAssistantMessage({ message });

		expect(rendered.title).toBe('LOGOS follow-up');
	});

	it('does not decide advancement — renderer is pure', () => {
		const message = followUpMessage();
		const frozen = structuredClone(message);

		renderAssistantMessage({ message });

		// Input unchanged.
		expect(message).toEqual(frozen);

		// Output has no side effects — just data.
		const rendered = renderAssistantMessage({ message });
		expect(rendered.kind).toBe('follow_up');
	});

	it('preserves blockers and warnings when supplied', () => {
		const message = followUpMessage();
		const blockers = [{ code: 'b1', message: 'Block.' }];
		const warnings = [{ code: 'w1', message: 'Warn.' }];

		const rendered = renderAssistantMessage({ blockers, message, warnings });

		expect(rendered.blockers).toEqual(blockers);
		expect(rendered.warnings).toEqual(warnings);
	});

	it('does not include questionId when Core message lacks it', () => {
		const message: AssistantMessage = {
			body: 'Follow-up without questionId.',
			kind: 'follow_up',
		};
		const rendered = renderAssistantMessage({ message });

		expect(rendered.questionId).toBeUndefined();
	});
});
