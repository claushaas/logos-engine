/**
 * Document materializer — assembles accepted canonical answers into
 * structured Markdown documents.
 *
 * `materializeDocument` is the strict entry point: it never includes
 * unaccepted answer content and reports missing/stale sections via
 * inline markers.  It returns a `Result` so callers can distinguish
 * configuration errors (missing rule) from partial drafts.
 *
 * `previewDocument` is the permissive variant: it always returns a
 * draft, falling back to a defensive empty document when the rule is
 * absent.  Missing and stale markers are always included.
 *
 * Both functions are pure — they do not mutate state and produce
 * repeatable output for the same inputs.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 * @see {@link https://logos-engine/docs/architecture/02-runtime-architecture.md}
 */
import type {
	DocumentMaterializationRule,
	LogosProfile,
	LogosRuntimeState,
	MaterializedDocumentDraft,
	NodeRuntimeState,
} from '../contracts/index.js';
import type { DocumentId, NodeId, Result } from '../shared/index.js';
import { err, nowIso, ok } from '../shared/index.js';

// ─── MaterializationError ───────────────────────────────────────────────────

/**
 * Structured error returned when `materializeDocument` cannot proceed.
 *
 * Currently the only error is a missing materialization rule, but the
 * type is open for future expansion (e.g., profile mismatch, cycle
 * detection).
 */
