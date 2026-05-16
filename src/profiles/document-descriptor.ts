import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

export type DocumentDescriptorId = string;

export type DocumentDescriptorStatus =
	| 'not_started'
	| 'drafting'
	| 'drafted'
	| 'needs_review'
	| 'reviewed'
	| 'approved'
	| 'needs_revision'
	| 'deprecated';

export interface DocumentDescriptorOutputCanonical {
	format: string;
	path: string;
	purpose?: string;
}

export interface DocumentDescriptorOutputArtifact {
	id: string;
	format: string;
	path: string;
	purpose: string;
	audience?: string;
	includes?: string[];
	generationMode?: string;
}

export interface DocumentDescriptorOutputAgentPack {
	id: string;
	format: string;
	path: string;
	purpose: string;
	agentRole?: string;
	includes?: string[];
	constraints?: string[];
}

export interface DocumentDescriptorOutputData {
	id: string;
	format: string;
	path: string;
	purpose: string;
	schemaRef?: string;
}

export interface DocumentDescriptorOutputExecutive {
	id: string;
	format: string;
	path: string;
	purpose: string;
	role?: string;
	schemaRef?: string;
}

export interface DocumentDescriptorOutput {
	canonical: DocumentDescriptorOutputCanonical;
	artifacts?: DocumentDescriptorOutputArtifact[];
	agentPacks?: DocumentDescriptorOutputAgentPack[];
	data?: DocumentDescriptorOutputData[];
	executive?: DocumentDescriptorOutputExecutive[];
}

export interface DocumentDescriptorDependency {
	id: string;
	type: string;
	path?: string;
	required?: boolean;
	description?: string;
}

export interface DocumentDescriptorSection {
	id: string;
	title: string;
	intent?: string;
	required?: boolean;
	questions: string[];
	outputGuidance?: string[];
	qualityChecks?: string[];
	antiPatterns?: string[];
}

export interface DocumentDescriptor {
	id: DocumentDescriptorId;
	title: string;
	phase: string;
	order?: number;
	type: string;
	status: DocumentDescriptorStatus;
	summary?: string;
	purpose: string;
	centralQuestion: string;
	dependsOn?: string[];
	feeds?: string[];
	inputs?: DocumentDescriptorDependency[];
	outputs: DocumentDescriptorOutput;
	completionCriteria?: string[];
	qualityChecks?: string[];
	antiPatterns?: string[];
	generationRules?: string[];
	reviewRules?: string[];
	sections: DocumentDescriptorSection[];
	specializedFormats?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

export interface DocumentDescriptorValidationError {
	code: string;
	message: string;
	path: string;
	fieldPath: string | undefined;
	expected?: unknown;
	received?: unknown;
}

export interface DocumentDescriptorValidationResult {
	valid: boolean;
	errors: DocumentDescriptorValidationError[];
}

export interface DocumentDescriptorValidationOptions {
	profileRoot?: string;
	schemaPath?: string;
	schema?: DocumentSchema;
}

export interface LoadAndValidateDocumentDescriptorOptions
	extends DocumentDescriptorValidationOptions {
	descriptorPath: string;
}

export class DocumentDescriptorValidationErrorClass extends Error {
	errors: DocumentDescriptorValidationError[];

	constructor(errors: DocumentDescriptorValidationError[]) {
		super(errors.map((e) => e.message).join('; '));
		this.errors = errors;
		this.name = 'DocumentDescriptorValidationError';
	}
}

export interface SchemaFieldDef {
	type: string;
	required?: boolean;
	allowedValues?: unknown[];
	itemSchema?: Record<string, SchemaFieldDef>;
	fields?: Record<string, SchemaFieldDef>;
	structure?: Record<string, SchemaFieldDef>;
	default?: unknown;
}

export interface DocumentSchema {
	requiredFields: string[];
	optionalFields: string[];
	fields: Record<string, SchemaFieldDef>;
}

const schemaCache = new Map<string, DocumentSchema>();
let validationSchemaOverride: DocumentSchema | undefined;

function extractFieldDef(fieldRaw: Record<string, unknown>): SchemaFieldDef {
	const def: SchemaFieldDef = {
		type: String(fieldRaw.type ?? 'string'),
	};

	if (typeof fieldRaw.required === 'boolean') {
		def.required = fieldRaw.required;
	}

	if (Array.isArray(fieldRaw.allowedValues)) {
		def.allowedValues = fieldRaw.allowedValues;
	}

	if (fieldRaw.default !== undefined) {
		def.default = fieldRaw.default;
	}

	if (
		fieldRaw.itemSchema !== undefined &&
		typeof fieldRaw.itemSchema === 'object' &&
		fieldRaw.itemSchema !== null
	) {
		const itemSchemaRaw = fieldRaw.itemSchema as Record<string, unknown>;
		const itemSchema: Record<string, SchemaFieldDef> = {};
		for (const [key, value] of Object.entries(itemSchemaRaw)) {
			if (
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value)
			) {
				itemSchema[key] = extractFieldDef(value as Record<string, unknown>);
			}
		}
		def.itemSchema = itemSchema;
	}

