/**
 * Profile loader — reads and validates LogosProfile YAML/JSON files.
 *
 * The loader performs two layers of validation:
 *  1. Structural validation — top-level shape, required fields, field types.
 *  2. Cross-reference validation — document/node/materialization-rule ID integrity.
 *
 * All errors are returned as `Result<never, LoadError>` (never throw).
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';

import type {
	DocumentDefinition,
	DocumentMaterializationRule,
	LogosProfile,
	NodeDefinition,
	PhaseDefinition,
} from '../contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../shared/index.js';
import { err, LogosError, ok, type Result } from '../shared/index.js';

// ─── LoadError ──────────────────────────────────────────────────────────────

/** Error type returned by all profile loader operations. */
export type LoadError = LogosError;

// ─── Error helpers ──────────────────────────────────────────────────────────

function fileNotFound(path: string, cause?: unknown): LoadError {
	return new LogosError(
		'LOGOS_PROFILE_FILE_NOT_FOUND',
		'profile_schema',
		`Profile file not found: ${path}`,
		{
			cause,
			details: { path },
			recoverable: false,
		},
	);
}

function parseError(path: string, message: string, cause?: unknown): LoadError {
	return new LogosError(
		'LOGOS_PROFILE_PARSE_ERROR',
		'profile_schema',
		`Failed to parse profile: ${message}`,
		{
			cause,
			details: { message, path },
			recoverable: false,
		},
	);
}

function schemaInvalid(
	path: string,
	message: string,
	details?: Record<string, unknown>,
): LoadError {
	return new LogosError(
		'LOGOS_PROFILE_SCHEMA_INVALID',
		'profile_schema',
		`Invalid profile schema: ${message}`,
		{
			details: { message, path, ...details },
			recoverable: false,
		},
	);
}

function referenceInvalid(
	path: string,
	message: string,
	details?: Record<string, unknown>,
): LoadError {
	return new LogosError(
		'LOGOS_PROFILE_REFERENCE_INVALID',
		'profile_schema',
		`Invalid cross-reference: ${message}`,
		{
			details: { message, path, ...details },
			recoverable: false,
		},
	);
}

// ─── Parsing ────────────────────────────────────────────────────────────────

/**
 * Read and parse a profile file (YAML or JSON).
 *
 * Determines format from file extension: `.yml`/`.yaml` → YAML, `.json` → JSON.
 */
function readAndParse(path: string): Result<unknown, LoadError> {
	let raw: string;
	try {
		raw = readFileSync(path, 'utf-8');
	} catch (cause) {
		return err(fileNotFound(path, cause));
	}

	const ext = extname(path).toLowerCase();

	try {
		if (ext === '.json') {
			return ok(JSON.parse(raw));
		}
		// Default to YAML for .yml, .yaml, or unknown extensions.
		return ok(parseYaml(raw));
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		return err(parseError(path, message, cause));
	}
}

// ─── Structural validation ──────────────────────────────────────────────────

/**
 * Assert that `value` is a non-null object.
 */
function assertObject(
	value: unknown,
	label: string,
	path: string,
): asserts value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) {
		throw schemaInvalid(path, `${label} must be an object`, {
			[label]: String(value),
		});
	}
}

/**
 * Assert that `value` is a string.
 */
function assertString(
	value: unknown,
	label: string,
	path: string,
): asserts value is string {
	if (typeof value !== 'string') {
		throw schemaInvalid(path, `${label} must be a string`, {
			[label]: String(value),
		});
	}
}

/**
 * Assert that `value` is a number.
 */
function assertNumber(
	value: unknown,
	label: string,
	path: string,
): asserts value is number {
	if (typeof value !== 'number') {
		throw schemaInvalid(path, `${label} must be a number`, {
			[label]: String(value),
		});
	}
}

/**
 * Assert that `value` is an array.
 */
function assertArray(
	value: unknown,
	label: string,
	path: string,
): asserts value is unknown[] {
	if (!Array.isArray(value)) {
		throw schemaInvalid(path, `${label} must be an array`, {
			[label]: String(value),
		});
	}
}

/**
 * Assert that every element of `arr` is a string.
 */
