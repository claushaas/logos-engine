import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export type ProfileId = string;

export interface ProfileRegistryPaths {
	profileRoot: string;
	registryPath: string;
	phaseRegistryDirectory: string;
}

export interface ProfileAxis {
	id: string;
	title: string;
	description: string;
	phases: string[] | undefined;
	artifacts: string[] | undefined;
}

export interface ProfilePhaseRegistryEntry {
	id: string;
	path: string;
	required: boolean;
}

export interface ProfilePhaseRegistry {
	directory: string;
	files: ProfilePhaseRegistryEntry[];
}

export interface ProfileOutputModelEntry {
	format: string;
	role: string;
	editable: boolean;
	regenerationRule: string | undefined;
}

export interface ProfileOutputModel {
	structure: ProfileOutputModelEntry;
	canonical: ProfileOutputModelEntry;
	presentation: ProfileOutputModelEntry;
	agentPacks: ProfileOutputModelEntry;
}

export interface ProfileGlobalRules {
	questionsLocation: string;
	yamlRole: string;
	markdownRole: string;
	htmlRole: string;
	agentPackRole: string;
	boundaryRule: string;
	traceabilityRule: string;
	assumptionRule: string;
	decisionRule: string;
	antiDuplicationRule: string;
	regenerationRule: string;
}

export interface ProfileStatusWorkflow {
	allowed: string[];
	terminal: string[];
	transitions: Record<string, string[]>;
}

export interface ProfileQualityModel {
	requiredChecks: string[];
	failurePolicy: Record<string, string>;
}

export interface ProfileDependencyPolicy {
	missingRequiredInput: string;
	missingOptionalInput: string;
	circularDependency: string;
	staleDependency: string;
	crossPhaseDependency: string;
}

export interface ProfileAgentPolicy {
	defaultMode: string;
	rules: string[];
	requiredAgentOutputs: string[];
}

export interface ProfileRoadmapIntegration {
	enabled: boolean;
	role: string;
	sources: string[];
	outputs: string[];
}

export interface ProfileRegistry {
	id: ProfileId;
	schemaVersion: number;
	contentVersion: string;
	registryType: string;
	project: {
		id: string;
		title: string;
		purpose: string;
	};
	documentationSystem: {
		id: string;
		title: string;
		purpose: string;
	};
	axes: ProfileAxis[];
	phaseDefinitions: Record<string, { purpose: string }>;
	phaseRegistry: ProfilePhaseRegistry;
	outputModel: ProfileOutputModel;
	globalRules: ProfileGlobalRules;
	statusWorkflow: ProfileStatusWorkflow;
	qualityModel: ProfileQualityModel;
	dependencyPolicy: ProfileDependencyPolicy;
	agentPolicy: ProfileAgentPolicy;
	roadmapIntegration: ProfileRoadmapIntegration;
	paths: ProfileRegistryPaths;
}

export interface ProfileRegistryDiagnostic {
	code: string;
	message: string;
	path: string;
	fieldPath: string | undefined;
}

export class ProfileRegistryError extends Error {
	diagnostics: ProfileRegistryDiagnostic[];

	constructor(diagnostics: ProfileRegistryDiagnostic[]) {
		super(diagnostics.map((d) => d.message).join('; '));
		this.diagnostics = diagnostics;
		this.name = 'ProfileRegistryError';
	}
}

export interface LoadProfileRegistryOptions {
	profileId?: ProfileId;
	repoRoot?: string;
	profileRoot?: string;
	useDefault?: boolean;
}

function assertField(
	condition: boolean,
	diagnostics: ProfileRegistryDiagnostic[],
	code: string,
	message: string,
	path: string,
	fieldPath: string | undefined,
): void {
	if (!condition) {
		diagnostics.push({ code, fieldPath, message, path });
	}
}

function assertString(
	value: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
	fieldPath: string,
): void {
	assertField(
		typeof value === 'string' && value.length > 0,
		diagnostics,
		'E_PROFILE_FIELD_TYPE',
		`Expected ${fieldPath} to be a non-empty string`,
		path,
		fieldPath,
	);
}

