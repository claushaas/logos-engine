/** Step 8.1 — Provenance builder functions from existing state */

import type { RenderedMarkdownSection } from '../generation/markdown-renderer-types.js';
import type { LoadedDocumentDescriptor } from '../profiles/documentation-contract.js';
import type {
	WorkspaceAssumption,
	WorkspaceDecision,
	WorkspaceOpenQuestion,
	WorkspaceRisk,
} from '../state/workspace-state.schema.js';
import type { ValidationFinding } from '../validation/validation-finding.js';
import type {
	ClaimRecord,
	ClaimResolutionDiagnostic,
	ClaimSourceLink,
	DocumentSectionClaim,
	ExecutiveItemClaim,
	ProvenanceBuilderContext,
	SourceId,
	SourceRecord,
	SourceReference,
} from './provenance-types.js';

// ---------------------------------------------------------------------------
// ID generation helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

export function resetProvenanceIdCounter(value = 0): void {
	idCounter = value;
}

function nextId(): number {
	idCounter += 1;
	return idCounter;
}

function sourceId(
	type: string,
	recordId: string,
	_context: ProvenanceBuilderContext,
): SourceId {
	return `src:${type}:${recordId}:${nextId()}` as SourceId;
}

function claimId(
	type: string,
	recordId: string,
	_context: ProvenanceBuilderContext,
): string {
	return `claim:${type}:${recordId}:${nextId()}`;
}

function nowISO(): string {
	return new Date().toISOString();
}

function orderFromContext(context: ProvenanceBuilderContext): number {
	return context.orderIndex ?? nextId();
}

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function missingFieldDiag(
	field: string,
	code: string,
	relatedSourceId?: SourceId,
): ClaimResolutionDiagnostic {
	return {
		code,
		message: `Missing required ${field} for provenance record.`,
		recoveryHint: `Provide a value for ${field} to improve provenance traceability.`,
		relatedSourceId,
		severity: 'warning',
	};
}

function inferredContentDiag(): ClaimResolutionDiagnostic {
	return {
		code: 'provenance_inferred_content',
		message: 'Content is inferred and requires human review.',
		recoveryHint: 'Review the inferred content and confirm or correct it.',
		severity: 'warning',
	};
}

function missingSourceDiag(relatedClaimId?: string): ClaimResolutionDiagnostic {
	return {
		code: 'provenance_missing_source',
		message: 'Claim is missing a required source reference.',
		recoveryHint: 'Add at least one explicit source to support this claim.',
		relatedClaimId,
		severity: 'warning',
	};
}

// ---------------------------------------------------------------------------
// Source builders
// ---------------------------------------------------------------------------

export function sourceFromConversationAnswer(
	answer: {
		answerId: string;
		sessionId?: string | undefined;
		questionId?: string | undefined;
		text?: string | undefined;
	},
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('conversation_answer', answer.answerId, context);
	const title = answer.text?.slice(0, 120) ?? `Answer ${answer.answerId}`;

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: context.projectRoot
				? `${context.projectRoot}/.logos/workspace.json`
				: undefined,
			pointer: answer.sessionId ? `/sessions/${answer.sessionId}` : undefined,
		},
		metadata: {
			answerId: answer.answerId,
			label: title,
			questionId: answer.questionId,
			sessionId: answer.sessionId,
		},
		orderIndex: orderFromContext(context),
		relatedWorkspaceRecordId: answer.answerId,
		sourceId: id,
		sourceType: 'conversation_answer',
		status: 'confirmed',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
			observedAt: nowISO(),
		},
		title,
	};

	if (!answer.answerId) {
		diagnostics.push(
			missingFieldDiag('answerId', 'provenance_missing_answer_id', id),
		);
	}

	return { diagnostics, source };
}

export function sourceFromConfirmedDecision(
	decision: WorkspaceDecision,
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('confirmed_decision', decision.id, context);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: context.projectRoot
				? `${context.projectRoot}/.logos/workspace.json`
				: undefined,
			pointer: `/decisions/${decision.id}`,
		},
		metadata: {
			confidence: decision.confidence,
			decisionId: decision.id,
			label: decision.title,
		},
		orderIndex: orderFromContext(context),
		relatedWorkspaceRecordId: decision.id,
		sourceId: id,
		sourceType: 'confirmed_decision',
		status: decision.status === 'confirmed' ? 'confirmed' : 'proposed',
		timestamp: {
			createdAt: decision.createdAt ?? nowISO(),
			generatedAt: context.generatedAt,
			updatedAt: decision.updatedAt,
		},
		title: decision.title,
	};

	if (!decision.id || !decision.title) {
		diagnostics.push(
			missingFieldDiag(
				'decision fields',
				'provenance_missing_decision_fields',
				id,
			),
		);
	}

	return { diagnostics, source };
}

