/**
 * Canonical Answer Preview component.
 *
 * Renders the canonical answer content for the active node when available.
 * Shows confidence level, source message count, and status badge
 * (Accepted / Draft / Stale).
 *
 * Badge priority:
 * - Stale if `canonicalAnswerStale`
 * - Accepted if `canonicalAnswerAccepted`
 * - Draft otherwise
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.8}
 */
import { Box, Text } from 'ink';
import type { NodeConversationPanel } from '../../contracts/index.js';

// ─── CanonicalPreview props ─────────────────────────────────────────────────

export type CanonicalPreviewProps = {
	readonly panel: NodeConversationPanel;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveStatusLabel(panel: NodeConversationPanel): string {
	if (panel.canonicalAnswerStale === true) {
		return 'STALE';
	}
	if (panel.canonicalAnswerAccepted) {
		return 'ACCEPTED';
	}
	return 'DRAFT';
}

// ─── CanonicalPreview ───────────────────────────────────────────────────────

export function CanonicalPreview({ panel }: CanonicalPreviewProps) {
	if (panel.canonicalAnswerPreview === null) {
		return null;
	}

	const statusLabel = resolveStatusLabel(panel);

	return (
		<Box
			borderColor="yellow"
			borderStyle="single"
			flexDirection="column"
			marginY={1}
			paddingX={1}
		>
			{/* Header with status badge */}
			<Box>
				<Text bold={true} color="yellow">
					CANONICAL ANSWER
				</Text>
				<Text> (</Text>
				<Text bold={true}>{statusLabel}</Text>
				<Text>)</Text>
			</Box>

			{/* Content */}
			<Box marginTop={1}>
				<Text>{panel.canonicalAnswerPreview}</Text>
			</Box>

			{/* Metadata: confidence + source message count */}
			{(panel.canonicalAnswerConfidence !== undefined ||
				panel.canonicalAnswerSourceMessageCount !== undefined) && (
				<Box marginTop={1}>
					{panel.canonicalAnswerConfidence !== undefined && (
						<Text dimColor={true}>
							Confidence: {panel.canonicalAnswerConfidence}
						</Text>
					)}
					{panel.canonicalAnswerConfidence !== undefined &&
						panel.canonicalAnswerSourceMessageCount !== undefined && (
							<Text dimColor={true}>  ·  </Text>
						)}
					{panel.canonicalAnswerSourceMessageCount !== undefined && (
						<Text dimColor={true}>
							Generated from{' '}
							{panel.canonicalAnswerSourceMessageCount} messages
						</Text>
					)}
				</Box>
			)}

			{/* Completeness summary (if available) */}
			{panel.completenessSummary !== undefined && (
				<Box marginTop={1}>
					<Text dimColor={true}>{panel.completenessSummary}</Text>
				</Box>
			)}
		</Box>
	);
}
