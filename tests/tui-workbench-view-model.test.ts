/**
 * TUI Workbench View Model Tests
 *
 * Phase 5: TUI Workbench Redesign — tests for view model, state labels,
 * focus model, loading state, serializability, and view kind mapping.
 */

import { describe, expect, it } from 'vitest';
import type { ParsedInput } from '../src/tui/types.js';
import {
	buildContextRailItems,
	commandToViewKind,
	createDefaultFocusModel,
	createLoadingModel,
	createStateLabel,
	createWorkbenchViewModel,
	getDefaultActionsForView,
	getViewportMode,
	isLoadingActive,
	moveFocusNext,
	moveFocusPrevious,
	STATE_LABEL_KINDS,
	STATE_LABEL_MAP,
	setFocusTarget,
	stateLabelText,
	TUI_VIEW_KINDS,
	type TuiViewKind,
} from '../src/tui/workbench-model.js';

// ---------------------------------------------------------------------------
// Viewport mode
// ---------------------------------------------------------------------------

describe('getViewportMode', () => {
	it('returns compact for undefined width', () => {
		expect(getViewportMode()).toBe('compact');
	});

	it('returns compact for width <= 79', () => {
		expect(getViewportMode(60)).toBe('compact');
		expect(getViewportMode(79)).toBe('compact');
	});

	it('returns standard for width 80-119', () => {
		expect(getViewportMode(80)).toBe('standard');
		expect(getViewportMode(100)).toBe('standard');
		expect(getViewportMode(119)).toBe('standard');
	});

	it('returns wide for width >= 120', () => {
		expect(getViewportMode(120)).toBe('wide');
		expect(getViewportMode(200)).toBe('wide');
	});
});

// ---------------------------------------------------------------------------
// State labels
// ---------------------------------------------------------------------------

describe('state labels', () => {
	it('has labels for all kinds', () => {
		for (const kind of STATE_LABEL_KINDS) {
			const label = createStateLabel(kind);
			expect(label.kind).toBe(kind);
			expect(label.text).toBeTruthy();
			expect(label.text.startsWith('[')).toBe(true);
			expect(label.text.endsWith(']')).toBe(true);
		}
	});

	it('stateLabelText returns text', () => {
		expect(stateLabelText('proposed')).toBe('[proposed]');
		expect(stateLabelText('confirmed')).toBe('[confirmed]');
		expect(stateLabelText('assumed')).toBe('[assumed]');
		expect(stateLabelText('unknown')).toBe('[unknown]');
		expect(stateLabelText('incomplete')).toBe('[incomplete]');
		expect(stateLabelText('blocked')).toBe('[blocked]');
		expect(stateLabelText('stale')).toBe('[stale]');
		expect(stateLabelText('current')).toBe('[current]');
		expect(stateLabelText('canonical')).toBe('[canonical]');
		expect(stateLabelText('derived')).toBe('[derived]');
		expect(stateLabelText('low_confidence')).toBe('[low confidence]');
		expect(stateLabelText('partial')).toBe('[partial]');
		expect(stateLabelText('failed')).toBe('[failed]');
		expect(stateLabelText('warning')).toBe('[warning]');
		expect(stateLabelText('ready')).toBe('[ready]');
		expect(stateLabelText('read_only')).toBe('[read-only]');
		expect(stateLabelText('dry_run')).toBe('[dry-run]');
		expect(stateLabelText('provider_disabled')).toBe('[provider-disabled]');
		expect(stateLabelText('provider_unconfigured')).toBe(
			'[provider-unconfigured]',
		);
		expect(stateLabelText('provider_ready')).toBe('[provider-ready]');
	});

	it('labels are visible as text', () => {
		for (const kind of STATE_LABEL_KINDS) {
			const text = stateLabelText(kind);
			// Every text label must be non-empty and distinguishable
			expect(text.length).toBeGreaterThan(2);
			// No label is blank
			expect(text.trim()).not.toBe('');
		}
	});

	it('label text does not depend on color alone', () => {
		// All labels contain brackets for text visibility
		for (const kind of STATE_LABEL_KINDS) {
			const text = stateLabelText(kind);
			expect(text).toContain('[');
			expect(text).toContain(']');
		}
	});
});

// ---------------------------------------------------------------------------
// Focus model
// ---------------------------------------------------------------------------

