/**
 * Completeness evaluation — determines whether a node's conversation has
 * produced sufficient quality to synthesise a canonical answer.
 *
 * `evaluateCompleteness` inspects the user messages in a node's
 * conversation and compares them against the node definition's
 * `coverageTopics`.
 *
 * For each coverage topic the function evaluates whether it is `"missing"`
 * (not addressed), `"weak"` (addressed vaguely or generically), or
 * `"sufficient"` (addressed with specificity).
 *
 * Contradictory statements between user messages are flagged as
 * `blockingIssues` — these prevent synthesis regardless of coverage.
 *
 * This initial implementation uses simple heuristics (keyword matching,
 * length thresholds, generic-phrase detection, and basic contradiction
 * scanning). The LLM-assisted evaluation path (via
 * `AgentTurnOutput.completenessEvaluation`) will enhance accuracy in
 * later phases.
 *
 * All functions are pure: no side effects, no state mutation.
 *
 * @see {@link https://logos-engine/docs/11-conversation-quality-and-completeness.md}
 * @see {@link https://logos-engine/docs/04-node-lifecycle-and-question-state.md §9}
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md §7}
 */
import type {
	CompletenessState,
	NodeDefinition,
	NodeMessage,
	NodeRuntimeState,
} from '../contracts/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Heuristic constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimum character length for a message addressing a topic to be
 * considered potentially sufficient. Messages shorter than this are
 * treated as weak regardless of content.
 */
const MIN_SUFFICIENT_LENGTH = 50;

/**
 * Generic / vague phrases that signal weak specificity.
 *
 * When any of these phrases appear in a message addressing a topic,
 * the topic is classified as `"weak"` even if the message is long.
 */
const VAGUE_PHRASES: readonly string[] = [
	'best in class',
	'cutting edge',
	'game changer',
	'great product',
	'innovative solution',
	'industry leading',
	'it depends',
	'market leading',
	'next generation',
	'state of the art',
	'to be determined',
	'to be discussed',
	'will be defined later',
	'will be great',
	'world class',
];

/**
 * Concrete language markers — their presence in a message addressing a
 * topic increases the confidence that the topic is addressed with
 * specificity. These include numeric tokens, quantification words, and
 * concrete action verbs.
 */
