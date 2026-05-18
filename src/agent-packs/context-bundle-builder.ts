/** Step 10.2 — Bounded Context Bundle builder: read-only deterministic bundle construction */

import { redactString } from '../runtime/redaction.js';
import type {
	AgentPackKind,
	AgentPackPlanItem,
	AgentPackSource,
	AgentPackSourceKind,
} from './agent-pack-types.js';
import {
	type ContextBundle,
	type ContextBundleBlocker,
	type ContextBundleDiagnostic,
	type ContextBundleInput,
	type ContextBundleMetadata,
	type ContextBundleOptions,
	type ContextBundleRedactionSummary,
	type ContextBundleResult,
	type ContextBundleSection,
	type ContextBundleSectionItem,
	type ContextBundleSectionKind,
	type ContextBundleSizeBudget,
	type ContextBundleSizeSummary,
	type ContextBundleSource,
	type ContextBundleSourceKind,
	type ContextBundleStatus,
	DEFAULT_SCOPE_OPTIONS,
	DEFAULT_SIZE_BUDGET,
} from './context-bundle-model.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<ContextBundleDiagnostic>,
): ContextBundleDiagnostic {
	return {
		code,
		fieldPath: undefined,
		message,
		recoveryHint: undefined,
		sectionKind: undefined,
		severity,
		sourcePath: undefined,
		...overrides,
	};
}

