/** Custom profile init and status tests */

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initWorkspace } from '../src/init/init-execute.js';
import { planInitWorkspace } from '../src/init/init-plan.js';
import { readWorkspaceState } from '../src/state/workspace-state-repository.js';
import { getWorkspaceStatusSummary } from '../src/state/workspace-status.js';

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`logos-custom-init-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

function createMinimalProfile(dir: string, profileName: string): string {
	const profileDir = join(dir, profileName);
	mkdirSync(join(profileDir, 'phases'), { recursive: true });
	mkdirSync(join(profileDir, 'executive', 'mappings'), { recursive: true });
	mkdirSync(join(profileDir, 'executive', 'templates'), { recursive: true });

	const { writeFileSync } = require('node:fs');

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
`,
	);

	writeFileSync(
		join(profileDir, 'executive', 'executive-plan.schema.json'),
		JSON.stringify({
			properties: { id: { type: 'string' }, version: { type: 'string' } },
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
		'# Custom Template\n',
	);

	return profileDir;
}

// ---------------------------------------------------------------------------
// Init with custom profile root
// ---------------------------------------------------------------------------

describe('planInitWorkspace — custom profile root', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('accepts custom profile root and resolves as local', async () => {
		const profileDir = createMinimalProfile(tempDir, 'custom-init');

		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'custom-init',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(plan.profile.profileId).toBe('custom-init');
		expect(plan.profile.source).toBe('local');
		expect(plan.profile.validated).toBe(true);
		expect(plan.profile.safeProfileRoot).toBeDefined();
		expect(plan.profile.contractStatus).toBe('valid');
	});

	it('records custom profile metadata in workspace state', async () => {
		const profileDir = createMinimalProfile(tempDir, 'custom-init');

		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'custom-init',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(plan.state.profile.profileId).toBe('custom-init');
		expect(plan.state.profile.source).toBe('local');
		expect(plan.state.profile.contractStatus).toBeDefined();
		expect(plan.state.profile.executiveContractStatus).toBeDefined();
	});

	it('safeProfileRoot is project-relative, not absolute', async () => {
		const profileDir = createMinimalProfile(tempDir, 'safe-root');

		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'safe-root',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(plan.profile.safeProfileRoot).toBeDefined();
		expect((plan.profile.safeProfileRoot ?? '').startsWith('/')).toBe(false);
		expect((plan.profile.safeProfileRoot ?? '').length).toBeGreaterThan(0);
	});

	it('standard remains default when no custom profile root is provided', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			projectRoot: tempDir,
		});

		expect(plan.profile.profileId).toBe('standard');
		expect(plan.profile.source).toBe('bundled');
	});

	it('rejects unsafe profile root before state mutation', async () => {
		const plan = await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'escape',
			profileRoot: '../../../outside',
			projectRoot: tempDir,
		});

		expect(plan.profile.validated).toBe(false);
		expect(
			plan.diagnostics.some((d) => d.code === 'LOGOS_PROFILE_ROOT_UNSAFE'),
		).toBe(true);
	});

	it('dry-run init does not write files', async () => {
		const profileDir = createMinimalProfile(tempDir, 'dry-run-custom');

		await planInitWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			profileId: 'dry-run-custom',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		// Plan should not write
		const { existsSync } = require('node:fs');
		expect(existsSync(join(tempDir, '.logos'))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Status with custom profile metadata
// ---------------------------------------------------------------------------

describe('status — custom profile metadata', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir();
	});

	afterEach(() => {
		cleanupTempDir(tempDir);
	});

	it('status reports profile source and version when initialized with custom profile', async () => {
		const profileDir = createMinimalProfile(tempDir, 'status-profile');

		// Execute init
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'status-test-ws',
			confirm: true,
			documentationRoot: 'logos/',
			profileId: 'status-profile',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(result.success).toBe(true);

		const status = await getWorkspaceStatusSummary({ projectRoot: tempDir });

		expect(status.activeProfileId).toBe('status-profile');
		expect(status.profileSource).toBe('local');
		expect(status.contractStatus).toBeDefined();
		expect(status.executiveContractStatus).toBeDefined();
		expect(status.profileRoot).toBeDefined();
		// profileRoot should be project-relative
		expect((status.profileRoot ?? '').startsWith('/')).toBe(false);
	});

	it('status reports standard profile when no custom profile is used', async () => {
		const result = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'status-std-ws',
			confirm: true,
			projectRoot: tempDir,
		});

		expect(result.success).toBe(true);

		const status = await getWorkspaceStatusSummary({ projectRoot: tempDir });

		expect(status.activeProfileId).toBe('standard');
		expect(status.profileSource).toBe('bundled');
	});

	it('workspace state stores contract status for custom profile', async () => {
		const profileDir = createMinimalProfile(tempDir, 'state-contract');

		const initResult = await initWorkspace({
			_testTimestamp: '2024-01-01T00:00:00.000Z',
			_testWorkspaceId: 'state-contract-ws',
			confirm: true,
			profileId: 'state-contract',
			profileRoot: profileDir,
			projectRoot: tempDir,
		});

		expect(initResult.success).toBe(true);

		const readResult = await readWorkspaceState({ projectRoot: tempDir });

		expect(readResult.success).toBe(true);
		expect(readResult.state).toBeDefined();
		if (readResult.state) {
			expect(readResult.state.profile.source).toBe('local');
			expect(readResult.state.profile.contractStatus).toBeDefined();
			expect(readResult.state.profile.executiveContractStatus).toBeDefined();
			expect(readResult.state.profile.safeProfileRoot).toBeDefined();
		}
	});
});
