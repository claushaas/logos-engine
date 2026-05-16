import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import type { DocumentDescriptor } from './document-descriptor.js';
import {
	DocumentDescriptorValidationErrorClass,
	loadAndValidateDocumentDescriptor,
} from './document-descriptor.js';
import type {
	LoadProfileRegistryOptions,
	ProfileId,
	ProfileStatusWorkflow,
} from './profile-registry.js';
import { loadProfileRegistry } from './profile-registry.js';

export type PhaseId = string;
export type CanonicalDocumentId = string;
export type DocumentDescriptorPath = string;

export interface DocumentationContractPaths {
	profileRoot: string;
	registryPath: string;
}

export interface PhaseDocumentRef {
	id: string;
	title: string;
	file: string;
	output?: string | undefined;
	purpose?: string | undefined;
	centralQuestion?: string | undefined;
	required?: boolean | undefined;
}

export interface LoadedPhaseDescriptor {
	id: PhaseId;
	title: string;
	order: number;
	axis: string;
	status: string;
	description?: string | undefined;
	purpose?: string | undefined;
	centralQuestion?: string | undefined;
	responsibilityBoundary: Record<string, unknown>;
	dependsOn: string[];
	feedsInto: string[];
	readingOrder: string[];
	completionCriteria: string[];
	qualityChecks: string[];
	generatedOutputs: Record<string, unknown>;
	documents: PhaseDocumentRef[];
	sourcePath: string;
	raw: Record<string, unknown>;
}

export interface LoadedDocumentDescriptor {
	descriptor: DocumentDescriptor;
	canonicalId: CanonicalDocumentId;
	phaseId: PhaseId;
	sourcePath: string;
	phaseOrder: number;
	documentOrder: number;
	globalOrder: number;
}

export interface DocumentationContract {
	profileId: ProfileId;
	profileRoot: string;
	registryPath: string;
	phaseOrder: PhaseId[];
	phases: LoadedPhaseDescriptor[];
	documents: LoadedDocumentDescriptor[];
	documentsByCanonicalId: Map<CanonicalDocumentId, LoadedDocumentDescriptor>;
	documentsByPhaseId: Map<PhaseId, LoadedDocumentDescriptor[]>;
	statusWorkflow: ProfileStatusWorkflow;
}

export interface LoadDocumentationContractOptions
	extends LoadProfileRegistryOptions {
	schemaPath?: string;
}

export interface DocumentationContractDiagnostic {
	code: string;
	message: string;
	path: string;
	fieldPath: string | undefined;
	expected?: string | undefined;
	received?: string | undefined;
	sourcePaths?: string[] | undefined;
}

export class DocumentationContractError extends Error {
	diagnostics: DocumentationContractDiagnostic[];

	constructor(diagnostics: DocumentationContractDiagnostic[]) {
		super(diagnostics.map((d) => d.message).join('; '));
		this.diagnostics = diagnostics;
		this.name = 'DocumentationContractError';
	}
}

export interface DocumentationContractIndexEntry {
	phaseId: string;
	phaseOrder: number;
	documentId: string;
	canonicalDocumentId: string;
	documentOrder: number;
	globalOrder: number;
	sourcePath: string;
}

function normalizeCanonicalId(rawId: string): CanonicalDocumentId {
	const trimmed = rawId.trim();
	if (trimmed.length === 0) {
		throw new Error('Document ID cannot be empty after trimming');
	}
	return trimmed;
}

function createPhaseDiagnostic(
	code: string,
	message: string,
	path: string,
	fieldPath: string | undefined,
	expected?: string,
	received?: string,
): DocumentationContractDiagnostic {
	return { code, expected, fieldPath, message, path, received };
}

