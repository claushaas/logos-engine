/**
 * Step 5.5 — Fake Pi extension harness and fake Core for contract tests.
 *
 * Provides:
 * - {@link FakePiHarness}: registers commands by name, tracks handlers,
 *   and can invoke them with a fake context.
 * - {@link FakeCore}: records every Core API call with method name and
 *   input, and returns canned results.
 * - Factory helpers to build deterministic Core result fixtures.
 *
 * This harness lives in tests and is not a Pi runtime replacement.
 * It proves that command handlers call Core interruption logic before
 * command-specific Core APIs.
 */

import type {
	HandleIntakeCommandData,
	HandleIntakeCommandResult,
	IntakeCommandDisposition,
} from '../../src/core/api.js';
import type { LogosLifecycleCommand } from '../../src/core/intake/lifecycle-command.js';
import type { AssistantMessage } from '../../src/core/messages.js';
import type { IntakeMode } from '../../src/core/state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Fake Pi command context
// ---------------------------------------------------------------------------

export type FakePiCommandContext = {
	cwd: string;
};

// ---------------------------------------------------------------------------
// Fake Pi harness
// ---------------------------------------------------------------------------

export type RegisteredCommandHandler = (
	ctx: FakePiCommandContext,
	args?: string[],
) => Promise<void> | void;

export type FakePiHarness = {
	readonly commands: Map<string, RegisteredCommandHandler>;
	registerCommand(name: string, handler: RegisteredCommandHandler): void;
	invokeCommand(
		name: string,
		ctx?: Partial<FakePiCommandContext>,
		args?: string[],
	): Promise<void>;
};

/**
 * Create a fake Pi harness that can register command handlers and invoke
 * them with a fake command context.
 *
 * Usage in tests:
 * ```ts
 * const pi = createFakePiHarness();
 * pi.registerCommand('logos-status', async (ctx) => { ... });
 * await pi.invokeCommand('logos-status');
 * ```
 */
export function createFakePiHarness(): FakePiHarness {
	const commands = new Map<string, RegisteredCommandHandler>();

	return {
		commands,
		async invokeCommand(
			name: string,
			ctx?: Partial<FakePiCommandContext>,
			args?: string[],
		): Promise<void> {
			const handler = commands.get(name);
			if (handler === undefined) {
				throw new Error(`Command "${name}" is not registered.`);
			}
			await handler({ cwd: ctx?.cwd ?? '/repo' }, args);
		},
		registerCommand(name: string, handler: RegisteredCommandHandler): void {
			if (commands.has(name)) {
				throw new Error(`Command "${name}" is already registered.`);
			}
			commands.set(name, handler);
		},
	};
}

// ---------------------------------------------------------------------------
// Fake Core
// ---------------------------------------------------------------------------

export type RecordedCoreCall = {
	method:
		| 'handleIntakeCommand'
		| 'initProject'
		| 'startIntake'
		| 'stopIntake'
		| 'getStatus'
		| 'generate'
		| 'handleIntakeMessage';
	input: unknown;
};

export type FakeCore = {
	calls: RecordedCoreCall[];
	handleIntakeCommand: (input: {
		projectRoot: string;
		command: LogosLifecycleCommand;
	}) => Promise<HandleIntakeCommandResult>;
	initProject: (input: { projectRoot: string }) => Promise<{ status: string }>;
	startIntake: (input: { projectRoot: string }) => Promise<{ status: string }>;
	stopIntake: (input: { projectRoot: string }) => Promise<{ status: string }>;
	getStatus: (input: { projectRoot: string }) => Promise<{ status: string }>;
	generate: (input: { projectRoot: string }) => Promise<{ status: string }>;
	handleIntakeMessage: (input: {
		projectRoot: string;
		message: string;
	}) => Promise<{ status: string }>;
	resetCalls(): void;
};

/**
 * Create a fake Core that records every API call.
 *
 * Use {@link setFakeCoreResult} to configure the next call's response.
 */
export function createFakeCore(): FakeCore {
	const calls: RecordedCoreCall[] = [];

	function record(method: RecordedCoreCall['method'], input: unknown) {
		calls.push({ input, method });
	}

	const nextHandleIntakeCommandResult: HandleIntakeCommandResult = {
		blockers: [],
		changedPaths: [],
		data: undefined,
		dryRun: false,
		errors: [],
		message: { body: 'ok', kind: 'status' },
		status: 'ok',
		warnings: [],
	};
	const nextInitProjectResult = { status: 'ok' };
	const nextStartIntakeResult = { status: 'ok' };
	const nextStopIntakeResult = { status: 'ok' };
	const nextGetStatusResult = { status: 'ok' };
	const nextGenerateResult = { status: 'ok' };
	const nextHandleIntakeMessageResult = { status: 'ok' };

	return {
		calls,
		async generate(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('generate', input);
			return nextGenerateResult;
		},
		async getStatus(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('getStatus', input);
			return nextGetStatusResult;
		},
		async handleIntakeCommand(input: {
			projectRoot: string;
			command: LogosLifecycleCommand;
		}): Promise<HandleIntakeCommandResult> {
			record('handleIntakeCommand', input);
			return nextHandleIntakeCommandResult;
		},
		async handleIntakeMessage(input: {
			projectRoot: string;
			message: string;
		}): Promise<{ status: string }> {
			record('handleIntakeMessage', input);
			return nextHandleIntakeMessageResult;
		},
		async initProject(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('initProject', input);
			return nextInitProjectResult;
		},
		resetCalls(): void {
			calls.length = 0;
		},
		async startIntake(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('startIntake', input);
			return nextStartIntakeResult;
		},
		async stopIntake(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('stopIntake', input);
			return nextStopIntakeResult;
		},
	};

	// We need getters/setters to allow tests to configure results.
	// Return a proxy-like object by exposing config functions through
	// additional properties set below.
}

