/**
 * LOGOS Core — Handle intake message transition (Step 4.2).
 *
 * Core-owned logic for processing a user message during active intake mode.
 *
 * This module:
 * 1. Loads durable intake state.
 * 2. Rebuilds the active prompt from state + registry.
 * 3. Calls the deterministic intent router.
 * 4. Returns a structured transition result appropriate for each route.
 *
 * **This module does not implement answer evaluation execution.**
 * When the router returns `evaluate_answer`, this module returns a result
 * indicating that answer evaluation is not implemented yet.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { loadLogosConfig } from '../config/load-config.js';
import type {
	AnswerEvaluator,
	EvaluateAnswerResult,
} from '../evaluation/answer-evaluator-port.js';
import { createDeterministicAnswerEvaluator } from '../evaluation/deterministic-evaluator.js';
import type { AssistantMessage } from '../messages.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import type { LoadedProfileContracts } from '../profiles/profile-contracts.js';
import { ensureProfileReady } from '../profiles/profile-gate.js';
import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import { loadIntakeState } from '../state/intake-state-persistence.js';
import type {
	ActivePromptState,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import {
	createContradictionPrompt,
	createFollowUpPrompt,
	createQuestionPrompt,
} from './active-prompt.js';
import type {
	IntakeRouteAction,
	RouteIntakeMessageResult,
} from './deterministic-intent-router.js';
import { routeIntakeMessage } from './deterministic-intent-router.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type HandleIntakeMessageTransitionInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
	dryRun: boolean;
	/** The raw user message text. */
	message: string;
	/**
	 * Optional answer evaluator.  When provided, it is called for
	 * `evaluate_answer` routes.  When omitted, the deterministic
	 * baseline evaluator {@link createDeterministicAnswerEvaluator}
	 * is used as a fallback.
	 */
	evaluator?: AnswerEvaluator | undefined;
};

export type HandleIntakeMessageTransitionResult = {
	status: 'blocked' | 'routed' | 'not_active';
	action?: IntakeRouteAction | undefined;
	messageText: string;
	messageKind: AssistantMessage['kind'];
	warnings: string[];
	activeQuestionId?: string | undefined;
	stateChanged: boolean;
	/**
	 * Present when the route action is `evaluate_answer` and the
	 * evaluator was successfully called.  Contains the structured
	 * evaluation result (validated {@link AnswerEvaluation} or error).
	 *
	 * The evaluation has **not** been applied to intake state.
	 */
	evaluationResult?: EvaluateAnswerResult | undefined;
};

// ---------------------------------------------------------------------------
// ActivePromptState → ActivePrompt rebuild (mirrors start-intake.ts)
// ---------------------------------------------------------------------------

function rebuildActivePrompt(
	promptState: ActivePromptState,
	registry: LogosQuestionRegistry,
	intakeState: LogosIntakeState,
): ActivePrompt | undefined {
	const question = registry.byId[promptState.questionId];
	if (question === undefined) {
		return undefined;
	}

	switch (promptState.kind) {
		case 'question': {
			return createQuestionPrompt(question);
		}
		case 'follow_up': {
			const partialRecord =
				intakeState.partialQuestions[promptState.questionId];
			const answerRecord =
				intakeState.answeredQuestions[promptState.questionId];
			const missingAspects = partialRecord?.missingAspects ?? [];
			const reason = partialRecord?.reason ?? answerRecord?.status;

			const p = createFollowUpPrompt({
				missingAspects,
				question,
				...(reason !== undefined ? { reason } : {}),
			});
			if (promptState.followUpId !== undefined) {
				p.followUpId = promptState.followUpId;
			}
			return p;
		}
		case 'contradiction_resolution': {
			const contradictionId =
				promptState.contradictionId ??
				Object.keys(intakeState.contradictions).find(
					(cid) => intakeState.contradictions[cid]?.questionId === question.id,
				);

			const contradiction =
				contradictionId !== undefined
					? intakeState.contradictions[contradictionId]
					: undefined;

			if (contradiction === undefined) {
				return undefined;
			}

			return createContradictionPrompt({ contradiction, question });
		}
	}
}

