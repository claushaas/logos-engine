/**
 * TUI Workbench Model — pure view types, state labels, focus, loading, and helpers.
 *
 * Phase 5: TUI Workbench Redesign — Outcome 1 (TUI view model).
 *
 * All types and functions are pure: no side effects, no provider calls,
 * no filesystem access, no network. The model is serializable and testable.
 *
 * This module defines the structured state that the workbench renderer
 * consumes. It does NOT render UI.
 */

import type { LogosDiagnostic } from '../runtime/diagnostics.js';
import type { ParsedInput } from './types.js';

// ---------------------------------------------------------------------------
// View kinds
// ---------------------------------------------------------------------------

export const TUI_VIEW_KINDS = [
	'startup',
	'first_run',
	'status',
	'intake',
	'proposal_review',
	'proposal_detail',
	'decision_detail',
	'generation_confirmation',
	'generation_report',
	'executive_compile_report',
	'diagnostics',
	'validation',
	'provider_config',
	'root_config',
	'output_browser',
	'help',
	'recovery',
] as const;

export type TuiViewKind = (typeof TUI_VIEW_KINDS)[number];

// ---------------------------------------------------------------------------
// Focus targets
// ---------------------------------------------------------------------------

export const TUI_FOCUS_TARGETS = [
	'command_input',
	'confirmation',
	'action_area',
	'context_rail',
	'primary_report',
	'recovery_action',
	'none',
] as const;

export type TuiFocusTarget = (typeof TUI_FOCUS_TARGETS)[number];

// ---------------------------------------------------------------------------
// Viewport modes
// ---------------------------------------------------------------------------

export type TuiViewportMode = 'compact' | 'standard' | 'wide';

/** Viewport breakpoints for terminal width classification */
export const VIEWPORT_BREAKPOINTS = {
	/** Below this width is compact */
	compactMax: 79,
	/** Below this width is standard; above is wide */
	wideMin: 120,
} as const;

/**
 * Determine viewport mode from terminal width.
 * Pure function: no side effects, testable.
 */
export function getViewportMode(width?: number): TuiViewportMode {
	if (width === undefined || width <= VIEWPORT_BREAKPOINTS.compactMax) {
		return 'compact';
	}
	if (width < VIEWPORT_BREAKPOINTS.wideMin) {
		return 'standard';
	}
	return 'wide';
}

// ---------------------------------------------------------------------------
// State labels
// ---------------------------------------------------------------------------

export const STATE_LABEL_KINDS = [
	'proposed',
	'confirmed',
	'assumed',
	'unknown',
	'incomplete',
	'blocked',
	'stale',
	'current',
	'canonical',
	'derived',
	'low_confidence',
	'partial',
	'failed',
	'warning',
	'ready',
	'read_only',
	'dry_run',
	'provider_disabled',
	'provider_unconfigured',
	'provider_ready',
] as const;

export type StateLabelKind = (typeof STATE_LABEL_KINDS)[number];

/** Full state label with display text and kind */
export interface TuiStateLabel {
	kind: StateLabelKind;
	/** Primary display text, e.g. "[proposed]" */
	text: string;
	/** Optional expanded label for wider contexts */
	description?: string | undefined;
}

