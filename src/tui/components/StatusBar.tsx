import { Box, Text } from 'ink';
import type React from 'react';

type StatusBarProps = {
	readonly messageCount: number;
	readonly providerStatus: string;
	readonly scrollPosition: number;
};

export function StatusBar({
	messageCount,
	providerStatus,
	scrollPosition,
}: StatusBarProps): React.ReactElement {
	return (
		<Box
			borderColor="gray"
			borderStyle="single"
			flexDirection="row"
			justifyContent="space-between"
			paddingLeft={1}
			paddingRight={1}
		>
			<Text dimColor>
				Messages: {scrollPosition + 1}/{messageCount}
			</Text>
			<Text dimColor>{providerStatus}</Text>
			<Text dimColor>↑/↓ to scroll</Text>
		</Box>
	);
}