function createBlocker(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<ContextBundleBlocker>,
): ContextBundleBlocker {
	return {
		code,
		message,
		recoveryHint: undefined,
		sectionKind: undefined,
		severity,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

function redactContent(
	value: string,
	redactionSummary: ContextBundleRedactionSummary,
): string {
	const before = value;
	const after = redactString(before);
	if (after !== before) {
		redactionSummary.redactedCount += 1;
		if (!redactionSummary.kinds.includes('string_redaction')) {
			redactionSummary.kinds.push('string_redaction');
		}
	}
	return after;
}

function redactSectionItems(
	section: ContextBundleSection,
	kind: ContextBundleSectionKind,
	redactionSummary: ContextBundleRedactionSummary,
): ContextBundleSection {
	const originalJson = JSON.stringify(section);
	const redactedJson = redactString(originalJson);
	if (redactedJson !== originalJson) {
		redactionSummary.redactedCount += 1;
		if (!redactionSummary.sectionsAffected.includes(kind)) {
			redactionSummary.sectionsAffected.push(kind);
		}
		if (!redactionSummary.kinds.includes('section_redaction')) {
			redactionSummary.kinds.push('section_redaction');
		}
		try {
			return JSON.parse(redactedJson) as ContextBundleSection;
		} catch {
			return section;
		}
	}
	return section;
}

// ---------------------------------------------------------------------------
// Size budget enforcement
// ---------------------------------------------------------------------------

function enforceSizeBudget(
	sections: ContextBundleSection[],
	budget: ContextBundleSizeBudget,
	diagnostics: ContextBundleDiagnostic[],
	sizeSummary: ContextBundleSizeSummary,
): ContextBundleSection[] {
	let totalItemCount = 0;
	let approximateChars = 0;

	for (const section of sections) {
		totalItemCount += section.items.length;
		approximateChars += approximateSectionChars(section);
	}

	// Enforce max section item count
	const scored: ContextBundleSection[] = [];
	for (const section of sections) {
		let items = section.items;
		let truncated = section.truncated;
		let omitted = section.omittedCount;

		if (
			budget.maxSectionItemCount > 0 &&
			items.length > budget.maxSectionItemCount
		) {
			omitted += items.length - budget.maxSectionItemCount;
			items = items.slice(0, budget.maxSectionItemCount);
			truncated = true;
			diagnostics.push(
				createDiagnostic(
					'E_CTX_BUNDLE_SECTION_TRUNCATED',
					'warning',
					`Section "${section.kind}" truncated: ${omitted} items omitted (max ${budget.maxSectionItemCount})`,
					{ sectionKind: section.kind },
				),
			);
		}

		scored.push({ ...section, items, omittedCount: omitted, truncated });
		if (truncated) {
			if (!sizeSummary.sectionsTruncated.includes(section.kind)) {
				sizeSummary.sectionsTruncated.push(section.kind);
			}
		}
	}

	// Recalculate after individual section truncation
	totalItemCount = 0;
	approximateChars = 0;
	for (const section of scored) {
		totalItemCount += section.items.length;
		approximateChars += approximateSectionChars(section);
	}

	sizeSummary.sectionCount = scored.length;
	sizeSummary.totalItemCount = totalItemCount;
	sizeSummary.approximateCharacterCount = approximateChars;
	sizeSummary.totalOmittedItems = scored.reduce(
		(sum, s) => sum + s.omittedCount,
		0,
	);

	// Enforce max total character count
	if (
		budget.maxTotalCharacterCount > 0 &&
		approximateChars > budget.maxTotalCharacterCount
	) {
		diagnostics.push(
			createDiagnostic(
				'E_CTX_BUNDLE_TOTAL_SIZE_EXCEEDED',
				'warning',
				`Total bundle size (${approximateChars} chars) exceeds budget (${budget.maxTotalCharacterCount} chars)`,
				{ recoveryHint: 'Consider narrowing scope or increasing size budget' },
			),
		);
	}

	return scored;
}

function approximateSectionChars(section: ContextBundleSection): number {
	return JSON.stringify(section).length;
}

// ---------------------------------------------------------------------------
// Bundle ID generation (deterministic)
// ---------------------------------------------------------------------------

function generateBundleId(
	planItem: AgentPackPlanItem,
	generatedAt: string,
): string {
	const input = `${planItem.packId}:${planItem.packKind}:${generatedAt}`;
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const chr = input.charCodeAt(i);
		hash = ((hash << 5) - hash + chr) | 0;
	}
	const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
	return `ctx-bundle-${hexHash}`;
}

// ---------------------------------------------------------------------------
// Source collection
// ---------------------------------------------------------------------------

function collectSources(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
	includeContentExcerpts: boolean,
	budget: ContextBundleSizeBudget,
): ContextBundleSource[] {
	const sources: ContextBundleSource[] = [];

	// Collect from plan item sources
	for (const ps of planItem.sources) {
		const docMeta =
			ps.documentCanonicalId !== undefined
				? input.canonicalDocumentMeta.get(ps.documentCanonicalId)
				: undefined;

		const sourceKind = mapAgentPackSourceKind(ps.sourceKind);
		let contentExcerpt: string | undefined;
		let excerptTruncated = false;

		if (includeContentExcerpts && ps.documentCanonicalId !== undefined) {
			const excerpt = input.canonicalContentExcerpts.get(
				ps.documentCanonicalId,
			);
			if (excerpt !== undefined) {
				if (excerpt.length > budget.maxExcerptLength) {
					contentExcerpt = excerpt.slice(0, budget.maxExcerptLength);
					excerptTruncated = true;
				} else {
					contentExcerpt = excerpt;
				}
			}
		}

		sources.push({
			contentExcerpt,
			documentCanonicalId: ps.documentCanonicalId,
			excerptTruncated,
			label: ps.label ?? docMeta?.title,
			phaseId: ps.phaseId,
			required: ps.required,
			sourceId: ps.sourceId,
			sourceKind,
			sourcePath: ps.outputPath ?? docMeta?.sourcePath,
			stalenessStatus: docMeta?.stalenessStatus,
			title: docMeta?.title,
			validationStatus: docMeta?.validationStatus,
		});
	}

	return sources;
}

function mapAgentPackSourceKind(
	kind: AgentPackSourceKind,
): ContextBundleSourceKind {
	const map: Record<string, ContextBundleSourceKind> = {
		artifact_metadata: 'artifact_metadata',
		assumption_register: 'assumption',
		canonical_markdown: 'canonical_markdown',
		consistency_finding: 'consistency_finding',
		decision_register: 'confirmed_decision',
		document_descriptor: 'document_descriptor',
		executive_declaration: 'executive_declaration',
		generated_output_metadata: 'generated_metadata',
		hypothesis_register: 'hypothesis',
		open_question_register: 'open_question',
		profile_descriptor: 'profile_descriptor',
		provenance_claim: 'provenance_claim',
		risk_register: 'risk',
		traceability_source: 'traceability_source',
		unknown: 'canonical_markdown',
		validation_finding: 'validation_finding',
	};
	return (map[kind] ?? 'canonical_markdown') as ContextBundleSourceKind;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildObjectiveSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
	diagnostics: ContextBundleDiagnostic[],
): ContextBundleSection {
	const intentMap: Record<AgentPackKind, ContextBundleSectionItem['detail']> = {
		custom: 'custom',
		documentation: 'documentation',
		executive_task: 'executive_task',
		follow_up: 'follow_up',
		implementation: 'implementation',
		research: 'research',
		review: 'review',
		task: 'task',
	};

	const safeIntent = (
		typeof (intentMap as Record<string, unknown>)[planItem.packKind] ===
		'string'
			? (intentMap as Record<string, unknown>)[planItem.packKind]
			: 'unknown'
	) as string;

	const objectiveMissing = !planItem.title || planItem.title.length === 0;

	if (objectiveMissing) {
		diagnostics.push(
			createDiagnostic(
				'E_CTX_BUNDLE_OBJECTIVE_MISSING',
				'warning',
				`Pack "${planItem.packId}" has no explicit objective; bundle requires review`,
				{ sectionKind: 'objective' },
			),
		);
	}

	const detail = {
		affectedDocumentIds: planItem.canonicalSourceDocumentIds,
		affectedPhaseIds: planItem.sourcePhaseIds,
		intent: safeIntent,
		objectiveMissing,
		outputPurpose: input.planItem.title,
		packKind: planItem.packKind,
		purpose:
			planItem.title ||
			`Bounded context bundle for ${planItem.packKind} agent pack`,
		targetArtifact: planItem.relativeOutputPath,
	};

	return {
		items: [
			{
				blocking: objectiveMissing,
				confidence: objectiveMissing ? 'low' : 'high',
				detail,
				id: `objective:${planItem.packId}`,
				label: 'Pack Objective',
				reviewRequired: objectiveMissing,
				sourceIds: planItem.canonicalSourceDocumentIds,
				sourcePaths: planItem.canonicalSourceOutputPaths,
				summary: planItem.title,
			},
		],
		kind: 'objective',
		omittedCount: 0,
		title: 'Objective',
		truncated: false,
	};
}

function buildSourceDocumentsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const docId of planItem.canonicalSourceDocumentIds) {
		const meta = input.canonicalDocumentMeta.get(docId);
		const sourcePath =
			meta?.sourcePath ??
			planItem.canonicalSourceOutputPaths.find((p) => p.includes(docId));

		items.push({
			blocking: false,
			confidence: 'high',
			detail: {
				phaseId: meta?.phaseId,
				sourcePath,
				stalenessStatus: meta?.stalenessStatus,
				title: meta?.title,
				validationStatus: meta?.validationStatus,
			},
			id: `source-doc:${docId}`,
			label: meta?.title ?? docId,
			reviewRequired: false,
			sourceIds: [docId],
			sourcePaths: sourcePath ? [sourcePath] : [],
			summary: meta?.title ?? docId,
		});
	}

	// Include source kind-level references from plan item sources
	for (const src of planItem.sources) {
		if (src.sourceKind !== 'canonical_markdown') {
			items.push({
				blocking: false,
				confidence: 'high',
				detail: {
					outputPath: src.outputPath,
					phaseId: src.phaseId,
					sourceKind: src.sourceKind,
					status: src.status,
				},
				id: `source-ref:${src.sourceId}`,
				label: src.label ?? src.sourceId,
				reviewRequired: false,
				sourceIds: [src.sourceId],
				sourcePaths: src.outputPath ? [src.outputPath] : [],
				summary: `${src.sourceKind}: ${src.label ?? src.sourceId}`,
			});
		}
	}

	return {
		items,
		kind: 'source_documents',
		omittedCount: 0,
		title: 'Source Documents',
		truncated: false,
	};
}

function buildSourcePathsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const path of planItem.canonicalSourceOutputPaths) {
		// Reject path traversal
		let safePath = path;
		if (path.includes('..')) {
			safePath = sanitizePortablePath(path);
		}
		items.push({
			blocking: false,
			confidence: 'high',
			detail: { path: safePath },
			id: `source-path:${safePath}`,
			label: safePath,
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [safePath],
			summary: safePath,
		});
	}

	for (const docId of planItem.canonicalSourceDocumentIds) {
		const meta = input.canonicalDocumentMeta.get(docId);
		if (
			meta?.sourcePath &&
			!planItem.canonicalSourceOutputPaths.includes(meta.sourcePath)
		) {
			items.push({
				blocking: false,
				confidence: 'high',
				detail: { path: meta.sourcePath },
				id: `source-path-meta:${docId}`,
				label: meta.sourcePath,
				reviewRequired: false,
				sourceIds: [],
				sourcePaths: [meta.sourcePath],
				summary: meta.sourcePath,
			});
		}
	}

	return {
		items,
		kind: 'source_paths',
		omittedCount: 0,
		title: 'Source Paths',
		truncated: false,
	};
}

function buildConstraintsSection(
	_planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items: ContextBundleSectionItem[] = [];

	// Default LOGOS constraints (always included)
	const defaultConstraints: Array<{
		id: string;
		label: string;
		description: string;
	}> = [
		{
			description:
				'Operate within the local repository. No hosted services or external sync.',
			id: 'constraint:local-first',
			label: 'Local-First Operation',
		},
		{
			description:
				'Do not persist raw provider tokens, raw prompts, or raw model responses.',
			id: 'constraint:no-raw-token',
			label: 'No Raw Token Persistence',
		},
		{
			description:
				'Canonical Markdown documents and structured workspace state are the source of truth.',
			id: 'constraint:canonical-truth',
			label: 'Canonical Markdown is Source of Truth',
		},
		{
			description:
				'HTML, agent packs, validation reports, and graph artifacts are derived and regenerable.',
			id: 'constraint:derived-artifacts',
			label: 'Derived Artifacts are Not Canonical',
		},
		{
			description:
				'Do not read or include arbitrary unrelated repository files.',
			id: 'constraint:no-unrelated-files',
			label: 'No Unrelated Repository File Access',
		},
		{
			description: 'No live AI provider calls or external network requests.',
			id: 'constraint:no-live-ai',
			label: 'No Live AI Provider Calls',
		},
	];

	for (const dc of defaultConstraints) {
		items.push({
			blocking: false,
			confidence: 'high',
			detail: dc,
			id: dc.id,
			label: dc.label,
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary: dc.description,
		});
	}

	// Profile-level constraints
	for (const c of input.profileConstraints) {
		items.push({
			blocking: false,
			confidence: 'high',
			detail: {
				description: c,
				id: `constraint:profile:${items.length}`,
				label: 'Profile constraint',
			},
			id: `constraint:profile:${items.length}`,
			label: 'Profile constraint',
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary: c,
		});
	}

	// Descriptor constraints
	for (const [docId, constraints] of input.descriptorConstraints) {
		for (const c of constraints) {
			items.push({
				blocking: false,
				confidence: 'high',
				detail: {
					description: c,
					documentId: docId,
					id: `constraint:desc:${docId}:${items.length}`,
					label: 'Document constraint',
				},
				id: `constraint:desc:${docId}:${items.length}`,
				label: `${docId} constraint`,
				reviewRequired: false,
				sourceIds: [docId],
				sourcePaths: [],
				summary: c,
			});
		}
	}

	return {
		items,
		kind: 'constraints',
		omittedCount: 0,
		title: 'Constraints',
		truncated: false,
	};
}

function buildRequirementsSection(
	planItem: AgentPackPlanItem,
	_input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	// Requirements come from plan item sources that are required
	for (const src of planItem.sources) {
		if (src.required) {
			items.push({
				blocking: false,
				confidence: 'high',
				detail: {
					blocked: false,
					description: `Required source: ${src.sourceKind}`,
					id: `req:${src.sourceId}`,
					label: src.label ?? src.sourceId,
					missing: src.status === 'missing' || src.status === 'blocked',
					phaseId: src.phaseId,
					sourceDocumentId: src.documentCanonicalId,
				},
				id: `req:${src.sourceId}`,
				label: `Required source: ${src.sourceKind}`,
				reviewRequired: false,
				sourceIds: [src.sourceId],
				sourcePaths: src.outputPath ? [src.outputPath] : [],
				summary: `Required source "${src.sourceKind}" for "${planItem.packId}"`,
			});
		}
	}

	return {
		items,
		kind: 'requirements',
		omittedCount: 0,
		title: 'Requirements',
		truncated: false,
	};
}

function buildRequiredChangesSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
	diagnostics: ContextBundleDiagnostic[],
): ContextBundleSection {
	const items = [];

	if (input.requiredChanges.length === 0) {
		diagnostics.push(
			createDiagnostic(
				'E_CTX_BUNDLE_NO_REQUIRED_CHANGES',
				'info',
				`No explicit required changes declared for "${planItem.packId}"; downstream agent should review objectives`,
				{ sectionKind: 'required_changes' },
			),
		);
		items.push({
			blocking: false,
			confidence: 'low',
			detail: {
				blocked: false,
				description:
					'No explicit required changes provided. Review pack objective and source documents.',
				id: 'change:unknown',
				label: 'No explicit changes declared',
				sourceId: undefined,
				unknown: true,
			},
			id: 'change:unknown',
			label: 'Required changes unknown',
			reviewRequired: true,
			sourceIds: [],
			sourcePaths: [],
			summary: 'No explicit required changes declared',
		});
	} else {
		for (const rc of input.requiredChanges) {
			items.push({
				blocking: rc.blocked,
				confidence: rc.unknown ? 'low' : 'high',
				detail: rc,
				id: rc.id,
				label: rc.label,
				reviewRequired: rc.unknown,
				sourceIds: rc.sourceId ? [rc.sourceId] : [],
				sourcePaths: [],
				summary: rc.description,
			});
		}
	}

	return {
		items,
		kind: 'required_changes',
		omittedCount: 0,
		title: 'Required Changes',
		truncated: false,
	};
}

function buildAcceptanceCriteriaSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const docId of planItem.canonicalSourceDocumentIds) {
		const criteria = input.acceptanceCriteria.get(docId);
		if (criteria !== undefined) {
			for (const ac of criteria) {
				items.push({
					blocking: false,
					confidence: 'high',
					detail: ac,
					id: ac.id,
					label: ac.label,
					reviewRequired: false,
					sourceIds: ac.sourceDocumentId ? [ac.sourceDocumentId] : [],
					sourcePaths: [],
					summary: ac.description,
				});
			}
		}
	}

	return {
		items,
		kind: 'acceptance_criteria',
		omittedCount: 0,
		title: 'Acceptance Criteria',
		truncated: false,
	};
}

function buildNonGoalsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	// Default non-goals
	const defaultNonGoals: Array<{
		id: string;
		label: string;
		description: string;
		reason?: string;
	}> = [
		{
			description: 'No live AI provider calls or external network requests.',
			id: 'non-goal:live-ai',
			label: 'No Live AI',
		},
		{
			description:
				'No external service sync (Linear, Notion, GitHub bidirectional sync).',
			id: 'non-goal:external-sync',
			label: 'No External Sync',
		},
		{
			description:
				'No mutation of canonical Markdown or workspace state by this bundle.',
			id: 'non-goal:canonical-mutation',
			label: 'No Canonical Mutation',
		},
	];

	for (const ng of defaultNonGoals) {
		items.push({
			blocking: false,
			confidence: 'high',
			detail: {
				description: ng.description,
				id: ng.id,
				label: ng.label,
				reason: ng.reason,
			},
			id: ng.id,
			label: ng.label,
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary: ng.description,
		});
	}

	// Input-specified non-goals
	for (const ng of input.nonGoals) {
		items.push({
			blocking: false,
			confidence: 'high',
			detail: {
				description: ng.description,
				id: ng.id,
				label: ng.label,
				reason: ng.reason,
			},
			id: ng.id,
			label: ng.label,
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary: ng.description,
		});
	}

	// Pack kind-specific non-goals
	const packKindNonGoals: Record<
		string,
		Array<{ id: string; label: string; description: string }>
	> = {
		executive_task: [
			{
				description:
					'Do not compile Executive Axis. Bundles are derived from normative baseline only.',
				id: 'non-goal:executive-compile',
				label: 'No Executive Axis Compilation',
			},
		],
		research: [
			{
				description:
					'Do not perform external research. Research packs describe research objectives only.',
				id: 'non-goal:external-research',
				label: 'No External Research Performed',
			},
		],
	};

	const kindNonGoals = packKindNonGoals[planItem.packKind];
	if (kindNonGoals) {
		for (const ng of kindNonGoals) {
			items.push({
				blocking: false,
				confidence: 'high',
				detail: { description: ng.description, id: ng.id, label: ng.label },
				id: ng.id,
				label: ng.label,
				reviewRequired: false,
				sourceIds: [],
				sourcePaths: [],
				summary: ng.description,
			});
		}
	}

	return {
		items,
		kind: 'non_goals',
		omittedCount: 0,
		title: 'Non-Goals',
		truncated: false,
	};
}

function buildDecisionsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	// Filter decisions relevant to this pack
	for (const dec of input.registerData.decisions) {
		// Include if decision affects any of the canonical document IDs
		const isRelevant =
			planItem.requiredDecisionIds.includes(dec.id) ||
			dec.affectedDocumentIds.some((did) =>
				planItem.canonicalSourceDocumentIds.includes(did),
			);

		if (isRelevant) {
			items.push({
				blocking: false,
				confidence: 'high',
				detail: {
					affectedDocumentIds: dec.affectedDocumentIds,
					affectedPhaseIds: dec.affectedPhaseIds,
					id: dec.id,
					reviewRequired: dec.reviewRequired,
					sourceIds: dec.sourceIds,
					status: dec.status,
					summary: dec.summary,
				} satisfies ContextBundle['sections'][number]['items'][number]['detail'],
				id: `decision:${dec.id}`,
				label: `Decision: ${dec.id}`,
				reviewRequired: dec.reviewRequired,
				sourceIds: dec.sourceIds,
				sourcePaths: [],
				summary: dec.summary,
			});
		}
	}

	return {
		items,
		kind: 'decisions',
		omittedCount: 0,
		title: 'Decisions',
		truncated: false,
	};
}

function buildAssumptionsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const asm of input.registerData.assumptions) {
		const isRelevant =
			planItem.requiredAssumptionIds.includes(asm.id) ||
			asm.sourceIds.some((sid) => planItem.requiredDecisionIds.includes(sid));

		if (isRelevant) {
			items.push({
				blocking: false,
				confidence: asm.confidence ?? 'medium',
				detail: {
					confidence: asm.confidence,
					id: asm.id,
					reviewRequired: asm.reviewRequired,
					sourceIds: asm.sourceIds,
					status: asm.status,
					summary: asm.summary,
				},
				id: `assumption:${asm.id}`,
				label: `Assumption: ${asm.id}`,
				reviewRequired: asm.reviewRequired,
				sourceIds: asm.sourceIds,
				sourcePaths: [],
				summary: asm.summary,
			});
		}
	}

	return {
		items,
		kind: 'assumptions',
		omittedCount: 0,
		title: 'Assumptions',
		truncated: false,
	};
}

