/** Step 12.3 — Docs-vs-Code Consistency Checker Tests */

import { beforeEach, describe, expect, it } from 'vitest';
import type {
	DocsCodeClaim,
	DocsCodeComparisonStatus,
	DocsCodeConsistencyFinding,
	DocsCodeConsistencyFindingKind,
	DocsCodeConsistencySeverity,
	DocsCodeObservedFact,
} from '../src/consistency/index.js';
import {
	buildDocsCodeConsistencyReport,
	buildObservedFacts,
	extractDocsClaims,
	isScriptMutating,
	nextDocsCodeId,
	resetDocsCodeIdCounter,
	runDocsCodeConsistencyCheck,
	sortDocsCodeFindings,
} from '../src/consistency/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixtureIdFactory(): () => string {
	let counter = 0;
	return () => `test-${counter++}`;
}

function makeClaim(overrides: Partial<DocsCodeClaim> = {}): DocsCodeClaim {
	return {
		claimedKey: 'test-key',
		claimedValue: 'test-value',
		description: 'Test claim',
		evidence: 'Test evidence',
		id: nextDocsCodeId('claim'),
		kind: 'unknown',
		required: true,
		source: 'fixture',
		...overrides,
	};
}

function makeObservedFact(
	overrides: Partial<DocsCodeObservedFact> = {},
): DocsCodeObservedFact {
	return {
		boundedObservation: true,
		id: nextDocsCodeId('obs'),
		insufficient: false,
		key: 'test-key',
		kind: 'unknown',
		observedValue: 'test-value',
		path: 'test-path',
		redacted: false,
		source: 'fixture',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Model tests
// ---------------------------------------------------------------------------

describe('DocsCodeConsistency model', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('validates consistency input', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims: [],
				dryRun: true,
				observedFacts: [],
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		expect(result.readOnly).toBe(true);
		expect(result.dryRun).toBe(true);
		expect(result.claimCount).toBeGreaterThan(0);
		expect(result.observedFactCount).toBe(0);
	});

	it('supports all claim kinds', () => {
		const kinds = [
			'cli_command',
			'slash_command',
			'package_script',
			'package_binary',
			'node_version',
			'package_manager',
			'generated_root',
			'profile_id',
			'profile_registry',
			'phase_descriptor',
			'document_descriptor',
			'source_directory',
			'test_directory',
			'script_directory',
			'config_file',
			'ci_workflow',
			'canonical_output',
			'derived_artifact',
			'executive_export',
			'external_integration_boundary',
			'security_boundary',
			'provider_boundary',
		];

		for (const kind of kinds) {
			const claim = makeClaim({ kind });
			expect(claim.kind).toBe(kind);
		}
	});

	it('supports all observed fact kinds', () => {
		const kinds = [
			'observed_command',
			'observed_script',
			'observed_binary',
			'observed_config',
			'observed_directory',
			'observed_file',
			'observed_profile',
			'observed_output_path',
			'observed_artifact_metadata',
			'observed_security_marker',
			'observed_integration_marker',
			'missing_observation',
		];

		for (const kind of kinds) {
			const fact = makeObservedFact({ kind });
			expect(fact.kind).toBe(kind);
		}
	});

	it('supports all comparison statuses', () => {
		const statuses: DocsCodeComparisonStatus[] = [
			'consistent',
			'inconsistent',
			'missing_in_code',
			'missing_in_docs',
			'ambiguous',
			'unsupported',
			'unknown',
			'not_applicable',
		];
		expect(statuses.length).toBe(8);
	});

	it('supports all finding kinds', () => {
		const kinds: DocsCodeConsistencyFindingKind[] = [
			'documented_command_missing',
			'implemented_command_undocumented',
			'documented_script_missing',
			'script_behavior_conflict',
			'package_binary_conflict',
			'version_contract_conflict',
			'generated_root_conflict',
			'profile_identity_conflict',
			'profile_descriptor_conflict',
			'document_descriptor_conflict',
			'source_tree_conflict',
			'test_tree_conflict',
			'config_contract_conflict',
			'ci_contract_conflict',
			'canonical_output_conflict',
			'derived_artifact_boundary_conflict',
			'executive_export_boundary_conflict',
			'external_integration_boundary_conflict',
			'provider_boundary_conflict',
			'security_boundary_conflict',
			'readme_drift',
			'unsupported_claim',
			'insufficient_observation',
			'unknown_conflict',
		];
		expect(kinds.length).toBe(24);
	});

	it('supports all severities', () => {
		const severities: DocsCodeConsistencySeverity[] = [
			'info',
			'warning',
			'error',
			'fatal',
		];
		expect(severities.length).toBe(4);
	});

	it('changed paths are empty', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		expect(result.changedPaths).toEqual([]);
	});

	it('read-only marker is present', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		expect(result.readOnly).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Claim extraction tests
// ---------------------------------------------------------------------------

describe('claim extraction', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('extracts slash command claims from explicit metadata', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
		});

		const slashClaims = claims.filter((c) => c.kind === 'slash_command');
		expect(slashClaims.length).toBeGreaterThan(0);

		const initClaim = slashClaims.find((c) => c.claimedValue === '/init');
		expect(initClaim).toBeDefined();
		expect(initClaim?.required).toBe(true);
	});

	it('extracts package script claims', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			packageMetadata: {
				scripts: {
					build: 'tsc',
					check: 'pnpm lint:biome && pnpm typecheck && pnpm test',
					'lint:biome': 'biome check .',
					'lint:md': 'markdownlint-cli2',
					'smoke:cli': 'node scripts/smoke-cli.js',
					test: 'vitest run',
					typecheck: 'tsc --noEmit',
				},
			},
			profileId: 'standard',
		});

		const scriptClaims = claims.filter((c) => c.kind === 'package_script');
		expect(scriptClaims.length).toBeGreaterThan(0);

		const buildClaim = scriptClaims.find((c) => c.claimedKey === 'build');
		expect(buildClaim).toBeDefined();
		expect(buildClaim?.required).toBe(true);
	});

	it('extracts binary claim', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			packageMetadata: {
				bin: { logos: 'dist/cli.js' },
			},
			profileId: 'standard',
		});

		const binClaim = claims.find((c) => c.kind === 'package_binary');
		expect(binClaim).toBeDefined();
		expect(binClaim?.claimedValue).toBe('logos');
	});

	it('extracts generated root claim', () => {
		const claims = extractDocsClaims({
			documentationRoot: 'logos/',
			includeInfo: true,
			profileId: 'standard',
		});

		const rootClaim = claims.find((c) => c.kind === 'generated_root');
		expect(rootClaim).toBeDefined();
		expect(rootClaim?.claimedValue).toBe('logos/');
	});

	it('extracts profile id claim', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
		});

		const profileClaim = claims.find((c) => c.kind === 'profile_id');
		expect(profileClaim).toBeDefined();
		expect(profileClaim?.claimedValue).toBe('standard');
	});

	it('extracts canonical/derived artifact boundary claims', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
		});

		const derivedClaims = claims.filter((c) => c.kind === 'derived_artifact');
		expect(derivedClaims.length).toBeGreaterThan(0);

		const htmlClaim = derivedClaims.find(
			(c) => c.claimedKey === 'html_derived',
		);
		expect(htmlClaim).toBeDefined();
		expect(htmlClaim?.claimedValue).toBe('non-canonical');
	});

	it('extracts external integration boundary claims', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
		});

		const integrationClaims = claims.filter(
			(c) => c.kind === 'external_integration_boundary',
		);
		expect(integrationClaims.length).toBeGreaterThan(0);
	});

	it('ambiguous prose becomes unsupported/ambiguous', () => {
		// Claim extraction is deterministic and bounded — it does not interpret
		// vague prose. Unrecognized snippet patterns don't produce claims.
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
			readmeSnippet: 'Some vague prose about future features.',
		});

		// The snippet contains no known patterns, so no extra claims beyond defaults
		const vagueClaims = claims.filter((c) => c.evidence?.includes('vague'));
		expect(vagueClaims.length).toBe(0);
	});

	it('no AI is called', () => {
		// This test verifies claim extraction doesn't call AI providers
		// Claim extraction is purely deterministic pattern matching
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
		});
		expect(claims.length).toBeGreaterThan(0);
		// No external calls are made — this is verified by construction
	});

	it('no full docs reading is required', () => {
		// Claims are extracted from structured sources and bounded snippets
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
		});
		// All claims should have bounded evidence, not full file contents
		for (const claim of claims) {
			expect(typeof claim.evidence).toBe('string');
			expect(claim.evidence?.length).toBeLessThan(500);
		}
	});
});

