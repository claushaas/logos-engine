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

export function LogosTuiApp({ cwd }: LogosTuiAppProps): React.ReactElement {
	const { exit } = useApp();
	const { isRawModeSupported } = useStdin();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<readonly Message[]>([
		{
			body: [
				'Type /help to see commands. Slash command autocomplete appears as you type.',
				'Type /status to see project progress.',
			],
			title: 'LOGOS Engine',
			tone: 'info',
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

	// Load workspace config for provider notice
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
	const maxScroll = Math.max(0, messages.length - maxVisibleMessages);
	const visibleMessages = messages.slice(
		Math.max(0, Math.min(scrollOffset, maxScroll)),
		Math.max(0, Math.min(scrollOffset, maxScroll)) + maxVisibleMessages,
	);

	const addMessage = useCallback(
		(body: readonly string[], title: string, tone: MessageTone) => {
			setMessages((currentMessages) => {
				const newMessages = [...currentMessages, { body, title, tone }];
				// Auto-scroll to bottom on new message
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

	const executeCommand = useCallback(
		async (commandInput: string) => {
			const parseResult = parseSlashCommand(commandInput);

			if (!parseResult.ok) {
				addMessage([parseResult.error.message], 'Command error', 'error');
				return;
			}

			const command = parseResult.command;

			// Check for destructive actions that need confirmation
			if (
				command.definition.id === '/generate' &&
				command.args.includes('--force')
			) {
				setPendingConfirmation({
					message:
						'Force generate will overwrite all existing generated documents. This cannot be undone.',
					onConfirm: () => {
						setPendingConfirmation(null);
						void runCommand(command, context, services, addMessage, exit);
					},
					onReject: () => {
						setPendingConfirmation(null);
						addMessage(
							['Force generate cancelled. No files were changed.'],
							'Cancelled',
							'warning',
						);
					},
				});
				return;
			}

			void runCommand(command, context, services, addMessage, exit);
		},
		[addMessage, context, exit, services],
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
				void executeCommand(input);
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

			if (key.tab && completions[0]) {
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
				{visibleMessages.map((message) => (
					<MessageBox
						key={`${message.title}:${message.body.join('|')}`}
						message={message}
					/>
				))}
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

				{completions.length > 0 ? (
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
				messageCount={messages.length}
				providerStatus={getProviderStatusText(providerConfig)}
				scrollPosition={Math.min(scrollOffset, maxScroll)}
			/>
		</Box>
	);
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
