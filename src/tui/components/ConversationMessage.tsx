import { Box, Text } from 'ink';
import type React from 'react';

export type ConversationMessageRole = 'user' | 'ai';

export type ConversationMessage = {
	readonly body: readonly string[];
	readonly role: ConversationMessageRole;
	readonly timestamp: string;
};

type ConversationMessageProps = {
	readonly message: ConversationMessage;
};

export function ConversationMessage({
	message,
}: ConversationMessageProps): React.ReactElement {
	const isAi = message.role === 'ai';
	const roleLabel = isAi ? 'LOGOS' : 'You';
	const seenLines = new Map<string, number>();
	const bodyLines = message.body.map((line) => {
		const occurrence = seenLines.get(line) ?? 0;
		seenLines.set(line, occurrence + 1);

		return {
			key: `${message.role}:${message.timestamp}:${occurrence}:${line.slice(0, 20)}`,
			line,
		};
	});

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text bold color={isAi ? 'cyan' : 'green'}>
					{roleLabel}
				</Text>
				<Text dimColor> ({message.timestamp.slice(11, 19)})</Text>
			</Box>
			<Box
				borderColor={isAi ? 'cyan' : 'green'}
				borderStyle={isAi ? 'single' : 'round'}
				flexDirection="column"
			>
				{bodyLines.map(({ key, line }) => (
					<Text key={key}>{line}</Text>
				))}
			</Box>
		</Box>
	);
}
