/**
 * Materialization — document assembly from accepted canonical answers.
 *
 * The materialization module converts structured conversation outputs
 * (accepted canonical answers) into readable, portable Markdown documents.
 *
 * Two entry points:
 * - `materializeDocument` — strict; returns `Result`.
 * - `previewDocument` — permissive; always returns a draft.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 */
export {
	materializeDocument,
	previewDocument,
	type MaterializationError,
} from './document-materializer.js';
