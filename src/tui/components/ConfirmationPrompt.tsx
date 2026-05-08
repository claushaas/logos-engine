import { Box, Text } from 'ink';
import type React from 'react';

type ConfirmationPromptProps = {
	readonly message: string;
	readonly onConfirm: () => void;
	readonly onReject: () => void;
};

export function ConfirmationPrompt({
	message,
}: ConfirmationPromptProps): React.ReactElement {
	return (
		<Box borderColor="yellow" borderStyle="double" flexDirection="column">
			<Text bold color="yellow">
				⚠ Confirmation Required
			</Text>
			<Text>{message}</Text>
			<Text dimColor>Type 'yes' to confirm, or 'no' to cancel.</Text>
		</Box>
	);
}
