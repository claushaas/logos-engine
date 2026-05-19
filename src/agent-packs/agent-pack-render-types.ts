/** Step 10.3 — Agent Pack Renderer types and contracts */

import type { SafeWriteChangedPath } from '../fs/safe-filesystem.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type { AgentPackKind, AgentPackPlanItem } from './agent-pack-types.js';
import type { ContextBundle } from './context-bundle-model.js';

// ---------------------------------------------------------------------------
// Template Kinds
// ---------------------------------------------------------------------------

export type AgentPackTemplateKind =
	| 'coding_agent'
	| 'review_agent'
	| 'documentation_agent'
	| 'research_agent'
	| 'follow_up_agent'
	| 'task_agent'
	| 'executive_task_agent'
	| 'custom';

export const AGENT_PACK_TEMPLATE_KIND_ORDER: Record<
	AgentPackTemplateKind,
	number
> = {
	coding_agent: 0,
	custom: 7,
	documentation_agent: 2,
	executive_task_agent: 6,
	follow_up_agent: 4,
	research_agent: 3,
	review_agent: 1,
	task_agent: 5,
};

export function mapPackKindToTemplateKind(
	packKind: AgentPackKind,
): AgentPackTemplateKind {
	switch (packKind) {
		case 'review':
			return 'review_agent';
		case 'implementation':
			return 'coding_agent';
		case 'task':
			return 'task_agent';
		case 'documentation':
			return 'documentation_agent';
		case 'research':
			return 'research_agent';
		case 'follow_up':
			return 'follow_up_agent';
		case 'executive_task':
			return 'executive_task_agent';
		default:
			return 'custom';
	}
}

// ---------------------------------------------------------------------------
// Render Input / Options
// ---------------------------------------------------------------------------

export interface AgentPackRenderInput {
	bundle: ContextBundle;
	packTitle?: string | undefined;
	generatedAt: string;
	validateCommands?: string[] | undefined;
}

