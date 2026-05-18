/** Step 8.1 — Provenance Zod schemas for runtime validation */

import { z } from 'zod';
import {
	looksLikeSecretLikeValue,
	redactSecretLikeString,
} from '../validation/validation-finding.js';
import {
	CLAIM_CONFIDENCES,
	CLAIM_REVIEW_STATES,
	CLAIM_SOURCE_LINK_TYPES,
	CLAIM_STATUSES,
	CLAIM_TYPES,
	SOURCE_CONFIDENCES,
	SOURCE_STATUSES,
	SOURCE_TYPES,
} from './provenance-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isoTimestamp = z.string().datetime({ offset: true }).optional();
const nonEmptyString = z.string().min(1);

function redactSecret(input: string): string {
	return redactSecretLikeString(input);
}

// ---------------------------------------------------------------------------
// Source schema
// ---------------------------------------------------------------------------

export const SourceTypeSchema = z.enum(
	SOURCE_TYPES as unknown as readonly [string, ...string[]],
);
export const SourceStatusSchema = z.enum(
	SOURCE_STATUSES as unknown as readonly [string, ...string[]],
);
export const SourceConfidenceSchema = z.enum(
	SOURCE_CONFIDENCES as unknown as readonly [string, ...string[]],
);

const SourceLocationSchema = z.object({
	line: z.number().int().nonnegative().optional(),
	path: z.string().optional(),
	pointer: z.string().optional(),
	section: z.string().optional(),
});

const SourceTimestampSchema = z.object({
	createdAt: isoTimestamp,
	generatedAt: isoTimestamp,
	observedAt: isoTimestamp,
	updatedAt: isoTimestamp,
});

const SourceMetadataSchema = z
	.record(z.string(), z.unknown())
	.default({})
	.superRefine((metadata, ctx) => {
		for (const [key, value] of Object.entries(metadata)) {
			if (typeof value === 'string' && looksLikeSecretLikeValue(value)) {
				metadata[key] = redactSecret(value);
				ctx.addIssue({
					code: 'custom',
					message: 'Source metadata contains redacted secret-like value.',
					path: [key],
				});
			}
			// Reject raw token-like values
			if (typeof value === 'string' && key.toLowerCase().includes('token')) {
				metadata[key] = redactSecret(value);
				ctx.addIssue({
					code: 'custom',
					message:
						'Source metadata key suggests a token field; value redacted.',
					path: [key],
				});
			}
		}
	});

export const SourceRecordSchema = z
	.object({
		confidence: SourceConfidenceSchema,
		externalUri: z.string().optional(),
		location: SourceLocationSchema.default({}),
		metadata: SourceMetadataSchema,
		orderIndex: z.number().int().nonnegative(),
		relatedArtifactId: z.string().optional(),
		relatedDocumentCanonicalId: z.string().optional(),
		relatedPhaseId: z.string().optional(),
		relatedProposalId: z.string().optional(),
		relatedValidationFindingId: z.string().optional(),
		relatedWorkspaceRecordId: z.string().optional(),
		sourceId: nonEmptyString,
		sourceType: SourceTypeSchema,
		status: SourceStatusSchema,
		timestamp: SourceTimestampSchema.default({}),
		title: nonEmptyString,
	})
	.superRefine((record, ctx) => {
		if (record.externalUri) {
			if (
				record.externalUri.startsWith('http://') ||
				record.externalUri.startsWith('https://')
			) {
				// OK — external URI is permissible
				return;
			}
			if (looksLikeSecretLikeValue(record.externalUri)) {
				ctx.addIssue({
					code: 'custom',
					message:
						'Source externalUri looks like a secret-like value; reject or redact.',
					path: ['externalUri'],
				});
			}
		}
	});

export type SourceRecordSchemaType = z.infer<typeof SourceRecordSchema>;

export const SourceReferenceSchema = z.object({
	label: z.string().optional(),
	path: z.string().optional(),
	pointer: z.string().optional(),
	sourceId: nonEmptyString,
	sourceType: SourceTypeSchema,
});