function assertStringArray(
	arr: unknown[],
	label: string,
	path: string,
): asserts arr is string[] {
	for (let i = 0; i < arr.length; i++) {
		if (typeof arr[i] !== 'string') {
			throw schemaInvalid(path, `${label}[${i}] must be a string`, {
				[`${label}[${i}]`]: String(arr[i]),
			});
		}
	}
}

/**
 * Assert that `key` exists on `obj` and is a string. Returns the string.
 */
function getRequiredString(
	obj: Record<string, unknown>,
	key: string,
	path: string,
): string {
	if (!(key in obj)) {
		throw schemaInvalid(path, `missing required field "${key}"`);
	}
	const val = obj[key];
	assertString(val, key, path);
	return val;
}

/**
 * Assert that `key` exists on `obj` and is a number. Returns the number.
 */
function getRequiredNumber(
	obj: Record<string, unknown>,
	key: string,
	path: string,
): number {
	if (!(key in obj)) {
		throw schemaInvalid(path, `missing required field "${key}"`);
	}
	const val = obj[key];
	assertNumber(val, key, path);
	return val;
}

/**
 * Assert that `key` exists on `obj` and is an array. Returns the array.
 */
function getRequiredArray(
	obj: Record<string, unknown>,
	key: string,
	path: string,
): unknown[] {
	if (!(key in obj)) {
		throw schemaInvalid(path, `missing required field "${key}"`);
	}
	const val = obj[key];
	assertArray(val, key, path);
	return val;
}

// ─── Validators per type ────────────────────────────────────────────────────

function validatePhase(raw: unknown, path: string): PhaseDefinition {
	assertObject(raw, 'phase', path);
	const id = getRequiredString(raw, 'id', path);
	const title = getRequiredString(raw, 'title', path);
	const order = getRequiredNumber(raw, 'order', path);
	const purpose = getRequiredString(raw, 'purpose', path);
	return { id, order, purpose, title } as PhaseDefinition;
}

function validateDocument(raw: unknown, path: string): DocumentDefinition {
	assertObject(raw, 'document', path);
	const id = getRequiredString(raw, 'id', path);
	const phaseId = getRequiredString(raw, 'phaseId', path);
	const title = getRequiredString(raw, 'title', path);
	const order = getRequiredNumber(raw, 'order', path);
	const purpose = getRequiredString(raw, 'purpose', path);
	const outputPath = getRequiredString(raw, 'outputPath', path);
	const requiredNodeIds = getRequiredArray(raw, 'requiredNodeIds', path);
	assertStringArray(requiredNodeIds, 'requiredNodeIds', path);

	if (!('optionalNodeIds' in raw)) {
		throw schemaInvalid(path, 'missing required field "optionalNodeIds"');
	}
	assertArray(raw.optionalNodeIds, 'optionalNodeIds', path);
	assertStringArray(raw.optionalNodeIds, 'optionalNodeIds', path);
	const optionalNodeIds = raw.optionalNodeIds as NodeId[];

	return {
		id: id as DocumentId,
		optionalNodeIds,
		order,
		outputPath,
		phaseId,
		purpose,
		requiredNodeIds: requiredNodeIds as NodeId[],
		title,
	} as DocumentDefinition;
}

