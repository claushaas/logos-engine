/** Step 8.2 — Register Schemas: Zod validation for all register types */

import { z } from 'zod';
import {
	isLikelyRawSecret,
	redactSecretValue,
} from '../state/workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const nonEmptyString = z.string().min(1);
const _isoTimestamp = z.string().datetime({ offset: true }).optional();

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const RegisterKindSchema = z.enum([
	'decision',
	'assumption',
	'hypothesis',
	'risk',
	'open_question',
]);

export const RegisterSharedStatusSchema = z.enum([
	'proposed',
	'confirmed',
	'rejected',
	'superseded',
]);

export const OpenQuestionStatusSchema = z.enum([
	'open',
	'resolved',
	'rejected',
	'superseded',
]);

export const RiskStatusSchema = z.enum([
	'proposed',
	'accepted',
	'mitigated',
	'resolved',
	'rejected',
	'superseded',
]);

export const HypothesisStatusSchema = z.enum([
	'proposed',
	'active',
	'validated',
	'invalidated',
	'inconclusive',
	'superseded',
]);

export const RegisterReviewStateSchema = z.enum([
	'not_required',
	'requires_review',
	'in_review',
	'approved',
	'rejected',
	'blocked',
]);

export const RegisterConfidenceSchema = z.enum([
	'explicit',
	'derived',
	'inferred',
	'unknown',
]);

// ---------------------------------------------------------------------------
// Lifecycle event
// ---------------------------------------------------------------------------

export const RegisterLifecycleEventTypeSchema = z.enum([
	'created',
	'proposed',
	'confirmed',
	'rejected',
	'revised',
	'superseded',
	'resolved',
	'reopened',
	'accepted',
	'mitigated',
	'activated',
	'validated',
	'invalidated',
	'inconclusive',
	'source_linked',
	'document_linked',
	'document_unlinked',
	'review_started',
	'review_approved',
	'review_rejected',
	'review_blocked',
]);

