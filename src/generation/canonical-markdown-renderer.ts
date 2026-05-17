/** Canonical Markdown Renderer — deterministic Markdown string generation */

import type { DocumentDescriptorSection } from '../profiles/document-descriptor.js';
import type {
	WorkspaceAssumption,
	WorkspaceDecision,
	WorkspaceOpenQuestion,
	WorkspaceRisk,
	WorkspaceState,
} from '../state/workspace-state.schema.js';
import type {
	GenerationPlan,
	GenerationPlanItem,
} from './generation-planner-types.js';
import type {
	CanonicalMarkdownRenderDiagnostic,
	CanonicalMarkdownRenderInput,
	CanonicalMarkdownRenderOptions,
	CanonicalMarkdownRenderResult,
	ConfirmedStateCollections,
	MarkdownGapMarker,
	MarkdownLanguagePolicy,
	MarkdownMetadataHeader,
	MarkdownQualityNote,
	MarkdownSectionRenderStatus,
	MarkdownSourceReference,
	MarkdownTraceabilityReference,
	RenderedMarkdownSection,
	SectionRenderContext,
} from './markdown-renderer-types.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RENDERED_BY = 'logos-engine (canonical-markdown-renderer)';
const _RENDERER_VERSION = '0.1.0';
const DEFAULT_LANGUAGE: MarkdownLanguagePolicy = {
	enforceEnglish: true,
	language: 'en',
};

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------

