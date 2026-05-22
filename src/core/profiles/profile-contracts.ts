/**
 * LOGOS Core — Profile contracts validation.
 *
 * Defines required profile paths and a validation helper that checks
 * file/directory existence against a {@link LogosFilesystem} port.
 *
 * In Step 2.2 this only validates existence; full contract loading and
 * parsing happens in Step 2.3.
 */

import type { LogosFilesystem } from '../ports/filesystem.js';
import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import type { LogosQuestion } from '../questions/question-types.js';
import { createProfileResolutionError } from './profile-errors.js';
import type { ProfileResolutionError } from './profile-resolver.js';

// ---------------------------------------------------------------------------
// Loaded profile contract types (Step 2.3)
// ---------------------------------------------------------------------------

/**
 * Parsed root registry from profiles/<profileId>/docs.yml.
 * Preserves known fields as typed properties and all unknown fields under `raw`.
 */
export type ProfileRootRegistry = {
	schemaVersion?: number;
	contentVersion?: string;
	registryType?: string;
	project?: Record<string, unknown>;
	documentationSystem?: Record<string, unknown>;
	axes?: unknown[];
	phaseDefinitions?: Record<string, unknown>;
	phaseRegistry?: Record<string, unknown>;
	outputModel?: Record<string, unknown>;
	globalRules?: Record<string, unknown>;
	qualityModel?: Record<string, unknown>;
	dependencyPolicy?: Record<string, unknown>;
	agentPolicy?: Record<string, unknown>;
	statusWorkflow?: Record<string, unknown>;
	roadmapIntegration?: Record<string, unknown>;
	raw: Record<string, unknown>;
};

/**
 * Parsed document schema from profiles/<profileId>/document.schema.yml.
 * For initial loading, only the raw parsed object is preserved.
 */
export type ProfileDocumentSchema = {
	raw: Record<string, unknown>;
};

/**
 * A single phase descriptor loaded from profiles/<profileId>/phases/<phase-id>.yml.
 */
export type ProfilePhaseContract = {
	id: string;
	title?: string;
	path: string;
	/** Document ids listed in the phase descriptor's documents array. */
	documentIds: string[];
	raw: Record<string, unknown>;
};

/**
 * A single document section inside a document descriptor.
 */
export type ProfileDocumentSection = {
	id: string;
	title?: string;
	questions: string[];
	required: boolean;
	raw: Record<string, unknown>;
};

/**
 * A single document descriptor loaded from
 * profiles/<profileId>/phases/<phase-id>/<doc-id>.yml.
 */
export type ProfileDocumentContract = {
	id: string;
	title?: string;
	phaseId: string;
	path: string;
	centralQuestion?: string;
	sections: ProfileDocumentSection[];
	outputs?: Record<string, unknown>;
	completionCriteria?: string[];
	qualityChecks?: string[];
	dependsOn?: string[];
	raw: Record<string, unknown>;
};

/**
 * Validation-related contracts derived from the active profile.
 * Does not implement validation execution.
 */
export type ProfileValidationContracts = {
	documentSchemaPath: string;
	completionCriteria: Array<{
		documentId: string;
		phaseId: string;
		raw: unknown;
	}>;
	qualityChecks: Array<{
		documentId: string;
		phaseId: string;
		raw: unknown;
	}>;
};

/**
 * Generation-related contracts derived from document descriptor outputs.
 * Does not implement generation execution.
 */
export type ProfileGenerationContracts = {
	documentOutputPaths: Array<{
		documentId: string;
		phaseId: string;
		path?: string;
		rawOutputs?: unknown;
	}>;
};

/**
 * Artifact-related contracts derived from document descriptor outputs.
 * Does not implement artifact generation.
 */
export type ProfileArtifactContracts = {
	artifacts: Array<{
		documentId: string;
		phaseId: string;
		rawOutputs?: unknown;
	}>;
};

/**
 * Executive-related contracts loaded from the active profile's executive/ directory.
 */
export type ProfileExecutiveContracts = {
	generationConfigPath: string;
	planSchemaPath: string;
	mappingPaths: string[];
	templatePaths: string[];
	generationConfig?: Record<string, unknown>;
	mappingConfigs: Array<{
		path: string;
		raw: Record<string, unknown>;
	}>;
};

