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
import { setPendingIntakePrompt } from '../intake-model-bridge.js';
import type {
	LogosPiEventContext,
	LogosPiInputEvent,
	LogosPiInputHandlerResult,
} from '../pi-types.js';
import { getProjectRootFromContext } from '../project-root.js';

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

	// 5. Status / active-state lookup.
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

	// 6. Evaluate answer and store next question as pending.
	// The agent_end handler will send it after the agent finishes responding.
	try {
		const result = await deps.core.handleIntakeMessage({
			message: event.text,
			projectRoot,
		});

		if (result.status === 'ok') {
			const data = result.data as Record<string, unknown> | undefined;
			const prompt = data?.activePrompt;
			if (prompt !== undefined) {
				setPendingIntakePrompt(
					prompt as import('../../core/index.js').ActivePrompt,
				);
			}
		}
	} catch {
		// Silently ignore.
	}

	return { action: 'continue' };
}

export function toPiInputResult(
	result: PiInputRouteResult,
): LogosPiInputHandlerResult {
	return result;
}
