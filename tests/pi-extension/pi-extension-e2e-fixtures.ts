/**
 * Step 11.2 — Pi Extension E2E harness fixtures.
 *
 * Shared test fixtures for the Pi extension E2E harness.
 * Provides a fake Pi host, a fake Core scenario engine, deterministic
 * result builders, and context helpers.
 *
 * Rules:
 * - No real Pi runtime.
 * - No real terminal UI.
 * - No Ink/React.
 * - No network, credentials, or live providers.
 * - No Core product reimplementation.
 * - No CLI/TUI imports.
 */

import type {
	CoreResult,
	CoreResultStatus,
	LogosCore,
} from '../../src/core/index.js';
import { createCoreResult } from '../../src/core/index.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type {
	LogosPiCommandContext,
	LogosPiEventContext,
} from '../../src/pi-extension/pi-types.js';

// ---------------------------------------------------------------------------
// Fake Pi Host
// ---------------------------------------------------------------------------

export type FakePiCommandHandler = (
	args: string,
	ctx: LogosPiCommandContext,
) => Promise<void> | void;

export type FakePiInputHandler = (
	event: { text: string; source: string; type: string },
	ctx: LogosPiEventContext,
) => Promise<{
	action: 'handled' | 'continue';
}>;

export type FakePiSentMessage = {
	content: string;
	customType: string;
	details: unknown;
	display: boolean;
};

export type FakePiHost = {
	commands: Map<string, FakePiCommandHandler>;
	inputHandlers: FakePiInputHandler[];
	sentMessages: FakePiSentMessage[];
	sentUserMessages: string[];
	registeredRenderers: Map<string, unknown>;
	registerCommand(
		name: string,
		options: {
			description: string;
			handler: FakePiCommandHandler;
		},
	): void;
	on(event: 'input', handler: FakePiInputHandler): void;
	sendMessage(message: FakePiSentMessage): Promise<void>;
	sendUserMessage(message: string): Promise<void>;
	registerMessageRenderer(type: string, renderer: unknown): void;
	/**
	 * Invoke a registered command handler by name.
	 * The `args` parameter is a single string matching Pi's
	 * `registerCommand` handler signature (all args joined as one string).
	 */
	invokeCommand(
		name: string,
		ctx?: Partial<LogosPiCommandContext>,
		args?: string,
	): Promise<void>;
	/**
	 * Emit an input event through the registered input handlers.
	 * Returns the first handler's result (or undefined if none).
	 */
	emitInput(
		text: string,
		ctx?: Partial<LogosPiEventContext>,
		eventOverride?: Partial<{ text: string; source: string; type: string }>,
	): Promise<{ action: 'handled' | 'continue' } | undefined>;
};

export function createFakePiHost(): FakePiHost {
	const host: FakePiHost = {
		commands: new Map(),

		async emitInput(text, ctxMaybe, eventOverride) {
			const first = host.inputHandlers[0];
			if (!first) return undefined;
			const handler = first;
			const event = {
				source: 'interactive',
				text,
				type: 'input',
				...eventOverride,
			};
			const fullCtx: LogosPiEventContext = {
				cwd: ctxMaybe?.cwd ?? '/repo',
				...ctxMaybe,
			} as LogosPiEventContext;
			return handler(event, fullCtx);
		},
		inputHandlers: [],

		async invokeCommand(name, ctx, args) {
			const handler = host.commands.get(name);
			if (!handler) {
				throw new Error(`Command "${name}" is not registered.`);
			}
			const fullCtx: LogosPiCommandContext = {
				cwd: ctx?.cwd ?? '/repo',
				...ctx,
			} as LogosPiCommandContext;
			await handler(args ?? '', fullCtx);
		},

		on(event, handler) {
			if (event === 'input') {
				host.inputHandlers.push(handler);
			}
		},

		registerCommand(name, options) {
			host.commands.set(name, options.handler);
		},
		registeredRenderers: new Map(),

		registerMessageRenderer(type, renderer) {
			host.registeredRenderers.set(type, renderer);
		},

		async sendMessage(message) {
			host.sentMessages.push(message);
		},

		async sendUserMessage(message) {
			host.sentUserMessages.push(message);
		},
		sentMessages: [],
		sentUserMessages: [],
	};

	return host;
}

// ---------------------------------------------------------------------------
// Fake Core Scenario Engine
// ---------------------------------------------------------------------------

export type CoreScenarioStep = {
	method: string;
	result: CoreResult<unknown>;
};