export interface AgentPackRenderOptions {
	allowBlockedBundle?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Rendered Markdown result
// ---------------------------------------------------------------------------

export interface AgentPackRenderedMarkdown {
	packId: string;
	packKind: AgentPackKind;
	templateKind: AgentPackTemplateKind;
	title: string;
	markdown: string;
	metadata: AgentPackRenderMetadata;
	diagnostics: AgentPackRenderDiagnostic[];
	securitySummary: AgentPackSecuritySummary;
	changedPaths: never[];
	readOnly: true;
}

// ---------------------------------------------------------------------------
// Render metadata
// ---------------------------------------------------------------------------

export interface AgentPackRenderMetadata {
	artifactType: 'agent_pack';
	canonical: false;
	derived: true;
	executionAid: true;
	packId: string;
	packKind: AgentPackKind;
	templateKind: AgentPackTemplateKind;
	sourceBundleId: string;
	profileId: string;
	profileVersion: string | undefined;
	generatedAt: string;
	sourceDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	logosItemId: string | undefined;
	traceabilitySourceIds: string[];
	registerItemIds: string[];
	validationStatus: string | undefined;
	readinessStatus: string | undefined;
	redactionSummary:
		| {
				redactedCount: number;
				kinds: string[];
		  }
		| undefined;
}

// ---------------------------------------------------------------------------
// Render diagnostic
// ---------------------------------------------------------------------------

export interface AgentPackRenderDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath: string | undefined;
	fieldPath: string | undefined;
	relatedPackId: string | undefined;
	relatedPackKind: AgentPackKind | undefined;
	relatedTemplateKind: AgentPackTemplateKind | undefined;
	relatedBundleId: string | undefined;
	relatedSourceDocumentId: CanonicalDocumentId | undefined;
	relatedPhaseId: PhaseId | undefined;
	relatedRegisterItemId: string | undefined;
	outputPath: string | undefined;
	expected: string | undefined;
	received: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Render result
// ---------------------------------------------------------------------------

export interface AgentPackRenderResult {
	rendered: AgentPackRenderedMarkdown;
	diagnostics: AgentPackRenderDiagnostic[];
}

// ---------------------------------------------------------------------------
// Security summary
// ---------------------------------------------------------------------------

export interface AgentPackSecuritySummary {
	redactionCount: number;
	forbiddenRawPromptCount: number;
	forbiddenModelResponseCount: number;
	tokenLikeValueCount: number;
	passed: boolean;
	blockReasons: string[];
}

// ---------------------------------------------------------------------------
// Template contracts
// ---------------------------------------------------------------------------

export interface AgentPackRenderSection {
	kind: AgentPackRenderSectionKind;
	title: string;
	content: string;
	sortOrder: number;
}

export type AgentPackRenderSectionKind =
	| 'metadata'
	| 'derived_warning'
	| 'objective'
	| 'scope'
	| 'source_documents'
	| 'constraints'
	| 'required_changes'
	| 'acceptance_criteria'
	| 'non_goals'
	| 'decisions'
	| 'assumptions'
	| 'hypotheses'
	| 'risks'
	| 'open_questions'
	| 'validation_findings'
	| 'consistency_findings'
	| 'traceability'
	| 'expected_outputs'
	| 'reporting_requirements'
	| 'diagnostics';

export const SECTION_SORT_ORDER: Record<AgentPackRenderSectionKind, number> = {
	acceptance_criteria: 7,
	assumptions: 9,
	consistency_findings: 11,
	constraints: 5,
	decisions: 8,
	derived_warning: 1,
	diagnostics: 14,
	expected_outputs: 12,
	hypotheses: 9, // shares slot with assumptions
	metadata: 0,
	non_goals: 6, // comes after acceptance criteria
	objective: 2,
	open_questions: 10,
	reporting_requirements: 13,
	required_changes: 6, // shares slot with non_goals
	risks: 10, // shares with open_questions
	scope: 3,
	source_documents: 4,
	traceability: 11,
	validation_findings: 11, // shares with traceability
};

export interface AgentPackTemplate {
	kind: AgentPackTemplateKind;
	render(input: {
		metadata: AgentPackRenderMetadata;
		objective: string;
		scope: string;
		sourceDocuments: string;
		constraints: string;
		requiredChanges: string;
		acceptanceCriteria: string;
		nonGoals: string;
		decisions: string;
		assumptions: string;
		hypotheses: string;
		risks: string;
		openQuestions: string;
		validationFindings: string;
		consistencyFindings: string;
		traceability: string;
		expectedOutputs: string;
		reportingRequirements: string;
		diagnostics: string;
	}): string;
}

// ---------------------------------------------------------------------------
// Generation types
// ---------------------------------------------------------------------------

export type AgentPackWritePolicy =
	| 'skip_existing'
	| 'fail_on_collision'
	| 'backup_and_write'
	| 'explicit_overwrite';

export type AgentPackGenerationStatus =
	| 'created'
	| 'updated'
	| 'skipped'
	| 'blocked'
	| 'stale'
	| 'requires_review'
	| 'failed';

export interface AgentPackGenerationItem {
	packId: string;
	packKind: AgentPackKind;
	templateKind: AgentPackTemplateKind;
	bundleId: string;
	status: AgentPackGenerationStatus;
	outputPath: string;
	relativeOutputPath: string;
	checksum: string | undefined;
	markdown: string | undefined;
	sourceDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	blockers: string[];
	reasons: string[];
	diagnostics: AgentPackRenderDiagnostic[];
	securitySummary: AgentPackSecuritySummary | undefined;
}

export interface AgentPackGenerationInput {
	planItems: AgentPackPlanItem[];
	bundles: ContextBundle[];
	profileId: string;
	profileVersion: string | undefined;
	documentationRoot: string;
	artifactRoot: string | undefined;
	generatedAt: string;
	dryRun: boolean;
	writePolicy: AgentPackWritePolicy;
	allowBlockedBundles: boolean;
	projectRoot?: string | undefined;
}

export interface AgentPackGenerationOptions {
	dryRun?: boolean;
	writePolicy?: AgentPackWritePolicy;
	allowBlockedBundles?: boolean;
	generatedAt?: string;
	projectRoot?: string;
	deterministicTimestamp?: string;
	deterministicRandomId?: string;
}

export interface AgentPackGenerationResult {
	profileId: string;
	documentationRoot: string;
	artifactRoot: string | undefined;
	dryRun: boolean;
	readOnly: boolean;
	items: AgentPackGenerationItem[];
	summaryCounts: Record<AgentPackGenerationStatus, number>;
	summaryByKind: Record<AgentPackTemplateKind, number>;
	createdPaths: string[];
	updatedPaths: string[];
	skippedPaths: string[];
	blockedPaths: string[];
	failedPaths: string[];
	artifactRegistryEntriesCreated: number;
	artifactRegistryEntriesUpdated: number;
	changedPaths: SafeWriteChangedPath[];
	diagnostics: AgentPackRenderDiagnostic[];
	securitySummary: AgentPackSecuritySummary;
	generatedAt: string;
}

export interface AgentPackArtifactRecord {
	artifactId: string;
	artifactType: 'agent_pack';
	packKind: AgentPackKind;
	templateKind: AgentPackTemplateKind;
	outputPath: string;
	bundleId: string;
	sourceDocumentIds: CanonicalDocumentId[];
	sourceCanonicalPaths: string[];
	profileId: string;
	profileVersion: string | undefined;
	generatedAt: string;
	checksum: string;
	generationRunId: string | undefined;
	isCanonical: false;
	isDerivedExecutionAid: true;
	status: AgentPackGenerationStatus;
	traceabilitySummary: string | undefined;
}

export type AgentPackChangedPath = {
	path: string;
	role: string;
};

export type AgentPackGenerationReport = {
	canonicalMarkdownCounts: Record<string, number> | undefined;
	htmlArtifactCounts: Record<string, number> | undefined;
	agentPackCounts: Record<AgentPackGenerationStatus, number>;
	agentPackByKind: Record<AgentPackTemplateKind, number>;
	agentPackCreatedPaths: string[];
	agentPackUpdatedPaths: string[];
	agentPackSkippedPaths: string[];
	agentPackBlockedPaths: string[];
	agentPackFailedPaths: string[];
	agentPackDryRun: boolean;
	agentPackSummary: string;
};
