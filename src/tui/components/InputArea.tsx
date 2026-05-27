/**
 * Input Area component.
 *
 * Renders the user text input surface at the bottom of the conversation
 * panel. Visible only when `InputRenderModel.enabled` is true. Returns
 * `null` when disabled (input hidden for blocked/accepted/review states).
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
	/** Current input buffer value (ephemeral TUI state). */
	readonly value: string | undefined;
};

// ─── InputArea ──────────────────────────────────────────────────────────────

export function InputArea({ focusedRegion, input, value }: InputAreaProps) {
	const isInputFocused = focusedRegion === 'input';

	// Hidden when input is not enabled (blocked, accepted, review, etc.)
	if (!input.enabled) {
		return null;
	}

	const displayText = value !== undefined && value.length > 0
		? value
		: input.placeholder ?? 'Type your answer…';

	if (isInputFocused) {
		return (
			<Box
				borderColor="blue"
				borderStyle="round"
				marginTop={1}
				paddingX={1}
			>
				<Text color="blue">
					▸ {displayText}
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
				{'>>>'} {displayText}
			</Text>
		</Box>
	);
}