function assertObject(
	value: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
	fieldPath: string,
): value is Record<string, unknown> {
	const isObj =
		value !== null && typeof value === 'object' && !Array.isArray(value);
	if (!isObj) {
		diagnostics.push({
			code: 'E_PROFILE_FIELD_TYPE',
			fieldPath,
			message: `Expected ${fieldPath} to be an object`,
			path,
		});
	}
	return isObj;
}

function assertArray(
	value: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
	fieldPath: string,
): value is unknown[] {
	const isArr = Array.isArray(value);
	if (!isArr) {
		diagnostics.push({
			code: 'E_PROFILE_FIELD_TYPE',
			fieldPath,
			message: `Expected ${fieldPath} to be an array`,
			path,
		});
	}
	return isArr;
}

function validateStringArray(
	value: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
	fieldPath: string,
	options: { allowEmpty?: boolean } = {},
): string[] {
	if (!assertArray(value, diagnostics, path, fieldPath)) {
		return [];
	}

	if (options.allowEmpty !== true && value.length === 0) {
		diagnostics.push({
			code: 'E_PROFILE_EMPTY_ARRAY',
			fieldPath,
			message: `${fieldPath} must not be empty`,
			path,
		});
	}

	const result: string[] = [];
	for (let i = 0; i < value.length; i++) {
		const item = value[i];
		if (typeof item !== 'string' || item.length === 0) {
			diagnostics.push({
				code: 'E_PROFILE_FIELD_TYPE',
				fieldPath: `${fieldPath}[${i}]`,
				message: `Expected ${fieldPath}[${i}] to be a non-empty string`,
				path,
			});
			continue;
		}
		result.push(item);
	}

	return result;
}

