/**
 * LOGOS Core — Assistant message from prompt helper (Step 3.4).
 *
 * Converts a selected {@link ActivePrompt} into a Core {@link AssistantMessage}
 * that the Pi Extension can render. This is a pure function: it does not
 * mutate state, call AI, or access filesystem.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { AssistantMessage } from '../messages.js';
import type { ActivePrompt } from './prompt-selection-types.js';

// ---------------------------------------------------------------------------
// Kind mapping
// ---------------------------------------------------------------------------

/**
 * Map an {@link ActivePrompt} kind to an {@link AssistantMessage} kind.
 *
 * | prompt kind                | message kind     |
 * |---------------------------|------------------|
 * | question                  | question         |
 * | follow_up                 | follow_up        |
 * | contradiction_resolution  | contradiction    |
 */
function mapKind(activePrompt: ActivePrompt): AssistantMessage['kind'] {
	switch (activePrompt.kind) {
		case 'question':
			return 'question';
		case 'follow_up':
			return 'follow_up';
		case 'contradiction_resolution':
			return 'contradiction';
		default:
			return 'warning';
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an {@link ActivePrompt} to a Core {@link AssistantMessage}.
 *
 * The message body includes contextual framing (phase id, document id,
 * priority) and the prompt's `context` (purpose) when available, so the
 * user sees more than a bare question.
 *
 * Metadata carries question id, phase id, document id, section id,
 * priority, required flag, and optional follow-up / contradiction
 * identifiers.
 *
 * The result is a plain serializable message intended for rendering
 * by the Pi Extension. No Pi-specific formatting is applied here.
 */
export function createAssistantMessageFromPrompt(
	prompt: ActivePrompt,
): AssistantMessage {
	const metadata: Record<string, unknown> = {
		documentId: prompt.documentId,
		phaseId: prompt.phaseId,
		priority: prompt.priority,
		required: prompt.required,
		sectionId: prompt.sectionId,
	};

	if (prompt.followUpId !== undefined) {
		metadata.followUpId = prompt.followUpId;
	}
	if (prompt.contradictionId !== undefined) {
		metadata.contradictionId = prompt.contradictionId;
	}
	if (prompt.context !== undefined) {
		metadata.context = prompt.context;
	}
	if (prompt.sourcePath !== undefined) {
		metadata.sourcePath = prompt.sourcePath;
	}
	if (prompt.metadata !== undefined) {
		metadata.promptMetadata = prompt.metadata;
	}

	// ---- Build a contextualized body -------
	const title = buildPromptTitle(prompt);
	const body = title !== undefined ? `${title}\n\n${prompt.text}` : prompt.text;

	return {
		body,
		kind: mapKind(prompt),
		metadata,
		questionId: prompt.questionId,
	};
}

// ---------------------------------------------------------------------------
// Contextual title builder
// ---------------------------------------------------------------------------

/**
 * Build a human-readable header line that frames the question for the user.
 *
 * Includes the phase id, document id, optional section id, priority, and
 * the `context` (purpose) when available.
 *
 * Example output:
 * ```
 * Phase 01-foundation · Document 01-thesis · critical
 * Core Thesis — Establish the central tension that drives the project.
 * ```
 */
function buildPromptTitle(prompt: ActivePrompt): string | undefined {
	const parts: string[] = [];

	// Location breadcrumb
	if (prompt.phaseId.length > 0) {
		parts.push(`Phase ${prompt.phaseId}`);
	}
	if (prompt.documentId.length > 0) {
		parts.push(`Document ${prompt.documentId}`);
	}
	if (prompt.sectionId.length > 0) {
		parts.push(`Section ${prompt.sectionId}`);
	}

	if (parts.length === 0) {
		return prompt.context;
	}

	// Append priority when available
	if (prompt.priority.length > 0) {
		parts.push(prompt.priority);
	}

	let header = parts.join(' · ');

	// Append context / purpose as a subtitle
	if (prompt.context !== undefined && prompt.context.length > 0) {
		header = `${header}\n${prompt.context}`;
	}

	return header;
}
