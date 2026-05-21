/** Step 10.3 — Agent Pack Renderer (pure, side-effect-free) */

import { redactString } from '../runtime/redaction.js';
import type {
	AgentPackRenderDiagnostic,
	AgentPackRenderedMarkdown,
	AgentPackRenderInput,
	AgentPackRenderMetadata,
	AgentPackRenderOptions,
	AgentPackRenderResult,
	AgentPackSecuritySummary,
	AgentPackTemplateKind,
} from './agent-pack-render-types.js';
import { mapPackKindToTemplateKind } from './agent-pack-render-types.js';
import { TEMPLATES } from './agent-pack-templates.js';
import type { ContextBundle } from './context-bundle-model.js';

// ---------------------------------------------------------------------------
// Render entry point
// ---------------------------------------------------------------------------

export function renderAgentPack(
	input: AgentPackRenderInput,
	options: AgentPackRenderOptions = {},
): AgentPackRenderResult {
	const diagnostics: AgentPackRenderDiagnostic[] = [];
	const { bundle } = input;
	const metadata = bundle.metadata;
	const bundleStatus = bundle.status;

	// Check bundle status
	if (bundleStatus === 'blocked' && !options.allowBlockedBundle) {
		const diag = createDiagnostic(
			'E_AP_RENDER_BLOCKED_BUNDLE',
			'error',
			'Bundle is blocked; cannot render Agent Pack',
			{
				bundleId: metadata.bundleId,
				packId: metadata.packId,
				packKind: metadata.packKind,
				recoveryHint:
					'Resolve blockers in the plan item first, or enable allowBlockedBundle to render diagnostic packs.',
			},
		);
		diagnostics.push(diag);
		return {
			diagnostics,
			rendered: createEmptyRenderedMarkdown(input, diagnostics),
		};
	}

	const templateKind = mapPackKindToTemplateKind(metadata.packKind);
	const template = TEMPLATES[templateKind];

	if (!template) {
		const diag = createDiagnostic(
			'E_AP_RENDER_UNKNOWN_TEMPLATE',
			'error',
			`No template found for template kind "${templateKind}"`,
			{
				bundleId: metadata.bundleId,
				packId: metadata.packId,
				packKind: metadata.packKind,
				recoveryHint:
					'Use a supported pack kind or register a custom template.',
				templateKind,
			},
		);
		diagnostics.push(diag);
		return {
			diagnostics,
			rendered: createEmptyRenderedMarkdown(input, diagnostics),
		};
	}

	// Build render metadata from bundle metadata
	const renderMetadata = buildRenderMetadata(metadata, input);

	// Extract section content from bundle
	const objective = extractSectionContent(bundle, 'objective');
	const scope = extractSectionContent(bundle, 'scope');
	const sourceDocuments = extractSectionContent(bundle, 'source_documents');
	const constraints = extractSectionContent(bundle, 'constraints');
	const requiredChanges = extractSectionContent(bundle, 'required_changes');
	const acceptanceCriteria = extractSectionContent(
		bundle,
		'acceptance_criteria',
	);
	const nonGoals = extractSectionContent(bundle, 'non_goals');
	const decisions = extractSectionContent(bundle, 'decisions');
	const assumptions = extractSectionContent(bundle, 'assumptions');
	const hypotheses = extractSectionContent(bundle, 'hypotheses');
	const risks = extractSectionContent(bundle, 'risks');
	const openQuestions = extractSectionContent(bundle, 'open_questions');
	const validationFindings = extractSectionContent(
		bundle,
		'validation_findings',
	);
	const consistencyFindings = extractSectionContent(
		bundle,
		'consistency_findings',
	);
	const traceability = extractSectionContent(bundle, 'traceability');
	const expectedOutputs = extractSectionContent(bundle, 'expected_outputs');

	// Build reporting section
	let reportingLines = '';
	if (input.validateCommands && input.validateCommands.length > 0) {
		reportingLines += '**Suggested Validation Commands:**\n';
		for (const cmd of input.validateCommands) {
			reportingLines += `\`\`\`bash\n${cmd}\n\`\`\`\n\n`;
		}
	}

	// Build diagnostics section
	const diagnosticsContent = bundle.diagnostics
		.map(
			(d) =>
				`- [${d.severity}] \`${d.code}\`: ${d.message}${d.recoveryHint ? ` (Hint: ${d.recoveryHint})` : ''}`,
		)
		.join('\n');

	// Render via template
	const markdownContent = template.render({
		acceptanceCriteria,
		assumptions,
		consistencyFindings,
		constraints,
		decisions,
		diagnostics: diagnosticsContent,
		expectedOutputs,
		hypotheses,
		metadata: renderMetadata,
		nonGoals,
		objective,
		openQuestions,
		reportingRequirements: reportingLines,
		requiredChanges,
		risks,
		scope,
		sourceDocuments,
		traceability,
		validationFindings,
	});

	// Apply redaction to final markdown
	const redactedContent = redactString(markdownContent);

	// Build security summary
	const securitySummary = buildSecuritySummary(
		markdownContent,
		redactedContent,
	);

	const title =
		input.packTitle ??
		bundle.sections
			.find((s) => s.kind === 'objective')
			?.items[0]?.summary?.slice(0, 80) ??
		`Agent Pack: ${metadata.packId}`;

	const rendered: AgentPackRenderedMarkdown = {
		changedPaths: [],
		diagnostics,
		markdown: redactedContent,
		metadata: renderMetadata,
		packId: metadata.packId,
		packKind: metadata.packKind,
		readOnly: true,
		securitySummary,
		templateKind,
		title,
	};

	return { diagnostics, rendered };
}

