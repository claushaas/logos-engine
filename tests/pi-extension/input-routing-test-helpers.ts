import { vi } from 'vitest';
import type {
	CoreResult,
	CoreResultStatus,
	HandleIntakeMessageResult,
	IntakeMode,
	LogosCore,
} from '../../src/core/index.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type {
	LogosPiEventContext,
	LogosPiInputEvent,
	LogosPiInputHandlerResult,
} from '../../src/pi-extension/pi-types.js';

export type RecordedInputHandler = (
	event: LogosPiInputEvent,
	ctx: LogosPiEventContext,
) => Promise<LogosPiInputHandlerResult> | LogosPiInputHandlerResult;

export type FakePi = {
	inputHandlers: RecordedInputHandler[];
	commands: Map<string, unknown>;
	on(event: 'input', handler: RecordedInputHandler): void;
	registerCommand(name: string, options: unknown): void;
};

export function createFakePi(): FakePi {
	return {
		commands: new Map<string, unknown>(),
		inputHandlers: [],
		on(event, handler) {
			if (event === 'input') {
				this.inputHandlers.push(handler);
			}
		},
		registerCommand(name, options) {
			this.commands.set(name, options);
		},
	};
}

export function makeCoreResult<TData>(input: {
	data?: TData;
	message?: string;
	status?: CoreResultStatus;
}): CoreResult<TData> {
	const result: CoreResult<TData> = {
		blockers: [],
		changedPaths: [],
		dryRun: false,
		errors: [],
		message: { body: input.message ?? 'ok', kind: 'status' },
		status: input.status ?? 'ok',
		warnings: [],
	};

	if (input.data !== undefined) {
		result.data = input.data;
	}

	return result;
}

export function statusResultForMode(mode: IntakeMode): CoreResult<unknown> {
	return makeCoreResult({ data: { mode } });
}

export function handledMessageResult(
	body = 'handled intake message',
): HandleIntakeMessageResult {
	return makeCoreResult({
		data: {
			mode: 'intake_active' as const,
			stateChanged: true,
			transition: 'answer_accepted' as const,
		},
		message: body,
	});
}

export type FakeCoreHarness = {
	core: LogosCore;
	getStatus: ReturnType<typeof vi.fn>;
	handleIntakeMessage: ReturnType<typeof vi.fn>;
	handleIntakeCommand: ReturnType<typeof vi.fn>;
	startIntake: ReturnType<typeof vi.fn>;
	generate: ReturnType<typeof vi.fn>;
};

export function createFakeCore(options?: {
	statusResult?: CoreResult<unknown>;
	messageResult?: HandleIntakeMessageResult;
}): FakeCoreHarness {
	const getStatus = vi.fn(async () =>
		options?.statusResult === undefined
			? statusResultForMode('idle')
			: options.statusResult,
	);
	const handleIntakeMessage = vi.fn(async () =>
		options?.messageResult === undefined
			? handledMessageResult()
			: options.messageResult,
	);
	const handleIntakeCommand = vi.fn(async () => makeCoreResult({}));
	const startIntake = vi.fn(async () => makeCoreResult({}));
	const stopIntake = vi.fn(async () => makeCoreResult({}));
	const generate = vi.fn(async () => makeCoreResult({}));
	const initProject = vi.fn(async () => makeCoreResult({}));

	return {
		core: {
			generate: generate as unknown as LogosCore['generate'],
			getStatus: getStatus as unknown as LogosCore['getStatus'],
			handleIntakeCommand:
				handleIntakeCommand as unknown as LogosCore['handleIntakeCommand'],
			handleIntakeMessage:
				handleIntakeMessage as unknown as LogosCore['handleIntakeMessage'],
			initProject: initProject as unknown as LogosCore['initProject'],
			startIntake: startIntake as unknown as LogosCore['startIntake'],
			stopIntake: stopIntake as unknown as LogosCore['stopIntake'],
		},
		generate,
		getStatus,
		handleIntakeCommand,
		handleIntakeMessage,
		startIntake,
	};
}

export function makeDeps(input: {
	core: LogosCore;
	pi?: FakePi;
	getProjectRoot?: ((ctx: { cwd?: string }) => string) | undefined;
	renderCoreResult?: LogosPiExtensionDependencies['renderCoreResult'];
}): LogosPiExtensionDependencies {
	const deps: LogosPiExtensionDependencies = {
		core: input.core,
		pi: (input.pi ??
			createFakePi()) as unknown as LogosPiExtensionDependencies['pi'],
	};

	if (input.getProjectRoot !== undefined) {
		deps.getProjectRoot = input.getProjectRoot;
	}

	if (input.renderCoreResult !== undefined) {
		deps.renderCoreResult = input.renderCoreResult;
	}

	return deps;
}

export function inputEvent(
	text: string,
	source: 'interactive' | 'rpc' | 'extension' = 'interactive',
): LogosPiInputEvent {
	return { source, text, type: 'input' } as LogosPiInputEvent;
}

export function inputEventWithoutSource(text: string): LogosPiInputEvent {
	return { text, type: 'input' } as unknown as LogosPiInputEvent;
}

export function ctx(cwd = '/workspace/project'): LogosPiEventContext {
	return { cwd } as LogosPiEventContext;
}