	const nestedStructure =
		(fieldRaw.structure !== undefined ? fieldRaw.structure : fieldRaw.fields) ??
		undefined;
	if (
		nestedStructure !== undefined &&
		typeof nestedStructure === 'object' &&
		nestedStructure !== null &&
		!Array.isArray(nestedStructure)
	) {
		const structure: Record<string, SchemaFieldDef> = {};
		for (const [key, value] of Object.entries(nestedStructure)) {
			if (
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value)
			) {
				structure[key] = extractFieldDef(value as Record<string, unknown>);
			}
		}
		def.fields = structure;
	}

	return def;
}

function extractDocumentSchema(raw: unknown): DocumentSchema {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error(
			'Expected document schema root to be an object under schema.document',
		);
	}

	const rawObj = raw as Record<string, unknown>;

	const requiredFields = Array.isArray(rawObj.requiredFields)
		? (rawObj.requiredFields as string[])
		: [];
	const optionalFields = Array.isArray(rawObj.optionalFields)
		? (rawObj.optionalFields as string[])
		: [];

	const fields: Record<string, SchemaFieldDef> = {};
	const fieldsRaw = rawObj.fields;
	if (
		fieldsRaw !== undefined &&
		typeof fieldsRaw === 'object' &&
		!Array.isArray(fieldsRaw)
	) {
		for (const [key, value] of Object.entries(
			fieldsRaw as Record<string, unknown>,
		)) {
			if (
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value)
			) {
				fields[key] = extractFieldDef(value as Record<string, unknown>);
			}
		}
	}

	return { fields, optionalFields, requiredFields };
}

function getDefaultSchemaPath(
	options?: DocumentDescriptorValidationOptions,
): string {
	if (options?.schemaPath) {
		return resolve(options.schemaPath);
	}
	const profileRoot = options?.profileRoot
		? resolve(options.profileRoot)
		: resolve(process.cwd(), 'profiles', 'standard');
	return resolve(profileRoot, 'document.schema.yml');
}

export async function loadDocumentSchema(
	options?: DocumentDescriptorValidationOptions,
): Promise<DocumentSchema> {
	const schemaPath = getDefaultSchemaPath(options);
	const cached = schemaCache.get(schemaPath);
	if (cached !== undefined) {
		return cached;
	}

	let rawContent: string;
	try {
		rawContent = readFileSync(schemaPath, 'utf-8');
	} catch (_err) {
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_SCHEMA_MISSING_FILE',
				fieldPath: undefined,
				message: `Document schema file not found: ${schemaPath}`,
				path: schemaPath,
			},
		]);
	}

	let parsed: unknown;
	try {
		parsed = YAML.parse(rawContent);
	} catch (err) {
		const parseError = err instanceof Error ? err.message : String(err);
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_SCHEMA_PARSE_ERROR',
				fieldPath: undefined,
				message: `Failed to parse YAML at ${schemaPath}: ${parseError}`,
				path: schemaPath,
			},
		]);
	}

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_SCHEMA_SHAPE',
				fieldPath: undefined,
				message: `Expected document schema root to be an object`,
				path: schemaPath,
			},
		]);
	}

	const schemaRoot = (parsed as Record<string, unknown>).schema;
	if (
		schemaRoot === null ||
		typeof schemaRoot !== 'object' ||
		Array.isArray(schemaRoot)
	) {
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_SCHEMA_SHAPE',
				fieldPath: 'schema',
				message: `Expected document schema to contain a 'schema' object`,
				path: schemaPath,
			},
		]);
	}

	const documentSchema = (schemaRoot as Record<string, unknown>).document;
	if (
		documentSchema === null ||
		typeof documentSchema !== 'object' ||
		Array.isArray(documentSchema)
	) {
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_SCHEMA_SHAPE',
				fieldPath: 'schema.document',
				message: `Expected document schema to contain 'schema.document' object`,
				path: schemaPath,
			},
		]);
	}

	const schema = extractDocumentSchema(documentSchema);
	schemaCache.set(schemaPath, schema);
	return schema;
}

