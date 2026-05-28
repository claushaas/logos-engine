/**
 * DocumentPreview — overlay/modal panel for inspecting materialized
 * document drafts.
 *
 * Renders as a full take-over of the main panel area when the session
 * mode is `document_preview`.  Shows accepted sections, missing
 * section markers, stale warnings, completeness indicator, and
 * actions: [Regenerate], [Export], [Close].
 *
 * The component is a pure renderer — it receives a fully-populated
 * `DocumentPreviewPanel` from the application layer and never calls
 * the state engine or materialization module directly.
 *
 * Page navigation: long content is split into pages.  `n` advances
 * one page; `p` goes back one page.  This is ephemeral TUI state —
 * never persisted to the runtime state.
 *
 * Missing node links: each entry in `panel.missingNodeIds` is
 * rendered as a numbered link.  Pressing the corresponding digit
 * key (1-9) calls `onSelectMissingNode` with the node ID.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.11}
 */
import { Box, Text, useInput } from 'ink';
import { useCallback, useMemo, useState } from 'react';
import type {
	ActionBarRenderModel,
	DocumentPreviewPanel,
	InputRenderModel,
} from '../../contracts/index.js';
import type { FocusRegion } from '../hooks/use-focus.js';
import { ActionBar } from './ActionBar.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Number of visible lines per page (excluding title and footer). */
const PAGE_SIZE = 12;

// ─── DocumentPreview props ──────────────────────────────────────────────────

export type DocumentPreviewProps = {
	/** The fully-populated panel data from the application layer. */
	readonly panel: DocumentPreviewPanel;

	/** Action bar render model. */
	readonly actionBar: ActionBarRenderModel;

	/** Input render model (disabled in document preview). */
	readonly input: InputRenderModel;

	/** Current focus region. */
	readonly focusedRegion: FocusRegion | null;

	/** Index of the focused action in the action bar. */
	readonly focusedActionIndex: number;

	/** Callback for action selection. */
	readonly onSelectAction?: ((actionId: string) => void) | undefined;

	/** Callback when user navigates to a missing source node. */
	readonly onSelectMissingNode?: ((nodeId: string) => void) | undefined;
};

// ─── Content line type ──────────────────────────────────────────────────────

/**
 * Parsed line from the materialized content.
 */
type ContentLine =
	| { readonly kind: 'text'; readonly text: string }
	| {
			readonly kind: 'missing';
			readonly nodeId: string;
			readonly text: string;
	  }
	| {
			readonly kind: 'stale';
			readonly text: string;
	  }
	| { readonly kind: 'completeness'; readonly text: string };

// ─── Parsing helpers ────────────────────────────────────────────────────────

const MISSING_PATTERN = /\[MISSING\s*[-—]\s*requires node:\s*(\S+)\]/i;
const STALE_PATTERN = /\[⚠\s*STALE/i;

function parseLine(line: string): ContentLine {
	const missingMatch = line.match(MISSING_PATTERN);
	if (missingMatch) {
		return {
			kind: 'missing',
			// biome-ignore lint/style/noNonNullAssertion: regex match ensures capture group exists
			nodeId: missingMatch[1]!,
			text: line,
		};
	}

	if (STALE_PATTERN.test(line)) {
		return {
			kind: 'stale',
			text: line,
		};
	}

	if (/^Completeness:/.test(line)) {
		return {
			kind: 'completeness',
			text: line,
		};
	}

	return { kind: 'text', text: line };
}

// ─── ContentLineComponent ───────────────────────────────────────────────────

function ContentLineComponent({ line }: { readonly line: ContentLine }) {
	switch (line.kind) {
		case 'missing':
			return (
				<Box>
					<Text color="yellow">{line.text}</Text>
				</Box>
			);

		case 'stale':
			return (
				<Box>
					<Text color="yellow">{line.text}</Text>
				</Box>
			);

		case 'completeness':
			return (
				<Box marginTop={1}>
					<Text bold={true}>{line.text}</Text>
				</Box>
			);

		default:
			if (line.text.length === 0) {
				return <Text> </Text>;
			}

			if (line.text.startsWith('# ')) {
				return (
					<Box marginBottom={1}>
						<Text bold={true}>{line.text.slice(2)}</Text>
					</Box>
				);
			}

			if (line.text.startsWith('## ')) {
				return (
					<Box marginTop={1}>
						<Text bold={true}>{line.text.slice(3)}</Text>
					</Box>
				);
			}

			return <Text>{line.text}</Text>;
	}
}

// ─── MissingNodeLinks ───────────────────────────────────────────────────────

/**
 * Renders numbered links for each missing node ID.
 *
 * Pressing the corresponding digit key (1-9) triggers
 * `onSelectMissingNode` with the node ID.
 */
function MissingNodeLinks({
	missingNodeIds,
}: {
	readonly missingNodeIds: readonly string[];
}) {
	if (missingNodeIds.length === 0) return null;

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold={true} color="yellow">
				Missing required nodes:
			</Text>
			{missingNodeIds.slice(0, 9).map((nid, idx) => (
				<Box key={nid}>
					<Text dimColor={true}>
						[{idx + 1}] → {nid}
					</Text>
				</Box>
			))}
		</Box>
	);
}

