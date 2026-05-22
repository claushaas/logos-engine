/**
 * LOGOS Core — Answer evaluator port.
 *
 * Defines the canonical {@link AnswerEvaluator} port, input/result types,
 * and a reserved placeholder for future live provider integration.
 *
 * Evaluators must:
 * - Accept already-routed normal answer text only.
 * - Never receive lifecycle slash commands.
 * - Return {@link AnswerEvaluation} through the validated schema only.
 * - Never mutate intake state.
 * - Never select the next prompt.
 * - Never write files.
 * - Never import Pi APIs.
 * - Never return raw provider objects as canonical output.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { ActivePrompt } from '../intake/prompt-selection-types.js';
import type { LogosQuestion } from '../questions/question-types.js';
import type { LogosIntakeState } from '../state/intake-state-types.js';
import type { AnswerEvaluation } from './answer-evaluation.js';

// ---------------------------------------------------------------------------
// Evaluator context (shared across calls — not yet used, but reserved)
// ---------------------------------------------------------------------------

/**
 * Context shared across evaluation calls within a single intake session.
 *
 * Reserved for future use (e.g. provider pooling, caching).
 */
export type AnswerEvaluatorContext = {
	/** The active question being evaluated. */
	question: LogosQuestion;
	/** The active prompt, if one exists. */
	activePrompt?: ActivePrompt | undefined;
	/** Current durable intake state (read-only for the evaluator). */
	intakeState: LogosIntakeState;
	/** ISO-8601 timestamp representing "now" for this evaluation. */
	now: string;
	/** Extra serializable metadata. Must be a plain record. */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Evaluate-answer input
// ---------------------------------------------------------------------------

/**
 * Input for a single answer evaluation call.
 *
 * The evaluator receives the question, the user's answer text, the current
 * intake state for context, and a timestamp.  It must NOT mutate any of
 * these inputs.
 */
export type EvaluateAnswerInput = {
	/** The active question against which the answer is evaluated. */
	question: LogosQuestion;
	/** The active prompt at the time the user answered. */
	activePrompt?: ActivePrompt | undefined;
	/** Current durable intake state (read-only). */
	intakeState: LogosIntakeState;
	/** The raw user answer text (already intent-routed). */
	answer: string;
	/** ISO-8601 timestamp representing "now" for this evaluation. */
	now: string;
	/** Extra serializable metadata. Must be a plain record. */
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Evaluate-answer result
// ---------------------------------------------------------------------------

/**
 * Structured result from an {@link AnswerEvaluator}.
 *
 * On success (`ok: true`), `evaluation` is a validated {@link AnswerEvaluation}.
 * On failure (`ok: false`), `errors` explains why evaluation could not
 * produce a valid result.
 */
export type EvaluateAnswerResult =
	| {
			ok: true;
			evaluation: AnswerEvaluation;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// AnswerEvaluator port
// ---------------------------------------------------------------------------

/**
 * Canonical answer evaluator port.
 *
 * Implementations (deterministic, fake, or future AI-assisted) must conform
 * to this interface.  Every successful evaluation must be validated through
 * {@link validateAnswerEvaluation} before `ok: true` is returned.
 *
 * Implementations must be:
 * - Deterministic (fake and baseline) or externally validated (AI).
 * - Free of Pi, Ink, React, TUI, and CLI imports.
 * - Free of network calls, credentials, or API keys in test implementations.
 */
export type AnswerEvaluator = {
	evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerResult>;
};

// ---------------------------------------------------------------------------
// Live provider reservation (placeholder — do not implement)
// ---------------------------------------------------------------------------

/**
 * Reserved placeholder for future live AI provider configuration.
 *
 * **Not implemented in the MVP.** This type exists so that downstream
 * code can reference a stable shape without creating ad-hoc config shapes.
 *
 * When live provider integration is eventually added, this config will
 * drive which provider adapter to use (e.g. OpenAI, Anthropic, OpenRouter).
 *
 * @remarks
 * No live provider adapter must be implemented without explicit disclosure
 * and acceptance criteria.  Tests must remain network-free.
 */
export type LiveAnswerEvaluatorConfig = {
	/** Identifier for the provider adapter (e.g. "openai", "anthropic"). */
	providerId: string;
	/** Optional model identifier (e.g. "gpt-4o", "claude-3-opus"). */
	model?: string;
};