export const SourceResolutionDiagnosticSchema = z.object({
	code: z.string(),
	expected: z.unknown().optional(),
	message: z.string(),
	pointer: z.string().optional(),
	received: z.unknown().optional(),
	recoveryHint: z.string().optional(),
	relatedClaimId: z.string().optional(),
	relatedDocumentId: z.string().optional(),
	relatedPhaseId: z.string().optional(),
	relatedSourceId: z.string().optional(),
	relatedWorkspaceRecordId: z.string().optional(),
	severity: z.enum(['error', 'warning', 'info']),
	sourcePath: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Claim schema
// ---------------------------------------------------------------------------

export const ClaimTypeSchema = z.enum(
	CLAIM_TYPES as unknown as readonly [string, ...string[]],
);
export const ClaimStatusSchema = z.enum(
	CLAIM_STATUSES as unknown as readonly [string, ...string[]],
);
export const ClaimConfidenceSchema = z.enum(
	CLAIM_CONFIDENCES as unknown as readonly [string, ...string[]],
);
export const ClaimReviewStateSchema = z.enum(
	CLAIM_REVIEW_STATES as unknown as readonly [string, ...string[]],
);

const ClaimEvidenceSchema = z.object({
	bounded: z.boolean().optional(),
	snippet: z.string(),
	sourcePointer: z.string().optional(),
});

const ClaimResolutionDiagnosticSchema = z.object({
	code: z.string(),
	expected: z.unknown().optional(),
	message: z.string(),
	pointer: z.string().optional(),
	received: z.unknown().optional(),
	recoveryHint: z.string().optional(),
	relatedClaimId: z.string().optional(),
	relatedDocumentId: z.string().optional(),
	relatedPhaseId: z.string().optional(),
	relatedSourceId: z.string().optional(),
	relatedWorkspaceRecordId: z.string().optional(),
	severity: z.enum(['error', 'warning', 'info']),
	sourcePath: z.string().optional(),
});

const ClaimSourceLinkSchema = z.object({
	claimId: nonEmptyString,
	confidence: SourceConfidenceSchema,
	createdAt: isoTimestamp,
	evidence: ClaimEvidenceSchema.optional(),
	explanation: z.string().optional(),
	linkType: z.enum(
		CLAIM_SOURCE_LINK_TYPES as unknown as readonly [string, ...string[]],
	),
	observedAt: isoTimestamp,
	sourceId: nonEmptyString,
	sourcePath: z.string().optional(),
	sourcePointer: z.string().optional(),
	status: SourceStatusSchema,
});

export const ClaimRecordSchema = z.object({
	body: z.string().optional(),
	claimId: nonEmptyString,
	claimType: ClaimTypeSchema,
	confidence: ClaimConfidenceSchema,
	createdAt: isoTimestamp,
	diagnostics: z.array(ClaimResolutionDiagnosticSchema).default([]),
	isGenerated: z.boolean().default(false),
	isInferred: z.boolean().default(false),
	primarySourceId: z.string().optional(),
	relatedArtifactId: z.string().optional(),
	relatedDocumentCanonicalId: z.string().optional(),
	relatedPhaseId: z.string().optional(),
	relatedSectionId: z.string().optional(),
	relatedSectionPath: z.string().optional(),
	relatedWorkspaceRecordId: z.string().optional(),
	reviewState: ClaimReviewStateSchema,
	sourceCount: z.number().int().nonnegative(),
	sourceLinks: z.array(ClaimSourceLinkSchema).default([]),
	status: ClaimStatusSchema,
	summary: nonEmptyString,
	updatedAt: isoTimestamp,
});

export type ClaimRecordSchemaType = z.infer<typeof ClaimRecordSchema>;

// ---------------------------------------------------------------------------
// Query schema
// ---------------------------------------------------------------------------

export const ClaimQuerySchema = z.object({
	artifactFilter: z.string().optional(),
	claimConfidence: ClaimConfidenceSchema.optional(),
	claimId: z.string().optional(),
	claimStatus: ClaimStatusSchema.optional(),
	claimType: ClaimTypeSchema.optional(),
	documentId: z.string().optional(),
	phaseId: z.string().optional(),
	reviewState: ClaimReviewStateSchema.optional(),
	sectionId: z.string().optional(),
	sourceId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateSourceRecord(
	source: unknown,
):
	| { success: true; data: SourceRecordSchemaType }
	| { success: false; issues: z.ZodIssue[] } {
	const result = SourceRecordSchema.safeParse(source);
	if (result.success) return result;
	return { ...result, issues: result.error.issues };
}

export function validateClaimRecord(
	claim: unknown,
):
	| { success: true; data: ClaimRecordSchemaType }
	| { success: false; issues: z.ZodIssue[] } {
	const result = ClaimRecordSchema.safeParse(claim);
	if (result.success) return result;
	return { ...result, issues: result.error.issues };
}

export function validateClaimSourceLink(
	link: unknown,
):
	| { success: true; data: z.infer<typeof ClaimSourceLinkSchema> }
	| { success: false; issues: z.ZodIssue[] } {
	const result = ClaimSourceLinkSchema.safeParse(link);
	if (result.success) return result;
	return { ...result, issues: result.error.issues };
}
