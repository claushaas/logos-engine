import { Box, Text } from 'ink';
import type React from 'react';

type ProgressBarProps = {
	readonly label?: string;
	readonly width?: number;
} & (
	| { readonly percent: number }
	| { readonly fraction: readonly [number, number] }
);

export function ProgressBar(props: ProgressBarProps): React.ReactElement {
	const width = props.width ?? 20;
	const percent =
		'percent' in props
			? props.percent
			: props.fraction[1] === 0
				? 0
				: Math.round((props.fraction[0] / props.fraction[1]) * 100);
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;

	return (
		<Box>
			{props.label ? <Text>{props.label}: </Text> : null}
			<Text color="cyan">{'█'.repeat(filled)}</Text>
			<Text color="gray">{'░'.repeat(empty)}</Text>
			<Text> {percent}%</Text>
		</Box>
	);
}
