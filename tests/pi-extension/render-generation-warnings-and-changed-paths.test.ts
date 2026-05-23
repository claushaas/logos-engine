/**
 * Step 9.4 — Generation warnings and changed paths tests.
 *
 * Proves that `renderGenerationResult` preserves warnings, blockers,
 * and changed paths:
 * 1. Warnings are rendered.
 * 2. Blockers are rendered.
 * 3. Changed paths are preserved exactly.
 * 4. Unknown warning/blocker codes render generically.
 * 5. Manual edit/overwrite warnings remain visible.
 * 6. pi.sendUserMessage is not called (renderer is pure, no deps param).
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationResult } from '../../src/pi-extension/rendering/generation-result-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOp(overrides: Record<string, unknown>): Record<string, unknown> {
	return {
		authority: 'canonical',
		kind: 'create',
		outputKind: 'canonical_markdown',
		relativePath: 'docs/main.md',
		risks: [],
		...overrides,
	};
}

function msg(
	body = 'Report.',
	kind: 'generation_result' | 'warning' | 'error' = 'generation_result',
) {
	return { body, kind };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.4 — warnings and changed paths', () => {
	describe('warning rendering', () => {
		it('renders warnings from explicit warnings param', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
				warnings: [
					{
						code: 'overwrite_existing_file',
						message: 'File already exists.',
						path: 'docs/main.md',
					},
				],
			});

			expect(rendered.body).toContain('Warnings:');
			expect(rendered.body).toContain('Overwrite existing file');
			expect(rendered.body).toContain('File already exists.');
		});

		it('renders warnings from writePlan.warnings', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
						warnings: [
							{
								code: 'manual_edit_detected',
								message: 'Manual edits detected.',
								path: 'docs/main.md',
							},
						],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Warnings:');
			expect(rendered.body).toContain('Manual edit detected');
		});

		it('renders string warnings generically', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
				warnings: ['Simple warning text.'],
			});

			expect(rendered.body).toContain('Warnings:');
			expect(rendered.body).toContain('Simple warning text.');
		});

		it('omits warnings section when empty', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).not.toContain('Warnings:');
		});
	});

	describe('blocker rendering', () => {
		it('renders blockers from explicit blockers param', () => {
			const rendered = renderGenerationResult({
				blockers: [
					{
						code: 'unsafe_output_path',
						message: 'Path is unsafe.',
					},
				],
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Blockers:');
			expect(rendered.body).toContain('Unsafe output path');
		});

		it('renders blockers from writePlan.blockers', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						blockers: [
							{
								code: 'write_plan_blocked_by_preflight',
								message: 'Preflight blocked.',
							},
						],
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Blockers:');
			expect(rendered.body).toContain('Write plan blocked by preflight');
		});

		it('renders string blockers generically', () => {
			const rendered = renderGenerationResult({
				blockers: ['Blocker string.'],
				data: {
					generatedPaths: [],
					generationMode: 'final',
					wroteFiles: false,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Blockers:');
			expect(rendered.body).toContain('Blocker string.');
		});
	});

	describe('unknown warning/blocker codes', () => {
		it('renders unknown warning codes generically', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
						warnings: [
							{
								code: 'future_warning_code_xyz',
								message: 'Some future warning.',
							},
						],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('future_warning_code_xyz');
			expect(rendered.body).toContain('Some future warning.');
		});

		it('renders unknown blocker codes as raw code', () => {
			const rendered = renderGenerationResult({
				blockers: [{ code: 'future_blocker_abc', message: 'Future blocker.' }],
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('future_blocker_abc');
		});
	});

	describe('manual edit / overwrite warnings', () => {
		it('renders manual_edit_detected warning', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
						warnings: [
							{
								code: 'manual_edit_detected',
								message: 'File has been manually edited.',
								path: 'docs/main.md',
							},
						],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Manual edit detected');
			expect(rendered.body).toContain('File has been manually edited.');
		});

		it('renders overwrite_existing_file warning', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
						warnings: [
							{
								code: 'overwrite_existing_file',
								message: 'Output path exists.',
								path: 'docs/main.md',
							},
						],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Overwrite existing file');
		});

		it('renders manual_edit_risk blocker', () => {
			const rendered = renderGenerationResult({
				blockers: [
					{
						code: 'manual_edit_risk',
						message: 'Manual edits detected at target path.',
					},
				],
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Manual edit risk');
		});
	});

	describe('changed paths preservation', () => {
		it('renders changed paths from explicit changedPaths param', () => {
			const rendered = renderGenerationResult({
				changedPaths: [
					{ kind: 'created', path: 'docs/a.md', reason: 'generated' },
					{ kind: 'skipped', path: 'docs/b.md', reason: 'planned_not_written' },
				],
				data: {
					generatedPaths: ['docs/a.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({ relativePath: 'docs/a.md' })],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Changed paths:');
			expect(rendered.body).toContain('docs/a.md');
			expect(rendered.body).toContain('(created)');
			expect(rendered.body).toContain('docs/b.md');
			expect(rendered.body).toContain('(skipped)');
		});

		it('renders string changed paths', () => {
			const rendered = renderGenerationResult({
				changedPaths: ['docs/a.md', 'docs/b.md'],
				data: {
					generatedPaths: ['docs/a.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({ relativePath: 'docs/a.md' })],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Changed paths:');
			expect(rendered.body).toContain('docs/a.md');
			expect(rendered.body).toContain('docs/b.md');
		});

		it('omits changed paths section when empty', () => {
			const rendered = renderGenerationResult({
				changedPaths: [],
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered.body).not.toContain('Changed paths:');
		});
	});

	describe('pi.sendUserMessage not called', () => {
		it('renderer is pure — no sendUserMessage possible', () => {
			// The renderGenerationResult function has no deps/pi parameter.
			// It returns a LogosRenderedMessage synchronously.
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: ['out.md'],
					generationMode: 'final',
					writePlan: {
						operations: [makeOp({})],
						warnings: [{ code: 'test', message: 'Test.' }],
					},
					wroteFiles: true,
				},
				message: msg(),
			});

			expect(rendered).toBeDefined();
			expect(rendered.type).toBe('logos');
			// No side effects; pure function.
		});
	});
});
