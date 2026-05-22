/**
 * LOGOS Core — Intake module.
 *
 * Owns intake state transitions, prompt selection, and intake session logic.
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
	CheckDependencyStatusInput,
	DependencyStatus,
} from './dependency-status.js';
export { checkDependencyStatus } from './dependency-status.js';

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
