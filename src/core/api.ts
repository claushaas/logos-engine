/**
 * LOGOS Core — Public API.
 *
 * Defines the stable Pi-independent API that the Pi extension will call.
 * All functions in this file are stubs for Step 1.3; real behavior is added in later phases.
 */

import type { AssistantMessage } from './messages.js';
import type { CoreResult } from './result.js';
import { createCoreResult } from './result.js';
import type { IntakeMode, IntakeProgress } from './state/index.js';

export type { IntakeMode, IntakeProgress } from './state/index.js';

// ---------------------------------------------------------------------------
// Shared API types
// ---------------------------------------------------------------------------

export type CoreApiOptions = {
	dryRun?: boolean;
	metadata?: Record<string, unknown>;
};

export type ProjectRootInput = {
	projectRoot: string;
};

// IntakeMode and IntakeProgress are imported from ./state/index.js

export type IntakeUserIntent =
	| 'answer_current_question'
	| 'ask_question_about_current_question'
	| 'revise_previous_answer'
	| 'pause_intake'
	| 'skip_current_question'
	| 'request_status'
	| 'request_generation'
	| 'out_of_scope';

export type LogosLifecycleCommand =
	| 'logos-init'
	| 'logos-start'
	| 'logos-stop'
	| 'logos-status'
	| 'logos-generate';

export type IntakeCommandDisposition =
	| 'execute'
	| 'pause_and_execute'
	| 'reemit_active_prompt'
	| 'confirmation_required'
	| 'blocked';

export type GenerationMode = 'final' | 'partial_draft' | 'dry_run';

// IntakeProgress is imported from ./state/index.js

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

export type StartIntakeInput = ProjectRootInput & CoreApiOptions;

export type StartIntakeData = {
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
};

export type StartIntakeResult = CoreResult<StartIntakeData>;

// ---------------------------------------------------------------------------
// Handle Intake Message
// ---------------------------------------------------------------------------

export type HandleIntakeMessageInput = ProjectRootInput &
	CoreApiOptions & {
		message: string;
	};

export type HandleIntakeMessageData = {
	mode: IntakeMode;
	intent?: IntakeUserIntent | undefined;
	activeQuestionId?: string | undefined;
	stateChanged: boolean;
};

export type HandleIntakeMessageResult = CoreResult<HandleIntakeMessageData>;

// ---------------------------------------------------------------------------
// Handle Intake Command (reserved for Phase 5)
// ---------------------------------------------------------------------------

export type HandleIntakeCommandInput = ProjectRootInput &
	CoreApiOptions & {
		command: LogosLifecycleCommand;
		confirmed?: boolean;
	};

export type HandleIntakeCommandData = {
	disposition: IntakeCommandDisposition;
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
	preservedQuestionId?: string | undefined;
	stateChanged: boolean;
};

export type HandleIntakeCommandResult = CoreResult<HandleIntakeCommandData>;

// ---------------------------------------------------------------------------
// Stop Intake
// ---------------------------------------------------------------------------

export type StopIntakeInput = ProjectRootInput & CoreApiOptions;

export type StopIntakeData = {
	mode: IntakeMode;
	activeQuestionId?: string | undefined;
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
	};

export type GenerateData = {
	generationMode: GenerationMode;
	generatedPaths: string[];
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
// Stub implementations
// ---------------------------------------------------------------------------

function stubMessage(body: string): AssistantMessage {
	return { body, kind: 'warning' };
}

const emptyProgress: IntakeProgress = {
	byPhase: {},
	contradictory: 0,
	missing: 0,
	partial: 0,
	sufficient: 0,
	total: 0,
};

export async function initProject(
	input: InitProjectInput,
): Promise<InitProjectResult> {
	return createCoreResult({
		data: {
			createdPaths: [],
			existingPaths: [],
			initialized: false,
		},
		dryRun: input.dryRun ?? false,
		message: stubMessage(
			'LOGOS project initialization is not implemented yet.',
		),
		status: 'blocked',
	});
}

export async function startIntake(
	input: StartIntakeInput,
): Promise<StartIntakeResult> {
	return createCoreResult({
		data: {
			activeQuestionId: undefined,
			mode: 'idle',
		},
		dryRun: input.dryRun ?? false,
		message: stubMessage('LOGOS intake start is not implemented yet.'),
		status: 'blocked',
	});
}

export async function handleIntakeMessage(
	input: HandleIntakeMessageInput,
): Promise<HandleIntakeMessageResult> {
	return createCoreResult({
		data: {
			mode: 'idle',
			stateChanged: false,
		},
		dryRun: input.dryRun ?? false,
		message: stubMessage(
			'LOGOS intake message handling is not implemented yet.',
		),
		status: 'blocked',
	});
}

export async function handleIntakeCommand(
	input: HandleIntakeCommandInput,
): Promise<HandleIntakeCommandResult> {
	return createCoreResult({
		data: {
			disposition: 'blocked',
			mode: 'idle',
			stateChanged: false,
		},
		dryRun: input.dryRun ?? false,
		message: stubMessage(
			'LOGOS intake command interruption is not implemented yet.',
		),
		status: 'blocked',
	});
}

export async function stopIntake(
	input: StopIntakeInput,
): Promise<StopIntakeResult> {
	return createCoreResult({
		data: {
			mode: 'idle',
			progress: emptyProgress,
		},
		dryRun: input.dryRun ?? false,
		message: stubMessage('LOGOS intake stop is not implemented yet.'),
		status: 'blocked',
	});
}

export async function getStatus(
	input: GetStatusInput,
): Promise<GetStatusResult> {
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

export async function generate(input: GenerateInput): Promise<GenerateResult> {
	return createCoreResult({
		data: {
			generatedPaths: [],
			generationMode: input.mode ?? 'final',
		},
		dryRun: input.dryRun ?? false,
		message: stubMessage('LOGOS generation is not implemented yet.'),
		status: 'blocked',
	});
}

export function createLogosCore(): LogosCore {
	return {
		generate,
		getStatus,
		handleIntakeCommand,
		handleIntakeMessage,
		initProject,
		startIntake,
		stopIntake,
	};
}
