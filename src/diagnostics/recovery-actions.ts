/**
 * Recovery actions — maps error codes (and categories) to suggested
 * recovery actions the user can take.
 *
 * The architecture defines nine recovery actions (see §11 of the
 * error handling document). Each error code maps to one or more
 * actions; when no code-specific override exists, the category
 * provides a sensible default list.
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md §11}
 */
import type { RuntimeErrorCategory } from './error-categories.js';

// ─── RecoveryAction ────────────────────────────────────────────────────────

/**
 * Recovery actions the system or user can take in response to an error.
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md §11}
 */
export type RecoveryAction =
	| 'retry'
	| 'reopen_node'
	| 'open_missing_prerequisite'
	| 'regenerate_canonical_answer'
	| 'clear_invalid_active_node'
	| 'export_recovery_bundle'
	| 'restore_previous_snapshot'
	| 'open_settings';

// ─── Category defaults ─────────────────────────────────────────────────────

/**
 * Default recovery actions per error category.
 *
 * These are used when no code-specific override exists.
 */
const CATEGORY_DEFAULTS: Record<RuntimeErrorCategory, RecoveryAction[]> = {
	export: ['export_recovery_bundle', 'open_missing_prerequisite'],
	invalid_state: ['clear_invalid_active_node', 'restore_previous_snapshot'],
	llm_provider: ['retry', 'open_settings'],
	materialization: ['regenerate_canonical_answer', 'open_missing_prerequisite'],
	persistence: ['retry', 'export_recovery_bundle', 'restore_previous_snapshot'],
	profile_schema: ['open_settings'],
	structured_output: ['retry', 'regenerate_canonical_answer'],
	tui_rendering: ['restore_previous_snapshot'],
	validation: ['retry'],
};

// ─── Code-specific overrides ───────────────────────────────────────────────

/**
 * Recovery action overrides for specific error codes.
 *
 * These take priority over category defaults. Every code listed here
 * was discovered from existing usage across the codebase (see grep
 * output from `src/`).
 */