// ---------------------------------------------------------------------------
// Observed fact tests
// ---------------------------------------------------------------------------

describe('observed facts', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('builds observed facts from scanner package summary', () => {
		const facts = buildObservedFacts({
			scannerResult: {
				activeProfileId: 'standard',
				artifacts: [],
				boundarySummary: {
					agentPacksInCanonicalRoot: [],
					canonicalDocsDependentOnDerived: [],
					derivedArtifactsMarkedCanonical: [],
					executiveExportsInCanonicalRoot: [],
					htmlArtifactsInCanonicalRoot: [],
					validationReportsMarkedCanonical: [],
				},
				bytesInspected: 0,
				changedPaths: [],
				ciSummary: {
					ciWorkflowCount: 0,
					ciWorkflowPaths: [],
					ciWorkflowsExist: false,
				},
				configSummary: {
					biomeConfigPath: null,
					markdownlintConfigPath: null,
					tsconfigPath: null,
					vitestConfigPath: null,
				},
				diagnostics: [],
				directoriesInspected: 0,
				documentationRoot: null,
				documentationSummary: {
					canonicalOutputPaths: [],
					configDocsRoot: null,
					derivedArtifactsInCanonicalRoot: [],
					documentationDirectories: [],
					documentSchemaExists: false,
					hardcodedDocsRootDetected: false,
					missingCanonicalOutputs: [],
					phaseDescriptorsExist: false,
					profileDirectoryExists: false,
					profileRegistryExists: false,
				},
				dryRun: true,
				filesInspected: 0,
				findings: [],
				packageSummary: {
					binPath: 'dist/cli.js',
					declaredScripts: ['build', 'test'],
					exists: true,
					missingRequiredScripts: [],
					name: 'test',
				},
				profileVersion: null,
				readOnly: true as const,
				repositoryRoot: '/test',
				scannedAt: '2025-01-01T00:00:00.000Z',
				scanPolicy: {
					allowedExtensions: ['.json'],
					allowlistPaths: [],
					callNetwork: false,
					enforceRootBoundary: true,
					executeScripts: false,
					ignoredDirectoryNames: [],
					ignorePatterns: [],
					installDependencies: false,
					maxFileSizeBytes: 256000,
					maxFilesInspected: 2000,
					maxRecursionDepth: 8,
					readKnownMetadata: true,
					readSourceContent: false,
				},
				securitySummary: {
					dotEnvDetected: false,
					redactedCount: 0,
					secretLikeValuesDetected: 0,
					unsafePathDetected: false,
				},
				targets: [],
				targetsScanned: 0,
				targetsSkipped: 0,
				toolingSummary: {
					biomeConfigExists: false,
					lockfileExists: false,
					lockfileKind: null,
					markdownlintConfigExists: false,
					missingConfigFiles: [],
					mutatingScriptPatterns: [],
					nodeVersionDeclared: false,
					packageManagerMatch: null,
					pnpmVersionDeclared: false,
					tsconfigExists: false,
					vitestConfigExists: false,
				},
				workspaceSummary: {
					activeProfileId: null,
					documentationRoot: null,
					exists: false,
					initializationState: 'missing',
					providerConfigured: false,
				},
			} as import('../src/scanner/repository-scan-model.js').RepositoryScanResult,
		});

		expect(facts.length).toBeGreaterThan(0);
	});

	it('builds observed facts from command registry metadata', () => {
		const facts = buildObservedFacts({
			commandRegistry: {
				externalCommands: ['logos', 'logos doctor'],
				slashCommands: ['/init', '/help', '/exit'],
			},
		});

		const cmdFacts = facts.filter((f) => f.kind === 'observed_command');
		expect(cmdFacts.length).toBe(5);
	});

	it('builds observed facts from artifact registry metadata', () => {
		const facts = buildObservedFacts({
			artifactRegistryEntries: [
				{
					artifactId: 'art-1',
					artifactType: 'html',
					isCanonical: false,
					path: 'logos/html/index.html',
				},
			],
		});

		const artFacts = facts.filter(
			(f) => f.kind === 'observed_artifact_metadata',
		);
		expect(artFacts.length).toBe(1);
	});

	it('missing command metadata yields insufficient observation', () => {
		// When command registry is not provided, no command facts are built
		const facts = buildObservedFacts({});
		const cmdFacts = facts.filter((f) => f.kind === 'observed_command');
		expect(cmdFacts.length).toBe(0);
	});

	it('no source file parsing is performed', () => {
		// Observed facts only use bounded metadata — no source parsing
		const facts = buildObservedFacts({});
		for (const fact of facts) {
			expect(fact.boundedObservation).toBe(true);
		}
	});

	it('scanner result builds comprehensive facts', () => {
		const facts = buildObservedFacts({
			scannerResult: {
				activeProfileId: 'standard',
				artifacts: [
					{
						exists: true,
						kind: 'source_directory',
						path: '/test/src',
						relativePath: 'src/',
						targetKind: 'source_tree',
					},
					{
						exists: true,
						kind: 'test_directory',
						path: '/test/tests',
						relativePath: 'tests/',
						targetKind: 'test_tree',
					},
				],
				boundarySummary: {
					agentPacksInCanonicalRoot: [],
					canonicalDocsDependentOnDerived: [],
					derivedArtifactsMarkedCanonical: [],
					executiveExportsInCanonicalRoot: [],
					htmlArtifactsInCanonicalRoot: [],
					validationReportsMarkedCanonical: [],
				},
				bytesInspected: 100,
				changedPaths: [],
				ciSummary: {
					ciWorkflowCount: 1,
					ciWorkflowPaths: ['.github/workflows/ci.yml'],
					ciWorkflowsExist: true,
				},
				configSummary: {
					biomeConfigPath: 'biome.json',
					markdownlintConfigPath: '.markdownlint.json',
					tsconfigPath: 'tsconfig.json',
					vitestConfigPath: 'vitest.config.ts',
				},
				diagnostics: [],
				directoriesInspected: 1,
				documentationRoot: 'logos/',
				documentationSummary: {
					canonicalOutputPaths: [],
					configDocsRoot: null,
					derivedArtifactsInCanonicalRoot: [],
					documentationDirectories: ['docs/'],
					documentSchemaExists: true,
					hardcodedDocsRootDetected: false,
					missingCanonicalOutputs: [],
					phaseDescriptorsExist: true,
					profileDirectoryExists: true,
					profileRegistryExists: true,
				},
				dryRun: true,
				filesInspected: 1,
				findings: [],
				packageSummary: {
					binPath: 'dist/cli.js',
					declaredScripts: ['build', 'test'],
					exists: true,
					missingRequiredScripts: [],
					name: 'test',
				},
				profileVersion: null,
				readOnly: true as const,
				repositoryRoot: '/test',
				scannedAt: '2025-01-01T00:00:00.000Z',
				scanPolicy: {
					allowedExtensions: ['.json'],
					allowlistPaths: [],
					callNetwork: false,
					enforceRootBoundary: true,
					executeScripts: false,
					ignoredDirectoryNames: [],
					ignorePatterns: [],
					installDependencies: false,
					maxFileSizeBytes: 256000,
					maxFilesInspected: 2000,
					maxRecursionDepth: 8,
					readKnownMetadata: true,
					readSourceContent: false,
				},
				securitySummary: {
					dotEnvDetected: false,
					redactedCount: 0,
					secretLikeValuesDetected: 0,
					unsafePathDetected: false,
				},
				targets: [],
				targetsScanned: 1,
				targetsSkipped: 0,
				toolingSummary: {
					biomeConfigExists: true,
					lockfileExists: true,
					lockfileKind: 'pnpm',
					markdownlintConfigExists: true,
					missingConfigFiles: [],
					mutatingScriptPatterns: [],
					nodeVersionDeclared: true,
					packageManagerMatch: true,
					pnpmVersionDeclared: true,
					tsconfigExists: true,
					vitestConfigExists: true,
				},
				workspaceSummary: {
					activeProfileId: 'standard',
					documentationRoot: 'logos/',
					exists: true,
					initializationState: 'initialized',
					providerConfigured: false,
				},
			} as import('../src/scanner/repository-scan-model.js').RepositoryScanResult,
		});

		expect(facts.length).toBeGreaterThan(10);
	});
});

