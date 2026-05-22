/**
 * Step 4.2 — Intake clarification routing tests.
 *
 * Tests that clarification requests:
 * 1. Map to explain_active_question.
 * 2. Include the active question id in the result.
 * 3. Do not advance the intake prompt.
 * 4. Are not evaluated as answers.
 * 5. Without an active prompt are blocked or handled safely.
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
		context: 'This question is about the project thesis.',
		documentId: '01-thesis',
		kind: 'question',
		phaseId: '01-foundation',
		priority: 'critical',
		questionId: 'q-foundation-thesis',
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

describe('clarification routing — happy path', () => {
	// Test 1: Clarification request maps to explain active question.
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

	it('"please clarify" routes to explain_active_question', () => {
		const result = routeIntakeMessage(createRoutingInput('please clarify'));
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});

	it('"explain" routes to explain_active_question', () => {
		const result = routeIntakeMessage(createRoutingInput('explain'));
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});
});

describe('clarification routing — active question id', () => {
	// Test 2: Clarification response includes active question id.
	it('explain_active_question action includes the active question id', () => {
		const result = routeIntakeMessage(
			createRoutingInput('o que você quer dizer?'),
		);
		expect(result.kind).toBe('routed');
		if (
			result.kind === 'routed' &&
			result.action.type === 'explain_active_question'
		) {
			expect(result.action.questionId).toBe('q-foundation-thesis');
		}
	});

	it('clarification with a different active prompt includes that question id', () => {
		const result = routeIntakeMessage(
			createRoutingInput('o que você quer dizer?', {
				activePrompt: createActivePromptFixture({
					questionId: 'q-other-question',
					text: 'What problem does this solve?',
				}),
			}),
		);
		expect(result.kind).toBe('routed');
		if (
			result.kind === 'routed' &&
			result.action.type === 'explain_active_question'
		) {
			expect(result.action.questionId).toBe('q-other-question');
		}
	});
});

describe('clarification routing — does not advance', () => {
	// Test 3: Clarification does not advance prompt.
	it('clarification does NOT route to evaluate_answer', () => {
		const result = routeIntakeMessage(
			createRoutingInput('o que você quer dizer?'),
		);
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('evaluate_answer');
		}
	});

	it('clarification does NOT route to skip', () => {
		const result = routeIntakeMessage(
			createRoutingInput('o que você quer dizer?'),
		);
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('skip_current_question');
		}
	});

	it('clarification does NOT route to pause', () => {
		const result = routeIntakeMessage(
			createRoutingInput('o que você quer dizer?'),
		);
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('pause_intake');
		}
	});
});

describe('clarification routing — not answer-evaluated', () => {
	// Test 4: Clarification does not evaluate answer.
	it('clarification is NOT an answer evaluation', () => {
		const result = routeIntakeMessage(createRoutingInput('can you clarify?'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('explain_active_question');
		}
	});

	it('clarification classification is ask_question_about_current_question', () => {
		const result = routeIntakeMessage(createRoutingInput('can you clarify?'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.classification.intent).toBe(
				'ask_question_about_current_question',
			);
		}
	});
});

describe('clarification routing — without active prompt', () => {
	// Test 5: Clarification without active prompt is blocked or handled safely.
	it('"what do you mean?" without active prompt is blocked', () => {
		const result = routeIntakeMessage(
			createRoutingInput('what do you mean?', {
				activePrompt: undefined,
			}),
		);
		expect(result.kind).toBe('blocked');
		expect(result.reason).toContain('no active');
	});

	it('"não entendi" without active prompt is blocked', () => {
		const result = routeIntakeMessage(
			createRoutingInput('não entendi', { activePrompt: undefined }),
		);
		expect(result.kind).toBe('blocked');
	});

	it('blocked clarification result includes a useful reason', () => {
		const result = routeIntakeMessage(
			createRoutingInput('can you clarify?', {
				activePrompt: undefined,
			}),
		);
		expect(result.kind).toBe('blocked');
		expect(result.reason.length).toBeGreaterThan(0);
	});
});

describe('clarification routing — classification correctness', () => {
	it('all Portuguese clarification patterns route correctly', () => {
		const patterns = [
			'o que você quer dizer?',
			'o que voce quer dizer?',
			'o que você quer dizer',
			'explique melhor',
			'não entendi',
			'nao entendi',
			'explique',
			'me explique',
			'me explica',
		];

		for (const pattern of patterns) {
			const result = routeIntakeMessage(createRoutingInput(pattern));
			expect(
				isActionType(result, 'explain_active_question'),
				`"${pattern}" should route to explain_active_question`,
			).toBe(true);
		}
	});

	it('all English clarification patterns route correctly', () => {
		const patterns = [
			'what do you mean?',
			'what do you mean',
			'can you clarify?',
			'can you clarify',
			'could you clarify?',
			'could you clarify',
			'please clarify',
			'explain better',
			'explain more',
			'explain',
			'what does that mean?',
			'what does that mean',
			'what is this question asking?',
		];

		for (const pattern of patterns) {
			const result = routeIntakeMessage(createRoutingInput(pattern));
			expect(
				isActionType(result, 'explain_active_question'),
				`"${pattern}" should route to explain_active_question`,
			).toBe(true);
		}
	});
});

describe('clarification routing — integration context', () => {
	it('clarification routing result is pure and does not mutate inputs', () => {
		const prompt = createActivePromptFixture();
		const state = createIntakeStateFixture();

		const promptBefore = JSON.stringify(prompt);
		const stateBefore = JSON.stringify(state);

		routeIntakeMessage({
			activePrompt: prompt,
			intakeState: state,
			message: 'o que você quer dizer?',
		});

		expect(JSON.stringify(prompt)).toBe(promptBefore);
		expect(JSON.stringify(state)).toBe(stateBefore);
	});

	it('clarification with context in active prompt does not cause errors', () => {
		// The router itself doesn't build the clarification message — that's
		// in handle-intake-message.ts. But we can verify the route is correct.
		const result = routeIntakeMessage(
			createRoutingInput('what do you mean?', {
				activePrompt: createActivePromptFixture({
					context:
						'This question is about the founding conviction behind the project.',
				}),
			}),
		);
		expect(isActionType(result, 'explain_active_question')).toBe(true);
	});
});
