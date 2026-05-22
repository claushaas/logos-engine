/**
 * LOGOS Core — Start intake transition (Step 3.4).
 *
 * Implements the Core-owned start/activate transition:
 *
 * 1. Load project config.
 * 2. Resolve and load the active profile contracts.
 * 3. Load durable intake state.
 * 4. If intake is already active and has an active prompt, re-emit it
 *    without advancing.
 * 5. Otherwise, select the next prompt via {@link selectNextPrompt}.
 * 6. Persist `intake_active` mode, `activeQuestionId`, and `activePrompt`.
 * 7. Return an assistant message with the selected prompt.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { loadLogosConfig } from '../config/load-config.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import type { LoadedProfileContracts } from '../profiles/profile-contracts.js';
import { ensureProfileReady } from '../profiles/profile-gate.js';
import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import {
	loadIntakeState,
	saveIntakeState,
} from '../state/intake-state-persistence.js';
import type {
	ActivePromptState,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import {
	createContradictionPrompt,
	createFollowUpPrompt,
	createQuestionPrompt,
} from './active-prompt.js';
import { createAssistantMessageFromPrompt } from './assistant-message-from-prompt.js';
import { selectNextPrompt } from './next-prompt-selector.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type StartIntakeTransitionInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
	dryRun: boolean;
};

export type StartIntakeTransitionData = {
	mode: 'intake_active' | 'complete';
	activeQuestionId?: string;
	activePrompt?: ActivePrompt;
	/** Whether this was a re-emission of an already-active prompt. */
	reemitted: boolean;
};