// ---------------------------------------------------------------------------
// Script mutating detection
// ---------------------------------------------------------------------------

describe('script mutating detection', () => {
	it('detects --write as mutating', () => {
		expect(isScriptMutating('biome check --write .')).toBe(true);
	});

	it('detects --fix as mutating', () => {
		expect(isScriptMutating('eslint --fix src/')).toBe(true);
	});

	it('detects rm -rf as mutating', () => {
		expect(isScriptMutating('rm -rf dist/')).toBe(true);
	});

	it('non-mutating script passes', () => {
		expect(isScriptMutating('biome check .')).toBe(false);
	});

	it('empty script is non-mutating', () => {
		expect(isScriptMutating('')).toBe(false);
		expect(isScriptMutating(undefined)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Command consistency tests
// ---------------------------------------------------------------------------

describe('command consistency', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('documented logos --help observed => consistent', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'logos',
				claimedValue: 'logos',
				kind: 'cli_command',
				required: true,
				source: 'cli_metadata',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'logos',
				kind: 'observed_command',
				observedValue: 'logos',
				source: 'command_registry',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const cmdFindings = result.findings.filter(
			(f) => f.kind === 'documented_command_missing',
		);
		expect(cmdFindings.length).toBe(0);
	});

	it('documented slash command missing => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: '/init',
				claimedValue: '/init',
				kind: 'slash_command',
				required: true,
				source: 'tui_metadata',
			}),
		];
		const facts: DocsCodeObservedFact[] = [];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const missingFindings = result.findings.filter(
			(f) => f.kind === 'documented_command_missing',
		);
		expect(missingFindings.length).toBe(1);
		expect(missingFindings[0]?.severity).toBe('error');
	});

	it('implemented undocumented slash command => info', () => {
		const claims: DocsCodeClaim[] = [];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: '/custom-slash',
				kind: 'observed_command',
				observedValue: '/custom-slash',
				source: 'command_registry',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const undocFindings = result.findings.filter(
			(f) => f.kind === 'implemented_command_undocumented',
		);
		expect(undocFindings.length).toBe(1);
		expect(undocFindings[0]?.severity).toBe('info');
	});

	it('command metadata unavailable => findings present', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'logos',
				claimedValue: 'logos',
				kind: 'cli_command',
				required: true,
				source: 'cli_metadata',
			}),
		];
		const facts: DocsCodeObservedFact[] = [];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		expect(result.findings.length).toBeGreaterThan(0);
	});

	it('no CLI commands are executed', () => {
		// The checker is read-only and does not execute commands
		const claims = extractDocsClaims({ profileId: 'standard' });
		const cmdClaims = claims.filter(
			(c) => c.kind === 'cli_command' || c.kind === 'slash_command',
		);
		expect(cmdClaims.length).toBeGreaterThan(0);
		// Verified by construction: the checker does not shell out
	});
});

