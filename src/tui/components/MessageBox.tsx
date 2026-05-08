import { Box, Text } from 'ink';
import type React from 'react';

export type MessageTone =
	| 'error'
	| 'info'
	| 'normal'
	| 'proposal'
	| 'success'
	| 'warning';

export type Message = {
	readonly body: readonly string[];
	readonly title: string;
	readonly tone: MessageTone;
};

type MessageBoxProps = {
	readonly message: Message;
};

export function MessageBox({ message }: MessageBoxProps): React.ReactElement {
	const titleColor = getTitleColor(message.tone);
	const borderColor = getBorderColor(message.tone);
	const prefix = getPrefix(message.tone);

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text bold color={titleColor}>
					{prefix}
					{message.title}
				</Text>
			</Box>
			<Box
				borderColor={borderColor}
				borderStyle="single"
				flexDirection="column"
			>
				{message.body.map((line) => (
					<Text key={`${message.title}:${line}`}>{line}</Text>
				))}
			</Box>
		</Box>
	);
}

function getTitleColor(tone: MessageTone): string {
	switch (tone) {
		case 'error':
			return 'red';
		case 'warning':
			return 'yellow';
		case 'success':
			return 'green';
		case 'info':
			return 'blue';
		case 'proposal':
			return 'magenta';
		default:
			return 'white';
	}
}

function getBorderColor(tone: MessageTone): string {
	switch (tone) {
		case 'error':
			return 'red';
		case 'warning':
			return 'yellow';
		case 'success':
			return 'green';
		case 'info':
			return 'blue';
		case 'proposal':
			return 'magenta';
		default:
			return 'gray';
	}
}

function getPrefix(tone: MessageTone): string {
	switch (tone) {
		case 'error':
			return '✗ ';
		case 'warning':
			return '⚠ ';
		case 'success':
			return '✓ ';
		case 'info':
			return 'ℹ ';
		case 'proposal':
			return '◆ ';
		default:
			return '';
	}
}
