/**
 * LOGOS Core — Handle intake command (Step 5.1).
 *
 * Core-owned command interruption logic for all allowed LOGOS lifecycle
 * commands that arrive while intake mode is active.
 *
 * This module:
 * 1. Defines the {@link IntakeCommandDisposition} union.
 * 2. Exposes a pure {@link resolveIntakeCommandDisposition} helper that
 *    determines how a given lifecycle command should be handled based on
 *    the current intake mode and active-prompt state.
 * 3. Provides {@link handleIntakeCommand} — the main Core function that
 *    loads state, resolves the disposition, and returns a structured
 *    {@link HandleIntakeCommandResult}.
 *
 * Full pause/persist behavior is implemented in later Phase 5 steps.
 * Step 5.1 returns disposition results with `stateChanged: false` and
 * `persisted: false`.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { loadLogosConfig } from '../config/load-config.js';
import type { AssistantMessage } from '../messages.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import { ensureProfileReady } from '../profiles/profile-gate.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../state/intake-state-persistence.js';
import type {
	ActivePromptState,
	IntakeMode,
	IntakeProgress,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import { createAssistantMessageFromPrompt } from './assistant-message-from-prompt.js';
import type { LogosLifecycleCommand } from './lifecycle-command.js';
import type { ActivePrompt } from './prompt-selection-types.js';
import { rebuildActivePrompt } from './rebuild-active-prompt.js';

// ---------------------------------------------------------------------------
// Disposition
// ---------------------------------------------------------------------------

/**
 * The action Core prescribes when a lifecycle command is received.
 *
 * | Value              | Meaning |
 * |--------------------|---------|
 * | `reaffirm`         | Re-emit the active prompt without pausing or advancing. Used for `logos-start` during active intake. |
 * | `pause_and_execute`| Preserve the active prompt, pause intake, then allow command-specific behaviour. Used for `logos-stop`, `logos-status`, `logos-generate` during active intake. |
 * | `confirm_required` | Block until the user explicitly confirms a potentially destructive action. Used for `logos-init` during active intake. |
 * | `block`            | The command cannot be handled safely (invalid command, missing state, or unsafe case). |
 * | `execute`          | Intake is not active; the command may run normally. |
 */
export type IntakeCommandDisposition =
	| 'reaffirm'
	| 'pause_and_execute'
	| 'confirm_required'
	| 'block'
	| 'execute';

// ---------------------------------------------------------------------------
// Pure disposition resolver
// ---------------------------------------------------------------------------

/**
 * Input for the pure {@link resolveIntakeCommandDisposition} helper.
 */
export type ResolveIntakeCommandDispositionInput = {
	/** The lifecycle command being handled. */
	command: LogosLifecycleCommand;
	/** Current intake mode from the loaded state. */
	mode: IntakeMode;
	/** Whether the loaded state contains an active prompt record. */
	hasActivePrompt: boolean;
	/** Whether the user has explicitly confirmed a destructive action. */
	confirmed?: boolean | undefined;
};

/**
 * Result of the pure {@link resolveIntakeCommandDisposition} helper.
 */
export type ResolveIntakeCommandDispositionResult = {
	/** The resolved disposition. */
	disposition: IntakeCommandDisposition;
	/** Human-readable explanation for logging and diagnostics. */
	reason: string;
};

/**
 * Pure helper that determines how a lifecycle command should be handled
 * based on the current intake mode and whether an active prompt exists.
 *
 * This function is deterministic, side-effect-free, and never throws.
 * It does not load state, persist files, or call external services.
 *
 * Rules:
 *
 * When `mode !== "intake_active"`:
 * - All allowed commands → `execute`.
 *
 * When `mode === "intake_active"`:
 * - `logos-start` → `reaffirm` (re-emit active prompt without advancing).
 * - `logos-stop` → `pause_and_execute` (preserve, then pause).
 * - `logos-status` → `pause_and_execute` (preserve, persist, then report).
 * - `logos-generate` → `pause_and_execute` (preserve, persist, then preflight).
 * - `logos-init` → `confirm_required` (warn about state loss before re-init).
 */
