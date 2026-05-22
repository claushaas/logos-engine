/**
 * LOGOS Core — Profile contract loader (Step 2.3).
 *
 * Loads and normalizes all profile contracts from a resolved active profile
 * directory. Produces a {@link LoadedProfileContracts} that becomes the
 * source for intake question registry, document contracts, validation rules,
 * generation outputs, artifacts, agent packs, and Executive output rules.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import path from 'node:path';

import { parse as yamlParse } from 'yaml';

import type { LogosFilesystem } from '../ports/filesystem.js';
import { createQuestionId } from '../questions/question-id.js';
import type {
	LogosQuestion,
	QuestionPriority,
} from '../questions/question-types.js';
import { DEFAULT_FOLLOW_UP_POLICY } from '../questions/question-types.js';
import type {
	LoadedProfileContracts,
	ProfileArtifactContracts,
	ProfileDocumentContract,
	ProfileDocumentSchema,
	ProfileDocumentSection,
	ProfileExecutiveContracts,
	ProfileGenerationContracts,
	ProfilePhaseContract,
	ProfileRootRegistry,
	ProfileValidationContracts,
} from './profile-contracts.js';
import { profileInvalid } from './profile-errors.js';
import type {
	ProfileResolutionError,
	ResolveActiveProfileInput,
} from './profile-resolver.js';
import { resolveActiveProfile } from './profile-resolver.js';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type LoadProfileContractsInput = {
	projectRoot: string;
	activeProfileId: string;
	filesystem: LogosFilesystem;
};

export type LoadProfileContractsResult =
	| {
			ok: true;
			contracts: LoadedProfileContracts;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: ProfileResolutionError[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// YAML / JSON parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a YAML string into an unknown value.
 * Returns structured profile_invalid errors on parse failure.
 */