function buildHypothesesSection(
	_planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const hyp of input.registerData.hypotheses) {
		items.push({
			blocking: false,
			confidence: 'medium',
			detail: {
				evidenceSourceIds: hyp.evidenceSourceIds,
				expectedSignal: hyp.expectedSignal,
				id: hyp.id,
				status: hyp.status,
				summary: hyp.summary,
			},
			id: `hypothesis:${hyp.id}`,
			label: `Hypothesis: ${hyp.id}`,
			reviewRequired: false,
			sourceIds: hyp.evidenceSourceIds,
			sourcePaths: [],
			summary: hyp.summary,
		});
	}

	return {
		items,
		kind: 'hypotheses',
		omittedCount: 0,
		title: 'Hypotheses',
		truncated: false,
	};
}

function buildRisksSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const risk of input.registerData.risks) {
		const isRelevant =
			planItem.requiredRiskIds.includes(risk.id) ||
			risk.affectedDocumentIds.some((did) =>
				planItem.canonicalSourceDocumentIds.includes(did),
			);

		if (isRelevant) {
			items.push({
				blocking: risk.status === 'blocking' || risk.status === 'active',
				confidence: risk.likelihood === 'high' ? 'low' : 'medium',
				detail: {
					affectedDocumentIds: risk.affectedDocumentIds,
					affectedPhaseIds: risk.affectedPhaseIds,
					id: risk.id,
					impact: risk.impact,
					likelihood: risk.likelihood,
					mitigation: risk.mitigation,
					status: risk.status,
					summary: risk.summary,
				},
				id: `risk:${risk.id}`,
				label: `Risk: ${risk.id}`,
				reviewRequired: false,
				sourceIds: [],
				sourcePaths: [],
				summary: risk.summary,
			});
		}
	}

	return {
		items,
		kind: 'risks',
		omittedCount: 0,
		title: 'Risks',
		truncated: false,
	};
}

function buildOpenQuestionsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const oq of input.registerData.openQuestions) {
		const isRelevant =
			planItem.requiredOpenQuestionIds.includes(oq.id) ||
			oq.affectedDocumentIds.some((did) =>
				planItem.canonicalSourceDocumentIds.includes(did),
			);

		if (isRelevant) {
			items.push({
				blocking: oq.blocking,
				confidence: 'low',
				detail: {
					affectedDocumentIds: oq.affectedDocumentIds,
					affectedPhaseIds: oq.affectedPhaseIds,
					blocking: oq.blocking,
					id: oq.id,
					status: oq.status,
					summary: oq.summary,
					whyItMatters: oq.whyItMatters,
				},
				id: `open-question:${oq.id}`,
				label: `Open Question: ${oq.id}`,
				reviewRequired: true,
				sourceIds: [],
				sourcePaths: [],
				summary: oq.summary,
			});
		}
	}

	return {
		items,
		kind: 'open_questions',
		omittedCount: 0,
		title: 'Open Questions',
		truncated: false,
	};
}

function buildValidationFindingsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const vf of input.validationFindings) {
		const isRelevant =
			planItem.requiredValidationFindingIds.includes(vf.id) ||
			(vf.documentCanonicalId !== undefined &&
				planItem.canonicalSourceDocumentIds.includes(vf.documentCanonicalId));

		if (isRelevant) {
			items.push({
				blocking: vf.releaseBlocking || vf.severity === 'error',
				confidence: 'high',
				detail: vf,
				id: `validation:${vf.id}`,
				label: `[${vf.severity}] ${vf.code}: ${vf.message}`,
				reviewRequired: false,
				sourceIds: vf.relatedSourceIds,
				sourcePaths: [],
				summary: vf.message,
			});
		}
	}

	return {
		items,
		kind: 'validation_findings',
		omittedCount: 0,
		title: 'Validation Findings',
		truncated: false,
	};
}

function buildConsistencyFindingsSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const cf of input.consistencyFindings) {
		const isRelevant =
			(cf.documentCanonicalId !== undefined &&
				planItem.canonicalSourceDocumentIds.includes(cf.documentCanonicalId)) ||
			(cf.phaseId !== undefined &&
				planItem.sourcePhaseIds.includes(cf.phaseId));

		if (isRelevant) {
			items.push({
				blocking: cf.releaseBlocking || cf.severity === 'error',
				confidence: 'high',
				detail: cf,
				id: `consistency:${cf.id}`,
				label: `[${cf.severity}] ${cf.code}: ${cf.message}`,
				reviewRequired: false,
				sourceIds: [],
				sourcePaths: [],
				summary: cf.message,
			});
		}
	}

	return {
		items,
		kind: 'consistency_findings',
		omittedCount: 0,
		title: 'Consistency Findings',
		truncated: false,
	};
}

function buildTraceabilitySection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
): ContextBundleSection {
	const items = [];

	for (const te of input.traceabilityEntries) {
		const isRelevant =
			planItem.requiredTraceabilitySourceIds.includes(te.id) ||
			(te.sourceId !== undefined &&
				planItem.requiredTraceabilitySourceIds.includes(te.sourceId));

		if (isRelevant) {
			items.push({
				blocking: te.missingSource,
				confidence: te.confidence ?? (te.missingSource ? 'low' : 'medium'),
				detail: te,
				id: `traceability:${te.id}`,
				label: `Traceability: ${te.id}`,
				reviewRequired: te.reviewRequired,
				sourceIds: te.sourceId ? [te.sourceId] : [],
				sourcePaths: te.sourcePath ? [te.sourcePath] : [],
				summary: `${te.boundary} ${te.reviewRequired ? '(review required)' : ''} ${te.missingSource ? '(missing source)' : ''}`,
			});
		}
	}

	// If no traceability entries, add a marker
	if (items.length === 0 && planItem.requiredTraceabilitySourceIds.length > 0) {
		for (const tsId of planItem.requiredTraceabilitySourceIds) {
			items.push({
				blocking: false,
				confidence: 'low',
				detail: {
					boundary: 'unknown',
					confidence: 'low',
					id: tsId,
					missingSource: true,
					reviewRequired: true,
					sourceReference: undefined,
				},
				id: `traceability:${tsId}`,
				label: `Traceability source: ${tsId} (missing)`,
				reviewRequired: true,
				sourceIds: [tsId],
				sourcePaths: [],
				summary: `Required traceability source "${tsId}" is missing from bundle input`,
			});
		}
	}

	return {
		items,
		kind: 'traceability',
		omittedCount: 0,
		title: 'Traceability',
		truncated: false,
	};
}