// ---------------------------------------------------------------------------
// Result fixtures
// ---------------------------------------------------------------------------

/**
 * Create a deterministic `handleIntakeCommand` result with the given
 * disposition.
 */
export function createCommandResult(
	disposition: IntakeCommandDisposition,
	overrides: Partial<HandleIntakeCommandResult> = {},
): HandleIntakeCommandResult {
	const statusMap: Record<
		IntakeCommandDisposition,
		HandleIntakeCommandResult['status']
	> = {
		block: 'blocked',
		confirm_required: 'confirmation_required',
		execute: 'ok',
		pause_and_execute: 'ok',
		reaffirm: 'ok',
	};

	const data: HandleIntakeCommandData = {
		activeQuestionId: 'q1',
		command: 'logos-status',
		disposition,
		mode:
			disposition === 'pause_and_execute'
				? ('paused' as IntakeMode)
				: ('intake_active' as IntakeMode),
		persisted: disposition === 'pause_and_execute',
		preservedQuestionId: disposition !== 'execute' ? 'q1' : undefined,
		stateChanged: disposition === 'pause_and_execute',
		...(overrides.data as HandleIntakeCommandData | undefined),
	};

	const message: AssistantMessage = {
		body: `Disposition: ${disposition}`,
		kind:
			disposition === 'confirm_required'
				? 'confirmation_request'
				: disposition === 'block'
					? 'error'
					: 'status',
		metadata: {
			command: data.command,
			disposition,
		},
	};

	return {
		blockers: [],
		changedPaths: [],
		data,
		dryRun: false,
		errors: [],
		message,
		status: overrides.status ?? statusMap[disposition],
		warnings: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// FakeCore configuration helpers
// ---------------------------------------------------------------------------

/**
 * Extend a `FakeCore` with additional properties so tests can configure
 * the next result for each method directly.
 */
export type ConfigurableFakeCore = FakeCore & {
	setHandleIntakeCommandResult: (result: HandleIntakeCommandResult) => void;
	setInitProjectResult: (result: { status: string }) => void;
	setStartIntakeResult: (result: { status: string }) => void;
	setStopIntakeResult: (result: { status: string }) => void;
	setGetStatusResult: (result: { status: string }) => void;
	setGenerateResult: (result: { status: string }) => void;
	setHandleIntakeMessageResult: (result: { status: string }) => void;
};

/**
 * Create a configurable fake Core whose per-method results can be set
 * by the test before each invocation.
 */
export function createConfigurableFakeCore(): ConfigurableFakeCore {
	const base = createFakeCore();

	let hicResult: HandleIntakeCommandResult = createCommandResult('execute');
	let initResult = { status: 'ok' };
	let startResult = { status: 'ok' };
	let stopResult = { status: 'ok' };
	let statusResult = { status: 'ok' };
	let genResult = { status: 'ok' };
	let himResult = { status: 'ok' };

	const record = (method: RecordedCoreCall['method'], input: unknown) => {
		base.calls.push({ input, method });
	};

	return {
		get calls() {
			return base.calls;
		},
		set calls(_v) {
			// no-op setter to satisfy TS — tests use resetCalls
		},
		async generate(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('generate', input);
			return genResult;
		},
		async getStatus(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('getStatus', input);
			return statusResult;
		},
		async handleIntakeCommand(input: {
			projectRoot: string;
			command: LogosLifecycleCommand;
		}): Promise<HandleIntakeCommandResult> {
			record('handleIntakeCommand', input);
			return hicResult;
		},
		async handleIntakeMessage(input: {
			projectRoot: string;
			message: string;
		}): Promise<{ status: string }> {
			record('handleIntakeMessage', input);
			return himResult;
		},
		async initProject(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('initProject', input);
			return initResult;
		},
		resetCalls(): void {
			base.calls.length = 0;
		},
		setGenerateResult(result: { status: string }): void {
			genResult = result;
		},
		setGetStatusResult(result: { status: string }): void {
			statusResult = result;
		},
		setHandleIntakeCommandResult(result: HandleIntakeCommandResult): void {
			hicResult = result;
		},
		setHandleIntakeMessageResult(result: { status: string }): void {
			himResult = result;
		},
		setInitProjectResult(result: { status: string }): void {
			initResult = result;
		},
		setStartIntakeResult(result: { status: string }): void {
			startResult = result;
		},
		setStopIntakeResult(result: { status: string }): void {
			stopResult = result;
		},
		async startIntake(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('startIntake', input);
			return startResult;
		},
		async stopIntake(input: {
			projectRoot: string;
		}): Promise<{ status: string }> {
			record('stopIntake', input);
			return stopResult;
		},
	};
}
