/**
 * LOGOS Core — Deterministic intent router (Step 4.2).
 *
 * Routes active-intake user messages by intent before evaluation.
 * Uses simple deterministic heuristics — no AI semantic classification.
 *
 * The router classifies messages in a fixed priority order:
 *
 *  1. Empty / whitespace
 *  2. Lifecycle slash command
 *  3. Unknown slash command
 *  4. Pause intent (natural language)
 *  5. Status intent
 *  6. Generation intent
 *  7. Skip / pending intent
 *  8. Clarification intent
 *  9. Revision intent
 * 10. Out-of-scope
 * 11. Answer current question (when active prompt exists)
 * 12. Blocked (no active prompt → cannot evaluate answer)
 *
 * Command text (any message starting with `/`) is *never* routed to
 * `evaluate_answer`.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosIntakeState } from '../state/intake-state-types.js';
import type { LogosLifecycleCommand } from './detect-lifecycle-command.js';
import { detectLifecycleCommand } from './detect-lifecycle-command.js';
import type {
	IntakeIntentClassification,
	IntakeUserIntent,
} from './intake-user-intent.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// Re-export so consumers can import from a single place.
export type { LogosLifecycleCommand } from './detect-lifecycle-command.js';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type RouteIntakeMessageInput = {
	/** Raw user message text. */
	message: string;
	/** Current durable intake state. */
	intakeState: LogosIntakeState;
	/** The active prompt, if one exists. */
	activePrompt?: ActivePrompt | undefined;
};

export type RouteIntakeMessageResult =
	| {
			kind: 'routed';
			classification: IntakeIntentClassification;
			action: IntakeRouteAction;
			warnings: string[];
	  }
	| {
			kind: 'blocked';
			classification?: IntakeIntentClassification | undefined;
			reason: string;
			warnings: string[];
	  };

export type IntakeRouteAction =
	| {
			type: 'evaluate_answer';
			message: string;
			questionId: string;
	  }
	| {
			type: 'explain_active_question';
			questionId: string;
	  }
	| {
			type: 'revise_previous_answer';
			message: string;
			targetQuestionId?: string | undefined;
	  }
	| {
			type: 'pause_intake';
	  }
	| {
			type: 'skip_current_question';
			questionId: string;
			reason?: string | undefined;
	  }
	| {
			type: 'show_status';
	  }
	| {
			type: 'request_generation';
	  }
	| {
			type: 'handle_lifecycle_command';
			command: LogosLifecycleCommand;
	  }
	| {
			type: 'out_of_scope';
			message: string;
	  };

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a message for deterministic pattern matching.
 *
 * - trim leading/trailing whitespace
 * - convert to lowercase
 * - collapse repeated whitespace characters to a single space
 */
