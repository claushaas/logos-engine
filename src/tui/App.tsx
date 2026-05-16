/** Ink TUI root component */

import { Box, Text, useApp, useInput } from 'ink';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	buildDeterministicStartupBriefing,
	renderStartupBriefing,
} from '../intake/index.js';
import { formatProviderStatus } from '../runtime/project-context.js';
import {
	buildStartupBriefingInputFromContext,
	createRouterContext,
	type Message,
	processCommand,
} from './shell-logic.js';

export function App(): React.JSX.Element {
	const { exit } = useApp();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Message[]>([]);
	const [nextId, setNextId] = useState(0);
	const [processing, setProcessing] = useState(false);
	const context = createRouterContext();
	const ctx = context.projectContext;
	const briefingShown = useRef(false);

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

	useInput((inputChar, key) => {
		if (key.return) {
			if (processing) return;
			const submitted = input;
			setProcessing(true);
			processCommand(submitted, context).then(
				({ messages: newMessages, shouldExit }) => {
					if (newMessages.length > 0) {
						addMessages(newMessages);
					}
					if (shouldExit) {
						exit();
					}
					setProcessing(false);
				},
			);
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
