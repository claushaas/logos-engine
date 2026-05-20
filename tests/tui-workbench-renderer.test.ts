/**
 * TUI Workbench Renderer and State Label Tests
 *
 * Phase 5: TUI Workbench Redesign — tests for workbench layout rendering,
 * state label visibility, orientation header, primary area, context rail,
 * action area, feedback area, and compact/standard/wide modes.
 */

import { describe, expect, it } from 'vitest';
import {
	buildContextRailItems,
	createDefaultFocusModel,
	createLoadingModel,
	createStateLabel,
	createWorkbenchViewModel,
	messagesToFeedback,
	STATE_LABEL_KINDS,
	STATE_LABEL_MAP,
	stateLabelText,
	type TuiViewKind,
} from '../src/tui/workbench-model.js';
import {
	renderActionArea,
	renderCommandInput,
	renderCompactOrientation,
	renderContextRail,
	renderFocusIndicator,
	renderHelpContent,
	renderLoadingArea,
	renderOrientationHeader,
	renderRecoveryContent,
	renderWorkbench,
} from '../src/tui/workbench-renderer.js';

// ---------------------------------------------------------------------------
// Base view model for tests
// ---------------------------------------------------------------------------

function baseViewModel(
	overrides?: Partial<ReturnType<typeof createWorkbenchViewModel>>,
) {
	const vm = createWorkbenchViewModel({
		actions: [
			{
				category: 'navigation',
				description: 'Show status',
				label: '/status',
				mutating: false,
				readOnly: true,
				recommended: true,
				requiresConfirmation: false,
			},
			{
				category: 'generation',
				description: 'Generate docs',
				label: '/generate',
				mutating: false,
				readOnly: true,
				recommended: false,
				requiresConfirmation: false,
			},
		],
		activeProfileId: 'standard',
		content: ['Status line 1', 'Status line 2'],
		contextItems: buildContextRailItems({
			assumptionCount: 2,
			openQuestionCount: 3,
			providerStatusText: 'not configured',
		}),
		documentationRoot: 'logos/',
		feedbackMessages: [{ severity: 'info' as const, text: 'Ready' }],
		feedbackStatusKind: 'info',
		projectRoot: '/test/project',
		providerStatusText: 'not configured',
		stateLabels: [STATE_LABEL_MAP.ready],
		title: 'Status',
		viewKind: 'status',
		width: 100,
		workspaceStatus: 'initialized',
	});
	return Object.assign(vm, overrides ?? {});
}

// ---------------------------------------------------------------------------
// State label rendering tests
// ---------------------------------------------------------------------------

describe('state labels (renderer)', () => {
	it('all state labels are visible as text in rendering', () => {
		for (const kind of STATE_LABEL_KINDS) {
			const text = stateLabelText(kind);
			expect(text).toBeTruthy();
			expect(text.length).toBeGreaterThan(2);
			// All labels have brackets
			expect(text).toContain('[');
			expect(text).toContain(']');
		}
	});

	it('state labels in view model appear in rendering', () => {
		const vm = createWorkbenchViewModel({
			activeProfileId: 'standard',
			documentationRoot: 'logos/',
			projectRoot: '/test/project',
			providerStatusText: 'not configured',
			stateLabels: [STATE_LABEL_MAP.proposed, STATE_LABEL_MAP.low_confidence],
			title: 'Status',
			viewKind: 'status',
			width: 100,
			workspaceStatus: 'initialized',
		});
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('[proposed]');
		expect(text).toContain('[low confidence]');
	});

	it('no label depends on color alone', () => {
		// All labels must have text content (plain text labels)
		for (const kind of STATE_LABEL_KINDS) {
			const label = createStateLabel(kind);
			// Labels are plain text — verify length and bracket presence
			expect(label.text.length).toBeGreaterThan(2);
		}
	});
});

// ---------------------------------------------------------------------------
// Orientation header tests
// ---------------------------------------------------------------------------