export type FakeCoreScenario = {
	steps: CoreScenarioStep[];
	callLog: Array<{ method: string; input: unknown }>;
	nextIndex: number;
};

export function createFakeCoreScenario(
	steps: CoreScenarioStep[],
): FakeCoreScenario {
	return {
		callLog: [],
		nextIndex: 0,
		steps,
	};
}

function getNextResult(
	scenario: FakeCoreScenario,
	method: string,
	input: unknown,
): CoreResult<unknown> {
	scenario.callLog.push({ input, method });
	const step = scenario.steps[scenario.nextIndex];
	if (step && step.method === method) {
		scenario.nextIndex++;
		return step.result;
	}
	// Fallback result for unexpected calls.
	return createCoreResult({
		message: {
			body: `Unexpected Core call: ${method}`,
			kind: 'error',
		},
		status: 'failed',
	});
}

export function buildCoreFromScenario(scenario: FakeCoreScenario): LogosCore {
	return {
		generate: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'generate', input) as ReturnType<
					LogosCore['generate']
				>,
			),
		getStatus: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'getStatus', input) as ReturnType<
					LogosCore['getStatus']
				>,
			),
		handleIntakeCommand: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'handleIntakeCommand', input) as ReturnType<
					LogosCore['handleIntakeCommand']
				>,
			),
		handleIntakeMessage: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'handleIntakeMessage', input) as ReturnType<
					LogosCore['handleIntakeMessage']
				>,
			),
		initProject: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'initProject', input) as ReturnType<
					LogosCore['initProject']
				>,
			),
		startIntake: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'startIntake', input) as ReturnType<
					LogosCore['startIntake']
				>,
			),
		stopIntake: (input) =>
			Promise.resolve(
				getNextResult(scenario, 'stopIntake', input) as ReturnType<
					LogosCore['stopIntake']
				>,
			),
	};
}

// ---------------------------------------------------------------------------
// Deterministic Result Builders
// ---------------------------------------------------------------------------

export function okResult(
	kind: string,
	body: string,
	data?: Record<string, unknown>,
	overrides?: Partial<CoreResult<unknown>>,
): CoreResult<unknown> {
	return createCoreResult({
		...overrides,
		data,
		message: {
			body,
			kind: kind as CoreResult['message']['kind'],
			...(data?.metadata !== undefined
				? { metadata: data.metadata as Record<string, unknown> }
				: {}),
			...(data?.questionId !== undefined
				? { questionId: data.questionId as string }
				: {}),
			...(data?.title !== undefined ? { title: data.title as string } : {}),
		},
		status: (overrides?.status ?? 'ok') as CoreResultStatus,
	});
}

export function blockedResult(
	body: string,
	blockers: Array<{ code: string; message: string }>,
	data?: Record<string, unknown>,
): CoreResult<unknown> {
	return createCoreResult({
		blockers: blockers.map((b) => ({
			code: b.code,
			message: b.message,
			severity: 'blocker' as const,
		})),
		data,
		message: { body, kind: 'error' },
		status: 'blocked',
	});
}

export function confirmationRequiredResult(
	body: string,
	data?: Record<string, unknown>,
): CoreResult<unknown> {
	return createCoreResult({
		data,
		message: { body, kind: 'confirmation_request' },
		status: 'confirmation_required',
	});
}

export function statusResultOk(
	body: string,
	data?: Record<string, unknown>,
): CoreResult<unknown> {
	return okResult('status', body, data);
}

// ---------------------------------------------------------------------------
// Scenario Presets
// ---------------------------------------------------------------------------

/**
 * Preset: init → start → intake_active
 *
 * Steps:
 * 1. handleIntakeCommand('logos-init') → execute
 * 2. initProject → ok
 * 3. getStatus → idle (for input route guard; input handler checks status)
 * 4. handleIntakeCommand('logos-start') → execute
 * 5. startIntake → question Q1
 * 6. getStatus → intake_active (for subsequent input routing)
 * 7. handleIntakeMessage → question Q2
 * 8. handleIntakeMessage → follow_up
 */
