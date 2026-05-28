/**
 * Diagnostics Panel component.
 *
 * Renders a full overlay panel showing session-level diagnostics:
 * errors, warnings, stale nodes, blocked exports, and recovery
 * suggestions. Toggled via Ctrl+D; dismissed via Escape or Ctrl+D.
 *
 * The panel groups diagnostics by severity (error, warning, info),
 * shows affected nodes/documents (sourceId), and derives suggested
 * recovery actions from error codes using the existing diagnostics
 * utilities.
 *
 * The TUI is a renderer only. Recovery actions are displayed for
 * user guidance — actual recovery is dispatched through existing
 * action bar events or node navigation.
 *
 * @see {@link https://logos-engine/docs/architecture/08-error-handling-and-recovery.md §12}
 */
import { Box, Text } from 'ink';
import type {
	ActionBarRenderModel,
	InputRenderModel,
	RuntimeDiagnostic,
} from '../../contracts/index.js';
import {
	getCategoryFromCode,
	getRecoveryActions,
	type RecoveryAction,
} from '../../diagnostics/recovery-actions.js';
import type { FocusRegion } from '../hooks/use-focus.js';
import { ActionBar } from './ActionBar.js';

// ─── DiagnosticsPanel Props ─────────────────────────────────────────────────

export type DiagnosticsPanelProps = {
	/** The diagnostics from the snapshot. */
	readonly diagnostics: readonly RuntimeDiagnostic[];

	/** Action bar with global actions (e.g., close). */
	readonly actionBar: ActionBarRenderModel;

	/** Input model (disabled while panel is open). */
	readonly input: InputRenderModel;

	/** Current focus region. */
	readonly focusedRegion: FocusRegion | null;

	/** Currently focused action index in the action bar. */
	readonly focusedActionIndex: number;
};

// ─── Recovery action display labels ─────────────────────────────────────────

const RECOVERY_LABELS: Record<RecoveryAction, string> = {
	clear_invalid_active_node: 'Clear invalid active node',
	export_recovery_bundle: 'Export recovery bundle',
	open_missing_prerequisite: 'Open missing prerequisite',
	open_settings: 'Open settings',
	regenerate_canonical_answer: 'Regenerate canonical answer',
	reopen_node: 'Reopen node',
	restore_previous_snapshot: 'Restore previous snapshot',
	retry: 'Retry',
};

// ─── Severity helpers ───────────────────────────────────────────────────────

type SeverityGroup = 'error' | 'warning' | 'info';

const SEVERITY_ORDER: readonly SeverityGroup[] = ['error', 'warning', 'info'];

const SEVERITY_HEADER: Record<SeverityGroup, string> = {
	error: 'Errors',
	info: 'Info',
	warning: 'Warnings',
};

const SEVERITY_COLOR: Record<SeverityGroup, string | undefined> = {
	error: 'red',
	info: undefined, // default color
	warning: 'yellow',
};

// ─── Enriched diagnostic ────────────────────────────────────────────────────

type EnrichedDiagnostic = RuntimeDiagnostic & {
	readonly recoveryActions: RecoveryAction[];
	readonly category: string | null;
};

function enrich(
	diagnostics: readonly RuntimeDiagnostic[],
): EnrichedDiagnostic[] {
	return diagnostics.map((d) => ({
		...d,
		category: getCategoryFromCode(d.code),
		recoveryActions: getRecoveryActions(d.code),
	}));
}

// ─── Count badge ────────────────────────────────────────────────────────────

function CountBadge({
	count,
	severity,
}: {
	readonly count: number;
	readonly severity: SeverityGroup;
}) {
	const color = SEVERITY_COLOR[severity];

	if (color !== undefined) {
		return <Text color={color}> ({count})</Text>;
	}

	return <Text> ({count})</Text>;
}

// ─── DiagnosticsPanel ───────────────────────────────────────────────────────

export function DiagnosticsPanel({
	actionBar,
	diagnostics,
	focusedActionIndex,
	focusedRegion,
}: DiagnosticsPanelProps) {
	const enriched = enrich(diagnostics);

	// ── Group by severity ────────────────────────────────────────────────

	const groups = new Map<SeverityGroup, EnrichedDiagnostic[]>();
	for (const sev of SEVERITY_ORDER) {
		groups.set(sev, []);
	}

	for (const d of enriched) {
		groups.get(d.severity)?.push(d);
	}

	const totalCount = enriched.length;

	// ── Empty state ──────────────────────────────────────────────────────

	if (totalCount === 0) {
		return (
			<Box flexDirection="column" flexGrow={1} paddingX={2}>
				{/* Header */}
				<Box marginBottom={1}>
					<Text bold={true}>Diagnostics</Text>
				</Box>

				<Box marginBottom={1}>
					<Text dimColor={true}>No diagnostics reported.</Text>
				</Box>

				<Box marginTop={1}>
					<Text dimColor={true}>
						Press Escape or Ctrl+D to close this panel.
					</Text>
				</Box>

				{/* Action bar (close) */}
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

	// ── Normal state ─────────────────────────────────────────────────────

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={2}>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold={true}>Diagnostics</Text>
				<Text dimColor={true}> ({totalCount} total)</Text>
			</Box>

			{/* Severity groups */}
			{SEVERITY_ORDER.map((severity) => {
				const items = groups.get(severity);
				if (!items || items.length === 0) return null;

				const headerColor = SEVERITY_COLOR[severity];

				return (
					<Box flexDirection="column" key={severity} marginBottom={1}>
						{/* Group header */}
						<Box marginBottom={1}>
							{headerColor !== undefined ? (
								<Text bold={true} color={headerColor}>
									─── {SEVERITY_HEADER[severity]}
								</Text>
							) : (
								<Text bold={true}>─── {SEVERITY_HEADER[severity]}</Text>
							)}
							<CountBadge count={items.length} severity={severity} />
						</Box>

						{/* Diagnostic entries */}
						{items.map((diag) => (
							<Box
								flexDirection="column"
								key={diag.code}
								marginBottom={1}
								paddingLeft={2}
							>
								{/* Code + message */}
								<Box>
									<Text dimColor={true}>[{diag.code}]</Text>
									<Box marginLeft={1}>
										<Text>{diag.message}</Text>
									</Box>
								</Box>

								{/* Category */}
								{diag.category !== null && (
									<Box>
										<Text dimColor={true}>Category: {diag.category}</Text>
									</Box>
								)}

								{/* Affected node/document */}
								{diag.sourceId !== undefined && (
									<Box>
										<Text dimColor={true}>Affected: {diag.sourceId}</Text>
									</Box>
								)}

								{/* Recovery actions */}
								{diag.recoveryActions.length > 0 && (
									<Box marginTop={1}>
										<Text dimColor={true}>Recovery: </Text>
										<Text>
											{diag.recoveryActions
												.map((a) => RECOVERY_LABELS[a] ?? a)
												.join(', ')}
										</Text>
									</Box>
								)}
							</Box>
						))}
					</Box>
				);
			})}

			{/* Dismiss hint */}
			<Box marginTop={1}>
				<Text dimColor={true}>Press Escape or Ctrl+D to close this panel.</Text>
			</Box>

			{/* Action bar (close) */}
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
