/**
 * LOGOS Core — Public API.
 *
 * Defines the stable Pi-independent API that the Pi extension will call.
 * Step 2.4 adds profile resolution gating to initProject, startIntake,
 * generate, and getStatus.
 */

import { getLogosConfigPath } from './config/config-paths.js';
import {
	DEFAULT_PROFILE_ID,
	validateProfileId,
} from './config/config-schema.js';
import { loadLogosConfig } from './config/load-config.js';
import { saveLogosConfig } from './config/save-config.js';
import type {
	AnswerEvaluator,
	EvaluateAnswerResult,
} from './evaluation/index.js';
import { executePartialDraftWritePlan } from './generation/partial-draft.js';
import type { RunGenerationPreflightInput } from './generation/preflight.js';
import { runGenerationPreflight } from './generation/preflight.js';
import type {
	GenerationPreflightMode,
	GenerationPreflightResult,
} from './generation/preflight-result.js';
import type { GenerationWritePlan } from './generation/write-plan.js';
import { buildGenerationWritePlan } from './generation/write-plan.js';
import { handleIntakeCommand as handleIntakeCommandCore } from './intake/handle-intake-command.js';
import type { MessageTransition } from './intake/handle-intake-message.js';
import {
	handleIntakeMessageTransition,
	startIntakeTransition,
	stopIntakeTransition,
} from './intake/index.js';
import type { IntakeUserIntent } from './intake/intake-user-intent.js';
import type { LogosLifecycleCommand } from './intake/lifecycle-command.js';
import type { ActivePrompt } from './intake/prompt-selection-types.js';
import type { AssistantMessage } from './messages.js';
import type { LogosFilesystem } from './ports/filesystem.js';
import { ensureProfileReady } from './profiles/profile-gate.js';
import type { CoreResult } from './result.js';
import {
	createCoreResult,
	createLogosBlocker,
	createLogosError,
	createLogosWarning,
} from './result.js';
import { createDefaultLogosConfig } from './state/config-types.js';
import type { IntakeMode, IntakeProgress } from './state/index.js';
import type { ActivePromptState } from './state/intake-state-types.js';

export type { IntakeMode, IntakeProgress } from './state/index.js';

// ---------------------------------------------------------------------------
// Shared API types
// ---------------------------------------------------------------------------

export type CoreApiOptions = {
	dryRun?: boolean;
	metadata?: Record<string, unknown>;
	filesystem?: LogosFilesystem | undefined;
};

export type ProjectRootInput = {
	projectRoot: string;
};

export type { LogosLifecycleCommand } from './intake/detect-lifecycle-command.js';
export type { IntakeUserIntent } from './intake/intake-user-intent.js';

export type IntakeCommandDisposition =
	| 'reaffirm'
	| 'pause_and_execute'
	| 'confirm_required'
	| 'block'
	| 'execute';

export type GenerationMode = GenerationPreflightMode;

export type GenerationReadinessSummary = {
	ready: boolean;
	completenessScore: number;
	blockers: string[];
	warnings: string[];
};

// ---------------------------------------------------------------------------
// Init Project
// ---------------------------------------------------------------------------

export type InitProjectInput = ProjectRootInput &
	CoreApiOptions & {
		force?: boolean;
		selectedProfileId?: string;
	};

export type InitProjectData = {
	initialized: boolean;
	activeProfileId?: string | undefined;
	createdPaths: string[];
	existingPaths: string[];
};

export type InitProjectResult = CoreResult<InitProjectData>;

// ---------------------------------------------------------------------------
// Start Intake
// ---------------------------------------------------------------------------

export type StartIntakeInput = ProjectRootInput &
	CoreApiOptions & {
		now?: string;
	};

export type StartIntakeData = {
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
	activePrompt?: ActivePrompt | undefined;
};

export type StartIntakeResult = CoreResult<StartIntakeData>;

// ---------------------------------------------------------------------------
// Handle Intake Message
// ---------------------------------------------------------------------------

export type HandleIntakeMessageInput = ProjectRootInput &
	CoreApiOptions & {
		message: string;
		/**
		 * Optional answer evaluator.  When omitted, the deterministic
		 * baseline evaluator is used as a fallback.
		 */
		evaluator?: AnswerEvaluator | undefined;
	};