// ---------------------------------------------------------------------------
// Build metadata from bundle
// ---------------------------------------------------------------------------

function buildRenderMetadata(
	metadata: ContextBundle['metadata'],
	input: AgentPackRenderInput,
): AgentPackRenderMetadata {
	// Collect register item IDs from bundle sections
	const registerItemIds: string[] = [];
	const decisionIds = collectItemIds(input.bundle, 'decisions');
	const assumptionIds = collectItemIds(input.bundle, 'assumptions');
	const riskIds = collectItemIds(input.bundle, 'risks');
	const openQuestionIds = collectItemIds(input.bundle, 'open_questions');
	registerItemIds.push(
		...decisionIds,
		...assumptionIds,
		...riskIds,
		...openQuestionIds,
	);

	// Collect traceability IDs
	const traceabilitySourceIds: string[] = collectItemIds(
		input.bundle,
		'traceability',
	);

	// Validation and readiness status from bundle
	const validationStatus = undefined; // not available at render time
	const readinessStatus = input.bundle.status;

	return {
		artifactType: 'agent_pack',
		canonical: false,
		derived: true,
		executionAid: true,
		generatedAt: input.generatedAt,
		logosItemId: metadata.packId || undefined,
		packId: metadata.packId,
		packKind: metadata.packKind,
		profileId: metadata.profileId,
		profileVersion: metadata.profileVersion,
		readinessStatus,
		redactionSummary: metadata.redactionSummary
			? {
					kinds: metadata.redactionSummary.kinds,
					redactedCount: metadata.redactionSummary.redactedCount,
				}
			: undefined,
		registerItemIds,
		sourceBundleId: metadata.bundleId,
		sourceCanonicalPaths: metadata.canonicalSourcePaths,
		sourceDocumentIds: metadata.canonicalSourceDocumentIds,
		templateKind: mapPackKindToTemplateKind(metadata.packKind),
		traceabilitySourceIds,
		validationStatus,
	};
}

// ---------------------------------------------------------------------------
// Section content extractors
// ---------------------------------------------------------------------------

function extractSectionContent(bundle: ContextBundle, kind: string): string {
	const section = bundle.sections.find((s) => s.kind === kind);
	if (!section || section.items.length === 0) return '';

	const lines: string[] = [];
	for (const item of section.items) {
		const flags: string[] = [];
		if (item.blocking) flags.push('BLOCKING');
		if (item.reviewRequired) flags.push('REVIEW_REQUIRED');
		if (item.confidence && item.confidence !== 'confirmed')
			flags.push(`confidence: ${item.confidence}`);

		const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';

		lines.push(`- **${item.label}**${flagStr}: ${item.summary}`);

		// Include detail if structured
		if (item.detail && typeof item.detail === 'object') {
			const detail = item.detail as Record<string, unknown>;
			if (detail.description && typeof detail.description === 'string') {
				lines.push(`  ${detail.description}`);
			}
			if (detail.impact && typeof detail.impact === 'string') {
				lines.push(`  Impact: ${detail.impact}`);
			}
			if (detail.likelihood && typeof detail.likelihood === 'string') {
				lines.push(`  Likelihood: ${detail.likelihood}`);
			}
			if (detail.mitigation && typeof detail.mitigation === 'string') {
				lines.push(`  Mitigation: ${detail.mitigation}`);
			}
			if (detail.whyItMatters && typeof detail.whyItMatters === 'string') {
				lines.push(`  Why it matters: ${detail.whyItMatters}`);
			}
		}
	}

	if (section.truncated) {
		lines.push('');
		lines.push(
			`> **Note:** This section was truncated. ${section.omittedCount} items omitted due to size budget.`,
		);
	}

	return lines.join('\n');
}

