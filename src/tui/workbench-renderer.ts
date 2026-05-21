/**
 * TUI Workbench Renderer — pure rendering functions for the workbench layout.
 *
 * Phase 5: TUI Workbench Redesign — Outcome 2 (stable workbench layout).
 *
 * All functions are pure: they take a view model and return display lines.
 * No side effects, no provider calls, no filesystem access, no state mutation,
 * no Ink-specific code. The renderer produces arrays of strings that the Ink
 * component can display as Text elements.
 *
 * Layout regions:
 * 1. Orientation header
 * 2. Primary work area
 * 3. Context rail (optional)
 * 4. Action area
 * 5. Feedback/status area
 * 6. Command input
 */

import { renderReport } from './report-renderers.js';
import {
	createStateLabel,
	type StateLabelKind,
	type TuiFocusModel,
	type TuiLoadingModel,
	type TuiWorkbenchViewModel,
} from './workbench-model.js';

// ---------------------------------------------------------------------------
// Rendering options
// ---------------------------------------------------------------------------

export interface WorkbenchRenderOptions {
	/** Override viewport mode (defaults to model.viewportMode) */
	mode?: 'compact' | 'standard' | 'wide' | undefined;
	/** Maximum items to show in any list (default 10) */
	maxItems?: number | undefined;
	/** Maximum primary content lines to show before scroll/pagination (default maxItems) */
	maxPrimaryLines?: number | undefined;
	/** Zero-based offset into primary content for scrollable views */
	primaryContentOffset?: number | undefined;
	/** Render width override (for tests) */
	width?: number | undefined;
}

// ---------------------------------------------------------------------------
// Divider helper
// ---------------------------------------------------------------------------

function divider(char = '─', length = 60): string {
	return char.repeat(length);
}

// ---------------------------------------------------------------------------
// State label formatting
// ---------------------------------------------------------------------------

function formatLabel(kind: StateLabelKind): string {
	return createStateLabel(kind).text;
}

// ---------------------------------------------------------------------------
// Orientation header
// ---------------------------------------------------------------------------

/**
 * Render the orientation header. Always shows repository, workspace status,
 * profile, documentation root, provider status, and current view.
 */
export function renderOrientationHeader(
	model: TuiWorkbenchViewModel,
): string[] {
	const o = model.orientation;
	const lines: string[] = [];

	// Row 1: Repository | Workspace | Profile
	const statusLabel = o.isDryRun
		? formatLabel('dry_run')
		: o.isMutating
			? ''
			: o.isReadOnly
				? formatLabel('read_only')
				: '';

	lines.push(
		`Repo: ${o.repository} | Workspace: ${o.workspaceStatus} | Profile: ${o.activeProfileId} ${statusLabel}`,
	);

	// Row 2: Root | Provider | View
	const providerLabel =
		o.providerStatus.includes('not configured') ||
		o.providerStatus.includes('disabled')
			? formatLabel('provider_unconfigured')
			: o.providerStatus.includes('ready') ||
					o.providerStatus.includes('configured')
				? formatLabel('provider_ready')
				: '';

	lines.push(
		`Root: ${o.documentationRoot} | Provider: ${o.providerStatus} ${providerLabel} | View: ${o.currentView}`,
	);

	lines.push(divider());
	return lines;
}

/**
 * Render compact orientation header (for narrow terminals).
 * Keeps essential orientation without line count.
 */
export function renderCompactOrientation(
	model: TuiWorkbenchViewModel,
): string[] {
	const o = model.orientation;
	const lines: string[] = [];

	const statusLabel = o.isDryRun
		? formatLabel('dry_run')
		: o.isReadOnly
			? formatLabel('read_only')
			: '';

	const providerShort =
		o.providerStatus.includes('not configured') ||
		o.providerStatus.includes('disabled')
			? formatLabel('provider_unconfigured')
			: formatLabel('provider_ready');

	lines.push(
		`${o.repository} | ${o.workspaceStatus} | ${o.documentationRoot} | ${o.activeProfileId} ${statusLabel} | ${providerShort}`,
	);
	lines.push(`View: ${o.currentView}`);
	lines.push(divider('─', 40));
	return lines;
}

// ---------------------------------------------------------------------------
// Primary work area
// ---------------------------------------------------------------------------

/**
 * Render the primary work area. This shows the active view's content
 * or a structured report.
 */