export function sourceFromAssumption(
	assumption: WorkspaceAssumption,
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('assumption', assumption.id, context);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: context.projectRoot
				? `${context.projectRoot}/.logos/workspace.json`
				: undefined,
			pointer: `/assumptions/${assumption.id}`,
		},
		metadata: {
			assumptionId: assumption.id,
			caveat: assumption.caveat,
			label: assumption.title,
			status: assumption.status,
		},
		orderIndex: orderFromContext(context),
		relatedWorkspaceRecordId: assumption.id,
		sourceId: id,
		sourceType: 'assumption',
		status: assumption.status === 'active' ? 'confirmed' : 'proposed',
		timestamp: {
			createdAt: assumption.createdAt ?? nowISO(),
			generatedAt: context.generatedAt,
			updatedAt: assumption.updatedAt,
		},
		title: assumption.title,
	};

	if (!assumption.id || !assumption.title) {
		diagnostics.push(
			missingFieldDiag(
				'assumption fields',
				'provenance_missing_assumption_fields',
				id,
			),
		);
	}

	return { diagnostics, source };
}

export function sourceFromDocumentDescriptor(
	loaded: LoadedDocumentDescriptor,
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('document', loaded.canonicalId, context);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: loaded.sourcePath,
			pointer: `/documents/${loaded.canonicalId}`,
		},
		metadata: {
			canonicalId: loaded.canonicalId,
			documentId: loaded.descriptor.id,
			label: loaded.descriptor.title,
			phaseId: loaded.phaseId,
			sourcePath: loaded.sourcePath,
		},
		orderIndex: orderFromContext(context),
		relatedDocumentCanonicalId: loaded.canonicalId,
		relatedPhaseId: loaded.phaseId,
		sourceId: id,
		sourceType: 'document',
		status: 'confirmed',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
		},
		title: loaded.descriptor.title,
	};

	return { diagnostics, source };
}

export function sourceFromProfileDescriptor(
	profileDescriptor: {
		profileId: string;
		descriptorPath?: string | undefined;
		label?: string | undefined;
	},
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId(
		'profile_descriptor',
		profileDescriptor.profileId,
		context,
	);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: profileDescriptor.descriptorPath,
			pointer: `/profiles/${profileDescriptor.profileId}`,
		},
		metadata: {
			descriptorPath: profileDescriptor.descriptorPath,
			label: profileDescriptor.label,
			profileId: profileDescriptor.profileId,
		},
		orderIndex: orderFromContext(context),
		sourceId: id,
		sourceType: 'profile_descriptor',
		status: 'confirmed',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
		},
		title: profileDescriptor.label ?? `Profile ${profileDescriptor.profileId}`,
	};

	return { diagnostics, source };
}

export function sourceFromValidationFinding(
	finding: ValidationFinding,
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('validation_finding', finding.id, context);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: finding.source.path,
			pointer: finding.location.pointer,
		},
		metadata: {
			code: finding.code,
			findingId: finding.id,
			label: finding.message,
			severity: finding.severity,
		},
		orderIndex: orderFromContext(context),
		relatedDocumentCanonicalId: finding.documentCanonicalId,
		relatedPhaseId: finding.phaseId,
		relatedValidationFindingId: finding.id,
		relatedWorkspaceRecordId: finding.workspaceRecordId,
		sourceId: id,
		sourceType: 'validation_finding',
		status: 'confirmed',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
		},
		title: finding.message.slice(0, 120),
	};

	return { diagnostics, source };
}

export function sourceFromManualNote(
	note: {
		noteId: string;
		title: string;
		body?: string | undefined;
		path?: string | undefined;
	},
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('manual_note', note.noteId, context);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: undefined,
		location: {
			path: note.path,
			pointer: `/notes/${note.noteId}`,
		},
		metadata: {
			label: note.title,
			noteId: note.noteId,
		},
		orderIndex: orderFromContext(context),
		relatedWorkspaceRecordId: note.noteId,
		sourceId: id,
		sourceType: 'manual_note',
		status: 'confirmed',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
		},
		title: note.title,
	};

	return { diagnostics, source };
}

