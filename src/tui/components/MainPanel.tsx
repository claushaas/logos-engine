/**
 * Main Panel component.
 *
 * Renders mode-specific content by switching on `mainPanel.kind`.
 * Each panel variant gets its own rendering block.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.7}
 */
import { Box, Text } from 'ink';
import type {
	ActionBarRenderModel,
	InputRenderModel,
	MainPanelRenderModel,
} from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';
import { ConversationPanel } from './ConversationPanel.js';
import { DocumentPreview } from './DocumentPreview.js';
import { ActionBar } from './ActionBar.js';

// ─── MainPanel props ────────────────────────────────────────────────────────

export type MainPanelProps = {
	readonly mainPanel: MainPanelRenderModel;
	readonly actionBar: ActionBarRenderModel;
	readonly input: InputRenderModel;
	readonly focusedRegion: FocusRegion | null;
	readonly focusedActionIndex: number;
	readonly onSelectAction?: (actionId: string) => void;
	/** Current input buffer value (ephemeral TUI state). */
	readonly inputValue: string | undefined;
	/** Callback when user navigates to a missing node from document preview. */
	readonly onSelectMissingNode?: ((nodeId: string) => void) | undefined;
};

// ─── MainPanel ──────────────────────────────────────────────────────────────

export function MainPanel({
	actionBar,
	focusedActionIndex,
	focusedRegion,
	input,
	inputValue,
	mainPanel,
	onSelectAction,
	onSelectMissingNode,
}: MainPanelProps) {
	switch (mainPanel.kind) {
		// ── Idle ─────────────────────────────────────────────────────────

		case 'idle':
			return (
				<Box flexDirection="column" flexGrow={1} paddingX={2}>
					<Box marginBottom={1}>
						<Text bold={true}>Welcome to LOGOS Engine</Text>
					</Box>
					<Box marginBottom={1}>
						<Text>
							LOGOS helps you produce structured documentation
							through guided conversation. Each decision,
							assumption, and insight is captured as canonical
							source material.
						</Text>
					</Box>
					<Box>
						<Text dimColor={true}>
							To begin, select a project profile.
						</Text>
					</Box>
					<ActionBar
						actionBar={actionBar}
						focusedActionIndex={focusedActionIndex}
						focusedRegion={focusedRegion}
					/>
				</Box>
			);

		// ── Profile / Structure overview ─────────────────────────────────

		case 'profile':
			return (
				<Box flexDirection="column" flexGrow={1} paddingX={2}>
					<Box marginBottom={1}>
						<Text bold={true}>Structure Overview</Text>
					</Box>
					{mainPanel.message !== undefined && (
						<Box marginBottom={1}>
							<Text>{mainPanel.message}</Text>
						</Box>
					)}
					<Box>
						<Text dimColor={true}>
							Select a node from the sidebar to begin.
						</Text>
					</Box>
				</Box>
			);

		// ── Node conversation ────────────────────────────────────────────

		case 'node_conversation': {
			const convProps = onSelectAction !== undefined
				? {
						actionBar,
						focusedActionIndex,
						focusedRegion,
						input,
						inputValue,
						onSelectAction,
						panel: mainPanel,
				  }
				: {
						actionBar,
						focusedActionIndex,
						focusedRegion,
						input,
						inputValue,
						panel: mainPanel,
				  };

			return <ConversationPanel {...convProps} />;
		}

		// ── Document preview ─────────────────────────────────────────────

		case 'document_preview':
			return (
				<DocumentPreview
					actionBar={actionBar}
					focusedActionIndex={focusedActionIndex}
					focusedRegion={focusedRegion}
					input={input}
					panel={mainPanel}
					onSelectAction={onSelectAction}
					onSelectMissingNode={onSelectMissingNode}
				/>
			);

		// ── Export ───────────────────────────────────────────────────────

		case 'export':
			return (
				<Box flexDirection="column" flexGrow={1} paddingX={2}>
					<Box marginBottom={1}>
						<Text bold={true}>Export</Text>
					</Box>
					<Box marginBottom={1}>
						<Text>
							Available formats:{' '}
							{mainPanel.availableFormats.join(', ')}
						</Text>
					</Box>
					{mainPanel.generatedArtifacts.length > 0 && (
						<Box marginBottom={1} flexDirection="column">
							<Text bold={true}>Generated artifacts:</Text>
							{mainPanel.generatedArtifacts.map((a) => (
								<Box key={a.id}>
									<Text>
										{a.type} - {a.path}{' '}
										{a.stale ? '(stale)' : ''}
									</Text>
								</Box>
							))}
						</Box>
					)}
				</Box>
			);

		// ── Settings ─────────────────────────────────────────────────────

		case 'settings':
			return (
				<Box flexDirection="column" flexGrow={1} paddingX={2}>
					<Box marginBottom={1}>
						<Text bold={true}>Settings</Text>
					</Box>
					<Box>
						<Text dimColor={true}>
							Settings panel is not yet implemented.
						</Text>
					</Box>
				</Box>
			);

		// ── Error ────────────────────────────────────────────────────────

		case 'error':
			return (
				<Box flexDirection="column" flexGrow={1} paddingX={2}>
					<Box marginBottom={1}>
						<Text bold={true} color="red">
							Error
						</Text>
					</Box>
					<Box marginBottom={1}>
						<Text color="red">{mainPanel.message}</Text>
					</Box>
					{mainPanel.recoveryHint !== undefined && (
						<Box>
							<Text dimColor={true}>
								{mainPanel.recoveryHint}
							</Text>
						</Box>
					)}
				</Box>
			);

		default:
			return (
				<Box flexDirection="column" flexGrow={1} paddingX={2}>
					<Text dimColor={true}>Unknown panel kind.</Text>
				</Box>
			);
	}
}
