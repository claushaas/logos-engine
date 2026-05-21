/** Active Profile Runtime Paths tests */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ACTIVE_PROFILE_DIAGNOSTIC_CODES,
	type ActiveProfileRuntimePaths,
	resolveActiveProfileRuntimePaths,
	resolveBundledStandardProfileRoot,
	validateExecutiveContract,
} from '../src/profiles/profile-runtime-paths.js';

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-profile-paths-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanupTempDir(dir: string): void {
	try {
		rmSync(dir, { force: true, recursive: true });
	} catch {
		// best effort
	}
}

function createMinimalProfile(
	dir: string,
	profileName: string,
	includeExecutive = false,
): string {
	const profileDir = join(dir, profileName);
	mkdirSync(join(profileDir, 'phases'), { recursive: true });

	writeFileSync(
		join(profileDir, 'docs.yml'),
		`schemaVersion: 1
contentVersion: '1.0.0'
registryType: 'documentation-system'
project:
  id: '${profileName}'
  title: '${profileName} Profile'
  purpose: 'Test profile'
documentationSystem:
  id: '${profileName}-docs'
  title: '${profileName} Docs'
  purpose: 'Test'
axes:
  - id: '${profileName}-axis'
    title: '${profileName} Axis'
    description: 'Test axis'
    phases:
      - '01-foundation'
phaseDefinitions:
  '01-foundation':
    purpose: 'Foundation'
phaseRegistry:
  directory: 'phases'
  files:
    - id: '01-foundation'
      path: '01-foundation.yml'
      required: true
outputModel:
  structure:
    format: 'yml'
    role: 'registry'
    editable: false
    regenerationRule: 'manual'
  canonical:
    format: 'md'
    role: 'canonical'
    editable: true
    regenerationRule: 'on-demand'
  presentation:
    format: 'html'
    role: 'presentation'
    editable: false
    regenerationRule: 'on-demand'
  agentPacks:
    format: 'md'
    role: 'agent-pack'
    editable: false
    regenerationRule: 'on-demand'
globalRules:
  questionsLocation: 'document-descriptors'
  yamlRole: 'structure'
  markdownRole: 'canonical'
  htmlRole: 'presentation'
  agentPackRole: 'agent-pack'
  boundaryRule: 'local-only'
  traceabilityRule: 'required'
  assumptionRule: 'visible'
  decisionRule: 'confirmed-only'
  antiDuplicationRule: 'strict'
  regenerationRule: 'safe'
statusWorkflow:
  allowed:
    - draft
    - review
    - current
  terminal:
    - current
  transitions:
    draft:
      - review
    review:
      - current
      - draft
    current:
      - draft
qualityModel:
  requiredChecks:
    - presence
  failurePolicy:
    presence: 'block'
dependencyPolicy:
  missingRequiredInput: 'block'
  missingOptionalInput: 'warn'
  circularDependency: 'block'
  staleDependency: 'warn'
  crossPhaseDependency: 'warn'
agentPolicy:
  defaultMode: 'assist'
  rules:
    - 'no-auto-confirm'
  requiredAgentOutputs: []
roadmapIntegration:
  enabled: false
  role: 'reference'
  sources: []
  outputs: []
`,
	);

	writeFileSync(
		join(profileDir, 'document.schema.yml'),
		`documentSchema:
  version: '1.0.0'
  requiredFields:
    - id
  statusValues:
    - draft
  outputs:
    canonical:
      format: markdown
      pathPattern: '{phase}/{documentId}.md'
  sections:
    - id: purpose
      required: false
  qualityChecks: []
  antiPatterns: []
`,
	);

	writeFileSync(
		join(profileDir, 'phases', '01-foundation.yml'),
		`phase:
  id: '01-foundation'
  title: 'Foundation'
  order: 0
  axis: '${profileName}-axis'
  status: 'current'
  description: 'Foundation phase'
  purpose: 'Establish foundation'
  responsibilityBoundary:
    scope: 'test'
  dependsOn: []
  feedsInto: []
  readingOrder: []
  completionCriteria: []
  qualityChecks: []
  generatedOutputs: {}
  documents:
    - id: 'test-doc'
      title: 'Test Document'
      file: 'phases/01-foundation.yml'
      required: true
`,
	);

	if (includeExecutive) {
		mkdirSync(join(profileDir, 'executive', 'mappings'), { recursive: true });
		mkdirSync(join(profileDir, 'executive', 'templates'), { recursive: true });

		writeFileSync(
			join(profileDir, 'executive', 'executive-generation.yml'),
			`version: '1.0.0'
readinessGate:
  requiredStatus: 'current'
  allowDraftGeneration: false
  allowExportWhenDraft: false
exports:
  targets:
    markdown:
      enabled: true
`,
		);

		writeFileSync(
			join(profileDir, 'executive', 'executive-plan.schema.json'),
			JSON.stringify({
				properties: {
					id: { type: 'string' },
					version: { type: 'string' },
				},
				required: ['id', 'version'],
				type: 'object',
			}),
		);

		writeFileSync(
			join(profileDir, 'executive', 'mappings', 'markdown.mapping.yml'),
			'id: markdown\nversion: 1.0.0\nstatus: supported\n',
		);

		writeFileSync(
			join(profileDir, 'executive', 'templates', 'agent-task.md'),
			'# Test Template\n',
		);
	}

	return profileDir;
}

