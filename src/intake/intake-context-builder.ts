/** Intake Context Builder — builds scoped, redacted intake context from contracts and state */

import type { ContractGraph } from '../profiles/contract-graph.js';
import type { DocumentationContract } from '../profiles/documentation-contract.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import { redactIntakeContext } from './context-redaction.js';
import type {
	IntakeContext,
	IntakeContextAssumption,
	IntakeContextBuilderInput,
	IntakeContextBuilderOptions,
	IntakeContextDecision,
	IntakeContextDiagnostic,
	IntakeContextDocumentReference,
	IntakeContextOpenQuestion,
	IntakeContextProfileReference,
	IntakeContextRelevantAnswer,
	IntakeContextRisk,
	IntakeContextScope,
	IntakeContextSection,
	IntakeContextValidationGap,
} from './intake-context-types.js';
import { DEFAULT_BUILDER_OPTIONS } from './intake-context-types.js';
import type { QuestionCluster } from './question-planner-types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildIntakeContext(
	input: IntakeContextBuilderInput,
	_options?: IntakeContextBuilderOptions | undefined,
): IntakeContext {
	const opts = resolveOptions(_options);
	const diagnostics: IntakeContextDiagnostic[] = [];

	const profile = buildProfileReference(input.state);
	const documents = buildDocumentReferences(input.contract, input.graph);
	const scope = determineScope(input, documents);

	const decisions = selectDecisions(
		input.state,
		input.questionCluster,
		opts,
		diagnostics,
	);
	const assumptions = selectAssumptions(
		input.state,
		input.questionCluster,
		opts,
		diagnostics,
	);
	const openQuestions = selectOpenQuestions(
		input.state,
		input.questionCluster,
		opts,
		diagnostics,
	);
	const risks = selectRisks(
		input.state,
		input.questionCluster,
		opts,
		diagnostics,
	);
	const validationGaps = selectValidationGaps(
		input.validationGaps,
		opts,
		diagnostics,
	);
	const answers = selectAnswers(input.answers, opts);
	const recentSessions = selectRecentSessions(input.state, opts);
	const recentRuns = opts.includeRecentRuns
		? selectRecentRuns(input.state, opts)
		: [];
	const artifactMetadata = opts.includeArtifactMetadata
		? selectArtifactMetadata(input.state, opts)
		: [];

	const sections = buildSections(scope, documents.length);

	const context: IntakeContext = {
		answers,
		artifactMetadata,
		assumptions,
		decisions,
		diagnostics,
		documents,
		openQuestions,
		profile,
		questionCluster: input.questionCluster ?? undefined,
		recentRuns,
		recentSessions,
		redaction: {
			redacted: false,
			redactedCategories: [],
			redactedKeyCount: 0,
			summary: 'Redaction applied by redactIntakeContext before use',
		},
		risks,
		sections,
		validationGaps,
	};

	return redactIntakeContext(context);
}

// ---------------------------------------------------------------------------
// Options resolution
// ---------------------------------------------------------------------------

function resolveOptions(
	options: IntakeContextBuilderOptions | undefined,
): Required<IntakeContextBuilderOptions> {
	return {
		includeArtifactMetadata:
			options?.includeArtifactMetadata ??
			DEFAULT_BUILDER_OPTIONS.includeArtifactMetadata,
		includeRecentRuns:
			options?.includeRecentRuns ?? DEFAULT_BUILDER_OPTIONS.includeRecentRuns,
		maxArtifactMetadata:
			options?.maxArtifactMetadata ??
			DEFAULT_BUILDER_OPTIONS.maxArtifactMetadata,
		maxAssumptions:
			options?.maxAssumptions ?? DEFAULT_BUILDER_OPTIONS.maxAssumptions,
		maxDecisions: options?.maxDecisions ?? DEFAULT_BUILDER_OPTIONS.maxDecisions,
		maxOpenQuestions:
			options?.maxOpenQuestions ?? DEFAULT_BUILDER_OPTIONS.maxOpenQuestions,
		maxRecentRuns:
			options?.maxRecentRuns ?? DEFAULT_BUILDER_OPTIONS.maxRecentRuns,
		maxRecentSessions:
			options?.maxRecentSessions ?? DEFAULT_BUILDER_OPTIONS.maxRecentSessions,
		maxRisks: options?.maxRisks ?? DEFAULT_BUILDER_OPTIONS.maxRisks,
		maxValidationGaps:
			options?.maxValidationGaps ?? DEFAULT_BUILDER_OPTIONS.maxValidationGaps,
	};
}

