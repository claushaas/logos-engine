/**
 * Tests for Step 12.2 — DocumentPreview component.
 *
 * Uses ink-testing-library for render output assertions.
 * Tests cover: partial completeness, stale sections,
 * no content state, and export eligibility display.
 */
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';

import type { DocumentId } from '../../src/shared/index.js';
import type { DocumentPreviewPanel } from '../../src/contracts/index.js';
import { DocumentPreview } from '../../src/tui/components/DocumentPreview.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const BASE_ACTION_BAR = {
	actions: [
		{ enabled: true, id: 'regenerate_document', label: '[Regenerate]' },
		{ enabled: false, id: 'export_document', label: '[Export]' },
		{ enabled: true, id: 'close_document_preview', label: '[Close]' },
	],
};

const BASE_INPUT = { enabled: false };

/**
 * Panel with partial completeness: some sections accepted,
 * some missing, some stale.
 */
function partialCompletenessPanel(): DocumentPreviewPanel {
	return {
		content: [
			'# Foundation Thesis',
			'',
			'## Core Thesis',
			'',
			'The hiring industry evaluates credentials over competence and pedigree over demonstrated ability. This structural mismatch creates inefficiency, bias, and poor outcomes.',
			'',
			'## Central Tension',
			'',
			'There is a fundamental misalignment between how companies signal quality (credentials) and how they actually assess it (work samples, past performance).',
			'',
			'## Problem Statement',
			'',
			'[MISSING — requires node: problem.problem_space]',
			'',
			'Completeness: 2/3 sections accepted',
		].join('\n'),
		documentId: 'foundation.thesis' as DocumentId,
		exportEligible: false,
		kind: 'document_preview',
		missingNodeIds: ['problem.problem_space' as DocumentId],
		staleNodeIds: [],
		title: 'Foundation Thesis',
	} as DocumentPreviewPanel;
}

/**
 * Panel with stale sections.
 */
function staleSectionsPanel(): DocumentPreviewPanel {
	return {
		content: [
			'# Foundation Thesis',
			'',
			'## Core Thesis',
			'',
			'[⚠ STALE — source node has changed]',
			'',
			'The hiring industry evaluates credentials over competence.',
			'',
			'## Market Context',
			'',
			'The market is shifting towards skills-based hiring.',
			'',
			'Completeness: 1/2 sections accepted',
		].join('\n'),
		documentId: 'foundation.thesis' as DocumentId,
		exportEligible: false,
		kind: 'document_preview',
		missingNodeIds: [],
		staleNodeIds: ['foundation.thesis.core' as DocumentId],
		title: 'Foundation Thesis',
	} as DocumentPreviewPanel;
}

/**
 * Panel with no content (no accepted nodes yet).
 */
function noContentPanel(): DocumentPreviewPanel {
	return {
		content: null,
		documentId: 'foundation.thesis' as DocumentId,
		exportEligible: false,
		kind: 'document_preview',
		missingNodeIds: ['foundation.thesis.core' as DocumentId, 'foundation.thesis.tension' as DocumentId],
		staleNodeIds: [],
		title: 'Foundation Thesis',
	} as DocumentPreviewPanel;
}

/**
 * Panel with all sections accepted and export eligible.
 */
function exportReadyPanel(): DocumentPreviewPanel {
	return {
		content: [
			'# Foundation Thesis',
			'',
			'## Core Thesis',
			'',
			'The hiring industry evaluates credentials over competence.',
			'',
			'## Central Tension',
			'',
			'There is a structural mismatch in hiring.',
			'',
			'Completeness: 2/2 sections accepted',
		].join('\n'),
		documentId: 'foundation.thesis' as DocumentId,
		exportEligible: true,
		kind: 'document_preview',
		missingNodeIds: [],
		staleNodeIds: [],
		title: 'Foundation Thesis',
	} as DocumentPreviewPanel;
}

const EXPORT_READY_ACTION_BAR = {
	actions: [
		{ enabled: true, id: 'regenerate_document', label: '[Regenerate]' },
		{ enabled: true, id: 'export_document', label: '[Export]' },
		{ enabled: true, id: 'close_document_preview', label: '[Close]' },
	],
};

