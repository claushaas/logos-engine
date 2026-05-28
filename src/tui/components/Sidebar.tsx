/**
 * Sidebar component — renders the profile header and delegates the
 * phase/document/node tree to `NodeTree`.
 *
 * The sidebar is navigational. It shows the profile structure with
 * status symbols per node, highlights the active node, and marks
 * the focused item for keyboard navigation.
 *
 * Collapse state is ephemeral TUI state owned by the parent (AppShell).
 * The sidebar never mutates state engine data.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.3-2.6}
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md §6}
 */
import { Box, Text } from 'ink';
import type { SidebarRenderModel } from '../../contracts/index.js';
import {
	type CollapsedDocumentIds,
	type CollapsedPhaseIds,
	NodeTree,
} from './NodeTree.js';

// ─── Sidebar props ──────────────────────────────────────────────────────────

export type SidebarProps = {
	readonly sidebar: SidebarRenderModel;
	/** Whether the sidebar region currently has focus. */
	readonly isFocused: boolean;
	/** Index of the focused visible item in the flattened tree, or -1. */
	readonly focusedItemIndex: number;
	/** Set of collapsed phase IDs. */
	readonly collapsedPhaseIds: CollapsedPhaseIds;
	/** Set of collapsed document IDs. */
	readonly collapsedDocumentIds: CollapsedDocumentIds;
};

// ─── Sidebar ────────────────────────────────────────────────────────────────

/**
 * Renders the sidebar panel with profile header and collapsible node tree.
 *
 * The tree rendering is delegated to `NodeTree`, which handles
 * expand/collapse indicators, status symbols, active-node highlighting,
 * and focus visualization.
 */
export function Sidebar({
	collapsedDocumentIds,
	collapsedPhaseIds,
	focusedItemIndex,
	isFocused,
	sidebar,
}: SidebarProps) {
	return (
		<Box
			borderRight={true}
			borderStyle="single"
			flexDirection="column"
			paddingRight={1}
			width={32}
		>
			{/* Profile header */}
			<Box marginBottom={1}>
				<Text bold={true}>
					{sidebar.profileTitle
						? `Profile: ${sidebar.profileTitle}`
						: 'No profile'}
				</Text>
			</Box>

			{/* Phase / Document / Node tree */}
			<NodeTree
				collapsedDocumentIds={collapsedDocumentIds}
				collapsedPhaseIds={collapsedPhaseIds}
				focusedItemIndex={focusedItemIndex}
				isFocused={isFocused}
				sidebar={sidebar}
			/>
		</Box>
	);
}
