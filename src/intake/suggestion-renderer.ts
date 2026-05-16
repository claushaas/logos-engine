/** Suggestion Renderer — converts suggestions to terminal-friendly lines */

import { redactString } from '../runtime/redaction.js';
import type {
	ContextualSuggestion,
	ContextualSuggestionRenderOptions,
} from './contextual-suggestion-types.js';
import { DEFAULT_SUGGESTION_RENDER_OPTIONS } from './contextual-suggestion-types.js';

const SECRET_SUBSTRING_PATTERNS = [
	/\bsk-[a-zA-Z0-9_-]{10,}\b/g,
	/\bgsk_[a-zA-Z0-9]{10,}\b/g,
	/\bhf_[a-zA-Z0-9]{10,}\b/g,
	/\bBearer\s+[a-zA-Z0-9\-_.~+/=]{20,}\b/gi,
	/\beyJ[a-zA-Z0-9_\-.]{8,}\b/g,
	/\b(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl)[a-zA-Z0-9_-]{10,}\b/g,
];

function redactLine(line: string): string {
	let result = line;
	for (const pattern of SECRET_SUBSTRING_PATTERNS) {
		result = result.replace(pattern, '[REDACTED]');
	}
	return redactString(result);
}

export function renderContextualSuggestions(
	suggestions: ContextualSuggestion[],
	options: ContextualSuggestionRenderOptions = DEFAULT_SUGGESTION_RENDER_OPTIONS,
): string[] {
	const lines: string[] = [];
	const opts = { ...DEFAULT_SUGGESTION_RENDER_OPTIONS, ...options };
	const toRender = suggestions.slice(0, opts.maxSuggestions);

	if (toRender.length === 0) return lines;

	lines.push('');
	lines.push(
		'Contextual suggestions [suggestions only — not confirmed facts]:',
	);

	for (const s of toRender) {
		lines.push('');
		lines.push(redactLine(`  [${s.kind}] ${redactString(s.title)}`));
		lines.push(redactLine(`    ${redactString(s.body)}`));

		if (opts.showSourceReferences) {
			const refs: string[] = [];
			if (s.sourceDocumentId) refs.push(`doc=${s.sourceDocumentId}`);
			if (s.sourcePhaseId) refs.push(`phase=${s.sourcePhaseId}`);
			if (s.sourceQuestionId) refs.push(`question=${s.sourceQuestionId}`);
			if (s.relatedDecisionId) refs.push(`decision=${s.relatedDecisionId}`);
			if (s.relatedAssumptionId)
				refs.push(`assumption=${s.relatedAssumptionId}`);
			if (s.relatedOpenQuestionId)
				refs.push(`openQ=${s.relatedOpenQuestionId}`);
			if (s.relatedRiskId) refs.push(`risk=${s.relatedRiskId}`);
			if (s.relatedProposalId) refs.push(`proposal=${s.relatedProposalId}`);
			if (refs.length > 0) {
				lines.push(redactLine(`    Source: ${refs.join(', ')}`));
			}
		}

		if (opts.showRecommendedCommands && s.recommendedCommand) {
			lines.push(redactLine(`    Suggested command: ${s.recommendedCommand}`));
		}

		if (s.confidence) {
			lines.push(
				redactLine(`    Confidence: ${s.confidence} (non-authoritative)`),
			);
		}
	}

	return lines;
}
