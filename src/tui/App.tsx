/**
 * Ink TUI root component.
 *
 * Phase 4: Keyboard Confirmation Framework — Outcome 3 (confirmation flow integration).
 * Phase 5: TUI Workbench Redesign — Outcome 3 (existing flows rendered through workbench).
 *
 * Interactive TUI confirmations use keyboard-selectable controls instead of
 * retyping `--confirm`. The workbench layout provides orientation, context,
 * action area, and report views.
 */

import { Box, Text, useApp, useInput } from 'ink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildDeterministicStartupBriefing,
	renderStartupBriefing,
} from '../intake/index.js';
import { formatProviderStatus } from '../runtime/project-context.js';
import { redactString } from '../runtime/redaction.js';
import { ConfirmationPrompt } from './ConfirmationPrompt.js';
import {
	getConfirmedCommand,
	resolveTuiConfirmation,
} from './confirmation-resolver.js';
import type { ConfirmationState } from './confirmation-state.js';
import {
	cancelConfirmation,
	createConfirmationState,
	resolveConfirmation,
	selectConfirmationOption,
	setPendingConfirmation,
} from './confirmation-state.js';
import {
	buildStartupBriefingInputFromContext,
	createRouterContext,
	type Message,
	processCommand,
} from './shell-logic.js';
import { parseSlashCommand } from './slash-parser.js';
import { routeSlashCommand } from './slash-router.js';
import type { RouterContext, SlashCommandResult } from './types.js';
import {
	buildContextRailItems,
	commandToViewKind,
	createFeedbackMessage,
	createWorkbenchViewModel,
	getDefaultActionsForView,
	messagesToFeedback,
	STATE_LABEL_MAP,
	type TuiFeedbackMessage,
	type TuiViewKind,
	type TuiWorkbenchViewModel,
} from './workbench-model.js';
import { renderWorkbench } from './workbench-renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrimaryWindowLineCount(rows?: number): number {
	const availableRows = (rows ?? 24) - 20;
	return Math.max(8, Math.min(40, availableRows));
}

function createWorkbenchLineItems(
	lines: string[],
): Array<{ key: string; text: string }> {
	const seen = new Map<string, number>();
	return lines.map((text) => {
		const occurrence = seen.get(text) ?? 0;
		seen.set(text, occurrence + 1);
		return { key: `${text}\x1f${occurrence}`, text };
	});
}

/**
 * Build initial view model from project context and startup data.
 */
function _buildInitialViewModel(
	context: RouterContext,
	startupLines: string[],
	viewKind: TuiViewKind,
	stateCounts?: {
		openQuestions: number;
		assumptions: number;
		proposals: number;
		risks: number;
	},
): TuiWorkbenchViewModel {
	const ctx = context.projectContext;
	const workspaceStatus =
		ctx.workspace.initializationState === 'initialized'
			? 'initialized'
			: ctx.workspace.initializationState === 'missing'
				? 'uninitialized'
				: ctx.workspace.initializationState;

	const providerStatusText = formatProviderStatus(ctx.config.providerStatus);
	const providerConfigured = ctx.config.providerStatus.kind === 'configured';

	const contextItems = buildContextRailItems({
		assumptionCount: stateCounts?.assumptions ?? 0,
		openQuestionCount: stateCounts?.openQuestions ?? 0,
		proposalCount: stateCounts?.proposals ?? 0,
		providerStatusText,
		riskCount: stateCounts?.risks ?? 0,
	});

	const actions = getDefaultActionsForView(viewKind, {
		providerConfigured,
		workspaceInitialized: ctx.workspace.initializationState === 'initialized',
	});

	const feedbackMessages: TuiFeedbackMessage[] = [];
	if (viewKind === 'first_run') {
		feedbackMessages.push(
			createFeedbackMessage(
				'Workspace not initialized. Run /init to begin.',
				'warning',
				'provider_unconfigured',
			),
		);
	}

	return createWorkbenchViewModel({
		actions,
		activeProfileId: ctx.config.activeProfileId ?? 'unknown',
		assumptionCount: stateCounts?.assumptions ?? 0,
		content: startupLines,
		contextItems,
		documentationRoot: ctx.config.documentationRoot.rootPath,
		feedbackMessages,
		feedbackStatusKind: viewKind === 'first_run' ? 'warning' : 'idle',
		isDryRun: false,
		isMutating: false,
		isReadOnly: true,
		openQuestionCount: stateCounts?.openQuestions ?? 0,
		projectRoot: ctx.root.rootPath ?? ctx.cwd,
		proposalCount: stateCounts?.proposals ?? 0,
		providerStatusText,
		riskCount: stateCounts?.risks ?? 0,
		stateLabels:
			viewKind === 'first_run' ? [STATE_LABEL_MAP.provider_unconfigured] : [],
		title: viewKind === 'first_run' ? 'First Run' : 'Startup',
		viewKind,
		workspaceStatus,
	});
}

