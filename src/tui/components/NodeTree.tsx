/**
 * NodeTree component — renders the collapsible phase/document/node tree.
 *
 * Phases and documents are collapsible. Nodes are selectable and show
 * lifecycle status symbols. The active node is visually highlighted.
 *
 * This component is purely presentational. It receives collapse state,
 * focus state, and node data from the parent; it never owns or
 * computes lifecycle rules.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §2.4-2.6}
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md §6}
 */
import { Box, Text } from 'ink';
import type { SidebarRenderModel } from '../../contracts/index.js';

// ─── Visible item types ─────────────────────────────────────────────────────

/** A phase row in the visible tree. */
export type VisiblePhase = {
	readonly kind: 'phase';
	readonly phaseId: string;
	readonly title: string;
	/** Zero-based display order within the profile. */
	readonly order: number;
	/** Whether this phase is expanded (showing its children). */
	readonly expanded: boolean;
	/** Total number of nodes in this phase (for display). */
	readonly nodeCount: number;
};

/** A document row in the visible tree. */
export type VisibleDocument = {
	readonly kind: 'document';
	readonly documentId: string;
	readonly phaseId: string;
	readonly title: string;
	/** Optional document-level status symbol. */
	readonly statusSymbol?: string;
	/** Whether this document is expanded (showing its nodes). */
	readonly expanded: boolean;
	/** Total number of nodes in this document. */
	readonly nodeCount: number;
};

/** A node row in the visible tree. */
export type VisibleNode = {
	readonly kind: 'node';
	readonly nodeId: string;
	readonly title: string;
	/** Single-character lifecycle status symbol. */
	readonly statusSymbol: string;
	/** Whether this node is the currently active node. */
	readonly selected: boolean;
	/** Whether navigation to this node is disabled. */
	readonly disabled: boolean;
	/** Human-readable reason if the node is disabled. */
	readonly reasonIfDisabled?: string;
};

/** Union of all visible sidebar tree items. */
export type VisibleItem = VisiblePhase | VisibleDocument | VisibleNode;

// ─── Collapse state types ───────────────────────────────────────────────────

export type CollapsedPhaseIds = ReadonlySet<string>;
export type CollapsedDocumentIds = ReadonlySet<string>;

// ─── Flatten helper ─────────────────────────────────────────────────────────

/**
 * Flatten a `SidebarRenderModel` into a list of visible items, respecting
 * collapse state for phases and documents.
 *
 * All phases start expanded by default. All documents start expanded
 * by default. Collapse state is ephemeral TUI state — it is never
 * persisted to the state engine.
 *
 * @param sidebar - The sidebar render model from the snapshot.
 * @param collapsedPhaseIds - Set of phase IDs that are collapsed.
 * @param collapsedDocumentIds - Set of document IDs that are collapsed.
 * @returns A flat array of visible items in tree order.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: utility function colocated with component
export function flattenSidebarTree(
	sidebar: SidebarRenderModel,
	collapsedPhaseIds: CollapsedPhaseIds,
	collapsedDocumentIds: CollapsedDocumentIds,
): VisibleItem[] {
	const items: VisibleItem[] = [];

	for (let pIdx = 0; pIdx < sidebar.phases.length; pIdx++) {
		// biome-ignore lint/style/noNonNullAssertion: guarded above
		const phase = sidebar.phases[pIdx]!;
		const phaseExpanded = !collapsedPhaseIds.has(phase.phaseId);
		const totalNodesInPhase = phase.documents.reduce(
			(sum, d) => sum + d.nodes.length,
			0,
		);

		items.push({
			expanded: phaseExpanded,
			kind: 'phase',
			nodeCount: totalNodesInPhase,
			order: pIdx,
			phaseId: phase.phaseId,
			title: phase.title,
		});

		if (!phaseExpanded) {
			continue;
		}

		for (const doc of phase.documents) {
			const docExpanded = !collapsedDocumentIds.has(doc.documentId);

			items.push({
				documentId: doc.documentId,
				expanded: docExpanded,
				kind: 'document' as const,
				nodeCount: doc.nodes.length,
				phaseId: phase.phaseId,
				// exactOptionalPropertyTypes: only include when defined
				...(doc.statusSymbol !== undefined
					? { statusSymbol: doc.statusSymbol }
					: {}),
				title: doc.title,
			} as VisibleDocument);

			if (!docExpanded) {
				continue;
			}

			for (const node of doc.nodes) {
				items.push({
					disabled: node.disabled,
					kind: 'node' as const,
					nodeId: node.nodeId,
					selected: node.selected,
					statusSymbol: node.statusSymbol,
					title: node.title,
					// exactOptionalPropertyTypes: only include when defined
					...(node.reasonIfDisabled !== undefined
						? { reasonIfDisabled: node.reasonIfDisabled }
						: {}),
				} as VisibleNode);
			}
		}
	}

	return items;
}

// ─── NodeTree props ─────────────────────────────────────────────────────────

export type NodeTreeProps = {
	readonly sidebar: SidebarRenderModel;
	/** Whether the sidebar region currently has focus. */
	readonly isFocused: boolean;
	/** Index of the focused visible item (0-based), or -1 if none. */
	readonly focusedItemIndex: number;
	/** Set of collapsed phase IDs. */
	readonly collapsedPhaseIds: CollapsedPhaseIds;
	/** Set of collapsed document IDs. */
	readonly collapsedDocumentIds: CollapsedDocumentIds;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format the order as a zero-padded two-digit string.
 */
