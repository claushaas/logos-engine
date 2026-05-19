/** Step 12.4 — Candidate Fact/Decision Extractor: deterministic extraction from import candidates */

// ---------------------------------------------------------------------------
// Helper: update an extracted item's status/confidence while preserving
// discriminated union type.  Uses a type assertion because TS narrows
// `item.kind` inside each branch but loses it when spreading across
// the union.
// ---------------------------------------------------------------------------

function updateItem<T extends CandidateExtractedItem>(
	item: T,
	patch: Partial<
		Pick<CandidateExtractedItemBase, 'status' | 'confidence' | 'requiresReview'>
	> & { duplicateOfIds?: string[] },
): T {
	return { ...item, ...patch } as T;
}

function updateItemWithDiagnostics<T extends CandidateExtractedItem>(
	item: T,
	patch: Partial<
		Pick<CandidateExtractedItemBase, 'status' | 'confidence' | 'requiresReview'>
	>,
	extraDiagnostics: CandidateExtractionDiagnostic[],
): T {
	return {
		...item,
		...patch,
		diagnostics: [...item.diagnostics, ...extraDiagnostics],
	} as T;
}

import type { DocsCodeConsistencyFinding } from '../consistency/docs-code-consistency-model.js';
import type { RepositoryScanFinding } from '../scanner/repository-scan-model.js';
import {
	CANDIDATE_EXTRACTED_ITEM_KIND_ORDER,
	CANDIDATE_EXTRACTION_ACTION_KIND_ORDER,
	CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER,
	CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER,
	type CandidateExtractedAcceptanceCriterion,
	type CandidateExtractedAssumption,
	type CandidateExtractedConstraint,
	type CandidateExtractedDecision,
	type CandidateExtractedEvidenceReference,
	type CandidateExtractedFact,
	type CandidateExtractedHypothesis,
	type CandidateExtractedItem,
	type CandidateExtractedItemBase,
	type CandidateExtractedItemConfidence,
	type CandidateExtractedItemKind,
	type CandidateExtractedItemStatus,
	type CandidateExtractedNonGoal,
	type CandidateExtractedOpenQuestion,
	type CandidateExtractedRequirement,
	type CandidateExtractedRisk,
	type CandidateExtractionActionKind,
	type CandidateExtractionBlocker,
	type CandidateExtractionConflict,
	type CandidateExtractionDiagnostic,
	type CandidateExtractionEvidence,
	type CandidateExtractionInput,
	type CandidateExtractionOptions,
	type CandidateExtractionReadiness,
	type CandidateExtractionResult,
	type CandidateExtractionReviewAction,
	type CandidateExtractionSource,
	type CandidateExtractionSourceKind,
	type CandidateExtractionSummary,
	type CandidateExtractionWarning,
	contentLooksLikeDerivedArtifactExtraction,
	contentLooksLikeTranscriptExtraction,
	nextExtractionId,
	pathLooksLikeDerivedArtifactExtraction,
	RECOGNIZED_FRONTMATTER_KEYS,
	RECOGNIZED_HEADINGS,
	resetExtractionIdCounter,
} from './candidate-extraction-model.js';
import type { DocumentationImportCandidate } from './import-model.js';

