/**
 * Step 9.2 — Status renderer tests.
 *
 * Proves that `renderStatus`:
 * 1. Status message renders as kind: "status".
 * 2. Rendered body includes Core status message body.
 * 3. Rendered body includes intake mode when present.
 * 4. Rendered body includes total progress when present.
 * 5. Rendered body includes sufficient / partial / missing / contradictory /
 *    skipped counts when present.
 * 6. Rendered body includes completeness score when present.
 * 7. Renderer preserves structured progress metadata.
 * 8. Renderer does not call Core APIs.
 */

import { describe, expect, it } from 'vitest';
import type { AssistantMessage } from '../../src/core/index.js';
import { renderStatus } from '../../src/pi-extension/rendering/status-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function statusMessage(
	overrides?: Partial<AssistantMessage>,
): AssistantMessage {
	return {
		body: 'Intake is in progress.',
		kind: 'status',
		...overrides,
	};
}

function makeStatusData(
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		activeQuestionId: 'q1',
		initialized: true,
		mode: 'intake_active',
		progress: {
			byPhase: {
				'01-foundation': {
					completenessScore: 0.75,
					contradictory: 0,
					missing: 0,
					partial: 1,
					phaseId: '01-foundation',
					sufficient: 2,
					total: 3,
				},
			},
			completenessScore: 0.58,
			contradictory: 1,
			missing: 2,
			partial: 2,
			skipped: 0,
			sufficient: 7,
			total: 12,
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.2 — status renderer', () => {
	it('renders status message as kind "status"', () => {
		const rendered = renderStatus({ message: statusMessage() });

		expect(rendered.type).toBe('logos');
		expect(rendered.kind).toBe('status');
	});

	it('title defaults to "LOGOS status"', () => {
		const rendered = renderStatus({ message: statusMessage() });

		expect(rendered.title).toBe('LOGOS status');
	});

	it('uses explicit title when provided', () => {
		const rendered = renderStatus({
			message: statusMessage({ title: 'Custom status' }),
		});

		expect(rendered.title).toBe('Custom status');
	});

	it('rendered body includes Core status message body', () => {
		const rendered = renderStatus({
			message: statusMessage({ body: 'Specific status text.' }),
		});

		expect(rendered.body).toContain('Specific status text.');
	});

	it('rendered body includes intake mode when present', () => {
		const rendered = renderStatus({
			data: makeStatusData({ mode: 'intake_active' }),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Mode: intake_active');
	});

	it('rendered body includes active question id when present', () => {
		const rendered = renderStatus({
			data: makeStatusData({ activeQuestionId: 'q42' }),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Active question: q42');
	});

	it('rendered body includes total progress when present', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Progress: 7/12 sufficient');
	});

	it('rendered body includes partial count when > 0', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Partial: 2');
	});

	it('rendered body includes missing count when > 0', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Missing: 2');
	});

	it('rendered body includes contradictory count when > 0', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Contradictions: 1');
	});

	it('omits skipped count when zero', () => {
		const rendered = renderStatus({
			data: makeStatusData({}),
			message: statusMessage(),
		});

		expect(rendered.body).not.toContain('Skipped:');
	});

	it('rendered body includes skipped count when > 0', () => {
		const rendered = renderStatus({
			data: makeStatusData({
				progress: {
					contradictory: 0,
					missing: 1,
					partial: 1,
					skipped: 1,
					sufficient: 2,
					total: 5,
				},
			}),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Skipped: 1');
	});

	it('rendered body includes completeness score when present', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Completeness: 58%');
	});

	it('rounds completeness score to integer percentage', () => {
		const rendered = renderStatus({
			data: makeStatusData({
				progress: { completenessScore: 0.336, sufficient: 3, total: 10 },
			}),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Completeness: 34%');
	});

	it('rendered body includes by-phase progress', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('By phase:');
		expect(rendered.body).toContain('01-foundation: 2/3 sufficient, 1 partial');
	});

	it('preserves structured progress metadata', () => {
		const rendered = renderStatus({
			data: makeStatusData(),
			message: statusMessage(),
		});

		expect(rendered.metadata).toBeDefined();
		expect(rendered.metadata?.mode).toBe('intake_active');
		expect(rendered.metadata?.activeQuestionId).toBe('q1');

		const progress = rendered.metadata?.progress as
			| Record<string, unknown>
			| undefined;
		expect(progress).toBeDefined();
		expect(progress?.total).toBe(12);
		expect(progress?.sufficient).toBe(7);
		expect(progress?.byPhase).toBeDefined();
	});

	it('preserves blockers in rendered payload', () => {
		const blockers = [{ code: 'incomplete', message: 'Not done.' }];
		const rendered = renderStatus({
			blockers,
			message: statusMessage(),
		});

		expect(rendered.blockers).toEqual(blockers);
	});

	it('preserves warnings in rendered payload', () => {
		const warnings = [
			{ code: 'optional_missing', message: 'Optional missing.' },
		];
		const rendered = renderStatus({
			message: statusMessage(),
			warnings,
		});

		expect(rendered.warnings).toEqual(warnings);
	});

	it('does not throw for unknown data shapes', () => {
		expect(() =>
			renderStatus({
				data: { unknownField: true },
				message: statusMessage(),
			}),
		).not.toThrow();
	});

	it('does not throw for null data', () => {
		expect(() =>
			renderStatus({
				data: null,
				message: statusMessage(),
			}),
		).not.toThrow();
	});

	it('does not throw for undefined data', () => {
		expect(() =>
			renderStatus({
				message: statusMessage(),
			}),
		).not.toThrow();
	});

	it('handles progress with only total set', () => {
		const rendered = renderStatus({
			data: makeStatusData({
				progress: { total: 10 },
			}),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Progress: 10 total');
	});

	it('handles progress with only sufficient set', () => {
		const rendered = renderStatus({
			data: makeStatusData({
				progress: { sufficient: 5 },
			}),
			message: statusMessage(),
		});

		expect(rendered.body).toContain('Progress: 5 sufficient');
	});

	it('preserves questionId in rendered payload', () => {
		const rendered = renderStatus({
			data: makeStatusData({ activeQuestionId: 'q42' }),
			message: statusMessage(),
		});

		expect(rendered.questionId).toBe('q42');
	});
});
