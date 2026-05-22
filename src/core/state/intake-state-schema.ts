/**
 * LOGOS Core — Intake state schema normalization.
 *
 * Validates and normalizes raw persisted intake state into a canonical
 * LogosIntakeState. All rules are deterministic and do not depend on AI.
 */

import type {
	ActivePromptKind,
	ActivePromptState,
	IntakeAnswerRecord,
	IntakeAnswerStatus,
	IntakeContradictionRecord,
	IntakeMode,
	IntakePartialRecord,
	IntakePhaseProgress,
	IntakeProgress,
	IntakeProgressCounts,
	IntakeSkippedRecord,
	LogosIntakeState,
} from './intake-state-types.js';

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

export type NormalizeIntakeStateInput = {
	raw: unknown;
	projectRoot: string;
	now: string;
};

export type NormalizeIntakeStateResult =
	| {
			ok: true;
			state: LogosIntakeState;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// Allowed value sets
// ---------------------------------------------------------------------------

const ALLOWED_MODES: readonly IntakeMode[] = [
	'idle',
	'intake_active',
	'paused',
	'generating',
	'complete',
];

const ALLOWED_PROMPT_KINDS: readonly ActivePromptKind[] = [
	'question',
	'follow_up',
	'contradiction_resolution',
];

const ALLOWED_ANSWER_STATUSES: readonly IntakeAnswerStatus[] = [
	'sufficient',
	'partial',
	'insufficient',
	'contradictory',
	'needs_clarification',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

// ---------------------------------------------------------------------------
// Record validators
// ---------------------------------------------------------------------------

function validateAnswerRecord(
	value: unknown,
	key: string,
): { ok: true; record: IntakeAnswerRecord } | { ok: false; error: string } {
	if (!isPlainObject(value)) {
		return {
			error: `answeredQuestions["${key}"] must be a plain object.`,
			ok: false,
		};
	}
	if (!isString(value.questionId)) {
		return {
			error: `answeredQuestions["${key}"].questionId must be a string.`,
			ok: false,
		};
	}
	if (!isString(value.answer)) {
		return {
			error: `answeredQuestions["${key}"].answer must be a string.`,
			ok: false,
		};
	}
	if (
		!isString(value.status) ||
		!ALLOWED_ANSWER_STATUSES.includes(value.status as IntakeAnswerStatus)
	) {
		return {
			error: `answeredQuestions["${key}"].status must be a valid answer status.`,
			ok: false,
		};
	}
	if (!isString(value.answeredAt)) {
		return {
			error: `answeredQuestions["${key}"].answeredAt must be a string.`,
			ok: false,
		};
	}

	const record: IntakeAnswerRecord = {
		answer: value.answer,
		answeredAt: value.answeredAt,
		questionId: value.questionId,
		status: value.status as IntakeAnswerStatus,
	};

	if (isString(value.evaluationId)) {
		record.evaluationId = value.evaluationId;
	}
	if (isString(value.revisedAt)) {
		record.revisedAt = value.revisedAt;
	}
	if (value.metadata !== undefined && value.metadata !== null) {
		if (!isPlainObject(value.metadata)) {
			return {
				error: `answeredQuestions["${key}"].metadata must be a plain object.`,
				ok: false,
			};
		}
		record.metadata = value.metadata as Record<string, unknown>;
	}

	return { ok: true, record };
}

function validatePartialRecord(
	value: unknown,
	key: string,
): { ok: true; record: IntakePartialRecord } | { ok: false; error: string } {
	if (!isPlainObject(value)) {
		return {
			error: `partialQuestions["${key}"] must be a plain object.`,
			ok: false,
		};
	}
	if (!isString(value.questionId)) {
		return {
			error: `partialQuestions["${key}"].questionId must be a string.`,
			ok: false,
		};
	}
	if (!isString(value.recordedAt)) {
		return {
			error: `partialQuestions["${key}"].recordedAt must be a string.`,
			ok: false,
		};
	}
	if (!isStringArray(value.missingAspects)) {
		return {
			error: `partialQuestions["${key}"].missingAspects must be an array of strings.`,
			ok: false,
		};
	}

	const record: IntakePartialRecord = {
		missingAspects: value.missingAspects,
		questionId: value.questionId,
		recordedAt: value.recordedAt,
	};

	if (isString(value.answer)) {
		record.answer = value.answer;
	}
	if (isString(value.reason)) {
		record.reason = value.reason;
	}
	if (isString(value.updatedAt)) {
		record.updatedAt = value.updatedAt;
	}
	if (value.metadata !== undefined && value.metadata !== null) {
		if (!isPlainObject(value.metadata)) {
			return {
				error: `partialQuestions["${key}"].metadata must be a plain object.`,
				ok: false,
			};
		}
		record.metadata = value.metadata as Record<string, unknown>;
	}

	return { ok: true, record };
}

function validateSkippedRecord(
	value: unknown,
	key: string,
): { ok: true; record: IntakeSkippedRecord } | { ok: false; error: string } {
	if (!isPlainObject(value)) {
		return {
			error: `skippedQuestions["${key}"] must be a plain object.`,
			ok: false,
		};
	}
	if (!isString(value.questionId)) {
		return {
			error: `skippedQuestions["${key}"].questionId must be a string.`,
			ok: false,
		};
	}
	if (!isString(value.reason)) {
		return {
			error: `skippedQuestions["${key}"].reason must be a string.`,
			ok: false,
		};
	}
	if (!isString(value.skippedAt)) {
		return {
			error: `skippedQuestions["${key}"].skippedAt must be a string.`,
			ok: false,
		};
	}

	const record: IntakeSkippedRecord = {
		questionId: value.questionId,
		reason: value.reason,
		skippedAt: value.skippedAt,
	};

	if (value.metadata !== undefined && value.metadata !== null) {
		if (!isPlainObject(value.metadata)) {
			return {
				error: `skippedQuestions["${key}"].metadata must be a plain object.`,
				ok: false,
			};
		}
		record.metadata = value.metadata as Record<string, unknown>;
	}

	return { ok: true, record };
}

function validateContradictionRecord(
	value: unknown,
	key: string,
):
	| { ok: true; record: IntakeContradictionRecord }
	| { ok: false; error: string } {
	if (!isPlainObject(value)) {
		return {
			error: `contradictions["${key}"] must be a plain object.`,
			ok: false,
		};
	}
	if (!isString(value.id)) {
		return {
			error: `contradictions["${key}"].id must be a string.`,
			ok: false,
		};
	}
	if (!isString(value.questionId)) {
		return {
			error: `contradictions["${key}"].questionId must be a string.`,
			ok: false,
		};
	}
	if (!isStringArray(value.conflictsWithQuestionIds)) {
		return {
			error: `contradictions["${key}"].conflictsWithQuestionIds must be an array of strings.`,
			ok: false,
		};
	}
	if (!isString(value.summary)) {
		return {
			error: `contradictions["${key}"].summary must be a string.`,
			ok: false,
		};
	}
	if (
		!isString(value.status) ||
		(value.status !== 'unresolved' && value.status !== 'resolved')
	) {
		return {
			error: `contradictions["${key}"].status must be "unresolved" or "resolved".`,
			ok: false,
		};
	}
	if (!isString(value.createdAt)) {
		return {
			error: `contradictions["${key}"].createdAt must be a string.`,
			ok: false,
		};
	}

	const record: IntakeContradictionRecord = {
		conflictsWithQuestionIds: value.conflictsWithQuestionIds,
		createdAt: value.createdAt,
		id: value.id,
		questionId: value.questionId,
		status: value.status as 'unresolved' | 'resolved',
		summary: value.summary,
	};

	if (isString(value.resolvedAt)) {
		record.resolvedAt = value.resolvedAt;
	}
	if (isString(value.resolution)) {
		record.resolution = value.resolution;
	}
	if (value.metadata !== undefined && value.metadata !== null) {
		if (!isPlainObject(value.metadata)) {
			return {
				error: `contradictions["${key}"].metadata must be a plain object.`,
				ok: false,
			};
		}
		record.metadata = value.metadata as Record<string, unknown>;
	}

	return { ok: true, record };
}

function validateProgressCounts(
	value: unknown,
	path: string,
): { ok: true; counts: IntakeProgressCounts } | { ok: false; error: string } {
	if (!isPlainObject(value)) {
		return {
			error: `${path} must be a plain object.`,
			ok: false,
		};
	}

	const keys: Array<keyof IntakeProgressCounts> = [
		'total',
		'sufficient',
		'partial',
		'missing',
		'contradictory',
		'skipped',
	];
	for (const k of keys) {
		const v = value[k];
		if (v !== undefined && !isNonNegativeNumber(v)) {
			return {
				error: `${path}.${k} must be a non-negative number.`,
				ok: false,
			};
		}
	}

	return {
		counts: {
			contradictory: isNonNegativeNumber(value.contradictory)
				? value.contradictory
				: 0,
			missing: isNonNegativeNumber(value.missing) ? value.missing : 0,
			partial: isNonNegativeNumber(value.partial) ? value.partial : 0,
			skipped: isNonNegativeNumber(value.skipped) ? value.skipped : 0,
			sufficient: isNonNegativeNumber(value.sufficient) ? value.sufficient : 0,
			total: isNonNegativeNumber(value.total) ? value.total : 0,
		},
		ok: true,
	};
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

export function normalizeIntakeState(
	input: NormalizeIntakeStateInput,
): NormalizeIntakeStateResult {
	const { raw, projectRoot, now } = input;

	if (!isPlainObject(raw)) {
		return {
			errors: ['Intake state must be a plain object.'],
			ok: false,
			warnings: [],
		};
	}

	const warnings: string[] = [];

	// --- version ---
	const rawVersion = raw.version;
	if (rawVersion !== undefined && rawVersion !== 1) {
		return {
			errors: [`Unsupported intake state version: ${String(rawVersion)}.`],
			ok: false,
			warnings: [],
		};
	}

	// --- mode ---
	const rawMode = raw.mode;
	if (!isString(rawMode) || !ALLOWED_MODES.includes(rawMode as IntakeMode)) {
		return {
			errors: [`Invalid intake mode: ${String(rawMode)}.`],
			ok: false,
			warnings: [],
		};
	}
	const mode = rawMode as IntakeMode;

	// --- activePrompt ---
	let activePrompt: ActivePromptState | undefined;
	const rawActivePrompt = raw.activePrompt;
	if (rawActivePrompt !== undefined && rawActivePrompt !== null) {
		if (!isPlainObject(rawActivePrompt)) {
			return {
				errors: ['activePrompt must be a plain object if present.'],
				ok: false,
				warnings: [],
			};
		}
		const kind = rawActivePrompt.kind;
		if (
			!isString(kind) ||
			!ALLOWED_PROMPT_KINDS.includes(kind as ActivePromptKind)
		) {
			return {
				errors: [`Invalid activePrompt.kind: ${String(kind)}.`],
				ok: false,
				warnings: [],
			};
		}
		if (
			!isString(rawActivePrompt.questionId) ||
			rawActivePrompt.questionId.length === 0
		) {
			return {
				errors: ['activePrompt.questionId must be a non-empty string.'],
				ok: false,
				warnings: [],
			};
		}

		activePrompt = {
			kind: kind as ActivePromptKind,
			questionId: rawActivePrompt.questionId,
			startedAt:
				isString(rawActivePrompt.startedAt) &&
				rawActivePrompt.startedAt.length > 0
					? rawActivePrompt.startedAt
					: now,
			updatedAt:
				isString(rawActivePrompt.updatedAt) &&
				rawActivePrompt.updatedAt.length > 0
					? rawActivePrompt.updatedAt
					: now,
		};

		if (isString(rawActivePrompt.followUpId)) {
			activePrompt.followUpId = rawActivePrompt.followUpId;
		}
		if (isString(rawActivePrompt.contradictionId)) {
			activePrompt.contradictionId = rawActivePrompt.contradictionId;
		}
	}

	// --- activeQuestionId ---
	let activeQuestionId: string | undefined;
	const rawActiveQuestionId = raw.activeQuestionId;
	if (rawActiveQuestionId !== undefined && rawActiveQuestionId !== null) {
		if (!isString(rawActiveQuestionId)) {
			return {
				errors: ['activeQuestionId must be a string if present.'],
				ok: false,
				warnings: [],
			};
		}
		activeQuestionId = rawActiveQuestionId;
	}

	// Validate activeQuestionId matches activePrompt.questionId when both exist
	if (
		activeQuestionId !== undefined &&
		activePrompt !== undefined &&
		activeQuestionId !== activePrompt.questionId
	) {
		return {
			errors: [
				'activeQuestionId must match activePrompt.questionId when both are present.',
			],
			ok: false,
			warnings: [],
		};
	}

	// --- answeredQuestions ---
	const answeredQuestions: Record<string, IntakeAnswerRecord> = {};
	const rawAnswered = raw.answeredQuestions;
	if (rawAnswered !== undefined && rawAnswered !== null) {
		if (!isPlainObject(rawAnswered)) {
			return {
				errors: ['answeredQuestions must be a plain object.'],
				ok: false,
				warnings: [],
			};
		}
		for (const [key, value] of Object.entries(rawAnswered)) {
			const result = validateAnswerRecord(value, key);
			if (!result.ok) {
				return { errors: [result.error], ok: false, warnings: [] };
			}
			answeredQuestions[key] = result.record;
		}
	}

	// --- partialQuestions ---
	const partialQuestions: Record<string, IntakePartialRecord> = {};
	const rawPartial = raw.partialQuestions;
	if (rawPartial !== undefined && rawPartial !== null) {
		if (!isPlainObject(rawPartial)) {
			return {
				errors: ['partialQuestions must be a plain object.'],
				ok: false,
				warnings: [],
			};
		}
		for (const [key, value] of Object.entries(rawPartial)) {
			const result = validatePartialRecord(value, key);
			if (!result.ok) {
				return { errors: [result.error], ok: false, warnings: [] };
			}
			partialQuestions[key] = result.record;
		}
	}

	// --- skippedQuestions ---
	const skippedQuestions: Record<string, IntakeSkippedRecord> = {};
	const rawSkipped = raw.skippedQuestions;
	if (rawSkipped !== undefined && rawSkipped !== null) {
		if (!isPlainObject(rawSkipped)) {
			return {
				errors: ['skippedQuestions must be a plain object.'],
				ok: false,
				warnings: [],
			};
		}
		for (const [key, value] of Object.entries(rawSkipped)) {
			const result = validateSkippedRecord(value, key);
			if (!result.ok) {
				return { errors: [result.error], ok: false, warnings: [] };
			}
			skippedQuestions[key] = result.record;
		}
	}

	// --- contradictions ---
	const contradictions: Record<string, IntakeContradictionRecord> = {};
	const rawContradictions = raw.contradictions;
	if (rawContradictions !== undefined && rawContradictions !== null) {
		if (!isPlainObject(rawContradictions)) {
			return {
				errors: ['contradictions must be a plain object.'],
				ok: false,
				warnings: [],
			};
		}
		for (const [key, value] of Object.entries(rawContradictions)) {
			const result = validateContradictionRecord(value, key);
			if (!result.ok) {
				return { errors: [result.error], ok: false, warnings: [] };
			}
			contradictions[key] = result.record;
		}
	}

	// --- progress ---
	let progress: IntakeProgress;
	const rawProgress = raw.progress;
	if (rawProgress !== undefined && rawProgress !== null) {
		if (!isPlainObject(rawProgress)) {
			return {
				errors: ['progress must be a plain object.'],
				ok: false,
				warnings: [],
			};
		}
		const countsResult = validateProgressCounts(rawProgress, 'progress');
		if (!countsResult.ok) {
			return { errors: [countsResult.error], ok: false, warnings: [] };
		}

		const byPhase: Record<string, IntakePhaseProgress> = {};
		const rawByPhase = rawProgress.byPhase;
		if (rawByPhase !== undefined && rawByPhase !== null) {
			if (!isPlainObject(rawByPhase)) {
				return {
					errors: ['progress.byPhase must be a plain object.'],
					ok: false,
					warnings: [],
				};
			}
			for (const [phaseId, phaseValue] of Object.entries(rawByPhase)) {
				const phaseResult = validateProgressCounts(
					phaseValue,
					`progress.byPhase["${phaseId}"]`,
				);
				if (!phaseResult.ok) {
					return { errors: [phaseResult.error], ok: false, warnings: [] };
				}
				byPhase[phaseId] = { ...phaseResult.counts, phaseId };
			}
		}

		progress = { ...countsResult.counts, byPhase };
	} else {
		progress = {
			byPhase: {},
			contradictory: 0,
			missing: 0,
			partial: 0,
			skipped: 0,
			sufficient: 0,
			total: 0,
		};
		warnings.push('progress missing, defaulting to zero counts.');
	}

	// --- initializedAt ---
	let initializedAt: string;
	if (isString(raw.initializedAt) && raw.initializedAt.length > 0) {
		initializedAt = raw.initializedAt;
	} else {
		initializedAt = now;
		warnings.push('initializedAt missing or invalid, defaulting to now.');
	}

	// --- updatedAt ---
	let updatedAt: string;
	if (isString(raw.updatedAt) && raw.updatedAt.length > 0) {
		updatedAt = raw.updatedAt;
	} else {
		updatedAt = now;
		warnings.push('updatedAt missing or invalid, defaulting to now.');
	}

	// --- metadata ---
	let metadata: Record<string, unknown> | undefined;
	const rawMetadata = raw.metadata;
	if (rawMetadata !== undefined && rawMetadata !== null) {
		if (!isPlainObject(rawMetadata)) {
			return {
				errors: ['metadata must be a plain object if present.'],
				ok: false,
				warnings: [],
			};
		}
		metadata = rawMetadata as Record<string, unknown>;
	}

	// --- projectRoot ---
	let finalProjectRoot: string;
	if (isString(raw.projectRoot) && raw.projectRoot.length > 0) {
		finalProjectRoot = raw.projectRoot;
	} else {
		finalProjectRoot = projectRoot;
		warnings.push(
			'projectRoot missing or invalid, using provided projectRoot.',
		);
	}

	// --- Build state ---
	const state: LogosIntakeState = {
		answeredQuestions,
		contradictions,
		initializedAt,
		mode,
		partialQuestions,
		progress,
		projectRoot: finalProjectRoot,
		skippedQuestions,
		updatedAt,
		version: 1,
	};

	if (activePrompt !== undefined) {
		state.activePrompt = activePrompt;
	}
	if (activeQuestionId !== undefined) {
		state.activeQuestionId = activeQuestionId;
	}
	if (metadata !== undefined) {
		state.metadata = metadata;
	}

	return { ok: true, state, warnings };
}
