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
]);

export const WorkspaceProfileLockSchema = z.object({
	lockedAt: z.string().optional(),
	profileId: z.string().min(1).default('standard'),
	profileSchemaVersion: z.string().optional(),
	profileVersion: z.string().optional(),
	registryPath: z.string().optional(),
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

export const TokenSourceSchema = z
	.string()
	.refine((val: string) => !looksLikeSecret(val), {
		message: `Provider token source appears to contain a raw secret value. Store only an environment variable name, not the token itself.`,
	});

export const WorkspaceProviderConfigReferenceSchema = z.object({
	apiKeyEnvVarName: TokenSourceSchema.optional(),
	disclosureAcceptedAt: z.string().optional(),
	enabled: z.boolean().default(false),
	endpoint: z.string().optional(),
	modelId: z.string().optional(),
	providerId: z.string().min(1),
	providerName: z.string().optional(),
	remotePolicyFlags: z.record(z.string(), z.unknown()).optional(),
	tokenEnvVarName: TokenSourceSchema.optional(),
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
	'intake',
	'generation',
	'validation',
	'diagnostic',
	'manual',
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
// Top-level WorkspaceState
// ---------------------------------------------------------------------------

export const WorkspaceStateSchema = z.object({
	artifacts: z.array(WorkspaceArtifactSchema).default([]),
	assumptions: z.array(WorkspaceAssumptionSchema).default([]),
	auditEvents: z.array(WorkspaceAuditEventSchema).default([]),
	decisions: z.array(WorkspaceDecisionSchema).default([]),
	documentation: DocumentationRootConfigSchema,
	generationRuns: z.array(WorkspaceGenerationRunSchema).default([]),
	migrations: z.array(WorkspaceMigrationRecordSchema).default([]),
	openQuestions: z.array(WorkspaceOpenQuestionSchema).default([]),
	profile: WorkspaceProfileLockSchema,
	provider: WorkspaceProviderConfigReferenceSchema.optional(),
	risks: z.array(WorkspaceRiskSchema).default([]),
	schemaVersion: z.string().min(1),
	sessions: z.array(WorkspaceSessionSchema).default([]),
	validationRuns: z.array(WorkspaceValidationRunSchema).default([]),
	workspace: WorkspaceMetadataSchema,
});

export type WorkspaceState = z.infer<typeof WorkspaceStateSchema>;