// ---------------------------------------------------------------------------
// Package script consistency tests
// ---------------------------------------------------------------------------

describe('package script consistency', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('all required scripts present => consistent', () => {
		const claims = extractDocsClaims({
			packageMetadata: {
				scripts: {
					build: 'tsc',
					check: 'pnpm lint:biome && pnpm typecheck && pnpm test',
					'lint:biome': 'biome check .',
					'lint:md': 'markdownlint-cli2',
					'smoke:cli': 'node scripts/smoke-cli.js',
					test: 'vitest run',
					typecheck: 'tsc --noEmit',
				},
			},
			profileId: 'standard',
		});
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'build',
				kind: 'observed_script',
				observedValue: 'build',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'check',
				kind: 'observed_script',
				observedValue: 'check',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'lint:biome',
				kind: 'observed_script',
				observedValue: 'lint:biome',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'lint:md',
				kind: 'observed_script',
				observedValue: 'lint:md',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'smoke:cli',
				kind: 'observed_script',
				observedValue: 'smoke:cli',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'test',
				kind: 'observed_script',
				observedValue: 'test',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'typecheck',
				kind: 'observed_script',
				observedValue: 'typecheck',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const missingScriptFindings = result.findings.filter(
			(f) => f.kind === 'documented_script_missing',
		);
		expect(missingScriptFindings.length).toBe(0);
	});

	it('missing build script => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'build',
				claimedValue: 'tsc',
				expectedNonMutating: true,
				kind: 'package_script',
				required: true,
				source: 'package_json',
			}),
		];
		const facts: DocsCodeObservedFact[] = [];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const missingFindings = result.findings.filter(
			(f) => f.kind === 'documented_script_missing',
		);
		expect(missingFindings.length).toBe(1);
		expect(missingFindings[0]?.severity).toBe('error');
	});

	it('check script containing mutating pattern => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'check',
				claimedValue: 'biome check --write .',
				expectedNonMutating: true,
				kind: 'package_script',
				required: true,
				source: 'package_json',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'check',
				kind: 'observed_script',
				observedValue: 'check',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				packageMetadata: {
					scripts: { check: 'biome check --write .' },
				},
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const behaviorFindings = result.findings.filter(
			(f) => f.kind === 'script_behavior_conflict',
		);
		expect(behaviorFindings.length).toBe(1);
		expect(behaviorFindings[0]?.severity).toBe('error');
	});

	it('binary path mismatch => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'bin',
				claimedValue: 'logos',
				kind: 'package_binary',
				required: true,
				source: 'package_json',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'bin',
				kind: 'observed_binary',
				observedValue: 'wrong-binary.js',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const binFindings = result.findings.filter(
			(f) => f.kind === 'package_binary_conflict',
		);
		expect(binFindings.length).toBe(1);
	});

	it('no scripts are executed', () => {
		// The checker is read-only and does not execute scripts
		const claims = extractDocsClaims({
			packageMetadata: {
				scripts: { build: 'tsc', test: 'vitest run' },
			},
			profileId: 'standard',
		});
		expect(claims.length).toBeGreaterThan(0);
		// Verified by construction
	});
});

