/**
 * LOGOS Pi Extension — Input router (Step 8.1).
 *
 * Adapter-only routing for normal Pi input events.  Product behavior stays in
 * Core; this module only decides whether LOGOS should claim the input event
 * and forwards active-intake natural-language messages to Core.
 */

import type { CoreResult, IntakeMode } from '../../core/index.js';
import { createCoreResult, createLogosError } from '../../core/index.js';
import type { LogosPiExtensionDependencies } from '../extension-dependencies.js';
import type {
	LogosPiEventContext,
	LogosPiInputEvent,
	LogosPiInputHandlerResult,
} from '../pi-types.js';
import { getProjectRootFromContext } from '../project-root.js';
import { renderCoreResult } from '../rendering/render-core-result.js';

export type PiInputRouteResult = { action: 'continue' } | { action: 'handled' };

export type RoutePiInputInput = {
	deps: LogosPiExtensionDependencies;
	event: LogosPiInputEvent;
	ctx: LogosPiEventContext;
};

type StatusDataWithMode = {
	mode?: unknown;
	intake?: { mode?: unknown };
	intakeState?: { mode?: unknown };
	status?: { intakeMode?: unknown };
};

const INTAKE_MODES: readonly IntakeMode[] = [
	'idle',
	'intake_active',
	'paused',
	'generating',
	'complete',
];

function isIntakeMode(value: unknown): value is IntakeMode {
	return (
		typeof value === 'string' && INTAKE_MODES.includes(value as IntakeMode)
	);
}

function readObject(value: unknown): StatusDataWithMode | null {
	return typeof value === 'object' && value !== null
		? (value as StatusDataWithMode)
		: null;
}

/**
 * Read active intake mode from public Core status data only.
 *
 * Fail closed: if the shape is unknown, return null so Pi normal behavior
 * continues instead of LOGOS intercepting uncertain input.
 */
export function getIntakeModeFromStatusResult(
	result: CoreResult<unknown>,
): IntakeMode | null {
	if (result.status !== 'ok' && result.status !== 'noop') {
		return null;
	}

	const data = readObject(result.data);
	if (data === null) {
		return null;
	}

	const candidates = [
		data.mode,
		data.intake?.mode,
		data.intakeState?.mode,
		data.status?.intakeMode,
	];

	for (const candidate of candidates) {
		if (isIntakeMode(candidate)) {
			return candidate;
		}
	}

	return null;
}

function resolveProjectRoot(
	deps: LogosPiExtensionDependencies,
	ctx: LogosPiEventContext,
): string {
	const getProjectRoot = deps.getProjectRoot ?? getProjectRootFromContext;
	return getProjectRoot(ctx);
}

function safeInputHandlingErrorResult(): CoreResult<unknown> {
	return createCoreResult({
		errors: [
			createLogosError({
				code: 'pi_extension_api_unavailable',
				message: 'LOGOS intake message handling failed unexpectedly.',
			}),
		],
		message: {
			body: 'LOGOS intake message handling failed unexpectedly.',
			kind: 'error',
		},
		status: 'failed',
	});
}

function isSlashCommand(text: string): boolean {
	return text.trim().startsWith('/');
}

export async function routePiInput(
	input: RoutePiInputInput,
): Promise<PiInputRouteResult> {
	const { deps, event, ctx } = input;

	// 1. Extension source guard — prevent extension-injected message loops.
	if (event.source === 'extension') {
		return { action: 'continue' };
	}

	// 2. Empty input guard.
	if (event.text.trim().length === 0) {
		return { action: 'continue' };
	}

	// 3. Slash command guard — command text is never an intake answer.
	if (isSlashCommand(event.text)) {
		return { action: 'continue' };
	}

	// 4. Project root resolution.
	const projectRoot = resolveProjectRoot(deps, ctx);

	// 5. Status / active-state lookup.  Fail open to normal Pi behavior when
	// status is unavailable or ambiguous.
	let statusResult: CoreResult<unknown>;
	try {
		statusResult = await deps.core.getStatus({ projectRoot });
	} catch {
		return { action: 'continue' };
	}

	const intakeMode = getIntakeModeFromStatusResult(statusResult);
	if (intakeMode !== 'intake_active') {
		return { action: 'continue' };
	}

	// 6. Active intake natural message: Core owns all product behavior.
	try {
		const result = await deps.core.handleIntakeMessage({
			message: event.text,
			projectRoot,
		});

		await renderCoreResult({ ctx, deps, result });
	} catch {
		await renderCoreResult({
			ctx,
			deps,
			result: safeInputHandlingErrorResult(),
		});
	}

	return { action: 'handled' };
}

export function toPiInputResult(
	result: PiInputRouteResult,
): LogosPiInputHandlerResult {
	return result;
}
