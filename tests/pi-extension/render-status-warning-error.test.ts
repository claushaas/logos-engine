/**
 * Step 9.1 — Status, warning, and error message renderer tests.
 *
 * Proves that `renderAssistantMessage` correctly renders status, warning,
 * and error messages:
 * 1. Status message renders as kind: "status".
 * 2. Warning message renders as kind: "warning".
 * 3. Error message renders as kind: "error".
 * 4. Blockers are preserved in rendered error/warning payloads.
 * 5. Warnings are preserved in rendered status/warning payloads.
 * 6. Raw Error objects are not exposed directly.
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderAssistantMessage } from '../../src/pi-extension/rendering/render-assistant-message.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function statusMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'Intake is in progress. 3 of 10 questions answered.',
		kind: 'status',
		metadata: { progress: 3, total: 10 },
		...overrides,
	};
}

function warningMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'Some optional questions remain unanswered.',
		kind: 'warning',
		metadata: { code: 'missing_optional' },
		...overrides,
	};
}

function errorMessage(overrides?: Partial<AssistantMessage>): AssistantMessage {
	return {
		body: 'Profile not found. Cannot continue intake.',
		kind: 'error',
		metadata: { code: 'profile_not_found' },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.1 — status renderer', () => {
	it('renders status message as kind "status"', () => {
		const rendered = renderAssistantMessage({ message: statusMessage() });

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('status');
	});

	it('title defaults to "LOGOS status"', () => {
		const rendered = renderAssistantMessage({ message: statusMessage() });

		expect(rendered.title).toBe('LOGOS status');
	});

	it('preserves progress metadata', () => {
		const rendered = renderAssistantMessage({ message: statusMessage() });

		expect(rendered.metadata).toEqual({ progress: 3, total: 10 });
	});

	it('preserves warnings in rendered payload', () => {
		const warnings = [{ code: 'incomplete', message: 'Not done.' }];
		const rendered = renderAssistantMessage({
			message: statusMessage(),
			warnings,
		});

		expect(rendered.warnings).toEqual(warnings);
	});
});

describe('Step 9.1 — warning renderer', () => {
	it('renders warning message as kind "warning"', () => {
		const rendered = renderAssistantMessage({ message: warningMessage() });

		expect(rendered.kind).toBe('warning');
	});

	it('title defaults to "LOGOS warning"', () => {
		const rendered = renderAssistantMessage({ message: warningMessage() });

		expect(rendered.title).toBe('LOGOS warning');
	});

	it('preserves warning code in metadata', () => {
		const rendered = renderAssistantMessage({ message: warningMessage() });

		expect(rendered.metadata).toEqual({ code: 'missing_optional' });
	});

	it('preserves blockers when supplied', () => {
		const blockers = [{ code: 'b1', message: 'Blocker.' }];
		const rendered = renderAssistantMessage({
			blockers,
			message: warningMessage(),
		});

		expect(rendered.blockers).toEqual(blockers);
	});
});

describe('Step 9.1 — error renderer', () => {
	it('renders error message as kind "error"', () => {
		const rendered = renderAssistantMessage({ message: errorMessage() });

		expect(rendered.kind).toBe('error');
	});

	it('title defaults to "LOGOS error"', () => {
		const rendered = renderAssistantMessage({ message: errorMessage() });

		expect(rendered.title).toBe('LOGOS error');
	});

	it('preserves blocker metadata in rendered payload', () => {
		const blockers = [{ code: 'profile_not_found', message: 'Missing.' }];
		const rendered = renderAssistantMessage({
			blockers,
			message: errorMessage(),
		});

		expect(rendered.blockers).toEqual(blockers);
	});

	it('does not expose raw Error objects', () => {
		// The renderer only works with serializable AssistantMessage inputs.
		// Raw Error objects cannot appear in the payload.  We verify that
		// structured blockers/warnings (not raw Error instances) are used.
		const blockers = [
			{ code: 'profile_not_found', message: 'Profile missing.' },
		];
		const rendered = renderAssistantMessage({
			blockers,
			message: errorMessage(),
		});

		// Blockers are plain objects, not Error instances.
		expect(rendered.blockers).toBeDefined();
		expect(rendered.blockers?.[0]).not.toBeInstanceOf(Error);
		expect(rendered.blockers?.[0]).toEqual({
			code: 'profile_not_found',
			message: 'Profile missing.',
		});
	});

	it('preserves error code in metadata', () => {
		const rendered = renderAssistantMessage({ message: errorMessage() });

		expect(rendered.metadata).toEqual({ code: 'profile_not_found' });
	});
});
