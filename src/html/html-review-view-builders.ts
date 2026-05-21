/** Step 9.3 — HTML Review View Data Builders */

import type { HtmlArtifactKind } from './html-artifact-types.js';
import type {
	HtmlRenderDecisionData,
	HtmlRenderDiagnostic,
	HtmlRenderDocumentData,
	HtmlRenderPhaseData,
	HtmlRenderRiskData,
	HtmlRenderSection,
	HtmlRenderSummaryData,
	HtmlRenderValidationFindingData,
} from './html-render-types.js';
import type { HtmlReviewViewDataInput } from './html-review-generation-types.js';

// ---------------------------------------------------------------------------
// Helper: empty state sentinel
// ---------------------------------------------------------------------------

function summarySection(): HtmlRenderSection {
	return { rendered: true, sectionKind: 'summary', title: 'Summary' };
}

function phaseListSection(): HtmlRenderSection {
	return { rendered: true, sectionKind: 'phase_list', title: 'Phases' };
}

function documentListSection(): HtmlRenderSection {
	return {
		rendered: true,
		sectionKind: 'document_list',
		title: 'Documents by Phase',
	};
}

function decisionListSection(): HtmlRenderSection {
	return { rendered: true, sectionKind: 'decision_list', title: 'Decisions' };
}

function riskListSection(): HtmlRenderSection {
	return { rendered: true, sectionKind: 'risk_list', title: 'Risks' };
}

function validationSection(): HtmlRenderSection {
	return {
		rendered: true,
		sectionKind: 'validation_findings',
		title: 'Findings',
	};
}

function emptyValidationSection(): HtmlRenderSection {
	return {
		rendered: false,
		sectionKind: 'validation_findings',
		title: 'No findings',
	};
}

function readinessSection(): HtmlRenderSection {
	return {
		rendered: true,
		sectionKind: 'readiness_status',
		title: 'Overall Readiness',
	};
}

// ---------------------------------------------------------------------------
// View Data Result type
// ---------------------------------------------------------------------------

export interface HtmlReviewViewDataResult {
	sections: HtmlRenderSection[];
	summary: HtmlRenderSummaryData | undefined;
	phases: HtmlRenderPhaseData[] | undefined;
	documents: HtmlRenderDocumentData[] | undefined;
	decisions: HtmlRenderDecisionData[] | undefined;
	risks: HtmlRenderRiskData[] | undefined;
	validationFindings: HtmlRenderValidationFindingData[] | undefined;
	diagnostics: HtmlRenderDiagnostic[];
}

// ---------------------------------------------------------------------------
// Dashboard View Data Builder
// ---------------------------------------------------------------------------