export type StartIntakeTransitionResult =
	| {
			status: 'selected' | 'reemitted' | 'complete';
			data: StartIntakeTransitionData;
			messageText: string;
			messageKind: string;
			warnings: string[];
	  }
	| {
			status: 'blocked';
			data: { mode: 'idle' };
			blockers: Array<{
				code: string;
				message: string;
				details?: string | undefined;
			}>;
			messageText: string;
			messageKind: string;
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// ActivePromptState → ActivePrompt rebuild
// ---------------------------------------------------------------------------

/**
 * Rebuild a renderable {@link ActivePrompt} from a persisted
 * {@link ActivePromptState} and the question registry.
 *
 * Returns `undefined` when the referenced question (or contradiction)
 * no longer exists in the registry.
 */
function rebuildActivePrompt(
	promptState: ActivePromptState,
	registry: LogosQuestionRegistry,
	intakeState: LogosIntakeState,
): ActivePrompt | undefined {
	const question = registry.byId[promptState.questionId];
	if (question === undefined) {
		return undefined;
	}

	switch (promptState.kind) {
		case 'question': {
			const p = createQuestionPrompt(question);
			return p;
		}
		case 'follow_up': {
			const partialRecord =
				intakeState.partialQuestions[promptState.questionId];
			const answerRecord =
				intakeState.answeredQuestions[promptState.questionId];
			const missingAspects = partialRecord?.missingAspects ?? [];
			const reason = partialRecord?.reason ?? answerRecord?.status;

			const p = createFollowUpPrompt({
				missingAspects,
				question,
				...(reason !== undefined ? { reason } : {}),
			});
			if (promptState.followUpId !== undefined) {
				p.followUpId = promptState.followUpId;
			}
			return p;
		}
		case 'contradiction_resolution': {
			const contradictionId =
				promptState.contradictionId ??
				Object.keys(intakeState.contradictions).find(
					(cid) => intakeState.contradictions[cid]?.questionId === question.id,
				);

			const contradiction =
				contradictionId !== undefined
					? intakeState.contradictions[contradictionId]
					: undefined;

			// If we can't find the specific contradiction record, return a
			// question-prompt fallback — the selector will re-derive on next call.
			if (contradiction === undefined) {
				return undefined;
			}

			return createContradictionPrompt({ contradiction, question });
		}
	}
}

// ---------------------------------------------------------------------------
// ActivePrompt → ActivePromptState persistence helper
// ---------------------------------------------------------------------------

function toActivePromptState(
	prompt: ActivePrompt,
	now: string,
): ActivePromptState {
	const state: ActivePromptState = {
		kind: prompt.kind,
		questionId: prompt.questionId,
		startedAt: now,
		updatedAt: now,
	};

	if (prompt.followUpId !== undefined) {
		state.followUpId = prompt.followUpId;
	}
	if (prompt.contradictionId !== undefined) {
		state.contradictionId = prompt.contradictionId;
	}

	return state;
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

/**
 * Execute the start-intake transition.
 *
 * Does **not** wrap the result in a {@link CoreResult} envelope; the public
 * API layer (api.ts) is responsible for that.
 *
 * Required behaviour (from the spec):
 * - Loads config/profile/contracts/state.
 * - Uses `selectNextPrompt` for prompt selection.
 * - Re-emits the existing active prompt when intake is already active.
 * - Persists `intake_active` state when a prompt is selected.
 * - Blocks on missing/invalid profile without activating intake.
 * - Does **not** evaluate answers or select new questions when already active.
 */
export async function startIntakeTransition(
	input: StartIntakeTransitionInput,
): Promise<StartIntakeTransitionResult> {
	const { projectRoot, filesystem, now, dryRun } = input;

	// ---- 1. Load project config ----
	const configResult = await loadLogosConfig({
		filesystem,
		now,
		projectRoot,
	});

	if (!configResult.ok) {
		return {
			blockers: [
				{
					code: 'project_not_initialized',
					message: 'Project is not initialized. Run /logos-init first.',
				},
			],
			data: { mode: 'idle' },
			messageKind: 'error',
			messageText: 'Project is not initialized. Run /logos-init first.',
			status: 'blocked',
			warnings: [],
		};
	}

	// ---- 2. Resolve active profile ----
	const gateResult = await ensureProfileReady({
		activeProfileId: configResult.config.activeProfileId,
		filesystem,
		projectRoot,
	});

	if (!gateResult.ok) {
		const firstBlocker = gateResult.blockers[0];
		return {
			blockers: gateResult.blockers.map((b) => {
				const entry: {
					code: string;
					message: string;
					details?: string | undefined;
				} = {
					code: b.code,
					message: b.message,
				};
				if (b.details !== undefined) {
					entry.details = b.details;
				}
				return entry;
			}),
			data: { mode: 'idle' },
			messageKind: 'error',
			messageText: firstBlocker?.message ?? 'Profile resolution failed.',
			status: 'blocked',
			warnings: gateResult.warnings,
		};
	}

	const contracts: LoadedProfileContracts = gateResult.contracts;
	const registry: LogosQuestionRegistry = contracts.questionRegistry;
	const warnings: string[] = [...gateResult.warnings];

	// ---- 3. Load intake state ----
	const intakeLoadResult = await loadIntakeState({
		filesystem,
		now,
		projectRoot,
	});

	if (!intakeLoadResult.ok) {
		return {
			blockers: [
				{
					code: 'state_read_failed',
					message: intakeLoadResult.errors.join('; '),
				},
			],
			data: { mode: 'idle' },
			messageKind: 'error',
			messageText: 'Failed to load intake state.',
			status: 'blocked',
			warnings: [],
		};
	}

	let intakeState: LogosIntakeState = intakeLoadResult.state;
	const intakeWarnings = intakeLoadResult.warnings;
	warnings.push(...intakeWarnings);

	// ---- 4. Re-emit active prompt when already active ----
	if (
		intakeState.mode === 'intake_active' &&
		intakeState.activePrompt !== undefined
	) {
		const rebuilt = rebuildActivePrompt(
			intakeState.activePrompt,
			registry,
			intakeState,
		);

		if (rebuilt === undefined) {
			// The active prompt references a question (or contradiction) that
			// no longer exists in the registry. Block without advancing.
			return {
				blockers: [
					{
						code: 'active_prompt_invalid',
						details: `Active prompt references missing question "${intakeState.activePrompt.questionId}".`,
						message: `Active prompt is invalid: the question "${intakeState.activePrompt.questionId}" was not found in the profile registry.`,
					},
				],
				data: { mode: 'idle' },
				messageKind: 'error',
				messageText: `The active question "${intakeState.activePrompt.questionId}" is no longer available in the active profile.`,
				status: 'blocked',
				warnings,
			};
		}

		// Update updatedAt timestamp (minimal, deterministic).
		if (!dryRun) {
			intakeState = {
				...intakeState,
				activePrompt: {
					...intakeState.activePrompt,
					updatedAt: now,
				},
				updatedAt: now,
			};
			await saveIntakeState({
				filesystem,
				projectRoot,
				state: intakeState,
			});
		}

		const assistantMessage = createAssistantMessageFromPrompt(rebuilt);

		return {
			data: {
				activePrompt: rebuilt,
				activeQuestionId: rebuilt.questionId,
				mode: 'intake_active',
				reemitted: true,
			},
			messageKind: assistantMessage.kind,
			messageText: assistantMessage.body,
			status: 'reemitted',
			warnings,
		};
	}

	// ---- 5. Select next prompt ----
	const selection = selectNextPrompt({
		intakeState,
		registry,
	});

	if (selection.status === 'selected') {
		const prompt = selection.prompt;
		const activePromptState = toActivePromptState(prompt, now);

		if (!dryRun) {
			intakeState = {
				...intakeState,
				activePrompt: activePromptState,
				activeQuestionId: prompt.questionId,
				mode: 'intake_active',
				updatedAt: now,
			};
			await saveIntakeState({
				filesystem,
				projectRoot,
				state: intakeState,
			});
		}

		const assistantMessage = createAssistantMessageFromPrompt(prompt);

		warnings.push(...selection.warnings);

		return {
			data: {
				activePrompt: prompt,
				activeQuestionId: prompt.questionId,
				mode: 'intake_active',
				reemitted: false,
			},
			messageKind: assistantMessage.kind,
			messageText: assistantMessage.body,
			status: 'selected',
			warnings,
		};
	}

	if (selection.status === 'complete') {
		if (!dryRun) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { activePrompt: _ap, activeQuestionId: _aq, ...rest } = intakeState;
			intakeState = {
				...rest,
				mode: 'complete',
				updatedAt: now,
			};
			await saveIntakeState({
				filesystem,
				projectRoot,
				state: intakeState,
			});
		}

		warnings.push(...selection.warnings);

		return {
			data: {
				mode: 'complete' as const,
				reemitted: false,
			},
			messageKind: 'completion',
			messageText:
				'All intake questions have been answered. Run /logos-generate to produce documentation.',
			status: 'complete',
			warnings,
		};
	}

	// selection.status === 'blocked'
	warnings.push(...selection.warnings);

	return {
		blockers: selection.blockers.map((msg) => ({
			code: selection.reason,
			message: msg,
		})),
		data: { mode: 'idle' },
		messageKind: 'warning',
		messageText: selection.blockers.join(' '),
		status: 'blocked',
		warnings,
	};
}
