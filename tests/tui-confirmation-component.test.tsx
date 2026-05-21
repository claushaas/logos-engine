/**
 * Tests for confirmation keyboard handling and rendering.
 *
 * Phase 4: Keyboard Confirmation Framework — Component tests.
 *
 * Keyboard logic is tested via pure helpers (mapKeyToConfirmationAction,
 * applyConfirmationKeyboardAction) so that Escape/Arrow key behavior
 * is covered deterministically without relying on Ink stdin parsing.
 * The Enter key confirmation and basic rendering are tested with ink-testing-library.
 */

import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationPrompt } from '../src/tui/ConfirmationPrompt.js';
import {
	createTuiConfirmationRequest,
	yesNoOptions,
} from '../src/tui/confirmation-model.js';
import {
	applyConfirmationKeyboardAction,
	mapKeyToConfirmationAction,
} from '../src/tui/confirmation-state.js';

function makeTestRequest(
	overrides?: Partial<Parameters<typeof createTuiConfirmationRequest>[0]>,
) {
	return createTuiConfirmationRequest({
		_testId: 'comp-test',
		_testTimestamp: '2026-01-01T00:00:00.000Z',
		actionKind: 'workspace_init',
		message: 'Initialize the workspace.',
		options: yesNoOptions(),
		sourceCommand: '/init',
		title: 'Initialize Workspace',
		...overrides,
	});
}

// ---------------------------------------------------------------------------
// Pure keyboard helper tests
// ---------------------------------------------------------------------------

describe('mapKeyToConfirmationAction', () => {
	it('maps Enter to confirm', () => {
		const key = makeKey({ return: true });
		expect(mapKeyToConfirmationAction(key)).toBe('confirm');
	});

	it('maps Escape to cancel', () => {
		const key = makeKey({ escape: true });
		expect(mapKeyToConfirmationAction(key)).toBe('cancel');
	});

	it('maps downArrow to next', () => {
		const key = makeKey({ downArrow: true });
		expect(mapKeyToConfirmationAction(key)).toBe('next');
	});

	it('maps rightArrow to next', () => {
		const key = makeKey({ rightArrow: true });
		expect(mapKeyToConfirmationAction(key)).toBe('next');
	});

	it('maps upArrow to previous', () => {
		const key = makeKey({ upArrow: true });
		expect(mapKeyToConfirmationAction(key)).toBe('previous');
	});

	it('maps leftArrow to previous', () => {
		const key = makeKey({ leftArrow: true });
		expect(mapKeyToConfirmationAction(key)).toBe('previous');
	});

	it('maps Tab to next', () => {
		const key = makeKey({ tab: true });
		expect(mapKeyToConfirmationAction(key)).toBe('next');
	});

	it('maps Shift-Tab to previous', () => {
		const key = makeKey({ shift: true, tab: true });
		expect(mapKeyToConfirmationAction(key)).toBe('previous');
	});

	it('returns undefined for unrecognized key', () => {
		const key = makeKey({});
		expect(mapKeyToConfirmationAction(key)).toBeUndefined();
	});

	it('prefers Escape over arrow keys', () => {
		const key = makeKey({ downArrow: true, escape: true });
		expect(mapKeyToConfirmationAction(key)).toBe('cancel');
	});

	it('prefers Enter over arrow keys', () => {
		const key = makeKey({ downArrow: true, return: true });
		expect(mapKeyToConfirmationAction(key)).toBe('confirm');
	});
});

