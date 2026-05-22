/**
 * LOGOS Core — Generation preflight (Step 6.2).
 *
 * Evaluates whether generation can proceed before any write plan or file
 * write happens.  Returns structured blockers and warnings; does **not**
 * generate documentation, create write plans, or write files.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { loadLogosConfig } from '../config/load-config.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import { ensureProfileReady } from '../profiles/profile-gate.js';
import { loadIntakeState } from '../state/intake-state-persistence.js';

import { calculateIntakeCompleteness } from './completeness.js';
import {
	loadGenerationState,
	saveGenerationState,
} from './generation-state.js';
import type {
	GenerationPreflightIssue,
	GenerationPreflightMode,
	GenerationPreflightResult,
} from './preflight-result.js';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type RunGenerationPreflightInput = {
	projectRoot: string;
	mode?: GenerationPreflightMode;
	filesystem: LogosFilesystem;
	now: string;
};

export type RunGenerationPreflightResult =
	| {
			ok: true;
			preflight: GenerationPreflightResult;
			warnings: string[];
	  }
	| {
			ok: false;
			preflight?: GenerationPreflightResult;
			errors: string[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function issue(
	code: GenerationPreflightIssue['code'],
	message: string,
	overrides?: {
		questionIds?: string[];
		paths?: string[];
		metadata?: Record<string, unknown>;
	},
): GenerationPreflightIssue {
	const i: GenerationPreflightIssue = { code, message };
	if (overrides?.questionIds !== undefined)
		i.questionIds = overrides.questionIds;
	if (overrides?.paths !== undefined) i.paths = overrides.paths;
	if (overrides?.metadata !== undefined) i.metadata = overrides.metadata;
	return i;
}

function defaultPreflightResult(
	mode: GenerationPreflightMode,
	now: string,
): GenerationPreflightResult {
	return {
		blockers: [],
		canGeneratePartialDraft: false,
		checkedAt: now,
		completenessScore: 0,
		contradictions: [],
		missingCriticalQuestions: [],
		mode,
		optionalMissingQuestions: [],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: [],
		ready: false,
		requiredSkippedQuestions: [],
		requiresExplicitConfirmation: false,
		status: 'not_initialized',
		warnings: [],
	};
}

// ---------------------------------------------------------------------------
// Main preflight function
// ---------------------------------------------------------------------------

/**
 * Run generation preflight checks.
 *
 * Flow:
 * 1. Load LOGOS config.
 * 2. Resolve/load active profile contracts.
 * 3. Load intake state.
 * 4. Build question registry from profile contracts.
 * 5. Calculate intake completeness.
 * 6. Collect blockers and warnings.
 * 7. Persist preflight attempt in generation state.
 * 8. Return structured preflight result.
 *
 * Does **not** generate documentation, create write plans, or write files.
 */
