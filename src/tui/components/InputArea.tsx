/**
 * Input Area component.
 *
 * Renders the user text input surface at the bottom of the conversation
 * panel. When disabled, shows the reason instead.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.7}
 */
import { Box, Text } from 'ink';
import type { InputRenderModel } from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';

// ─── InputArea props ────────────────────────────────────────────────────────

export type InputAreaProps = {
	readonly input: InputRenderModel;
	readonly focusedRegion: FocusRegion | null;
};

// ─── InputArea ──────────────────────────────────────────────────────────────

export function InputArea({ focusedRegion, input }: InputAreaProps) {
	const isInputFocused = focusedRegion === 'input';

	if (!input.enabled) {
		return (
			<Box marginTop={1}>
				<Text dimColor={true}>
					{input.reasonIfDisabled ?? 'Input disabled.'}
				</Text>
			</Box>
		);
	}

	if (isInputFocused) {
		return (
			<Box
				borderColor="blue"
				borderStyle="round"
				marginTop={1}
				paddingX={1}
			>
				<Text color="blue">
					▸ {input.placeholder ?? 'Type your answer…'}
				</Text>
			</Box>
		);
	}

	return (
		<Box
			borderColor="blue"
			borderStyle="round"
			marginTop={1}
			paddingX={1}
		>
			<Text dimColor={true}>
				{'>'} {input.placeholder ?? 'Type your answer…'}
			</Text>
		</Box>
	);
}
