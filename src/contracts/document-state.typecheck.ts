/**
 * Compile-time assertions for Step 1.4 document state types.
 *
 * This file exercises TypeScript-level type identity for the
 * document-state contracts created in Step 1.4. It is NOT a
 * runtime test — if any assertion were violated, the project
 * would not type-check.
 *
 * Tests:
 *  1. Minimal valid `DocumentRuntimeState` for a partially-ready document compiles.
 *  2. `DocumentStatus` includes the 6 canonical states (type-level check).
 *  3. `missingRequiredNodeIds` is assignable to `NodeId[]`.
 *  4. `DocumentStatus` discriminated union narrowing works.
 *  5. `MaterializedDocumentDraft.stale` is a boolean.
 *  6. `DocumentSectionRule` compiles.
 */
import type { DocumentId, NodeId } from '../shared/index.js';
import type {
	DocumentRuntimeState,
	DocumentSectionRule,
	DocumentStatus,
	ExportRuntimeState,
	GeneratedArtifact,
	GeneratedArtifactType,
	MaterializedDocumentDraft,
} from './index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

type IsAssignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;
type ExpectFalse<T extends false> = T;

// ─── 1. Minimal valid DocumentRuntimeState (partially-ready) compiles ──────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _partiallyReadyDocument: DocumentRuntimeState = {
	documentId: 'doc_thesis' as DocumentId,
	draft: null,
	missingRequiredNodeIds: ['node_problem' as NodeId],
	optionalNodeIds: [],
	requiredNodeIds: ['node_thesis_core' as NodeId, 'node_problem' as NodeId],
	sourceNodeIds: ['node_thesis_core' as NodeId, 'node_problem' as NodeId],
	staleSourceNodeIds: [],
	status: 'partially_ready',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

// ─── 2. DocumentStatus has exactly 6 members ───────────────────────────────

// These 6 assignments compile only if DocumentStatus covers all 6 strings.
// If one is missing or misspelled, tsc rejects.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _statuses: Record<DocumentStatus, true> = {
	accepted: true,
	drafted: true,
	not_ready: true,
	partially_ready: true,
	ready: true,
	stale: true,
};

// Type-level assertion: the 6 known literals are assignable to DocumentStatus.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _All6Covered =
	| Expect<IsAssignable<'not_ready', DocumentStatus>>
	| Expect<IsAssignable<'partially_ready', DocumentStatus>>
	| Expect<IsAssignable<'ready', DocumentStatus>>
	| Expect<IsAssignable<'drafted', DocumentStatus>>
	| Expect<IsAssignable<'accepted', DocumentStatus>>
	| Expect<IsAssignable<'stale', DocumentStatus>>;

// ─── 3. missingRequiredNodeIds is typed as NodeId[] ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _MissingReqIsNodeIdArray = Expect<
	IsAssignable<NodeId[], DocumentRuntimeState['missingRequiredNodeIds']>
>;

// ─── 4. DocumentStatus discriminated union narrowing ───────────────────────

/** Helper: exhaustive switch coverage over DocumentStatus. */
function _describe(status: DocumentStatus): string {
	// If the switch is exhaustive, tsc compiles without errors.
	// If a status is missing, tsc reports "not all code paths return a value".
	switch (status) {
		case 'not_ready':
			return 'No source nodes accepted yet.';
		case 'partially_ready':
			return 'Some required nodes still missing.';
		case 'ready':
			return 'All required nodes accepted. Ready for draft.';
		case 'drafted':
			return 'A materialized draft exists.';
		case 'accepted':
			return 'The draft has been accepted.';
		case 'stale':
			return 'Source content has changed since last draft.';
	}
}
// Prevent unused warning.
void _describe;

// ─── 5. MaterializedDocumentDraft.stale is a boolean ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _draft: MaterializedDocumentDraft = {
	content: '# Thesis\n\nThesis content.',
	documentId: 'doc_thesis' as DocumentId,
	format: 'markdown',
	generatedAt: '2026-01-02T00:00:00.000Z',
	missingSections: [],
	sourceNodeIds: ['node_thesis_core' as NodeId],
	stale: false,
};

// stale must be assignable to boolean.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _StaleIsBoolean = Expect<
	IsAssignable<boolean, MaterializedDocumentDraft['stale']>
>;
// stale must NOT be string.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _StaleIsNotString = ExpectFalse<
	IsAssignable<string, MaterializedDocumentDraft['stale']>
>;

// ─── 6. DocumentSectionRule compiles ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sectionRule: DocumentSectionRule = {
	required: true,
	sectionId: 'sec_thesis_statement',
	sourceNodeIds: ['node_thesis_core' as NodeId],
	title: 'Thesis Statement',
};

// ─── 7. ExportRuntimeState compiles ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _exportState: ExportRuntimeState = {
	artifacts: [],
};

// ─── 8. GeneratedArtifact compiles ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _artifact: GeneratedArtifact = {
	generatedAt: '2026-01-03T00:00:00.000Z',
	id: 'art_thesis_md',
	path: 'exports/thesis.md',
	sessionId: 'sess_000000000000001' as import('../shared/index.js').SessionId,
	sourceDocumentIds: ['doc_thesis' as DocumentId],
	sourceNodeIds: ['node_thesis_core' as NodeId],
	stale: true,
	type: 'markdown',
};

// ─── 9. GeneratedArtifact.type is exactly the 3-option union ────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ArtifactTypeIsUnion =
	| Expect<IsAssignable<'markdown', GeneratedArtifactType>>
	| Expect<IsAssignable<'html', GeneratedArtifactType>>
	| Expect<IsAssignable<'agent_pack', GeneratedArtifactType>>;

// Random string is NOT assignable to GeneratedArtifactType.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ArtifactTypeRejectsRandom = ExpectFalse<
	IsAssignable<'pdf', GeneratedArtifactType>
>;