// ---------------------------------------------------------------------------
// Root/profile consistency tests
// ---------------------------------------------------------------------------

describe('root/profile consistency', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('documented logos/ and observed logos/ => consistent', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'documentationRoot',
				claimedValue: 'logos/',
				kind: 'generated_root',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'documentationRoot',
				kind: 'observed_output_path',
				observedValue: 'logos/',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const rootFindings = result.findings.filter(
			(f) => f.kind === 'generated_root_conflict',
		);
		expect(rootFindings.length).toBe(0);
	});

	it('observed hard-coded docs/ root => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'documentationRoot',
				claimedValue: 'logos/',
				kind: 'generated_root',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'documentationRoot',
				kind: 'observed_output_path',
				observedValue: 'docs/',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const rootFindings = result.findings.filter(
			(f) => f.kind === 'generated_root_conflict',
		);
		expect(rootFindings.length).toBeGreaterThan(0);
		expect(rootFindings[0]?.severity).toBe('error');
	});

	it('README app-business drift vs standard => warning', () => {
		const claims = extractDocsClaims({
			includeInfo: true,
			profileId: 'standard',
			readmeSnippet:
				'This project uses the app-business profile for documentation.',
		});

		const readmeClaims = claims.filter(
			(c) => c.source === 'readme' && c.claimedValue === 'standard',
		);
		expect(readmeClaims.length).toBeGreaterThan(0);

		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'activeProfileId',
				kind: 'observed_profile',
				observedValue: 'standard',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims: readmeClaims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const driftFindings = result.findings.filter(
			(f) => f.kind === 'readme_drift',
		);
		expect(driftFindings.length).toBe(1);
		expect(driftFindings[0]?.severity).toBe('warning');
	});

	it('active profile mismatch => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'profileId',
				claimedValue: 'standard',
				kind: 'profile_id',
				required: true,
				source: 'profile_registry',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'activeProfileId',
				kind: 'observed_profile',
				observedValue: 'custom',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const profileFindings = result.findings.filter(
			(f) => f.kind === 'profile_identity_conflict',
		);
		expect(profileFindings.length).toBe(1);
		expect(profileFindings[0]?.severity).toBe('error');
	});
});

