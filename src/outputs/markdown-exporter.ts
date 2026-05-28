/**
 * Markdown exporter — writes a materialized document to a `.md` file
 * on disk.
 *
 * `exportMarkdown` gates on document readiness and materialization
 * completeness: incomplete or stale documents are blocked.  The
 * content is obtained from `materializeDocument()` (strict mode), so
 * unaccepted answer content is never written.
 *
 * Side effects: creates parent directories and writes the file via
 * `fs/promises`.  Does NOT mutate runtime state — the caller is
 * responsible for recording the `GeneratedArtifact` in the session.
 *
 * All filesystem errors are caught and returned as `ExportError` —
 * this function never throws for expected I/O failure paths.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';
import type {
	DocumentMaterializationRule,
	GeneratedArtifact,
	LogosProfile,
	LogosRuntimeState,
} from '../contracts/index.js';
import { materializeDocument } from '../materialization/document-materializer.js';
import type { DocumentId, Result } from '../shared/index.js';
import { err, generateId, ok } from '../shared/index.js';
import { computeDocumentReadiness } from '../state-engine/document-readiness.js';

// ─── ExportError ────────────────────────────────────────────────────────────

/**
 * Structured error returned when `exportMarkdown` cannot proceed.
 */
export type ExportError = {
	/** Machine-readable error code. */
	readonly code: string;

	/** Human-readable description of the problem. */
	readonly message: string;

	/** The document that was requested (when applicable). */
	readonly documentId?: DocumentId;
};

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Find the materialization rule for `documentId` in the profile.
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
 * Ensure the output path ends with `.md`.
 */
function ensureMdExtension(filePath: string): string {
	if (filePath.endsWith('.md')) return filePath;
	return `${filePath}.md`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export a document as a Markdown file.
 *
 * Gating rules (in order):
 * 1. A materialization rule must exist for the document.
 * 2. The document must be **ready** or **drafted** / **accepted**
 *    (not `"not_ready"` or `"partially_ready"`).
 * 3. The document must not be stale.
 * 4. The materialized draft must be complete (no missing required
 *    sections) and non-stale.
 * 5. The target output path must not already exist (collision policy:
 *    block with `FILE_COLLISION`; overwrite requires explicit
 *    confirmation in a future UI step).
 *
 * On success, writes the Markdown content to the configured output
 * path and returns a `GeneratedArtifact` with metadata.
 *
 * @param documentId - The document to export (branded).
 * @param state      - The current runtime state (not mutated).
 * @param profile    - The loaded profile.
 * @returns A `Promise` resolving to `Result<GeneratedArtifact, ExportError>`.
 */
export async function exportMarkdown(
	documentId: DocumentId,
	state: LogosRuntimeState,
	profile: LogosProfile,
): Promise<Result<GeneratedArtifact, ExportError>> {
	// ── Step 1: Find the materialization rule ─────────────────────────
	const rule = findRule(profile, documentId);
	if (!rule) {
		return err({
			code: 'RULE_NOT_FOUND',
			documentId,
			message: `No materialization rule found for document "${documentId}".`,
		});
	}

	// ── Step 2: Check document readiness ─────────────────────────────
	const readiness = computeDocumentReadiness(documentId, state, profile);

	// Normalise "drafted" / "accepted" to the same export-ready gate.
	const exportableStatuses = new Set(['ready', 'drafted', 'accepted']);

	if (!exportableStatuses.has(readiness.status)) {
		if (readiness.status === 'stale') {
			return err({
				code: 'DOCUMENT_STALE',
				documentId,
				message: `Document "${documentId}" is stale and cannot be exported. Reopen and re-accept source nodes to refresh.`,
			});
		}
		if (readiness.status === 'partially_ready') {
			const missing = readiness.missingRequiredNodeIds.join(', ');
			return err({
				code: 'DOCUMENT_INCOMPLETE',
				documentId,
				message: `Document "${documentId}" is incomplete. Missing required nodes: ${missing || '(none known)'}.`,
			});
		}
		return err({
			code: 'DOCUMENT_NOT_READY',
			documentId,
			message: `Document "${documentId}" is not ready for export (status: ${readiness.status}).`,
		});
	}

	// ── Step 3: Materialize the document (strict mode) ───────────────
	const draftResult = materializeDocument(documentId, state, profile);
	if (!draftResult.ok) {
		return err({
			code: 'MATERIALIZATION_FAILED',
			documentId,
			message: draftResult.error.message,
		});
	}

	const draft = draftResult.value;

	// Double-check materializer output: block if still stale or missing
	// required sections (readiness and materializer differ on the
	// `canonicalAnswer.accepted` gating).
	if (draft.stale) {
		return err({
			code: 'DRAFT_STALE',
			documentId,
			message: `Materialized draft for "${documentId}" is stale. Source nodes may have changed.`,
		});
	}

	if (draft.missingSections.length > 0) {
		const sections = draft.missingSections.join(', ');
		return err({
			code: 'DRAFT_INCOMPLETE',
			documentId,
			message: `Document "${documentId}" has missing required sections: ${sections}.`,
		});
	}

	// ── Step 4: Resolve output path ──────────────────────────────────
	const outputPath = ensureMdExtension(rule.outputPath);

	// ── Step 5: Check for file collision ─────────────────────────────
	try {
		await access(outputPath, constants.F_OK);
		// File exists — block with collision error.
		return err({
			code: 'FILE_COLLISION',
			documentId,
			message: `Output file already exists: "${outputPath}". Use --overwrite to replace.`,
		});
	} catch (accessErr: unknown) {
		const accessError = accessErr as NodeJS.ErrnoException;
		if (accessError.code !== 'ENOENT') {
			return err({
				code: 'OUTPUT_PATH_ACCESS_FAILED',
				documentId,
				message: `Cannot access output path "${outputPath}": ${accessError.message}`,
			});
		}
		// ENOENT — file does not exist, proceed.
	}

	// ── Step 6: Create parent directories ────────────────────────────
	try {
		await mkdir(dirname(outputPath), { recursive: true });
	} catch (mkdirErr: unknown) {
		const mkdirError = mkdirErr as NodeJS.ErrnoException;
		return err({
			code: 'OUTPUT_DIRECTORY_FAILED',
			documentId,
			message: `Cannot create output directory for "${outputPath}": ${mkdirError.message}`,
		});
	}

	// ── Step 7: Write content ────────────────────────────────────────
	try {
		await writeFile(outputPath, draft.content, 'utf-8');
	} catch (writeErr: unknown) {
		const writeError = writeErr as NodeJS.ErrnoException;
		return err({
			code: 'WRITE_FAILED',
			documentId,
			message: `Failed to write "${outputPath}": ${writeError.message}`,
		});
	}

	// ── Step 8: Build artifact metadata ──────────────────────────────
	const artifact: GeneratedArtifact = {
		generatedAt: draft.generatedAt,
		id: generateId(),
		path: outputPath,
		sessionId: state.sessionId,
		sourceDocumentIds: [documentId],
		sourceNodeIds: draft.sourceNodeIds,
		stale: false,
		type: 'markdown',
	};

	return ok(artifact);
}