export type MaterializationError = {
	/** Machine-readable error code. */
	readonly code: string;

	/** The document that was requested. */
	readonly documentId: DocumentId;

	/** Human-readable description of the problem. */
	readonly message: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find the materialization rule for `documentId` in the profile.
 *
 * Returns `undefined` when no rule exists — this is a configuration
 * error for `materializeDocument` and a soft fallback for `previewDocument`.
 */
function findRule(
	profile: LogosProfile,
	documentId: DocumentId,
): DocumentMaterializationRule | undefined {
	return profile.materializationRules.find(
		(r) => r.documentId === documentId,
	);
}

/**
 * Determine whether a node has been **accepted** for materialization
 * purposes.
 *
 * All three conditions must hold:
 * 1. The node exists in `nodeStates`.
 * 2. Its lifecycle is `"accepted"`.
 * 3. It has a canonical answer with `accepted === true`.
 *
 * Nodes that are `"accepted"` by lifecycle but whose canonical answer
 * has not yet been explicitly accepted via Step 4.2 are treated as
 * missing — their content is never used in output.
 */
function isAccepted(nodeState: NodeRuntimeState | undefined): boolean {
	return (
		nodeState !== undefined &&
		nodeState.lifecycle === 'accepted' &&
		nodeState.canonicalAnswer !== null &&
		nodeState.canonicalAnswer.accepted === true
	);
}

/**
 * Determine whether a node's canonical answer is **stale**.
 *
 * Only accepted nodes with `canonicalAnswer.stale === true` are
 * considered stale.  Stale content is included in the draft for
 * preview visibility but the resulting `MaterializedDocumentDraft`
 * is flagged with `stale: true`.
 */
function isStale(nodeState: NodeRuntimeState | undefined): boolean {
	return (
		isAccepted(nodeState) &&
		nodeState!.canonicalAnswer !== null &&
		nodeState!.canonicalAnswer.stale === true
	);
}

/**
 * Build the `missingSections` array, deduplicating section IDs.
 */
function pushMissing(deduped: Set<string>, sectionId: string): void {
	deduped.add(sectionId);
}

const STALE_MARKER = '[⚠ STALE — source node has changed]';

// ─── Internal: buildMaterializedDraft ───────────────────────────────────────

/**
 * Shared draft-building logic used by both `materializeDocument` and
 * `previewDocument`.
 *
 * Iterates over every section in the materialization rule and collects
 * canonical answer content from accepted source nodes.  Sections with
 * no accepted content are handled according to their `required` flag.
 *
 * @returns A `MaterializedDocumentDraft` reflecting the current state
 *          of accepted answers.
 */
function buildMaterializedDraft(
	documentId: DocumentId,
	state: LogosRuntimeState,
	rule: DocumentMaterializationRule,
): MaterializedDocumentDraft {
	const sourceNodeIds: NodeId[] = [];
	const missingSectionsSet = new Set<string>();
	let anyStale = false;
	let acceptedSectionCount = 0;

	const sectionContents: string[] = [];

	for (const section of rule.sections) {
		const lines: string[] = [];
		lines.push(`## ${section.title}`);
		lines.push('');

		let allFreshAccepted = section.sourceNodeIds.length > 0;
		let anyStaleInSection = false;

		for (const nodeId of section.sourceNodeIds) {
			const nodeState = state.nodeStates[nodeId];

			if (isStale(nodeState)) {
				// Stale accepted answer — include content but mark stale.
				lines.push(STALE_MARKER);
				lines.push('');
				if (nodeState!.canonicalAnswer!.content) {
					lines.push(nodeState!.canonicalAnswer!.content);
					lines.push('');
				}
				anyStale = true;
				anyStaleInSection = true;
				allFreshAccepted = false;
				sourceNodeIds.push(nodeId);
			} else if (isAccepted(nodeState)) {
				// Fresh accepted answer — include content as-is.
				if (nodeState!.canonicalAnswer!.content) {
					lines.push(nodeState!.canonicalAnswer!.content);
					lines.push('');
				}
				sourceNodeIds.push(nodeId);
			} else {
				// Node is not accepted — mark as missing if section is required.
				allFreshAccepted = false;
				if (section.required) {
					lines.push(`[MISSING — requires node: ${nodeId}]`);
					lines.push('');
					pushMissing(missingSectionsSet, section.id);
				}
				// Optional nodes without accepted content are simply omitted.
			}
		}

		// A section is accepted only if it has at least one source node
		// and every source node is fresh accepted (non-stale, non-missing).
		if (allFreshAccepted) {
			acceptedSectionCount++;
		}

		sectionContents.push(lines.join('\n'));
	}

	// ── Assemble Markdown ──────────────────────────────────────────
	const contentLines: string[] = [];
	contentLines.push(`# ${rule.title}`);
	contentLines.push('');

	for (const sectionContent of sectionContents) {
		contentLines.push(sectionContent);
	}

	contentLines.push(
		`Completeness: ${acceptedSectionCount}/${rule.sections.length} sections accepted`,
	);

	return {
		documentId,
		content: contentLines.join('\n'),
		format: 'markdown',
		generatedAt: nowIso(),
		sourceNodeIds,
		missingSections: [...missingSectionsSet],
		stale: anyStale,
	};
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Materialize a document from accepted canonical answers.
 *
 * Strict mode:
 * - Only accepted, non-stale canonical answer content is used.
 * - Unaccepted content is **never** included in the output.
 * - Missing required sections are flagged with `[MISSING — requires node: X]`.
 * - Stale sections are flagged with `[⚠ STALE — source node has changed]`
 *   and the resulting draft's `stale` field is `true`.
 * - Completeness indicator is appended.
 *
 * Returns an error when the materialization rule is not found in the
 * profile — this is a hard configuration error, not a content-level
 * issue.
 *
 * @param documentId - The document to materialize (branded).
 * @param state      - The current runtime state (not mutated).
 * @param profile    - The loaded profile containing materialization rules.
 * @returns `Result<MaterializedDocumentDraft, MaterializationError>`.
 */
export function materializeDocument(
	documentId: DocumentId,
	state: LogosRuntimeState,
	profile: LogosProfile,
): Result<MaterializedDocumentDraft, MaterializationError> {
	const rule = findRule(profile, documentId);
	if (!rule) {
		return err({
			code: 'DOCUMENT_RULE_NOT_FOUND',
			documentId,
			message: `No materialization rule found for document "${documentId}".`,
		});
	}

	return ok(buildMaterializedDraft(documentId, state, rule));
}

/**
 * Preview a document — always returns a draft.
 *
 * Permissive mode:
 * - Same content as `materializeDocument` when the rule exists.
 * - When the rule is **not found**, returns a defensive empty draft
 *   with a placeholder title (falling back to `DocumentDefinition.title`
 *   or the document ID) so the TUI preview panel never crashes.
 *
 * @param documentId - The document to preview (branded).
 * @param state      - The current runtime state (not mutated).
 * @param profile    - The loaded profile.
 * @returns A `MaterializedDocumentDraft` — never throws.
 */
export function previewDocument(
	documentId: DocumentId,
	state: LogosRuntimeState,
	profile: LogosProfile,
): MaterializedDocumentDraft {
	const rule = findRule(profile, documentId);
	if (!rule) {
		// Defensive fallback: try to find the document title from
		// DocumentDefinition, otherwise use the raw document ID.
		const docDef = profile.documents.find((d) => d.id === documentId);
		const title = docDef?.title ?? String(documentId);

		return {
			documentId,
			content: [
				`# ${title}`,
				'',
				'*Document materialization rule not found. Cannot preview.*',
				'',
				'Completeness: 0/0 sections accepted',
			].join('\n'),
			format: 'markdown',
			generatedAt: nowIso(),
			sourceNodeIds: [],
			missingSections: [],
			stale: false,
		};
	}

	return buildMaterializedDraft(documentId, state, rule);
}