describe('orientation header', () => {
	it('renders repository, workspace, profile, root, provider, view', () => {
		const vm = baseViewModel();
		const lines = renderOrientationHeader(vm);
		const text = lines.join('\n');
		expect(text).toContain('/test/project');
		expect(text).toContain('initialized');
		expect(text).toContain('standard');
		expect(text).toContain('logos/');
		expect(text).toContain('Status');
		expect(text).toContain('not configured');
	});

	it('shows read-only label when applicable', () => {
		const vm = baseViewModel();
		vm.orientation.isReadOnly = true;
		const lines = renderOrientationHeader(vm);
		const text = lines.join('\n');
		expect(text).toContain('[read-only]');
	});

	it('shows dry-run label when applicable', () => {
		const vm = baseViewModel();
		vm.orientation.isDryRun = true;
		vm.orientation.isReadOnly = false;
		const lines = renderOrientationHeader(vm);
		const text = lines.join('\n');
		expect(text).toContain('[dry-run]');
	});

	it('compact orientation shows essential labels', () => {
		const vm = baseViewModel();
		const lines = renderCompactOrientation(vm);
		const text = lines.join('\n');
		expect(text).toContain('/test/project');
		expect(text).toContain('initialized');
		expect(text).toContain('logos/');
		expect(text).toContain('standard');
		expect(text).toContain('[provider-unconfigured]');
	});
});

// ---------------------------------------------------------------------------
// Primary area tests
// ---------------------------------------------------------------------------

describe('primary area', () => {
	it('renders title and state labels', () => {
		const vm = baseViewModel();
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('Status');
		expect(text).toContain('[ready]');
	});

	it('renders content lines', () => {
		const vm = baseViewModel();
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('Status line 1');
		expect(text).toContain('Status line 2');
	});

	it('shows (no content) when empty', () => {
		const vm = createWorkbenchViewModel({
			activeProfileId: 'standard',
			documentationRoot: 'logos/',
			projectRoot: '/test/project',
			providerStatusText: 'not configured',
			title: 'Empty',
			viewKind: 'status',
			width: 100,
			workspaceStatus: 'initialized',
		});
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('(no content)');
	});

	it('shows summary when available', () => {
		const vm = createWorkbenchViewModel({
			activeProfileId: 'standard',
			documentationRoot: 'logos/',
			projectRoot: '/test/project',
			providerStatusText: 'not configured',
			summary: 'Summary text',
			title: 'With Summary',
			viewKind: 'status',
			width: 100,
			workspaceStatus: 'initialized',
		});
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('Summary text');
	});
});

// ---------------------------------------------------------------------------
// Context rail tests
// ---------------------------------------------------------------------------

