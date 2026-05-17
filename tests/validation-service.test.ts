import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceArtifact, WorkspaceState } from '../src/index.js';
import {
	createDefaultWorkspaceState,
	validateArtifactRegistry,
	validateContracts,
	validateGeneratedOutputMetadata,
	validateWorkspace,
	validateWorkspaceStateScope,
	WORKSPACE_STATE_SCHEMA_VERSION,
} from '../src/index.js';

const REPO_ROOT = process.cwd();
const STANDARD_PROFILE_ROOT = resolve(REPO_ROOT, 'profiles', 'standard');
const PROFILE_FIXTURES_ROOT = resolve(
	REPO_ROOT,
	'tests',
	'fixtures',
	'profiles',
);
const ZERO_SHA = '0'.repeat(64);

const tempDirs: string[] = [];

async function createTempProject(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'logos-validation-'));
	tempDirs.push(dir);
	return dir;
}

async function writeText(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, 'utf-8');
}

function baseState(projectRoot: string): WorkspaceState {
	return {
		...createDefaultWorkspaceState({
			createdAt: '2024-01-01T00:00:00.000Z',
			projectRootPath: projectRoot,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'workspace-validation-test',
		}),
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			initializedBy: '/init',
			projectRootPath: projectRoot,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'workspace-validation-test',
		},
	};
}

function canonicalArtifact(
	overrides: Partial<WorkspaceArtifact> = {},
): WorkspaceArtifact {
	return {
		artifactId: 'art-001',
		artifactType: 'canonical_markdown',
		checksum: ZERO_SHA,
		generatedAt: '2024-01-01T00:00:00.000Z',
		isCanonical: true,
		metadata: { phaseId: '04-engineering' },
		path: 'logos/docs/04-engineering/05-data-model.md',
		runId: 'run-001',
		sourceDocumentIds: ['05-data-model'],
		status: 'planned',
		...overrides,
	};
}

function generatedMarkdown(overrides: Record<string, string> = {}): string {
	const fields = {
		canonicalOutput: 'docs/04-engineering/05-data-model.md',
		contentChecksum: ZERO_SHA,
		documentId: '05-data-model',
		generatedAt: '2024-01-01T00:00:00.000Z',
		generatedBy: 'logos-engine (canonical-markdown-renderer)',
		generationStatus: 'generated',
		phaseId: '04-engineering',
		profileId: 'standard',
		sourceStateSchemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
		...overrides,
	};
	return `---
documentId: ${fields.documentId}
phaseId: ${fields.phaseId}
profileId: ${fields.profileId}
canonicalOutput: ${fields.canonicalOutput}
generatedBy: ${fields.generatedBy}
generatedAt: ${fields.generatedAt}
generationStatus: ${fields.generationStatus}
sourceStateSchemaVersion: ${fields.sourceStateSchemaVersion}
contentChecksum: ${fields.contentChecksum}
---

# Data Model

Generated body.
`;
}

function codes(result: { findings: Array<{ code: string }> }): string[] {
	return result.findings.map((finding) => finding.code);
}

function snapshotFindings(result: {
	findings: Array<{
		code: string;
		severity: string;
		source: { kind: string };
		location: { pointer?: string };
	}>;
}) {
	return result.findings.map((finding) => ({
		code: finding.code,
		pointer: finding.location.pointer,
		severity: finding.severity,
		source: finding.source.kind,
	}));
}

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) await rm(dir, { force: true, recursive: true });
	}
});

describe('contract validation', () => {
	it('validates Standard profile contracts deterministically', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
		expect(result.validatedProfileId).toBe('standard');
		expect(result.status).toBe('pass');
		expect(result.summary.bySeverity.error).toBe(0);
		expect(result.summary.bySeverity.fatal).toBe(0);
		expect(result.scopesChecked).toEqual(['contracts']);
		expect(snapshotFindings(result).slice(0, 3)).toMatchSnapshot();
	});

	it('wraps missing and invalid registry diagnostics as findings', async () => {
		const projectRoot = await createTempProject();
		const missing = await validateContracts({
			profileId: 'missing',
			profileRoot: join(projectRoot, 'profiles', 'missing'),
			projectRoot,
		});
		const invalid = await validateContracts({
			profileId: 'invalid-axis',
			profileRoot: join(PROFILE_FIXTURES_ROOT, 'invalid-axis'),
			projectRoot,
		});

		expect(codes(missing)).toContain('profile_registry_missing');
		expect(codes(invalid)).toContain('profile_registry_invalid');
		expect(snapshotFindings(invalid)).toMatchSnapshot();
	});

	it('reports phase, document, dependency, status, cycle, and duplicate ID failures', async () => {
		const projectRoot = await createTempProject();
		const cases = [
			['missing-phase', 'phase_descriptor_missing'],
			['malformed-phase', 'phase_descriptor_invalid'],
			['invalid-document', 'document_descriptor_invalid'],
			['duplicate-document-id', 'document_duplicate_id'],
			['unknown-dependency', 'document_missing_dependency'],
			['invalid-status', 'document_invalid_status'],
			['circular-dependency-direct', 'document_circular_dependency'],
		] as const;

		for (const [fixture, expectedCode] of cases) {
			const result = await validateContracts({
				profileId: fixture,
				profileRoot: join(PROFILE_FIXTURES_ROOT, fixture),
				projectRoot,
			});
			expect(codes(result)).toContain(expectedCode);
		}
	});
});

