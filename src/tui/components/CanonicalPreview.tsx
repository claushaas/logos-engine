/**
 * Canonical Answer Preview component.
 *
 * Renders the canonical answer content for the active node when available.
 * Shows confidence level and generation metadata.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.8}
 */
import { Box, Text } from 'ink';
import type { NodeConversationPanel } from '../../contracts/index.js';

// ─── CanonicalPreview props ─────────────────────────────────────────────────

export type CanonicalPreviewProps = {
	readonly panel: NodeConversationPanel;
};

// ─── CanonicalPreview ───────────────────────────────────────────────────────

export function CanonicalPreview({ panel }: CanonicalPreviewProps) {
	if (panel.canonicalAnswerPreview === null) {
		return null;
	}

	const statusLabel = panel.canonicalAnswerAccepted ? 'ACCEPTED' : 'DRAFT';

	return (
		<Box
			borderColor="yellow"
			borderStyle="single"
			flexDirection="column"
			marginY={1}
			paddingX={1}
		>
			<Box>
				<Text bold={true} color="yellow">
					CANONICAL ANSWER ({statusLabel})
				</Text>
			</Box>

			<Box marginTop={1}>
				<Text>{panel.canonicalAnswerPreview}</Text>
			</Box>

			{panel.completenessSummary !== undefined && (
				<Box marginTop={1}>
					<Text dimColor={true}>{panel.completenessSummary}</Text>
				</Box>
			)}
		</Box>
	);
}
