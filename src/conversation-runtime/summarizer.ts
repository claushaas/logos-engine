/**
 * Conversation summary generation — deterministic heuristic extraction of
 * facts, decisions, and assumptions from a node's message history.
 *
 * The summary is supplementary — it never replaces raw messages. It is
 * consumed by the prompt orchestrator for context-budget compression when
 * the conversation grows too long for the full history.
 *
 * All functions are pure: they take `NodeMessage[]` and return a string.
 * No state mutation, no side effects, no LLM calls.
 *
 * @see {@link https://logos-engine/docs/03-conversation-runtime-spec.md §10}
 * @see {@link https://logos-engine/docs/05-prompt-orchestration-spec.md §8}
 */
import type { NodeMessage, NodeMessageRole } from '../contracts/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Budget constants
// ═══════════════════════════════════════════════════════════════════════════

/** Hard cap on summary output (characters). */
const SUMMARY_HARD_CAP = 1000;

/** Maximum fraction of original conversation length the summary may occupy. */
const SUMMARY_MAX_FRACTION = 0.45;

/** Maximum total bullets in the summary. */
const MAX_TOTAL_BULLETS = 4;

// ═══════════════════════════════════════════════════════════════════════════
// Keyword heuristics
// ═══════════════════════════════════════════════════════════════════════════

/** Phrases that signal a decision was made (word-boundary regex). */
const DECISION_RE =
	/\b(decided|decision|chosen|chose|approved|accepted|picked|selected|settled|resolved|opted|elected|went with|go with|going with|will use|final choice)\b/i;

/** Phrases that signal an assumption or hypothesis (word-boundary regex). */
const ASSUMPTION_RE =
	/\b(assume|assumption|assuming|likely|probably|hypothesis|maybe|perhaps|possibly|guess|suppose|expect|believe|estimate|think)\b/i;

// ═══════════════════════════════════════════════════════════════════════════
// Sentence splitting
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split `text` into sentences deterministically.
 *
 * Splits on `.`, `!`, `?` followed by whitespace/end-of-string,
 * excluding common abbreviations (e.g. "e.g.", "i.e.", "etc.").
 */
function splitSentences(text: string): string[] {
	const raw = text.split(/(?<=[.!?])\s+/);
	return raw
		.map((s) => s.trim())
		.filter((s) => {
			// Exclude empty strings
			if (s.length === 0) return false;
			// Exclude common abbreviation fragments
			if (/^(?:e\.g|i\.e|etc|vs|fig|approx)$/i.test(s)) return false;
			return true;
		});
}

/**
 * Return true when `sentence` contains enough content to be a substantive
 * declarative statement (excludes questions, greetings, acknowledgements,
 * and very short fragments).
 */
function isSubstantive(sentence: string): boolean {
	const cleaned = sentence.replace(/^[.,!?;:\s]+/, '').trim();
	// Very short — likely not substantive
	if (cleaned.length < 15) return false;
	// Questions — not declarative facts
	if (cleaned.endsWith('?')) return false;
	// Greetings / social niceties
	if (
		/^(hello|hi|hey|thanks|thank you|ok|okay|great|sure|got it|no problem)/i.test(
			cleaned,
		)
	)
		return false;
	// Pure questions starting with question words (not declarative)
	if (
		/^(what|how|why|when|where|who|which|can you|do you|does|is there|are there|would you|could you|will you)/i.test(
			cleaned,
		)
	)
		return false;
	// Requests / imperatives (not declarative facts)
	if (
		/^(please|tell me|describe|explain|list|name|elaborate|clarify)/i.test(
			cleaned,
		)
	)
		return false;
	// Filler / meta / transition phrases (not substantive facts)
	if (
		/^(let me think|i want to understand|take your time|good question|sure,? let me|yes,? i understand|of course|i am particularly|please go ahead|welcome)/i.test(
			cleaned,
		)
	)
		return false;
	return true;
}

/**
 * Classify a sentence into one of the summary categories.
 *
 * Heuristic priority (first match wins):
 * 1. Decision keywords → `'decision'`
 * 2. Assumption keywords → `'assumption'`
 * 3. Substantive → `'fact'`
 * 4. Otherwise → `null` (skip)
 */
/**
 * Classify a sentence into one of the summary categories.
 *
 * Heuristic priority (first match wins):
 * 1. Decision keywords → `'decision'`  (user messages only)
 * 2. Assumption keywords → `'assumption'` (user messages only)
 * 3. Substantive → `'fact'`
 * 4. Otherwise → `null` (skip)
 *
 * Decisions and assumptions are only meaningful from user messages;
 * assistant messages may contain these words in a meta context
 * (e.g., "document this decision").
 */
