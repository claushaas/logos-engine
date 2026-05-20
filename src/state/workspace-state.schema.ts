/** Workspace State Schemas — typed, versioned state contracts for `.logos/` */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema Version
// ---------------------------------------------------------------------------

export const WORKSPACE_STATE_SCHEMA_VERSION = '3.1.0';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const isoTimestamp = z.string().datetime({ offset: true }).optional();

const nonEmptyString = z.string().min(1);

// ---------------------------------------------------------------------------
// WorkspaceMetadata
// ---------------------------------------------------------------------------

export const WorkspaceMetadataSchema = z.object({
	createdAt: nonEmptyString,
	initializationState: z
		.enum(['initialized', 'uninitialized', 'recovering'])
		.default('uninitialized'),
	initializedBy: z.string().optional(),
	projectRootPath: nonEmptyString,
	updatedAt: nonEmptyString,
	workspaceId: nonEmptyString,
});

export type WorkspaceMetadata = z.infer<typeof WorkspaceMetadataSchema>;

// ---------------------------------------------------------------------------
// DocumentationRootConfig
// ---------------------------------------------------------------------------

export const DocumentationRootConfigSchema = z.object({
	isDefault: z.boolean().default(true),
	rootPath: z.string().min(1).default('logos/'),
	wasExplicitlyConfigured: z.boolean().default(false),
});

export type WorkspaceDocumentationRootConfig = z.infer<
	typeof DocumentationRootConfigSchema
>;

// ---------------------------------------------------------------------------
// ProfileLock
// ---------------------------------------------------------------------------

export const ProfileSourceSchema = z.enum([
	'bundled',
	'local',
	'custom',
	'remote',
	'unknown',
]);

export const WorkspaceProfileLockSchema = z.object({
	contractStatus: z.string().optional(),
	executiveContractStatus: z.string().optional(),
	lockedAt: z.string().optional(),
	profileId: z.string().min(1).default('standard'),
	profileRootPath: z.string().optional(),
	profileSchemaVersion: z.string().optional(),
	profileVersion: z.string().optional(),
	registryPath: z.string().optional(),
	safeProfileRoot: z.string().optional(),
	source: ProfileSourceSchema.default('bundled'),
});

export type WorkspaceProfileLock = z.infer<typeof WorkspaceProfileLockSchema>;

// ---------------------------------------------------------------------------
// ProviderConfigReference — stores env-var names, never token values
// ---------------------------------------------------------------------------

function looksLikeSecret(value: string): boolean {
	if (typeof value !== 'string') return false;
	const lower = value.toLowerCase();
	// Reject fields that look like raw tokens rather than env-var names
	if (lower.startsWith('sk-')) return true;
	if (lower.startsWith('sk_')) return true;
	if (lower.startsWith('bearer ')) return true;
	if (lower.startsWith('basic ')) return true;
	if (lower.startsWith('api-')) return true;
	if (lower.startsWith('api_')) return true;
	if (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/]{30,}/.test(value)
	)
		return true;
	if (
		value.length > 20 &&
		/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)
	)
		return true;
	return false;
}

function addSecretLikeStringIssues(
	value: unknown,
	ctx: z.RefinementCtx,
	path: (string | number)[] = [],
): void {
	if (typeof value === 'string') {
		const fieldName = String(path[path.length - 1] ?? '').toLowerCase();
		if (fieldName === 'checksum' || fieldName === 'contentchecksum') {
			return;
		}
		if (looksLikeSecret(value)) {
			ctx.addIssue({
				code: 'custom',
				message:
					'State contains a raw secret-like value. Store environment-variable references or redacted metadata only.',
				path,
			});
		}
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			addSecretLikeStringIssues(item, ctx, [...path, index]);
		});
		return;
	}

	if (value !== null && typeof value === 'object') {
		for (const [key, item] of Object.entries(
			value as Record<string, unknown>,
		)) {
			addSecretLikeStringIssues(item, ctx, [...path, key]);
		}
	}
}

export const TokenSourceSchema = z
	.string()
	.refine((val: string) => !looksLikeSecret(val), {
		message: `Provider token source appears to contain a raw secret value. Store only an environment variable name, not the token itself.`,
	});

export const AiProviderModeSchema = z.enum([
	'disabled',
	'no_provider',
	'local',
	'remote',
]);

export const WorkspaceProviderDisclosureStateSchema = z.object({
	accepted: z.boolean().default(false),
	acceptedAt: z.string().optional(),
	contextCategories: z.array(z.string()).optional(),
	declinedAt: z.string().optional(),
	version: z.string().optional(),
});

