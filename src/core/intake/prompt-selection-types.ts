/**
 * LOGOS Core — Prompt selection types (Step 3.3).
 *
 * Defines the ActivePrompt shape, selection result types, and selector input
 * contracts. All types are plain serializable data, free of Pi or UI types.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosIntakeState } from '../state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Active prompt kinds
// ---------------------------------------------------------------------------

/**
 * Classification for the active prompt. Mirrors the persisted
 * {@link import('../state/intake-state-types.js').ActivePromptKind} but is
 * self-contained so the selector does not need to couple to the persistence
 * shape.
 */
export type ActivePromptKind =
	| 'question'
	| 'follow_up'
	| 'contradiction_resolution';

// ---------------------------------------------------------------------------
// ActivePrompt
// ---------------------------------------------------------------------------

/**
 * An askable prompt that the system will present to the user next.
 *
 * Unlike {@link import('../state/intake-state-types.js').ActivePromptState},
 * which stores only ids and timestamps for persistence, this type includes
 * the full display text, priority, phase/document/section metadata, and
 * optional context needed for rendering.
 */
export type ActivePrompt = {
	/** Classification: question, follow_up, or contradiction_resolution. */
	kind: ActivePromptKind;

	/** The question id this prompt relates to. */
	questionId: string;

	/** The text that should be presented to the user. */
	text: string;

	/** Optional additional context or explanation. */
	context?: string;

	/** Whether the originating question is required for intake completeness. */
	required: boolean;

	/** Priority level of the originating question. */
	priority: 'critical' | 'important' | 'optional';

	/** Phase identifier from the originating question. */
	phaseId: string;

	/** Document identifier from the originating question. */
	documentId: string;

	/** Section identifier from the originating question. */
	sectionId: string;

	/** For follow-up prompts, the follow-up identifier if available. */
	followUpId?: string;

	/** For contradiction prompts, the contradiction record identifier. */
	contradictionId?: string;

	/** Source profile file path from the originating question. */
	sourcePath?: string;

	/** Extra serializable metadata. */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Selection status
// ---------------------------------------------------------------------------

/**
 * Top-level outcome of the selector.
 *
 * - `selected`: exactly one prompt was chosen.
 * - `complete`: no unanswered/partial prompts remain.
 * - `blocked`: selection could not proceed (empty registry, dependency
 *    deadlock, invalid active prompt).
 */
export type NextPromptSelectionStatus = 'selected' | 'complete' | 'blocked';

// ---------------------------------------------------------------------------
// Selection reason
// ---------------------------------------------------------------------------

/**
 * Reason explaining why the selector returned its particular prompt or
 * outcome. Useful for debugging, logging, and status reporting.
 */
export type NextPromptSelectionReason =
	| 'unresolved_contradiction'
	| 'active_unresolved_follow_up'
	| 'critical_unanswered'
	| 'critical_partial'
	| 'important_unanswered'
	| 'important_partial'
	| 'optional_unanswered'
	| 'optional_partial'
	| 'complete'
	| 'dependency_blocked'
	| 'registry_empty'
	| 'active_prompt_invalid';

// ---------------------------------------------------------------------------
// NextPromptSelection (discriminated union)
// ---------------------------------------------------------------------------

export type NextPromptSelection =
	| {
			status: 'selected';
			reason: NextPromptSelectionReason;
			prompt: ActivePrompt;
			warnings: string[];
			blockers: string[];
	  }
	| {
			status: 'complete';
			reason: 'complete';
			prompt?: undefined;
			warnings: string[];
			blockers: string[];
	  }
	| {
			status: 'blocked';
			reason: 'dependency_blocked' | 'registry_empty' | 'active_prompt_invalid';
			prompt?: undefined;
			warnings: string[];
			blockers: string[];
	  };

// ---------------------------------------------------------------------------
// Selector input
// ---------------------------------------------------------------------------

/**
 * Pure-function input for the next-prompt selector.
 *
 * The selector does not read from filesystem, resolve profiles, call AI,
 * or mutate state. Callers supply the registry and intake state explicitly.
 */
export type SelectNextPromptInput = {
	/** The active profile's question registry (questions + indexes). */
	registry: import('../questions/question-registry.js').LogosQuestionRegistry;
	/** Current durable intake state. */
	intakeState: LogosIntakeState;
};
