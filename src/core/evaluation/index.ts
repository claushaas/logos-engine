/**
 * LOGOS Core — Evaluation module.
 *
 * Owns answer evaluation contracts, evaluator ports, deterministic
 * validation, baseline evaluator, and fake evaluator for tests.
 * All evaluation output must be validated by the helpers exported here
 * before it can be applied to canonical intake state.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export type CoreEvaluationModule = 'core.evaluation';

export type {
	AnswerEvaluation,
	AnswerEvaluationStatus,
	ExtractedIntakeItem,
} from './answer-evaluation.js';
export {
	ANSWER_EVALUATION_STATUS_VALUES,
	answerEvaluationSchema,
	extractedIntakeItemSchema,
} from './answer-evaluation.js';
export type {
	AnswerEvaluator,
	AnswerEvaluatorContext,
	EvaluateAnswerInput,
	EvaluateAnswerResult,
	LiveAnswerEvaluatorConfig,
} from './answer-evaluator-port.js';
export { createDeterministicAnswerEvaluator } from './deterministic-evaluator.js';
export type { AnswerEvaluationValidationResult } from './evaluation-validation.js';
export {
	validateAnswerEvaluation,
	validateEvaluationAdvancementConsistency,
} from './evaluation-validation.js';
export type {
	FakeAnswerEvaluatorMode,
	FakeAnswerEvaluatorOptions,
} from './fake-answer-evaluator.js';
export { createFakeAnswerEvaluator } from './fake-answer-evaluator.js';
