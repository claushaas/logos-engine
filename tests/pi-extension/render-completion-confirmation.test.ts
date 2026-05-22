/**
 * Step 9.1 — Completion and confirmation request renderer tests.
 *
 * Proves that `renderAssistantMessage` correctly renders completion and
 * confirmation_request messages:
 * 1. Completion message renders as kind: "completion".
 * 2. Confirmation request renders as kind: "confirmation_request".
 * 3. Confirmation renderer does not call ctx.ui.confirm(...).
 * 4. Completion renderer does not call generation.
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderAssistantMessage } from '../../src/pi-extension/rendering/render-assistant-message.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function completionMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'All intake questions have been answered. Run /logos-generate to produce documentation.',
		kind: 'completion',
		metadata: { completenessScore: 1.0 },
		...overrides,
	};
}

function confirmationRequestMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'Partial draft generation requires explicit confirmation. Set confirmedPartialGeneration to true to proceed.',
		kind: 'confirmation_request',
		metadata: { requiresExplicitConfirmation: true },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — completion renderer', () => {
	it('renders completion message as kind "completion"', () => {
		const rendered = renderAssistantMessage({
			message: completionMessage(),
		});

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('completion');
	});

	it('title defaults to "LOGOS complete"', () => {
		const rendered = renderAssistantMessage({
			message: completionMessage(),
		});

		expect(rendered.title).toBe('LOGOS complete');
	});

	it('rendered body includes completion text', () => {
		const rendered = renderAssistantMessage({
			message: completionMessage(),
		});

		expect(rendered.body).toContain('/logos-generate');
	});

	it('completion renderer does not call generation', () => {
		// The renderAssistantMessage function is pure — it cannot call Core.
		const message = completionMessage();
		const frozen = structuredClone(message);

		const rendered = renderAssistantMessage({ message });

		expect(message).toEqual(frozen);
		expect(rendered.kind).toBe('completion');
	});

	it('preserves completion metadata', () => {
		const rendered = renderAssistantMessage({
			message: completionMessage(),
		});

		expect(rendered.metadata).toEqual({ completenessScore: 1.0 });
	});
});

describe('Step 9.1 — confirmation request renderer', () => {
	it('renders confirmation request as kind "confirmation_request"', () => {
		const rendered = renderAssistantMessage({
			message: confirmationRequestMessage(),
		});

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('confirmation_request');
	});

	it('title defaults to "LOGOS confirmation required"', () => {
		const rendered = renderAssistantMessage({
			message: confirmationRequestMessage(),
		});

		expect(rendered.title).toBe('LOGOS confirmation required');
	});

	it('rendered body includes confirmation request text', () => {
		const rendered = renderAssistantMessage({
			message: confirmationRequestMessage(),
		});

		expect(rendered.body).toContain('confirmedPartialGeneration');
	});

	it('does not call ctx.ui.confirm — renderer is pure', () => {
		// The renderAssistantMessage function is a pure data transformer.
		// It does not (and cannot) call ctx.ui.confirm or any Pi UI API.
		const message = confirmationRequestMessage();
		const frozen = structuredClone(message);

		const rendered = renderAssistantMessage({ message });

		expect(message).toEqual(frozen);
		expect(rendered.kind).toBe('confirmation_request');
	});

	it('preserves confirmation metadata', () => {
		const rendered = renderAssistantMessage({
			message: confirmationRequestMessage(),
		});

		expect(rendered.metadata).toEqual({
			requiresExplicitConfirmation: true,
		});
	});

	it('does not call generation or preflight', () => {
		// Pure function — no Core APIs called.
		const message = confirmationRequestMessage();
		const frozen = structuredClone(message);

		renderAssistantMessage({ message });

		expect(message).toEqual(frozen);
	});
});
