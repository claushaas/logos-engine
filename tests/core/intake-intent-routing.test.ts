/**
 * Step 4.2 — Intake intent routing tests.
 *
 * Tests the deterministic intent router (`routeIntakeMessage`) for:
 * - Normal non-command answers
 * - Empty messages
 * - Pause, status, generation, skip, clarification, revision, out-of-scope intents
 * - Answer-like messages without active prompt
 * - Unknown slash commands
 * - JSON serializability of routing results
 */

import { describe, expect, it } from 'vitest';
import {
	type RouteIntakeMessageInput,
	routeIntakeMessage,
} from '../../src/core/intake/deterministic-intent-router.js';
import type { ActivePrompt } from '../../src/core/intake/prompt-selection-types.js';
import type { LogosIntakeState } from '../../src/core/state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createActivePromptFixture(
	overrides: Partial<ActivePrompt> = {},
): ActivePrompt {
	return {
		context: undefined,
		documentId: '01-thesis',
		kind: 'question',
		phaseId: '01-foundation',
		priority: 'critical',
		questionId: 'q-1',
		required: true,
		sectionId: 'core-thesis',
		text: 'What is the central thesis that justifies this project existing?',
		...overrides,
	};
}

function createIntakeStateFixture(
	overrides: Partial<LogosIntakeState> = {},
): LogosIntakeState {
	return {
		activePrompt: undefined,
		activeQuestionId: undefined,
		answeredQuestions: {},
		contradictions: {},
		initializedAt: '2026-01-01T00:00:00.000Z',
		mode: 'intake_active',
		partialQuestions: {},
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 0,
			partial: 0,
			skipped: 0,
			sufficient: 0,
			total: 0,
		},
		projectRoot: '/tmp/test',
		skippedQuestions: {},
		updatedAt: '2026-01-01T00:00:00.000Z',
		version: 1,
		...overrides,
	};
}