export function resolveIntakeCommandDisposition(
	input: ResolveIntakeCommandDispositionInput,
): ResolveIntakeCommandDispositionResult {
	const { command, mode, hasActivePrompt, confirmed } = input;

	// ------------------------------------------------------------------
	// Intake is NOT active — command can execute normally.
	// ------------------------------------------------------------------
	if (mode !== 'intake_active') {
		return {
			disposition: 'execute',
			reason: `Intake mode is "${mode}" — command "${command}" can execute normally.`,
		};
	}

	// ------------------------------------------------------------------
	// Intake IS active — resolve per-command disposition.
	// ------------------------------------------------------------------

	switch (command) {
		case 'logos-start':
			if (!hasActivePrompt) {
				return {
					disposition: 'block',
					reason:
						'Intake is active but no active prompt exists — cannot reaffirm.',
				};
			}
			return {
				disposition: 'reaffirm',
				reason:
					'Intake is already active — re-emitting active prompt without advancing.',
			};

		case 'logos-stop':
			return {
				disposition: 'pause_and_execute',
				reason:
					'Pausing intake before executing logos-stop to preserve active state.',
			};

		case 'logos-status':
			return {
				disposition: 'pause_and_execute',
				reason:
					'Pausing intake before executing logos-status to preserve active state.',
			};

		case 'logos-generate':
			return {
				disposition: 'pause_and_execute',
				reason:
					'Pausing intake before executing logos-generate to preserve active state.',
			};

		case 'logos-init': {
			// MVP behaviour: always require confirmation during active intake.
			// The confirmed path is reserved for a future implementation step.
			if (confirmed === true) {
				return {
					disposition: 'pause_and_execute',
					reason:
						'User confirmed re-initialization — pausing intake before destructive reset.',
				};
			}
			return {
				disposition: 'confirm_required',
				reason:
					'Intake is active — re-initialization would discard state and requires explicit confirmation.',
			};
		}

		default: {
			// Exhaustiveness: this path cannot be reached with the current
			// LogosLifecycleCommand union, but TypeScript requires a default.
			const _exhaustive: never = command;
			return {
				disposition: 'block',
				reason: `Unknown lifecycle command: ${String(_exhaustive)}`,
			};
		}
	}
}

// ---------------------------------------------------------------------------
// Public handleIntakeCommand input / output types
// ---------------------------------------------------------------------------

/**
 * Input for the public {@link handleIntakeCommand} function.
 *
 * Mirrors the public API type defined in `api.ts` but is self-contained
 * so the intake module does not need to import from the API layer.
 */
export type HandleIntakeCommandInput = {
	projectRoot: string;
	command: LogosLifecycleCommand;
	/** Whether the user has explicitly confirmed a destructive action. */
	confirmed?: boolean | undefined;
	/** ISO-8601 timestamp for deterministic state updates. */
	now?: string | undefined;
	/** When `true`, state is not persisted. */
	dryRun?: boolean | undefined;
	/** Optional filesystem port. When absent, only pure disposition is returned. */
	filesystem?: LogosFilesystem | undefined;
};

/**
 * Data payload inside a {@link HandleIntakeCommandResult}.
 */
export type HandleIntakeCommandData = {
	/** The lifecycle command that was handled. */
	command: LogosLifecycleCommand;
	/** Resolved disposition. */
	disposition: IntakeCommandDisposition;
	/** Current intake mode after disposition resolution. */
	mode: IntakeMode;
	/** The active question id at the time of the command, if one exists. */
	activeQuestionId?: string | undefined;
	/**
	 * The question id that must be preserved across the command execution.
	 * Present when an active prompt existed at the time of the command and
	 * the disposition requires preservation.
	 */
	preservedQuestionId?: string | undefined;
	/**
	 * The active prompt at the time of the command, if available and safe
	 * to expose as Core data.
	 */
	activePrompt?: ActivePrompt | undefined;
	/** Whether intake state was changed by this call. */
	stateChanged: boolean;
	/** Whether state was persisted in this call. */
	persisted: boolean;
};

/**
 * Public result type for the {@link handleIntakeCommand} function.
 */
export type HandleIntakeCommandResult = {
	status: 'ok' | 'blocked' | 'confirmation_required' | 'failed';
	message: AssistantMessage;
	data?: HandleIntakeCommandData | undefined;
	warnings: Array<{ code: string; message: string; severity: 'warning' }>;
	blockers: Array<{ code: string; message: string; severity: 'blocker' }>;
	errors: Array<{ code: string; message: string }>;
	dryRun: boolean;
};

// ---------------------------------------------------------------------------
// Pure disposition → status mapping
// ---------------------------------------------------------------------------

function dispositionToStatus(
	disposition: IntakeCommandDisposition,
): HandleIntakeCommandResult['status'] {
	switch (disposition) {
		case 'execute':
		case 'reaffirm':
		case 'pause_and_execute':
			return 'ok';
		case 'confirm_required':
			return 'confirmation_required';
		case 'block':
			return 'blocked';
	}
}

// ---------------------------------------------------------------------------
// Pause command whitelist (Step 5.3)
// ---------------------------------------------------------------------------

