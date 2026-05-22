/**
 * LOGOS Core — Generation write plan (Step 6.3).
 *
 * Defines the canonical write plan model, build function, and all
 * associated contracts.  The write plan derives planned output operations
 * from active profile contracts and accepted intake state without
 * writing any generated documentation.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosFilesystem } from '../ports/filesystem.js';
import type { LoadedProfileContracts } from '../profiles/profile-contracts.js';
import { detectManualEditRisk } from './manual-edit-risk.js';
import { deriveOutputOperations } from './output-contracts.js';
import { resolveSafeOutputPath } from './output-paths.js';
import { detectOverwriteRisk } from './overwrite-risk.js';
import type { GenerationPreflightResult } from './preflight-result.js';

// ---------------------------------------------------------------------------
// Write plan types (Step 6.3 canonical model)
// ---------------------------------------------------------------------------

/**
 * The kind of generated output this operation represents.
 */
export type GenerationOutputKind =
	| 'canonical_markdown'
	| 'html_artifact'
	| 'agent_pack'
	| 'data_output'
	| 'executive_markdown'
	| 'executive_html'
	| 'executive_mapping'
	| 'other_artifact';

/**
 * Authority over the output: canonical (normative) or derived (reproducible,
 * non-authoritative unless promoted).
 */
export type GenerationOutputAuthority = 'canonical' | 'derived';

/**
 * What the write plan intends to do with this output path.
 */
export type GenerationWriteOperationKind =
	| 'create'
	| 'update'
	| 'skip'
	| 'blocked';

/**
 * Structured risk codes recognised by the write plan.
 */
export type WriteRiskCode =
	| 'unsafe_path'
	| 'outside_project_root'
	| 'path_traversal'
	| 'overwrite_existing_file'
	| 'manual_edit_detected'
	| 'unknown_output_contract'
	| 'missing_output_path'
	| 'write_plan_blocked_by_preflight';

/**
 * A single risk (blocker or warning) attached to a write plan operation
 * or to the overall plan.
 */
export type WritePlanRisk = {
	code: WriteRiskCode;
	message: string;
	path?: string;
	documentId?: string;
	phaseId?: string;
	metadata?: Record<string, unknown>;
};

/**
 * A single planned operation in the write plan.
 *
 * Rules:
 * - `id` must be stable and deterministic.
 * - `path` and `relativePath` must be present for create/update.
 * - `kind` is `blocked` when the operation cannot proceed.
 * - `contentPreview` is optional and must not contain full generated docs.
 * - `contentHash` is optional; hash only placeholder content, not unstored
 *    generated docs.
 */
export type WritePlanOperation = {
	id: string;
	kind: GenerationWriteOperationKind;
	outputKind: GenerationOutputKind;
	authority: GenerationOutputAuthority;
	path: string;
	relativePath: string;
	phaseId?: string;
	documentId?: string;
	sourceProfilePath?: string;
	contentPreview?: string;
	contentHash?: string;
	risks: WritePlanRisk[];
	metadata?: Record<string, unknown>;
};

/**
 * Canonical generation write plan.
 *
 * Rules:
 * - `readyToWrite` is false when blockers exist.
 * - `operations` are deterministic for the same inputs.
 * - Every operation includes outputKind, authority, path, and relativePath.
 * - `dryRun` is true when the plan must produce no writes.
 * - `checkedAt` is the ISO timestamp when the plan was built.
 * - The model is serializable; it must not contain raw provider output,
 *   secrets, hidden reasoning, or raw prompts.
 */