export const WorkspaceProviderTestSummarySchema = z.object({
	diagnosticCodes: z.array(z.string()).default([]),
	durationMs: z.number().optional(),
	endpointOrigin: z.string().optional(),
	modelId: z.string().optional(),
	providerId: z.string().optional(),
	status: z
		.enum(['never_run', 'passed', 'failed', 'blocked', 'skipped'])
		.default('never_run'),
	testedAt: z.string().optional(),
});

export const WorkspaceProviderConfigReferenceSchema = z.object({
	apiKeyEnvVarName: TokenSourceSchema.optional(),
	disclosure: WorkspaceProviderDisclosureStateSchema.optional(),
	disclosureAcceptedAt: z.string().optional(),
	enabled: z.boolean().optional().default(false),
	endpoint: z.string().optional(),
	lastTest: WorkspaceProviderTestSummarySchema.optional(),
	mode: AiProviderModeSchema.optional(),
	modelId: z.string().optional(),
	providerId: z.string().min(1),
	providerName: z.string().optional(),
	remotePolicyFlags: z.record(z.string(), z.unknown()).optional(),
	timeoutMs: z.number().optional(),
	tokenEnvVarName: TokenSourceSchema.optional(),
	updatedAt: z.string().optional(),
});

export type WorkspaceProviderConfigReference = z.infer<
	typeof WorkspaceProviderConfigReferenceSchema
>;

// ---------------------------------------------------------------------------
// Decision, Assumption, OpenQuestion, Risk
// ---------------------------------------------------------------------------

export const DecisionStatusSchema = z.enum([
	'proposed',
	'confirmed',
	'rejected',
	'deferred',
	'superseded',
]);

export const WorkspaceDecisionSchema = z.object({
	affectedDocumentIds: z.array(z.string()).default([]),
	body: z.string().optional(),
	confidence: z.enum(['low', 'medium', 'high', 'advisory']).optional(),
	createdAt: isoTimestamp,
	id: nonEmptyString,
	sourceRefs: z.array(z.string()).default([]),
	status: DecisionStatusSchema.default('proposed'),
	title: nonEmptyString,
	updatedAt: isoTimestamp,
});

export type WorkspaceDecision = z.infer<typeof WorkspaceDecisionSchema>;

export const AssumptionStatusSchema = z.enum([
	'proposed',
	'active',
	'challenged',
	'resolved',
	'superseded',
]);

export const WorkspaceAssumptionSchema = z.object({
	affectedDocumentIds: z.array(z.string()).default([]),
	body: z.string().optional(),
	caveat: z.string().optional(),
	createdAt: isoTimestamp,
	id: nonEmptyString,
	sourceRefs: z.array(z.string()).default([]),
	status: AssumptionStatusSchema.default('active'),
	title: nonEmptyString,
	updatedAt: isoTimestamp,
});

export type WorkspaceAssumption = z.infer<typeof WorkspaceAssumptionSchema>;

export const OpenQuestionStatusSchema = z.enum([
	'open',
	'answered',
	'deferred',
	'obsolete',
]);

export const WorkspaceOpenQuestionSchema = z.object({
	affectedDocumentIds: z.array(z.string()).default([]),
	body: z.string().optional(),
	createdAt: isoTimestamp,
	id: nonEmptyString,
	question: nonEmptyString,
	sourceRefs: z.array(z.string()).default([]),
	status: OpenQuestionStatusSchema.default('open'),
	updatedAt: isoTimestamp,
});

export type WorkspaceOpenQuestion = z.infer<typeof WorkspaceOpenQuestionSchema>;

export const RiskSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const RiskStatusSchema = z.enum([
	'identified',
	'monitored',
	'mitigated',
	'accepted',
	'closed',
]);

export const WorkspaceRiskSchema = z.object({
	affectedDocumentIds: z.array(z.string()).default([]),
	body: z.string().optional(),
	createdAt: isoTimestamp,
	id: nonEmptyString,
	rationale: z.string().optional(),
	severity: RiskSeveritySchema.default('medium'),
	sourceRefs: z.array(z.string()).default([]),
	status: RiskStatusSchema.default('identified'),
	title: nonEmptyString,
	updatedAt: isoTimestamp,
});

export type WorkspaceRisk = z.infer<typeof WorkspaceRiskSchema>;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export const SessionTypeSchema = z.enum([
	'tui',
	'intake',
	'generation',
	'validation',
	'diagnostic',
	'executive',
]);
export const SessionStatusSchema = z.enum([
	'open',
	'paused',
	'completed',
	'failed',
	'archived',
]);