export function sourceFromRepositoryScan(
	scanResult: { label?: string | undefined; description?: string | undefined },
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId('repository_scan', 'placeholder', context);

	const source: SourceRecord = {
		confidence: 'unknown',
		externalUri: undefined,
		location: {},
		metadata: {
			description: scanResult.description,
			label: scanResult.label ?? 'Repository scan placeholder',
			scanStatus: 'not_implemented',
		},
		orderIndex: orderFromContext(context),
		sourceId: id,
		sourceType: 'repository_scan',
		status: 'inferred',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
		},
		title: scanResult.label ?? 'Repository scan placeholder',
	};

	diagnostics.push({
		code: 'provenance_repository_scan_not_implemented',
		message:
			'Repository scan source is a placeholder; scanning is not yet implemented.',
		recoveryHint:
			'Replace with real scan results when Phase 12 scanner is available.',
		severity: 'info',
	});

	return { diagnostics, source };
}

export function sourceFromExternalReference(
	reference: {
		uri: string;
		label?: string | undefined;
		description?: string | undefined;
	},
	context: ProvenanceBuilderContext = {},
): { source: SourceRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const id = sourceId(
		'external_reference',
		reference.label ?? 'ext_ref',
		context,
	);

	const source: SourceRecord = {
		confidence: 'explicit',
		externalUri: reference.uri,
		location: {},
		metadata: {
			description: reference.description,
			label: reference.label,
			retrievedAt: undefined,
			uri: reference.uri,
		},
		orderIndex: orderFromContext(context),
		sourceId: id,
		sourceType: 'external_reference',
		status: 'confirmed',
		timestamp: {
			createdAt: nowISO(),
			generatedAt: context.generatedAt,
		},
		title: reference.label ?? reference.uri.slice(0, 120),
	};

	return { diagnostics, source };
}

// ---------------------------------------------------------------------------
// Source reference factory
// ---------------------------------------------------------------------------

function sourceRef(source: SourceRecord): SourceReference {
	return {
		label: source.title,
		path: source.location.path,
		pointer: source.location.pointer,
		sourceId: source.sourceId,
		sourceType: source.sourceType,
	};
}

// ---------------------------------------------------------------------------
// Claim builders
// ---------------------------------------------------------------------------

export function claimFromDecision(
	decision: WorkspaceDecision,
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('decision', decision.id, context);

	if (sources.length === 0 && context.strictSources !== false) {
		diagnostics.push(missingSourceDiag(cid));
	}

	const links = buildClaimSourceLinks(cid, sources, 'supports', context);
	const isInferred =
		decision.confidence === 'low' || decision.confidence === 'advisory';

	const claim: ClaimRecord = {
		body: decision.body,
		claimId: cid,
		claimType: 'decision',
		confidence: isInferred ? 'inferred' : 'explicit',
		createdAt: decision.createdAt ?? nowISO(),
		diagnostics,
		isGenerated: false,
		isInferred,
		primarySourceId: sources[0]?.sourceId,
		relatedWorkspaceRecordId: decision.id,
		reviewState: isInferred ? 'required' : 'not_required',
		sourceCount: sources.length,
		sourceLinks: links,
		status: decision.status === 'confirmed' ? 'confirmed' : 'proposed',
		summary: decision.title,
		updatedAt: decision.updatedAt,
	};

	if (isInferred) {
		diagnostics.push(inferredContentDiag());
	}

	return { claim, diagnostics };
}

export function claimFromAssumption(
	assumption: WorkspaceAssumption,
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('assumption', assumption.id, context);

	if (sources.length === 0 && context.strictSources !== false) {
		diagnostics.push(missingSourceDiag(cid));
	}

	const links = buildClaimSourceLinks(cid, sources, 'derived_from', context);

	const claim: ClaimRecord = {
		body: assumption.body,
		claimId: cid,
		claimType: 'assumption',
		confidence: 'derived',
		createdAt: assumption.createdAt ?? nowISO(),
		diagnostics,
		isGenerated: false,
		isInferred: true,
		primarySourceId: sources[0]?.sourceId,
		relatedWorkspaceRecordId: assumption.id,
		reviewState: 'required',
		sourceCount: sources.length,
		sourceLinks: links,
		status: 'requires_review',
		summary: assumption.title,
		updatedAt: assumption.updatedAt,
	};

	diagnostics.push(inferredContentDiag());

	return { claim, diagnostics };
}

