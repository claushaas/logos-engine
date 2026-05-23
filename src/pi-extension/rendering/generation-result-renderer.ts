/**
 * LOGOS Pi Extension — Generation result renderer (Step 9.4).
 *
 * Pure rendering function that formats Core generation result data
 * into a structured {@link LogosRenderedMessage}.  Displays:
 * - Generated output paths grouped by authority (canonical / derived);
 * - Changed paths from Core result envelope;
 * - Write plan operations (planned vs written);
 * - Provenance metadata (profile id, mode, timestamps);
 * - Partial / incomplete draft status;
 * - Warnings and blockers.
 *
 * Rules:
 * - Does not run generation or preflight.
 * - Does not call Core APIs.
 * - Does not call Pi runtime methods.
 * - Does not access filesystem.
 * - Does not mutate inputs.
 * - Does not ask confirmation.
 * - Does not call pi.sendUserMessage(...).
 * - Does not invent missing paths or authority.
 * - Does not imply derived artifacts are canonical.
 * - Preserves Core blockers/warnings structurally.
 * - Redacts secret-like fields in provenance metadata.
 *
 * Boundary:
 * - Must not import Core internals.
 * - Must not import Pi runtime values.
 * - Must not import CLI/TUI/Ink/React.
 */

import type { AssistantMessage } from '../../core/index.js';
import type { LogosRenderedMessage } from './render-core-result.js';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type RenderGenerationResultInput = {
	message?: AssistantMessage;
	data?: unknown;
	blockers?: unknown[];
	warnings?: unknown[];
	changedPaths?: unknown[];
};

// ---------------------------------------------------------------------------
// Known output authority & kind value sets
// ---------------------------------------------------------------------------

const CANONICAL_AUTHORITY = 'canonical';
const DERIVED_AUTHORITY = 'derived';

const CANONICAL_OUTPUT_KINDS: ReadonlySet<string> = new Set([
	'canonical_markdown',
]);

const DERIVED_OUTPUT_KINDS: ReadonlySet<string> = new Set([
	'html_artifact',
	'agent_pack',
	'data_output',
	'executive_markdown',
	'executive_html',
	'executive_mapping',
	'other_artifact',
]);

/**
 * Output kind → display label for the renderer.
 */
const OUTPUT_KIND_LABELS: Record<string, string> = {
	agent_pack: 'Agent pack',
	canonical_markdown: 'Canonical Markdown',
	data_output: 'Data',
	executive_html: 'Executive HTML',
	executive_mapping: 'Executive mapping',
	executive_markdown: 'Executive Markdown',
	html_artifact: 'HTML',
	other_artifact: 'Other artifact',
};

function outputKindLabel(kind: string): string {
	return OUTPUT_KIND_LABELS[kind] ?? kind;
}

// ---------------------------------------------------------------------------
// Secret-key redaction helper
// ---------------------------------------------------------------------------

const SECRET_KEYS = new Set([
	'token',
	'secret',
	'password',
	'apikey',
	'api_key',
	'authorization',
	'auth',
	'bearer',
	'credential',
	'privatekey',
	'private_key',
	'accesstoken',
	'refreshtoken',
]);

function isSecretKey(key: string): boolean {
	return SECRET_KEYS.has(key.toLowerCase());
}

/**
 * Shallow redaction of an unknown object.  Returns a copy with
 * secret-like keys replaced by `[redacted]`.
 */