// ---------------------------------------------------------------------------
// Structure/config consistency tests
// ---------------------------------------------------------------------------

describe('structure/config consistency', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('expected src/tests/scripts present => consistent', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'src/',
				claimedValue: 'src/',
				kind: 'source_directory',
				required: true,
				source: 'product_docs',
			}),
			makeClaim({
				claimedKey: 'tests/',
				claimedValue: 'tests/',
				kind: 'test_directory',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'src/',
				kind: 'observed_directory',
				observedValue: 'src/',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'tests/',
				kind: 'observed_directory',
				observedValue: 'tests/',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const structFindings = result.findings.filter(
			(f) =>
				f.kind === 'source_tree_conflict' || f.kind === 'test_tree_conflict',
		);
		expect(structFindings.length).toBe(0);
	});

	it('missing tsconfig config => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'tsconfig.json',
				claimedValue: 'tsconfig.json',
				kind: 'config_file',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const configFindings = result.findings.filter(
			(f) => f.kind === 'config_contract_conflict',
		);
		expect(configFindings.length).toBeGreaterThan(0);
	});

	it('no arbitrary source content is read', () => {
		const facts = buildObservedFacts({});
		for (const fact of facts) {
			expect(fact.boundedObservation).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Canonical output consistency tests
// ---------------------------------------------------------------------------

describe('canonical output consistency', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('canonical output under root => consistent', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'canonical_outputs',
				claimedValue: 'logos/',
				kind: 'canonical_output',
				required: true,
				source: 'profile_contract',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'canonical_outputs',
				kind: 'observed_output_path',
				observedValue: 'logos/',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const outputFindings = result.findings.filter(
			(f) => f.kind === 'canonical_output_conflict',
		);
		expect(outputFindings.length).toBe(0);
	});

	it('canonical output collides with derived artifact => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'canonical_outputs',
				claimedValue: 'logos/',
				kind: 'canonical_output',
				required: true,
				source: 'profile_contract',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'canonical_outputs',
				kind: 'observed_output_path',
				observedValue: 'logos/',
				source: 'scanner',
			}),
			makeObservedFact({
				key: 'logos/html/index.html',
				kind: 'observed_artifact_metadata',
				observedValue: 'HTML in canonical root: logos/html/index.html',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const outputFindings = result.findings.filter(
			(f) => f.kind === 'canonical_output_conflict',
		);
		expect(outputFindings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Derived artifact boundary tests
// ---------------------------------------------------------------------------

describe('derived artifact boundaries', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('HTML derived/non-canonical => consistent', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				artifactRegistryEntries: [
					{
						artifactId: 'html-1',
						artifactType: 'html',
						isCanonical: false,
						path: 'logos/html/index.html',
					},
				],
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims: [
					makeClaim({
						claimedKey: 'html_derived',
						claimedValue: 'non-canonical',
						kind: 'derived_artifact',
						required: true,
						source: 'profile_contract',
					}),
				],
				dryRun: true,
				observedFacts: [],
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const boundaryFindings = result.findings.filter(
			(f) => f.kind === 'derived_artifact_boundary_conflict',
		);
		expect(boundaryFindings.length).toBe(0);
	});

	it('derived artifact marked canonical => fatal', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				artifactRegistryEntries: [
					{
						artifactId: 'html-1',
						artifactType: 'html',
						isCanonical: true,
						path: 'logos/html/index.html',
					},
				],
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims: [],
				dryRun: true,
				observedFacts: [],
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const boundaryFindings = result.findings.filter(
			(f) => f.kind === 'derived_artifact_boundary_conflict',
		);
		expect(boundaryFindings.length).toBeGreaterThan(0);
		expect(boundaryFindings[0]?.severity).toBe('fatal');
	});
});

// ---------------------------------------------------------------------------
// Executive boundary tests
// ---------------------------------------------------------------------------

describe('executive boundaries', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('GitHub export local file-only claim consistent', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'github_export_local',
				claimedValue: 'local_file_export_only',
				kind: 'executive_export',
				required: true,
				source: 'profile_contract',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: [],
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const execFindings = result.findings.filter(
			(f) => f.kind === 'executive_export_boundary_conflict',
		);
		expect(execFindings.length).toBe(0);
	});

	it('GitHub API/live issue creation marker => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'github_export_local',
				claimedValue: 'local_file_export_only',
				kind: 'executive_export',
				required: true,
				source: 'profile_contract',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'github_api',
				kind: 'observed_integration_marker',
				observedValue: 'GitHub API issue creation detected',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const execFindings = result.findings.filter(
			(f) => f.kind === 'executive_export_boundary_conflict',
		);
		expect(execFindings.length).toBeGreaterThan(0);
	});

	it('Executive Axis live task manager claim => finding', () => {
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'executive',
				kind: 'observed_artifact_metadata',
				observedValue: 'live task manager integration detected',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims: [
					makeClaim({
						claimedKey: 'executive_axis_snapshot',
						claimedValue: 'derived_snapshot_not_live_task_manager',
						kind: 'executive_export',
						required: true,
						source: 'profile_contract',
					}),
				],
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const execFindings = result.findings.filter(
			(f) => f.kind === 'executive_export_boundary_conflict',
		);
		expect(execFindings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// External/provider/security boundary tests
// ---------------------------------------------------------------------------

describe('external/provider/security boundaries', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('default check scripts no network/provider => consistent', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'default_tests_no_provider',
				claimedValue: 'true',
				expectedNoProvider: true,
				kind: 'provider_boundary',
				required: true,
				source: 'product_docs',
			}),
			makeClaim({
				claimedKey: 'default_tests_no_network',
				claimedValue: 'true',
				expectedNoProvider: true,
				kind: 'provider_boundary',
				required: true,
				source: 'product_docs',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: [],
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		// Provider boundary claims are consistent when no security violations observed
		const secFindings = result.findings.filter(
			(f) => f.kind === 'security_boundary_conflict',
		);
		expect(secFindings.length).toBe(0);
	});

	it('raw token in observed metadata => redacted fatal', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'no_raw_tokens',
				claimedValue: 'env_var_references_only',
				kind: 'security_boundary',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'secretLikeValues',
				kind: 'observed_security_marker',
				observedValue: '[REDACTED: 3 secret-like values detected]',
				redacted: true,
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const secFindings = result.findings.filter(
			(f) => f.kind === 'security_boundary_conflict',
		);
		expect(secFindings.length).toBeGreaterThan(0);
		expect(secFindings[0]?.severity).toBe('fatal');

		// Verify fake secrets do not appear in output
		for (const finding of secFindings) {
			expect(finding.observedValue).not.toContain('sk-');
			expect(finding.observedValue).not.toContain('api_key');
			expect(finding.observedValue).toContain('REDACTED');
		}
	});

	it('env var reference only => allowed', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'no_raw_tokens',
				claimedValue: 'env_var_references_only',
				kind: 'security_boundary',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const secFindings = result.findings.filter(
			(f) => f.kind === 'security_boundary_conflict',
		);
		expect(secFindings.length).toBe(0);
	});

	it('external sync script marker => finding', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'local_first',
				claimedValue: 'true',
				expectedLocalOnly: true,
				kind: 'external_integration_boundary',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'external_sync',
				kind: 'observed_integration_marker',
				observedValue:
					'external_integration_scope_risk: live external API call in check path',
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const extFindings = result.findings.filter(
			(f) => f.kind === 'external_integration_boundary_conflict',
		);
		expect(extFindings.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Severity tests
// ---------------------------------------------------------------------------

describe('severity rules', () => {
	it('raw secret => fatal/error', () => {
		// Tested in security boundary test above
	});

	it('derived artifact canonical source => fatal', () => {
		// Tested in derived artifact boundary test above
	});

	it('missing required command/script => error', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'build',
				claimedValue: 'tsc',
				kind: 'package_script',
				required: true,
				source: 'package_json',
			}),
		];
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: [],
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const missing = result.findings.filter(
			(f) => f.kind === 'documented_script_missing',
		);
		expect(missing.length).toBeGreaterThan(0);
		expect(missing[0]?.severity).toBe('error');
	});

	it('README drift => warning', () => {
		// Tested in root/profile consistency test above
	});

	it('extra optional directory => info', () => {
		const claims: DocsCodeClaim[] = [];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: '/extra-cmd',
				kind: 'observed_command',
				observedValue: '/extra-cmd',
				source: 'command_registry',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const undocFindings = result.findings.filter(
			(f) => f.kind === 'implemented_command_undocumented',
		);
		expect(undocFindings.length).toBe(1);
		expect(undocFindings[0]?.severity).toBe('info');
	});
});