function collectErrors(
	value: unknown,
	def: SchemaFieldDef,
	path: string,
	fieldPath: string,
	errors: DocumentDescriptorValidationError[],
): void {
	const type = def.type;

	if (type === 'string') {
		if (typeof value !== 'string') {
			errors.push({
				code: 'E_FIELD_TYPE',
				expected: 'string',
				fieldPath,
				message: `Expected ${fieldPath} to be a string`,
				path,
				received: typeof value,
			});
			return;
		}
		if (value.length === 0) {
			errors.push({
				code: 'E_FIELD_EMPTY',
				fieldPath,
				message: `Expected ${fieldPath} to be a non-empty string`,
				path,
			});
			return;
		}
		if (def.allowedValues !== undefined) {
			if (!def.allowedValues.includes(value)) {
				errors.push({
					code: 'E_FIELD_DISALLOWED_VALUE',
					expected: def.allowedValues,
					fieldPath,
					message: `Expected ${fieldPath} to be one of ${JSON.stringify(def.allowedValues)}; received "${value}"`,
					path,
					received: value,
				});
			}
		}
		return;
	}

	if (type === 'integer') {
		if (typeof value !== 'number' || !Number.isInteger(value)) {
			errors.push({
				code: 'E_FIELD_TYPE',
				expected: 'integer',
				fieldPath,
				message: `Expected ${fieldPath} to be an integer`,
				path,
				received: typeof value,
			});
		}
		return;
	}

	if (type === 'boolean') {
		if (typeof value !== 'boolean') {
			errors.push({
				code: 'E_FIELD_TYPE',
				expected: 'boolean',
				fieldPath,
				message: `Expected ${fieldPath} to be a boolean`,
				path,
				received: typeof value,
			});
		}
		return;
	}

	if (type === 'object') {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			errors.push({
				code: 'E_FIELD_TYPE',
				expected: 'object',
				fieldPath,
				message: `Expected ${fieldPath} to be an object`,
				path,
				received:
					value === null
						? 'null'
						: Array.isArray(value)
							? 'array'
							: typeof value,
			});
			return;
		}

		const nestedFields = def.fields ?? def.structure;
		if (nestedFields !== undefined) {
			for (const [nestedKey, nestedDef] of Object.entries(nestedFields)) {
				const nestedValue = (value as Record<string, unknown>)[nestedKey];
				const nestedFieldPath = `${fieldPath}.${nestedKey}`;
				if (nestedValue === undefined) {
					if (nestedDef.required) {
						errors.push({
							code: 'E_FIELD_MISSING',
							fieldPath: nestedFieldPath,
							message: `Missing required field: ${nestedFieldPath}`,
							path,
						});
					}
					continue;
				}
				collectErrors(nestedValue, nestedDef, path, nestedFieldPath, errors);
			}
		}
		return;
	}

	if (type === 'array<string>') {
		if (!Array.isArray(value)) {
			errors.push({
				code: 'E_FIELD_TYPE',
				expected: 'array',
				fieldPath,
				message: `Expected ${fieldPath} to be an array`,
				path,
				received: typeof value,
			});
			return;
		}
		for (let i = 0; i < value.length; i++) {
			const item = value[i];
			if (typeof item !== 'string') {
				errors.push({
					code: 'E_FIELD_ARRAY_ITEM_TYPE',
					expected: 'string',
					fieldPath: `${fieldPath}[${i}]`,
					message: `Expected ${fieldPath}[${i}] to be a string`,
					path,
					received: typeof item,
				});
			}
		}
		return;
	}

	if (type === 'array<object>') {
		if (!Array.isArray(value)) {
			errors.push({
				code: 'E_FIELD_TYPE',
				expected: 'array',
				fieldPath,
				message: `Expected ${fieldPath} to be an array`,
				path,
				received: typeof value,
			});
			return;
		}

		const itemSchema = def.itemSchema;
		if (itemSchema === undefined) {
			return;
		}

		for (let i = 0; i < value.length; i++) {
			const item = value[i];
			if (item === null || typeof item !== 'object' || Array.isArray(item)) {
				errors.push({
					code: 'E_FIELD_ARRAY_ITEM_TYPE',
					expected: 'object',
					fieldPath: `${fieldPath}[${i}]`,
					message: `Expected ${fieldPath}[${i}] to be an object`,
					path,
					received:
						item === null
							? 'null'
							: Array.isArray(item)
								? 'array'
								: typeof item,
				});
				continue;
			}

			for (const [itemKey, itemDef] of Object.entries(itemSchema)) {
				const itemValue = (item as Record<string, unknown>)[itemKey];
				const itemFieldPath = `${fieldPath}[${i}].${itemKey}`;
				if (itemValue === undefined) {
					if (itemDef.required) {
						errors.push({
							code: 'E_FIELD_MISSING',
							fieldPath: itemFieldPath,
							message: `Missing required field: ${itemFieldPath}`,
							path,
						});
					}
					continue;
				}
				collectErrors(itemValue, itemDef, path, itemFieldPath, errors);
			}
		}
		return;
	}

	// Fallback: treat unrecognized types permissively
}