export type GenerationWritePlan = {
	projectRoot: string;
	mode: 'final' | 'partial_draft' | 'dry_run';
	dryRun: boolean;
	readyToWrite: boolean;
	operations: WritePlanOperation[];
	blockers: WritePlanRisk[];
	warnings: WritePlanRisk[];
	checkedAt: string;
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Build input / output
// ---------------------------------------------------------------------------

export type BuildGenerationWritePlanInput = {
	projectRoot: string;
	mode?: 'final' | 'partial_draft' | 'dry_run';
	filesystem: LogosFilesystem;
	preflight: GenerationPreflightResult;
	profileContracts: LoadedProfileContracts;
	now: string;
};

export type BuildGenerationWritePlanResult =
	| {
			ok: true;
			writePlan: GenerationWritePlan;
			warnings: string[];
	  }
	| {
			ok: false;
			writePlan?: GenerationWritePlan;
			errors: string[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRisk(
	code: WriteRiskCode,
	message: string,
	overrides?: {
		path?: string;
		documentId?: string;
		phaseId?: string;
		metadata?: Record<string, unknown>;
	},
): WritePlanRisk {
	const risk: WritePlanRisk = { code, message };
	if (overrides?.path !== undefined) risk.path = overrides.path;
	if (overrides?.documentId !== undefined)
		risk.documentId = overrides.documentId;
	if (overrides?.phaseId !== undefined) risk.phaseId = overrides.phaseId;
	if (overrides?.metadata !== undefined) risk.metadata = overrides.metadata;
	return risk;
}

function emptyWritePlan(
	projectRoot: string,
	mode: 'final' | 'partial_draft' | 'dry_run',
	dryRun: boolean,
	now: string,
): GenerationWritePlan {
	return {
		blockers: [],
		checkedAt: now,
		dryRun,
		mode,
		operations: [],
		projectRoot,
		readyToWrite: false,
		warnings: [],
	};
}

/**
 * Stable id for a write operation.
 *
 * Format: `<outputKind>:<phaseId>:<documentId>:<safeRelativePath>`
 *
 * Falls back to progressively shorter slugs when fields are missing.
 */
function buildOperationId(opts: {
	outputKind: GenerationOutputKind;
	phaseId: string | undefined;
	documentId: string | undefined;
	relativePath: string;
}): string {
	const parts: string[] = [opts.outputKind];
	if (opts.phaseId !== undefined) parts.push(opts.phaseId);
	if (opts.documentId !== undefined) parts.push(opts.documentId);
	parts.push(opts.relativePath.replace(/\\/g, '/'));
	return parts.join(':');
}

// ---------------------------------------------------------------------------
// Write plan builder
// ---------------------------------------------------------------------------

/**
 * Build a safe generation write plan from active profile contracts,
 * preflight result, and filesystem state.
 *
 * Flow:
 * 1. Inspect preflight result.
 * 2. If preflight blocks final generation and mode is final, return
 *    a blocked plan.
 * 3. If mode is partial_draft and preflight does not allow it, block.
 * 4. Derive planned output candidates from active profile contracts.
 * 5. Validate each output path.
 * 6. Detect overwrite risk for each existing file.
 * 7. Detect manual-edit risk where possible.
 * 8. Assemble and return the write plan.
 *
 * Does **not** write files, execute templates, render full docs, mutate
 * intake state, mutate profile contracts, or call AI/provider code.
 */
export async function buildGenerationWritePlan(
	input: BuildGenerationWritePlanInput,
): Promise<BuildGenerationWritePlanResult> {
	const {
		projectRoot,
		mode = 'final',
		filesystem,
		preflight,
		profileContracts,
		now,
	} = input;

	const buildWarnings: string[] = [];
	const dryRun = mode === 'dry_run';

	// ---- 1. Inspect preflight ----

	if (!preflight.ready && mode === 'final') {
		const plan = emptyWritePlan(projectRoot, mode, dryRun, now);
		plan.blockers.push(
			makeRisk(
				'write_plan_blocked_by_preflight',
				'Final generation is blocked by preflight. Resolve the reported blockers before generating.',
			),
		);
		plan.warnings.push(
			...preflight.warnings.map((w) =>
				makeRisk('missing_output_path', `Preflight warning: ${w.message}`),
			),
		);
		return { ok: true, warnings: buildWarnings, writePlan: plan };
	}

	if (mode === 'partial_draft' && !preflight.canGeneratePartialDraft) {
		const plan = emptyWritePlan(projectRoot, mode, dryRun, now);
		plan.blockers.push(
			makeRisk(
				'write_plan_blocked_by_preflight',
				'Partial draft generation is not possible. Preflight does not allow it.',
			),
		);
		return { ok: true, warnings: buildWarnings, writePlan: plan };
	}

	// ---- 2. Derive planned output candidates from profile contracts ----
	const plannedOutputs = deriveOutputOperations(profileContracts);
	const planWarnings: WritePlanRisk[] = [];

	// ---- 3. Build operations for each candidate ----
	const operations: WritePlanOperation[] = [];
	const blockers: WritePlanRisk[] = [];

	for (const candidate of plannedOutputs) {
		// 3a. Resolve and validate the output path.
		const resolved = resolveSafeOutputPath({
			outputPath: candidate.path,
			projectRoot,
		});

		if (!resolved.ok) {
			// Path is unsafe → blocked operation.
			const risk = resolved.risk;
			blockers.push(risk);
			const blockedOp: WritePlanOperation = {
				authority: candidate.authority,
				id: buildOperationId({
					documentId: candidate.documentId,
					outputKind: candidate.outputKind,
					phaseId: candidate.phaseId,
					relativePath: candidate.path,
				}),
				kind: 'blocked',
				outputKind: candidate.outputKind,
				path: candidate.path,
				relativePath: candidate.path,
				risks: [risk],
			};
			if (candidate.documentId !== undefined)
				blockedOp.documentId = candidate.documentId;
			if (candidate.phaseId !== undefined)
				blockedOp.phaseId = candidate.phaseId;
			if (candidate.sourceProfilePath !== undefined)
				blockedOp.sourceProfilePath = candidate.sourceProfilePath;
			operations.push(blockedOp);
			continue;
		}

		const safePath = resolved.path;
		const relativePath = resolved.relativePath;

		// 3b. Detect overwrite risk.
		const overwriteRisk = await detectOverwriteRisk({
			filesystem,
			path: safePath,
		});

		// 3c. Detect manual-edit risk.
		let manualEditRisk: WritePlanRisk | undefined;
		if (overwriteRisk.exists && overwriteRisk.content !== undefined) {
			const manualResult = detectManualEditRisk({
				content: overwriteRisk.content,
				exists: true,
				path: safePath,
			});
			if (manualResult.risk) {
				const mrOverrides: {
					path?: string;
					documentId?: string;
					phaseId?: string;
				} = { path: safePath };
				if (candidate.documentId !== undefined)
					mrOverrides.documentId = candidate.documentId;
				if (candidate.phaseId !== undefined)
					mrOverrides.phaseId = candidate.phaseId;
				manualEditRisk = makeRisk(
					'manual_edit_detected',
					manualResult.message,
					mrOverrides,
				);
			}
		}

		// 3d. Determine operation kind.
		let operationKind: GenerationWriteOperationKind;
		const risks: WritePlanRisk[] = [];

		if (overwriteRisk.exists) {
			operationKind = 'update';
			const owOverrides: {
				path?: string;
				documentId?: string;
				phaseId?: string;
			} = { path: safePath };
			if (candidate.documentId !== undefined)
				owOverrides.documentId = candidate.documentId;
			if (candidate.phaseId !== undefined)
				owOverrides.phaseId = candidate.phaseId;
			risks.push(
				makeRisk(
					'overwrite_existing_file',
					`Output path already exists: ${relativePath}`,
					owOverrides,
				),
			);
			if (manualEditRisk !== undefined) {
				risks.push(manualEditRisk);
			}
		} else {
			operationKind = 'create';
		}

		const op: WritePlanOperation = {
			authority: candidate.authority,
			id: buildOperationId({
				documentId: candidate.documentId,
				outputKind: candidate.outputKind,
				phaseId: candidate.phaseId,
				relativePath,
			}),
			kind: operationKind,
			outputKind: candidate.outputKind,
			path: safePath,
			relativePath,
			risks,
		};
		if (candidate.documentId !== undefined)
			op.documentId = candidate.documentId;
		if (candidate.phaseId !== undefined) op.phaseId = candidate.phaseId;
		if (candidate.sourceProfilePath !== undefined)
			op.sourceProfilePath = candidate.sourceProfilePath;

		operations.push(op);
	}

	// ---- 4. Collect warnings from missing/unknown contracts ----
	for (const w of planWarnings) {
		// Only add as blocker if the code is explicitly blocking.
		if (
			w.code === 'missing_output_path' ||
			w.code === 'unknown_output_contract'
		) {
			// Missing/unknown paths from output-contracts.ts are warnings, not blockers,
			// unless they are for canonical outputs.
			// The deriveOutputOperations function separates these.
		}
	}

	// Warnings from preflight carry through.
	for (const w of preflight.warnings) {
		operations.push({
			authority: 'derived',
			id: `warning:preflight:${w.code}`,
			kind: 'skip',
			outputKind: 'other_artifact',
			path: '',
			relativePath: '',
			risks: [
				makeRisk('unknown_output_contract', `Preflight warning: ${w.message}`),
			],
		});
	}

	// ---- 5. Determine readyToWrite ----
	const readyToWrite =
		blockers.length === 0 && !operations.some((op) => op.kind === 'blocked');

	// ---- 6. Assemble result ----
	const writePlan: GenerationWritePlan = {
		blockers,
		checkedAt: now,
		dryRun,
		mode,
		operations,
		projectRoot,
		readyToWrite,
		warnings: planWarnings,
	};

	return { ok: true, warnings: buildWarnings, writePlan };
}
