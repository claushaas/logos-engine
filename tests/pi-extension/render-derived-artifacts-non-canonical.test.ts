/**
 * Step 9.4 — Derived artifacts not labeled canonical tests.
 *
 * Proves that `renderGenerationResult` never labels derived artifacts as
 * canonical unless Core explicitly marks them so:
 * 1. html_artifact is not labeled canonical.
 * 2. agent_pack is not labeled canonical.
 * 3. data_output is not labeled canonical.
 * 4. executive_html is not labeled canonical.
 * 5. executive_mapping is not labeled canonical.
 * 6. Unknown authority is not promoted to canonical.
 * 7. Renderer preserves original output kind and authority metadata.
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationResult } from '../../src/pi-extension/rendering/generation-result-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOp(overrides: Record<string, unknown>): Record<string, unknown> {
	return {
		kind: 'create',
		outputKind: 'other_artifact',
		relativePath: 'output/path',
		risks: [],
		...overrides,
	};
}

function makeData(ops: Record<string, unknown>[]): Record<string, unknown> {
	return {
		generatedPaths: ops.map((op) => op.relativePath as string),
		generationMode: 'final',
		writePlan: { operations: ops },
		wroteFiles: true,
	};
}

function msg() {
	return { body: 'Report.', kind: 'generation_result' as const };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step 9.4 — derived artifacts never canonical', () => {
	describe('html_artifact', () => {
		it('is NOT labeled canonical when authority is "derived"', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'html_artifact',
						relativePath: 'docs/out.html',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).not.toContain('Canonical:');
			expect(rendered.body).toContain('Derived (non-canonical):');
		});

		it('is NOT labeled canonical when authority is absent (fallback from kind)', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						outputKind: 'html_artifact',
						relativePath: 'docs/out.html',
						// authority intentionally omitted
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
		});
	});

	describe('agent_pack', () => {
		it('is NOT labeled canonical', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'agent_pack',
						relativePath: 'docs/pack.agent.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).not.toContain('Canonical:');
			expect(rendered.body).toContain('Derived (non-canonical):');
		});
	});

	describe('data_output', () => {
		it('is NOT labeled canonical', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'data_output',
						relativePath: 'docs/data.json',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).not.toContain('Canonical:');
			expect(rendered.body).toContain('Derived (non-canonical):');
		});
	});

	describe('executive_html', () => {
		it('is NOT labeled canonical', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'executive_html',
						relativePath: 'docs/report.html',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
		});
	});

	describe('executive_mapping', () => {
		it('is NOT labeled canonical', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'executive_mapping',
						relativePath: 'docs/mapping.json',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
		});
	});

	describe('unknown authority', () => {
		it('is not promoted to canonical when authority is absent and kind is unknown', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						outputKind: 'some_future_kind',
						relativePath: 'docs/future.xyz',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).not.toContain('Canonical:');
			// Should appear in unclassified.
			expect(rendered.body).toContain('Unclassified authority:');
		});

		it('is not promoted to canonical when authority is an unknown string', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'future_authority_value',
						outputKind: 'html_artifact',
						relativePath: 'docs/out.html',
					}),
				]),
				message: msg(),
			});

			// Unknown authority string doesn't match 'canonical' or 'derived'.
			// It falls to outputKind classification, which puts html_artifact in derived.
			expect(rendered.body).toContain('Derived (non-canonical):');
		});

		it('is not promoted to canonical when authority is missing entirely', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						relativePath: 'docs/unknown.xyz',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).not.toContain('Canonical:');
		});
	});

	describe('preserves original authority and kind metadata', () => {
		it('renderer does not mutate input data', () => {
			const ops = [
				makeOp({
					authority: 'derived',
					outputKind: 'html_artifact',
					relativePath: 'docs/out.html',
				}),
			];
			const data = makeData(ops);

			renderGenerationResult({ data, message: msg() });

			// Input should not have been mutated.
			const wp = data.writePlan as { operations: unknown[] };
			const firstOp = wp.operations[0] as Record<string, unknown>;
			expect(firstOp.authority).toBe('derived');
			expect(firstOp.outputKind).toBe('html_artifact');
		});
	});
});