function validateNode(raw: unknown, path: string): NodeDefinition {
	assertObject(raw, 'node', path);
	const id = getRequiredString(raw, 'id', path);
	const phaseId = getRequiredString(raw, 'phaseId', path);
	const documentId = getRequiredString(raw, 'documentId', path);
	const title = getRequiredString(raw, 'title', path);
	const order = getRequiredNumber(raw, 'order', path);
	const canonicalQuestion = getRequiredString(raw, 'canonicalQuestion', path);
	const coverageTopics = getRequiredArray(raw, 'coverageTopics', path);
	assertStringArray(coverageTopics, 'coverageTopics', path);
	const sufficiencyCriteria = getRequiredArray(
		raw,
		'sufficiencyCriteria',
		path,
	);
	assertStringArray(sufficiencyCriteria, 'sufficiencyCriteria', path);

	// promptRefs is required and must be an object.
	if (!('promptRefs' in raw)) {
		throw schemaInvalid(path, 'missing required field "promptRefs"');
	}
	assertObject(raw.promptRefs, 'promptRefs', path);
	// Validate each known promptRef field is a string if present.
	const promptRefs = raw.promptRefs as Record<string, unknown>;
	for (const key of Object.keys(promptRefs)) {
		if (typeof promptRefs[key] !== 'string') {
			throw schemaInvalid(path, `promptRefs.${key} must be a string`, {
				[key]: String(promptRefs[key]),
			});
		}
	}

	const result: NodeDefinition = {
		canonicalQuestion,
		coverageTopics: coverageTopics as string[],
		documentId: documentId as DocumentId,
		id: id as NodeId,
		order,
		phaseId,
		promptRefs: raw.promptRefs as NodeDefinition['promptRefs'],
		sufficiencyCriteria: sufficiencyCriteria as string[],
		title,
	} as NodeDefinition;

	// Optional fields
	if ('dependencies' in raw && raw.dependencies !== undefined) {
		assertObject(raw.dependencies, 'dependencies', path);
		const deps = raw.dependencies as Record<string, unknown>;
		if ('requiredNodeIds' in deps && deps.requiredNodeIds !== undefined) {
			assertArray(deps.requiredNodeIds, 'dependencies.requiredNodeIds', path);
			assertStringArray(
				deps.requiredNodeIds,
				'dependencies.requiredNodeIds',
				path,
			);
			(result as Record<string, unknown>).dependencies = {
				requiredNodeIds: deps.requiredNodeIds as NodeId[],
			};
		}
		if ('recommendedNodeIds' in deps && deps.recommendedNodeIds !== undefined) {
			assertArray(
				deps.recommendedNodeIds,
				'dependencies.recommendedNodeIds',
				path,
			);
			assertStringArray(
				deps.recommendedNodeIds,
				'dependencies.recommendedNodeIds',
				path,
			);
			const existing = (result as Record<string, unknown>).dependencies as
				| Record<string, unknown>
				| undefined;
			(result as Record<string, unknown>).dependencies = {
				...existing,
				recommendedNodeIds: deps.recommendedNodeIds as NodeId[],
			};
		}
	}

	if ('outputSchemaRef' in raw && raw.outputSchemaRef !== undefined) {
		assertString(raw.outputSchemaRef, 'outputSchemaRef', path);
		(result as Record<string, unknown>).outputSchemaRef = raw.outputSchemaRef;
	}

	return result;
}

function validateSection(
	raw: unknown,
	path: string,
): DocumentMaterializationRule['sections'][number] {
	assertObject(raw, 'section', path);
	const id = getRequiredString(raw, 'id', path);
	const title = getRequiredString(raw, 'title', path);
	const sourceNodeIds = getRequiredArray(raw, 'sourceNodeIds', path);
	assertStringArray(sourceNodeIds, 'sourceNodeIds', path);

	if (!('required' in raw)) {
		throw schemaInvalid(path, 'missing required field "required"');
	}
	if (typeof raw.required !== 'boolean') {
		throw schemaInvalid(path, 'section.required must be a boolean');
	}
	const required = raw.required;

	return {
		id,
		required,
		sourceNodeIds: sourceNodeIds as NodeId[],
		title,
	} as DocumentMaterializationRule['sections'][number];
}

function validateMaterializationRule(
	raw: unknown,
	path: string,
): DocumentMaterializationRule {
	assertObject(raw, 'materializationRule', path);
	const documentId = getRequiredString(raw, 'documentId', path);
	const title = getRequiredString(raw, 'title', path);
	const outputPath = getRequiredString(raw, 'outputPath', path);
	const sourceNodeIds = getRequiredArray(raw, 'sourceNodeIds', path);
	assertStringArray(sourceNodeIds, 'sourceNodeIds', path);
	const requiredNodeIds = getRequiredArray(raw, 'requiredNodeIds', path);
	assertStringArray(requiredNodeIds, 'requiredNodeIds', path);

	if (!('optionalNodeIds' in raw)) {
		throw schemaInvalid(path, 'missing required field "optionalNodeIds"');
	}
	assertArray(raw.optionalNodeIds, 'optionalNodeIds', path);
	assertStringArray(raw.optionalNodeIds, 'optionalNodeIds', path);
	const optionalNodeIds = raw.optionalNodeIds as NodeId[];

	const sectionsRaw = getRequiredArray(raw, 'sections', path);
	const sections: DocumentMaterializationRule['sections'] = [];
	for (let i = 0; i < sectionsRaw.length; i++) {
		assertObject(sectionsRaw[i], `sections[${i}]`, path);
		sections.push(validateSection(sectionsRaw[i], path));
	}

	return {
		documentId: documentId as DocumentId,
		optionalNodeIds,
		outputPath,
		requiredNodeIds: requiredNodeIds as NodeId[],
		sections,
		sourceNodeIds: sourceNodeIds as NodeId[],
		title,
	} as DocumentMaterializationRule;
}

