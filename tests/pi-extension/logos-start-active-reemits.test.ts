/**
 * Step 8.2 — /logos-start active-intake re-emission.
 *
 * Proves that:
 * 1. When handleIntakeCommand returns reaffirm, the result is rendered.
 * 2. core.startIntake is NOT called.
 * 3. core.handleIntakeMessage is NOT called.
 * 4. Active prompt metadata from the reaffirm result is preserved in
 *    rendered data.
 */

import { describe, expect, it } from 'vitest';
import type {
	HandleIntakeCommandData,
	HandleIntakeCommandResult,
} from '../../src/core/api.js';
import { createCoreResult } from '../../src/core/index.js';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
} from './command-adapter-test-helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Create a reaffirm interruption result carrying the active question prompt
 * and metadata that Core would return when intake is already active.
 */
function createReaffirmQuestionResult(): HandleIntakeCommandResult {
	return createCoreResult<HandleIntakeCommandData>({
		data: {
			activePrompt: {
				context: 'The founding question for this project.',
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
			command: 'logos-start',
			disposition: 'reaffirm',
			mode: 'intake_active',
			persisted: false,
			preservedQuestionId: 'q1',
			stateChanged: false,
		},
		message: {
			body: 'What is the central thesis that justifies this project existing?',
			kind: 'question',
			metadata: {
				activeQuestionId: 'q1',
				command: 'logos-start',
				disposition: 'reaffirm',
				questionId: 'q1',
			},
		},
		status: 'ok',
	});
}

/** Reaffirm for a follow-up prompt. */
function createReaffirmFollowUpResult(): HandleIntakeCommandResult {
	return createCoreResult<HandleIntakeCommandData>({
		data: {
			activePrompt: {
				context: 'You gave the thesis but not the audience.',
				documentId: '01-thesis',
				followUpId: 'fu-1',
				kind: 'follow_up',
				phaseId: '01-foundation',
				priority: 'important' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'Which specific audience does this thesis matter to?',
			},
			activeQuestionId: 'q1',
			command: 'logos-start',
			disposition: 'reaffirm',
			mode: 'intake_active',
			persisted: false,
			preservedQuestionId: 'q1',
			stateChanged: false,
		},
		message: {
			body: 'Which specific audience does this thesis matter to?',
			kind: 'follow_up',
			metadata: {
				activeQuestionId: 'q1',
				command: 'logos-start',
				disposition: 'reaffirm',
				followUpId: 'fu-1',
			},
		},
		status: 'ok',
	});
}

/** Reaffirm for a contradiction-resolution prompt. */
function createReaffirmContradictionResult(): HandleIntakeCommandResult {
	return createCoreResult<HandleIntakeCommandData>({
		data: {
			activePrompt: {
				context: 'Your thesis contradicts the stated problem scope.',
				contradictionId: 'contra-1',
				documentId: '01-thesis',
				kind: 'contradiction_resolution',
				phaseId: '01-foundation',
				priority: 'critical' as const,
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'Your thesis contradicts the problem scope. Which should take priority?',
			},
			activeQuestionId: 'q1',
			command: 'logos-start',
			disposition: 'reaffirm',
			mode: 'intake_active',
			persisted: false,
			preservedQuestionId: 'q1',
			stateChanged: false,
		},
		message: {
			body: 'Your thesis contradicts the problem scope. Which should take priority?',
			kind: 'contradiction',
			metadata: {
				activeQuestionId: 'q1',
				command: 'logos-start',
				contradictionId: 'contra-1',
				disposition: 'reaffirm',
			},
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logos-start active re-emission', () => {
	it('renders reaffirm result and does not call startIntake', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });
		harness.setInterruptionResult(createReaffirmQuestionResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
		expect(harness.rendered).toHaveLength(1);
	});

	it('reaffirm renders question prompt with active metadata', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });
		harness.setInterruptionResult(createReaffirmQuestionResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.rendered[0]?.result.message.kind).toBe('question');
		expect(harness.rendered[0]?.result.message.body).toBe(
			'What is the central thesis that justifies this project existing?',
		);
		// Metadata from the reaffirm result must be preserved.
		expect(harness.rendered[0]?.result.message.metadata).toBeDefined();
		expect(harness.rendered[0]?.result.message.metadata?.questionId).toBe('q1');
	});

	it('reaffirm renders follow-up prompt with followUpId preserved', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });
		harness.setInterruptionResult(createReaffirmFollowUpResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.rendered[0]?.result.message.kind).toBe('follow_up');
		expect(harness.rendered[0]?.result.message.metadata?.followUpId).toBe(
			'fu-1',
		);
	});

	it('reaffirm renders contradiction prompt with contradictionId preserved', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });
		harness.setInterruptionResult(createReaffirmContradictionResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.rendered[0]?.result.message.kind).toBe('contradiction');
		expect(harness.rendered[0]?.result.message.metadata?.contradictionId).toBe(
			'contra-1',
		);
	});

	it('never calls handleIntakeMessage on reaffirm', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(
			harness.calls.some((call) => call.method === 'handleIntakeMessage'),
		).toBe(false);
	});

	it('never calls startIntake on reaffirm', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.some((call) => call.method === 'startIntake')).toBe(
			false,
		);
	});

	it('does not advance to a new question on reaffirm', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });
		harness.setInterruptionResult(createReaffirmQuestionResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// Only handleIntakeCommand was called — no startIntake means no new prompt.
		expect(harness.calls).toHaveLength(1);

		// The rendered prompt is the active question, not a new prompt.
		expect(harness.rendered[0]?.result.data?.preservedQuestionId).toBe('q1');
	});
});
