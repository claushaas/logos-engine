/** Active Profile Runtime Paths — resolve profile and Executive contract paths from active profile */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkspaceProfileLock } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActiveProfileSource = 'bundled' | 'local' | 'unknown';

export type ActiveProfileContractStatus =
	| 'valid'
	| 'missing'
	| 'invalid'
	| 'unknown';

export type ActiveProfileExecutiveContractStatus =
	| 'available'
	| 'missing'
	| 'invalid'
	| 'unsupported'
	| 'unknown';

export interface ActiveProfileRuntimePaths {
	profileId: string;
	profileVersion: string | undefined;
	source: ActiveProfileSource;
	profileRoot: string;
	registryPath: string;
	documentSchemaPath: string;
	phaseRegistryDirectory: string;
	executiveRoot: string;
	executiveGenerationConfigPath: string;
	executiveSchemaPath: string;
	executiveMappingsDirectory: string;
	executiveTemplatesDirectory: string;
	safeDisplay: {
		profileRoot: string;
		registryPath: string;
		documentSchemaPath: string;
		phaseRegistryDirectory: string;
		executiveRoot: string;
		executiveGenerationConfigPath: string;
		executiveSchemaPath: string;
		executiveMappingsDirectory: string;
		executiveTemplatesDirectory: string;
	};
	contractStatus: ActiveProfileContractStatus;
	executiveContractStatus: ActiveProfileExecutiveContractStatus;
	contractDiagnostics: ActiveProfileDiagnostic[];
	executiveContractDiagnostics: ActiveProfileDiagnostic[];
}

export interface ActiveProfileDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
	expected?: string | undefined;
	received?: string | undefined;
}