/** All state labels in text form, keyed by kind */
export const STATE_LABEL_MAP: Record<StateLabelKind, TuiStateLabel> = {
	assumed: {
		description: 'Accepted as a working assumption; requires validation',
		kind: 'assumed',
		text: '[assumed]',
	},
	blocked: {
		description: 'Blocked by unresolved dependencies or issues',
		kind: 'blocked',
		text: '[blocked]',
	},
	canonical: {
		description: 'Primary human-readable generated output',
		kind: 'canonical',
		text: '[canonical]',
	},
	confirmed: {
		description: 'User-confirmed state',
		kind: 'confirmed',
		text: '[confirmed]',
	},
	current: {
		description: 'Currently active or up-to-date',
		kind: 'current',
		text: '[current]',
	},
	derived: {
		description: 'Regenerated from canonical source; not source of truth',
		kind: 'derived',
		text: '[derived]',
	},
	dry_run: {
		description: 'No files were written; plan only',
		kind: 'dry_run',
		text: '[dry-run]',
	},
	failed: {
		description: 'The operation did not complete successfully',
		kind: 'failed',
		text: '[failed]',
	},
	incomplete: {
		description: 'Missing required inputs or outputs',
		kind: 'incomplete',
		text: '[incomplete]',
	},
	low_confidence: {
		description: 'AI interpretation with low confidence; requires review',
		kind: 'low_confidence',
		text: '[low confidence]',
	},
	partial: {
		description: 'Some results succeeded, some did not',
		kind: 'partial',
		text: '[partial]',
	},
	proposed: {
		description: 'AI-derived or user-suggested; not yet confirmed',
		kind: 'proposed',
		text: '[proposed]',
	},
	provider_disabled: {
		description: 'AI provider is disabled',
		kind: 'provider_disabled',
		text: '[provider-disabled]',
	},
	provider_ready: {
		description: 'AI provider is configured and ready',
		kind: 'provider_ready',
		text: '[provider-ready]',
	},
	provider_unconfigured: {
		description: 'No AI provider configured',
		kind: 'provider_unconfigured',
		text: '[provider-unconfigured]',
	},
	read_only: {
		description: 'This operation does not modify any state',
		kind: 'read_only',
		text: '[read-only]',
	},
	ready: {
		description: 'Ready for the next action',
		kind: 'ready',
		text: '[ready]',
	},
	stale: {
		description: 'Source state has changed; regeneration recommended',
		kind: 'stale',
		text: '[stale]',
	},
	unknown: {
		description:
			'Valid unknown state; paired with an open question or next action',
		kind: 'unknown',
		text: '[unknown]',
	},
	warning: {
		description: 'Proceed with awareness of the noted issue',
		kind: 'warning',
		text: '[warning]',
	},
};

/**
 * Create a state label from a kind. Pure, deterministic.
 */
export function createStateLabel(kind: StateLabelKind): TuiStateLabel {
	return (
		STATE_LABEL_MAP[kind] ?? { description: undefined, kind, text: `[${kind}]` }
	);
}

/**
 * Get display text for a state label kind.
 */
export function stateLabelText(kind: StateLabelKind): string {
	return STATE_LABEL_MAP[kind]?.text ?? `[${kind}]`;
}

/**
 * Check if a label is blocking (i.e., requires user action before continuing).
 */
export function isBlockingLabel(kind: StateLabelKind): boolean {
	return kind === 'blocked' || kind === 'failed';
}

/**
 * Check if a label is mutable (i.e., the operation modifies state).
 */
export function isMutatingLabel(kind: StateLabelKind): boolean {
	return kind === 'ready' || kind === 'current' || kind === 'confirmed';
}

// ---------------------------------------------------------------------------
// Loading/operation model
// ---------------------------------------------------------------------------

export const LOADING_OPERATION_KINDS = [
	'provider_call',
	'intake_interpretation',
	'generation',
	'validation',
	'diagnostics',
	'executive_compile',
	'security_check',
	'package_smoke',
	'migration',
	'backup',
	'restore',
	'unknown',
] as const;

export type LoadingOperationKind = (typeof LOADING_OPERATION_KINDS)[number];

export interface TuiLoadingModel {
	/** Operation identifier */
	operationId: string;
	/** What kind of operation is running */
	operationKind: LoadingOperationKind;
	/** Human-readable title */
	title: string;
	/** Current phase description */
	phase: string;
	/** Whether the operation is read-only */
	readOnly: boolean;
	/** Whether the operation can be cancelled */
	cancellable: boolean;
	/** ISO timestamp of operation start */
	startedAt: string;
	/** Additional status text */
	statusText: string;
	/** Associated diagnostics */
	diagnostics: LogosDiagnostic[];
}

/**
 * Create a loading model. Pure factory.
 */
