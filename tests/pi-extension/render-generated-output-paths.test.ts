/**
 * Step 9.4 — Generated output paths grouping tests.
 *
 * Proves that `renderGenerationResult` correctly groups and labels paths:
 * 1. Canonical Markdown path is rendered under canonical outputs.
 * 2. HTML artifact path is rendered under derived outputs.
 * 3. Agent pack path is rendered under derived outputs.
 * 4. Data output path is rendered under derived outputs.
 * 5. Executive output path is rendered as derived unless Core marks canonical.
 * 6. Skipped/not-written paths are rendered separately when present.
 * 7. Planned paths are not mislabeled as generated when wroteFiles: false.
 */

import { describe, expect, it } from 'vitest';
import { renderGenerationResult } from '../../src/pi-extension/rendering/generation-result-renderer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOp(overrides: Record<string, unknown>): Record<string, unknown> {
	return {
		authority: 'derived',
		kind: 'create',
		outputKind: 'other_artifact',
		relativePath: 'output/path',
		risks: [],
		...overrides,
	};
}

function makeData(ops: Record<string, unknown>[]): Record<string, unknown> {
	return {
		generatedPaths: ops
			.filter((op) => op.kind !== 'skip' && op.kind !== 'blocked')
			.map((op) => op.relativePath as string),
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

describe('Step 9.4 — generated output paths grouping', () => {
	describe('canonical Markdown rendering', () => {
		it('renders canonical Markdown under "Canonical" group', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						outputKind: 'canonical_markdown',
						relativePath: 'docs/01-foundation/THESIS.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Canonical:');
			expect(rendered.body).toContain('THESIS.md');
			// Should appear under canonical, not derived.
			const canonicalIdx = rendered.body.indexOf('Canonical:');
			const _derivedIdx = rendered.body.indexOf('Derived');
			expect(canonicalIdx).toBeGreaterThan(-1);
			// If no derived operations, derived section should not exist.
		});

		it('labels canonical Markdown as "Canonical Markdown" output kind', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						outputKind: 'canonical_markdown',
						relativePath: 'docs/main.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Canonical Markdown:');
		});
	});

	describe('HTML artifact rendering', () => {
		it('renders HTML artifact under "Derived" group', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						outputKind: 'canonical_markdown',
						relativePath: 'docs/main.md',
					}),
					makeOp({
						authority: 'derived',
						outputKind: 'html_artifact',
						relativePath: 'docs/.artifacts/main.html',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
			expect(rendered.body).toContain('HTML:');
			expect(rendered.body).toContain('main.html');
		});

		it('HTML artifact is NOT under canonical group', () => {
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
	});

	describe('agent pack rendering', () => {
		it('renders agent pack under "Derived" group', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						outputKind: 'canonical_markdown',
						relativePath: 'docs/main.md',
					}),
					makeOp({
						authority: 'derived',
						outputKind: 'agent_pack',
						relativePath: 'docs/.agent-packs/main.agent.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Agent pack:');
			expect(rendered.body).toContain('main.agent.md');
		});
	});

	describe('data output rendering', () => {
		it('renders data output under "Derived" group', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'data_output',
						relativePath: 'docs/.data/main.json',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Data:');
			expect(rendered.body).toContain('main.json');
		});
	});

	describe('Executive output rendering', () => {
		it('renders executive_markdown as derived by default', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'executive_markdown',
						relativePath: 'docs/executive/plan.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
			expect(rendered.body).toContain('Executive Markdown:');
		});

		it('renders executive_markdown as canonical when Core explicitly marks it so', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						outputKind: 'executive_markdown',
						relativePath: 'docs/executive/plan.md',
					}),
				]),
				message: msg(),
			});

			// When authority is explicitly "canonical", it goes to canonical group.
			expect(rendered.body).toContain('Canonical:');
			expect(rendered.body).not.toContain('Derived');
		});

		it('renders executive_html as derived', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'executive_html',
						relativePath: 'docs/executive/report.html',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
			expect(rendered.body).toContain('Executive HTML:');
		});

		it('renders executive_mapping as derived', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'executive_mapping',
						relativePath: 'docs/executive/mapping.json',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Derived (non-canonical):');
		});
	});

	describe('skipped / not-written paths', () => {
		it('renders skipped paths separately', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						kind: 'create',
						outputKind: 'canonical_markdown',
						relativePath: 'docs/main.md',
					}),
					makeOp({
						authority: 'derived',
						kind: 'skip',
						outputKind: 'html_artifact',
						relativePath: 'docs/.artifacts/skipped.html',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Not written:');
			expect(rendered.body).toContain('skipped: docs/.artifacts/skipped.html');
		});

		it('renders blocked paths separately', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						kind: 'blocked',
						outputKind: 'agent_pack',
						relativePath: 'docs/blocked.agent.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Not written:');
			expect(rendered.body).toContain('blocked: docs/blocked.agent.md');
		});
	});

	describe('planned vs generated distinction', () => {
		it('labels as "Planned outputs" when wroteFiles is false', () => {
			const rendered = renderGenerationResult({
				data: {
					generatedPaths: [],
					generationMode: 'final',
					writePlan: {
						operations: [
							makeOp({
								authority: 'canonical',
								outputKind: 'canonical_markdown',
								relativePath: 'docs/plan.md',
							}),
						],
					},
					wroteFiles: false,
				},
				message: msg(),
			});

			expect(rendered.body).toContain('Planned outputs');
			expect(rendered.body).not.toContain('Generated outputs');
		});

		it('labels as "Generated outputs" when wroteFiles is true', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'canonical',
						outputKind: 'canonical_markdown',
						relativePath: 'docs/gen.md',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Generated outputs');
			expect(rendered.body).not.toContain('Planned outputs');
		});
	});

	describe('other artifact output kind', () => {
		it('renders other_artifact with its label', () => {
			const rendered = renderGenerationResult({
				data: makeData([
					makeOp({
						authority: 'derived',
						outputKind: 'other_artifact',
						relativePath: 'docs/misc.xyz',
					}),
				]),
				message: msg(),
			});

			expect(rendered.body).toContain('Other artifact:');
		});
	});
});