// ─── Cross-reference validation ─────────────────────────────────────────────

/**
 * Validate cross-references between nodes, documents, and materialization rules:
 *
 * - Every `NodeDefinition.documentId` must exist in `documents[]`.
 * - Every `DocumentDefinition.requiredNodeIds` and `optionalNodeIds` entry must exist in `nodes[]`.
 * - Every `NodeDefinition.dependencies.requiredNodeIds` and `recommendedNodeIds` entry must exist in `nodes[]`.
 * - Every `DocumentMaterializationRule.documentId` must exist in `documents[]`.
 * - Every `rule.sourceNodeIds` entry must exist in `nodes[]`.
 * - `rule.requiredNodeIds` ⊆ `rule.sourceNodeIds`.
 * - `rule.optionalNodeIds` ⊆ `rule.sourceNodeIds`.
 * - Every `rule.sections[].sourceNodeIds` entry must exist in `nodes[]`.
 */
function validateCrossReferences(profile: LogosProfile, path: string): void {
	const docIds = new Set<string>(profile.documents.map((d) => d.id));
	const nodeIds = new Set<string>(profile.nodes.map((n) => n.id));

	// Node → Document references.
	for (const node of profile.nodes) {
		if (!docIds.has(node.documentId)) {
			throw referenceInvalid(
				path,
				`Node "${node.id}" references non-existent document "${node.documentId}"`,
				{ documentId: node.documentId, nodeId: node.id },
			);
		}
	}

	// Document → Node references (requiredNodeIds, optionalNodeIds).
	for (const doc of profile.documents) {
		for (const requiredId of doc.requiredNodeIds) {
			if (!nodeIds.has(requiredId)) {
				throw referenceInvalid(
					path,
					`Document "${doc.id}" references non-existent node "${requiredId}" in requiredNodeIds`,
					{ documentId: doc.id, nodeId: requiredId },
				);
			}
		}
		for (const optionalId of doc.optionalNodeIds) {
			if (!nodeIds.has(optionalId)) {
				throw referenceInvalid(
					path,
					`Document "${doc.id}" references non-existent node "${optionalId}" in optionalNodeIds`,
					{ documentId: doc.id, nodeId: optionalId },
				);
			}
		}
	}

	// Node dependency → Node references.
	for (const node of profile.nodes) {
		const deps = node.dependencies;
		if (!deps) continue;
		if (deps.requiredNodeIds) {
			for (const depId of deps.requiredNodeIds) {
				if (!nodeIds.has(depId)) {
					throw referenceInvalid(
						path,
						`Node "${node.id}" depends on non-existent node "${depId}" (requiredNodeIds)`,
						{ dependencyId: depId, nodeId: node.id },
					);
				}
			}
		}
		if (deps.recommendedNodeIds) {
			for (const depId of deps.recommendedNodeIds) {
				if (!nodeIds.has(depId)) {
					throw referenceInvalid(
						path,
						`Node "${node.id}" depends on non-existent node "${depId}" (recommendedNodeIds)`,
						{ dependencyId: depId, nodeId: node.id },
					);
				}
			}
		}
	}

	// Materialization rule references.
	for (const rule of profile.materializationRules) {
		if (!docIds.has(rule.documentId)) {
			throw referenceInvalid(
				path,
				`Materialization rule references non-existent document "${rule.documentId}"`,
				{ documentId: rule.documentId },
			);
		}

		for (const sourceNodeId of rule.sourceNodeIds) {
			if (!nodeIds.has(sourceNodeId)) {
				throw referenceInvalid(
					path,
					`Materialization rule for document "${rule.documentId}" references non-existent node "${sourceNodeId}" in sourceNodeIds`,
					{ documentId: rule.documentId, nodeId: sourceNodeId },
				);
			}
		}

		// requiredNodeIds ⊆ sourceNodeIds.
		const sourceSet = new Set<string>(rule.sourceNodeIds);
		for (const requiredId of rule.requiredNodeIds) {
			if (!sourceSet.has(requiredId)) {
				throw referenceInvalid(
					path,
					`Materialization rule for document "${rule.documentId}" has requiredNodeIds entry "${requiredId}" not in sourceNodeIds`,
					{
						documentId: rule.documentId,
						nodeId: requiredId,
					},
				);
			}
		}

		// optionalNodeIds ⊆ sourceNodeIds.
		for (const optionalId of rule.optionalNodeIds) {
			if (!sourceSet.has(optionalId)) {
				throw referenceInvalid(
					path,
					`Materialization rule for document "${rule.documentId}" has optionalNodeIds entry "${optionalId}" not in sourceNodeIds`,
					{
						documentId: rule.documentId,
						nodeId: optionalId,
					},
				);
			}
		}

		// Section sourceNodeIds must be a subset of the node Ids in the profile.
		for (let i = 0; i < rule.sections.length; i++) {
			const section = rule.sections[i];
			if (!section) continue;
			for (let j = 0; j < section.sourceNodeIds.length; j++) {
				const snId = section.sourceNodeIds[j];
				if (!snId) continue;
				if (!nodeIds.has(snId)) {
					throw referenceInvalid(
						path,
						`Materialization rule section "${section.id}" references non-existent node "${snId}"`,
						{
							documentId: rule.documentId,
							nodeId: snId,
							sectionId: section.id,
						},
					);
				}
			}
		}
	}
}