function buildReadinessSection(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
	bundleStatus: ContextBundleStatus,
): ContextBundleSection {
	const blockers: unknown[] = [];
	const warnings: unknown[] = [];

	for (const b of planItem.blockers) {
		blockers.push({ code: b.code, message: b.message, severity: b.severity });
	}
	for (const r of planItem.reasons) {
		if (r.severity === 'warning' || r.severity === 'info') {
			warnings.push({ code: r.code, message: r.message, severity: r.severity });
		}
	}

	// Count unresolved blocking questions
	let unresolvedBlockingCount = 0;
	for (const oq of input.registerData.openQuestions) {
		if (oq.blocking && oq.status !== 'resolved' && oq.status !== 'closed') {
			unresolvedBlockingCount += 1;
		}
	}

	// Count missing sources
	const missingSourceCount = planItem.sources.filter(
		(s) => s.status === 'missing' || s.status === 'blocked',
	).length;

	// Count stale sources
	const staleSourceCount = planItem.sources.filter(
		(s) => s.status === 'stale',
	).length;

	const detail = {
		blockers,
		bundleStatus,
		consistencyGateStatus:
			input.consistencyFindings.length === 0 ? 'pass' : 'fail',
		expectedOutputPath: planItem.relativeOutputPath,
		missingSourceCount,
		packReadinessStatus: planItem.status,
		planItemId: planItem.packId,
		reviewRequiredCount: planItem.sources.filter(
			(s) => s.status === 'requires_review',
		).length,
		sourceOfTruthWarning: planItem.sourceOfTruthWarning,
		staleSourceCount,
		unresolvedBlockingCount,
		validationGateStatus:
			input.validationFindings.length === 0 ? 'pass' : 'fail',
		warnings,
	};

	return {
		items: [
			{
				blocking: bundleStatus === 'blocked',
				confidence:
					bundleStatus === 'ready'
						? 'high'
						: bundleStatus === 'blocked'
							? 'low'
							: 'medium',
				detail,
				id: `readiness:${planItem.packId}`,
				label: `Readiness: ${bundleStatus}`,
				reviewRequired: bundleStatus === 'requires_review',
				sourceIds: [],
				sourcePaths: [],
				summary: `Bundle status: ${bundleStatus}. Plan item status: ${planItem.status}.`,
			},
		],
		kind: 'readiness',
		omittedCount: 0,
		title: 'Readiness',
		truncated: false,
	};
}

function buildExpectedOutputsSection(
	planItem: AgentPackPlanItem,
	diagnostics: ContextBundleDiagnostic[],
): ContextBundleSection {
	const detail = {
		derivedExecutionAidLabel:
			'This bundle is a derived execution aid for downstream agents.',
		expectedFormat: 'markdown',
		expectedOutputKind: 'agent_pack',
		expectedOutputPath: planItem.relativeOutputPath,
		isNonCanonical: true,
		noFinalWriteReminder:
			'Final agent-pack rendering and file writing is performed in Step 10.3, not by this bundle builder.',
		nonCanonicalWarning:
			'This bundle is NOT canonical. Always consult source-of-truth canonical Markdown, workspace state, and profile contracts.',
		scopeWarning:
			'Downstream agents must NOT mutate files outside the pack scope. Unrelated repository files must remain untouched.',
	};

	diagnostics.push(
		createDiagnostic(
			'E_CTX_BUNDLE_NO_RENDER',
			'info',
			'Bundle builder does not render or write agent-pack files. Step 10.3 handles rendering.',
			{ sectionKind: 'expected_outputs' },
		),
	);

	return {
		items: [
			{
				blocking: false,
				confidence: 'high',
				detail,
				id: `expected-output:${planItem.packId}`,
				label: 'Expected Output',
				reviewRequired: false,
				sourceIds: [],
				sourcePaths: [planItem.relativeOutputPath],
				summary: `Agent pack: ${planItem.relativeOutputPath}`,
			},
		],
		kind: 'expected_outputs',
		omittedCount: 0,
		title: 'Expected Outputs',
		truncated: false,
	};
}

function buildBlockedItemsSection(
	planItem: AgentPackPlanItem,
): ContextBundleSection {
	const items: ContextBundleSection['items'] = [];

	for (const blocker of planItem.blockers) {
		items.push({
			blocking: true,
			confidence: 'high',
			detail: blocker,
			id: `blocked:${blocker.code}:${blocker.message.slice(0, 30)}`,
			label: `[${blocker.severity}] ${blocker.code}`,
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: blocker.sourcePath ? [blocker.sourcePath] : [],
			summary: blocker.message,
		});
	}

	return {
		items,
		kind: 'blocked_items',
		omittedCount: 0,
		title: 'Blocked Items',
		truncated: false,
	};
}

function buildOutOfScopeSection(): ContextBundleSection {
	const items = [
		{
			blocking: false,
			confidence: 'high',
			detail: {
				description:
					'Arbitrary repository files not referenced by the plan item or its declared sources.',
				id: 'out-of-scope:arbitrary-files',
			},
			id: 'out-of-scope:arbitrary-files',
			label: 'Unrelated repository files',
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary: 'Files not referenced by the plan item are excluded by default',
		},
		{
			blocking: false,
			confidence: 'high',
			detail: {
				description:
					'Raw provider tokens, raw prompts, raw model responses, authorization headers, environment values, and private chat history.',
				id: 'out-of-scope:secrets',
			},
			id: 'out-of-scope:secrets',
			label: 'Sensitive data and secrets',
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary:
				'Secrets, tokens, raw prompts, and private chat history are redacted',
		},
		{
			blocking: false,
			confidence: 'high',
			detail: {
				description:
					'External web content, fetched URLs, or remote API responses.',
				id: 'out-of-scope:external-fetched',
			},
			id: 'out-of-scope:external-fetched',
			label: 'External fetched content',
			reviewRequired: false,
			sourceIds: [],
			sourcePaths: [],
			summary: 'No external fetched content is included',
		},
	];

	return {
		items,
		kind: 'out_of_scope',
		omittedCount: 0,
		title: 'Out of Scope',
		truncated: false,
	};
}