export const WorkspaceSessionSchema = z.object({
	commandOrTrigger: z.string().optional(),
	endedAt: z.string().optional(),
	relatedArtifactIds: z.array(z.string()).default([]),
	relatedDecisionIds: z.array(z.string()).default([]),
	relatedQuestionIds: z.array(z.string()).default([]),
	relatedRunIds: z.array(z.string()).default([]),
	sessionId: nonEmptyString,
	sessionType: SessionTypeSchema,
	startedAt: nonEmptyString,
	status: SessionStatusSchema.default('open'),
	summary: z.string().optional(),
});

export type WorkspaceSession = z.infer<typeof WorkspaceSessionSchema>;

// ---------------------------------------------------------------------------
// ValidationRun and GenerationRun
// ---------------------------------------------------------------------------

export const ValidationRunStatusSchema = z.enum([
	'running',
	'complete',
	'failed',
	'obsolete',
]);

export const WorkspaceValidationRunSchema = z.object({
	changedPaths: z.array(z.string()).default([]),
	command: z.string().optional(),
	completedAt: z.string().optional(),
	dryRun: z.boolean().default(false),
	errors: z.array(z.string()).default([]),
	findingIds: z.array(z.string()).default([]),
	relatedArtifactIds: z.array(z.string()).default([]),
	runId: nonEmptyString,
	runType: z.literal('validation'),
	startedAt: nonEmptyString,
	status: ValidationRunStatusSchema.default('complete'),
	warnings: z.array(z.string()).default([]),
});

export type WorkspaceValidationRun = z.infer<
	typeof WorkspaceValidationRunSchema
>;

export const GenerationRunStatusSchema = z.enum([
	'planned',
	'running',
	'partial',
	'complete',
	'failed',
	'obsolete',
]);

export const WorkspaceGenerationRunSchema = z.object({
	changedPaths: z.array(z.string()).default([]),
	command: z.string().optional(),
	completedAt: z.string().optional(),
	dryRun: z.boolean().default(false),
	errors: z.array(z.string()).default([]),
	relatedArtifactIds: z.array(z.string()).default([]),
	runId: nonEmptyString,
	runType: z.literal('generation'),
	startedAt: nonEmptyString,
	status: GenerationRunStatusSchema.default('planned'),
	warnings: z.array(z.string()).default([]),
});

export type WorkspaceGenerationRun = z.infer<
	typeof WorkspaceGenerationRunSchema
>;

// ---------------------------------------------------------------------------
// Artifact
// ---------------------------------------------------------------------------

export const ArtifactTypeSchema = z.enum([
	'canonical_markdown',
	'html',
	'agent_pack',
	'executive_json',
	'executive_markdown',
	'executive_html',
	'data',
	'report',
]);

export const ArtifactStatusSchema = z.enum([
	'planned',
	'generated',
	'skipped',
	'blocked',
	'failed',
	'stale',
	'missing',
]);

export const WorkspaceArtifactSchema = z.object({
	artifactId: nonEmptyString,
	artifactType: ArtifactTypeSchema,
	checksum: z.string().optional(),
	generatedAt: z.string().optional(),
	isCanonical: z.boolean().default(false),
	metadata: z.record(z.string(), z.unknown()).optional(),
	path: z.string().min(1),
	runId: z.string().optional(),
	sourceDocumentIds: z.array(z.string()).default([]),
	status: ArtifactStatusSchema.default('planned'),
});

export type WorkspaceArtifact = z.infer<typeof WorkspaceArtifactSchema>;

// ---------------------------------------------------------------------------
// AuditEvent
// ---------------------------------------------------------------------------

export const WorkspaceAuditEventSchema = z.object({
	actor: z.string().min(1),
	changedPaths: z.array(z.string()).default([]),
	commandRef: z.string().optional(),
	eventId: nonEmptyString,
	eventType: z.string().min(1),
	runRef: z.string().optional(),
	sessionRef: z.string().optional(),
	summary: z.string().min(1),
	targetEntityRef: z.string().optional(),
	targetPath: z.string().optional(),
	timestamp: nonEmptyString,
});

export type WorkspaceAuditEvent = z.infer<typeof WorkspaceAuditEventSchema>;

// ---------------------------------------------------------------------------
// MigrationRecord
// ---------------------------------------------------------------------------

export const MigrationStatusSchema = z.enum([
	'planned',
	'applied',
	'failed',
	'rolled_forward',
]);