export async function loadDocumentationContract(
	options: LoadDocumentationContractOptions = {},
): Promise<DocumentationContract> {
	const diagnostics: DocumentationContractDiagnostic[] = [];

	// Load profile registry (Step 1.1)
	const registry = await loadProfileRegistry(options);

	const phases: LoadedPhaseDescriptor[] = [];
	const documents: LoadedDocumentDescriptor[] = [];
	const documentsByPhaseId = new Map<PhaseId, LoadedDocumentDescriptor[]>();
	const canonicalIdToSourcePath = new Map<
		CanonicalDocumentId,
		{ path: string; phaseId: string }
	>();
	let globalOrder = 0;

	for (const phaseEntry of registry.phaseRegistry.files) {
		const phasePath = resolve(registry.paths.profileRoot, phaseEntry.path);

		if (!existsSync(phasePath)) {
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_MISSING_FILE',
					`Phase descriptor file not found: ${phasePath}`,
					registry.paths.registryPath,
					`phaseRegistry.files[${registry.phaseRegistry.files.indexOf(phaseEntry)}].path`,
					phaseEntry.path,
				),
			);
			continue;
		}

		let rawContent: string;
		try {
			rawContent = readFileSync(phasePath, 'utf-8');
		} catch (_err) {
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_READ_ERROR',
					`Failed to read phase descriptor file: ${phasePath}`,
					phasePath,
					undefined,
				),
			);
			continue;
		}

		let parsed: unknown;
		try {
			parsed = YAML.parse(rawContent);
		} catch (err) {
			const parseError = err instanceof Error ? err.message : String(err);
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_PARSE_ERROR',
					`Failed to parse YAML at ${phasePath}: ${parseError}`,
					phasePath,
					undefined,
				),
			);
			continue;
		}

		if (
			parsed === null ||
			typeof parsed !== 'object' ||
			Array.isArray(parsed) ||
			!('phase' in parsed)
		) {
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_SHAPE',
					`Expected phase descriptor file to contain a top-level 'phase' key`,
					phasePath,
					undefined,
				),
			);
			continue;
		}

		const phaseRaw = (parsed as Record<string, unknown>).phase as Record<
			string,
			unknown
		>;

		if (typeof phaseRaw.id !== 'string' || phaseRaw.id.trim().length === 0) {
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_FIELD_TYPE',
					`Expected phase.id to be a non-empty string`,
					phasePath,
					'phase.id',
					'non-empty string',
					typeof phaseRaw.id,
				),
			);
			continue;
		}

		if (
			typeof phaseRaw.title !== 'string' ||
			phaseRaw.title.trim().length === 0
		) {
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_FIELD_TYPE',
					`Expected phase.title to be a non-empty string`,
					phasePath,
					'phase.title',
					'non-empty string',
					typeof phaseRaw.title,
				),
			);
		}

		const documentsRaw = phaseRaw.documents;
		if (!Array.isArray(documentsRaw)) {
			diagnostics.push(
				createPhaseDiagnostic(
					'E_PHASE_FIELD_TYPE',
					`Expected phase.documents to be an array`,
					phasePath,
					'phase.documents',
					'array',
					typeof documentsRaw,
				),
			);
			continue;
		}

		const documentRefs: PhaseDocumentRef[] = [];
		for (let i = 0; i < documentsRaw.length; i++) {
			const docRef = documentsRaw[i];
			if (
				docRef === null ||
				typeof docRef !== 'object' ||
				Array.isArray(docRef)
			) {
				diagnostics.push(
					createPhaseDiagnostic(
						'E_PHASE_DOCUMENT_REF_TYPE',
						`Expected phase.documents[${i}] to be an object`,
						phasePath,
						`phase.documents[${i}]`,
						'object',
						docRef === null
							? 'null'
							: Array.isArray(docRef)
								? 'array'
								: typeof docRef,
					),
				);
				continue;
			}

			const docRefObj = docRef as Record<string, unknown>;
			if (
				typeof docRefObj.file !== 'string' ||
				docRefObj.file.trim().length === 0
			) {
				diagnostics.push(
					createPhaseDiagnostic(
						'E_PHASE_DOCUMENT_REF_FIELD',
						`Expected phase.documents[${i}].file to be a non-empty string`,
						phasePath,
						`phase.documents[${i}].file`,
						'non-empty string',
						typeof docRefObj.file,
					),
				);
				continue;
			}

			documentRefs.push({
				centralQuestion:
					typeof docRefObj.centralQuestion === 'string'
						? docRefObj.centralQuestion
						: undefined,
				file: String(docRefObj.file),
				id: String(docRefObj.id ?? ''),
				output:
					typeof docRefObj.output === 'string' ? docRefObj.output : undefined,
				purpose:
					typeof docRefObj.purpose === 'string' ? docRefObj.purpose : undefined,
				required:
					typeof docRefObj.required === 'boolean'
						? docRefObj.required
						: undefined,
				title: String(docRefObj.title ?? ''),
			});
		}

		const phaseDescriptor: LoadedPhaseDescriptor = {
			axis: String(phaseRaw.axis ?? ''),
			centralQuestion:
				typeof phaseRaw.centralQuestion === 'string'
					? phaseRaw.centralQuestion
					: undefined,
			completionCriteria: Array.isArray(phaseRaw.completionCriteria)
				? (phaseRaw.completionCriteria as string[])
				: [],
			dependsOn: Array.isArray(phaseRaw.dependsOn)
				? (phaseRaw.dependsOn as string[])
				: [],
			description:
				typeof phaseRaw.description === 'string'
					? phaseRaw.description
					: undefined,
			documents: documentRefs,
			feedsInto: Array.isArray(phaseRaw.feedsInto)
				? (phaseRaw.feedsInto as string[])
				: [],
			generatedOutputs:
				typeof phaseRaw.generatedOutputs === 'object' &&
				phaseRaw.generatedOutputs !== null &&
				!Array.isArray(phaseRaw.generatedOutputs)
					? (phaseRaw.generatedOutputs as Record<string, unknown>)
					: {},
			id: phaseRaw.id as string,
			order: typeof phaseRaw.order === 'number' ? phaseRaw.order : 0,
			purpose:
				typeof phaseRaw.purpose === 'string' ? phaseRaw.purpose : undefined,
			qualityChecks: Array.isArray(phaseRaw.qualityChecks)
				? (phaseRaw.qualityChecks as string[])
				: [],
			raw: phaseRaw,
			readingOrder: Array.isArray(phaseRaw.readingOrder)
				? (phaseRaw.readingOrder as string[])
				: [],
			responsibilityBoundary:
				typeof phaseRaw.responsibilityBoundary === 'object' &&
				phaseRaw.responsibilityBoundary !== null &&
				!Array.isArray(phaseRaw.responsibilityBoundary)
					? (phaseRaw.responsibilityBoundary as Record<string, unknown>)
					: {},
			sourcePath: phasePath,
			status: String(phaseRaw.status ?? ''),
			title: String(phaseRaw.title ?? ''),
		};

		phases.push(phaseDescriptor);

		const phaseDocuments: LoadedDocumentDescriptor[] = [];

		for (let docIdx = 0; docIdx < documentRefs.length; docIdx++) {
			const docRef = documentRefs[docIdx];
			if (docRef === undefined) {
				continue;
			}
			const docPath = resolve(registry.paths.profileRoot, docRef.file);

			if (!existsSync(docPath)) {
				diagnostics.push(
					createPhaseDiagnostic(
						'E_DOCUMENT_MISSING_FILE',
						`Document descriptor file not found: ${docPath}`,
						phasePath,
						`phase.documents[${docIdx}].file`,
						docRef.file,
					),
				);
				continue;
			}

			let descriptor: DocumentDescriptor;
			try {
				const descriptorOptions = options.schemaPath
					? {
							profileRoot: registry.paths.profileRoot,
							schemaPath: options.schemaPath,
						}
					: { profileRoot: registry.paths.profileRoot };
				descriptor = await loadAndValidateDocumentDescriptor(docPath, {
					...descriptorOptions,
				});
			} catch (err) {
				if (err instanceof DocumentDescriptorValidationErrorClass) {
					for (const docError of err.errors) {
						diagnostics.push({
							code: docError.code,
							expected:
								docError.expected !== undefined
									? String(docError.expected)
									: undefined,
							fieldPath: docError.fieldPath,
							message: docError.message,
							path: docError.path,
							received:
								docError.received !== undefined
									? String(docError.received)
									: undefined,
						});
					}
				} else {
					diagnostics.push(
						createPhaseDiagnostic(
							'E_DOCUMENT_LOAD_ERROR',
							err instanceof Error ? err.message : String(err),
							docPath,
							`phase.documents[${docIdx}].file`,
						),
					);
				}
				continue;
			}

			let canonicalId: CanonicalDocumentId;
			try {
				canonicalId = normalizeCanonicalId(descriptor.id);
			} catch (_err) {
				diagnostics.push(
					createPhaseDiagnostic(
						'E_DOCUMENT_EMPTY_ID',
						`Document descriptor has an empty or whitespace-only ID`,
						docPath,
						'document.id',
					),
				);
				continue;
			}

			const existing = canonicalIdToSourcePath.get(canonicalId);
			if (existing) {
				diagnostics.push({
					...createPhaseDiagnostic(
						'E_DOCUMENT_DUPLICATE_ID',
						`Duplicate document ID "${canonicalId}" found in ${docPath} (first defined in ${existing.path})`,
						docPath,
						'document.id',
						'unique id',
						canonicalId,
					),
					sourcePaths: [existing.path, docPath],
				});
				continue;
			}

			canonicalIdToSourcePath.set(canonicalId, {
				path: docPath,
				phaseId: phaseDescriptor.id,
			});

			const loadedDoc: LoadedDocumentDescriptor = {
				canonicalId,
				descriptor,
				documentOrder: docIdx,
				globalOrder,
				phaseId: phaseDescriptor.id,
				phaseOrder: phaseDescriptor.order,
				sourcePath: docPath,
			};

			phaseDocuments.push(loadedDoc);
			documents.push(loadedDoc);
			globalOrder++;
		}

		documentsByPhaseId.set(phaseDescriptor.id, phaseDocuments);
	}

	if (diagnostics.length > 0) {
		throw new DocumentationContractError(diagnostics);
	}

	const documentsByCanonicalId = new Map<
		CanonicalDocumentId,
		LoadedDocumentDescriptor
	>();
	for (const doc of documents) {
		documentsByCanonicalId.set(doc.canonicalId, doc);
	}

	return {
		documents,
		documentsByCanonicalId,
		documentsByPhaseId,
		phaseOrder: phases.map((p) => p.id),
		phases,
		profileId: registry.id,
		profileRoot: registry.paths.profileRoot,
		registryPath: registry.paths.registryPath,
		statusWorkflow: registry.statusWorkflow,
	};
}

export function listDocumentationContractIndex(
	contract: DocumentationContract,
): DocumentationContractIndexEntry[] {
	return contract.documents.map((doc) => ({
		canonicalDocumentId: doc.canonicalId,
		documentId: doc.descriptor.id,
		documentOrder: doc.documentOrder,
		globalOrder: doc.globalOrder,
		phaseId: doc.phaseId,
		phaseOrder: doc.phaseOrder,
		sourcePath: doc.sourcePath,
	}));
}

/**
 * Convert absolute source paths in index entries to paths relative to the given root.
 * Useful for producing deterministic snapshots across environments.
 */
export function relativizeIndexPaths(
	entries: DocumentationContractIndexEntry[],
	root: string,
): DocumentationContractIndexEntry[] {
	const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
	return entries.map((entry) => ({
		...entry,
		sourcePath: entry.sourcePath.startsWith(normalizedRoot)
			? entry.sourcePath.slice(normalizedRoot.length)
			: entry.sourcePath,
	}));
}