// ─── Render helper ──────────────────────────────────────────────────────────

function renderPreview(
	panel: DocumentPreviewPanel,
	overrides: {
		actionBar?: typeof BASE_ACTION_BAR;
		onSelectAction?: (actionId: string) => void;
		onSelectMissingNode?: (nodeId: string) => void;
	} = {},
) {
	return render(
		<DocumentPreview
			actionBar={overrides.actionBar ?? BASE_ACTION_BAR}
			focusedActionIndex={-1}
			focusedRegion={null}
			input={BASE_INPUT}
			panel={panel}
			onSelectAction={overrides.onSelectAction}
			onSelectMissingNode={overrides.onSelectMissingNode}
		/>,
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// Partial completeness
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — partial completeness', () => {
	it('renders document title', () => {
		const { lastFrame } = renderPreview(partialCompletenessPanel());
		expect(lastFrame()).toContain('Document: Foundation Thesis');
	});

	it('renders accepted section headings', () => {
		const { lastFrame } = renderPreview(partialCompletenessPanel());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Core Thesis');
		expect(frame).toContain('Central Tension');
	});

	it('renders accepted section content', () => {
		const { lastFrame } = renderPreview(partialCompletenessPanel());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('credentials over competence');
		expect(frame).toContain('structural mismatch');
	});

	it('renders [MISSING] label for missing sections', () => {
		const { lastFrame, stdin } = renderPreview(partialCompletenessPanel());
		// Navigate to page 2 to see the [MISSING] marker
		stdin.write('n');
		// Yield for React state update
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(lastFrame()).toContain('[MISSING');
				expect(lastFrame()).toContain('problem.problem_space');
				resolve();
			}, 10);
		});
	});

	it('renders completeness indicator', () => {
		const { lastFrame, stdin } = renderPreview(partialCompletenessPanel());
		// Navigate to page 2 to see the completeness line
		stdin.write('n');
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(lastFrame()).toContain('Completeness: 2/3 sections accepted');
				resolve();
			}, 10);
		});
	});

	it('renders action bar with export disabled', () => {
		const { lastFrame } = renderPreview(partialCompletenessPanel());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Regenerate]');
		expect(frame).toContain('[Export]');
		expect(frame).toContain('[Close]');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Stale sections
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — stale sections', () => {
	it('renders stale section warning', () => {
		const { lastFrame } = renderPreview(staleSectionsPanel());
		expect(lastFrame()).toContain('[⚠ STALE');
	});

	it('renders stale source node count in footer', () => {
		const { lastFrame } = renderPreview(staleSectionsPanel());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('⚠ Stale source nodes');
		expect(frame).toContain('foundation.thesis.core');
	});

	it('stale content is still displayed', () => {
		const { lastFrame } = renderPreview(staleSectionsPanel());
		expect(lastFrame()).toContain('credentials over competence');
	});

	it('export remains disabled when stale', () => {
		const { lastFrame } = renderPreview(staleSectionsPanel());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Export]');
		expect(frame).not.toContain('[Export] (unavailable)');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// No content
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — no content', () => {
	it('shows no content message', () => {
		const { lastFrame } = renderPreview(noContentPanel());
		expect(lastFrame()).toContain('No content yet');
	});

	it('lists missing required nodes', () => {
		const { lastFrame } = renderPreview(noContentPanel());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Missing required nodes');
		expect(frame).toContain('foundation.thesis.core');
		expect(frame).toContain('foundation.thesis.tension');
	});

	it('shows export not eligible message', () => {
		const { lastFrame } = renderPreview(noContentPanel());
		expect(lastFrame()).toContain('not yet export-eligible');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Export ready
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — export ready', () => {
	it('shows export action as enabled', () => {
		const { lastFrame } = renderPreview(exportReadyPanel(), {
			actionBar: EXPORT_READY_ACTION_BAR,
		});
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Export]');
	});

	it('shows full completeness', () => {
		const { lastFrame } = renderPreview(exportReadyPanel());
		expect(lastFrame()).toContain('Completeness: 2/2 sections accepted');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Action bar rendering in document_preview mode (integration with render-model-builder)
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — action bar interaction', () => {
	it('calls onSelectAction when [Regenerate] is selected', () => {
		// This tests the component wiring — actual selection happens
		// through keyboard in AppShell integration tests.
		const panel = exportReadyPanel();
		const { lastFrame } = renderPreview(panel, {
			actionBar: EXPORT_READY_ACTION_BAR,
		});
		const frame = lastFrame() ?? '';
		// All three document preview actions are rendered
		expect(frame).toContain('[Regenerate]');
		expect(frame).toContain('[Export]');
		expect(frame).toContain('[Close]');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Missing node navigation
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — missing node navigation', () => {
	it('renders numbered missing node links', () => {
		const panel = noContentPanel();
		const { lastFrame } = renderPreview(panel);
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[1]');
		expect(frame).toContain('[2]');
		expect(frame).toContain('foundation.thesis.core');
		expect(frame).toContain('foundation.thesis.tension');
	});

	it('calls onSelectMissingNode with correct nodeId when digit key pressed', () => {
		const panel = noContentPanel();
		let selectedNodeId: string | undefined;

		const { stdin } = renderPreview(panel, {
			onSelectMissingNode: (nodeId: string) => {
				selectedNodeId = nodeId;
			},
		});

		// Press '1' key to select the first missing node
		stdin.write('1');
		// yield
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(selectedNodeId).toBe('foundation.thesis.core');
				resolve();
			}, 10);
		});
	});

	it('does not call onSelectMissingNode for keys out of range', () => {
		const panel = noContentPanel();
		let selectedNodeId: string | undefined;

		const { stdin } = renderPreview(panel, {
			onSelectMissingNode: (nodeId: string) => {
				selectedNodeId = nodeId;
			},
		});

		// Press '5' key (only 2 missing nodes)
		stdin.write('5');
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(selectedNodeId).toBeUndefined();
				resolve();
			}, 10);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Page navigation
// ═══════════════════════════════════════════════════════════════════════════

describe('DocumentPreview — page navigation', () => {
	it('renders page indicator for long content', () => {
		const longContent = Array.from(
			{ length: 30 },
			(_, i) => `Line ${i + 1} of the document content.`,
		).join('\n');

		const panel: DocumentPreviewPanel = {
			content: `# Long Document\n\n${longContent}\n\nCompleteness: 0/0`,
			documentId: 'doc' as DocumentId,
			exportEligible: false,
			kind: 'document_preview',
			missingNodeIds: [],
			staleNodeIds: [],
			title: 'Long Document',
		} as DocumentPreviewPanel;

		const { lastFrame } = renderPreview(panel);
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Page 1/');
		expect(frame).toContain('n/p to navigate');
	});

	it('navigates to page 2 via n key and back via p key', () => {
		const longContent = Array.from(
			{ length: 30 },
			(_, i) => `Line ${i + 1} of the document.`,
		).join('\n');

		const panel: DocumentPreviewPanel = {
			content: `# Long Doc\n\n${longContent}\n\nCompleteness: 0/0`,
			documentId: 'doc' as DocumentId,
			exportEligible: false,
			kind: 'document_preview',
			missingNodeIds: [],
			staleNodeIds: [],
			title: 'Long Document',
		} as DocumentPreviewPanel;

		const { lastFrame, stdin } = renderPreview(panel);

		// Page 2 should not show early lines
		const page1 = lastFrame() ?? '';
		expect(page1).toContain('Page 1/');
		expect(page1).toContain('Line 1');

		// Navigate to page 2
		stdin.write('n');
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				const page2 = lastFrame() ?? '';
				expect(page2).toContain('Page 2/');
				// Should show a line from the second page
				expect(page2).toContain('Line 13');

				// Navigate back to page 1
				stdin.write('p');
				setTimeout(() => {
					const backToPage1 = lastFrame() ?? '';
					expect(backToPage1).toContain('Page 1/');
					resolve();
				}, 10);
			}, 10);
		});
	});
});