export function claimFromRisk(
	risk: WorkspaceRisk,
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('risk', risk.id, context);

	if (sources.length === 0 && context.strictSources !== false) {
		diagnostics.push(missingSourceDiag(cid));
	}

	const links = buildClaimSourceLinks(cid, sources, 'derived_from', context);
	const isConfirmed = risk.status === 'mitigated' || risk.status === 'accepted';

	const claim: ClaimRecord = {
		body: risk.body,
		claimId: cid,
		claimType: 'risk',
		confidence: isConfirmed ? 'explicit' : 'derived',
		createdAt: risk.createdAt ?? nowISO(),
		diagnostics,
		isGenerated: false,
		isInferred: !isConfirmed,
		primarySourceId: sources[0]?.sourceId,
		relatedWorkspaceRecordId: risk.id,
		reviewState: isConfirmed ? 'not_required' : 'required',
		sourceCount: sources.length,
		sourceLinks: links,
		status: isConfirmed ? 'confirmed' : 'proposed',
		summary: risk.title,
		updatedAt: risk.updatedAt,
	};

	return { claim, diagnostics };
}

export function claimFromOpenQuestion(
	openQuestion: WorkspaceOpenQuestion,
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('open_question', openQuestion.id, context);

	const links = buildClaimSourceLinks(cid, sources, 'mentions', context);

	const claim: ClaimRecord = {
		body: openQuestion.body,
		claimId: cid,
		claimType: 'open_question',
		confidence: 'inferred',
		createdAt: openQuestion.createdAt ?? nowISO(),
		diagnostics,
		isGenerated: false,
		isInferred: true,
		primarySourceId: sources[0]?.sourceId,
		relatedWorkspaceRecordId: openQuestion.id,
		reviewState: 'required',
		sourceCount: sources.length,
		sourceLinks: links,
		status:
			openQuestion.status === 'answered' ? 'confirmed' : 'requires_review',
		summary: openQuestion.question,
		updatedAt: openQuestion.updatedAt,
	};

	diagnostics.push(inferredContentDiag());

	return { claim, diagnostics };
}

export function claimFromGeneratedSection(
	section: RenderedMarkdownSection,
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('generated_section', section.sectionId, context);

	if (sources.length === 0) {
		diagnostics.push(missingSourceDiag(cid));
	}

	const links = buildClaimSourceLinks(cid, sources, 'derived_from', context);
	const isInferred =
		section.status !== 'rendered' || section.sources.length === 0;

	const claim: ClaimRecord = {
		body: section.markdown.slice(0, 500),
		claimId: cid,
		claimType: 'generated_section',
		confidence: isInferred ? 'inferred' : 'derived',
		createdAt: nowISO(),
		diagnostics,
		isGenerated: true,
		isInferred,
		primarySourceId: sources[0]?.sourceId,
		relatedSectionId: section.sectionId,
		reviewState: isInferred ? 'required' : 'not_required',
		sourceCount: sources.length,
		sourceLinks: links,
		status: isInferred ? 'requires_review' : 'proposed',
		summary: section.title,
	};

	if (isInferred) {
		diagnostics.push(inferredContentDiag());
	}

	return { claim, diagnostics };
}

export function claimFromValidationFinding(
	finding: ValidationFinding,
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('validation_claim', finding.id, context);

	const links = buildClaimSourceLinks(cid, sources, 'derived_from', context);

	const claim: ClaimRecord = {
		body: finding.message,
		claimId: cid,
		claimType: 'validation_claim',
		confidence: 'explicit',
		createdAt: nowISO(),
		diagnostics,
		isGenerated: false,
		isInferred: false,
		primarySourceId: sources[0]?.sourceId,
		relatedDocumentCanonicalId: finding.documentCanonicalId,
		relatedPhaseId: finding.phaseId,
		relatedWorkspaceRecordId: finding.workspaceRecordId,
		reviewState: 'not_required',
		sourceCount: sources.length,
		sourceLinks: links,
		status: 'confirmed',
		summary: finding.message.slice(0, 120),
	};

	return { claim, diagnostics };
}