export function buildDashboardViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const documentCount = input.documents.length;
	const phaseCount = input.phases.length;

	const readyCount = input.documents.filter(
		(d) => d.status === 'current' || d.status === 'generated',
	).length;
	const blockedCount = input.stalenessData?.blockedDocumentIds.size ?? 0;
	const staleCount = input.stalenessData?.staleDocumentIds.size ?? 0;
	const missingCount = input.stalenessData?.missingDocumentIds.size ?? 0;

	const validationFindingCount = input.validationFindings.length;
	const registerCount =
		(input.registerCount?.decisions ?? 0) +
		(input.registerCount?.risks ?? 0) +
		(input.registerCount?.assumptions ?? 0) +
		(input.registerCount?.questions ?? 0) +
		(input.registerCount?.hypotheses ?? 0);
	const traceabilityCount =
		(input.traceabilityData?.sourceCount ?? 0) +
		(input.traceabilityData?.claimCount ?? 0);

	const summary: HtmlRenderSummaryData = {
		blockedCount,
		documentCount,
		missingCount,
		phaseCount,
		readyCount,
		registerCount: registerCount > 0 ? registerCount : undefined,
		staleCount,
		traceabilityCount: traceabilityCount > 0 ? traceabilityCount : undefined,
		validationFindingCount:
			validationFindingCount > 0 ? validationFindingCount : undefined,
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (input.phases.length > 0) {
		sections.push(phaseListSection());
	}

	const phases: HtmlRenderPhaseData[] = input.phases.map((phase) => {
		const phaseDocs = input.documents.filter((d) => d.phaseId === phase.id);
		const phaseReady = phaseDocs.filter(
			(d) => d.status === 'current' || d.status === 'generated',
		).length;
		const blockedDocs = input.stalenessData
			? phaseDocs.filter((d) =>
					input.stalenessData?.blockedDocumentIds.has(d.canonicalId),
				).length
			: 0;
		const staleDocs = input.stalenessData
			? phaseDocs.filter((d) =>
					input.stalenessData?.staleDocumentIds.has(d.canonicalId),
				).length
			: 0;

		return {
			blockedCount: blockedDocs,
			canonicalSourcePath: phase.sourcePath,
			documentCount: phaseDocs.length,
			order: phase.order,
			phaseId: phase.id,
			readyCount: phaseReady,
			staleCount: staleDocs,
			status: phase.status ?? 'unknown',
			title: phase.title,
		};
	});

	const result: HtmlReviewViewDataResult = {
		decisions: undefined,
		diagnostics,
		documents: undefined,
		phases: phases.length > 0 ? phases : undefined,
		risks: undefined,
		sections,
		summary,
		validationFindings: undefined,
	};

	return result;
}

// ---------------------------------------------------------------------------
// Phase Map View Data Builder
// ---------------------------------------------------------------------------

export function buildPhaseMapViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const summary: HtmlRenderSummaryData = {
		blockedCount: input.stalenessData?.blockedDocumentIds.size ?? 0,
		documentCount: input.documents.length,
		missingCount: input.stalenessData?.missingDocumentIds.size ?? 0,
		phaseCount: input.phases.length,
		readyCount: input.documents.filter(
			(d) => d.status === 'current' || d.status === 'generated',
		).length,
		staleCount: input.stalenessData?.staleDocumentIds.size ?? 0,
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (input.phases.length > 0) {
		sections.push(phaseListSection());
		sections.push(documentListSection());
	}

	const phases: HtmlRenderPhaseData[] = input.phases.map((phase) => {
		const phaseDocs = input.documents.filter((d) => d.phaseId === phase.id);
		const blockedDocs = input.stalenessData
			? phaseDocs.filter((d) =>
					input.stalenessData?.blockedDocumentIds.has(d.canonicalId),
				).length
			: 0;
		const staleDocs = input.stalenessData
			? phaseDocs.filter((d) =>
					input.stalenessData?.staleDocumentIds.has(d.canonicalId),
				).length
			: 0;

		return {
			blockedCount: blockedDocs,
			canonicalSourcePath: phase.sourcePath,
			documentCount: phaseDocs.length,
			order: phase.order,
			phaseId: phase.id,
			readyCount: phaseDocs.filter(
				(d) => d.status === 'current' || d.status === 'generated',
			).length,
			staleCount: staleDocs,
			status: phase.status ?? 'unknown',
			title: phase.title,
		};
	});

	const documents: HtmlRenderDocumentData[] = input.documents.map((doc) => {
		let staleStatus: string | undefined;
		if (input.stalenessData?.staleDocumentIds.has(doc.canonicalId)) {
			staleStatus = 'stale';
		} else if (input.stalenessData?.blockedDocumentIds.has(doc.canonicalId)) {
			staleStatus = 'blocked';
		} else if (input.stalenessData?.missingDocumentIds.has(doc.canonicalId)) {
			staleStatus = 'missing';
		}

		return {
			canonicalSourcePath: doc.sourcePath,
			documentCanonicalId: doc.canonicalId,
			phaseId: doc.phaseId,
			staleStatus,
			status: doc.status,
			title: doc.title,
		};
	});

	return {
		decisions: undefined,
		diagnostics,
		documents,
		phases,
		risks: undefined,
		sections,
		summary,
		validationFindings: undefined,
	};
}

