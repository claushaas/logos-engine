/**
 * Tests for repair prompt generation.
 *
 * Covers:
 * 1. `buildRepairPrompt` preserves original system prompt, messages, schema.
 * 2. `buildRepairPrompt` appends repair instructions with error details.
 * 3. `buildRepairPrompt` includes "Do not re-ask the original task."
 * 4. `buildNextRepairAttempt` increments the attempt counter.
 * 5. `buildNextRepairAttempt` enforces the retry limit.
 * 6. `repair_failed` error is recoverable and includes diagnostics.
 */
import { describe, expect, it } from 'vitest';

import type { LlmRequest } from '../../src/prompt-orchestration/prompt-assembler.js';
import { isOk, isErr } from '../../src/shared/index.js';
import {
	type RepairAttempt,
	type RepairFailedError,
	type ValidationError,
	buildRepairPrompt,
	buildNextRepairAttempt,
	DEFAULT_REPAIR_ATTEMPT_LIMIT,
} from '../../src/validation/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** A minimal valid LlmRequest fixture. */
function makeOriginalRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
	return {
		messages: [
			{ content: 'Node: Project Thesis', role: 'user' },
			{ content: 'What is the central thesis?', role: 'user' },
		],
		schema: { name: 'AgentTurnOutput' },
		systemPrompt: 'You are an expert interviewer.',
		...overrides,
	};
}

/** A set of realistic validation errors. */
function makeSampleErrors(): ValidationError[] {
	return [
		{
			code: 'INVALID_TRANSITION',
			message:
				'Cannot transition from "not_started" to "synthesized": transition is not permitted by the lifecycle state machine',
			path: ['proposedLifecycle'],
		},
		{
			code: 'DRAFT_IN_DISALLOWED_STATE',
			message:
				'Canonical answer draft may only be proposed during synthesis or review.',
			path: ['canonicalAnswerDraft'],
		},
		{
			code: 'too_small',
			message: 'String must contain at least 1 character(s)',
			path: ['userFacingMessage'],
		},
	];
}

/** Errors with empty paths (used to test `<root>` formatting). */
function makeEmptyPathErrors(): ValidationError[] {
	return [
		{
			code: 'invalid_type',
			message: 'Expected object, received null',
			path: [],
		},
	];
}

