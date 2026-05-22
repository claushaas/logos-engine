/**
 * LOGOS Core — Durable intake state types.
 *
 * Defines the shape of project-local intake state.
 * All types are plain serializable data.
 */

export type IntakeMode =
	| 'idle'
	| 'intake_active'
	| 'paused'
	| 'generating'
	| 'complete';

export type IntakeAnswerStatus =
	| 'sufficient'
	| 'partial'
	| 'insufficient'
	| 'contradictory'
	| 'needs_clarification';

export type ActivePromptKind =
	| 'question'
	| 'follow_up'
	| 'contradiction_resolution';

export type ActivePromptState = {
	kind: ActivePromptKind;
	questionId: string;
	followUpId?: string;
	contradictionId?: string;
	startedAt: string;
	updatedAt: string;
};

export type IntakeAnswerRecord = {
	questionId: string;
	answer: string;
	status: IntakeAnswerStatus;
	evaluationId?: string;
	answeredAt: string;
	revisedAt?: string;
	metadata?: Record<string, unknown>;
};

export type IntakePartialRecord = {
	questionId: string;
	answer?: string;
	reason?: string;
	missingAspects: string[];
	recordedAt: string;
	updatedAt?: string;
	metadata?: Record<string, unknown>;
};

export type IntakeSkippedRecord = {
	questionId: string;
	reason: string;
	skippedAt: string;
	metadata?: Record<string, unknown>;
};

export type IntakeContradictionRecord = {
	id: string;
	questionId: string;
	conflictsWithQuestionIds: string[];
	summary: string;
	status: 'unresolved' | 'resolved';
	createdAt: string;
	resolvedAt?: string;
	resolution?: string;
	metadata?: Record<string, unknown>;
};

export type IntakeProgressCounts = {
	total: number;
	sufficient: number;
	partial: number;
	missing: number;
	contradictory: number;
	skipped: number;
};

export type IntakePhaseProgress = IntakeProgressCounts & {
	phaseId: string;
};

export type IntakeProgress = IntakeProgressCounts & {
	byPhase: Record<string, IntakePhaseProgress>;
};

export type LogosIntakeState = {
	version: 1;
	projectRoot: string;
	initializedAt: string;
	updatedAt: string;
	mode: IntakeMode;
	activePrompt?: ActivePromptState;
	activeQuestionId?: string;
	answeredQuestions: Record<string, IntakeAnswerRecord>;
	partialQuestions: Record<string, IntakePartialRecord>;
	skippedQuestions: Record<string, IntakeSkippedRecord>;
	contradictions: Record<string, IntakeContradictionRecord>;
	progress: IntakeProgress;
	metadata?: Record<string, unknown>;
};