function redactShallow(obj: unknown): unknown {
	if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
	const source = obj as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(source)) {
		result[key] = isSecretKey(key) ? '[redacted]' : val;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Safe extraction helpers
// ---------------------------------------------------------------------------

/**
 * Safe shape for a single write plan operation.
 */
type SafeOperation = {
	id?: string;
	kind?: string;
	outputKind?: string;
	authority?: string;
	path?: string;
	relativePath?: string;
	phaseId?: string;
	documentId?: string;
	sourceProfilePath?: string;
	contentHash?: string;
	risks?: unknown[];
	metadata?: Record<string, unknown>;
};

/**
 * Safe shape for a generation write plan.
 */
type SafeWritePlan = {
	mode?: string;
	dryRun?: boolean;
	readyToWrite?: boolean;
	operations?: SafeOperation[];
	blockers?: unknown[];
	warnings?: unknown[];
	checkedAt?: string;
	projectRoot?: string;
	metadata?: Record<string, unknown>;
};

/**
 * Safe shape for generation data (subset of {@link GenerateData}).
 */
type SafeGenerateData = {
	generationMode?: string;
	generatedPaths?: string[];
	preflight?: Record<string, unknown>;
	writePlan?: SafeWritePlan;
	partialDraft?: boolean;
	incomplete?: boolean;
	requiresExplicitConfirmation?: boolean;
	confirmationProvided?: boolean;
	wroteFiles?: boolean;
	skippedReason?: string;
	metadata?: Record<string, unknown>;
};

function extractGenerateData(data: unknown): SafeGenerateData | undefined {
	if (data === null || typeof data !== 'object') return undefined;
	const d = data as Record<string, unknown>;

	// Must have at least one recognized generation result field.
	const hasGenFields =
		'generatedPaths' in d ||
		'writePlan' in d ||
		'generationMode' in d ||
		'preflight' in d ||
		'wroteFiles' in d ||
		'partialDraft' in d;

	if (!hasGenFields) return undefined;

	const result: SafeGenerateData = {};

	if (typeof d.generationMode === 'string')
		result.generationMode = d.generationMode;
	if (Array.isArray(d.generatedPaths))
		result.generatedPaths = d.generatedPaths.filter(
			(v): v is string => typeof v === 'string',
		);
	if (typeof d.partialDraft === 'boolean') result.partialDraft = d.partialDraft;
	if (typeof d.incomplete === 'boolean') result.incomplete = d.incomplete;
	if (typeof d.requiresExplicitConfirmation === 'boolean')
		result.requiresExplicitConfirmation = d.requiresExplicitConfirmation;
	if (typeof d.confirmationProvided === 'boolean')
		result.confirmationProvided = d.confirmationProvided;
	if (typeof d.wroteFiles === 'boolean') result.wroteFiles = d.wroteFiles;
	if (typeof d.skippedReason === 'string')
		result.skippedReason = d.skippedReason;

	if (d.metadata !== undefined && typeof d.metadata === 'object') {
		result.metadata = redactShallow(d.metadata) as Record<string, unknown>;
	}

	// Extract preflight (keep it as opaque record).
	if (
		d.preflight !== undefined &&
		d.preflight !== null &&
		typeof d.preflight === 'object' &&
		!Array.isArray(d.preflight)
	) {
		result.preflight = d.preflight as Record<string, unknown>;
	}

	// Extract write plan.
	if (
		d.writePlan !== undefined &&
		d.writePlan !== null &&
		typeof d.writePlan === 'object' &&
		!Array.isArray(d.writePlan)
	) {
		const wp = extractWritePlan(d.writePlan);
		if (wp !== undefined) {
			result.writePlan = wp;
		}
	}

	return result;
}

function extractWritePlan(data: unknown): SafeWritePlan | undefined {
	if (data === null || typeof data !== 'object') return undefined;
	const d = data as Record<string, unknown>;

	const result: SafeWritePlan = {};

	if (typeof d.mode === 'string') result.mode = d.mode;
	if (typeof d.dryRun === 'boolean') result.dryRun = d.dryRun;
	if (typeof d.readyToWrite === 'boolean') result.readyToWrite = d.readyToWrite;
	if (typeof d.checkedAt === 'string') result.checkedAt = d.checkedAt;
	if (typeof d.projectRoot === 'string') result.projectRoot = d.projectRoot;

	if (Array.isArray(d.operations)) {
		result.operations = d.operations
			.filter(
				(op): op is Record<string, unknown> =>
					op !== null && typeof op === 'object',
			)
			.map((op) => extractOperation(op));
	}

	if (Array.isArray(d.blockers)) result.blockers = d.blockers;
	if (Array.isArray(d.warnings)) result.warnings = d.warnings;

	if (d.metadata !== undefined && typeof d.metadata === 'object') {
		result.metadata = redactShallow(d.metadata) as Record<string, unknown>;
	}

	return result;
}

function extractOperation(data: Record<string, unknown>): SafeOperation {
	const op: SafeOperation = {};

	if (typeof data.id === 'string') op.id = data.id;
	if (typeof data.kind === 'string') op.kind = data.kind;
	if (typeof data.outputKind === 'string') op.outputKind = data.outputKind;
	if (typeof data.authority === 'string') op.authority = data.authority;
	if (typeof data.path === 'string') op.path = data.path;
	if (typeof data.relativePath === 'string')
		op.relativePath = data.relativePath;
	if (typeof data.phaseId === 'string') op.phaseId = data.phaseId;
	if (typeof data.documentId === 'string') op.documentId = data.documentId;
	if (typeof data.sourceProfilePath === 'string')
		op.sourceProfilePath = data.sourceProfilePath;
	if (typeof data.contentHash === 'string') op.contentHash = data.contentHash;

	if (Array.isArray(data.risks)) op.risks = data.risks;

	if (
		data.metadata !== undefined &&
		typeof data.metadata === 'object' &&
		data.metadata !== null
	) {
		op.metadata = redactShallow(data.metadata) as Record<string, unknown>;
	}

	return op;
}

// ---------------------------------------------------------------------------
// Authority classification
// ---------------------------------------------------------------------------

/**
 * Determine the effective authority for an operation.
 *
 * Precedence:
 * 1. Explicit `authority` field (canonical | derived).
 * 2. Output kind fallback: canonical_markdown → canonical, all others → derived.
 * 3. Unknown → `undefined` (renderer treats as unclassified).
 */
function effectiveAuthority(
	authority: string | undefined,
	outputKind: string | undefined,
): 'canonical' | 'derived' | undefined {
	if (authority === CANONICAL_AUTHORITY) return 'canonical';
	if (authority === DERIVED_AUTHORITY) return 'derived';

	// Fallback: infer from output kind.
	if (outputKind !== undefined) {
		if (CANONICAL_OUTPUT_KINDS.has(outputKind)) return 'canonical';
		if (DERIVED_OUTPUT_KINDS.has(outputKind)) return 'derived';
	}

	return undefined;
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

type GroupedOperation = {
	canonical: SafeOperation[];
	derived: SafeOperation[];
	unclassified: SafeOperation[];
	skippedOrBlocked: SafeOperation[];
};

function groupOperations(operations: SafeOperation[]): GroupedOperation {
	const groups: GroupedOperation = {
		canonical: [],
		derived: [],
		skippedOrBlocked: [],
		unclassified: [],
	};

	for (const op of operations) {
		// skipped / blocked → separate group.
		if (op.kind === 'skip' || op.kind === 'blocked') {
			groups.skippedOrBlocked.push(op);
			continue;
		}

		const authority = effectiveAuthority(op.authority, op.outputKind);

		if (authority === 'canonical') {
			groups.canonical.push(op);
		} else if (authority === 'derived') {
			groups.derived.push(op);
		} else {
			groups.unclassified.push(op);
		}
	}

	return groups;
}

// ---------------------------------------------------------------------------
// Known blocker / warning code → concise label
// ---------------------------------------------------------------------------

const ISSUE_LABELS: Record<string, string> = {
	manual_edit_detected: 'Manual edit detected',
	manual_edit_detection_not_available: 'Manual edit detection not available',
	manual_edit_risk: 'Manual edit risk',
	missing_critical_questions: 'Missing critical questions',
	missing_output_path: 'Missing output path',
	optional_questions_missing: 'Optional questions missing',
	optional_questions_skipped: 'Optional questions skipped',
	output_paths_not_fully_validated: 'Output paths not fully validated',
	outside_project_root: 'Outside project root',
	overwrite_existing_file: 'Overwrite existing file',
	overwrite_risk: 'Overwrite risk',
	partial_critical_questions: 'Partial critical answers',
	path_traversal: 'Path traversal',
	profile_invalid: 'Invalid profile',
	profile_not_found: 'Profile not found',
	project_not_initialized: 'Project not initialized',
	question_registry_empty: 'No questions registered',
	required_questions_skipped: 'Required questions skipped',
	unknown_output_contract: 'Unknown output contract',
	unresolved_contradictions: 'Unresolved contradictions',
	unsafe_output_path: 'Unsafe output path',
	write_plan_blocked_by_preflight: 'Write plan blocked by preflight',
	write_plan_not_built: 'Write plan not built',
};

function issueLabel(code: string): string {
	return ISSUE_LABELS[code] ?? code;
}

// ---------------------------------------------------------------------------
// Body formatters
// ---------------------------------------------------------------------------

const NL = '\n';

function formatOperationPath(op: SafeOperation): string {
	const kindLabel =
		op.outputKind !== undefined ? outputKindLabel(op.outputKind) : 'Output';
	const path = op.relativePath ?? op.path ?? '';
	return `  ${kindLabel}: ${path}`;
}

function formatIssueList(
	issues: unknown[] | undefined,
	label: string,
): string[] {
	if (issues === undefined || issues.length === 0) return [];

	const lines: string[] = [];
	lines.push('');
	lines.push(`${label}:`);

	for (const issue of issues) {
		if (issue === null || issue === undefined) continue;
		if (typeof issue === 'string') {
			lines.push(`  - ${issue}`);
		} else if (typeof issue === 'object') {
			const i = issue as { code?: string; message?: string; path?: string };
			const code = i.code ?? 'unknown';
			const msg = i.message ?? '';
			const conciseLabel = issueLabel(code);
			let line = `  - [${conciseLabel}] ${msg}`;
			if (i.path !== undefined) {
				line += `  (${i.path})`;
			}
			lines.push(line);
		}
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

/**
 * Render Core generation result data as a {@link LogosRenderedMessage}.
 *
 * This function is **pure** and **deterministic**:
 * - It does not call Core APIs.
 * - It does not call Pi runtime methods.
 * - It does not access the filesystem.
 * - It does not mutate its input.
 * - It does not ask confirmation.
 * - It does not call pi.sendUserMessage(...).
 *
 * @param input - The generation result render input.
 * @returns A structured {@link LogosRenderedMessage} ready for Pi delivery.
 */
export function renderGenerationResult(
	input: RenderGenerationResultInput,
): LogosRenderedMessage {
	const {
		message,
		data,
		blockers: explicitBlockers,
		warnings: explicitWarnings,
		changedPaths: explicitChangedPaths,
	} = input;

	const genData = extractGenerateData(data);

	const bodyParts: string[] = [];

	// ---- 1. Core message body ----
	if (message !== undefined && message.body.length > 0) {
		bodyParts.push(message.body);
	}

	// ---- 2. Status header ----
	const isPartialDraft = genData?.partialDraft === true;
	const isIncomplete = genData?.incomplete === true;

	if (isPartialDraft && isIncomplete) {
		bodyParts.push('');
		bodyParts.push('INCOMPLETE PARTIAL DRAFT');
	} else if (isPartialDraft) {
		bodyParts.push('');
		bodyParts.push('PARTIAL DRAFT');
	} else if (isIncomplete) {
		bodyParts.push('');
		bodyParts.push('INCOMPLETE');
	}

	// ---- 3. Generation mode ----
	if (genData?.generationMode !== undefined) {
		bodyParts.push('');
		bodyParts.push(`Mode: ${genData.generationMode}`);
	}

	// ---- 4. Wrote files status ----
	if (genData?.wroteFiles === true) {
		bodyParts.push('Files written: yes');
	} else if (genData?.wroteFiles === false) {
		if (genData?.skippedReason !== undefined) {
			bodyParts.push(`Files written: no (${genData.skippedReason})`);
		} else {
			bodyParts.push('Files written: no');
		}
	}

	// ---- 5. Confirmation status ----
	if (genData?.requiresExplicitConfirmation === true) {
		const provided = genData.confirmationProvided === true;
		bodyParts.push(`Confirmation: ${provided ? 'provided' : 'required'}`);
	}

	// ---- 6. Output paths grouped by authority ----
	const writePlan = genData?.writePlan;
	const generatedPaths = genData?.generatedPaths ?? [];
	const generatedPathsSet = new Set(generatedPaths);

	if (
		writePlan !== undefined &&
		writePlan.operations !== undefined &&
		writePlan.operations.length > 0
	) {
		const groups = groupOperations(writePlan.operations);

		// Determine if we should say "Planned" or "Generated".
		// If wroteFiles: true, we say "Generated outputs".
		// If wroteFiles: false, we say "Planned outputs".
		const isWritten = genData?.wroteFiles === true;

		const sectionLabel = isWritten ? 'Generated outputs' : 'Planned outputs';

		// --- Canonical outputs ---
		if (groups.canonical.length > 0) {
			bodyParts.push('');
			bodyParts.push(`${sectionLabel} — Canonical:`);
			for (const op of groups.canonical) {
				const path = op.relativePath ?? op.path ?? '';
				const isGenerated =
					generatedPathsSet.size > 0 && generatedPathsSet.has(path);
				const suffix = isGenerated && isWritten ? ' (written)' : '';
				bodyParts.push(`${formatOperationPath(op)}${suffix}`);
			}
		}

		// --- Derived outputs ---
		if (groups.derived.length > 0) {
			bodyParts.push('');
			bodyParts.push(`${sectionLabel} — Derived (non-canonical):`);
			for (const op of groups.derived) {
				const path = op.relativePath ?? op.path ?? '';
				const isGenerated =
					generatedPathsSet.size > 0 && generatedPathsSet.has(path);
				const suffix = isGenerated && isWritten ? ' (written)' : '';
				bodyParts.push(`${formatOperationPath(op)}${suffix}`);
			}
		}

		// --- Unclassified outputs ---
		if (groups.unclassified.length > 0) {
			bodyParts.push('');
			bodyParts.push(`${sectionLabel} — Unclassified authority:`);
			for (const op of groups.unclassified) {
				bodyParts.push(formatOperationPath(op));
			}
		}

		// --- Skipped / blocked ---
		if (groups.skippedOrBlocked.length > 0) {
			bodyParts.push('');
			bodyParts.push('Not written:');
			for (const op of groups.skippedOrBlocked) {
				const kindLabel = op.kind === 'blocked' ? 'blocked' : 'skipped';
				const path = op.relativePath ?? op.path ?? '';
				bodyParts.push(`  ${kindLabel}: ${path}`);
			}
		}
	} else if (generatedPaths.length > 0) {
		// No write plan but we have generated paths — render as flat list.
		bodyParts.push('');
		bodyParts.push('Generated paths:');
		for (const p of generatedPaths) {
			bodyParts.push(`  - ${p}`);
		}
	}

	// ---- 7. Changed paths ----
	const resultChangedPaths = explicitChangedPaths ?? [];
	if (resultChangedPaths.length > 0) {
		bodyParts.push('');
		bodyParts.push('Changed paths:');
		for (const cp of resultChangedPaths) {
			if (cp !== null && typeof cp === 'object') {
				const c = cp as { path?: string; kind?: string; reason?: string };
				const lineParts: string[] = [];
				lineParts.push(c.path ?? '');
				if (c.kind !== undefined) lineParts.push(`(${c.kind})`);
				if (c.reason !== undefined) lineParts.push(`— ${c.reason}`);
				bodyParts.push(`  - ${lineParts.join(' ')}`);
			} else if (typeof cp === 'string') {
				bodyParts.push(`  - ${cp}`);
			}
		}
	}

	// ---- 8. Warnings ----
	const warnings = explicitWarnings ?? writePlan?.warnings;
	const warningLines = formatIssueList(warnings, 'Warnings');
	if (warningLines.length > 0) {
		bodyParts.push(...warningLines);
	}

	// ---- 9. Blockers ----
	const blockers = explicitBlockers ?? writePlan?.blockers;
	const blockerLines = formatIssueList(blockers, 'Blockers');
	if (blockerLines.length > 0) {
		bodyParts.push(...blockerLines);
	}

	// ---- 10. Provenance ----
	const provenanceLines: string[] = [];

	// Profile info
	const profileId =
		typeof genData?.metadata?.activeProfileId === 'string'
			? genData.metadata.activeProfileId
			: typeof genData?.preflight?.metadata === 'object' &&
					genData.preflight?.metadata !== null
				? (genData.preflight.metadata as Record<string, unknown>)
						.activeProfileId
				: undefined;

	if (typeof profileId === 'string' && profileId.length > 0) {
		provenanceLines.push(`Profile: ${profileId}`);
	} else if (
		genData?.metadata !== undefined &&
		typeof genData.metadata === 'object' &&
		genData.metadata !== null
	) {
		// Look for profileId or sourceProfilePath in metadata.
		const meta = genData.metadata as Record<string, unknown>;
		const metaProfileId =
			typeof meta.profileId === 'string'
				? meta.profileId
				: typeof meta.sourceProfile === 'string'
					? meta.sourceProfile
					: undefined;
		if (typeof metaProfileId === 'string' && metaProfileId.length > 0) {
			provenanceLines.push(`Profile: ${metaProfileId}`);
		}
	}

	// Generation mode
	if (genData?.generationMode !== undefined) {
		provenanceLines.push(`Mode: ${genData.generationMode}`);
	}

	// Source profile path from first operation
	if (
		writePlan !== undefined &&
		writePlan.operations !== undefined &&
		writePlan.operations.length > 0
	) {
		const firstOp = writePlan.operations[0];
		if (firstOp?.sourceProfilePath !== undefined) {
			provenanceLines.push(`Source profile: ${firstOp.sourceProfilePath}`);
		}
		if (firstOp?.phaseId !== undefined && firstOp?.documentId !== undefined) {
			provenanceLines.push(
				`Source document: ${firstOp.phaseId}/${firstOp.documentId}`,
			);
		} else if (firstOp?.phaseId !== undefined) {
			provenanceLines.push(`Phase: ${firstOp.phaseId}`);
		} else if (firstOp?.documentId !== undefined) {
			provenanceLines.push(`Document: ${firstOp.documentId}`);
		}
	}

	// Checked / generated timestamps
	if (typeof genData?.preflight?.checkedAt === 'string') {
		provenanceLines.push(`Checked at: ${genData.preflight.checkedAt}`);
	}
	if (genData?.metadata !== undefined && typeof genData.metadata === 'object') {
		const meta = genData.metadata as Record<string, unknown>;
		if (typeof meta.generatedAt === 'string') {
			provenanceLines.push(`Generated at: ${meta.generatedAt}`);
		}
	}

	if (provenanceLines.length > 0) {
		bodyParts.push('');
		bodyParts.push('Provenance:');
		bodyParts.push(...provenanceLines.map((l) => `  ${l}`));
	}

	// ---- 11. Assemble message body ----
	const enrichedBody = bodyParts.join(NL);

	// ---- 12. Build metadata ----
	const metadata: Record<string, unknown> = {};

	if (message?.metadata !== undefined) {
		Object.assign(metadata, message.metadata);
	}

	// Preserve structured generation data.
	if (genData !== undefined) {
		if (genData.generationMode !== undefined) {
			metadata.generationMode = genData.generationMode;
		}
		if (genData.partialDraft !== undefined) {
			metadata.partialDraft = genData.partialDraft;
		}
		if (genData.incomplete !== undefined) {
			metadata.incomplete = genData.incomplete;
		}
		if (genData.wroteFiles !== undefined) {
			metadata.wroteFiles = genData.wroteFiles;
		}
		if (genData.requiresExplicitConfirmation !== undefined) {
			metadata.requiresExplicitConfirmation =
				genData.requiresExplicitConfirmation;
		}
		if (genData.confirmationProvided !== undefined) {
			metadata.confirmationProvided = genData.confirmationProvided;
		}
		if (genData.generatedPaths !== undefined) {
			metadata.generatedPaths = [...genData.generatedPaths];
		}
		if (genData.skippedReason !== undefined) {
			metadata.skippedReason = genData.skippedReason;
		}
		if (genData.preflight !== undefined) {
			metadata.preflight = redactShallow(genData.preflight);
		}
		if (genData.writePlan !== undefined) {
			metadata.writePlan = {
				dryRun: genData.writePlan.dryRun,
				mode: genData.writePlan.mode,
				readyToWrite: genData.writePlan.readyToWrite,
			};
		}
		if (genData.metadata !== undefined) {
			metadata.generationMetadata = redactShallow(genData.metadata);
		}
	}

	// Determine title.
	const title =
		message?.title ??
		(isPartialDraft && isIncomplete
			? 'LOGOS generation result — incomplete partial draft'
			: isPartialDraft
				? 'LOGOS generation result — partial draft'
				: 'LOGOS generation result');

	// Determine message kind.
	const msgKind = message?.kind ?? 'generation_result';

	const rendered: LogosRenderedMessage = {
		body: enrichedBody,
		kind: msgKind,
		metadata,
		title,
		type: 'logos',
	};

	// ---- preserve blockers/warnings ----
	if (explicitBlockers !== undefined && explicitBlockers.length > 0) {
		rendered.blockers = [...explicitBlockers];
	}
	if (explicitWarnings !== undefined && explicitWarnings.length > 0) {
		rendered.warnings = [...explicitWarnings];
	}

	return rendered;
}
