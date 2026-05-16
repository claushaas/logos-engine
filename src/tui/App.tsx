/** Ink TUI root component */

/** Ink TUI root component */

import { Box, Text, useApp, useInput } from 'ink';
import type React from 'react';
import { useCallback, useState } from 'react';
import { formatProviderStatus } from '../runtime/project-context.js';
import {
	createRouterContext,
	type Message,
	processCommand,
} from './shell-logic.js';

export function App(): React.JSX.Element {
	const { exit } = useApp();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Message[]>([]);
	const [nextId, setNextId] = useState(0);
	const context = createRouterContext();
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

	useInput((inputChar, key) => {
		if (key.return) {
			const { messages: newMessages, shouldExit } = processCommand(
				input,
				context,
			);
			if (newMessages.length > 0) {
				addMessages(newMessages);
			}
			if (shouldExit) {
				exit();
			}
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
			</Box>
			<Box>
				<Text>
					{'> '}
					{input}
					<Text color="gray">|</Text>
				</Text>
			</Box>
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
