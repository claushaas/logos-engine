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
import {
	createNoUiBlockedResult,
	createPartialGenerationCancelledResult,
	getPartialGenerationConfirmationRequirement,
} from '../confirmations/partial-generation-confirmation.js';
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
			return input.deps.core.initProject({
				profileSourcePath: input.deps.profileSourcePath,
				projectRoot: input.projectRoot,
			});
		case 'logos-start': {
			const result = await input.deps.core.startIntake({
				projectRoot: input.projectRoot,
				...(input.now !== undefined ? { now: input.now } : {}),
			});
			if (result.status === 'ok') {
				const data = result.data as Record<string, unknown> | undefined;
				const prompt = data?.activePrompt;
				if (prompt !== undefined) {
					sendIntakeInstruction(
						input.deps.pi,
						prompt as import('../../core/index.js').ActivePrompt,
					);
				}
			}
			return result;
		}
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

		const disposition = getDisposition(interruptionResult.data);

		// Skip rendering for execute — internal diagnostics, not user-facing.
		if (disposition !== 'execute' || interruptionResult.status !== 'ok') {
			await renderCoreResult({
				ctx: input.ctx,
				deps: input.deps,
				result: interruptionResult,
			});
		}
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

			// logos-start sends question via sendUserMessage; skip renderCoreResult.
			if (input.command !== 'logos-start' || commandResult.status !== 'ok') {
				await renderCoreResult({
					ctx: input.ctx,
					deps: input.deps,
					result: commandResult,
				});
			}
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

// ---------------------------------------------------------------------------
// Generate-specific command adapter

function sendIntakeInstruction(
	pi: import('../pi-types.js').LogosPiExtensionApi,
	prompt: import('../../core/index.js').ActivePrompt,
): void {
	const loc: string[] = [];
	if (prompt.phaseId) loc.push(prompt.phaseId);
	if (prompt.documentId) loc.push(prompt.documentId);
	if (prompt.sectionId) loc.push(prompt.sectionId);
	const locStr =
		loc.length > 0
			? ' (' +
				loc.join(' / ') +
				(prompt.priority ? ' ' + prompt.priority : '') +
				')'
			: '';
	const context =
		prompt.context && prompt.context.length > 0
			? '\nContext: ' + prompt.context
			: '';
	const msg =
		'LOGOS intake' +
		locStr +
		context +
		'\nAsk the user conversationally, in their language:\n' +
		prompt.text;

	const piAny = pi as unknown as Record<string, unknown>;
	const fn = piAny['sendUserMessage'];
	if (typeof fn === 'function') {
		try {
			(fn as (m: string) => void)(msg);
		} catch {
			/* */
		}
	}
}

// ---------------------------------------------------------------------------
// Generate-specific command adapter (Step 9.3)

/**
 * Input type for the generate-specific command adapter.
 */
export type RunGenerateCommandAdapterInput = {
	deps: LogosPiExtensionDependencies;
	ctx: LogosPiCommandContext;
	args?: string[] | undefined;
};

/**
 * Generate-specific command adapter that adds partial generation
 * confirmation UI after the initial Core generate result.
 *
 * Flow:
 * 1. Handle intake command interruption (same as shared adapter).
 * 2. Render interruption result.
 * 3. Call core.generate(...) with default mode.
 * 4. Render initial generation result (shows blockers/readiness).
 * 5. If Core result requires explicit confirmation AND UI is available:
 *    a. Ask ctx.ui.confirm(...) for user approval.
 *    b. If confirmed: call core.generate(...) with partial_draft
 *       mode and confirmation flag, then render result.
 *    c. If declined: render cancellation, write nothing.
 * 6. If Core result requires confirmation but UI is unavailable:
 *    a. Render no-UI blocked result, write nothing.
 *
 * Rules:
 * - Never treats confirmation as a final-generation bypass.
 * - Never retries generate in "final" mode after confirmation.
 * - Pi does not write files directly.
 * - Pi does not call handleIntakeMessage.
 */
export async function runGenerateCommandAdapter(
	input: RunGenerateCommandAdapterInput,
): Promise<void> {
	const projectRoot = resolveProjectRoot(input.deps, input.ctx);
	const now = input.deps.now?.();
	const generateArgs = now !== undefined ? { now } : {};

	try {
		// Step 1: Handle interruption.
		const interruptionResult = await input.deps.core.handleIntakeCommand({
			command: 'logos-generate',
			projectRoot,
			...generateArgs,
		});

		const disposition = getDisposition(interruptionResult.data);

		// Skip rendering for execute — internal diagnostics, not user-facing.
		if (disposition !== 'execute' || interruptionResult.status !== 'ok') {
			await renderCoreResult({
				ctx: input.ctx,
				deps: input.deps,
				result: interruptionResult,
			});
		}
		if (!isExecutableDisposition(disposition)) {
			return;
		}

		try {
			// Step 2: Initial generate call (default mode, no confirmation).
			const initialResult = await runCommandSpecificCoreAction({
				args: input.args,
				command: 'logos-generate',
				deps: input.deps,
				projectRoot,
				...generateArgs,
			});

			// Step 3: Render initial result (shows blockers / readiness).
			await renderCoreResult({
				ctx: input.ctx,
				deps: input.deps,
				result: initialResult,
			});

			// Step 4: Check if confirmation is required.
			const confirmationReq =
				getPartialGenerationConfirmationRequirement(initialResult);

			if (!confirmationReq.required) {
				return;
			}

			// Step 5: Check UI availability.
			const hasUi =
				input.ctx.hasUI !== false &&
				typeof input.ctx.ui?.confirm === 'function';

			if (!hasUi) {
				await renderCoreResult({
					ctx: input.ctx,
					deps: input.deps,
					result: createNoUiBlockedResult(),
				});
				return;
			}

			// Step 6: Ask for user confirmation.
			const confirmed = await input.ctx.ui.confirm(
				'Partial Draft Generation',
				'Generation is blocked for final documentation, but LOGOS can create an incomplete partial draft. This may write files marked as INCOMPLETE DRAFT. Continue?',
			);

			if (!confirmed) {
				await renderCoreResult({
					ctx: input.ctx,
					deps: input.deps,
					result: createPartialGenerationCancelledResult(),
				});
				return;
			}

			// Step 7: Call Core generate with confirmation flag.
			// Never retry final mode — always use partial_draft.
			const confirmedResult = await input.deps.core.generate({
				confirmedPartialGeneration: true,
				mode: 'partial_draft',
				projectRoot,
				...generateArgs,
			});

			// Step 8: Render confirmed generation result.
			await renderCoreResult({
				ctx: input.ctx,
				deps: input.deps,
				result: confirmedResult,
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