function buildDiagnosticsSection(
	diagnostics: ContextBundleDiagnostic[],
): ContextBundleSection {
	const items = diagnostics.map((d) => ({
		blocking: d.severity === 'error',
		confidence: 'high',
		detail: d,
		id: `diag:${d.code}:${d.message.slice(0, 30)}`,
		label: `[${d.severity}] ${d.code}`,
		reviewRequired: false,
		sourceIds: [],
		sourcePaths: d.sourcePath ? [d.sourcePath] : [],
		summary: d.message,
	}));

	return {
		items,
		kind: 'diagnostics',
		omittedCount: 0,
		title: 'Diagnostics',
		truncated: false,
	};
}

// ---------------------------------------------------------------------------
// Bundle status determination
// ---------------------------------------------------------------------------

function determineBundleStatus(
	planItem: AgentPackPlanItem,
	input: ContextBundleInput,
	diagnostics: ContextBundleDiagnostic[],
	blockers: ContextBundleBlocker[],
): ContextBundleStatus {
	// Blocked if plan item is blocked
	if (planItem.status === 'blocked') {
		return 'blocked';
	}

	// Blocked if there are release-blocking validation findings
	for (const vf of input.validationFindings) {
		if (vf.releaseBlocking) {
			const isRelevant =
				planItem.requiredValidationFindingIds.includes(vf.id) ||
				(vf.documentCanonicalId !== undefined &&
					planItem.canonicalSourceDocumentIds.includes(vf.documentCanonicalId));
			if (isRelevant) {
				blockers.push(
					createBlocker(
						'ctx_bundle_release_blocking_validation',
						'error',
						`Release-blocking validation finding "${vf.code}" affects bundle scope`,
						{
							recoveryHint: vf.recoveryHint,
							sectionKind: 'validation_findings',
						},
					),
				);
				return 'blocked';
			}
		}
	}

	// Blocked if there are release-blocking consistency findings
	for (const cf of input.consistencyFindings) {
		if (cf.releaseBlocking) {
			const isRelevant =
				(cf.documentCanonicalId !== undefined &&
					planItem.canonicalSourceDocumentIds.includes(
						cf.documentCanonicalId,
					)) ||
				(cf.phaseId !== undefined &&
					planItem.sourcePhaseIds.includes(cf.phaseId));
			if (isRelevant) {
				blockers.push(
					createBlocker(
						'ctx_bundle_release_blocking_consistency',
						'error',
						`Release-blocking consistency finding "${cf.code}" affects bundle scope`,
						{
							recoveryHint: cf.recoveryHint,
							sectionKind: 'consistency_findings',
						},
					),
				);
				return 'blocked';
			}
		}
	}

	// Blocked if there are unresolved blocking open questions
	let blockingOpenQuestionCount = 0;
	for (const oq of input.registerData.openQuestions) {
		const isRelevant =
			planItem.requiredOpenQuestionIds.includes(oq.id) ||
			oq.affectedDocumentIds.some((did) =>
				planItem.canonicalSourceDocumentIds.includes(did),
			);
		if (
			isRelevant &&
			oq.blocking &&
			oq.status !== 'resolved' &&
			oq.status !== 'closed'
		) {
			blockingOpenQuestionCount += 1;
		}
	}
	if (blockingOpenQuestionCount > 0) {
		blockers.push(
			createBlocker(
				'ctx_bundle_blocking_open_questions',
				'error',
				`${blockingOpenQuestionCount} unresolved blocking open question(s) affect bundle scope`,
				{
					recoveryHint: 'Resolve or acknowledge blocking open questions',
					sectionKind: 'open_questions',
				},
			),
		);
		return 'blocked';
	}

	// Requires review if plan item requires review
	if (planItem.status === 'requires_review' || planItem.status === 'stale') {
		return 'requires_review';
	}

	// Requires review if traceability has review-required items
	let reviewRequiredTraceability = false;
	for (const te of input.traceabilityEntries) {
		if (te.reviewRequired) {
			const isRelevant =
				planItem.requiredTraceabilitySourceIds.includes(te.id) ||
				(te.sourceId !== undefined &&
					planItem.requiredTraceabilitySourceIds.includes(te.sourceId));
			if (isRelevant) {
				reviewRequiredTraceability = true;
				break;
			}
		}
	}
	if (reviewRequiredTraceability && planItem.status === 'ready') {
		diagnostics.push(
			createDiagnostic(
				'E_CTX_BUNDLE_REVIEW_REQUIRED',
				'warning',
				'Traceability sources require review; bundle marked requires_review',
				{ sectionKind: 'traceability' },
			),
		);
		return 'requires_review';
	}

	// Unknown if missing metadata
	if (planItem.status === 'missing_source' || planItem.status === 'unknown') {
		if (planItem.status === 'missing_source') {
			diagnostics.push(
				createDiagnostic(
					'E_CTX_BUNDLE_MISSING_SOURCE',
					'warning',
					`Plan item "${planItem.packId}" has missing source documents`,
					{ recoveryHint: 'Generate canonical documents and re-plan' },
				),
			);
		}
		return planItem.status === 'missing_source' ? 'blocked' : 'unknown';
	}

	// Otherwise ready
	return 'ready';
}

// ---------------------------------------------------------------------------
// Main builder function
// ---------------------------------------------------------------------------