export function validateDocumentDescriptor(
	descriptor: unknown,
	options?: DocumentDescriptorValidationOptions & { descriptorPath?: string },
): DocumentDescriptorValidationResult {
	const errors: DocumentDescriptorValidationError[] = [];
	const path = options?.descriptorPath ?? '<descriptor>';

	// The descriptor should be the inner document object, not the wrapper.
	// If the caller passes { document: {...} }, unwrap it.
	let target = descriptor;
	if (
		target !== null &&
		typeof target === 'object' &&
		!Array.isArray(target) &&
		'document' in target
	) {
		target = (target as Record<string, unknown>).document;
	}

	if (target === null || typeof target !== 'object' || Array.isArray(target)) {
		errors.push({
			code: 'E_DESCRIPTOR_SHAPE',
			expected: 'object',
			fieldPath: undefined,
			message: 'Expected document descriptor to be an object',
			path,
			received:
				target === null
					? 'null'
					: Array.isArray(target)
						? 'array'
						: typeof target,
		});
		return { errors, valid: false };
	}

	const targetObj = target as Record<string, unknown>;

	// Load schema synchronously for validation if needed, but we avoid
	// I/O at import time.  Because validateDocumentDescriptor is sync,
	// we use the cached schema populated by an earlier call, or we
	// perform a lightweight structural validation without the full
	// schema when the cache is cold.
	const schema = options?.schema ?? validationSchemaOverride;

	if (schema === undefined) {
		// Without an explicit parsed schema, this synchronous helper performs a
		// conservative manual validation. File-based loading must use the real
		// profile schema and does not silently fall back.
		performFallbackValidation(targetObj, path, errors);
		return { errors, valid: errors.length === 0 };
	}

	// Validate required top-level fields from schema
	for (const field of schema.requiredFields) {
		if (!(field in targetObj)) {
			errors.push({
				code: 'E_FIELD_MISSING',
				fieldPath: field,
				message: `Missing required field: ${field}`,
				path,
			});
		}
	}

	// Validate each present field against its schema definition
	const allKnownFields = new Set([
		...schema.requiredFields,
		...schema.optionalFields,
	]);

	for (const [field, value] of Object.entries(targetObj)) {
		if (!allKnownFields.has(field)) {
			// Unknown fields are allowed in YAML but noted as warnings
			// for diagnostics.  Step 1.2 treats them as non-fatal.
			continue;
		}

		const fieldDef = schema.fields[field];
		if (fieldDef === undefined) {
			continue;
		}

		collectErrors(value, fieldDef, path, field, errors);
	}

	return { errors, valid: errors.length === 0 };
}

