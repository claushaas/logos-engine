/**
 * LOGOS Pi Extension — Command adapter contract (Step 5.5).
 *
 * Defines the contract that Phase 7 command adapters must satisfy.
 * This module provides:
 * - A dependency type that captures what a Pi command handler needs from Core.
 * - A thin `registerLogosLifecycleCommands` helper that wires the five
 *   allowed LOGOS lifecycle commands to Core through a Pi-like registration
 *   surface.
 *
 * Rules enforced by this contract:
 * - Only the five allowed commands are registered.
 * - Command names DO NOT include a leading slash.
 * - Every handler calls `core.handleIntakeCommand(...)` first.
 * - `core.handleIntakeMessage(...)` is never called from lifecycle handlers.
 * - The handler only calls command-specific Core APIs when the interruption
 *   disposition allows it.
 *
 * This module is a TEST CONTRACT — it is intentionally thin and does not
 * import real Pi APIs.  The Pi registration surface is a minimal interface
 * that the fake harness in tests also implements.
 */

import type {
	HandleIntakeCommandResult,
	IntakeCommandDisposition,
	LogosCore,
} from '../../core/api.js';
import type { LogosLifecycleCommand } from '../../core/intake/lifecycle-command.js';

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

export type LogosCommandAdapterDependencies = {
	/** Core API subset needed by lifecycle command handlers. */
	core: Pick<
		LogosCore,
		| 'handleIntakeCommand'
		| 'initProject'
		| 'startIntake'
		| 'stopIntake'
		| 'getStatus'
		| 'generate'
	>;
	/** Resolve project root from Pi command context cwd. */
	getProjectRoot(input: { cwd: string }): string;
	/** Render a Core result to the user (fake in tests). */
	renderCoreResult?: (result: unknown) => Promise<void> | void;
};

/**
 * Minimal Pi registration surface used by the command adapter.
 *
 * Only the subset of the real `ExtensionAPI` that the adapter actually
 * needs is captured here.  This keeps the adapter testable without Pi.
 */
export type PiCommandRegistrationSurface = {
	registerCommand(
		name: string,
		handler: (ctx: { cwd: string }, args?: string[]) => Promise<void> | void,
	): void;
};

// ---------------------------------------------------------------------------
// Interruption disposition → behaviour mapping
// ---------------------------------------------------------------------------

/** Command-specific Core method name. */
type CommandMethod =
	| 'initProject'
	| 'startIntake'
	| 'stopIntake'
	| 'getStatus'
	| 'generate';

/**
 * Result of processing a core.handleIntakeCommand(...) call.
 *
 * Guides the handler on which command-specific method (if any) to invoke.
 */
type InterruptionDecision =
	| {
			action: 'reaffirm' | 'block' | 'confirm_required';
			result: HandleIntakeCommandResult;
	  }
	| {
			action: 'pause_and_execute' | 'execute';
			result: HandleIntakeCommandResult;
			commandMethod: CommandMethod;
	  };

const COMMAND_METHOD_MAP: Record<LogosLifecycleCommand, CommandMethod> = {
	'logos-generate': 'generate',
	'logos-init': 'initProject',
	'logos-start': 'startIntake',
	'logos-status': 'getStatus',
	'logos-stop': 'stopIntake',
};

function mapDisposition(
	disposition: IntakeCommandDisposition,
	result: HandleIntakeCommandResult,
	command: LogosLifecycleCommand,
): InterruptionDecision {
	const commandMethod = COMMAND_METHOD_MAP[command];

	switch (disposition) {
		case 'reaffirm':
			return { action: 'reaffirm', result };
		case 'confirm_required':
			return { action: 'confirm_required', result };
		case 'block':
			return { action: 'block', result };
		case 'pause_and_execute':
			return {
				action: 'pause_and_execute',
				commandMethod,
				result,
			};
		case 'execute':
			return {
				action: 'execute',
				commandMethod,
				result,
			};
	}
}

// ---------------------------------------------------------------------------
// Individual command handler factories
// ---------------------------------------------------------------------------

function makeCommandHandler(
	deps: LogosCommandAdapterDependencies,
	command: LogosLifecycleCommand,
): (ctx: { cwd: string }, args?: string[]) => Promise<void> {
	return async (ctx: { cwd: string }, _args?: string[]) => {
		const projectRoot = deps.getProjectRoot({ cwd: ctx.cwd });

		// 1. Always call handleIntakeCommand first.
		const interruption = await deps.core.handleIntakeCommand({
			command,
			projectRoot,
		});

		const disposition = interruption.data?.disposition;
		if (disposition === undefined) {
			// No disposition data — treat as block.
			await deps.renderCoreResult?.(interruption);
			return;
		}

		const decision = mapDisposition(disposition, interruption, command);

		// 2. Always render the interruption result first.
		await deps.renderCoreResult?.(interruption);

		// 3. Only call command-specific Core API when allowed.
		switch (decision.action) {
			case 'reaffirm':
			case 'block':
			case 'confirm_required':
				// Do not call command-specific method.
				return;
			case 'pause_and_execute':
			case 'execute': {
				// Call command-specific method after interruption.
				const coreMethod = deps.core[decision.commandMethod];
				const commandResult = await coreMethod({ projectRoot });
				await deps.renderCoreResult?.(commandResult);
				return;
			}
		}

		// Note: handleIntakeMessage is NEVER called from command handlers.
	};
}

// ---------------------------------------------------------------------------
// Public registration function
// ---------------------------------------------------------------------------

/**
 * Register the five allowed LOGOS lifecycle commands on a Pi-like
 * command registration surface.
 *
 * Each handler:
 * 1. Calls `core.handleIntakeCommand(...)` first.
 * 2. Inspects the disposition to decide whether to call the command-specific
 *    Core API.
 * 3. Never calls `core.handleIntakeMessage(...)`.
 *
 * Only these commands are registered:
 *   logos-init, logos-start, logos-stop, logos-status, logos-generate
 *
 * Command names do not include a leading slash.
 */
export function registerLogosLifecycleCommands(input: {
	pi: PiCommandRegistrationSurface;
	deps: LogosCommandAdapterDependencies;
}): void {
	const allowedCommands: LogosLifecycleCommand[] = [
		'logos-init',
		'logos-start',
		'logos-stop',
		'logos-status',
		'logos-generate',
	];

	for (const command of allowedCommands) {
		input.pi.registerCommand(command, makeCommandHandler(input.deps, command));
	}
}