export const RegisterLifecycleEventSchema = z.object({
	actor: z.string().optional(),
	diagnostics: z.array(z.unknown()).optional(),
	eventId: nonEmptyString,
	eventType: RegisterLifecycleEventTypeSchema,
	fromReviewState: RegisterReviewStateSchema.optional(),
	fromStatus: z.string().optional(),
	notes: z.string().optional(),
	occurredAt: nonEmptyString,
	operationSource: z.string().optional(),
	registerItemId: nonEmptyString,
	sessionId: z.string().optional(),
	toReviewState: RegisterReviewStateSchema.optional(),
	toStatus: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Source and affected document links
// ---------------------------------------------------------------------------

export const RegisterSourceLinkSchema = z.object({
	answerId: z.string().optional(),
	claimId: z.string().optional(),
	documentDescriptorRef: z.string().optional(),
	label: z.string().optional(),
	linkedAt: nonEmptyString,
	profileDescriptorRef: z.string().optional(),
	proposalId: z.string().optional(),
	sessionId: z.string().optional(),
	sourceId: nonEmptyString,
	sourceType: z.string().optional(),
});

export const RegisterAffectedDocumentLinkSchema = z.object({
	documentCanonicalId: nonEmptyString,
	graphNodeId: z.string().optional(),
	linkedAt: nonEmptyString,
	phaseId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export const RegisterOperationDiagnosticSchema = z.object({
	code: z.string().min(1),
	expected: z.unknown().optional(),
	message: z.string().min(1),
	path: z.string().optional(),
	pointer: z.string().optional(),
	received: z.unknown().optional(),
	recoveryHint: z.string().optional(),
	relatedClaimId: z.string().optional(),
	relatedDocumentId: z.string().optional(),
	relatedPhaseId: z.string().optional(),
	relatedRegisterItemId: z.string().optional(),
	relatedRegisterKind: RegisterKindSchema.optional(),
	relatedSourceId: z.string().optional(),
	severity: z.enum(['error', 'warning', 'info']),
});

// ---------------------------------------------------------------------------
// Register item schemas
// ---------------------------------------------------------------------------

const baseRegisterItemSchema = {
	acceptedAt: z.string().optional(),
	affectedDocumentLinks: z
		.array(RegisterAffectedDocumentLinkSchema)
		.default([]),
	body: z.string().optional(),
	confidence: RegisterConfidenceSchema,
	createdAt: nonEmptyString,
	decidedAt: z.string().optional(),
	details: z.string().optional(),
	diagnostics: z.array(RegisterOperationDiagnosticSchema).default([]),
	id: nonEmptyString,
	kind: RegisterKindSchema,
	lifecycleHistory: z.array(RegisterLifecycleEventSchema).default([]),
	resolvedAt: z.string().optional(),
	reviewState: RegisterReviewStateSchema,
	sourceLinks: z.array(RegisterSourceLinkSchema).default([]),
	status: z.string().min(1),
	supersededAt: z.string().optional(),
	title: nonEmptyString,
	updatedAt: nonEmptyString,
};

export const DecisionRegisterItemSchema = z.object({
	...baseRegisterItemSchema,
	alternativesConsidered: z.array(z.string()).optional(),
	consequences: z.string().optional(),
	decisionStatement: nonEmptyString,
	kind: z.literal('decision'),
	rationale: z.string().optional(),
	status: RegisterSharedStatusSchema,
	supersededBy: z.string().optional(),
	supersedes: z.string().optional(),
});

export const AssumptionRegisterItemSchema = z.object({
	...baseRegisterItemSchema,
	assumptionStatement: nonEmptyString,
	kind: z.literal('assumption'),
	relatedHypothesisIds: z.array(z.string()).optional(),
	relatedOpenQuestionIds: z.array(z.string()).optional(),
	relatedRiskIds: z.array(z.string()).optional(),
	reviewDate: z.string().optional(),
	reviewTrigger: z.string().optional(),
	scope: z.string().optional(),
	status: RegisterSharedStatusSchema,
});

export const HypothesisRegisterItemSchema = z.object({
	...baseRegisterItemSchema,
	evidenceSourceIds: z.array(z.string()).optional(),
	expectedSignal: z.string().optional(),
	hypothesisStatement: nonEmptyString,
	kind: z.literal('hypothesis'),
	outcomeStatus: z
		.enum(['active', 'validated', 'invalidated', 'inconclusive'])
		.optional(),
	relatedAssumptionIds: z.array(z.string()).optional(),
	relatedRiskIds: z.array(z.string()).optional(),
	status: HypothesisStatusSchema,
	validationMethod: z.string().optional(),
});

export const RiskRegisterItemSchema = z.object({
	...baseRegisterItemSchema,
	acceptedRiskMarker: z.boolean().optional(),
	impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
	kind: z.literal('risk'),
	likelihood: z.enum(['low', 'medium', 'high', 'critical']).optional(),
	mitigation: z.string().optional(),
	owner: z.string().optional(),
	relatedAssumptionIds: z.array(z.string()).optional(),
	relatedDecisionIds: z.array(z.string()).optional(),
	relatedHypothesisIds: z.array(z.string()).optional(),
	relatedOpenQuestionIds: z.array(z.string()).optional(),
	riskStatement: nonEmptyString,
	status: RiskStatusSchema,
});

export const OpenQuestionRegisterItemSchema = z.object({
	...baseRegisterItemSchema,
	isBlocking: z.boolean().default(false),
	kind: z.literal('open_question'),
	questionText: nonEmptyString,
	resolutionSummary: z.string().optional(),
	resolvedByClaimId: z.string().optional(),
	resolvedByDecisionId: z.string().optional(),
	resolvedBySourceId: z.string().optional(),
	status: OpenQuestionStatusSchema,
	whyItMatters: z.string().optional(),
});

export const AnyRegisterItemSchema = z.discriminatedUnion('kind', [
	DecisionRegisterItemSchema,
	AssumptionRegisterItemSchema,
	HypothesisRegisterItemSchema,
	RiskRegisterItemSchema,
	OpenQuestionRegisterItemSchema,
]);

// ---------------------------------------------------------------------------
// Operation input schema
// ---------------------------------------------------------------------------

export const RegisterOperationInputSchema = z.object({
	affectedDocumentLinks: z.array(RegisterAffectedDocumentLinkSchema).optional(),
	alternativesConsidered: z.array(z.string()).optional(),
	answerId: z.string().optional(),
	// Assumption-specific
	assumptionStatement: z.string().optional(),
	body: z.string().optional(),
	confidence: RegisterConfidenceSchema.optional(),
	consequences: z.string().optional(),
	// Decision-specific
	decisionStatement: z.string().optional(),
	// Operation control
	dryRun: z.boolean().optional(),
	expectedSignal: z.string().optional(),
	// Hypothesis-specific
	hypothesisStatement: z.string().optional(),
	impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
	isBlocking: z.boolean().optional(),
	kind: RegisterKindSchema,
	likelihood: z.enum(['low', 'medium', 'high', 'critical']).optional(),
	mitigation: z.string().optional(),
	proposalId: z.string().optional(),
	// Open question-specific
	questionText: z.string().optional(),
	rationale: z.string().optional(),
	reviewDate: z.string().optional(),
	reviewState: RegisterReviewStateSchema.optional(),
	reviewTrigger: z.string().optional(),
	// Risk-specific
	riskStatement: z.string().optional(),
	scope: z.string().optional(),
	sessionId: z.string().optional(),
	sourceLinks: z.array(RegisterSourceLinkSchema).optional(),
	status: z.string().optional(),
	title: nonEmptyString,
	validationMethod: z.string().optional(),
	whyItMatters: z.string().optional(),
	// Skipped: clock, idFactory, notes, actor, reason handled at service layer
});

// ---------------------------------------------------------------------------
// Security / redaction helpers
// ---------------------------------------------------------------------------

export function looksLikeTokenValue(value: string): boolean {
	return isLikelyRawSecret(value);
}

export function redactTokenLikeValue(value: string): string {
	if (!looksLikeTokenValue(value)) return value;
	return redactSecretValue(value);
}

export function collectTokenFindings(
	value: unknown,
	path: string[],
): { path: string; value: string }[] {
	const findings: { path: string; value: string }[] = [];
	if (typeof value === 'string') {
		if (looksLikeTokenValue(value)) {
			findings.push({ path: path.join('.'), value });
		}
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => {
			findings.push(...collectTokenFindings(item, [...path, String(index)]));
		});
	} else if (value !== null && typeof value === 'object') {
		for (const [key, item] of Object.entries(
			value as Record<string, unknown>,
		)) {
			findings.push(...collectTokenFindings(item, [...path, key]));
		}
	}
	return findings;
}

export function redactTokenValues(obj: unknown): unknown {
	if (typeof obj === 'string') {
		if (looksLikeTokenValue(obj)) return redactSecretValue(obj);
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(redactTokenValues);
	}
	if (obj !== null && typeof obj === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			result[key] = redactTokenValues(value);
		}
		return result;
	}
	return obj;
}