export function createLoadingModel(opts: {
	operationId?: string | undefined;
	operationKind: LoadingOperationKind;
	title: string;
	phase?: string | undefined;
	readOnly?: boolean | undefined;
	cancellable?: boolean | undefined;
	startedAt?: string | undefined;
	statusText?: string | undefined;
	diagnostics?: LogosDiagnostic[] | undefined;
}): TuiLoadingModel {
	return {
		cancellable: opts.cancellable ?? false,
		diagnostics: opts.diagnostics ?? [],
		operationId: opts.operationId ?? `op-${Date.now()}`,
		operationKind: opts.operationKind,
		phase: opts.phase ?? '',
		readOnly: opts.readOnly ?? true,
		startedAt: opts.startedAt ?? new Date().toISOString(),
		statusText: opts.statusText ?? 'Pending...',
		title: opts.title,
	};
}

/**
 * A loading model that is empty/null.
 */
export function createEmptyLoadingModel(): TuiLoadingModel {
	return {
		cancellable: false,
		diagnostics: [],
		operationId: '',
		operationKind: 'unknown',
		phase: '',
		readOnly: true,
		startedAt: '',
		statusText: 'Idle',
		title: '',
	};
}

/**
 * Check whether a loading model represents an active operation.
 */
export function isLoadingActive(loading: TuiLoadingModel): boolean {
	return loading.operationId !== '' && loading.statusText !== 'Idle';
}

// ---------------------------------------------------------------------------
// Focus model
// ---------------------------------------------------------------------------

export interface TuiFocusModel {
	/** Current focus target */
	target: TuiFocusTarget;
	/** Whether the command input is blocked (confirmation active) */
	inputBlocked: boolean;
	/** Whether focus is currently in a modal state */
	modalActive: boolean;
	/** Label for the current focus target (for accessibility) */
	focusLabel: string;
}

/** Ordered list of focusable targets */
export const FOCUSABLE_TARGETS: TuiFocusTarget[] = [
	'command_input',
	'action_area',
	'context_rail',
	'primary_report',
	'confirmation',
	'recovery_action',
];

/**
 * Create default focus model (focus on command input, no block, no modal).
 */
export function createDefaultFocusModel(opts?: {
	inputBlocked?: boolean | undefined;
	modalActive?: boolean | undefined;
}): TuiFocusModel {
	const inputBlocked = opts?.inputBlocked ?? false;
	return {
		focusLabel: inputBlocked ? 'Focus: confirmation' : 'Focus: command input',
		inputBlocked,
		modalActive: opts?.modalActive ?? inputBlocked,
		target: inputBlocked ? 'confirmation' : 'command_input',
	};
}

/**
 * Move focus to the next focusable area.
 */
export function moveFocusNext(
	current: TuiFocusModel,
	availableTargets?: TuiFocusTarget[],
): TuiFocusModel {
	const targets = availableTargets ?? FOCUSABLE_TARGETS;
	const idx = targets.indexOf(current.target);
	const nextIdx = idx < 0 ? 0 : (idx + 1) % targets.length;
	const nextTarget = targets[nextIdx] ?? 'command_input';
	return { ...current, focusLabel: `Focus: ${nextTarget}`, target: nextTarget };
}

/**
 * Move focus to the previous focusable area.
 */
export function moveFocusPrevious(
	current: TuiFocusModel,
	availableTargets?: TuiFocusTarget[],
): TuiFocusModel {
	const targets = availableTargets ?? FOCUSABLE_TARGETS;
	const idx = targets.indexOf(current.target);
	const prevIdx =
		idx < 0 ? targets.length - 1 : (idx - 1 + targets.length) % targets.length;
	const prevTarget = targets[prevIdx] ?? 'command_input';
	return { ...current, focusLabel: `Focus: ${prevTarget}`, target: prevTarget };
}

/**
 * Set focus on a specific target.
 */
export function setFocusTarget(
	current: TuiFocusModel,
	target: TuiFocusTarget,
): TuiFocusModel {
	return { ...current, focusLabel: `Focus: ${target}`, target };
}

// ---------------------------------------------------------------------------
// Orientation model
// ---------------------------------------------------------------------------

