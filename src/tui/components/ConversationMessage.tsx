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
				{message.body.map((line) => (
					<Text key={`${message.role}:${line.slice(0, 20)}`}>{line}</Text>
				))}
			</Box>
		</Box>
	);
}