// ---------------------------------------------------------------------------
// Profile reference
// ---------------------------------------------------------------------------

function buildProfileReference(
	state: WorkspaceState,
): IntakeContextProfileReference {
	return {
		profileId: state.profile.profileId,
		profileSource: state.profile.source,
		profileVersion: state.profile.profileVersion,
	};
}

// ---------------------------------------------------------------------------
// Document references
// ---------------------------------------------------------------------------

function buildDocumentReferences(
	contract: DocumentationContract,
	_graph: ContractGraph | undefined,
): IntakeContextDocumentReference[] {
	return contract.documents.map((doc) => {
		const phase = contract.phases.find((p) => p.id === doc.phaseId);
		return {
			canonicalId: doc.canonicalId,
			descriptorPath: doc.sourcePath,
			phaseId: doc.phaseId,
			phaseTitle: phase?.title,
			status: doc.descriptor.status,
			title: doc.descriptor.title,
		};
	});
}

// ---------------------------------------------------------------------------
// Scope determination
// ---------------------------------------------------------------------------

function determineScope(
	input: IntakeContextBuilderInput,
	documents: IntakeContextDocumentReference[],
): IntakeContextScope {
	const documentIds = new Set(documents.map((d) => d.canonicalId));
	const phaseIds = new Set(documents.map((d) => d.phaseId));

	let relevantDocumentIds = documentIds;
	let relevantPhaseIds = phaseIds;

	if (input.questionCluster) {
		const clusterDocIds = new Set(input.questionCluster.sourceDocuments);
		if (clusterDocIds.size > 0) {
			// Scope to documents in the cluster
			const clusterDocSet = new Set(
				documents.filter((d) => clusterDocIds.has(d.canonicalId)),
			);
			relevantDocumentIds = new Set(
				[...clusterDocSet].map((d) => d.canonicalId),
			);
			relevantPhaseIds = new Set([...clusterDocSet].map((d) => d.phaseId));
		}
	}

	return {
		documentIds: relevantDocumentIds,
		hasQuestionCluster: input.questionCluster !== undefined,
		includesAnswers: (input.answers?.length ?? 0) > 0,
		includesArtifactMetadata: true,
		includesAssumptions: true,
		includesDecisions: true,
		includesOpenQuestions: true,
		includesRecentRuns: true,
		includesRecentSessions: true,
		includesRisks: true,
		includesValidationGaps: (input.validationGaps?.length ?? 0) > 0,
		phaseIds: relevantPhaseIds,
		profileId: input.profileId,
	};
}

// ---------------------------------------------------------------------------
// Decision selection
// ---------------------------------------------------------------------------

function selectDecisions(
	state: WorkspaceState,
	cluster: QuestionCluster | undefined,
	opts: Required<IntakeContextBuilderOptions>,
	_diagnostics: IntakeContextDiagnostic[],
): IntakeContextDecision[] {
	let filtered = state.decisions.filter(
		(d) => d.status === 'confirmed' || d.status === 'proposed',
	);

	// Scope to cluster-related documents if cluster is available
	if (cluster && cluster.sourceDocuments.length > 0) {
		const clusterDocIds = new Set(cluster.sourceDocuments);
		filtered = filtered.filter(
			(d) =>
				d.affectedDocumentIds.length === 0 ||
				d.affectedDocumentIds.some((did) => clusterDocIds.has(did)),
		);
	}

	// Sort: most recently created first
	filtered.sort((a, b) => {
		const aTime = a.createdAt ?? '';
		const bTime = b.createdAt ?? '';
		return bTime.localeCompare(aTime);
	});

	const selected = filtered.slice(0, opts.maxDecisions);

	return selected.map((d) => ({
		affectedDocumentIds: d.affectedDocumentIds,
		body: d.body,
		confidence: d.confidence,
		id: d.id,
		status: d.status,
		title: d.title,
	}));
}