export async function runGenerationPreflight(
	input: RunGenerationPreflightInput,
): Promise<RunGenerationPreflightResult> {
	const { projectRoot, mode = 'final', filesystem, now } = input;

	const preflightWarnings: string[] = [];
	const preflight = defaultPreflightResult(mode, now);

	// ---- 1. Load project config ----
	const configResult = await loadLogosConfig({
		filesystem,
		now,
		projectRoot,
	});

	if (!configResult.ok) {
		preflight.blockers.push(
			issue(
				'project_not_initialized',
				'Project is not initialized. Run /logos-init first.',
			),
		);
		preflight.status = 'not_initialized';
		await persistPreflightAttempt({
			filesystem,
			now,
			preflight,
			projectRoot,
		});
		return { ok: true, preflight, warnings: preflightWarnings };
	}

	if (configResult.createdDefault) {
		// Config was defaulted — project effectively not initialized.
		preflight.blockers.push(
			issue(
				'project_not_initialized',
				'Project config is missing — project appears uninitialized.',
			),
		);
		preflight.status = 'not_initialized';
		await persistPreflightAttempt({
			filesystem,
			now,
			preflight,
			projectRoot,
		});
		return { ok: true, preflight, warnings: preflightWarnings };
	}

	// ---- 2. Resolve and load active profile contracts ----
	const gateResult = await ensureProfileReady({
		activeProfileId: configResult.config.activeProfileId,
		filesystem,
		projectRoot,
	});

	if (!gateResult.ok) {
		for (const blocker of gateResult.blockers) {
			const code = blocker.code as GenerationPreflightIssue['code'];
			if (code === 'profile_not_found' || code === 'profile_invalid') {
				preflight.blockers.push(issue(code, blocker.message));
			} else {
				// Unknown profile error — treat as profile_invalid.
				preflight.blockers.push(issue('profile_invalid', blocker.message));
			}
		}

		if (preflight.blockers.length === 0) {
			// Should not happen but guard.
			preflight.blockers.push(
				issue('profile_invalid', 'Active profile failed to load.'),
			);
		}

		preflight.status = 'blocked';
		await persistPreflightAttempt({
			filesystem,
			now,
			preflight,
			projectRoot,
		});
		return { ok: true, preflight, warnings: preflightWarnings };
	}

	const contracts = gateResult.contracts;

	// ---- 3. Load intake state ----
	const intakeLoadResult = await loadIntakeState({
		filesystem,
		now,
		projectRoot,
	});

	if (!intakeLoadResult.ok) {
		preflight.blockers.push(
			issue('intake_state_missing', 'Failed to load intake state.', {
				metadata: { details: intakeLoadResult.errors.join('; ') },
			}),
		);
		preflight.status = 'blocked';
		await persistPreflightAttempt({
			filesystem,
			now,
			preflight,
			projectRoot,
		});
		return { ok: true, preflight, warnings: preflightWarnings };
	}

	const intakeState = intakeLoadResult.state;

	// ---- 4. Validate question registry is non-empty ----
	const registry = contracts.questionRegistry;
	if (registry.questions.length === 0) {
		preflight.blockers.push(
			issue(
				'question_registry_empty',
				'The active profile contains no intake questions.',
			),
		);
		preflight.status = 'blocked';
		await persistPreflightAttempt({
			filesystem,
			now,
			preflight,
			projectRoot,
		});
		return { ok: true, preflight, warnings: preflightWarnings };
	}

	// ---- 5. Calculate intake completeness ----
	const completeness = calculateIntakeCompleteness({
		intakeState,
		registry,
	});

	preflight.completenessScore = completeness.completenessScore;
	preflight.missingCriticalQuestions = completeness.missingCriticalQuestionIds;
	preflight.partialCriticalQuestions = completeness.partialCriticalQuestionIds;
	preflight.contradictions = completeness.contradictoryQuestionIds;
	preflight.requiredSkippedQuestions = completeness.skippedRequiredQuestionIds;

	// Collect optional missing/skipped questions.
	for (const [id, qc] of Object.entries(completeness.byQuestion)) {
		if (qc.priority === 'optional' && qc.status === 'missing') {
			preflight.optionalMissingQuestions.push(id);
		}
		if (qc.priority === 'optional' && qc.status === 'skipped') {
			preflight.optionalSkippedQuestions.push(id);
		}
	}

	// ---- 6a. Collect blockers from completeness ----

	// Missing critical questions block.
	if (preflight.missingCriticalQuestions.length > 0) {
		preflight.blockers.push(
			issue(
				'missing_critical_questions',
				'One or more critical required questions have not been answered.',
				{ questionIds: preflight.missingCriticalQuestions },
			),
		);
	}

	// Partial critical questions block.
	if (preflight.partialCriticalQuestions.length > 0) {
		preflight.blockers.push(
			issue(
				'partial_critical_questions',
				'One or more critical required questions have only partial answers.',
				{ questionIds: preflight.partialCriticalQuestions },
			),
		);
	}

	// Unresolved contradictions block.
	if (preflight.contradictions.length > 0) {
		preflight.blockers.push(
			issue(
				'unresolved_contradictions',
				'One or more unresolved contradictions exist in the intake state.',
				{ questionIds: preflight.contradictions },
			),
		);
	}

	// Required skipped questions block.
	if (preflight.requiredSkippedQuestions.length > 0) {
		preflight.blockers.push(
			issue(
				'required_questions_skipped',
				'One or more required questions have been explicitly skipped.',
				{ questionIds: preflight.requiredSkippedQuestions },
			),
		);
	}

	// ---- 6b. Collect warnings ----

	// Optional missing → warning.
	if (preflight.optionalMissingQuestions.length > 0) {
		preflight.warnings.push(
			issue(
				'optional_questions_missing',
				'Some optional questions have not been answered.',
				{ questionIds: preflight.optionalMissingQuestions },
			),
		);
	}

	// Optional skipped → warning.
	if (preflight.optionalSkippedQuestions.length > 0) {
		preflight.warnings.push(
			issue(
				'optional_questions_skipped',
				'Some optional questions have been skipped.',
				{ questionIds: preflight.optionalSkippedQuestions },
			),
		);
	}

	// Important missing/partial → warnings (not critical, so don't block).
	const importantMissing: string[] = [];
	const importantPartial: string[] = [];
	for (const [id, qc] of Object.entries(completeness.byQuestion)) {
		if (qc.priority === 'important') {
			if (qc.status === 'missing') importantMissing.push(id);
			if (qc.status === 'partial') importantPartial.push(id);
		}
	}

	if (importantMissing.length > 0) {
		preflight.warnings.push(
			issue(
				'important_questions_missing',
				'Some important (but non-critical) questions have not been answered.',
				{ questionIds: importantMissing },
			),
		);
	}

	if (importantPartial.length > 0) {
		preflight.warnings.push(
			issue(
				'important_questions_partial',
				'Some important (but non-critical) questions have only partial answers.',
				{ questionIds: importantPartial },
			),
		);
	}

	// ---- 6c. Output path / write-plan warnings ----
	// Write plan validation is now implemented in Step 6.3.
	// Preflight no longer emits placeholder warnings; actual path
	// safety, overwrite, and manual-edit checks run during
	// buildGenerationWritePlan().

	// ---- 6d. Derive status and ready ----

	const hasBlockers = preflight.blockers.length > 0;

	if (hasBlockers) {
		preflight.status = 'blocked';
		preflight.ready = false;
	} else {
		preflight.status = 'ready';
		preflight.ready = true;
	}

	// ---- 6e. Partial draft readiness ----
	// canGeneratePartialDraft is true when profile/contracts/questions/intake
	// state are all valid, even if critical blockers remain.
	preflight.canGeneratePartialDraft = true;

	// requiresExplicitConfirmation when partial draft is possible but final
	// is blocked, OR when user explicitly selected partial_draft mode with blockers.
	preflight.requiresExplicitConfirmation =
		(hasBlockers && preflight.canGeneratePartialDraft) ||
		mode === 'partial_draft';

	// ---- 7. Persist preflight attempt in generation state ----
	await persistPreflightAttempt({
		filesystem,
		now,
		preflight,
		projectRoot,
	});

	// ---- 8. Return ----
	return { ok: true, preflight, warnings: preflightWarnings };
}

// ---------------------------------------------------------------------------
// Persistence helper
// ---------------------------------------------------------------------------

async function persistPreflightAttempt(input: {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
	preflight: GenerationPreflightResult;
}): Promise<void> {
	const { projectRoot, filesystem, now, preflight } = input;

	const loadResult = await loadGenerationState({
		filesystem,
		now,
		projectRoot,
	});

	let genState = loadResult.ok ? loadResult.state : undefined;

	if (genState === undefined) {
		// If load failed, create a fresh generation state.
		genState = {
			generatedPaths: [],
			initializedAt: now,
			projectRoot,
			updatedAt: now,
		};
	}

	// Update generation state with preflight snapshot.
	genState.updatedAt = now;
	genState.lastPreflightAt = now;
	genState.lastPreflight = {
		blockerCodes: preflight.blockers.map((b) => b.code),
		checkedAt: now,
		completenessScore: preflight.completenessScore,
		mode: preflight.mode,
		ready: preflight.ready,
		status: preflight.status,
		warningCodes: preflight.warnings.map((w) => w.code),
	};

	await saveGenerationState({
		filesystem,
		projectRoot,
		state: genState,
	});
}