// ---------------------------------------------------------------------------
// Clarification message builder
// ---------------------------------------------------------------------------

function buildClarificationMessage(activePrompt: ActivePrompt): string {
	let body =
		'This question is asking you to clarify the current project decision or context. ' +
		'Please answer the active question in your own words, or say that it should remain pending.';

	if (activePrompt.context !== undefined && activePrompt.context.length > 0) {
		body += `\n\nContext: ${activePrompt.context}`;
	}

	body += `\n\nOriginal question: ${activePrompt.text}`;

	return body;
}

// ---------------------------------------------------------------------------
// Out-of-scope message builder
// ---------------------------------------------------------------------------

function buildOutOfScopeMessage(): string {
	return (
		'LOGOS intake is active. This message does not appear to answer the current question. ' +
		'Reply to the current question, ask for clarification, or pause intake.'
	);
}

// ---------------------------------------------------------------------------
// Main transition
// ---------------------------------------------------------------------------

/**
 * Process a user message during active intake mode.
 *
 * Does **not** implement answer evaluation execution, AI classification,
 * or conversational advancement beyond routing.  Returns a structured result
 * that the public API layer (`api.ts`) wraps in a {@link CoreResult}.
 *
 * Required behaviour (from the spec):
 * - Loads intake state.
 * - Rebuilds the active prompt for routing context.
 * - Routes via deterministic {@link routeIntakeMessage}.
 * - Never submits command text to answer evaluation.
 * - Returns a clarification message for clarification intents.
 * - Returns an out-of-scope message for out-of-scope intents.
 * - Returns a "not implemented" result for evaluate_answer.
 */