export const WorkspaceMigrationRecordSchema = z.object({
	appliedAt: z.string().optional(),
	errors: z.array(z.string()).default([]),
	fromSchemaVersion: nonEmptyString,
	migrationId: nonEmptyString,
	notes: z.string().optional(),
	status: MigrationStatusSchema.default('planned'),
	toSchemaVersion: nonEmptyString,
});

export type WorkspaceMigrationRecord = z.infer<
	typeof WorkspaceMigrationRecordSchema
>;

// ---------------------------------------------------------------------------
// Proposal
// ---------------------------------------------------------------------------

export const ProposalKindSchema = z.enum([
	'decision',
	'assumption',
	'hypothesis',
	'open_question',
	'risk',
	'document_content_hint',
]);

export const ProposalStatusSchema = z.enum([
	'proposed',
	'accepted',
	'rejected',
	'revised',
	'superseded',
]);

export const ProposalExtractionMetadataSchema = z.object({
	operation: z.string().optional(),
	providerId: z.string().optional(),
	providerKind: z.string().optional(),
	responseId: z.string().optional(),
});

export const ProposalRevisionSchema = z.object({
	previousBody: z.string().min(1),
	previousTitle: z.string().min(1),
	reason: z.string().optional(),
	revisedAt: nonEmptyString,
});

export const WorkspaceProposalSchema = z.object({
	body: z.string().default(''),
	confidence: z.enum(['low', 'medium', 'high', 'advisory']).optional(),
	createdAt: isoTimestamp,
	evidence: z.string().optional(),
	extractionMetadata: ProposalExtractionMetadataSchema.optional(),
	kind: ProposalKindSchema,
	proposalId: nonEmptyString,
	rejectionReason: z.string().optional(),
	revisionHistory: z.array(ProposalRevisionSchema).optional(),
	sourceAnswerId: z.string().optional(),
	sourceDocumentCanonicalId: z.string().optional(),
	sourcePhaseId: z.string().optional(),
	sourceQuestionId: z.string().optional(),
	sourceSessionId: z.string().optional(),
	status: ProposalStatusSchema.default('proposed'),
	supersededByProposalId: z.string().optional(),
	targetConfirmedRecordId: z.string().optional(),
	title: nonEmptyString,
	updatedAt: isoTimestamp,
});

export type WorkspaceProposal = z.infer<typeof WorkspaceProposalSchema>;

// ---------------------------------------------------------------------------
// Unified Run Record (validation, diagnostic, generation, executive)
// ---------------------------------------------------------------------------

export const RunTypeSchema = z.enum([
	'validation',
	'diagnostic',
	'generation',
	'executive',
]);

export const RunStatusSchema = z.enum([
	'planned',
	'running',
	'completed',
	'failed',
	'cancelled',
	'blocked',
]);

export const WorkspaceRunRecordSchema = z.object({
	changedPaths: z.array(z.string()).default([]),
	command: z.string().optional(),
	completedAt: z.string().optional(),
	dryRun: z.boolean().default(false),
	errors: z.array(z.string()).default([]),
	findingIds: z.array(z.string()).default([]),
	relatedArtifactIds: z.array(z.string()).default([]),
	runId: nonEmptyString,
	runType: RunTypeSchema,
	startedAt: nonEmptyString,
	status: RunStatusSchema.default('planned'),
	warnings: z.array(z.string()).default([]),
});

export type WorkspaceRunRecord = z.infer<typeof WorkspaceRunRecordSchema>;

// ---------------------------------------------------------------------------
// Top-level WorkspaceState
// ---------------------------------------------------------------------------

const ProvenanceSourceRecordSchema = z
	.object({
		confidence: z.string().min(1),
		sourceId: nonEmptyString,
		sourceType: z.string().min(1),
		status: z.string().min(1),
		title: nonEmptyString,
	})
	.passthrough();

const ProvenanceClaimRecordSchema = z
	.object({
		claimId: nonEmptyString,
		claimType: z.string().min(1),
		confidence: z.string().min(1),
		reviewState: z.string().min(1),
		status: z.string().min(1),
		summary: nonEmptyString,
	})
	.passthrough();

const ProvenanceClaimSourceLinkSchema = z
	.object({
		claimId: nonEmptyString,
		linkType: z.string().min(1),
		sourceId: nonEmptyString,
	})
	.passthrough();

// ---------------------------------------------------------------------------
// Registers (Step 8.2)
// ---------------------------------------------------------------------------

const RegisterLifecycleEventSchemaRuntime = z
	.object({
		eventId: nonEmptyString,
		eventType: z.string().min(1),
		occurredAt: nonEmptyString,
		registerItemId: nonEmptyString,
	})
	.passthrough();

