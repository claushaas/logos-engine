import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type React from 'react';
import { useMemo, useState } from 'react';
import { createLogosApplicationServices } from '../application/logos-application-service.js';
import { loadCommandContext } from '../commands/command-context.js';
import { getSlashCommandCompletions } from '../commands/slash-command-autocomplete.js';
import { handleSlashCommand } from '../commands/slash-command-handlers.js';
import { parseSlashCommand } from '../commands/slash-command-parser.js';

export type LogosTuiAppProps = {
	readonly cwd: string;
};

type Message = {
	readonly body: readonly string[];
	readonly title: string;
	readonly tone: 'error' | 'normal';
};

export function LogosTuiApp({ cwd }: LogosTuiAppProps): React.ReactElement {
	const { exit } = useApp();
	const { isRawModeSupported } = useStdin();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<readonly Message[]>([
		{
			body: [
				'Type /help to see commands. Slash command autocomplete appears as you type.',
			],
			title: 'LOGOS Engine',
			tone: 'normal',
		},
	]);
	const context = useMemo(() => loadCommandContext(cwd), [cwd]);
	const services = useMemo(() => createLogosApplicationServices(), []);
	const completions = useMemo(
		() => getSlashCommandCompletions(input).slice(0, 5),
		[input],
	);
	const isInputActive = isRawModeSupported === true;

	useInput(
		(value, key) => {
			if (key.return) {
				const parseResult = parseSlashCommand(input);

				if (!parseResult.ok) {
					setMessages((currentMessages) => [
						...currentMessages,
						{
							body: [parseResult.error.message],
							title: 'Command error',
							tone: 'error',
						},
					]);
					setInput('');
					return;
				}

				const result = handleSlashCommand(
					parseResult.command,
					context,
					services,
				);

				setMessages((currentMessages) => [
					...currentMessages,
					{
						body: result.body,
						title: result.title,
						tone: 'normal',
					},
				]);
				setInput('');

				if (result.exitRequested) {
					exit();
				}

				return;
			}

			if (key.backspace || key.delete) {
				setInput((currentInput) => currentInput.slice(0, -1));
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
		<Box flexDirection="column">
			<Box flexDirection="column" marginBottom={1}>
				<Text bold>LOGOS Engine</Text>
				<Text dimColor>Local-first documentation and intent clarification</Text>
				<Text dimColor>Workspace: {context.cwd}</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				{messages.slice(-4).map((message) => (
					<Box
						flexDirection="column"
						key={`${message.title}:${message.body.join('|')}`}
					>
						{message.tone === 'error' ? (
							<Text bold color="red">
								{message.title}
							</Text>
						) : (
							<Text bold>{message.title}</Text>
						)}
						{message.body.map((line) => (
							<Text key={`${message.title}:${line}`}>{line}</Text>
						))}
					</Box>
				))}
			</Box>

			<Box>
				<Text color="cyan">{'> '}</Text>
				<Text>{input}</Text>
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
	);
}