// ---------------------------------------------------------------------------
// Decision Map View Data Builder
// ---------------------------------------------------------------------------

export function buildDecisionMapViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const decisions: HtmlRenderDecisionData[] = input.decisions.map((d) => ({
		affectedDocumentIds: d.affectedDocumentIds,
		confidence: d.confidence,
		id: d.id,
		isInferred: d.isInferred,
		reviewRequired: d.reviewRequired,
		reviewState: d.reviewState,
		sourceIds: d.sourceIds,
		status: d.status,
		summary: d.summary,
		title: d.title,
	}));

	const summary: HtmlRenderSummaryData = {
		documentCount: decisions.length,
		extraFields: {
			Confirmed: String(
				decisions.filter((d) => d.status === 'confirmed').length,
			),
			Proposed: String(decisions.filter((d) => d.status === 'proposed').length),
			'Review Required': String(
				decisions.filter((d) => d.reviewRequired).length,
			),
		},
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (decisions.length > 0) {
		sections.push(decisionListSection());
	}

	return {
		decisions,
		diagnostics,
		documents: undefined,
		phases: undefined,
		risks: undefined,
		sections,
		summary,
		validationFindings: undefined,
	};
}

// ---------------------------------------------------------------------------
// Risk Map View Data Builder
// ---------------------------------------------------------------------------

export function buildRiskMapViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const risks: HtmlRenderRiskData[] = input.risks.map((r) => ({
		affectedDocumentIds: r.affectedDocumentIds,
		confidence: r.confidence,
		id: r.id,
		isInferred: r.isInferred,
		mitigation: r.mitigation,
		reviewRequired: r.reviewRequired,
		sourceIds: r.sourceIds,
		status: r.status,
		summary: r.summary,
		title: r.title,
	}));

	const acceptedRisks = risks.filter(
		(r) =>
			r.status === 'accepted' ||
			r.status === 'mitigated' ||
			r.status === 'resolved',
	);

	const summary: HtmlRenderSummaryData = {
		documentCount: risks.length,
		extraFields: {
			'Accepted/Mitigated/Resolved': String(acceptedRisks.length),
			Proposed: String(risks.filter((r) => r.status === 'proposed').length),
			'Review Required': String(risks.filter((r) => r.reviewRequired).length),
		},
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (risks.length > 0) {
		sections.push(riskListSection());
	}

	return {
		decisions: undefined,
		diagnostics,
		documents: undefined,
		phases: undefined,
		risks,
		sections,
		summary,
		validationFindings: undefined,
	};
}

// ---------------------------------------------------------------------------
// Validation Summary View Data Builder
// ---------------------------------------------------------------------------

export function buildValidationSummaryViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const findings: HtmlRenderValidationFindingData[] =
		input.validationFindings.map((f) => ({
			code: f.code,
			documentCanonicalId: f.documentCanonicalId,
			id: f.id,
			isReleaseBlocker:
				f.isReleaseBlocker ??
				(f.severity === 'fatal' || f.severity === 'error'),
			message: f.message,
			path: f.path,
			phaseId: f.phaseId,
			pointer: f.pointer,
			recoveryHint: f.recoveryHint,
			severity: f.severity,
		}));

	const fatalCount = findings.filter((f) => f.severity === 'fatal').length;
	const errorCount = findings.filter((f) => f.severity === 'error').length;
	const warningCount = findings.filter((f) => f.severity === 'warning').length;
	const infoCount = findings.filter((f) => f.severity === 'info').length;
	const releaseBlocking = findings.filter((f) => f.isReleaseBlocker).length;

	const gateStatus =
		fatalCount > 0 || releaseBlocking > 0
			? 'fail'
			: errorCount > 0
				? 'warn'
				: 'pass';

	const summary: HtmlRenderSummaryData = {
		documentCount: findings.length,
		extraFields: {
			Error: String(errorCount),
			Fatal: String(fatalCount),
			'Gate Status': gateStatus,
			Info: String(infoCount),
			'Release Blockers': String(releaseBlocking),
			Warning: String(warningCount),
		},
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (findings.length > 0) {
		sections.push(validationSection());
	} else {
		sections.push(emptyValidationSection());
	}

	return {
		decisions: undefined,
		diagnostics,
		documents: undefined,
		phases: undefined,
		risks: undefined,
		sections,
		summary,
		validationFindings: findings.length > 0 ? findings : undefined,
	};
}

