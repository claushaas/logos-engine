// Purpose: LLM response validation.
// What it should do: Validate JSON responses against schemas and report precise failures.
// Why it exists: Prevents malformed model output from mutating state.

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single validation problem with its location in the data. */
export interface ValidationIssue {
	/** Path to the offending field (e.g. `["user", "name"]`). Empty for root-level issues. */
	path: (string | number)[];
	/** Human-readable description of what went wrong. */
	message: string;
}

/** Result of a validation attempt — never throws. */
export interface ValidationOutcome<T> {
	/** `true` when the data passes validation. */
	valid: boolean;
	/** The validated data when `valid` is `true`, otherwise `null`. */
	data: T | null;
	/** Empty on success; one or more issues on failure. */
	issues: ValidationIssue[];
}

// ─── JSON parsing ───────────────────────────────────────────────────────────

/**
 * Safely parse a JSON string.
 *
 * Returns a `ValidationOutcome` instead of throwing, so callers can inspect
 * the failure without try/catch.
 */
export function tryParseJson(raw: string): ValidationOutcome<unknown> {
	try {
		const data = JSON.parse(raw);
		return { data, issues: [], valid: true };
	} catch (error) {
		return {
			data: null,
			issues: [
				{
					message:
						error instanceof Error ? error.message : 'Unknown JSON parse error',
					path: [],
				},
			],
			valid: false,
		};
	}
}

// ─── Schema validation ──────────────────────────────────────────────────────

/**
 * Validate already-parsed data against a schema.
 *
 * The `schema` only needs a `parse` method (Zod, Valibot, ArkType, etc. are
 * all supported without coupling).
 */
export function validateAgainstSchema<T>(
	parsed: unknown,
	schema: { parse(input: unknown): T },
): ValidationOutcome<T> {
	try {
		const data = schema.parse(parsed);
		return { data, issues: [], valid: true };
	} catch (error) {
		return {
			data: null,
			issues: extractIssues(error),
			valid: false,
		};
	}
}

/**
 * Parse a raw JSON string and validate it against a schema in one call.
 *
 * Shortcut for `tryParseJson` followed by `validateAgainstSchema`.
 */
export function validateJsonResponse<T>(
	raw: string,
	schema: { parse(input: unknown): T },
): ValidationOutcome<T> {
	const parsed = tryParseJson(raw);
	if (!parsed.valid) {
		return parsed as ValidationOutcome<T>;
	}
	return validateAgainstSchema(parsed.data, schema);
}

// ─── Error extraction ───────────────────────────────────────────────────────

/**
 * Extract structured `ValidationIssue` items from a thrown validation error.
 *
 * Duck-types Zod-style errors (any object with an `issues` array) so the
 * module stays provider-agnostic. Falls back to a single root-level issue
 * for generic `Error` objects.
 */
export function extractIssues(error: unknown): ValidationIssue[] {
	if (
		error &&
		typeof error === 'object' &&
		'issues' in error &&
		Array.isArray((error as { issues: unknown }).issues)
	) {
		const zodError = error as {
			issues: Array<{ path?: (string | number)[]; message: string }>;
		};
		return zodError.issues.map((issue) => ({
			message: issue.message,
			path: issue.path ?? [],
		}));
	}

	return [
		{
			message:
				error instanceof Error ? error.message : 'Unknown validation error',
			path: [],
		},
	];
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a list of `ValidationIssue` items as a human-readable string.
 *
 * Suitable for logging or displaying in a TUI.
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
	return issues
		.map((issue) => {
			const location =
				issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
			return `  - ${issue.message}${location}`;
		})
		.join('\n');
}

// ─── Compatibility stub ─────────────────────────────────────────────────────

export const response_validation = {
	extractIssues,
	formatValidationIssues,
	tryParseJson,
	validateAgainstSchema,
	validateJsonResponse,
};