export interface ResolveActiveProfileRuntimePathsOptions {
	projectRoot: string;
	profileLock?: WorkspaceProfileLock | undefined;
	profileId?: string | undefined;
	profileRoot?: string | undefined;
	requireExecutive?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic codes
// ---------------------------------------------------------------------------

export const ACTIVE_PROFILE_DIAGNOSTIC_CODES = {
	LOGOS_EXECUTIVE_CONFIG_INVALID: 'LOGOS_EXECUTIVE_CONFIG_INVALID',
	LOGOS_EXECUTIVE_CONFIG_MISSING: 'LOGOS_EXECUTIVE_CONFIG_MISSING',
	LOGOS_EXECUTIVE_CONTRACT_UNSUPPORTED: 'LOGOS_EXECUTIVE_CONTRACT_UNSUPPORTED',
	LOGOS_EXECUTIVE_MAPPINGS_MISSING: 'LOGOS_EXECUTIVE_MAPPINGS_MISSING',
	LOGOS_EXECUTIVE_ROOT_MISSING: 'LOGOS_EXECUTIVE_ROOT_MISSING',
	LOGOS_EXECUTIVE_SCHEMA_INVALID: 'LOGOS_EXECUTIVE_SCHEMA_INVALID',
	LOGOS_EXECUTIVE_SCHEMA_MISSING: 'LOGOS_EXECUTIVE_SCHEMA_MISSING',
	LOGOS_EXECUTIVE_TEMPLATES_MISSING: 'LOGOS_EXECUTIVE_TEMPLATES_MISSING',
	LOGOS_PROFILE_ACTIVE_MISSING: 'LOGOS_PROFILE_ACTIVE_MISSING',
	LOGOS_PROFILE_PHASES_MISSING: 'LOGOS_PROFILE_PHASES_MISSING',
	LOGOS_PROFILE_REGISTRY_INVALID: 'LOGOS_PROFILE_REGISTRY_INVALID',
	LOGOS_PROFILE_REGISTRY_MISSING: 'LOGOS_PROFILE_REGISTRY_MISSING',
	LOGOS_PROFILE_ROOT_UNSAFE: 'LOGOS_PROFILE_ROOT_UNSAFE',
	LOGOS_PROFILE_SCHEMA_MISSING: 'LOGOS_PROFILE_SCHEMA_MISSING',
} as const;

// ---------------------------------------------------------------------------
// Bundled Standard profile root resolution
// ---------------------------------------------------------------------------

function tryResolvePackageRoot(): string | undefined {
	try {
		const modulePath = fileURLToPath(import.meta.url);
		const moduleDir = dirname(modulePath);
		// The compiled module is at dist/profiles/profile-runtime-paths.js.
		// Package root is two levels up from dist/profiles/.
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

/**
 * Resolve the bundled Standard profile root.
 * Works from source checkout, compiled dist, and packaged install.
 */
export function resolveBundledStandardProfileRoot(): string {
	const packageRoot = tryResolvePackageRoot();
	if (packageRoot) {
		return resolve(packageRoot, 'profiles', 'standard');
	}
	// Fallback to process.cwd() for source checkout compatibility
	return resolve(process.cwd(), 'profiles', 'standard');
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function isPathInsideProject(
	pathToCheck: string,
	projectRoot: string,
): boolean {
	const absoluteProject = resolve(projectRoot);
	const absolutePath = resolve(absoluteProject, pathToCheck);
	const rel = relative(absoluteProject, absolutePath);
	if (rel === '' || rel === '.') return true;
	if (rel.startsWith('..')) return false;
	if (isAbsolute(rel)) return false;
	// Also reject path traversal in the normalized path itself
	const normalized = normalize(rel);
	if (normalized.split(sep).includes('..')) return false;
	return true;
}

const sep = /\\/;

function makeSafeDisplayPath(
	absolutePath: string,
	projectRoot: string,
	packageRoot: string | undefined,
): string {
	// Prefer project-relative
	const relProject = relative(projectRoot, absolutePath);
	if (!relProject.startsWith('..') && !isAbsolute(relProject)) {
		return relProject.replace(/\\/g, '/');
	}
	// Prefer package-relative for bundled profiles
	if (packageRoot) {
		const relPackage = relative(packageRoot, absolutePath);
		if (!relPackage.startsWith('..') && !isAbsolute(relPackage)) {
			return relPackage.replace(/\\/g, '/');
		}
	}
	// Fallback: basename only to avoid leaking absolute paths
	const base = absolutePath.split(/[/\\]/).pop() ?? absolutePath;
	return base;
}

// ---------------------------------------------------------------------------
// Contract validation
// ---------------------------------------------------------------------------

function validateProfileContract(
	profileRoot: string,
	projectRoot: string,
): {
	status: ActiveProfileContractStatus;
	diagnostics: ActiveProfileDiagnostic[];
} {
	const diagnostics: ActiveProfileDiagnostic[] = [];
	const registryPath = resolve(profileRoot, 'docs.yml');
	const schemaPath = resolve(profileRoot, 'document.schema.yml');
	const phasesDir = resolve(profileRoot, 'phases');

	if (!existsSync(registryPath)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_REGISTRY_MISSING,
			message: `Profile registry not found: ${makeSafeDisplayPath(registryPath, projectRoot, undefined)}`,
			recoveryHint:
				'Ensure the profile root contains a docs.yml registry file.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(registryPath, projectRoot, undefined),
		});
	}

	if (!existsSync(schemaPath)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_SCHEMA_MISSING,
			message: `Document schema not found: ${makeSafeDisplayPath(schemaPath, projectRoot, undefined)}`,
			recoveryHint:
				'Ensure the profile root contains a document.schema.yml file.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(schemaPath, projectRoot, undefined),
		});
	}

	if (!existsSync(phasesDir)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_PHASES_MISSING,
			message: `Phase registry directory not found: ${makeSafeDisplayPath(phasesDir, projectRoot, undefined)}`,
			recoveryHint: 'Ensure the profile root contains a phases/ directory.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(phasesDir, projectRoot, undefined),
		});
	}

	const status: ActiveProfileContractStatus =
		diagnostics.length === 0 ? 'valid' : 'missing';
	return { diagnostics, status };
}