// ---------------------------------------------------------------------------
// Bundled Standard profile resolution
// ---------------------------------------------------------------------------

describe('resolveBundledStandardProfileRoot', () => {
	it('returns a path that contains profiles/standard', () => {
		const root = resolveBundledStandardProfileRoot();
		expect(root).toContain('profiles/standard');
	});

	it('profile root includes docs.yml registry', () => {
		const root = resolveBundledStandardProfileRoot();
		const registryPath = resolve(root, 'docs.yml');
		expect(existsSync(registryPath)).toBe(true);
	});

	it('profile root includes document.schema.yml', () => {
		const root = resolveBundledStandardProfileRoot();
		const schemaPath = resolve(root, 'document.schema.yml');
		expect(existsSync(schemaPath)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// resolveActiveProfileRuntimePaths — bundled standard
// ---------------------------------------------------------------------------

describe('resolveActiveProfileRuntimePaths — bundled standard', () => {
	it('resolves standard profile as bundled', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: process.cwd(),
		});

		expect(paths.profileId).toBe('standard');
		expect(paths.source).toBe('bundled');
		expect(paths.profileRoot).toContain('profiles/standard');
		expect(existsSync(paths.registryPath)).toBe(true);
		expect(existsSync(paths.documentSchemaPath)).toBe(true);
		expect([paths.contractStatus]).toContain('valid');
	});

	it('safe display paths are relative when project-relative', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: process.cwd(),
		});

		expect(typeof paths.safeDisplay.profileRoot).toBe('string');
		expect(paths.safeDisplay.profileRoot.length).toBeGreaterThan(0);
		// Safe display should not be an absolute path
		expect(paths.safeDisplay.profileRoot.startsWith('/')).toBe(false);
	});

	it('has all required path fields', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: process.cwd(),
		});

		const requiredKeys: (keyof ActiveProfileRuntimePaths)[] = [
			'profileId',
			'source',
			'profileRoot',
			'registryPath',
			'documentSchemaPath',
			'phaseRegistryDirectory',
			'executiveRoot',
			'executiveGenerationConfigPath',
			'executiveSchemaPath',
			'executiveMappingsDirectory',
			'executiveTemplatesDirectory',
			'safeDisplay',
			'contractStatus',
			'executiveContractStatus',
		];
		for (const key of requiredKeys) {
			expect(paths[key]).toBeDefined();
		}
	});

	it('safeDisplay has all sub-paths', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: process.cwd(),
		});

		const safeKeys: (keyof ActiveProfileRuntimePaths['safeDisplay'])[] = [
			'profileRoot',
			'registryPath',
			'documentSchemaPath',
			'phaseRegistryDirectory',
			'executiveRoot',
			'executiveGenerationConfigPath',
			'executiveSchemaPath',
			'executiveMappingsDirectory',
			'executiveTemplatesDirectory',
		];
		for (const key of safeKeys) {
			expect(typeof paths.safeDisplay[key]).toBe('string');
			expect(paths.safeDisplay[key].length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// resolveActiveProfileRuntimePaths — custom profile root
// ---------------------------------------------------------------------------

describe('resolveActiveProfileRuntimePaths — custom profile', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('resolves custom profile root with local source', () => {
		const profileDir = createMinimalProfile(tempDir, 'my-profile', true);

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'my-profile',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(paths.profileId).toBe('my-profile');
		expect(paths.source).toBe('local');
		expect(paths.contractStatus).toBe('valid');
	});

	it('resolves executive contract when requireExecutive is true', () => {
		const profileDir = createMinimalProfile(tempDir, 'my-profile', true);

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'my-profile',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.executiveContractStatus).toBe('available');
		expect(paths.executiveContractDiagnostics.length).toBe(0);
		expect(existsSync(paths.executiveGenerationConfigPath)).toBe(true);
		expect(existsSync(paths.executiveSchemaPath)).toBe(true);
		expect(existsSync(paths.executiveMappingsDirectory)).toBe(true);
		expect(existsSync(paths.executiveTemplatesDirectory)).toBe(true);
	});

	it('executive contract status is missing when no executive directory', () => {
		const profileDir = createMinimalProfile(tempDir, 'no-exec', false);

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'no-exec',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.executiveContractStatus).toBe('missing');
		expect(paths.executiveContractDiagnostics.length).toBeGreaterThan(0);
		expect(
			paths.executiveContractDiagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_ROOT_MISSING,
			),
		).toBe(true);
	});

	it('executive contract status is missing when config file is missing', () => {
		const profileDir = createMinimalProfile(tempDir, 'missing-config', false);
		// Create executive dir but no config
		mkdirSync(join(profileDir, 'executive'), { recursive: true });

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'missing-config',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.executiveContractStatus).toBe('missing');
		expect(
			paths.executiveContractDiagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_CONFIG_MISSING,
			),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Unsafe profile root rejection
// ---------------------------------------------------------------------------

describe('resolveActiveProfileRuntimePaths — unsafe roots', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('rejects profile root with path traversal (..)', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'escape',
			profileRoot: '../../../outside',
			projectRoot: tempDir,
		});

		expect(
			paths.contractDiagnostics.some(
				(d) =>
					d.code === ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_ROOT_UNSAFE,
			),
		).toBe(true);
	});

	it('rejects profile root with path traversal mid-path', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'escape',
			profileRoot: '../traversal/out',
			projectRoot: tempDir,
		});

		expect(
			paths.contractDiagnostics.some(
				(d) =>
					d.code === ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_ROOT_UNSAFE,
			),
		).toBe(true);
	});

	it('produces registry missing diagnostic when profile root has no docs.yml', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'nonexistent',
			profileRoot: 'nonexistent-profile',
			projectRoot: tempDir,
		});

		expect(
			paths.contractDiagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_PROFILE_REGISTRY_MISSING,
			),
		).toBe(true);
		expect(paths.contractStatus).toBe('missing');
	});

	it('safe display paths do not contain absolute paths', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: tempDir,
		});

		for (const value of Object.values(paths.safeDisplay)) {
			expect(value.startsWith('/')).toBe(false);
			expect(value.startsWith('C:')).toBe(false);
		}
	});
});

