/**
 * LOGOS Core — Question types.
 *
 * Defines the canonical LogosQuestion shape, follow-up policy, and priority
 * levels used by the question registry and intake system.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export type LogosQuestionPriority = 'critical' | 'important' | 'optional';
export type QuestionPriority = LogosQuestionPriority;

// ---------------------------------------------------------------------------
// Follow-up policy
// ---------------------------------------------------------------------------

export type QuestionFollowUpPolicy = {
	maxFollowUps: number;
	askForExamples: boolean;
	askForTradeoffs: boolean;
};

// ---------------------------------------------------------------------------
// LogosQuestion
// ---------------------------------------------------------------------------

/**
 * A single structured intake question derived from an active profile's
 * document section questions.
 *
 * Every question carries enough metadata for routing, evaluation,
 * persistence, and generation.
 */
export type LogosQuestion = {
	/** Stable, deterministic identifier (e.g. `01-foundation.01-thesis.core-thesis.q01`). */
	id: string;
	/** Profile identifier from which this question was derived. */
	profileId: string;
	/** Phase identifier from the active profile (e.g. `01-foundation`). */
	phaseId: string;
	/** Document identifier from the active profile (e.g. `01-thesis`). */
	documentId: string;
	/** Section identifier from the active profile (e.g. `core-thesis`). */
	sectionId: string;

	/** The original question text from the profile section. */
	question: string;
	/**
	 * Human-readable purpose derived from the section title,
	 * document central question, or document title.
	 */
	purpose: string;

	/** Whether this question is required for intake completeness. */
	required: boolean;
	/** Priority level used for question selection ordering. */
	priority: QuestionPriority;

	/**
	 * Criteria that define an acceptable answer.
	 * May be derived from the document's completion criteria or quality checks.
	 */
	acceptanceCriteria: string[];
	/**
	 * Signals that indicate the question has been sufficiently answered.
	 * May be derived from document or section quality checks.
	 */
	completionSignals: string[];
	/**
	 * Signals that indicate the current answer is insufficient and needs
	 * a follow-up. Initially empty until answer evaluation is implemented.
	 */
	insufficiencySignals: string[];

	/**
	 * Stable ids of questions that should be answered before this one.
	 * Derived from `document.dependsOn` when applicable.
	 */
	dependsOn?: string[];

	/** Policy governing follow-up behavior when answers are partial. */
	followUpPolicy: QuestionFollowUpPolicy;

	/**
	 * Absolute path of the source profile file that contained this question.
	 * Preserved for traceability.
	 */
	sourcePath: string;

	/**
	 * Extra serializable metadata from the source profile, such as
	 * document title, section title, raw dependency info, raw outputs,
	 * and source indexes.
	 */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Default follow-up policy
// ---------------------------------------------------------------------------

/**
 * Default follow-up policy used when a question does not define its own.
 */
export const DEFAULT_FOLLOW_UP_POLICY: QuestionFollowUpPolicy = {
	askForExamples: true,
	askForTradeoffs: true,
	maxFollowUps: 3,
};