function classifySentence(
	sentence: string,
	role: NodeMessageRole,
): 'decision' | 'assumption' | 'fact' | null {
	// Skip questions — keyword matching on questions produces false positives.
	const cleaned = sentence.replace(/^[.,!?;:\s]+/, '').trim();
	if (cleaned.endsWith('?')) return null;

	// Only classify decisions and assumptions from user messages.
	if (role === 'user') {
		if (DECISION_RE.test(sentence)) return 'decision';
		if (ASSUMPTION_RE.test(sentence)) return 'assumption';
	}

	if (isSubstantive(sentence)) return 'fact';

	return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Category extraction
// ═══════════════════════════════════════════════════════════════════════════

/** A classified candidate sentence with its source message ID. */
interface Candidate {
	readonly sentence: string;
	readonly messageId: string;
	readonly category: 'decision' | 'assumption' | 'fact';
}

/** Format a single candidate as a bullet line with source ID. */
function fmt(c: Candidate): string {
	return `- ${c.sentence} [${c.messageId}]`;
}

/** Categories in display order. */
type Category = 'decision' | 'assumption' | 'fact';

const CATEGORY_ORDER: Category[] = ['fact', 'decision', 'assumption'];

const CATEGORY_LABEL: Record<Category, string> = {
	assumption: 'Assumptions:',
	decision: 'Decisions:',
	fact: 'Facts:',
};

/**
 * Extract classified candidates from user and assistant messages.
 * System messages are intentionally excluded — they are internal and
 * should not appear in user-facing summaries.
 */
function extractCandidates(messages: NodeMessage[]): Candidate[] {
	const candidates: Candidate[] = [];

	for (const msg of messages) {
		// Skip system messages — they are internal and not user-visible.
		if (msg.role === 'system') continue;

		const sentences = splitSentences(msg.content);

		for (const sentence of sentences) {
			const category = classifySentence(sentence, msg.role);
			if (category === null) continue;

			candidates.push({
				category,
				messageId: msg.id,
				sentence,
			});
		}
	}

	return candidates;
}

// ═══════════════════════════════════════════════════════════════════════════
// Balanced bullet selection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Select bullets from all categories in a balanced pass:
 * - First pass: take up to 1 from each non-empty category.
 * - Second pass: take up to 1 more from each non-empty category.
 * - Continue until `MAX_TOTAL_BULLETS` or categories are exhausted.
 *
 * This ensures at least one bullet from each category appears,
 * avoiding budget starvation for later categories.
 */
function selectBalancedBullets(
	byCategory: Record<Category, Candidate[]>,
): { category: Category; candidate: Candidate }[] {
	const selected: { category: Category; candidate: Candidate }[] = [];
	const indices: Record<Category, number> = {
		assumption: 0,
		decision: 0,
		fact: 0,
	};

	// Keep taking passes until we hit the max or run out of candidates.
	let addedInPass: boolean;
	do {
		addedInPass = false;
		for (const cat of CATEGORY_ORDER) {
			if (selected.length >= MAX_TOTAL_BULLETS) break;
			const pool = byCategory[cat];
			const idx = indices[cat];
			if (idx < pool.length && pool[idx] !== undefined) {
				selected.push({ candidate: pool[idx], category: cat });
				indices[cat] = idx + 1;
				addedInPass = true;
			}
		}
	} while (addedInPass && selected.length < MAX_TOTAL_BULLETS);

	return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble the summary from balanced bullets, grouping by category.
 *
 * Returns `null` if the assembled summary is not shorter than the
 * original conversation (should not happen for meaningful input).
 */
function assembleSummary(
	selected: { category: Category; candidate: Candidate }[],
	originalLength: number,
): string | null {
	// Group selections by category, preserving the balanced order.
	const groups = new Map<Category, Candidate[]>();
	for (const { category, candidate } of selected) {
		const list = groups.get(category) ?? [];
		list.push(candidate);
		groups.set(category, list);
	}

	// Build lines.
	const lines: string[] = [];
	for (const cat of CATEGORY_ORDER) {
		const bullets = groups.get(cat);
		if (!bullets || bullets.length === 0) continue;

		lines.push(CATEGORY_LABEL[cat]);
		for (const c of bullets) {
			lines.push(fmt(c));
		}
		lines.push('');
	}

	const result = lines.join('\n').trimEnd();
	if (result.length === 0) return null;

	// Budget enforcement: cap at 45% of original or hard cap.
	const fractionCap = Math.floor(originalLength * SUMMARY_MAX_FRACTION);
	const effectiveCap = Math.min(SUMMARY_HARD_CAP, fractionCap);

	let finalResult = result;
	if (finalResult.length > effectiveCap) {
		finalResult = pruneToBudget(lines, effectiveCap) ?? '';
	}

	// The summary must be shorter than the original conversation.
	if (finalResult.length === 0 || finalResult.length >= originalLength) {
		return null;
	}

	return finalResult;
}

/**
 * Prune lines to fit within `cap` characters.
 *
 * Removes trailing bullets one at a time. Never removes section headers
 * (so at least one bullet per section is guaranteed). Returns `null`
 * if even the minimal summary (one bullet per category) exceeds the cap.
 */
function pruneToBudget(lines: string[], cap: number): string | null {
	// Work on a copy.
	const pruned = [...lines];

	// Remove trailing blank lines first (no structural effect).
	while (
		pruned.length > 0 &&
		(pruned[pruned.length - 1] === '' ||
			pruned[pruned.length - 1] === undefined)
	) {
		pruned.pop();
	}

	// If it already fits, return it.
	let result = pruned.join('\n').trimEnd();
	if (result.length <= cap) return result;

	// Remove complete sections from the end until it fits.
	// A section is: a header line + its bullet lines + trailing blank.
	// Never leave a section header dangling without bullets.
	while (pruned.length > 0 && result.length > cap) {
		// Find the start of the last section by scanning backwards
		// for a blank line or the array start.
		let sectionStart = pruned.length - 1;

		// Walk backwards to find the section header (first line
		// before bullets that doesn't start with "- ").
		while (sectionStart > 0) {
			const prev = pruned[sectionStart - 1];
			if (prev === '' || prev === undefined) break;
			if (
				!pruned[sectionStart]?.startsWith('- ') &&
				sectionStart < pruned.length - 1
			) {
				// We've walked past the bullets to the header — stop here
				// so sectionStart points to the header.
				break;
			}
			sectionStart--;
		}

		// Remove from sectionStart (the header) to the end.
		pruned.length = sectionStart;

		// Remove trailing blank after truncation.
		while (
			pruned.length > 0 &&
			(pruned[pruned.length - 1] === '' ||
				pruned[pruned.length - 1] === undefined)
		) {
			pruned.pop();
		}

		result = pruned.join('\n').trimEnd();
	}

	return result.length <= cap && result.length > 0 ? result : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a concise, deterministic conversation summary from a sequence
 * of node-scoped messages.
 *
 * The summary extracts **facts**, **decisions**, and **assumptions**
 * using keyword heuristics. Each extracted claim references the source
 * message ID. System messages are ignored.
 *
 * Bullet selection is **balanced**: at least one bullet from each
 * non-empty category is included before adding extras, up to a total
 * of 6 bullets.
 *
 * Budget rules:
 * - The summary is capped at `min(1000 chars, 45% of original conversation length)`.
 * - The summary is always shorter than the original conversation.
 * - If no meaningful content is found, an empty string is returned.
 *
 * The summary is **supplementary**: raw messages remain intact and
 * accessible via `getConversation`. The prompt orchestrator may inject
 * this summary when the full conversation exceeds the context budget.
 *
 * @param messages  The node's message history (typically from `getConversation`).
 * @returns A plain-text summary with section headings, or `""` if empty.
 */
export function summarizeConversation(messages: NodeMessage[]): string {
	// Guard: empty or meaningless input.
	if (messages.length === 0) return '';

	// Compute original conversation length for the budget ratio.
	const originalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
	if (originalLength === 0) return '';

	const candidates = extractCandidates(messages);
	if (candidates.length === 0) return '';

	// Partition candidates by category.
	const byCategory: Record<Category, Candidate[]> = {
		assumption: candidates.filter((c) => c.category === 'assumption'),
		decision: candidates.filter((c) => c.category === 'decision'),
		fact: candidates.filter((c) => c.category === 'fact'),
	};

	// Select bullets in a balanced pass.
	const selected = selectBalancedBullets(byCategory);
	if (selected.length === 0) return '';

	// Assemble and enforce budget.
	const result = assembleSummary(selected, originalLength);
	return result ?? '';
}
