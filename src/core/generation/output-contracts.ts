/**
 * LOGOS Core — Output contract derivation (Step 6.3).
 *
 * Derives deterministic planned output candidates from loaded active
 * profile contracts.  These candidates are later validated for path
 * safety, overwrite risk, and manual-edit risk by the write plan builder.
 *
 * Sources:
 * - `profileContracts.documents[].outputs` (canonical, artifacts, agentPacks)
 * - `profileContracts.generation.documentOutputPaths`
 * - `profileContracts.artifacts.artifacts`
 * - `profileContracts.executive.generationConfig`, mappingConfigs
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LoadedProfileContracts } from '../profiles/profile-contracts.js';
import type {
	GenerationOutputAuthority,
	GenerationOutputKind,
} from './write-plan.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A planned output candidate before path validation.
 */
export type PlannedOutput = {
	outputKind: GenerationOutputKind;
	authority: GenerationOutputAuthority;
	path: string;
	phaseId?: string;
	documentId?: string;
	sourceProfilePath?: string;
	metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to read a string property from an unknown value.
 * Handles both objects and primitives.
 */
function readStringProp(obj: unknown, key: string): string | undefined {
	if (obj === null || typeof obj !== 'object' || Array.isArray(obj))
		return undefined;
	const val = (obj as Record<string, unknown>)[key];
	return typeof val === 'string' ? val : undefined;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Derive all planned output candidates from loaded profile contracts.
 *
 * Categories:
 * 1. Canonical Markdown — from `document.outputs.canonical.path`.
 * 2. HTML artifacts — from `document.outputs.artifacts` with `format: html`.
 * 3. Agent packs — from `document.outputs.agentPacks`.
 * 4. Data outputs — from `document.outputs.artifacts` with data-like formats
 *    (json, yaml, yml).
 * 5. Executive outputs — from executive generation config / mapping configs
 *    when they explicitly define generated output paths.
 *
 * Does NOT invent file paths.  Missing contracts produce structured
 * PlannedOutput entries with empty paths for later warning/blocker
 * processing.
 *
 * Results are sorted deterministically: phaseId, documentId, outputKind, path.
 */
export function deriveOutputOperations(
	contracts: LoadedProfileContracts,
): PlannedOutput[] {
	const outputs: PlannedOutput[] = [];
	const { documents, executive } = contracts;

	// ---- 1. Document-driven outputs ----
	for (const doc of documents) {
		const docOutputs = doc.outputs;
		if (docOutputs === undefined) {
			// Document has no outputs block → canonical is missing.
			outputs.push({
				authority: 'canonical',
				documentId: doc.id,
				metadata: { reason: 'missing_outputs_block' },
				outputKind: 'canonical_markdown',
				path: '',
				phaseId: doc.phaseId,
				sourceProfilePath: doc.path,
			});
			continue;
		}

		const docOutputsObj = docOutputs as Record<string, unknown>;

		// ---- 1a. Canonical Markdown ----
		const canonical = docOutputsObj.canonical;
		if (
			canonical !== undefined &&
			canonical !== null &&
			typeof canonical === 'object'
		) {
			const canonicalObj = canonical as Record<string, unknown>;
			const canonicalPath = readStringProp(canonicalObj, 'path') ?? '';
			outputs.push({
				authority: 'canonical',
				documentId: doc.id,
				metadata: canonicalObj,
				outputKind: 'canonical_markdown',
				path: canonicalPath,
				phaseId: doc.phaseId,
				sourceProfilePath: doc.path,
			});
		} else {
			// No canonical block → missing canonical path.
			outputs.push({
				authority: 'canonical',
				documentId: doc.id,
				metadata: { reason: 'missing_canonical_block' },
				outputKind: 'canonical_markdown',
				path: '',
				phaseId: doc.phaseId,
				sourceProfilePath: doc.path,
			});
		}

		// ---- 1b. Artifacts ----
		const artifactsRaw = docOutputsObj.artifacts;
		if (Array.isArray(artifactsRaw)) {
			for (const art of artifactsRaw) {
				if (art === null || typeof art !== 'object') continue;
				const artObj = art as Record<string, unknown>;
				const artFormat = readStringProp(artObj, 'format');
				const artPath = readStringProp(artObj, 'path') ?? '';

				const outputKind = classifyArtifactFormat(artFormat);

				outputs.push({
					authority: 'derived',
					documentId: doc.id,
					metadata: artObj,
					outputKind,
					path: artPath,
					phaseId: doc.phaseId,
					sourceProfilePath: doc.path,
				});
			}
		}

		// ---- 1c. Agent packs ----
		const agentPacksRaw = docOutputsObj.agentPacks;
		if (Array.isArray(agentPacksRaw)) {
			for (const pack of agentPacksRaw) {
				if (pack === null || typeof pack !== 'object') continue;
				const packObj = pack as Record<string, unknown>;
				const packPath = readStringProp(packObj, 'path') ?? '';

				outputs.push({
					authority: 'derived',
					documentId: doc.id,
					metadata: packObj,
					outputKind: 'agent_pack',
					path: packPath,
					phaseId: doc.phaseId,
					sourceProfilePath: doc.path,
				});
			}
		}
	}

	// ---- 2. Executive outputs ----
	if (executive.generationConfig !== undefined) {
		const genConfig = executive.generationConfig;

		// Check for explicit output paths in the generation config.
		const execOutputsRaw = genConfig.outputs;
		if (Array.isArray(execOutputsRaw)) {
			for (const out of execOutputsRaw) {
				if (out === null || typeof out !== 'object') continue;
				const outObj = out as Record<string, unknown>;
				const outFormat = readStringProp(outObj, 'format');
				const outPath = readStringProp(outObj, 'path') ?? '';

				const outputKind = classifyExecutiveFormat(outFormat);

				outputs.push({
					authority: 'derived',
					metadata: outObj,
					outputKind,
					path: outPath,
					sourceProfilePath: executive.generationConfigPath,
				});
			}
		}

		// Check for explicit output paths in mapping configs.
		for (const mapping of executive.mappingConfigs) {
			const mappingKind = classifyMappingFormat(mapping.raw);
			const mappingOutputPath = readStringProp(mapping.raw, 'outputPath');

			if (mappingOutputPath !== undefined && mappingOutputPath.length > 0) {
				outputs.push({
					authority: 'derived',
					metadata: mapping.raw,
					outputKind: mappingKind,
					path: mappingOutputPath,
					sourceProfilePath: mapping.path,
				});
			}
		}
	}

	// ---- 3. Sort deterministically ----
	outputs.sort((a, b) => {
		const phaseCmp = (a.phaseId ?? '').localeCompare(b.phaseId ?? '');
		if (phaseCmp !== 0) return phaseCmp;
		const docCmp = (a.documentId ?? '').localeCompare(b.documentId ?? '');
		if (docCmp !== 0) return docCmp;
		const kindCmp = a.outputKind.localeCompare(b.outputKind);
		if (kindCmp !== 0) return kindCmp;
		return a.path.localeCompare(b.path);
	});

	return outputs;
}

// ---------------------------------------------------------------------------
// Format classification helpers
// ---------------------------------------------------------------------------

/**
 * Classify an artifact `format` string into a {@link GenerationOutputKind}.
 *
 * `html` → `html_artifact`
 * `json`, `yaml`, `yml` → `data_output`
 * `undefined` → `other_artifact` (ambiguous)
 * anything else → `other_artifact`
 */
function classifyArtifactFormat(
	format: string | undefined,
): GenerationOutputKind {
	if (format === undefined) return 'other_artifact';
	switch (format.toLowerCase()) {
		case 'html':
			return 'html_artifact';
		case 'json':
		case 'yaml':
		case 'yml':
			return 'data_output';
		default:
			return 'other_artifact';
	}
}

/**
 * Classify an executive output `format` string.
 */
function classifyExecutiveFormat(
	format: string | undefined,
): GenerationOutputKind {
	if (format === undefined) return 'executive_mapping';
	switch (format.toLowerCase()) {
		case 'markdown':
		case 'md':
			return 'executive_markdown';
		case 'html':
			return 'executive_html';
		default:
			return 'executive_mapping';
	}
}

/**
 * Classify a mapping config by its adapter/type field.
 */
function classifyMappingFormat(
	raw: Record<string, unknown>,
): GenerationOutputKind {
	const adapter = readStringProp(raw, 'adapter') ?? '';
	switch (adapter.toLowerCase()) {
		case 'markdown':
		case 'md':
			return 'executive_markdown';
		case 'html':
			return 'executive_html';
		default:
			return 'executive_mapping';
	}
}