describe('workspace state validation', () => {
	it('passes valid initialized workspace state and default root is logos/', async () => {
		const projectRoot = await createTempProject();
		const state = baseState(projectRoot);
		const result = await validateWorkspaceStateScope({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(result.status).toBe('pass');
		expect(result.documentationRoot).toBe('logos/');
		expect(result.summary.totalFindings).toBe(0);
	});

	it('reports missing workspace, invalid JSON, schema version mismatch, invalid roots, and profile mismatch', async () => {
		const projectRoot = await createTempProject();
		const missing = await validateWorkspaceStateScope({ projectRoot });
		const invalidJsonPath = join(projectRoot, '.logos', 'workspace.json');
		await writeText(invalidJsonPath, '{invalid json');
		const invalidJson = await validateWorkspaceStateScope({ projectRoot });
		const schemaMismatch = await validateWorkspaceStateScope({
			projectRoot,
			state: { ...baseState(projectRoot), schemaVersion: '0.0.0' },
		});
		const invalidRoot = await validateWorkspaceStateScope({
			projectRoot,
			state: {
				...baseState(projectRoot),
				documentation: {
					isDefault: true,
					rootPath: 'docs/',
					wasExplicitlyConfigured: false,
				},
			},
		});
		const profileMismatch = await validateWorkspaceStateScope({
			profileId: 'custom-profile',
			projectRoot,
			state: baseState(projectRoot),
		});

		expect(codes(missing)).toContain('workspace_missing');
		expect(codes(invalidJson)).toContain('workspace_invalid_json');
		expect(codes(schemaMismatch)).toContain(
			'workspace_schema_version_unsupported',
		);
		expect(codes(invalidRoot)).toContain('workspace_root_invalid');
		expect(codes(profileMismatch)).toContain('profile_lock_mismatch');
		expect(snapshotFindings(schemaMismatch)).toMatchSnapshot();
	});

	it('redacts token-like values and reports unknown state references', async () => {
		const projectRoot = await createTempProject();
		const fakeSecret = 'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLM';
		const secretState = {
			...baseState(projectRoot),
			provider: {
				enabled: true,
				providerId: 'openai',
				tokenEnvVarName: fakeSecret,
			},
		};
		const referenceState = {
			...baseState(projectRoot),
			proposals: [
				{
					body: 'body',
					kind: 'decision',
					proposalId: 'proposal-001',
					sourceDocumentCanonicalId: 'unknown-doc',
					sourceSessionId: 'missing-session',
					status: 'proposed',
					title: 'Proposal',
				},
			],
		};

		const secretResult = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts', 'state'],
			state: secretState,
		});
		const referenceResult = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts', 'state'],
			state: referenceState,
		});

		expect(codes(secretResult)).toContain('secret_like_value');
		expect(codes(referenceResult)).toContain('workspace_reference_unknown');
		expect(JSON.stringify(secretResult.findings)).not.toContain(fakeSecret);
	});
});

