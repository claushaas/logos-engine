/**
 * Outputs module — export management and artifact generation.
 *
 * Provides:
 * - `exportMarkdown()` — write materialized documents to `.md` files.
 * - `getAvailableExports()` — evaluate export availability across all
 *   documents and formats.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.8}
 */
export { exportMarkdown } from './markdown-exporter.js';
export type { ExportError } from './markdown-exporter.js';
export { getAvailableExports } from './export-manager.js';
export type { ExportAvailability } from './export-manager.js';
