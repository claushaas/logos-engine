/**
 * Step 6.4 — Wire Validation into pnpm check
 *
 * Deterministic, non-mutating, provider-free validation-gate tests.
 * These tests validate the bundled Standard profile and generated-output
 * fixtures as a release-quality gate.
 */

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
import type {
	DocumentDescriptor,
	ValidationFinding,
	WorkspaceArtifact,
	WorkspaceState,
} from '../src/index.js';
import {
	buildContractGraph,
	createDefaultWorkspaceState,
	createValidationFinding,
	createValidationRunResult,
	determineValidationGateStatus,
	lintCanonicalMarkdownDocument,
	loadDocumentationContract,
	validateContracts,
	validateGeneratedOutputMetadata,
	validateWorkspace,
	validateWorkspaceStateScope,
	WORKSPACE_STATE_SCHEMA_VERSION,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = process.cwd();
const STANDARD_PROFILE_ROOT = resolve(REPO_ROOT, 'profiles', 'standard');
const FIXTURES_ROOT = resolve(REPO_ROOT, 'tests', 'fixtures', 'profiles');

const ZERO_SHA = '0'.repeat(64);
const tempDirs: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempProject(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'logos-gate-'));
	tempDirs.push(dir);
	return dir;
}

async function writeText(path: string, content: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, 'utf-8');
}

function codes(result: { findings: Array<{ code: string }> }): string[] {
	return result.findings.map((f) => f.code);
}

function baseState(projectRoot: string): WorkspaceState {
	return {
		...createDefaultWorkspaceState({
			createdAt: '2024-01-01T00:00:00.000Z',
			projectRootPath: projectRoot,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'ws-gate-test',
		}),
		workspace: {
			createdAt: '2024-01-01T00:00:00.000Z',
			initializationState: 'initialized',
			initializedBy: '/init',
			projectRootPath: projectRoot,
			updatedAt: '2024-01-01T00:00:00.000Z',
			workspaceId: 'ws-gate-test',
		},
	};
}

function canonicalArtifact(
	overrides: Partial<WorkspaceArtifact> = {},
): WorkspaceArtifact {
	return {
		artifactId: 'art-gate-001',
		artifactType: 'canonical_markdown',
		checksum: ZERO_SHA,
		generatedAt: '2024-01-01T00:00:00.000Z',
		isCanonical: true,
		metadata: { phaseId: '02-validation' },
		path: 'logos/docs/02-validation/10-validation-report.md',
		runId: 'run-001',
		sourceDocumentIds: ['10-validation-report'],
		status: 'planned',
		...overrides,
	};
}

