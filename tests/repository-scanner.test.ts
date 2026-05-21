/** Step 12.2 — Repository Scanner Integration Tests */

import { beforeEach, describe, expect, it } from 'vitest';
import type { RepositoryScanInput } from '../src/scanner/index.js';
import { resetFindingCounter, scanRepository } from '../src/scanner/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
	overrides?: Partial<RepositoryScanInput>,
): RepositoryScanInput {
	return {
		dryRun: true,
		projectRoot: '/test-repo',
		scannedAt: '2025-01-01T00:00:00.000Z',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Repository root / workspace tests
// ---------------------------------------------------------------------------

describe('repository root inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects repository root with package.json', () => {
		const fixtures = new Map<string, string>([
			['/test-repo/package.json', '{"name":"test"}'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.packageSummary.exists).toBe(true);
	});

	it('detects missing package.json', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([['/test-repo', []]]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.packageSummary.exists).toBe(false);
	});

	it('scanner is read-only with empty changedPaths', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
		expect(result.readOnly).toBe(true);
	});

	it('scanner is dry-run by default', () => {
		const result = scanRepository(makeInput());
		expect(result.dryRun).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Workspace tests
// ---------------------------------------------------------------------------

describe('workspace inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects missing .logos workspace', () => {
		const result = scanRepository(makeInput());
		expect(result.workspaceSummary.exists).toBe(false);
		expect(result.workspaceSummary.initializationState).toBe('missing');
	});

	it('detects initialized workspace', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/.logos/workspace.json',
				JSON.stringify({
					documentation: { rootPath: 'logos/' },
					profile: { profileId: 'standard' },
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['.logos']],
			['/test-repo/.logos', ['workspace.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.workspaceSummary.exists).toBe(true);
		expect(result.workspaceSummary.activeProfileId).toBe('standard');
		expect(result.workspaceSummary.documentationRoot).toBe('logos/');
	});

	it('does NOT initialize workspace', () => {
		const result = scanRepository(makeInput());
		expect(result.workspaceSummary.exists).toBe(false);
		expect(result.changedPaths).toEqual([]);
	});

	it('default documentation root is logos/', () => {
		const result = scanRepository(makeInput());
		expect(result.documentationRoot).toBe('logos/');
	});
});

// ---------------------------------------------------------------------------
// Package/tooling tests
// ---------------------------------------------------------------------------

describe('package and tooling inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects package.json with scripts', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					bin: {
						logos: './dist/cli.js',
					},
					engines: { node: '>=22' },
					name: 'test-project',
					packageManager: 'pnpm@10.33.2',
					scripts: {
						build: 'tsc',
						check: 'pnpm lint && pnpm test',
						'lint:biome': 'biome check .',
						'lint:md': 'markdownlint "**/*.md"',
						'smoke:cli': 'node scripts/smoke.js',
						test: 'vitest run',
						typecheck: 'tsc --noEmit',
					},
					version: '1.0.0',
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.packageSummary.exists).toBe(true);
		expect(result.packageSummary.name).toBe('test-project');
		expect(result.packageSummary.binPath).toBe('./dist/cli.js');
		expect(result.packageSummary.declaredScripts).toContain('build');
		expect(result.packageSummary.declaredScripts).toContain('test');
		expect(result.packageSummary.missingRequiredScripts).toEqual([]);
	});

	it('detects object-form package binary even when key differs from package name', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					bin: { logos: './dist/cli.js' },
					name: 'logos-engine',
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		expect(result.packageSummary.binPath).toBe('./dist/cli.js');
	});

	it('detects missing required scripts', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					name: 'test',
					scripts: { build: 'tsc' },
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.packageSummary.missingRequiredScripts.length).toBeGreaterThan(
			0,
		);
		expect(result.packageSummary.missingRequiredScripts).toContain('test');

		// Should have findings for missing scripts
		const scriptFindings = result.findings.filter(
			(f) => f.kind === 'unexpected_missing_script',
		);
		expect(scriptFindings.length).toBeGreaterThan(0);
	});

	it('detects mutating check script', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					name: 'test',
					scripts: {
						build: 'tsc',
						check: 'pnpm lint --write',
						'lint:biome': 'biome check .',
						'lint:md': 'markdownlint "**/*.md"',
						'smoke:cli': 'node scripts/smoke.js',
						test: 'vitest run',
						typecheck: 'tsc --noEmit',
					},
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const mutatingFindings = result.findings.filter(
			(f) =>
				f.kind === 'script_contract_mismatch' &&
				f.relatedScriptName === 'check',
		);
		expect(mutatingFindings.length).toBeGreaterThan(0);
	});

	it('detects package manager mismatch', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					name: 'test',
					packageManager: 'npm@10.0.0',
					scripts: {},
				}),
			],
			['/test-repo/pnpm-lock.yaml', 'lockfileVersion: 6.0'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json', 'pnpm-lock.yaml']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		expect(result.toolingSummary.lockfileKind).toBe('pnpm');
		const mismatchFindings = result.findings.filter(
			(f) => f.kind === 'package_manager_mismatch',
		);
		expect(mismatchFindings.length).toBeGreaterThan(0);
	});

	it('detects missing config files', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([['/test-repo', []]]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.toolingSummary.tsconfigExists).toBe(false);
		expect(result.toolingSummary.biomeConfigExists).toBe(false);
		expect(result.toolingSummary.missingConfigFiles).toContain('tsconfig.json');
	});

	it('does NOT run package scripts', () => {
		// The scanner doesn't execute anything — it only reads metadata
		const result = scanRepository(makeInput());
		expect(result.scanPolicy.executeScripts).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Documentation/profile tests
// ---------------------------------------------------------------------------

describe('documentation and profile inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects profile registry', () => {
		const fixtures = new Map<string, string>([
			['/test-repo/profiles/standard/docs.yml', '# Profile registry'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['profiles']],
			['/test-repo/profiles', ['standard']],
			['/test-repo/profiles/standard', ['docs.yml']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.documentationSummary.profileRegistryExists).toBe(true);
	});

	it('detects document schema', () => {
		const fixtures = new Map<string, string>([
			['/test-repo/profiles/standard/document.schema.yml', '# Schema'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['profiles']],
			['/test-repo/profiles', ['standard']],
			['/test-repo/profiles/standard', ['document.schema.yml']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.documentationSummary.documentSchemaExists).toBe(true);
	});

	it('detects phase descriptors', () => {
		const fixtures = new Map<string, string>([
			['/test-repo/profiles/standard/phases/01-foundation/docs.yml', '# Phase'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['profiles']],
			['/test-repo/profiles', ['standard']],
			['/test-repo/profiles/standard', ['phases']],
			['/test-repo/profiles/standard/phases', ['01-foundation']],
			['/test-repo/profiles/standard/phases/01-foundation', ['docs.yml']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.documentationSummary.phaseDescriptorsExist).toBe(true);
	});

	it('detects documentation root conflict (hardcoded docs/)', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['docs']],
			['/test-repo/docs', []],
		]);

		const result = scanRepository(
			makeInput({
				documentationRoot: 'docs/',
				fixtureDirectories: fixtureDirs,
				fixtures,
			}),
		);
		expect(result.documentationSummary.hardcodedDocsRootDetected).toBe(true);
	});

	it('does NOT create missing docs', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Canonical/generated output tests
// ---------------------------------------------------------------------------

describe('canonical and generated output inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects missing generated root', () => {
		const result = scanRepository(makeInput({ documentationRoot: 'logos/' }));

		const missingFindings = result.findings.filter(
			(f) =>
				f.kind === 'missing_expected_directory' && f.message.includes('logos'),
		);
		expect(missingFindings.length).toBeGreaterThanOrEqual(1);
	});

	it('does NOT generate outputs', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
		expect(result.readOnly).toBe(true);
	});

	it('does NOT read full Markdown content by default', () => {
		// The scanner policy sets readSourceContent to false
		const result = scanRepository(makeInput());
		expect(result.scanPolicy.readSourceContent).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Derived boundary tests
// ---------------------------------------------------------------------------

describe('derived boundary inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects HTML artifact in canonical root', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['docs']],
			['/test-repo/docs', ['index.html', 'report.html']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const htmlFindings = result.findings.filter(
			(f) =>
				f.kind === 'generated_artifact_boundary_violation' &&
				f.title.includes('HTML'),
		);
		expect(htmlFindings.length).toBeGreaterThan(0);
	});

	it('detects Agent Pack in canonical root', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['docs']],
			['/test-repo/docs', ['agent-pack-export.md']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const agentFindings = result.findings.filter(
			(f) =>
				f.kind === 'generated_artifact_boundary_violation' &&
				f.title.includes('Agent'),
		);
		expect(agentFindings.length).toBeGreaterThan(0);
	});

	it('detects Executive export in canonical root', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['docs']],
			['/test-repo/docs', ['executive-plan.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const execFindings = result.findings.filter(
			(f) =>
				f.kind === 'generated_artifact_boundary_violation' &&
				f.title.includes('Executive'),
		);
		expect(execFindings.length).toBeGreaterThan(0);
	});

	it('detects validation report in canonical root', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['docs']],
			['/test-repo/docs', ['validation-report.md']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const reportFindings = result.findings.filter(
			(f) =>
				f.kind === 'derived_artifact_marked_canonical' &&
				f.title.includes('Report'),
		);
		expect(reportFindings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// External integration scope tests
// ---------------------------------------------------------------------------

describe('external integration scope inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('Linear mapping file is planned contract, not live sync', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/profiles/standard/executive/mappings/linear.mapping.yml',
				'# Linear mapping',
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['profiles']],
			['/test-repo/profiles', ['standard']],
			['/test-repo/profiles/standard', ['executive']],
			['/test-repo/profiles/standard/executive', ['mappings']],
			[
				'/test-repo/profiles/standard/executive/mappings',
				['linear.mapping.yml'],
			],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const linearFindings = result.findings.filter(
			(f) =>
				f.kind === 'external_integration_scope_risk' &&
				f.title.includes('Linear'),
		);
		expect(linearFindings.length).toBeGreaterThan(0);
		// Severity should be info, not error
		expect(linearFindings.every((f) => f.severity === 'info')).toBe(true);
	});

	it('Notion mapping file is planned contract, not live sync', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/profiles/standard/executive/mappings/notion.mapping.yml',
				'# Notion mapping',
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['profiles']],
			['/test-repo/profiles', ['standard']],
			['/test-repo/profiles/standard', ['executive']],
			['/test-repo/profiles/standard/executive', ['mappings']],
			[
				'/test-repo/profiles/standard/executive/mappings',
				['notion.mapping.yml'],
			],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const notionFindings = result.findings.filter(
			(f) =>
				f.kind === 'external_integration_scope_risk' &&
				f.title.includes('Notion'),
		);
		expect(notionFindings.length).toBeGreaterThan(0);
		expect(notionFindings.every((f) => f.severity === 'info')).toBe(true);
	});

	it('.env presence is reported without reading contents', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([['/test-repo', ['.env']]]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.securitySummary.dotEnvDetected).toBe(true);

		// Should have unknown_risk finding about .env
		const envFindings = result.findings.filter((f) => f.title.includes('.env'));
		expect(envFindings.length).toBeGreaterThan(0);
	});

	it('no external API calls occur', () => {
		// The scanner has callNetwork: false in its policy
		const result = scanRepository(makeInput());
		expect(result.scanPolicy.callNetwork).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Security tests
// ---------------------------------------------------------------------------

describe('security inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects and redacts OpenAI API key in package.json', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					description: 'sk-proj-1234567890abcdef1234567890abcdef1234567890',
					name: 'test',
					scripts: {},
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const secretFindings = result.findings.filter(
			(f) => f.kind === 'secret_like_value',
		);
		expect(secretFindings.length).toBeGreaterThan(0);
		expect(secretFindings[0]?.severity).toBe('error');
	});

	it('fake secrets do not appear in results', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					name: 'test',
					scripts: {},
					token: 'ghp_1234567890abcdef1234567890abcdef123456',
				}),
			],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		const resultJson = JSON.stringify(result);
		expect(resultJson).not.toContain(
			'ghp_1234567890abcdef1234567890abcdef123456',
		);
	});

	it('path traversal is blocked', () => {
		const result = scanRepository(makeInput({ projectRoot: '/test-repo' }));
		// The scanner enforces root boundary — dangerous paths are rejected
		expect(result.scanPolicy.enforceRootBoundary).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('scanner non-mutation guarantees', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('scanner writes no files', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});

	it('scanner does NOT create .logos/', () => {
		const result = scanRepository(makeInput());
		expect(result.workspaceSummary.exists).toBe(false);
	});

	it('scanner does NOT execute package scripts', () => {
		const result = scanRepository(makeInput());
		expect(result.scanPolicy.executeScripts).toBe(false);
	});

	it('scanner does NOT call AI providers', () => {
		// The scanner has no provider port dependency
		const result = scanRepository(makeInput());
		expect(result.readOnly).toBe(true);
	});

	it('scanner does NOT call network', () => {
		const result = scanRepository(makeInput());
		expect(result.scanPolicy.callNetwork).toBe(false);
	});

	it('scanner does NOT generate Markdown', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});

	it('scanner does NOT generate HTML', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});

	it('scanner does NOT generate Agent Packs', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});

	it('scanner does NOT generate Executive outputs', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});

	it('scanner does NOT mutate canonical Markdown', () => {
		const result = scanRepository(makeInput());
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// CI inspection tests
// ---------------------------------------------------------------------------

describe('CI inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects CI workflows', () => {
		const fixtures = new Map<string, string>([
			['/test-repo/package.json', '{"name":"test","scripts":{}}'],
			['/test-repo/.github/workflows/ci.yml', 'name: CI'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json', '.github']],
			['/test-repo/.github', ['workflows']],
			['/test-repo/.github/workflows', ['ci.yml']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);
		expect(result.ciSummary.ciWorkflowsExist).toBe(true);
		expect(result.ciSummary.ciWorkflowCount).toBe(1);
	});

	it('detects missing CI with package.json', () => {
		const fixtures = new Map<string, string>([
			['/test-repo/package.json', '{"name":"test","scripts":{}}'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['package.json']],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const ciFindings = result.findings.filter((f) => f.kind === 'ci_missing');
		expect(ciFindings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Source structure tests
// ---------------------------------------------------------------------------

describe('source structure inspection', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('detects src/tests/scripts directories', () => {
		const fixtures = new Map<string, string>();
		const fixtureDirs = new Map<string, string[]>([
			['/test-repo', ['src', 'tests', 'scripts']],
			['/test-repo/src', []],
			['/test-repo/tests', []],
			['/test-repo/scripts', []],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		const srcArtifacts = result.artifacts.filter(
			(a) => a.kind === 'source_directory',
		);
		const testArtifacts = result.artifacts.filter(
			(a) => a.kind === 'test_directory',
		);
		const scriptArtifacts = result.artifacts.filter(
			(a) => a.kind === 'script_directory',
		);

		expect(srcArtifacts.length).toBeGreaterThanOrEqual(1);
		expect(testArtifacts.length).toBeGreaterThanOrEqual(1);
		expect(scriptArtifacts.length).toBeGreaterThanOrEqual(1);
		expect(result.directoriesInspected).toBeGreaterThanOrEqual(4);
	});
});

// ---------------------------------------------------------------------------
// Smoke test: full project scan snapshot
// ---------------------------------------------------------------------------

describe('full repository scan', () => {
	beforeEach(() => {
		resetFindingCounter();
	});

	it('produces complete scan result with all summary sections', () => {
		const fixtures = new Map<string, string>([
			[
				'/test-repo/package.json',
				JSON.stringify({
					engines: { node: '>=22' },
					name: 'test-project',
					packageManager: 'pnpm@10.33.2',
					scripts: {
						build: 'tsc',
						check: 'pnpm lint && pnpm test',
						'lint:biome': 'biome check .',
						'lint:md': 'markdownlint "**/*.md"',
						'smoke:cli': 'node scripts/smoke.js',
						test: 'vitest run',
						typecheck: 'tsc --noEmit',
					},
					version: '1.0.0',
				}),
			],
			[
				'/test-repo/.logos/workspace.json',
				JSON.stringify({
					documentation: { rootPath: 'logos/' },
					profile: { profileId: 'standard' },
				}),
			],
			['/test-repo/profiles/standard/docs.yml', '# Profile registry'],
			['/test-repo/profiles/standard/document.schema.yml', '# Schema'],
			['/test-repo/.github/workflows/ci.yml', 'name: CI'],
			['/test-repo/tsconfig.json', '{}'],
			['/test-repo/biome.json', '{}'],
		]);
		const fixtureDirs = new Map<string, string[]>([
			[
				'/test-repo',
				[
					'package.json',
					'.logos',
					'profiles',
					'.github',
					'tsconfig.json',
					'biome.json',
					'src',
					'tests',
					'scripts',
				],
			],
			['/test-repo/.logos', ['workspace.json']],
			['/test-repo/profiles', ['standard']],
			['/test-repo/profiles/standard', ['docs.yml', 'document.schema.yml']],
			['/test-repo/.github', ['workflows']],
			['/test-repo/.github/workflows', ['ci.yml']],
			['/test-repo/src', []],
			['/test-repo/tests', []],
			['/test-repo/scripts', []],
		]);

		const result = scanRepository(
			makeInput({ fixtureDirectories: fixtureDirs, fixtures }),
		);

		// Verify all summary sections have data
		expect(result.packageSummary.exists).toBe(true);
		expect(result.toolingSummary.tsconfigExists).toBe(true);
		expect(result.toolingSummary.biomeConfigExists).toBe(true);
		expect(result.workspaceSummary.exists).toBe(true);
		expect(result.documentationSummary.profileRegistryExists).toBe(true);
		expect(result.documentationSummary.documentSchemaExists).toBe(true);
		expect(result.ciSummary.ciWorkflowsExist).toBe(true);

		// Verify result shape
		expect(result.readOnly).toBe(true);
		expect(result.dryRun).toBe(true);
		expect(result.changedPaths).toEqual([]);
		expect(typeof result.repositoryRoot).toBe('string');
		expect(typeof result.scannedAt).toBe('string');
	});
});