export function claimFromExecutiveItemDraft(
	item: {
		itemId: string;
		itemTitle?: string | undefined;
		body: string;
		sourceDocumentIds?: string[] | undefined;
		sourceDecisionIds?: string[] | undefined;
		sourceAssumptionIds?: string[] | undefined;
		sourceRiskIds?: string[] | undefined;
		sourceFindingIds?: string[] | undefined;
	},
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): { claim: ClaimRecord; diagnostics: ClaimResolutionDiagnostic[] } {
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const cid = claimId('executive_item', item.itemId, context);

	if (sources.length === 0) {
		diagnostics.push(missingSourceDiag(cid));
	}

	const links = buildClaimSourceLinks(cid, sources, 'derived_from', context);

	const claim: ClaimRecord = {
		body: item.body,
		claimId: cid,
		claimType: 'executive_item',
		confidence: 'inferred',
		createdAt: nowISO(),
		diagnostics,
		isGenerated: true,
		isInferred: true,
		primarySourceId: sources[0]?.sourceId,
		reviewState: 'required',
		sourceCount: sources.length,
		sourceLinks: links,
		status: 'requires_review',
		summary: item.itemTitle ?? item.body.slice(0, 120),
	};

	diagnostics.push(inferredContentDiag());

	return { claim, diagnostics };
}

// ---------------------------------------------------------------------------
// Generated section provenance (document section claim builder)
// ---------------------------------------------------------------------------

export function buildGeneratedSectionClaim(
	section: RenderedMarkdownSection,
	documentId: string,
	phaseId: string,
	sectionPath: string,
	sourceCandidates: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): DocumentSectionClaim {
	const cid = claimId('generated_section', documentId, context);
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const isInferred = section.status !== 'rendered';
	const refs: SourceReference[] = sourceCandidates.map(sourceRef);

	if (sourceCandidates.length === 0) {
		diagnostics.push(missingSourceDiag(cid));
	}
	if (isInferred) {
		diagnostics.push(inferredContentDiag());
	}

	return {
		body: section.markdown.slice(0, 500),
		claimId: cid,
		diagnostics,
		documentCanonicalId: documentId,
		isInferred,
		phaseId,
		reviewState:
			isInferred || sourceCandidates.length === 0 ? 'required' : 'not_required',
		sectionId: section.sectionId,
		sectionPath,
		sectionTitle: section.title,
		sources: refs,
	};
}

// ---------------------------------------------------------------------------
// Executive item provenance readiness
// ---------------------------------------------------------------------------

export function buildExecutiveItemProvenanceClaim(
	item: {
		itemId: string;
		itemTitle?: string | undefined;
		body: string;
		sourceDocumentIds?: string[] | undefined;
		sourceDecisionIds?: string[] | undefined;
		sourceAssumptionIds?: string[] | undefined;
		sourceRiskIds?: string[] | undefined;
		sourceFindingIds?: string[] | undefined;
		sourceProfileDescriptorIds?: string[] | undefined;
	},
	sources: SourceRecord[],
	context: ProvenanceBuilderContext = {},
): ExecutiveItemClaim {
	const cid = claimId('executive_item', item.itemId, context);
	const diagnostics: ClaimResolutionDiagnostic[] = [];
	const refs: SourceReference[] = sources.map(sourceRef);

	if (sources.length === 0) {
		diagnostics.push(missingSourceDiag(cid));
	}

	// Inferred content is always review-required
	diagnostics.push(inferredContentDiag());

	return {
		assumptions: [], // Filled by caller from actual state
		body: item.body,
		claimId: cid,
		confirmedDecisions: [], // Filled by caller from actual state
		diagnostics,
		findings: [], // Filled by caller from actual state
		isInferred: true,
		itemId: item.itemId,
		itemTitle: item.itemTitle,
		normativeDocuments: [], // Filled by caller from actual state
		profileDescriptors: [], // Filled by caller from actual state
		reviewState: 'required',
		risks: [],
		sources: refs,
	};
}

// ---------------------------------------------------------------------------
// Claim-source link builder
// ---------------------------------------------------------------------------

export function buildClaimSourceLinks(
	claimIdText: string,
	sources: SourceRecord[],
	defaultLinkType: import('./provenance-types.js').ClaimSourceLinkType = 'supports',
	context: ProvenanceBuilderContext = {},
): ClaimSourceLink[] {
	const now = context.generatedAt ?? nowISO();
	return sources.map((source, _index) => ({
		claimId: claimIdText,
		confidence: source.confidence,
		createdAt: now,
		explanation: `Linked from ${source.sourceType} source "${source.title}"`,
		linkType: defaultLinkType,
		observedAt: source.timestamp.observedAt ?? source.timestamp.createdAt,
		sourceId: source.sourceId,
		sourcePath: source.location.path,
		sourcePointer: source.location.pointer,
		status: source.status,
	}));
}