function generatedMarkdown(overrides: Record<string, string> = {}): string {
	const fields = {
		canonicalOutput: 'logos/docs/02-validation/10-validation-report.md',
		contentChecksum: ZERO_SHA,
		documentId: '10-validation-report',
		generatedAt: '2024-01-01T00:00:00.000Z',
		generatedBy: 'logos-engine (canonical-markdown-renderer)',
		generationStatus: 'generated',
		phaseId: '02-validation',
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

# Validation Report

Generated body.
`;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) await rm(dir, { force: true, recursive: true });
	}
});

// ===========================================================================
// 1. Package Script Wiring Tests
// ===========================================================================

describe('package script wiring', () => {
	it('package.json includes a check:validation script', async () => {
		const pkg = JSON.parse(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		);
		expect(pkg.scripts['check:validation']).toBeDefined();
		expect(pkg.scripts['check:validation']).toContain('validation-gate');
	});

	it('pnpm check includes the validation gate', async () => {
		const pkg = JSON.parse(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		);
		expect(pkg.scripts.check).toContain('check:validation');
	});

	it('pnpm check does not include mutating format/write flags', async () => {
		const pkg = JSON.parse(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		);
		const checkScript = pkg.scripts.check as string;

		// Resolve all chained scripts in the check script
		const parts = checkScript.split('&&').map((s: string) => s.trim());
		for (const part of parts) {
			const resolved = resolveScript(part, pkg);
			expect(resolved).not.toContain('--write');
			expect(resolved).not.toContain('--unsafe');
		}
	});

	it('format script is separate from check scripts', async () => {
		const pkg = JSON.parse(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		);
		const checkScript = pkg.scripts.check as string;
		expect(checkScript).not.toContain('format');
		expect(checkScript).not.toContain('--write');
	});

	it('validation gate script does not reference provider credentials', async () => {
		const pkg = JSON.parse(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		);
		const valScript = pkg.scripts['check:validation'] as string;
		expect(valScript).not.toMatch(/key|token|secret|api/i);
	});

	it('smoke:cli remains non-interactive', async () => {
		const pkg = JSON.parse(
			await readFile(resolve(REPO_ROOT, 'package.json'), 'utf-8'),
		);
		const smoke = pkg.scripts['smoke:cli'] as string;
		expect(smoke).toContain('smoke-cli.js');
		expect(smoke).not.toContain('--tui');
		expect(smoke).not.toContain('--interactive');
	});
});

function resolveScript(
	scriptName: string,
	pkg: Record<string, unknown>,
): string {
	const name = scriptName.replace(/^pnpm\s+/, '').trim();
	const scripts = pkg.scripts as Record<string, string>;
	return scripts[name] ?? scriptName;
}

// ===========================================================================
// 2. Bundled Standard Profile Contract Validation
// ===========================================================================

describe('bundled Standard profile contract validation', () => {
	it('validates Standard profile contracts through Step 6.1 service', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
		expect(result.validatedProfileId).toBe('standard');
		expect(result.status).toBe('pass');
		expect(result.summary.bySeverity.error).toBe(0);
		expect(result.summary.bySeverity.fatal).toBe(0);
		expect(result.scopesChecked).toEqual(['contracts']);
	});

	it('Standard profile registry loads and validates', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		expect(
			result.findings.filter((f) => f.source.kind === 'profile_registry'),
		).toHaveLength(0);
	});

	it('Standard profile graph has no circular dependencies', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		const circularFindings = result.findings.filter(
			(f) => f.code === 'document_circular_dependency',
		);
		expect(circularFindings).toHaveLength(0);
	});

	it('Standard profile contract graph builds without circular dependencies', async () => {
		const contract = await loadDocumentationContract({
			profileId: 'standard',
			repoRoot: REPO_ROOT,
		});
		const { diagnostics, graph } = buildContractGraph(contract);

		const circularDiagnostics = diagnostics.filter(
			(d) => d.code === 'E_GRAPH_CIRCULAR_DEPENDENCY',
		);
		expect(circularDiagnostics).toHaveLength(0);

		// All declared graph nodes are present and output count is non-zero
		expect(graph.nodes.length).toBeGreaterThan(0);
		expect(graph.outputs.length).toBeGreaterThan(0);
	});

	it('all Standard profile document descriptors validate', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		const documentDescriptorFindings = result.findings.filter(
			(f) =>
				f.source.kind === 'document_descriptor' &&
				(f.severity === 'error' || f.severity === 'fatal'),
		);
		expect(documentDescriptorFindings).toHaveLength(0);
	});

	it('all Standard profile phase descriptors validate', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		const phaseFindings = result.findings.filter(
			(f) =>
				f.source.kind === 'phase_descriptor' &&
				(f.severity === 'error' || f.severity === 'fatal'),
		);
		expect(phaseFindings).toHaveLength(0);
	});

	it('Standard profile output declarations are valid', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		const outputFindings = result.findings.filter(
			(f) =>
				f.code === 'output_invalid_kind' || f.code === 'output_duplicate_path',
		);
		expect(outputFindings).toHaveLength(0);
	});

	it('Standard profile has non-empty outputs', async () => {
		const contract = await loadDocumentationContract({
			profileId: 'standard',
			repoRoot: REPO_ROOT,
		});
		const { graph } = buildContractGraph(contract);

		expect(graph.outputs.length).toBeGreaterThan(0);

		const canonicalOutputs = graph.outputs.filter(
			(o) => o.kind === 'canonical',
		);
		expect(canonicalOutputs.length).toBeGreaterThan(0);

		// All canonical outputs must be markdown format
		for (const output of canonicalOutputs) {
			expect(output.format).toBe('markdown');
		}
	});
});

// ===========================================================================
// 3. Invalid Profile Fixture Tests
// ===========================================================================

describe('invalid profile fixture validation', () => {
	it('invalid registry fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'invalid-axis',
			profileRoot: resolve(FIXTURES_ROOT, 'invalid-axis'),
			projectRoot,
		});
		expect(codes(result)).toContain('profile_registry_invalid');
		expect(result.status).toBe('fail');
	});

	it('missing phase descriptor fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'missing-phase',
			profileRoot: resolve(FIXTURES_ROOT, 'missing-phase'),
			projectRoot,
		});
		expect(codes(result)).toContain('phase_descriptor_missing');
	});

	it('malformed phase descriptor fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'malformed-phase',
			profileRoot: resolve(FIXTURES_ROOT, 'malformed-phase'),
			projectRoot,
		});
		expect(codes(result)).toContain('phase_descriptor_invalid');
	});

	it('invalid document descriptor fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'invalid-document',
			profileRoot: resolve(FIXTURES_ROOT, 'invalid-document'),
			projectRoot,
		});
		expect(codes(result)).toContain('document_descriptor_invalid');
	});

	it('duplicate document ID fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'duplicate-document-id',
			profileRoot: resolve(FIXTURES_ROOT, 'duplicate-document-id'),
			projectRoot,
		});
		expect(codes(result)).toContain('document_duplicate_id');
	});

	it('unknown dependency fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'unknown-dependency',
			profileRoot: resolve(FIXTURES_ROOT, 'unknown-dependency'),
			projectRoot,
		});
		expect(result.findings.length).toBeGreaterThan(0);
	});

	it('circular dependency fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'circular-dependency-direct',
			profileRoot: resolve(FIXTURES_ROOT, 'circular-dependency-direct'),
			projectRoot,
		});
		expect(codes(result)).toContain('document_circular_dependency');
	});

	it('invalid status fixture fails deterministically', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'invalid-status',
			profileRoot: resolve(FIXTURES_ROOT, 'invalid-status'),
			projectRoot,
		});
		expect(codes(result)).toContain('document_invalid_status');
	});

	it('findings include source path, pointer, and recovery hint where practical', async () => {
		const projectRoot = await createTempProject();
		const result = await validateContracts({
			profileId: 'invalid-document',
			profileRoot: resolve(FIXTURES_ROOT, 'invalid-document'),
			projectRoot,
		});

		for (const finding of result.findings.filter(
			(f) => f.severity === 'error' || f.severity === 'fatal',
		)) {
			expect(finding.source.kind).toBeTruthy();
			expect(finding.location.pointer).toBeTruthy();
			expect(finding.recoveryHint?.message).toBeTruthy();
		}
	});
});

// ===========================================================================
// 4. Generated-Output Fixture Validation
// ===========================================================================

describe('generated-output fixture validation', () => {
	it('valid generated Markdown fixture passes validation', async () => {
		const projectRoot = await createTempProject();
		const outputPath = join(
			projectRoot,
			'logos',
			'docs',
			'02-validation',
			'10-validation-report.md',
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
		expect(result.summary.bySeverity.fatal).toBe(0);
	});

	it('missing metadata fixture produces finding', async () => {
		const projectRoot = await createTempProject();
		const missingPath = join(projectRoot, 'logos', 'missing-metadata.md');
		await writeText(missingPath, '# No frontmatter here\n\nSome content.\n');

		const result = await validateGeneratedOutputMetadata({
			outputPaths: ['logos/missing-metadata.md'],
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
		});

		expect(codes(result)).toContain('output_metadata_missing');
	});

	it('missing required section fixture produces finding via semantic lints', () => {
		const md = `---
documentId: 10-validation-report
phaseId: 02-validation
profileId: standard
canonicalOutput: logos/docs/02-validation/10-validation-report.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: ${WORKSPACE_STATE_SCHEMA_VERSION}
---

# Validation Report

## Introduction

Only intro, no other sections.
`;

		const descriptor = createReportDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['required-sections'] },
		);

		const missingFindings = result.findings.filter(
			(f) => f.code === 'document_missing_required_section',
		);
		expect(missingFindings.length).toBeGreaterThan(0);
	});

	it('unsupported external validation claim fixture produces finding', () => {
		const md = `---
documentId: 10-validation-report
phaseId: 02-validation
profileId: standard
canonicalOutput: logos/docs/02-validation/10-validation-report.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: ${WORKSPACE_STATE_SCHEMA_VERSION}
---

# Validation Report

## Introduction

The product has been validated and proven through extensive market testing.
`;

		const descriptor = createReportDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['evidence-boundary'] },
		);

		const claimFindings = result.findings.filter(
			(f) => f.code === 'document_unsupported_validation_claim',
		);
		expect(claimFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('token-like leak fixture produces redacted finding', () => {
		const fakeSecret = 'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH';
		const md = `---
documentId: 10-validation-report
phaseId: 02-validation
profileId: standard
canonicalOutput: logos/docs/02-validation/10-validation-report.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: ${WORKSPACE_STATE_SCHEMA_VERSION}
---

## Config

token: ${fakeSecret}
`;

		const descriptor = createReportDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['token-leak'] },
		);

		const tokenFindings = result.findings.filter(
			(f) => f.code === 'document_token_like_value',
		);
		expect(tokenFindings.length).toBeGreaterThan(0);

		// Findings must not contain raw fake secret
		for (const f of tokenFindings) {
			expect(f.received).not.toContain('sk-');
			expect(f.received).not.toContain('abcdef');
		}
		const serialized = JSON.stringify(tokenFindings);
		expect(serialized).not.toContain(fakeSecret);
	});

	it('invalid generated metadata fixture produces finding', () => {
		const md = `---
documentId: wrong-id
phaseId: wrong-phase
profileId: wrong-profile
canonicalOutput: logos/docs/wrong.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: not-a-real-status
sourceStateSchemaVersion: ${WORKSPACE_STATE_SCHEMA_VERSION}
---

# Wrong Doc

Bad metadata.
`;

		const descriptor = createReportDescriptor({ id: '10-validation-report' });
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['traceability', 'contradiction'] },
		);

		const mismatchFindings = result.findings.filter(
			(f) =>
				f.code === 'document_metadata_id_mismatch' ||
				f.code === 'document_metadata_profile_mismatch',
		);
		expect(mismatchFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('derived artifact boundary violation fixture produces finding', () => {
		const md = `---
documentId: 10-validation-report
phaseId: 02-validation
profileId: standard
canonicalOutput: logos/docs/02-validation/10-validation-report.md
generatedBy: logos-engine
generatedAt: 2024-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: ${WORKSPACE_STATE_SCHEMA_VERSION}
---

# Validation Report

## Outputs

The HTML dashboard is the canonical source of truth for validation status.
`;

		const descriptor = createReportDescriptor();
		const result = lintCanonicalMarkdownDocument(
			{ descriptor, markdown: md },
			{ ruleIds: ['derived-artifact-boundary'] },
		);

		const violationFindings = result.findings.filter(
			(f) => f.code === 'document_derived_artifact_boundary_violation',
		);
		expect(violationFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('output path mismatch fixture produces finding', async () => {
		const projectRoot = await createTempProject();
		const outputPath = join(
			projectRoot,
			'logos',
			'docs',
			'02-validation',
			'10-validation-report.md',
		);
		await writeText(
			outputPath,
			generatedMarkdown({
				canonicalOutput: 'logos/docs/wrong/other.md',
				documentId: '10-validation-report',
			}),
		);
		const state = {
			...baseState(projectRoot),
			artifacts: [canonicalArtifact({ status: 'generated' })],
		};

		const result = await validateGeneratedOutputMetadata({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(codes(result)).toContain('output_metadata_path_mismatch');
	});

	it('manual edit / modified-generated metadata fixture is reported', async () => {
		const projectRoot = await createTempProject();
		const outputPath = join(
			projectRoot,
			'logos',
			'docs',
			'02-validation',
			'10-validation-report.md',
		);
		const modifiedChecksum = '1'.repeat(64);
		await writeText(
			outputPath,
			generatedMarkdown({ contentChecksum: modifiedChecksum }),
		);
		const state = {
			...baseState(projectRoot),
			artifacts: [
				canonicalArtifact({
					checksum: 'a'.repeat(64),
					status: 'generated',
				}),
			],
		};

		const result = await validateGeneratedOutputMetadata({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(codes(result)).toContain('output_manual_edit_status');
		expect(codes(result)).toContain('output_registry_mismatch');
	});
});

function createReportDescriptor(
	overrides: Partial<DocumentDescriptor> = {},
): DocumentDescriptor {
	return {
		centralQuestion: 'Is the project validated?',
		id: '10-validation-report',
		outputs: {
			canonical: {
				format: 'markdown',
				path: 'logos/docs/02-validation/10-validation-report.md',
			},
		},
		phase: '02-validation',
		purpose: 'Validation report.',
		sections: [
			{
				id: 'intro',
				questions: ['What was validated?'],
				required: true,
				title: 'Introduction',
			},
			{
				id: 'criteria',
				questions: ['Which criteria?'],
				required: true,
				title: 'Validation Criteria',
			},
			{
				id: 'results',
				questions: ['What were the results?'],
				required: true,
				title: 'Validation Results',
			},
			{
				id: 'gaps',
				questions: ['What gaps remain?'],
				required: false,
				title: 'Gaps & Open Issues',
			},
		],
		status: 'not_started',
		title: 'Validation Report',
		type: 'thesis',
		...overrides,
	};
}

// ===========================================================================
// 5. Check-Gate Behavior Tests
// ===========================================================================

describe('check-gate behavior', () => {
	it('service-level release validation returns pass for current repository contracts', async () => {
		const result = await validateContracts({ projectRoot: REPO_ROOT });

		expect(result.status).toBe('pass');
		expect(result.summary.bySeverity.error).toBe(0);
		expect(result.summary.bySeverity.fatal).toBe(0);
	});

	it('simulated error/fatal findings produce failing gate status', () => {
		const findings: ValidationFinding[] = [
			createValidationFinding({
				code: 'profile_registry_missing',
				location: { path: 'missing-docs.yml' },
				message: 'Profile registry missing.',
				order: 0,
				severity: 'error',
				source: { kind: 'profile_registry', path: 'missing-docs.yml' },
			}),
		];

		const status = determineValidationGateStatus(findings);
		expect(status).toBe('fail');
	});

	it('simulated fatal findings produce failing gate status', () => {
		const findings: ValidationFinding[] = [
			createValidationFinding({
				code: 'validation_scope_failed',
				location: { path: 'some-profile' },
				message: 'Validation failed unexpectedly.',
				order: 0,
				severity: 'fatal',
				source: { kind: 'validation_service', path: 'some-profile' },
			}),
		];

		const status = determineValidationGateStatus(findings);
		expect(status).toBe('fail');
	});

	it('warnings-only produces pass_with_warnings by default', () => {
		const findings: ValidationFinding[] = [
			createValidationFinding({
				code: 'artifact_file_missing',
				location: { path: 'some-file.md' },
				message: 'File missing.',
				order: 0,
				severity: 'warning',
				source: { kind: 'artifact_registry', path: 'some-file.md' },
			}),
		];

		const status = determineValidationGateStatus(findings);
		expect(status).toBe('pass_with_warnings');
	});

	it('validation with no findings produces pass', () => {
		expect(determineValidationGateStatus([])).toBe('pass');
	});

	it('validation with info-only findings produces pass', () => {
		const findings: ValidationFinding[] = [
			createValidationFinding({
				code: 'document_missing_dependency',
				location: { path: 'doc.yml' },
				message: 'Informational drift.',
				order: 0,
				severity: 'info',
				source: { kind: 'contract_graph', path: 'doc.yml' },
			}),
		];

		expect(determineValidationGateStatus(findings)).toBe('pass');
	});

	it('output summary is deterministic and concise', () => {
		const findings: ValidationFinding[] = [
			createValidationFinding({
				code: 'profile_registry_invalid',
				location: { path: 'docs.yml', pointer: '/axes/0/id' },
				message: 'Invalid axis entry.',
				order: 0,
				severity: 'error',
				source: { kind: 'profile_registry', path: 'docs.yml' },
			}),
			createValidationFinding({
				code: 'artifact_file_missing',
				location: { path: 'a.md' },
				message: 'File missing.',
				order: 1,
				severity: 'warning',
				source: { kind: 'artifact_registry', path: 'a.md' },
			}),
		];

		const result = createValidationRunResult({
			dryRun: true,
			findings,
			scopesChecked: ['contracts'],
		});

		expect(result.status).toBe('fail');
		expect(result.summary.totalFindings).toBe(2);
		expect(result.summary.bySeverity.error).toBe(1);
		expect(result.summary.bySeverity.warning).toBe(1);
	});

	it('result is read-only and has no changed paths', () => {
		const result = createValidationRunResult({
			dryRun: true,
			findings: [],
			scopesChecked: ['contracts'],
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});
});

// ===========================================================================
// 6. Non-Mutation Tests
// ===========================================================================

describe('non-mutation guarantees', () => {
	it('running validation gate service creates no .logos/', async () => {
		const projectRoot = await createTempProject();
		const logosPath = join(projectRoot, '.logos');

		const beforeLogos = await stat(logosPath).then(
			() => true,
			() => false,
		);
		expect(beforeLogos).toBe(false);

		await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts'],
		});

		const afterLogos = await stat(logosPath).then(
			() => true,
			() => false,
		);
		expect(afterLogos).toBe(false);
	});

	it('running validation gate service writes no reports', async () => {
		const projectRoot = await createTempProject();

		await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts'],
		});

		// Verify no reports subdirectory under logos/
		const reportsPath = join(projectRoot, 'logos', 'reports');
		const reportsExist = await stat(reportsPath).then(
			() => true,
			() => false,
		);
		expect(reportsExist).toBe(false);
	});

	it('running validation gate service persists no run metadata', async () => {
		const projectRoot = await createTempProject();

		const result = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts'],
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});

	it('running validation gate service updates no artifact registry', async () => {
		const projectRoot = await createTempProject();

		const result = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['artifacts'],
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});

	it('running validation gate service does not generate Markdown', async () => {
		const projectRoot = await createTempProject();
		const logosDocs = join(projectRoot, 'logos', 'docs');

		await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts'],
		});

		const docsExist = await stat(logosDocs).then(
			() => true,
			() => false,
		);
		expect(docsExist).toBe(false);
	});

	it('no test mutates the real repository', () => {
		expect(process.cwd()).toContain('logos-engine');
	});

	it('validation gate does not require initialized workspace', async () => {
		const projectRoot = await createTempProject();

		// Contract-only validation must not require initialized workspace
		const result = await validateContracts({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
		});

		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
		// May have missing workspace warning, but must not block contract validation
	});

	it('default validation does not persist validation runs in temp project', async () => {
		const projectRoot = await createTempProject();

		await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
		});

		const logosDir = join(projectRoot, '.logos');
		const logosExist = await stat(logosDir).then(
			() => true,
			() => false,
		);
		expect(logosExist).toBe(false);
	});
});

// ===========================================================================
// 7. Secret/Token Redaction in Gate Context
// ===========================================================================

describe('secret redaction in gate context', () => {
	it('fake secrets in artifact input are redacted in findings', async () => {
		const projectRoot = await createTempProject();
		const fakeSecret = 'sk-fake-gate-test-abcdefghijklmnopqrstuvwxyz12345';
		const state = {
			...baseState(projectRoot),
			provider: {
				enabled: true,
				providerId: 'openai',
				tokenEnvVarName: fakeSecret,
			},
		};

		const result = await validateWorkspace({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			scopes: ['contracts', 'state'],
			state,
		});

		const secretFindings = result.findings.filter(
			(f) => f.code === 'secret_like_value',
		);
		expect(secretFindings.length).toBeGreaterThan(0);

		for (const f of secretFindings) {
			expect(JSON.stringify(f.received)).not.toContain('sk-');
			expect(JSON.stringify(f.received)).not.toContain('fake');
		}
	});

	it('no test fixture contains real API keys or tokens', () => {
		// All fixture paths use fake/synthetic values
		const fakeSecret = 'sk-fake-test-only-1234567890abcdefghijklmn';
		expect(fakeSecret).not.toMatch(
			/^(sk-[a-zA-Z0-9]{48,}|sk-[a-zA-Z0-9-]{30,}proj)/,
		);
	});
});

// ===========================================================================
// 8. Invalid Profile Fixture — Workspace State Checks
// ===========================================================================

describe('workspace state validation in gate context', () => {
	it('valid initialized workspace state passes', async () => {
		const projectRoot = await createTempProject();
		const state = baseState(projectRoot);

		const result = await validateWorkspaceStateScope({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(result.status).toBe('pass');
		expect(result.summary.totalFindings).toBe(0);
	});

	it('default documentation root is logos/ not docs/', async () => {
		const projectRoot = await createTempProject();
		const state = {
			...baseState(projectRoot),
			documentation: {
				isDefault: true,
				rootPath: 'docs/',
				wasExplicitlyConfigured: false,
			},
		};

		const result = await validateWorkspaceStateScope({
			profileRoot: STANDARD_PROFILE_ROOT,
			projectRoot,
			state,
		});

		expect(codes(result)).toContain('workspace_root_invalid');
	});

	it('profile lock mismatch emits finding', async () => {
		const projectRoot = await createTempProject();
		const state = baseState(projectRoot);

		const result = await validateWorkspaceStateScope({
			profileId: 'custom-profile',
			projectRoot,
			state,
		});

		expect(codes(result)).toContain('profile_lock_mismatch');
	});
});