// ---------------------------------------------------------------------------
// validateExecutiveContract
// ---------------------------------------------------------------------------

describe('validateExecutiveContract', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('returns status available for complete executive contract', () => {
		const profileDir = createMinimalProfile(tempDir, 'full-exec', true);
		const result = validateExecutiveContract(profileDir, tempDir);

		expect(result.status).toBe('available');
		expect(result.diagnostics.length).toBe(0);
	});

	it('returns status missing when executive root is absent', () => {
		const profileDir = createMinimalProfile(tempDir, 'no-exec-root', false);
		const result = validateExecutiveContract(profileDir, tempDir);

		expect(result.status).toBe('missing');
		expect(
			result.diagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_ROOT_MISSING,
			),
		).toBe(true);
	});

	it('reports missing config, schema, mappings when exec root is empty', () => {
		const profileDir = createMinimalProfile(tempDir, 'empty-exec', false);
		mkdirSync(join(profileDir, 'executive'), { recursive: true });

		const result = validateExecutiveContract(profileDir, tempDir);

		expect(
			result.diagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_CONFIG_MISSING,
			),
		).toBe(true);
		expect(
			result.diagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_SCHEMA_MISSING,
			),
		).toBe(true);
		expect(
			result.diagnostics.some(
				(d) =>
					d.code ===
					ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_MAPPINGS_MISSING,
			),
		).toBe(true);
	});

	it('templates missing is a warning, not an error', () => {
		const profileDir = createMinimalProfile(tempDir, 'no-templates', true);
		// Remove templates
		rmSync(join(profileDir, 'executive', 'templates'), {
			force: true,
			recursive: true,
		});

		const result = validateExecutiveContract(profileDir, tempDir);

		const templateDiags = result.diagnostics.filter(
			(d) =>
				d.code ===
				ACTIVE_PROFILE_DIAGNOSTIC_CODES.LOGOS_EXECUTIVE_TEMPLATES_MISSING,
		);
		expect(templateDiags.length).toBe(1);
		expect(templateDiags[0]?.severity).toBe('warning');
	});
});