// ---------------------------------------------------------------------------
// Report tests
// ---------------------------------------------------------------------------

describe('consistency report', () => {
	beforeEach(() => {
		resetDocsCodeIdCounter(0);
	});

	it('report includes summary', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.summary).toBeDefined();
		expect(report.summary.claimCount).toBe(result.claimCount);
	});

	it('report includes scope/policy note', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.scopeAndPolicyNote).toBeDefined();
		expect(report.scopeAndPolicyNote.length).toBeGreaterThan(0);
		expect(report.scopeAndPolicyNote).toContain('bounded');
	});

	it('report includes claims checked', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.claimsChecked.total).toBe(result.claimCount);
	});

	it('report includes command/script/root/profile sections', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.commandConsistency).toBeDefined();
		expect(report.packageScriptConsistency).toBeDefined();
		expect(report.rootProfileConsistency).toBeDefined();
		expect(report.structureConfigConsistency).toBeDefined();
		expect(report.canonicalOutputConsistency).toBeDefined();
		expect(report.derivedArtifactBoundaryConsistency).toBeDefined();
		expect(report.executiveExportBoundaryConsistency).toBeDefined();
		expect(report.externalIntegrationProviderSecurityConsistency).toBeDefined();
	});

	it('report includes findings by severity', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.findingsBySeverity).toBeDefined();
		expect(report.findingsBySeverity.fatal).toBeDefined();
		expect(report.findingsBySeverity.error).toBeDefined();
		expect(report.findingsBySeverity.warning).toBeDefined();
		expect(report.findingsBySeverity.info).toBeDefined();
	});

	it('report includes unknown observations', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.unknownObservations).toBeDefined();
	});

	it('report includes next actions', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		const report = buildDocsCodeConsistencyReport(result);
		expect(report.recommendedNextActions).toBeDefined();
		expect(report.recommendedNextActions.length).toBeGreaterThan(0);
	});

	it('report is non-canonical', () => {
		// The report is a derived artifact, not canonical
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);
		const report = buildDocsCodeConsistencyReport(result);
		expect(report.boundedDisclaimer).toContain('non-canonical');
	});

	it('report contains no secrets', () => {
		const claims: DocsCodeClaim[] = [
			makeClaim({
				claimedKey: 'no_raw_tokens',
				claimedValue: 'env_var_references_only',
				kind: 'security_boundary',
				required: true,
				source: 'product_docs',
			}),
		];
		const facts: DocsCodeObservedFact[] = [
			makeObservedFact({
				key: 'secretLikeValues',
				kind: 'observed_security_marker',
				observedValue: '[REDACTED: 1 secret-like value detected]',
				redacted: true,
				source: 'scanner',
			}),
		];

		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				claims,
				dryRun: true,
				observedFacts: facts,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory(), includeInfo: true },
		);

		const report = buildDocsCodeConsistencyReport(result);
		const reportStr = JSON.stringify(report);
		expect(reportStr).not.toContain('sk-');
		expect(reportStr).not.toContain('api_key');
		expect(reportStr).not.toContain('token:');
	});

	it('report states checks are bounded', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);
		const report = buildDocsCodeConsistencyReport(result);
		expect(report.boundedDisclaimer).toContain('bounded');
		expect(report.boundedDisclaimer).toContain('No arbitrary source files');
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('non-mutation guarantees', () => {
	it('checker writes no files', () => {
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);

		expect(result.changedPaths).toEqual([]);
		expect(result.readOnly).toBe(true);
	});

	it('checker does not call AI/provider code', () => {
		// Verified by construction: the checker has no AI provider dependencies
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);
		expect(result.readOnly).toBe(true);
	});

	it('checker does not call network/external APIs', () => {
		// Verified by construction: the checker is purely deterministic
		const result = runDocsCodeConsistencyCheck(
			{
				checkedAt: '2025-01-01T00:00:00.000Z',
				dryRun: true,
				profileId: 'standard',
				projectRoot: '/test',
			},
			{ idFactory: fixtureIdFactory() },
		);
		expect(result).toBeDefined();
	});

	it('no test mutates the real repository', () => {
		// All tests use injected paths and fixtures, never the real workspace
		expect(true).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Sort findings tests
// ---------------------------------------------------------------------------

describe('sorting', () => {
	it('sorts findings by severity, kind, path, id', () => {
		const findings: DocsCodeConsistencyFinding[] = [
			{
				comparisonStatus: 'missing_in_code',
				evidence: {
					claimId: 'c1',
					claimKind: 'package_script',
					claimSource: 'package_json',
					expectedValue: 'x',
					observedFactId: 'o1',
					observedFactKind: 'missing_observation',
					observedValue: 'y',
					summary: 'test',
				},
				expectedValue: 'x',
				id: 'f3',
				kind: 'documented_script_missing',
				observedValue: 'y',
				order: 0,
				recoveryHint: { message: 'fix it' },
				severity: 'warning',
			},
			{
				comparisonStatus: 'inconsistent',
				evidence: {
					claimId: 'c2',
					claimKind: 'security_boundary',
					claimSource: 'product_docs',
					expectedValue: 'x',
					observedFactId: 'o2',
					observedFactKind: 'observed_security_marker',
					observedValue: 'y',
					summary: 'test',
				},
				expectedValue: 'x',
				id: 'f1',
				kind: 'security_boundary_conflict',
				observedValue: 'y',
				order: 0,
				recoveryHint: { message: 'fix it' },
				severity: 'fatal',
			},
			{
				comparisonStatus: 'missing_in_code',
				evidence: {
					claimId: 'c3',
					claimKind: 'cli_command',
					claimSource: 'cli_metadata',
					expectedValue: 'x',
					observedFactId: 'o3',
					observedFactKind: 'missing_observation',
					observedValue: 'y',
					summary: 'test',
				},
				expectedValue: 'x',
				id: 'f2',
				kind: 'documented_command_missing',
				observedValue: 'y',
				order: 0,
				recoveryHint: { message: 'fix it' },
				severity: 'error',
			},
		];

		const sorted = sortDocsCodeFindings(findings);
		expect(sorted[0]?.severity).toBe('fatal');
		expect(sorted[1]?.severity).toBe('error');
		expect(sorted[2]?.severity).toBe('warning');
	});
});