// ---------------------------------------------------------------------------
// Readiness View Data Builder
// ---------------------------------------------------------------------------

export function buildReadinessViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const hasBlockers =
		(input.stalenessData?.blockedDocumentIds.size ?? 0) > 0 ||
		input.validationFindings.some(
			(f) => f.severity === 'fatal' || f.severity === 'error',
		) ||
		input.openQuestions.filter((q) => q.isBlocking).length > 0;

	const readinessStatus = hasBlockers ? 'not_ready' : 'ready';

	const unresolvedBlockingQuestions = input.openQuestions.filter(
		(q) => q.status !== 'resolved' && q.isBlocking,
	);
	const reviewRequiredItems =
		input.decisions.filter((d) => d.reviewRequired).length +
		input.risks.filter((r) => r.reviewRequired).length +
		input.assumptions.filter((a) => a.reviewRequired).length +
		input.openQuestions.filter((q) => q.reviewRequired).length;

	const summary: HtmlRenderSummaryData = {
		blockedCount: input.stalenessData?.blockedDocumentIds.size ?? 0,
		documentCount: input.documents.length,
		extraFields: {
			'Consistency Status': input.consistencyStatus?.overall ?? 'unknown',
			'Readiness Status': readinessStatus,
			'Review-Required Items': String(reviewRequiredItems),
			'Unresolved Blocking Questions': String(
				unresolvedBlockingQuestions.length,
			),
		},
		missingCount: input.stalenessData?.missingDocumentIds.size ?? 0,
		readyCount: input.documents.filter(
			(d) => d.status === 'current' || d.status === 'generated',
		).length,
		staleCount: input.stalenessData?.staleDocumentIds.size ?? 0,
		validationFindingCount: input.validationFindings.length,
	};

	const sections: HtmlRenderSection[] = [summarySection(), readinessSection()];

	if (input.validationFindings.length > 0) {
		sections.push(validationSection());
	}

	const validationFindings: HtmlRenderValidationFindingData[] =
		input.validationFindings.map((f) => ({
			code: f.code,
			documentCanonicalId: f.documentCanonicalId,
			id: f.id,
			isReleaseBlocker:
				f.isReleaseBlocker ??
				(f.severity === 'fatal' || f.severity === 'error'),
			message: f.message,
			path: f.path,
			phaseId: f.phaseId,
			pointer: f.pointer,
			recoveryHint: f.recoveryHint,
			severity: f.severity,
		}));

	return {
		decisions: undefined,
		diagnostics,
		documents: undefined,
		phases: undefined,
		risks: undefined,
		sections,
		summary,
		validationFindings,
	};
}

// ---------------------------------------------------------------------------
// Executive Readiness View Data Builder
// ---------------------------------------------------------------------------