export function buildBoundedContextBundle(
	input: ContextBundleInput,
	options?: ContextBundleOptions,
): ContextBundleResult {
	const diagnostics: ContextBundleDiagnostic[] = [];
	const blockers: ContextBundleBlocker[] = [];
	const redactionSummary: ContextBundleRedactionSummary = {
		kinds: [],
		redactedCount: 0,
		sectionsAffected: [],
	};

	// Resolve options
	const resolvedScope = { ...DEFAULT_SCOPE_OPTIONS, ...options?.scope };
	const resolvedBudget = { ...DEFAULT_SIZE_BUDGET, ...options?.sizeBudget };

	// Validate minimal input
	if (!input.planItem.packId) {
		diagnostics.push(
			createDiagnostic(
				'E_CTX_BUNDLE_INVALID_INPUT',
				'error',
				'Plan item has no pack ID',
				{ recoveryHint: 'Provide a valid AgentPackPlanItem' },
			),
		);
	}

	// Build all sections
	const sections: ContextBundleSection[] = [];

	// Determine bundle status first so it can feed into readiness
	const status = determineBundleStatus(
		input.planItem,
		input,
		diagnostics,
		blockers,
	);

	sections.push(buildObjectiveSection(input.planItem, input, diagnostics));
	sections.push(buildSourceDocumentsSection(input.planItem, input));
	sections.push(buildSourcePathsSection(input.planItem, input));
	sections.push(buildConstraintsSection(input.planItem, input));
	sections.push(buildRequirementsSection(input.planItem, input));
	sections.push(
		buildRequiredChangesSection(input.planItem, input, diagnostics),
	);
	sections.push(buildAcceptanceCriteriaSection(input.planItem, input));
	sections.push(buildNonGoalsSection(input.planItem, input));
	sections.push(buildDecisionsSection(input.planItem, input));
	sections.push(buildAssumptionsSection(input.planItem, input));
	sections.push(buildHypothesesSection(input.planItem, input));
	sections.push(buildRisksSection(input.planItem, input));
	sections.push(buildOpenQuestionsSection(input.planItem, input));
	sections.push(buildValidationFindingsSection(input.planItem, input));
	sections.push(buildConsistencyFindingsSection(input.planItem, input));
	sections.push(buildTraceabilitySection(input.planItem, input));
	sections.push(buildReadinessSection(input.planItem, input, status));
	sections.push(buildExpectedOutputsSection(input.planItem, diagnostics));
	sections.push(buildBlockedItemsSection(input.planItem));
	sections.push(buildOutOfScopeSection());
	sections.push(buildDiagnosticsSection(diagnostics));

	// Apply redaction to all sections
	const redactedSections = sections.map((s) =>
		redactSectionItems(s, s.kind, redactionSummary),
	);

	// Collect sources
	const sources = collectSources(
		input.planItem,
		input,
		resolvedScope.includeContentExcerpts,
		resolvedBudget,
	);

	// Apply redaction to sources
	const redactedSources = sources.map((src) => ({
		...src,
		contentExcerpt: src.contentExcerpt
			? redactContent(src.contentExcerpt, redactionSummary)
			: undefined,
		label: src.label ? redactContent(src.label, redactionSummary) : undefined,
		title: src.title ? redactContent(src.title, redactionSummary) : undefined,
	}));

	// Enforce size budget
	const sizeSummary: ContextBundleSizeSummary = {
		approximateCharacterCount: 0,
		sectionCount: 0,
		sectionsTruncated: [],
		totalItemCount: 0,
		totalOmittedItems: 0,
	};

	const budgetedSections = enforceSizeBudget(
		redactedSections,
		resolvedBudget,
		diagnostics,
		sizeSummary,
	);

	// Build metadata
	const generatedAt = options?.generatedAtOverride ?? input.generatedAt;
	const bundleId =
		options?.bundleId ?? generateBundleId(input.planItem, generatedAt);

	const metadata: ContextBundleMetadata = {
		affectedDocumentIds: input.planItem.canonicalSourceDocumentIds,
		artifactRoot: input.artifactRoot,
		bundleId,
		canonicalSourceDocumentIds: input.planItem.canonicalSourceDocumentIds,
		canonicalSourcePaths: input.planItem.canonicalSourceOutputPaths,
		changedPaths: [],
		consistencyFindingCount: input.consistencyFindings.length,
		documentationRoot: input.documentationRoot,
		generatedAt,
		isDerivedExecutionAid: true,
		isNonCanonical: true,
		isReadOnly: true,
		missingSourceCount:
			input.planItem.sources.filter(
				(s: AgentPackSource) =>
					s.status === 'missing' || s.status === 'blocked',
			).length + input.planItem.blockers.length,
		packId: input.planItem.packId,
		packKind: input.planItem.packKind,
		planItemId: input.planItem.packId,
		profileId: input.profileId,
		profileVersion: input.profileVersion,
		redactionSummary,
		registerItemCount:
			input.registerData.decisions.length +
			input.registerData.assumptions.length +
			input.registerData.hypotheses.length +
			input.registerData.risks.length +
			input.registerData.openQuestions.length,
		reviewRequiredCount:
			input.traceabilityEntries.filter((te) => te.reviewRequired).length +
			input.registerData.assumptions.filter((a) => a.reviewRequired).length +
			input.registerData.decisions.filter((d) => d.reviewRequired).length,
		sizeSummary,
		sourceCount: sources.length,
		sourcePhaseIds: input.planItem.sourcePhaseIds,
		unresolvedQuestionCount: input.registerData.openQuestions.filter(
			(oq) => oq.status !== 'resolved' && oq.status !== 'closed',
		).length,
		validationFindingCount: input.validationFindings.length,
	};

	const bundle: ContextBundle = {
		blockers,
		bundleId,
		diagnostics,
		metadata,
		sections: budgetedSections,
		sources: redactedSources,
		status,
	};

	return { bundle, diagnostics };
}

// ---------------------------------------------------------------------------
// Sanitize helper: strip path traversal
// ---------------------------------------------------------------------------

function sanitizePortablePath(path: string): string {
	// Remove .. sequences, collapse, normalize
	return (
		path
			.replace(/\.\./g, '')
			.replace(/\/{2,}/g, '/')
			.replace(/^\/+/, '')
			.replace(/\/+$/, '') || '.'
	);
}
