/**
 * LOGOS Core — Intake module.
 *
 * Owns intake state transitions, prompt selection, intake session logic,
 * user intent classification contracts, lifecycle command detection,
 * deterministic intent routing, and intake message handling.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export type CoreIntakeModule = 'core.intake';

export type {
	CreateContradictionPromptInput,
	CreateFollowUpPromptInput,
} from './active-prompt.js';
export {
	createContradictionPrompt,
	createFollowUpPrompt,
	createQuestionPrompt,
} from './active-prompt.js';
export type {
	ApplyAnswerEvaluationInput,
	ApplyAnswerEvaluationResult,
	EvaluationTransition,
} from './apply-evaluation.js';
export { applyAnswerEvaluation } from './apply-evaluation.js';
export { createAssistantMessageFromPrompt } from './assistant-message-from-prompt.js';
export type {
	BuildContradictionResolutionInput,
	BuildContradictionResolutionResult,
	CreateContradictionRecordInput,
} from './contradiction-resolution.js';
export {
	buildContradictionResolution,
	createContradictionId,
	createContradictionRecord,
} from './contradiction-resolution.js';
export type {
	CheckDependencyStatusInput,
	DependencyStatus,
} from './dependency-status.js';
export { checkDependencyStatus } from './dependency-status.js';
export type { DetectedLifecycleCommand } from './detect-lifecycle-command.js';
export {
	ALLOWED_LIFECYCLE_COMMANDS,
	detectLifecycleCommand,
} from './detect-lifecycle-command.js';
export type {
	IntakeRouteAction,
	RouteIntakeMessageInput,
	RouteIntakeMessageResult,
} from './deterministic-intent-router.js';
export { routeIntakeMessage } from './deterministic-intent-router.js';
export type {
	ResolveIntakeCommandDispositionInput,
	ResolveIntakeCommandDispositionResult,
} from './handle-intake-command.js';
export { resolveIntakeCommandDisposition } from './handle-intake-command.js';
export type {
	HandleIntakeMessageTransitionInput,
	HandleIntakeMessageTransitionResult,
} from './handle-intake-message.js';
export { handleIntakeMessageTransition } from './handle-intake-message.js';
export type {
	IntakeIntentClassification,
	IntakeIntentValidationResult,
	IntakeUserIntent,
} from './intake-user-intent.js';
export {
	INTAKE_USER_INTENT_VALUES,
	intakeIntentClassificationSchema,
	validateIntakeIntentClassification,
} from './intake-user-intent.js';
export type {
	ForbiddenLogosCommand,
	LogosLifecycleCommand,
} from './lifecycle-command.js';
export {
	FORBIDDEN_LOGOS_COMMANDS,
	isForbiddenLogosCommand,
	isLogosLifecycleCommand,
	LOGOS_LIFECYCLE_COMMANDS,
} from './lifecycle-command.js';
export { selectNextPrompt } from './next-prompt-selector.js';
export type {
	ActivePrompt,
	NextPromptSelection,
	NextPromptSelectionReason,
	NextPromptSelectionStatus,
	SelectNextPromptInput,
} from './prompt-selection-types.js';
export type {
	GetQuestionSelectionStatusInput,
	QuestionSelectionStatus,
} from './question-status.js';
export { getQuestionSelectionStatus } from './question-status.js';
export type {
	StartIntakeTransitionData,
	StartIntakeTransitionInput,
	StartIntakeTransitionResult,
} from './start-intake.js';
export { startIntakeTransition } from './start-intake.js';
export type {
	StopIntakeTransitionData,
	StopIntakeTransitionInput,
	StopIntakeTransitionResult,
} from './stop-intake.js';
export { stopIntakeTransition } from './stop-intake.js';