/**
 * Build a view model from a command result.
 */
function _buildResultViewModel(
	context: RouterContext,
	result: SlashCommandResult,
	viewKind: TuiViewKind,
	stateCounts?: {
		openQuestions: number;
		assumptions: number;
		proposals: number;
		risks: number;
	},
	inputBlocked?: boolean,
): TuiWorkbenchViewModel {
	const ctx = context.projectContext;
	const workspaceStatus =
		ctx.workspace.initializationState === 'initialized'
			? 'initialized'
			: ctx.workspace.initializationState === 'missing'
				? 'uninitialized'
				: ctx.workspace.initializationState;

	const providerStatusText = formatProviderStatus(ctx.config.providerStatus);
	const providerConfigured = ctx.config.providerStatus.kind === 'configured';

	const contextItems = buildContextRailItems({
		assumptionCount: stateCounts?.assumptions ?? 0,
		openQuestionCount: stateCounts?.openQuestions ?? 0,
		proposalCount: stateCounts?.proposals ?? 0,
		providerStatusText,
		riskCount: stateCounts?.risks ?? 0,
	});

	const actions = getDefaultActionsForView(viewKind, {
		providerConfigured,
		workspaceInitialized: ctx.workspace.initializationState === 'initialized',
	});

	const feedbackMessages = messagesToFeedback(result.messages, result.kind);
	// Use all messages as content (feedback gets first 3, all go to primary)
	const content = result.messages.length > 3 ? result.messages : [];

	const isDryRun =
		result.messages.some((m) => m.includes('dry-run')) ||
		result.messages.some((m) => m.includes('dry_run'));

	const stateLabels =
		result.kind === 'error'
			? [STATE_LABEL_MAP.failed]
			: result.kind === 'warning'
				? [STATE_LABEL_MAP.warning]
				: [];

	return createWorkbenchViewModel({
		actions,
		activeProfileId: ctx.config.activeProfileId ?? 'unknown',
		assumptionCount: stateCounts?.assumptions ?? 0,
		content,
		contextItems,
		documentationRoot: ctx.config.documentationRoot.rootPath,
		feedbackMessages,
		feedbackStatusKind:
			result.kind === 'success'
				? 'success'
				: result.kind === 'error'
					? 'error'
					: result.kind === 'warning'
						? 'warning'
						: 'info',
		inputBlocked,
		isDryRun,
		isMutating: !isDryRun && viewKind === 'generation_report',
		isReadOnly: isDryRun || viewKind !== 'generation_report',
		openQuestionCount: stateCounts?.openQuestions ?? 0,
		projectRoot: ctx.root.rootPath ?? ctx.cwd,
		proposalCount: stateCounts?.proposals ?? 0,
		providerStatusText,
		riskCount: stateCounts?.risks ?? 0,
		stateLabels,
		summary: result.messages.length > 0 ? result.messages[0] : undefined,
		title:
			viewKind === 'startup'
				? 'Startup'
				: viewKind === 'first_run'
					? 'First Run'
					: viewKind === 'status'
						? 'Status'
						: viewKind === 'help'
							? 'Help'
							: viewKind === 'intake'
								? 'Intake'
								: viewKind === 'generation_confirmation'
									? 'Generation Confirmation'
									: viewKind === 'generation_report'
										? 'Generation Report'
										: viewKind === 'validation'
											? 'Validation'
											: viewKind === 'diagnostics'
												? 'Diagnostics'
												: viewKind === 'executive_compile_report'
													? 'Executive Compile'
													: viewKind === 'proposal_review'
														? 'Proposal Review'
														: viewKind === 'proposal_detail'
															? 'Proposal Detail'
															: viewKind === 'decision_detail'
																? 'Decision Detail'
																: viewKind === 'provider_config'
																	? 'Provider Configuration'
																	: viewKind === 'recovery'
																		? 'Recovery'
																		: result.command || viewKind,
		viewKind,
		workspaceStatus,
	});
}

// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
	const { exit } = useApp();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Message[]>([]);
	const [nextId, setNextId] = useState(0);
	const [processing, setProcessing] = useState(false);
	const briefingShown = useRef(false);
	const [lastViewKind, setLastViewKind] = useState<TuiViewKind | undefined>(
		undefined,
	);
	const [primaryContentOffset, setPrimaryContentOffset] = useState(0);

	// Confirmation state
	const [confirmation, setConfirmation] = useState<ConfirmationState>(
		createConfirmationState,
	);

	// Router context with interactive mode enabled
	const context = useMemo<RouterContext>(
		() => createRouterContext({ interactive: true }),
		[],
	);
	const ctx = context.projectContext;

	const addMessages = useCallback(
		(newMessages: Message[]) => {
			setMessages((prev) => {
				let id = nextId;
				const withIds = newMessages.map((msg) => ({ ...msg, id: id++ }));
				setNextId(id);
				return [...prev, ...withIds];
			});
		},
		[nextId],
	);

	// Build current view model from messages and context
	const currentViewModel = useMemo<TuiWorkbenchViewModel>(() => {
		const workspaceStatus =
			ctx.workspace.initializationState === 'initialized'
				? 'initialized'
				: ctx.workspace.initializationState === 'missing'
					? 'uninitialized'
					: ctx.workspace.initializationState;

		const providerStatusText = formatProviderStatus(ctx.config.providerStatus);

		// Determine active view kind
		let activeViewKind: TuiViewKind;
		if (confirmation.inputBlocked && confirmation.pending) {
			activeViewKind = 'generation_confirmation';
		} else if (lastViewKind) {
			activeViewKind = lastViewKind;
		} else {
			activeViewKind =
				ctx.workspace.initializationState === 'initialized'
					? 'startup'
					: 'first_run';
		}

		// Extract content from messages, starting from latest result
		const contentMessages = messages
			.filter((m) => m.sender === 'system')
			.slice(-30) // Last 30 system messages
			.map((m) => m.text);

		const actions = getDefaultActionsForView(activeViewKind, {
			providerConfigured: ctx.config.providerStatus.kind === 'configured',
			workspaceInitialized: ctx.workspace.initializationState === 'initialized',
		});

		const feedbackKind = processing ? ('info' as const) : ('idle' as const);

		return createWorkbenchViewModel({
			actions,
			activeProfileId: ctx.config.activeProfileId ?? 'unknown',
			content: contentMessages,
			contextItems: buildContextRailItems({
				providerStatusText,
			}),
			documentationRoot: ctx.config.documentationRoot.rootPath,
			feedbackStatusKind: feedbackKind,
			inputBlocked: confirmation.inputBlocked,
			isDryRun: false,
			isMutating: false,
			isReadOnly: true,
			projectRoot: ctx.root.rootPath ?? ctx.cwd,
			providerStatusText,
			stateLabels:
				activeViewKind === 'first_run'
					? [STATE_LABEL_MAP.provider_unconfigured]
					: [],
			summary: contentMessages.length > 0 ? contentMessages[0] : undefined,
			title:
				activeViewKind === 'startup'
					? 'Startup'
					: activeViewKind === 'first_run'
						? 'First Run'
						: activeViewKind === 'status'
							? 'Status'
							: activeViewKind === 'help'
								? 'Help'
								: activeViewKind === 'intake'
									? 'Intake'
									: activeViewKind === 'generation_confirmation'
										? 'Generation Confirmation'
										: activeViewKind === 'generation_report'
											? 'Generation Report'
											: activeViewKind === 'validation'
												? 'Validation'
												: activeViewKind === 'diagnostics'
													? 'Diagnostics'
													: activeViewKind === 'executive_compile_report'
														? 'Executive Compile'
														: activeViewKind === 'proposal_review'
															? 'Proposal Review'
															: activeViewKind === 'proposal_detail'
																? 'Proposal Detail'
																: activeViewKind === 'decision_detail'
																	? 'Decision Detail'
																	: activeViewKind === 'provider_config'
																		? 'Provider Configuration'
																		: activeViewKind === 'recovery'
																			? 'Recovery'
																			: 'LOGOS',
			viewKind: activeViewKind,
			width: process.stdout.columns,
			workspaceStatus,
		});
	}, [
		ctx,
		messages,
		processing,
		confirmation.inputBlocked,
		confirmation.pending,
		lastViewKind,
	]);

	// Render workbench lines
	const primaryWindowLineCount = getPrimaryWindowLineCount(process.stdout.rows);
	const primaryContentLength = currentViewModel.primary.content.length;
	const primaryMaxOffset = Math.max(
		0,
		primaryContentLength - primaryWindowLineCount,
	);

	useEffect(() => {
		setPrimaryContentOffset((prev) => Math.min(prev, primaryMaxOffset));
	}, [primaryMaxOffset]);

	const workbenchLines = useMemo(() => {
		return renderWorkbench(currentViewModel, {
			maxPrimaryLines: primaryWindowLineCount,
			primaryContentOffset,
			width: process.stdout.columns,
		});
	}, [currentViewModel, primaryContentOffset, primaryWindowLineCount]);
	const workbenchLineItems = useMemo(
		() => createWorkbenchLineItems(workbenchLines),
		[workbenchLines],
	);

	// Generate and show startup briefing on mount
	useEffect(() => {
		if (briefingShown.current) return;
		briefingShown.current = true;

		const projectRoot = ctx.root.rootPath ?? ctx.cwd;
		if (ctx.workspace.initializationState === 'initialized') {
			buildStartupBriefingInputFromContext(projectRoot)
				.then((briefingInput) => {
					if (!briefingInput) return;
					const briefing = buildDeterministicStartupBriefing(briefingInput);
					const lines = renderStartupBriefing(briefing, {
						maxWidth: undefined,
						showActions: true,
						showDiagnostics: false,
						showLabels: true,
					});
					addMessages(
						lines.map((text) => ({ id: 0, sender: 'system' as const, text })),
					);
				})
				.catch(() => {
					// Silently ignore briefing failures — don't block TUI startup
				});
		} else {
			// For uninitialized workspaces, show a concise recovery path
			const lines = [
				'',
				'LOGOS Engine',
				'',
				'Workspace is not initialized.',
				'',
				'Run /init to initialize a LOGOS workspace.',
				'Run /help to see available commands.',
				'',
			];
			addMessages(
				lines.map((text) => ({ id: 0, sender: 'system' as const, text })),
			);
		}
	}, [
		ctx.workspace.initializationState,
		ctx.root.rootPath,
		ctx.cwd,
		addMessages,
	]);

	// Execute a confirmed command with confirmationBypass
	const executeConfirmedCommand = useCallback(
		async (command: string, args: string[]) => {
			setProcessing(true);
			try {
				const raw = [command, ...args].join(' ');
				const parsed = parseSlashCommand(raw);
				const bypassContext: RouterContext = {
					...context,
					confirmationBypass: true,
				};
				const result = await routeSlashCommand(parsed, bypassContext);

				if (result.messages.length > 0) {
					addMessages(
						result.messages.map((text) => ({
							id: 0,
							sender: 'system' as const,
							text,
						})),
					);
				}

				// Update view kind after confirmed command
				const vk = result.viewKind ?? commandToViewKind(parsed);
				setLastViewKind(vk);
			} catch {
				addMessages([
					{
						id: 0,
						sender: 'system' as const,
						text: '[ERROR] The confirmed command could not be executed.',
					},
				]);
				setLastViewKind('recovery');
			}
			setProcessing(false);
		},
		[context, addMessages],
	);

	// Handle confirmation resolution
	const handleConfirm = useCallback(
		(optionId: string) => {
			if (!confirmation.pending) return;

			const resolverResult = resolveTuiConfirmation({
				now: new Date().toISOString(),
				request: confirmation.pending,
				selectedOptionId: optionId,
				state: confirmation,
			});

			setConfirmation((prev) => resolveConfirmation(prev, resolverResult));

			// Add resolution messages
			if (resolverResult.messages.length > 0) {
				addMessages(
					resolverResult.messages.map((text) => ({
						id: 0,
						sender: 'system' as const,
						text,
					})),
				);
			}

			// If accepted, execute the confirmed command
			if (resolverResult.outcome === 'accepted' && confirmation.pending) {
				const cmd = getConfirmedCommand(confirmation.pending);
				if (cmd) {
					executeConfirmedCommand(cmd.command, cmd.args);
				} else {
					addMessages([
						{
							id: 0,
							sender: 'system',
							text: 'Action accepted. No further command to execute.',
						},
					]);
				}
			} else {
				// Cancelled or failed — return focus to command input
				setLastViewKind((prev) => prev ?? 'status');
			}
		},
		[confirmation, addMessages, executeConfirmedCommand],
	);

	const handleCancel = useCallback(() => {
		setConfirmation((prev) => cancelConfirmation(prev));
		addMessages([
			{
				id: 0,
				sender: 'system' as const,
				text: 'Confirmation cancelled. No changes were made.',
			},
		]);
		// Return to previous view
		setLastViewKind((prev) => prev ?? 'status');
	}, [addMessages]);

	const handleSelectionChange = useCallback((optionId: string) => {
		setConfirmation((prev) => {
			const pending = prev.pending;
			if (!pending) return prev;
			const idx = pending.options.findIndex((o) => o.id === optionId);
			if (idx >= 0) {
				return selectConfirmationOption(prev, idx);
			}
			return prev;
		});
	}, []);

	// Command input handling
	useInput((inputChar, key) => {
		// If confirmation is pending, block normal input
		if (confirmation.inputBlocked) {
			// Only confirmation keyboard handling is active — handled by ConfirmationPrompt
			return;
		}

		if (key.return) {
			if (processing) return;
			const submitted = input;
			setPrimaryContentOffset(0);
			setProcessing(true);

			processCommand(submitted, context)
				.then(
					({
						messages: cmdMessages,
						shouldExit,
						confirmationRequest,
						viewKind,
					}) => {
						// Add response messages
						const newMessages: Message[] = [];
						newMessages.push({
							id: 0,
							sender: 'user' as const,
							text: submitted,
						});
						for (const msg of cmdMessages) {
							newMessages.push(msg);
						}
						if (newMessages.length > 0) {
							addMessages(newMessages);
						}

						// Update view kind
						if (viewKind) {
							setLastViewKind(viewKind);
						} else {
							const parsed = parseSlashCommand(submitted);
							setLastViewKind(commandToViewKind(parsed));
						}

						// Handle confirmation request (with redaction applied)
						if (confirmationRequest) {
							const redactedRequest = {
								...confirmationRequest,
								consequences: confirmationRequest.consequences.map((c) =>
									redactString(c),
								),
								message: redactString(confirmationRequest.message),
								options: confirmationRequest.options.map((o) => ({
									...o,
									consequence: o.consequence
										? redactString(o.consequence)
										: undefined,
									description: o.description
										? redactString(o.description)
										: undefined,
									label: redactString(o.label),
								})),
								target: confirmationRequest.target
									? {
											...confirmationRequest.target,
											safeDisplay: confirmationRequest.target.safeDisplay
												? redactString(confirmationRequest.target.safeDisplay)
												: undefined,
										}
									: undefined,
								title: redactString(confirmationRequest.title),
							};
							setConfirmation((prev) =>
								setPendingConfirmation(prev, redactedRequest),
							);
						}

						if (shouldExit) {
							exit();
						}
						setProcessing(false);
					},
				)
				.catch(() => {
					setProcessing(false);
				});

			setInput('');
		} else if (key.backspace || key.delete) {
			setInput((prev) => prev.slice(0, -1));
		} else if (key.upArrow && primaryMaxOffset > 0) {
			setPrimaryContentOffset((prev) => Math.max(0, prev - 1));
		} else if (key.downArrow && primaryMaxOffset > 0) {
			setPrimaryContentOffset((prev) => Math.min(primaryMaxOffset, prev + 1));
		} else if ('pageUp' in key && key.pageUp && primaryMaxOffset > 0) {
			setPrimaryContentOffset((prev) =>
				Math.max(0, prev - primaryWindowLineCount),
			);
		} else if ('pageDown' in key && key.pageDown && primaryMaxOffset > 0) {
			setPrimaryContentOffset((prev) =>
				Math.min(primaryMaxOffset, prev + primaryWindowLineCount),
			);
		} else if (!key.ctrl && !key.meta && inputChar.length === 1) {
			setInput((prev) => prev + inputChar);
		}
	});

	return (
		<Box flexDirection="column" height="100%">
			<Box flexDirection="column" flexGrow={1}>
				{/* Render workbench lines */}
				{workbenchLineItems.map((line) => (
					<Box key={line.key}>
						<Text>{line.text}</Text>
					</Box>
				))}

				{/* Render confirmation prompt when pending — on top of workbench */}
				{confirmation.pending && (
					<Box flexDirection="column" marginTop={1}>
						<Box>
							<Text>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
						</Box>
						<ConfirmationPrompt
							onCancel={handleCancel}
							onConfirm={handleConfirm}
							onSelectionChange={handleSelectionChange}
							request={confirmation.pending}
						/>
						<Box>
							<Text>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
						</Box>
					</Box>
				)}
			</Box>

			{/* Only show command input when no confirmation is pending */}
			{!confirmation.inputBlocked && (
				<Box>
					<Text>
						{'> '}
						{input}
						<Text color="gray">|</Text>
					</Text>
				</Box>
			)}
		</Box>
	);
}