export interface TuiOrientationModel {
	/** Repository name or path display */
	repository: string;
	/** Workspace initialization state */
	workspaceStatus: string;
	/** Active profile id */
	activeProfileId: string;
	/** Documentation root */
	documentationRoot: string;
	/** Provider status text */
	providerStatus: string;
	/** Current view title */
	currentView: string;
	/** Whether a mutation is pending or active */
	isMutating: boolean;
	/** Whether this is a dry-run */
	isDryRun: boolean;
	/** Whether this is read-only */
	isReadOnly: boolean;
}

// ---------------------------------------------------------------------------
// Context model
// ---------------------------------------------------------------------------

export interface TuiContextModel {
	/** Active phase/document if known */
	activePhase?: string | undefined;
	/** Open questions count */
	openQuestionCount: number;
	/** Assumptions count */
	assumptionCount: number;
	/** Risks count */
	riskCount: number;
	/** Validation blockers count */
	validationBlockerCount: number;
	/** Stale outputs count */
	staleOutputCount: number;
	/** Provider status */
	providerStatusText: string;
	/** Recent turn/proposal summary */
	proposalCount: number;
	/** Whether context is available */
	available: boolean;
}

// ---------------------------------------------------------------------------
// Primary panel model
// ---------------------------------------------------------------------------

export interface TuiPrimaryPanelModel {
	/** View kind */
	viewKind: TuiViewKind;
	/** Title for the primary area */
	title: string;
	/** Primary content lines */
	content: string[];
	/** Structured report data (for report views) */
	report?: TuiReportData | undefined;
	/** State labels for this view */
	stateLabels: TuiStateLabel[];
	/** Summary line */
	summary?: string | undefined;
}

// ---------------------------------------------------------------------------
// Context rail model
// ---------------------------------------------------------------------------

export interface TuiContextRailModel {
	/** Whether context rail is visible (suppressed in compact mode) */
	visible: boolean;
	/** Summary items */
	items: TuiContextRailItem[];
}

export interface TuiContextRailItem {
	/** Label */
	label: string;
	/** Value text */
	value: string;
	/** Optional state label */
	stateLabel?: TuiStateLabel | undefined;
}

// ---------------------------------------------------------------------------
// Action area model
// ---------------------------------------------------------------------------

export interface TuiActionAreaModel {
	/** Available command actions */
	actions: TuiActionItem[];
}

export interface TuiActionItem {
	/** Display label (e.g., "/validate") */
	label: string;
	/** Short description */
	description: string;
	/** Whether this action is read-only */
	readOnly: boolean;
	/** Whether this action is mutating */
	mutating: boolean;
	/** Whether confirmation is required */
	requiresConfirmation: boolean;
	/** Category (e.g., "diagnostics", "generation") */
	category?: string | undefined;
	/** Whether this is the recommended next action */
	recommended: boolean;
}

// ---------------------------------------------------------------------------
// Feedback model
// ---------------------------------------------------------------------------

export interface TuiFeedbackModel {
	/** Feedback messages */
	messages: TuiFeedbackMessage[];
	/** Overall status kind from command */
	statusKind: 'success' | 'info' | 'warning' | 'error' | 'idle';
}

export interface TuiFeedbackMessage {
	/** Message text */
	text: string;
	/** Severity */
	severity: 'success' | 'info' | 'warning' | 'error';
	/** Optional state label kind */
	labelKind?: StateLabelKind | undefined;
}

// ---------------------------------------------------------------------------
// Command input model
// ---------------------------------------------------------------------------

export interface TuiCommandInputModel {
	/** Whether command input is visible */
	visible: boolean;
	/** Whether command input is disabled */
	disabled: boolean;
	/** Reason for disabled state */
	disabledReason?: string | undefined;
	/** Placeholder text */
	placeholder: string;
}

// ---------------------------------------------------------------------------
// Report data (structured)
// ---------------------------------------------------------------------------

