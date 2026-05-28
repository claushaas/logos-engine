/**
 * Error Panel component.
 *
 * Renders when the session enters error mode (`mode === "error"`).
 * Shows the error message, diagnostic details (code, category),
 * recoverability distinction (recoverable vs fatal), and recovery
 * action buttons.
 *
 * The TUI is a renderer only. Recovery actions are dispatched as
 * `ACTION_SELECTED` events via the existing action bar dispatch
 * mechanism.
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md §10-11}
 * @see {@link https://logos-engine/docs/13-prototypes.md Appendix C}
 */
import { Box, Text } from 'ink';
import type {
	ActionBarRenderModel,
	ErrorPanel,
	InputRenderModel,
} from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';
import { ActionBar } from './ActionBar.js';

// ─── ErrorPanel props ───────────────────────────────────────────────────────

export type ErrorPanelProps = {
	/** The error panel render model from the snapshot. */
	readonly panel: ErrorPanel;

	/** Action bar with recovery actions (built by the render model builder). */
	readonly actionBar: ActionBarRenderModel;

	/** Input model (always disabled in error mode). */
	readonly input: InputRenderModel;

	/** Current focus region (for highlighting focused action). */
	readonly focusedRegion: FocusRegion | null;

	/** Currently focused action index in the action bar. */
	readonly focusedActionIndex: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a snake_case category string for display.
 *
 * Examples:
 * - `invalid_state` → `Invalid state`
 * - `llm_provider` → `LLM provider`
 * - `tui_rendering` → `TUI rendering`
 */
function formatCategory(category: string): string {
	return category
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── ErrorPanel ─────────────────────────────────────────────────────────────

export function ErrorPanel({
	actionBar,
	focusedActionIndex,
	focusedRegion,
	panel,
}: ErrorPanelProps) {
	// ── Recoverability ──────────────────────────────────────────────────

	const fatal = panel.recoverable === false;
	const recoverable = panel.recoverable === true;
	const severityLine = fatal
		? '⚠ FATAL ERROR — manual intervention required.'
		: recoverable
			? 'Recoverable error — use the actions below to recover.'
			: undefined;

	const severityColor = fatal ? 'red' : 'yellow';

	// ── Render ───────────────────────────────────────────────────────────

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={2}>
			{/* Error header */}
			<Box marginBottom={1}>
				<Text bold={true} color="red">
					✗ Error
				</Text>
			</Box>

			{/* Primary error message */}
			<Box marginBottom={1}>
				<Text color="red">{panel.message}</Text>
			</Box>

			{/* Severity / recoverability line */}
			{severityLine !== undefined && (
				<Box marginBottom={1}>
					<Text color={severityColor}>{severityLine}</Text>
				</Box>
			)}

			{/* Recovery hint (when no recovery actions are suggested) */}
			{panel.recoveryHint !== undefined &&
				panel.recoveryActions === undefined && (
					<Box marginBottom={1}>
						<Text dimColor={true}>{panel.recoveryHint}</Text>
					</Box>
				)}

			{/* Diagnostic details */}
			{(panel.code !== undefined || panel.category !== undefined) && (
				<Box flexDirection="column" marginBottom={1}>
					<Text dimColor={true}>─── Diagnostic Details ───</Text>
					{panel.code !== undefined && (
						<Box>
							<Text dimColor={true}>Code: </Text>
							<Text>{panel.code}</Text>
						</Box>
					)}
					{panel.category !== undefined && (
						<Box>
							<Text dimColor={true}>Category: </Text>
							<Text>{formatCategory(panel.category)}</Text>
						</Box>
					)}
				</Box>
			)}

			{/* Recovery hint as supplementary info */}
			{panel.recoveryHint !== undefined &&
				panel.recoveryActions !== undefined && (
					<Box marginBottom={1}>
						<Text dimColor={true}>{panel.recoveryHint}</Text>
					</Box>
				)}

			{/* Recovery action buttons */}
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
