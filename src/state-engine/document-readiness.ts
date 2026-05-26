/**
 * Document readiness computation — evaluates whether a document is ready
 * for materialization given the state of its source nodes.
 *
 * `computeDocumentReadiness` evaluates a single document. It determines
 * the document status (`"ready"`, `"partially_ready"`, `"not_ready"`,
 * `"stale"`) based on the lifecycle and canonical answer state of its
 * source nodes.
 *
 * `recomputeAllDocumentReadiness` recomputes every document in the
 * profile, returning an updated `LogosRuntimeState`. It preserves
 * existing drafts.
 *
 * Document readiness gates materialization and export. The sidebar and
 * document preview panel depend on this evaluation.
 *
 * All functions are pure: no side effects, no state mutation.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md §5}
 * @see {@link https://logos-engine/docs/13-prototypes.md §1.4}
 */
import type {
	DocumentRuntimeState,
	DocumentStatus,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../contracts/index.js';
import type { DocumentId, NodeId } from '../shared/index.js';
import { nowIso } from '../shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine whether a node has been accepted — its lifecycle is
 * `"accepted"` and it has a canonical answer.
 *
 * Does NOT require `canonicalAnswer.accepted === true` — that field is
 * managed by Step 4.2 (canonical answer management) and is not available
 * at this stage. The lifecycle transition to `accepted` is the trigger
 * for document readiness recomputation.
 */
function isNodeAccepted(nodeState: NodeRuntimeState): boolean {
	return (
		nodeState.lifecycle === 'accepted' && nodeState.canonicalAnswer !== null
	);
}

/**
 * Determine whether a node's canonical answer is stale.
 *
 * Only accepted nodes with stale canonical answers are considered.
 * A node that is not accepted never produces stale content for
 * document readiness purposes.
 */
function isNodeStale(nodeState: NodeRuntimeState): boolean {
	return (
		isNodeAccepted(nodeState) &&
		nodeState.canonicalAnswer !== null &&
		nodeState.canonicalAnswer.stale === true
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate the readiness of a single document.
 *
 * Sources and required nodes are derived from the profile's
 * `materializationRules` first (preferred), falling back to the
 * `DocumentDefinition`.
 *
 * Status precedence:
 * 1. `"stale"` — at least one required or source node has a stale
 *    canonical answer.
 * 2. `"ready"` — all required nodes are accepted with non-stale
 *    canonical answers.
 * 3. `"partially_ready"` — at least one source node is accepted but
 *    some required nodes are still missing.
 * 4. `"not_ready"` — no source nodes are accepted.
 *
 * Preserves the existing `draft` from `state.documentStates[documentId]`
 * if one exists; otherwise `draft` is `null`.
 *
 * @param documentId - The ID of the document to evaluate.
 * @param state      - The current runtime state (not mutated).
 * @param profile    - The loaded profile.
 * @returns A new `DocumentRuntimeState` reflecting current readiness.
 */
export function computeDocumentReadiness(
	documentId: DocumentId,
	state: LogosRuntimeState,
	profile: LogosProfile,
): DocumentRuntimeState {
	// ── Resolve source / required / optional node IDs ───────────────
	const rule = profile.materializationRules.find(
		(r) => r.documentId === documentId,
	);
	const doc = profile.documents.find((d) => d.id === documentId);

	// Prefer rule metadata; fall back to document definition.
	let sourceNodeIds: NodeId[];
	let requiredNodeIds: NodeId[];
	let optionalNodeIds: NodeId[];

	if (rule) {
		sourceNodeIds = rule.sourceNodeIds;
		requiredNodeIds = rule.requiredNodeIds;
		optionalNodeIds = rule.optionalNodeIds;
	} else if (doc) {
		sourceNodeIds = [...doc.requiredNodeIds, ...doc.optionalNodeIds];
		requiredNodeIds = doc.requiredNodeIds;
		optionalNodeIds = doc.optionalNodeIds;
	} else {
		// Document exists in state but not in profile — should not happen
		// in normal operation. Return `not_ready` with empty arrays.
		const existing = state.documentStates[documentId];
		return {
			documentId,
			draft: existing?.draft ?? null,
			missingRequiredNodeIds: [],
			optionalNodeIds: [],
			requiredNodeIds: [],
			sourceNodeIds: [],
			staleSourceNodeIds: [],
			status: 'not_ready' as DocumentStatus,
			updatedAt: nowIso(),
		};
	}

	// ── Classify source nodes ───────────────────────────────────────
	const acceptedNodeIds: NodeId[] = [];
	const staleNodeIds: NodeId[] = [];
	let anyAccepted = false;

	for (const nodeId of sourceNodeIds) {
		const nodeState: NodeRuntimeState | undefined = state.nodeStates[nodeId];
		if (!nodeState) {
			continue; // Node not yet initialized — treated as not accepted.
		}

		if (isNodeStale(nodeState)) {
			acceptedNodeIds.push(nodeId);
			staleNodeIds.push(nodeId);
			anyAccepted = true;
		} else if (isNodeAccepted(nodeState)) {
			acceptedNodeIds.push(nodeId);
			anyAccepted = true;
		}
		// Otherwise: node exists but is not accepted/stale — not counted.
	}

	// Compute which required nodes are missing.
	const missingRequiredNodeIds: NodeId[] = requiredNodeIds.filter(
		(id) => !acceptedNodeIds.includes(id),
	);

	// ── Determine status ────────────────────────────────────────────
	let status: DocumentStatus;
	if (staleNodeIds.length > 0) {
		status = 'stale';
	} else if (missingRequiredNodeIds.length === 0 && anyAccepted) {
		status = 'ready';
	} else if (anyAccepted) {
		status = 'partially_ready';
	} else {
		status = 'not_ready';
	}

	// ── Preserve existing draft ─────────────────────────────────────
	const existing = state.documentStates[documentId];

	return {
		documentId,
		draft: existing?.draft ?? null,
		missingRequiredNodeIds,
		optionalNodeIds,
		requiredNodeIds,
		sourceNodeIds,
		staleSourceNodeIds: staleNodeIds,
		status,
		updatedAt: nowIso(),
	};
}

/**
 * Recompute readiness for all documents in the profile.
 *
 * Iterates over all `DocumentMaterializationRule` entries and
 * `DocumentDefinition` entries in the profile, computes readiness
 * for each, and returns an updated `LogosRuntimeState` with the
 * `documentStates` record fully populated.
 *
 * Existing drafts are preserved — only `status`, `missingRequiredNodeIds`,
 * and `staleSourceNodeIds` are recomputed.
 *
 * @param state   - The current runtime state (not mutated).
 * @param profile - The loaded profile.
 * @returns A new `LogosRuntimeState` with updated `documentStates`.
 */
export function recomputeAllDocumentReadiness(
	state: LogosRuntimeState,
	profile: LogosProfile,
): LogosRuntimeState {
	const nextDocumentStates: Record<DocumentId, DocumentRuntimeState> = {};

	// Collect all document IDs from rules and document definitions.
	const seenIds = new Set<DocumentId>();

	// Materialization rules take precedence — their document IDs are
	// authoritative.
	for (const rule of profile.materializationRules) {
		const docId = rule.documentId;
		seenIds.add(docId);
		nextDocumentStates[docId] = computeDocumentReadiness(docId, state, profile);
	}

	// Document definitions without matching rules get computed too.
	for (const doc of profile.documents) {
		if (!seenIds.has(doc.id)) {
			nextDocumentStates[doc.id] = computeDocumentReadiness(
				doc.id,
				state,
				profile,
			);
		}
	}

	// Preserve existing document states for docs not in the profile
	// (defensive — should not happen in normal operation).
	for (const [docId, existingState] of Object.entries(state.documentStates)) {
		if (!(docId in nextDocumentStates)) {
			nextDocumentStates[docId as DocumentId] = existingState;
		}
	}

	return {
		...state,
		documentStates: nextDocumentStates,
		updatedAt: nowIso(),
	};
}