function collectItemIds(bundle: ContextBundle, kind: string): string[] {
	const section = bundle.sections.find((s) => s.kind === kind);
	if (!section) return [];
	return section.items.map((item) => item.id);
}

// ---------------------------------------------------------------------------
// Empty rendered markdown (for error cases)
// ---------------------------------------------------------------------------

function createEmptyRenderedMarkdown(
	input: AgentPackRenderInput,
	diagnostics: AgentPackRenderDiagnostic[],
): AgentPackRenderedMarkdown {
	const bundle = input.bundle;
	return {
		changedPaths: [],
		diagnostics,
		markdown: '',
		metadata: {
			artifactType: 'agent_pack',
			canonical: false,
			derived: true,
			executionAid: true,
			generatedAt: input.generatedAt,
			logosItemId: undefined,
			packId: '',
			packKind: 'custom',
			profileId: '',
			profileVersion: undefined,
			readinessStatus: 'blocked',
			redactionSummary: undefined,
			registerItemIds: [],
			sourceBundleId: bundle.metadata.bundleId,
			sourceCanonicalPaths: [],
			sourceDocumentIds: [],
			templateKind: 'custom',
			traceabilitySourceIds: [],
			validationStatus: undefined,
		},
		packId: '',
		packKind: 'custom',
		readOnly: true,
		securitySummary: {
			blockReasons: ['render_failed'],
			forbiddenModelResponseCount: 0,
			forbiddenRawPromptCount: 0,
			passed: false,
			redactionCount: 0,
			tokenLikeValueCount: 0,
		},
		templateKind: 'custom',
		title: 'Render Failed',
	};
}

// ---------------------------------------------------------------------------
// Security summary builder
// ---------------------------------------------------------------------------

function buildSecuritySummary(
	original: string,
	redacted: string,
): AgentPackSecuritySummary {
	const blockReasons: string[] = [];
	let tokenLikeValueCount = 0;
	let forbiddenRawPromptCount = 0;
	let forbiddenModelResponseCount = 0;
	const redactionCount = original !== redacted ? 1 : 0;

	// Check for raw prompt markers
	if (
		original.toLowerCase().includes('system prompt') ||
		original.toLowerCase().includes('system message')
	) {
		forbiddenRawPromptCount++;
	}

	// Check for model response markers
	if (
		original.toLowerCase().includes('model response') ||
		original.toLowerCase().includes('chat completion') ||
		original.toLowerCase().includes('model output')
	) {
		forbiddenModelResponseCount++;
	}

	// Check for token-like patterns
	const tokenPatterns = [
		/\b(sk-[a-zA-Z0-9]{20,})\b/,
		/\b(gsk_[a-zA-Z0-9]{20,})\b/,
		/\b(hf_[a-zA-Z0-9]{20,})\b/,
		/Bearer\s+\S{20,}/i,
		/Authorization\s*[:=]\s*\S{20,}/i,
	];

	for (const pattern of tokenPatterns) {
		const matches = original.match(pattern);
		if (matches) {
			tokenLikeValueCount += 1;
		}
	}

	const passed =
		forbiddenRawPromptCount === 0 &&
		forbiddenModelResponseCount === 0 &&
		tokenLikeValueCount === 0;

	return {
		blockReasons,
		forbiddenModelResponseCount,
		forbiddenRawPromptCount,
		passed,
		redactionCount,
		tokenLikeValueCount,
	};
}

// ---------------------------------------------------------------------------
// Diagnostic helper
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: AgentPackRenderDiagnostic['severity'],
	message: string,
	opts: {
		packId?: string;
		packKind?: import('./agent-pack-types.js').AgentPackKind;
		templateKind?: AgentPackTemplateKind;
		bundleId?: string;
		sourcePath?: string;
		fieldPath?: string;
		recoveryHint?: string;
		sourceDocId?: string;
		registerItemId?: string;
		expected?: string;
		received?: string;
	} = {},
): AgentPackRenderDiagnostic {
	return {
		code,
		expected: opts.expected,
		fieldPath: opts.fieldPath,
		message,
		outputPath: undefined,
		received: opts.received,
		recoveryHint: opts.recoveryHint,
		relatedBundleId: opts.bundleId,
		relatedPackId: opts.packId,
		relatedPackKind: opts.packKind,
		relatedPhaseId: undefined,
		relatedRegisterItemId: opts.registerItemId,
		relatedSourceDocumentId: opts.sourceDocId,
		relatedTemplateKind: opts.templateKind,
		severity,
		sourcePath: opts.sourcePath,
	};
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { buildSecuritySummary, mapPackKindToTemplateKind };