export async function handleIntakeMessageTransition(
	input: HandleIntakeMessageTransitionInput,
): Promise<HandleIntakeMessageTransitionResult> {
	const { projectRoot, filesystem, now, message, evaluator } = input;
	const warnings: string[] = [];

	// ---- 1. Load project config ----
	const configResult = await loadLogosConfig({
		filesystem,
		now,
		projectRoot,
	});

	if (!configResult.ok) {
		return {
			action: undefined,
			messageKind: 'error',
			messageText: 'Project is not initialized. Run /logos-init first.',
			stateChanged: false,
			status: 'blocked',
			warnings: [],
		};
	}

	// ---- 2. Resolve active profile ----
	const gateResult = await ensureProfileReady({
		activeProfileId: configResult.config.activeProfileId,
		filesystem,
		projectRoot,
	});

	let registry: LogosQuestionRegistry | undefined;

	if (!gateResult.ok) {
		// Profile missing — we can still try to load intake state and route
		// control intents that don't require the question registry.
		warnings.push(
			...gateResult.blockers.map((b) => b.message),
			...gateResult.warnings,
		);
	} else {
		const contracts: LoadedProfileContracts = gateResult.contracts;
		registry = contracts.questionRegistry;
		warnings.push(...gateResult.warnings);
	}

	// ---- 3. Load intake state ----
	const intakeLoadResult = await loadIntakeState({
		filesystem,
		now,
		projectRoot,
	});

	if (!intakeLoadResult.ok) {
		return {
			action: undefined,
			messageKind: 'error',
			messageText: 'Failed to load intake state.',
			stateChanged: false,
			status: 'blocked',
			warnings: intakeLoadResult.errors,
		};
	}

	const intakeState: LogosIntakeState = intakeLoadResult.state;
	warnings.push(...intakeLoadResult.warnings);

	// ---- 4. Check if intake is active ----
	if (intakeState.mode !== 'intake_active') {
		return {
			action: undefined,
			messageKind: 'status',
			messageText: `Intake is not active (current mode: ${intakeState.mode}). Use /logos-start to begin.`,
			stateChanged: false,
			status: 'not_active',
			warnings: [],
		};
	}

	// ---- 5. Rebuild active prompt ----
	let activePrompt: ActivePrompt | undefined;

	if (intakeState.activePrompt !== undefined && registry !== undefined) {
		activePrompt = rebuildActivePrompt(
			intakeState.activePrompt,
			registry,
			intakeState,
		);
	}

	// ---- 6. Route via deterministic router ----
	const routeResult: RouteIntakeMessageResult = routeIntakeMessage({
		activePrompt,
		intakeState,
		message,
	});

	// ---- 7. Handle each route ----

	if (routeResult.kind === 'blocked') {
		return {
			action: undefined,
			activeQuestionId: activePrompt?.questionId,
			messageKind: 'warning',
			messageText: routeResult.reason,
			stateChanged: false,
			status: 'blocked',
			warnings: [...warnings, ...routeResult.warnings],
		};
	}

	const { action } = routeResult;
	warnings.push(...routeResult.warnings);

	switch (action.type) {
		// ---- Lifecycle command ----
		case 'handle_lifecycle_command': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText: `Lifecycle command "${action.command}" detected. Command interruption will be handled separately.`,
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Pause intake ----
		case 'pause_intake': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText: 'Pausing intake as requested.',
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Show status ----
		case 'show_status': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText:
					'Status request detected. Use /logos-status for a full status report.',
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Request generation ----
		case 'request_generation': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText:
					'Generation request detected. Use /logos-generate to run preflight and generate documentation.',
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Skip current question ----
		case 'skip_current_question': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText: `Skipping question "${action.questionId}". (Skip execution is not implemented yet.)`,
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Clarification ----
		case 'explain_active_question': {
			const clarificationBody = activePrompt
				? buildClarificationMessage(activePrompt)
				: 'There is no active question to clarify.';

			return {
				action,
				activeQuestionId: action.questionId,
				messageKind: 'clarification',
				messageText: clarificationBody,
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Revision ----
		case 'revise_previous_answer': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText:
					'Revision request detected. (Revision execution is not implemented yet.)',
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Out of scope ----
		case 'out_of_scope': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'warning',
				messageText: buildOutOfScopeMessage(),
				stateChanged: false,
				status: 'routed',
				warnings,
			};
		}

		// ---- Evaluate answer ----
		case 'evaluate_answer': {
			// Look up the question from the registry.
			const question = registry?.byId[action.questionId];
			if (question === undefined) {
				return {
					action,
					activeQuestionId: action.questionId,
					messageKind: 'error',
					messageText: `Cannot evaluate answer: question "${action.questionId}" not found in the active profile registry.`,
					stateChanged: false,
					status: 'blocked',
					warnings,
				};
			}

			// Resolve the evaluator (fallback to deterministic baseline).
			const resolvedEvaluator =
				evaluator ?? createDeterministicAnswerEvaluator();

			const evalResult = await resolvedEvaluator.evaluateAnswer({
				activePrompt,
				answer: action.message,
				intakeState,
				now,
				question,
			});

			const evalWarnings = evalResult.ok
				? [...warnings, ...evalResult.warnings]
				: [...warnings, ...evalResult.warnings];

			return {
				action,
				activeQuestionId: action.questionId,
				evaluationResult: evalResult,
				messageKind: evalResult.ok ? 'status' : 'warning',
				messageText: evalResult.ok
					? `Answer evaluated as "${evalResult.evaluation.status}" (completeness: ${evalResult.evaluation.completenessScore}).`
					: `Answer evaluation failed: ${evalResult.errors.join('; ')}`,
				stateChanged: false,
				status: 'routed',
				warnings: evalWarnings,
			};
		}

		default: {
			// Exhaustiveness check — should never reach here.
			const _exhaustive: never = action;
			return {
				action: undefined,
				messageKind: 'error',
				messageText: `Unknown route action: ${String(_exhaustive)}`,
				stateChanged: false,
				status: 'blocked',
				warnings,
			};
		}
	}
}