export type HandleIntakeMessageData = {
	mode: IntakeMode;
	intent?: IntakeUserIntent | undefined;
	activeQuestionId?: string | undefined;
	activePrompt?: ActivePrompt | undefined;
	stateChanged: boolean;
	/**
	 * Present when the router dispatched to answer evaluation.
	 * Contains the validated evaluation result.
	 */
	evaluationResult?: EvaluateAnswerResult | undefined;
	/**
	 * The semantic transition that occurred.
	 * Set when state changed or a control intent was routed.
	 */
	transition: MessageTransition;
	/**
	 * The assistant message to present to the user.
	 * Present for most non-blocked paths.
	 */
	assistantMessage?: AssistantMessage | undefined;
};

export type HandleIntakeMessageResult = CoreResult<HandleIntakeMessageData>;

// ---------------------------------------------------------------------------
// Handle Intake Command (reserved for Phase 5)
// ---------------------------------------------------------------------------

export type HandleIntakeCommandInput = ProjectRootInput &
	CoreApiOptions & {
		command: LogosLifecycleCommand;
		confirmed?: boolean;
		now?: string;
	};

export type HandleIntakeCommandData = {
	command: LogosLifecycleCommand;
	disposition: IntakeCommandDisposition;
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
	preservedQuestionId?: string | undefined;
	activePrompt?:
		| import('./intake/prompt-selection-types.js').ActivePrompt
		| undefined;
	stateChanged: boolean;
	persisted: boolean;
};

export type HandleIntakeCommandResult = CoreResult<HandleIntakeCommandData>;

// ---------------------------------------------------------------------------
// Stop Intake
// ---------------------------------------------------------------------------

export type StopIntakeInput = ProjectRootInput &
	CoreApiOptions & {
		now?: string;
	};

export type StopIntakeData = {
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
	activePrompt?: ActivePromptState | undefined;
	progress: IntakeProgress;
};

export type StopIntakeResult = CoreResult<StopIntakeData>;

// ---------------------------------------------------------------------------
// Get Status
// ---------------------------------------------------------------------------

export type GetStatusInput = ProjectRootInput & CoreApiOptions;

export type GetStatusData = {
	initialized: boolean;
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
	progress: IntakeProgress;
	generationReadiness: GenerationReadinessSummary;
};

export type GetStatusResult = CoreResult<GetStatusData>;

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

export type GenerateInput = ProjectRootInput &
	CoreApiOptions & {
		mode?: GenerationMode;
		confirmedPartialGeneration?: boolean;
		now?: string;
	};

export type GenerateData = {
	generationMode: GenerationMode;
	generatedPaths: string[];
	preflight?: GenerationPreflightResult;
	writePlan?: GenerationWritePlan;
	partialDraft: boolean;
	incomplete: boolean;
	requiresExplicitConfirmation: boolean;
	confirmationProvided: boolean;
	wroteFiles: boolean;
	skippedReason?: string;
	metadata?: Record<string, unknown>;
};

export type GenerateResult = CoreResult<GenerateData>;

// ---------------------------------------------------------------------------
// LogosCore type
// ---------------------------------------------------------------------------