describe('focus model', () => {
	it('default focus is command input', () => {
		const focus = createDefaultFocusModel();
		expect(focus.target).toBe('command_input');
		expect(focus.focusLabel).toBe('Focus: command input');
		expect(focus.inputBlocked).toBe(false);
		expect(focus.modalActive).toBe(false);
	});

	it('confirmation focus blocks input', () => {
		const focus = createDefaultFocusModel({ inputBlocked: true });
		expect(focus.target).toBe('confirmation');
		expect(focus.inputBlocked).toBe(true);
		expect(focus.modalActive).toBe(true);
		expect(focus.focusLabel).toBe('Focus: confirmation');
	});

	it('focus label is text-visible', () => {
		const focus = createDefaultFocusModel();
		expect(focus.focusLabel).toBeTruthy();
		expect(focus.focusLabel.startsWith('Focus:')).toBe(true);
	});

	it('moveFocusNext cycles through targets', () => {
		let focus = createDefaultFocusModel();
		focus = moveFocusNext(focus);
		expect(focus.target).toBe('action_area');
		focus = moveFocusNext(focus);
		expect(focus.target).toBe('context_rail');
	});

	it('moveFocusPrevious cycles backwards', () => {
		let focus = createDefaultFocusModel();
		focus = moveFocusPrevious(focus);
		expect(focus.target).toBe('recovery_action');
	});

	it('setFocusTarget changes target and label', () => {
		const focus = setFocusTarget(createDefaultFocusModel(), 'action_area');
		expect(focus.target).toBe('action_area');
		expect(focus.focusLabel).toBe('Focus: action_area');
	});
});

// ---------------------------------------------------------------------------
// Loading state model
// ---------------------------------------------------------------------------