export function createInitStartQ1Scenario(): FakeCoreScenario {
	return createFakeCoreScenario([
		{
			method: 'handleIntakeCommand',
			result: okResult('status', 'Ready to execute logos-init.', {
				command: 'logos-init',
				disposition: 'execute',
				mode: 'idle',
				persisted: false,
				stateChanged: false,
			}),
		},
		{
			method: 'initProject',
			result: statusResultOk(
				'LOGOS project initialized with activeProfileId: "standard".',
				{
					activeProfileId: 'standard',
					createdPaths: ['/repo/.logos/config.yml'],
					existingPaths: [],
					initialized: true,
				},
			),
		},
		{
			method: 'handleIntakeCommand',
			result: okResult('status', 'Ready to execute logos-start.', {
				command: 'logos-start',
				disposition: 'execute',
				mode: 'idle',
				persisted: false,
				stateChanged: false,
			}),
		},
		{
			method: 'startIntake',
			result: okResult(
				'question',
				'What is the central thesis that justifies this project existing?',
				{
					activePrompt: {
						context: 'This is the founding question for the project.',
						documentId: '01-thesis',
						kind: 'question',
						phaseId: '01-foundation',
						priority: 'critical',
						questionId: 'q1',
						required: true,
						sectionId: 'core-thesis',
						text: 'What is the central thesis that justifies this project existing?',
					},
					activeQuestionId: 'q1',
					mode: 'intake_active',
				},
			),
		},
	]);
}

/**
 * Returns a getStatus result that reports `intake_active` mode.
 */
export function makeIntakeActiveStatus(): CoreResult<unknown> {
	return statusResultOk('Intake is active.', {
		activeQuestionId: 'q1',
		generationReadiness: {
			blockers: ['missing_critical_questions'],
			completenessScore: 0.2,
			ready: false,
			warnings: [],
		},
		initialized: true,
		mode: 'intake_active',
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 5,
			partial: 0,
			skipped: 0,
			sufficient: 1,
			total: 6,
		},
	});
}

/**
 * Returns a getStatus result that reports `idle` mode.
 */
export function makeIdleStatus(): CoreResult<unknown> {
	return statusResultOk('Project is initialized. Intake is idle.', {
		generationReadiness: {
			blockers: [],
			completenessScore: 0,
			ready: false,
			warnings: [],
		},
		initialized: true,
		mode: 'idle',
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 6,
			partial: 0,
			skipped: 0,
			sufficient: 0,
			total: 6,
		},
	});
}

/**
 * Returns a confirmation-required generation result (Scenario B — partial draft
 * is possible but requires explicit confirmation).
 */
export function makeConfirmationRequiredGenerateResult(): CoreResult<unknown> {
	return confirmationRequiredResult(
		'Final generation is blocked, but an incomplete partial draft can be created. Continue?',
		{
			confirmationProvided: false,
			generatedPaths: [],
			generationMode: 'final',
			incomplete: false,
			partialDraft: false,
			preflight: {
				blockers: [
					{
						code: 'missing_critical_questions',
						message: 'Missing critical questions.',
						questionIds: ['q1'],
					},
				],
				canGeneratePartialDraft: true,
				checkedAt: '2026-05-22T12:00:00.000Z',
				completenessScore: 0.5,
				contradictions: [],
				missingCriticalQuestions: ['q1'],
				mode: 'final',
				optionalMissingQuestions: ['q2'],
				optionalSkippedQuestions: [],
				partialCriticalQuestions: [],
				ready: false,
				requiredSkippedQuestions: [],
				requiresExplicitConfirmation: true,
				status: 'blocked',
				warnings: [],
			},
			requiresExplicitConfirmation: true,
			wroteFiles: false,
		},
	);
}

/**
 * Returns a noop cancellation result (adapter-level, not Core).
 */
export function makeCancelledResult(): CoreResult<unknown> {
	return createCoreResult({
		data: {
			confirmationProvided: false,
			generatedPaths: [],
			mode: 'partial_draft',
			skippedReason: 'user_declined_partial_generation',
			wroteFiles: false,
		},
		message: {
			body: 'Partial draft generation cancelled. No files were written.',
			kind: 'status',
		},
		status: 'noop',
	});
}

/**
 * Returns a follow_up result from handleIntakeMessage.
 */
export function makeFollowUpResult(): CoreResult<unknown> {
	return okResult(
		'follow_up',
		'You mentioned the thesis applies to software teams. Can you be more specific?',
		{
			activePrompt: {
				context: 'You gave the thesis but did not identify who it matters to.',
				documentId: '01-thesis',
				followUpId: 'fu-1',
				kind: 'follow_up',
				phaseId: '01-foundation',
				priority: 'important',
				questionId: 'q1',
				required: true,
				sectionId: 'core-thesis',
				text: 'You mentioned the thesis applies to software teams. Can you be more specific?',
			},
			activeQuestionId: 'q1',
			assistantMessage: {
				body: 'You mentioned the thesis applies to software teams. Can you be more specific?',
				kind: 'follow_up',
			},
			intent: { kind: 'answer' },
			mode: 'intake_active',
			stateChanged: true,
			transition: 'follow_up',
		},
	);
}