function performFallbackValidation(
	targetObj: Record<string, unknown>,
	path: string,
	errors: DocumentDescriptorValidationError[],
): void {
	const requiredTopLevel = [
		'id',
		'title',
		'phase',
		'type',
		'status',
		'purpose',
		'centralQuestion',
		'outputs',
		'sections',
	];

	for (const field of requiredTopLevel) {
		if (!(field in targetObj)) {
			errors.push({
				code: 'E_FIELD_MISSING',
				fieldPath: field,
				message: `Missing required field: ${field}`,
				path,
			});
		}
	}

	if (typeof targetObj.id !== 'string' || targetObj.id.length === 0) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'non-empty string',
			fieldPath: 'id',
			message: 'Expected id to be a non-empty string',
			path,
			received: typeof targetObj.id,
		});
	}

	if (
		targetObj.outputs !== undefined &&
		(targetObj.outputs === null ||
			typeof targetObj.outputs !== 'object' ||
			Array.isArray(targetObj.outputs))
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'object',
			fieldPath: 'outputs',
			message: 'Expected outputs to be an object',
			path,
			received:
				targetObj.outputs === null
					? 'null'
					: Array.isArray(targetObj.outputs)
						? 'array'
						: typeof targetObj.outputs,
		});
	} else if (
		targetObj.outputs !== undefined &&
		!Array.isArray(targetObj.outputs)
	) {
		const outputs = targetObj.outputs as Record<string, unknown>;
		if (
			outputs.canonical === undefined ||
			outputs.canonical === null ||
			typeof outputs.canonical !== 'object' ||
			Array.isArray(outputs.canonical)
		) {
			errors.push({
				code: 'E_FIELD_MISSING',
				fieldPath: 'outputs.canonical',
				message: 'Missing required field: outputs.canonical',
				path,
			});
		} else {
			const canonical = outputs.canonical as Record<string, unknown>;
			if (typeof canonical.path !== 'string' || canonical.path.length === 0) {
				errors.push({
					code: 'E_FIELD_MISSING',
					fieldPath: 'outputs.canonical.path',
					message: 'Missing required field: outputs.canonical.path',
					path,
				});
			}
		}
	}

	if (targetObj.sections !== undefined && !Array.isArray(targetObj.sections)) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'sections',
			message: 'Expected sections to be an array',
			path,
			received: typeof targetObj.sections,
		});
	} else if (Array.isArray(targetObj.sections)) {
		for (let i = 0; i < targetObj.sections.length; i++) {
			const section = targetObj.sections[i];
			if (
				section === null ||
				typeof section !== 'object' ||
				Array.isArray(section)
			) {
				errors.push({
					code: 'E_FIELD_ARRAY_ITEM_TYPE',
					expected: 'object',
					fieldPath: `sections[${i}]`,
					message: `Expected sections[${i}] to be an object`,
					path,
					received:
						section === null
							? 'null'
							: Array.isArray(section)
								? 'array'
								: typeof section,
				});
				continue;
			}
			const sec = section as Record<string, unknown>;
			if (typeof sec.id !== 'string' || sec.id.length === 0) {
				errors.push({
					code: 'E_FIELD_MISSING',
					fieldPath: `sections[${i}].id`,
					message: `Missing required field: sections[${i}].id`,
					path,
				});
			}
			if (typeof sec.title !== 'string' || sec.title.length === 0) {
				errors.push({
					code: 'E_FIELD_MISSING',
					fieldPath: `sections[${i}].title`,
					message: `Missing required field: sections[${i}].title`,
					path,
				});
			}
			if (!Array.isArray(sec.questions)) {
				errors.push({
					code: 'E_FIELD_MISSING',
					fieldPath: `sections[${i}].questions`,
					message: `Missing required field: sections[${i}].questions`,
					path,
				});
			}
		}
	}

	if (
		targetObj.dependsOn !== undefined &&
		!Array.isArray(targetObj.dependsOn)
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'dependsOn',
			message: 'Expected dependsOn to be an array',
			path,
			received: typeof targetObj.dependsOn,
		});
	}

	if (targetObj.feeds !== undefined && !Array.isArray(targetObj.feeds)) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'feeds',
			message: 'Expected feeds to be an array',
			path,
			received: typeof targetObj.feeds,
		});
	}

	if (targetObj.inputs !== undefined && !Array.isArray(targetObj.inputs)) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'inputs',
			message: 'Expected inputs to be an array',
			path,
			received: typeof targetObj.inputs,
		});
	} else if (Array.isArray(targetObj.inputs)) {
		for (let i = 0; i < targetObj.inputs.length; i++) {
			const input = targetObj.inputs[i];
			if (input === null || typeof input !== 'object' || Array.isArray(input)) {
				errors.push({
					code: 'E_FIELD_ARRAY_ITEM_TYPE',
					expected: 'object',
					fieldPath: `inputs[${i}]`,
					message: `Expected inputs[${i}] to be an object`,
					path,
					received:
						input === null
							? 'null'
							: Array.isArray(input)
								? 'array'
								: typeof input,
				});
				continue;
			}
			const inp = input as Record<string, unknown>;
			if (typeof inp.id !== 'string' || inp.id.length === 0) {
				errors.push({
					code: 'E_FIELD_MISSING',
					fieldPath: `inputs[${i}].id`,
					message: `Missing required field: inputs[${i}].id`,
					path,
				});
			}
			if (typeof inp.type !== 'string' || inp.type.length === 0) {
				errors.push({
					code: 'E_FIELD_MISSING',
					fieldPath: `inputs[${i}].type`,
					message: `Missing required field: inputs[${i}].type`,
					path,
				});
			}
		}
	}

	if (
		targetObj.completionCriteria !== undefined &&
		!Array.isArray(targetObj.completionCriteria)
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'completionCriteria',
			message: 'Expected completionCriteria to be an array',
			path,
			received: typeof targetObj.completionCriteria,
		});
	}

	if (
		targetObj.qualityChecks !== undefined &&
		!Array.isArray(targetObj.qualityChecks)
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'qualityChecks',
			message: 'Expected qualityChecks to be an array',
			path,
			received: typeof targetObj.qualityChecks,
		});
	}

	if (
		targetObj.antiPatterns !== undefined &&
		!Array.isArray(targetObj.antiPatterns)
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'antiPatterns',
			message: 'Expected antiPatterns to be an array',
			path,
			received: typeof targetObj.antiPatterns,
		});
	}

	if (
		targetObj.generationRules !== undefined &&
		!Array.isArray(targetObj.generationRules)
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'generationRules',
			message: 'Expected generationRules to be an array',
			path,
			received: typeof targetObj.generationRules,
		});
	}

	if (
		targetObj.reviewRules !== undefined &&
		!Array.isArray(targetObj.reviewRules)
	) {
		errors.push({
			code: 'E_FIELD_TYPE',
			expected: 'array',
			fieldPath: 'reviewRules',
			message: 'Expected reviewRules to be an array',
			path,
			received: typeof targetObj.reviewRules,
		});
	}
}

