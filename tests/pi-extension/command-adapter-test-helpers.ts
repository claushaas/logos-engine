import type {
	CoreResult,
	HandleIntakeCommandData,
	IntakeCommandDisposition,
	LogosCore,
	LogosLifecycleCommand,
} from '../../src/core/index.js';
import { createCoreResult } from '../../src/core/index.js';
import type { LogosPiExtensionDependencies } from '../../src/pi-extension/extension-dependencies.js';
import type { LogosPiCommandContext } from '../../src/pi-extension/pi-types.js';

type CoreCallMethod =
	| 'handleIntakeCommand'
	| 'initProject'
	| 'startIntake'
	| 'stopIntake'
	| 'getStatus'
	| 'generate'
	| 'handleIntakeMessage';

export type RecordedCoreCall = {
	method: CoreCallMethod;
	input: unknown;
};

export type RenderedCoreResult = {
	result: CoreResult<unknown>;
	ctx: LogosPiCommandContext;
};

export function createResult<TData>(input: {
	body: string;
	data?: TData;
	status?: CoreResult<TData>['status'];
}): CoreResult<TData> {
	return createCoreResult({
		...(input.data !== undefined ? { data: input.data } : {}),
		message: { body: input.body, kind: 'status' },
		status: input.status ?? 'ok',
	});
}

export function createInterruptionResult(
	disposition: IntakeCommandDisposition,
	command: LogosLifecycleCommand = 'logos-status',
): CoreResult<HandleIntakeCommandData> {
	return createCoreResult({
		data: {
			command,
			disposition,
			mode: disposition === 'pause_and_execute' ? 'paused' : 'idle',
			persisted: disposition === 'pause_and_execute',
			stateChanged: disposition === 'pause_and_execute',
		},
		message: {
			body: `Disposition: ${disposition}`,
			kind:
				disposition === 'confirm_required'
					? 'confirmation_request'
					: disposition === 'block'
						? 'error'
						: 'status',
		},
		status:
			disposition === 'confirm_required'
				? 'confirmation_required'
				: disposition === 'block'
					? 'blocked'
					: 'ok',
	});
}

export function createFakeCommandContext(cwd = '/repo'): LogosPiCommandContext {
	return {
		cwd,
		ui: {
			notify: () => {},
		},
	} as LogosPiCommandContext;
}

export function createAdapterHarness(options?: {
	disposition?: IntakeCommandDisposition;
	projectRoot?: string;
	now?: string;
}): {
	calls: RecordedCoreCall[];
	core: LogosCore;
	deps: LogosPiExtensionDependencies;
	rendered: RenderedCoreResult[];
	setInterruptionResult(result: CoreResult<HandleIntakeCommandData>): void;
	setCommandResult(result: CoreResult<unknown>): void;
} {
	const calls: RecordedCoreCall[] = [];
	const rendered: RenderedCoreResult[] = [];
	let interruptionResult = createInterruptionResult(
		options?.disposition ?? 'execute',
	);
	let commandResult = createResult({ body: 'command result' });

	function record(method: CoreCallMethod, input: unknown): void {
		calls.push({ input, method });
	}

	const core: LogosCore = {
		async generate(input) {
			record('generate', input);
			return commandResult as Awaited<ReturnType<LogosCore['generate']>>;
		},
		async getStatus(input) {
			record('getStatus', input);
			return commandResult as Awaited<ReturnType<LogosCore['getStatus']>>;
		},
		async handleIntakeCommand(input) {
			record('handleIntakeCommand', input);
			return interruptionResult;
		},
		async handleIntakeMessage(input) {
			record('handleIntakeMessage', input);
			return createResult({ body: 'unexpected intake message' }) as Awaited<
				ReturnType<LogosCore['handleIntakeMessage']>
			>;
		},
		async initProject(input) {
			record('initProject', input);
			return commandResult as Awaited<ReturnType<LogosCore['initProject']>>;
		},
		async startIntake(input) {
			record('startIntake', input);
			return commandResult as Awaited<ReturnType<LogosCore['startIntake']>>;
		},
		async stopIntake(input) {
			record('stopIntake', input);
			return commandResult as Awaited<ReturnType<LogosCore['stopIntake']>>;
		},
	};

	const deps: LogosPiExtensionDependencies = {
		core,
		getProjectRoot: (ctx) => options?.projectRoot ?? ctx.cwd ?? '/fallback',
		now: options?.now !== undefined ? () => options.now as string : undefined,
		pi: {} as LogosPiExtensionDependencies['pi'],
		renderCoreResult: (result, ctx) => {
			rendered.push({ ctx, result });
		},
	};

	return {
		calls,
		core,
		deps,
		rendered,
		setCommandResult(result) {
			commandResult = result;
		},
		setInterruptionResult(result) {
			interruptionResult = result;
		},
	};
}
