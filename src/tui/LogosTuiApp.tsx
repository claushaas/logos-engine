import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { createLogosApplicationServices } from '../application/logos-application-service.js';
import { loadCommandContext } from '../commands/command-context.js';
import { getSlashCommandCompletions } from '../commands/slash-command-autocomplete.js';
import { handleSlashCommand } from '../commands/slash-command-handlers.js';
import type { ParsedSlashCommand } from '../commands/slash-command-parser.js';
import { parseSlashCommand } from '../commands/slash-command-parser.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import { detectProjectRoot } from '../storage/project-root.js';
import { ConfirmationPrompt } from './components/ConfirmationPrompt.js';
import {
	type ConversationMessage,
	ConversationMessage as ConversationMessageComponent,
} from './components/ConversationMessage.js';
import {
	type Message,
	MessageBox,
	type MessageTone,
} from './components/MessageBox.js';
import { ProviderNotice } from './components/ProviderNotice.js';
import { StatusBar } from './components/StatusBar.js';

export type LogosTuiAppProps = {
	readonly cwd: string;
};

type PendingConfirmation = {
	readonly message: string;
	readonly onConfirm: () => void;
	readonly onReject: () => void;
};

type DisplayMessage =
	| { readonly kind: 'system'; readonly message: Message }
	| { readonly kind: 'conversation'; readonly message: ConversationMessage };

const pendingAiResponseText = 'Thinking...';

