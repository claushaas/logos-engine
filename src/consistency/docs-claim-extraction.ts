/** Step 12.3 — Documentation claim extraction from bounded sources */

import type { RepositoryScanResult } from '../scanner/repository-scan-model.js';
import type {
	DocsCodeClaim,
	DocsCodeClaimKind,
} from './docs-code-consistency-model.js';
import { nextDocsCodeId } from './docs-code-consistency-model.js';

// ---------------------------------------------------------------------------
// Known documented external commands
// ---------------------------------------------------------------------------

const KNOWN_CLI_COMMANDS: Array<{
	name: string;
	flags?: string[];
}> = [
	{ flags: ['--help', '--version'], name: 'logos' },
	{ flags: ['--json', '--dry-run'], name: 'logos doctor' },
];

// ---------------------------------------------------------------------------
// Known documented TUI slash commands
// ---------------------------------------------------------------------------

const KNOWN_SLASH_COMMANDS: string[] = [
	'/init',
	'/continue',
	'/generate',
	'/diagnose',
	'/validate',
	'/status',
	'/config ai',
	'/help',
	'/exit',
];

// ---------------------------------------------------------------------------
// Known required package scripts
// ---------------------------------------------------------------------------

const REQUIRED_SCRIPTS: Array<{
	name: string;
	nonMutating: boolean;
	required: boolean;
}> = [
	{ name: 'build', nonMutating: true, required: true },
	{ name: 'test', nonMutating: true, required: true },
	{ name: 'typecheck', nonMutating: true, required: true },
	{ name: 'lint:biome', nonMutating: true, required: true },
	{ name: 'lint:md', nonMutating: true, required: false },
	{ name: 'smoke:cli', nonMutating: true, required: true },
	{ name: 'check', nonMutating: true, required: true },
];

// ---------------------------------------------------------------------------
// Mutating script patterns (conservative detection)
// ---------------------------------------------------------------------------

const MUTATING_PATTERNS = [
	'--write',
	'--fix',
	'rm -rf',
	'mv ',
	'cp ',
	'> ',
	'>>',
];

// ---------------------------------------------------------------------------
// Known expected structure
// ---------------------------------------------------------------------------

const EXPECTED_STRUCTURE: Array<{
	kind:
		| 'source_directory'
		| 'test_directory'
		| 'script_directory'
		| 'config_file';
	path: string;
	required: boolean;
}> = [
	{ kind: 'source_directory', path: 'src/', required: true },
	{ kind: 'test_directory', path: 'tests/', required: true },
	{ kind: 'script_directory', path: 'scripts/', required: true },
	{ kind: 'config_file', path: 'tsconfig.json', required: true },
	{ kind: 'config_file', path: 'vitest.config.ts', required: true },
	{ kind: 'config_file', path: 'biome.json', required: true },
	{ kind: 'config_file', path: '.markdownlint.json', required: true },
];

// ---------------------------------------------------------------------------
// Claim extraction
// ---------------------------------------------------------------------------

