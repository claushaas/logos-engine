/**
 * Open document preview use case — orchestrates the transition from
 * node-focus or structure-overview mode into document preview mode.
 *
 * Pipeline:
 * 1. Resolve the target document (via explicit `documentId` or derived
 *    from the active node's parent document).
 * 2. Call `previewDocument()` to materialize content from accepted
 *    canonical answers.
 * 3. Cache the draft into `state.documentStates[documentId]` and update
 *    the document status (drafted → partially_ready → stale).
 * 4. Compute `exportEligible` from the updated document state.
 * 5. Construct a `StateEngineSnapshot` with `mode: 'document_preview'`
 *    and a populated `DocumentPreviewPanel`.
 * 6. Pass through `buildRenderSnapshot()` for the TUI.
 *
 * Because `resolveSessionMode()` is purely structural (idle /
 * structure_overview / node_focus / error), this use case builds the
 * snapshot directly rather than going through `dispatch()` +
 * `buildSnapshot()`.  The document preview is a rendering surface, not
 * a state-machine mode.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.11, §4.7}
 */
import type {
	DocumentPreviewPanel,
	DocumentRuntimeState,
	DocumentStatus,
	LogosProfile,
	LogosRuntimeState,
	MainPanelRenderModel,
	SidebarRenderModel,
	TuiRenderSnapshot,
} from '../../contracts/index.js';
import { previewDocument } from '../../materialization/document-materializer.js';
import type { DocumentId, NodeId } from '../../shared/index.js';
import { nowIso } from '../../shared/index.js';
import { buildSnapshot } from '../../state-engine/snapshot-builder.js';
import type {
	StateDiagnostic,
	StateEngineSnapshot,
} from '../../state-engine/types.js';
import { buildRenderSnapshot } from '../render-model-builder.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of the open-document-preview use case.
 */
export type OpenDocumentPreviewResult =
	| {
			readonly ok: true;
			readonly state: LogosRuntimeState;
			readonly snapshot: TuiRenderSnapshot;
			readonly diagnostics: StateDiagnostic[];
	  }
	| {
			readonly ok: false;
			readonly error: string;
			readonly diagnostics: StateDiagnostic[];
	  };

/**
 * Options for `openDocumentPreviewUseCase`.
 */