export function LogosTuiApp({ cwd }: LogosTuiAppProps): React.ReactElement {
	const { exit } = useApp();
	const { isRawModeSupported } = useStdin();
	const [input, setInput] = useState('');
	const [displayMessages, setDisplayMessages] = useState<
		readonly DisplayMessage[]
	>([
		{
			kind: 'system',
			message: {
				body: [
					'Type naturally to start an AI-led conversation about your project.',
					'Slash commands such as /help, /continue, /status, and /generate are always available.',
				],
				title: 'LOGOS Engine',
				tone: 'info',
			},
		},
	]);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [pendingConfirmation, setPendingConfirmation] =
		useState<PendingConfirmation | null>(null);

	const context = useMemo(() => loadCommandContext(cwd), [cwd]);
	const services = useMemo(() => createLogosApplicationServices(), []);
	const completions = useMemo(
		() => getSlashCommandCompletions(input).slice(0, 5),
		[input],
	);

	const providerConfig = useMemo(() => {
		try {
			const projectRoot = detectProjectRoot(cwd);
			if (projectRoot) {
				const workspace = readWorkspaceState(projectRoot);
				return workspace.config.ai;
			}
		} catch {
			// No workspace yet
		}
		return {
			enabled: false,
			provider: null,
			remoteContextDisclosureAccepted: false,
		};
	}, [cwd]);

	const isInputActive = isRawModeSupported === true;
	const maxVisibleMessages = 6;
	const maxScroll = Math.max(0, displayMessages.length - maxVisibleMessages);
	const visibleMessages = displayMessages.slice(
		Math.max(0, Math.min(scrollOffset, maxScroll)),
		Math.max(0, Math.min(scrollOffset, maxScroll)) + maxVisibleMessages,
	);

	const addSystemMessage = useCallback(
		(body: readonly string[], title: string, tone: MessageTone) => {
			setDisplayMessages((current) => {
				const newMessages: DisplayMessage[] = [
					...current,
					{ kind: 'system', message: { body, title, tone } },
				];
				const newMaxScroll = Math.max(
					0,
					newMessages.length - maxVisibleMessages,
				);
				setScrollOffset(newMaxScroll);
				return newMessages;
			});
		},
		[],
	);

	const addConversationMessages = useCallback(
		(userText: string, aiTexts: readonly string[]) => {
			setDisplayMessages((current) => {
				const now = new Date().toISOString();
				const newMessages: DisplayMessage[] = [
					...current,
					{
						kind: 'conversation',
						message: {
							body: [userText],
							role: 'user',
							timestamp: now,
						},
					},
				];

				if (aiTexts.length > 0) {
					newMessages.push({
						kind: 'conversation',
						message: {
							body: [...aiTexts],
							role: 'ai',
							timestamp: now,
						},
					});
				}

				const newMaxScroll = Math.max(
					0,
					newMessages.length - maxVisibleMessages,
				);
				setScrollOffset(newMaxScroll);
				return newMessages;
			});
		},
		[],
	);

	const handleConversationInput = useCallback(
		async (text: string) => {
			addConversationMessages(text, [pendingAiResponseText]);

			let result: Awaited<
				ReturnType<typeof services.handleConversationMessage>
			>;

			try {
				result = await services.handleConversationMessage(context, text);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				setDisplayMessages((current) => {
					const nextMessages = replacePendingAiMessage(current, [
						`AI response failed: ${message}. Session preserved.`,
					]);
					const newMaxScroll = Math.max(
						0,
						nextMessages.length - maxVisibleMessages,
					);
					setScrollOffset(newMaxScroll);
					return nextMessages;
				});
				return;
			}

			const aiMessages =
				result.aiMessages.length > 0
					? result.aiMessages
					: [
							'No AI response was returned. Try again or run /config ai --test.',
						];

			setDisplayMessages((current) => {
				const nextMessages = replacePendingAiMessage(current, aiMessages);
				const newMaxScroll = Math.max(
					0,
					nextMessages.length - maxVisibleMessages,
				);
				setScrollOffset(newMaxScroll);
				return nextMessages;
			});

			if (result.status === 'error') {
				addSystemMessage(
					[
						'The conversation turn was preserved, but the AI response failed.',
						'Run /config ai --test to inspect provider configuration.',
					],
					'AI response failed',
					'error',
				);
				return;
			}

			if (result.status === 'no_provider') {
				addSystemMessage(
					[
						result.providerNotice,
						'Slash commands (/init, /status, /validate, /diagnose, /generate, /config ai, /help, /exit) are available without a provider.',
						'Type /config ai to configure a provider (local or remote).',
					],
					'AI Provider Required',
					'warning',
				);
				return;
			}

			if (result.providerStatus !== 'remote_ready') {
				addSystemMessage([result.providerNotice], 'Provider notice', 'info');
			}
		},
		[addConversationMessages, addSystemMessage, context, services],
	);

	const executeCommand = useCallback(
		async (commandInput: string) => {
			const parseResult = parseSlashCommand(commandInput);

			if (!parseResult.ok) {
				addSystemMessage([parseResult.error.message], 'Command error', 'error');
				return;
			}

			const command = parseResult.command;

			if (
				command.definition.id === '/generate' &&
				command.args.includes('--force')
			) {
				setPendingConfirmation({
					message:
						'Force generate will overwrite all existing generated documents. This cannot be undone.',
					onConfirm: () => {
						setPendingConfirmation(null);
						void runCommand(command, context, services, addSystemMessage, exit);
					},
					onReject: () => {
						setPendingConfirmation(null);
						addSystemMessage(
							['Force generate cancelled. No files were changed.'],
							'Cancelled',
							'warning',
						);
					},
				});
				return;
			}

			void runCommand(command, context, services, addSystemMessage, exit);
		},
		[addSystemMessage, context, exit, services],
	);

	useInput(
		(value, key) => {
			if (pendingConfirmation) {
				if (key.return) {
					const normalized = input.trim().toLowerCase();
					if (normalized === 'yes' || normalized === 'y') {
						pendingConfirmation.onConfirm();
					} else {
						pendingConfirmation.onReject();
					}
					setInput('');
				} else if (key.backspace || key.delete) {
					setInput((currentInput) => currentInput.slice(0, -1));
				} else if (value) {
					setInput((currentInput) => `${currentInput}${value}`);
				}
				return;
			}

			if (key.return) {
				const trimmed = input.trim();

				if (trimmed.length === 0) {
					return;
				}

				if (trimmed.startsWith('/')) {
					void executeCommand(trimmed);
				} else {
					void handleConversationInput(trimmed);
				}

				setInput('');
				return;
			}

			if (key.backspace || key.delete) {
				setInput((currentInput) => currentInput.slice(0, -1));
				return;
			}

			if (key.upArrow) {
				setScrollOffset((current) => Math.max(0, current - 1));
				return;
			}

			if (key.downArrow) {
				setScrollOffset((current) => Math.min(maxScroll, current + 1));
				return;
			}

			if (key.tab && completions[0] && input.startsWith('/')) {
				setInput(completions[0].insertText);
				return;
			}

			if (value) {
				setInput((currentInput) => `${currentInput}${value}`);
			}
		},
		{ isActive: isInputActive },
	);

	return (
		<Box flexDirection="column" height="100%">
			<Box flexDirection="column" marginBottom={1}>
				<Text bold>LOGOS Engine</Text>
				<Text dimColor>Local-first documentation and intent clarification</Text>
				<Text dimColor>Workspace: {context.cwd}</Text>
			</Box>

			<ProviderNotice config={providerConfig} />

			<Box flexDirection="column" flexGrow={1} marginY={1}>
				{visibleMessages.map((display) => {
					if (display.kind === 'system') {
						return (
							<MessageBox
								key={`sys:${display.message.title}:${display.message.body[0]?.slice(0, 20) ?? ''}`}
								message={display.message}
							/>
						);
					}
					return (
						<ConversationMessageComponent
							key={`conv:${display.message.role}:${display.message.timestamp}`}
							message={display.message}
						/>
					);
				})}
			</Box>

			{pendingConfirmation ? (
				<Box marginBottom={1}>
					<ConfirmationPrompt
						message={pendingConfirmation.message}
						onConfirm={pendingConfirmation.onConfirm}
						onReject={pendingConfirmation.onReject}
					/>
				</Box>
			) : null}

			<Box flexDirection="column">
				<Box>
					<Text color="cyan">{'> '}</Text>
					<Text>{input}</Text>
					<Text color="gray">_ </Text>
				</Box>

				{completions.length > 0 && input.startsWith('/') ? (
					<Box flexDirection="column" marginTop={1}>
						{completions.map((completion) => (
							<Text dimColor key={completion.label}>
								{completion.label} - {completion.description}
							</Text>
						))}
					</Box>
				) : null}
			</Box>

			<StatusBar
				messageCount={displayMessages.length}
				providerStatus={getProviderStatusText(providerConfig)}
				scrollPosition={Math.min(scrollOffset, maxScroll)}
			/>
		</Box>
	);
}

