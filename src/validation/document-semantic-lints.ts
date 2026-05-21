/** Step 6.2 — Document Completeness and Semantic Lints
 * Conservative, deterministic, read-only semantic lint service for canonical
 * Markdown documents.  No AI.  No file writes.  No state mutation.
 */

import type { GenerationPlanItem } from '../generation/generation-planner-types.js';
import type { CanonicalMarkdownRenderResult } from '../generation/markdown-renderer-types.js';
import type { GeneratedMarkdownMetadata } from '../generation/markdown-writer-types.js';
import { parseFrontmatter } from '../generation/safe-markdown-writer.js';
import type { DocumentDescriptor } from '../profiles/document-descriptor.js';
import {
	createValidationFinding,
	determineValidationGateStatus,
	looksLikeSecretLikeValue,
	redactSecretLikeString,
	sortValidationFindings,
	summarizeValidationFindings,
	type ValidationFinding,
	type ValidationFindingCode,
	type ValidationFindingSeverity,
	type ValidationFindingSource,
	type ValidationGateStatus,
	type ValidationRunResult,
	type ValidationScope,
	type ValidationSummary,
} from './validation-finding.js';

// ---------------------------------------------------------------------------
// Semantic-lint-specific source kind (reuses existing sources)
// ---------------------------------------------------------------------------

const SOURCE_DOCUMENT_LINT: ValidationFindingSource = 'validation_service';
const SOURCE_SECRET_SCAN: ValidationFindingSource = 'secret_scan';

// ---------------------------------------------------------------------------
// Lint rule IDs
// ---------------------------------------------------------------------------

export type DocumentSemanticLintRuleId =
	| 'required-sections'
	| 'traceability'
	| 'unresolved-questions-marking'
	| 'evidence-boundary'
	| 'derived-artifact-boundary'
	| 'token-leak'
	| 'contradiction'
	| 'plan-status';

// ---------------------------------------------------------------------------
// Lint rule definition
// ---------------------------------------------------------------------------

export interface DocumentSemanticLintRule {
	id: DocumentSemanticLintRuleId;
	title: string;
	description: string;
	defaultSeverity: ValidationFindingSeverity;
	checks: string;
	doesNotCheck: string;
	sourceReferences?: string[];
}

// ---------------------------------------------------------------------------
// Lint context passed to each rule
// ---------------------------------------------------------------------------

export interface DocumentSemanticLintContext {
	markdown: string;
	descriptor?: DocumentDescriptor | undefined;
	renderResult?: CanonicalMarkdownRenderResult | undefined;
	planItem?: GenerationPlanItem | undefined;
	parsedMetadata?: GeneratedMarkdownMetadata | undefined;
	profileId?: string | undefined;
	sourcePath?: string | undefined;
}

// ---------------------------------------------------------------------------
// Lint input / options / result
// ---------------------------------------------------------------------------

export interface DocumentSemanticLintInput {
	markdown: string;
	descriptor?: DocumentDescriptor | undefined;
	renderResult?: CanonicalMarkdownRenderResult | undefined;
	planItem?: GenerationPlanItem | undefined;
	profileId?: string | undefined;
	sourcePath?: string | undefined;
}

export interface DocumentSemanticLintOptions {
	ruleIds?: DocumentSemanticLintRuleId[] | undefined;
	checkedAt?: string | undefined;
}

export interface DocumentSemanticLintRuleResult {
	ruleId: DocumentSemanticLintRuleId;
	findings: ValidationFinding[];
}

export interface DocumentSemanticLintResult {
	documentCanonicalId: string;
	phaseId: string;
	sourcePath?: string | undefined;
	profileId?: string | undefined;
	rulesChecked: DocumentSemanticLintRuleId[];
	ruleResults: DocumentSemanticLintRuleResult[];
	findings: ValidationFinding[];
	summary: ValidationSummary;
	gate: ValidationGateStatus;
	checkedAt?: string | undefined;
	readOnly: true;
	changedPaths: [];
}

// ---------------------------------------------------------------------------
// Markdown structure types
// ---------------------------------------------------------------------------

export interface MarkdownHeadingIndex {
	level: number;
	title: string;
	line: number;
}

export interface MarkdownLintDiagnostic {
	code: string;
	severity: ValidationFindingSeverity;
	message: string;
	line?: number;
	pointer?: string;
}