function formatOrder(order: number): string {
	return String(order + 1).padStart(2, '0');
}

/**
 * Determine the visual style string for an item based on focus and selection.
 * Returns `null` for no special rendering; returns attribute combinations
 * for grouped styles.
 */
type LineStyle =
	| 'normal'
	| 'focused'
	| 'selected'
	| 'focused-selected'
	| 'disabled';

function itemStyle(
	isFocused: boolean,
	isSelected: boolean,
	isDisabled: boolean,
): LineStyle {
	if (isDisabled) return 'disabled';
	if (isFocused && isSelected) return 'focused-selected';
	if (isFocused) return 'focused';
	if (isSelected) return 'selected';
	return 'normal';
}

// ─── NodeTree ───────────────────────────────────────────────────────────────

/**
 * Renders a collapsible tree of phases, documents, and nodes.
 *
 * - Phases: show order + title, collapsible via ▾/▸.
 * - Documents: show title, optionally collapsible via ▾/▸.
 * - Nodes: show status symbol + title, selectable.
 * - Active node gets a highlighted (green/bold) appearance.
 * - Focused item gets inverse rendering.
 */
export function NodeTree({
	collapsedDocumentIds,
	collapsedPhaseIds,
	focusedItemIndex,
	isFocused,
	sidebar,
}: NodeTreeProps) {
	const visibleItems = flattenSidebarTree(
		sidebar,
		collapsedPhaseIds,
		collapsedDocumentIds,
	);

	if (visibleItems.length === 0) {
		return null;
	}

	return (
		<Box flexDirection="column">
			{visibleItems.map((item, idx) => {
				const isItemFocused = isFocused && focusedItemIndex === idx;

				switch (item.kind) {
					case 'phase':
						return (
							<PhaseRow
								isFocused={isItemFocused}
								item={item}
								key={item.phaseId}
							/>
						);
					case 'document':
						return (
							<DocumentRow
								isFocused={isItemFocused}
								item={item}
								key={item.documentId}
							/>
						);
					case 'node':
						return (
							<NodeRow
								isFocused={isItemFocused}
								item={item}
								key={item.nodeId}
							/>
						);
					default:
						return null;
				}
			})}
		</Box>
	);
}

// ─── Phase row ──────────────────────────────────────────────────────────────

function PhaseRow({
	isFocused,
	item,
}: {
	readonly isFocused: boolean;
	readonly item: VisiblePhase;
}) {
	const chevron = item.expanded ? '▾' : '▸';
	const label = `${chevron} ${formatOrder(item.order)} ${item.title}`;

	return (
		<Box>
			<Text bold={true} color="cyan" inverse={isFocused}>
				{label}
			</Text>
		</Box>
	);
}

// ─── Document row ───────────────────────────────────────────────────────────

function DocumentRow({
	isFocused,
	item,
}: {
	readonly isFocused: boolean;
	readonly item: VisibleDocument;
}) {
	const chevron = item.expanded ? '▾' : '▸';
	const hasNodes = item.nodeCount > 0;
	const statusPrefix =
		item.statusSymbol !== undefined ? `${item.statusSymbol} ` : '';
	const label = `  ${hasNodes ? chevron : ' '} ${statusPrefix}${item.title}`;

	return (
		<Box>
			<Text bold={isFocused} dimColor={!isFocused} inverse={isFocused}>
				{label}
			</Text>
		</Box>
	);
}

// ─── Node row ───────────────────────────────────────────────────────────────

function NodeRow({
	isFocused,
	item,
}: {
	readonly isFocused: boolean;
	readonly item: VisibleNode;
}) {
	const style = itemStyle(isFocused, item.selected, item.disabled);
	const prefix = isFocused ? '▶' : ' ';
	const suffix = item.selected ? ' ◀' : '';
	const label = `  ${prefix} ${item.statusSymbol} ${item.title}${suffix}`;

	switch (style) {
		case 'disabled':
			return (
				<Box flexDirection="column">
					<Box>
						<Text color="gray" dimColor={true}>
							{label}
						</Text>
					</Box>
					{item.reasonIfDisabled !== undefined && (
						<Box paddingLeft={5}>
							<Text color="gray" dimColor={true}>
								({item.reasonIfDisabled})
							</Text>
						</Box>
					)}
				</Box>
			);

		case 'selected':
			return (
				<Box>
					<Text bold={true} color="green">
						{label}
					</Text>
				</Box>
			);

		case 'focused-selected':
			return (
				<Box>
					<Text bold={true} color="green" inverse={true}>
						{label}
					</Text>
				</Box>
			);

		case 'focused':
			return (
				<Box>
					<Text bold={true} inverse={true}>
						{label}
					</Text>
				</Box>
			);

		default:
			return (
				<Box>
					<Text>{label}</Text>
				</Box>
			);
	}
}