const CONCRETE_INDICATORS: readonly RegExp[] = [
	/\b\d+%?\b/, // numbers (100, 50%, etc.)
	/\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // proper nouns (Name Surname)
	/\bfor example\b/i,
	/\bspecifically\b/i,
	/\bin particular\b/i,
	/\bmeasured by\b/i,
	/\bvalidated through\b/i,
	/\bbecause\b/i,
	/\btherefore\b/i,
	/\bleads to\b/i,
	/\bresults in\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract keywords from a topic string for matching against message
 * content.
 *
 * Splits on whitespace and punctuation, lowercases, and filters out
 * very short stop words that produce too many false positives.
 */
function topicKeywords(topic: string): string[] {
	return topic
		.toLowerCase()
		.split(/[\s,;:.!?()]+/)
		.filter((w) => w.length > 2)
		.filter(
			(w) =>
				![
					'the',
					'and',
					'for',
					'are',
					'has',
					'its',
					'not',
					'but',
					'that',
					'this',
					'with',
					'from',
				].includes(w),
		);
}

/**
 * Return `true` when every topic keyword appears somewhere in the
 * combined user message content.
 *
 * The keyword must match as a whole word (case-insensitive) to avoid
 * accidental substring matches (e.g., "target" matching "targeting").
 */
function topicMatched(topic: string, userContent: string): boolean {
	const keywords = topicKeywords(topic);
	if (keywords.length === 0) return false;
	const lower = userContent.toLowerCase();
	return keywords.every((kw) => {
		const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
		return re.test(lower);
	});
}

/**
 * Escape special regex characters so keyword strings are matched
 * literally.
 */
function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Return `true` when the message content addressing a topic is
 * generic / vague.
 *
 * Heuristics:
 * - Very short content (below `MIN_SUFFICIENT_LENGTH`).
 * - Contains at least one vague marketing / placeholder phrase.
 * - Lacks any concrete indicator (numbers, proper nouns, reasoning
 *   connectives).
 */
function isWeakContent(content: string): boolean {
	const trimmed = content.trim();

	// Short responses are almost always weak.
	if (trimmed.length < MIN_SUFFICIENT_LENGTH) return true;

	// Generic marketing / placeholder phrases → weak.
	const lower = trimmed.toLowerCase();
	if (VAGUE_PHRASES.some((p) => lower.includes(p))) return true;

	// No concrete indicators → weak.
	if (!CONCRETE_INDICATORS.some((re) => re.test(trimmed))) return true;

	return false;
}

/**
 * Return the subset of user messages whose content matches (contains all
 * keywords of) the given topic.
 */
function messagesAddressingTopic(
	topic: string,
	conversation: readonly NodeMessage[],
): NodeMessage[] {
	return conversation.filter(
		(m) => m.role === 'user' && topicMatched(topic, m.content),
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// Topic coverage evaluation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate a single topic's coverage status.
 *
 * Returns `"missing"` if no user message addresses the topic.
 * Returns `"weak"` if the topic is addressed but the content is vague.
 * Returns `"sufficient"` if addressed with concrete detail.
 */
function evaluateTopicCoverage(
	topic: string,
	conversation: readonly NodeMessage[],
): 'missing' | 'weak' | 'sufficient' {
	const addressed = messagesAddressingTopic(topic, conversation);
	if (addressed.length === 0) return 'missing';

	// The topic is addressed — check quality across all matching messages.
	// If *any* matching message has sufficient content, the topic is
	// sufficient. Otherwise it is weak.
	const hasSufficient = addressed.some((m) => !isWeakContent(m.content));
	return hasSufficient ? 'sufficient' : 'weak';
}

// ═══════════════════════════════════════════════════════════════════════════
// Ambiguity detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Broad comparative / aspirational terms that signal ambiguity when used
 * without a concrete dimension.
 *
 * When a user message contains one of these terms without specifying
 * *how* or *in what way* (i.e. lacking supporting detail), it is
 * ambiguous — the system cannot safely synthesise from it.
 */
const AMBIGUOUS_COMPARATIVES: readonly RegExp[] = [
	/\bbetter\b/i,
	/\bfaster\b/i,
	/\bstronger\b/i,
	/\bimprove(d|ment)?\b/i,
	/\bmore efficient\b/i,
	/\bmore effective\b/i,
	/\bgame.?changing\b/i,
];

/**
 * Detect ambiguous statements in user messages.
 *
 * Scans all user messages for broad comparative / aspirational terms
 * that lack concrete dimension or specificity. When detected, the
 * ambiguity blocks synthesis because the engine cannot determine what
 * the user actually means.
 *
 * This heuristic is intentionally conservative — it only flags terms
 * that are categorically ambiguous without qualification. More nuanced
 * ambiguity detection is handled by the LLM completeness evaluation.
 *
 * @returns Human-readable blocking issues describing the ambiguity.
 */
function detectAmbiguity(conversation: readonly NodeMessage[]): string[] {
	const userMessages = conversation.filter((m) => m.role === 'user');
	const issues: string[] = [];

	// Only check the most recent user message — previous messages have
	// already been evaluated in earlier turns.
	if (userMessages.length === 0) return issues;
	const lastUserMsg = userMessages[userMessages.length - 1];
	if (!lastUserMsg) return issues;

	for (const re of AMBIGUOUS_COMPARATIVES) {
		if (re.test(lastUserMsg.content)) {
			// This term is present — check if the message is too short/vague
			// to clarify *what* makes it better/faster/etc.
			if (isWeakContent(lastUserMsg.content)) {
				// The message uses a comparative term but doesn't provide
				// enough concrete detail to resolve the ambiguity.
				issues.push(
					`Ambiguity detected: the most recent answer uses broad comparative language ` +
						`("${re.source.replace(/\\b/g, '')}") without specifying what dimension or ` +
						'how the comparison is measured. This makes the answer too vague for synthesis.',
				);
				break; // One ambiguity issue is enough per turn.
			}
		}
	}

	return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// Contradiction detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pairs of antonyms / mutually-exclusive modifiers used for simple
 * contradiction detection across user messages.
 *
 * When one user message uses the positive term and another uses the
 * negative term about the same topic area, a `blockingIssue` is raised.
 */
const CONTRADICTORY_PAIRS: ReadonlyArray<readonly [string, string]> = [
	['always', 'never'],
	['must', 'must not'],
	['required', 'optional'],
	['should', 'should not'],
	['will', 'will not'],
	['is', 'is not'],
	['does', 'does not'],
	['all', 'none'],
	['every', 'no'],
	['only', 'also'],
];

/**
 * Scan all user messages for contradictory statements and return any
 * contradictions found as `blockingIssues`.
 *
 * A contradiction is flagged when two different user messages of the
 * same topic area use opposing modifiers (e.g., "X is required" in one
 * message and "X is optional" in another).
 *
 * The returned strings are human-readable descriptions suitable for
 * display in the TUI and for inclusion in `blockingIssues`.
 */
function detectContradictions(conversation: readonly NodeMessage[]): string[] {
	const userMessages = conversation.filter((m) => m.role === 'user');
	const issues: string[] = [];

	if (userMessages.length < 2) return issues;

	for (const [pos, neg] of CONTRADICTORY_PAIRS) {
		// Escape for regex word-boundary matching.
		const posRe = new RegExp(`\\b${escapeRegex(pos)}\\b`, 'i');
		const negRe = new RegExp(`\\b${escapeRegex(neg)}\\b`, 'i');

		// Find messages containing the positive term and the negative term.
		const posMessages = userMessages.filter((m) => posRe.test(m.content));
		const negMessages = userMessages.filter((m) => negRe.test(m.content));

		if (posMessages.length > 0 && negMessages.length > 0) {
			// Only flag as a contradiction if the terms appear in *different*
			// messages (self-contradiction within a single message is a
			// different problem that LLM evaluation handles later).
			const posIds = new Set(posMessages.map((m) => m.id));
			const negIds = new Set(negMessages.map((m) => m.id));
			const hasCrossMessage =
				posMessages.some((m) => !negIds.has(m.id)) &&
				negMessages.some((m) => !posIds.has(m.id));

			if (hasCrossMessage) {
				issues.push(
					`Contradiction detected: some messages use "${pos}" while others use "${neg}". ` +
						'These statements appear to conflict and should be reconciled before synthesis.',
				);
			}
		}
	}

	return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate the completeness of a node's conversation against its
 * definition's `coverageTopics` and `sufficiencyCriteria`.
 *
 * For each topic in `nodeDef.coverageTopics` the function checks
 * whether the topic is addressed in the node's user messages and, if
 * so, whether the content is specific enough to support synthesis.
 *
 * Contradictions between user messages are flagged as `blockingIssues`
 * — even when all topics are individually sufficient, a contradiction
 * blocks synthesis.
 *
 * `complete` is `true` only when:
 * - all `coverageTopics` are `"sufficient"`, AND
 * - there are no `blockingIssues`.
 *
 * If `nodeDef.coverageTopics` is empty, the node is considered
 * **not complete** — there is no quality target to measure against,
 * so the engine cannot guarantee the conversation has produced a
 * useful canonical answer.
 *
 * This function is deterministic and pure — repeated calls with the
 * same inputs produce identical results.
 *
 * @param nodeState - The node's current runtime state, including its
 *   conversation history.
 * @param nodeDef   - The node's static definition, including its
 *   `coverageTopics` and `sufficiencyCriteria`.
 * @returns A `CompletenessState` with coverage evaluation and
 *   blocking issues.
 */
export function evaluateCompleteness(
	nodeState: NodeRuntimeState,
	nodeDef: NodeDefinition,
): CompletenessState {
	const conversation = nodeState.conversation;
	const topics = nodeDef.coverageTopics;

	// ── Evaluate each coverage topic ───────────────────────────────
	const coverage: Record<string, 'missing' | 'weak' | 'sufficient'> = {};
	const missing: string[] = [];
	const weak: string[] = [];

	for (const topic of topics) {
		const status = evaluateTopicCoverage(topic, conversation);
		coverage[topic] = status;
		if (status === 'missing') missing.push(topic);
		if (status === 'weak') weak.push(topic);
	}

	// ── Detect contradictions ──────────────────────────────────────
	let blockingIssues = detectContradictions(conversation);

	// ── Detect ambiguity (broad comparatives without dimension) ───
	const ambiguityIssues = detectAmbiguity(conversation);
	blockingIssues = [...blockingIssues, ...ambiguityIssues];

	// ── Determine overall completeness ─────────────────────────────
	const allSufficient =
		topics.length > 0 && missing.length === 0 && weak.length === 0;
	const noBlockers = blockingIssues.length === 0;
	const complete = allSufficient && noBlockers;

	return {
		blockingIssues,
		complete,
		coverage,
		missing,
		weak,
	};
}
