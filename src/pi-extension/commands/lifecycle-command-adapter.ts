/**
 * LOGOS Pi Extension — Lifecycle command adapter (Step 7.4).
 *
 * Shared command adapter for the five LOGOS lifecycle commands.  It resolves
 * Pi context, delegates interruption policy to Core, executes command-specific
 * Core APIs only when Core allows it, and forwards results to the rendering
 * boundary.
 */

import type {
	CoreResult,
	HandleIntakeCommandData,
	IntakeCommandDisposition,
	LogosLifecycleCommand,
} from '../../core/index.js';
import { createCoreResult, createLogosError } from '../../core/index.js';
import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type { LogosPiCommandContext } from '../pi-types.js';
import { getProjectRootFromContext } from '../project-root.js';
import { renderCoreResult } from '../rendering/render-core-result.js';

export type RunLifecycleCommandAdapterInput = {
	deps: LogosPiExtensionDependencies;
	ctx: LogosPiCommandContext;
	args?: string[] | undefined;
	command: LogosLifecycleCommand;
};

export type RunCommandSpecificCoreActionInput = {
	deps: LogosPiExtensionDependencies;
	command: LogosLifecycleCommand;
	projectRoot: string;
	args?: string[] | undefined;
	now?: string | undefined;
};

function safeCoreErrorResult(message: string): CoreResult<unknown> {
	return createCoreResult({
		errors: [
			createLogosError({
				code: 'pi_extension_api_unavailable',
				message,
			}),
		],
		message: {
			body: message,
			kind: 'error',
		},
		status: 'failed',
	});
}

function resolveProjectRoot(
	deps: LogosPiExtensionDependencies,
	ctx: LogosPiCommandContext,
): string {
	const getProjectRoot = deps.getProjectRoot ?? getProjectRootFromContext;
	return getProjectRoot(ctx);
}

function isExecutableDisposition(
	disposition: IntakeCommandDisposition | undefined,
): disposition is 'execute' | 'pause_and_execute' {
	return disposition === 'execute' || disposition === 'pause_and_execute';
}

function getDisposition(
	data: HandleIntakeCommandData | undefined,
): IntakeCommandDisposition | undefined {
	return data?.disposition;
}

export async function runCommandSpecificCoreAction(
	input: RunCommandSpecificCoreActionInput,
): Promise<CoreResult<unknown>> {
	void input.args;

	switch (input.command) {
		case 'logos-init':
			return input.deps.core.initProject({ projectRoot: input.projectRoot });
		case 'logos-start':
			return input.deps.core.startIntake({
				projectRoot: input.projectRoot,
				...(input.now !== undefined ? { now: input.now } : {}),
			});
		case 'logos-stop':
			return input.deps.core.stopIntake({
				projectRoot: input.projectRoot,
				...(input.now !== undefined ? { now: input.now } : {}),
			});
		case 'logos-status':
			return input.deps.core.getStatus({ projectRoot: input.projectRoot });
		case 'logos-generate':
			return input.deps.core.generate({
				projectRoot: input.projectRoot,
				...(input.now !== undefined ? { now: input.now } : {}),
			});
	}
}

export async function runLifecycleCommandAdapter(
	input: RunLifecycleCommandAdapterInput,
): Promise<void> {
	const projectRoot = resolveProjectRoot(input.deps, input.ctx);
	const now = input.deps.now?.();

	try {
		const interruptionResult = await input.deps.core.handleIntakeCommand({
			command: input.command,
			projectRoot,
			...(now !== undefined ? { now } : {}),
		});

		await renderCoreResult({
			ctx: input.ctx,
			deps: input.deps,
			result: interruptionResult,
		});

		const disposition = getDisposition(interruptionResult.data);
		if (!isExecutableDisposition(disposition)) {
			return;
		}

		try {
			const commandResult = await runCommandSpecificCoreAction({
				args: input.args,
				command: input.command,
				deps: input.deps,
				projectRoot,
				...(now !== undefined ? { now } : {}),
			});

			await renderCoreResult({
				ctx: input.ctx,
				deps: input.deps,
				result: commandResult,
			});
		} catch {
			await renderCoreResult({
				ctx: input.ctx,
				deps: input.deps,
				result: safeCoreErrorResult(
					'LOGOS command execution failed unexpectedly.',
				),
			});
		}
	} catch {
		await renderCoreResult({
			ctx: input.ctx,
			deps: input.deps,
			result: safeCoreErrorResult(
				'LOGOS command interruption handling failed unexpectedly.',
			),
		});
	}
}
