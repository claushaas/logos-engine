/**
 * LOGOS Core — Generation preflight result types (Step 6.2).
 *
 * Defines the canonical preflight result model, blocker/warning codes,
 * and readiness statuses used before any generation write plan executes.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

// ---------------------------------------------------------------------------
// Status & mode enums
// ---------------------------------------------------------------------------

export type GenerationReadinessStatus =
	| 'ready'
	| 'blocked'
	| 'confirmation_required'
	| 'not_initialized';

export type GenerationPreflightMode = 'final' | 'partial_draft' | 'dry_run';

// ---------------------------------------------------------------------------
// Blocker & warning codes
// ---------------------------------------------------------------------------

export type GenerationPreflightBlockerCode =
	| 'project_not_initialized'
	| 'profile_not_found'
	| 'profile_invalid'
	| 'intake_state_missing'
	| 'question_registry_empty'
	| 'missing_critical_questions'
	| 'partial_critical_questions'
	| 'unresolved_contradictions'
	| 'required_questions_skipped'
	| 'unsafe_output_path'
	| 'overwrite_risk'
	| 'manual_edit_risk';

export type GenerationPreflightWarningCode =
	| 'optional_questions_missing'
	| 'optional_questions_skipped'
	| 'important_questions_missing'
	| 'important_questions_partial'
	| 'output_paths_not_fully_validated'
	| 'write_plan_not_built'
	| 'manual_edit_detection_not_available';

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export type GenerationPreflightIssue = {
	code: GenerationPreflightBlockerCode | GenerationPreflightWarningCode;
	message: string;
	questionIds?: string[];
	paths?: string[];
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * Canonical preflight result returned by {@link runGenerationPreflight}.
 *
 * Rules:
 * - `ready` must be `false` when `blockers.length > 0`.
 * - `status` must be `"blocked"` when blockers exist.
 * - `status` must be `"ready"` only when final generation has no blockers.
 * - `completenessScore` must be between 0 and 1.
 * - `canGeneratePartialDraft` may be true even when final generation is
 *   blocked, but only when enough profile/state exists to produce a
 *   meaningful (incomplete) draft.
 * - `requiresExplicitConfirmation` must be true whenever partial draft
 *   generation is possible but final generation is blocked.
 * - Result must be JSON-serializable.
 */
export type GenerationPreflightResult = {
	mode: GenerationPreflightMode;
	status: GenerationReadinessStatus;
	ready: boolean;
	completenessScore: number;
	blockers: GenerationPreflightIssue[];
	warnings: GenerationPreflightIssue[];
	missingCriticalQuestions: string[];
	partialCriticalQuestions: string[];
	contradictions: string[];
	requiredSkippedQuestions: string[];
	optionalMissingQuestions: string[];
	optionalSkippedQuestions: string[];
	canGeneratePartialDraft: boolean;
	requiresExplicitConfirmation: boolean;
	generatedAt?: string;
	checkedAt: string;
	metadata?: Record<string, unknown>;
};
