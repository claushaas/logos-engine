/**
 * Export Panel component.
 *
 * Renders the export / outcome generation surface. Shows available
 * and blocked export formats with descriptions and reasons, lists
 * generated artifacts, and displays the output path on success.
 *
 * The TUI is a renderer only. It never calls exporters or writes
 * files directly. Export actions are dispatched as `ACTION_SELECTED`
 * events — the application layer handles the actual export.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.12}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */
import { Box, Text } from 'ink';
import type {
	ActionBarRenderModel,
	ExportPanel as ExportPanelModel,
	InputRenderModel,
} from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';
import { ActionBar } from './ActionBar.js';

// ─── ExportPanel props ──────────────────────────────────────────────────────

export type ExportPanelProps = {
	/** The fully-populated export panel data from the application layer. */
	readonly panel: ExportPanelModel;

	/** Action bar with per-format export actions and close. */
	readonly actionBar: ActionBarRenderModel;

	/** Input model (always disabled in export mode). */
	readonly input: InputRenderModel;

	/** Current focus region (for highlighting focused action). */
	readonly focusedRegion: FocusRegion | null;

	/** Currently focused action index in the action bar. */
	readonly focusedActionIndex: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format labels for export types (used in fallback derivation).
 */
const FORMAT_LABEL_MAP: Readonly<Record<string, string>> = {
	agent_pack: 'Agent Pack',
	html: 'HTML',
	markdown: 'Markdown',
};

/**
 * Derive export options from availableFormats when exportOptions is
 * absent or empty (legacy compat).
 */
function deriveExportOptions(
	panel: ExportPanelModel,
): Array<{
	readonly format: string;
	readonly label: string;
	readonly description: string;
	readonly available: boolean;
	readonly blockedReason?: string;
}> {
	if (panel.exportOptions !== undefined) {
		return panel.exportOptions;
	}

	// Legacy compat: derive from availableFormats.
	const allFormats = ['markdown', 'html', 'agent_pack'] as const;

	return allFormats.map((format) => {
		const available = panel.availableFormats.includes(format);

		return {
			available,
			description: '',
			format,
			label: FORMAT_LABEL_MAP[format] ?? format,
		};
	});
}

// ─── ExportPanel ────────────────────────────────────────────────────────────

export function ExportPanel({
	actionBar,
	focusedActionIndex,
	focusedRegion,
	panel,
}: ExportPanelProps) {
	const exportOptions = deriveExportOptions(panel);

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={2}>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold={true}>Export Outcomes</Text>
			</Box>

			{/* Export options list */}
			{exportOptions.length > 0 && (
				<Box flexDirection="column" marginBottom={1}>
					<Box marginBottom={1}>
						<Text bold={true}>Available Exports</Text>
					</Box>

					{exportOptions.map((opt) => {
						const icon = opt.available ? '✓' : '⚠';
						const iconColor = opt.available ? 'green' : 'yellow';

						return (
							<Box
								flexDirection="column"
								key={opt.format}
								marginBottom={1}
								paddingX={1}
							>
								{/* Format name + status icon */}
								<Box>
									<Text bold={true}>{opt.label}</Text>
									<Box marginLeft={1}>
										<Text color={iconColor}>{icon}</Text>
									</Box>
								</Box>

								{/* Description */}
								<Box>
									<Text dimColor={true}>{opt.description}</Text>
								</Box>

								{/* Blocked reason */}
								{!opt.available && opt.blockedReason !== undefined && (
									<Box>
										<Text color="yellow">
											Blocked: {opt.blockedReason}
										</Text>
									</Box>
								)}
							</Box>
						);
					})}
				</Box>
			)}

			{/* No export options */}
			{exportOptions.length === 0 && (
				<Box marginBottom={1}>
					<Text dimColor={true}>
						No export formats are currently available. Complete at least one
						document to unlock exports.
					</Text>
				</Box>
			)}

			{/* Generated artifacts */}
			{panel.generatedArtifacts.length > 0 && (
				<Box flexDirection="column" marginBottom={1}>
					<Box marginBottom={1}>
						<Text bold={true}>Generated Artifacts</Text>
					</Box>
					{panel.generatedArtifacts.map((a) => (
						<Box key={a.id} paddingLeft={1}>
							<Text>
								{a.type} → {a.path}
								{a.stale ? ' (stale)' : ''}
							</Text>
						</Box>
					))}
				</Box>
			)}

			{/* Output path on success */}
			{panel.outputPath !== undefined && (
				<Box marginBottom={1}>
					<Text color="green">
						Exported to {panel.outputPath}
					</Text>
				</Box>
			)}

			{/* Action bar */}
			{actionBar.actions.length > 0 && (
				<Box marginTop={1}>
					<ActionBar
						actionBar={actionBar}
						focusedActionIndex={focusedActionIndex}
						focusedRegion={focusedRegion}
					/>
				</Box>
			)}
		</Box>
	);
}