export async function loadAndValidateDocumentDescriptor(
	path: string,
	options?: DocumentDescriptorValidationOptions,
): Promise<DocumentDescriptor> {
	let rawContent: string;
	try {
		rawContent = readFileSync(path, 'utf-8');
	} catch (_err) {
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_DESCRIPTOR_MISSING_FILE',
				fieldPath: undefined,
				message: `Document descriptor file not found: ${path}`,
				path,
			},
		]);
	}

	let parsed: unknown;
	try {
		parsed = YAML.parse(rawContent);
	} catch (err) {
		const parseError = err instanceof Error ? err.message : String(err);
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_DESCRIPTOR_PARSE_ERROR',
				fieldPath: undefined,
				message: `Failed to parse YAML at ${path}: ${parseError}`,
				path,
			},
		]);
	}

	// Ensure the parsed content contains a `document` wrapper
	if (
		parsed === null ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed) ||
		!('document' in parsed)
	) {
		throw new DocumentDescriptorValidationErrorClass([
			{
				code: 'E_DESCRIPTOR_SHAPE',
				fieldPath: undefined,
				message: `Expected document descriptor file to contain a top-level 'document' key`,
				path,
			},
		]);
	}

	const descriptor = (parsed as Record<string, unknown>).document;

	const schema = options?.schema ?? (await loadDocumentSchema(options));

	const result = validateDocumentDescriptor(descriptor, {
		...options,
		descriptorPath: path,
		schema,
	});
	if (!result.valid) {
		throw new DocumentDescriptorValidationErrorClass(result.errors);
	}

	return descriptor as DocumentDescriptor;
}

export function setDocumentSchemaForValidation(schema: DocumentSchema): void {
	validationSchemaOverride = schema;
}
