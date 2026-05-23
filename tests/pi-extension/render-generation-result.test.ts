/**
 * Step 9.4 — Generation result renderer tests.
 *
 * Proves that `renderGenerationResult`:
 * 1. Renders as a LOGOS generation result.
 * 2. Rendered body includes Core generation message body.
 * 3. Rendered body includes generation mode.
 * 4. Rendered body includes wroteFiles status when present.
 * 5. Rendered body includes generated paths when present.
 * 6. Rendered body includes changed paths when present.
 * 7. Renderer preserves structured generation metadata.
 * 8. Renderer does not call Core APIs (pure function, no deps param).
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationResult } from '../../src/pi-extension/rendering/generation-result-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fullGenerationResultData(): Record<string, unknown> {
	return {
		confirmationProvided: true,
		generatedPaths: [
			'docs/01-foundation/THESIS.md',
			'docs/.artifacts/01-foundation/THESIS.html',
		],
		generationMode: 'partial_draft',
		incomplete: true,
		metadata: {
			activeProfileId: 'standard',
			generatedAt: '2026-05-22T12:00:00.000Z',
		},
		partialDraft: true,
		preflight: {
			checkedAt: '2026-05-22T12:00:00.000Z',
			completenessScore: 0.5,
		},
		requiresExplicitConfirmation: true,
		skippedReason: undefined,
		writePlan: {
			dryRun: false,
			mode: 'partial_draft',
			operations: [
				{
					authority: 'canonical',
					documentId: '01-thesis',
					id: 'canonical_markdown:01-foundation:01-thesis:docs/01-foundation/THESIS.md',
					kind: 'create',
					outputKind: 'canonical_markdown',
					path: '/repo/docs/01-foundation/THESIS.md',
					phaseId: '01-foundation',
					relativePath: 'docs/01-foundation/THESIS.md',
					risks: [],
					sourceProfilePath:
						'profiles/standard/phases/01-foundation/01-thesis.yml',
				},
				{
					authority: 'derived',
					documentId: '01-thesis',
					id: 'html_artifact:01-foundation:01-thesis:docs/.artifacts/01-foundation/THESIS.html',
					kind: 'create',
					outputKind: 'html_artifact',
					path: '/repo/docs/.artifacts/01-foundation/THESIS.html',
					phaseId: '01-foundation',
					relativePath: 'docs/.artifacts/01-foundation/THESIS.html',
					risks: [],
				},
			],
			readyToWrite: true,
		},
		wroteFiles: true,
	};
}

function message(body: string, kind = 'generation_result') {
	return { body, kind };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.4 — generation result renderer', () => {
	describe('renders as LOGOS generation result', () => {
		it('returns type "logos"', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Generation complete.'),
			});

			expect(rendered.type).toBe('logos');
		});

		it('returns kind "generation_result" by default', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Generated.'),
			});

			expect(rendered.kind).toBe('generation_result');
		});

		it('default title is "LOGOS generation result"', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['docs/out.md'],
					generationMode: 'final',
				},
				message: message('Done.'),
			});

			expect(rendered.title).toBe('LOGOS generation result');
		});

		it('title reflects partial draft when incomplete', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.title).toContain('incomplete partial draft');
		});
	});

	describe('renders Core generation message body', () => {
		it('includes message body text', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Generation has been completed successfully.'),
			});

			expect(rendered.body).toContain(
				'Generation has been completed successfully.',
			);
		});

		it('preserves full message body at the start', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Custom output report.'),
			});

			expect(rendered.body.startsWith('Custom output report.')).toBe(true);
		});
	});

	describe('renders generation mode', () => {
		it('includes generation mode', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Mode: partial_draft');
		});

		it('renders final mode', () => {
			const rendered = renderGenerationResult({
				data: { generatedPaths: [], generationMode: 'final' },
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Mode: final');
		});

		it('renders dry_run mode', () => {
			const rendered = renderGenerationResult({
				data: { generatedPaths: [], generationMode: 'dry_run' },
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Mode: dry_run');
		});
	});

	describe('renders wroteFiles status', () => {
		it('shows "Files written: yes" when wroteFiles is true', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					wroteFiles: true,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Files written: yes');
		});

		it('shows "Files written: no" when wroteFiles is false', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: [],
					generationMode: 'dry_run',
					wroteFiles: false,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Files written: no');
		});

		it('includes skippedReason when no files written', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: [],
					generationMode: 'dry_run',
					skippedReason: 'Dry run — no files were written.',
					wroteFiles: false,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain(
				'Files written: no (Dry run — no files were written.)',
			);
		});
	});

	describe('renders generated paths', () => {
		it('includes generated paths in output groups', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.body).toContain('THESIS.md');
			expect(rendered.body).toContain('THESIS.html');
		});

		it('renders flat generated paths when no write plan', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out/a.md', 'out/b.html'],
					generationMode: 'final',
					wroteFiles: true,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Generated paths:');
			expect(rendered.body).toContain('out/a.md');
			expect(rendered.body).toContain('out/b.html');
		});

		it('labels planned vs generated correctly when wroteFiles is false', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: [],
					generationMode: 'final',
					writePlan: {
						operations: [
							{
								authority: 'canonical',
								kind: 'create',
								outputKind: 'canonical_markdown',
								relativePath: 'docs/plan.md',
							},
						],
					},
					wroteFiles: false,
				},
				message: message('Planned only.'),
			});

			expect(rendered.body).toContain('Planned outputs');
			expect(rendered.body).not.toContain('Generated outputs');
		});
	});

	describe('renders changed paths', () => {
		it('includes changed paths when provided', () => {
			const rendered = renderGenerationResult({
				changedPaths: [
					{ kind: 'created', path: 'docs/a.md', reason: 'generated' },
				],
				data: {
					generatedPaths: ['docs/a.md'],
					generationMode: 'final',
					wroteFiles: true,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain('Changed paths:');
			expect(rendered.body).toContain('docs/a.md');
			expect(rendered.body).toContain('(created)');
		});

		it('omits changed paths section when empty', () => {
			const rendered = renderGenerationResult({
				changedPaths: [],
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.body).not.toContain('Changed paths:');
		});
	});

	describe('renders incomplete/partial draft status', () => {
		it('renders INCOMPLETE PARTIAL DRAFT header', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.body).toContain('INCOMPLETE PARTIAL DRAFT');
		});

		it('renders PARTIAL DRAFT when partial but not incomplete', () => {
			const rendered = renderGenerationResult({
				data: {
					...fullGenerationResultData(),
					incomplete: false,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain('PARTIAL DRAFT');
			expect(rendered.body).not.toContain('INCOMPLETE PARTIAL DRAFT');
		});

		it('renders INCOMPLETE when incomplete but not partial', () => {
			const rendered = renderGenerationResult({
				data: {
					...fullGenerationResultData(),
					incomplete: true,
					partialDraft: false,
				},
				message: message('Done.'),
			});

			expect(rendered.body).toContain('INCOMPLETE');
		});
	});

	describe('preserves structured metadata', () => {
		it('preserves generationMode in metadata', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.metadata?.generationMode).toBe('partial_draft');
		});

		it('preserves partialDraft and incomplete flags in metadata', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.metadata?.partialDraft).toBe(true);
			expect(rendered.metadata?.incomplete).toBe(true);
		});

		it('preserves wroteFiles in metadata', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			expect(rendered.metadata?.wroteFiles).toBe(true);
		});

		it('preserves generatedPaths in metadata', () => {
			const rendered = renderGenerationResult({
				data: fullGenerationResultData(),
				message: message('Done.'),
			});

			const paths = rendered.metadata?.generatedPaths as string[] | undefined;
			expect(paths).toBeDefined();
			expect(paths).toHaveLength(2);
		});
	});

	describe('safety', () => {
		it('does not throw for null data', () => {
			expect(() =>
				renderGenerationResult({
					data: null,
					message: message('Safe.'),
				}),
			).not.toThrow();
		});

		it('does not throw for undefined data', () => {
			expect(() =>
				renderGenerationResult({
					message: message('Safe.'),
				}),
			).not.toThrow();
		});

		it('does not throw for unknown data shape', () => {
			expect(() =>
				renderGenerationResult({
					data: { unknown: true },
					message: message('Safe.'),
				}),
			).not.toThrow();
		});

		it('does not throw for string data', () => {
			expect(() =>
				renderGenerationResult({
					data: 'not-an-object',
					message: message('Safe.'),
				}),
			).not.toThrow();
		});

		it('is a pure function — no deps param', () => {
			// The function signature has no `deps` or `pi` parameter.
			// Proved by calling with only input data.
			const rendered = renderGenerationResult({
				data: { generatedPaths: ['out.md'], generationMode: 'final' },
				message: message('Safe.'),
			});

			expect(rendered).toBeDefined();
		});
	});
});
