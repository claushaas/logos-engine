/**
 * HTML exporter — writes a materialized document to an `.html` file
 * on disk.
 *
 * `exportHtml` gates on the same conditions as `exportMarkdown`:
 * document readiness, materialization completeness, and staleness.
 * The Markdown content from `materializeDocument()` is wrapped in a
 * minimal HTML shell with proper escaping for safe local viewing.
 *
 * HTML artifacts are derived — the canonical source remains the
 * Markdown document. HTML is generated only when Markdown export
 * is valid.
 *
 * Side effects: creates parent directories and writes the file via
 * `fs/promises`.  Does NOT mutate runtime state — the caller is
 * responsible for recording the `GeneratedArtifact` in the session.
 *
 * All filesystem errors are caught and returned as `ExportError` —
 * this function never throws for expected I/O failure paths.
 *
 * @see {@link https://logos-engine/docs/architecture/10-local-development-and-deployment.md §11}
 * @see {@link https://logos-engine/docs/13-prototypes.md §3.12}
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
import { err, generateId, ok, nowIso } from '../shared/index.js';
import { computeDocumentReadiness } from '../state-engine/document-readiness.js';
import type { ExportError } from './markdown-exporter.js';

// ─── HTML escaping ──────────────────────────────────────────────────────────

/**
 * Escape a string for safe inclusion in HTML text content.
 *
 * Replaces `&`, `<`, `>`, `"`, and `'` with their named entity
 * equivalents.  This is sufficient for attribute values and
 * text content; it is NOT a substitute for context-aware escaping
 * in arbitrary HTML insertion scenarios.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

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
 * Derive the HTML output path from the materialization rule's output path.
 *
 * If the output path ends with `.md` or `.markdown`, replace the
 * trailing extension with `.html`.  Otherwise append `.html`.
 */
function deriveHtmlPath(rule: DocumentMaterializationRule): string {
	const outputPath = rule.outputPath;

	if (outputPath.endsWith('.md')) {
		return outputPath.slice(0, -3) + '.html';
	}
	if (outputPath.endsWith('.markdown')) {
		return outputPath.slice(0, -9) + '.html';
	}
	return `${outputPath}.html`;
}

// ─── HTML shell builder ─────────────────────────────────────────────────────

/**
 * Build a complete HTML document shell around the escaped Markdown content.
 *
 * The shell includes:
 * - `<!doctype html>` and standard meta tags.
 * - A metadata header block with document info and generation timestamp.
 * - The document content inside `<pre><code>` preserved verbatim (escaped).
 * - Minimal CSS for readability.
 * - A note that this is a derived artifact, not canonical source.
 *
 * @param title   - The document title (escaped).
 * @param content - The materialized Markdown content (escaped).
 * @param metadata - Generation metadata for the header.
 * @returns A complete HTML document string.
 */
function buildHtmlShell(
	title: string,
	content: string,
	metadata: {
		readonly documentId: DocumentId;
		readonly generatedAt: string;
		readonly sourceNodeIds: readonly string[];
	},
): string {
	const escapedTitle = escapeHtml(title);
	const escapedContent = escapeHtml(content);
	const escapedDocumentId = escapeHtml(String(metadata.documentId));
	const escapedGeneratedAt = escapeHtml(metadata.generatedAt);
	const escapedSourceNodes = escapeHtml(metadata.sourceNodeIds.join(', '));

	return `\
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle}</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 48rem;
    margin: 2rem auto;
    padding: 0 1rem;
    line-height: 1.6;
    color: #1a1a1a;
  }
  .metadata {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 2rem;
    font-size: 0.875rem;
    color: #666;
  }
  .metadata dt {
    font-weight: 600;
    margin-top: 0.5rem;
  }
  .metadata dd {
    margin-left: 0;
    margin-bottom: 0.5rem;
  }
  pre {
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 1.5rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  code {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
    font-size: 0.875rem;
  }
  .footer-note {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
    font-size: 0.8rem;
    color: #999;
  }
</style>
</head>
<body>
<div class="metadata">
  <dl>
    <dt>Document</dt>
    <dd>${escapedTitle}</dd>
    <dt>Document ID</dt>
    <dd>${escapedDocumentId}</dd>
    <dt>Generated</dt>
    <dd>${escapedGeneratedAt}</dd>
    <dt>Source Nodes</dt>
    <dd>${escapedSourceNodes}</dd>
  </dl>
</div>

<h1>${escapedTitle}</h1>

<pre><code>${escapedContent}</code></pre>

<div class="footer-note">
  <p>This is a <strong>derived artifact</strong> generated by LOGOS Engine.
  The canonical source is the Markdown document. Changes to source
  nodes will require re-export.</p>
</div>
</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export a document as an HTML artifact.
 *
 * Gating rules (same as `exportMarkdown`):
 * 1. A materialization rule must exist for the document.
 * 2. The document must be **ready** / **drafted** / **accepted**
 *    (not `"not_ready"`, `"partially_ready"`, or `"stale"`).
 * 3. The materialized draft must be complete and non-stale.
 * 4. The target output path must not already exist (collision policy).
 *
 * On success, writes the HTML content to the derived output path
 * and returns a `GeneratedArtifact` with metadata.
 *
 * @param documentId - The document to export (branded).
 * @param state      - The current runtime state (not mutated).
 * @param profile    - The loaded profile.
 * @returns A `Promise` resolving to `Result<GeneratedArtifact, ExportError>`.
 */
export async function exportHtml(
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
	const outputPath = deriveHtmlPath(rule);

	// ── Step 5: Check for file collision ─────────────────────────────
	try {
		await access(outputPath, constants.F_OK);
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

	// ── Step 7: Build HTML content ──────────────────────────────────
	const generatedAt = nowIso();
	const htmlContent = buildHtmlShell(rule.title, draft.content, {
		documentId,
		generatedAt,
		sourceNodeIds: draft.sourceNodeIds.map(String),
	});

	// ── Step 8: Write content ────────────────────────────────────────
	try {
		await writeFile(outputPath, htmlContent, 'utf-8');
	} catch (writeErr: unknown) {
		const writeError = writeErr as NodeJS.ErrnoException;
		return err({
			code: 'WRITE_FAILED',
			documentId,
			message: `Failed to write "${outputPath}": ${writeError.message}`,
		});
	}

	// ── Step 9: Build artifact metadata ──────────────────────────────
	const artifact: GeneratedArtifact = {
		generatedAt,
		id: generateId(),
		path: outputPath,
		sessionId: state.sessionId,
		sourceDocumentIds: [documentId],
		sourceNodeIds: draft.sourceNodeIds,
		stale: false,
		type: 'html',
	};

	return ok(artifact);
}