export function extractDocsClaims(params: {
	profileId: string;
	documentationRoot?: string | undefined;
	scannerResult?: RepositoryScanResult | undefined;
	packageMetadata?:
		| {
				name?: string | undefined;
				version?: string | undefined;
				bin?: Record<string, string> | undefined;
				scripts?: Record<string, string> | undefined;
				engines?: Record<string, string> | undefined;
				packageManager?: string | undefined;
		  }
		| undefined;
	readmeSnippet?: string | undefined;
	includeInfo?: boolean | undefined;
}): DocsCodeClaim[] {
	const claims: DocsCodeClaim[] = [];
	const root = params.documentationRoot ?? 'logos/';

	// CLI command claims
	for (const cmd of KNOWN_CLI_COMMANDS) {
		claims.push({
			claimedKey: cmd.name,
			claimedValue: cmd.name,
			description: `External CLI command should exist: ${cmd.name}`,
			evidence: `Referenced in AGENTS.md operational commands and TUI-first product model.`,
			id: nextDocsCodeId('claim-cli'),
			kind: 'cli_command',
			required: true,
			source: 'cli_metadata',
			sourcePath: 'AGENTS.md',
		});
		if (cmd.flags) {
			for (const flag of cmd.flags) {
				claims.push({
					claimedKey: cmd.name,
					claimedSubKey: flag,
					claimedValue: `${cmd.name} ${flag}`,
					description: `CLI command flag should exist: ${flag} on ${cmd.name}`,
					evidence: `Referenced in AGENTS.md operational conventions and /diagnose behavior.`,
					id: nextDocsCodeId('claim-cli-flag'),
					kind: 'cli_command',
					required: false,
					source: 'cli_metadata',
					sourcePath: 'AGENTS.md',
				});
			}
		}
	}

	// Slash command claims
	for (const cmd of KNOWN_SLASH_COMMANDS) {
		claims.push({
			claimedKey: cmd,
			claimedValue: cmd,
			description: `TUI slash command should exist: ${cmd}`,
			evidence: `Referenced in docs/03-product/10-functional-requirements.md and AGENTS.md.`,
			id: nextDocsCodeId('claim-slash'),
			kind: 'slash_command',
			required: true,
			source: 'tui_metadata',
			sourcePath: 'docs/03-product/10-functional-requirements.md',
		});
	}

	// Additional known slash commands from later phases
	const phaseExtendedCommands: string[] = [];
	if (params.scannerResult) {
		// Phase 11: /executive compile
		phaseExtendedCommands.push('/executive compile');
		// Step 12.1: /import plan
		phaseExtendedCommands.push('/import plan');
	}
	for (const cmd of phaseExtendedCommands) {
		claims.push({
			claimedKey: cmd,
			claimedValue: cmd,
			description: `TUI slash command may exist: ${cmd}`,
			evidence: `Referenced in later-phase documentation.`,
			id: nextDocsCodeId('claim-slash'),
			kind: 'slash_command',
			required: false,
			source: 'tui_metadata',
			sourcePath: 'AGENTS.md',
		});
	}

	// Package script claims
	if (params.packageMetadata?.scripts) {
		for (const req of REQUIRED_SCRIPTS) {
			const scriptContent = params.packageMetadata.scripts[req.name];
			claims.push({
				claimedKey: req.name,
				claimedValue: scriptContent ?? '(missing)',
				description: `Package script "${req.name}" is ${req.required ? 'required' : 'optional'}.`,
				evidence: `Referenced in AGENTS.md operational commands.`,
				expectedNonMutating: req.nonMutating,
				id: nextDocsCodeId('claim-script'),
				kind: 'package_script',
				required: req.required,
				source: 'package_json',
				sourcePath: 'package.json',
			});
		}

		// Also extract any additional scripts from package
		for (const name of Object.keys(params.packageMetadata.scripts)) {
			if (!REQUIRED_SCRIPTS.some((r) => r.name === name)) {
				claims.push({
					claimedKey: name,
					claimedValue: params.packageMetadata.scripts[name] ?? '',
					description: `Package script "${name}" is present.`,
					evidence: 'Declared in package.json scripts.',
					id: nextDocsCodeId('claim-script-extra'),
					kind: 'package_script',
					required: false,
					source: 'package_json',
					sourcePath: 'package.json',
				});
			}
		}
	}

	// Package binary claim
	if (params.packageMetadata?.bin) {
		const binName = Object.keys(params.packageMetadata.bin)[0];
		claims.push({
			claimedKey: 'bin',
			claimedValue: binName ?? 'logos',
			description: `Package binary should point to built CLI path.`,
			evidence: 'Declared in package.json bin field.',
			id: nextDocsCodeId('claim-binary'),
			kind: 'package_binary',
			required: true,
			source: 'package_json',
			sourcePath: 'package.json',
		});
	}

	// Node version claim
	if (params.packageMetadata?.engines?.node) {
		claims.push({
			claimedKey: 'node',
			claimedValue: params.packageMetadata.engines.node,
			description: `Node.js engine version requirement.`,
			evidence: 'Declared in package.json engines field.',
			id: nextDocsCodeId('claim-node-version'),
			kind: 'node_version',
			required: true,
			source: 'package_json',
			sourcePath: 'package.json',
		});
	}

	// Package manager claim
	if (params.packageMetadata?.packageManager) {
		claims.push({
			claimedKey: 'packageManager',
			claimedValue: params.packageMetadata.packageManager,
			description: `Package manager declaration.`,
			evidence: 'Declared in package.json packageManager field.',
			id: nextDocsCodeId('claim-pkg-mgr'),
			kind: 'package_manager',
			required: true,
			source: 'package_json',
			sourcePath: 'package.json',
		});
	}

	// Generated root claim
	claims.push({
		claimedKey: 'documentationRoot',
		claimedValue: root,
		description: `Generated documentation root.`,
		evidence: `Default is logos/; product docs specify configurable root.`,
		id: nextDocsCodeId('claim-root'),
		kind: 'generated_root',
		required: true,
		source: 'product_docs',
		sourcePath: 'docs/03-product/10-functional-requirements.md',
	});

	// Profile identity claim
	claims.push({
		claimedKey: 'profileId',
		claimedValue: params.profileId,
		description: `Active profile ID should be "${params.profileId}".`,
		evidence: `Bundled Standard profile is the default.`,
		id: nextDocsCodeId('claim-profile-id'),
		kind: 'profile_id',
		required: true,
		source: 'profile_registry',
		sourcePath: 'profiles/standard/docs.yml',
	});

	// Profile registry path claim
	claims.push({
		claimedKey: 'profileRegistry',
		claimedValue: 'profiles/standard/docs.yml',
		description: 'Profile registry should exist at expected path.',
		evidence: 'Profiles directory contains the Standard profile.',
		id: nextDocsCodeId('claim-profile-registry'),
		kind: 'profile_registry',
		required: true,
		source: 'profile_registry',
		sourcePath: 'profiles/standard',
	});

	// Source directory claims
	for (const entry of EXPECTED_STRUCTURE) {
		claims.push({
			claimedKey: entry.path,
			claimedValue: entry.path,
			description: `${entry.kind} "${entry.path}" is ${entry.required ? 'required' : 'expected'}.`,
			evidence: 'Referenced in AGENTS.md repository topology.',
			id: nextDocsCodeId('claim-structure'),
			kind: entry.kind as DocsCodeClaimKind,
			required: entry.required,
			source: 'product_docs',
			sourcePath: 'AGENTS.md',
		});
	}

	// CI workflow claim (expected but not required in MVP)
	claims.push({
		claimedKey: '.github/workflows',
		claimedValue: 'ci_workflows',
		description: 'CI workflows should be present.',
		evidence: 'Referenced in AGENTS.md and engineering docs.',
		id: nextDocsCodeId('claim-ci'),
		kind: 'ci_workflow',
		required: false,
		source: 'engineering_docs',
		sourcePath: 'docs/04-engineering/12-deployment-and-environments.md',
	});

	// Canonical output boundary claims
	claims.push({
		claimedKey: 'canonical_outputs',
		claimedValue: `${root}`,
		description:
			'Canonical outputs should be under the configured documentation root.',
		evidence:
			'Profile contract defines canonical output paths under documentation root.',
		expectedNonMutating: false,
		id: nextDocsCodeId('claim-canonical-output'),
		kind: 'canonical_output',
		required: true,
		source: 'profile_contract',
		sourcePath: 'profiles/standard/docs.yml',
	});

	// Derived artifact boundary claims
	claims.push({
		claimedKey: 'html_derived',
		claimedValue: 'non-canonical',
		description: 'HTML artifacts must be derived/non-canonical.',
		evidence:
			'Referenced in profiles/standard/docs.yml and product architecture docs.',
		id: nextDocsCodeId('claim-html-derived'),
		kind: 'derived_artifact',
		required: true,
		source: 'profile_contract',
		sourcePath: 'profiles/standard/docs.yml',
	});

	claims.push({
		claimedKey: 'agent_pack_derived',
		claimedValue: 'non-canonical',
		description: 'Agent packs must be derived execution aids/non-canonical.',
		evidence: 'Referenced in profiles/standard/docs.yml.',
		id: nextDocsCodeId('claim-agentpack-derived'),
		kind: 'derived_artifact',
		required: true,
		source: 'profile_contract',
		sourcePath: 'profiles/standard/docs.yml',
	});

	claims.push({
		claimedKey: 'executive_export_derived',
		claimedValue: 'non-canonical',
		description: 'Executive exports must be derived snapshots/non-canonical.',
		evidence:
			'Referenced in profiles/standard/executive/executive-generation.yml.',
		id: nextDocsCodeId('claim-exec-export-derived'),
		kind: 'derived_artifact',
		required: true,
		source: 'profile_contract',
		sourcePath: 'profiles/standard/executive/executive-generation.yml',
	});

	claims.push({
		claimedKey: 'validation_report_derived',
		claimedValue: 'non-canonical',
		description: 'Validation/diagnostic reports must be non-canonical.',
		evidence: 'Referenced in profile contract and validation docs.',
		id: nextDocsCodeId('claim-val-report-derived'),
		kind: 'derived_artifact',
		required: true,
		source: 'profile_contract',
		sourcePath: 'profiles/standard/docs.yml',
	});

	// Executive export boundary claims
	claims.push({
		claimedKey: 'github_export_local',
		claimedValue: 'local_file_export_only',
		description: 'GitHub Issue-compatible export is local file export only.',
		evidence:
			'Referenced in profiles/standard/executive/mappings/github-issues.mapping.yml.',
		id: nextDocsCodeId('claim-github-local'),
		kind: 'executive_export',
		required: true,
		source: 'profile_contract',
		sourcePath:
			'profiles/standard/executive/mappings/github-issues.mapping.yml',
	});

	claims.push({
		claimedKey: 'linear_planned',
		claimedValue: 'planned_adapter_contract',
		description: 'Linear mapping is a planned adapter contract, not live sync.',
		evidence: 'Referenced in IMPLEMENTATION_ROADMAP.md.',
		id: nextDocsCodeId('claim-linear-planned'),
		kind: 'executive_export',
		required: true,
		source: 'roadmap',
		sourcePath: 'docs/roadmap/IMPLEMENTATION_ROADMAP.md',
	});

	claims.push({
		claimedKey: 'notion_planned',
		claimedValue: 'planned_adapter_contract',
		description: 'Notion mapping is a planned adapter contract, not live sync.',
		evidence: 'Referenced in IMPLEMENTATION_ROADMAP.md.',
		id: nextDocsCodeId('claim-notion-planned'),
		kind: 'executive_export',
		required: true,
		source: 'roadmap',
		sourcePath: 'docs/roadmap/IMPLEMENTATION_ROADMAP.md',
	});

	claims.push({
		claimedKey: 'executive_axis_snapshot',
		claimedValue: 'derived_snapshot_not_live_task_manager',
		description:
			'Executive Axis is a derived execution snapshot, not a live task manager.',
		evidence:
			'Referenced in profiles/standard/executive/executive-generation.yml.',
		id: nextDocsCodeId('claim-exec-snapshot'),
		kind: 'executive_export',
		required: true,
		source: 'profile_contract',
		sourcePath: 'profiles/standard/executive/executive-generation.yml',
	});

	// External integration boundary claims
	claims.push({
		claimedKey: 'local_first',
		claimedValue: 'true',
		description: 'Tool is local-first with no hosted control plane.',
		evidence: 'Explicit in AGENTS.md identity section.',
		expectedLocalOnly: true,
		id: nextDocsCodeId('claim-local-first'),
		kind: 'external_integration_boundary',
		required: true,
		source: 'product_docs',
		sourcePath: 'AGENTS.md',
	});

	// Security/provider boundary claims
	claims.push({
		claimedKey: 'no_raw_tokens',
		claimedValue: 'env_var_references_only',
		description: 'Raw provider tokens must not be stored.',
		evidence: 'Referenced in SECURITY.md and AGENTS.md.',
		id: nextDocsCodeId('claim-no-tokens'),
		kind: 'security_boundary',
		required: true,
		source: 'product_docs',
		sourcePath: 'SECURITY.md',
	});

	claims.push({
		claimedKey: 'default_tests_no_provider',
		claimedValue: 'true',
		description: 'Default tests must not require provider credentials.',
		evidence: 'Referenced in AGENTS.md and CONTRIBUTING.md.',
		expectedNoProvider: true,
		id: nextDocsCodeId('claim-no-provider-tests'),
		kind: 'provider_boundary',
		required: true,
		source: 'product_docs',
		sourcePath: 'CONTRIBUTING.md',
	});

	claims.push({
		claimedKey: 'default_tests_no_network',
		claimedValue: 'true',
		description: 'Default tests must not require network access.',
		evidence: 'Referenced in AGENTS.md and CONTRIBUTING.md.',
		expectedNoProvider: true,
		id: nextDocsCodeId('claim-no-network-tests'),
		kind: 'provider_boundary',
		required: true,
		source: 'product_docs',
		sourcePath: 'CONTRIBUTING.md',
	});

	// README drift check
	if (params.readmeSnippet) {
		// Check for stale 'app-business' references
		if (params.readmeSnippet.toLowerCase().includes('app-business')) {
			claims.push({
				claimedKey: 'readme_profile',
				claimedValue: params.profileId,
				description: `README should reference active profile "${params.profileId}", not stale "app-business".`,
				evidence: `README content snippet contains "app-business" reference.`,
				id: nextDocsCodeId('claim-readme-profile'),
				kind: 'profile_id',
				required: false,
				source: 'readme',
				sourcePath: 'README.md',
			});
		}

		// Check for hard-coded docs/ references
		if (params.readmeSnippet.match(/\bdocs\//) && root !== 'docs/') {
			claims.push({
				claimedKey: 'readme_root',
				claimedValue: root,
				description: `README should reference "${root}" as documentation root, not "docs/".`,
				evidence: 'README content snippet contains docs/ references.',
				id: nextDocsCodeId('claim-readme-root'),
				kind: 'generated_root',
				required: false,
				source: 'readme',
				sourcePath: 'README.md',
			});
		}
	}

	return claims;
}

// ---------------------------------------------------------------------------
// Script mutating detection
// ---------------------------------------------------------------------------

export function isScriptMutating(scriptContent?: string): boolean {
	if (!scriptContent) return false;
	for (const pattern of MUTATING_PATTERNS) {
		if (scriptContent.includes(pattern)) {
			return true;
		}
	}
	return false;
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export function claimKindToCategory(kind: DocsCodeClaimKind): string {
	switch (kind) {
		case 'cli_command':
		case 'slash_command':
			return 'commands';
		case 'package_script':
		case 'package_binary':
		case 'node_version':
		case 'package_manager':
			return 'scripts';
		case 'generated_root':
			return 'roots';
		case 'profile_id':
		case 'profile_registry':
		case 'phase_descriptor':
		case 'document_descriptor':
			return 'profile';
		case 'source_directory':
		case 'test_directory':
		case 'script_directory':
			return 'structure';
		case 'config_file':
		case 'ci_workflow':
			return 'configs';
		case 'canonical_output':
			return 'canonical outputs';
		case 'derived_artifact':
			return 'derived boundaries';
		case 'executive_export':
			return 'executive exports';
		case 'external_integration_boundary':
		case 'security_boundary':
		case 'provider_boundary':
			return 'external integration/provider/security boundaries';
		default:
			return 'other';
	}
}