// ---------------------------------------------------------------------------
// Assumption selection
// ---------------------------------------------------------------------------

function selectAssumptions(
	state: WorkspaceState,
	cluster: QuestionCluster | undefined,
	opts: Required<IntakeContextBuilderOptions>,
	_diagnostics: IntakeContextDiagnostic[],
): IntakeContextAssumption[] {
	let filtered = state.assumptions.filter(
		(a) => a.status === 'active' || a.status === 'proposed',
	);

	if (cluster && cluster.sourceDocuments.length > 0) {
		const clusterDocIds = new Set(cluster.sourceDocuments);
		filtered = filtered.filter(
			(a) =>
				a.affectedDocumentIds.length === 0 ||
				a.affectedDocumentIds.some((did) => clusterDocIds.has(did)),
		);
	}

	filtered.sort((a, b) => {
		const aTime = a.createdAt ?? '';
		const bTime = b.createdAt ?? '';
		return bTime.localeCompare(aTime);
	});

	const selected = filtered.slice(0, opts.maxAssumptions);

	return selected.map((a) => ({
		affectedDocumentIds: a.affectedDocumentIds,
		body: a.body,
		caveat: a.caveat,
		id: a.id,
		status: a.status,
		title: a.title,
	}));
}

// ---------------------------------------------------------------------------
// Open question selection
// ---------------------------------------------------------------------------

function selectOpenQuestions(
	state: WorkspaceState,
	cluster: QuestionCluster | undefined,
	opts: Required<IntakeContextBuilderOptions>,
	_diagnostics: IntakeContextDiagnostic[],
): IntakeContextOpenQuestion[] {
	let filtered = state.openQuestions.filter((q) => q.status === 'open');

	if (cluster && cluster.sourceDocuments.length > 0) {
		const clusterDocIds = new Set(cluster.sourceDocuments);
		filtered = filtered.filter(
			(q) =>
				q.affectedDocumentIds.length === 0 ||
				q.affectedDocumentIds.some((did) => clusterDocIds.has(did)),
		);
	}

	filtered.sort((a, b) => {
		const aTime = a.createdAt ?? '';
		const bTime = b.createdAt ?? '';
		return bTime.localeCompare(aTime);
	});

	const selected = filtered.slice(0, opts.maxOpenQuestions);

	return selected.map((q) => ({
		affectedDocumentIds: q.affectedDocumentIds,
		body: q.body,
		id: q.id,
		question: q.question,
		status: q.status,
	}));
}

// ---------------------------------------------------------------------------
// Risk selection
// ---------------------------------------------------------------------------

function selectRisks(
	state: WorkspaceState,
	cluster: QuestionCluster | undefined,
	opts: Required<IntakeContextBuilderOptions>,
	_diagnostics: IntakeContextDiagnostic[],
): IntakeContextRisk[] {
	let filtered = state.risks.filter(
		(r) => r.status === 'identified' || r.status === 'monitored',
	);

	if (cluster && cluster.sourceDocuments.length > 0) {
		const clusterDocIds = new Set(cluster.sourceDocuments);
		filtered = filtered.filter(
			(r) =>
				r.affectedDocumentIds.length === 0 ||
				r.affectedDocumentIds.some((did) => clusterDocIds.has(did)),
		);
	}

	filtered.sort((a, b) => {
		const aTime = a.createdAt ?? '';
		const bTime = b.createdAt ?? '';
		return bTime.localeCompare(aTime);
	});

	const selected = filtered.slice(0, opts.maxRisks);

	return selected.map((r) => ({
		affectedDocumentIds: r.affectedDocumentIds,
		body: r.body,
		id: r.id,
		rationale: r.rationale,
		severity: r.severity,
		status: r.status,
		title: r.title,
	}));
}