// ═══════════════════════════════════════════════════════════════════════════
// buildRepairPrompt tests
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRepairPrompt', () => {
	it('preserves the original system prompt', () => {
		const original = makeOriginalRequest({
			systemPrompt: 'You are an expert interviewer.',
		});
		const result = buildRepairPrompt(original, makeSampleErrors());

		expect(result.systemPrompt).toContain('You are an expert interviewer.');
	});

	it('preserves the original messages', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, makeSampleErrors());

		// Messages 0 and 1 should be unchanged
		expect(result.messages[0]).toEqual(original.messages[0]);
		expect(result.messages[1]).toEqual(original.messages[1]);
		// A repair instruction message should be appended
		expect(result.messages.length).toBe(original.messages.length + 1);
	});

	it('preserves the schema reference', () => {
		const schema = { name: 'CustomSchema', fields: {} };
		const original = makeOriginalRequest({ schema });
		const result = buildRepairPrompt(original, makeSampleErrors());

		expect(result.schema).toBe(schema);
	});

	it('preserves model and temperature fields', () => {
		const original = makeOriginalRequest({
			model: 'gpt-5',
			temperature: 0.7,
		});
		const result = buildRepairPrompt(original, makeSampleErrors());

		expect(result.model).toBe('gpt-5');
		expect(result.temperature).toBe(0.7);
	});

	it('preserves metadata fields', () => {
		const original = makeOriginalRequest({
			metadata: { traceId: 'abc123', nodeId: 'n1' },
		});
		const result = buildRepairPrompt(original, makeSampleErrors());

		expect(result.metadata).toEqual({ traceId: 'abc123', nodeId: 'n1' });
	});

	it('appends "Repair Mode" to the system prompt', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, makeSampleErrors());

		expect(result.systemPrompt).toContain('## Repair Mode');
	});

	it('includes the repair instruction phrase', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, makeSampleErrors());
		const repairMessage = result.messages[result.messages.length - 1];

		expect(repairMessage.role).toBe('user');
		expect(repairMessage.content).toContain(
			'Your previous output failed validation. Fix these errors:',
		);
	});

	it('list all validation errors with codes', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildRepairPrompt(original, errors);

		const repairMessage = result.messages[result.messages.length - 1];
		const content = repairMessage.content;

		for (const e of errors) {
			expect(content).toContain(e.code);
		}
	});

	it('list all validation error messages', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildRepairPrompt(original, errors);

		const repairMessage = result.messages[result.messages.length - 1];
		const content = repairMessage.content;

		for (const e of errors) {
			expect(content).toContain(e.message);
		}
	});

	it('includes error paths in the repair message', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildRepairPrompt(original, errors);

		const repairMessage = result.messages[result.messages.length - 1];
		const content = repairMessage.content;

		// Should include the dotted path for non-empty paths
		expect(content).toContain('proposedLifecycle');
		expect(content).toContain('canonicalAnswerDraft');
		expect(content).toContain('userFacingMessage');
	});

	it('uses <root> for empty error paths', () => {
		const original = makeOriginalRequest();
		const errors = makeEmptyPathErrors();
		const result = buildRepairPrompt(original, errors);

		const repairMessage = result.messages[result.messages.length - 1];
		expect(repairMessage.content).toContain('<root>');
	});

	it('includes "Do not re-ask the original task" guard rule', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, makeSampleErrors());

		const repairMessage = result.messages[result.messages.length - 1];
		expect(repairMessage.content).toContain(
			'Do not re-ask the original task.',
		);
	});

	it('includes "Do not reinterpret or expand the original request" guard rule', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, makeSampleErrors());

		const repairMessage = result.messages[result.messages.length - 1];
		expect(repairMessage.content).toContain(
			'Do not reinterpret or expand the original request.',
		);
	});

	it('includes "Return only a corrected structured output" guard rule', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, makeSampleErrors());

		const repairMessage = result.messages[result.messages.length - 1];
		expect(repairMessage.content).toContain(
			'Return only a corrected structured output conforming to the schema.',
		);
	});

	it('works with a single validation error', () => {
		const original = makeOriginalRequest();
		const errors: ValidationError[] = [
			{
				code: 'INVALID_TYPE',
				message: 'Expected string, got number',
				path: ['userFacingMessage'],
			},
		];
		const result = buildRepairPrompt(original, errors);

		const repairMessage = result.messages[result.messages.length - 1];
		expect(repairMessage.content).toContain('INVALID_TYPE');
	});

	it('works with no validation errors (defensive)', () => {
		const original = makeOriginalRequest();
		const result = buildRepairPrompt(original, []);

		// Should still append repair instructions even with empty errors
		const repairMessage = result.messages[result.messages.length - 1];
		expect(repairMessage.content).toContain(
			'Your previous output failed validation. Fix these errors:',
		);
	});

	it('does not mutate the original request', () => {
		const original = makeOriginalRequest();
		const originalMessagesLen = original.messages.length;
		const originalSystemPrompt = original.systemPrompt;

		buildRepairPrompt(original, makeSampleErrors());

		// Original should be untouched
		expect(original.messages.length).toBe(originalMessagesLen);
		expect(original.systemPrompt).toBe(originalSystemPrompt);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// buildNextRepairAttempt tests
// ═══════════════════════════════════════════════════════════════════════════

describe('buildNextRepairAttempt', () => {
	it('returns ok with attempt 1 when 0 attempts have been used', () => {
		const original = makeOriginalRequest();
		const result = buildNextRepairAttempt(original, makeSampleErrors(), 0);

		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.attempt).toBe(1);
			expect(result.value.maxAttempts).toBe(DEFAULT_REPAIR_ATTEMPT_LIMIT);
			expect(result.value.request.systemPrompt).toContain('Repair Mode');
		}
	});

	it('increments the attempt counter', () => {
		const original = makeOriginalRequest();
		const r1 = buildNextRepairAttempt(original, makeSampleErrors(), 1);
		expect(isOk(r1)).toBe(true);
		if (isOk(r1)) {
			expect(r1.value.attempt).toBe(2);
		}

		const r2 = buildNextRepairAttempt(original, makeSampleErrors(), 2);
		expect(isOk(r2)).toBe(true);
		if (isOk(r2)) {
			expect(r2.value.attempt).toBe(3);
		}
	});

	it('returns repair_failed when attemptsUsed equals maxAttempts (3/3)', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildNextRepairAttempt(
			original,
			errors,
			3,
			DEFAULT_REPAIR_ATTEMPT_LIMIT,
		);

		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			const err_: RepairFailedError = result.error as RepairFailedError;
			expect(err_.code).toBe('repair_failed');
			expect(err_.recoverable).toBe(true);
			expect(err_.diagnostics.attempts).toBe(3);
			expect(err_.diagnostics.maxAttempts).toBe(DEFAULT_REPAIR_ATTEMPT_LIMIT);
			expect(err_.diagnostics.validationErrors).toBe(errors);
		}
	});

	it('returns repair_failed when attemptsUsed exceeds maxAttempts', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildNextRepairAttempt(
			original,
			errors,
			5, // Already used 5 attempts, exceeding default of 3
		);

		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.code).toBe('repair_failed');
		}
	});

	it('includes validation errors in the failed error diagnostics', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildNextRepairAttempt(
			original,
			errors,
			DEFAULT_REPAIR_ATTEMPT_LIMIT,
			DEFAULT_REPAIR_ATTEMPT_LIMIT,
		);

		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.diagnostics.validationErrors).toEqual(errors);
		}
	});

	it('respects a custom maxAttempts value', () => {
		const customLimit = 2;
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();

		// After 1 attempt used, still room for one more
		const r1 = buildNextRepairAttempt(original, errors, 0, customLimit);
		expect(isOk(r1)).toBe(true);
		if (isOk(r1)) {
			expect(r1.value.attempt).toBe(1);
			expect(r1.value.maxAttempts).toBe(customLimit);
		}

		// After 2 attempts used with limit 2, should fail
		const r2 = buildNextRepairAttempt(original, errors, 2, customLimit);
		expect(isErr(r2)).toBe(true);
		if (isErr(r2)) {
			expect(r2.error.code).toBe('repair_failed');
			expect(r2.error.diagnostics.maxAttempts).toBe(customLimit);
		}
	});

	it('includes attempt metadata in the assembled request', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildNextRepairAttempt(original, errors, 0);

		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			const metadata = result.value.request.metadata ?? {};
			expect(metadata.repairAttempt).toBe(1);
			expect(metadata.maxRepairAttempts).toBe(DEFAULT_REPAIR_ATTEMPT_LIMIT);
			expect(metadata.repairErrorCount).toBe(errors.length);
		}
	});

	it('merges repair metadata with existing metadata', () => {
		const original = makeOriginalRequest({
			metadata: { traceId: 'xyz', nodeId: 'n1' },
		});
		const result = buildNextRepairAttempt(original, makeSampleErrors(), 0);

		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			const metadata = result.value.request.metadata ?? {};
			expect(metadata.traceId).toBe('xyz');
			expect(metadata.nodeId).toBe('n1');
			expect(metadata.repairAttempt).toBe(1);
			expect(metadata.maxRepairAttempts).toBe(DEFAULT_REPAIR_ATTEMPT_LIMIT);
		}
	});

	it('repair_failed error message mentions attempt counts', () => {
		const original = makeOriginalRequest();
		const errors = makeSampleErrors();
		const result = buildNextRepairAttempt(original, errors, 3);

		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.message).toContain('3/3');
			expect(result.error.message).toContain(String(errors.length));
		}
	});
});