function createRoutingInput(
	message: string,
	overrides: Partial<RouteIntakeMessageInput> = {},
): RouteIntakeMessageInput {
	return {
		activePrompt: createActivePromptFixture(),
		intakeState: createIntakeStateFixture(),
		message,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function isActionType(
	result: ReturnType<typeof routeIntakeMessage>,
	type: string,
) {
	return result.kind === 'routed' && result.action.type === type;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('routeIntakeMessage — normal answers', () => {
	// Test 1: Normal non-command answer routes to evaluate_answer.
	it('normal non-command answer routes to evaluate_answer', () => {
		const result = routeIntakeMessage(
			createRoutingInput('My project is about building a better task manager.'),
		);
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('evaluate_answer');
			if (result.action.type === 'evaluate_answer') {
				expect(result.action.questionId).toBe('q-1');
				expect(result.action.message).toBe(
					'My project is about building a better task manager.',
				);
			}
		}
	});

	// Test 2: Short answer routes to evaluate_answer.
	it('short answer routes to evaluate_answer', () => {
		const result = routeIntakeMessage(createRoutingInput('Yes, it is.'));
		expect(isActionType(result, 'evaluate_answer')).toBe(true);
	});

	// Test 3: Portuguese answer routes to evaluate_answer.
	it('Portuguese answer routes to evaluate_answer', () => {
		const result = routeIntakeMessage(
			createRoutingInput('Meu projeto é um sistema de documentação.'),
		);
		expect(isActionType(result, 'evaluate_answer')).toBe(true);
	});

	// Test 4: Classification intent is correct for normal answers.
	it('classification intent is answer_current_question for normal answers', () => {
		const result = routeIntakeMessage(createRoutingInput('My answer here.'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.classification.intent).toBe('answer_current_question');
			expect(result.classification.confidence).toBe(1.0);
		}
	});
});

describe('routeIntakeMessage — empty messages', () => {
	// Test 5: Empty message does not route to answer evaluation.
	it('empty message does not route to answer evaluation', () => {
		const result = routeIntakeMessage(createRoutingInput(''));
		expect(result.kind).toBe('blocked');
		expect(result.reason).toContain('empty');
	});

	// Test 6: Whitespace-only message does not route to answer evaluation.
	it('whitespace-only message does not route to answer evaluation', () => {
		const result = routeIntakeMessage(createRoutingInput('   \t  \n  '));
		expect(result.kind).toBe('blocked');
		expect(result.reason).toContain('empty');
	});
});

describe('routeIntakeMessage — pause intent', () => {
	// Test 7: Pause phrase routes to pause.
	it('"pause" routes to pause_intake', () => {
		const result = routeIntakeMessage(createRoutingInput('pause'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"stop intake" routes to pause_intake', () => {
		const result = routeIntakeMessage(createRoutingInput('stop intake'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"pausar" routes to pause_intake', () => {
		const result = routeIntakeMessage(createRoutingInput('pausar'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"vamos parar" routes to pause_intake', () => {
		const result = routeIntakeMessage(createRoutingInput('vamos parar'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"interromper" routes to pause_intake', () => {
		const result = routeIntakeMessage(createRoutingInput('interromper'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});
});

describe('routeIntakeMessage — status intent', () => {
	// Test 8: Status phrase routes to status.
	it('"status" routes to show_status', () => {
		const result = routeIntakeMessage(createRoutingInput('status'));
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	it('"como está o progresso?" routes to show_status', () => {
		const result = routeIntakeMessage(
			createRoutingInput('como está o progresso?'),
		);
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	it('"qual o progresso?" routes to show_status', () => {
		const result = routeIntakeMessage(createRoutingInput('qual o progresso?'));
		expect(isActionType(result, 'show_status')).toBe(true);
	});
});

describe('routeIntakeMessage — generation intent', () => {
	// Test 9: Generation phrase routes to request_generation.
	it('"gerar documentação" routes to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('gerar documentação'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});

	it('"generate docs" routes to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('generate docs'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});

	it('"gerar agora" routes to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('gerar agora'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});

	it('"generate" routes to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('generate'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});
});

describe('routeIntakeMessage — skip / pending intent', () => {
	// Test 10: Skip/pending phrase routes to skip_current_question.
	it('"skip this" routes to skip_current_question', () => {
		const result = routeIntakeMessage(createRoutingInput('skip this'));
		expect(isActionType(result, 'skip_current_question')).toBe(true);
	});

	it('"não sei responder agora" routes to skip_current_question', () => {
		const result = routeIntakeMessage(
			createRoutingInput('não sei responder agora'),
		);
		expect(isActionType(result, 'skip_current_question')).toBe(true);
	});

	it('"deixa pendente" routes to skip_current_question', () => {
		const result = routeIntakeMessage(createRoutingInput('deixa pendente'));
		expect(isActionType(result, 'skip_current_question')).toBe(true);
	});

	it('"not sure yet" routes to skip_current_question', () => {
		const result = routeIntakeMessage(createRoutingInput('not sure yet'));
		expect(isActionType(result, 'skip_current_question')).toBe(true);
	});
});

describe('routeIntakeMessage — clarification intent', () => {
	// Test 11: Clarification phrase routes to explain_active_question.
	it('"o que você quer dizer?" routes to explain_active_question', () => {
		const result = routeIntakeMessage(
			createRoutingInput('o que você quer dizer?'),
		);
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});

	it('"não entendi" routes to explain_active_question', () => {
		const result = routeIntakeMessage(createRoutingInput('não entendi'));
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});

	it('"what do you mean?" routes to explain_active_question', () => {
		const result = routeIntakeMessage(createRoutingInput('what do you mean?'));
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});

	it('"can you clarify?" routes to explain_active_question', () => {
		const result = routeIntakeMessage(createRoutingInput('can you clarify?'));
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});

	it('"explique melhor" routes to explain_active_question', () => {
		const result = routeIntakeMessage(createRoutingInput('explique melhor'));
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});
});

describe('routeIntakeMessage — revision intent', () => {
	// Test 12: Revision phrase routes to revise_previous_answer.
	it('"na verdade" routes to revise_previous_answer', () => {
		const result = routeIntakeMessage(createRoutingInput('na verdade'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});

	it('"actually" routes to revise_previous_answer', () => {
		const result = routeIntakeMessage(createRoutingInput('actually'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});

	it('"let me revise" routes to revise_previous_answer', () => {
		const result = routeIntakeMessage(createRoutingInput('let me revise'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});

	it('"corrigindo" routes to revise_previous_answer', () => {
		const result = routeIntakeMessage(createRoutingInput('corrigindo'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});
});

describe('routeIntakeMessage — out-of-scope', () => {
	// Test 13: Out-of-scope phrase routes to out_of_scope.
	it('coding request routes to out_of_scope', () => {
		const result = routeIntakeMessage(
			createRoutingInput('write a function to sort arrays'),
		);
		expect(isActionType(result, 'out_of_scope')).toBe(true);
	});

	it('"fix the bug" routes to out_of_scope', () => {
		const result = routeIntakeMessage(createRoutingInput('fix the bug'));
		expect(isActionType(result, 'out_of_scope')).toBe(true);
	});

	it('unknown slash command routes to out_of_scope', () => {
		const result = routeIntakeMessage(
			createRoutingInput('/some-unknown-command'),
		);
		expect(isActionType(result, 'out_of_scope')).toBe(true);
	});
});

describe('routeIntakeMessage — no active prompt', () => {
	// Test 14: Answer-like message with no active prompt is blocked.
	it('answer-like message with no active prompt is blocked', () => {
		const result = routeIntakeMessage(
			createRoutingInput('This is a good answer to the question.', {
				activePrompt: undefined,
			}),
		);
		expect(result.kind).toBe('blocked');
		expect(result.reason).toContain('no active');
	});

	it('answer-like message with no active prompt has correct warnings', () => {
		const result = routeIntakeMessage(
			createRoutingInput('An answer without a prompt.', {
				activePrompt: undefined,
			}),
		);
		expect(result.kind).toBe('blocked');
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings.some((w) => w.includes('No active prompt'))).toBe(
			true,
		);
	});
});

describe('routeIntakeMessage — deterministic order', () => {
	// Test 15: Route order is deterministic — pause overrides evaluation.
	it('"pause" is routed before answer evaluation even when active prompt exists', () => {
		// Even though "pause" could be a weird answer, it should route to
		// pause_intake because pause has higher priority.
		const result = routeIntakeMessage(createRoutingInput('pause'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	// Test 16: Status overrides answer evaluation.
	it('"status" routes to show_status even with active prompt', () => {
		const result = routeIntakeMessage(createRoutingInput('status'));
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	// Test 17: Command overrides natural-language pause.
	it('slash command overrides pause-like text', () => {
		// Even though the word "pause" isn't in a command, /logos-stop should be
		// detected as a command, not a natural-language pause.
		const result = routeIntakeMessage(createRoutingInput('/logos-stop'));
		expect(isActionType(result, 'handle_lifecycle_command')).toBe(true);
		expect(isActionType(result, 'pause_intake')).toBe(false);
	});
});

describe('routeIntakeMessage — JSON serializability', () => {
	it('routed result is JSON-serializable', () => {
		const result = routeIntakeMessage(
			createRoutingInput('This is a test answer.'),
		);
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.kind).toBe(result.kind);
	});

	it('blocked result is JSON-serializable', () => {
		const result = routeIntakeMessage(
			createRoutingInput('An answer without a prompt.', {
				activePrompt: undefined,
			}),
		);
		const json = JSON.stringify(result);
		expect(typeof json).toBe('string');
		const parsed = JSON.parse(json) as typeof result;
		expect(parsed.kind).toBe('blocked');
	});

	it('evaluate_answer result has all required action fields', () => {
		const result = routeIntakeMessage(
			createRoutingInput('My answer text here.'),
		);
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed' && result.action.type === 'evaluate_answer') {
			expect(result.action.questionId).toBe('q-1');
			expect(result.action.message).toBe('My answer text here.');
		}
	});
});

describe('routeIntakeMessage — conservative heuristics', () => {
	it('messages containing "pause" as part of a larger word are NOT misclassified', () => {
		// The normalised message must be an exact match against the pattern
		// list, not a substring match.  "pausing" != "pause".
		const result = routeIntakeMessage(
			createRoutingInput(
				'I am pausing to think about the thesis for this project.',
			),
		);
		expect(isActionType(result, 'evaluate_answer')).toBe(true);
	});

	it('messages containing "status" as part of a sentence route to evaluate_answer', () => {
		const result = routeIntakeMessage(
			createRoutingInput('The status of the project is unclear.'),
		);
		// "status" is in the pattern list, but the full normalised message is
		// "the status of the project is unclear." — NOT an exact match.
		expect(isActionType(result, 'evaluate_answer')).toBe(true);
	});

	it('long messages are not misclassified as control intents', () => {
		const result = routeIntakeMessage(
			createRoutingInput(
				'The central thesis of my project is that existing tools fail to capture project intent, and LOGOS should bridge that gap by being conversational and structured.',
			),
		);
		expect(isActionType(result, 'evaluate_answer')).toBe(true);
	});
});
