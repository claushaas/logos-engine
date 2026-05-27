/**
 * Sidebar component — renders the profile header and phase/document/node tree.
 *
 * The sidebar is navigational. It shows the profile structure with
 * status symbols per node, highlights the active node, and marks
 * the focused node for keyboard navigation.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.3-2.6}
 */
import { Box, Text } from 'ink';
import type { SidebarRenderModel } from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';

// ─── Sidebar props ──────────────────────────────────────────────────────────

export type SidebarProps = {
	readonly sidebar: SidebarRenderModel;
	readonly focusedRegion: FocusRegion | null;
	readonly focusedNodeIndex: number;
	readonly onSelectNode?: (nodeId: string) => void;
};

// ─── Node line helper (avoids passing undefined color) ──────────────────────

function NodeLine({
	isDisabled,
	isFocused,
	isSelected,
	label,
}: {
	readonly isDisabled: boolean;
	readonly isFocused: boolean;
	readonly isSelected: boolean;
	readonly label: string;
}) {
	// Construct display attributes WITHOUT passing undefined color
	if (isDisabled) {
		return (
			<Text color="gray" dimColor={true} bold={isSelected || isFocused} inverse={isFocused && !isSelected}>
				{label}
			</Text>
		);
	}

	if (isSelected) {
		return (
			<Text color="green" bold={true} inverse={isFocused && !isSelected}>
				{label}
			</Text>
		);
	}

	return (
		<Text bold={isFocused} inverse={isFocused}>
			{label}
		</Text>
	);
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

export function Sidebar({
	focusedNodeIndex,
	focusedRegion,
	onSelectNode,
	sidebar,
}: SidebarProps) {
	const isSidebarFocused = focusedRegion === 'sidebar';

	let globalNodeIndex = 0;

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
					{sidebar.profileTitle ? `Profile: ${sidebar.profileTitle}` : 'No profile'}
				</Text>
			</Box>

			{/* Phase / Document / Node tree */}
			{sidebar.phases.map((phase) => (
				<Box key={phase.phaseId} flexDirection="column" marginBottom={1}>
					<Text color="cyan" bold={true}>
						{phase.title}
					</Text>

					{phase.documents.map((doc) => (
						<Box
							key={doc.documentId}
							flexDirection="column"
							paddingLeft={2}
						>
							<Text dimColor={true}>
								{doc.title}
							</Text>

							{doc.nodes.map((node) => {
								const nodeIdx = globalNodeIndex;
								globalNodeIndex += 1;

								const isSelected = node.selected;
								const isFocused =
									isSidebarFocused &&
									focusedNodeIndex === nodeIdx;

								const prefix =
									isFocused ? '▶ ' : '  ';
								const suffix =
									isSelected ? ' ◀' : '';

								return (
									<Box key={node.nodeId} paddingLeft={2}>
										<NodeLine
											isDisabled={node.disabled}
											isFocused={isFocused}
											isSelected={isSelected}
											label={`${prefix}${node.statusSymbol} ${node.title}${suffix}`}
										/>
									</Box>
								);
							})}
						</Box>
					))}
				</Box>
			))}
		</Box>
	);
}