function normaliseForMatching(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Pause-intent patterns
// ---------------------------------------------------------------------------

const PAUSE_PATTERNS: readonly string[] = [
	'pause',
	'pausar',
	'stop intake',
	'interromper',
	'vamos parar',
	'parar por enquanto',
	'stop the intake',
	'pausa',
];

/**
 * Heuristic: message matches a known pause-intent pattern.
 * Checks exact normalised matches only — no partial-substring matching
 * to avoid false positives on ordinary answers.
 */
function matchesPauseIntent(normalised: string): boolean {
	return PAUSE_PATTERNS.includes(normalised);
}

// ---------------------------------------------------------------------------
// Status-intent patterns
// ---------------------------------------------------------------------------

const STATUS_PATTERNS: readonly string[] = [
	'status',
	'estado',
	'como está o progresso?',
	'como está o progresso',
	'qual o progresso?',
	'qual o progresso',
	'onde estamos?',
	'onde estamos',
	'progress?',
	'progress',
	'progresso?',
	'progresso',
	'what is the progress?',
	'what is the progress',
	"what's the progress?",
	"what's the progress",
	'show progress',
	'show status',
	'mostrar progresso',
	'mostrar status',
];

function matchesStatusIntent(normalised: string): boolean {
	return STATUS_PATTERNS.includes(normalised);
}

// ---------------------------------------------------------------------------
// Generation-intent patterns
// ---------------------------------------------------------------------------

const GENERATION_PATTERNS: readonly string[] = [
	'gerar documentação',
	'gerar documentacao',
	'pode gerar',
	'generate docs',
	'gerar agora',
	'generate documentation',
	'gerar',
	'generate',
	'gerar tudo',
	'generate all',
	'generate now',
	'gerar já',
	'gerar ja',
];

function matchesGenerationIntent(normalised: string): boolean {
	return GENERATION_PATTERNS.includes(normalised);
}

// ---------------------------------------------------------------------------
// Skip / pending-intent patterns
// ---------------------------------------------------------------------------

const SKIP_PATTERNS: readonly string[] = [
	'não sei responder agora',
	'nao sei responder agora',
	'deixa pendente',
	'pule essa',
	'pular',
	'skip this',
	'skip',
	'not sure yet',
	'não sei',
	'nao sei',
	"don't know",
	'dont know',
	'i dont know',
	"i don't know",
	'não sei responder',
	'nao sei responder',
	'deixar pendente',
	'deixar em aberto',
	'marcar como pendente',
	'pendente',
];

function matchesSkipIntent(normalised: string): boolean {
	return SKIP_PATTERNS.includes(normalised);
}

// ---------------------------------------------------------------------------
// Clarification-intent patterns
// ---------------------------------------------------------------------------

const CLARIFICATION_PATTERNS: readonly string[] = [
	'o que você quer dizer?',
	'o que voce quer dizer?',
	'o que você quer dizer',
	'o que voce quer dizer',
	'explique melhor',
	'não entendi',
	'nao entendi',
	'what do you mean?',
	'what do you mean',
	'can you clarify?',
	'can you clarify',
	'could you clarify?',
	'could you clarify',
	'please clarify',
	'explain better',
	'explain more',
	'explique',
	'explain',
	'what does that mean?',
	'what does that mean',
	'what is this question asking?',
	'me explique',
	'me explica',
];

function matchesClarificationIntent(normalised: string): boolean {
	return CLARIFICATION_PATTERNS.includes(normalised);
}

// ---------------------------------------------------------------------------
// Revision-intent patterns
// ---------------------------------------------------------------------------

const REVISION_PATTERNS: readonly string[] = [
	'quero corrigir minha resposta anterior',
	'na verdade...',
	'na verdade',
	'corrigindo',
	'let me revise',
	'let me revise that',
	'actually',
	'actually...',
	'corrigir',
	'corrigir resposta',
	'revise',
	'revise my answer',
	'revise previous answer',
	'quero mudar minha resposta',
	'quero alterar minha resposta',
	'correction',
	'correction:',
	'correção',
	'correção:',
	'correcao',
	'correcao:',
];

function matchesRevisionIntent(normalised: string): boolean {
	return REVISION_PATTERNS.includes(normalised);
}

// ---------------------------------------------------------------------------
// Out-of-scope detection
// ---------------------------------------------------------------------------

/**
 * Heuristic for out-of-scope messages.
 *
 * Returns `true` when the message is clearly not an answer to the active
 * question and is not already classified as a recognised control intent.
 *
 * Current rules (conservative):
 * - Empty/whitespace-only messages are out-of-scope.
 * - Messages that look like coding requests while intake is active.
 */
const OUT_OF_SCOPE_PREFIXES: readonly string[] = [
	'write a',
	'create a',
	'build a',
	'implement a',
	'fix the',
	'debug',
	'deploy',
	'commit',
	'git ',
	'code ',
	'refactor',
	'optimise',
	'optimize',
];

function matchesOutOfScope(normalised: string): boolean {
	// Empty/whitespace is out-of-scope.
	if (normalised.length === 0) {
		return true;
	}

	// Check coding-request prefixes.
	for (const prefix of OUT_OF_SCOPE_PREFIXES) {
		if (normalised.startsWith(prefix)) {
			return true;
		}
	}

	return false;
}

// ---------------------------------------------------------------------------
// Classification factory
// ---------------------------------------------------------------------------

function makeClassification(
	intent: IntakeUserIntent,
	confidence: number,
	reason: string,
	targetQuestionId?: string,
): IntakeIntentClassification {
	const classification: IntakeIntentClassification = {
		confidence,
		intent,
		reason,
	};
	if (targetQuestionId !== undefined) {
		classification.targetQuestionId = targetQuestionId;
	}
	return classification;
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

/**
 * Deterministically route a user message received during active intake.
 *
 * The router classifies messages in a fixed priority order:
 *
 *  1. Empty / whitespace → blocked (out_of_scope)
 *  2. Lifecycle slash command → handle_lifecycle_command
 *  3. Unknown slash command → out_of_scope (never answer-evaluated)
 *  4. Natural-language pause → pause_intake
 *  5. Natural-language status → show_status
 *  6. Natural-language generation → request_generation
 *  7. Natural-language skip / pending → skip_current_question
 *  8. Natural-language clarification → explain_active_question
 *  9. Natural-language revision → revise_previous_answer
 * 10. Out-of-scope detection → out_of_scope
 * 11. Active prompt exists → evaluate_answer
 * 12. No active prompt → blocked
 *
 * **Command text safety guarantee**: any message starting with `/` is
 * handled by routes 2 or 3 and *never* reaches `evaluate_answer`.
 *
 * @returns A structured routing result.  The result is pure and does not
 *          mutate any state.
 */
export function routeIntakeMessage(
	input: RouteIntakeMessageInput,
): RouteIntakeMessageResult {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { message, intakeState: _intakeState, activePrompt } = input;
	const normalised = normaliseForMatching(message);

	// ---- 1. Empty / whitespace ----
	if (normalised.length === 0) {
		return {
			kind: 'blocked',
			reason: 'Message is empty.',
			warnings: ['Empty message cannot be evaluated as an answer.'],
		};
	}

	// ---- 2. Lifecycle slash command ----
	const commandResult = detectLifecycleCommand(message);
	if (commandResult.detected) {
		return {
			action: {
				command: commandResult.command,
				type: 'handle_lifecycle_command',
			},
			classification: makeClassification(
				'out_of_scope',
				1.0,
				`Detected lifecycle command: ${commandResult.command}`,
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 3. Unknown slash command (never answer-evaluated) ----
	if (commandResult.isSlashCommand) {
		return {
			action: {
				message: `Unknown command: "${message.trim()}". Allowed commands: /logos-init, /logos-start, /logos-stop, /logos-status, /logos-generate.`,
				type: 'out_of_scope',
			},
			classification: makeClassification(
				'out_of_scope',
				1.0,
				'Unknown slash command.',
			),
			kind: 'routed',
			warnings: ['Unknown slash commands are never evaluated as answers.'],
		};
	}

	// ---- 4. Pause intent ----
	if (matchesPauseIntent(normalised)) {
		return {
			action: { type: 'pause_intake' },
			classification: makeClassification(
				'pause_intake',
				1.0,
				'Matched pause-intent pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 5. Status intent ----
	if (matchesStatusIntent(normalised)) {
		return {
			action: { type: 'show_status' },
			classification: makeClassification(
				'request_status',
				1.0,
				'Matched status-intent pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 6. Generation intent ----
	if (matchesGenerationIntent(normalised)) {
		return {
			action: { type: 'request_generation' },
			classification: makeClassification(
				'request_generation',
				1.0,
				'Matched generation-intent pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 7. Skip / pending intent ----
	if (matchesSkipIntent(normalised)) {
		const questionId = activePrompt?.questionId;
		if (questionId === undefined) {
			return {
				classification: makeClassification(
					'skip_current_question',
					1.0,
					'Matched skip-intent pattern, but no active question.',
				),
				kind: 'blocked',
				reason: 'Cannot skip: no active prompt / question.',
				warnings: ['Skip intent without active question is blocked.'],
			};
		}

		return {
			action: {
				questionId,
				reason: 'User indicated they cannot answer the current question.',
				type: 'skip_current_question',
			},
			classification: makeClassification(
				'skip_current_question',
				1.0,
				'Matched skip-intent pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 8. Clarification intent ----
	if (matchesClarificationIntent(normalised)) {
		const questionId = activePrompt?.questionId;
		if (questionId === undefined) {
			return {
				classification: makeClassification(
					'ask_question_about_current_question',
					1.0,
					'Matched clarification-intent pattern, but no active question.',
				),
				kind: 'blocked',
				reason: 'Cannot clarify: no active prompt / question.',
				warnings: ['Clarification intent without active question is blocked.'],
			};
		}

		return {
			action: {
				questionId,
				type: 'explain_active_question',
			},
			classification: makeClassification(
				'ask_question_about_current_question',
				1.0,
				'Matched clarification-intent pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 9. Revision intent ----
	if (matchesRevisionIntent(normalised)) {
		return {
			action: {
				message,
				type: 'revise_previous_answer',
			},
			classification: makeClassification(
				'revise_previous_answer',
				1.0,
				'Matched revision-intent pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 10. Out-of-scope ----
	if (matchesOutOfScope(normalised)) {
		return {
			action: {
				message,
				type: 'out_of_scope',
			},
			classification: makeClassification(
				'out_of_scope',
				1.0,
				'Matched out-of-scope pattern.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 11. Answer current question (when active prompt exists) ----
	if (activePrompt !== undefined && activePrompt.questionId !== undefined) {
		return {
			action: {
				message,
				questionId: activePrompt.questionId,
				type: 'evaluate_answer',
			},
			classification: makeClassification(
				'answer_current_question',
				1.0,
				'Default: message is not a control intent and an active prompt exists.',
			),
			kind: 'routed',
			warnings: [],
		};
	}

	// ---- 12. Blocked: answer-like message without active prompt ----
	return {
		classification: makeClassification(
			'answer_current_question',
			1.0,
			'Message could be an answer, but no active prompt exists.',
		),
		kind: 'blocked',
		reason:
			'Answer-like message received, but no active question is currently being asked.',
		warnings: ['No active prompt to evaluate the answer against.'],
	};
}
