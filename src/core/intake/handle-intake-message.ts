/**
 * LOGOS Core — Handle intake message transition (Steps 4.2 + 4.4).
 *
 * Core-owned logic for processing a user message during active intake mode.
 *
 * This module:
 * 1. Loads durable intake state.
 * 2. Rebuilds the active prompt from state + registry.
 * 3. Calls the deterministic intent router.
 * 4. Applies validated evaluations to state.
 * 5. Persists state after every state-changing transition.
 * 6. Returns the next assistant action.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { loadLogosConfig } from '../config/load-config.js';
import type {
	AnswerEvaluator,
	EvaluateAnswerResult,
} from '../evaluation/answer-evaluator-port.js';
import { createDeterministicAnswerEvaluator } from '../evaluation/deterministic-evaluator.js';
import { validateAnswerEvaluation } from '../evaluation/evaluation-validation.js';
import type { AssistantMessage } from '../messages.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import type { LoadedProfileContracts } from '../profiles/profile-contracts.js';
import { ensureProfileReady } from '../profiles/profile-gate.js';
import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import type { LogosQuestion } from '../questions/question-types.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../state/intake-state-persistence.js';
import type {
	ActivePromptState,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import {
	createContradictionPrompt,
	createFollowUpPrompt,
	createQuestionPrompt,
} from './active-prompt.js';
import type { EvaluationTransition } from './apply-evaluation.js';
import { applyAnswerEvaluation } from './apply-evaluation.js';
import { createAssistantMessageFromPrompt } from './assistant-message-from-prompt.js';
import type {
	IntakeRouteAction,
	RouteIntakeMessageResult,
} from './deterministic-intent-router.js';
import { routeIntakeMessage } from './deterministic-intent-router.js';
import { selectNextPrompt } from './next-prompt-selector.js';
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

/**
 * The transition classification exposed to the public API.
 * Mirrors {@link EvaluationTransition} with additional routing transitions.
 */
export type MessageTransition =
	| 'answer_accepted'
	| 'follow_up_requested'
	| 'clarification_requested'
	| 'contradiction_recorded'
	| 'insufficient_answer'
	| 'pending_recorded'
	| 'skipped'
	| 'status_requested'
	| 'generation_requested'
	| 'pause_requested'
	| 'out_of_scope'
	| 'command_control'
	| 'blocked'
	| 'complete';

