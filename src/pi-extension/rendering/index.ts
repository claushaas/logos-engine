/**
 * LOGOS Pi Extension — Rendering barrel export.
 *
 * Re-exports all rendering types and functions for the Pi extension surface.
 * Core must never import this module.
 */

export type { RenderGenerationBlockersInput } from './generation-blocker-renderer.js';
export { renderGenerationBlockers } from './generation-blocker-renderer.js';
export type { PhaseProgress, ProgressSummary } from './progress-formatter.js';
export {
	formatPhaseProgress,
	formatProgressSummary,
} from './progress-formatter.js';
export { registerLogosRenderers } from './register-renderers.js';
export type { RenderAssistantMessageInput } from './render-assistant-message.js';
export { renderAssistantMessage } from './render-assistant-message.js';
export type {
	LogosRenderedMessage,
	LogosRenderedMessageKind,
	RenderCoreResultInput,
} from './render-core-result.js';
export {
	extractRenderedMessage,
	renderCoreResult,
} from './render-core-result.js';
// ---- Step 9.2 specialized renderers ----
export type { RenderStatusInput } from './status-renderer.js';
export { renderStatus } from './status-renderer.js';
