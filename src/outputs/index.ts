/**
 * Outputs module — export management and artifact generation.
 *
 * Provides:
 * - `exportMarkdown()` — write materialized documents to `.md` files.
 * - `exportHtml()` — write materialized documents to `.html` files.
 * - `getAvailableExports()` — evaluate export availability across all
 *   documents and formats.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */

export type { ExportAvailability } from './export-manager.js';
export { getAvailableExports } from './export-manager.js';
export { exportHtml } from './html-exporter.js';
export type { ExportError } from './markdown-exporter.js';
export { exportMarkdown } from './markdown-exporter.js';
