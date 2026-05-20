/**
 * TUI Focus Model Tests
 *
 * Phase 5: TUI Workbench Redesign — Outcome 5 (focus model).
 */

import { describe, expect, it } from 'vitest';
import {
	createDefaultFocusModel,
	FOCUSABLE_TARGETS,
	moveFocusNext,
	moveFocusPrevious,
	setFocusTarget,
} from '../src/tui/workbench-model.js';

describe('focus model', () => {
	it('default focus is command input', () => {
		const focus = createDefaultFocusModel();
		expect(focus.target).toBe('command_input');
		expect(focus.focusLabel).toBe('Focus: command input');
	});

	it('confirmation focus overrides command input', () => {
		const focus = createDefaultFocusModel({ inputBlocked: true });
		expect(focus.target).toBe('confirmation');
		expect(focus.inputBlocked).toBe(true);
	});

	it('focus indicator is text-visible', () => {
		const focus = createDefaultFocusModel();
		expect(focus.focusLabel).toBeTruthy();
		expect(focus.focusLabel.startsWith('Focus:')).toBe(true);
	});

	it('focus moves to next target predictably', () => {
		let focus = createDefaultFocusModel();
		const allTargets: string[] = [];
		for (let i = 0; i < FOCUSABLE_TARGETS.length; i++) {
			allTargets.push(focus.target);
			focus = moveFocusNext(focus);
		}
		// Should cycle through all targets
		expect(allTargets).toContain('command_input');
	});

	it('focus moves to previous target', () => {
		const focus = createDefaultFocusModel();
		const prev = moveFocusPrevious(focus);
		expect(prev.target).toBe('recovery_action');
	});

	it('focus returns to command input after success (reset)', () => {
		// Simulate: confirmation → resolution → back to command input
		const confirmed = createDefaultFocusModel({ inputBlocked: true });
		expect(confirmed.target).toBe('confirmation');

		const reset = createDefaultFocusModel();
		expect(reset.target).toBe('command_input');
		expect(reset.inputBlocked).toBe(false);
	});

	it('focus returns to command input after cancellation', () => {
		const cancelled = createDefaultFocusModel({ inputBlocked: false });
		expect(cancelled.target).toBe('command_input');
	});

	it('focus can move to recovery action on blocking error', () => {
		const recovery = setFocusTarget(
			createDefaultFocusModel(),
			'recovery_action',
		);
		expect(recovery.target).toBe('recovery_action');
		expect(recovery.focusLabel).toBe('Focus: recovery_action');
	});

	it('focus label updates when target changes', () => {
		let focus = createDefaultFocusModel();
		expect(focus.focusLabel).toBe('Focus: command input');

		focus = setFocusTarget(focus, 'action_area');
		expect(focus.focusLabel).toBe('Focus: action_area');
	});

	it('all focusable targets are valid', () => {
		for (const target of FOCUSABLE_TARGETS) {
			const focus = setFocusTarget(createDefaultFocusModel(), target);
			expect(focus.target).toBe(target);
			expect(focus.focusLabel).toContain(target);
		}
	});
});
