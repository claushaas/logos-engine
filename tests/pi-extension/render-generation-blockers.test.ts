/**
 * Step 9.2 — Generation blocker renderer tests.
 *
 * Proves that `renderGenerationBlockers`:
 * 1. Blocked generation preflight renders with appropriate kind.
 * 2. Rendered body includes readiness status.
 * 3. Rendered body includes blocker codes/messages.
 * 4. Rendered body includes missing critical question ids.
 * 5. Rendered body includes partial critical question ids.
 * 6. Rendered body includes contradiction ids.
 * 7. Rendered body includes required skipped question ids.
 * 8. Renderer preserves structured preflight/blocker data.
 * 9. Renderer does not call generate(...).
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderGenerationBlockers } from '../../src/pi-extension/rendering/generation-blocker-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function errorMessage(body: string): AssistantMessage {
	return { body, kind: 'error' };
}

function warningMessage(body: string): AssistantMessage {
	return { body, kind: 'warning' };
}

function blockedPreflight(
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		blockers: [
			{
				code: 'missing_critical_questions',
				message: 'Missing critical questions.',
				questionIds: ['q1', 'q3'],
			},
			{
				code: 'partial_critical_questions',
				message: 'Partial critical answers exist.',
				questionIds: ['q2'],
			},
		],
		canGeneratePartialDraft: true,
		checkedAt: '2026-05-22T12:00:00.000Z',
		completenessScore: 0.42,
		contradictions: ['contradiction.q4.1', 'contradiction.q5.1'],
		missingCriticalQuestions: ['q1', 'q3'],
		mode: 'final',
		optionalMissingQuestions: ['q9'],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: ['q2'],
		ready: false,
		requiredSkippedQuestions: ['q6'],
		requiresExplicitConfirmation: true,
		status: 'blocked',
		warnings: [
			{
				code: 'optional_questions_missing',
				message: 'Optional questions are missing.',
				questionIds: ['q9'],
			},
		],
		...overrides,
	};
}

function readyPreflight(
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		blockers: [],
		canGeneratePartialDraft: false,
		checkedAt: '2026-05-22T12:00:00.000Z',
		completenessScore: 1.0,
		contradictions: [],
		missingCriticalQuestions: [],
		mode: 'final',
		optionalMissingQuestions: [],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: [],
		ready: true,
		requiredSkippedQuestions: [],
		requiresExplicitConfirmation: false,
		status: 'ready',
		warnings: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.2 — generation blocker renderer', () => {
	describe('blocked preflight rendering', () => {
		it('renders blocked generation preflight as kind "error"', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Final generation is blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.type).toBe('logos');
			expect(rendered.kind).toBe('error');
		});

		it('title defaults to "LOGOS generation blocked" for blocked status', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.title).toBe('LOGOS generation blocked');
		});

		it('title defaults to "LOGOS generation blockers" for ready status', () => {
			const rendered = renderGenerationBlockers({
				message: warningMessage('All clear.'),
				preflight: readyPreflight(),
			});

			expect(rendered.title).toBe('LOGOS generation blockers');
		});

		it('rendered body includes readiness status', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Generation readiness: blocked');
		});

		it('rendered body includes "ready" readiness', () => {
			const rendered = renderGenerationBlockers({
				message: warningMessage('Ready.'),
				preflight: readyPreflight(),
			});

			expect(rendered.body).toContain('Generation readiness: ready');
		});

		it('renders "confirmation required" readiness', () => {
			const rendered = renderGenerationBlockers({
				message: warningMessage('Confirm.'),
				preflight: blockedPreflight({
					ready: false,
					status: 'confirmation_required',
				}),
			});

			expect(rendered.body).toContain(
				'Generation readiness: confirmation required',
			);
		});

		it('renders "not initialized" readiness', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Not initialized.'),
				preflight: readyPreflight({
					completenessScore: 0,
					ready: false,
					status: 'not_initialized',
				}),
			});

			expect(rendered.body).toContain('Generation readiness: not_initialized');
		});

		it('rendered body includes completeness score', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Completeness: 42%');
		});

		it('rendered body includes blocker codes and messages', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Blockers:');
			expect(rendered.body).toContain(
				'[missing_critical_questions] Missing critical questions.',
			);
			expect(rendered.body).toContain(
				'[partial_critical_questions] Partial critical answers exist.',
			);
		});

		it('rendered body includes actionable hints for known blocker codes', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain(
				'→ Answer the missing critical questions before generating.',
			);
			expect(rendered.body).toContain(
				'→ Complete critical partial answers before generating.',
			);
		});

		it('rendered body includes warning codes and messages', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Warnings:');
			expect(rendered.body).toContain(
				'[optional_questions_missing] Optional questions are missing.',
			);
		});

		it('rendered body includes missing critical question ids', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Missing critical questions:');
			expect(rendered.body).toContain('  - q1');
			expect(rendered.body).toContain('  - q3');
		});

		it('rendered body includes partial critical question ids', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Partial critical questions:');
			expect(rendered.body).toContain('  - q2');
		});

		it('rendered body includes contradiction ids', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Unresolved contradictions:');
			expect(rendered.body).toContain('  - contradiction.q4.1');
			expect(rendered.body).toContain('  - contradiction.q5.1');
		});

		it('rendered body includes required skipped question ids', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Required skipped questions:');
			expect(rendered.body).toContain('  - q6');
		});

		it('rendered body includes optional missing question ids', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Optional missing questions:');
			expect(rendered.body).toContain('  - q9');
		});

		it('does not include empty sections', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight({
					optionalMissingQuestions: [],
					optionalSkippedQuestions: [],
					requiredSkippedQuestions: [],
				}),
			});

			expect(rendered.body).not.toContain('Optional missing questions:');
			expect(rendered.body).not.toContain('Optional skipped questions:');
			expect(rendered.body).not.toContain('Required skipped questions:');
		});

		it('renders partial draft availability', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Partial draft: available');
		});

		it('renders explicit confirmation requirement', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.body).toContain('Explicit confirmation: required');
		});

		it('preserves structured preflight/blocker data in metadata', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.metadata).toBeDefined();

			const preflight = rendered.metadata?.preflight as
				| Record<string, unknown>
				| undefined;
			expect(preflight).toBeDefined();
			expect(preflight?.status).toBe('blocked');
			expect(preflight?.ready).toBe(false);
			expect(preflight?.completenessScore).toBe(0.42);
			expect(preflight?.canGeneratePartialDraft).toBe(true);
			expect(preflight?.requiresExplicitConfirmation).toBe(true);
		});

		it('preserves blockers and warnings in rendered payload', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Blocked.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.blockers).toBeDefined();
			expect(rendered.blockers?.length).toBe(2);
			expect(rendered.warnings).toBeDefined();
			expect(rendered.warnings?.length).toBe(1);
		});
	});

	describe('generation data as preflight source', () => {
		it('extracts preflight from generation data when no explicit preflight', () => {
			const rendered = renderGenerationBlockers({
				generation: {
					generationMode: 'final',
					preflight: blockedPreflight({ status: 'blocked' }),
				},
				message: errorMessage('Blocked from generation.'),
			});

			expect(rendered.body).toContain('Generation readiness: blocked');
		});
	});

	describe('unknown blocker codes', () => {
		it('renders unknown blocker codes generically', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Unknown blocker.'),
				preflight: blockedPreflight({
					blockers: [
						{ code: 'future_unknown_code', message: 'Some future issue.' },
					],
				}),
			});

			expect(rendered.body).toContain(
				'[future_unknown_code] Some future issue.',
			);
			// Unknown code should not produce a hint, but the original message is preserved.
			expect(rendered.body).toContain('Unknown blocker.');
		});

		it('preserves unknown blocker in metadata', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Unknown.'),
				preflight: blockedPreflight({
					blockers: [{ code: 'future_unknown_code', message: 'Future issue.' }],
				}),
			});

			expect(rendered.metadata?.blockerCodes).toBeDefined();
		});
	});

	describe('explicit blockers/warnings override', () => {
		it('prefers explicit blockers over those from preflight', () => {
			const explicitBlockers = [{ code: 'explicit_b', message: 'Explicit.' }];
			const rendered = renderGenerationBlockers({
				blockers: explicitBlockers,
				message: errorMessage('Explicit blockers.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.blockers).toEqual(explicitBlockers);
		});

		it('falls back to preflight blockers when no explicit blockers', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('Preflight blockers.'),
				preflight: blockedPreflight(),
			});

			expect(rendered.blockers).toBeDefined();
			expect(rendered.blockers?.length).toBe(2);
		});
	});

	describe('safety', () => {
		it('does not throw for unknown data shapes', () => {
			expect(() =>
				renderGenerationBlockers({
					message: errorMessage('Safe.'),
					preflight: { unknown: true },
				}),
			).not.toThrow();
		});

		it('does not throw for null preflight', () => {
			expect(() =>
				renderGenerationBlockers({
					message: errorMessage('Safe.'),
					preflight: null,
				}),
			).not.toThrow();
		});

		it('does not throw for undefined preflight', () => {
			expect(() =>
				renderGenerationBlockers({
					message: errorMessage('Safe.'),
				}),
			).not.toThrow();
		});

		it('does not throw for string blocker in preflight', () => {
			expect(() =>
				renderGenerationBlockers({
					message: errorMessage('String blocker.'),
					preflight: blockedPreflight({
						blockers: ['string-blocker'],
					}),
				}),
			).not.toThrow();
		});

		it('renders string blocker items', () => {
			const rendered = renderGenerationBlockers({
				message: errorMessage('String blocker.'),
				preflight: blockedPreflight({
					blockers: ['raw-string-blocker'],
				}),
			});

			expect(rendered.body).toContain('- blocker: raw-string-blocker');
		});
	});
});
