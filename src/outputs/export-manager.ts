/**
 * Export manager — evaluates which export formats are available for
 * each document in the loaded profile.
 *
 * `getAvailableExports` returns an `ExportAvailability` entry for each
 * document/document+format pair.  It gates on document readiness:
 * incomplete or stale documents show as unavailable with a concrete
 * blocked reason.
 *
 * Markdown, HTML, and Agent Pack all share the same readiness gate.
 *
 * Pure function — no side effects, no state mutation.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md §10}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */
import type {
	GeneratedArtifactType,
	LogosProfile,
	LogosRuntimeState,
} from '../contracts/index.js';
import { materializeDocument } from '../materialization/document-materializer.js';
import type { DocumentId } from '../shared/index.js';
import { computeDocumentReadiness } from '../state-engine/document-readiness.js';

// ─── ExportAvailability ─────────────────────────────────────────────────────

/**
 * Availability of an export format for a specific document.
 */
export type ExportAvailability = {
	/** The document this assessment applies to (branded). */
	readonly documentId: DocumentId;

	/** Human-readable document title (from the profile definition). */
	readonly documentTitle: string;

	/** The export format being assessed. */
	readonly format: GeneratedArtifactType;

	/** Whether the format is currently available for this document. */
	readonly available: boolean;

	/** Human-readable reason when `available === false`. */
	readonly blockedReason?: string;
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluate export availability for all documents in the profile.
 *
 * For each document in `profile.documents` (or `profile.materializationRules`),
 * checks:
 * - Does a materialization rule exist?
 * - Is the document ready / drafted / accepted?
 * - Is the document stale?
 * - Does the materialized draft pass the completeness check?
 *
 * HTML export mirrors Markdown readiness (same gates); Agent Pack
 * remains a placeholder (Phase 17).
 *
 * Already-generated artifacts (from `state.exportState`) are included
 * for informational purposes but do not affect availability assessment.
 *
 * @param state   - The current runtime state (not mutated).
 * @param profile - The loaded profile.
 * @returns An array of `ExportAvailability` entries.
 */
export function getAvailableExports(
	state: LogosRuntimeState,
	profile: LogosProfile,
): ExportAvailability[] {
	const results: ExportAvailability[] = [];

	// Collect all document IDs from materialization rules and doc definitions.
	const documentIds = new Set<DocumentId>();

	for (const rule of profile.materializationRules) {
		documentIds.add(rule.documentId);
	}
	for (const doc of profile.documents) {
		documentIds.add(doc.id);
	}

	// Evaluate each document.
	for (const documentId of documentIds) {
		const rule = profile.materializationRules.find(
			(r) => r.documentId === documentId,
		);
		const docDef = profile.documents.find((d) => d.id === documentId);
		const title = docDef?.title ?? String(documentId);

		// Compute a single readiness verdict shared by all export formats.
		let documentExportAvailable = false;
		let blockedReason: string | undefined;

		if (!rule) {
			blockedReason = 'No materialization rule configured.';
		} else {
			// Compute readiness on-the-fly so availability is always current —
			// does not depend on pre-computed documentStates.
			const readiness = computeDocumentReadiness(documentId, state, profile);

			const exportableStatuses = new Set(['ready', 'drafted', 'accepted']);

			if (!exportableStatuses.has(readiness.status)) {
				if (readiness.status === 'stale') {
					blockedReason =
						'Document is stale. Reopen and re-accept source nodes to refresh.';
				} else if (readiness.status === 'partially_ready') {
					const missing = readiness.missingRequiredNodeIds.join(', ');
					blockedReason =
						missing.length > 0
							? `Missing required nodes: ${missing}.`
							: 'Document is partially ready. Accept all required source nodes.';
				} else {
					blockedReason =
						'Document is not ready. Accept at least one source node.';
				}
			} else {
				// Document is ready / drafted / accepted — materialize and
				// cross-check for inconsistencies.
				const draftResult = materializeDocument(documentId, state, profile);

				if (!draftResult.ok) {
					blockedReason = draftResult.error.message;
				} else if (draftResult.value.stale) {
					blockedReason =
						'Materialized draft is stale. Source nodes may have changed.';
				} else if (draftResult.value.missingSections.length > 0) {
					const sections = draftResult.value.missingSections.join(', ');
					blockedReason = `Missing required sections: ${sections}.`;
				} else {
					documentExportAvailable = true;
				}
			}
		}

		// ── Markdown: the canonical format — implemented ─────────────
		const markdownEntry: ExportAvailability = {
			available: documentExportAvailable,
			documentId,
			documentTitle: title,
			format: 'markdown',
		};
		if (!documentExportAvailable && blockedReason !== undefined) {
			(markdownEntry as { blockedReason?: string }).blockedReason =
				blockedReason;
		}
		results.push(markdownEntry);

		// ── HTML: mirrors Markdown readiness (same gates) ────────────
		const htmlEntry: ExportAvailability = {
			available: documentExportAvailable,
			documentId,
			documentTitle: title,
			format: 'html',
		};
		if (!documentExportAvailable && blockedReason !== undefined) {
			(htmlEntry as { blockedReason?: string }).blockedReason = blockedReason;
		}
		results.push(htmlEntry);

		// ── Agent Pack: same gates as Markdown/HTML — Phase 17 ─────
		const agentPackEntry: ExportAvailability = {
			available: documentExportAvailable,
			documentId,
			documentTitle: title,
			format: 'agent_pack',
		};
		if (!documentExportAvailable && blockedReason !== undefined) {
			(agentPackEntry as { blockedReason?: string }).blockedReason =
				blockedReason;
		}
		results.push(agentPackEntry);
	}

	return results;
}