export function buildExecutiveReadinessViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const hasBlockers =
		(input.stalenessData?.blockedDocumentIds.size ?? 0) > 0 ||
		input.validationFindings.some((f) => f.severity === 'fatal');

	const normativeReadiness = hasBlockers ? 'blocked' : 'ready';

	const summary: HtmlRenderSummaryData = {
		blockedCount: input.stalenessData?.blockedDocumentIds.size ?? 0,
		documentCount: input.documents.length,
		extraFields: {
			'Export Readiness': hasBlockers ? 'not_ready' : 'ready',
			'Normative Readiness': normativeReadiness,
		},
		missingCount: input.stalenessData?.missingDocumentIds.size ?? 0,
		readyCount: input.documents.filter(
			(d) => d.status === 'current' || d.status === 'generated',
		).length,
		staleCount: input.stalenessData?.staleDocumentIds.size ?? 0,
		validationFindingCount: input.validationFindings.filter(
			(f) => f.severity === 'fatal',
		).length,
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (input.phases.length > 0) {
		sections.push(phaseListSection());
	}

	const phases: HtmlRenderPhaseData[] = input.phases.map((phase) => {
		const phaseDocs = input.documents.filter((d) => d.phaseId === phase.id);
		const blockedDocs = input.stalenessData
			? phaseDocs.filter((d) =>
					input.stalenessData?.blockedDocumentIds.has(d.canonicalId),
				).length
			: 0;
		const staleDocs = input.stalenessData
			? phaseDocs.filter((d) =>
					input.stalenessData?.staleDocumentIds.has(d.canonicalId),
				).length
			: 0;

		return {
			blockedCount: blockedDocs,
			canonicalSourcePath: phase.sourcePath,
			documentCount: phaseDocs.length,
			order: phase.order,
			phaseId: phase.id,
			readyCount: phaseDocs.filter(
				(d) => d.status === 'current' || d.status === 'generated',
			).length,
			staleCount: staleDocs,
			status: phase.status ?? 'unknown',
			title: phase.title,
		};
	});

	return {
		decisions: undefined,
		diagnostics,
		documents: undefined,
		phases,
		risks: undefined,
		sections,
		summary,
		validationFindings: undefined,
	};
}

// ---------------------------------------------------------------------------
// Document View Data Builder
// ---------------------------------------------------------------------------

export function buildDocumentViewData(
	input: HtmlReviewViewDataInput,
	_artifactKind: HtmlArtifactKind,
	_documentCanonicalId?: string,
): HtmlReviewViewDataResult {
	const diagnostics: HtmlRenderDiagnostic[] = [];

	const docFindings = input.validationFindings.filter(
		(f) => f.documentCanonicalId === _documentCanonicalId,
	);

	const summary: HtmlRenderSummaryData = {
		documentCount: input.documents.length,
		extraFields: {
			Findings: String(docFindings.length),
		},
	};

	const sections: HtmlRenderSection[] = [summarySection()];

	if (docFindings.length > 0) {
		sections.push(validationSection());
	}

	const validationFindings: HtmlRenderValidationFindingData[] = docFindings.map(
		(f) => ({
			code: f.code,
			documentCanonicalId: f.documentCanonicalId,
			id: f.id,
			isReleaseBlocker:
				f.isReleaseBlocker ??
				(f.severity === 'fatal' || f.severity === 'error'),
			message: f.message,
			path: f.path,
			phaseId: f.phaseId,
			pointer: f.pointer,
			recoveryHint: f.recoveryHint,
			severity: f.severity,
		}),
	);

	return {
		decisions: undefined,
		diagnostics,
		documents: undefined,
		phases: undefined,
		risks: undefined,
		sections,
		summary,
		validationFindings,
	};
}

// ---------------------------------------------------------------------------
// View Data Builder Registry
// ---------------------------------------------------------------------------

export type HtmlReviewViewDataBuilder = (
	input: HtmlReviewViewDataInput,
	artifactKind: HtmlArtifactKind,
) => HtmlReviewViewDataResult;

export function getViewDataBuilder(
	artifactKind: HtmlArtifactKind,
): HtmlReviewViewDataBuilder | undefined {
	switch (artifactKind) {
		case 'dashboard':
			return buildDashboardViewData;
		case 'phase_map':
			return buildPhaseMapViewData;
		case 'decision_map':
			return buildDecisionMapViewData;
		case 'risk_map':
			return buildRiskMapViewData;
		case 'validation_summary':
			return buildValidationSummaryViewData;
		case 'readiness_view':
			return buildReadinessViewData;
		case 'executive_readiness':
			return buildExecutiveReadinessViewData;
		case 'document_view':
			return buildDocumentViewData;
		default:
			return undefined;
	}
}