function replacePendingAiMessage(
	messages: readonly DisplayMessage[],
	aiMessages: readonly string[],
): DisplayMessage[] {
	let pendingIndex = -1;

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const item = messages[index];

		if (
			item?.kind === 'conversation' &&
			item.message.role === 'ai' &&
			item.message.body.length === 1 &&
			item.message.body[0] === pendingAiResponseText
		) {
			pendingIndex = index;
			break;
		}
	}

	const replacement: DisplayMessage = {
		kind: 'conversation',
		message: {
			body: [...aiMessages],
			role: 'ai',
			timestamp: new Date().toISOString(),
		},
	};

	if (pendingIndex === -1) {
		return [...messages, replacement];
	}

	return [
		...messages.slice(0, pendingIndex),
		replacement,
		...messages.slice(pendingIndex + 1),
	];
}

async function runCommand(
	command: ParsedSlashCommand,
	context: ReturnType<typeof loadCommandContext>,
	services: ReturnType<typeof createLogosApplicationServices>,
	addMessage: (
		body: readonly string[],
		title: string,
		tone: MessageTone,
	) => void,
	exitApp: () => void,
): Promise<void> {
	const result = await handleSlashCommand(command, context, services);

	const tone: MessageTone =
		result.status === 'error'
			? 'error'
			: result.status === 'not_implemented'
				? 'warning'
				: 'normal';

	addMessage(result.body, result.title, tone);

	if (result.exitRequested) {
		exitApp();
	}
}

function getProviderStatusText(config: {
	enabled: boolean;
	provider: string | null;
	remoteContextDisclosureAccepted: boolean;
}): string {
	if (!config.enabled || !config.provider) {
		return 'AI: off';
	}
	if (config.provider === 'mock') {
		return 'AI: mock';
	}
	if (!config.remoteContextDisclosureAccepted) {
		return 'AI: pending';
	}
	return `AI: ${config.provider}`;
}
