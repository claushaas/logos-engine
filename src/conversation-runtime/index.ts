/**
 * Conversation runtime — node-scoped message management and conversation
 * utilities.
 *
 * Every node owns its own conversation history. This module provides
 * pure functions to append messages (user, assistant, system) and
 * retrieve conversation history from `LogosRuntimeState`.
 *
 * Exports:
 * - Message append: `appendUserMessage`, `appendAssistantMessage`,
 *   `appendSystemMessage`
 * - Conversation queries: `getConversation`, `getRecentMessages`
 * - Result types: `ConversationResult`, `ConversationDiagnostic`
 */

export {
	appendAssistantMessage,
	appendSystemMessage,
	appendUserMessage,
	getConversation,
	getRecentMessages,
} from './messages.js';
export type { ConversationResult } from './messages.js';
