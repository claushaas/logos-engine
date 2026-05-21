/** Step 12.3 — Observed fact construction from repository scanner and metadata */

import type { RepositoryScanResult } from '../scanner/repository-scan-model.js';
import type {
	DocsCodeObservedFact,
	DocsCodeObservedFactKind,
} from './docs-code-consistency-model.js';
import { nextDocsCodeId } from './docs-code-consistency-model.js';

// ---------------------------------------------------------------------------
// Observed fact builder
// ---------------------------------------------------------------------------

export function buildObservedFacts(params: {
	scannerResult?: RepositoryScanResult | undefined;
	commandRegistry?:
		| {
				externalCommands: string[];
				slashCommands: string[];
		  }
		| undefined;
	artifactRegistryEntries?:
		| Array<{
				artifactId: string;
				artifactType: string;
				isCanonical?: boolean | undefined;
				path: string;
				status?: string | undefined;
				metadata?: Record<string, unknown> | undefined;
		  }>
		| undefined;
	packageMetadata?:
		| {
				name?: string | undefined;
				bin?: Record<string, string> | undefined;
				scripts?: Record<string, string> | undefined;
				engines?: Record<string, string> | undefined;
				packageManager?: string | undefined;
		  }
		| undefined;
}): DocsCodeObservedFact[] {
	const facts: DocsCodeObservedFact[] = [];

	// -----------------------------------------------------------------------
	// From scanner result
	// -----------------------------------------------------------------------
	if (params.scannerResult) {
		const scan = params.scannerResult;

		// Observed package scripts
		for (const script of scan.packageSummary.declaredScripts) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-script'),
				insufficient: false,
				key: script,
				kind: 'observed_script',
				observedValue: script,
				path: 'package.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed missing scripts
		for (const script of scan.packageSummary.missingRequiredScripts) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-missing-script'),
				insufficient: false,
				key: script,
				kind: 'missing_observation',
				observedValue: '(missing)',
				path: 'package.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed binary
		if (scan.packageSummary.binPath) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-binary'),
				insufficient: false,
				key: 'bin',
				kind: 'observed_binary',
				observedValue: scan.packageSummary.binPath,
				path: 'package.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed package manager
		if (scan.packageSummary.packageManager) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-pkg-mgr'),
				insufficient: false,
				key: 'packageManager',
				kind: 'observed_config',
				observedValue: scan.packageSummary.packageManager,
				path: 'package.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed Node version
		if (scan.packageSummary.engines) {
			for (const [engine, version] of Object.entries(
				scan.packageSummary.engines,
			)) {
				facts.push({
					boundedObservation: true,
					id: nextDocsCodeId('obs-engine'),
					insufficient: false,
					key: engine,
					kind: 'observed_config',
					observedValue: version,
					path: 'package.json',
					redacted: false,
					source: 'scanner',
				});
			}
		}

		// Observed config files
		if (scan.configSummary.tsconfigPath) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-config'),
				insufficient: false,
				key: 'tsconfig.json',
				kind: 'observed_config',
				observedValue: scan.configSummary.tsconfigPath,
				path: scan.configSummary.tsconfigPath,
				redacted: false,
				source: 'scanner',
			});
		}
		if (scan.configSummary.vitestConfigPath) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-config'),
				insufficient: false,
				key: 'vitest.config.ts',
				kind: 'observed_config',
				observedValue: scan.configSummary.vitestConfigPath,
				path: scan.configSummary.vitestConfigPath,
				redacted: false,
				source: 'scanner',
			});
		}
		if (scan.configSummary.biomeConfigPath) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-config'),
				insufficient: false,
				key: 'biome.json',
				kind: 'observed_config',
				observedValue: scan.configSummary.biomeConfigPath,
				path: scan.configSummary.biomeConfigPath,
				redacted: false,
				source: 'scanner',
			});
		}
		if (scan.configSummary.markdownlintConfigPath) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-config'),
				insufficient: false,
				key: '.markdownlint.json',
				kind: 'observed_config',
				observedValue: scan.configSummary.markdownlintConfigPath,
				path: scan.configSummary.markdownlintConfigPath,
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed tooling config existence
		facts.push({
			boundedObservation: true,
			id: nextDocsCodeId('obs-tooling'),
			insufficient: false,
			key: 'tsconfig',
			kind: 'observed_config',
			observedValue: scan.toolingSummary.tsconfigExists ? 'present' : 'missing',
			path: 'tsconfig.json',
			redacted: false,
			source: 'scanner',
		});
		facts.push({
			boundedObservation: true,
			id: nextDocsCodeId('obs-tooling'),
			insufficient: false,
			key: 'vitestConfig',
			kind: 'observed_config',
			observedValue: scan.toolingSummary.vitestConfigExists
				? 'present'
				: 'missing',
			path: 'vitest.config.ts',
			redacted: false,
			source: 'scanner',
		});
		facts.push({
			boundedObservation: true,
			id: nextDocsCodeId('obs-tooling'),
			insufficient: false,
			key: 'biomeConfig',
			kind: 'observed_config',
			observedValue: scan.toolingSummary.biomeConfigExists
				? 'present'
				: 'missing',
			path: 'biome.json',
			redacted: false,
			source: 'scanner',
		});
		facts.push({
			boundedObservation: true,
			id: nextDocsCodeId('obs-tooling'),
			insufficient: false,
			key: 'markdownlintConfig',
			kind: 'observed_config',
			observedValue: scan.toolingSummary.markdownlintConfigExists
				? 'present'
				: 'missing',
			path: '.markdownlint.json',
			redacted: false,
			source: 'scanner',
		});

		// Observed mutating script patterns
		for (const pattern of scan.toolingSummary.mutatingScriptPatterns) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-mutating'),
				insufficient: false,
				key: pattern,
				kind: 'observed_security_marker',
				observedValue: `mutating pattern: ${pattern}`,
				path: 'package.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed directories from artifacts
		for (const artifact of scan.artifacts) {
			if (artifact.exists && artifact.relativePath) {
				const factKind: DocsCodeObservedFactKind =
					artifact.kind === 'source_directory'
						? 'observed_directory'
						: artifact.kind === 'test_directory'
							? 'observed_directory'
							: artifact.kind === 'script_directory'
								? 'observed_directory'
								: 'observed_file';
				facts.push({
					boundedObservation: true,
					id: nextDocsCodeId('obs-artifact'),
					insufficient: false,
					key: artifact.relativePath,
					kind: factKind,
					observedValue: artifact.relativePath,
					path: artifact.relativePath,
					redacted: false,
					source: 'scanner',
				});
			}
		}

		// Observed documentation root
		if (scan.documentationSummary.configDocsRoot) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-root'),
				insufficient: false,
				key: 'documentationRoot',
				kind: 'observed_output_path',
				observedValue: scan.documentationSummary.configDocsRoot,
				path: '.logos/workspace.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed hard-coded docs/ root
		if (scan.documentationSummary.hardcodedDocsRootDetected) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-root-drift'),
				insufficient: false,
				key: 'hardcodedDocsRoot',
				kind: 'observed_output_path',
				observedValue: 'docs/',
				path: 'configuration',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed profile
		if (scan.documentationSummary.profileDirectoryExists) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-profile'),
				insufficient: false,
				key: 'profileDirectory',
				kind: 'observed_profile',
				observedValue: 'profiles/standard/',
				path: 'profiles/',
				redacted: false,
				source: 'scanner',
			});
		}
		if (scan.workspaceSummary.activeProfileId) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-profile-active'),
				insufficient: false,
				key: 'activeProfileId',
				kind: 'observed_profile',
				observedValue: scan.workspaceSummary.activeProfileId,
				path: '.logos/workspace.json',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed canonical output paths
		for (const path of scan.documentationSummary.canonicalOutputPaths) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-canonical-path'),
				insufficient: false,
				key: path,
				kind: 'observed_output_path',
				observedValue: path,
				path,
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed derived artifacts in canonical root
		for (const path of scan.documentationSummary
			.derivedArtifactsInCanonicalRoot) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-derived-in-canon'),
				insufficient: false,
				key: path,
				kind: 'observed_artifact_metadata',
				observedValue: `derived in canonical root: ${path}`,
				path,
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed boundary violations
		for (const path of scan.boundarySummary.derivedArtifactsMarkedCanonical) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-boundary-violation'),
				insufficient: false,
				key: path,
				kind: 'observed_artifact_metadata',
				observedValue: `derived marked canonical: ${path}`,
				path,
				redacted: false,
				source: 'scanner',
			});
		}
		for (const path of scan.boundarySummary.htmlArtifactsInCanonicalRoot) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-html-in-canon'),
				insufficient: false,
				key: path,
				kind: 'observed_artifact_metadata',
				observedValue: `HTML in canonical root: ${path}`,
				path,
				redacted: false,
				source: 'scanner',
			});
		}
		for (const path of scan.boundarySummary.agentPacksInCanonicalRoot) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-pack-in-canon'),
				insufficient: false,
				key: path,
				kind: 'observed_artifact_metadata',
				observedValue: `agent pack in canonical root: ${path}`,
				path,
				redacted: false,
				source: 'scanner',
			});
		}
		for (const path of scan.boundarySummary.executiveExportsInCanonicalRoot) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-exec-in-canon'),
				insufficient: false,
				key: path,
				kind: 'observed_artifact_metadata',
				observedValue: `executive export in canonical root: ${path}`,
				path,
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed CI
		if (scan.ciSummary.ciWorkflowsExist) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-ci'),
				insufficient: false,
				key: 'ci_workflows',
				kind: 'observed_file',
				observedValue: scan.ciSummary.ciWorkflowCount.toString(),
				path: '.github/workflows/',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed security findings
		if (scan.securitySummary.secretLikeValuesDetected > 0) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-secret'),
				insufficient: false,
				key: 'secretLikeValues',
				kind: 'observed_security_marker',
				observedValue: `[REDACTED: ${scan.securitySummary.secretLikeValuesDetected} secret-like values detected]`,
				path: 'scanner',
				redacted: true,
				source: 'scanner',
			});
		}
		if (scan.securitySummary.dotEnvDetected) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-dotenv'),
				insufficient: false,
				key: '.env',
				kind: 'observed_security_marker',
				observedValue: '.env file detected',
				path: '.env',
				redacted: false,
				source: 'scanner',
			});
		}

		// Observed scanner findings
		for (const finding of scan.findings) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-scan-finding'),
				insufficient: false,
				key: finding.kind,
				kind:
					finding.kind === 'secret_like_value'
						? 'observed_security_marker'
						: finding.kind === 'external_integration_scope_risk'
							? 'observed_integration_marker'
							: 'observed_config',
				observedValue: finding.message,
				path: finding.affectedPath,
				redacted: finding.kind === 'secret_like_value',
				scannerFindingId: finding.id,
				source: 'scanner',
			});
		}
	}

	// -----------------------------------------------------------------------
	// From command registry
	// -----------------------------------------------------------------------
	if (params.commandRegistry) {
		// External commands
		for (const cmd of params.commandRegistry.externalCommands) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-cmd'),
				insufficient: false,
				key: cmd,
				kind: 'observed_command',
				observedValue: cmd,
				path: 'command_registry',
				redacted: false,
				source: 'command_registry',
			});
		}

		// Slash commands
		for (const cmd of params.commandRegistry.slashCommands) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-slash-cmd'),
				insufficient: false,
				key: cmd,
				kind: 'observed_command',
				observedValue: cmd,
				path: 'command_registry',
				redacted: false,
				source: 'command_registry',
			});
		}
	}

	// -----------------------------------------------------------------------
	// From artifact registry entries
	// -----------------------------------------------------------------------
	if (params.artifactRegistryEntries) {
		for (const entry of params.artifactRegistryEntries) {
			facts.push({
				boundedObservation: true,
				id: nextDocsCodeId('obs-art-registry'),
				insufficient: false,
				key: entry.artifactId,
				kind: 'observed_artifact_metadata',
				observedValue: JSON.stringify({
					artifactType: entry.artifactType,
					isCanonical: entry.isCanonical ?? false,
					path: entry.path,
					status: entry.status ?? 'unknown',
				}),
				path: entry.path,
				redacted: false,
				source: 'artifact_registry',
			});
		}
	}

	return facts;
}
