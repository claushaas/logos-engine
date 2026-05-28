/**
 * Tests for Step 17.3 — ExportPanel component.
 *
 * Uses ink-testing-library for render output assertions.
 * Tests cover: all exports available, blocked exports,
 * generated artifacts display, and output path on success.
 */

import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type {
	ExportOption,
	ExportPanel as ExportPanelModel,
} from '../../src/contracts/index.js';
import { ExportPanel } from '../../src/tui/components/ExportPanel.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const BASE_INPUT = { enabled: false };

/**
 * Panel with all exports available (Markdown, HTML, Agent Pack).
 */
function allAvailablePanel(): ExportPanelModel {
	const exportOptions: ExportOption[] = [
		{
			available: true,
			description: 'Canonical documentation in portable Markdown format.',
			format: 'markdown',
			label: 'Markdown',
		},
		{
			available: true,
			description: 'Styled documentation as a standalone HTML artifact.',
			format: 'html',
			label: 'HTML',
		},
		{
			available: true,
			description: 'Portable context package for downstream AI agents.',
			format: 'agent_pack',
			label: 'Agent Pack',
		},
	];

	return {
		availableFormats: ['markdown', 'html', 'agent_pack'],
		eligibleDocumentIds: [],
		exportOptions,
		generatedArtifacts: [],
		kind: 'export',
	};
}

/**
 * Panel with blocked Agent Pack export.
 */
function blockedAgentPackPanel(): ExportPanelModel {
	const exportOptions: ExportOption[] = [
		{
			available: true,
			description: 'Canonical documentation in portable Markdown format.',
			format: 'markdown',
			label: 'Markdown',
		},
		{
			available: true,
			description: 'Styled documentation as a standalone HTML artifact.',
			format: 'html',
			label: 'HTML',
		},
		{
			available: false,
			blockedReason:
				'Requires all 3 documents to be ready (2/3 ready). Missing: Product Phase.',
			description: 'Portable context package for downstream AI agents.',
			format: 'agent_pack',
			label: 'Agent Pack',
		},
	];

	return {
		availableFormats: ['markdown', 'html'],
		eligibleDocumentIds: [],
		exportOptions,
		generatedArtifacts: [],
		kind: 'export',
	};
}

/**
 * Panel with generated artifacts.
 */
function panelWithArtifacts(): ExportPanelModel {
	const exportOptions: ExportOption[] = [
		{
			available: true,
			description: 'Canonical documentation in portable Markdown format.',
			format: 'markdown',
			label: 'Markdown',
		},
	];

	return {
		availableFormats: ['markdown'],
		eligibleDocumentIds: [],
		exportOptions,
		generatedArtifacts: [
			{
				id: 'art-1',
				path: './output/foundation-thesis.md',
				stale: false,
				type: 'markdown',
			},
			{
				id: 'art-2',
				path: './output/foundation-thesis.html',
				stale: true,
				type: 'html',
			},
		],
		kind: 'export',
	};
}

/**
 * Panel with output path (success state).
 */
function panelWithOutputPath(): ExportPanelModel {
	const exportOptions: ExportOption[] = [
		{
			available: true,
			description: 'Canonical documentation in portable Markdown format.',
			format: 'markdown',
			label: 'Markdown',
		},
	];

	return {
		availableFormats: ['markdown'],
		eligibleDocumentIds: [],
		exportOptions,
		generatedArtifacts: [
			{
				id: 'art-1',
				path: './output/foundation-thesis.md',
				stale: false,
				type: 'markdown',
			},
		],
		kind: 'export',
		outputPath: './output/foundation-thesis.md',
	};
}

/**
 * Panel with no export options (nothing ready).
 */
function noExportsAvailablePanel(): ExportPanelModel {
	return {
		availableFormats: [],
		eligibleDocumentIds: [],
		exportOptions: [],
		generatedArtifacts: [],
		kind: 'export',
	};
}

// ─── Action bar helper ─────────────────────────────────────────────────────

function actionBarFromPanel(panel: ExportPanelModel) {
	const actions = (panel.exportOptions ?? []).map((opt) => {
		const base = {
			enabled: opt.available,
			id: `export_${opt.format}`,
			label: `[Export ${opt.label}]`,
		};

		if (!opt.available && opt.blockedReason !== undefined) {
			return { ...base, reasonIfDisabled: opt.blockedReason };
		}

		return base;
	});

	actions.push({
		enabled: true,
		id: 'close_export',
		label: '[Close]',
	});

	return { actions };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ExportPanel', () => {
	// ── All exports available ───────────────────────────────────────────

	it('renders export title', () => {
		const panel = allAvailablePanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		expect(lastFrame()).toContain('Export Outcomes');
	});

	it('shows all export options with check marks when all available', () => {
		const panel = allAvailablePanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		// Option cards show format labels (not [Export X] buttons — those are in ActionBar)
		expect(output).toContain('Markdown');
		expect(output).toContain('HTML');
		expect(output).toContain('Agent Pack');
		// All should have ✓ indicator
		expect(output).toContain('✓');
	});

	it('shows descriptions for each export option', () => {
		const panel = allAvailablePanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain(
			'Canonical documentation in portable Markdown format',
		);
		expect(output).toContain(
			'Styled documentation as a standalone HTML artifact',
		);
		expect(output).toContain(
			'Portable context package for downstream AI agents',
		);
	});

	// ── Blocked export ──────────────────────────────────────────────────

	it('shows blocked export with warning icon and reason', () => {
		const panel = blockedAgentPackPanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('Agent Pack');
		expect(output).toContain('⚠');
		expect(output).toContain('Requires all 3 documents to be ready');
		expect(output).toContain('Missing: Product Phase');
	});

	it('available exports still show check marks alongside blocked ones', () => {
		const panel = blockedAgentPackPanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		// Markdown and HTML should have ✓
		expect(output).toContain('✓');
		// Agent Pack should have ⚠
		expect(output).toContain('⚠');
	});

	// ── Generated artifacts ─────────────────────────────────────────────

	it('shows generated artifacts when present', () => {
		const panel = panelWithArtifacts();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('Generated Artifacts');
		expect(output).toContain('markdown');
		expect(output).toContain('./output/foundation-thesis.md');
		expect(output).toContain('html');
		expect(output).toContain('./output/foundation-thesis.html');
	});

	it('marks stale artifacts', () => {
		const panel = panelWithArtifacts();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('(stale)');
	});

	// ── Output path on success ──────────────────────────────────────────

	it('shows output path when provided', () => {
		const panel = panelWithOutputPath();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('Exported to ./output/foundation-thesis.md');
	});

	// ── No exports available ────────────────────────────────────────────

	it('shows fallback message when no export options are available', () => {
		const panel = noExportsAvailablePanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain(
			'No export formats are currently available',
		);
	});

	// ── Action bar ──────────────────────────────────────────────────────

	it('renders action buttons for each export format', () => {
		const panel = allAvailablePanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('[Export Markdown]');
		expect(output).toContain('[Export HTML]');
		expect(output).toContain('[Export Agent Pack]');
	});

	it('renders close action', () => {
		const panel = allAvailablePanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={-1}
				focusedRegion={null}
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('[Close]');
	});

	it('shows blocked reason in action bar for disabled exports', () => {
		const panel = blockedAgentPackPanel();
		const { lastFrame } = render(
			<ExportPanel
				actionBar={actionBarFromPanel(panel)}
				focusedActionIndex={1}
				focusedRegion="actions"
				input={BASE_INPUT}
				panel={panel}
			/>,
		);

		const output = lastFrame();
		expect(output).toContain('Requires all 3 documents to be ready');
	});
});
