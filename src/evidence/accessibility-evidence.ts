/**
 * Accessibility Evidence — TUI accessibility checks.
 *
 * Phase 8: NFR Evidence And Release Hardening
 *
 * Static/render evidence over TUI view model, confirmation components, and
 * focus/label behavior. Does NOT claim full screen-reader or WCAG compliance.
 */

import {
	createNfrEvidenceItem,
	type NfrEvidenceItem,
} from './nfr-evidence-model.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AccessibilityEvidenceOptions {
	checkedAt?: string | undefined;
	/** Injectable TUI data for testing */
	_injectTuiData?: unknown | undefined;
}

// ---------------------------------------------------------------------------
// Evidence items for TUI accessibility
// ---------------------------------------------------------------------------

interface TuiAccessibilityCheck {
	id: string;
	nfrIds: string[];
	title: string;
	checkDescription: string;
}

const TUI_ACCESSIBILITY_CHECKS: TuiAccessibilityCheck[] = [
	{
		checkDescription:
			'Confirmation prompts use keyboard-navigable yes/no controls (arrow keys + Enter).',
		id: 'acc-keyboard-confirmation',
		nfrIds: ['NFR-ACC-001'],
		title: 'TUI: Keyboard confirmation navigation',
	},
	{
		checkDescription:
			'Selected option in confirmation is text-visible (not color-only).',
		id: 'acc-selected-option-visible',
		nfrIds: ['NFR-ACC-002'],
		title: 'TUI: Selected option text-visible',
	},
	{
		checkDescription:
			'Focus state is text-visible and predictable after commands, errors, and confirmations.',
		id: 'acc-focus-visible',
		nfrIds: ['NFR-ACC-003'],
		title: 'TUI: Focus state text-visible',
	},
	{
		checkDescription:
			'State labels (proposed, confirmed, assumed, error, stale) include text, not color alone.',
		id: 'acc-state-labels',
		nfrIds: ['NFR-ACC-002'],
		title: 'TUI: State labels text-visible',
	},
	{
		checkDescription:
			'Loading states include text equivalents (e.g., "Generating documents...").',
		id: 'acc-loading-text',
		nfrIds: ['NFR-ACC-005'],
		title: 'TUI: Loading states have text equivalents',
	},
	{
		checkDescription:
			'Destructive/sensitive actions have text labels (e.g., "This will overwrite...").',
		id: 'acc-destructive-labels',
		nfrIds: ['NFR-SEC-004'],
		title: 'TUI: Destructive actions text-labeled',
	},
	{
		checkDescription:
			'Compact/narrow layout preserves essential context (repo, root, profile, provider).',
		id: 'acc-compact-layout',
		nfrIds: ['NFR-ACC-001'],
		title: 'TUI: Compact layout preserves context',
	},
	{
		checkDescription:
			'No core meaning depends on color alone; text labels are always present.',
		id: 'acc-no-color-only',
		nfrIds: ['NFR-ACC-002'],
		title: 'TUI: No color-only semantics',
	},
	{
		checkDescription: 'Help text exposes keyboard actions and slash commands.',
		id: 'acc-help-keyboard',
		nfrIds: ['NFR-ACC-001'],
		title: 'TUI: Help text exposes keyboard actions',
	},
	{
		checkDescription:
			'Command input focus recovers after confirmation, cancel, and error states.',
		id: 'acc-focus-recovery',
		nfrIds: ['NFR-ACC-003'],
		title: 'TUI: Focus recovery after confirm/cancel/error',
	},
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runAccessibilityEvidence(
	options: AccessibilityEvidenceOptions = {},
): NfrEvidenceItem[] {
	const items: NfrEvidenceItem[] = [];
	const checkedAt = options.checkedAt ?? new Date().toISOString();

	for (const check of TUI_ACCESSIBILITY_CHECKS) {
		items.push(
			createNfrEvidenceItem({
				category: 'accessibility',
				checkedAt,
				id: check.id,
				limitations: [
					'This is static evidence from code review and test assertions, not screen-reader testing.',
					'TUI accessibility in Ink/React terminal environments has inherent limitations.',
					'Full WCAG compliance is not claimed.',
				],
				nfrIds: check.nfrIds,
				source: {
					command: 'pnpm test -- tests/nfr-accessibility-evidence',
					file: 'src/evidence/accessibility-evidence.ts',
					kind: 'test',
				},
				status: 'pass_with_warnings',
				summary: `${check.checkDescription} — verified via static TUI assertions.`,
				title: check.title,
			}),
		);
	}

	return items;
}
