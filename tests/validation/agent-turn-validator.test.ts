/**
 * Tests for the AgentTurnOutput validator.
 *
 * Covers:
 * 1. Valid output passes (with and without context).
 * 2. Empty / missing `userFacingMessage` → error.
 * 3. Impossible lifecycle transition → error.
 * 4. `canonicalAnswerDraft` in disallowed lifecycle → error.
 * 5. Missing required fields in draft → error.
 * 6. Multiple errors reported at once.
 * 7. `accepted` lifecycle without user accept → error.
 * 8. Suggested actions incompatible with lifecycle → error.
 * 9. Completeness contradicts lifecycle → error.
 */
import { describe, expect, it } from 'vitest';

import type {
	AgentTurnOutput,
	CanonicalAnswerDraft,
	NodeAction,
} from '../../src/contracts/index.js';
import { isErr, isOk } from '../../src/shared/index.js';
import {
	type AgentTurnValidationContext,
	type ValidationError,
	validateAgentTurnOutput,
} from '../../src/validation/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Shorthand: assert result has at least one error with the given code. */
function expectErrorCode(
	errors: readonly ValidationError[],
	code: string,
): void {
	const found = errors.some((e) => e.code === code);
	expect(
		found,
		`Expected error code "${code}" but got: ${JSON.stringify(errors.map((e) => e.code))}`,
	).toBe(true);
}

/** Shorthand: assert result has NO error with the given code. */
function expectNoErrorCode(
	errors: readonly ValidationError[],
	code: string,
): void {
	const found = errors.some((e) => e.code === code);
	expect(found, `Did NOT expect error code "${code}" but it was present`).toBe(
		false,
	);
}

/** Build a minimal valid AgentTurnOutput. */
function validTurn(overrides: Partial<AgentTurnOutput> = {}): AgentTurnOutput {
	return {
		userFacingMessage: 'What is the central thesis of your project?',
		...overrides,
	};
}

