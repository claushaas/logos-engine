/**
 * Conversation Panel component.
 *
 * Renders the node-focused conversational surface:
 * - Breadcrumb showing Phase / Document / Node
 * - Node lifecycle status badge
 * - Scrollable conversation history
 * - Canonical answer preview
 * - Contextual action bar
 * - User input area
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.7}
 */
import { Box, Text } from 'ink';
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
	onSelectAction,
	panel,
}: ConversationPanelProps) {
	const lifecycleLabel =
		LIFECYCLE_LABELS[panel.lifecycle] ?? panel.lifecycle;

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

			{/* Conversation messages */}
			{panel.messages.length > 0 ? (
				<Box flexDirection="column" marginBottom={1}>
					{panel.messages.map((msg) => (
						<Box key={msg.id} marginBottom={1}>
							<Text color={msg.role === 'user' ? 'green' : 'cyan'}>
								{msg.role === 'user' ? 'You' : 'Agent'}
							</Text>
							<Text>: {msg.content}</Text>
						</Box>
					))}
				</Box>
			) : (
				<Box marginBottom={1}>
					<Text dimColor={true}>
						No messages yet. Start the conversation.
					</Text>
				</Box>
			)}

			{/* Canonical answer preview */}
			<CanonicalPreview panel={panel} />

			{/* Action bar */}
			<ActionBar {...actionBarProps} />

			{/* Input area */}
			<InputArea focusedRegion={focusedRegion} input={input} />
		</Box>
	);
}
