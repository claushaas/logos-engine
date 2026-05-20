/**
 * Ink TUI root component.
 *
 * Phase 4: Keyboard Confirmation Framework — Outcome 3 (confirmation flow integration).
 *
 * Interactive TUI confirmations use keyboard-selectable controls instead of
 * retyping `--confirm`. When a command returns a confirmation request, the
 * shell renders a ConfirmationPrompt and blocks normal input until resolution.
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
import type { RouterContext } from './types.js';

export function App(): React.JSX.Element {
	const { exit } = useApp();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Message[]>([]);
	const [nextId, setNextId] = useState(0);
	const [processing, setProcessing] = useState(false);
	const briefingShown = useRef(false);

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
			} catch {
				addMessages([
					{
						id: 0,
						sender: 'system' as const,
						text: '[ERROR] The confirmed command could not be executed.',
					},
				]);
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
			setProcessing(true);

			processCommand(submitted, context)
				.then(({ messages: cmdMessages, shouldExit, confirmationRequest }) => {
					// Add response messages (from processCommand, already structured)
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
				})
				.catch(() => {
					setProcessing(false);
				});

			setInput('');
		} else if (key.backspace || key.delete) {
			setInput((prev) => prev.slice(0, -1));
		} else if (!key.ctrl && !key.meta && inputChar.length === 1) {
			setInput((prev) => prev + inputChar);
		}
	});

	return (
		<Box flexDirection="column" height="100%">
			<Box flexDirection="column" flexGrow={1}>
				{messages.map((msg) => (
					<Box key={msg.id}>
						<Text>
							{msg.sender === 'user' ? '> ' : '  '}
							{msg.text}
						</Text>
					</Box>
				))}

				{/* Render confirmation prompt when pending */}
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

			<Box>
				<Text>
					{ctx.cwd}
					{' | '}
					{ctx.config.documentationRoot.rootPath}
					{' | '}
					{ctx.config.activeProfileId ?? 'unknown'}
					{' | '}
					{formatProviderStatus(ctx.config.providerStatus)}
				</Text>
			</Box>
		</Box>
	);
}