/** Build a minimal valid CanonicalAnswerDraft. */
function validDraft(
	overrides: Partial<CanonicalAnswerDraft> = {},
): CanonicalAnswerDraft {
	return {
		confidence: 'medium',
		content: 'The central thesis is X.',
		format: 'markdown',
		generatedAt: '2026-01-01T00:00:00.000Z',
		generatedFromMessageIds: ['msg_000000000000001'],
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Schema validation tests
// ═══════════════════════════════════════════════════════════════════════════

describe('validateAgentTurnOutput — schema validation', () => {
	it('valid output passes (no context)', () => {
		const result = validateAgentTurnOutput(validTurn());
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.userFacingMessage).toBe(
				'What is the central thesis of your project?',
			);
		}
	});

	it('valid output passes (with context)', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'active',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'answered' }),
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});

	it('empty userFacingMessage → error', () => {
		const result = validateAgentTurnOutput({ userFacingMessage: '' });
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.length).toBeGreaterThanOrEqual(1);
			expectErrorCode(result.error, 'too_small');
		}
	});

	it('missing userFacingMessage → error', () => {
		const result = validateAgentTurnOutput({});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'invalid_type');
		}
	});

	it('whitespace-only userFacingMessage → error', () => {
		const result = validateAgentTurnOutput({ userFacingMessage: '   ' });
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'too_small');
		}
	});

	it('invalid proposedLifecycle → error', () => {
		const result = validateAgentTurnOutput({
			proposedLifecycle: 'nonexistent',
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'invalid_value');
		}
	});

	it('invalid proposedPromptState → error', () => {
		const result = validateAgentTurnOutput({
			proposedPromptState: 'invalid_state',
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'invalid_value');
		}
	});

	it('draft with missing required fields → error', () => {
		const result = validateAgentTurnOutput({
			// Draft missing `generatedAt`, `generatedFromMessageIds`, etc.
			canonicalAnswerDraft: {
				content: 'incomplete draft',
			},
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'invalid_type');
		}
	});

	it('draft with empty content → error', () => {
		const result = validateAgentTurnOutput({
			canonicalAnswerDraft: validDraft({ content: '' }),
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'too_small');
		}
	});

	it('draft with invalid confidence → error', () => {
		const result = validateAgentTurnOutput({
			canonicalAnswerDraft: validDraft({
				confidence: 'certain' as 'low' | 'medium' | 'high',
			}),
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'invalid_value');
		}
	});

	it('transitionIntent with empty reason → error', () => {
		const result = validateAgentTurnOutput({
			transitionIntent: {
				event: 'ASKED_INITIAL',
				reason: '',
			},
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'too_small');
		}
	});

	it('transitionIntent with whitespace-only reason → error', () => {
		const result = validateAgentTurnOutput({
			transitionIntent: {
				event: 'ASKED_INITIAL',
				reason: '   ',
			},
			userFacingMessage: 'test',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'too_small');
		}
	});

	it('multiple schema errors reported at once', () => {
		const result = validateAgentTurnOutput({
			// Missing userFacingMessage
			proposedLifecycle: 'nonexistent',
			transitionIntent: { event: 'ASKED_INITIAL', reason: '' },
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			// Should have at least 2 distinct errors
			expect(result.error.length).toBeGreaterThanOrEqual(2);
		}
	});

	it('extra unknown fields do not cause validation failure', () => {
		const result = validateAgentTurnOutput({
			anotherExtra: 42,
			extraField: 'should be ignored',
			userFacingMessage: 'valid message',
		});
		expect(isOk(result)).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Semantic validation tests
// ═══════════════════════════════════════════════════════════════════════════

describe('validateAgentTurnOutput — semantic validation', () => {
	// ── Lifecycle transition ─────────────────────────────────────────

	it('valid lifecycle transition passes', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'active' }),
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});

	it('impossible lifecycle transition → error', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'synthesized' }),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'INVALID_TRANSITION');
		}
	});

	it('self-transition (no-op) → error', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'active',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'active' }),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'INVALID_TRANSITION');
		}
	});

	it('accepted from not_started → error', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'accepted' }),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			// Both INVALID_TRANSITION and ACCEPTED_WITHOUT_USER_ACTION expected
			expectErrorCode(result.error, 'INVALID_TRANSITION');
			expectErrorCode(result.error, 'ACCEPTED_WITHOUT_USER_ACTION');
		}
	});

	it('accepted with valid transition but no accept action → error', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'synthesized',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'accepted' }),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'ACCEPTED_WITHOUT_USER_ACTION');
			// Transition itself is valid — only the accept check fails
			expectNoErrorCode(result.error, 'INVALID_TRANSITION');
		}
	});

	it('accepted with valid transition and user accept action passes', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'synthesized',
			userAction: 'accept',
		};
		const result = validateAgentTurnOutput(
			validTurn({ proposedLifecycle: 'accepted' }),
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});

	// ── CanonicalAnswerDraft ─────────────────────────────────────────

	it('draft with proposedLifecycle "not_started" → error', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: validDraft(),
				proposedLifecycle: 'not_started',
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'DRAFT_IN_DISALLOWED_STATE');
		}
	});

	it('draft with proposedLifecycle "active" → error', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: validDraft(),
				proposedLifecycle: 'active',
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'DRAFT_IN_DISALLOWED_STATE');
		}
	});

	it('draft with proposedLifecycle "ready_for_synthesis" passes', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'answered',
		};
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: validDraft(),
				proposedLifecycle: 'ready_for_synthesis',
			}),
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});

	it('draft with proposedLifecycle "synthesized" passes', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: validDraft(),
				proposedLifecycle: 'synthesized',
			}),
		);
		expect(isOk(result)).toBe(true);
	});

	it('draft with currentLifecycle "not_started" and no proposedLifecycle → error', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: validDraft(),
				// No proposedLifecycle — falls back to context.currentLifecycle
			}),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'DRAFT_IN_DISALLOWED_STATE');
		}
	});

	it('draft is null → no draft error', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: null,
			}),
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});

	// ── Suggested actions ────────────────────────────────────────────

	it('suggested action incompatible with proposed lifecycle → error', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				proposedLifecycle: 'not_started',
				suggestedActions: ['accept' as NodeAction],
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'ACTION_NOT_ALLOWED');
		}
	});

	it('suggested actions compatible with lifecycle pass', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				proposedLifecycle: 'not_started',
				suggestedActions: ['answer', 'skip'],
			}),
		);
		expect(isOk(result)).toBe(true);
	});

	it('suggested action uses context.currentLifecycle when proposedLifecycle absent', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({
				// No proposedLifecycle
				suggestedActions: ['accept' as NodeAction],
			}),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'ACTION_NOT_ALLOWED');
		}
	});

	it('multiple incompatible actions → multiple errors', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				proposedLifecycle: 'not_started',
				suggestedActions: ['accept', 'regenerate', 'reopen'] as NodeAction[],
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			const actionErrors = result.error.filter(
				(e) => e.code === 'ACTION_NOT_ALLOWED',
			);
			expect(actionErrors.length).toBe(3);
		}
	});

	// ── Completeness contradiction ───────────────────────────────────

	it('incomplete evaluation with ready_for_synthesis → error', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				completenessEvaluation: {
					blockingIssues: [],
					complete: false,
					coverage: {},
					missing: ['topic1'],
					weak: [],
				},
				proposedLifecycle: 'ready_for_synthesis',
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'COMPLETENESS_CONTRADICTS_LIFECYCLE');
		}
	});

	it('incomplete evaluation with synthesized → error', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				completenessEvaluation: {
					blockingIssues: [],
					complete: false,
					coverage: {},
					missing: ['topic1'],
					weak: [],
				},
				proposedLifecycle: 'synthesized',
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'COMPLETENESS_CONTRADICTS_LIFECYCLE');
		}
	});

	it('incomplete evaluation with accepted → error', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				completenessEvaluation: {
					blockingIssues: [],
					complete: false,
					coverage: {},
					missing: ['topic1'],
					weak: [],
				},
				proposedLifecycle: 'accepted',
			}),
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expectErrorCode(result.error, 'COMPLETENESS_CONTRADICTS_LIFECYCLE');
		}
	});

	it('complete evaluation with ready_for_synthesis passes', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'answered',
		};
		const result = validateAgentTurnOutput(
			validTurn({
				completenessEvaluation: {
					blockingIssues: [],
					complete: true,
					coverage: { thesis: 'sufficient' },
					missing: [],
					weak: [],
				},
				proposedLifecycle: 'ready_for_synthesis',
			}),
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});

	it('incomplete evaluation with active lifecycle passes', () => {
		const result = validateAgentTurnOutput(
			validTurn({
				completenessEvaluation: {
					blockingIssues: [],
					complete: false,
					coverage: {},
					missing: ['topic1'],
					weak: [],
				},
				proposedLifecycle: 'active',
			}),
		);
		// Active lifecycle doesn't require completeness
		expect(isOk(result)).toBe(true);
	});

	// ── Multiple semantic errors ────────────────────────────────────

	it('multiple semantic errors reported at once', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			validTurn({
				canonicalAnswerDraft: validDraft(),
				completenessEvaluation: {
					blockingIssues: [],
					complete: false,
					coverage: {},
					missing: ['topic1'],
					weak: [],
				},
				proposedLifecycle: 'accepted',
				suggestedActions: ['accept', 'regenerate'] as NodeAction[],
			}),
			ctx,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			// All of these should be present:
			expectErrorCode(result.error, 'INVALID_TRANSITION'); // not_started → accepted
			expectErrorCode(result.error, 'ACCEPTED_WITHOUT_USER_ACTION');
			expectErrorCode(result.error, 'DRAFT_IN_DISALLOWED_STATE');
			// actions: 'accept' not allowed in 'accepted' lifecycle
			expectErrorCode(result.error, 'ACTION_NOT_ALLOWED');
			expectErrorCode(result.error, 'COMPLETENESS_CONTRADICTS_LIFECYCLE');
		}
	});

	// ── Full valid turn with all fields ─────────────────────────────

	it('full valid turn with all optional fields passes', () => {
		const ctx: AgentTurnValidationContext = {
			currentLifecycle: 'ready_for_synthesis',
			userAction: 'accept',
		};
		const result = validateAgentTurnOutput(
			{
				canonicalAnswerDraft: validDraft(),
				completenessEvaluation: {
					blockingIssues: [],
					complete: true,
					coverage: { thesis: 'sufficient' },
					missing: [],
					weak: [],
				},
				diagnostics: [
					{
						code: 'INFO_NOTE',
						message: 'Synthesis completed in one pass.',
						severity: 'info',
					},
				],
				extracted: {
					assumptions: ['Market size 10B'],
					decisions: ['Use TypeScript'],
					facts: ['Project targets enterprise'],
					openQuestions: ['Pricing model?'],
					risks: ['Competitor X'],
				},
				proposedLifecycle: 'synthesized',
				proposedPromptState: 'review',
				suggestedActions: ['accept', 'edit'],
				transitionIntent: {
					event: 'SYNTHESIS_PROPOSED',
					reason: 'All coverage topics are sufficient.',
				},
				userFacingMessage: 'Here is your synthesized answer.',
			},
			ctx,
		);
		expect(isOk(result)).toBe(true);
	});
});
