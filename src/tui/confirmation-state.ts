/**
 * Confirmation state — pure functions for managing pending TUI confirmations.
 *
 * Phase 4: Keyboard Confirmation Framework — Outcome 2 (confirmation state store).
 *
 * All functions are pure: they take current state and return new state
 * without side effects. The containing component owns the actual React state.
 */

import type {
	TuiConfirmationRequest,
	TuiConfirmationResult,
} from './confirmation-model.js';

// ---------------------------------------------------------------------------
// State type
// ---------------------------------------------------------------------------

export interface ConfirmationState {
	/** The current pending confirmation, or undefined */
	pending: TuiConfirmationRequest | undefined;

	/** Result of the last resolution, or undefined */
	lastResult: TuiConfirmationResult | undefined;

	/** Whether command input should be blocked */
	inputBlocked: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an initial, empty confirmation state.
 */
export function createConfirmationState(): ConfirmationState {
	return {
		inputBlocked: false,
		lastResult: undefined,
		pending: undefined,
	};
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/**
 * Check whether there is a pending, unresolved confirmation.
 */
export function hasPendingConfirmation(state: ConfirmationState): boolean {
	return state.pending !== undefined;
}

/**
 * Check whether a confirmation request has expired.
 * An expiry window (default 5 minutes) is used when timestamp is available.
 */
export function isConfirmationExpired(
	request: TuiConfirmationRequest,
	now: string,
	expiryWindowMs?: number,
): boolean {
	const windowMs = expiryWindowMs ?? 5 * 60 * 1000; // 5 minutes
	const createdAt = new Date(request.createdAt).getTime();
	const nowTime = new Date(now).getTime();
	return Number.isNaN(createdAt) ? false : nowTime - createdAt > windowMs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentIndex(pending: TuiConfirmationRequest | undefined): number {
	if (!pending) return -1;
	return pending.options.findIndex((o) => o.id === pending.selectedOptionId);
}

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

/**
 * Set a new pending confirmation, clearing any previous result.
 */
export function setPendingConfirmation(
	_state: ConfirmationState,
	request: TuiConfirmationRequest,
): ConfirmationState {
	return {
		inputBlocked: true,
		lastResult: undefined,
		pending: request,
	};
}

/**
 * Update the selected option by index within the available options.
 */
export function selectConfirmationOption(
	state: ConfirmationState,
	index: number,
): ConfirmationState {
	if (!state.pending) return state;

	const options = state.pending.options;
	if (index < 0 || index >= options.length) return state;

	const option = options[index];
	if (!option) return state;

	return {
		...state,
		pending: {
			...state.pending,
			selectedOptionId: option.id,
		},
	};
}

/**
 * Move to the next option (wrapping around).
 */
export function selectNextConfirmationOption(
	state: ConfirmationState,
): ConfirmationState {
	if (!state.pending) return state;

	const options = state.pending.options;
	if (options.length === 0) return state;

	const currentIndex = getCurrentIndex(state.pending);
	const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length;

	return selectConfirmationOption(state, nextIndex);
}

/**
 * Move to the previous option (wrapping around).
 */
export function selectPreviousConfirmationOption(
	state: ConfirmationState,
): ConfirmationState {
	if (!state.pending) return state;

	const options = state.pending.options;
	if (options.length === 0) return state;

	const currentIndex = getCurrentIndex(state.pending);
	const prevIndex =
		currentIndex < 0
			? options.length - 1
			: (currentIndex - 1 + options.length) % options.length;

	return selectConfirmationOption(state, prevIndex);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Mark a pending confirmation as resolved and clear it.
 * The actual operation execution happens elsewhere (in the resolver).
 */
export function resolveConfirmation(
	_state: ConfirmationState,
	result: TuiConfirmationResult,
): ConfirmationState {
	return {
		inputBlocked: false,
		lastResult: result,
		pending: undefined,
	};
}

/**
 * Cancel the pending confirmation without mutating anything.
 */
export function cancelConfirmation(
	state: ConfirmationState,
): ConfirmationState {
	const cancelledResult: TuiConfirmationResult = {
		confirmationId: state.pending?.id ?? '',
		diagnostics: [],
		messages: ['Confirmation cancelled. No changes were made.'],
		nextActions: [],
		outcome: 'cancelled',
		selectedOptionId: undefined,
	};

	return {
		inputBlocked: false,
		lastResult: cancelledResult,
		pending: undefined,
	};
}

/**
 * Clear confirmation state entirely (no pending, no result).
 */
export function clearConfirmation(
	_state: ConfirmationState,
): ConfirmationState {
	return createConfirmationState();
}

// ---------------------------------------------------------------------------
// Pure keyboard navigation helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Keyboard action that can be dispatched from any input source.
 */
export type ConfirmationKeyboardAction =
	| 'next'
	| 'previous'
	| 'confirm'
	| 'cancel';

/**
 * Map Ink `useInput` key object to a confirmation keyboard action.
 * Pure function — testable without Ink.
 */
export function mapKeyToConfirmationAction(key: {
	return: boolean;
	escape: boolean;
	downArrow: boolean;
	rightArrow: boolean;
	upArrow: boolean;
	leftArrow: boolean;
	tab: boolean;
	shift: boolean;
}): ConfirmationKeyboardAction | undefined {
	if (key.return) return 'confirm';
	if (key.escape) return 'cancel';
	if (key.downArrow || key.rightArrow) return 'next';
	if (key.upArrow || key.leftArrow) return 'previous';
	if (key.tab) {
		return key.shift ? 'previous' : 'next';
	}
	return undefined;
}

/**
 * Apply a keyboard action to a confirmation request, returning the next selected option id.
 * Pure function — testable without React/Ink.
 */
export function applyConfirmationKeyboardAction(
	request: TuiConfirmationRequest,
	action: ConfirmationKeyboardAction,
): { selectedOptionId: string; shouldConfirm: boolean; shouldCancel: boolean } {
	const options = request.options;
	const currentIdx = options.findIndex(
		(o) => o.id === request.selectedOptionId,
	);

	switch (action) {
		case 'next': {
			const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % options.length;
			return {
				selectedOptionId: options[nextIdx]?.id ?? request.selectedOptionId,
				shouldCancel: false,
				shouldConfirm: false,
			};
		}
		case 'previous': {
			const prevIdx =
				currentIdx < 0
					? options.length - 1
					: (currentIdx - 1 + options.length) % options.length;
			return {
				selectedOptionId: options[prevIdx]?.id ?? request.selectedOptionId,
				shouldCancel: false,
				shouldConfirm: false,
			};
		}
		case 'confirm': {
			return {
				selectedOptionId: request.selectedOptionId,
				shouldCancel: false,
				shouldConfirm: true,
			};
		}
		case 'cancel': {
			return {
				selectedOptionId: request.selectedOptionId,
				shouldCancel: true,
				shouldConfirm: false,
			};
		}
	}
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check whether a resolution id matches the pending confirmation.
 */
export function validateConfirmationId(
	state: ConfirmationState,
	confirmationId: string,
): boolean {
	return state.pending?.id === confirmationId;
}

/**
 * Check whether a selected option id is valid for the pending confirmation.
 */
export function validateConfirmationOption(
	state: ConfirmationState,
	optionId: string,
): boolean {
	if (!state.pending) return false;
	return state.pending.options.some((o) => o.id === optionId);
}

/**
 * Get the currently selected option from pending confirmation.
 */
export function getSelectedOption(
	state: ConfirmationState,
): import('./confirmation-model.js').TuiConfirmationOption | undefined {
	if (!state.pending) return undefined;
	return state.pending.options.find(
		(o) => o.id === state.pending?.selectedOptionId,
	);
}