// ---------------------------------------------------------------------------
// Secret detection patterns for evidence redaction
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
	/\bsk-[a-zA-Z0-9]{20,}\b/g,
	/\bsk-proj-[a-zA-Z0-9\-_]{20,}\b/g,
	/\bgsk_[a-zA-Z0-9]{20,}\b/g,
	/\bhf_[a-zA-Z0-9]{20,}\b/g,
	/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
	/\bBasic\s+[A-Za-z0-9+/=]+\b/gi,
	/\bapi[_-]?key\s*[:=]\s*["']?[A-Za-z0-9\-_]{20,}["']?/gi,
	/\bsecret\s*[:=]\s*["']?[A-Za-z0-9\-_+/=]{20,}["']?/gi,
	/\btoken\s*[:=]\s*["']?[A-Za-z0-9\-_+/=]{20,}["']?/gi,
	/\bpassword\s*[:=]\s*["']?\S{8,}["']?/gi,
	/\bauthorization\s*[:=]\s*["']?[A-Za-z0-9\-_./+=\s]+["']?/gi,
	/\bprivate[_-]?key\s*[:=]\s*["']?[A-Za-z0-9\-_+/=\n\r]{20,}["']?/gi,
	/\baccess[_-]?token\s*[:=]\s*["']?[A-Za-z0-9\-_./+]{20,}["']?/gi,
	/\bclient[_-]?secret\s*[:=]\s*["']?[A-Za-z0-9\-_+/=]{20,}["']?/gi,
	/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
	/\bxox[bp]-[A-Za-z0-9-]{20,}\b/g,
	/\bdapi-[A-Za-z0-9]{32,}\b/g,
	/\bsl\.[A-Za-z0-9\-_]{20,}\b/g,
	/\bAKIA[A-Z0-9]{16}\b/g,
	/\beyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
];

const PRIVATE_KEY_PATTERNS = [
	/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
	/-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/,
	/-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/,
	/-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/,
];

const RAW_PROMPT_MARKERS = [
	/\braw[_-]?prompt\b/i,
	/\bmodel[_-]?response\b/i,
	/\bsystem[_-]?prompt\b/i,
	/\bchain[_-]?of[_-]?thought\b/i,
	/<suggestion\b/i,
];

const REDACTED_PLACEHOLDER = '[REDACTED]';

function hasSecretContent(text: string): boolean {
	for (const p of SECRET_PATTERNS) {
		p.lastIndex = 0;
		if (p.test(text)) return true;
	}
	for (const p of PRIVATE_KEY_PATTERNS) {
		p.lastIndex = 0;
		if (p.test(text)) return true;
	}
	return false;
}

function redactSecretContent(text: string): string {
	let result = text;
	for (const p of SECRET_PATTERNS) {
		p.lastIndex = 0;
		result = result.replace(p, REDACTED_PLACEHOLDER);
	}
	for (const p of PRIVATE_KEY_PATTERNS) {
		p.lastIndex = 0;
		result = result.replace(p, REDACTED_PLACEHOLDER);
	}
	return result;
}

function hasRawPromptMarkers(text: string): boolean {
	return RAW_PROMPT_MARKERS.some((p) => p.test(text));
}

function looksLikeTranscript(text: string): boolean {
	return contentLooksLikeTranscriptExtraction(text);
}

function looksLikeDerivedArtifact(text: string): boolean {
	return contentLooksLikeDerivedArtifactExtraction(text);
}

// ---------------------------------------------------------------------------
// Bounded snippet helpers
// ---------------------------------------------------------------------------

const MAX_SNIPPET_LENGTH = 500;

function boundedSnippet(text: string): string {
	if (text.length <= MAX_SNIPPET_LENGTH) return text;
	return `${text.slice(0, MAX_SNIPPET_LENGTH)}... [truncated]`;
}

function safeSnippet(text: string): string {
	return boundedSnippet(redactSecretContent(text));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowISO(): string {
	return new Date().toISOString();
}

function normalizeForComparison(s: string): string {
	return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (simple YAML-like key: value extraction from bounded snippet)
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
	keys: Map<string, string | string[]>;
	raw: Map<string, string>;
}

function parseFrontmatterFromSnippet(snippet: string): ParsedFrontmatter {
	const keys = new Map<string, string | string[]>();
	const raw = new Map<string, string>();

	// Try to find frontmatter block
	const fmMatch = snippet.match(/^---\s*\n([\s\S]*?)\n---/);
	let lines: string[] = [];
	if (fmMatch?.[1]) {
		lines = fmMatch[1].split('\n');
	} else {
		// No frontmatter block, try key:value lines at start
		lines = snippet
			.split('\n')
			.slice(0, 30)
			.filter((l) => /^\s*[a-zA-Z]/.test(l));
	}

	for (const line of lines) {
		const kvMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
		if (!kvMatch) {
			// Check for list item indicator
			const listMatch = line.match(/^\s*-\s+(.+)$/);
			if (listMatch?.[1]) {
				// Accumulate list items under last key
				const lastKey = Array.from(keys.keys()).pop();
				if (lastKey) {
					const existing = keys.get(lastKey);
					const itemText = listMatch[1].trim();
					if (Array.isArray(existing)) {
						existing.push(itemText);
					} else if (typeof existing === 'string') {
						keys.set(lastKey, [existing, itemText]);
					}
				}
			}
			continue;
		}
		const key = kvMatch[1];
		const value = kvMatch[2];
		if (!key) continue;
		const trimmedKey = key.trim();
		const trimmedValue = (value ?? '').trim().replace(/^["']|["']$/g, '');

		// Handle YAML-style list keys (empty value followed by dash items)
		if (trimmedValue === '' || trimmedValue === '|' || trimmedValue === '>') {
			// Register empty array so subsequent dash-list items accumulate
			raw.set(trimmedKey, trimmedValue || '[list]');
			if (!keys.has(trimmedKey)) {
				keys.set(trimmedKey, []);
			}
			continue;
		}

		raw.set(trimmedKey, trimmedValue);

		// Try to parse as array if comma-separated
		if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
			const inner = trimmedValue.slice(1, -1);
			const items = inner
				.split(',')
				.map((s) => s.trim().replace(/^["']|["']$/g, ''))
				.filter(Boolean);
			keys.set(trimmedKey, items);
		} else {
			keys.set(trimmedKey, trimmedValue);
		}
	}

	return { keys, raw };
}

// ---------------------------------------------------------------------------
// Heading extraction from snippet
// ---------------------------------------------------------------------------

interface ParsedHeadingSection {
	heading: string;
	level: number;
	content: string;
	items: string[];
}

function parseHeadingsFromSnippet(snippet: string): ParsedHeadingSection[] {
	const sections: ParsedHeadingSection[] = [];
	const lines = snippet.split('\n');

	let currentSection: ParsedHeadingSection | null = null;

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch?.[1] && headingMatch[2]) {
			if (currentSection) {
				sections.push(currentSection);
			}
			currentSection = {
				content: '',
				heading: headingMatch[2].trim(),
				items: [],
				level: headingMatch[1].length,
			};
			continue;
		}

		if (currentSection) {
			// Collect list items
			const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
			if (listMatch?.[1]) {
				currentSection.items.push(listMatch[1].trim());
			}
			currentSection.content += `${line}\n`;
		}
	}

	if (currentSection) {
		sections.push(currentSection);
	}

	return sections;
}

// ---------------------------------------------------------------------------
// Check if candidate is a derived artifact
// ---------------------------------------------------------------------------

function isDerivedArtifactCandidate(
	candidate: DocumentationImportCandidate,
): boolean {
	return (
		pathLooksLikeDerivedArtifactExtraction(candidate.relativePath) ||
		(candidate.contentSnippet
			? looksLikeDerivedArtifact(candidate.contentSnippet)
			: false)
	);
}

function isTranscriptCandidate(
	candidate: DocumentationImportCandidate,
): boolean {
	return (
		candidate.kind === 'transcript' ||
		(candidate.contentSnippet
			? looksLikeTranscript(candidate.contentSnippet)
			: false)
	);
}

// ---------------------------------------------------------------------------
// Source reference building
// ---------------------------------------------------------------------------

function buildSource(
	candidate: DocumentationImportCandidate,
	kind: CandidateExtractionSourceKind,
	pointer?: string,
	evidence?: string,
	confidence?: number,
): CandidateExtractionSource {
	return {
		candidateId: candidate.id,
		candidatePath: candidate.relativePath,
		confidence: confidence ?? 0.5,
		evidence: evidence ? safeSnippet(evidence) : undefined,
		kind,
		pointer,
	};
}

function buildEvidence(
	snippet: string,
	sourceKind: CandidateExtractionSourceKind,
	sourcePointer?: string,
	candidate?: DocumentationImportCandidate,
	confidence?: number,
): CandidateExtractionEvidence {
	return {
		candidateId: candidate?.id,
		confidence: confidence ?? 0.5,
		snippet: safeSnippet(snippet),
		sourceKind,
		sourcePath: candidate?.relativePath,
		sourcePointer,
	};
}

// ---------------------------------------------------------------------------
// Item building helpers
// ---------------------------------------------------------------------------

let _itemIdCounter = 0;

function _resetItemIdCounter(): void {
	_itemIdCounter = 0;
}

function nextItemId(kind: CandidateExtractedItemKind): string {
	_itemIdCounter += 1;
	return `extracted-${kind}-${_itemIdCounter}`;
}

function makeBase(
	kind: CandidateExtractedItemKind,
	sourceCandidateIds: string[],
	sources: CandidateExtractionSource[],
	status: CandidateExtractedItemStatus,
	confidence: CandidateExtractedItemConfidence,
): CandidateExtractedItemBase {
	return {
		confidence,
		diagnostics: [],
		duplicateOfIds: [],
		id: nextItemId(kind),
		kind,
		requiresReview: status !== 'candidate',
		sourceCandidateIds,
		sources,
		status,
	};
}

// ---------------------------------------------------------------------------
// Extraction from frontmatter
// ---------------------------------------------------------------------------

function extractFromFrontmatter(
	candidate: DocumentationImportCandidate,
	fm: ParsedFrontmatter,
	_diagnostics: CandidateExtractionDiagnostic[],
): CandidateExtractedItem[] {
	const items: CandidateExtractedItem[] = [];

	for (const [key, rawValue] of fm.raw) {
		// Check for recognized frontmatter keys
		const itemKind = RECOGNIZED_FRONTMATTER_KEYS[key];
		if (!itemKind) {
			// Check if it's a generic id/title that might contain decision-like info
			if (key === 'id') {
				// id alone doesn't create an extracted item
				continue;
			}
			if (key === 'title') {
				// title alone doesn't create an extracted item
				continue;
			}
			if (key === 'status') {
				// status alone doesn't create an extracted item
				continue;
			}
			if (key === 'question' || key.toLowerCase().includes('question')) {
				// Frontmatter question-like key — treat as open question
				const value = fm.keys.get(key);
				const values = Array.isArray(value) ? value : [String(value)];
				for (const v of values) {
					const trimmed = String(v).trim();
					if (!trimmed) continue;
					items.push({
						...makeBase(
							'open_question',
							[candidate.id],
							[
								buildSource(
									candidate,
									'markdown_frontmatter',
									key,
									rawValue,
									0.6,
								),
							],
							'candidate',
							'medium',
						),
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						blocking: undefined,
						evidenceItems: [
							buildEvidence(
								rawValue,
								'markdown_frontmatter',
								key,
								candidate,
								0.6,
							),
						],
						kind: 'open_question' as const,
						question: trimmed,
					} as CandidateExtractedOpenQuestion);
				}
				continue;
			}
			continue;
		}

		const value = fm.keys.get(key);
		const values = Array.isArray(value) ? value : [String(value)];
		const isStructured = Array.isArray(value);
		// Frontmatter values are always structured (from YAML), single values get medium too
		const confidence: CandidateExtractedItemConfidence = 'medium';
		const sourceKind: CandidateExtractionSourceKind = 'markdown_frontmatter';

		for (const v of values) {
			const trimmed = String(v).trim();
			if (!trimmed) continue;

			const confNum = 0.6;

			const source = buildSource(
				candidate,
				sourceKind,
				key,
				isStructured ? rawValue : trimmed,
				confNum,
			);
			const evidence = buildEvidence(
				trimmed,
				sourceKind,
				key,
				candidate,
				confNum,
			);

			const baseItem = makeBase(
				itemKind,
				[candidate.id],
				[source],
				'candidate',
				confidence,
			);

			switch (itemKind) {
				case 'fact': {
					const fact: CandidateExtractedFact = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'fact',
						statement: trimmed,
					};
					items.push(fact);
					break;
				}
				case 'decision': {
					const decision: CandidateExtractedDecision = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						alternatives: undefined,
						consequences: undefined,
						evidenceItems: [evidence],
						kind: 'decision',
						rationale: undefined,
						statement: trimmed,
						title: trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed,
					};
					items.push(decision);
					break;
				}
				case 'assumption': {
					const assumption: CandidateExtractedAssumption = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						expectedSignal: undefined,
						kind: 'assumption',
						statement: trimmed,
					};
					items.push(assumption);
					break;
				}
				case 'hypothesis': {
					const hypothesis: CandidateExtractedHypothesis = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						expectedSignal: undefined,
						kind: 'hypothesis',
						statement: trimmed,
						validationEvidence: undefined,
					};
					items.push(hypothesis);
					break;
				}
				case 'risk': {
					const risk: CandidateExtractedRisk = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						description: trimmed,
						evidenceItems: [evidence],
						impact: undefined,
						kind: 'risk',
						likelihood: undefined,
						mitigation: undefined,
						title: trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed,
					};
					items.push(risk);
					break;
				}
				case 'open_question': {
					const question: CandidateExtractedOpenQuestion = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						blocking: undefined,
						evidenceItems: [evidence],
						kind: 'open_question',
						question: trimmed,
					};
					items.push(question);
					break;
				}
				case 'constraint': {
					const constraint: CandidateExtractedConstraint = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'constraint',
						statement: trimmed,
					};
					items.push(constraint);
					break;
				}
				case 'requirement': {
					const requirement: CandidateExtractedRequirement = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'requirement',
						statement: trimmed,
					};
					items.push(requirement);
					break;
				}
				case 'acceptance_criterion': {
					const criterion: CandidateExtractedAcceptanceCriterion = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'acceptance_criterion',
						satisfied: undefined,
						statement: trimmed,
					};
					items.push(criterion);
					break;
				}
				case 'non_goal': {
					const nonGoal: CandidateExtractedNonGoal = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'non_goal',
						statement: trimmed,
					};
					items.push(nonGoal);
					break;
				}
				case 'evidence_reference': {
					const ref = classifyEvidenceReference(trimmed);
					const evRef: CandidateExtractedEvidenceReference = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'evidence_reference',
						reference: trimmed,
						referenceType: ref.type,
						verified: ref.verified,
					};
					items.push(evRef);
					break;
				}
				default:
					break;
			}
		}
	}

	return items;
}

