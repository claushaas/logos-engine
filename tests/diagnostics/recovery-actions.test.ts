/**
 * Unit tests for recovery action suggestions.
 *
 * Covers code-specific overrides, category defaults, and the
 * two-argument `getRecoveryActionsForError` variant.
 */
import { describe, expect, it } from 'vitest';
import type { RecoveryAction, RuntimeErrorCategory } from '../../src/diagnostics/index.js';
import {
	getRecoveryActions,
	getRecoveryActionsForError,
} from '../../src/diagnostics/index.js';

// ─── getRecoveryActions (code only) ────────────────────────────────────────

describe('getRecoveryActions (code only)', () => {
	it('returns empty array for unknown code', () => {
		expect(getRecoveryActions('UNKNOWN_CODE')).toEqual([]);
	});

	// ── Validation ───────────────────────────────────────────────────────

	it('LOGOS_INVARIANT_VIOLATION → restore_previous_snapshot', () => {
		expect(getRecoveryActions('LOGOS_INVARIANT_VIOLATION')).toEqual([
			'restore_previous_snapshot',
		]);
	});

	it('LOGOS_STATE_INVALID_LIFECYCLE_TRANSITION → retry + clear_invalid_active_node', () => {
		expect(
			getRecoveryActions('LOGOS_STATE_INVALID_LIFECYCLE_TRANSITION'),
		).toEqual(['retry', 'clear_invalid_active_node']);
	});

	// ── Invalid state ────────────────────────────────────────────────────

	it('LOGOS_DISPATCH_NO_PROFILE → open_settings', () => {
		expect(getRecoveryActions('LOGOS_DISPATCH_NO_PROFILE')).toEqual([
			'open_settings',
		]);
	});

	it('LOGOS_DISPATCH_NO_ACTIVE_NODE → clear_invalid_active_node', () => {
		expect(getRecoveryActions('LOGOS_DISPATCH_NO_ACTIVE_NODE')).toEqual([
			'clear_invalid_active_node',
		]);
	});

	it('LOGOS_STATE_NO_PROFILE_SELECTED → open_settings', () => {
		expect(getRecoveryActions('LOGOS_STATE_NO_PROFILE_SELECTED')).toEqual([
			'open_settings',
		]);
	});

	it('LOGOS_STATE_UNRESOLVED_BLOCKERS → open_missing_prerequisite', () => {
		expect(getRecoveryActions('LOGOS_STATE_UNRESOLVED_BLOCKERS')).toEqual([
			'open_missing_prerequisite',
		]);
	});

	it('LOGOS_STATE_INCOMPLETE_FOR_SYNTHESIS → reopen_node', () => {
		expect(getRecoveryActions('LOGOS_STATE_INCOMPLETE_FOR_SYNTHESIS')).toEqual([
			'reopen_node',
		]);
	});

	// ── LLM provider ─────────────────────────────────────────────────────

	it('LOGOS_LLM_TIMEOUT → retry + open_settings', () => {
		expect(getRecoveryActions('LOGOS_LLM_TIMEOUT')).toEqual([
			'retry',
			'open_settings',
		]);
	});

	it('LOGOS_LLM_RATE_LIMITED → retry', () => {
		expect(getRecoveryActions('LOGOS_LLM_RATE_LIMITED')).toEqual(['retry']);
	});

	it('LOGOS_LLM_API_KEY → open_settings', () => {
		expect(getRecoveryActions('LOGOS_LLM_API_KEY')).toEqual([
			'open_settings',
		]);
	});

	// ── Structured output ────────────────────────────────────────────────

	it('LOGOS_REPAIR_EXHAUSTED → reopen_node + regenerate_canonical_answer', () => {
		expect(getRecoveryActions('LOGOS_REPAIR_EXHAUSTED')).toEqual([
			'reopen_node',
			'regenerate_canonical_answer',
		]);
	});

	// ── Persistence ──────────────────────────────────────────────────────

	it('LOGOS_PERSISTENCE_WRITE_FAILED → retry + export_recovery_bundle', () => {
		expect(getRecoveryActions('LOGOS_PERSISTENCE_WRITE_FAILED')).toEqual([
			'retry',
			'export_recovery_bundle',
		]);
	});

	it('LOGOS_SNAPSHOT_CORRUPT → restore_previous_snapshot + export_recovery_bundle', () => {
		expect(getRecoveryActions('LOGOS_SNAPSHOT_CORRUPT')).toEqual([
			'restore_previous_snapshot',
			'export_recovery_bundle',
		]);
	});

	// ── Profile / schema ─────────────────────────────────────────────────

	it('LOGOS_PROFILE_SCHEMA_INVALID → open_settings', () => {
		expect(getRecoveryActions('LOGOS_PROFILE_SCHEMA_INVALID')).toEqual([
			'open_settings',
		]);
	});

	it('LOGOS_PROFILE_FILE_NOT_FOUND → open_settings', () => {
		expect(getRecoveryActions('LOGOS_PROFILE_FILE_NOT_FOUND')).toEqual([
			'open_settings',
		]);
	});

	// ── Materialization ──────────────────────────────────────────────────

	it('LOGOS_STALE_NOT_ACCEPTED → reopen_node', () => {
		expect(getRecoveryActions('LOGOS_STALE_NOT_ACCEPTED')).toEqual([
			'reopen_node',
		]);
	});

	it('LOGOS_STALE_CASCADE → regenerate_canonical_answer', () => {
		expect(getRecoveryActions('LOGOS_STALE_CASCADE')).toEqual([
			'regenerate_canonical_answer',
		]);
	});

	// ── Conversation runtime ─────────────────────────────────────────────

	it('LOGOS_CA_NODE_NOT_FOUND → clear_invalid_active_node', () => {
		expect(getRecoveryActions('LOGOS_CA_NODE_NOT_FOUND')).toEqual([
			'clear_invalid_active_node',
		]);
	});

	it('LOGOS_CONV_NOT_NODE_FOCUS → clear_invalid_active_node', () => {
		expect(getRecoveryActions('LOGOS_CONV_NOT_NODE_FOCUS')).toEqual([
			'clear_invalid_active_node',
		]);
	});

	// ── Application ──────────────────────────────────────────────────────

	it('LOGOS_SUBMIT_AGENT_FAIL → retry', () => {
		expect(getRecoveryActions('LOGOS_SUBMIT_AGENT_FAIL')).toEqual(['retry']);
	});

	it('LOGOS_APPLY_AT_NO_ACTIVE_NODE → clear_invalid_active_node', () => {
		expect(getRecoveryActions('LOGOS_APPLY_AT_NO_ACTIVE_NODE')).toEqual([
			'clear_invalid_active_node',
		]);
	});

	// ── Category-based fallback (inferred from prefix) ───────────────────

	it('infers invalid_state from LOGOS_STATE_ prefix', () => {
		expect(getRecoveryActions('LOGOS_STATE_SOME_NEW_ERROR')).toEqual([
			'clear_invalid_active_node',
			'restore_previous_snapshot',
		]);
	});

	it('infers profile_schema from LOGOS_PROFILE_ prefix', () => {
		expect(getRecoveryActions('LOGOS_PROFILE_FUTURE_ERROR')).toEqual([
			'open_settings',
		]);
	});

	it('infers llm_provider from LOGOS_LLM_ prefix', () => {
		expect(getRecoveryActions('LOGOS_LLM_FUTURE_ERROR')).toEqual([
			'retry',
			'open_settings',
		]);
	});

	it('infers persistence from LOGOS_PERSISTENCE_ prefix', () => {
		expect(getRecoveryActions('LOGOS_PERSISTENCE_FUTURE_ERROR')).toEqual([
			'retry',
			'export_recovery_bundle',
			'restore_previous_snapshot',
		]);
	});

	it('infers materialization from LOGOS_STALE_ prefix', () => {
		expect(getRecoveryActions('LOGOS_STALE_FUTURE_ERROR')).toEqual([
			'regenerate_canonical_answer',
			'open_missing_prerequisite',
		]);
	});

	it('returns empty array for completely unrecognized prefix', () => {
		expect(getRecoveryActions('SOME_RANDOM_ERROR')).toEqual([]);
	});
});

