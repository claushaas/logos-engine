/**
 * Step 8.2 — /logos-start ask-first enforcement.
 *
 * Proves that the logos-start command handler:
 * 1. Calls core.handleIntakeCommand first.
 * 2. When disposition is execute, calls core.startIntake.
 * 3. Passes projectRoot from ctx.cwd to both Core calls.
 * 4. Renders the startIntake result immediately.
 * 5. The rendered result contains a question/follow-up/contradiction message.
 * 6. Never calls core.handleIntakeMessage.
 * 7. Does not silently toggle mode.
 */

import { describe, expect, it } from 'vitest';
import type { StartIntakeData } from '../../src/core/api.js';
import { createCoreResult } from '../../src/core/index.js';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
} from './command-adapter-test-helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createQuestionStartResult() {
	return createCoreResult<StartIntakeData>({
		data: {
			activePrompt: {
				context: 'This is the founding question for the project.',
				documentId: '01-thesis',
				kind: 'question',
				phaseId: '01-foundation',
				priority: 'critical' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'What is the central thesis that justifies this project existing?',
			},
			activeQuestionId: 'q1',
			mode: 'intake_active',
		},
		message: {
			body: 'What is the central thesis that justifies this project existing?',
			kind: 'question',
			metadata: { questionId: 'q1' },
		},
		status: 'ok',
	});
}

function createFollowUpStartResult() {
	return createCoreResult<StartIntakeData>({
		data: {
			activePrompt: {
				context: 'You gave the thesis but did not identify who it matters to.',
				documentId: '01-thesis',
				followUpId: 'fu-1',
				kind: 'follow_up',
				phaseId: '01-foundation',
				priority: 'important' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'You mentioned the thesis applies to software teams. Can you be more specific about which type of team?',
			},
			activeQuestionId: 'q1',
			mode: 'intake_active',
		},
		message: {
			body: 'You mentioned the thesis applies to software teams. Can you be more specific about which type of team?',
			kind: 'follow_up',
			metadata: { followUpId: 'fu-1', questionId: 'q1' },
		},
		status: 'ok',
	});
}

function createContradictionStartResult() {
	return createCoreResult<StartIntakeData>({
		data: {
			activePrompt: {
				context: 'A previously accepted answer conflicts with this response.',
				contradictionId: 'contra-1',
				documentId: '01-thesis',
				kind: 'contradiction_resolution',
				phaseId: '01-foundation',
				priority: 'critical' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'Your answer to the thesis question conflicts with your earlier problem statement. Which one should take priority?',
			},
			activeQuestionId: 'q1',
			mode: 'intake_active',
		},
		message: {
			body: 'Your answer to the thesis question conflicts with your earlier problem statement. Which one should take priority?',
			kind: 'contradiction',
			metadata: { contradictionId: 'contra-1', questionId: 'q1' },
		},
		status: 'ok',
	});
}

function createCompletionStartResult() {
	return createCoreResult<StartIntakeData>({
		data: {
			mode: 'complete',
		},
		message: {
			body: 'All intake questions have been answered. Run /logos-generate to produce documentation.',
			kind: 'completion',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logos-start asks first', () => {
	it('calls handleIntakeCommand first, then startIntake on execute', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		const questionResult = createQuestionStartResult();
		harness.setCommandResult(questionResult);

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
			'startIntake',
		]);
	});

	it('passes projectRoot from ctx.cwd to handleIntakeCommand', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/my-project'),
			deps: harness.deps,
		});

		expect(harness.calls[0]?.input).toEqual(
			expect.objectContaining({
				command: 'logos-start',
				projectRoot: '/my-project',
			}),
		);
	});

	it('passes projectRoot from ctx.cwd to startIntake', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/my-project'),
			deps: harness.deps,
		});

		expect(harness.calls[1]?.input).toEqual(
			expect.objectContaining({ projectRoot: '/my-project' }),
		);
	});

	it('renders question result immediately after startIntake', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		const questionResult = createQuestionStartResult();
		harness.setCommandResult(questionResult);

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// At least one rendered entry exists.
		expect(harness.rendered.length).toBeGreaterThanOrEqual(1);

		// The last rendered entry must be the startIntake result.
		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.message.kind).toBe('question');
		expect(lastRendered?.result.message.body).toBe(
			'What is the central thesis that justifies this project existing?',
		);
	});

	it('renders follow-up result immediately', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createFollowUpStartResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.message.kind).toBe('follow_up');
	});

	it('renders contradiction result immediately', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createContradictionStartResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.message.kind).toBe('contradiction');
	});

	it('renders completion result immediately', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createCompletionStartResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.message.kind).toBe('completion');
	});

	it('never calls handleIntakeMessage', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createQuestionStartResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(
			harness.calls.some((call) => call.method === 'handleIntakeMessage'),
		).toBe(false);
	});

	it('does not silently toggle mode — result is always rendered', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createQuestionStartResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// The handler must have rendered at least one result.
		// A silent toggle would have 0 rendered items.
		expect(harness.rendered.length).toBeGreaterThan(0);

		// At least one rendered entry must be the question prompt.
		const questionEntries = harness.rendered.filter(
			(entry) => entry.result.message.kind === 'question',
		);
		expect(questionEntries.length).toBeGreaterThan(0);
	});

	it('command args are never treated as an answer', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		await runLifecycleCommandAdapter({
			args: ['some answer text'],
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// handleIntakeMessage must never be called.
		expect(
			harness.calls.some((call) => call.method === 'handleIntakeMessage'),
		).toBe(false);

		// Command args are forwarded to the adapter but never used as an answer.
		// The adapter passes args to runCommandSpecificCoreAction which ignores
		// them via `void input.args`.
	});
});
