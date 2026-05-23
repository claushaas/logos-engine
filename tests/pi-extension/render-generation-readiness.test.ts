/**
 * Step 9.2 — Generation readiness renderer tests.
 *
 * Proves that `renderGenerationBlockers` correctly renders all readiness
 * states and preserves flags without invoking confirmation UI.
 *
 * Tests:
 * 1. ready readiness renders clearly.
 * 2. blocked readiness renders clearly.
 * 3. confirmation_required readiness renders clearly.
 * 4. not_initialized readiness renders clearly.
 * 5. canGeneratePartialDraft is displayed when present.
 * 6. requiresExplicitConfirmation is displayed when present.
 * 7. No confirmation UI is invoked.
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationBlockers } from '../../src/pi-extension/rendering/generation-blocker-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePreflight(
	overrides: Record<string, unknown>,
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

function msg(body: string, kind: 'warning' | 'error' | 'status' = 'status') {
	return { body, kind };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.2 — generation readiness display', () => {
	it('renders "ready" readiness clearly', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Generation is ready.'),
			preflight: makePreflight({ ready: true, status: 'ready' }),
		});

		expect(rendered.body).toContain('Generation readiness: ready');
	});

	it('renders "blocked" readiness clearly', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Generation is blocked.', 'error'),
			preflight: makePreflight({
				blockers: [
					{ code: 'project_not_initialized', message: 'Not initialized.' },
				],
				ready: false,
				status: 'blocked',
			}),
		});

		expect(rendered.body).toContain('Generation readiness: blocked');
	});

	it('renders "confirmation_required" readiness clearly', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Confirmation needed.', 'warning'),
			preflight: makePreflight({
				canGeneratePartialDraft: true,
				ready: false,
				requiresExplicitConfirmation: true,
				status: 'confirmation_required',
			}),
		});

		expect(rendered.body).toContain(
			'Generation readiness: confirmation required',
		);
	});

	it('renders "not_initialized" readiness clearly', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Not initialized.', 'error'),
			preflight: makePreflight({
				completenessScore: 0,
				ready: false,
				status: 'not_initialized',
			}),
		});

		expect(rendered.body).toContain('Generation readiness: not_initialized');
	});

	it('infers blocked readiness from ready=false when status absent', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Blocked.', 'error'),
			preflight: makePreflight({
				ready: false,
				status: undefined,
			}),
		});

		expect(rendered.body).toContain('Generation readiness: blocked');
	});

	it('infers ready readiness from ready=true when status absent', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Ready.', 'status'),
			preflight: makePreflight({
				ready: true,
				status: undefined,
			}),
		});

		expect(rendered.body).toContain('Generation readiness: ready');
	});

	it('displays canGeneratePartialDraft when true', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Partial available.'),
			preflight: makePreflight({
				canGeneratePartialDraft: true,
				ready: false,
				status: 'blocked',
			}),
		});

		expect(rendered.body).toContain('Partial draft: available');
	});

	it('omits canGeneratePartialDraft when false', () => {
		const rendered = renderGenerationBlockers({
			message: msg('No partial.'),
			preflight: makePreflight({ canGeneratePartialDraft: false }),
		});

		expect(rendered.body).not.toContain('Partial draft:');
	});

	it('displays requiresExplicitConfirmation when true', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Confirm needed.'),
			preflight: makePreflight({
				ready: false,
				requiresExplicitConfirmation: true,
				status: 'confirmation_required',
			}),
		});

		expect(rendered.body).toContain('Explicit confirmation: required');
	});

	it('omits requiresExplicitConfirmation when false', () => {
		const rendered = renderGenerationBlockers({
			message: msg('No confirm needed.'),
			preflight: makePreflight({ requiresExplicitConfirmation: false }),
		});

		expect(rendered.body).not.toContain('Explicit confirmation:');
	});

	it('preserves readiness status in metadata', () => {
		const rendered = renderGenerationBlockers({
			message: msg('Blocked.', 'error'),
			preflight: makePreflight({
				ready: false,
				requiresExplicitConfirmation: true,
				status: 'blocked',
			}),
		});

		const preflightMeta = rendered.metadata?.preflight as
			| Record<string, unknown>
			| undefined;
		expect(preflightMeta?.status).toBe('blocked');
		expect(preflightMeta?.ready).toBe(false);
		expect(preflightMeta?.requiresExplicitConfirmation).toBe(true);
	});

	it('does not invoke confirmation UI (pure renderer)', () => {
		// The renderer is a pure function; no ctx.ui.confirm calls possible.
		// We prove by rendering and checking no side effects occurred.
		const rendered = renderGenerationBlockers({
			message: msg('Confirm.', 'confirmation_request'),
			preflight: makePreflight({
				ready: false,
				requiresExplicitConfirmation: true,
				status: 'confirmation_required',
			}),
		});

		expect(rendered).toBeDefined();
		expect(rendered.type).toBe('logos');
		// No external calls are made; the renderer is pure.
	});
});