function parseYamlSafe(
	content: string,
	sourcePath: string,
): Record<string, unknown> | ProfileResolutionError[] {
	let raw: unknown;
	try {
		raw = yamlParse(content);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return [
			profileInvalid(
				`YAML parse error in "${sourcePath}": ${message}`,
				undefined,
				sourcePath,
			),
		];
	}

	if (raw === null || raw === undefined) {
		return {};
	}

	if (typeof raw !== 'object' || Array.isArray(raw)) {
		return [
			profileInvalid(
				`Expected a YAML mapping in "${sourcePath}", got ${Array.isArray(raw) ? 'array' : typeof raw}.`,
				undefined,
				sourcePath,
			),
		];
	}

	return raw as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Read file helper
// ---------------------------------------------------------------------------

async function readFileSafe(
	filesystem: LogosFilesystem,
	filePath: string,
): Promise<string | ProfileResolutionError> {
	try {
		const result = await filesystem.readTextFile(filePath);
		return result.content;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return profileInvalid(
			`Failed to read file "${filePath}": ${message}`,
			undefined,
			filePath,
		);
	}
}

// ---------------------------------------------------------------------------
// Root registry loading
// ---------------------------------------------------------------------------

async function loadRootRegistry(
	filesystem: LogosFilesystem,
	docsPath: string,
): Promise<ProfileRootRegistry | ProfileResolutionError[]> {
	const content = await readFileSafe(filesystem, docsPath);
	if (typeof content !== 'string') return [content];

	const parsed = parseYamlSafe(content, docsPath);
	if (Array.isArray(parsed)) return parsed;

	const registry: ProfileRootRegistry = { raw: parsed };

	const schemaVersion = readNumberProp(parsed, 'schemaVersion');
	if (schemaVersion !== undefined) registry.schemaVersion = schemaVersion;

	const contentVersion = readStringProp(parsed, 'contentVersion');
	if (contentVersion !== undefined) registry.contentVersion = contentVersion;

	const registryType = readStringProp(parsed, 'registryType');
	if (registryType !== undefined) registry.registryType = registryType;

	const project = readSubObj(parsed, 'project');
	if (project !== undefined) registry.project = project;

	const documentationSystem = readSubObj(parsed, 'documentationSystem');
	if (documentationSystem !== undefined)
		registry.documentationSystem = documentationSystem;

	const axes = parsed.axes;
	if (Array.isArray(axes)) registry.axes = axes;

	const phaseDefinitions = readSubObj(parsed, 'phaseDefinitions');
	if (phaseDefinitions !== undefined)
		registry.phaseDefinitions = phaseDefinitions;

	const phaseRegistry = readSubObj(parsed, 'phaseRegistry');
	if (phaseRegistry !== undefined) registry.phaseRegistry = phaseRegistry;

	const outputModel = readSubObj(parsed, 'outputModel');
	if (outputModel !== undefined) registry.outputModel = outputModel;

	const globalRules = readSubObj(parsed, 'globalRules');
	if (globalRules !== undefined) registry.globalRules = globalRules;

	const qualityModel = readSubObj(parsed, 'qualityModel');
	if (qualityModel !== undefined) registry.qualityModel = qualityModel;

	const dependencyPolicy = readSubObj(parsed, 'dependencyPolicy');
	if (dependencyPolicy !== undefined)
		registry.dependencyPolicy = dependencyPolicy;

	const agentPolicy = readSubObj(parsed, 'agentPolicy');
	if (agentPolicy !== undefined) registry.agentPolicy = agentPolicy;

	const statusWorkflow = readSubObj(parsed, 'statusWorkflow');
	if (statusWorkflow !== undefined) registry.statusWorkflow = statusWorkflow;

	const roadmapIntegration = readSubObj(parsed, 'roadmapIntegration');
	if (roadmapIntegration !== undefined)
		registry.roadmapIntegration = roadmapIntegration;

	return registry;
}

// ---------------------------------------------------------------------------
// Document schema loading
// ---------------------------------------------------------------------------

async function loadDocumentSchema(
	filesystem: LogosFilesystem,
	schemaPath: string,
): Promise<ProfileDocumentSchema | ProfileResolutionError[]> {
	const content = await readFileSafe(filesystem, schemaPath);
	if (typeof content !== 'string') return [content];

	const parsed = parseYamlSafe(content, schemaPath);
	if (Array.isArray(parsed)) return parsed;

	return { raw: parsed };
}

// ---------------------------------------------------------------------------
// Phase descriptor loading
// ---------------------------------------------------------------------------

/**
 * Determine whether a directory entry's path points directly inside the
 * given parent directory (not nested in a subdirectory).
 */
function isDirectChild(entryPath: string, parentPath: string): boolean {
	const rel = path.relative(parentPath, entryPath);
	return (
		!rel.startsWith('..') && !path.isAbsolute(rel) && !rel.includes(path.sep)
	);
}

async function loadPhaseDescriptors(
	filesystem: LogosFilesystem,
	phasesRoot: string,
): Promise<ProfilePhaseContract[] | ProfileResolutionError[]> {
	let entries: unknown;
	try {
		entries = await filesystem.listDirectory({ path: phasesRoot });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return [
			profileInvalid(
				`Failed to list phases directory "${phasesRoot}": ${message}`,
				undefined,
				phasesRoot,
			),
		];
	}

	const dirEntries = entries as Array<{ path: string; kind: string }>;
	const phaseFiles = dirEntries.filter(
		(e) =>
			e.kind === 'file' &&
			e.path.endsWith('.yml') &&
			isDirectChild(e.path, phasesRoot),
	);

	const errors: ProfileResolutionError[] = [];
	const phases: ProfilePhaseContract[] = [];

	for (const entry of phaseFiles) {
		const content = await readFileSafe(filesystem, entry.path);
		if (typeof content !== 'string') {
			errors.push(content);
			continue;
		}

		const parsed = parseYamlSafe(content, entry.path);
		if (Array.isArray(parsed)) {
			errors.push(...parsed);
			continue;
		}

		// Phase YAML wraps content under a `phase` key.
		const phaseData =
			(readSubObj(parsed, 'phase') as Record<string, unknown> | undefined) ??
			parsed;

		const phaseId = readStringProp(phaseData, 'id');
		if (phaseId === undefined || phaseId.length === 0) {
			errors.push(
				profileInvalid(
					`Phase descriptor "${entry.path}" is missing an id field.`,
					undefined,
					entry.path,
				),
			);
			continue;
		}

		const phaseTitle = readStringProp(phaseData, 'title');
		const documentIds = readDocumentIds(phaseData);

		const contract: ProfilePhaseContract = {
			documentIds,
			id: phaseId,
			path: entry.path,
			raw: parsed,
		};
		if (phaseTitle !== undefined) contract.title = phaseTitle;

		phases.push(contract);
	}

	if (errors.length > 0) return errors;

	// Sort deterministically by id.
	phases.sort((a, b) => a.id.localeCompare(b.id));
	return phases;
}

/**
 * Extract document ids from a phase descriptor's `documents` array.
 */
function readDocumentIds(phaseData: Record<string, unknown>): string[] {
	const docsRaw = phaseData.documents;
	if (!Array.isArray(docsRaw)) return [];

	const ids: string[] = [];
	for (const doc of docsRaw) {
		if (doc !== null && typeof doc === 'object') {
			const docObj = doc as Record<string, unknown>;
			const docId = readStringProp(docObj, 'id');
			if (docId !== undefined) {
				ids.push(docId);
			}
		}
	}
	return ids;
}

// ---------------------------------------------------------------------------
// Document descriptor loading
// ---------------------------------------------------------------------------

async function loadDocumentDescriptors(
	filesystem: LogosFilesystem,
	phases: ProfilePhaseContract[],
	profileRoot: string,
): Promise<ProfileDocumentContract[] | ProfileResolutionError[]> {
	const errors: ProfileResolutionError[] = [];
	const docs: ProfileDocumentContract[] = [];

	for (const phase of phases) {
		const phaseDataRaw = phase.raw.phase;
		const phaseData =
			(phaseDataRaw as Record<string, unknown> | undefined) ?? phase.raw;

		const docList = Array.isArray(phaseData.documents)
			? (phaseData.documents as Array<Record<string, unknown>>)
			: [];

		for (const docEntry of docList) {
			const fileField = readStringProp(docEntry, 'file');
			if (fileField === undefined || fileField.length === 0) continue;

			const docPath = path.resolve(profileRoot, fileField);
			const content = await readFileSafe(filesystem, docPath);
			if (typeof content !== 'string') {
				errors.push(content);
				continue;
			}

			const parsed = parseYamlSafe(content, docPath);
			if (Array.isArray(parsed)) {
				errors.push(...parsed);
				continue;
			}

			// Document YAML wraps content under a `document` key.
			const docData =
				(readSubObj(parsed, 'document') as
					| Record<string, unknown>
					| undefined) ?? parsed;

			const docId = readStringProp(docData, 'id');
			if (docId === undefined || docId.length === 0) {
				errors.push(
					profileInvalid(
						`Document descriptor "${docPath}" is missing an id field.`,
						undefined,
						docPath,
					),
				);
				continue;
			}

			const docTitle = readStringProp(docData, 'title');
			const docPhaseId = readStringProp(docData, 'phase') ?? phase.id;
			const centralQuestion = readStringProp(docData, 'centralQuestion');
			const outputs = readSubObj(docData, 'outputs');
			const completionCriteria = readStringArrayProp(
				docData,
				'completionCriteria',
			);
			const qualityChecks = readStringArrayProp(docData, 'qualityChecks');
			const dependsOn = readStringArrayProp(docData, 'dependsOn');
			const sections = readSections(docData);

			const contract: ProfileDocumentContract = {
				id: docId,
				path: docPath,
				phaseId: docPhaseId,
				raw: parsed,
				sections,
			};

			if (docTitle !== undefined) contract.title = docTitle;
			if (centralQuestion !== undefined)
				contract.centralQuestion = centralQuestion;
			if (outputs !== undefined) contract.outputs = outputs;
			if (completionCriteria !== undefined)
				contract.completionCriteria = completionCriteria;
			if (qualityChecks !== undefined) contract.qualityChecks = qualityChecks;
			if (dependsOn !== undefined) contract.dependsOn = dependsOn;

			docs.push(contract);
		}
	}

	if (errors.length > 0) return errors;

	// Sort deterministically by phase id then document id.
	docs.sort((a, b) => {
		const phaseCmp = a.phaseId.localeCompare(b.phaseId);
		if (phaseCmp !== 0) return phaseCmp;
		return a.id.localeCompare(b.id);
	});
	return docs;
}

function readSections(
	docData: Record<string, unknown>,
): ProfileDocumentSection[] {
	const sectionsRaw = docData.sections;
	if (!Array.isArray(sectionsRaw)) return [];

	const sections: ProfileDocumentSection[] = [];
	for (const sec of sectionsRaw) {
		if (sec === null || typeof sec !== 'object') continue;
		const secObj = sec as Record<string, unknown>;
		const sectionId = readStringProp(secObj, 'id');
		if (sectionId === undefined || sectionId.length === 0) continue;

		const sectionTitle = readStringProp(secObj, 'title');
		const questions = readQuestionArray(secObj);

		const section: ProfileDocumentSection = {
			id: sectionId,
			questions,
			raw: secObj,
			required: secObj.required !== false,
		};
		if (sectionTitle !== undefined) section.title = sectionTitle;

		sections.push(section);
	}
	return sections;
}

function readQuestionArray(secObj: Record<string, unknown>): string[] {
	const questionsRaw = secObj.questions;
	if (!Array.isArray(questionsRaw)) return [];

	const result: string[] = [];
	for (const q of questionsRaw) {
		if (typeof q === 'string' && q.trim().length > 0) {
			result.push(q);
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Question derivation
// ---------------------------------------------------------------------------

function deriveQuestions(
	documents: ProfileDocumentContract[],
): LogosQuestion[] {
	const questions: LogosQuestion[] = [];

	for (const doc of documents) {
		const priority = derivePriority(doc);

		for (const section of doc.sections) {
			const purpose = derivePurpose(doc, section);

			for (let idx = 0; idx < section.questions.length; idx++) {
				const questionText = section.questions[idx];
				if (questionText === undefined || questionText.trim().length === 0) {
					continue;
				}

				const id = createQuestionId({
					documentId: doc.id,
					phaseId: doc.phaseId,
					question: questionText,
					questionIndex: idx,
					sectionId: section.id,
				});

				const q: LogosQuestion = {
					acceptanceCriteria: deriveAcceptanceCriteria(doc),
					completionSignals: deriveCompletionSignals(doc),
					documentId: doc.id,
					followUpPolicy: DEFAULT_FOLLOW_UP_POLICY,
					id,
					insufficiencySignals: [],
					phaseId: doc.phaseId,
					priority,
					purpose,
					question: questionText,
					required: section.required,
					sectionId: section.id,
					sourcePath: doc.path,
				};

				const deps = deriveDependencies(doc);
				if (deps !== undefined) q.dependsOn = deps;

				questions.push(q);
			}
		}
	}

	return questions;
}

function derivePriority(doc: ProfileDocumentContract): QuestionPriority {
	if (doc.phaseId === '01-foundation' || doc.phaseId.startsWith('01-')) {
		return 'critical';
	}
	return 'important';
}

function derivePurpose(
	doc: ProfileDocumentContract,
	section: ProfileDocumentSection,
): string {
	if (doc.centralQuestion !== undefined && doc.centralQuestion.length > 0) {
		return doc.centralQuestion;
	}
	if (section.title !== undefined && section.title.length > 0) {
		return section.title;
	}
	if (doc.title !== undefined && doc.title.length > 0) {
		return doc.title;
	}
	return 'No purpose available.';
}

function deriveAcceptanceCriteria(doc: ProfileDocumentContract): string[] {
	if (
		doc.completionCriteria !== undefined &&
		doc.completionCriteria.length > 0
	) {
		return doc.completionCriteria;
	}
	return [];
}

function deriveCompletionSignals(doc: ProfileDocumentContract): string[] {
	if (doc.qualityChecks !== undefined && doc.qualityChecks.length > 0) {
		return doc.qualityChecks;
	}
	return [];
}

function deriveDependencies(
	doc: ProfileDocumentContract,
): string[] | undefined {
	if (doc.dependsOn !== undefined && doc.dependsOn.length > 0) {
		return doc.dependsOn;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Validation contracts
// ---------------------------------------------------------------------------

function deriveValidationContracts(
	docs: ProfileDocumentContract[],
	documentSchemaPath: string,
): ProfileValidationContracts {
	const completionCriteria: ProfileValidationContracts['completionCriteria'] =
		[];
	const qualityChecks: ProfileValidationContracts['qualityChecks'] = [];

	for (const doc of docs) {
		if (
			doc.completionCriteria !== undefined &&
			doc.completionCriteria.length > 0
		) {
			completionCriteria.push({
				documentId: doc.id,
				phaseId: doc.phaseId,
				raw: doc.completionCriteria,
			});
		}
		if (doc.qualityChecks !== undefined && doc.qualityChecks.length > 0) {
			qualityChecks.push({
				documentId: doc.id,
				phaseId: doc.phaseId,
				raw: doc.qualityChecks,
			});
		}
	}

	return {
		completionCriteria,
		documentSchemaPath,
		qualityChecks,
	};
}

// ---------------------------------------------------------------------------
// Generation contracts
// ---------------------------------------------------------------------------

function deriveGenerationContracts(
	docs: ProfileDocumentContract[],
): ProfileGenerationContracts {
	const documentOutputPaths: ProfileGenerationContracts['documentOutputPaths'] =
		[];

	for (const doc of docs) {
		const outputs = doc.outputs;
		if (outputs !== undefined) {
			const canonical = outputs.canonical as
				| Record<string, unknown>
				| undefined;
			const entry: ProfileGenerationContracts['documentOutputPaths'][number] = {
				documentId: doc.id,
				phaseId: doc.phaseId,
				rawOutputs: outputs,
			};
			if (canonical !== undefined && canonical.path !== undefined) {
				entry.path = String(canonical.path);
			}
			documentOutputPaths.push(entry);
		}
	}

	return { documentOutputPaths };
}

// ---------------------------------------------------------------------------
// Artifact contracts
// ---------------------------------------------------------------------------

function deriveArtifactContracts(
	docs: ProfileDocumentContract[],
): ProfileArtifactContracts {
	const artifacts: ProfileArtifactContracts['artifacts'] = [];

	for (const doc of docs) {
		const outputs = doc.outputs;
		if (outputs !== undefined) {
			const docArtifacts = outputs.artifacts;
			if (Array.isArray(docArtifacts)) {
				for (const art of docArtifacts) {
					artifacts.push({
						documentId: doc.id,
						phaseId: doc.phaseId,
						rawOutputs: art,
					});
				}
			}
		}
	}

	return { artifacts };
}

// ---------------------------------------------------------------------------
// Executive contracts
// ---------------------------------------------------------------------------

async function loadExecutiveContracts(
	filesystem: LogosFilesystem,
	executiveRoot: string,
): Promise<ProfileExecutiveContracts | ProfileResolutionError[]> {
	const genConfigPath = path.join(executiveRoot, 'executive-generation.yml');
	const planSchemaPath = path.join(executiveRoot, 'executive-plan.schema.json');
	const mappingsDir = path.join(executiveRoot, 'mappings');
	const templatesDir = path.join(executiveRoot, 'templates');

	const errors: ProfileResolutionError[] = [];

	// Load generation config YAML.
	const contract: ProfileExecutiveContracts = {
		generationConfigPath: genConfigPath,
		mappingConfigs: [],
		mappingPaths: [],
		planSchemaPath,
		templatePaths: [],
	};

	const genContent = await readFileSafe(filesystem, genConfigPath);
	if (typeof genContent === 'string') {
		const parsed = parseYamlSafe(genContent, genConfigPath);
		if (Array.isArray(parsed)) {
			errors.push(...parsed);
		} else {
			contract.generationConfig = parsed;
		}
	}

	// Load mapping YAML files.
	let mappingEntries: Array<{ path: string; kind: string }>;
	try {
		mappingEntries = await filesystem.listDirectory({ path: mappingsDir });
	} catch {
		mappingEntries = [];
	}

	for (const entry of mappingEntries) {
		if (entry.kind === 'file' && entry.path.endsWith('.yml')) {
			contract.mappingPaths.push(entry.path);
			const mapContent = await readFileSafe(filesystem, entry.path);
			if (typeof mapContent === 'string') {
				const parsed = parseYamlSafe(mapContent, entry.path);
				if (Array.isArray(parsed)) {
					errors.push(...parsed);
				} else {
					contract.mappingConfigs.push({ path: entry.path, raw: parsed });
				}
			} else {
				errors.push(mapContent);
			}
		}
	}
	contract.mappingPaths.sort();
	contract.mappingConfigs.sort((a, b) => a.path.localeCompare(b.path));

	// Collect template paths.
	let templateEntries: Array<{ path: string; kind: string }>;
	try {
		templateEntries = await filesystem.listDirectory({ path: templatesDir });
	} catch {
		templateEntries = [];
	}

	for (const entry of templateEntries) {
		if (entry.kind === 'file') {
			contract.templatePaths.push(entry.path);
		}
	}
	contract.templatePaths.sort();

	if (errors.length > 0) return errors;

	return contract;
}

// ---------------------------------------------------------------------------
// Predicate: check whether a value is an error array (for type narrowing)
// ---------------------------------------------------------------------------

function isErrorArray<T>(
	value: T[] | ProfileResolutionError[],
): value is ProfileResolutionError[] {
	if (value.length === 0) return false;
	const first = value[0];
	return (
		first !== undefined &&
		first !== null &&
		typeof first === 'object' &&
		'code' in first
	);
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

/**
 * Load and normalize all profile contracts from the resolved active profile.
 *
 * Flow:
 * 1. Resolve the active profile through {@link resolveActiveProfile}.
 * 2. Load root registry (`docs.yml`).
 * 3. Load document schema (`document.schema.yml`).
 * 4. Load phase descriptors from `phases/*.yml`.
 * 5. Load document descriptors from `phases/<phase-id>/*.yml`.
 * 6. Derive {@link LogosQuestion} records from document sections.
 * 7. Derive validation, generation, and artifact contracts.
 * 8. Load Executive contracts.
 * 9. Return normalized {@link LoadedProfileContracts}.
 */
export async function loadProfileContracts(
	input: LoadProfileContractsInput,
): Promise<LoadProfileContractsResult> {
	const { projectRoot, activeProfileId, filesystem } = input;

	// ---- 1. Resolve active profile ----
	const resolveInput: ResolveActiveProfileInput = {
		activeProfileId,
		filesystem,
		projectRoot,
	};

	const resolved = await resolveActiveProfile(resolveInput);
	if (!resolved.ok) {
		return { errors: resolved.errors, ok: false, warnings: resolved.warnings };
	}

	const { profile } = resolved;
	const warnings: string[] = [...resolved.warnings];
	const loadedPaths: string[] = [];

	// ---- 2. Load root registry ----
	const rootRegistry = await loadRootRegistry(filesystem, profile.docsPath);
	if (Array.isArray(rootRegistry)) {
		return { errors: rootRegistry, ok: false, warnings };
	}
	loadedPaths.push(profile.docsPath);

	// ---- 3. Load document schema ----
	const documentSchema = await loadDocumentSchema(
		filesystem,
		profile.documentSchemaPath,
	);
	if (Array.isArray(documentSchema)) {
		return { errors: documentSchema, ok: false, warnings };
	}
	loadedPaths.push(profile.documentSchemaPath);

	// ---- 4. Load phase descriptors ----
	const phases = await loadPhaseDescriptors(filesystem, profile.phasesRoot);
	if (isErrorArray(phases)) {
		return { errors: phases, ok: false, warnings };
	}
	for (const p of phases) {
		loadedPaths.push(p.path);
	}

	// ---- 5. Load document descriptors ----
	const documents = await loadDocumentDescriptors(
		filesystem,
		phases,
		profile.profileRoot,
	);
	if (isErrorArray(documents)) {
		return { errors: documents, ok: false, warnings };
	}
	for (const d of documents) {
		loadedPaths.push(d.path);
	}

	// ---- 6. Derive questions ----
	const questions = deriveQuestions(documents);

	// ---- 7. Derive validation ----
	const validation = deriveValidationContracts(
		documents,
		profile.documentSchemaPath,
	);

	// ---- 8. Derive generation ----
	const generation = deriveGenerationContracts(documents);

	// ---- 9. Derive artifacts ----
	const artifacts = deriveArtifactContracts(documents);

	// ---- 10. Load executive contracts ----
	const executive = await loadExecutiveContracts(
		filesystem,
		profile.executiveRoot,
	);
	if (Array.isArray(executive)) {
		return { errors: executive, ok: false, warnings };
	}

	// Add executive paths to loadedPaths.
	loadedPaths.push(executive.generationConfigPath);
	loadedPaths.push(executive.planSchemaPath);
	for (const mp of executive.mappingPaths) {
		loadedPaths.push(mp);
	}
	for (const tp of executive.templatePaths) {
		loadedPaths.push(tp);
	}

	// ---- 11. Return ----
	const contracts: LoadedProfileContracts = {
		artifacts,
		documentSchema,
		documents,
		executive,
		generation,
		loadedPaths,
		phases,
		profileId: activeProfileId,
		profileRoot: profile.profileRoot,
		questions,
		rootRegistry,
		validation,
		warnings,
	};

	return { contracts, ok: true, warnings };
}

// ---------------------------------------------------------------------------
// Safe property access helpers
// ---------------------------------------------------------------------------

function readStringProp(
	obj: Record<string, unknown>,
	key: string,
): string | undefined {
	const val = obj[key];
	if (typeof val === 'string') return val;
	return undefined;
}

function readNumberProp(
	obj: Record<string, unknown>,
	key: string,
): number | undefined {
	const val = obj[key];
	if (typeof val === 'number') return val;
	return undefined;
}

function readSubObj(
	obj: Record<string, unknown>,
	key: string,
): Record<string, unknown> | undefined {
	const val = obj[key];
	if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
		return val as Record<string, unknown>;
	}
	return undefined;
}

function readStringArrayProp(
	obj: Record<string, unknown>,
	key: string,
): string[] | undefined {
	const val = obj[key];
	if (!Array.isArray(val)) return undefined;
	const result: string[] = [];
	for (const item of val) {
		if (typeof item === 'string' && item.length > 0) {
			result.push(item);
		}
	}
	return result.length > 0 ? result : undefined;
}
