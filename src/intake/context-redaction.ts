/** Context Redaction — redact secret-like values from intake context */

import {
	redactString,
	redactValue,
	relativizePaths,
} from '../runtime/redaction.js';
import type {
	IntakeContext,
	IntakeContextAssumption,
	IntakeContextDecision,
	IntakeContextOpenQuestion,
	IntakeContextRedactionResult,
	IntakeContextRelevantAnswer,
	IntakeContextRisk,
	IntakeContextValidationGap,
} from './intake-context-types.js';

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

const TOKEN_LIKE_PATTERNS = [
	/\bsk-[a-zA-Z0-9]{20,}\b/,
	/\bsk-proj-[a-zA-Z0-9\-_]{20,}\b/,
	/\bgsk_[a-zA-Z0-9]{20,}\b/,
	/\bhf_[a-zA-Z0-9]{20,}\b/,
	/\bBearer\s+\S+/i,
	/\bBasic\s+\S+/i,
];

function isTokenLike(value: string): boolean {
	return TOKEN_LIKE_PATTERNS.some((p) => p.test(value));
}

const SECRET_KEY_PATTERNS = [
	/token/i,
	/secret/i,
	/password/i,
	/api.*key/i,
	/credential/i,
	/private.*key/i,
	/access.*token/i,
	/refresh.*token/i,
	/client.*secret/i,
];

function isSecretKey(key: string): boolean {
	return SECRET_KEY_PATTERNS.some((p) => p.test(key));
}

// ---------------------------------------------------------------------------
// Individual record redaction
// ---------------------------------------------------------------------------

function redactDecision(item: IntakeContextDecision): IntakeContextDecision {
	return {
		...item,
		body: item.body !== undefined ? redactString(item.body) : undefined,
		title: redactString(item.title),
	};
}

function redactAssumption(
	item: IntakeContextAssumption,
): IntakeContextAssumption {
	return {
		...item,
		body: item.body !== undefined ? redactString(item.body) : undefined,
		caveat: item.caveat !== undefined ? redactString(item.caveat) : undefined,
		title: redactString(item.title),
	};
}

function redactOpenQuestion(
	item: IntakeContextOpenQuestion,
): IntakeContextOpenQuestion {
	return {
		...item,
		body: item.body !== undefined ? redactString(item.body) : undefined,
		question: redactString(item.question),
	};
}

function redactRisk(item: IntakeContextRisk): IntakeContextRisk {
	return {
		...item,
		body: item.body !== undefined ? redactString(item.body) : undefined,
		rationale:
			item.rationale !== undefined ? redactString(item.rationale) : undefined,
		title: redactString(item.title),
	};
}

function redactValidationGap(
	item: IntakeContextValidationGap,
): IntakeContextValidationGap {
	return {
		...item,
		description: redactString(item.description),
		sourcePath:
			item.sourcePath !== undefined ? redactString(item.sourcePath) : undefined,
	};
}

function redactAnswer(
	item: IntakeContextRelevantAnswer,
): IntakeContextRelevantAnswer {
	return {
		...item,
		answer: redactString(item.answer),
		questionText: redactString(item.questionText),
	};
}

// ---------------------------------------------------------------------------
// Redaction result builder
// ---------------------------------------------------------------------------

function buildRedactionResult(
	context: IntakeContext,
	options?: { projectRoot?: string },
): IntakeContextRedactionResult {
	const redactedCategories: string[] = [];
	let redactedKeyCount = 0;

	// Scan all context records for secret-like values
	const allRecords: Array<{
		category: string;
		record: Record<string, unknown>;
	}> = [
		...context.decisions.map((d) => ({
			category: 'decisions',
			record: d as unknown as Record<string, unknown>,
		})),
		...context.assumptions.map((a) => ({
			category: 'assumptions',
			record: a as unknown as Record<string, unknown>,
		})),
		...context.openQuestions.map((q) => ({
			category: 'openQuestions',
			record: q as unknown as Record<string, unknown>,
		})),
		...context.risks.map((r) => ({
			category: 'risks',
			record: r as unknown as Record<string, unknown>,
		})),
		...context.validationGaps.map((g) => ({
			category: 'validationGaps',
			record: g as unknown as Record<string, unknown>,
		})),
		...context.answers.map((a) => ({
			category: 'answers',
			record: a as unknown as Record<string, unknown>,
		})),
	];

	const seenCategories = new Set<string>();

	for (const { category, record } of allRecords) {
		for (const [key, value] of Object.entries(record)) {
			if (isSecretKey(key)) {
				redactedKeyCount++;
				seenCategories.add(category);
			}
			if (typeof value === 'string' && isTokenLike(value)) {
				redactedKeyCount++;
				seenCategories.add(category);
			}
		}
	}

	for (const cat of seenCategories) {
		redactedCategories.push(cat);
	}

	const summaryLines: string[] = [];
	if (redactedCategories.length > 0) {
		summaryLines.push(
			`Redacted ${redactedKeyCount} secret-like value(s) across categories: ${redactedCategories.join(', ')}`,
		);
	} else {
		summaryLines.push('No secret-like values detected in context');
	}

	if (options?.projectRoot) {
		summaryLines.push('Absolute paths relativized for safety');
	}

	return {
		redacted: redactedKeyCount > 0,
		redactedCategories,
		redactedKeyCount,
		summary: summaryLines.join('. '),
	};
}

// ---------------------------------------------------------------------------
// Main redaction function
// ---------------------------------------------------------------------------

export function redactIntakeContext(
	context: IntakeContext,
	options?: { projectRoot?: string },
): IntakeContext {
	const redacted = {
		...context,
		answers: context.answers.map(redactAnswer),
		assumptions: context.assumptions.map(redactAssumption),
		decisions: context.decisions.map(redactDecision),
		openQuestions: context.openQuestions.map(redactOpenQuestion),
		redaction: buildRedactionResult(context, options),
		risks: context.risks.map(redactRisk),
		validationGaps: context.validationGaps.map(redactValidationGap),
	};

	if (options?.projectRoot) {
		return relativizePaths(
			redacted,
			options.projectRoot,
		) as unknown as IntakeContext;
	}

	return redacted;
}

// Re-export helpers for tests
export { isSecretKey, isTokenLike, redactString, redactValue };