export function validateExecutiveContract(
	profileRoot: string,
	projectRoot: string,
): {
	status: ActiveProfileExecutiveContractStatus;
	diagnostics: ActiveProfileDiagnostic[];
} {
	const diagnostics: ActiveProfileDiagnostic[] = [];
	const executiveRoot = resolve(profileRoot, 'executive');
	const configPath = resolve(executiveRoot, 'executive-generation.yml');
	const schemaPath = resolve(executiveRoot, 'executive-plan.schema.json');
	const mappingsDir = resolve(executiveRoot, 'mappings');
	const templatesDir = resolve(executiveRoot, 'templates');

	if (!existsSync(executiveRoot)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_ROOT_MISSING,
			message: `Executive root not found: ${makeSafeDisplayPath(executiveRoot, projectRoot, undefined)}`,
			recoveryHint: 'Ensure the profile contains an executive/ directory.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(executiveRoot, projectRoot, undefined),
		});
		return { diagnostics, status: 'missing' };
	}

	if (!existsSync(configPath)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_CONFIG_MISSING,
			message: `Executive generation config not found: ${makeSafeDisplayPath(configPath, projectRoot, undefined)}`,
			recoveryHint:
				'Ensure the profile executive/ directory contains executive-generation.yml.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(configPath, projectRoot, undefined),
		});
	}

	if (!existsSync(schemaPath)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_SCHEMA_MISSING,
			message: `Executive plan schema not found: ${makeSafeDisplayPath(schemaPath, projectRoot, undefined)}`,
			recoveryHint:
				'Ensure the profile executive/ directory contains executive-plan.schema.json.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(schemaPath, projectRoot, undefined),
		});
	}

	if (!existsSync(mappingsDir)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_MAPPINGS_MISSING,
			message: `Executive mappings directory not found: ${makeSafeDisplayPath(mappingsDir, projectRoot, undefined)}`,
			recoveryHint:
				'Ensure the profile executive/ directory contains a mappings/ subdirectory.',
			severity: 'error',
			sourcePath: makeSafeDisplayPath(mappingsDir, projectRoot, undefined),
		});
	}

	if (!existsSync(templatesDir)) {
		diagnostics.push({
			code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_TEMPLATES_MISSING,
			message: `Executive templates directory not found: ${makeSafeDisplayPath(templatesDir, projectRoot, undefined)}`,
			recoveryHint:
				'Ensure the profile executive/ directory contains a templates/ subdirectory.',
			severity: 'warning',
			sourcePath: makeSafeDisplayPath(templatesDir, projectRoot, undefined),
		});
	}

	const status: ActiveProfileExecutiveContractStatus =
		diagnostics.length === 0
			? 'available'
			: diagnostics.some((d) => d.severity === 'error')
				? 'missing'
				: 'invalid';

	return { diagnostics, status };
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export function resolveActiveProfileRuntimePaths(
	options: ResolveActiveProfileRuntimePathsOptions,
): ActiveProfileRuntimePaths {
	const {
		projectRoot,
		profileLock,
		profileId: explicitProfileId,
		profileRoot: explicitProfileRoot,
		requireExecutive = false,
	} = options;

	const packageRoot = tryResolvePackageRoot();
	const resolvedProjectRoot = resolve(projectRoot);

	// Determine profile id, source, and root
	const resolvedProfileId =
		explicitProfileId ?? profileLock?.profileId ?? 'standard';
	let resolvedSource: ActiveProfileSource = 'unknown';
	let resolvedProfileRoot: string;
	const contractDiagnostics: ActiveProfileDiagnostic[] = [];

	if (explicitProfileRoot) {
		// Custom/local profile root
		resolvedProfileRoot = resolve(resolvedProjectRoot, explicitProfileRoot);
		resolvedSource = 'local';

		// Safety check
		if (!isPathInsideProject(explicitProfileRoot, resolvedProjectRoot)) {
			contractDiagnostics.push({
				code: ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_ROOT_UNSAFE,
				message: `Profile root "${explicitProfileRoot}" resolves outside the project root or contains path traversal.`,
				recoveryHint: 'Provide a profile root inside the project directory.',
				severity: 'error',
				sourcePath: explicitProfileRoot,
			});
		}
	} else if (resolvedProfileId === 'standard') {
		// Bundled standard profile
		resolvedProfileRoot = resolveBundledStandardProfileRoot();
		resolvedSource = 'bundled';
	} else if (
		profileLock?.source === 'local' ||
		profileLock?.source === 'custom'
	) {
		// Legacy custom/local from state
		resolvedProfileRoot = profileLock.registryPath
			? resolve(dirname(profileLock.registryPath))
			: resolve(resolvedProjectRoot, 'profiles', resolvedProfileId);
		resolvedSource = 'local';
	} else {
		// Default fallback: try bundled first, then local relative to project
		const bundledRoot = resolveBundledStandardProfileRoot();
		if (resolvedProfileId === 'standard' && existsSync(bundledRoot)) {
			resolvedProfileRoot = bundledRoot;
			resolvedSource = 'bundled';
		} else {
			resolvedProfileRoot = resolve(
				resolvedProjectRoot,
				'profiles',
				resolvedProfileId,
			);
			resolvedSource = existsSync(resolve(resolvedProfileRoot, 'docs.yml'))
				? 'local'
				: 'unknown';
		}
	}

	// Validate core profile contract
	const contractValidation = validateProfileContract(
		resolvedProfileRoot,
		resolvedProjectRoot,
	);
	contractDiagnostics.push(...contractValidation.diagnostics);

	// Validate executive contract when requested
	let executiveValidation: ReturnType<typeof validateExecutiveContract> = {
		diagnostics: [],
		status: 'unknown',
	};
	if (requireExecutive) {
		executiveValidation = validateExecutiveContract(
			resolvedProfileRoot,
			resolvedProjectRoot,
		);
	}

	// Build paths
	const registryPath = resolve(resolvedProfileRoot, 'docs.yml');
	const documentSchemaPath = resolve(
		resolvedProfileRoot,
		'document.schema.yml',
	);
	const phaseRegistryDirectory = resolve(resolvedProfileRoot, 'phases');
	const executiveRoot = resolve(resolvedProfileRoot, 'executive');
	const executiveGenerationConfigPath = resolve(
		executiveRoot,
		'executive-generation.yml',
	);
	const executiveSchemaPath = resolve(
		executiveRoot,
		'executive-plan.schema.json',
	);
	const executiveMappingsDirectory = resolve(executiveRoot, 'mappings');
	const executiveTemplatesDirectory = resolve(executiveRoot, 'templates');

	const safeDisplay = {
		documentSchemaPath: makeSafeDisplayPath(
			documentSchemaPath,
			resolvedProjectRoot,
			packageRoot,
		),
		executiveGenerationConfigPath: makeSafeDisplayPath(
			executiveGenerationConfigPath,
			resolvedProjectRoot,
			packageRoot,
		),
		executiveMappingsDirectory: makeSafeDisplayPath(
			executiveMappingsDirectory,
			resolvedProjectRoot,
			packageRoot,
		),
		executiveRoot: makeSafeDisplayPath(
			executiveRoot,
			resolvedProjectRoot,
			packageRoot,
		),
		executiveSchemaPath: makeSafeDisplayPath(
			executiveSchemaPath,
			resolvedProjectRoot,
			packageRoot,
		),
		executiveTemplatesDirectory: makeSafeDisplayPath(
			executiveTemplatesDirectory,
			resolvedProjectRoot,
			packageRoot,
		),
		phaseRegistryDirectory: makeSafeDisplayPath(
			phaseRegistryDirectory,
			resolvedProjectRoot,
			packageRoot,
		),
		profileRoot: makeSafeDisplayPath(
			resolvedProfileRoot,
			resolvedProjectRoot,
			packageRoot,
		),
		registryPath: makeSafeDisplayPath(
			registryPath,
			resolvedProjectRoot,
			packageRoot,
		),
	};

	return {
		contractDiagnostics,
		contractStatus: contractValidation.status,
		documentSchemaPath,
		executiveContractDiagnostics: executiveValidation.diagnostics,
		executiveContractStatus: executiveValidation.status,
		executiveGenerationConfigPath,
		executiveMappingsDirectory,
		executiveRoot,
		executiveSchemaPath,
		executiveTemplatesDirectory,
		phaseRegistryDirectory,
		profileId: resolvedProfileId,
		profileRoot: resolvedProfileRoot,
		profileVersion: profileLock?.profileVersion,
		registryPath,
		safeDisplay,
		source: resolvedSource,
	};
}