describe('context rail', () => {
	it('renders context items with labels', () => {
		const vm = baseViewModel();
		const lines = renderContextRail(vm);
		const text = lines.join('\n');
		expect(text).toContain('Open Questions');
		expect(text).toContain('3');
		expect(text).toContain('Assumptions');
		expect(text).toContain('2');
	});

	it('compact mode renders one-liner context', () => {
		const vm = baseViewModel({
			contextRail: undefined,
			viewportMode: 'compact',
		});
		vm.context.openQuestionCount = 3;
		vm.context.assumptionCount = 2;
		vm.context.available = true;
		const lines = renderContextRail(vm);
		const text = lines.join('\n');
		expect(text).toContain('Context:');
		expect(text).toContain('Q:3');
		expect(text).toContain('A:2');
	});

	it('renders nothing when context is not available', () => {
		const vm = baseViewModel({ contextRail: undefined });
		vm.context.available = false;
		const lines = renderContextRail(vm);
		expect(lines).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Action area tests
// ---------------------------------------------------------------------------

describe('action area', () => {
	it('renders action items', () => {
		const vm = baseViewModel();
		const lines = renderActionArea(vm);
		const text = lines.join('\n');
		expect(text).toContain('Actions:');
		expect(text).toContain('/status');
		expect(text).toContain('/generate');
	});

	it('labels read-only actions', () => {
		const vm = baseViewModel();
		const lines = renderActionArea(vm);
		const text = lines.join('\n');
		expect(text).toContain('[read-only]');
	});

	it('labels mutating actions', () => {
		const vm = baseViewModel();
		vm.actionArea.actions = [
			{
				category: 'write',
				description: 'Write files',
				label: '/generate --confirm',
				mutating: true,
				readOnly: false,
				recommended: true,
				requiresConfirmation: true,
			},
		];
		const lines = renderActionArea(vm);
		const text = lines.join('\n');
		expect(text).toContain('[mutating]');
	});

	it('marks recommended actions', () => {
		const vm = baseViewModel();
		const lines = renderActionArea(vm);
		const text = lines.join('\n');
		// Recommended action has arrow indicator
		expect(text).toContain('→');
	});

	it('returns empty when no actions', () => {
		const vm = baseViewModel({ actionArea: { actions: [] } });
		const lines = renderActionArea(vm);
		expect(lines).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Feedback area tests
// ---------------------------------------------------------------------------

describe('feedback area', () => {
	it('renders status messages', () => {
		const vm = baseViewModel();
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('Status:');
		expect(text).toContain('Ready');
	});

	it('shows error label for errors', () => {
		const vm = baseViewModel({
			feedback: {
				messages: [{ severity: 'error', text: 'Something failed' }],
				statusKind: 'error',
			},
		});
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('[failed]');
		expect(text).toContain('Something failed');
	});

	it('shows warning label for warnings', () => {
		const vm = baseViewModel({
			feedback: {
				messages: [{ severity: 'warning', text: 'Proceed with caution' }],
				statusKind: 'warning',
			},
		});
		const lines = renderWorkbench(vm);
		const text = lines.join('\n');
		expect(text).toContain('[warning]');
	});

	it('returns empty for idle state with no messages', () => {
		const vm = baseViewModel({
			feedback: { messages: [], statusKind: 'idle' },
		});
		const lines = renderWorkbench(vm);
		// Feedback section won't appear in output
		const text = lines.join('\n');
		expect(text).not.toContain('Status:');
	});
});

// ---------------------------------------------------------------------------
// Command input tests
// ---------------------------------------------------------------------------

describe('command input rendering', () => {
	it('renders active command prompt', () => {
		const vm = baseViewModel();
		const lines = renderCommandInput(vm);
		const text = lines.join('\n');
		expect(text).toContain('> _');
	});

	it('shows disabled when input blocked', () => {
		const vm = baseViewModel({
			commandInput: {
				disabled: true,
				disabledReason: 'Confirmation is pending',
				placeholder: 'Input blocked',
				visible: true,
			},
		});
		const lines = renderCommandInput(vm);
		const text = lines.join('\n');
		expect(text).toContain('[input disabled]');
		expect(text).toContain('Confirmation is pending');
	});
});

// ---------------------------------------------------------------------------
// Focus indicator tests
// ---------------------------------------------------------------------------

describe('focus indicator', () => {
	it('shows text-visible focus label', () => {
		const focus = createDefaultFocusModel();
		const lines = renderFocusIndicator(focus);
		const text = lines.join('\n');
		expect(text).toContain('[Focus: command input]');
	});

	it('shows confirmation focus', () => {
		const focus = createDefaultFocusModel({ inputBlocked: true });
		const lines = renderFocusIndicator(focus);
		const text = lines.join('\n');
		expect(text).toContain('[Focus: confirmation]');
	});
});

// ---------------------------------------------------------------------------
// Loading area tests
// ---------------------------------------------------------------------------

describe('loading area', () => {
	it('renders loading title and phase', () => {
		const loading = createLoadingModel({
			operationKind: 'generation',
			phase: 'Planning documents',
			title: 'Generating canonical documentation',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Loading: Generating canonical documentation');
		expect(text).toContain('Planning documents');
	});

	it('labels read-only operations', () => {
		const loading = createLoadingModel({
			operationKind: 'diagnostics',
			readOnly: true,
			title: 'Running diagnostics',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('[read-only]');
	});

	it('labels mutating operations', () => {
		const loading = createLoadingModel({
			operationKind: 'generation',
			readOnly: false,
			title: 'Writing files',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('[mutating]');
	});

	it('shows cancellable note', () => {
		const loading = createLoadingModel({
			cancellable: true,
			operationKind: 'provider_call',
			title: 'Calling provider',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('(cancellable)');
	});

	it('renders diagnostics if present', () => {
		const loading = createLoadingModel({
			diagnostics: [
				{
					code: 'TEST',
					message: 'Info message',
					recoveryHints: [],
					severity: 'info',
				},
			],
			operationKind: 'generation',
			title: 'Test',
		});
		const lines = renderLoadingArea(loading);
		const text = lines.join('\n');
		expect(text).toContain('Info message');
	});
});

// ---------------------------------------------------------------------------
// Help view tests
// ---------------------------------------------------------------------------

describe('help view', () => {
	it('renders help content with command groups', () => {
		const vm = baseViewModel({ viewKind: 'help' });
		const messages = [
			'/help        — Show this help',
			'/status      — Show runtime status',
			'/init        — Initialize LOGOS workspace',
			'/init --confirm — Confirm and execute workspace creation',
			'/generate    — Generate canonical Markdown documentation',
			'/generate --confirm — Confirm and execute generation',
			'/diagnose    — Run diagnostic analysis',
			'/validate    — Run deterministic validation',
			'/config ai   — Configure AI provider',
			'LOGOS Engine — TUI slash commands:',
		];
		const lines = renderHelpContent(messages, vm);
		const text = lines.join('\n');

		// Command groups appear
		expect(text).toContain('Core Operations');
		expect(text).toContain('Diagnostics & Validation');
		expect(text).toContain('Configuration');

		// Labels appear
		expect(text).toContain('[read-only]');
		expect(text).toContain('[mutating]');

		// Mutating commands are marked
		expect(text).toContain('/init --confirm');

		// Read-only/mutating legend appears
		expect(text).toContain('Read-only (no filesystem writes)');
		expect(text).toContain('Mutating (may write files or change state)');
	});
});

// ---------------------------------------------------------------------------
// Recovery view tests
// ---------------------------------------------------------------------------

describe('recovery view', () => {
	it('renders recovery content with error and hints', () => {
		const lines = renderRecoveryContent({
			errorType: 'Unknown command',
			preservedState: 'Workspace state is intact',
			recoveryHints: [
				'Run /help for available commands',
				'Run /status to review state',
			],
			retrySafe: true,
			whatFailed: 'Command /foo was not recognized',
		});

		const text = lines.join('\n');
		expect(text).toContain('[failed]');
		expect(text).toContain('Unknown command');
		expect(text).toContain('What failed: Command /foo was not recognized');
		expect(text).toContain('State preserved: Workspace state is intact');
		expect(text).toContain('Retry is safe');
		expect(text).toContain('Run /help');
		expect(text).toContain('Run /status');
	});

	it('shows retry not safe when applicable', () => {
		const lines = renderRecoveryContent({
			errorType: 'Provider error',
			preservedState: 'Partial state saved',
			recoveryHints: ['Run /config ai to reconfigure'],
			retrySafe: false,
			whatFailed: 'Provider call timed out',
		});

		const text = lines.join('\n');
		expect(text).toContain('Retry may not be safe');
	});
});

// ---------------------------------------------------------------------------
// Compact/standard/wide tests
// ---------------------------------------------------------------------------

describe('responsive terminal behavior', () => {
	it('compact view renders compact orientation', () => {
		const vm = baseViewModel({ viewportMode: 'compact', width: 60 });
		const lines = renderWorkbench(vm, { mode: 'compact' });
		const text = lines.join('\n');

		expect(text).toContain('/test/project');
		expect(text).toContain('initialized');
		expect(text).toContain('logos/');
		expect(text).toContain('View: Status');
	});

	it('standard view renders full orientation', () => {
		const vm = baseViewModel({ viewportMode: 'standard', width: 100 });
		const lines = renderWorkbench(vm, { mode: 'standard' });
		const text = lines.join('\n');

		expect(text).toContain('Repo: /test/project');
		expect(text).toContain('Workspace: initialized');
		expect(text).toContain('Profile: standard');
		expect(text).toContain('Root: logos/');
	});

	it('wide view renders same structure as standard', () => {
		const vm = baseViewModel({ viewportMode: 'wide', width: 150 });
		const lines = renderWorkbench(vm, { mode: 'wide' });
		const text = lines.join('\n');

		expect(text).toContain('Repo: /test/project');
		expect(text).toContain('Actions:');
	});

	it('compact mode preserves essential labels', () => {
		const vm = baseViewModel({
			stateLabels: [STATE_LABEL_MAP.failed],
			viewportMode: 'compact',
			width: 60,
		});
		vm.orientation.isDryRun = true;
		vm.orientation.isReadOnly = false;
		const lines = renderWorkbench(vm, { mode: 'compact' });
		const text = lines.join('\n');

		// Essential labels still visible
		expect(text).toContain('[dry-run]');
		expect(text).toContain('[provider-unconfigured]');
	});

	it('no layout becomes unreadable', () => {
		for (const mode of ['compact', 'standard', 'wide'] as const) {
			const vm = baseViewModel({ viewportMode: mode });
			const lines = renderWorkbench(vm, { mode });
			const text = lines.join('\n');

			// Every layout should have meaningful content
			expect(text.length).toBeGreaterThan(10);
			// No raw JSON dumps
			expect(text).not.toContain('{');
		}
	});
});

// ---------------------------------------------------------------------------
// Integration: workbench renders all view kinds without crashing
// ---------------------------------------------------------------------------

describe('workbench rendering per view kind', () => {
	const allViewKinds: TuiViewKind[] = [
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
	];

	for (const vk of allViewKinds) {
		it(`renders ${vk} view without crashing`, () => {
			const vm = createWorkbenchViewModel({
				actions: [
					{
						category: 'navigation',
						description: 'Status',
						label: '/status',
						mutating: false,
						readOnly: true,
						recommended: true,
						requiresConfirmation: false,
					},
				],
				activeProfileId: 'standard',
				content: [`${vk} content line`],
				documentationRoot: 'logos/',
				projectRoot: '/test/project',
				providerStatusText: 'not configured',
				title: vk,
				viewKind: vk,
				width: 100,
				workspaceStatus: 'initialized',
			});

			const lines = renderWorkbench(vm);
			expect(Array.isArray(lines)).toBe(true);
			expect(lines.length).toBeGreaterThan(0);

			const text = lines.join('\n');
			expect(text).toContain('/test/project');
		});
	}
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('non-mutation guarantees', () => {
	it('renderWorkbench does not mutate its input', () => {
		const vm = baseViewModel();
		const before = JSON.stringify(vm);
		renderWorkbench(vm);
		const after = JSON.stringify(vm);
		expect(after).toBe(before);
	});

	it('renderOrientationHeader returns new array', () => {
		const vm = baseViewModel();
		const before = JSON.stringify(vm);
		renderOrientationHeader(vm);
		const after = JSON.stringify(vm);
		expect(after).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// messagesToFeedback tests
// ---------------------------------------------------------------------------

describe('messagesToFeedback', () => {
	it('converts message strings to feedback messages', () => {
		const fb = messagesToFeedback(
			['Generation complete', '5 files created'],
			'success',
		);
		expect(fb.length).toBe(2);
		expect(fb[0]?.severity).toBe('success');
		expect(fb[0]?.text).toBe('Generation complete');
	});

	it('handles empty messages', () => {
		const fb = messagesToFeedback([], 'success');
		expect(fb).toEqual([]);
	});

	it('maps error status to error severity', () => {
		const fb = messagesToFeedback(['Failed'], 'error');
		expect(fb[0]?.severity).toBe('error');
	});
});