describe('loading state', () => {
	it('createLoadingModel creates valid model', () => {
		const loading = createLoadingModel({
			operationKind: 'generation',
			title: 'Generating canonical documentation',
		});

		expect(loading.operationKind).toBe('generation');
		expect(loading.title).toBe('Generating canonical documentation');
		expect(loading.statusText).toBe('Pending...');
		expect(loading.readOnly).toBe(true);
		expect(loading.operationId).toBeTruthy();
	});

	it('createLoadingModel respects readOnly override', () => {
		const loading = createLoadingModel({
			operationKind: 'generation',
			readOnly: false,
			title: 'Writing files',
		});
		expect(loading.readOnly).toBe(false);
	});

	it('isLoadingActive detects active operations', () => {
		const active = createLoadingModel({
			operationKind: 'generation',
			title: 'Test',
		});
		expect(isLoadingActive(active)).toBe(true);

		const inactive = createLoadingModel({
			operationId: '',
			operationKind: 'unknown',
			statusText: 'Idle',
			title: '',
		});
		expect(isLoadingActive(inactive)).toBe(false);
	});

	it('loading does not imply background execution', () => {
		// The loading model is just state — it doesn't start operations
		const loading = createLoadingModel({
			operationKind: 'generation',
			title: 'Test',
		});
		expect(loading.startedAt).toBeTruthy();
		// No side effects
		expect(loading.diagnostics).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// View model creation
// ---------------------------------------------------------------------------

describe('createWorkbenchViewModel', () => {
	const defaultOpts = {
		activeProfileId: 'standard',
		documentationRoot: 'logos/',
		projectRoot: '/test/project',
		providerStatusText: 'not configured',
		title: 'Status',
		viewKind: 'status' as TuiViewKind,
		workspaceStatus: 'initialized',
	};

	it('creates a valid view model (serializable)', () => {
		const vm = createWorkbenchViewModel(defaultOpts);
		expect(vm.viewKind).toBe('status');
		expect(vm.title).toBe('Status');
		expect(vm.orientation).toBeDefined();
		expect(vm.orientation.repository).toBe('/test/project');
		expect(vm.orientation.activeProfileId).toBe('standard');
		expect(vm.orientation.documentationRoot).toBe('logos/');
		expect(vm.orientation.providerStatus).toBe('not configured');
		expect(vm.primary).toBeDefined();
		expect(vm.actionArea).toBeDefined();
		expect(vm.feedback).toBeDefined();
		expect(vm.commandInput).toBeDefined();
		expect(vm.focus).toBeDefined();

		// Must be JSON-serializable
		const serialized = JSON.parse(JSON.stringify(vm));
		expect(serialized.viewKind).toBe('status');
	});

	it('handles missing data without crashing', () => {
		const vm = createWorkbenchViewModel({
			...defaultOpts,
			activeProfileId: 'unknown',
			documentationRoot: 'logos/',
			providerStatusText: 'not configured',
			title: 'First Run',
			viewKind: 'first_run',
			workspaceStatus: 'unknown',
		});
		expect(vm.orientation.activeProfileId).toBe('unknown');
		expect(vm.orientation.workspaceStatus).toBe('unknown');
		expect(vm.primary.content).toEqual([]);
	});

	it('first_run view works', () => {
		const vm = createWorkbenchViewModel({
			...defaultOpts,
			title: 'First Run',
			viewKind: 'first_run',
			workspaceStatus: 'uninitialized',
		});
		expect(vm.viewKind).toBe('first_run');
	});

	it('recovery view works', () => {
		const vm = createWorkbenchViewModel({
			...defaultOpts,
			content: ['Unknown command'],
			feedbackMessages: [{ severity: 'error', text: 'Unknown command: /foo' }],
			feedbackStatusKind: 'error',
			stateLabels: [STATE_LABEL_MAP.failed],
			title: 'Recovery',
			viewKind: 'recovery',
		});
		expect(vm.viewKind).toBe('recovery');
		expect(vm.feedback.statusKind).toBe('error');
	});

	it('inputBlocked sets disabled command input', () => {
		const vm = createWorkbenchViewModel({
			...defaultOpts,
			inputBlocked: true,
		});
		expect(vm.commandInput.disabled).toBe(true);
		expect(vm.commandInput.disabledReason).toBeTruthy();
	});

	it('compact viewport suppresses context rail visibility', () => {
		const vm = createWorkbenchViewModel({
			...defaultOpts,
			contextItems: [{ label: 'Phase', value: '01-foundation' }],
			width: 60,
		});
		expect(vm.viewportMode).toBe('compact');
		// Context rail may exist but must not be visible in compact mode
		if (vm.contextRail) {
			expect(vm.contextRail.visible).toBe(false);
		}
	});

	it('standard/wide viewport shows context rail', () => {
		const vm = createWorkbenchViewModel({
			...defaultOpts,
			contextItems: [{ label: 'Phase', value: '01-foundation' }],
			width: 100,
		});
		expect(vm.viewportMode).toBe('standard');
		expect(vm.contextRail).toBeDefined();
		expect(vm.contextRail?.visible).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// View kind mapping from commands
// ---------------------------------------------------------------------------

describe('commandToViewKind', () => {
	function slash(name: string, args: string[]): ParsedInput {
		return { args, kind: 'slash', name, raw: `/${name} ${args.join(' ')}` };
	}

	it('maps /help to help', () => {
		expect(commandToViewKind(slash('help', []))).toBe('help');
	});

	it('maps /status to status', () => {
		expect(commandToViewKind(slash('status', []))).toBe('status');
	});

	it('maps /init to first_run', () => {
		expect(commandToViewKind(slash('init', []))).toBe('first_run');
	});

	it('maps /generate to generation_confirmation', () => {
		expect(commandToViewKind(slash('generate', []))).toBe(
			'generation_confirmation',
		);
	});

	it('maps /generate --dry-run to generation_report', () => {
		expect(commandToViewKind(slash('generate', ['--dry-run']))).toBe(
			'generation_report',
		);
	});

	it('maps /generate --confirm to generation_report', () => {
		expect(commandToViewKind(slash('generate', ['--confirm']))).toBe(
			'generation_report',
		);
	});

	it('maps /diagnose to diagnostics', () => {
		expect(commandToViewKind(slash('diagnose', []))).toBe('diagnostics');
	});

	it('maps /validate to validation', () => {
		expect(commandToViewKind(slash('validate', []))).toBe('validation');
	});

	it('maps /proposals to proposal_review', () => {
		expect(commandToViewKind(slash('proposals', []))).toBe('proposal_review');
	});

	it('maps /decisions to decision_detail', () => {
		expect(commandToViewKind(slash('decisions', []))).toBe('decision_detail');
	});

	it('maps free-form to intake', () => {
		expect(commandToViewKind({ kind: 'free-form', text: 'hello' })).toBe(
			'intake',
		);
	});

	it('maps empty to status', () => {
		expect(commandToViewKind({ kind: 'empty' })).toBe('status');
	});

	it('maps unknown command to recovery', () => {
		expect(commandToViewKind(slash('unknowncmd', []))).toBe('recovery');
	});

	it('maps /exit to status', () => {
		expect(commandToViewKind(slash('exit', []))).toBe('status');
	});

	it('maps /continue to intake', () => {
		expect(commandToViewKind(slash('continue', []))).toBe('intake');
	});

	it('maps /executive compile to executive_compile_report', () => {
		expect(commandToViewKind(slash('executive', ['compile']))).toBe(
			'executive_compile_report',
		);
	});

	it('maps /config ai to provider_config', () => {
		expect(commandToViewKind(slash('config', ['ai']))).toBe('provider_config');
	});
});

// ---------------------------------------------------------------------------
// Default actions per view
// ---------------------------------------------------------------------------

describe('getDefaultActionsForView', () => {
	it('returns actions for all view kinds without crashing', () => {
		for (const vk of TUI_VIEW_KINDS) {
			const actions = getDefaultActionsForView(vk);
			expect(Array.isArray(actions)).toBe(true);
		}
	});

	it('actions have read-only or mutating labels', () => {
		for (const vk of TUI_VIEW_KINDS) {
			const actions = getDefaultActionsForView(vk);
			for (const action of actions) {
				expect(
					action.readOnly !== action.mutating ||
						(!action.readOnly && !action.mutating),
				).toBe(true);
			}
		}
	});

	it('status view has key actions', () => {
		const actions = getDefaultActionsForView('status');
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('/status');
		expect(labels).toContain('/help');
	});

	it('first_run has init actions', () => {
		const actions = getDefaultActionsForView('first_run');
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('/init');
	});

	it('recovery view has navigation actions', () => {
		const actions = getDefaultActionsForView('recovery');
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('/status');
		expect(labels).toContain('/help');
	});

	it('recommended actions are marked', () => {
		const actions = getDefaultActionsForView('status');
		const recommended = actions.filter((a) => a.recommended);
		expect(recommended.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Context rail items
// ---------------------------------------------------------------------------

describe('buildContextRailItems', () => {
	it('returns items with counts', () => {
		const items = buildContextRailItems({
			assumptionCount: 5,
			openQuestionCount: 3,
			proposalCount: 2,
			providerStatusText: 'not configured',
			riskCount: 1,
		});

		expect(items.length).toBeGreaterThan(0);
		const openQItem = items.find((i) => i.label === 'Open Questions');
		expect(openQItem).toBeDefined();
		expect(openQItem?.value).toBe('3');
	});

	it('marks state on positive counts', () => {
		const items = buildContextRailItems({
			openQuestionCount: 5,
		});
		const openQItem = items.find((i) => i.label === 'Open Questions');
		expect(openQItem?.stateLabel).toBeDefined();
		expect(openQItem?.stateLabel?.kind).toBe('incomplete');
	});

	it('empty opts returns empty array', () => {
		const items = buildContextRailItems({});
		expect(items).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Serializability
// ---------------------------------------------------------------------------

describe('serializability', () => {
	it('view model is JSON-serializable', () => {
		const vm = createWorkbenchViewModel({
			activeProfileId: 'standard',
			content: ['line 1', 'line 2'],
			documentationRoot: 'logos/',
			projectRoot: '/test',
			providerStatusText: 'not configured',
			title: 'Test',
			viewKind: 'status',
			workspaceStatus: 'initialized',
		});

		const json = JSON.stringify(vm);
		expect(json).toBeTruthy();
		const parsed = JSON.parse(json);
		expect(parsed.viewKind).toBe('status');
		expect(parsed.primary.content).toEqual(['line 1', 'line 2']);
	});

	it('all view kinds can be used in view models', () => {
		for (const vk of TUI_VIEW_KINDS) {
			const vm = createWorkbenchViewModel({
				activeProfileId: 'standard',
				documentationRoot: 'logos/',
				projectRoot: '/test',
				providerStatusText: 'not configured',
				title: vk,
				viewKind: vk,
				workspaceStatus: 'initialized',
			});

			expect(vm.viewKind).toBe(vk);
			expect(JSON.stringify(vm)).toBeTruthy();
		}
	});
});
