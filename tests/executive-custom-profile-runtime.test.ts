/** Executive custom profile runtime tests */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initWorkspace } from '../src/init/init-execute.js';
import { resolveActiveProfileRuntimePaths } from '../src/profiles/profile-runtime-paths.js';
import { readWorkspaceState } from '../src/state/workspace-state-repository.js';

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-exec-custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
	includeExecutive = true,
): string {
	const profileDir = join(dir, profileName);
	const { mkdirSync: mk } = require('node:fs');
	mk(join(profileDir, 'phases'), { recursive: true });

	writeFileSync(
		join(profileDir, 'docs.yml'),
		`schemaVersion: 1
contentVersion: '1.0.0-custom'
registryType: 'documentation-system'
project:
  id: '${profileName}'
  title: '${profileName} Profile'
  purpose: 'Test custom profile'
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
		mk(join(profileDir, 'executive', 'mappings'), { recursive: true });
		mk(join(profileDir, 'executive', 'templates'), { recursive: true });

		writeFileSync(
			join(profileDir, 'executive', 'executive-generation.yml'),
			`version: '1.0.0-custom'
readinessGate:
  requiredStatus: 'current'
  allowDraftGeneration: false
  allowExportWhenDraft: false
exports:
  targets:
    markdown:
      enabled: true
    html:
      enabled: true
`,
		);

		writeFileSync(
			join(profileDir, 'executive', 'executive-plan.schema.json'),
			JSON.stringify({
				properties: {
					execution: {
						properties: {
							initiatives: { type: 'array' },
							items: { type: 'array' },
							milestones: { type: 'array' },
							roadmaps: { type: 'array' },
							workstreams: { type: 'array' },
						},
						required: [
							'roadmaps',
							'milestones',
							'workstreams',
							'initiatives',
							'items',
						],
						type: 'object',
					},
					generatedAt: { type: 'string' },
					id: { type: 'string' },
					project: {
						properties: { id: { type: 'string' }, name: { type: 'string' } },
						required: ['id', 'name'],
						type: 'object',
					},
					source: {
						properties: {
							normativeDocuments: { items: { type: 'string' }, type: 'array' },
						},
						required: ['normativeDocuments'],
						type: 'object',
					},
					version: { type: 'string' },
				},
				required: [
					'id',
					'version',
					'project',
					'generatedAt',
					'source',
					'execution',
				],
				type: 'object',
			}),
		);

		writeFileSync(
			join(profileDir, 'executive', 'mappings', 'markdown.mapping.yml'),
			'id: markdown\nversion: 1.0.0\nstatus: supported\n',
		);

		writeFileSync(
			join(profileDir, 'executive', 'mappings', 'html.mapping.yml'),
			'id: html\nversion: 1.0.0\nstatus: supported\n',
		);

		writeFileSync(
			join(profileDir, 'executive', 'templates', 'agent-task.md'),
			'# Custom Template\n## Context\n{{context}}\n',
		);
	}

	return profileDir;
}

// ---------------------------------------------------------------------------
// Custom profile Executive runtime paths
// ---------------------------------------------------------------------------

describe('Executive paths — custom profile', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('executive paths resolve to custom profile, not Standard', () => {
		const profileDir = createMinimalProfile(tempDir, 'exec-custom');

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'exec-custom',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		// All executive paths should be inside the custom profile
		expect(paths.executiveRoot).toContain(profileDir);
		expect(paths.executiveGenerationConfigPath).toContain(profileDir);
		expect(paths.executiveSchemaPath).toContain(profileDir);
		expect(paths.executiveMappingsDirectory).toContain(profileDir);
		expect(paths.executiveTemplatesDirectory).toContain(profileDir);

		// They should not reference standard
		expect(paths.executiveRoot).not.toContain('profiles/standard');
		expect(paths.executiveGenerationConfigPath).not.toContain(
			'profiles/standard',
		);
	});

	it('missing custom Executive generation config blocks readiness', () => {
		const profileDir = createMinimalProfile(tempDir, 'no-config', false);
		// Create executive dir but no config file
		mkdirSync(join(profileDir, 'executive'), { recursive: true });

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'no-config',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.executiveContractStatus).toBe('missing');
		expect(
			paths.executiveContractDiagnostics.some(
				(d) => d.code === 'LOGOS_EXECUTIVE_CONFIG_MISSING',
			),
		).toBe(true);
	});

	it('profile without executive root reports unsupported/missing executive contract', () => {
		const profileDir = createMinimalProfile(tempDir, 'no-exec', false);

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'no-exec',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.executiveContractStatus).toBe('missing');
		expect(
			paths.executiveContractDiagnostics.some(
				(d) => d.code === 'LOGOS_EXECUTIVE_ROOT_MISSING',
			),
		).toBe(true);
	});

	it('Standard profile executive readiness still passes', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: tempDir,
			requireExecutive: true,
		});

		// Standard profile should have executive contract available
		expect(paths.executiveContractStatus).toBe('available');
		expect(paths.executiveContractDiagnostics.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Custom profile init with executive contract
// ---------------------------------------------------------------------------

describe('Init with custom profile and executive contract', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('initialized workspace state records executive contract status', async () => {
		const profileDir = createMinimalProfile(tempDir, 'exec-init');

		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'exec-init-ws',
			confirm: true,
			profileId: 'exec-init',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(result.success).toBe(true);

		const readResult = await readWorkspaceState({ projectRoot: tempDir });

		expect(readResult.success).toBe(true);
		expect(readResult.state).toBeDefined();
		if (readResult.state) {
			expect(readResult.state.profile.executiveContractStatus).toBeDefined();
			expect(readResult.state.profile.contractStatus).toBe('valid');
		}
	});

	it('workspace state includes safe profile root reference', async () => {
		const profileDir = createMinimalProfile(tempDir, 'safe-ref');

		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'safe-ref-ws',
			confirm: true,
			profileId: 'safe-ref',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(result.success).toBe(true);

		const readResult = await readWorkspaceState({ projectRoot: tempDir });

		if (readResult.state) {
			expect(readResult.state.profile.safeProfileRoot).toBeDefined();
			// safeProfileRoot should not be absolute
			expect(
				(readResult.state.profile.safeProfileRoot ?? '').startsWith('/'),
			).toBe(false);
			expect(
				(readResult.state.profile.safeProfileRoot ?? '').length,
			).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Regression: Standard profile still works
// ---------------------------------------------------------------------------

describe('Regression — Standard profile still works', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('can init with standard profile', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'regression-std-ws',
			confirm: true,
			profileId: 'standard',
			projectRoot: tempDir,
		});

		expect(result.success).toBe(true);
		expect(result.profile.profileId).toBe('standard');
		expect(result.profile.source).toBe('bundled');
	});

	it('standard profile exec paths resolve from bundled location', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.source).toBe('bundled');
		expect(paths.executiveContractStatus).toBe('available');
	});

	it('custom exec paths do not read profiles/standard/executive', () => {
		const profileDir = createMinimalProfile(tempDir, 'no-standard');

		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'no-standard',
			profileRoot: profileDir,
			projectRoot: tempDir,
			requireExecutive: true,
		});

		expect(paths.executiveGenerationConfigPath).not.toContain(
			'profiles/standard',
		);
		expect(paths.executiveSchemaPath).not.toContain('profiles/standard');
		expect(paths.executiveMappingsDirectory).not.toContain('profiles/standard');
	});
});
