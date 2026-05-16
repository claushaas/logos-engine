/** Provider Response Validation — zod schemas for validating AI provider responses */

import { z } from 'zod';
import type {
	AiProviderDiagnostic,
	AiProviderOperation,
	AiProviderResponse,
	AiProviderResponseValidationResult,
	StructuredExtractionResponse,
} from './provider-port.js';

// ---------------------------------------------------------------------------
// Zod schemas for response sub-types
// ---------------------------------------------------------------------------

const ConversationMessageSchema = z.object({
	content: z.string(),
	role: z.enum(['user', 'assistant', 'system']),
});

const StructuredExtractionRecordSchema = z.object({
	confidence: z.enum(['low', 'medium', 'high', 'advisory']).optional(),
	fields: z.record(z.string(), z.unknown()),
	isProposed: z.boolean(),
	recordId: z.string().min(1),
	recordType: z.string().min(1),
});

const SuggestionItemSchema = z.object({
	category: z.string().optional(),
	confidence: z.enum(['low', 'medium', 'high', 'advisory']).optional(),
	id: z.string().min(1),
	isProposed: z.boolean(),
	text: z.string().min(1),
});

const StartupBriefingItemSchema = z.object({
	category: z.string().optional(),
	id: z.string().min(1),
	priority: z.enum(['low', 'medium', 'high', 'critical']),
	text: z.string().min(1),
});

const AiProviderDiagnosticSchema = z.object({
	code: z.string().min(1),
	message: z.string().min(1),
	path: z.string().optional(),
	pointer: z.string().optional(),
	recoveryHint: z.string().optional(),
	severity: z.enum(['error', 'warning', 'info']),
});

// ---------------------------------------------------------------------------
// Operation-specific response schemas
// ---------------------------------------------------------------------------

const BaseResponseSchema = z.object({
	diagnostics: z.array(AiProviderDiagnosticSchema).default([]),
	operation: z.enum([
		'conversation',
		'structured_extraction',
		'suggestion',
		'startup_briefing',
	]),
	status: z.enum(['success', 'failure', 'blocked']),
});

const ConversationResponseSchema = BaseResponseSchema.extend({
	messages: z.array(ConversationMessageSchema),
	operation: z.literal('conversation'),
});

const StructuredExtractionResponseSchema = BaseResponseSchema.extend({
	extractions: z.array(StructuredExtractionRecordSchema),
	operation: z.literal('structured_extraction'),
});

const SuggestionResponseSchema = BaseResponseSchema.extend({
	operation: z.literal('suggestion'),
	suggestions: z.array(SuggestionItemSchema),
});

const StartupBriefingResponseSchema = BaseResponseSchema.extend({
	briefingItems: z.array(StartupBriefingItemSchema),
	operation: z.literal('startup_briefing'),
	summary: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

function zodIssueToDiagnostic(
	issue: z.ZodIssue,
	operation: AiProviderOperation,
): AiProviderDiagnostic {
	const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
	return {
		code: issue.code,
		message: issue.message,
		path,
		pointer: `/${operation}/response/${path}`,
		recoveryHint:
			'The provider returned an unexpected response shape; check provider compatibility',
		severity: 'error',
	};
}

function validateResponseShape<T extends AiProviderResponse>(
	schema: z.ZodSchema<T>,
	response: unknown,
	operation: AiProviderOperation,
): AiProviderResponseValidationResult {
	// Check operation mismatch first, before full schema validation
	if (
		response !== null &&
		typeof response === 'object' &&
		'operation' in response
	) {
		const respOp = (response as Record<string, unknown>).operation;
		if (typeof respOp === 'string' && respOp !== operation) {
			return {
				diagnostics: [
					{
						code: 'E_RESPONSE_OPERATION_MISMATCH',
						message: `Response operation "${respOp}" does not match requested operation "${operation}"`,
						path: 'operation',
						pointer: `/${operation}/response/operation`,
						recoveryHint:
							'Discard the response and retry with the correct operation',
						severity: 'error',
					},
				],
				valid: false,
			};
		}
	}

	const result = schema.safeParse(response);

	if (result.success) {
		return { diagnostics: [], valid: true };
	}

	return {
		diagnostics: result.error.issues.map((issue) =>
			zodIssueToDiagnostic(issue, operation),
		),
		valid: false,
	};
}

export function validateConversationResponse(
	response: unknown,
): AiProviderResponseValidationResult {
	return validateResponseShape(
		ConversationResponseSchema,
		response,
		'conversation',
	);
}

export function validateStructuredExtractionResponse(
	response: unknown,
): AiProviderResponseValidationResult {
	return validateResponseShape(
		StructuredExtractionResponseSchema,
		response,
		'structured_extraction',
	);
}

export function validateSuggestionResponse(
	response: unknown,
): AiProviderResponseValidationResult {
	return validateResponseShape(
		SuggestionResponseSchema,
		response,
		'suggestion',
	);
}

export function validateStartupBriefingResponse(
	response: unknown,
): AiProviderResponseValidationResult {
	return validateResponseShape(
		StartupBriefingResponseSchema,
		response,
		'startup_briefing',
	);
}

export function validateProviderResponse(
	response: unknown,
	operation: AiProviderOperation,
): AiProviderResponseValidationResult {
	switch (operation) {
		case 'conversation':
			return validateConversationResponse(response);
		case 'structured_extraction':
			return validateStructuredExtractionResponse(response);
		case 'suggestion':
			return validateSuggestionResponse(response);
		case 'startup_briefing':
			return validateStartupBriefingResponse(response);
		default: {
			const _exhaustive: never = operation;
			void _exhaustive;
			return {
				diagnostics: [
					{
						code: 'E_UNKNOWN_OPERATION',
						message: `Unknown operation: ${String(operation)}`,
						path: '(root)',
						pointer: undefined,
						recoveryHint: 'Use a recognized provider operation',
						severity: 'error',
					},
				],
				valid: false,
			};
		}
	}
}

// ---------------------------------------------------------------------------
// Ensure all structured extraction records are marked as proposed
// ---------------------------------------------------------------------------

export function assertAllRecordsProposed(
	response: StructuredExtractionResponse,
): AiProviderResponseValidationResult {
	const failures: AiProviderDiagnostic[] = [];

	for (let i = 0; i < response.extractions.length; i++) {
		const record = response.extractions[i];
		if (!record) continue;
		if (!record.isProposed) {
			failures.push({
				code: 'E_RECORD_NOT_PROPOSED',
				message: `Extraction record "${record.recordId}" is not marked as proposed; AI output must not be treated as confirmed`,
				path: `extractions[${i}].isProposed`,
				pointer: `/structured_extraction/response/extractions[${i}]/isProposed`,
				recoveryHint:
					'All AI extraction records must be marked as proposed (isProposed: true)',
				severity: 'error',
			});
		}
	}

	return {
		diagnostics: failures,
		valid: failures.length === 0,
	};
}
