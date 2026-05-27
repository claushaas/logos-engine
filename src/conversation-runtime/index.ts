/**
 * Conversation runtime — node-scoped message management, canonical answer
 * management, and conversation utilities.
 *
 * Every node owns its own conversation history and canonical answer.
 * This module provides pure functions to append messages (user, assistant,
 * system), retrieve conversation history, and manage canonical answers
 * (draft, accept, mark stale, regenerate) from `LogosRuntimeState`.
 *
 * Exports:
 * - Message append: `appendUserMessage`, `appendAssistantMessage`,
 *   `appendSystemMessage`
 * - Conversation queries: `getConversation`, `getRecentMessages`
 * - Canonical answers: `setCanonicalAnswerDraft`,
 *   `acceptCanonicalAnswer`, `markCanonicalAnswerStale`,
 *   `regenerateCanonicalAnswer`
 * - Summarizer: `summarizeConversation`
 * - Result types: `ConversationResult`, `CanonicalAnswerResult`
 */

export type { CanonicalAnswerResult } from './canonical-answers.js';
export {
	acceptCanonicalAnswer,
	markCanonicalAnswerStale,
	regenerateCanonicalAnswer,
	setCanonicalAnswerDraft,
} from './canonical-answers.js';
export type { ConversationResult } from './messages.js';
export {
	appendAssistantMessage,
	appendSystemMessage,
	appendUserMessage,
	getConversation,
	getRecentMessages,
} from './messages.js';
export { summarizeConversation } from './summarizer.js';