const RegisterSourceLinkSchemaRuntime = z
	.object({
		linkedAt: nonEmptyString,
		sourceId: nonEmptyString,
	})
	.passthrough();

const RegisterAffectedDocumentLinkSchemaRuntime = z
	.object({
		documentCanonicalId: nonEmptyString,
		linkedAt: nonEmptyString,
	})
	.passthrough();

const BaseRegisterItemSchemaRuntime = z.object({
	affectedDocumentLinks: z
		.array(RegisterAffectedDocumentLinkSchemaRuntime)
		.default([]),
	confidence: z.string().min(1),
	createdAt: nonEmptyString,
	id: nonEmptyString,
	kind: z.enum([
		'decision',
		'assumption',
		'hypothesis',
		'risk',
		'open_question',
	]),
	lifecycleHistory: z.array(RegisterLifecycleEventSchemaRuntime).default([]),
	reviewState: z.string().min(1),
	sourceLinks: z.array(RegisterSourceLinkSchemaRuntime).default([]),
	status: z.string().min(1),
	title: nonEmptyString,
	updatedAt: nonEmptyString,
});

const DecisionRegisterItemSchemaRuntime = BaseRegisterItemSchemaRuntime.extend({
	decisionStatement: nonEmptyString,
	kind: z.literal('decision'),
}).passthrough();

const AssumptionRegisterItemSchemaRuntime =
	BaseRegisterItemSchemaRuntime.extend({
		assumptionStatement: nonEmptyString,
		kind: z.literal('assumption'),
	}).passthrough();

const HypothesisRegisterItemSchemaRuntime =
	BaseRegisterItemSchemaRuntime.extend({
		hypothesisStatement: nonEmptyString,
		kind: z.literal('hypothesis'),
	}).passthrough();

const RiskRegisterItemSchemaRuntime = BaseRegisterItemSchemaRuntime.extend({
	kind: z.literal('risk'),
	riskStatement: nonEmptyString,
}).passthrough();

const OpenQuestionRegisterItemSchemaRuntime =
	BaseRegisterItemSchemaRuntime.extend({
		isBlocking: z.boolean().default(false),
		kind: z.literal('open_question'),
		questionText: nonEmptyString,
	}).passthrough();

const RegisterCollectionsSchemaRuntime = z
	.object({
		assumptions: z.array(AssumptionRegisterItemSchemaRuntime).default([]),
		decisions: z.array(DecisionRegisterItemSchemaRuntime).default([]),
		hypotheses: z.array(HypothesisRegisterItemSchemaRuntime).default([]),
		lifecycleEvents: z.array(RegisterLifecycleEventSchemaRuntime).default([]),
		openQuestions: z.array(OpenQuestionRegisterItemSchemaRuntime).default([]),
		risks: z.array(RiskRegisterItemSchemaRuntime).default([]),
	})
	.passthrough();

export const WorkspaceStateSchema = z
	.object({
		artifacts: z.array(WorkspaceArtifactSchema).default([]),
		assumptions: z.array(WorkspaceAssumptionSchema).default([]),
		auditEvents: z.array(WorkspaceAuditEventSchema).default([]),
		claimSourceLinks: z.array(ProvenanceClaimSourceLinkSchema).default([]),
		claims: z.array(ProvenanceClaimRecordSchema).default([]),
		decisions: z.array(WorkspaceDecisionSchema).default([]),
		documentation: DocumentationRootConfigSchema,
		generationRuns: z.array(WorkspaceGenerationRunSchema).default([]),
		migrations: z.array(WorkspaceMigrationRecordSchema).default([]),
		openQuestions: z.array(WorkspaceOpenQuestionSchema).default([]),
		profile: WorkspaceProfileLockSchema,
		proposals: z.array(WorkspaceProposalSchema).default([]),
		provider: WorkspaceProviderConfigReferenceSchema.optional(),
		registers: RegisterCollectionsSchemaRuntime.optional(),
		risks: z.array(WorkspaceRiskSchema).default([]),
		runs: z.array(WorkspaceRunRecordSchema).default([]),
		schemaVersion: z.literal(WORKSPACE_STATE_SCHEMA_VERSION),
		sessions: z.array(WorkspaceSessionSchema).default([]),
		sources: z.array(ProvenanceSourceRecordSchema).default([]),
		validationRuns: z.array(WorkspaceValidationRunSchema).default([]),
		workspace: WorkspaceMetadataSchema,
	})
	.superRefine((state, ctx) => {
		addSecretLikeStringIssues(state, ctx);
	});

export type WorkspaceState = z.infer<typeof WorkspaceStateSchema>;