describe('applyConfirmationKeyboardAction', () => {
	it('next moves to second option', () => {
		const request = makeTestRequest();
		expect(request.selectedOptionId).toBe('accept');

		const result = applyConfirmationKeyboardAction(request, 'next');
		expect(result.selectedOptionId).toBe('cancel');
		expect(result.shouldConfirm).toBe(false);
		expect(result.shouldCancel).toBe(false);
	});

	it('next wraps around to first option', () => {
		const request = makeTestRequest();
		// Manually select last option
		const withLast = {
			...request,
			selectedOptionId: 'cancel',
		};

		const result = applyConfirmationKeyboardAction(withLast, 'next');
		expect(result.selectedOptionId).toBe('accept');
	});

	it('previous wraps around to last option', () => {
		const request = makeTestRequest();
		expect(request.selectedOptionId).toBe('accept');

		const result = applyConfirmationKeyboardAction(request, 'previous');
		expect(result.selectedOptionId).toBe('cancel');
	});

	it('previous moves to first when on second', () => {
		const request = makeTestRequest();
		const withLast = {
			...request,
			selectedOptionId: 'cancel',
		};

		const result = applyConfirmationKeyboardAction(withLast, 'previous');
		expect(result.selectedOptionId).toBe('accept');
	});

	it('confirm returns shouldConfirm=true', () => {
		const request = makeTestRequest();
		const result = applyConfirmationKeyboardAction(request, 'confirm');
		expect(result.shouldConfirm).toBe(true);
		expect(result.shouldCancel).toBe(false);
		expect(result.selectedOptionId).toBe(request.selectedOptionId);
	});

	it('cancel returns shouldCancel=true', () => {
		const request = makeTestRequest();
		const result = applyConfirmationKeyboardAction(request, 'cancel');
		expect(result.shouldCancel).toBe(true);
		expect(result.shouldConfirm).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Component rendering tests
// ---------------------------------------------------------------------------

describe('ConfirmationPrompt rendering', () => {
	it('renders title', () => {
		const request = makeTestRequest();
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		expect(lastFrame()).toContain('Initialize Workspace');
	});

	it('renders message', () => {
		const request = makeTestRequest();
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		expect(lastFrame()).toContain('Initialize the workspace.');
	});

	it('renders options with text labels', () => {
		const request = makeTestRequest();
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		const output = lastFrame();
		expect(output).toContain('Accept');
		expect(output).toContain('Cancel');
		expect(output).toContain('[selected]');
		expect(output).toContain('[ ]');
	});

	it('shows consequences', () => {
		const request = makeTestRequest({
			consequences: ['File A will be created.', 'File B will be updated.'],
		});
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		const output = lastFrame();
		expect(output).toContain('Consequences');
		expect(output).toContain('File A will be created');
	});

	it('shows alternatives', () => {
		const request = makeTestRequest({
			alternatives: ['Run /init --dry-run first.'],
		});
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		expect(lastFrame()).toContain('Alternatives');
	});

	it('renders keyboard help text', () => {
		const request = makeTestRequest();
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		const output = lastFrame();
		expect(output).toContain('Arrow keys');
		expect(output).toContain('Enter');
		expect(output).toContain('Esc');
	});

	it('shows destructive label', () => {
		const request = makeTestRequest({ destructive: true });
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		expect(lastFrame()).toContain('(destructive)');
	});

	it('shows sensitive label', () => {
		const request = makeTestRequest({ sensitive: true });
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		expect(lastFrame()).toContain('(sensitive)');
	});

	it('calls onConfirm when Enter is pressed', async () => {
		const request = makeTestRequest();
		const onConfirm = vi.fn();
		const { stdin } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: vi.fn(),
				onConfirm,
				request,
			}),
		);

		await stdin.write('\r');

		expect(onConfirm).toHaveBeenCalledWith('accept');
	});

	it('does not use color-only indicators', () => {
		const request = makeTestRequest();
		const { lastFrame } = render(
			React.createElement(ConfirmationPrompt, {
				onCancel: () => {},
				onConfirm: () => {},
				request,
			}),
		);

		const output = lastFrame();
		expect(output).toContain('[selected]');
		expect(output).toContain('[ ]');
	});
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeKey(
	overrides: Partial<{
		return: boolean;
		escape: boolean;
		downArrow: boolean;
		rightArrow: boolean;
		upArrow: boolean;
		leftArrow: boolean;
		tab: boolean;
		shift: boolean;
	}>,
): {
	return: boolean;
	escape: boolean;
	downArrow: boolean;
	rightArrow: boolean;
	upArrow: boolean;
	leftArrow: boolean;
	tab: boolean;
	shift: boolean;
} {
	return {
		downArrow: false,
		escape: false,
		leftArrow: false,
		return: false,
		rightArrow: false,
		shift: false,
		tab: false,
		upArrow: false,
		...overrides,
	};
}