export interface TuiReportData {
	/** Overall summary */
	summary: string;
	/** Grouped findings by category/severity */
	groups: TuiReportGroup[];
	/** Total counts */
	counts: TuiReportCounts;
	/** Next actions */
	nextActions: string[];
	/** Canonical/derived classification */
	outputType?: 'canonical' | 'derived' | 'report' | undefined;
}

export interface TuiReportGroup {
	/** Group label */
	label: string;
	/** Group severity */
	severity: 'critical' | 'error' | 'warning' | 'info' | 'success';
	/** Items in group */
	items: TuiReportItem[];
	/** Optional reason/summary for group */
	reason?: string | undefined;
}

export interface TuiReportItem {
	/** Item text */
	text: string;
	/** Optional path */
	path?: string | undefined;
	/** Optional state label kind */
	labelKind?: StateLabelKind | undefined;
	/** Optional detail */
	detail?: string | undefined;
}

export interface TuiReportCounts {
	total: number;
	critical: number;
	error: number;
	warning: number;
	info: number;
	success: number;
}

// ---------------------------------------------------------------------------
// Workbench view model
// ---------------------------------------------------------------------------

export interface TuiWorkbenchViewModel {
	viewKind: TuiViewKind;
	title: string;
	orientation: TuiOrientationModel;
	context: TuiContextModel;
	primary: TuiPrimaryPanelModel;
	contextRail?: TuiContextRailModel | undefined;
	actionArea: TuiActionAreaModel;
	feedback: TuiFeedbackModel;
	commandInput: TuiCommandInputModel;
	focus: TuiFocusModel;
	loading?: TuiLoadingModel | undefined;
	/** Viewport mode */
	viewportMode: TuiViewportMode;
}

// ---------------------------------------------------------------------------
// View model factory helpers
// ---------------------------------------------------------------------------

export interface CreateWorkbenchViewModelOptions {
	/** Project context data */
	projectRoot: string;
	documentationRoot: string;
	activeProfileId: string;
	providerStatusText: string;
	workspaceStatus: string;

	/** View data */
	viewKind: TuiViewKind;
	title: string;
	/** Display content lines from command/service output */
	content?: string[] | undefined;
	/** Structured report data */
	report?: TuiReportData | undefined;

	/** State labels for primary view */
	stateLabels?: TuiStateLabel[] | undefined;

	/** Feedback data */
	feedbackMessages?: TuiFeedbackMessage[] | undefined;
	feedbackStatusKind?: 'success' | 'info' | 'warning' | 'error' | 'idle';

	/** Action items */
	actions?: TuiActionItem[] | undefined;

	/** Context data */
	contextItems?: TuiContextRailItem[] | undefined;
	openQuestionCount?: number;
	assumptionCount?: number;
	riskCount?: number;
	validationBlockerCount?: number;
	staleOutputCount?: number;
	proposalCount?: number;

	/** Focus and input */
	inputBlocked?: boolean | undefined;
	modalActive?: boolean | undefined;
	focusTarget?: TuiFocusTarget | undefined;

	/** Loading */
	loading?: TuiLoadingModel | undefined;

	/** Viewport */
	width?: number | undefined;

	/** Whether operation is mutating/read-only/dry-run */
	isMutating?: boolean | undefined;
	isDryRun?: boolean | undefined;
	isReadOnly?: boolean | undefined;

	/** Primary summary */
	summary?: string | undefined;
}

/**
 * Create a full workbench view model from input options.
 * Pure function, no side effects.
 */