function escapeHeadingValue(value: string): string {
	return value.replace(/\n/g, ' ').replace(/^[#]+/, '').trim();
}

function escapeTableCell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function _escapeListValue(value: string): string {
	return value.replace(/^\s*[-*+]\s*/, '').trim();
}

function _escapeFrontmatterValue(value: string): string {
	const escaped = value
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
	return `"${escaped}"`;
}

function _escapeCodeFence(value: string): string {
	return value.replace(/```/g, '` ` `');
}

function looksLikeDangerousInput(value: string): boolean {
	const lower = value.toLowerCase();
	if (/<script/i.test(value)) return true;
	if (/<iframe/i.test(value)) return true;
	if (/<object/i.test(value)) return true;
	if (/<embed/i.test(value)) return true;
	if (/on\w+\s*=/i.test(value)) return true;
	if (/javascript:/i.test(value)) return true;
	if (lower.includes('sk-') && value.length > 30) return true;
	if (lower.includes('bearer ') && value.length > 30) return true;
	if (lower.includes('basic ') && value.length > 30) return true;
	return false;
}

function sanitizeForMarkdown(value: string): string {
	if (looksLikeDangerousInput(value)) {
		return '[redacted]';
	}
	return value;
}

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: CanonicalMarkdownRenderDiagnostic['severity'],
	message: string,
	documentId?: string,
	sourcePath?: string,
	fieldPointer?: string,
	recoveryHint?: string,
): CanonicalMarkdownRenderDiagnostic {
	const d: CanonicalMarkdownRenderDiagnostic = { code, message, severity };
	if (documentId !== undefined) d.documentId = documentId;
	if (sourcePath !== undefined) d.sourcePath = sourcePath;
	if (fieldPointer !== undefined) d.fieldPointer = fieldPointer;
	if (recoveryHint !== undefined) d.recoveryHint = recoveryHint;
	return d;
}

function createGap(
	code: string,
	message: string,
	sectionId?: string,
	inputId?: string,
	sourceDocumentId?: string,
	recoveryHint?: string,
): MarkdownGapMarker {
	const g: MarkdownGapMarker = { code, message };
	if (sectionId !== undefined) g.sectionId = sectionId;
	if (inputId !== undefined) g.inputId = inputId;
	if (sourceDocumentId !== undefined) g.sourceDocumentId = sourceDocumentId;
	if (recoveryHint !== undefined) g.recoveryHint = recoveryHint;
	return g;
}

function createSourceRef(
	recordId: string,
	recordType: MarkdownSourceReference['recordType'],
	sourceProposalId?: string,
	sourceAnswerId?: string,
	sourceSessionId?: string,
	sourceQuestionId?: string,
	sourceDocumentId?: string,
	sourcePhaseId?: string,
): MarkdownSourceReference {
	const s: MarkdownSourceReference = { recordId, recordType };
	if (sourceProposalId !== undefined) s.sourceProposalId = sourceProposalId;
	if (sourceAnswerId !== undefined) s.sourceAnswerId = sourceAnswerId;
	if (sourceSessionId !== undefined) s.sourceSessionId = sourceSessionId;
	if (sourceQuestionId !== undefined) s.sourceQuestionId = sourceQuestionId;
	if (sourceDocumentId !== undefined) s.sourceDocumentId = sourceDocumentId;
	if (sourcePhaseId !== undefined) s.sourcePhaseId = sourcePhaseId;
	return s;
}

function traceRefFromSource(
	s: MarkdownSourceReference,
): MarkdownTraceabilityReference {
	const t: MarkdownTraceabilityReference = {
		recordType: s.recordType,
		workspaceRecordId: s.recordId,
	};
	if (s.sourceProposalId !== undefined) t.sourceProposalId = s.sourceProposalId;
	if (s.sourceAnswerId !== undefined) t.sourceAnswerId = s.sourceAnswerId;
	if (s.sourceSessionId !== undefined) t.sourceSessionId = s.sourceSessionId;
	if (s.sourceQuestionId !== undefined) t.sourceQuestionId = s.sourceQuestionId;
	if (s.sourceDocumentId !== undefined) t.sourceDocumentId = s.sourceDocumentId;
	if (s.sourcePhaseId !== undefined) t.sourcePhaseId = s.sourcePhaseId;
	return t;
}

// ---------------------------------------------------------------------------
// Confirmed state collection
// ---------------------------------------------------------------------------

function collectConfirmedState(
	planItem: GenerationPlanItem,
	state: WorkspaceState,
): ConfirmedStateCollections {
	const confirmedDecisions = state.decisions.filter(
		(d) =>
			d.status === 'confirmed' && planItem.confirmedDecisionIds.includes(d.id),
	);
	const confirmedAssumptions = state.assumptions.filter(
		(a) =>
			a.status === 'active' && planItem.confirmedAssumptionIds.includes(a.id),
	);
	const unresolvedQuestions = state.openQuestions.filter(
		(q) => q.status === 'open' && planItem.unresolvedQuestionIds.includes(q.id),
	);
	const relatedRisks = state.risks.filter((r) =>
		planItem.relatedRiskIds.includes(r.id),
	);
	const acceptedProposals = state.proposals.filter(
		(p) =>
			p.status === 'accepted' &&
			p.sourceDocumentCanonicalId === planItem.documentCanonicalId,
	);
	const proposedProposals = state.proposals.filter(
		(p) =>
			p.status === 'proposed' &&
			p.sourceDocumentCanonicalId === planItem.documentCanonicalId,
	);
	return {
		acceptedProposals,
		confirmedAssumptions,
		confirmedDecisions,
		proposedProposals,
		relatedRisks,
		unresolvedQuestions,
	};
}

// ---------------------------------------------------------------------------
// Plan item status gate
// ---------------------------------------------------------------------------

function checkPlanItemStatus(
	planItem: GenerationPlanItem,
	options: CanonicalMarkdownRenderOptions,
	diagnostics: CanonicalMarkdownRenderDiagnostic[],
): 'render' | 'partial' | 'blocked' | 'failed' | 'diagnostic_only' {
	switch (planItem.action) {
		case 'generate':
		case 'update':
		case 'incomplete':
			return 'render';
		case 'stale':
			return 'render';
		case 'blocked':
			if (options.allowBlockedPreview) return 'partial';
			diagnostics.push(
				createDiagnostic(
					'E_MDR_BLOCKED_DOCUMENT',
					'warning',
					`Document "${planItem.documentCanonicalId}" is blocked and cannot be fully rendered`,
					planItem.documentCanonicalId,
					planItem.descriptorSourcePath,
					undefined,
					'Resolve blockers and re-plan before rendering',
				),
			);
			return 'blocked';
		case 'failed':
			if (options.allowFailedPreview) return 'diagnostic_only';
			diagnostics.push(
				createDiagnostic(
					'E_MDR_FAILED_DOCUMENT',
					'error',
					`Document "${planItem.documentCanonicalId}" has failed and cannot be rendered`,
					planItem.documentCanonicalId,
					planItem.descriptorSourcePath,
					undefined,
					'Fix document descriptor issues first',
				),
			);
			return 'failed';
		case 'skip':
			if (options.allowSkipPreview) return 'render';
			diagnostics.push(
				createDiagnostic(
					'E_MDR_SKIPPED_DOCUMENT',
					'info',
					`Document "${planItem.documentCanonicalId}" plan status is skip; rendering not requested`,
					planItem.documentCanonicalId,
				),
			);
			return 'diagnostic_only';
	}
}

// ---------------------------------------------------------------------------
// Metadata header builder
// ---------------------------------------------------------------------------

function buildMetadataHeader(
	input: CanonicalMarkdownRenderInput,
	options: CanonicalMarkdownRenderOptions,
	sources: MarkdownSourceReference[],
): MarkdownMetadataHeader {
	return {
		canonicalOutput: input.planItem.canonicalOutputPath,
		documentId: input.documentDescriptor.id,
		generatedAt: options.generatedAt ?? new Date().toISOString(),
		generatedBy: options.renderedBy ?? DEFAULT_RENDERED_BY,
		generationStatus: input.planItem.action,
		phaseId: input.documentDescriptor.phaseId,
		profileId: input.profileId,
		sourceStateSchemaVersion: input.schemaVersion,
		traceability: sources.map(traceRefFromSource),
	};
}

// ---------------------------------------------------------------------------
// YAML frontmatter builder
// ---------------------------------------------------------------------------

function buildYamlFrontmatter(metadata: MarkdownMetadataHeader): string {
	const lines: string[] = ['---'];

	lines.push(`documentId: ${escapeTableCell(metadata.documentId)}`);
	lines.push(`phaseId: ${escapeTableCell(metadata.phaseId)}`);
	lines.push(`profileId: ${escapeTableCell(metadata.profileId)}`);
	lines.push(`canonicalOutput: ${escapeTableCell(metadata.canonicalOutput)}`);
	lines.push(`generatedBy: ${escapeTableCell(metadata.generatedBy)}`);
	lines.push(`generatedAt: ${escapeTableCell(metadata.generatedAt)}`);
	lines.push(`generationStatus: ${metadata.generationStatus}`);
	lines.push(
		`sourceStateSchemaVersion: ${escapeTableCell(metadata.sourceStateSchemaVersion)}`,
	);

	if (metadata.traceability !== undefined && metadata.traceability.length > 0) {
		lines.push('traceability:');
		for (const t of metadata.traceability) {
			lines.push(`  - recordId: ${escapeTableCell(t.workspaceRecordId)}`);
			lines.push(`    recordType: ${t.recordType}`);
			if (t.sourceProposalId !== undefined)
				lines.push(
					`    sourceProposalId: ${escapeTableCell(t.sourceProposalId)}`,
				);
			if (t.sourceAnswerId !== undefined)
				lines.push(`    sourceAnswerId: ${escapeTableCell(t.sourceAnswerId)}`);
			if (t.sourceSessionId !== undefined)
				lines.push(
					`    sourceSessionId: ${escapeTableCell(t.sourceSessionId)}`,
				);
			if (t.sourceQuestionId !== undefined)
				lines.push(
					`    sourceQuestionId: ${escapeTableCell(t.sourceQuestionId)}`,
				);
			if (t.sourceDocumentId !== undefined)
				lines.push(
					`    sourceDocumentId: ${escapeTableCell(t.sourceDocumentId)}`,
				);
			if (t.sourcePhaseId !== undefined)
				lines.push(`    sourcePhaseId: ${escapeTableCell(t.sourcePhaseId)}`);
		}
	}

	if (
		metadata.nonCanonicalArtifacts !== undefined &&
		metadata.nonCanonicalArtifacts.length > 0
	) {
		lines.push('nonCanonicalArtifacts:');
		for (const a of metadata.nonCanonicalArtifacts) {
			lines.push(`  - ${escapeTableCell(a)}`);
		}
	}

	lines.push('---');
	lines.push('');

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Markdown section builders
// ---------------------------------------------------------------------------

function buildTitleSection(input: CanonicalMarkdownRenderInput): string {
	const title = escapeHeadingValue(input.documentDescriptor.title);
	return `# ${title}\n`;
}

function buildPurposeSection(input: CanonicalMarkdownRenderInput): string {
	const lines: string[] = [];
	lines.push('## Purpose');
	lines.push('');
	lines.push(sanitizeForMarkdown(input.documentDescriptor.purpose));
	lines.push('');

	if (input.documentDescriptor.centralQuestion) {
		lines.push(
			`**Central Question:** ${sanitizeForMarkdown(input.documentDescriptor.centralQuestion)}`,
		);
		lines.push('');
	}

	return lines.join('\n');
}

function buildDocumentStatusSection(planItem: GenerationPlanItem): string {
	const lines: string[] = [];
	lines.push('## Document Status');
	lines.push('');
	lines.push(`- **Generation Status:** ${planItem.action}`);
	lines.push(
		`- **Readiness:** ${planItem.readiness.ready ? 'Ready' : 'Not ready'}`,
	);

	if (planItem.action === 'stale' && planItem.staleReasons.length > 0) {
		lines.push('');
		lines.push(
			'> **Warning:** This document is stale. Underlying state has changed since last generation.',
		);
	}
	if (planItem.action === 'incomplete') {
		lines.push('');
		lines.push(
			'> **Note:** This document is incomplete. Required confirmed state is missing.',
		);
	}

	lines.push('');
	return lines.join('\n');
}

function buildSourcesSection(sources: MarkdownSourceReference[]): string {
	if (sources.length === 0) return '';

	const lines: string[] = [];
	lines.push('## Sources & Traceability');
	lines.push('');
	lines.push(
		'| Record ID | Type | Proposal | Session | Question | Document | Phase |',
	);
	lines.push(
		'|-----------|------|----------|---------|----------|----------|-------|',
	);

	for (const s of sources) {
		const recordId = escapeTableCell(s.recordId);
		const recordType = escapeTableCell(s.recordType);
		const proposal = escapeTableCell(s.sourceProposalId ?? '-');
		const session = escapeTableCell(s.sourceSessionId ?? '-');
		const question = escapeTableCell(s.sourceQuestionId ?? '-');
		const document = escapeTableCell(s.sourceDocumentId ?? '-');
		const phase = escapeTableCell(s.sourcePhaseId ?? '-');
		lines.push(
			`| ${recordId} | ${recordType} | ${proposal} | ${session} | ${question} | ${document} | ${phase} |`,
		);
	}

	lines.push('');
	return lines.join('\n');
}

function buildDecisionsSection(decisions: WorkspaceDecision[]): {
	markdown: string;
	sources: MarkdownSourceReference[];
} {
	const sources: MarkdownSourceReference[] = [];
	if (decisions.length === 0) return { markdown: '', sources };

	const lines: string[] = [];
	lines.push('## Decisions');
	lines.push('');

	for (const d of decisions) {
		lines.push(`### ${escapeHeadingValue(d.title)}`);
		lines.push('');
		if (d.body) {
			lines.push(sanitizeForMarkdown(d.body));
			lines.push('');
		}
		lines.push(`- **Confidence:** ${d.confidence ?? 'not specified'}`);
		lines.push(`- **Status:** ${d.status}`);
		if (d.sourceRefs.length > 0) {
			lines.push(
				`- **Source Refs:** ${d.sourceRefs.map(escapeTableCell).join(', ')}`,
			);
		}
		lines.push('');

		sources.push(
			createSourceRef(
				d.id,
				'decision',
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			),
		);
	}

	return { markdown: lines.join('\n'), sources };
}

function buildAssumptionsSection(assumptions: WorkspaceAssumption[]): {
	markdown: string;
	sources: MarkdownSourceReference[];
} {
	const sources: MarkdownSourceReference[] = [];
	if (assumptions.length === 0) return { markdown: '', sources };

	const lines: string[] = [];
	lines.push('## Assumptions');
	lines.push('');

	for (const a of assumptions) {
		lines.push(`### ${escapeHeadingValue(a.title)}`);
		lines.push('');
		if (a.body) {
			lines.push(sanitizeForMarkdown(a.body));
			lines.push('');
		}
		if (a.caveat) {
			lines.push(`**Caveat:** ${sanitizeForMarkdown(a.caveat)}`);
			lines.push('');
		}
		lines.push(`- **Status:** ${a.status}`);
		if (a.sourceRefs.length > 0) {
			lines.push(
				`- **Source Refs:** ${a.sourceRefs.map(escapeTableCell).join(', ')}`,
			);
		}
		lines.push('');

		sources.push(
			createSourceRef(
				a.id,
				'assumption',
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			),
		);
	}

	return { markdown: lines.join('\n'), sources };
}

function buildUnresolvedQuestionsSection(questions: WorkspaceOpenQuestion[]): {
	markdown: string;
	sources: MarkdownSourceReference[];
} {
	const sources: MarkdownSourceReference[] = [];
	if (questions.length === 0) return { markdown: '', sources };

	const lines: string[] = [];
	lines.push('## Unresolved Questions');
	lines.push('');

	for (const q of questions) {
		lines.push(`### ${escapeHeadingValue(q.question)}`);
		lines.push('');
		if (q.body) {
			lines.push(sanitizeForMarkdown(q.body));
			lines.push('');
		}
		lines.push(`- **ID:** ${escapeTableCell(q.id)}`);
		lines.push(`- **Status:** ${q.status}`);
		lines.push('');

		sources.push(
			createSourceRef(
				q.id,
				'open_question',
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			),
		);
	}

	return { markdown: lines.join('\n'), sources };
}

function buildRisksSection(risks: WorkspaceRisk[]): {
	markdown: string;
	sources: MarkdownSourceReference[];
} {
	const sources: MarkdownSourceReference[] = [];
	if (risks.length === 0) return { markdown: '', sources };

	const lines: string[] = [];
	lines.push('## Risks');
	lines.push('');

	for (const r of risks) {
		lines.push(`### ${escapeHeadingValue(r.title)}`);
		lines.push('');
		if (r.body) {
			lines.push(sanitizeForMarkdown(r.body));
			lines.push('');
		}
		lines.push(`- **Severity:** ${r.severity}`);
		lines.push(`- **Status:** ${r.status}`);
		if (r.rationale) {
			lines.push(`- **Rationale:** ${sanitizeForMarkdown(r.rationale)}`);
		}
		lines.push('');

		sources.push(
			createSourceRef(
				r.id,
				'risk',
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			),
		);
	}

	return { markdown: lines.join('\n'), sources };
}

function buildContentSection(
	ctx: SectionRenderContext,
): RenderedMarkdownSection {
	const section = ctx.section;
	const lines: string[] = [];
	const sources: MarkdownSourceReference[] = [];
	const gaps: MarkdownGapMarker[] = [];
	let status: MarkdownSectionRenderStatus = 'rendered';

	lines.push(`## ${escapeHeadingValue(section.title)}`);
	lines.push('');

	if (section.intent) {
		lines.push(`*${sanitizeForMarkdown(section.intent)}*`);
		lines.push('');
	}

	// Include accepted document_content_hint proposals as traceable content
	const contentHints = ctx.acceptedProposals.filter(
		(p) => p.kind === 'document_content_hint',
	);
	if (contentHints.length > 0) {
		lines.push('### Content');
		lines.push('');
		for (const hint of contentHints) {
			lines.push(sanitizeForMarkdown(hint.body));
			lines.push('');
			sources.push(
				createSourceRef(
					hint.proposalId,
					'proposal',
					hint.proposalId,
					hint.sourceAnswerId,
					hint.sourceSessionId,
					hint.sourceQuestionId,
					hint.sourceDocumentCanonicalId,
					hint.sourcePhaseId,
				),
			);
		}
	}

	// Include relevant decisions, assumptions as content
	const relevantDecisions = ctx.confirmedDecisions.filter(
		(d) => d.affectedDocumentIds.length > 0,
	);
	const relevantAssumptions = ctx.confirmedAssumptions.filter(
		(a) => a.affectedDocumentIds.length > 0,
	);

	if (relevantDecisions.length > 0 || relevantAssumptions.length > 0) {
		if (contentHints.length === 0) {
			lines.push('### Content');
			lines.push('');
		}

		for (const d of relevantDecisions) {
			if (d.body) {
				lines.push(
					`**Decision (${escapeTableCell(d.id)}):** ${sanitizeForMarkdown(d.body)}`,
				);
				lines.push('');
			}
		}
		for (const a of relevantAssumptions) {
			if (a.body) {
				lines.push(
					`**Assumption (${escapeTableCell(a.id)}):** ${sanitizeForMarkdown(a.body)}`,
				);
				lines.push('');
			}
		}
	}

	// If no content at all and section is required, mark gap
	if (
		contentHints.length === 0 &&
		relevantDecisions.length === 0 &&
		relevantAssumptions.length === 0
	) {
		if (section.required !== false) {
			const gap = createGap(
				'E_MDR_SECTION_MISSING_CONTENT',
				`Section "${section.id}" has no confirmed content to render`,
				section.id,
				undefined,
				undefined,
				'Provide confirmed decisions, assumptions, or accepted content proposals for this section',
			);
			gaps.push(gap);
			lines.push('');
			lines.push('> **Gap:** No confirmed content available for this section.');
			lines.push(
				'> Provide confirmed decisions, assumptions, or accepted content proposals.',
			);
			lines.push('');
			status = 'gap_only';
		}
	}

	// Render questions from descriptor
	if (section.questions.length > 0) {
		lines.push('### Guiding Questions');
		lines.push('');
		for (const q of section.questions) {
			lines.push(`- ${sanitizeForMarkdown(q)}`);
		}
		lines.push('');
	}

	// Render output guidance
	if (section.outputGuidance && section.outputGuidance.length > 0) {
		lines.push('### Output Guidance');
		lines.push('');
		for (const g of section.outputGuidance) {
			lines.push(`- ${sanitizeForMarkdown(g)}`);
		}
		lines.push('');
	}

	return {
		descriptorOrder: ctx.descriptorOrder,
		gaps,
		markdown: lines.join('\n'),
		required: section.required !== false,
		sectionId: section.id,
		sources,
		status,
		title: section.title,
	};
}

function buildGapsSection(
	gaps: MarkdownGapMarker[],
	planItem: GenerationPlanItem,
): string {
	// Combine render-time gaps and plan-item gaps
	const allGaps = [...gaps];

	// Add plan item gaps as MarkdownGapMarker
	for (const pg of planItem.gaps) {
		const gapMarker: MarkdownGapMarker = { code: pg.code, message: pg.message };
		if (pg.inputId !== undefined) gapMarker.inputId = pg.inputId;
		if (pg.recoveryHint !== undefined) gapMarker.recoveryHint = pg.recoveryHint;
		if (pg.sectionId !== undefined) gapMarker.sectionId = pg.sectionId;
		if (pg.sourceDocumentId !== undefined)
			gapMarker.sourceDocumentId = pg.sourceDocumentId;
		allGaps.push(gapMarker);
	}

	if (allGaps.length === 0) return '';

	const lines: string[] = [];
	lines.push('## Gaps & Incomplete Sections');
	lines.push('');
	lines.push('| Code | Message | Section | Input | Recovery Hint |');
	lines.push('|------|---------|---------|-------|---------------|');

	for (const g of allGaps) {
		const code = escapeTableCell(g.code);
		const message = escapeTableCell(g.message);
		const section = escapeTableCell(g.sectionId ?? '-');
		const input = escapeTableCell(g.inputId ?? '-');
		const hint = escapeTableCell(g.recoveryHint ?? '-');
		lines.push(`| ${code} | ${message} | ${section} | ${input} | ${hint} |`);
	}

	lines.push('');
	return lines.join('\n');
}

function buildQualityNotesSection(
	input: CanonicalMarkdownRenderInput,
	state: ConfirmedStateCollections,
): string {
	const notes: MarkdownQualityNote[] = [];

	// Add completion criteria
	if (input.documentDescriptor.completionCriteria) {
		for (const crit of input.documentDescriptor.completionCriteria) {
			notes.push({
				criterion: crit,
				detail: 'Not evaluated',
				status: 'not_evaluated',
			});
		}
	}

	// Add quality checks
	if (input.documentDescriptor.qualityChecks) {
		for (const check of input.documentDescriptor.qualityChecks) {
			const isSatisfied =
				state.confirmedDecisions.length > 0 ||
				state.confirmedAssumptions.length > 0 ||
				state.acceptedProposals.length > 0;
			notes.push({
				criterion: check,
				detail: isSatisfied
					? 'May be covered by confirmed state'
					: 'Missing input — no confirmed state available',
				status: isSatisfied ? 'satisfied' : 'missing_input',
			});
		}
	}

	// Add anti-patterns
	if (input.documentDescriptor.antiPatterns) {
		for (const ap of input.documentDescriptor.antiPatterns) {
			notes.push({
				criterion: `Anti-pattern watch: ${ap}`,
				detail: 'Not evaluated',
				status: 'not_evaluated',
			});
		}
	}

	// Add review rules
	if (input.documentDescriptor.reviewRules) {
		for (const rule of input.documentDescriptor.reviewRules) {
			notes.push({
				criterion: `Review rule: ${rule}`,
				detail: 'Not evaluated',
				status: 'not_evaluated',
			});
		}
	}

	if (notes.length === 0) return '';

	const lines: string[] = [];
	lines.push('## Quality Notes');
	lines.push('');

	for (const note of notes) {
		const statusLabel =
			{
				blocked: 'BLOCKED',
				incomplete: 'INCOMPLETE',
				missing_input: 'MISSING INPUT',
				not_evaluated: 'NOT EVALUATED',
				satisfied: 'SATISFIED',
			}[note.status] ?? note.status;

		lines.push(`- **${statusLabel}** — ${sanitizeForMarkdown(note.criterion)}`);
		if (note.detail) {
			lines.push(`  ${sanitizeForMarkdown(note.detail)}`);
		}
	}

	lines.push('');
	return lines.join('\n');
}

function buildBlockedPreviewSection(planItem: GenerationPlanItem): string {
	const lines: string[] = [];
	lines.push('# BLOCKED DOCUMENT');
	lines.push('');
	lines.push(
		`Document \`${escapeTableCell(planItem.documentCanonicalId)}\` is blocked and cannot be generated.`,
	);
	lines.push('');

	if (planItem.blockers.length > 0) {
		lines.push('## Blockers');
		lines.push('');
		for (const b of planItem.blockers) {
			lines.push(
				`- **${escapeTableCell(b.code)}:** ${sanitizeForMarkdown(b.message)}`,
			);
			if (b.recoveryHint) {
				lines.push(`  *${sanitizeForMarkdown(b.recoveryHint)}*`);
			}
		}
		lines.push('');
	}

	if (planItem.dependencyState.length > 0) {
		lines.push('## Dependency State');
		lines.push('');
		for (const ds of planItem.dependencyState) {
			lines.push(
				`- **${escapeTableCell(ds.dependencyRawId)}:** ${ds.status}${ds.reason ? ` — ${sanitizeForMarkdown(ds.reason)}` : ''}`,
			);
		}
		lines.push('');
	}

	return lines.join('\n');
}

function buildFailedDiagnosticSection(planItem: GenerationPlanItem): string {
	const lines: string[] = [];
	lines.push('# FAILED DOCUMENT');
	lines.push('');
	lines.push(
		`Document \`${escapeTableCell(planItem.documentCanonicalId)}\` has failed. It cannot be rendered in its current state.`,
	);
	lines.push('');

	if (planItem.blockers.length > 0) {
		lines.push('## Blockers');
		lines.push('');
		for (const b of planItem.blockers) {
			lines.push(
				`- **${escapeTableCell(b.code)}:** ${sanitizeForMarkdown(b.message)}`,
			);
			if (b.recoveryHint) {
				lines.push(`  *${sanitizeForMarkdown(b.recoveryHint)}*`);
			}
		}
		lines.push('');
	}

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderCanonicalMarkdownDocument(
	input: CanonicalMarkdownRenderInput,
	options: CanonicalMarkdownRenderOptions = {},
): CanonicalMarkdownRenderResult {
	const diagnostics: CanonicalMarkdownRenderDiagnostic[] = [];
	const planItem = input.planItem;

	// Validate input
	if (!input.documentDescriptor.id) {
		diagnostics.push(
			createDiagnostic(
				'E_MDR_MISSING_DESCRIPTOR',
				'error',
				'Document descriptor is missing or has no ID',
			),
		);
	}

	if (!planItem.documentCanonicalId) {
		diagnostics.push(
			createDiagnostic(
				'E_MDR_MISSING_PLAN_ITEM',
				'error',
				'Plan item is missing or has no document canonical ID',
			),
		);
	}

	if (diagnostics.some((d) => d.severity === 'error')) {
		return {
			canonicalOutputPath: planItem?.canonicalOutputPath ?? '',
			diagnostics,
			documentCanonicalId: planItem?.documentCanonicalId ?? '',
			gaps: [],
			markdown: '',
			metadata: {
				canonicalOutput: planItem?.canonicalOutputPath ?? '',
				documentId: input.documentDescriptor?.id ?? '',
				generatedAt: options.generatedAt ?? new Date().toISOString(),
				generatedBy: options.renderedBy ?? DEFAULT_RENDERED_BY,
				generationStatus: planItem?.action ?? 'failed',
				phaseId: input.documentDescriptor?.phaseId ?? '',
				profileId: input.profileId ?? '',
				sourceStateSchemaVersion: input.schemaVersion ?? '',
				traceability: [],
			},
			phaseId: input.documentDescriptor?.phaseId ?? '',
			renderedAt: options.generatedAt ?? new Date().toISOString(),
			sections: [],
			sources: [],
			status: 'failed',
		};
	}

	// Check plan item status
	const statusGate = checkPlanItemStatus(planItem, options, diagnostics);

	if (statusGate === 'diagnostic_only') {
		return {
			canonicalOutputPath: planItem.canonicalOutputPath,
			diagnostics,
			documentCanonicalId: planItem.documentCanonicalId,
			gaps: [],
			markdown: '',
			metadata: buildMetadataHeader(input, options, []),
			phaseId: planItem.phaseId,
			renderedAt: options.generatedAt ?? new Date().toISOString(),
			sections: [],
			sources: [],
			status: planItem.action,
		};
	}

	if (statusGate === 'failed') {
		const markdown = buildFailedDiagnosticSection(planItem);
		return {
			canonicalOutputPath: planItem.canonicalOutputPath,
			diagnostics,
			documentCanonicalId: planItem.documentCanonicalId,
			gaps: [],
			markdown,
			metadata: buildMetadataHeader(input, options, []),
			phaseId: planItem.phaseId,
			renderedAt: options.generatedAt ?? new Date().toISOString(),
			sections: [],
			sources: [],
			status: planItem.action,
		};
	}

	if (statusGate === 'blocked') {
		const markdown = buildBlockedPreviewSection(planItem);
		return {
			canonicalOutputPath: planItem.canonicalOutputPath,
			diagnostics,
			documentCanonicalId: planItem.documentCanonicalId,
			gaps: [],
			markdown,
			metadata: buildMetadataHeader(input, options, []),
			phaseId: planItem.phaseId,
			renderedAt: options.generatedAt ?? new Date().toISOString(),
			sections: [],
			sources: [],
			status: planItem.action,
		};
	}

	// Status gate is 'render', 'partial', or 'diagnostic_only'
	// 'partial' means blocked with preview allowed — render blocked preview
	if (statusGate === 'partial') {
		const markdown = buildBlockedPreviewSection(planItem);
		return {
			canonicalOutputPath: planItem.canonicalOutputPath,
			diagnostics,
			documentCanonicalId: planItem.documentCanonicalId,
			gaps: [],
			markdown,
			metadata: buildMetadataHeader(input, options, []),
			phaseId: planItem.phaseId,
			renderedAt: options.generatedAt ?? new Date().toISOString(),
			sections: [],
			sources: [],
			status: planItem.action,
		};
	}

	const confirmedState = collectConfirmedState(planItem, input.state);

	// Warn about proposed (unaccepted) proposals
	if (confirmedState.proposedProposals.length > 0) {
		diagnostics.push(
			createDiagnostic(
				'E_MDR_PROPOSED_NOT_CONFIRMED',
				'warning',
				`${confirmedState.proposedProposals.length} proposed (unaccepted) proposal(s) reference this document but are not treated as confirmed state`,
				planItem.documentCanonicalId,
				planItem.descriptorSourcePath,
				undefined,
				'Accept proposals via /continue or API to convert to confirmed state',
			),
		);
	}

	const allSources: MarkdownSourceReference[] = [];
	const allGaps: MarkdownGapMarker[] = [];
	const renderedSections: RenderedMarkdownSection[] = [];

	const _languagePolicy = options.languagePolicy ?? DEFAULT_LANGUAGE;

	// Build sections in order. Frontmatter is prepended after sources are known.
	const mdParts: string[] = [];

	// Document title
	mdParts.push(buildTitleSection(input));

	// Stale warning
	if (planItem.action === 'stale') {
		mdParts.push(
			'> **Warning:** This document is stale. Underlying confirmed state has changed since the last generation.\n\n',
		);
	}

	// Incomplete marker
	if (planItem.action === 'incomplete') {
		mdParts.push(
			'> **Note:** This document is incomplete. Some required content is missing from confirmed state.\n\n',
		);
	}

	// Purpose section
	mdParts.push(buildPurposeSection(input));

	// Document status
	mdParts.push(buildDocumentStatusSection(planItem));

	// Sources section (will be filled as we go)
	// We temporarily skip this, will build it at the end with all accumulated sources.

	// Decisions
	const decisionsResult = buildDecisionsSection(
		confirmedState.confirmedDecisions,
	);
	if (decisionsResult.markdown) {
		mdParts.push(decisionsResult.markdown);
		allSources.push(...decisionsResult.sources);
	}

	// Assumptions
	const assumptionsResult = buildAssumptionsSection(
		confirmedState.confirmedAssumptions,
	);
	if (assumptionsResult.markdown) {
		mdParts.push(assumptionsResult.markdown);
		allSources.push(...assumptionsResult.sources);
	}

	// Unresolved questions
	const questionsResult = buildUnresolvedQuestionsSection(
		confirmedState.unresolvedQuestions,
	);
	if (questionsResult.markdown) {
		mdParts.push(questionsResult.markdown);
		allSources.push(...questionsResult.sources);
	}

	// Risks
	const risksResult = buildRisksSection(confirmedState.relatedRisks);
	if (risksResult.markdown) {
		mdParts.push(risksResult.markdown);
		allSources.push(...risksResult.sources);
	}

	// Content sections from descriptor
	if (
		input.documentDescriptor.sections &&
		input.documentDescriptor.sections.length > 0
	) {
		let sectionIdx = 0;
		for (const section of input.documentDescriptor.sections) {
			if (!section || typeof section.id !== 'string') {
				diagnostics.push(
					createDiagnostic(
						'E_MDR_INVALID_SECTION_SHAPE',
						'warning',
						`Section at index ${sectionIdx} of document "${planItem.documentCanonicalId}" has an unsupported shape`,
						planItem.documentCanonicalId,
						input.planItem.descriptorSourcePath,
						`sections[${sectionIdx}]`,
					),
				);
				sectionIdx++;
				continue;
			}

			const sectionCtx: SectionRenderContext = {
				acceptedProposals: confirmedState.acceptedProposals,
				confirmedAssumptions: confirmedState.confirmedAssumptions,
				confirmedDecisions: confirmedState.confirmedDecisions,
				descriptorOrder: sectionIdx,
				gaps: [],
				relatedRisks: confirmedState.relatedRisks,
				section,
				sources: [],
				unresolvedQuestions: confirmedState.unresolvedQuestions,
			};

			const rendered = buildContentSection(sectionCtx);
			renderedSections.push(rendered);
			mdParts.push(rendered.markdown);
			allSources.push(...rendered.sources);
			allGaps.push(...rendered.gaps);

			sectionIdx++;
		}
	} else {
		// No sections defined in descriptor — mark as gap
		const gap = createGap(
			'E_MDR_MISSING_SECTIONS',
			`Document "${planItem.documentCanonicalId}" has no sections defined in its descriptor`,
			undefined,
			undefined,
			planItem.documentCanonicalId,
			'Define sections in the document descriptor',
		);
		allGaps.push(gap);
	}

	// Sources section (built after accumulating all sources)
	const sourcesMarkdown = buildSourcesSection(allSources);
	if (sourcesMarkdown) {
		// Insert after Document Status section
		const statusIdx = mdParts.findIndex((p) =>
			p.startsWith('## Document Status'),
		);
		if (statusIdx >= 0) {
			mdParts.splice(statusIdx + 1, 0, sourcesMarkdown);
		} else {
			mdParts.push(sourcesMarkdown);
		}
	}

	// Gaps section
	const gapsMarkdown = buildGapsSection(allGaps, planItem);
	if (gapsMarkdown) {
		mdParts.push(gapsMarkdown);
	}

	// Quality notes
	const qualityNotesMarkdown = buildQualityNotesSection(input, confirmedState);
	if (qualityNotesMarkdown) {
		mdParts.push(qualityNotesMarkdown);
	}

	// Update metadata to include all sources
	const finalMetadata = buildMetadataHeader(input, options, allSources);

	const markdown = [buildYamlFrontmatter(finalMetadata), ...mdParts].join('\n');

	return {
		canonicalOutputPath: planItem.canonicalOutputPath,
		diagnostics,
		documentCanonicalId: planItem.documentCanonicalId,
		gaps: allGaps,
		markdown,
		metadata: finalMetadata,
		phaseId: planItem.phaseId,
		renderedAt: options.generatedAt ?? new Date().toISOString(),
		sections: renderedSections,
		sources: allSources,
		status: planItem.action,
	};
}

// ---------------------------------------------------------------------------
// Batch render from plan
// ---------------------------------------------------------------------------

export interface RenderFromPlanInput {
	plan: GenerationPlan;
	state: WorkspaceState;
	profileId: string;
	schemaVersion: string;
	contractDocuments: Map<
		string,
		{
			id: string;
			title: string;
			phaseId: string;
			purpose: string;
			centralQuestion: string;
			sections: DocumentDescriptorSection[];
			completionCriteria?: string[];
			qualityChecks?: string[];
			antiPatterns?: string[];
			reviewRules?: string[];
			status: string;
			type: string;
		}
	>;
}

export function renderCanonicalMarkdownFromPlan(
	input: RenderFromPlanInput,
	options: CanonicalMarkdownRenderOptions = {},
): CanonicalMarkdownRenderResult[] {
	const results: CanonicalMarkdownRenderResult[] = [];

	for (const planItem of input.plan.items) {
		const descriptor = input.contractDocuments.get(
			planItem.documentCanonicalId,
		);

		if (descriptor === undefined) {
			results.push({
				canonicalOutputPath: planItem.canonicalOutputPath,
				diagnostics: [
					createDiagnostic(
						'E_MDR_MISSING_DESCRIPTOR_FOR_PLAN',
						'error',
						`No document descriptor found for plan item "${planItem.documentCanonicalId}"`,
						planItem.documentCanonicalId,
					),
				],
				documentCanonicalId: planItem.documentCanonicalId,
				gaps: [],
				markdown: '',
				metadata: {
					canonicalOutput: planItem.canonicalOutputPath,
					documentId: planItem.documentId,
					generatedAt: options.generatedAt ?? new Date().toISOString(),
					generatedBy: options.renderedBy ?? DEFAULT_RENDERED_BY,
					generationStatus: 'failed',
					phaseId: planItem.phaseId,
					profileId: input.profileId,
					sourceStateSchemaVersion: input.schemaVersion,
					traceability: [],
				},
				phaseId: planItem.phaseId,
				renderedAt: options.generatedAt ?? new Date().toISOString(),
				sections: [],
				sources: [],
				status: 'failed',
			});
			continue;
		}

		const docDescriptor: CanonicalMarkdownRenderInput['documentDescriptor'] = {
			centralQuestion: descriptor.centralQuestion,
			id: descriptor.id,
			phaseId: descriptor.phaseId,
			purpose: descriptor.purpose,
			sections: descriptor.sections,
			status: descriptor.status,
			title: descriptor.title,
			type: descriptor.type,
		};
		if (descriptor.completionCriteria !== undefined)
			docDescriptor.completionCriteria = descriptor.completionCriteria;
		if (descriptor.qualityChecks !== undefined)
			docDescriptor.qualityChecks = descriptor.qualityChecks;
		if (descriptor.antiPatterns !== undefined)
			docDescriptor.antiPatterns = descriptor.antiPatterns;
		if (descriptor.reviewRules !== undefined)
			docDescriptor.reviewRules = descriptor.reviewRules;

		const renderInput: CanonicalMarkdownRenderInput = {
			documentDescriptor: docDescriptor,
			planItem,
			profileId: input.profileId,
			schemaVersion: input.schemaVersion,
			state: input.state,
		};

		results.push(renderCanonicalMarkdownDocument(renderInput, options));
	}

	return results;
}
