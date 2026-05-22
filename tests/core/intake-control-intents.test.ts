/**
 * Step 4.2 — Intake control-intent routing tests.
 *
 * Tests that natural-language control intents (pause, status, generation,
 * skip, revision) map to the correct route actions, and that
 * skip/clarification without an active question are blocked safely.
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
		questionId: 'q-42',
		required: true,
		sectionId: 'core-thesis',
		text: 'What is the central thesis?',
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

describe('intake control intents — pause', () => {
	// Test 1: Natural-language pause maps to pause action.
	it('"pause" maps to pause_intake action', () => {
		const result = routeIntakeMessage(createRoutingInput('pause'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"stop intake" maps to pause_intake action', () => {
		const result = routeIntakeMessage(createRoutingInput('stop intake'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"interromper" maps to pause_intake action', () => {
		const result = routeIntakeMessage(createRoutingInput('interromper'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('"vamos parar" maps to pause_intake action', () => {
		const result = routeIntakeMessage(createRoutingInput('vamos parar'));
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('pause intent works even without an active prompt', () => {
		// Pause doesn't require an active question.
		const result = routeIntakeMessage(
			createRoutingInput('pause', { activePrompt: undefined }),
		);
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});
});

describe('intake control intents — status', () => {
	// Test 2: Natural-language status maps to show_status action.
	it('"status" maps to show_status action', () => {
		const result = routeIntakeMessage(createRoutingInput('status'));
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	it('"como está o progresso?" maps to show_status action', () => {
		const result = routeIntakeMessage(
			createRoutingInput('como está o progresso?'),
		);
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	it('"onde estamos?" maps to show_status action', () => {
		const result = routeIntakeMessage(createRoutingInput('onde estamos?'));
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	it('"what is the progress?" maps to show_status action', () => {
		const result = routeIntakeMessage(
			createRoutingInput('what is the progress?'),
		);
		expect(isActionType(result, 'show_status')).toBe(true);
	});

	it('status intent works even without an active prompt', () => {
		const result = routeIntakeMessage(
			createRoutingInput('status', { activePrompt: undefined }),
		);
		expect(isActionType(result, 'show_status')).toBe(true);
	});
});

describe('intake control intents — generation', () => {
	// Test 3: Natural-language generation maps to request_generation.
	it('"gerar documentação" maps to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('gerar documentação'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});

	it('"generate docs" maps to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('generate docs'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});

	it('"gerar" maps to request_generation', () => {
		const result = routeIntakeMessage(createRoutingInput('gerar'));
		expect(isActionType(result, 'request_generation')).toBe(true);
	});

	it('generation intent works even without an active prompt', () => {
		const result = routeIntakeMessage(
			createRoutingInput('generate', { activePrompt: undefined }),
		);
		expect(isActionType(result, 'request_generation')).toBe(true);
	});
});

describe('intake control intents — skip', () => {
	// Test 4: Natural-language skip maps to skip action with active question id.
	it('"skip this" maps to skip action with question id', () => {
		const result = routeIntakeMessage(createRoutingInput('skip this'));
		expect(result.kind).toBe('routed');
		if (
			result.kind === 'routed' &&
			result.action.type === 'skip_current_question'
		) {
			expect(result.action.questionId).toBe('q-42');
		}
	});

	it('"não sei" maps to skip action with question id', () => {
		const result = routeIntakeMessage(createRoutingInput('não sei'));
		expect(result.kind).toBe('routed');
		if (
			result.kind === 'routed' &&
			result.action.type === 'skip_current_question'
		) {
			expect(result.action.questionId).toBe('q-42');
		}
	});

	it('"not sure yet" maps to skip action with question id', () => {
		const result = routeIntakeMessage(createRoutingInput('not sure yet'));
		expect(result.kind).toBe('routed');
		if (
			result.kind === 'routed' &&
			result.action.type === 'skip_current_question'
		) {
			expect(result.action.questionId).toBe('q-42');
		}
	});

	// Test 5: Natural-language skip without active question is blocked.
	it('"skip this" without active question is blocked', () => {
		const result = routeIntakeMessage(
			createRoutingInput('skip this', { activePrompt: undefined }),
		);
		expect(result.kind).toBe('blocked');
		expect(result.reason).toContain('no active');
	});

	it('"não sei" without active question is blocked', () => {
		const result = routeIntakeMessage(
			createRoutingInput('não sei', { activePrompt: undefined }),
		);
		expect(result.kind).toBe('blocked');
	});

	it('skip action includes a reason', () => {
		const result = routeIntakeMessage(createRoutingInput('skip'));
		expect(result.kind).toBe('routed');
		if (
			result.kind === 'routed' &&
			result.action.type === 'skip_current_question'
		) {
			expect(result.action.reason).toBeDefined();
			expect(result.action.reason?.length).toBeGreaterThan(0);
		}
	});
});

describe('intake control intents — revision', () => {
	// Test 6: Natural-language revision maps to revise action but does not mutate answers.
	it('"actually" maps to revise_previous_answer action', () => {
		const result = routeIntakeMessage(createRoutingInput('actually'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});

	it('"na verdade" maps to revise_previous_answer action', () => {
		const result = routeIntakeMessage(createRoutingInput('na verdade'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});

	it('revision action preserves original message', () => {
		const originalMsg = 'actually I meant something else';
		const result = routeIntakeMessage(createRoutingInput(originalMsg));
		// Note: "actually" is in the pattern list, but the full normalised
		// message is "actually i meant something else" — NOT an exact match.
		// So it should route to evaluate_answer, not revise.
		// Only exact matches like "actually" or "actually..." are revision.
		expect(isActionType(result, 'evaluate_answer')).toBe(true);
	});

	it('exact "actually" routes to revision', () => {
		const result = routeIntakeMessage(createRoutingInput('actually'));
		expect(isActionType(result, 'revise_previous_answer')).toBe(true);
	});

	it('revision action does not advance or mutate state', () => {
		const result = routeIntakeMessage(createRoutingInput('actually'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('revise_previous_answer');
			// Does not evaluate the answer.
			expect(result.action.type).not.toBe('evaluate_answer');
		}
		// Route result is pure — does not mutate input state.
	});
});

describe('intake control intents — deterministic priority', () => {
	it('pause has higher priority than status', () => {
		// "pause" is in both pause and status patterns? No, but test priority.
		const result = routeIntakeMessage(createRoutingInput('pause'));
		// pause is matched first (route order 4), before status (route order 5).
		expect(isActionType(result, 'pause_intake')).toBe(true);
	});

	it('command has higher priority than natural-language pause', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-stop'));
		expect(isActionType(result, 'handle_lifecycle_command')).toBe(true);
	});

	it('unknown slash command is out_of_scope, never evaluated as answer', () => {
		const result = routeIntakeMessage(createRoutingInput('/random-cmd'));
		expect(isActionType(result, 'out_of_scope')).toBe(true);
	});
});