export interface MarkdownDocumentStructure {
	headings: MarkdownHeadingIndex[];
	metadata?: GeneratedMarkdownMetadata | undefined;
	lines: string[];
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

const SEMANTIC_LINT_RULE_REGISTRY: Record<
	DocumentSemanticLintRuleId,
	DocumentSemanticLintRule
> = {
	contradiction: {
		checks:
			'Document ID/metadata mismatches, profile ID mismatches, status complete with missing sections, "no X" claims with X items present, validation-passed vs not-run contradictions.',
		defaultSeverity: 'error',
		description:
			'Checks for deterministic contradictions in canonical Markdown documents, such as metadata mismatches, status inconsistencies, and section content contradictions.',
		doesNotCheck:
			'Broad semantic contradictions via NLP/AI, nuanced logical inconsistencies, external fact-checking.',
		id: 'contradiction',
		sourceReferences: [
			'MarkdownMetadataHeader',
			'GenerationPlanItem',
			'rendered sections',
		],
		title: 'Deterministic Contradiction Checks',
	},
	'derived-artifact-boundary': {
		checks:
			'Derived artifacts labeled as derived/non-canonical; HTML/agent/executive outputs not called canonical; artifact metadata not used as proof of completeness.',
		defaultSeverity: 'warning',
		description:
			'Checks that generated artifacts (HTML, agent packs, executive exports) are correctly labeled as derived/non-canonical and not presented as sources of truth.',
		doesNotCheck:
			'Actual HTML/agent/executive file validation, artifact file correctness, cross-artifact consistency.',
		id: 'derived-artifact-boundary',
		sourceReferences: [
			'DocumentDescriptorOutput',
			'nonCanonicalArtifacts metadata field',
		],
		title: 'Derived Artifact Boundary Integrity',
	},
	'evidence-boundary': {
		checks:
			'Claims of validation, proof, user confirmation, market validation, legal compliance, security audit, production readiness that lack explicit evidence/source markers.',
		defaultSeverity: 'warning',
		description:
			'Checks that canonical Markdown documents do not claim external validation beyond the evidence they explicitly cite.',
		doesNotCheck:
			'Truthfulness of claims via AI, external research validation, actual evidence file existence, field-specific domain validation.',
		id: 'evidence-boundary',
		sourceReferences: [
			'Evidence log',
			'Decision record',
			'Validation report',
			'MarkdownSourceReference',
		],
		title: 'External Validation and Evidence Boundary',
	},
	'plan-status': {
		checks:
			'Incomplete documents without gap markers; blocked documents claiming complete; failed documents claiming generated/complete; stale documents without stale warning.',
		defaultSeverity: 'warning',
		description:
			'Checks generation plan item status consistency with rendered document content, including incomplete/blocked/failed documents claiming completion.',
		doesNotCheck:
			'Re-running generation planner, updating plan metadata, forcing generation actions.',
		id: 'plan-status',
		sourceReferences: ['GenerationPlanItem', 'GenerationAction'],
		title: 'Plan/Status Consistency',
	},
	'required-sections': {
		checks:
			'Required sections from descriptor exist in Markdown; missing, duplicate, and materially empty required sections.',
		defaultSeverity: 'error',
		description:
			'Checks that canonical Markdown documents include all required sections declared in the document descriptor.',
		doesNotCheck:
			'Section content quality, section order enforcement, optional section presence, AI-based semantic evaluation.',
		id: 'required-sections',
		sourceReferences: [
			'DocumentDescriptor.sections',
			'renderer section output',
		],
		title: 'Required Section Completeness',
	},
	'token-leak': {
		checks:
			'Bearer authorization strings, API key patterns, provider tokens, raw environment variable values, common secret patterns in content and metadata.',
		defaultSeverity: 'error',
		description:
			'Checks that canonical Markdown documents do not contain raw token-like values, API keys, bearer tokens, or other secret-like strings.',
		doesNotCheck:
			'Encrypted content, obfuscated secrets, non-string secret representations, external file scanning.',
		id: 'token-leak',
		sourceReferences: ['looksLikeSecretLikeValue', 'redactSecretLikeString'],
		title: 'Token-like Value Leak Detection',
	},
	traceability: {
		checks:
			'Metadata documentId/phaseId/profileId/canonicalOutput existence; traceability/source section presence; source references on decisions, assumptions, open questions, risks.',
		defaultSeverity: 'warning',
		description:
			'Checks that canonical Markdown documents preserve traceability metadata from the renderer, including document ID, phase ID, profile ID, canonical output path, and source references.',
		doesNotCheck:
			'Source record validity in workspace state, cross-document reference integrity, external link validation.',
		id: 'traceability',
		sourceReferences: [
			'MarkdownMetadataHeader',
			'MarkdownSourceReference',
			'MarkdownTraceabilityReference',
		],
		title: 'Traceability Completeness',
	},
	'unresolved-questions-marking': {
		checks:
			'Unresolved/open question labeling; assumption labeling vs fact presentation; gap markers for incomplete documents.',
		defaultSeverity: 'warning',
		description:
			'Checks that unresolved questions are explicitly marked as unresolved/open and that assumptions are explicitly labeled as assumptions.',
		doesNotCheck:
			'Broad NLP classification of content, factual accuracy of assumptions, question resolution status via AI.',
		id: 'unresolved-questions-marking',
		sourceReferences: [
			'WorkspaceOpenQuestion',
			'WorkspaceAssumption',
			'MarkdownGapMarker',
		],
		title: 'Unresolved Questions and Assumptions Marking',
	},
};

// ---------------------------------------------------------------------------
// Markdown structure parser
// ---------------------------------------------------------------------------

const ATX_HEADING_RE = /^(#{1,6})\s+(.+)$/;
const FRONTMATTER_DELIMITER = '---';

export function parseMarkdownStructure(
	markdown: string,
): MarkdownDocumentStructure {
	const lines = markdown.split('\n');
	const headings: MarkdownHeadingIndex[] = [];
	const metadata = parseFrontmatter(markdown);

	let lineIndex = 0;
	let inFrontmatter = false;
	let frontmatterCloseCount = 0;

	for (const raw of lines) {
		const trimmedStart = raw.trimStart();

		if (lineIndex === 0 && trimmedStart.startsWith(FRONTMATTER_DELIMITER)) {
			inFrontmatter = true;
			lineIndex++;
			continue;
		}

		if (inFrontmatter) {
			if (trimmedStart.startsWith(FRONTMATTER_DELIMITER)) {
				frontmatterCloseCount++;
				if (frontmatterCloseCount >= 1) {
					inFrontmatter = false;
				}
				lineIndex++;
				continue;
			}
			lineIndex++;
			continue;
		}

		const match = ATX_HEADING_RE.exec(trimmedStart);
		if (match?.[1] && match[2]) {
			headings.push({
				level: match[1].length,
				line: lineIndex + 1,
				title: match[2].trim(),
			});
		}

		lineIndex++;
	}

	return { headings, lines, metadata };
}

function findSectionRange(
	structure: MarkdownDocumentStructure,
	sectionTitle: string,
): { startLine: number; endLine: number } | undefined {
	const headingIdx = structure.headings.findIndex(
		(h) => h.title.toLowerCase() === sectionTitle.toLowerCase(),
	);
	if (headingIdx === -1) return undefined;

	const heading = structure.headings[headingIdx];
	if (!heading) return undefined;

	const headingLevel = heading.level;
	const nextHeading =
		structure.headings
			.slice(headingIdx + 1)
			.find((h) => h.level <= headingLevel) ?? undefined;

	const endLine = nextHeading
		? nextHeading.line - 1
		: structure.lines.length + 1;

	return { endLine, startLine: heading.line };
}

function headingExists(
	structure: MarkdownDocumentStructure,
	title: string,
): boolean {
	return structure.headings.some(
		(h) => h.title.toLowerCase() === title.toLowerCase(),
	);
}

function sectionHasContent(
	structure: MarkdownDocumentStructure,
	sectionTitle: string,
): boolean {
	const range = findSectionRange(structure, sectionTitle);
	if (!range) return false;

	const contentLines = structure.lines
		.slice(range.startLine, range.endLine - 1)
		.map((l) => l.trim())
		.filter((l) => l !== '' && !ATX_HEADING_RE.test(l));

	return contentLines.length > 0;
}

function _findHeadingContainingText(
	_structure: MarkdownDocumentStructure,
	text: string,
	headings: MarkdownHeadingIndex[],
): MarkdownHeadingIndex | undefined {
	return headings.find(
		(h) =>
			h.title.toLowerCase().includes(text.toLowerCase()) ||
			text.toLowerCase().includes(h.title.toLowerCase()),
	);
}

// ---------------------------------------------------------------------------
// Lint helpers
// ---------------------------------------------------------------------------

let _orderCounter = 0;

function resetOrderCounter(): void {
	_orderCounter = 0;
}

function nextOrder(): number {
	return _orderCounter++;
}

function addFinding(
	findings: ValidationFinding[],
	params: {
		code: ValidationFindingCode;
		severity: ValidationFindingSeverity;
		message: string;
		documentCanonicalId?: string | undefined;
		phaseId?: string | undefined;
		sourcePath?: string | undefined;
		pointer?: string | undefined;
		expected?: unknown;
		received?: unknown;
		recoveryHint?: string | undefined;
		workspaceRecordId?: string | undefined;
	},
): void {
	const received =
		typeof params.received === 'string'
			? redactSecretLikeString(params.received)
			: params.received;

	const finding = createValidationFinding({
		code: params.code,
		documentCanonicalId: params.documentCanonicalId,
		expected: params.expected,
		location: {
			path: params.sourcePath,
			pointer: params.pointer,
		},
		message: params.message,
		order: nextOrder(),
		phaseId: params.phaseId,
		received,
		recoveryHint: params.recoveryHint
			? { message: params.recoveryHint }
			: undefined,
		severity: params.severity,
		source: {
			kind: params.code.startsWith('document_token')
				? SOURCE_SECRET_SCAN
				: SOURCE_DOCUMENT_LINT,
			path: params.sourcePath,
		},
		workspaceRecordId: params.workspaceRecordId,
	});

	findings.push(finding);
}

// ---------------------------------------------------------------------------
// Rule: Required sections
// ---------------------------------------------------------------------------

function checkRequiredSections(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, descriptor, planItem } = context;
	const documentId = descriptor?.id ?? planItem?.documentCanonicalId ?? '';
	const phaseId = descriptor?.phase ?? planItem?.phaseId ?? '';
	const sourcePath = context.sourcePath ?? descriptor?.id ?? undefined;

	if (!descriptor) return findings;

	const structure = parseMarkdownStructure(markdown);
	const requiredSections = descriptor.sections.filter(
		(s) => s.required !== false,
	);
	const seenSectionIds = new Set<string>();

	for (const section of requiredSections) {
		const sectionId = section.id;
		const sectionTitle = section.title;

		if (seenSectionIds.has(sectionId)) {
			addFinding(findings, {
				code: 'document_duplicate_required_section',
				documentCanonicalId: documentId,
				expected: 'Single required section instance per descriptor',
				message: `Duplicate required section "${section.title}" (${sectionId}) found in descriptor.`,
				phaseId,
				pointer: `sections[${sectionId}]`,
				recoveryHint:
					'Remove the duplicate section declaration from the descriptor.',
				severity: 'warning',
				sourcePath,
			});
		}
		seenSectionIds.add(sectionId);

		const exists = headingExists(structure, sectionTitle);
		if (!exists) {
			addFinding(findings, {
				code: 'document_missing_required_section',
				documentCanonicalId: documentId,
				expected: `Section heading "## ${section.title}" or equivalent`,
				message: `Required section "${section.title}" (${sectionId}) is missing from the canonical document.`,
				phaseId,
				pointer: `## ${sectionTitle}`,
				recoveryHint: `Add the required section heading "${section.title}" to the document or re-generate.`,
				severity: 'error',
				sourcePath,
			});
			continue;
		}

		const hasContent = sectionHasContent(structure, sectionTitle);
		if (!hasContent) {
			addFinding(findings, {
				code: 'document_empty_required_section',
				documentCanonicalId: documentId,
				expected: 'Non-empty section with substantive content',
				message: `Required section "${section.title}" (${sectionId}) exists but has no meaningful content.`,
				phaseId,
				pointer: `## ${sectionTitle}`,
				received: '[empty section or heading only]',
				recoveryHint: `Populate section "${section.title}" with content or mark it with an explicit gap marker.`,
				severity: 'warning',
				sourcePath,
			});
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Rule: Traceability
// ---------------------------------------------------------------------------

function checkTraceability(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, renderResult, planItem, descriptor } = context;
	const documentId =
		descriptor?.id ??
		planItem?.documentCanonicalId ??
		renderResult?.documentCanonicalId ??
		'';
	const phaseId =
		descriptor?.phase ?? planItem?.phaseId ?? renderResult?.phaseId ?? '';
	const sourcePath = context.sourcePath;

	const structure = parseMarkdownStructure(markdown);
	const metadata = structure.metadata;

	if (!metadata?.parsedSuccessfully) {
		addFinding(findings, {
			code: 'document_missing_metadata',
			documentCanonicalId: documentId,
			expected: 'Valid YAML frontmatter with metadata',
			message: 'Document frontmatter metadata is missing or unparseable.',
			phaseId,
			pointer: 'frontmatter',
			received: metadata?.parseErrors?.join(', ') ?? 'no frontmatter',
			recoveryHint:
				'Re-generate the canonical document to produce valid frontmatter.',
			severity: 'error',
			sourcePath,
		});
		return findings;
	}

	const m = metadata.metadata;

	if (!m.documentId) {
		addFinding(findings, {
			code: 'document_missing_traceability',
			documentCanonicalId: '',
			expected: 'Non-empty documentId',
			message: 'Document ID is missing from frontmatter metadata.',
			phaseId,
			pointer: 'frontmatter.documentId',
			recoveryHint: 'Re-generate the canonical document.',
			severity: 'error',
			sourcePath,
		});
	}

	if (!m.phaseId) {
		addFinding(findings, {
			code: 'document_missing_traceability',
			documentCanonicalId: documentId,
			expected: 'Non-empty phaseId',
			message: 'Phase ID is missing from frontmatter metadata.',
			phaseId,
			pointer: 'frontmatter.phaseId',
			recoveryHint: 'Re-generate the canonical document.',
			severity: 'error',
			sourcePath,
		});
	}

	if (!m.profileId) {
		addFinding(findings, {
			code: 'document_missing_traceability',
			documentCanonicalId: documentId,
			expected: 'Non-empty profileId',
			message: 'Profile ID is missing from frontmatter metadata.',
			phaseId,
			pointer: 'frontmatter.profileId',
			recoveryHint: 'Re-generate the canonical document.',
			severity: 'warning',
			sourcePath,
		});
	}

	if (!m.canonicalOutput) {
		addFinding(findings, {
			code: 'document_missing_traceability',
			documentCanonicalId: documentId,
			expected: 'Non-empty canonicalOutput path',
			message: 'Canonical output path is missing from frontmatter metadata.',
			phaseId,
			pointer: 'frontmatter.canonicalOutput',
			recoveryHint: 'Re-generate the canonical document.',
			severity: 'warning',
			sourcePath,
		});
	}

	const hasSourceSection = headingExists(structure, 'Sources & Traceability');
	if (!hasSourceSection && renderResult) {
		addFinding(findings, {
			code: 'document_missing_traceability',
			documentCanonicalId: documentId,
			expected: 'Sources & Traceability section heading',
			message:
				'Expected Sources & Traceability section is not present in the canonical document body.',
			phaseId,
			pointer: '## Sources & Traceability',
			recoveryHint: 'Re-generate the document with the standard renderer.',
			severity: 'info',
			sourcePath,
		});
	}

	if (renderResult) {
		for (const source of renderResult.sources) {
			if (!source.recordId) {
				addFinding(findings, {
					code: 'document_missing_source_reference',
					documentCanonicalId: documentId,
					expected: 'Valid recordId',
					message: `Source reference for record type "${source.recordType}" is missing a record ID.`,
					phaseId,
					pointer: `sources[${source.recordType}]`,
					recoveryHint:
						'Ensure all source records have valid IDs in workspace state.',
					severity: 'warning',
					sourcePath,
				});
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Rule: Unresolved questions and assumptions marking
// ---------------------------------------------------------------------------

const UNRESOLVED_KEYWORDS = [
	'unresolved',
	'open',
	'pending',
	'tbd',
	'to be determined',
];
const QUESTION_SECTION_WORDS = ['question', 'unresolved', 'open question'];
const ASSUMPTION_SECTION_WORDS = ['assumption'];
const NO_QUESTIONS_REGEX = /no\s+(unresolved|open)\s+questions/i;
const NO_ASSUMPTIONS_REGEX = /no\s+assumptions/i;
const ASSUMPTION_LIKE_REGEX =
	/\b(we assume|it is assumed|assuming that|assumes|assumed that)\b/i;
const QUESTION_LIKE_REGEX =
	/\b(is it|should we|can we|will it|does it|how do we|what is the|who will|where will|when will|why do)\b/i;

function checkUnresolvedQuestionsAndAssumptionsMarking(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, renderResult, descriptor } = context;
	const documentId = descriptor?.id ?? renderResult?.documentCanonicalId ?? '';
	const phaseId = descriptor?.phase ?? renderResult?.phaseId ?? '';
	const sourcePath = context.sourcePath;

	const structure = parseMarkdownStructure(markdown);
	const metadata = structure.metadata;

	if (!metadata?.parsedSuccessfully) return findings;

	const textBelowFrontmatter = metadata.contentAfterFrontmatter;
	const lines = textBelowFrontmatter.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const line = raw.trim();
		const lineNum = i + 1 + 2;

		if (ASSUMPTION_LIKE_REGEX.test(line)) {
			const inAssumptionsSection = isLineInSection(
				structure,
				lineNum,
				ASSUMPTION_SECTION_WORDS,
			);
			if (!inAssumptionsSection) {
				addFinding(findings, {
					code: 'document_assumption_unlabeled',
					documentCanonicalId: documentId,
					expected: 'Assumptions in an "Assumptions" section',
					message: `Text appears assumption-like ("${line.slice(0, 80)}...") outside of an explicitly labeled Assumptions section.`,
					phaseId,
					pointer: `line ${lineNum}`,
					received: line.slice(0, 120),
					recoveryHint:
						'Move assumption-like content into the Assumptions section.',
					severity: 'warning',
					sourcePath,
				});
			}
		}

		if (QUESTION_LIKE_REGEX.test(line)) {
			const inQuestionSection = isLineInSection(
				structure,
				lineNum,
				QUESTION_SECTION_WORDS,
			);
			if (!inQuestionSection) {
				const marked = UNRESOLVED_KEYWORDS.some((kw) =>
					line.toLowerCase().includes(kw),
				);
				if (!marked) {
					addFinding(findings, {
						code: 'document_unresolved_question_unmarked',
						documentCanonicalId: documentId,
						expected:
							'Unresolved questions in an "Unresolved Questions" section',
						message: `Question-like text ("${line.slice(0, 80)}...") found outside of an unresolved/open question section.`,
						phaseId,
						pointer: `line ${lineNum}`,
						received: line.slice(0, 120),
						recoveryHint:
							'Move question-like content into the Unresolved Questions section or mark it as resolved.',
						severity: 'info',
						sourcePath,
					});
				}
			}
		}
	}

	if (renderResult) {
		const gaps = renderResult.gaps ?? [];
		const hasGaps = gaps.length > 0;
		const hasGapHeading = headingExists(
			structure,
			'Gaps & Incomplete Sections',
		);

		if (hasGaps && !hasGapHeading) {
			addFinding(findings, {
				code: 'document_gap_unmarked',
				documentCanonicalId: documentId,
				expected: 'Gaps & Incomplete Sections heading',
				message:
					'Document has generation gaps but no "Gaps & Incomplete Sections" heading.',
				phaseId,
				pointer: '## Gaps & Incomplete Sections',
				recoveryHint: 'Re-generate the document to include gap markers.',
				severity: 'warning',
				sourcePath,
			});
		}
	}

	return findings;
}

function isLineInSection(
	structure: MarkdownDocumentStructure,
	lineNum: number,
	sectionWords: string[],
): boolean {
	const headings = structure.headings;
	for (const h of headings) {
		const headingTitle = h.title.toLowerCase();
		const isMatch = sectionWords.some((w) =>
			headingTitle.includes(w.toLowerCase()),
		);
		if (!isMatch) continue;

		const range = findSectionRange(structure, h.title);
		if (!range) continue;

		if (lineNum > range.startLine && lineNum < range.endLine) {
			return true;
		}
	}
	return false;
}

// ---------------------------------------------------------------------------
// Rule: Evidence boundary
// ---------------------------------------------------------------------------

const UNSUPPORTED_CLAIM_PATTERNS: Array<{
	regex: RegExp;
	label: string;
	kind: string;
}> = [
	{
		kind: 'validation',
		label: 'validation/proof',
		regex: /\b(validated|proven|confirmed by users?)\b/i,
	},
	{
		kind: 'market',
		label: 'market validation',
		regex: /\b(market validated|product-market fit confirmed)\b/i,
	},
	{
		kind: 'legal',
		label: 'legal/compliance',
		regex:
			/\b(legally compliant|GDPR compliant|HIPAA compliant|SOC2 certified|PCI compliant)\b/i,
	},
	{
		kind: 'security',
		label: 'security audit',
		regex:
			/\b(security audited|pen tested|penetration tested|security reviewed)\b/i,
	},
	{
		kind: 'prod',
		label: 'production readiness',
		regex: /\b(production ready|battle tested|enterprise grade)\b/i,
	},
	{
		kind: 'research',
		label: 'user research',
		regex: /\b(user research confirms|user interviews show|users validated)\b/i,
	},
];

const EVIDENCE_REFERENCE_REGEX =
	/\b(evidence|source|reference|log|record|study|interview|test|experiment)\b/i;

function checkEvidenceBoundary(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, descriptor } = context;
	const documentId = descriptor?.id ?? '';
	const phaseId = descriptor?.phase ?? '';
	const sourcePath = context.sourcePath;

	const structure = parseMarkdownStructure(markdown);
	if (!structure.metadata?.parsedSuccessfully) return findings;

	const body = structure.metadata.contentAfterFrontmatter;
	const lines = body.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;

		const lineNum = i + 1 + 2;

		for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
			if (pattern.regex.test(line)) {
				const hasEvidenceRef = EVIDENCE_REFERENCE_REGEX.test(
					lines
						.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
						.join(' '),
				);

				if (!hasEvidenceRef) {
					const matches = line.match(pattern.regex);
					const matchText = matches?.[0] ?? line.slice(0, 80);

					const isInStatusSection = isLineInSection(structure, lineNum, [
						'Document Status',
						'status',
					]);

					const isLocalToolStatus =
						isInStatusSection &&
						/status/i.test(matchText) &&
						!/validated|proven|confirmed|compliant|audited|certified|enterprise/i.test(
							matchText,
						);

					if (isLocalToolStatus) continue;

					addFinding(findings, {
						code: 'document_unsupported_validation_claim',
						documentCanonicalId: documentId,
						expected: 'Explicit evidence/source/log reference with claim',
						message: `Document claims ${pattern.label} ("${matchText}") without a visible evidence/source reference nearby.`,
						phaseId,
						pointer: `line ${lineNum}`,
						received: line.slice(0, 200),
						recoveryHint: `Reference supporting evidence (log, decision, experiment) or soften the claim.`,
						severity: 'warning',
						sourcePath,
					});
				}
				break;
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Rule: Derived artifact boundary
// ---------------------------------------------------------------------------

const DERIVED_ARTIFACT_KEYWORDS = [
	'html',
	'agent pack',
	'executive',
	'executive overview',
	'agent report',
	'executive summary',
];

const CANONICAL_CLAIM_REGEX =
	/\b(canonical|source of truth|definitive|authoritative|official record)\b/i;
const DERIVED_LABEL_REGEX =
	/\b(derived|non-canonical|generated from|compiled from|export)\b/i;

function checkDerivedArtifactBoundary(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, descriptor } = context;
	const documentId = descriptor?.id ?? '';
	const phaseId = descriptor?.phase ?? '';
	const sourcePath = context.sourcePath;

	const structure = parseMarkdownStructure(markdown);
	if (!structure.metadata?.parsedSuccessfully) return findings;

	const body = structure.metadata.contentAfterFrontmatter;
	const lines = body.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;

		const lineNum = i + 1 + 2;
		const lowerLine = line.toLowerCase();

		const mentionsDerived = DERIVED_ARTIFACT_KEYWORDS.some((kw) =>
			lowerLine.includes(kw),
		);
		if (!mentionsDerived) continue;

		if (CANONICAL_CLAIM_REGEX.test(line)) {
			const isCanonicalMarkdownLine =
				lowerLine.includes('canonical markdown') ||
				lowerLine.includes('canonical document') ||
				lowerLine.includes('this document');
			if (!isCanonicalMarkdownLine) {
				addFinding(findings, {
					code: 'document_derived_artifact_boundary_violation',
					documentCanonicalId: documentId,
					expected: 'Derived artifact labeled as derived/non-canonical',
					message: `Derived artifact (${DERIVED_ARTIFACT_KEYWORDS.find((k) => lowerLine.includes(k)) ?? 'detected'}) is described as canonical/source-of-truth: "${line.slice(0, 120)}"`,
					phaseId,
					pointer: `line ${lineNum}`,
					received: line.slice(0, 200),
					recoveryHint:
						'Label derived artifacts as "derived" or "non-canonical" and refer to canonical Markdown as the source of truth.',
					severity: 'error',
					sourcePath,
				});
			}
		}

		if (!DERIVED_LABEL_REGEX.test(line)) {
			const inOutputsSection = isLineInSection(structure, lineNum, [
				'output',
				'artifact',
			]);
			if (inOutputsSection) {
				addFinding(findings, {
					code: 'document_derived_artifact_mislabeled',
					documentCanonicalId: documentId,
					expected:
						'Label such as "derived", "non-canonical", or "generated from canonical"',
					message: `Derived artifact reference ("${line.slice(0, 100)}") does not include a derived/non-canonical label.`,
					phaseId,
					pointer: `line ${lineNum}`,
					received: line.slice(0, 200),
					recoveryHint:
						'Add "(derived/non-canonical)" label when mentioning derived artifacts.',
					severity: 'warning',
					sourcePath,
				});
			}
		}
	}

	if (structure.metadata?.metadata?.nonCanonicalArtifacts) {
		for (const artifact of structure.metadata.metadata.nonCanonicalArtifacts) {
			if (CANONICAL_CLAIM_REGEX.test(artifact)) {
				addFinding(findings, {
					code: 'document_derived_artifact_boundary_violation',
					documentCanonicalId: documentId,
					expected: 'Non-canonical artifacts without canonical claims',
					message: `Non-canonical artifact "${artifact}" contains a canonical claim in metadata.`,
					phaseId,
					pointer: 'frontmatter.nonCanonicalArtifacts',
					received: artifact,
					recoveryHint:
						'Remove canonical/authoritative language from non-canonical artifact metadata.',
					severity: 'error',
					sourcePath,
				});
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Rule: Token leak
// ---------------------------------------------------------------------------

const BEARER_REGEX = /\bBearer\s+([A-Za-z0-9\-_=+/]{10,})\b/g;
const API_KEY_REGEXES: Array<{ regex: RegExp; label: string }> = [
	{ label: 'OpenAI-style key', regex: /sk-[a-zA-Z0-9]{20,}/g },
	{ label: 'OpenAI project key', regex: /sk-[a-zA-Z0-9\-_]{20,}/g },
	{ label: 'Groq-style key', regex: /gsk_[a-zA-Z0-9]{20,}/g },
	{ label: 'HuggingFace key', regex: /hf_[a-zA-Z0-9]{20,}/g },
	{ label: 'Slack token', regex: /xox[bprs]-[a-zA-Z0-9-]{10,}/g },
];

const ENV_VAR_REFERENCE_REGEX = /`[A-Z_]+`|`\$[A-Z_]+`|\$\{[A-Z_]+\}/g;

function _extractEnvVarReferences(line: string): string[] {
	const refs: string[] = [];
	const regex = new RegExp(ENV_VAR_REFERENCE_REGEX.source, 'g');

	let match = regex.exec(line);
	while (match !== null) {
		refs.push(match[0]);
		match = regex.exec(line);
	}
	return refs;
}

function checkTokenLeaks(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, descriptor } = context;
	const documentId = descriptor?.id ?? '';
	const phaseId = descriptor?.phase ?? '';
	const sourcePath = context.sourcePath;

	const structure = parseMarkdownStructure(markdown);
	if (!structure.metadata) return findings;

	const fullMarkdown = markdown;
	const lines = fullMarkdown.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const line = raw;
		const lineNum = i + 1;

		if (line.includes('OPENAI_API_KEY') && !line.includes('=')) {
			const trimmed = line.trim();
			if (
				trimmed.includes('`OPENAI_API_KEY`') ||
				trimmed.includes('$OPENAI_API_KEY') ||
				(/\bOPENAI_API_KEY\b/.test(trimmed) &&
					!looksLikeSecretLikeValue(trimmed))
			) {
				continue;
			}
		}

		if (BEARER_REGEX.test(line)) {
			BEARER_REGEX.lastIndex = 0;
			const _match = BEARER_REGEX.exec(line);
			BEARER_REGEX.lastIndex = 0;
			addFinding(findings, {
				code: 'document_token_like_value',
				documentCanonicalId: documentId,
				expected: 'No raw bearer tokens',
				message: `Bearer authorization token detected in document`,
				phaseId,
				pointer: `line ${lineNum}`,
				received: '[redacted-secret-like-value]',
				recoveryHint: 'Remove raw bearer tokens from document content.',
				severity: 'error',
				sourcePath,
			});
		}

		for (const pattern of API_KEY_REGEXES) {
			if (pattern.regex.test(line)) {
				pattern.regex.lastIndex = 0;
				addFinding(findings, {
					code: 'document_token_like_value',
					documentCanonicalId: documentId,
					expected: 'No raw API keys',
					message: `${pattern.label} detected in document`,
					phaseId,
					pointer: `line ${lineNum}`,
					received: '[redacted-secret-like-value]',
					recoveryHint: 'Remove raw API key values from document content.',
					severity: 'error',
					sourcePath,
				});
			}
		}

		if (
			line.length > 60 &&
			/[A-Za-z0-9+/]{40,}/.test(line) &&
			looksLikeSecretLikeValue(line.trim())
		) {
			addFinding(findings, {
				code: 'document_token_like_value',
				documentCanonicalId: documentId,
				expected: 'No secret-like strings',
				message: 'Long secret-like string detected in document',
				phaseId,
				pointer: `line ${lineNum}`,
				received: '[redacted-secret-like-value]',
				recoveryHint: 'Remove secret-like values from document content.',
				severity: 'error',
				sourcePath,
			});
		}

		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;

		const keyPart = line.slice(0, colonIdx).trim();
		const valuePart = line.slice(colonIdx + 1).trim();

		const isSecretKey =
			/\b(token|api_key|apiKey|secret|password|authorization|bearer|private_key|access_token|refresh_token|client_secret)\b/i.test(
				keyPart,
			);

		if (
			isSecretKey &&
			valuePart.length > 8 &&
			valuePart !== '""' &&
			valuePart !== "''"
		) {
			const isEnvRef =
				ENV_VAR_REFERENCE_REGEX.test(valuePart) ||
				valuePart.startsWith('$') ||
				valuePart.startsWith('${');
			if (!isEnvRef) {
				addFinding(findings, {
					code: 'document_token_like_value',
					documentCanonicalId: documentId,
					expected: 'Environment variable reference or redacted value',
					message: `Secret-like key "${keyPart}" has a non-reference value in document.`,
					phaseId,
					pointer: `line ${lineNum}`,
					received: '[redacted-secret-like-value]',
					recoveryHint:
						'Replace raw value with an environment variable reference.',
					severity: 'error',
					sourcePath,
				});
			}
		}
	}

	if (structure.metadata?.frontmatterRaw) {
		const fmLines = structure.metadata.frontmatterRaw.split('\n');
		for (let i = 0; i < fmLines.length; i++) {
			const rawLine = fmLines[i];
			if (rawLine === undefined) continue;
			const fmLine = rawLine.trim();

			if (boolLooksLikeBearer(fmLine)) {
				addFinding(findings, {
					code: 'document_token_like_value',
					documentCanonicalId: documentId,
					expected: 'No bearer tokens in metadata',
					message: 'Bearer token detected in document frontmatter metadata.',
					phaseId,
					pointer: 'frontmatter',
					received: '[redacted-secret-like-value]',
					recoveryHint:
						'Remove the bearer token from the document frontmatter.',
					severity: 'error',
					sourcePath,
				});
			}
		}
	}

	return findings;
}

function boolLooksLikeBearer(value: string): boolean {
	return /^\s*Bearer\s+/i.test(value);
}

// ---------------------------------------------------------------------------
// Rule: Contradiction
// ---------------------------------------------------------------------------

function checkContradictions(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, descriptor, planItem } = context;
	const documentId = descriptor?.id ?? planItem?.documentCanonicalId ?? '';
	const phaseId = descriptor?.phase ?? planItem?.phaseId ?? '';
	const sourcePath = context.sourcePath;

	const structure = parseMarkdownStructure(markdown);
	const metadata = structure.metadata;

	if (!metadata?.parsedSuccessfully) return findings;

	const m = metadata.metadata;

	if (m.documentId && descriptor?.id && m.documentId !== descriptor.id) {
		addFinding(findings, {
			code: 'document_metadata_id_mismatch',
			documentCanonicalId: documentId,
			expected: descriptor.id,
			message: `Document ID in metadata ("${m.documentId}") does not match descriptor ID ("${descriptor.id}").`,
			phaseId,
			pointer: 'frontmatter.documentId',
			received: m.documentId,
			recoveryHint: 'Re-generate the document with the correct descriptor.',
			severity: 'error',
			sourcePath,
		});
	}

	if (m.profileId && context.profileId && m.profileId !== context.profileId) {
		addFinding(findings, {
			code: 'document_metadata_profile_mismatch',
			documentCanonicalId: documentId,
			expected: context.profileId,
			message: `Profile ID in metadata ("${m.profileId}") does not match active profile ("${context.profileId}").`,
			phaseId,
			pointer: 'frontmatter.profileId',
			received: m.profileId,
			recoveryHint: 'Re-generate the document with the correct profile.',
			severity: 'warning',
			sourcePath,
		});
	}

	if (m.generationStatus === 'generated' || m.generationStatus === 'complete') {
		const requiredSections =
			descriptor?.sections.filter((s) => s.required !== false) ?? [];
		const missingSections = requiredSections.filter(
			(s) => !headingExists(structure, s.title),
		);
		if (missingSections.length > 0) {
			addFinding(findings, {
				code: 'document_status_contradiction',
				documentCanonicalId: documentId,
				expected: `All required sections present for status "${m.generationStatus}"`,
				message: `Document status claims "${m.generationStatus}" but ${missingSections.length} required section(s) are missing: ${missingSections.map((s) => s.title).join(', ')}.`,
				phaseId,
				pointer: 'frontmatter.generationStatus',
				received: `Missing: ${missingSections.map((s) => s.title).join(', ')}`,
				recoveryHint: 'Re-generate or update the document status.',
				severity: 'error',
				sourcePath,
			});
		}
	}

	const noQuestionsMatch = NO_QUESTIONS_REGEX.exec(markdown);
	if (noQuestionsMatch) {
		const hasQuestionItems = headingsWithContent(
			structure,
			QUESTION_SECTION_WORDS,
		);
		if (hasQuestionItems.length > 0) {
			addFinding(findings, {
				code: 'document_section_contradiction',
				documentCanonicalId: documentId,
				expected:
					'Empty Unresolved Questions section or no "no open questions" claim',
				message: `Document says "No open questions" but the Unresolved Questions section contains items.`,
				phaseId,
				pointer: '## Unresolved Questions',
				received: 'Content present in Unresolved Questions section',
				recoveryHint:
					'Remove the "no open questions" claim or resolve the listed questions.',
				severity: 'warning',
				sourcePath,
			});
		}
	}

	const noAssumptionsMatch = NO_ASSUMPTIONS_REGEX.exec(markdown);
	if (noAssumptionsMatch) {
		const hasAssumptionItems = headingsWithContent(
			structure,
			ASSUMPTION_SECTION_WORDS,
		);
		if (hasAssumptionItems.length > 0) {
			addFinding(findings, {
				code: 'document_section_contradiction',
				documentCanonicalId: documentId,
				expected: 'Empty Assumptions section or no "no assumptions" claim',
				message: `Document says "No assumptions" but the Assumptions section contains items.`,
				phaseId,
				pointer: '## Assumptions',
				received: 'Content present in Assumptions section',
				recoveryHint:
					'Remove the "no assumptions" claim or remove assumption items.',
				severity: 'warning',
				sourcePath,
			});
		}
	}

	return findings;
}

function headingsWithContent(
	structure: MarkdownDocumentStructure,
	sectionWords: string[],
): MarkdownHeadingIndex[] {
	return structure.headings.filter((h) => {
		const title = h.title.toLowerCase();
		const isMatch = sectionWords.some((w) => title.includes(w.toLowerCase()));
		if (!isMatch) return false;
		return sectionHasContent(structure, h.title);
	});
}

// ---------------------------------------------------------------------------
// Rule: Plan/status consistency
// ---------------------------------------------------------------------------

function checkPlanStatusConsistency(
	context: DocumentSemanticLintContext,
): ValidationFinding[] {
	const findings: ValidationFinding[] = [];
	const { markdown, planItem, descriptor } = context;
	const documentId = descriptor?.id ?? planItem?.documentCanonicalId ?? '';
	const phaseId = descriptor?.phase ?? planItem?.phaseId ?? '';
	const sourcePath = context.sourcePath;

	if (!planItem) return findings;

	const structure = parseMarkdownStructure(markdown);
	const metadata = structure.metadata;
	if (!metadata?.parsedSuccessfully) return findings;

	const action = planItem.action;
	const hasGaps =
		planItem.gaps.length > 0 ||
		headingExists(structure, 'Gaps & Incomplete Sections');
	const hasCompleteStatus =
		metadata.metadata.generationStatus === 'generated' ||
		metadata.metadata.generationStatus === 'complete';

	switch (action) {
		case 'incomplete':
			if (!hasGaps) {
				addFinding(findings, {
					code: 'document_plan_status_inconsistent',
					documentCanonicalId: documentId,
					expected: 'Explicit gap markers for incomplete documents',
					message: `Plan item status is "incomplete" but the document does not include gap markers.`,
					phaseId,
					pointer: '## Gaps & Incomplete Sections',
					recoveryHint:
						'Re-generate the document or add explicit gap markers for incomplete sections.',
					severity: 'warning',
					sourcePath,
				});
			}
			if (hasCompleteStatus) {
				addFinding(findings, {
					code: 'document_plan_status_inconsistent',
					documentCanonicalId: documentId,
					expected: 'Status consistent with incomplete plan',
					message: `Plan item is "incomplete" but document metadata claims "${metadata.metadata.generationStatus}".`,
					phaseId,
					pointer: 'frontmatter.generationStatus',
					received: metadata.metadata.generationStatus,
					recoveryHint:
						'Update the generation status to reflect the incomplete state.',
					severity: 'error',
					sourcePath,
				});
			}
			break;

		case 'blocked':
			if (hasCompleteStatus) {
				addFinding(findings, {
					code: 'document_plan_status_inconsistent',
					documentCanonicalId: documentId,
					expected: 'Status consistent with blocked plan',
					message: `Plan item is "blocked" but document metadata claims "${metadata.metadata.generationStatus}".`,
					phaseId,
					pointer: 'frontmatter.generationStatus',
					received: metadata.metadata.generationStatus,
					recoveryHint:
						'Update the generation status to reflect the blocked state.',
					severity: 'error',
					sourcePath,
				});
			}
			break;

		case 'failed':
			if (hasCompleteStatus) {
				addFinding(findings, {
					code: 'document_plan_status_inconsistent',
					documentCanonicalId: documentId,
					expected: 'Status consistent with failed plan',
					message: `Plan item is "failed" but document metadata claims "${metadata.metadata.generationStatus}".`,
					phaseId,
					pointer: 'frontmatter.generationStatus',
					received: metadata.metadata.generationStatus,
					recoveryHint:
						'Update the generation status to reflect the failed state.',
					severity: 'error',
					sourcePath,
				});
			}
			break;

		case 'stale':
			if (!headingExists(structure, 'Staleness')) {
				const hasStaleInMetadata =
					metadata.metadata.generationStatus === 'stale';
				const hasStalePlan = action === 'stale';

				if (hasStalePlan && !hasStaleInMetadata) {
					addFinding(findings, {
						code: 'document_stale_unmarked',
						documentCanonicalId: documentId,
						expected: 'Staleness warning in metadata or document body',
						message: `Plan item is "stale" but the document does not include a staleness warning.`,
						phaseId,
						pointer: 'frontmatter.generationStatus',
						recoveryHint:
							'Re-generate the document or add a staleness warning.',
						severity: 'warning',
						sourcePath,
					});
				}
			}
			break;

		case 'generate':
		case 'update': {
			const requiredSections =
				descriptor?.sections.filter((s) => s.required !== false) ?? [];
			const missingSections = requiredSections.filter(
				(s) => !headingExists(structure, s.title),
			);
			if (missingSections.length > 0 && hasCompleteStatus) {
				addFinding(findings, {
					code: 'document_plan_status_inconsistent',
					documentCanonicalId: documentId,
					expected: 'All required sections present',
					message: `Plan action is "${action}" but ${missingSections.length} required section(s) are missing.`,
					phaseId,
					pointer: '## document body',
					received: `Missing: ${missingSections.map((s) => s.title).join(', ')}`,
					recoveryHint:
						'Re-generate the document to include all required sections.',
					severity: 'error',
					sourcePath,
				});
			}
			break;
		}

		default:
			break;
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Rule executor
// ---------------------------------------------------------------------------

function runRule(
	ruleId: DocumentSemanticLintRuleId,
	context: DocumentSemanticLintContext,
): DocumentSemanticLintRuleResult {
	let findings: ValidationFinding[] = [];

	switch (ruleId) {
		case 'required-sections':
			findings = checkRequiredSections(context);
			break;
		case 'traceability':
			findings = checkTraceability(context);
			break;
		case 'unresolved-questions-marking':
			findings = checkUnresolvedQuestionsAndAssumptionsMarking(context);
			break;
		case 'evidence-boundary':
			findings = checkEvidenceBoundary(context);
			break;
		case 'derived-artifact-boundary':
			findings = checkDerivedArtifactBoundary(context);
			break;
		case 'token-leak':
			findings = checkTokenLeaks(context);
			break;
		case 'contradiction':
			findings = checkContradictions(context);
			break;
		case 'plan-status':
			findings = checkPlanStatusConsistency(context);
			break;
	}

	return { findings, ruleId };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSemanticLintRules(_options?: {
	ruleIds?: DocumentSemanticLintRuleId[];
}): DocumentSemanticLintRule[] {
	const ruleIds =
		_options?.ruleIds ??
		(Object.keys(SEMANTIC_LINT_RULE_REGISTRY) as DocumentSemanticLintRuleId[]);
	return ruleIds
		.map((id) => SEMANTIC_LINT_RULE_REGISTRY[id])
		.filter((r): r is DocumentSemanticLintRule => r !== undefined);
}

export function lintCanonicalMarkdownDocument(
	input: DocumentSemanticLintInput,
	options: DocumentSemanticLintOptions = {},
): DocumentSemanticLintResult {
	resetOrderCounter();

	const ruleIds =
		options.ruleIds ??
		(Object.keys(SEMANTIC_LINT_RULE_REGISTRY) as DocumentSemanticLintRuleId[]);

	const context: DocumentSemanticLintContext = {
		descriptor: input.descriptor,
		markdown: input.markdown,
		parsedMetadata: parseFrontmatter(input.markdown),
		planItem: input.planItem,
		profileId: input.profileId,
		renderResult: input.renderResult,
		sourcePath: input.sourcePath,
	};

	const ruleResults: DocumentSemanticLintRuleResult[] = [];
	const allFindings: ValidationFinding[] = [];
	let documentCanonicalId = '';
	let phaseId = '';

	for (const ruleId of ruleIds) {
		const result = runRule(ruleId, context);
		ruleResults.push(result);
		allFindings.push(...result.findings);
		if (!documentCanonicalId && result.findings.length > 0) {
			documentCanonicalId = result.findings[0]?.documentCanonicalId ?? '';
			phaseId = result.findings[0]?.phaseId ?? '';
		}
	}

	if (!documentCanonicalId) {
		documentCanonicalId =
			input.descriptor?.id ??
			input.renderResult?.documentCanonicalId ??
			input.planItem?.documentCanonicalId ??
			context.parsedMetadata?.metadata?.documentId ??
			'';
		phaseId =
			input.descriptor?.phase ??
			input.renderResult?.phaseId ??
			input.planItem?.phaseId ??
			context.parsedMetadata?.metadata?.phaseId ??
			'';
	}

	const sortedFindings = sortValidationFindings(allFindings);
	const summary = summarizeValidationFindings(sortedFindings);
	const gate = determineValidationGateStatus(sortedFindings);

	return {
		changedPaths: [],
		checkedAt: options.checkedAt,
		documentCanonicalId,
		findings: sortedFindings,
		gate,
		phaseId,
		profileId: input.profileId,
		readOnly: true,
		ruleResults,
		rulesChecked: ruleIds,
		sourcePath: input.sourcePath,
		summary,
	};
}

export function lintCanonicalMarkdownDocuments(
	inputs: DocumentSemanticLintInput[],
	options: DocumentSemanticLintOptions = {},
): ValidationRunResult {
	const allFindings: ValidationFinding[] = [];
	const documentsLinted: string[] = [];
	const rulesCheckedSet = new Set<DocumentSemanticLintRuleId>();

	for (const input of inputs) {
		const result = lintCanonicalMarkdownDocument(input, options);
		allFindings.push(...result.findings);
		documentsLinted.push(result.documentCanonicalId);
		for (const r of result.rulesChecked) {
			rulesCheckedSet.add(r);
		}
	}

	const sortedFindings = sortValidationFindings(allFindings);
	const summary = summarizeValidationFindings(sortedFindings);
	const scopes: ValidationScope[] = ['outputs'];

	return {
		changedPaths: [],
		diagnostics: [],
		documentationRoot: undefined,
		dryRun: true,
		findings: sortedFindings,
		projectRoot: undefined,
		readOnly: true,
		scopesChecked: scopes,
		status: determineValidationGateStatus(sortedFindings),
		summary,
		validatedProfileId: undefined,
		workspacePath: undefined,
	};
}

export { SEMANTIC_LINT_RULE_REGISTRY };
