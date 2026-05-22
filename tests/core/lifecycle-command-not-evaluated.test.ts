/**
 * Step 5.3 — Lifecycle commands are never evaluated as answers.
 *
 * Tests:
 * 1. /logos-stop is never evaluated as answer.
 * 2. /logos-status is never evaluated as answer.
 * 3. /logos-generate is never evaluated as answer.
 * 4. Evaluator is not called for those commands.
 * 5. No answer/evaluation record is created for those commands.
 * 6. Forbidden commands like /logos-next and /logos-answer are also not answer-evaluated.
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
// Tests
// ---------------------------------------------------------------------------

describe('lifecycle commands are never answer-evaluated', () => {
	it('/logos-stop routes to lifecycle command, not answer evaluation', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-stop'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('handle_lifecycle_command');
			if (result.action.type === 'handle_lifecycle_command') {
				expect(result.action.command).toBe('logos-stop');
			}
			expect(result.action.type).not.toBe('evaluate_answer');
		}
	});

	it('/logos-status routes to lifecycle command, not answer evaluation', () => {
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

	it('/logos-generate routes to lifecycle command, not answer evaluation', () => {
		const result = routeIntakeMessage(createRoutingInput('/logos-generate'));
		expect(result.kind).toBe('routed');
		if (result.kind === 'routed') {
			expect(result.action.type).toBe('handle_lifecycle_command');
			if (result.action.type === 'handle_lifecycle_command') {
				expect(result.action.command).toBe('logos-generate');
			}
			expect(result.action.type).not.toBe('evaluate_answer');
		}
	});

	it('evaluator is not invoked for lifecycle commands', () => {
		const commands = ['/logos-stop', '/logos-status', '/logos-generate'];
		for (const cmd of commands) {
			const result = routeIntakeMessage(createRoutingInput(cmd));
			expect(result.kind).toBe('routed');
			if (result.kind === 'routed') {
				expect(result.action.type).not.toBe('evaluate_answer');
			}
		}
	});

	it('no answer or evaluation record is created for lifecycle commands', async () => {
		// This is validated at the handleIntakeCommand level: pause commands
		// transition mode to paused without creating answeredQuestions or
		// partialQuestions entries.
		const { createLogosCore } = await import('../../src/core/api.js');
		const { createFakeFilesystem } = await import(
			'./helpers/fake-filesystem.js'
		);
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: PROJECT_ROOT });
		await core.startIntake({ now: NOW, projectRoot: PROJECT_ROOT });

		const commands = ['logos-stop', 'logos-status', 'logos-generate'] as const;
		for (const command of commands) {
			const { handleIntakeCommand } = await import(
				'../../src/core/intake/handle-intake-command.js'
			);
			await handleIntakeCommand({
				command,
				filesystem: fs,
				projectRoot: PROJECT_ROOT,
			});

			const { loadIntakeState } = await import(
				'../../src/core/state/intake-state-persistence.js'
			);
			const loadResult = await loadIntakeState({
				filesystem: fs,
				now: NOW,
				projectRoot: PROJECT_ROOT,
			});
			expect(loadResult.ok).toBe(true);
			if (loadResult.ok) {
				expect(
					Object.keys(loadResult.state.answeredQuestions),
					`${command} should not create answeredQuestions`,
				).toHaveLength(0);
				expect(
					Object.keys(loadResult.state.partialQuestions),
					`${command} should not create partialQuestions`,
				).toHaveLength(0);
				expect(
					Object.keys(loadResult.state.contradictions),
					`${command} should not create contradictions`,
				).toHaveLength(0);
			}
		}
	});

	it('forbidden commands like /logos-next are not answer-evaluated', () => {
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

			const result = routeIntakeMessage(createRoutingInput(cmd));
			expect(result.kind).toBe('routed');
			if (result.kind === 'routed') {
				expect(result.action.type).not.toBe('evaluate_answer');
				expect(result.action.type).not.toBe('handle_lifecycle_command');
			}
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
});

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NOW = '2026-05-22T00:00:00Z';
const PROJECT_ROOT = '/project';