export function createWorkbenchViewModel(
	opts: CreateWorkbenchViewModelOptions,
): TuiWorkbenchViewModel {
	const viewportMode = getViewportMode(opts.width);
	const inputBlocked = opts.inputBlocked ?? false;
	const modalActive = opts.modalActive ?? inputBlocked;

	const orientation: TuiOrientationModel = {
		activeProfileId: opts.activeProfileId,
		currentView: opts.title,
		documentationRoot: opts.documentationRoot,
		isDryRun: opts.isDryRun ?? false,
		isMutating: opts.isMutating ?? false,
		isReadOnly: opts.isReadOnly ?? true,
		providerStatus: opts.providerStatusText,
		repository: opts.projectRoot,
		workspaceStatus: opts.workspaceStatus,
	};

	const context: TuiContextModel = {
		assumptionCount: opts.assumptionCount ?? 0,
		available: (opts.contextItems?.length ?? 0) > 0,
		openQuestionCount: opts.openQuestionCount ?? 0,
		proposalCount: opts.proposalCount ?? 0,
		providerStatusText: opts.providerStatusText,
		riskCount: opts.riskCount ?? 0,
		staleOutputCount: opts.staleOutputCount ?? 0,
		validationBlockerCount: opts.validationBlockerCount ?? 0,
	};

	const primary: TuiPrimaryPanelModel = {
		content: opts.content ?? [],
		report: opts.report,
		stateLabels: opts.stateLabels ?? [],
		summary: opts.summary,
		title: opts.title,
		viewKind: opts.viewKind,
	};

	const contextRail: TuiContextRailModel | undefined =
		opts.contextItems && opts.contextItems.length > 0
			? {
					items: opts.contextItems,
					visible: viewportMode !== 'compact',
				}
			: undefined;

	const actionArea: TuiActionAreaModel = {
		actions: opts.actions ?? [],
	};

	const feedback: TuiFeedbackModel = {
		messages: opts.feedbackMessages ?? [],
		statusKind: opts.feedbackStatusKind ?? 'idle',
	};

	const commandInput: TuiCommandInputModel = {
		disabled: inputBlocked,
		disabledReason: inputBlocked ? 'Confirmation is pending' : undefined,
		placeholder: inputBlocked
			? 'Input blocked — resolve confirmation first'
			: 'Type a command (/help) or free-form intake...',
		visible: true,
	};

	const focus = createDefaultFocusModel({ inputBlocked, modalActive });
	if (opts.focusTarget) {
		focus.target = opts.focusTarget;
		focus.focusLabel = `Focus: ${opts.focusTarget}`;
	}

	return {
		actionArea,
		commandInput,
		context,
		contextRail,
		feedback,
		focus,
		loading: opts.loading,
		orientation,
		primary,
		title: opts.title,
		viewKind: opts.viewKind,
		viewportMode,
	};
}

// ---------------------------------------------------------------------------
// View kind from command mapping
// ---------------------------------------------------------------------------

/**
 * Map a parsed slash command to its expected view kind.
 * Pure function. Returns the view kind that the workbench should display
 * after this command is processed.
 */
export function commandToViewKind(
	parsed:
		| ParsedInput
		| { kind: 'slash'; name: string; args: string[]; raw: string }
		| { kind: 'free-form'; text: string },
	_isError?: boolean,
): TuiViewKind {
	if (parsed.kind === 'empty') {
		return 'status';
	}

	if (parsed.kind === 'free-form') {
		return 'intake';
	}

	if ('name' in parsed) {
		const { name, args } = parsed;

		if (name === 'config' && args[0] === 'ai') {
			return 'provider_config';
		}

		switch (name) {
			case 'help':
				return 'help';
			case 'status':
				return 'status';
			case 'exit':
				return 'status';
			case 'init':
				return args.includes('--confirm') || args.includes('--dry-run')
					? 'startup'
					: 'first_run';
			case 'continue':
				return 'intake';
			case 'generate':
				if (args.includes('--confirm') || args.includes('--dry-run')) {
					return 'generation_report';
				}
				return 'generation_confirmation';
			case 'diagnose':
				return 'diagnostics';
			case 'validate':
				return 'validation';
			case 'graph':
				return 'status';
			case 'executive':
				return 'executive_compile_report';
			case 'proposals':
				return 'proposal_review';
			case 'decisions':
				return 'decision_detail';
			default:
				return 'recovery';
		}
	}

	return 'status';
}

// ---------------------------------------------------------------------------
// Default actions per view kind
// ---------------------------------------------------------------------------

/**
 * Get default action items for a view kind. These are the common
 * next-available slash commands and review actions.
 */