const PAUSE_COMMANDS: LogosLifecycleCommand[] = [
	'logos-stop',
	'logos-status',
	'logos-generate',
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the active prompt in `state` can be safely preserved.
 *
 * Performs structural validation (existence, kind, consistency) and,
 * when `registry` is provided, verifies the referenced question exists.
 *
 * Returns `{ ok: true }` when safe to preserve, or `{ ok: false, reason }`
 * with a human-readable explanation.
 */
function canPreserveActivePrompt(
	state: LogosIntakeState,
	registry?: import('../questions/question-registry.js').LogosQuestionRegistry,
): { ok: true } | { ok: false; reason: string } {
	if (state.activePrompt === undefined) {
		return { ok: false, reason: 'Active prompt is missing.' };
	}
	if (state.activeQuestionId === undefined) {
		return { ok: false, reason: 'Active question id is missing.' };
	}
	if (state.activeQuestionId !== state.activePrompt.questionId) {
		return {
			ok: false,
			reason: 'Active question id does not match active prompt question id.',
		};
	}

	if (
		state.activePrompt.kind !== 'question' &&
		state.activePrompt.kind !== 'follow_up' &&
		state.activePrompt.kind !== 'contradiction_resolution'
	) {
		return {
			ok: false,
			reason: `Invalid active prompt kind: ${state.activePrompt.kind}`,
		};
	}

	if (state.activePrompt.kind === 'contradiction_resolution') {
		const contradictionId = state.activePrompt.contradictionId;
		if (contradictionId === undefined) {
			return {
				ok: false,
				reason: 'Contradiction prompt is missing contradictionId.',
			};
		}
		if (state.contradictions[contradictionId] === undefined) {
			return {
				ok: false,
				reason: `Contradiction record "${contradictionId}" not found.`,
			};
		}
	}

	if (registry !== undefined) {
		const question = registry.byId[state.activeQuestionId];
		if (question === undefined) {
			return {
				ok: false,
				reason: `Active prompt references missing question "${state.activeQuestionId}".`,
			};
		}
	}

	return { ok: true };
}

// ---------------------------------------------------------------------------
// Progress summary helper
// ---------------------------------------------------------------------------

function formatProgressSummary(progress: IntakeProgress): string {
	const parts: string[] = [];
	if (progress.sufficient > 0) {
		parts.push(`${progress.sufficient} sufficient`);
	}
	if (progress.partial > 0) {
		parts.push(`${progress.partial} partial`);
	}
	if (progress.missing > 0) {
		parts.push(`${progress.missing} missing`);
	}
	if (progress.contradictory > 0) {
		parts.push(`${progress.contradictory} contradictory`);
	}
	if (parts.length === 0) {
		return 'No questions answered yet.';
	}
	return `Progress: ${parts.join(', ')} (${progress.sufficient}/${progress.total} complete).`;
}

// ---------------------------------------------------------------------------
// Pause message builder
// ---------------------------------------------------------------------------

function buildPauseMessage(
	command: LogosLifecycleCommand,
	progress: IntakeProgress,
): string {
	switch (command) {
		case 'logos-stop': {
			return `Intake paused. ${formatProgressSummary(progress)}`;
		}
		case 'logos-status': {
			const progressText = formatProgressSummary(progress);
			return `Intake paused before status. The current prompt was preserved. ${progressText}`;
		}
		case 'logos-generate': {
			return 'Intake paused before generation/preflight. The current prompt was preserved.';
		}
		default: {
			return 'Intake paused safely before executing this command.';
		}
	}
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

function buildMessageForDisposition(
	disposition: IntakeCommandDisposition,
	reason: string,
	activePrompt?: ActivePrompt,
): AssistantMessage {
	switch (disposition) {
		case 'execute':
			return {
				body: `Command can execute normally because intake is not active. (${reason})`,
				kind: 'status',
			};

		case 'reaffirm': {
			// Re-emit active prompt when available.
			if (activePrompt !== undefined) {
				return createAssistantMessageFromPrompt(activePrompt);
			}
			return {
				body: 'Intake is already active. The current question is no longer available.',
				kind: 'warning',
			};
		}

		case 'pause_and_execute':
			return {
				body: `Intake must be paused safely before executing this command. (${reason})`,
				kind: 'status',
			};

		case 'confirm_required':
			return {
				actions: [
					{ id: 'confirm_init', kind: 'confirm', label: 'Confirm' },
					{ id: 'cancel_init', kind: 'cancel', label: 'Cancel' },
				],
				body: `Active intake exists. Initializing or re-initializing will discard the current intake state. Do you want to proceed? (${reason})`,
				kind: 'confirmation_request',
			};

		case 'block':
			return {
				body: `Command cannot be handled safely. (${reason})`,
				kind: 'error',
			};
	}
}

// ---------------------------------------------------------------------------
// Rebuild ActivePrompt from state (reused from start-intake.ts pattern)
// ---------------------------------------------------------------------------

/**
 * Build a lightweight renderable prompt from persisted state.
 *
 * This is a simplified version that does not require a profile registry.
 * It carries the question id and a basic description, but does not
 * resolve the full question text or context.
 */
function buildActivePromptFromState(
	promptState: ActivePromptState,
): ActivePrompt {
	return {
		context: `Persisted prompt for question "${promptState.questionId}".`,
		documentId: '',
		kind: promptState.kind,
		phaseId: '',
		priority: 'important',
		questionId: promptState.questionId,
		required: false,
		sectionId: '',
		text: `Active intake question: ${promptState.questionId}`,
	};
}

// ---------------------------------------------------------------------------
// Main implementation
// ---------------------------------------------------------------------------

/**
 * Handle a lifecycle command that may arrive while intake mode is active.
 *
 * Step 5.3 implementation:
 * 1. If a filesystem port is provided, loads config and intake state to
 *    determine the current mode and active prompt.
 * 2. Resolves the disposition via {@link resolveIntakeCommandDisposition}.
 * 3. For `pause_and_execute` dispositions (logos-stop, logos-status,
 *    logos-generate), validates the active prompt, transitions mode to
 *    `paused`, persists state, and returns the preserved prompt metadata.
 * 4. Returns a structured result with disposition, mode, preserved question
 *    id, and (when available) the active prompt.
 */
export async function handleIntakeCommand(
	input: HandleIntakeCommandInput,
): Promise<HandleIntakeCommandResult> {
	const { projectRoot, command, confirmed, now, dryRun, filesystem } = input;
	const dry = dryRun ?? false;

	// ---- No filesystem → pure disposition with default mode ----
	if (filesystem === undefined) {
		const resolution = resolveIntakeCommandDisposition({
			command,
			confirmed,
			hasActivePrompt: false,
			mode: 'idle',
		});

		const status = dispositionToStatus(resolution.disposition);
		const message = buildMessageForDisposition(
			resolution.disposition,
			resolution.reason,
		);

		return {
			blockers:
				status === 'blocked'
					? [
							{
								code: 'filesystem_unavailable',
								message: 'No filesystem port provided.',
								severity: 'blocker' as const,
							},
						]
					: [],
			data: {
				command,
				disposition: resolution.disposition,
				mode: 'idle',
				persisted: false,
				stateChanged: false,
			},
			dryRun: dry,
			errors: [],
			message,
			status,
			warnings: [],
		};
	}

	// ---- Load project config ----
	const configResult = await loadLogosConfig({
		filesystem,
		now: now ?? new Date().toISOString(),
		projectRoot,
	});

	if (!configResult.ok) {
		return {
			blockers: [
				{
					code: 'project_not_initialized',
					message: 'Project is not initialized. Run /logos-init first.',
					severity: 'blocker' as const,
				},
			],
			data: {
				command,
				disposition: 'block',
				mode: 'idle',
				persisted: false,
				stateChanged: false,
			},
			dryRun: dry,
			errors: [],
			message: {
				body: 'Project is not initialized. Run /logos-init first.',
				kind: 'error',
			},
			status: 'blocked',
			warnings: [],
		};
	}

	// ---- Load intake state ----
	const intakeLoadResult = await loadIntakeState({
		filesystem,
		now: now ?? new Date().toISOString(),
		projectRoot,
	});

	let mode: IntakeMode = 'idle';
	let activeQuestionId: string | undefined;
	let preservedQuestionId: string | undefined;
	let activePrompt: ActivePrompt | undefined;
	let loadedState: LogosIntakeState | undefined;

	if (intakeLoadResult.ok) {
		loadedState = intakeLoadResult.state;
		mode = loadedState.mode;
		activeQuestionId = loadedState.activeQuestionId;
		const promptState = loadedState.activePrompt;

		if (promptState !== undefined) {
			preservedQuestionId = promptState.questionId;
			activePrompt = buildActivePromptFromState(promptState);
		}
	}

	const hasActivePrompt = preservedQuestionId !== undefined;

	// ---- Resolve disposition ----
	let resolution = resolveIntakeCommandDisposition({
		command,
		confirmed,
		hasActivePrompt,
		mode,
	});

	// ---- For reaffirm, rebuild full prompt from registry ----
	if (
		resolution.disposition === 'reaffirm' &&
		loadedState !== undefined &&
		loadedState.activePrompt !== undefined
	) {
		const profileResult = await ensureProfileReady({
			activeProfileId: configResult.config.activeProfileId,
			filesystem,
			projectRoot,
		});

		if (profileResult.ok) {
			const rebuilt = rebuildActivePrompt(
				loadedState.activePrompt,
				profileResult.contracts.questionRegistry,
				loadedState,
			);

			if (rebuilt !== undefined) {
				activePrompt = rebuilt;
			} else {
				resolution = {
					disposition: 'block',
					reason: `Active prompt references missing question "${loadedState.activePrompt.questionId}" or missing contradiction record.`,
				};
			}
		} else {
			resolution = {
				disposition: 'block',
				reason:
					'Cannot re-emit active prompt because the active profile could not be resolved.',
			};
		}
	}

	// ---- For pause_and_execute, validate, rebuild, pause, persist ----
	if (
		resolution.disposition === 'pause_and_execute' &&
		PAUSE_COMMANDS.includes(command) &&
		loadedState !== undefined
	) {
		// Try to load profile for validation and prompt rebuild.
		let registry:
			| import('../questions/question-registry.js').LogosQuestionRegistry
			| undefined;
		const profileResult = await ensureProfileReady({
			activeProfileId: configResult.config.activeProfileId,
			filesystem,
			projectRoot,
		});

		if (profileResult.ok) {
			registry = profileResult.contracts.questionRegistry;
			if (loadedState.activePrompt !== undefined) {
				const rebuilt = rebuildActivePrompt(
					loadedState.activePrompt,
					registry,
					loadedState,
				);
				if (rebuilt !== undefined) {
					activePrompt = rebuilt;
				}
			}
		}

		// Validate active prompt can be preserved.
		const validation = canPreserveActivePrompt(loadedState, registry);
		if (!validation.ok) {
			return {
				blockers: [
					{
						code: 'active_prompt_invalid',
						message: validation.reason,
						severity: 'blocker' as const,
					},
				],
				data: {
					activeQuestionId,
					command,
					disposition: 'block',
					mode: loadedState.mode,
					persisted: false,
					preservedQuestionId,
					stateChanged: false,
				},
				dryRun: dry,
				errors: [],
				message: {
					body: `Active prompt could not be preserved safely. ${validation.reason}`,
					kind: 'error',
				},
				status: 'blocked',
				warnings: [],
			};
		}

		// Pause: transition mode to paused, preserve everything else.
		const pausedState: LogosIntakeState = {
			...loadedState,
			mode: 'paused',
			updatedAt: now ?? new Date().toISOString(),
		};

		if (!dryRun) {
			await saveIntakeState({
				filesystem,
				projectRoot,
				state: pausedState,
			});
		}

		// Build command-specific message.
		const messageBody = buildPauseMessage(command, pausedState.progress);
		const messageKind: AssistantMessage['kind'] =
			command === 'logos-generate' ? 'warning' : 'status';

		const message: AssistantMessage = {
			body: messageBody,
			kind: messageKind,
			metadata: {
				activePromptKind: pausedState.activePrompt?.kind,
				activeQuestionId: pausedState.activeQuestionId,
				command,
				contradictionId: pausedState.activePrompt?.contradictionId,
				disposition: resolution.disposition,
				followUpId: pausedState.activePrompt?.followUpId,
				preservedQuestionId,
			},
		};

		return {
			blockers: [],
			data: {
				activePrompt,
				activeQuestionId: pausedState.activeQuestionId,
				command,
				disposition: resolution.disposition,
				mode: 'paused',
				persisted: !dryRun,
				preservedQuestionId,
				stateChanged: true,
			},
			dryRun: dry,
			errors: [],
			message,
			status: 'ok',
			warnings: [],
		};
	}

	// ---- Build result ----
	const status = dispositionToStatus(resolution.disposition);
	const message = buildMessageForDisposition(
		resolution.disposition,
		resolution.reason,
		activePrompt,
	);

	const blockerCode =
		command === 'logos-start' && status === 'blocked'
			? 'active_prompt_invalid'
			: 'intake_command_blocked';

	return {
		blockers:
			status === 'blocked'
				? [
						{
							code: blockerCode,
							message: resolution.reason,
							severity: 'blocker' as const,
						},
					]
				: [],
		data: {
			activePrompt:
				resolution.disposition === 'reaffirm' ? activePrompt : undefined,
			activeQuestionId,
			command,
			disposition: resolution.disposition,
			mode,
			persisted: false,
			preservedQuestionId,
			stateChanged: false,
		},
		dryRun: dry,
		errors: [],
		message,
		status,
		warnings: [],
	};
}