describe('artifact registry validation', () => {
	it('passes valid canonical Markdown artifact metadata', async () => {
		const projectRoot = await createTempProject();
		const state = {
			...baseState(projectRoot),
			artifacts: [canonicalArtifact()],
		};
		const result = await validateArtifactRegistry({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(result.summary.bySeverity.error).toBe(0);
		expect(codes(result)).not.toContain('artifact_invalid_canonicality');
	});

	it('reports invalid canonicality, unknown IDs, invalid path, duplicate path, checksum, and missing file', async () => {
		const projectRoot = await createTempProject();
		const state = {
			...baseState(projectRoot),
			artifacts: [
				canonicalArtifact({
					artifactId: 'art-001',
					checksum: 'bad',
					path: '../escape.md',
					status: 'generated',
				}),
				canonicalArtifact({
					artifactId: 'art-002',
					artifactType: 'html',
					isCanonical: true,
					sourceDocumentIds: ['unknown-doc'],
				}),
				canonicalArtifact({
					artifactId: 'art-003',
					metadata: { phaseId: 'unknown-phase' },
					status: 'generated',
				}),
				canonicalArtifact({ artifactId: 'art-004', status: 'generated' }),
			],
		};
		const result = await validateArtifactRegistry({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(codes(result)).toEqual(
			expect.arrayContaining([
				'artifact_invalid_canonicality',
				'artifact_unknown_document',
				'artifact_unknown_phase',
				'path_traversal',
				'artifact_duplicate_path',
				'artifact_checksum_invalid',
				'artifact_file_missing',
			]),
		);
		expect(snapshotFindings(result)).toMatchSnapshot();
	});
});

describe('generated output metadata validation', () => {
	it('passes valid generated Markdown metadata', async () => {
		const projectRoot = await createTempProject();
		const outputPath = join(
			projectRoot,
			'logos',
			'docs',
			'04-engineering',
			'05-data-model.md',
		);
		await writeText(outputPath, generatedMarkdown());
		const state = {
			...baseState(projectRoot),
			artifacts: [canonicalArtifact({ status: 'generated' })],
		};

		const result = await validateGeneratedOutputMetadata({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(result.summary.bySeverity.error).toBe(0);
		expect(codes(result)).not.toContain('output_metadata_invalid');
	});

	it('reports missing, invalid, mismatched, overclaiming, modified, registry-mismatched, and traversal metadata', async () => {
		const projectRoot = await createTempProject();
		const missingMetadataPath = join(projectRoot, 'logos', 'missing.md');
		const invalidMetadataPath = join(projectRoot, 'logos', 'invalid.md');
		const mismatchPath = join(
			projectRoot,
			'logos',
			'docs',
			'04-engineering',
			'05-data-model.md',
		);
		await writeText(missingMetadataPath, '# Missing Metadata\n');
		await writeText(invalidMetadataPath, '---\nunclosed: true\n# Invalid\n');
		await writeText(
			mismatchPath,
			generatedMarkdown({
				canonicalOutput: 'docs/wrong.md',
				contentChecksum: '1'.repeat(64),
				documentId: 'wrong-doc',
				generationStatus: 'not-a-status',
				phaseId: 'wrong-phase',
				profileId: 'wrong-profile',
			}).replace(
				`contentChecksum: ${'1'.repeat(64)}`,
				`contentChecksum: ${'1'.repeat(64)}\nvalidation: passed`,
			),
		);
		const state = {
			...baseState(projectRoot),
			artifacts: [canonicalArtifact({ status: 'generated' })],
		};

		const result = await validateGeneratedOutputMetadata({
			outputPaths: ['logos/missing.md', 'logos/invalid.md', '../escape.md'],
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(codes(result)).toEqual(
			expect.arrayContaining([
				'output_metadata_missing',
				'output_metadata_invalid',
				'output_metadata_document_mismatch',
				'output_metadata_phase_mismatch',
				'output_metadata_profile_mismatch',
				'output_metadata_path_mismatch',
				'output_metadata_validation_overclaim',
				'output_manual_edit_status',
				'output_registry_mismatch',
				'path_traversal',
			]),
		);
		expect(snapshotFindings(result)).toMatchSnapshot();
	});
});

describe('scope and non-mutation behavior', () => {
	it('supports contract-only, state-only, output-only, and all scopes deterministically', async () => {
		const projectRoot = await createTempProject();
		const contractOnly = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts'],
		});
		const stateOnly = await validateWorkspace({
			projectRoot,
			scopes: ['state'],
		});
		const outputOnly = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['outputs'],
		});
		const all = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['all'],
		});

		expect(contractOnly.scopesChecked).toEqual(['contracts']);
		expect(stateOnly.scopesChecked).toEqual(['state']);
		expect(outputOnly.scopesChecked).toEqual(['outputs']);
		expect(all.scopesChecked).toEqual([
			'contracts',
			'state',
			'artifacts',
			'outputs',
		]);
		expect(codes(stateOnly)).toContain('workspace_missing');
		expect(outputOnly.readOnly).toBe(true);
	});

	it('does not create .logos, validation runs, artifact updates, reports, or generated files', async () => {
		const projectRoot = await createTempProject();
		const beforeLogosExists = await stat(join(projectRoot, '.logos')).then(
			() => true,
			() => false,
		);
		const result = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
		});
		const afterLogosExists = await stat(join(projectRoot, '.logos')).then(
			() => true,
			() => false,
		);

		expect(beforeLogosExists).toBe(false);
		expect(afterLogosExists).toBe(false);
		expect(result.changedPaths).toEqual([]);
		expect(result.readOnly).toBe(true);
		expect(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		).toContain('logos-engine');
	});
});