// ---------------------------------------------------------------------------
// Extraction from headings
// ---------------------------------------------------------------------------

function extractFromHeadings(
	candidate: DocumentationImportCandidate,
	sections: ParsedHeadingSection[],
	_diagnostics: CandidateExtractionDiagnostic[],
): CandidateExtractedItem[] {
	const items: CandidateExtractedItem[] = [];

	for (const section of sections) {
		const itemKind = RECOGNIZED_HEADINGS[section.heading];
		if (!itemKind) continue;

		const confidence: CandidateExtractedItemConfidence =
			section.items.length > 0 ? 'medium' : 'low';
		const sourceKind: CandidateExtractionSourceKind = 'markdown_heading';

		// Extract list items under the heading
		for (let idx = 0; idx < section.items.length; idx++) {
			// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
			const item = section.items[idx]!;
			const trimmed = item.trim();
			if (!trimmed) continue;

			const pointer = `${section.heading}[${idx}]`;
			const confNum = confidence === 'medium' ? 0.6 : 0.4;
			const source = buildSource(
				candidate,
				sourceKind,
				pointer,
				trimmed,
				confNum,
			);
			const evidence = buildEvidence(
				trimmed,
				sourceKind,
				pointer,
				candidate,
				confNum,
			);

			const baseItem = makeBase(
				itemKind,
				[candidate.id],
				[source],
				'candidate',
				confidence,
			);

			switch (itemKind) {
				case 'fact': {
					const fact: CandidateExtractedFact = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'fact',
						statement: trimmed,
					};
					items.push(fact);
					break;
				}
				case 'decision': {
					const decision: CandidateExtractedDecision = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						alternatives: undefined,
						consequences: undefined,
						evidenceItems: [evidence],
						kind: 'decision',
						rationale: undefined,
						statement: trimmed,
						title: trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed,
					};
					items.push(decision);
					break;
				}
				case 'assumption': {
					const assumption: CandidateExtractedAssumption = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						expectedSignal: undefined,
						kind: 'assumption',
						statement: trimmed,
					};
					items.push(assumption);
					break;
				}
				case 'hypothesis': {
					const hypothesis: CandidateExtractedHypothesis = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						expectedSignal: undefined,
						kind: 'hypothesis',
						statement: trimmed,
						validationEvidence: undefined,
					};
					items.push(hypothesis);
					break;
				}
				case 'risk': {
					const risk: CandidateExtractedRisk = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						description: trimmed,
						evidenceItems: [evidence],
						impact: undefined,
						kind: 'risk',
						likelihood: undefined,
						mitigation: undefined,
						title: trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed,
					};
					items.push(risk);
					break;
				}
				case 'open_question': {
					const question: CandidateExtractedOpenQuestion = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						blocking: undefined,
						evidenceItems: [evidence],
						kind: 'open_question',
						question: trimmed,
					};
					items.push(question);
					break;
				}
				case 'constraint': {
					const constraint: CandidateExtractedConstraint = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'constraint',
						statement: trimmed,
					};
					items.push(constraint);
					break;
				}
				case 'requirement': {
					const requirement: CandidateExtractedRequirement = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'requirement',
						statement: trimmed,
					};
					items.push(requirement);
					break;
				}
				case 'acceptance_criterion': {
					const criterion: CandidateExtractedAcceptanceCriterion = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'acceptance_criterion',
						satisfied: undefined,
						statement: trimmed,
					};
					items.push(criterion);
					break;
				}
				case 'non_goal': {
					const nonGoal: CandidateExtractedNonGoal = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'non_goal',
						statement: trimmed,
					};
					items.push(nonGoal);
					break;
				}
				case 'evidence_reference': {
					const ref = classifyEvidenceReference(trimmed);
					const evRef: CandidateExtractedEvidenceReference = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'evidence_reference',
						reference: trimmed,
						referenceType: ref.type,
						verified: ref.verified,
					};
					items.push(evRef);
					break;
				}
				default:
					break;
			}
		}

		// If no list items, try to extract from the content text itself
		if (section.items.length === 0 && section.content.trim()) {
			const content = section.content.trim();
			// For content-only sections, create a single item if it's not too long
			if (content.length < 500) {
				const source = buildSource(
					candidate,
					sourceKind,
					section.heading,
					content,
					0.4,
				);
				const evidence = buildEvidence(
					content,
					sourceKind,
					section.heading,
					candidate,
					0.4,
				);

				const baseItem = makeBase(
					itemKind,
					[candidate.id],
					[source],
					'requires_review',
					'low',
				);

				// Only create fact/decision items from content — others are too ambiguous
				if (itemKind === 'fact') {
					const fact: CandidateExtractedFact = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						evidenceItems: [evidence],
						kind: 'fact',
						statement: content,
					};
					items.push(fact);
				} else if (itemKind === 'decision') {
					const decision: CandidateExtractedDecision = {
						...baseItem,
						affectedDocumentIds: [],
						affectedPhaseIds: [],
						alternatives: undefined,
						consequences: undefined,
						evidenceItems: [evidence],
						kind: 'decision',
						rationale: undefined,
						statement: content,
						title: content.length > 80 ? `${content.slice(0, 80)}...` : content,
					};
					items.push(decision);
				}
			}
		}
	}

	return items;
}

// ---------------------------------------------------------------------------
// Evidence reference classification
// ---------------------------------------------------------------------------

function classifyEvidenceReference(ref: string): {
	type: CandidateExtractedEvidenceReference['referenceType'];
	verified: boolean;
} {
	const trimmed = ref.trim();

	// Local path
	if (
		trimmed.startsWith('./') ||
		trimmed.startsWith('../') ||
		trimmed.startsWith('/') ||
		trimmed.match(/^[a-zA-Z0-9_\-./]+\.[a-z]{2,4}$/i)
	) {
		const isUnsafe = trimmed.includes('../') || trimmed.startsWith('/etc/');
		return { type: 'local_path', verified: !isUnsafe };
	}

	// External URL
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return { type: 'external_url', verified: false };
	}

	// Finding ID patterns
	if (
		trimmed.match(/^(repo-scan-finding|docs-code-finding|validation-finding)-/)
	) {
		if (trimmed.startsWith('repo-scan-finding-')) {
			return { type: 'scanner_finding_id', verified: false };
		}
		if (trimmed.startsWith('validation-finding-')) {
			return { type: 'validation_finding_id', verified: false };
		}
		return { type: 'validation_finding_id', verified: false };
	}

	// Document ID patterns
	if (trimmed.match(/^\d{2}-[a-z-]+$/)) {
		return { type: 'document_id', verified: false };
	}

	// Claim ID patterns
	if (trimmed.startsWith('claim-')) {
		return { type: 'claim_id', verified: false };
	}

	return { type: 'unknown', verified: false };
}

// ---------------------------------------------------------------------------
// Scanner finding extraction
// ---------------------------------------------------------------------------

function extractFromScannerFindings(
	scannerFindings: RepositoryScanFinding[],
	_diagnostics: CandidateExtractionDiagnostic[],
): CandidateExtractedItem[] {
	const items: CandidateExtractedItem[] = [];

	for (const finding of scannerFindings) {
		const source: CandidateExtractionSource = {
			confidence: 0.7,
			evidence: safeSnippet(finding.evidence),
			kind: 'repository_scan_fact',
			pointer: finding.id,
		};

		const evidence = buildEvidence(
			finding.message,
			'repository_scan_fact',
			finding.id,
			undefined,
			0.7,
		);

		const base = makeBase('fact', [], [source], 'candidate', 'medium');

		const fact: CandidateExtractedFact = {
			...base,
			affectedDocumentIds: [],
			affectedPhaseIds: [],
			evidenceItems: [evidence],
			kind: 'fact',
			statement: `${finding.title}: ${finding.message}`,
		};

		items.push(fact);
	}

	return items;
}