export function getDefaultActionsForView(
	viewKind: TuiViewKind,
	options?: {
		workspaceInitialized?: boolean | undefined;
		providerConfigured?: boolean | undefined;
	},
): TuiActionItem[] {
	const _initialized = options?.workspaceInitialized ?? true;
	const _providerOk = options?.providerConfigured ?? false;

	const common: TuiActionItem[] = [
		{
			category: 'navigation',
			description: 'Show current workspace status',
			label: '/status',
			mutating: false,
			readOnly: true,
			recommended: false,
			requiresConfirmation: false,
		},
		{
			category: 'navigation',
			description: 'Show available commands',
			label: '/help',
			mutating: false,
			readOnly: true,
			recommended: false,
			requiresConfirmation: false,
		},
	];

	const byKind: Partial<Record<TuiViewKind, TuiActionItem[]>> = {
		decision_detail: [
			...common,
			{
				category: 'review',
				description: 'List confirmed decisions',
				label: '/decisions list',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
			{
				category: 'review',
				description: 'Show affected documents',
				label: '/decisions affected <id>',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
		],
		diagnostics: [
			...common,
			{
				category: 'diagnostics',
				description: 'Re-run diagnostic analysis',
				label: '/diagnose',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'diagnostics',
				description: 'Run dry-run diagnostics without writes',
				label: '/diagnose --dry-run',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		executive_compile_report: [
			...common,
			{
				category: 'generation',
				description: 'Re-run executive compilation preflight',
				label: '/executive compile',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'generation',
				description: 'Compile and execute executive outputs',
				label: '/executive compile --confirm',
				mutating: true,
				readOnly: false,
				recommended: false,
				requiresConfirmation: true,
			},
		],
		first_run: [
			{
				category: 'init',
				description: 'Plan workspace initialization',
				label: '/init',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'init',
				description: 'Initialize workspace with defaults',
				label: '/init --confirm',
				mutating: true,
				readOnly: false,
				recommended: false,
				requiresConfirmation: true,
			},
			{
				category: 'navigation',
				description: 'Show available commands',
				label: '/help',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		generation_confirmation: [
			...common,
			{
				category: 'generation',
				description: 'Execute generation with writes',
				label: '/generate --confirm',
				mutating: true,
				readOnly: false,
				recommended: true,
				requiresConfirmation: true,
			},
			{
				category: 'generation',
				description: 'Plan generation without writes',
				label: '/generate --dry-run',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		generation_report: [
			...common,
			{
				category: 'generation',
				description: 'Re-run generation',
				label: '/generate',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'diagnostics',
				description: 'Run diagnostics on generated output',
				label: '/diagnose',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		help: [
			{
				category: 'navigation',
				description: 'Show current workspace status',
				label: '/status',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'navigation',
				description: 'Return to prior context',
				label: '/status',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		intake: [
			...common,
			{
				category: 'intake',
				description: 'Continue intake with next questions',
				label: '/continue',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'intake',
				description: 'Type naturally to capture project context',
				label: '<free-form text>',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		output_browser: [...common],
		proposal_detail: [
			...common,
			{
				category: 'review',
				description: 'List all proposals',
				label: '/proposals list',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
			{
				category: 'review',
				description: 'Accept this proposal',
				label: '/proposals accept <id>',
				mutating: true,
				readOnly: false,
				recommended: true,
				requiresConfirmation: true,
			},
		],
		proposal_review: [
			...common,
			{
				category: 'review',
				description: 'Inspect a specific proposal',
				label: '/proposals show <id>',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'review',
				description: 'Accept proposal (creates confirmed record)',
				label: '/proposals accept <id>',
				mutating: true,
				readOnly: false,
				recommended: false,
				requiresConfirmation: true,
			},
		],
		provider_config: [
			...common,
			{
				category: 'config',
				description: 'Check provider status',
				label: '/config ai status',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'config',
				description: 'Test provider connectivity',
				label: '/config ai test',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		recovery: [
			{
				category: 'recovery',
				description: 'Show current workspace status',
				label: '/status',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'recovery',
				description: 'Show available commands',
				label: '/help',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		root_config: [...common],
		startup: [
			...common,
			{
				category: 'intake',
				description: 'Continue intake with next questions',
				label: '/continue',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'diagnostics',
				description: 'Run diagnostic analysis',
				label: '/diagnose',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
			{
				category: 'generation',
				description: 'Plan document generation',
				label: '/generate',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		status: [
			...common,
			{
				category: 'diagnostics',
				description: 'Run diagnostic analysis',
				label: '/diagnose',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'validation',
				description: 'Run validation checks',
				label: '/validate',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
			{
				category: 'generation',
				description: 'Plan document generation',
				label: '/generate',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		validation: [
			...common,
			{
				category: 'validation',
				description: 'Re-run validation',
				label: '/validate',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'diagnostics',
				description: 'Run diagnostic analysis',
				label: '/diagnose',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
	};

	return byKind[viewKind] ?? common;
}

// ---------------------------------------------------------------------------
// Context rail items builder
// ---------------------------------------------------------------------------

/**
 * Build context rail items from workspace summary data.
 */
export function buildContextRailItems(opts: {
	openQuestionCount?: number | undefined;
	assumptionCount?: number | undefined;
	riskCount?: number | undefined;
	validationBlockerCount?: number | undefined;
	staleOutputCount?: number | undefined;
	proposalCount?: number | undefined;
	providerStatusText?: string | undefined;
	activePhase?: string | undefined;
}): TuiContextRailItem[] {
	const items: TuiContextRailItem[] = [];

	if (opts.activePhase) {
		items.push({ label: 'Phase', value: opts.activePhase });
	}

	if (opts.providerStatusText) {
		items.push({ label: 'Provider', value: opts.providerStatusText });
	}

	if (opts.openQuestionCount !== undefined) {
		items.push({
			label: 'Open Questions',
			stateLabel:
				opts.openQuestionCount > 0 ? createStateLabel('incomplete') : undefined,
			value: String(opts.openQuestionCount),
		});
	}

	if (opts.assumptionCount !== undefined) {
		items.push({
			label: 'Assumptions',
			stateLabel:
				opts.assumptionCount > 0 ? createStateLabel('assumed') : undefined,
			value: String(opts.assumptionCount),
		});
	}

	if (opts.riskCount !== undefined) {
		items.push({
			label: 'Risks',
			value: String(opts.riskCount),
		});
	}

	if (opts.proposalCount !== undefined) {
		items.push({
			label: 'Proposals',
			stateLabel:
				opts.proposalCount > 0 ? createStateLabel('proposed') : undefined,
			value: String(opts.proposalCount),
		});
	}

	if (
		opts.validationBlockerCount !== undefined &&
		opts.validationBlockerCount > 0
	) {
		items.push({
			label: 'Validation Blockers',
			stateLabel: createStateLabel('blocked'),
			value: String(opts.validationBlockerCount),
		});
	}

	if (opts.staleOutputCount !== undefined && opts.staleOutputCount > 0) {
		items.push({
			label: 'Stale Outputs',
			stateLabel: createStateLabel('stale'),
			value: String(opts.staleOutputCount),
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// Feedback message builder
// ---------------------------------------------------------------------------

/**
 * Create a feedback message from a command result.
 */
export function createFeedbackMessage(
	text: string,
	severity: 'success' | 'info' | 'warning' | 'error',
	labelKind?: StateLabelKind,
): TuiFeedbackMessage {
	return { labelKind, severity, text };
}

/**
 * Convert TUI command result messages into feedback model messages.
 */
export function messagesToFeedback(
	messages: string[],
	statusKind?: 'success' | 'info' | 'warning' | 'error' | 'idle',
): TuiFeedbackMessage[] {
	if (messages.length === 0) return [];

	// Use first few as feedback, rest as primary content
	// First line as summary, severity from statusKind
	return messages.slice(0, 3).map((text, i) => ({
		labelKind: undefined,
		severity:
			i === 0
				? statusKind === 'success'
					? 'success'
					: statusKind === 'error'
						? 'error'
						: statusKind === 'warning'
							? 'warning'
							: 'info'
				: 'info',
		text,
	}));
}