export type LogosCore = {
	initProject(input: InitProjectInput): Promise<InitProjectResult>;
	startIntake(input: StartIntakeInput): Promise<StartIntakeResult>;
	handleIntakeMessage(
		input: HandleIntakeMessageInput,
	): Promise<HandleIntakeMessageResult>;
	handleIntakeCommand(
		input: HandleIntakeCommandInput,
	): Promise<HandleIntakeCommandResult>;
	stopIntake(input: StopIntakeInput): Promise<StopIntakeResult>;
	getStatus(input: GetStatusInput): Promise<GetStatusResult>;
	generate(input: GenerateInput): Promise<GenerateResult>;
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function stubMessage(body: string): AssistantMessage {
	return { body, kind: 'warning' };
}

const emptyProgress: IntakeProgress = {
	byPhase: {},
	contradictory: 0,
	missing: 0,
	partial: 0,
	skipped: 0,
	sufficient: 0,
	total: 0,
};

function makeProfileBlockedResult<TData>(input: {
	message: string;
	dryRun: boolean;
	data: TData;
	blockers: ReturnType<typeof createLogosBlocker>[];
	errors?: { code: string; message: string; details?: string }[];
}): CoreResult<TData> {
	return createCoreResult({
		blockers: input.blockers,
		data: input.data,
		dryRun: input.dryRun,
		errors:
			input.errors?.map((e) => ({
				code: e.code as import('./errors.js').LogosErrorCode,
				message: e.message,
				...(e.details !== undefined ? { details: e.details } : {}),
			})) ?? [],
		message: { body: input.message, kind: 'error' },
		status: 'blocked',
	});
}

// ---------------------------------------------------------------------------
// initProject
// ---------------------------------------------------------------------------

export async function initProject(
	input: InitProjectInput,
): Promise<InitProjectResult> {
	const filesystem = input.filesystem;

	// ---- validate selectedProfileId syntax ----
	if (input.selectedProfileId !== undefined) {
		const validationResult = validateProfileId(input.selectedProfileId);
		if (!validationResult.valid) {
			return createCoreResult({
				blockers: [
					createLogosBlocker({
						code: 'profile_invalid',
						details:
							'Profile ID must consist of lowercase letters, digits, and hyphens (max 80 chars).',
						message: `Invalid profile ID "${input.selectedProfileId}": ${validationResult.reason}.`,
					}),
				],
				data: {
					createdPaths: [],
					existingPaths: [],
					initialized: false,
				},
				dryRun: input.dryRun ?? false,
				message: {
					body: `Cannot initialize with invalid profile ID "${input.selectedProfileId}".`,
					kind: 'error',
				},
				status: 'blocked',
			});
		}
	}

	const activeProfileId = input.selectedProfileId ?? DEFAULT_PROFILE_ID;

	// ---- filesystem required for profile validation ----
	if (filesystem === undefined) {
		return createCoreResult({
			blockers: [
				createLogosBlocker({
					code: 'invalid_project_root',
					message: 'Filesystem port is required for project initialization.',
				}),
			],
			data: {
				createdPaths: [],
				existingPaths: [],
				initialized: false,
			},
			dryRun: input.dryRun ?? false,
			message: {
				body: 'Filesystem port is required for project initialization.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	// ---- resolve and validate profile before writing state ----
	const gateResult = await ensureProfileReady({
		activeProfileId,
		filesystem,
		projectRoot: input.projectRoot,
	});

	if (!gateResult.ok) {
		return makeProfileBlockedResult({
			blockers: gateResult.blockers,
			data: {
				createdPaths: [],
				existingPaths: [],
				initialized: false,
			},
			dryRun: input.dryRun ?? false,
			message: gateResult.blockers[0]?.message ?? 'Profile resolution failed.',
		});
	}

	// ---- profile is valid — persist config ----
	if (!input.dryRun) {
		const now = new Date().toISOString();
		const config = createDefaultLogosConfig({
			activeProfileId,
			now,
		});
		await saveLogosConfig({
			config,
			filesystem,
			projectRoot: input.projectRoot,
		});
	}

	return createCoreResult({
		data: {
			activeProfileId,
			createdPaths: input.dryRun ? [] : [getLogosConfigPath(input.projectRoot)],
			existingPaths: [],
			initialized: true,
		},
		dryRun: input.dryRun ?? false,
		message: {
			body: `LOGOS project initialized with activeProfileId: "${activeProfileId}".`,
			kind: 'status',
		},
		status: 'ok',
	});
}

// ---------------------------------------------------------------------------
// startIntake
// ---------------------------------------------------------------------------

export async function startIntake(
	input: StartIntakeInput,
): Promise<StartIntakeResult> {
	const filesystem = input.filesystem;
	const now = input.now ?? new Date().toISOString();
	const dryRun = input.dryRun ?? false;

	if (filesystem === undefined) {
		return createCoreResult({
			data: {
				activeQuestionId: undefined,
				mode: 'idle',
			},
			dryRun,
			message: {
				body: 'Filesystem port is required for intake operations.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	const transitionResult = await startIntakeTransition({
		dryRun,
		filesystem,
		now,
		projectRoot: input.projectRoot,
	});

	if (transitionResult.status === 'blocked') {
		return createCoreResult({
			blockers: transitionResult.blockers.map((b) =>
				createLogosBlocker({
					code: b.code,
					message: b.message,
					...(b.details !== undefined ? { details: b.details } : {}),
				}),
			),
			data: transitionResult.data,
			dryRun,
			message: {
				body: transitionResult.messageText,
				kind: transitionResult.messageKind as AssistantMessage['kind'],
			},
			status: 'blocked',
			warnings: transitionResult.warnings.map((w) => ({
				code: 'unknown_error',
				message: w,
				severity: 'warning' as const,
			})),
		});
	}

	// selected | reemitted | complete
	return createCoreResult({
		data: transitionResult.data,
		dryRun,
		message: {
			body: transitionResult.messageText,
			kind: transitionResult.messageKind as AssistantMessage['kind'],
		},
		status: 'ok',
		warnings: transitionResult.warnings.map((w) => ({
			code: 'unknown_error',
			message: w,
			severity: 'warning' as const,
		})),
	});
}

// ---------------------------------------------------------------------------
// handleIntakeMessage
// ---------------------------------------------------------------------------

export async function handleIntakeMessage(
	input: HandleIntakeMessageInput,
): Promise<HandleIntakeMessageResult> {
	const filesystem = input.filesystem;
	const dryRun = input.dryRun ?? false;

	if (filesystem === undefined) {
		return createCoreResult({
			data: {
				mode: 'idle',
				stateChanged: false,
				transition: 'blocked' as const,
			},
			dryRun,
			message: {
				body: 'Filesystem port is required for intake operations.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	const transitionResult = await handleIntakeMessageTransition({
		dryRun,
		evaluator: input.evaluator,
		filesystem,
		message: input.message,
		now: new Date().toISOString(),
		projectRoot: input.projectRoot,
	});

	if (transitionResult.status === 'blocked') {
		return createCoreResult({
			data: {
				activeQuestionId: transitionResult.activeQuestionId,
				evaluationResult: transitionResult.evaluationResult,
				mode: 'idle',
				stateChanged: transitionResult.stateChanged,
				transition: transitionResult.transition ?? 'blocked',
			},
			dryRun,
			message: {
				body: transitionResult.messageText,
				kind: transitionResult.messageKind,
			},
			status: 'blocked',
			warnings: transitionResult.warnings.map((w) => ({
				code: 'unknown_error',
				message: w,
				severity: 'warning' as const,
			})),
		});
	}

	if (transitionResult.status === 'not_active') {
		return createCoreResult({
			data: {
				activeQuestionId: transitionResult.activeQuestionId,
				evaluationResult: transitionResult.evaluationResult,
				mode: 'idle',
				stateChanged: false,
				transition: transitionResult.transition ?? 'blocked',
			},
			dryRun,
			message: {
				body: transitionResult.messageText,
				kind: transitionResult.messageKind,
			},
			status: 'blocked',
			warnings: transitionResult.warnings.map((w) => ({
				code: 'unknown_error',
				message: w,
				severity: 'warning' as const,
			})),
		});
	}

	// routed or complete
	return createCoreResult({
		data: {
			activeQuestionId: transitionResult.activeQuestionId,
			assistantMessage: {
				body: transitionResult.messageText,
				kind: transitionResult.messageKind,
				...(transitionResult.activeQuestionId !== undefined
					? { questionId: transitionResult.activeQuestionId }
					: {}),
			},
			evaluationResult: transitionResult.evaluationResult,
			mode:
				transitionResult.status === 'complete' ? 'complete' : 'intake_active',
			stateChanged: transitionResult.stateChanged,
			transition: transitionResult.transition ?? 'blocked',
		},
		dryRun,
		message: {
			body: transitionResult.messageText,
			kind: transitionResult.messageKind,
		},
		status: 'ok',
		warnings: transitionResult.warnings.map((w) => ({
			code: 'unknown_error',
			message: w,
			severity: 'warning' as const,
		})),
	});
}

// ---------------------------------------------------------------------------
// handleIntakeCommand
// ---------------------------------------------------------------------------

export async function handleIntakeCommand(
	input: HandleIntakeCommandInput,
): Promise<HandleIntakeCommandResult> {
	const coreResult = await handleIntakeCommandCore({
		command: input.command,
		confirmed: input.confirmed,
		dryRun: input.dryRun,
		filesystem: input.filesystem,
		now: input.now,
		projectRoot: input.projectRoot,
	});

	const result: HandleIntakeCommandResult = {
		blockers: coreResult.blockers.map((b) =>
			createLogosBlocker({
				code: b.code,
				message: b.message,
			}),
		),
		changedPaths: [],
		dryRun: coreResult.dryRun,
		errors: coreResult.errors.map((e) => ({
			code: e.code as import('./errors.js').LogosErrorCode,
			message: e.message,
		})),
		message: coreResult.message,
		status: coreResult.status,
		warnings: coreResult.warnings.map((w) => ({
			code: w.code as import('./errors.js').LogosErrorCode,
			message: w.message,
			severity: 'warning' as const,
		})),
	};

	if (coreResult.data !== undefined) {
		result.data = coreResult.data;
	}

	return result;
}

// ---------------------------------------------------------------------------
// stopIntake
// ---------------------------------------------------------------------------

export async function stopIntake(
	input: StopIntakeInput,
): Promise<StopIntakeResult> {
	const filesystem = input.filesystem;
	const now = input.now ?? new Date().toISOString();
	const dryRun = input.dryRun ?? false;

	if (filesystem === undefined) {
		return createCoreResult({
			data: {
				activeQuestionId: undefined,
				mode: 'idle',
				progress: emptyProgress,
			},
			dryRun,
			message: {
				body: 'Filesystem port is required for intake operations.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	const transitionResult = await stopIntakeTransition({
		dryRun,
		filesystem,
		now,
		projectRoot: input.projectRoot,
	});

	return createCoreResult({
		data: transitionResult.data,
		dryRun,
		message: {
			body: transitionResult.messageText,
			kind: transitionResult.messageKind as AssistantMessage['kind'],
		},
		status: 'ok',
		warnings: transitionResult.warnings.map((w) => ({
			code: 'unknown_error',
			message: w,
			severity: 'warning' as const,
		})),
	});
}

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

export async function getStatus(
	input: GetStatusInput,
): Promise<GetStatusResult> {
	const filesystem = input.filesystem;

	if (filesystem === undefined) {
		return createCoreResult({
			data: {
				generationReadiness: {
					blockers: [],
					completenessScore: 0,
					ready: false,
					warnings: [],
				},
				initialized: false,
				mode: 'idle',
				progress: emptyProgress,
			},
			dryRun: input.dryRun ?? false,
			message: stubMessage('LOGOS status retrieval is not implemented yet.'),
			status: 'blocked',
		});
	}

	// ---- attempt to load config ----
	const configResult = await loadLogosConfig({
		filesystem,
		now: new Date().toISOString(),
		projectRoot: input.projectRoot,
	});

	if (!configResult.ok) {
		// Config missing or invalid — project not initialized.
		return createCoreResult({
			data: {
				generationReadiness: {
					blockers: [],
					completenessScore: 0,
					ready: false,
					warnings: [],
				},
				initialized: false,
				mode: 'idle',
				progress: emptyProgress,
			},
			dryRun: input.dryRun ?? false,
			message: {
				body: 'Project is not initialized.',
				kind: 'status',
			},
			status: 'ok',
		});
	}

	// Config loaded from disk (or defaulted in memory).
	const initialized = !configResult.createdDefault;

	// ---- attempt to resolve active profile ----
	const gateResult = await ensureProfileReady({
		activeProfileId: configResult.config.activeProfileId,
		filesystem,
		projectRoot: input.projectRoot,
	});

	if (!gateResult.ok) {
		// Profile missing or invalid — report blockers but do not throw.
		const blockerMessages = gateResult.blockers.map((b) => b.message);
		return createCoreResult({
			blockers: gateResult.blockers,
			data: {
				generationReadiness: {
					blockers: blockerMessages,
					completenessScore: 0,
					ready: false,
					warnings: gateResult.warnings,
				},
				initialized,
				mode: 'idle',
				progress: emptyProgress,
			},
			dryRun: input.dryRun ?? false,
			errors: gateResult.errors,
			message: {
				body: gateResult.blockers[0]?.message ?? 'Profile resolution failed.',
				kind: 'warning',
			},
			status: 'ok',
		});
	}

	// Profile valid — keep existing stub behavior.
	// When the project is not yet initialized, return ok so status remains
	// observational. When initialized, the legacy stub returns blocked.
	return createCoreResult({
		data: {
			generationReadiness: {
				blockers: [],
				completenessScore: 0,
				ready: false,
				warnings: [],
			},
			initialized,
			mode: 'idle',
			progress: emptyProgress,
		},
		dryRun: input.dryRun ?? false,
		message: initialized
			? stubMessage('LOGOS status retrieval is not implemented yet.')
			: { body: 'Project is not initialized.', kind: 'status' },
		status: initialized ? 'blocked' : 'ok',
	});
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

/**
 * Build a minimal GenerateData with all required fields initialized.
 */
function emptyGenerateData(mode: GenerationMode): GenerateData {
	return {
		confirmationProvided: false,
		generatedPaths: [],
		generationMode: mode,
		incomplete: false,
		partialDraft: false,
		requiresExplicitConfirmation: false,
		wroteFiles: false,
	};
}

export async function generate(input: GenerateInput): Promise<GenerateResult> {
	const filesystem = input.filesystem;

	if (filesystem === undefined) {
		return createCoreResult({
			data: emptyGenerateData(input.mode ?? 'final'),
			dryRun: input.dryRun ?? false,
			message: {
				body: 'Filesystem port is required for generation.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	// ---- resolve effective mode ----
	const effectiveMode: GenerationMode = input.dryRun
		? 'dry_run'
		: (input.mode ?? 'final');
	const now = input.now ?? new Date().toISOString();
	const confirmedPartial = input.confirmedPartialGeneration === true;
	const isPartialDraft = effectiveMode === 'partial_draft';
	const isDryRun = effectiveMode === 'dry_run';
	const isFinal = effectiveMode === 'final';

	// ---- run generation preflight ----
	const preflightArgs: RunGenerationPreflightInput = {
		filesystem,
		mode: effectiveMode,
		now,
		projectRoot: input.projectRoot,
	};
	const preflightResult = await runGenerationPreflight(preflightArgs);

	// Preflight error (unexpected failure) — propagate.
	if (!preflightResult.ok) {
		return createCoreResult({
			data: emptyGenerateData(effectiveMode),
			dryRun: isDryRun,
			errors: preflightResult.errors.map((e) =>
				createLogosError({
					code: 'preflight_blocked',
					message: e,
				}),
			),
			message: {
				body: 'Generation preflight encountered an unexpected error.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	const preflight = preflightResult.preflight;

	// ---- final mode with blockers → blocked, no writes ----
	if (isFinal && !preflight.ready) {
		const coreBlockers = preflight.blockers.map((b) =>
			createLogosBlocker({
				code: b.code,
				message: b.message,
				...(b.questionIds !== undefined
					? { metadata: { questionIds: b.questionIds } }
					: {}),
			}),
		);

		const coreWarnings = preflight.warnings.map((w) =>
			createLogosWarning({
				code: w.code,
				message: w.message,
			}),
		);

		return createCoreResult({
			blockers: coreBlockers,
			data: {
				...emptyGenerateData(effectiveMode),
				preflight,
				requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
			},
			dryRun: isDryRun,
			message: {
				body:
					preflight.blockers[0]?.message ??
					'Final generation is blocked.  Resolve the reported blockers before generating.',
				kind: 'error',
			},
			status: 'blocked',
			warnings: coreWarnings,
		});
	}

	// ---- partial_draft without confirmation → confirmation_required ----
	if (isPartialDraft && !confirmedPartial) {
		// Check if partial draft can even be generated.
		if (!preflight.canGeneratePartialDraft) {
			const coreBlockers = preflight.blockers.map((b) =>
				createLogosBlocker({
					code: b.code,
					message: b.message,
					...(b.questionIds !== undefined
						? { metadata: { questionIds: b.questionIds } }
						: {}),
				}),
			);

			return createCoreResult({
				blockers: coreBlockers,
				data: {
					...emptyGenerateData(effectiveMode),
					partialDraft: true,
					preflight,
					requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
				},
				dryRun: isDryRun,
				message: {
					body:
						preflight.blockers[0]?.message ??
						'Partial draft generation is not possible.  Resolve the reported blockers.',
					kind: 'error',
				},
				status: 'blocked',
			});
		}

		// Partial draft is possible but confirmation is required.
		const coreWarnings = preflight.warnings.map((w) =>
			createLogosWarning({
				code: w.code,
				message: w.message,
			}),
		);

		return createCoreResult({
			data: {
				...emptyGenerateData(effectiveMode),
				incomplete: true,
				partialDraft: true,
				preflight,
				requiresExplicitConfirmation: true,
			},
			dryRun: isDryRun,
			message: {
				body: 'Partial draft generation requires explicit confirmation.  Set confirmedPartialGeneration to true to proceed.',
				kind: 'confirmation_request',
			},
			status: 'confirmation_required',
			warnings: coreWarnings,
		});
	}

	// ---- partial_draft with confirmation but can't generate → blocked ----
	if (
		isPartialDraft &&
		confirmedPartial &&
		!preflight.canGeneratePartialDraft
	) {
		const coreBlockers = preflight.blockers.map((b) =>
			createLogosBlocker({
				code: b.code,
				message: b.message,
				...(b.questionIds !== undefined
					? { metadata: { questionIds: b.questionIds } }
					: {}),
			}),
		);

		return createCoreResult({
			blockers: coreBlockers,
			data: {
				...emptyGenerateData(effectiveMode),
				confirmationProvided: true,
				incomplete: true,
				partialDraft: true,
				preflight,
				requiresExplicitConfirmation: true,
			},
			dryRun: isDryRun,
			message: {
				body:
					preflight.blockers[0]?.message ??
					'Partial draft generation is not possible despite confirmation.  Resolve the reported blockers.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	// ---- at this point we can proceed with write planning ----
	// (final ready, partial_draft confirmed & allowed, or dry_run preview)

	// Load config to get activeProfileId.
	const configLoadResult = await loadLogosConfig({
		filesystem,
		now,
		projectRoot: input.projectRoot,
	});

	if (!configLoadResult.ok) {
		return createCoreResult({
			data: {
				...emptyGenerateData(effectiveMode),
				confirmationProvided: confirmedPartial,
				incomplete: isPartialDraft,
				partialDraft: isPartialDraft,
				preflight,
				requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
			},
			dryRun: isDryRun,
			message: {
				body: 'Failed to load project config for write planning.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	// Resolve profile contracts.
	const gateResult = await ensureProfileReady({
		activeProfileId: configLoadResult.config.activeProfileId,
		filesystem,
		projectRoot: input.projectRoot,
	});

	if (!gateResult.ok) {
		const coreBlockers = gateResult.blockers;
		return createCoreResult({
			blockers: coreBlockers,
			data: {
				...emptyGenerateData(effectiveMode),
				confirmationProvided: confirmedPartial,
				incomplete: isPartialDraft,
				partialDraft: isPartialDraft,
				preflight,
				requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
			},
			dryRun: isDryRun,
			message: {
				body:
					gateResult.blockers[0]?.message ??
					'Profile resolution failed during write planning.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	const writePlanResult = await buildGenerationWritePlan({
		filesystem,
		mode: effectiveMode,
		now,
		preflight,
		profileContracts: gateResult.contracts,
		projectRoot: input.projectRoot,
	});

	if (!writePlanResult.ok) {
		const errData: GenerateData = {
			...emptyGenerateData(effectiveMode),
			confirmationProvided: confirmedPartial,
			incomplete: isPartialDraft,
			partialDraft: isPartialDraft,
			preflight,
			requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
		};
		if (writePlanResult.writePlan !== undefined) {
			errData.writePlan = writePlanResult.writePlan;
		}
		return createCoreResult({
			data: errData,
			dryRun: isDryRun,
			errors: writePlanResult.errors.map((e) =>
				createLogosError({
					code: 'generation_failed',
					message: e,
				}),
			),
			message: {
				body: 'Write plan building failed.',
				kind: 'error',
			},
			status: 'blocked',
		});
	}

	const writePlan = writePlanResult.writePlan;

	// ---- dry_run: return preflight + write plan, never write files ----
	// Must come before write-plan blocker check so dry-run always returns a
	// preview even when the write plan has blockers.
	if (isDryRun) {
		const allPlannedPaths = writePlan.operations.map((op) => ({
			kind: 'skipped' as const,
			path: op.relativePath,
			reason: 'dry_run_no_write',
		}));

		return createCoreResult({
			changedPaths: allPlannedPaths,
			data: {
				...emptyGenerateData(effectiveMode),
				confirmationProvided: false,
				incomplete: false,
				partialDraft: false,
				preflight,
				requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
				skippedReason: 'Dry run — no files were written.',
				writePlan,
			},
			dryRun: true,
			message: {
				body: 'Dry run complete.  Preflight and write plan are included.  No files were written.',
				kind: 'status',
			},
			status: 'ok',
			warnings: writePlan.warnings.map((w) => ({
				code: w.code,
				message: w.message,
				severity: 'warning' as const,
			})),
		});
	}

	// ---- write plan has blockers — return blocked with plan for inspection ----
	if (!writePlan.readyToWrite) {
		const planBlockers = writePlan.blockers.map((b) =>
			createLogosBlocker({
				code: b.code,
				message: b.message,
				...(b.path !== undefined ? { path: b.path } : {}),
			}),
		);

		const planWarnings = writePlan.warnings.map((w) =>
			createLogosWarning({
				code: w.code,
				message: w.message,
				...(w.path !== undefined ? { path: w.path } : {}),
			}),
		);

		// Mark planned paths as skipped in changedPaths.
		const plannedPaths = writePlan.operations
			.filter((op) => op.kind !== 'blocked')
			.map((op) => ({
				kind: 'skipped' as const,
				path: op.relativePath,
				reason: 'planned_not_written',
			}));

		return createCoreResult({
			blockers: planBlockers,
			changedPaths: plannedPaths,
			data: {
				...emptyGenerateData(effectiveMode),
				confirmationProvided: confirmedPartial,
				incomplete: isPartialDraft,
				partialDraft: isPartialDraft,
				preflight,
				requiresExplicitConfirmation: preflight.requiresExplicitConfirmation,
				writePlan,
			},
			dryRun: isDryRun,
			message: {
				body:
					writePlan.blockers[0]?.message ??
					'Write plan is blocked.  Resolve the reported issues before writing.',
				kind: 'error',
			},
			status: 'blocked',
			warnings: planWarnings,
		});
	}

	// ---- confirmed partial_draft: write incomplete placeholder files ----
	if (isPartialDraft && confirmedPartial) {
		const executeResult = await executePartialDraftWritePlan({
			filesystem,
			now,
			preflight: {
				blockers: preflight.blockers,
				checkedAt: preflight.checkedAt,
				completenessScore: preflight.completenessScore,
				warnings: preflight.warnings,
			},
			writePlan,
		});

		const generatedPaths = executeResult.writtenPaths.map((p) => p);

		const changedPaths = generatedPaths.map((p) => ({
			kind: 'created' as const,
			path: p,
			reason: 'partial_draft_placeholder',
		}));

		const wroteFiles = generatedPaths.length > 0;

		return createCoreResult({
			changedPaths,
			data: {
				...emptyGenerateData(effectiveMode),
				confirmationProvided: true,
				generatedPaths,
				incomplete: true,
				partialDraft: true,
				preflight,
				requiresExplicitConfirmation: true,
				writePlan,
				wroteFiles,
			},
			dryRun: false,
			message: {
				body: wroteFiles
					? `Partial draft generated with ${generatedPaths.length} incomplete placeholder file(s).`
					: 'Partial draft write plan is ready but no files were written.',
				kind: 'generation_result',
			},
			status: 'ok',
			warnings: writePlan.warnings.map((w) => ({
				code: w.code,
				message: w.message,
				severity: 'warning' as const,
			})),
		});
	}

	// ---- final mode ready: write execution not yet implemented → noop ----
	const allPlannedPaths = writePlan.operations.map((op) => ({
		kind: 'skipped' as const,
		path: op.relativePath,
		reason: 'planned_not_written',
	}));

	return createCoreResult({
		changedPaths: allPlannedPaths,
		data: {
			...emptyGenerateData(effectiveMode),
			confirmationProvided: false,
			incomplete: false,
			partialDraft: false,
			preflight,
			requiresExplicitConfirmation: false,
			skippedReason:
				'Generation preflight and write plan succeeded, but final write execution is not yet implemented.',
			writePlan,
		},
		dryRun: false,
		message: {
			body: 'Generation preflight and write plan succeeded, but write execution is not yet implemented.',
			kind: 'status',
		},
		status: 'noop',
		warnings: writePlan.warnings.map((w) => ({
			code: w.code,
			message: w.message,
			severity: 'warning' as const,
		})),
	});
}

// ---------------------------------------------------------------------------
// createLogosCore factory
// ---------------------------------------------------------------------------

export function createLogosCore(options?: {
	filesystem?: LogosFilesystem;
}): LogosCore {
	const defaultFilesystem = options?.filesystem;

	return {
		generate: (input) => {
			const { filesystem: inputFs, now, ...rest } = input;
			return generate({
				...rest,
				filesystem: inputFs ?? defaultFilesystem,
				...(now !== undefined ? { now } : {}),
			});
		},
		getStatus: (input) =>
			getStatus({
				...input,
				filesystem: input.filesystem ?? defaultFilesystem,
			}),
		handleIntakeCommand: (input) =>
			handleIntakeCommand({
				...input,
				filesystem: input.filesystem ?? defaultFilesystem,
			}),
		handleIntakeMessage: (input) =>
			handleIntakeMessage({
				...input,
				filesystem: input.filesystem ?? defaultFilesystem,
			}),
		initProject: (input) =>
			initProject({
				...input,
				filesystem: input.filesystem ?? defaultFilesystem,
			}),
		startIntake: (input) =>
			startIntake({
				...input,
				filesystem: input.filesystem ?? defaultFilesystem,
			}),
		stopIntake: (input) =>
			stopIntake({
				...input,
				filesystem: input.filesystem ?? defaultFilesystem,
			}),
	};
}