export function renderPrimaryArea(
	model: TuiWorkbenchViewModel,
	options?: WorkbenchRenderOptions,
): string[] {
	const p = model.primary;
	const lines: string[] = [];
	const maxItems = options?.maxPrimaryLines ?? options?.maxItems ?? 10;

	// Title
	lines.push(p.title);
	if (p.stateLabels.length > 0) {
		const labelText = p.stateLabels.map((l) => l.text).join(' ');
		lines.push(`  ${labelText}`);
	}

	// Phase 7: Output browser and generation report view-specific labels
	if (model.viewKind === 'output_browser') {
		lines.push(`  ${formatLabel('read_only')} Canonical and derived artifacts`);
	} else if (model.viewKind === 'generation_report') {
		lines.push(`  Review generated outputs with /outputs`);
	}

	lines.push(divider('─', 40));

	// Report takes priority over raw content
	if (p.report) {
		const rendered = renderReport(p.report);
		for (const line of rendered) {
			lines.push(line);
		}
	} else if (p.content.length > 0) {
		// Show content through a scrollable window.
		const maxOffset = Math.max(0, p.content.length - maxItems);
		const offset = Math.min(
			Math.max(0, options?.primaryContentOffset ?? 0),
			maxOffset,
		);
		const shown = p.content.slice(offset, offset + maxItems);
		for (const line of shown) {
			lines.push(line);
		}
		if (p.content.length > maxItems) {
			const start = offset + 1;
			const end = offset + shown.length;
			lines.push(
				`Lines ${start}-${end} of ${p.content.length}. Scroll: ↑/↓ line, PageUp/PageDown page.`,
			);
		}
	} else {
		// Summary fallback
		if (p.summary) {
			lines.push(p.summary);
		} else {
			lines.push('(no content)');
		}
	}

	// Summary line
	if (p.summary && p.report) {
		// Summary already shown in report rendering
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Context rail
// ---------------------------------------------------------------------------

/**
 * Render the context rail. Only shown when visible and in standard/wide mode.
 * In compact mode, the context rail is suppressed.
 */
export function renderContextRail(model: TuiWorkbenchViewModel): string[] {
	const rail = model.contextRail;
	if (!rail?.visible) {
		// Compact context summary (one-liner)
		const c = model.context;
		if (!c.available) return [];
		const parts: string[] = [];
		if (c.openQuestionCount > 0) parts.push(`Q:${c.openQuestionCount}`);
		if (c.assumptionCount > 0) parts.push(`A:${c.assumptionCount}`);
		if (c.riskCount > 0) parts.push(`R:${c.riskCount}`);
		if (c.proposalCount > 0) parts.push(`P:${c.proposalCount}`);
		if (parts.length === 0) return [];
		return [`Context: ${parts.join(' ')}`];
	}

	const lines: string[] = [];
	lines.push('Context:');
	for (const item of rail.items) {
		const stateText = item.stateLabel ? ` ${item.stateLabel.text}` : '';
		lines.push(`  ${item.label}: ${item.value}${stateText}`);
	}
	return lines;
}

// ---------------------------------------------------------------------------
// Action area
// ---------------------------------------------------------------------------

/**
 * Render the action area with available commands and review actions.
 */
export function renderActionArea(
	model: TuiWorkbenchViewModel,
	options?: WorkbenchRenderOptions,
): string[] {
	const actions = model.actionArea.actions;
	if (actions.length === 0) return [];

	const maxItems = options?.maxItems ?? 10;
	const lines: string[] = [];

	lines.push('Actions:');

	const shown = actions.slice(0, maxItems);
	for (const action of shown) {
		const readOnlyLabel = action.readOnly ? formatLabel('read_only') : '';
		const mutatingLabel = action.mutating ? ' [mutating]' : '';
		const recommendedMarker = action.recommended ? ' → ' : '   ';
		const confirmNote = action.requiresConfirmation
			? ' [needs confirmation]'
			: '';

		lines.push(
			`${recommendedMarker}${action.label} — ${action.description}${readOnlyLabel}${mutatingLabel}${confirmNote}`,
		);
	}

	if (actions.length > maxItems) {
		lines.push(`   ... and ${actions.length - maxItems} more actions`);
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Feedback/status area
// ---------------------------------------------------------------------------

/**
 * Render the feedback area with status messages, warnings, errors, and
 * loading/pending messages.
 */
export function renderFeedbackArea(model: TuiWorkbenchViewModel): string[] {
	const fb = model.feedback;
	const lines: string[] = [];

	if (fb.messages.length === 0 && fb.statusKind === 'idle') {
		return lines;
	}

	// Status kind label
	let statusLabel = '';
	switch (fb.statusKind) {
		case 'success':
			statusLabel = ' [ok]';
			break;
		case 'info':
			statusLabel = '';
			break;
		case 'warning':
			statusLabel = ` ${formatLabel('warning')}`;
			break;
		case 'error':
			statusLabel = ` ${formatLabel('failed')}`;
			break;
	}

	if (fb.messages.length > 0) {
		lines.push(`Status:${statusLabel}`);
		for (const msg of fb.messages.slice(0, 3)) {
			const labelText = msg.labelKind
				? `${createStateLabel(msg.labelKind).text} `
				: '';
			lines.push(`  ${labelText}${msg.text}`);
		}
		if (fb.messages.length > 3) {
			lines.push(`  ... and ${fb.messages.length - 3} more messages`);
		}
	} else if (fb.statusKind !== 'idle') {
		lines.push(`Status:${statusLabel}`);
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Loading area
// ---------------------------------------------------------------------------

/**
 * Render loading/pending state.
 */
export function renderLoadingArea(loading: TuiLoadingModel): string[] {
	const lines: string[] = [];

	const readOnlyLabel = loading.readOnly
		? formatLabel('read_only')
		: ' [mutating]';
	const cancelNote = loading.cancellable ? ' (cancellable)' : '';

	lines.push(`Loading: ${loading.title}${readOnlyLabel}${cancelNote}`);
	lines.push(`  Phase: ${loading.phase || 'starting...'}`);
	lines.push(`  Status: ${loading.statusText}`);

	if (loading.diagnostics.length > 0) {
		for (const diag of loading.diagnostics.slice(0, 3)) {
			lines.push(`  [${diag.severity.toUpperCase()}] ${diag.message}`);
		}
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Command input
// ---------------------------------------------------------------------------

/**
 * Render the command input area.
 */
export function renderCommandInput(model: TuiWorkbenchViewModel): string[] {
	const ci = model.commandInput;
	if (!ci.visible) return [];

	const lines: string[] = [];

	if (ci.disabled) {
		lines.push(
			`[input disabled] ${ci.disabledReason ?? 'Confirmation is pending'}`,
		);
	} else {
		lines.push('> _');
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Focus indicator
// ---------------------------------------------------------------------------

/**
 * Render a focus indicator for accessibility.
 */
export function renderFocusIndicator(focus: TuiFocusModel): string[] {
	return [`[${focus.focusLabel}]`];
}

// ---------------------------------------------------------------------------
// Full workbench renderer
// ---------------------------------------------------------------------------

/**
 * Render the complete workbench as an array of display lines.
 * This is the main entry point for workbench rendering.
 *
 * The layout order is:
 * 1. Orientation header
 * 2. Primary work area (with optional loading overlay)
 * 3. Context rail (or compact summary)
 * 4. Action area
 * 5. Feedback area
 * 6. Command input
 * 7. Focus indicator
 */
export function renderWorkbench(
	model: TuiWorkbenchViewModel,
	options?: WorkbenchRenderOptions,
): string[] {
	const lines: string[] = [];
	const mode = options?.mode ?? model.viewportMode;
	const isCompact = mode === 'compact';

	// 1. Orientation header
	if (isCompact) {
		lines.push(...renderCompactOrientation(model));
	} else {
		lines.push(...renderOrientationHeader(model));
	}

	lines.push('');

	// 2. Primary work area (with optional loading)
	const loading = model.loading;
	if (loading && loading.operationId !== '') {
		lines.push(...renderLoadingArea(loading));
		lines.push('');
	}

	lines.push(...renderPrimaryArea(model, options));

	lines.push('');

	// 3. Context rail
	const contextLines = renderContextRail(model);
	if (contextLines.length > 0) {
		lines.push(divider('─', 30));
		lines.push(...contextLines);
		lines.push('');
	}

	// 4. Action area
	const actionLines = renderActionArea(model, options);
	if (actionLines.length > 0) {
		lines.push(divider('─', 30));
		lines.push(...actionLines);
		lines.push('');
	}

	// 5. Feedback area
	const feedbackLines = renderFeedbackArea(model);
	if (feedbackLines.length > 0) {
		lines.push(divider('─', 30));
		lines.push(...feedbackLines);
		lines.push('');
	}

	// 6. Command input
	lines.push(...renderCommandInput(model));

	// 7. Focus indicator
	lines.push(...renderFocusIndicator(model.focus));

	return lines;
}

// ---------------------------------------------------------------------------
// Individual content renderers for each view kind
// ---------------------------------------------------------------------------

/**
 * Render startup/first-run content.
 */
export function renderStartupContent(model: TuiWorkbenchViewModel): string[] {
	const lines: string[] = [];

	lines.push('LOGOS Engine');
	lines.push('');
	if (model.viewKind === 'first_run') {
		lines.push('Workspace is not initialized.');
		lines.push('');
		lines.push('Run /init to initialize a LOGOS workspace.');
		lines.push('Run /help to see available commands.');
	} else {
		lines.push('Welcome back.');
		lines.push('');
		if (model.primary.content.length > 0) {
			lines.push(...model.primary.content);
		} else {
			lines.push('Run /status to review workspace state.');
			lines.push('Run /continue to advance intake.');
		}
	}

	return lines;
}

/**
 * Render help content from messages.
 */
export function renderHelpContent(
	messages: string[],
	_model: TuiWorkbenchViewModel,
): string[] {
	const lines: string[] = [];

	lines.push('LOGOS Engine — TUI slash commands:');
	lines.push('');

	// Group by category
	const categories: Record<string, string[]> = {
		Configuration: [],
		'Core Operations': [],
		'Diagnostics & Validation': [],
		Navigation: [],
		'Proposal & Decision Review': [],
	};

	for (const msg of messages) {
		const trimmed = msg.trim();
		if (trimmed.startsWith('/init')) categories['Core Operations']?.push(msg);
		else if (trimmed.startsWith('/generate'))
			categories['Core Operations']?.push(msg);
		else if (trimmed.startsWith('/diagnose'))
			categories['Diagnostics & Validation']?.push(msg);
		else if (trimmed.startsWith('/validate'))
			categories['Diagnostics & Validation']?.push(msg);
		else if (trimmed.startsWith('/proposals'))
			categories['Proposal & Decision Review']?.push(msg);
		else if (trimmed.startsWith('/decisions'))
			categories['Proposal & Decision Review']?.push(msg);
		else if (trimmed.startsWith('/config ai'))
			categories.Configuration?.push(msg);
		else if (
			trimmed.startsWith('/status') ||
			trimmed.startsWith('/help') ||
			trimmed.startsWith('/exit') ||
			trimmed.startsWith('/continue') ||
			trimmed.startsWith('/graph') ||
			trimmed.startsWith('/executive')
		) {
			categories.Navigation?.push(msg);
		} else if (trimmed) {
			lines.push(msg);
		}
	}

	for (const [cat, msgs] of Object.entries(categories)) {
		if (msgs.length === 0) continue;
		// Skip empty categories
		if (cat === '--empty--') continue;
	}

	// Show commands grouped
	const readOnlyLabelV = formatLabel('read_only');
	const mutatingLabelV = ' [mutating]';

	for (const [cat, msgs] of Object.entries(categories)) {
		if (msgs.length === 0) continue;

		// Determine if category is read-only
		let categoryLabel = '';
		if (cat === 'Navigation' || cat === 'Diagnostics & Validation') {
			categoryLabel = ` ${readOnlyLabelV}`;
		} else if (cat === 'Core Operations' || cat === 'Configuration') {
			categoryLabel = ` ${readOnlyLabelV}${mutatingLabelV}`;
		}

		lines.push(`${cat}:${categoryLabel}`);
		for (const msg of msgs.slice(0, 8)) {
			const trimmedMsg = msg.trim();
			// Mark mutating commands
			let actionLabel = '';
			if (
				trimmedMsg.includes('--confirm') ||
				trimmedMsg.includes('accept') ||
				trimmedMsg.includes('revise') ||
				trimmedMsg.includes('supersede')
			) {
				actionLabel = ` ${mutatingLabelV}`;
			}
			lines.push(`  ${trimmedMsg}${actionLabel}`);
		}
		lines.push('');
	}

	lines.push('Notes:');
	lines.push(`  ${readOnlyLabelV} = Read-only (no filesystem writes)`);
	lines.push(
		`  ${mutatingLabelV} = Mutating (may write files or change state)`,
	);
	lines.push('  Non-slash input is free-form conversational intake.');
	lines.push('  Run /status to review workspace state at any time.');

	return lines;
}

// ---------------------------------------------------------------------------
// Recovery view content builder
// ---------------------------------------------------------------------------

/**
 * Build recovery view content for a given error scenario.
 */
export function renderRecoveryContent(opts: {
	errorType: string;
	whatFailed: string;
	preservedState: string;
	retrySafe: boolean;
	recoveryHints: string[];
}): string[] {
	const lines: string[] = [];

	lines.push(`${formatLabel('failed')} An error occurred.`);
	lines.push('');
	lines.push(`Error type: ${opts.errorType}`);
	lines.push(`What failed: ${opts.whatFailed}`);
	lines.push(`State preserved: ${opts.preservedState}`);
	lines.push('');

	if (opts.retrySafe) {
		lines.push('Retry is safe.');
	} else {
		lines.push('Retry may not be safe — run /status first.');
	}

	lines.push('');
	lines.push('Recovery actions:');
	for (const hint of opts.recoveryHints.slice(0, 5)) {
		lines.push(`  - ${hint}`);
	}

	lines.push('');
	lines.push('The shell is still running. Run /help for available commands.');

	return lines;
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

export { formatLabel };
