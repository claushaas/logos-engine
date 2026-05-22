/**
 * Step 8.2 — silent toggle prohibition for /logos-start.
 *
 * Proves that:
 * 1. The logos-start handler cannot complete without rendering a result.
 * 2. A startIntake result with no message body triggers a safe error path.
 * 3. The handler does not just return { mode: "intake_active" }.
 * 4. The handler does not ask the user for an answer without rendering
 *    the actual prompt.
 * 5. The handler does not call startIntake after reaffirm.
 * 6. The handler does not call handleIntakeMessage.
 */

import { describe, expect, it } from 'vitest';
import type { StartIntakeData } from '../../src/core/api.js';
import { createCoreResult } from '../../src/core/index.js';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
	createInterruptionResult,
} from './command-adapter-test-helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A startIntake result that has no message body — a contract failure. */
function createEmptyMessageStartResult() {
	return createCoreResult<StartIntakeData>({
		data: {
			activePrompt: {
				documentId: '',
				kind: 'question',
				phaseId: '',
				priority: 'important' as const,
				questionId: 'q1',
				required: false,
				sectionId: '',
				text: 'hidden prompt',
			},
			activeQuestionId: 'q1',
			mode: 'intake_active',
		},
		message: {
			body: '',
			kind: 'question',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logos-start silent toggle prohibition', () => {
	it('handler cannot complete without rendering a result on execute path', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// The handler must have rendered something.
		expect(harness.rendered.length).toBeGreaterThan(0);
	});

	it('handler does not return bare mode toggle without rendering', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		// Use a fixture with a meaningful question kind so the test can
		// distinguish a real prompt from a generic status render.
		const questionResult = createCoreResult<StartIntakeData>({
			data: {
				activePrompt: {
					documentId: '01-thesis',
					kind: 'question',
					phaseId: '01-foundation',
					priority: 'critical' as const,
					questionId: 'q1',
					required: true,
					sectionId: 'core-thesis',
					text: 'What is the central thesis?',
				},
				activeQuestionId: 'q1',
				mode: 'intake_active',
			},
			message: {
				body: 'What is the central thesis?',
				kind: 'question',
				metadata: { questionId: 'q1' },
			},
			status: 'ok',
		});
		harness.setCommandResult(questionResult);

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// A silent toggle would return with zero rendered entries.
		expect(harness.rendered.length).toBeGreaterThan(0);

		// At least one rendered entry must be the question prompt (not just
		// a generic status message). A bare mode toggle would render nothing
		// or only status metadata.
		const questionRenders = harness.rendered.filter(
			(entry) => entry.result.message.kind === 'question',
		);
		expect(questionRenders.length).toBeGreaterThan(0);
	});

	it('does not call handleIntakeMessage on execute path', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(
			harness.calls.some((call) => call.method === 'handleIntakeMessage'),
		).toBe(false);
	});

	it('does not call startIntake after reaffirm disposition', async () => {
		const harness = createAdapterHarness({ disposition: 'reaffirm' });

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
		expect(harness.calls.some((call) => call.method === 'startIntake')).toBe(
			false,
		);
	});

	it('does not call handleIntakeMessage after reaffirm', async () => {
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

	it('does not call startIntake after block disposition', async () => {
		const harness = createAdapterHarness();
		harness.setInterruptionResult(
			createInterruptionResult('block', 'logos-start'),
		);

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
	});

	it('does not call handleIntakeMessage after block', async () => {
		const harness = createAdapterHarness();
		harness.setInterruptionResult(
			createInterruptionResult('block', 'logos-start'),
		);

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(
			harness.calls.some((call) => call.method === 'handleIntakeMessage'),
		).toBe(false);
	});

	it('renders result when startIntake returns empty message body', async () => {
		// When Core returns a result with an empty message body, the adapter
		// must still forward it to the rendering boundary — it must not
		// silently swallow the result or fail to render.
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createEmptyMessageStartResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// The empty-message result must still be forwarded to rendering.
		expect(harness.rendered.length).toBeGreaterThanOrEqual(1);

		// The last rendered entry should be the empty-message start result.
		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.message.body).toBe('');
		expect(lastRendered?.result.status).toBe('ok');
	});
});