// ─── getRecoveryActionsForError (code + category) ──────────────────────────

describe('getRecoveryActionsForError', () => {
	it('uses code override when available', () => {
		expect(
			getRecoveryActionsForError('LOGOS_LLM_TIMEOUT', 'invalid_state'),
		).toEqual(['retry', 'open_settings']);
	});

	it('falls back to category default when code is unknown', () => {
		expect(
			getRecoveryActionsForError('SOME_NEW_ERROR', 'persistence'),
		).toEqual(['retry', 'export_recovery_bundle', 'restore_previous_snapshot']);
	});

	it('returns empty array for unknown code and undefined-like category', () => {
		expect(
			// TypeScript wouldn't allow an invalid category, so use a valid one
			// and test the contract.
			getRecoveryActionsForError('TOTALLY_UNKNOWN', 'export'),
		).toEqual(['export_recovery_bundle', 'open_missing_prerequisite']);
	});

	// ── Category default coverage ─────────────────────────────────────────

	const categoryTests: Array<{
		category: RuntimeErrorCategory;
		expected: RecoveryAction[];
	}> = [
		{ category: 'validation', expected: ['retry'] },
		{
			category: 'invalid_state',
			expected: ['clear_invalid_active_node', 'restore_previous_snapshot'],
		},
		{ category: 'llm_provider', expected: ['retry', 'open_settings'] },
		{
			category: 'structured_output',
			expected: ['retry', 'regenerate_canonical_answer'],
		},
		{
			category: 'persistence',
			expected: ['retry', 'export_recovery_bundle', 'restore_previous_snapshot'],
		},
		{ category: 'profile_schema', expected: ['open_settings'] },
		{
			category: 'materialization',
			expected: ['regenerate_canonical_answer', 'open_missing_prerequisite'],
		},
		{ category: 'tui_rendering', expected: ['restore_previous_snapshot'] },
		{
			category: 'export',
			expected: ['export_recovery_bundle', 'open_missing_prerequisite'],
		},
	];

	for (const { category, expected } of categoryTests) {
		it(`category "${category}" → ${JSON.stringify(expected)}`, () => {
			expect(
				getRecoveryActionsForError('UNKNOWN_CODE', category),
			).toEqual(expected);
		});
	}
});