// ---------------------------------------------------------------------------
// Validation gap selection
// ---------------------------------------------------------------------------

function selectValidationGaps(
	gaps: IntakeContextValidationGap[] | undefined,
	opts: Required<IntakeContextBuilderOptions>,
	_diagnostics: IntakeContextDiagnostic[],
): IntakeContextValidationGap[] {
	if (!gaps || gaps.length === 0) return [];
	return gaps.slice(0, opts.maxValidationGaps);
}

// ---------------------------------------------------------------------------
// Answer selection
// ---------------------------------------------------------------------------

function selectAnswers(
	answers: IntakeContextRelevantAnswer[] | undefined,
	_opts: Required<IntakeContextBuilderOptions>,
): IntakeContextRelevantAnswer[] {
	if (!answers || answers.length === 0) return [];
	return answers.map((a) => ({ ...a, isEvidenceOnly: true }));
}

// ---------------------------------------------------------------------------
// Session selection
// ---------------------------------------------------------------------------

function selectRecentSessions(
	state: WorkspaceState,
	opts: Required<IntakeContextBuilderOptions>,
): Array<{
	sessionId: string;
	sessionType: string;
	status: string;
	startedAt: string;
}> {
	const sorted = [...state.sessions].sort((a, b) =>
		b.startedAt.localeCompare(a.startedAt),
	);

	return sorted.slice(0, opts.maxRecentSessions).map((s) => ({
		sessionId: s.sessionId,
		sessionType: s.sessionType,
		startedAt: s.startedAt,
		status: s.status,
	}));
}

// ---------------------------------------------------------------------------
// Run selection
// ---------------------------------------------------------------------------

function selectRecentRuns(
	state: WorkspaceState,
	opts: Required<IntakeContextBuilderOptions>,
): Array<{
	runId: string;
	runType: string;
	status: string;
	startedAt: string;
}> {
	const sorted = [...state.runs].sort((a, b) =>
		b.startedAt.localeCompare(a.startedAt),
	);

	return sorted.slice(0, opts.maxRecentRuns).map((r) => ({
		runId: r.runId,
		runType: r.runType,
		startedAt: r.startedAt,
		status: r.status,
	}));
}

// ---------------------------------------------------------------------------
// Artifact metadata selection
// ---------------------------------------------------------------------------

function selectArtifactMetadata(
	state: WorkspaceState,
	opts: Required<IntakeContextBuilderOptions>,
): Array<{
	artifactId: string;
	artifactType: string;
	status: string;
	path: string;
	isCanonical: boolean;
}> {
	const sorted = [...state.artifacts].sort((a, b) => {
		const aTime = a.generatedAt ?? '';
		const bTime = b.generatedAt ?? '';
		return bTime.localeCompare(aTime);
	});

	return sorted.slice(0, opts.maxArtifactMetadata).map((a) => ({
		artifactId: a.artifactId,
		artifactType: a.artifactType,
		isCanonical: a.isCanonical,
		path: a.path,
		status: a.status,
	}));
}

// ---------------------------------------------------------------------------
// Section building
// ---------------------------------------------------------------------------

function buildSections(
	_scope: IntakeContextScope,
	documentCount: number,
): IntakeContextSection[] {
	return [
		{
			label: 'Profile Reference',
			recordCount: 1,
			records: [],
			sectionId: 'profile',
			truncated: false,
			truncatedFrom: undefined,
		},
		{
			label: 'Document References',
			recordCount: documentCount,
			records: [],
			sectionId: 'documents',
			truncated: false,
			truncatedFrom: undefined,
		},
	];
}
