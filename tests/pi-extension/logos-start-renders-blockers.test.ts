/**
 * Step 8.2 — /logos-start renders blockers.
 *
 * Proves that:
 * 1. When handleIntakeCommand returns block, the blocker is rendered and
 *    startIntake is NOT called.
 * 2. When startIntake returns a blocked missing-profile result, the blocker
 *    is rendered.
 * 3. When startIntake returns a dependency-blocked result, the blocker is
 *    rendered.
 * 4. Blocked paths never call handleIntakeMessage.
 * 5. Blocked paths never silently succeed.
 */

import { describe, expect, it } from 'vitest';
import type { StartIntakeData } from '../../src/core/api.js';
import { createCoreResult, createLogosBlocker } from '../../src/core/index.js';
import { runLifecycleCommandAdapter } from '../../src/pi-extension/commands/lifecycle-command-adapter.js';
import {
	createAdapterHarness,
	createFakeCommandContext,
	createInterruptionResult,
} from './command-adapter-test-helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A startIntake result blocked by missing profile. */
function createMissingProfileBlockResult() {
	return createCoreResult<StartIntakeData>({
		blockers: [
			createLogosBlocker({
				code: 'profile_not_found',
				details:
					'The active profile "standard" could not be found at profiles/standard/.',
				message: 'Cannot start intake: active profile "standard" not found.',
			}),
		],
		data: {
			mode: 'idle',
		},
		message: {
			body: 'Cannot start intake: active profile "standard" not found.',
			kind: 'error',
		},
		status: 'blocked',
	});
}

/** A startIntake result blocked by a dependency-blocked question. */
function createDependencyBlockedResult() {
	return createCoreResult<StartIntakeData>({
		blockers: [
			createLogosBlocker({
				code: 'dependency_blocked',
				details:
					'Question "q2" depends on "q1" which has not been answered sufficiently.',
				message:
					'Cannot select next prompt: all remaining questions are dependency-blocked.',
			}),
		],
		data: {
			mode: 'idle',
		},
		message: {
			body: 'Cannot select next prompt: all remaining questions are dependency-blocked.',
			kind: 'warning',
		},
		status: 'blocked',
	});
}

/** A startIntake result blocked by missing config (project not initialized). */
function createProjectNotInitializedBlockResult() {
	return createCoreResult<StartIntakeData>({
		blockers: [
			createLogosBlocker({
				code: 'project_not_initialized',
				message: 'Project is not initialized. Run /logos-init first.',
			}),
		],
		data: {
			mode: 'idle',
		},
		message: {
			body: 'Project is not initialized. Run /logos-init first.',
			kind: 'error',
		},
		status: 'blocked',
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logos-start renders blockers', () => {
	it('block disposition renders blocker and does not call startIntake', async () => {
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
		expect(harness.rendered).toHaveLength(1);
		expect(harness.rendered[0]?.result.status).toBe('blocked');
	});

	it('block disposition does not call handleIntakeMessage', async () => {
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

	it('startIntake blocked with profile_not_found renders blocker', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createMissingProfileBlockResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
			'startIntake',
		]);

		// The startIntake blocked result must be rendered.
		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.status).toBe('blocked');
		expect(lastRendered?.result.blockers).toHaveLength(1);
		expect(lastRendered?.result.blockers[0]?.code).toBe('profile_not_found');
	});

	it('startIntake blocked with dependency_blocked renders blocker', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createDependencyBlockedResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.status).toBe('blocked');
		expect(lastRendered?.result.blockers).toHaveLength(1);
		expect(lastRendered?.result.blockers[0]?.code).toBe('dependency_blocked');
	});

	it('startIntake blocked with project_not_initialized renders blocker', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createProjectNotInitializedBlockResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.status).toBe('blocked');
		expect(lastRendered?.result.blockers[0]?.code).toBe(
			'project_not_initialized',
		);
	});

	it('blocked paths never call handleIntakeMessage', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createMissingProfileBlockResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(
			harness.calls.some((call) => call.method === 'handleIntakeMessage'),
		).toBe(false);
	});

	it('blocked paths never silently succeed — block status is rendered', async () => {
		const harness = createAdapterHarness({ disposition: 'execute' });
		harness.setCommandResult(createMissingProfileBlockResult());

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		// A silent success would return ok status. The blocked result must
		// be rendered with blocked status.
		const lastRendered = harness.rendered[harness.rendered.length - 1];
		expect(lastRendered?.result.status).toBe('blocked');
		expect(lastRendered?.result.message.kind).toBe('error');
	});

	it('confirm_required disposition renders confirmation and does not call startIntake', async () => {
		const harness = createAdapterHarness();
		harness.setInterruptionResult(
			createInterruptionResult('confirm_required', 'logos-start'),
		);

		await runLifecycleCommandAdapter({
			command: 'logos-start',
			ctx: createFakeCommandContext('/repo'),
			deps: harness.deps,
		});

		expect(harness.calls.map((call) => call.method)).toEqual([
			'handleIntakeCommand',
		]);
		expect(harness.rendered).toHaveLength(1);
		expect(harness.rendered[0]?.result.status).toBe('confirmation_required');
	});
});