// ─── Top-level validation ───────────────────────────────────────────────────

/**
 * Validate the top-level profile structure, then each array element.
 */
function validateProfile(raw: unknown, path: string): LogosProfile {
	assertObject(raw, 'profile', path);

	const id = getRequiredString(raw, 'id', path);
	const title = getRequiredString(raw, 'title', path);
	const version = getRequiredString(raw, 'version', path);

	const phasesRaw = getRequiredArray(raw, 'phases', path);
	const documentsRaw = getRequiredArray(raw, 'documents', path);
	const nodesRaw = getRequiredArray(raw, 'nodes', path);
	const rulesRaw = getRequiredArray(raw, 'materializationRules', path);

	const phases: PhaseDefinition[] = phasesRaw.map((p, i) =>
		validatePhase(p, `${path}[phases.${i}]`),
	);

	const documents: DocumentDefinition[] = documentsRaw.map((d, i) =>
		validateDocument(d, `${path}[documents.${i}]`),
	);

	const nodes: NodeDefinition[] = nodesRaw.map((n, i) =>
		validateNode(n, `${path}[nodes.${i}]`),
	);

	const materializationRules: DocumentMaterializationRule[] = rulesRaw.map(
		(r, i) =>
			validateMaterializationRule(r, `${path}[materializationRules.${i}]`),
	);

	let description: string | undefined;
	if ('description' in raw && raw.description !== undefined) {
		if (typeof raw.description !== 'string') {
			throw schemaInvalid(path, 'description must be a string', {
				description: String(raw.description),
			});
		}
		description = raw.description;
	}

	const profile: LogosProfile = {
		description,
		documents,
		id: id as ProfileId,
		materializationRules,
		nodes,
		phases,
		title,
		version,
	} as LogosProfile;

	return profile;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load and validate a profile from a file path.
 *
 * Supports YAML (`.yml`, `.yaml`) and JSON (`.json`) formats.
 * Returns `Result<LogosProfile, LoadError>` — never throws.
 *
 * Validation includes:
 *  - Structural validation of all fields and types.
 *  - Cross-reference validation of node→document and materialization rule links.
 *
 * @param path - Absolute or relative path to the profile file.
 */
export function loadProfile(path: string): Result<LogosProfile, LoadError> {
	const parsed = readAndParse(path);
	if (!parsed.ok) return parsed;

	try {
		const profile = validateProfile(parsed.value, path);
		validateCrossReferences(profile, path);
		return ok(profile);
	} catch (error) {
		if (error instanceof LogosError) {
			return err(error);
		}
		// Defensive: wrap unexpected errors.
		return err(
			new LogosError(
				'LOGOS_PROFILE_UNEXPECTED_ERROR',
				'profile_schema',
				`Unexpected error while validating profile: ${String(error)}`,
				{
					cause: error,
					details: { path },
					recoverable: false,
				},
			),
		);
	}
}