function validateAxes(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileAxis[] {
	if (!assertArray(raw, diagnostics, path, 'axes')) {
		return [];
	}

	const axes: ProfileAxis[] = [];
	for (let i = 0; i < raw.length; i++) {
		const axis = raw[i];
		if (!assertObject(axis, diagnostics, path, `axes[${i}]`)) {
			continue;
		}
		assertString(axis.id, diagnostics, path, `axes[${i}].id`);
		assertString(axis.title, diagnostics, path, `axes[${i}].title`);
		assertString(axis.description, diagnostics, path, `axes[${i}].description`);

		const phases =
			axis.phases !== undefined
				? validateStringArray(
						axis.phases,
						diagnostics,
						path,
						`axes[${i}].phases`,
						{ allowEmpty: true },
					)
				: undefined;
		const artifacts =
			axis.artifacts !== undefined
				? validateStringArray(
						axis.artifacts,
						diagnostics,
						path,
						`axes[${i}].artifacts`,
						{ allowEmpty: true },
					)
				: undefined;

		axes.push({
			artifacts,
			description: String(axis.description ?? ''),
			id: String(axis.id ?? `axis-${i}`),
			phases,
			title: String(axis.title ?? ''),
		});
	}
	return axes;
}

function validatePhaseRegistry(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfilePhaseRegistry {
	if (!assertObject(raw, diagnostics, path, 'phaseRegistry')) {
		return { directory: '', files: [] };
	}

	assertString(raw.directory, diagnostics, path, 'phaseRegistry.directory');

	const filesRaw = raw.files;
	const files: ProfilePhaseRegistryEntry[] = [];
	if (assertArray(filesRaw, diagnostics, path, 'phaseRegistry.files')) {
		for (let i = 0; i < filesRaw.length; i++) {
			const entry = filesRaw[i];
			if (
				!assertObject(entry, diagnostics, path, `phaseRegistry.files[${i}]`)
			) {
				continue;
			}
			assertString(entry.id, diagnostics, path, `phaseRegistry.files[${i}].id`);
			assertString(
				entry.path,
				diagnostics,
				path,
				`phaseRegistry.files[${i}].path`,
			);
			const required = entry.required;
			if (typeof required !== 'boolean') {
				diagnostics.push({
					code: 'E_PROFILE_FIELD_TYPE',
					fieldPath: `phaseRegistry.files[${i}].required`,
					message: `Expected phaseRegistry.files[${i}].required to be a boolean`,
					path,
				});
			}
			files.push({
				id: String(entry.id ?? ''),
				path: String(entry.path ?? ''),
				required: Boolean(required),
			});
		}
	}

	return {
		directory: String(raw.directory ?? ''),
		files,
	};
}

function validateOutputModel(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileOutputModel {
	if (!assertObject(raw, diagnostics, path, 'outputModel')) {
		return {
			agentPacks: {
				editable: false,
				format: '',
				regenerationRule: undefined,
				role: '',
			},
			canonical: {
				editable: false,
				format: '',
				regenerationRule: undefined,
				role: '',
			},
			presentation: {
				editable: false,
				format: '',
				regenerationRule: undefined,
				role: '',
			},
			structure: {
				editable: false,
				format: '',
				regenerationRule: undefined,
				role: '',
			},
		};
	}

	const entries: (keyof ProfileOutputModel)[] = [
		'structure',
		'canonical',
		'presentation',
		'agentPacks',
	];
	const result = {} as Record<
		keyof ProfileOutputModel,
		ProfileOutputModelEntry
	>;
	for (const key of entries) {
		const entryRaw = raw[key];
		if (!assertObject(entryRaw, diagnostics, path, `outputModel.${key}`)) {
			result[key] = {
				editable: false,
				format: '',
				regenerationRule: undefined,
				role: '',
			};
			continue;
		}
		assertString(
			entryRaw.format,
			diagnostics,
			path,
			`outputModel.${key}.format`,
		);
		assertString(entryRaw.role, diagnostics, path, `outputModel.${key}.role`);
		const editable = entryRaw.editable;
		if (typeof editable !== 'boolean') {
			diagnostics.push({
				code: 'E_PROFILE_FIELD_TYPE',
				fieldPath: `outputModel.${key}.editable`,
				message: `Expected outputModel.${key}.editable to be a boolean`,
				path,
			});
		}
		result[key] = {
			editable: Boolean(editable),
			format: String(entryRaw.format ?? ''),
			regenerationRule: entryRaw.regenerationRule as string | undefined,
			role: String(entryRaw.role ?? ''),
		};
	}
	return {
		agentPacks: result.agentPacks,
		canonical: result.canonical,
		presentation: result.presentation,
		structure: result.structure,
	};
}

function validateGlobalRules(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileGlobalRules {
	if (!assertObject(raw, diagnostics, path, 'globalRules')) {
		return {
			agentPackRole: '',
			antiDuplicationRule: '',
			assumptionRule: '',
			boundaryRule: '',
			decisionRule: '',
			htmlRole: '',
			markdownRole: '',
			questionsLocation: '',
			regenerationRule: '',
			traceabilityRule: '',
			yamlRole: '',
		};
	}

	const requiredFields: (keyof ProfileGlobalRules)[] = [
		'questionsLocation',
		'yamlRole',
		'markdownRole',
		'htmlRole',
		'agentPackRole',
		'boundaryRule',
		'traceabilityRule',
		'assumptionRule',
		'decisionRule',
		'antiDuplicationRule',
		'regenerationRule',
	];

	for (const field of requiredFields) {
		assertString(raw[field], diagnostics, path, `globalRules.${field}`);
	}

	return {
		agentPackRole: String(raw.agentPackRole ?? ''),
		antiDuplicationRule: String(raw.antiDuplicationRule ?? ''),
		assumptionRule: String(raw.assumptionRule ?? ''),
		boundaryRule: String(raw.boundaryRule ?? ''),
		decisionRule: String(raw.decisionRule ?? ''),
		htmlRole: String(raw.htmlRole ?? ''),
		markdownRole: String(raw.markdownRole ?? ''),
		questionsLocation: String(raw.questionsLocation ?? ''),
		regenerationRule: String(raw.regenerationRule ?? ''),
		traceabilityRule: String(raw.traceabilityRule ?? ''),
		yamlRole: String(raw.yamlRole ?? ''),
	};
}

function validateStatusWorkflow(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileStatusWorkflow {
	if (!assertObject(raw, diagnostics, path, 'statusWorkflow')) {
		return { allowed: [], terminal: [], transitions: {} };
	}

	if (!Array.isArray(raw.allowed)) {
		assertArray(raw.allowed, diagnostics, path, 'statusWorkflow.allowed');
		return { allowed: [], terminal: [], transitions: {} };
	}
	const allowed = validateStringArray(
		raw.allowed,
		diagnostics,
		path,
		'statusWorkflow.allowed',
	);
	if (allowed.length === 0) {
		diagnostics.push({
			code: 'E_PROFILE_EMPTY_ARRAY',
			fieldPath: 'statusWorkflow.allowed',
			message: 'statusWorkflow.allowed must not be empty',
			path,
		});
	}

	if (!Array.isArray(raw.terminal)) {
		assertArray(raw.terminal, diagnostics, path, 'statusWorkflow.terminal');
		return { allowed, terminal: [], transitions: {} };
	}
	const terminal = validateStringArray(
		raw.terminal,
		diagnostics,
		path,
		'statusWorkflow.terminal',
		{ allowEmpty: true },
	);
	const allowedSet = new Set(allowed);
	for (let i = 0; i < terminal.length; i++) {
		const status = terminal[i];
		if (status !== undefined && !allowedSet.has(status)) {
			diagnostics.push({
				code: 'E_PROFILE_DISALLOWED_VALUE',
				fieldPath: `statusWorkflow.terminal[${i}]`,
				message: `Expected statusWorkflow.terminal[${i}] to be listed in statusWorkflow.allowed`,
				path,
			});
		}
	}

	const transitions = raw.transitions;
	if (
		!assertObject(transitions, diagnostics, path, 'statusWorkflow.transitions')
	) {
		return {
			allowed,
			terminal,
			transitions: {},
		};
	}
	const normalizedTransitions: Record<string, string[]> = {};
	for (const [from, rawTargets] of Object.entries(transitions)) {
		if (!allowedSet.has(from)) {
			diagnostics.push({
				code: 'E_PROFILE_DISALLOWED_VALUE',
				fieldPath: `statusWorkflow.transitions.${from}`,
				message: `Expected statusWorkflow.transitions.${from} to reference an allowed source status`,
				path,
			});
		}
		const targets = validateStringArray(
			rawTargets,
			diagnostics,
			path,
			`statusWorkflow.transitions.${from}`,
			{ allowEmpty: true },
		);
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			if (target !== undefined && !allowedSet.has(target)) {
				diagnostics.push({
					code: 'E_PROFILE_DISALLOWED_VALUE',
					fieldPath: `statusWorkflow.transitions.${from}[${i}]`,
					message: `Expected statusWorkflow.transitions.${from}[${i}] to reference an allowed target status`,
					path,
				});
			}
		}
		normalizedTransitions[from] = targets;
	}

	return {
		allowed,
		terminal,
		transitions: normalizedTransitions,
	};
}

function validateQualityModel(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileQualityModel {
	if (!assertObject(raw, diagnostics, path, 'qualityModel')) {
		return { failurePolicy: {}, requiredChecks: [] };
	}

	const requiredChecks = raw.requiredChecks;
	if (
		!assertArray(
			requiredChecks,
			diagnostics,
			path,
			'qualityModel.requiredChecks',
		)
	) {
		return { failurePolicy: {}, requiredChecks: [] };
	}

	const failurePolicy = raw.failurePolicy;
	if (
		!assertObject(
			failurePolicy,
			diagnostics,
			path,
			'qualityModel.failurePolicy',
		)
	) {
		return { failurePolicy: {}, requiredChecks: requiredChecks as string[] };
	}

	return {
		failurePolicy: failurePolicy as Record<string, string>,
		requiredChecks: requiredChecks as string[],
	};
}

function validateDependencyPolicy(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileDependencyPolicy {
	if (!assertObject(raw, diagnostics, path, 'dependencyPolicy')) {
		return {
			circularDependency: '',
			crossPhaseDependency: '',
			missingOptionalInput: '',
			missingRequiredInput: '',
			staleDependency: '',
		};
	}

	const requiredFields: (keyof ProfileDependencyPolicy)[] = [
		'missingRequiredInput',
		'missingOptionalInput',
		'circularDependency',
		'staleDependency',
		'crossPhaseDependency',
	];

	for (const field of requiredFields) {
		assertString(raw[field], diagnostics, path, `dependencyPolicy.${field}`);
	}

	return {
		circularDependency: String(raw.circularDependency ?? ''),
		crossPhaseDependency: String(raw.crossPhaseDependency ?? ''),
		missingOptionalInput: String(raw.missingOptionalInput ?? ''),
		missingRequiredInput: String(raw.missingRequiredInput ?? ''),
		staleDependency: String(raw.staleDependency ?? ''),
	};
}

function validateAgentPolicy(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileAgentPolicy {
	if (!assertObject(raw, diagnostics, path, 'agentPolicy')) {
		return { defaultMode: '', requiredAgentOutputs: [], rules: [] };
	}

	assertString(raw.defaultMode, diagnostics, path, 'agentPolicy.defaultMode');

	const rules = raw.rules;
	if (!assertArray(rules, diagnostics, path, 'agentPolicy.rules')) {
		return {
			defaultMode: String(raw.defaultMode ?? ''),
			requiredAgentOutputs: [],
			rules: [],
		};
	}

	const requiredAgentOutputs = raw.requiredAgentOutputs;
	if (
		!assertArray(
			requiredAgentOutputs,
			diagnostics,
			path,
			'agentPolicy.requiredAgentOutputs',
		)
	) {
		return {
			defaultMode: String(raw.defaultMode ?? ''),
			requiredAgentOutputs: [],
			rules: rules as string[],
		};
	}

	return {
		defaultMode: String(raw.defaultMode ?? ''),
		requiredAgentOutputs: requiredAgentOutputs as string[],
		rules: rules as string[],
	};
}

function validateRoadmapIntegration(
	raw: unknown,
	diagnostics: ProfileRegistryDiagnostic[],
	path: string,
): ProfileRoadmapIntegration {
	if (!assertObject(raw, diagnostics, path, 'roadmapIntegration')) {
		return { enabled: false, outputs: [], role: '', sources: [] };
	}

	const enabled = raw.enabled;
	if (typeof enabled !== 'boolean') {
		diagnostics.push({
			code: 'E_PROFILE_FIELD_TYPE',
			fieldPath: 'roadmapIntegration.enabled',
			message: 'Expected roadmapIntegration.enabled to be a boolean',
			path,
		});
	}

	assertString(raw.role, diagnostics, path, 'roadmapIntegration.role');

	const sources = raw.sources;
	if (!assertArray(sources, diagnostics, path, 'roadmapIntegration.sources')) {
		return {
			enabled: Boolean(enabled),
			outputs: [],
			role: String(raw.role ?? ''),
			sources: [],
		};
	}

	const outputs = raw.outputs;
	if (!assertArray(outputs, diagnostics, path, 'roadmapIntegration.outputs')) {
		return {
			enabled: Boolean(enabled),
			outputs: [],
			role: String(raw.role ?? ''),
			sources: sources as string[],
		};
	}

	return {
		enabled: Boolean(enabled),
		outputs: outputs as string[],
		role: String(raw.role ?? ''),
		sources: sources as string[],
	};
}

export function validateProfileRegistry(
	id: ProfileId,
	raw: unknown,
	registryPath: string,
	profileRoot: string,
): ProfileRegistry {
	const diagnostics: ProfileRegistryDiagnostic[] = [];

	if (!assertObject(raw, diagnostics, registryPath, 'registry root')) {
		throw new ProfileRegistryError(diagnostics);
	}

	assertField(
		typeof raw.schemaVersion === 'number',
		diagnostics,
		'E_PROFILE_FIELD_TYPE',
		'Expected schemaVersion to be a number',
		registryPath,
		'schemaVersion',
	);

	assertString(raw.contentVersion, diagnostics, registryPath, 'contentVersion');
	assertString(raw.registryType, diagnostics, registryPath, 'registryType');

	const project = raw.project as Record<string, unknown>;
	if (assertObject(project, diagnostics, registryPath, 'project')) {
		assertString(project.id, diagnostics, registryPath, 'project.id');
		assertString(project.title, diagnostics, registryPath, 'project.title');
		assertString(project.purpose, diagnostics, registryPath, 'project.purpose');
	}

	const documentationSystem = raw.documentationSystem as Record<
		string,
		unknown
	>;
	if (
		assertObject(
			documentationSystem,
			diagnostics,
			registryPath,
			'documentationSystem',
		)
	) {
		assertString(
			documentationSystem.id,
			diagnostics,
			registryPath,
			'documentationSystem.id',
		);
		assertString(
			documentationSystem.title,
			diagnostics,
			registryPath,
			'documentationSystem.title',
		);
		assertString(
			documentationSystem.purpose,
			diagnostics,
			registryPath,
			'documentationSystem.purpose',
		);
	}

	const axes = validateAxes(raw.axes, diagnostics, registryPath);

	const phaseDefinitionsRaw = raw.phaseDefinitions;
	const phaseDefinitions: Record<string, { purpose: string }> = {};
	if (
		assertObject(
			phaseDefinitionsRaw,
			diagnostics,
			registryPath,
			'phaseDefinitions',
		)
	) {
		for (const [key, value] of Object.entries(phaseDefinitionsRaw)) {
			if (
				assertObject(
					value,
					diagnostics,
					registryPath,
					`phaseDefinitions.${key}`,
				)
			) {
				assertString(
					value.purpose,
					diagnostics,
					registryPath,
					`phaseDefinitions.${key}.purpose`,
				);
				phaseDefinitions[key] = { purpose: String(value.purpose ?? '') };
			}
		}
	}

	const phaseRegistry = validatePhaseRegistry(
		raw.phaseRegistry,
		diagnostics,
		registryPath,
	);
	assertField(
		phaseRegistry.files.length > 0,
		diagnostics,
		'E_PROFILE_EMPTY_ARRAY',
		'phaseRegistry.files must not be empty',
		registryPath,
		'phaseRegistry.files',
	);

	const outputModel = validateOutputModel(
		raw.outputModel,
		diagnostics,
		registryPath,
	);
	const globalRules = validateGlobalRules(
		raw.globalRules,
		diagnostics,
		registryPath,
	);
	const statusWorkflow = validateStatusWorkflow(
		raw.statusWorkflow,
		diagnostics,
		registryPath,
	);
	const qualityModel = validateQualityModel(
		raw.qualityModel,
		diagnostics,
		registryPath,
	);
	const dependencyPolicy = validateDependencyPolicy(
		raw.dependencyPolicy,
		diagnostics,
		registryPath,
	);
	const agentPolicy = validateAgentPolicy(
		raw.agentPolicy,
		diagnostics,
		registryPath,
	);
	const roadmapIntegration = validateRoadmapIntegration(
		raw.roadmapIntegration,
		diagnostics,
		registryPath,
	);

	if (diagnostics.length > 0) {
		throw new ProfileRegistryError(diagnostics);
	}

	return {
		agentPolicy,
		axes,
		contentVersion: String(raw.contentVersion),
		dependencyPolicy,
		documentationSystem: {
			id: String(documentationSystem.id),
			purpose: String(documentationSystem.purpose),
			title: String(documentationSystem.title),
		},
		globalRules,
		id,
		outputModel,
		paths: {
			phaseRegistryDirectory: resolve(profileRoot, phaseRegistry.directory),
			profileRoot,
			registryPath,
		},
		phaseDefinitions,
		phaseRegistry,
		project: {
			id: String(project.id),
			purpose: String(project.purpose),
			title: String(project.title),
		},
		qualityModel,
		registryType: String(raw.registryType),
		roadmapIntegration,
		schemaVersion: Number(raw.schemaVersion),
		statusWorkflow,
	};
}

function tryResolvePackageRoot(): string | undefined {
	try {
		const modulePath = fileURLToPath(import.meta.url);
		const moduleDir = dirname(modulePath);
		// The compiled module is at dist/profiles/profile-registry.js.
		// Package root is two levels up from dist/profiles/ (i.e. dist/../..).
		const candidate = resolve(moduleDir, '../..');
		if (existsSync(resolve(candidate, 'profiles', 'standard', 'docs.yml'))) {
			return candidate;
		}
		// Fallback: walk up looking for the profile marker
		let current = moduleDir;
		for (let i = 0; i < 6; i++) {
			const parent = dirname(current);
			if (parent === current) break;
			current = parent;
			if (existsSync(resolve(current, 'profiles', 'standard', 'docs.yml'))) {
				return current;
			}
		}
	} catch {
		// ignore
	}
	return undefined;
}

export async function loadProfileRegistry(
	options: LoadProfileRegistryOptions = {},
): Promise<ProfileRegistry> {
	const {
		profileId,
		profileRoot: explicitProfileRoot,
		repoRoot,
		useDefault,
	} = options;

	let resolvedProfileRoot: string;
	let resolvedProfileId: ProfileId;

	if (explicitProfileRoot) {
		resolvedProfileRoot = resolve(explicitProfileRoot);
		resolvedProfileId = profileId ?? 'custom';
	} else if (profileId && repoRoot) {
		resolvedProfileRoot = resolve(repoRoot, 'profiles', profileId);
		resolvedProfileId = profileId;
	} else if (useDefault) {
		resolvedProfileRoot = resolve(process.cwd(), 'profiles', 'standard');
		resolvedProfileId = 'standard';
	} else if (profileId) {
		resolvedProfileRoot = resolve(process.cwd(), 'profiles', profileId);
		resolvedProfileId = profileId;
	} else {
		throw new ProfileRegistryError([
			{
				code: 'E_PROFILE_MISSING_OPTIONS',
				fieldPath: undefined,
				message:
					'Must provide profileRoot, or profileId (with optional repoRoot), or set useDefault to true',
				path: '<options>',
			},
		]);
	}

	let registryPath = resolve(resolvedProfileRoot, 'docs.yml');

	let rawContent: string;
	try {
		rawContent = readFileSync(registryPath, 'utf-8');
	} catch (error) {
		// Fallback for bundled profiles: try resolving from the package installation directory
		const packageRoot = tryResolvePackageRoot();
		if (packageRoot) {
			const fallbackRoot = resolve(packageRoot, 'profiles', resolvedProfileId);
			const fallbackPath = resolve(fallbackRoot, 'docs.yml');
			if (existsSync(fallbackPath)) {
				resolvedProfileRoot = fallbackRoot;
				registryPath = fallbackPath;
				try {
					rawContent = readFileSync(registryPath, 'utf-8');
				} catch (fallbackError) {
					const errorMessage =
						fallbackError instanceof Error
							? fallbackError.message
							: String(fallbackError);
					throw new ProfileRegistryError([
						{
							code: 'E_PROFILE_MISSING_FILE',
							fieldPath: undefined,
							message: `Profile registry file not found: ${registryPath} — ${errorMessage}`,
							path: registryPath,
						},
					]);
				}
			} else {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				throw new ProfileRegistryError([
					{
						code: 'E_PROFILE_MISSING_FILE',
						fieldPath: undefined,
						message: `Profile registry file not found: ${registryPath} — ${errorMessage}`,
						path: registryPath,
					},
				]);
			}
		} else {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new ProfileRegistryError([
				{
					code: 'E_PROFILE_MISSING_FILE',
					fieldPath: undefined,
					message: `Profile registry file not found: ${registryPath} — ${errorMessage}`,
					path: registryPath,
				},
			]);
		}
	}

	let parsed: unknown;
	try {
		parsed = YAML.parse(rawContent);
	} catch (err) {
		const parseError = err instanceof Error ? err.message : String(err);
		throw new ProfileRegistryError([
			{
				code: 'E_PROFILE_PARSE_ERROR',
				fieldPath: undefined,
				message: `Failed to parse YAML at ${registryPath}: ${parseError}`,
				path: registryPath,
			},
		]);
	}

	return validateProfileRegistry(
		resolvedProfileId,
		parsed,
		registryPath,
		resolvedProfileRoot,
	);
}
