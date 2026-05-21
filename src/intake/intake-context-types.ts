/** Intake Context Types — typed contracts for scoped intake context building */

import type { ContractGraph } from '../profiles/contract-graph.js';
import type { DocumentationContract } from '../profiles/documentation-contract.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import type { QuestionCluster } from './question-planner-types.js';

// ---------------------------------------------------------------------------
// Profile reference
// ---------------------------------------------------------------------------

export interface IntakeContextProfileReference {
	profileId: string;
	profileSource: string | undefined;
	profileVersion: string | undefined;
}

// ---------------------------------------------------------------------------
// Document reference
// ---------------------------------------------------------------------------

export interface IntakeContextDocumentReference {
	canonicalId: string;
	title: string;
	phaseId: string;
	phaseTitle: string | undefined;
	descriptorPath: string;
	status: string;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export interface IntakeContextDecision {
	id: string;
	title: string;
	body: string | undefined;
	status: string;
	confidence: string | undefined;
	affectedDocumentIds: string[];
}

// ---------------------------------------------------------------------------
// Assumption
// ---------------------------------------------------------------------------

export interface IntakeContextAssumption {
	id: string;
	title: string;
	body: string | undefined;
	status: string;
	caveat: string | undefined;
	affectedDocumentIds: string[];
}

// ---------------------------------------------------------------------------
// Open question
// ---------------------------------------------------------------------------

export interface IntakeContextOpenQuestion {
	id: string;
	question: string;
	body: string | undefined;
	status: string;
	affectedDocumentIds: string[];
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export interface IntakeContextRisk {
	id: string;
	title: string;
	body: string | undefined;
	severity: string;
	status: string;
	rationale: string | undefined;
	affectedDocumentIds: string[];
}

// ---------------------------------------------------------------------------
// Validation gap
// ---------------------------------------------------------------------------

export interface IntakeContextValidationGap {
	id: string;
	description: string;
	severity: 'error' | 'warning' | 'info';
	affectedDocumentIds: string[];
	sourcePath: string | undefined;
	fieldPointer: string | undefined;
}

// ---------------------------------------------------------------------------
// Relevant answer (input evidence only)
// ---------------------------------------------------------------------------

export interface IntakeContextRelevantAnswer {
	questionId: string;
	questionText: string;
	answer: string;
	isEvidenceOnly: boolean;
}

// ---------------------------------------------------------------------------
// Redaction result
// ---------------------------------------------------------------------------

export interface IntakeContextRedactionResult {
	redacted: boolean;
	redactedCategories: string[];
	redactedKeyCount: number;
	summary: string;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface IntakeContextDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path: string | undefined;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Context section
// ---------------------------------------------------------------------------

export interface IntakeContextSection {
	sectionId: string;
	label: string;
	records: unknown[];
	recordCount: number;
	truncated: boolean;
	truncatedFrom: number | undefined;
}

// ---------------------------------------------------------------------------
// Top-level intake context
// ---------------------------------------------------------------------------

export interface IntakeContext {
	profile: IntakeContextProfileReference;
	documents: IntakeContextDocumentReference[];
	questionCluster: QuestionCluster | undefined;
	decisions: IntakeContextDecision[];
	assumptions: IntakeContextAssumption[];
	openQuestions: IntakeContextOpenQuestion[];
	risks: IntakeContextRisk[];
	validationGaps: IntakeContextValidationGap[];
	answers: IntakeContextRelevantAnswer[];
	recentSessions: Array<{
		sessionId: string;
		sessionType: string;
		status: string;
		startedAt: string;
	}>;
	recentRuns: Array<{
		runId: string;
		runType: string;
		status: string;
		startedAt: string;
	}>;
	artifactMetadata: Array<{
		artifactId: string;
		artifactType: string;
		status: string;
		path: string;
		isCanonical: boolean;
	}>;
	redaction: IntakeContextRedactionResult;
	diagnostics: IntakeContextDiagnostic[];
	sections: IntakeContextSection[];
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

export interface IntakeContextBuilderInput {
	/** The active profile ID */
	profileId: string;
	/** Loaded documentation contract */
	contract: DocumentationContract;
	/** Built contract graph (optional) */
	graph: ContractGraph | undefined;
	/** Current workspace state */
	state: WorkspaceState;
	/** Question cluster from Step 4.1 (optional) */
	questionCluster: QuestionCluster | undefined;
	/** User answers as input evidence (optional) */
	answers: IntakeContextRelevantAnswer[] | undefined;
	/** Validation gaps from future Phase 6 (optional) */
	validationGaps: IntakeContextValidationGap[] | undefined;
}

// ---------------------------------------------------------------------------
// Builder options
// ---------------------------------------------------------------------------

export interface IntakeContextBuilderOptions {
	/** Max decisions to include (default 10) */
	maxDecisions: number | undefined;
	/** Max assumptions to include (default 10) */
	maxAssumptions: number | undefined;
	/** Max open questions to include (default 10) */
	maxOpenQuestions: number | undefined;
	/** Max risks to include (default 10) */
	maxRisks: number | undefined;
	/** Max validation gaps to include (default 20) */
	maxValidationGaps: number | undefined;
	/** Include artifact metadata (default true) */
	includeArtifactMetadata: boolean | undefined;
	/** Include recent run summaries (default true) */
	includeRecentRuns: boolean | undefined;
	/** Max recent sessions to include (default 3) */
	maxRecentSessions: number | undefined;
	/** Max recent runs to include (default 3) */
	maxRecentRuns: number | undefined;
	/** Max artifact metadata entries (default 5) */
	maxArtifactMetadata: number | undefined;
}

// ---------------------------------------------------------------------------
// Context scope (internal)
// ---------------------------------------------------------------------------

export interface IntakeContextScope {
	profileId: string;
	documentIds: Set<string>;
	phaseIds: Set<string>;
	hasQuestionCluster: boolean;
	includesDecisions: boolean;
	includesAssumptions: boolean;
	includesOpenQuestions: boolean;
	includesRisks: boolean;
	includesValidationGaps: boolean;
	includesAnswers: boolean;
	includesRecentSessions: boolean;
	includesRecentRuns: boolean;
	includesArtifactMetadata: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_BUILDER_OPTIONS: Required<IntakeContextBuilderOptions> = {
	includeArtifactMetadata: true,
	includeRecentRuns: true,
	maxArtifactMetadata: 5,
	maxAssumptions: 10,
	maxDecisions: 10,
	maxOpenQuestions: 10,
	maxRecentRuns: 3,
	maxRecentSessions: 3,
	maxRisks: 10,
	maxValidationGaps: 20,
};
