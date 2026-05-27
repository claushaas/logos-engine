/**
 * Conversation Panel component.
 *
 * Renders the node-focused conversational surface:
 * - Breadcrumb showing Phase / Document / Node
 * - Node lifecycle status badge
 * - Scrollable conversation history (all messages except latest agent)
 * - Latest agent message rendered prominently
 * - Canonical answer preview
 * - Contextual action bar
 * - User input area
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.7}
 */
import { Box, Text } from 'ink';
import { useMemo } from 'react';
import type {
	ActionBarRenderModel,
	InputRenderModel,
	NodeConversationPanel,
} from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';
import { ActionBar } from './ActionBar.js';
import { CanonicalPreview } from './CanonicalPreview.js';
import { InputArea } from './InputArea.js';

// ─── ConversationPanel props ────────────────────────────────────────────────

export type ConversationPanelProps = {
	readonly panel: NodeConversationPanel;
	readonly actionBar: ActionBarRenderModel;
	readonly input: InputRenderModel;
	readonly focusedRegion: FocusRegion | null;
	readonly focusedActionIndex: number;
	readonly onSelectAction?: (actionId: string) => void;
	/** Current input buffer value (ephemeral TUI state). */
	readonly inputValue: string | undefined;
};

// ─── Lifecycle display names ────────────────────────────────────────────────

const LIFECYCLE_LABELS: Readonly<Record<string, string>> = {
	accepted: '✓ Accepted',
	active: '◐ In progress',
	answered: '◐ Answered',
	blocked: '⚠ Blocked',
	deferred: '⏸ Deferred',
	needs_clarification: '? Needs clarification',
	needs_refinement: '△ Needs refinement',
	not_started: '○ Not started',
	ready_for_synthesis: '◆ Ready for synthesis',
	synthesized: '◆ Awaiting review',
};

// ─── ConversationPanel ──────────────────────────────────────────────────────

export function ConversationPanel({
	actionBar,
	focusedActionIndex,
	focusedRegion,
	input,
	inputValue,
	onSelectAction,
	panel,
}: ConversationPanelProps) {
	const lifecycleLabel =
		LIFECYCLE_LABELS[panel.lifecycle] ?? panel.lifecycle;

	// ── Split messages: history + latest agent message ────────────────────

	const { historyMessages, latestAgentMessage } = useMemo(() => {
		const msgs = panel.messages;
		if (msgs.length === 0) {
			return { historyMessages: [], latestAgentMessage: undefined };
		}

		// Promote the latest agent message only when it is the
		// chronologically final message. If the user message comes
		// after the agent, render everything as plain history
		// to preserve chronological order.
		const lastMessage = msgs.at(-1)!;
		if (lastMessage.role === 'assistant') {
			return {
				historyMessages: msgs.slice(0, -1),
				latestAgentMessage: lastMessage,
			};
		}

		return { historyMessages: msgs, latestAgentMessage: undefined };
	}, [panel.messages]);

	const hasHistory = historyMessages.length > 0;

	// Avoid passing undefined onSelectAction — conditionally include
	const actionBarProps = onSelectAction !== undefined
		? { actionBar, focusedActionIndex, focusedRegion, onSelectAction }
		: { actionBar, focusedActionIndex, focusedRegion };

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			{/* Breadcrumb */}
			{panel.breadcrumb !== undefined && (
				<Box marginBottom={1}>
					<Text dimColor={true}>{panel.breadcrumb}</Text>
				</Box>
			)}

			{/* Title + lifecycle */}
			<Box marginBottom={1}>
				<Text bold={true}>{panel.title}</Text>
				<Text dimColor={true}> — {lifecycleLabel}</Text>
			</Box>

			{/* Conversation history (older messages, dimmed) */}
			{hasHistory && (
				<Box flexDirection="column" marginBottom={1}>
					<Text dimColor={true}>─── History ───</Text>
					{historyMessages.map((msg) => (
						<Box key={msg.id} marginTop={1}>
							<Text
								dimColor={true}
								color={msg.role === 'user' ? 'green' : 'cyan'}
							>
								{msg.role === 'user' ? 'You' : 'Agent'}
							</Text>
							<Text dimColor={true}>: {msg.content}</Text>
						</Box>
					))}
				</Box>
			)}

			{/* Latest agent message (prominent) */}
			{latestAgentMessage !== undefined ? (
				<Box flexDirection="column" marginBottom={1}>
					<Box>
						<Text bold={true} color="cyan">
							Agent
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text>{latestAgentMessage.content}</Text>
					</Box>
				</Box>
			) : panel.messages.length === 0 ? (
				<Box marginBottom={1}>
					<Text dimColor={true}>
						No messages yet. Start the conversation.
					</Text>
				</Box>
			) : null}

			{/* Canonical answer preview */}
			<CanonicalPreview panel={panel} />

			{/* Action bar */}
			<ActionBar {...actionBarProps} />

			{/* Input area */}
			<InputArea focusedRegion={focusedRegion} input={input} value={inputValue} />
		</Box>
	);
}
