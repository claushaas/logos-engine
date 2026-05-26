/**
 * Runtime validation tests for Step 1.3 contracts.
 *
 * TypeScript cannot reject empty strings at the type level, so we
 * validate the `userFacingMessage` non-empty rule at runtime.
 *
 * The full schema validator belongs to Step 6.1; this file only
 * asserts the minimal contract-level rule.
 */
import { describe, expect, it } from 'vitest';
import type { AgentTurnOutput } from '../../src/contracts/agent-turn.js';

// ─── Test-local minimal validator ───────────────────────────────────────────
//
// This is intentionally minimal. Step 6.1 will build the full validator
// with all 8 validation rules from the spec.

/**
 * Validates that an `AgentTurnOutput` has a non-empty `userFacingMessage`.
 *
 * Returns `true` if the message is present and non-blank.
 */
function hasValidUserFacingMessage(output: AgentTurnOutput): boolean {
	return output.userFacingMessage.trim().length > 0;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AgentTurnOutput validation', () => {
	it('accepts a turn with non-empty userFacingMessage', () => {
		const valid: AgentTurnOutput = {
			userFacingMessage: 'What is the central thesis of your project?',
		};
		expect(hasValidUserFacingMessage(valid)).toBe(true);
	});

	it('rejects a turn with empty userFacingMessage', () => {
		const invalid: AgentTurnOutput = {
			userFacingMessage: '',
		};
		expect(hasValidUserFacingMessage(invalid)).toBe(false);
	});

	it('rejects a turn with whitespace-only userFacingMessage', () => {
		const invalid: AgentTurnOutput = {
			userFacingMessage: '   ',
		};
		expect(hasValidUserFacingMessage(invalid)).toBe(false);
	});

	it('accepts a turn with a single character', () => {
		const valid: AgentTurnOutput = {
			userFacingMessage: '✓',
		};
		expect(hasValidUserFacingMessage(valid)).toBe(true);
	});

	it('accepts a fully-populated turn', () => {
		const full: AgentTurnOutput = {
			canonicalAnswerDraft: null,
			completenessEvaluation: {
				blockingIssues: [],
				complete: true,
				coverage: {},
				missing: [],
				weak: [],
			},
			diagnostics: [
				{
					code: 'INFO',
					message: 'Turn processed successfully.',
					severity: 'info',
				},
			],
			extracted: {
				assumptions: [],
				decisions: [],
				facts: [],
				openQuestions: [],
				risks: [],
			},
			proposedLifecycle: 'answered',
			proposedPromptState: 'follow_up',
			suggestedActions: ['answer'],
			transitionIntent: {
				event: 'USER_ANSWER_EVALUATED',
				reason: 'User provided sufficient detail.',
			},
			userFacingMessage:
				'Your answer has been recorded. Would you like to refine it?',
		};
		expect(hasValidUserFacingMessage(full)).toBe(true);
	});
});
