/**
 * Step 9.2 — Status renderer preserves structured data tests.
 *
 * Proves that status and blocker renderers preserve all structured Core
 * data in metadata without exposing raw Error objects.
 *
 * Tests:
 * 1. byPhase metadata is preserved.
 * 2. progress metadata is preserved.
 * 3. blocker objects are preserved.
 * 4. warning objects are preserved.
 * 5. unknown blocker codes are preserved and rendered generically.
 * 6. raw Error objects are not exposed directly.
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationBlockers } from '../../src/pi-extension/rendering/generation-blocker-renderer.js';
import { renderStatus } from '../../src/pi-extension/rendering/status-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function statusDataWithByPhase(): Record<string, unknown> {
	return {
		activeQuestionId: 'q-main',
		initialized: true,
		mode: 'intake_active',
		progress: {
			byPhase: {
				'01-foundation': {
					completenessScore: 0.875,
					contradictory: 0,
					missing: 0,
					partial: 1,
					phaseId: '01-foundation',
					sufficient: 3,
					total: 4,
				},
				'02-scope': {
					completenessScore: 0.667,
					contradictory: 0,
					missing: 1,
					partial: 0,
					phaseId: '02-scope',
					sufficient: 2,
					total: 3,
				},
				'03-audience': {
					completenessScore: 0.75,
					contradictory: 0,
					missing: 0,
					partial: 1,
					phaseId: '03-audience',
					sufficient: 1,
					total: 2,
				},
			},
			completenessScore: 0.6,
			contradictory: 1,
			missing: 2,
			partial: 3,
			skipped: 0,
			sufficient: 9,
			total: 15,
		},
	};
}

function fullPreflight(
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		blockers: [
			{
				code: 'missing_critical_questions',
				message: 'Missing critical.',
				questionIds: ['q1'],
			},
			{
				code: 'unknown_future_blocker',
				message: 'A future blocker type.',
				metadata: { source: 'future-plugin' },
			},
		],
		canGeneratePartialDraft: true,
		checkedAt: '2026-05-22T12:00:00.000Z',
		completenessScore: 0.42,
		contradictions: ['contradiction.q3.1'],
		missingCriticalQuestions: ['q1'],
		mode: 'final',
		optionalMissingQuestions: ['q9'],
		optionalSkippedQuestions: [],
		partialCriticalQuestions: ['q2'],
		ready: false,
		requiredSkippedQuestions: ['q4'],
		requiresExplicitConfirmation: true,
		status: 'blocked',
		warnings: [
			{
				code: 'optional_questions_missing',
				message: 'Optional missing.',
				questionIds: ['q9'],
			},
		],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.2 — structured data preservation', () => {
	describe('status renderer preserves byPhase metadata', () => {
		it('preserves byPhase in metadata', () => {
			const rendered = renderStatus({
				data: statusDataWithByPhase(),
				message: { body: 'Status report.', kind: 'status' },
			});

			const progress = rendered.metadata?.progress as
				| Record<string, unknown>
				| undefined;
			expect(progress).toBeDefined();
			const byPhase = progress?.byPhase as Record<string, unknown> | undefined;
			expect(byPhase).toBeDefined();

			const foundation = byPhase?.['01-foundation'] as
				| Record<string, unknown>
				| undefined;
			expect(foundation).toBeDefined();
			expect(foundation?.total).toBe(4);
			expect(foundation?.sufficient).toBe(3);
			expect(foundation?.completenessScore).toBe(0.875);

			const scope = byPhase?.['02-scope'] as
				| Record<string, unknown>
				| undefined;
			expect(scope).toBeDefined();
			expect(scope?.missing).toBe(1);

			const audience = byPhase?.['03-audience'] as
				| Record<string, unknown>
				| undefined;
			expect(audience).toBeDefined();
			expect(audience?.partial).toBe(1);
		});

		it('preserves progress metadata with all counts', () => {
			const rendered = renderStatus({
				data: statusDataWithByPhase(),
				message: { body: 'Progress.', kind: 'status' },
			});

			const progress = rendered.metadata?.progress as
				| Record<string, unknown>
				| undefined;
			expect(progress?.total).toBe(15);
			expect(progress?.sufficient).toBe(9);
			expect(progress?.partial).toBe(3);
			expect(progress?.missing).toBe(2);
			expect(progress?.contradictory).toBe(1);
			expect(progress?.skipped).toBe(0);
			expect(progress?.completenessScore).toBe(0.6);
		});
	});

	describe('status renderer preserves mode and questionId', () => {
		it('preserves mode in metadata', () => {
			const rendered = renderStatus({
				data: statusDataWithByPhase(),
				message: { body: 'Status.', kind: 'status' },
			});

			expect(rendered.metadata?.mode).toBe('intake_active');
		});

		it('preserves activeQuestionId in metadata and rendered payload', () => {
			const rendered = renderStatus({
				data: statusDataWithByPhase(),
				message: { body: 'Status.', kind: 'status' },
			});

			expect(rendered.metadata?.activeQuestionId).toBe('q-main');
			expect(rendered.questionId).toBe('q-main');
		});
	});

	describe('generation renderer preserves blocker objects', () => {
		it('preserves blocker codes in metadata', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Blocked.', kind: 'error' },
				preflight: fullPreflight(),
			});

			const blockerCodes = rendered.metadata?.blockerCodes as
				| unknown[]
				| undefined;
			expect(blockerCodes).toBeDefined();
			expect(blockerCodes?.length).toBe(2);
			expect((blockerCodes?.[0] as Record<string, unknown>)?.code).toBe(
				'missing_critical_questions',
			);
		});

		it('preserves blockers in rendered payload', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Blocked.', kind: 'error' },
				preflight: fullPreflight(),
			});

			expect(rendered.blockers).toBeDefined();
			expect(rendered.blockers?.length).toBe(2);
		});

		it('preserves warning objects in metadata and payload', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Blocked.', kind: 'error' },
				preflight: fullPreflight(),
			});

			expect(rendered.warnings).toBeDefined();
			expect(rendered.warnings?.length).toBe(1);
			expect((rendered.warnings?.[0] as Record<string, unknown>)?.code).toBe(
				'optional_questions_missing',
			);

			const metaWarnings = rendered.metadata?.warningCodes as
				| unknown[]
				| undefined;
			expect(metaWarnings).toBeDefined();
			expect(metaWarnings?.length).toBe(1);
		});
	});

	describe('unknown blocker codes are preserved and rendered generically', () => {
		it('renders unknown blocker code generically', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Unknown blocker.', kind: 'error' },
				preflight: fullPreflight(),
			});

			expect(rendered.body).toContain(
				'[unknown_future_blocker] A future blocker type.',
			);
		});

		it('preserves unknown blocker code in structured metadata', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Unknown.', kind: 'error' },
				preflight: fullPreflight(),
			});

			const blockerCodes = rendered.metadata?.blockerCodes as
				| Array<Record<string, unknown>>
				| undefined;
			const unknown = blockerCodes?.find(
				(b) => b.code === 'unknown_future_blocker',
			);
			expect(unknown).toBeDefined();
			expect(unknown?.message).toBe('A future blocker type.');
		});

		it('does not drop unknown blocker from rendered body', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'With unknown.', kind: 'error' },
				preflight: fullPreflight(),
			});

			// Both known and unknown are rendered.
			expect(rendered.body).toContain('missing_critical_questions');
			expect(rendered.body).toContain('unknown_future_blocker');
		});
	});

	describe('raw Error objects are not exposed', () => {
		it('rendered payload does not contain Error instances', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Safe.', kind: 'error' },
				preflight: fullPreflight(),
			});

			expect(rendered.blockers).toBeDefined();
			for (const blocker of rendered.blockers ?? []) {
				expect(blocker).not.toBeInstanceOf(Error);
			}

			expect(rendered.warnings).toBeDefined();
			for (const warning of rendered.warnings ?? []) {
				expect(warning).not.toBeInstanceOf(Error);
			}
		});

		it('status rendered payload does not contain Error instances', () => {
			const rendered = renderStatus({
				data: statusDataWithByPhase(),
				message: { body: 'Status.', kind: 'status' },
			});

			expect(rendered.blockers).toBeUndefined();
			expect(rendered.warnings).toBeUndefined();
			// Metadata is plain JSON-serializable data, not Error objects.
			const metaStr = JSON.stringify(rendered.metadata);
			expect(metaStr).toBeDefined();
			expect(() => JSON.parse(metaStr)).not.toThrow();
		});
	});

	describe('preflight metadata preservation', () => {
		it('preserves preflight status, ready, completeness in metadata', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'Preflight data.', kind: 'error' },
				preflight: fullPreflight(),
			});

			const preflight = rendered.metadata?.preflight as
				| Record<string, unknown>
				| undefined;
			expect(preflight?.status).toBe('blocked');
			expect(preflight?.ready).toBe(false);
			expect(preflight?.completenessScore).toBe(0.42);
			expect(preflight?.canGeneratePartialDraft).toBe(true);
			expect(preflight?.requiresExplicitConfirmation).toBe(true);
		});

		it('preserves question ID arrays in metadata', () => {
			const rendered = renderGenerationBlockers({
				message: { body: 'ID arrays.', kind: 'error' },
				preflight: fullPreflight(),
			});

			expect(rendered.metadata?.missingCriticalQuestions).toEqual(['q1']);
			expect(rendered.metadata?.partialCriticalQuestions).toEqual(['q2']);
			expect(rendered.metadata?.contradictions).toEqual(['contradiction.q3.1']);
			expect(rendered.metadata?.requiredSkippedQuestions).toEqual(['q4']);
		});
	});
});