// ─── DocumentPreview ────────────────────────────────────────────────────────

/**
 * Renders the document preview panel inside a bordered modal-style box.
 *
 * Content is paginated: `PAGE_SIZE` lines per page, navigable with
 * `n` (next page) and `p` (previous page).  Missing node IDs are
 * rendered as numbered links selectable via digit keys (1-9).
 */
export function DocumentPreview({
	actionBar,
	focusedActionIndex,
	focusedRegion,
	panel,
	onSelectAction: _onSelectAction,
	onSelectMissingNode,
}: DocumentPreviewProps) {
	// ── Page state (ephemeral TUI-only) ──────────────────────────────
	const [currentPage, setCurrentPage] = useState(0);

	const parsedLines = useMemo(() => {
		if (!panel.content) return [];
		return panel.content.split('\n').map(parseLine);
	}, [panel.content]);

	const totalPages = Math.max(1, Math.ceil(parsedLines.length / PAGE_SIZE));
	const safePage = Math.min(currentPage, totalPages - 1);

	const visibleLines = useMemo(() => {
		const start = safePage * PAGE_SIZE;
		return parsedLines.slice(start, start + PAGE_SIZE);
	}, [parsedLines, safePage]);

	// ── Page navigation via n/p keys ─────────────────────────────────
	const handlePageNavigation = useCallback(
		(input: string) => {
			// Only handle when the doc has multiple pages
			if (totalPages <= 1) return;

			// n = next page
			if (input === 'n') {
				setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
				return;
			}

			// p = previous page
			if (input === 'p') {
				setCurrentPage((p) => Math.max(0, p - 1));
				return;
			}
		},
		[totalPages],
	);

	// ── Missing node link navigation via digit keys ──────────────────
	const handleMissingNodeNavigation = useCallback(
		(input: string) => {
			if (!onSelectMissingNode) return;
			if (panel.missingNodeIds.length === 0) return;

			// Digits 1-9 select the corresponding missing node
			const digit = Number.parseInt(input, 10);
			if (digit >= 1 && digit <= 9) {
				const nodeId = panel.missingNodeIds[digit - 1];
				if (nodeId) {
					onSelectMissingNode(nodeId);
				}
			}
		},
		[onSelectMissingNode, panel.missingNodeIds],
	);

	useInput((input) => {
		handlePageNavigation(input);
		handleMissingNodeNavigation(input);
	});

	// ── No content state ────────────────────────────────────────────
	if (panel.content === null || parsedLines.length === 0) {
		return (
			<Box
				borderColor="grey"
				borderStyle="single"
				flexDirection="column"
				flexGrow={1}
				paddingX={1}
			>
				<Box marginBottom={1}>
					<Text bold={true}>Document: {panel.title}</Text>
				</Box>
				<Box marginBottom={1}>
					<Text dimColor={true}>
						No content yet. Accept node answers to populate this document.
					</Text>
				</Box>
				<MissingNodeLinks
					missingNodeIds={panel.missingNodeIds as readonly string[]}
				/>
				<Box>
					<Text dimColor={true}>
						{panel.exportEligible
							? 'Document is ready for export.'
							: 'Document is not yet export-eligible.'}
					</Text>
				</Box>
				<ActionBar
					actionBar={actionBar}
					focusedActionIndex={focusedActionIndex}
					focusedRegion={focusedRegion}
				/>
			</Box>
		);
	}

	// ── Content available ───────────────────────────────────────────
	return (
		<Box
			borderColor="grey"
			borderStyle="single"
			flexDirection="column"
			flexGrow={1}
			paddingX={1}
		>
			{/* ── Title ─────────────────────────────────────────── */}
			<Box marginBottom={1}>
				<Text bold={true}>Document: {panel.title}</Text>
			</Box>

			{/* ── Content (paginated) ──────────────────────────── */}
			<Box flexDirection="column" flexGrow={1} marginBottom={1}>
				{visibleLines.map((line, _idx) => (
					<ContentLineComponent key={`${safePage}-${line}`} line={line} />
				))}
			</Box>

			{/* ── Stale node warnings ──────────────────────────── */}
			{panel.staleNodeIds.length > 0 && (
				<Box marginBottom={1}>
					<Text color="yellow">
						⚠ Stale source nodes: {panel.staleNodeIds.join(', ')}
					</Text>
				</Box>
			)}

			{/* ── Missing node links ──────────────────────────── */}
			<MissingNodeLinks
				missingNodeIds={panel.missingNodeIds as readonly string[]}
			/>

			{/* ── Page indicator (when content spans multiple pages) ── */}
			{totalPages > 1 && (
				<Box marginBottom={1}>
					<Text dimColor={true}>
						Page {safePage + 1}/{totalPages} (n/p to navigate)
					</Text>
				</Box>
			)}

			{/* ── Action bar ───────────────────────────────────── */}
			<ActionBar
				actionBar={actionBar}
				focusedActionIndex={focusedActionIndex}
				focusedRegion={focusedRegion}
			/>
		</Box>
	);
}