// ---------------------------------------------------------------------------
// Consistency finding extraction
// ---------------------------------------------------------------------------

function extractFromConsistencyFindings(
	consistencyFindings: DocsCodeConsistencyFinding[],
	_diagnostics: CandidateExtractionDiagnostic[],
): CandidateExtractedItem[] {
	const items: CandidateExtractedItem[] = [];

	for (const finding of consistencyFindings) {
		const source: CandidateExtractionSource = {
			confidence: 0.7,
			evidence: safeSnippet(finding.evidence.summary),
			kind: 'docs_code_consistency_finding',
			pointer: finding.id,
		};

		const evidence = buildEvidence(
			`Expected: ${finding.expectedValue}, Observed: ${finding.observedValue}`,
			'docs_code_consistency_finding',
			finding.id,
			undefined,
			0.7,
		);

		const base = makeBase('fact', [], [source], 'candidate', 'medium');

		const fact: CandidateExtractedFact = {
			...base,
			affectedDocumentIds: [],
			affectedPhaseIds: [],
			evidenceItems: [evidence],
			kind: 'fact',
			statement: `Docs-vs-code: ${finding.evidence.summary}`,
		};

		items.push(fact);
	}

	return items;
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

function detectDuplicates(
	items: CandidateExtractedItem[],
	existingRegisterSummaries: CandidateExtractionInput['existingRegisterSummaries'],
	_diagnostics: CandidateExtractionDiagnostic[],
): {
	conflicts: CandidateExtractionConflict[];
	items: CandidateExtractedItem[];
} {
	const conflicts: CandidateExtractionConflict[] = [];
	const modifiedItems: CandidateExtractedItem[] = [...items];

	// Detect duplicates among extracted items
	for (let i = 0; i < modifiedItems.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
		const a = modifiedItems[i]!;
		if (a.status === 'duplicate') continue;

		for (let j = i + 1; j < modifiedItems.length; j++) {
			// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
			const b = modifiedItems[j]!;
			if (b.status === 'duplicate') continue;
			if (a.kind !== b.kind) continue;

			const aStmt = getStatement(a);
			const bStmt = getStatement(b);
			const aNorm = normalizeForComparison(aStmt);
			const bNorm = normalizeForComparison(bStmt);

			const isDuplicateStmt = aNorm === bNorm;
			const isSameSource =
				a.sourceCandidateIds.length > 0 &&
				b.sourceCandidateIds.length > 0 &&
				a.sourceCandidateIds.some((id) => b.sourceCandidateIds.includes(id));

			if (isDuplicateStmt || isSameSource) {
				const conflict: CandidateExtractionConflict = {
					candidateIds: [...a.sourceCandidateIds, ...b.sourceCandidateIds],
					existingRegisterIds: [],
					extractedItemIds: [a.id, b.id],
					id: nextExtractionId('extraction-conflict'),
					kind: 'duplicate_candidate',
					message: `Duplicate ${a.kind} detected: "${aStmt.slice(0, 80)}"`,
					pointer: a.sources[0]?.pointer,
					recoveryHint: 'Review duplicates and resolve before applying',
					severity: 'warning',
					sourcePath: a.sources[0]?.candidatePath,
				};
				conflicts.push(conflict);

				modifiedItems[i] = updateItem(a, {
					duplicateOfIds: [...a.duplicateOfIds, b.id],
					status: 'duplicate',
				});
				modifiedItems[j] = updateItem(b, {
					duplicateOfIds: [...b.duplicateOfIds, a.id],
					status: 'duplicate',
				});
			}
		}
	}

	// Detect duplicates with existing register items
	if (existingRegisterSummaries && existingRegisterSummaries.length > 0) {
		for (let idx = 0; idx < modifiedItems.length; idx++) {
			// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
			const item = modifiedItems[idx]!;
			if (item.status === 'duplicate') continue;
			const stmt = normalizeForComparison(getStatement(item));

			for (const existing of existingRegisterSummaries) {
				// Match by kind
				const existingKind = mapRegisterKindToExtractedKind(existing.kind);
				if (existingKind !== item.kind) continue;

				const existingStmt = normalizeForComparison(
					existing.statement || existing.title || '',
				);
				if (stmt === existingStmt) {
					const isConfirmed =
						existing.status === 'confirmed' ||
						existing.confirmationLevel === 'confirmed';

					const conflict: CandidateExtractionConflict = {
						candidateIds: item.sourceCandidateIds,
						existingRegisterIds: [existing.id],
						extractedItemIds: [item.id],
						id: nextExtractionId('extraction-conflict'),
						kind: isConfirmed
							? 'contradicts_existing_confirmed_record'
							: 'duplicate_candidate',
						message: `Extracted ${item.kind} matches existing register item "${existing.id}"`,
						pointer: item.sources[0]?.pointer,
						recoveryHint: isConfirmed
							? 'Existing confirmed record takes precedence; candidate requires review'
							: 'Resolve duplicate with existing register item',
						severity: isConfirmed ? 'error' : 'warning',
						sourcePath: item.sources[0]?.candidatePath,
					};
					conflicts.push(conflict);

					if (isConfirmed) {
						modifiedItems[idx] = updateItem(item, { status: 'conflicting' });
					} else {
						modifiedItems[idx] = updateItem(item, { status: 'duplicate' });
					}
					break;
				}
			}
		}
	}

	return { conflicts, items: modifiedItems };
}

function getStatement(item: CandidateExtractedItem): string {
	switch (item.kind) {
		case 'fact':
			return item.statement;
		case 'decision':
			return item.statement;
		case 'assumption':
			return item.statement;
		case 'hypothesis':
			return item.statement;
		case 'risk':
			return item.description;
		case 'open_question':
			return item.question;
		case 'constraint':
			return item.statement;
		case 'requirement':
			return item.statement;
		case 'acceptance_criterion':
			return item.statement;
		case 'non_goal':
			return item.statement;
		case 'evidence_reference':
			return item.reference;
		default:
			return '';
	}
}

function mapRegisterKindToExtractedKind(
	registerKind: string,
): CandidateExtractedItemKind | null {
	switch (registerKind) {
		case 'decision':
			return 'decision';
		case 'assumption':
			return 'assumption';
		case 'hypothesis':
			return 'hypothesis';
		case 'risk':
			return 'risk';
		case 'open_question':
			return 'open_question';
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Contradiction detection
// ---------------------------------------------------------------------------

function detectContradictions(
	items: CandidateExtractedItem[],
	input: CandidateExtractionInput,
	_diagnostics: CandidateExtractionDiagnostic[],
): {
	conflicts: CandidateExtractionConflict[];
	items: CandidateExtractedItem[];
} {
	const conflicts: CandidateExtractionConflict[] = [];
	const modifiedItems: CandidateExtractedItem[] = [...items];

	// Check for profile contract contradictions
	if (input.profileContractMetadata) {
		for (let i = 0; i < modifiedItems.length; i++) {
			// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
			const item = modifiedItems[i]!;
			if (item.status === 'conflicting' || item.status === 'blocked') continue;

			const stmt = normalizeForComparison(getStatement(item));

			// Profile ID conflicts
			if (
				stmt.includes(
					normalizeForComparison(input.profileContractMetadata?.profileId),
				)
			) {
				// Profile ID referenced is fine
			}

			// Check if candidate claims a different profile
			const profileMention = stmt.match(
				/profile\s*(?:id|identifier)?\s*["']?([a-zA-Z0-9_-]+)["']?/i,
			);
			if (
				profileMention &&
				profileMention[1]?.toLowerCase() !==
					input.profileContractMetadata?.profileId.toLowerCase()
			) {
				const conflict: CandidateExtractionConflict = {
					candidateIds: item.sourceCandidateIds,
					existingRegisterIds: [],
					extractedItemIds: [item.id],
					id: nextExtractionId('extraction-conflict'),
					kind: 'contradicts_profile_contract',
					message: `Extracted item references profile "${profileMention[1]}" but active profile is "${input.profileContractMetadata?.profileId}"`,
					recoveryHint: 'Verify profile reference',
					severity: 'warning',
					sourcePath: item.sources[0]?.candidatePath,
				};
				conflicts.push(conflict);

				modifiedItems[i] = updateItem(item, { status: 'conflicting' });
			}
		}
	}

	// Check for docs-code consistency contradictions
	if (input.consistencyResult) {
		for (const finding of input.consistencyResult.findings) {
			for (let i = 0; i < modifiedItems.length; i++) {
				// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
				const item = modifiedItems[i]!;
				if (item.status === 'conflicting' || item.status === 'blocked')
					continue;

				const _stmt = normalizeForComparison(getStatement(item));
				const findingPath = normalizeForComparison(
					finding.claimSourcePath ?? '',
				);

				// If candidate statement references the same path/document mentioned in finding
				if (
					findingPath &&
					item.sourceCandidateIds.some((cid) => {
						const sourcePath = item.sources.find(
							(s) => s.candidateId === cid,
						)?.candidatePath;
						return (
							sourcePath &&
							normalizeForComparison(sourcePath).includes(findingPath)
						);
					})
				) {
					const conflict: CandidateExtractionConflict = {
						candidateIds: item.sourceCandidateIds,
						existingRegisterIds: [],
						extractedItemIds: [item.id],
						id: nextExtractionId('extraction-conflict'),
						kind: 'contradicts_docs_code_consistency',
						message: `Extracted item may conflict with docs-code consistency finding "${finding.id}": ${finding.evidence.summary}`,
						recoveryHint: 'Review extracted item against consistency findings',
						severity: 'warning',
						sourcePath: item.sources[0]?.candidatePath,
					};
					conflicts.push(conflict);

					modifiedItems[i] = updateItem(item, { status: 'ambiguous' });
				}
			}
		}
	}

	// Check for scanner observation contradictions
	if (input.scannerResult) {
		for (const finding of input.scannerResult.findings) {
			if (finding.severity === 'error' || finding.severity === 'fatal') {
				for (let i = 0; i < modifiedItems.length; i++) {
					// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
					const item = modifiedItems[i]!;
					if (item.status === 'conflicting' || item.status === 'blocked')
						continue;

					const stmt = normalizeForComparison(getStatement(item));
					const _findingMsg = normalizeForComparison(finding.message);

					// Simple check: if extracted item asserts existence of something scanner says is missing
					if (
						finding.kind === 'missing_expected_file' &&
						(stmt.includes('exists') || stmt.includes('present'))
					) {
						const conflict: CandidateExtractionConflict = {
							candidateIds: item.sourceCandidateIds,
							existingRegisterIds: [],
							extractedItemIds: [item.id],
							id: nextExtractionId('extraction-conflict'),
							kind: 'contradicts_scanner_observation',
							message: `Extracted fact may contradict scanner finding "${finding.id}"`,
							recoveryHint: 'Review against scanner observations',
							severity: 'warning',
							sourcePath: item.sources[0]?.candidatePath,
						};
						conflicts.push(conflict);

						modifiedItems[i] = updateItem(item, { status: 'ambiguous' });
					}
				}
			}
		}
	}

	return { conflicts, items: modifiedItems };
}

// ---------------------------------------------------------------------------
// Security checks on extracted items
// ---------------------------------------------------------------------------

function checkSecurity(
	items: CandidateExtractedItem[],
	_diagnostics: CandidateExtractionDiagnostic[],
): {
	blockers: CandidateExtractionBlocker[];
	warnings: CandidateExtractionWarning[];
	items: CandidateExtractedItem[];
} {
	const blockers: CandidateExtractionBlocker[] = [];
	const warnings: CandidateExtractionWarning[] = [];
	const modifiedItems = [...items];

	for (let i = 0; i < modifiedItems.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
		const item = modifiedItems[i]!;
		const stmt = getStatement(item);

		// Check for secrets in statements
		if (hasSecretContent(stmt)) {
			const blocker: CandidateExtractionBlocker = {
				candidateId: item.sourceCandidateIds[0],
				code: 'extraction_secret_detected',
				extractedItemId: item.id,
				message: `Secret-like content detected in extracted ${item.kind}`,
				recoveryHint: 'Redact secrets before extraction; this item is blocked',
				severity: 'fatal',
				sourcePath: item.sources[0]?.candidatePath,
			};
			blockers.push(blocker);

			modifiedItems[i] = updateItemWithDiagnostics(
				item,
				{ status: 'blocked' },
				[
					{
						code: 'extraction_secret_detected',
						extractedItemId: item.id,
						itemKind: item.kind,
						message: 'Secret-like content detected',
						pointer: item.sources[0]?.pointer,
						recoveryHint: 'Redact secrets before extraction',
						severity: 'fatal',
						sourcePath: item.sources[0]?.candidatePath,
					},
				],
			);
			continue;
		}

		// Check for raw prompt/model response markers
		if (hasRawPromptMarkers(stmt)) {
			const warning: CandidateExtractionWarning = {
				candidateId: item.sourceCandidateIds[0],
				code: 'extraction_raw_prompt_detected',
				extractedItemId: item.id,
				message: `Raw prompt or model response marker detected in extracted ${item.kind}`,
				recoveryHint:
					'Verify this is not raw AI prompt/response content before confirming',
				sourcePath: item.sources[0]?.candidatePath,
			};
			warnings.push(warning);

			modifiedItems[i] = updateItemWithDiagnostics(
				item,
				{
					requiresReview: true,
					status: item.status === 'candidate' ? 'requires_review' : item.status,
				},
				[
					{
						code: 'extraction_raw_prompt_detected',
						extractedItemId: item.id,
						itemKind: item.kind,
						message:
							'Raw prompt/model response marker detected; review required',
						pointer: item.sources[0]?.pointer,
						recoveryHint:
							'Verify content is not raw AI output before confirming',
						severity: 'warning',
						sourcePath: item.sources[0]?.candidatePath,
					},
				],
			);
		}

		// Check for unsafe paths in evidence references
		if (item.kind === 'evidence_reference') {
			const ref = (item as CandidateExtractedEvidenceReference).reference;
			if (ref.includes('..') || ref.startsWith('/etc/') || ref.includes('~')) {
				const blocker: CandidateExtractionBlocker = {
					candidateId: item.sourceCandidateIds[0],
					code: 'extraction_unsafe_path_reference',
					extractedItemId: item.id,
					message: `Unsafe path reference detected: "${ref}"`,
					recoveryHint: 'Use relative, portable paths; path traversal detected',
					severity: 'fatal',
					sourcePath: item.sources[0]?.candidatePath,
				};
				blockers.push(blocker);
				modifiedItems[i] = updateItem(
					item as CandidateExtractedEvidenceReference,
					{ status: 'blocked' },
				) as CandidateExtractedItem;
			}
		}
	}

	// Redact evidence snippets that might still contain secrets
	for (let i = 0; i < modifiedItems.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
		const item = modifiedItems[i]!;
		const redactedSources = item.sources.map((s) => ({
			...s,
			evidence: s.evidence ? redactSecretContent(s.evidence) : s.evidence,
		}));

		let redactedEvidenceItems: CandidateExtractionEvidence[] | undefined;
		if ('evidenceItems' in item) {
			redactedEvidenceItems = (
				item as CandidateExtractedFact
			).evidenceItems?.map((e) => ({
				...e,
				snippet: redactSecretContent(e.snippet),
			}));
		}

		modifiedItems[i] = {
			...item,
			sources: redactedSources,
			...(redactedEvidenceItems
				? { evidenceItems: redactedEvidenceItems }
				: {}),
		} as CandidateExtractedItem;
	}

	return { blockers, items: modifiedItems, warnings };
}

// ---------------------------------------------------------------------------
// Derived artifact boundary checks
// ---------------------------------------------------------------------------

function checkDerivedArtifactBoundary(
	items: CandidateExtractedItem[],
	candidates: DocumentationImportCandidate[],
	options: CandidateExtractionOptions,
	_diagnostics: CandidateExtractionDiagnostic[],
): {
	blockers: CandidateExtractionBlocker[];
	warnings: CandidateExtractionWarning[];
	items: CandidateExtractedItem[];
} {
	const blockers: CandidateExtractionBlocker[] = [];
	const warnings: CandidateExtractionWarning[] = [];
	const modifiedItems = [...items];

	const derivedCandidateIds = new Set<string>();
	for (const c of candidates) {
		if (isDerivedArtifactCandidate(c)) {
			derivedCandidateIds.add(c.id);
		}
	}

	if (derivedCandidateIds.size === 0)
		return { blockers, items: modifiedItems, warnings };

	for (let i = 0; i < modifiedItems.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: bounded by loop index
		const item = modifiedItems[i]!;
		const isFromDerived = item.sourceCandidateIds.some((cid) =>
			derivedCandidateIds.has(cid),
		);

		if (!isFromDerived) continue;

		const allowExtraction = options.allowDerivedArtifactExtraction ?? false;
		const _allowEvidence = options.allowDerivedArtifactEvidence ?? false;

		// Derived artifacts cannot produce authoritative facts/decisions
		if (
			item.kind === 'fact' ||
			item.kind === 'decision' ||
			item.kind === 'assumption' ||
			item.kind === 'hypothesis' ||
			item.kind === 'constraint' ||
			item.kind === 'requirement' ||
			item.kind === 'acceptance_criterion' ||
			item.kind === 'non_goal' ||
			item.kind === 'risk'
		) {
			if (!allowExtraction) {
				// Block authoritative extractions from derived artifacts
				const blocker: CandidateExtractionBlocker = {
					candidateId: item.sourceCandidateIds[0],
					code: 'extraction_derived_artifact_source',
					extractedItemId: item.id,
					message: `Cannot extract authoritative ${item.kind} from derived artifact`,
					recoveryHint:
						'Use canonical Markdown or structured state as authoritative source',
					severity: 'error',
					sourcePath: item.sources[0]?.candidatePath,
				};
				blockers.push(blocker);
				modifiedItems[i] = updateItem(item, { status: 'blocked' });
			} else {
				// If allowed, mark as low confidence and requires review (conflict logged as diagnostic)
				modifiedItems[i] = updateItem(item, {
					confidence: 'low',
					requiresReview: true,
					status: 'requires_review',
				});
			}
			continue;
		}

		// Evidence references from derived artifacts
		if (item.kind === 'evidence_reference') {
			// Always downgrade confidence for evidence refs from derived artifacts
			modifiedItems[i] = updateItem(
				item as CandidateExtractedEvidenceReference,
				{
					confidence: 'low',
					requiresReview: true,
					status: 'requires_review',
				},
			) as CandidateExtractedItem;
		}
	}

	return { blockers, items: modifiedItems, warnings };
}

// ---------------------------------------------------------------------------
// Review action generation
// ---------------------------------------------------------------------------

function generateReviewActions(
	items: CandidateExtractedItem[],
	conflicts: CandidateExtractionConflict[],
	_diagnostics: CandidateExtractionDiagnostic[],
): CandidateExtractionReviewAction[] {
	const actions: CandidateExtractionReviewAction[] = [];

	for (const item of items) {
		let actionKind: CandidateExtractionActionKind | null = null;

		switch (item.kind) {
			case 'fact':
				actionKind = 'review_candidate_fact';
				break;
			case 'decision':
				actionKind = 'review_candidate_decision';
				break;
			case 'assumption':
				actionKind = 'review_candidate_assumption';
				break;
			case 'hypothesis':
				actionKind = 'review_candidate_hypothesis';
				break;
			case 'risk':
				actionKind = 'review_candidate_risk';
				break;
			case 'open_question':
				actionKind = 'review_candidate_open_question';
				break;
			case 'constraint':
				actionKind = 'review_candidate_constraint';
				break;
			case 'requirement':
				actionKind = 'review_candidate_requirement';
				break;
			case 'acceptance_criterion':
				actionKind = 'review_candidate_acceptance_criterion';
				break;
			case 'non_goal':
				actionKind = 'review_candidate_non_goal';
				break;
			case 'evidence_reference':
				actionKind = 'review_evidence_reference';
				break;
			default:
				break;
		}

		if (!actionKind) continue;

		const futureMutationType = `confirm_${item.kind}`;

		const action: CandidateExtractionReviewAction = {
			candidateId: item.sourceCandidateIds[0],
			confidence: confidenceToNumber(item.confidence),
			evidence: item.sources[0]?.evidence,
			extractedItemId: item.id,
			futureMutationType,
			id: nextExtractionId('extraction-action'),
			kind: actionKind,
			reason: `Review extracted ${item.kind}: "${getStatement(item).slice(0, 80)}"`,
			sourcePath: item.sources[0]?.candidatePath,
		};
		actions.push(action);
	}

	// Add conflict resolution actions
	for (const conflict of conflicts) {
		actions.push({
			candidateId: conflict.candidateIds[0],
			confidence: 0.5,
			conflictId: conflict.id,
			evidence: conflict.message,
			id: nextExtractionId('extraction-action'),
			kind: 'resolve_candidate_conflict',
			reason: `Resolve conflict: ${conflict.message}`,
			sourcePath: conflict.sourcePath,
		});
	}

	// Add discard actions for unsupported items
	for (const item of items) {
		if (item.status === 'unsupported' || item.status === 'blocked') {
			actions.push({
				candidateId: item.sourceCandidateIds[0],
				confidence: 0,
				extractedItemId: item.id,
				id: nextExtractionId('extraction-action'),
				kind: 'discard_unsupported_candidate',
				reason: `Discard unsupported/blocked ${item.kind}: "${getStatement(item).slice(0, 80)}"`,
				sourcePath: item.sources[0]?.candidatePath,
			});
		}
	}

	// Sort deterministically
	actions.sort((a, b) => {
		// 1. Action kind order
		const kindDiff =
			(CANDIDATE_EXTRACTION_ACTION_KIND_ORDER[a.kind] ?? 99) -
			(CANDIDATE_EXTRACTION_ACTION_KIND_ORDER[b.kind] ?? 99);
		if (kindDiff !== 0) return kindDiff;

		// 2. Source path
		const pathDiff = (a.sourcePath ?? '').localeCompare(b.sourcePath ?? '');
		if (pathDiff !== 0) return pathDiff;

		// 3. Stable id
		return a.id.localeCompare(b.id);
	});

	return actions;
}

function confidenceToNumber(
	confidence: CandidateExtractedItemConfidence,
): number {
	switch (confidence) {
		case 'high':
			return 0.8;
		case 'medium':
			return 0.5;
		case 'low':
			return 0.3;
		default:
			return 0.1;
	}
}

// ---------------------------------------------------------------------------
// Summary and readiness computation
// ---------------------------------------------------------------------------

function computeSummary(
	items: CandidateExtractedItem[],
	_conflicts: CandidateExtractionConflict[],
	_blockers: CandidateExtractionBlocker[],
	_warnings: CandidateExtractionWarning[],
	sourceCount: number,
	candidateCount: number,
): CandidateExtractionSummary {
	const kindCounts: Record<string, number> = {};
	const statusCounts: Record<string, number> = {};
	const confCounts: Record<string, number> = {};

	let duplicateCount = 0;
	let ambiguousCount = 0;
	let conflictingCount = 0;
	let blockedCount = 0;
	let unsupportedCount = 0;

	for (const item of items) {
		kindCounts[item.kind] = (kindCounts[item.kind] ?? 0) + 1;
		statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
		confCounts[item.confidence] = (confCounts[item.confidence] ?? 0) + 1;

		if (item.status === 'duplicate') duplicateCount++;
		if (item.status === 'ambiguous') ambiguousCount++;
		if (item.status === 'conflicting') conflictingCount++;
		if (item.status === 'blocked') blockedCount++;
		if (item.status === 'unsupported') unsupportedCount++;
	}

	return {
		ambiguousCount,
		blockedCount,
		candidateCount,
		confidenceSummary: summarizeConfidence(confCounts),
		conflictingCount,
		countsByConfidence: confCounts,
		countsByKind: kindCounts,
		countsByStatus: statusCounts,
		duplicateCount,
		extractedItemCount: items.length,
		sourceCount,
		sourceCoverageSummary: summarizeSourceCoverage(
			items,
			sourceCount,
			candidateCount,
		),
		unsupportedCount,
	};
}

function summarizeConfidence(confCounts: Record<string, number>): string {
	const high = confCounts.high ?? 0;
	const medium = confCounts.medium ?? 0;
	const low = confCounts.low ?? 0;
	const unknown = confCounts.unknown ?? 0;
	const total = high + medium + low + unknown;

	if (total === 0) return 'No extracted items';
	const highPct = Math.round((high / total) * 100);
	const mediumPct = Math.round((medium / total) * 100);
	return `${highPct}% high, ${mediumPct}% medium, rest low/unknown confidence`;
}

function summarizeSourceCoverage(
	items: CandidateExtractedItem[],
	sourceCount: number,
	_candidateCount: number,
): string {
	if (sourceCount === 0) return 'No sources processed';
	if (items.length === 0) return 'No items extracted from sources';

	const sourcesWithItems = new Set<string>();
	for (const item of items) {
		for (const src of item.sources) {
			if (src.candidatePath) sourcesWithItems.add(src.candidatePath);
		}
	}

	return `${sourcesWithItems.size}/${sourceCount} sources yielded extractable items`;
}

function computeReadiness(
	items: CandidateExtractedItem[],
	blockers: CandidateExtractionBlocker[],
): CandidateExtractionReadiness {
	const hasFatalBlockers = blockers.some(
		(b) => b.severity === 'fatal' || b.severity === 'error',
	);
	if (hasFatalBlockers) return 'blocked';

	if (items.length === 0) return 'empty';

	const hasAmbiguous = items.some((i) => i.status === 'ambiguous');
	const hasLowConfidence = items.some((i) => i.confidence === 'low');
	const hasRequiresReview = items.some((i) => i.requiresReview);

	if (hasAmbiguous || hasLowConfidence) return 'requires_manual_review';
	if (hasRequiresReview) return 'requires_manual_review';

	const hasCandidates = items.some((i) => i.status === 'candidate');
	if (hasCandidates) return 'ready_for_review';

	return 'unknown';
}

// ---------------------------------------------------------------------------
// Item ordering
// ---------------------------------------------------------------------------

function sortItems(items: CandidateExtractedItem[]): CandidateExtractedItem[] {
	return [...items].sort((a, b) => {
		// 1. Item kind order
		const kindDiff =
			(CANDIDATE_EXTRACTED_ITEM_KIND_ORDER[a.kind] ?? 99) -
			(CANDIDATE_EXTRACTED_ITEM_KIND_ORDER[b.kind] ?? 99);
		if (kindDiff !== 0) return kindDiff;

		// 2. Source candidate path
		const aPath = a.sources[0]?.candidatePath ?? '';
		const bPath = b.sources[0]?.candidatePath ?? '';
		const pathDiff = aPath.localeCompare(bPath);
		if (pathDiff !== 0) return pathDiff;

		// 3. Source kind
		const aKind = a.sources[0]?.kind ?? 'unknown';
		const bKind = b.sources[0]?.kind ?? 'unknown';
		const sourceKindDiff =
			(CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER[aKind] ?? 99) -
			(CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER[bKind] ?? 99);
		if (sourceKindDiff !== 0) return sourceKindDiff;

		// 4. Source pointer
		const aPointer = a.sources[0]?.pointer ?? '';
		const bPointer = b.sources[0]?.pointer ?? '';
		const pointerDiff = aPointer.localeCompare(bPointer);
		if (pointerDiff !== 0) return pointerDiff;

		// 5. Stable id
		return a.id.localeCompare(b.id);
	});
}

// ---------------------------------------------------------------------------
// Conflict ordering
// ---------------------------------------------------------------------------

function sortConflicts(
	conflicts: CandidateExtractionConflict[],
): CandidateExtractionConflict[] {
	const severityOrder: Record<string, number> = {
		error: 1,
		fatal: 0,
		warning: 2,
	};

	return [...conflicts].sort((a, b) => {
		// 1. Severity
		const sevDiff =
			(severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
		if (sevDiff !== 0) return sevDiff;

		// 2. Conflict kind
		const kindDiff =
			(CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER[a.kind] ?? 99) -
			(CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER[b.kind] ?? 99);
		if (kindDiff !== 0) return kindDiff;

		// 3. Source path
		const pathDiff = (a.sourcePath ?? '').localeCompare(b.sourcePath ?? '');
		if (pathDiff !== 0) return pathDiff;

		// 4. Stable id
		return a.id.localeCompare(b.id);
	});
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract candidate facts, decisions, assumptions, hypotheses, risks,
 * open questions, constraints, requirements, acceptance criteria, non-goals,
 * and evidence references from approved import candidates and bounded
 * documentation metadata.
 *
 * This is a read-only, deterministic, provider-free extractor.
 * It produces reviewable candidate records only — never confirmed state.
 *
 * It does NOT:
 * - Write to `.logos/` state
 * - Confirm decisions, assumptions, risks, or questions
 * - Update registers or artifact registry
 * - Generate canonical Markdown, HTML, Agent Packs, or Executive exports
 * - Call AI providers or perform external research
 * - Scan arbitrary source code
 * - Mutate files
 * - Read full candidate files by default
 */
export function extractCandidateFactsAndDecisions(
	input: CandidateExtractionInput,
	options?: CandidateExtractionOptions,
): CandidateExtractionResult {
	const dryRun = options?.dryRun ?? true;
	const extractedAt = options?.extractedAt ?? input.extractedAt ?? nowISO();

	// Reset counters for deterministic ids
	resetExtractionIdCounter();

	const diagnostics: CandidateExtractionDiagnostic[] = [];
	const blockers: CandidateExtractionBlocker[] = [];
	const warnings: CandidateExtractionWarning[] = [];
	const allConflicts: CandidateExtractionConflict[] = [];

	// ------------------------------------------------------------------
	// 1. Gather candidates
	// ------------------------------------------------------------------
	let candidates: DocumentationImportCandidate[] = [];

	if (input.importPlan) {
		candidates = input.importPlan.candidates;
	} else if (input.candidates) {
		candidates = input.candidates;
	}

	const candidateCount = candidates.length;
	const sourceCount =
		candidateCount +
		(input.scannerResult?.findings.length ?? 0) +
		(input.consistencyResult?.findings.length ?? 0);

	// ------------------------------------------------------------------
	// 2. Per-candidate extraction
	// ------------------------------------------------------------------
	const allItems: CandidateExtractedItem[] = [];

	for (const candidate of candidates) {
		// Check for transcript candidates
		if (isTranscriptCandidate(candidate)) {
			if (!options?.allowTranscriptExtraction) {
				// Defer transcript extraction
				diagnostics.push({
					candidateId: candidate.id,
					code: 'extraction_transcript_deferred',
					message: `Transcript extraction is deferred for candidate "${candidate.relativePath}"`,
					recoveryHint:
						'Transcript extraction requires explicit specification and is not supported in this step',
					severity: 'info',
					sourcePath: candidate.relativePath,
				});
				continue;
			} else {
				diagnostics.push({
					candidateId: candidate.id,
					code: 'extraction_transcript_low_confidence',
					message: `Transcript extraction is low-confidence for "${candidate.relativePath}"`,
					recoveryHint:
						'Transcript content may not be suitable for structured extraction',
					severity: 'warning',
					sourcePath: candidate.relativePath,
				});
			}
		}

		// Check for derived artifact candidates (preliminary pass)
		const isDerived = isDerivedArtifactCandidate(candidate);

		// Use bounded snippet from candidate or from explicit snippets map
		let snippet = candidate.contentSnippet;
		if (!snippet && input.candidateSnippets) {
			snippet = input.candidateSnippets.get(candidate.relativePath);
		}

		if (!snippet) {
			diagnostics.push({
				candidateId: candidate.id,
				code: 'extraction_no_snippet',
				message: `No content snippet available for candidate "${candidate.relativePath}"; limited extraction from metadata only`,
				recoveryHint: 'Provide bounded content snippets for richer extraction',
				severity: 'info',
				sourcePath: candidate.relativePath,
			});

			// Still try to extract from metadata (headings/frontmatter keys)
			const metaItems = extractFromMetadataOnly(candidate, diagnostics);
			if (isDerived) {
				// Don't add items from derived artifacts unless allowed
				if (options?.allowDerivedArtifactExtraction) {
					for (const mi of metaItems) {
						allItems.push({
							...mi,
							confidence: 'low',
							requiresReview: true,
							status: 'requires_review',
						});
					}
				}
			} else {
				allItems.push(...metaItems);
			}
			continue;
		}

		// Security check on snippet
		const snippetHasSecrets = hasSecretContent(snippet);
		if (snippetHasSecrets) {
			blockers.push({
				candidateId: candidate.id,
				code: 'extraction_secret_in_snippet',
				message: `Secret-like content detected in candidate "${candidate.relativePath}"`,
				recoveryHint:
					'Redact secrets from source before extraction; this candidate is blocked',
				severity: 'fatal',
				sourcePath: candidate.relativePath,
			});
			continue;
		}

		// Raw prompt check on snippet
		if (hasRawPromptMarkers(snippet)) {
			warnings.push({
				candidateId: candidate.id,
				code: 'extraction_raw_prompt_in_snippet',
				message: `Raw prompt/model response markers detected in candidate "${candidate.relativePath}"`,
				recoveryHint:
					'Verify content is not raw AI output before extracting structured items',
				sourcePath: candidate.relativePath,
			});
		}

		// Parse frontmatter
		const fm = parseFrontmatterFromSnippet(snippet);

		// Parse headings
		const sections = parseHeadingsFromSnippet(snippet);

		// Extract from frontmatter
		const fmItems = extractFromFrontmatter(candidate, fm, diagnostics);

		// Extract from headings
		const headingItems = extractFromHeadings(candidate, sections, diagnostics);

		const candidateItems = [...fmItems, ...headingItems];

		// If derived artifact, handle specially
		if (isDerived) {
			if (!options?.allowDerivedArtifactExtraction) {
				for (const item of candidateItems) {
					if (
						item.kind !== 'evidence_reference' ||
						!options?.allowDerivedArtifactEvidence
					) {
						diagnostics.push({
							candidateId: candidate.id,
							code: 'extraction_derived_artifact_blocked',
							extractedItemId: item.id,
							itemKind: item.kind,
							message: `Blocking authoritative ${item.kind} extraction from derived artifact "${candidate.relativePath}"`,
							recoveryHint: 'Use canonical sources for authoritative content',
							severity: 'error',
							sourcePath: candidate.relativePath,
						});
					}
				}
			} else {
				for (const item of candidateItems) {
					diagnostics.push({
						candidateId: candidate.id,
						code: 'extraction_derived_artifact_source',
						extractedItemId: item.id,
						itemKind: item.kind,
						message: `Extracted ${item.kind} from derived artifact "${candidate.relativePath}"; low confidence`,
						recoveryHint: 'Verify against canonical sources',
						severity: 'warning',
						sourcePath: candidate.relativePath,
					});
				}
			}
		}

		allItems.push(...candidateItems);
	}

	// ------------------------------------------------------------------
	// 3. Extract from scanner findings
	// ------------------------------------------------------------------
	if (input.scannerResult) {
		const scannerItems = extractFromScannerFindings(
			input.scannerResult.findings,
			diagnostics,
		);
		allItems.push(...scannerItems);
	}

	// ------------------------------------------------------------------
	// 4. Extract from consistency findings
	// ------------------------------------------------------------------
	if (input.consistencyResult) {
		const consistencyItems = extractFromConsistencyFindings(
			input.consistencyResult.findings,
			diagnostics,
		);
		allItems.push(...consistencyItems);
	}

	// ------------------------------------------------------------------
	// 5. Duplicate detection
	// ------------------------------------------------------------------
	const dupResult = detectDuplicates(
		allItems,
		input.existingRegisterSummaries,
		diagnostics,
	);
	let items = dupResult.items;
	allConflicts.push(...dupResult.conflicts);

	// ------------------------------------------------------------------
	// 6. Contradiction detection
	// ------------------------------------------------------------------
	const contraResult = detectContradictions(items, input, diagnostics);
	items = contraResult.items;
	allConflicts.push(...contraResult.conflicts);

	// ------------------------------------------------------------------
	// 7. Derived artifact boundary checks
	// ------------------------------------------------------------------
	const derivedResult = checkDerivedArtifactBoundary(
		items,
		candidates,
		options ?? {},
		diagnostics,
	);
	items = derivedResult.items;
	blockers.push(...derivedResult.blockers);
	warnings.push(...derivedResult.warnings);

	// ------------------------------------------------------------------
	// 8. Security checks
	// ------------------------------------------------------------------
	const secResult = checkSecurity(items, diagnostics);
	items = secResult.items;
	blockers.push(...secResult.blockers);
	warnings.push(...secResult.warnings);

	// ------------------------------------------------------------------
	// 9. Sort items and conflicts
	// ------------------------------------------------------------------
	items = sortItems(items);
	const conflicts = sortConflicts(allConflicts);

	// ------------------------------------------------------------------
	// 10. Generate review actions
	// ------------------------------------------------------------------
	const reviewActions = generateReviewActions(items, conflicts, diagnostics);

	// ------------------------------------------------------------------
	// 11. Compute summary and readiness
	// ------------------------------------------------------------------
	const summary = computeSummary(
		items,
		conflicts,
		blockers,
		warnings,
		sourceCount,
		candidateCount,
	);
	const readiness = computeReadiness(items, blockers);

	// ------------------------------------------------------------------
	// 12. Build result
	// ------------------------------------------------------------------
	const result: CandidateExtractionResult = {
		activeProfileId: input.profileId,
		ambiguousCount: summary.ambiguousCount,
		blockedCount: summary.blockedCount,
		blockers,
		candidateCount,
		changedPaths: [],
		confidenceSummary: summary.confidenceSummary,
		conflictingCount: summary.conflictingCount,
		conflicts,
		countsByConfidence: summary.countsByConfidence,
		countsByKind: summary.countsByKind,
		countsByStatus: summary.countsByStatus,
		diagnostics,
		documentationRoot: input.documentationRoot ?? 'logos/',
		dryRun,
		duplicateCount: summary.duplicateCount,
		extractedAt,
		extractedItemCount: summary.extractedItemCount,
		items,
		profileVersion: input.profileVersion ?? null,
		readiness,
		readOnly: true,
		reviewActions,
		sourceCount,
		sourceCoverageSummary: summary.sourceCoverageSummary,
		summary,
		unsupportedCount: summary.unsupportedCount,
		warnings,
	};

	return result;
}

// ---------------------------------------------------------------------------
// Metadata-only extraction (when no snippet available)
// ---------------------------------------------------------------------------

function extractFromMetadataOnly(
	candidate: DocumentationImportCandidate,
	diagnostics: CandidateExtractionDiagnostic[],
): CandidateExtractedItem[] {
	const items: CandidateExtractedItem[] = [];

	// Use declared frontmatter keys and headings from metadata
	const frontmatterKeys = candidate.metadata.frontmatterKeys ?? [];
	const headings = candidate.metadata.headings ?? [];

	for (const key of frontmatterKeys) {
		const itemKind = RECOGNIZED_FRONTMATTER_KEYS[key];
		if (!itemKind) continue;

		const source = buildSource(
			candidate,
			'markdown_frontmatter',
			key,
			undefined,
			0.3,
		);

		const base = makeBase(
			itemKind,
			[candidate.id],
			[source],
			'requires_review',
			'low',
		);

		const evidence = buildEvidence(
			`[metadata only: ${key} detected]`,
			'markdown_frontmatter',
			key,
			candidate,
			0.3,
		);

		switch (itemKind) {
			case 'fact': {
				const fact: CandidateExtractedFact = {
					...base,
					affectedDocumentIds: [],
					affectedPhaseIds: [],
					evidenceItems: [evidence],
					kind: 'fact',
					statement: `[fact from frontmatter key: ${key}]`,
				};
				items.push(fact);
				break;
			}
			case 'decision': {
				const decision: CandidateExtractedDecision = {
					...base,
					affectedDocumentIds: [],
					affectedPhaseIds: [],
					evidenceItems: [evidence],
					kind: 'decision',
					statement: `[decision from frontmatter key: ${key}]`,
					title: `Decision from ${key}`,
				};
				items.push(decision);
				break;
			}
			case 'risk': {
				const risk: CandidateExtractedRisk = {
					...base,
					affectedDocumentIds: [],
					affectedPhaseIds: [],
					description: `[risk from frontmatter key: ${key}]`,
					evidenceItems: [evidence],
					kind: 'risk',
					title: `Risk from ${key}`,
				};
				items.push(risk);
				break;
			}
			default:
				// For other types, create a generic fact as placeholder
				diagnostics.push({
					candidateId: candidate.id,
					code: 'extraction_metadata_only',
					message: `Cannot extract ${itemKind} from metadata-only key "${key}"; insufficient detail`,
					recoveryHint: 'Provide content snippets for richer extraction',
					severity: 'info',
					sourcePath: candidate.relativePath,
				});
				break;
		}
	}

	// Check headings from metadata
	for (const heading of headings) {
		const itemKind = RECOGNIZED_HEADINGS[heading];
		if (!itemKind) continue;

		const source = buildSource(
			candidate,
			'markdown_heading',
			heading,
			undefined,
			0.3,
		);

		const base = makeBase(
			itemKind,
			[candidate.id],
			[source],
			'requires_review',
			'low',
		);

		const evidence = buildEvidence(
			`[metadata only: heading "${heading}" detected]`,
			'markdown_heading',
			heading,
			candidate,
			0.3,
		);

		diagnostics.push({
			candidateId: candidate.id,
			code: 'extraction_metadata_only_heading',
			message: `Heading "${heading}" detected for candidate "${candidate.relativePath}" but no snippet available for content extraction`,
			recoveryHint: 'Provide content snippets for richer extraction',
			severity: 'info',
			sourcePath: candidate.relativePath,
		});

		// Only create minimal items for decision/risk types
		if (itemKind === 'decision') {
			const decision: CandidateExtractedDecision = {
				...base,
				affectedDocumentIds: [],
				affectedPhaseIds: [],
				evidenceItems: [evidence],
				kind: 'decision',
				statement: `[heading: ${heading}]`,
				title: heading,
			};
			items.push(decision);
		} else if (itemKind === 'risk') {
			const risk: CandidateExtractedRisk = {
				...base,
				affectedDocumentIds: [],
				affectedPhaseIds: [],
				description: `[heading: ${heading}]`,
				evidenceItems: [evidence],
				kind: 'risk',
				title: heading,
			};
			items.push(risk);
		}
	}

	return items;
}
