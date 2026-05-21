/**
 * Ink TUI root component — chat-based layout.
 *
 * Phase 8: TUI Simplification — replaces the over-engineered workbench
 * layout with a clean chat/REPL interface. User messages, system messages,
 * slash-command autocomplete, and inline confirmation prompts.
 */

import { Box, Text, useApp, useInput } from 'ink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Slash command autocomplete definitions
// ---------------------------------------------------------------------------

interface CommandSpec {
	command: string;
	description: string;
}

const COMMAND_SPECS: CommandSpec[] = [
	{ command: '/help', description: 'Show available commands' },
	{ command: '/status', description: 'Show workspace status' },
	{ command: '/continue', description: 'Resume intake session' },
	{ command: '/init', description: 'Initialize workspace' },
	{ command: '/generate', description: 'Generate documentation' },
	{ command: '/validate', description: 'Run validation checks' },
	{ command: '/diagnose', description: 'Run diagnostic analysis' },
	{ command: '/proposals list', description: 'List all proposals' },
	{ command: '/decisions list', description: 'List confirmed decisions' },
	{ command: '/config ai status', description: 'Show provider status' },
	{ command: '/root status', description: 'Show doc root config' },
	{ command: '/exit', description: 'Exit LOGOS' },
];

function getSuggestions(input: string, limit = 5): CommandSpec[] {
	const trimmed = input.trim();
	if (!trimmed.startsWith('/')) return [];
	return COMMAND_SPECS.filter((s) => s.command.startsWith(trimmed)).slice(
		0,
		limit,
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split multi-line system messages into individual lines for clean rendering.
 */
function flattenMessages(msgs: Message[]): Array<{
	sender: 'user' | 'system';
	text: string;
	msgId: number;
	lineIdx: number;
}> {
	const flat: Array<{
		sender: 'user' | 'system';
		text: string;
		msgId: number;
		lineIdx: number;
	}> = [];
	for (const msg of msgs) {
		const lines = msg.text.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? '';
			flat.push({ lineIdx: i, msgId: msg.id, sender: msg.sender, text: line });
		}
	}
	return flat;
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

	// Autocomplete state
	const [suggestionIndex, setSuggestionIndex] = useState(0);

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

	// Generate concise startup briefing on mount
	useEffect(() => {
		if (briefingShown.current) return;
		briefingShown.current = true;

		const projectRoot = ctx.root.rootPath ?? ctx.cwd;

		if (ctx.workspace.initializationState === 'initialized') {
			buildStartupBriefingInputFromContext(projectRoot)
				.then((briefingInput) => {
					const lines: string[] = [];
					lines.push('LOGOS ready.');

					if (briefingInput) {
						const parts: string[] = [];
						if (briefingInput.openQuestionCount > 0)
							parts.push(`Open questions: ${briefingInput.openQuestionCount}`);
						if (briefingInput.proposalCount > 0)
							parts.push(`Proposals: ${briefingInput.proposalCount}`);
						if (briefingInput.riskCount > 0)
							parts.push(`Risks: ${briefingInput.riskCount}`);
						if (parts.length > 0) {
							lines.push(parts.join(' · '));
						}
					}

					lines.push('Type /help for commands or /continue to resume intake.');
					addMessages(
						lines.map((text) => ({
							id: 0,
							sender: 'system' as const,
							text,
						})),
					);
				})
				.catch(() => {
					addMessages([
						{
							id: 0,
							sender: 'system',
							text: 'LOGOS ready. Type /help for available commands.',
						},
					]);
				});
		} else {
			addMessages([
				{
					id: 0,
					sender: 'system',
					text: 'LOGOS workspace not initialized. Run /init to begin.',
				},
			]);
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
				text: 'Cancelled. No changes were made.',
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
			return;
		}

		if (key.return) {
			if (processing) return;

			const suggestions = getSuggestions(input);
			let submitted = input;

			// If a suggestion is selected via arrows/tab, use that command
			if (
				suggestions.length > 0 &&
				suggestionIndex >= 0 &&
				suggestionIndex < suggestions.length
			) {
				submitted = suggestions[suggestionIndex]?.command ?? input;
			}

			setInput('');
			setSuggestionIndex(0);
			setProcessing(true);

			processCommand(submitted, context)
				.then(({ messages: cmdMessages, shouldExit, confirmationRequest }) => {
					// Add response messages (includes user echo as first message)
					if (cmdMessages.length > 0) {
						addMessages(cmdMessages);
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
		} else if (key.upArrow) {
			const suggestions = getSuggestions(input);
			if (suggestions.length > 0) {
				setSuggestionIndex((prev) =>
					prev <= 0 ? suggestions.length - 1 : prev - 1,
				);
			}
		} else if (key.downArrow) {
			const suggestions = getSuggestions(input);
			if (suggestions.length > 0) {
				setSuggestionIndex((prev) =>
					prev >= suggestions.length - 1 ? 0 : prev + 1,
				);
			}
		} else if (key.tab) {
			// Tab — cycle through suggestions
			if (input.startsWith('/')) {
				const suggestions = getSuggestions(input);
				if (suggestions.length > 0) {
					setSuggestionIndex((prev) => (prev + 1) % suggestions.length);
				}
			}
		} else if (key.backspace || key.delete) {
			setInput((prev) => prev.slice(0, -1));
			setSuggestionIndex(0);
		} else if (!key.ctrl && !key.meta && inputChar.length === 1) {
			setInput((prev) => {
				const next = prev + inputChar;
				// Reset suggestion index when typing changes the prefix
				setSuggestionIndex(0);
				return next;
			});
		}
	});

	// Determine visible messages (last N based on terminal height)
	const rows = process.stdout.rows;
	const visibleCount = Math.max(8, rows - 8);
	const visibleMessages = messages.slice(-visibleCount);
	const flatVisible = flattenMessages(visibleMessages);

	const suggestions = getSuggestions(input);

	return (
		<Box flexDirection="column" height="100%">
			{/* Message scroll area */}
			<Box flexDirection="column" flexGrow={1}>
				{flatVisible.map((line) => (
					<Box key={`${line.msgId}-${line.lineIdx}`}>
						<Text>
							{line.sender === 'user' ? (
								<Text color="cyan">You: </Text>
							) : (
								<Text color="green">LOGOS: </Text>
							)}
							<Text>{line.text}</Text>
						</Text>
					</Box>
				))}

				{/* Confirmation prompt */}
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

			{/* Autocomplete suggestions */}
			{!confirmation.inputBlocked && suggestions.length > 0 && (
				<Box flexDirection="column">
					{suggestions.map((s, i) => (
						<Box key={s.command}>
							<Text dimColor={i !== suggestionIndex}>
								{i === suggestionIndex ? '▶ ' : '  '}
								{s.command}
								{' — '}
								{s.description}
							</Text>
						</Box>
					))}
				</Box>
			)}

			{/* Command input */}
			{!confirmation.inputBlocked && (
				<Box>
					<Text>
						{'〉 '}
						{processing ? <Text dimColor>{input}…</Text> : <Text>{input}</Text>}
						<Text color="gray">│</Text>
					</Text>
				</Box>
			)}
		</Box>
	);
}