export type HandleIntakeMessageTransitionResult = {
	status: 'blocked' | 'routed' | 'not_active' | 'complete';
	action?: IntakeRouteAction | undefined;
	/** Human-readable message text for the assistant. */
	messageText: string;
	/** Kind classification for the Pi Extension renderer. */
	messageKind: AssistantMessage['kind'];
	warnings: string[];
	activeQuestionId?: string | undefined;
	stateChanged: boolean;
	/**
	 * Present when the router dispatched to answer evaluation and the
	 * evaluator was called.  Contains the structured evaluation result.
	 */
	evaluationResult?: EvaluateAnswerResult | undefined;
	/**
	 * The semantic transition that occurred (set when state changed or
	 * a control intent was routed).
	 */
	transition?: MessageTransition | undefined;
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
// Skip handler
// ---------------------------------------------------------------------------

function handleSkip(
	question: LogosQuestion | undefined,
	activePrompt: ActivePrompt | undefined,
	intakeState: LogosIntakeState,
	now: string,
): {
	state: LogosIntakeState;
	messageText: string;
	messageKind: AssistantMessage['kind'];
	transition: MessageTransition;
	advanceToNext: boolean;
} {
	// Cannot skip without active prompt / question.
	if (question === undefined || activePrompt === undefined) {
		return {
			advanceToNext: false,
			messageKind: 'warning',
			messageText: 'Cannot skip: no active question is currently being asked.',
			state: intakeState,
			transition: 'blocked',
		};
	}

	const state = { ...intakeState, updatedAt: now };
	state.skippedQuestions = { ...intakeState.skippedQuestions };
	state.partialQuestions = { ...intakeState.partialQuestions };

	if (question.required) {
		// Required question: record as partial/pending so it can be
		// revisited.  Do NOT mark as sufficient.
		state.partialQuestions[question.id] = {
			metadata: { skippedRequired: true },
			missingAspects: [],
			questionId: question.id,
			reason:
				'User indicated they cannot answer this required question right now.',
			recordedAt: now,
		};

		// Also record as skipped so it shows in progress.
		state.skippedQuestions[question.id] = {
			questionId: question.id,
			reason: 'User requested skip; required question recorded as partial.',
			skippedAt: now,
		};

		// Clear active prompt so selector can pick the next question.
		delete state.activePrompt;
		delete state.activeQuestionId;

		return {
			advanceToNext: true,
			messageKind: 'status',
			messageText:
				'This question is required and will need to be revisited. Moving to the next question.',
			state,
			transition: 'pending_recorded',
		};
	}

	// Optional question: record skipped and advance.
	state.skippedQuestions[question.id] = {
		questionId: question.id,
		reason: 'User chose to skip this optional question.',
		skippedAt: now,
	};

	// Remove partial state if present.
	delete state.partialQuestions[question.id];

	// Clear active prompt so selector picks next.
	delete state.activePrompt;
	delete state.activeQuestionId;

	return {
		advanceToNext: true,
		messageKind: 'status',
		messageText: 'Skipped this optional question. Moving to the next question.',
		state,
		transition: 'skipped',
	};
}

// ---------------------------------------------------------------------------
// Persist helper
// ---------------------------------------------------------------------------

async function persistIfDryRun(
	state: LogosIntakeState,
	input: HandleIntakeMessageTransitionInput,
): Promise<void> {
	if (!input.dryRun) {
		await saveIntakeState({
			filesystem: input.filesystem,
			projectRoot: input.projectRoot,
			state,
		});
	}
}

// ---------------------------------------------------------------------------
// Resolve evaluator
// ---------------------------------------------------------------------------

function resolveEvaluator(
	evaluator: AnswerEvaluator | undefined,
): AnswerEvaluator {
	return evaluator ?? createDeterministicAnswerEvaluator();
}

// ---------------------------------------------------------------------------
// Main transition
// ---------------------------------------------------------------------------

/**
 * Process a user message during active intake mode.
 *
 * Required behaviour (from the spec):
 * - Loads intake state.
 * - Rebuilds the active prompt for routing context.
 * - Routes via deterministic {@link routeIntakeMessage}.
 * - Never submits command text to answer evaluation.
 * - Evaluates answers through the {@link AnswerEvaluator} port.
 * - Applies evaluations to durable state.
 * - On sufficient: persists answer, selects next prompt, returns it.
 * - On partial: persists partial state, returns targeted follow-up.
 * - On contradiction: persists contradiction, returns resolution prompt.
 * - On insufficient: returns clarification without advancing.
 * - On skip/pending: handles according to question policy.
 * - On clarification: explains without advancing.
 * - On out-of-scope: explains without advancing.
 * - Persists state after every state-changing path.
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
			transition: 'blocked',
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
			transition: 'blocked',
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
			transition: 'blocked',
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
			transition: 'blocked',
			warnings: [...warnings, ...routeResult.warnings],
		};
	}

	const { action } = routeResult;
	warnings.push(...routeResult.warnings);

	switch (action.type) {
		// ============================================================
		// Lifecycle command
		// ============================================================
		case 'handle_lifecycle_command': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText: `Lifecycle command "${action.command}" detected. Command interruption will be handled separately.`,
				stateChanged: false,
				status: 'routed',
				transition: 'command_control',
				warnings,
			};
		}

		// ============================================================
		// Pause intake
		// ============================================================
		case 'pause_intake': {
			// Actually pause the intake state (set mode to 'paused',
			// preserve active prompt and question, and persist).
			const pausedState: LogosIntakeState = {
				...intakeState,
				mode: 'paused' as const,
				updatedAt: now,
			};
			// Do not clear activePrompt or activeQuestionId — preserve
			// so /logos-start can resume at the same question.

			await persistIfDryRun(pausedState, input);

			const progressParts: string[] = [];
			const pr = pausedState.progress;
			if (pr.sufficient > 0) {
				progressParts.push(`${pr.sufficient} sufficient`);
			}
			if (pr.partial > 0) {
				progressParts.push(`${pr.partial} partial`);
			}
			if (pr.missing > 0) {
				progressParts.push(`${pr.missing} missing`);
			}
			const progressText =
				progressParts.length > 0
					? `Progress: ${progressParts.join(', ')} (${pr.sufficient}/${pr.total} complete).`
					: 'No questions answered yet.';

			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText: `Intake paused. ${progressText}`,
				stateChanged: true,
				status: 'routed',
				transition: 'pause_requested',
				warnings,
			};
		}

		// ============================================================
		// Show status
		// ============================================================
		case 'show_status': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText:
					'Status request detected. Use /logos-status for a full status report.',
				stateChanged: false,
				status: 'routed',
				transition: 'status_requested',
				warnings,
			};
		}

		// ============================================================
		// Request generation
		// ============================================================
		case 'request_generation': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText:
					'Generation request detected. Use /logos-generate to run preflight and generate documentation.',
				stateChanged: false,
				status: 'routed',
				transition: 'generation_requested',
				warnings,
			};
		}

		// ============================================================
		// Skip current question
		// ============================================================
		case 'skip_current_question': {
			const question = activePrompt?.questionId
				? registry?.byId[activePrompt.questionId]
				: undefined;

			const skipResult = handleSkip(question, activePrompt, intakeState, now);

			if (!skipResult.advanceToNext) {
				return {
					action,
					activeQuestionId: activePrompt?.questionId,
					messageKind: skipResult.messageKind,
					messageText: skipResult.messageText,
					stateChanged: false,
					status: 'blocked',
					transition: skipResult.transition,
					warnings,
				};
			}

			// Advance to next question.
			const updatedState = skipResult.state;

			if (registry === undefined) {
				return {
					action,
					activeQuestionId: undefined,
					messageKind: 'warning',
					messageText:
						'Cannot select next question: profile registry unavailable.',
					stateChanged: false,
					status: 'blocked',
					transition: 'blocked',
					warnings,
				};
			}

			const selection = selectNextPrompt({
				intakeState: updatedState,
				registry,
			});

			if (selection.status === 'selected') {
				// Persist the new prompt state.
				updatedState.activePrompt = {
					kind: selection.prompt.kind,
					questionId: selection.prompt.questionId,
					startedAt: now,
					updatedAt: now,
				};
				updatedState.activeQuestionId = selection.prompt.questionId;
				updatedState.mode = 'intake_active';

				await persistIfDryRun(updatedState, input);

				const msg = createAssistantMessageFromPrompt(selection.prompt);

				return {
					action,
					activeQuestionId: selection.prompt.questionId,
					messageKind: msg.kind,
					messageText: msg.body,
					stateChanged: true,
					status: 'routed',
					transition: skipResult.transition,
					warnings: [...warnings, ...selection.warnings],
				};
			}

			// Complete or blocked.
			if (selection.status === 'complete') {
				updatedState.mode = 'complete';
				delete updatedState.activePrompt;
				delete updatedState.activeQuestionId;

				await persistIfDryRun(updatedState, input);

				return {
					action,
					activeQuestionId: undefined,
					messageKind: 'completion',
					messageText:
						'All intake questions have been addressed. Use /logos-generate to produce documentation.',
					stateChanged: true,
					status: 'complete',
					transition: 'complete',
					warnings,
				};
			}

			// Blocked.
			return {
				action,
				activeQuestionId: undefined,
				messageKind: 'warning',
				messageText: selection.blockers.join('; '),
				stateChanged: false,
				status: 'blocked',
				transition: 'blocked',
				warnings,
			};
		}

		// ============================================================
		// Clarification
		// ============================================================
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
				transition: 'clarification_requested',
				warnings,
			};
		}

		// ============================================================
		// Revision
		// ============================================================
		case 'revise_previous_answer': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'status',
				messageText:
					'Revision request detected. (Revision execution is not implemented yet.)',
				stateChanged: false,
				status: 'routed',
				transition: 'blocked',
				warnings,
			};
		}

		// ============================================================
		// Out of scope
		// ============================================================
		case 'out_of_scope': {
			return {
				action,
				activeQuestionId: activePrompt?.questionId,
				messageKind: 'warning',
				messageText: buildOutOfScopeMessage(),
				stateChanged: false,
				status: 'routed',
				transition: 'out_of_scope',
				warnings,
			};
		}

		// ============================================================
		// Evaluate answer (MAIN PATH — Step 4.4)
		// ============================================================
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
					transition: 'blocked',
					warnings,
				};
			}

			// Guard: active prompt required for evaluating answer context.
			if (activePrompt === undefined) {
				return {
					action,
					activeQuestionId: action.questionId,
					messageKind: 'error',
					messageText:
						'Cannot evaluate answer: no active prompt exists to provide question context.',
					stateChanged: false,
					status: 'blocked',
					transition: 'blocked',
					warnings,
				};
			}

			// ---- Call evaluator (deterministic fallback if none provided) ----
			const resolvedEvaluator = resolveEvaluator(evaluator);

			const evalResult = await resolvedEvaluator.evaluateAnswer({
				activePrompt,
				answer: action.message,
				intakeState,
				now,
				question,
			});

			const evalWarnings = [...warnings, ...evalResult.warnings];

			if (!evalResult.ok) {
				// Evaluator returned an error — do not mutate state.
				return {
					action,
					activeQuestionId: action.questionId,
					evaluationResult: evalResult,
					messageKind: 'warning',
					messageText: `Answer evaluation failed: ${evalResult.errors.join('; ')}`,
					stateChanged: false,
					status: 'routed',
					transition: 'blocked',
					warnings: evalWarnings,
				};
			}

			// ---- Validate evaluator output ----
			const validation = validateAnswerEvaluation(evalResult.evaluation);
			if (!validation.ok) {
				return {
					action,
					activeQuestionId: action.questionId,
					evaluationResult: {
						errors: validation.errors,
						ok: false,
						warnings: validation.warnings,
					},
					messageKind: 'warning',
					messageText: `Evaluator produced invalid output: ${validation.errors.join('; ')}`,
					stateChanged: false,
					status: 'routed',
					transition: 'blocked',
					warnings: [...evalWarnings, ...validation.warnings],
				};
			}

			const validatedEval = validation.evaluation;
			const evalOkResult: EvaluateAnswerResult = {
				evaluation: validatedEval,
				ok: true,
				warnings: validation.warnings,
			};

			// ---- Apply evaluation to state ----
			const applyResult = applyAnswerEvaluation({
				activePrompt,
				answer: action.message,
				evaluation: validatedEval,
				intakeState,
				now,
				question,
			});

			const allWarnings = [...evalWarnings, ...applyResult.warnings];

			// ---- Handle transition ----
			if (applyResult.transition === 'answer_accepted') {
				// Sufficient answer + shouldAdvance.
				// Persist updated state, then select next prompt.
				const updatedState = applyResult.state;

				if (registry === undefined) {
					return {
						action,
						activeQuestionId: question.id,
						evaluationResult: evalOkResult,
						messageKind: 'warning',
						messageText:
							'Answer accepted, but cannot select next question: profile registry unavailable.',
						stateChanged: false,
						status: 'blocked',
						transition: 'blocked',
						warnings: allWarnings,
					};
				}

				const selection = selectNextPrompt({
					intakeState: updatedState,
					registry,
				});

				if (selection.status === 'selected') {
					// Persist the new prompt state.
					updatedState.activePrompt = {
						kind: selection.prompt.kind,
						questionId: selection.prompt.questionId,
						startedAt: now,
						updatedAt: now,
					};
					updatedState.activeQuestionId = selection.prompt.questionId;
					updatedState.mode = 'intake_active';

					await persistIfDryRun(updatedState, input);

					const msg = createAssistantMessageFromPrompt(selection.prompt);

					return {
						action,
						activeQuestionId: selection.prompt.questionId,
						evaluationResult: evalOkResult,
						messageKind: msg.kind,
						messageText: msg.body,
						stateChanged: true,
						status: 'routed',
						transition: 'answer_accepted',
						warnings: [...allWarnings, ...selection.warnings],
					};
				}

				if (selection.status === 'complete') {
					updatedState.mode = 'complete';
					delete updatedState.activePrompt;
					delete updatedState.activeQuestionId;

					await persistIfDryRun(updatedState, input);

					return {
						action,
						activeQuestionId: undefined,
						evaluationResult: evalOkResult,
						messageKind: 'completion',
						messageText:
							'All intake questions have been addressed. Use /logos-generate to produce documentation.',
						stateChanged: true,
						status: 'complete',
						transition: 'complete',
						warnings: allWarnings,
					};
				}

				// Blocked.
				return {
					action,
					activeQuestionId: question.id,
					evaluationResult: evalOkResult,
					messageKind: 'warning',
					messageText: selection.blockers.join('; '),
					stateChanged: false,
					status: 'blocked',
					transition: 'blocked',
					warnings: allWarnings,
				};
			}

			// ---- Non-advancing transitions ----
			// (follow_up_requested, clarification_requested, contradiction_recorded, insufficient_answer)
			await persistIfDryRun(applyResult.state, input);

			// Build assistant message from the next-prompt hint.
			let msg: AssistantMessage;
			if (applyResult.nextPromptHint !== undefined) {
				msg = createAssistantMessageFromPrompt(applyResult.nextPromptHint);
			} else {
				// Fallback (shouldn't normally happen for non-advancing).
				msg = {
					body: `Answer evaluated as "${validatedEval.status}". Please continue.`,
					kind: 'status' as const,
					questionId: question.id,
				};
			}

			return {
				action,
				activeQuestionId: question.id,
				evaluationResult: evalOkResult,
				messageKind: msg.kind,
				messageText: msg.body,
				stateChanged: true,
				status: 'routed',
				transition: applyResult.transition,
				warnings: allWarnings,
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
				transition: 'blocked',
				warnings,
			};
		}
	}
}
