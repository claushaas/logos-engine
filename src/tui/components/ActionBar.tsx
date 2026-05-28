/**
 * Action Bar component.
 *
 * Renders the contextual actions from the state engine's allowed actions.
 * Disabled actions are shown dimmed. Focused actions are highlighted.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.9}
 */
import { Box, Text } from 'ink';
import type { ActionBarRenderModel } from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';

// ─── ActionBar props ────────────────────────────────────────────────────────

export type ActionBarProps = {
	readonly actionBar: ActionBarRenderModel;
	readonly focusedRegion: FocusRegion | null;
	readonly focusedActionIndex: number;
	readonly onSelectAction?: (actionId: string) => void;
};

// ─── Action item helper (avoids passing undefined color) ────────────────────

function ActionItem({
	isDisabled,
	isFocused,
	label,
}: {
	readonly isDisabled: boolean;
	readonly isFocused: boolean;
	readonly label: string;
}) {
	if (isDisabled) {
		return (
			<Box marginRight={1}>
				<Text color="gray" dimColor={true}>
					{label}
				</Text>
			</Box>
		);
	}

	return (
		<Box marginRight={1}>
			<Text bold={isFocused} inverse={isFocused}>
				{isFocused ? '▶ ' : ''}
				{label}
			</Text>
		</Box>
	);
}

// ─── ActionBar ──────────────────────────────────────────────────────────────

export function ActionBar({
	actionBar,
	focusedActionIndex,
	focusedRegion,
	onSelectAction,
}: ActionBarProps) {
	if (actionBar.actions.length === 0) {
		return null;
	}

	const isActionsFocused = focusedRegion === 'actions';

	return (
		<Box flexDirection="row" gap={1} marginTop={1}>
			<Text dimColor={true}>Actions: </Text>

			{actionBar.actions.map((action, idx) => (
				<ActionItem
					isDisabled={!action.enabled}
					isFocused={isActionsFocused && focusedActionIndex === idx}
					key={action.id}
					label={action.label}
				/>
			))}
		</Box>
	);
}