export type OpenDocumentPreviewOptions = {
	/** Explicit document ID (overrides derivation from active node). */
	readonly documentId?: DocumentId;

	/** The loaded profile. */
	readonly profile: LogosProfile;
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the document status after materialization.
 *
 * - `drafted` — no missing required nodes, not stale.
 * - `partially_ready` — some required nodes are missing.
 * - `stale` — the draft is stale or stale source nodes exist.
 */
function computeDocumentStatus(
	missingRequiredNodeIds: readonly NodeId[],
	staleSourceNodeIds: readonly NodeId[],
	draftStale: boolean,
): DocumentStatus {
	if (staleSourceNodeIds.length > 0 || draftStale) {
		return 'stale';
	}
	if (missingRequiredNodeIds.length > 0) {
		return 'partially_ready';
	}
	return 'drafted';
}

/**
 * Determine whether a document is eligible for export.
 *
 * A document is export-eligible when:
 * - All required nodes are accepted and non-stale.
 * - The document draft exists and is not stale.
 */
function isExportEligible(
	documentState: DocumentRuntimeState | undefined,
): boolean {
	if (!documentState?.draft) return false;
	if (documentState.draft.stale) return false;
	if (documentState.missingRequiredNodeIds.length > 0) return false;
	if (documentState.staleSourceNodeIds.length > 0) return false;
	return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Open (or regenerate) the document preview for a materialized document.
 *
 * Derives the target document from the active node's parent document when
 * no explicit `documentId` is provided.  Materializes content, caches
 * the draft in the document runtime state, updates the document status,
 * computes export eligibility, and returns an updated `LogosRuntimeState`
 * alongside a `TuiRenderSnapshot` with `mode: 'document_preview'`.
 *
 * @param state   - The current runtime state (not mutated).
 * @param options - Preview options (documentId, profile).
 * @returns An `OpenDocumentPreviewResult` with the updated state, snapshot.
 */
export function openDocumentPreviewUseCase(
	state: LogosRuntimeState,
	options: OpenDocumentPreviewOptions,
): OpenDocumentPreviewResult {
	const { profile } = options;

	// ── Step 1: Resolve the target document ─────────────────────────
	let documentId: DocumentId | null = options.documentId ?? null;

	if (documentId === null && state.activeNodeId !== null) {
		const nodeDef = profile.nodes.find((n) => n.id === state.activeNodeId);
		if (nodeDef) {
			documentId = nodeDef.documentId;
		}
	}

	if (documentId === null) {
		return {
			diagnostics: [],
			error: 'No document to preview. Select a node or provide a documentId.',
			ok: false as const,
		};
	}

	// ── Step 2: Find document definition for title ──────────────────
	const docDef = profile.documents.find((d) => d.id === documentId);
	const title = docDef?.title ?? String(documentId);

	// ── Step 3: Materialize the document ────────────────────────────
	const draft = previewDocument(documentId, state, profile);

	// ── Step 4: Cache draft in document runtime state ───────────────
	const existingDocState = state.documentStates[documentId];
	const now = nowIso();
	const newDocStatus = computeDocumentStatus(
		existingDocState?.missingRequiredNodeIds ?? [],
		existingDocState?.staleSourceNodeIds ?? [],
		draft.stale,
	);

	const updatedDocState: DocumentRuntimeState = {
		documentId,
		draft,
		missingRequiredNodeIds: existingDocState?.missingRequiredNodeIds ?? [],
		optionalNodeIds: existingDocState?.optionalNodeIds ?? [],
		requiredNodeIds: existingDocState?.requiredNodeIds ?? [],
		sourceNodeIds: existingDocState?.sourceNodeIds ?? [],
		staleSourceNodeIds: existingDocState?.staleSourceNodeIds ?? [],
		status: newDocStatus,
		updatedAt: now,
	};

	const updatedState: LogosRuntimeState = {
		...state,
		documentStates: {
			...state.documentStates,
			[documentId]: updatedDocState,
		},
		updatedAt: now,
	};

	// ── Step 5: Compute export eligibility from updated state ───────
	const exportEligible = isExportEligible(updatedDocState);

	// ── Step 6: Build the DocumentPreviewPanel ──────────────────────
	const previewPanel: DocumentPreviewPanel = {
		content: draft.content,
		documentId,
		exportEligible,
		kind: 'document_preview',
		missingNodeIds: updatedDocState.missingRequiredNodeIds,
		staleNodeIds: updatedDocState.staleSourceNodeIds,
		title,
	};

	// ── Step 7: Build sidebar from current state ────────────────────
	const baseSnapshot = buildSnapshot(updatedState, profile);
	const sidebar: SidebarRenderModel = baseSnapshot.sidebar;

	// ── Step 8: Construct StateEngineSnapshot with document_preview ─
	const previewSnapshot: StateEngineSnapshot = {
		activeNodeId: state.activeNodeId,
		activeNodeState:
			state.activeNodeId !== null
				? (state.nodeStates[state.activeNodeId] ?? null)
				: null,
		allowedActions: [],
		diagnostics: [],
		mainPanel: previewPanel as MainPanelRenderModel,
		mode: 'document_preview',
		selectedProfileId: state.selectedProfileId,
		sidebar,
	};

	// ── Step 9: Build TUI render snapshot ───────────────────────────
	const tuiSnapshot = buildRenderSnapshot(previewSnapshot, profile);

	return {
		diagnostics: [],
		ok: true as const,
		snapshot: tuiSnapshot,
		state: updatedState,
	};
}

/**
 * Close the document preview and return to the previous mode.
 *
 * This simply rebuilds the current state's snapshot through the
 * standard `buildSnapshot()` + `buildRenderSnapshot()` pipeline,
 * which will resolve the mode structurally.
 *
 * @param state   - The current runtime state (not mutated).
 * @param profile - The loaded profile.
 * @returns The standard render snapshot for the current state.
 */
export function closeDocumentPreviewUseCase(
	state: LogosRuntimeState,
	profile: LogosProfile,
): TuiRenderSnapshot {
	const engineSnapshot = buildSnapshot(state, profile);
	return buildRenderSnapshot(engineSnapshot, profile);
}