/**
 * Returns a Q2 question result from handleIntakeMessage.
 */
export function makeQ2Result(): CoreResult<unknown> {
	return okResult('question', 'Who is the primary audience for this project?', {
		activePrompt: {
			context: 'Identify the target user persona.',
			documentId: '02-audience',
			kind: 'question',
			phaseId: '01-foundation',
			priority: 'important',
			questionId: 'q2',
			required: true,
			sectionId: 'core-audience',
			text: 'Who is the primary audience for this project?',
		},
		activeQuestionId: 'q2',
		assistantMessage: {
			body: 'Who is the primary audience for this project?',
			kind: 'question',
		},
		intent: { kind: 'answer' },
		mode: 'intake_active',
		stateChanged: true,
		transition: 'answer_accepted',
	});
}

/**
 * Returns a paused status result.
 */
export function makePausedStatus(): CoreResult<unknown> {
	return statusResultOk('Intake is paused.', {
		generationReadiness: {
			blockers: ['missing_critical_questions'],
			completenessScore: 0.3,
			ready: false,
			warnings: [],
		},
		initialized: true,
		mode: 'paused',
		progress: {
			byPhase: {},
			contradictory: 0,
			missing: 4,
			partial: 0,
			skipped: 0,
			sufficient: 2,
			total: 6,
		},
	});
}

// ---------------------------------------------------------------------------
// Context Helpers
// ---------------------------------------------------------------------------

export type FakeConfirmFn = (
	title: string,
	message: string,
) => Promise<boolean>;

export function createFakeCommandContext(overrides?: {
	cwd?: string;
	hasUI?: boolean;
	confirm?: FakeConfirmFn;
	notify?: (message: string, type?: string) => void;
}): LogosPiCommandContext {
	const confirm = overrides?.confirm ?? (async () => false);
	const notify = overrides?.notify ?? (() => {});

	return {
		cwd: overrides?.cwd ?? '/repo',
		hasUI: overrides?.hasUI ?? true,
		ui: {
			confirm,
			notify,
		},
	} as unknown as LogosPiCommandContext;
}

// ---------------------------------------------------------------------------
// Extension Load Helpers
// ---------------------------------------------------------------------------

/**
 * Build a standard deps object for wiring the Pi extension with fake Pi
 * and fake Core. The `createLogosPiExtension` call is made by each test
 * file after importing it directly (to avoid ESM circular concerns).
 */
export function buildE2eDeps(options?: {
	core?: LogosCore;
	pi?: FakePiHost;
	getProjectRoot?: (ctx: { cwd?: string }) => string;
	renderCoreResult?: LogosPiExtensionDependencies['renderCoreResult'];
	now?: () => string;
}): {
	fakePi: FakePiHost;
	fakeCore: LogosCore;
	deps: LogosPiExtensionDependencies;
	renderedResults: CoreResult<unknown>[];
} {
	const fakePi = options?.pi ?? createFakePiHost();
	const fakeCore =
		options?.core ?? buildCoreFromScenario(createFakeCoreScenario([]));
	const renderedResults: CoreResult<unknown>[] = [];

	const deps: LogosPiExtensionDependencies = {
		core: fakeCore,
		getProjectRoot: options?.getProjectRoot,
		now: options?.now ?? (() => '2026-05-22T12:00:00.000Z'),
		pi: fakePi as unknown as LogosPiExtensionDependencies['pi'],
		renderCoreResult:
			options?.renderCoreResult ??
			(async (result) => {
				renderedResults.push(result);
			}),
	};

	return { deps, fakeCore, fakePi, renderedResults };
}

/**
 * Convenience: build deps and immediately call createLogosPiExtension.
 * The caller must supply the factory function (imported from source).
 */
export function wireExtension(
	factory: (deps: LogosPiExtensionDependencies) => void,
	options?: Parameters<typeof buildE2eDeps>[0],
): ReturnType<typeof buildE2eDeps> {
	const harness = buildE2eDeps(options);
	factory(harness.deps);
	return harness;
}
