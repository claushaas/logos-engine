/**
 * Step 5.1 — Forbidden lifecycle commands tests.
 *
 * Proves that forbidden command-first patterns are:
 * - not lifecycle commands;
 * - rejected by the lifecycle command guard;
 * - distinct from the allowed set;
 * - blocked at runtime by the guard and router.
 */

import { describe, expect, it } from 'vitest';
import { detectLifecycleCommand } from '../../src/core/intake/detect-lifecycle-command.js';
import {
	type RouteIntakeMessageInput,
	routeIntakeMessage,
} from '../../src/core/intake/deterministic-intent-router.js';
import {
	FORBIDDEN_LOGOS_COMMANDS,
	type ForbiddenLogosCommand,
	isForbiddenLogosCommand,
	isLogosLifecycleCommand,
	LOGOS_LIFECYCLE_COMMANDS,
} from '../../src/core/intake/lifecycle-command.js';
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
// Tests
// ---------------------------------------------------------------------------

describe('forbidden command list includes all spec-defined patterns', () => {
	const required: ForbiddenLogosCommand[] = [
		'logos-next',
		'logos-answer',
		'logos-continue',
		'logos-question',
		'logos-phase',
		'logos-doc',
		'logos-set-answer',
		'logos-skip',
		'logos-followup',
	];

	it('FORBIDDEN_LOGOS_COMMANDS contains all nine patterns', () => {
		const forbiddenSet = new Set(FORBIDDEN_LOGOS_COMMANDS);
		for (const cmd of required) {
			expect(forbiddenSet.has(cmd), `missing "${cmd}"`).toBe(true);
		}
		expect(FORBIDDEN_LOGOS_COMMANDS.length).toBe(required.length);
	});

	it('each forbidden command name has correct format (kebab-case, logos- prefix)', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			expect(cmd, `"${cmd}" should start with "logos-"`).toMatch(/^logos-/);
		}
	});
});

describe('forbidden commands are not lifecycle commands', () => {
	it('each forbidden command is rejected by isLogosLifecycleCommand', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			expect(isLogosLifecycleCommand(cmd), `"${cmd}"`).toBe(false);
		}
	});

	it('each forbidden command is accepted by isForbiddenLogosCommand', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			expect(isForbiddenLogosCommand(cmd), `"${cmd}"`).toBe(true);
		}
	});

	it('allowed commands are NOT forbidden', () => {
		for (const cmd of LOGOS_LIFECYCLE_COMMANDS) {
			expect(
				isForbiddenLogosCommand(cmd),
				`"${cmd}" should not be forbidden`,
			).toBe(false);
		}
	});
});

describe('unknown slash-style LOGOS command names', () => {
	const unknownCommands = [
		'logos-help',
		'logos-reset',
		'logos-config',
		'logos-export',
		'logos-import',
		'logos-info',
		'logos-debug',
	];

	it('unknown slash-style commands are not lifecycle commands', () => {
		for (const cmd of unknownCommands) {
			expect(isLogosLifecycleCommand(cmd), `"${cmd}"`).toBe(false);
		}
	});

	it('unknown slash-style commands are not forbidden commands', () => {
		for (const cmd of unknownCommands) {
			expect(isForbiddenLogosCommand(cmd), `"${cmd}"`).toBe(false);
		}
	});

	it('unknown commands are detected as slash commands by detectLifecycleCommand', () => {
		for (const cmd of unknownCommands) {
			const detection = detectLifecycleCommand(`/${cmd}`);
			expect(detection.detected, `/${cmd}`).toBe(false);
			expect(detection.isSlashCommand, `/${cmd}`).toBe(true);
		}
	});
});

describe('forbidden commands cannot be answer-evaluated', () => {
	it('slash-prefixed forbidden commands route to out_of_scope, not evaluate_answer', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			const slashCmd = `/${cmd}`;
			const result = routeIntakeMessage(createRoutingInput(slashCmd));
			expect(result.kind).toBe('routed');
			if (result.kind === 'routed') {
				expect(
					result.action.type,
					`/${cmd} should not be evaluate_answer`,
				).not.toBe('evaluate_answer');
				expect(
					result.action.type,
					`/${cmd} should not be handle_lifecycle_command`,
				).not.toBe('handle_lifecycle_command');
			}
		}
	});

	it('forbidden slash commands are detected as unknown slash commands', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			const slashCmd = `/${cmd}`;
			const detection = detectLifecycleCommand(slashCmd);
			expect(detection.detected, `/${cmd}`).toBe(false);
			expect(detection.isSlashCommand, `/${cmd}`).toBe(true);
		}
	});
});

describe('runtime guard rejects forbidden commands', () => {
	it('isLogosLifecycleCommand rejects all forbidden commands', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			expect(isLogosLifecycleCommand(cmd)).toBe(false);
		}
	});

	it('isLogosLifecycleCommand rejects slash-prefixed forbidden commands', () => {
		for (const cmd of FORBIDDEN_LOGOS_COMMANDS) {
			expect(isLogosLifecycleCommand(`/${cmd}`)).toBe(false);
		}
	});
});