/**
 * Normalized result of loading all contracts from a resolved active profile.
 *
 * This is the output of {@link loadProfileContracts} and becomes the source
 * for future intake question registry, document contracts, phase contracts,
 * validation rules, generation outputs, artifacts, agent packs, and Executive
 * output rules.
 */
export type LoadedProfileContracts = {
	profileId: string;
	profileRoot: string;
	rootRegistry: ProfileRootRegistry;
	documentSchema: ProfileDocumentSchema;
	phases: ProfilePhaseContract[];
	documents: ProfileDocumentContract[];
	/** @deprecated Use questionRegistry.questions for the array of questions. */
	questions: LogosQuestion[];
	questionRegistry: LogosQuestionRegistry;
	validation: ProfileValidationContracts;
	generation: ProfileGenerationContracts;
	artifacts: ProfileArtifactContracts;
	executive: ProfileExecutiveContracts;
	loadedPaths: string[];
	warnings: string[];
};

// ---------------------------------------------------------------------------
// Required path types
// ---------------------------------------------------------------------------

export type ProfileRequiredPath = {
	/** Absolute path to check. */
	path: string;
	/** Whether this path refers to a file or a directory. */
	kind: 'file' | 'directory';
	/** Human-readable label used in error messages. */
	label: string;
};

// ---------------------------------------------------------------------------
// Required Standard-profile paths
// ---------------------------------------------------------------------------

/**
 * Returns the list of required top-level paths that every profile
 * must provide. Derived from the Standard profile contract shape.
 *
 * Paths are computed as absolute paths from the given `profileRoot`.
 */
export function getStandardRequiredPaths(
	profileRoot: string,
): ProfileRequiredPath[] {
	return [
		{ kind: 'file', label: 'docs.yml', path: `${profileRoot}/docs.yml` },
		{
			kind: 'file',
			label: 'document.schema.yml',
			path: `${profileRoot}/document.schema.yml`,
		},
		{ kind: 'directory', label: 'phases/', path: `${profileRoot}/phases` },
		{
			kind: 'directory',
			label: 'executive/',
			path: `${profileRoot}/executive`,
		},
		{
			kind: 'file',
			label: 'executive/executive-generation.yml',
			path: `${profileRoot}/executive/executive-generation.yml`,
		},
		{
			kind: 'file',
			label: 'executive/executive-plan.schema.json',
			path: `${profileRoot}/executive/executive-plan.schema.json`,
		},
		{
			kind: 'directory',
			label: 'executive/mappings/',
			path: `${profileRoot}/executive/mappings`,
		},
		{
			kind: 'directory',
			label: 'executive/templates/',
			path: `${profileRoot}/executive/templates`,
		},
	];
}

// ---------------------------------------------------------------------------
// Directory existence helper
// ---------------------------------------------------------------------------

/**
 * Check whether a directory exists via the filesystem port.
 *
 * Tries {@link LogosFilesystem.listDirectory}; if the call throws
 * the directory is treated as non-existent. An empty listing is
 * treated as existence (the directory may simply be empty).
 */
async function directoryExists(
	filesystem: LogosFilesystem,
	dirPath: string,
): Promise<boolean> {
	try {
		await filesystem.listDirectory({ path: dirPath });
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that all required profile paths exist.
 *
 * - For **files**, uses {@link LogosFilesystem.fileExists}.
 * - For **directories**, uses {@link directoryExists} which calls
 *   {@link LogosFilesystem.listDirectory} and treats a thrown error
 *   as non-existence.
 *
 * Returns an empty array when every required path exists.
 */
export async function validateProfileRequiredPaths(input: {
	filesystem: LogosFilesystem;
	requiredPaths: ProfileRequiredPath[];
}): Promise<ProfileResolutionError[]> {
	const { filesystem, requiredPaths } = input;
	const errors: ProfileResolutionError[] = [];

	for (const entry of requiredPaths) {
		let exists: boolean;
		if (entry.kind === 'file') {
			exists = await filesystem.fileExists({ path: entry.path });
		} else {
			exists = await directoryExists(filesystem, entry.path);
		}

		if (!exists) {
			errors.push(
				createProfileResolutionError(
					'profile_invalid',
					`Missing required ${entry.kind}: ${entry.label}`,
					{
						details: `Expected ${entry.kind} at "${entry.path}".`,
						path: entry.path,
					},
				),
			);
		}
	}

	return errors;
}
