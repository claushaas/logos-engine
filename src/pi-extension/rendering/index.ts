/**
 * LOGOS Pi Extension — Rendering barrel export.
 *
 * Re-exports all rendering types and functions for the Pi extension surface.
 * Core must never import this module.
 */

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
