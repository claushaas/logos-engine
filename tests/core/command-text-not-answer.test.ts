/**
 * Step 4.2 — Command text safety tests.
 *
 * Proves that slash commands (both allowed and unknown) are never routed to
 * answer evaluation.  This is the primary safety requirement for Step 4.2.
 */

import { describe, expect, it } from 'vitest';
import {
	ALLOWED_LIFECYCLE_COMMANDS,
	detectLifecycleCommand,
} from '../../src/core/intake/detect-lifecycle-command.js';
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
// Helpers
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

describe('command text is never answer-evaluated', () => {
	// Test 1: /logos-status routes to lifecycle command, not answer.
	it('/logos-status routes to lifecycle command, not answer', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-status'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('handle_lifecycle_command');
			if (result.action.type === 'handle_lifecycle_command') {
				expect(result.action.command).toBe('logos-status');
			}
			expect(result.action.type).not.toBe('evaluate_answer');
		}
	});

	// Test 2: /logos-generate routes to lifecycle command, not answer.
	it('/logos-generate routes to lifecycle command, not answer', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-generate'));
		expect(isActionType(result, 'handle_lifecycle_command')).toBe(true);
	});

	// Test 3: /logos-stop routes to lifecycle command, not answer.
	it('/logos-stop routes to lifecycle command, not answer', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-stop'));
		expect(isActionType(result, 'handle_lifecycle_command')).toBe(true);
	});

	// Test 4: /logos-start routes to lifecycle command, not answer.
	it('/logos-start routes to lifecycle command, not answer', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-start'));
		expect(isActionType(result, 'handle_lifecycle_command')).toBe(true);
	});

	// Test 5: /logos-init routes to lifecycle command, not answer.
	it('/logos-init routes to lifecycle command, not answer', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-init'));
		expect(isActionType(result, 'handle_lifecycle_command')).toBe(true);
	});

	// Test 6: /logos-next is not an allowed lifecycle command and is not answer-evaluated.
	it('/logos-next is not an allowed lifecycle command and is not answer-evaluated', () => {
		const detection = detectLifecycleCommand('/logos-next');
		expect(detection.detected).toBe(false);
		expect(detection.isSlashCommand).toBe(true);

		const result = routeIntakeMessage(createRoutingInput('/logos-next'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('out_of_scope');
			expect(result.action.type).not.toBe('evaluate_answer');
			expect(result.action.type).not.toBe('handle_lifecycle_command');
		}
	});

	// Test 7: /logos-answer something is not answer-evaluated.
	it('/logos-answer is not an allowed lifecycle command and is not answer-evaluated', () => {
		const detection = detectLifecycleCommand('/logos-answer something');
		expect(detection.detected).toBe(false);
		expect(detection.isSlashCommand).toBe(true);

		const result = routeIntakeMessage(
			createRoutingInput('/logos-answer something'),
		);
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('evaluate_answer');
			expect(result.action.type).toBe('out_of_scope');
		}
	});

	// Test 8: Unknown slash command is not answer-evaluated.
	it('unknown slash command is not answer-evaluated', () => {
		const result = routeIntakeMessage(createRoutingInput('/unknown-command'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('evaluate_answer');
		}
	});

	// Test 9: Command with leading/trailing whitespace is detected safely.
	it('command with leading/trailing whitespace is detected safely', () => {
		// leading + trailing whitespace
		const r1 = routeIntakeMessage(createRoutingInput('  /logos-status  '));
		expect(isActionType(r1, 'handle_lifecycle_command')).toBe(true);

		// leading whitespace only
		const r2 = routeIntakeMessage(createRoutingInput('  /logos-generate'));
		expect(isActionType(r2, 'handle_lifecycle_command')).toBe(true);

		// trailing whitespace only
		const r3 = routeIntakeMessage(createRoutingInput('/logos-stop  '));
		expect(isActionType(r3, 'handle_lifecycle_command')).toBe(true);
	});

	// Test 10: Forbidden command-first patterns are never accepted as allowed commands.
	it('forbidden command patterns are never accepted as lifecycle commands', () => {
		const forbidden = [
			'/logos-next',
			'/logos-answer',
			'/logos-continue',
			'/logos-question',
			'/logos-phase',
			'/logos-doc',
			'/logos-set-answer',
			'/logos-skip',
			'/logos-followup',
		];

		for (const cmd of forbidden) {
			const detection = detectLifecycleCommand(cmd);
			expect(
				detection.detected,
				`${cmd} should NOT be detected as allowed lifecycle command`,
			).toBe(false);
		}

		// Also verify they are not in the allowed list.
		for (const cmd of forbidden) {
			const nameWithoutSlash = cmd.slice(1);
			expect(ALLOWED_LIFECYCLE_COMMANDS as readonly string[]).not.toContain(
				nameWithoutSlash,
			);
		}
	});
});

describe('handleIntakeMessage command-text-not-answer integration', () => {
	it('handleIntakeMessageTransition never invokes evaluation for slash commands', async () => {
		// This test validates at the routeIntakeMessage level (unit).
		// The integration is proven by the public-api test that handleIntakeMessage
		// calls handleIntakeMessageTransition, which calls routeIntakeMessage.
		const result = routeIntakeMessage(createRoutingInput('/logos-generate'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('evaluate_answer');
		}
	});

	it('unknown slash command during active intake is never answer-evaluated', () => {
		const result = routeIntakeMessage(createRoutingInput('/some-new-command'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).not.toBe('evaluate_answer');
			expect(result.action.type).not.toBe('handle_lifecycle_command');
		}
	});

	it('all five allowed commands are detected by detectLifecycleCommand', () => {
		for (const cmd of ALLOWED_LIFECYCLE_COMMANDS) {
			const slashCmd = `/${cmd}`;
			const detection = detectLifecycleCommand(slashCmd);
			expect(detection.detected, `/${cmd} should be detected`).toBe(true);
			if (detection.detected) {
				expect(detection.command).toBe(cmd);
			}
		}
	});

	it('detectLifecycleCommand returns isSlashCommand: false for normal text', () => {
		const detection = detectLifecycleCommand('This is a normal answer');
		expect(detection.detected).toBe(false);
		expect(detection.isSlashCommand).toBe(false);
	});

	it('detectLifecycleCommand preserves raw message', () => {
		const detection = detectLifecycleCommand('  /logos-status extra args  ');
		expect(detection.detected).toBe(true);
		if (detection.detected) {
			expect(detection.raw).toBe('  /logos-status extra args  ');
			expect(detection.command).toBe('logos-status');
			expect(detection.args).toBe('extra args');
		}
	});

	it('detectLifecycleCommand with no args returns empty args string', () => {
		const detection = detectLifecycleCommand('/logos-status');
		expect(detection.detected).toBe(true);
		if (detection.detected) {
			expect(detection.args).toBe('');
		}
	});

	it('empty message is never treated as a command', () => {
		const r1 = detectLifecycleCommand('');
		expect(r1.detected).toBe(false);
		expect(r1.isSlashCommand).toBe(false);

		const r2 = detectLifecycleCommand('   ');
		expect(r2.detected).toBe(false);
		expect(r2.isSlashCommand).toBe(false);
	});
});