const CODE_OVERRIDES: Record<string, RecoveryAction[]> = {
	// ── Application / use-case ───────────────────────────────────────────
	LOGOS_APPLY_AT_NO_ACTIVE_NODE: ['clear_invalid_active_node'],
	LOGOS_APPLY_AT_NODE_NOT_IN_STATE: ['clear_invalid_active_node'],
	LOGOS_APPLY_AT_PROFILE_MISMATCH: ['clear_invalid_active_node'],
	LOGOS_CA_NO_CANONICAL_ANSWER: ['reopen_node'],

	// ── Conversation runtime ─────────────────────────────────────────────
	LOGOS_CA_NODE_NOT_FOUND: ['clear_invalid_active_node'],
	LOGOS_CA_WRONG_LIFECYCLE_FOR_ACCEPT: ['retry'],
	LOGOS_CA_WRONG_LIFECYCLE_FOR_DRAFT: ['retry'],
	LOGOS_CA_WRONG_LIFECYCLE_FOR_REGENERATE: ['retry'],
	LOGOS_CONV_NODE_MISMATCH: ['clear_invalid_active_node'],
	LOGOS_CONV_NODE_NOT_FOUND: ['clear_invalid_active_node'],
	LOGOS_CONV_NOT_NODE_FOCUS: ['clear_invalid_active_node'],
	LOGOS_DISPATCH_ACTIVE_NODE_REMOVED_FROM_PROFILE: [
		'clear_invalid_active_node',
	],
	LOGOS_DISPATCH_EVENT_NODE_MISMATCH: ['clear_invalid_active_node'],
	LOGOS_DISPATCH_NO_ACTIVE_NODE: ['clear_invalid_active_node'],

	// ── Invalid state ────────────────────────────────────────────────────
	LOGOS_DISPATCH_NO_PROFILE: ['open_settings'],
	LOGOS_DISPATCH_NODE_NOT_IN_PROFILE: ['clear_invalid_active_node'],
	LOGOS_DISPATCH_PROFILE_MISMATCH: ['clear_invalid_active_node'],

	// ── Materialization ──────────────────────────────────────────────────
	LOGOS_DOCUMENT_MISSING_NODES: ['open_missing_prerequisite'],
	LOGOS_DOCUMENT_STALE: ['regenerate_canonical_answer'],
	LOGOS_EDIT_AGENT_FAIL: ['retry'],
	LOGOS_ENV_FILE: ['open_settings'],

	// ── Export ───────────────────────────────────────────────────────────
	LOGOS_EXPORT_FAILED: ['retry', 'export_recovery_bundle'],
	// ── Validation ───────────────────────────────────────────────────────
	LOGOS_INVARIANT_VIOLATION: ['restore_previous_snapshot'],
	LOGOS_LLM_API_KEY: ['open_settings'],
	LOGOS_LLM_BASE_URL: ['open_settings'],
	LOGOS_LLM_MODEL: ['open_settings'],
	LOGOS_LLM_RATE_LIMITED: ['retry'],

	// ── LLM provider ─────────────────────────────────────────────────────
	LOGOS_LLM_TIMEOUT: ['retry', 'open_settings'],
	LOGOS_LLM_UNAVAILABLE: ['retry', 'open_settings'],
	LOGOS_MATERIALIZATION_FAILED: ['retry', 'regenerate_canonical_answer'],
	LOGOS_PERSISTENCE_READ_FAILED: ['restore_previous_snapshot'],

	// ── Persistence ──────────────────────────────────────────────────────
	LOGOS_PERSISTENCE_WRITE_FAILED: ['retry', 'export_recovery_bundle'],
	LOGOS_PROFILE_FILE_NOT_FOUND: ['open_settings'],

	// ── Profile / schema ─────────────────────────────────────────────────
	LOGOS_PROFILE_NOT_FOUND: ['open_settings'],
	LOGOS_PROFILE_PARSE_ERROR: ['open_settings'],
	LOGOS_PROFILE_REFERENCE_INVALID: ['open_settings'],
	LOGOS_PROFILE_SCHEMA_INVALID: ['open_settings'],
	LOGOS_PROFILE_UNEXPECTED_ERROR: ['open_settings'],
	LOGOS_REGENERATE_AGENT_FAIL: ['retry'],

	// ── TUI rendering ────────────────────────────────────────────────────
	LOGOS_RENDER_FAILED: ['restore_previous_snapshot'],
	LOGOS_REPAIR_EXHAUSTED: ['reopen_node', 'regenerate_canonical_answer'],
	LOGOS_RESUME_CLEARED_INVALID_ACTIVE_NODE: ['restore_previous_snapshot'],
	LOGOS_RESUME_CLEARED_INVALID_LAST_ACTIVE_NODE: ['restore_previous_snapshot'],
	LOGOS_RESUME_MIGRATION_APPLIED: ['restore_previous_snapshot'],
	LOGOS_RESUME_NO_PROFILE_SELECTED: ['open_settings'],
	LOGOS_SELECT_AGENT_FAIL: ['retry'],
	LOGOS_SNAPSHOT_CORRUPT: [
		'restore_previous_snapshot',
		'export_recovery_bundle',
	],
	LOGOS_STALE_CASCADE: ['regenerate_canonical_answer'],
	LOGOS_STALE_NODE_NOT_FOUND: ['clear_invalid_active_node'],
	LOGOS_STALE_NOT_ACCEPTED: ['reopen_node'],
	LOGOS_STATE_ACTIVE_NODE_WITHOUT_PROFILE: ['clear_invalid_active_node'],
	LOGOS_STATE_CANNOT_APPLY_LIFECYCLE_TRANSITION_TO_NON_EXISTENT_NODE: [
		'clear_invalid_active_node',
	],
	LOGOS_STATE_INCOMPLETE_FOR_SYNTHESIS: ['reopen_node'],
	LOGOS_STATE_INVALID_LIFECYCLE_TRANSITION: [
		'retry',
		'clear_invalid_active_node',
	],
	LOGOS_STATE_MISSING_NODE_DEF_FOR_SYNTHESIS: ['open_missing_prerequisite'],
	LOGOS_STATE_MISSING_TRANSITION_EVENT: ['retry'],
	LOGOS_STATE_NO_PROFILE_SELECTED: ['open_settings'],
	LOGOS_STATE_NO_PROFILES_AVAILABLE: ['open_settings'],
	LOGOS_STATE_NODE_NOT_IN_PROFILE: ['clear_invalid_active_node'],
	LOGOS_STATE_PROFILE_DEFINITION_REQUIRED: ['open_settings'],
	LOGOS_STATE_PROFILE_LOAD_FAILED: ['open_settings'],
	LOGOS_STATE_PROFILE_MISMATCH: ['clear_invalid_active_node'],
	LOGOS_STATE_UNRESOLVED_BLOCKERS: ['open_missing_prerequisite'],
	LOGOS_STATE_WRONG_TRANSITION_EVENT: ['retry'],

	// ── Structured output ────────────────────────────────────────────────
	LOGOS_STRUCTURED_OUTPUT_PARSE_FAILED: [
		'retry',
		'regenerate_canonical_answer',
	],
	LOGOS_SUBMIT_AGENT_FAIL: ['retry'],
	LOGOS_VALIDATION_FAILED: ['retry'],
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get suggested recovery actions for an error code.
 *
 * Looks up the code in the override map first, then falls back to
 * the category defaults based on a best-guess category match from
 * the error code prefix. Returns an empty array when no mapping
 * is found.
 *
 * @param code - The error code (e.g., `LOGOS_DISPATCH_NO_PROFILE`).
 * @returns Zero or more recovery actions.
 */
export function getRecoveryActions(code: string): RecoveryAction[] {
	// Exact code match takes priority.
	if (code in CODE_OVERRIDES) {
		const override = CODE_OVERRIDES[code];
		if (override) return [...override];
	}

	// Try category-based fallback by inspecting the code prefix.
	const category = inferCategoryFromCode(code);
	if (category !== null) {
		const defaults = CATEGORY_DEFAULTS[category];
		if (defaults) return [...defaults];
	}

	return [];
}

/**
 * Get recovery actions for an error using both its code and category.
 *
 * Code-specific overrides take priority; category defaults provide
 * a fallback when no code mapping is known.
 *
 * @param code - The error code.
 * @param category - The explicit error category.
 * @returns Zero or more recovery actions.
 */
export function getRecoveryActionsForError(
	code: string,
	category: RuntimeErrorCategory,
): RecoveryAction[] {
	// Exact code match takes priority.
	if (code in CODE_OVERRIDES) {
		const override = CODE_OVERRIDES[code];
		if (override) return [...override];
	}

	return [...(CATEGORY_DEFAULTS[category] ?? [])];
}

// ─── Public helper ─────────────────────────────────────────────────────────

/**
 * Infer an error category from the error code prefix.
 *
 * Returns a plain string suitable for display in the TUI error panel.
 * Uses heuristics based on the naming convention observed across the
 * codebase (e.g., `LOGOS_STATE_*` → `"invalid_state"`,
 * `LOGOS_PROFILE_*` → `"profile_schema"`, etc.).
 *
 * @param code - The error code (e.g., `LOGOS_DISPATCH_NO_PROFILE`).
 * @returns A category string, or `null` if no prefix matches.
 */
export function getCategoryFromCode(code: string): string | null {
	return inferCategoryFromCode(code);
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Infer an error category from the error code prefix.
 *
 * Uses heuristics based on the naming convention observed across the
 * codebase (e.g., `LOGOS_STATE_*` → `invalid_state`,
 * `LOGOS_PROFILE_*` → `profile_schema`, etc.).
 */
function inferCategoryFromCode(code: string): RuntimeErrorCategory | null {
	if (code.startsWith('LOGOS_STATE_') || code.startsWith('LOGOS_RESUME_')) {
		return 'invalid_state';
	}
	if (code.startsWith('LOGOS_DISPATCH_')) {
		return 'invalid_state';
	}
	if (code.startsWith('LOGOS_PROFILE_')) {
		return 'profile_schema';
	}
	if (code.startsWith('LOGOS_LLM_') || code.startsWith('LOGOS_ENV_')) {
		return 'llm_provider';
	}
	if (
		code.startsWith('LOGOS_PERSISTENCE_') ||
		code.startsWith('LOGOS_SNAPSHOT_')
	) {
		return 'persistence';
	}
	if (
		code.startsWith('LOGOS_STALE_') ||
		code.startsWith('LOGOS_MATERIALIZATION_')
	) {
		return 'materialization';
	}
	if (code.startsWith('LOGOS_EXPORT_')) {
		return 'export';
	}
	if (code.startsWith('LOGOS_RENDER_')) {
		return 'tui_rendering';
	}
	if (
		code.startsWith('LOGOS_STRUCTURED_') ||
		code.startsWith('LOGOS_REPAIR_')
	) {
		return 'structured_output';
	}
	if (
		code.startsWith('LOGOS_INVARIANT_') ||
		code.startsWith('LOGOS_VALIDATION_')
	) {
		return 'validation';
	}
	if (code.startsWith('LOGOS_CA_') || code.startsWith('LOGOS_CONV_')) {
		return 'invalid_state';
	}
	if (
		code.startsWith('LOGOS_APPLY_') ||
		code.startsWith('LOGOS_SUBMIT_') ||
		code.startsWith('LOGOS_SELECT_') ||
		code.startsWith('LOGOS_EDIT_') ||
		code.startsWith('LOGOS_REGENERATE_')
	) {
		return 'invalid_state';
	}

	return null;
}
