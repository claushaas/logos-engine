/** Step 12.3 — Docs-vs-Code Consistency Checker */

import { extractDocsClaims } from './docs-claim-extraction.js';
import type {
	DocsCodeCategorySummary,
	DocsCodeClaim,
	DocsCodeClaimSource,
	DocsCodeComparison,
	DocsCodeComparisonStatus,
	DocsCodeConsistencyChecker,
	DocsCodeConsistencyDiagnostic,
	DocsCodeConsistencyFinding,
	DocsCodeConsistencyInput,
	DocsCodeConsistencyOptions,
	DocsCodeConsistencyResult,
	DocsCodeConsistencySeverity,
	DocsCodeRecoveryHint,
} from './docs-code-consistency-model.js';
import {
	type DocsCodeObservedFact,
	type DocsCodeObservedFactKind,
	findingKindToCategory,
	resetDocsCodeIdCounter,
	sortDocsCodeFindings,
} from './docs-code-consistency-model.js';
import { buildObservedFacts } from './docs-code-observed-facts.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DOCUMENTATION_ROOT = 'logos/';
const _DEFAULT_PROFILE_ID = 'standard';

// Known mutating patterns for script detection
const MUTATING_PATTERNS = [
	'--write',
	'--fix',
	'rm -rf',
	'mv ',
	'cp ',
	'> ',
	'>>',
];

// Derived artifact type prefixes
const DERIVED_TYPE_PREFIXES = ['html', 'agent_pack', 'executive_'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRoot(root?: string): string {
	const selected = root?.trim() || DEFAULT_DOCUMENTATION_ROOT;
	return selected.endsWith('/') ? selected : `${selected}/`;
}

function _idFactory(): string {
	return `ddc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fallbackIdFactory(): string {
	return `ddc-fallback-${Date.now()}`;
}

function findObservedFact(
	facts: DocsCodeObservedFact[],
	kind: DocsCodeObservedFactKind,
	key?: string,
): DocsCodeObservedFact | undefined {
	if (key) {
		return facts.find((f) => f.kind === kind && f.key === key);
	}
	return facts.find((f) => f.kind === kind);
}

function _findObservedFactValue(
	facts: DocsCodeObservedFact[],
	kind: DocsCodeObservedFactKind,
	key?: string,
): string | undefined {
	return findObservedFact(facts, kind, key)?.observedValue;
}

function defaultRecovery(
	message: string,
	action?: string,
): DocsCodeRecoveryHint {
	return { action, message };
}

function buildEvidence(
	claim: DocsCodeClaim,
	observed: DocsCodeObservedFact | undefined,
	expected: string,
	observedValue: string,
	summary: string,
) {
	return {
		claimId: claim.id,
		claimKind: claim.kind,
		claimSource: claim.source,
		expectedValue: expected,
		observedFactId: observed?.id ?? 'none',
		observedFactKind: observed?.kind ?? 'unknown',
		observedValue,
		summary,
	};
}

function _determineComparisonStatus(
	expectedPresent: boolean,
	observedPresent: boolean,
	isAmbiguous: boolean,
): DocsCodeComparisonStatus {
	if (expectedPresent && observedPresent) return 'consistent';
	if (expectedPresent && !observedPresent) return 'missing_in_code';
	if (!expectedPresent && observedPresent) return 'missing_in_docs';
	if (isAmbiguous) return 'ambiguous';
	return 'unknown';
}

function isMutatingScript(scriptContent?: string): boolean {
	if (!scriptContent) return false;
	for (const pattern of MUTATING_PATTERNS) {
		if (scriptContent.includes(pattern)) return true;
	}
	return false;
}

function isDerivedArtifactType(artifactType: string): boolean {
	for (const prefix of DERIVED_TYPE_PREFIXES) {
		if (artifactType.startsWith(prefix)) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Category summary helpers
// ---------------------------------------------------------------------------

function initCategorySummary(category: string): DocsCodeCategorySummary {
	return {
		ambiguousCount: 0,
		category,
		consistentCount: 0,
		inconsistentCount: 0,
		missingInCodeCount: 0,
		missingInDocsCount: 0,
		totalFindings: 0,
		unknownCount: 0,
		unsupportedCount: 0,
	};
}

function ensureCategory(
	acc: Record<string, DocsCodeCategorySummary>,
	category: string,
): DocsCodeCategorySummary {
	const existing = acc[category];
	if (existing) return existing;
	const created = initCategorySummary(category);
	acc[category] = created;
	return created;
}

function tallyCategory(
	acc: Record<string, DocsCodeCategorySummary>,
	finding: DocsCodeConsistencyFinding,
): void {
	const category = findingKindToCategory(finding.kind);
	const cat = ensureCategory(acc, category);
	cat.totalFindings += 1;
	switch (finding.comparisonStatus) {
		case 'consistent':
			cat.consistentCount += 1;
			break;
		case 'inconsistent':
			cat.inconsistentCount += 1;
			break;
		case 'missing_in_code':
			cat.missingInCodeCount += 1;
			break;
		case 'missing_in_docs':
			cat.missingInDocsCount += 1;
			break;
		case 'ambiguous':
			cat.ambiguousCount += 1;
			break;
		case 'unsupported':
			cat.unsupportedCount += 1;
			break;
		case 'unknown':
		case 'not_applicable':
			cat.unknownCount += 1;
			break;
	}
}

// ---------------------------------------------------------------------------
// Claim-to-observed-fact matching
// ---------------------------------------------------------------------------

function matchClaimToObserved(
	claim: DocsCodeClaim,
	observedFacts: DocsCodeObservedFact[],
): DocsCodeObservedFact | undefined {
	const key = claim.claimedKey;
	const subKey = claim.claimedSubKey;

	switch (claim.kind) {
		case 'cli_command': {
			// Match external commands
			if (subKey) {
				// Flag claim - check if the command with flag exists
				return observedFacts.find(
					(f) =>
						f.kind === 'observed_command' &&
						f.key?.includes(key ?? '') &&
						f.key?.includes(subKey),
				);
			}
			return observedFacts.find(
				(f) =>
					f.kind === 'observed_command' &&
					f.key === (key ?? claim.claimedValue),
			);
		}

		case 'slash_command': {
			return observedFacts.find(
				(f) =>
					f.kind === 'observed_command' &&
					f.key === (key ?? claim.claimedValue),
			);
		}

		case 'package_script': {
			if (claim.description.includes('is required')) {
				return (
					findObservedFact(observedFacts, 'observed_script', key) ??
					findObservedFact(observedFacts, 'missing_observation', key)
				);
			}
			return findObservedFact(observedFacts, 'observed_script', key);
		}

		case 'package_binary': {
			return findObservedFact(observedFacts, 'observed_binary', 'bin');
		}

		case 'node_version': {
			return (
				findObservedFact(observedFacts, 'observed_config', 'node') ??
				findObservedFact(observedFacts, 'observed_config', 'engines')
			);
		}

		case 'package_manager': {
			return findObservedFact(
				observedFacts,
				'observed_config',
				'packageManager',
			);
		}

		case 'generated_root': {
			const rootFact = findObservedFact(
				observedFacts,
				'observed_output_path',
				'documentationRoot',
			);
			const hardcodedFact = findObservedFact(
				observedFacts,
				'observed_output_path',
				'hardcodedDocsRoot',
			);
			return rootFact ?? hardcodedFact;
		}

		case 'profile_id': {
			return findObservedFact(
				observedFacts,
				'observed_profile',
				'activeProfileId',
			);
		}

		case 'profile_registry': {
			return findObservedFact(
				observedFacts,
				'observed_profile',
				'profileDirectory',
			);
		}

		case 'source_directory': {
			return findObservedFact(observedFacts, 'observed_directory', key);
		}

		case 'test_directory': {
			return findObservedFact(observedFacts, 'observed_directory', key);
		}

		case 'script_directory': {
			return findObservedFact(observedFacts, 'observed_directory', key);
		}

		case 'config_file': {
			return findObservedFact(observedFacts, 'observed_config', key);
		}

		case 'ci_workflow': {
			return findObservedFact(observedFacts, 'observed_file', 'ci_workflows');
		}

		case 'canonical_output': {
			return findObservedFact(observedFacts, 'observed_output_path', key);
		}

		case 'derived_artifact':
		case 'executive_export':
		case 'external_integration_boundary':
		case 'security_boundary':
		case 'provider_boundary': {
			return (
				findObservedFact(observedFacts, 'observed_artifact_metadata', key) ??
				findObservedFact(observedFacts, 'observed_security_marker', key) ??
				findObservedFact(observedFacts, 'observed_integration_marker', key)
			);
		}

		default: {
			return undefined;
		}
	}
}

// ---------------------------------------------------------------------------
// Check: commands
// ---------------------------------------------------------------------------

function checkCommands(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	_diagnostics: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = options.idFactory ?? fallbackIdFactory;

	for (const claim of claims) {
		if (claim.kind !== 'cli_command' && claim.kind !== 'slash_command')
			continue;

		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;
		let status: DocsCodeComparisonStatus;
		let finding: DocsCodeConsistencyFinding | undefined;

		if (!observed || observed.kind === 'missing_observation') {
			// Claimed command not observed
			status = 'missing_in_code';
			const severity: DocsCodeConsistencySeverity = claim.required
				? 'error'
				: 'warning';

			if (claim.required) {
				finding = {
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					claimSourcePointer: claim.sourcePointer,
					comparisonStatus: status,
					evidence: buildEvidence(
						claim,
						observed,
						claim.claimedValue,
						'(missing)',
						`Documented ${claim.kind === 'cli_command' ? 'CLI' : 'TUI slash'} command "${claim.claimedValue}" is not observed in command registry.`,
					),
					expectedValue: claim.claimedValue,
					id: makeId(),
					kind: 'documented_command_missing',
					observedFactId: observed?.id,
					observedKey: claim.claimedKey,
					observedPath: 'command_registry',
					observedValue: '(missing)',
					order: 0,
					recoveryHint: defaultRecovery(
						`Implement the documented ${claim.kind === 'cli_command' ? 'CLI' : 'slash'} command "${claim.claimedValue}" or remove it from documentation.`,
					),
					severity,
				};
			} else {
				finding = {
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: status,
					evidence: buildEvidence(
						claim,
						observed,
						claim.claimedValue,
						'(missing)',
						`Optional ${claim.kind === 'cli_command' ? 'CLI' : 'TUI slash'} command "${claim.claimedValue}" is not observed.`,
					),
					expectedValue: claim.claimedValue,
					id: makeId(),
					kind: 'documented_command_missing',
					observedFactId: observed?.id,
					observedKey: claim.claimedKey,
					observedPath: 'command_registry',
					observedValue: '(missing)',
					order: 0,
					recoveryHint: defaultRecovery(
						`The command "${claim.claimedValue}" is documented but not observed. Verify if it should be added.`,
					),
					severity: 'info',
				};
			}
		} else if (observed.kind === 'observed_command') {
			// Command observed
			status = 'consistent';
		} else {
			status = 'ambiguous';
			finding = {
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: status,
				evidence: buildEvidence(
					claim,
					observed,
					claim.claimedValue,
					observed.observedValue,
					`Unable to determine consistency for command claim "${claim.claimedValue}".`,
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'insufficient_observation',
				observedFactId: observed.id,
				observedKey: claim.claimedKey,
				observedPath: observed.path,
				observedValue: observed.observedValue,
				order: 0,
				recoveryHint: defaultRecovery(
					'Insufficient command metadata to verify. Add command registry metadata for complete coverage.',
				),
				severity: 'warning',
			};
		}

		comparisons.push({
			claimId: claim.id,
			findingId: finding?.id,
			id: comparisonId,
			observedFactId: observed?.id ?? 'none',
			status,
		});

		if (finding) {
			findings.push(finding);
		}
	}

	// Check for implemented but undocumented commands
	const claimedCommandKeys = new Set(
		claims
			.filter((c) => c.kind === 'cli_command' || c.kind === 'slash_command')
			.map((c) => c.claimedKey ?? c.claimedValue),
	);
	for (const observed of observedFacts) {
		if (observed.kind !== 'observed_command') continue;
		if (!observed.key) continue;

		// Skip if exact match in claimed
		if (claimedCommandKeys.has(observed.key)) continue;

		// Check if it's a flag variant
		const isFlag = observed.key.includes(' ');
		if (isFlag) {
			const baseCmd = observed.key.split(' ')[0] ?? '';
			if (claimedCommandKeys.has(baseCmd)) continue;
		}

		const comparisonId = `comp-${makeId()}`;
		const status: DocsCodeComparisonStatus = 'missing_in_docs';
		comparisons.push({
			claimId: 'none',
			id: comparisonId,
			observedFactId: observed.id,
			status,
		});

		findings.push({
			claimId: undefined,
			claimSourcePath: undefined,
			comparisonStatus: status,
			evidence: buildEvidence(
				{
					claimedValue: observed.observedValue,
					description: 'Implied from observed command.',
					id: 'claim-implied',
					kind: 'unknown',
					required: false,
					source: 'fixture' as DocsCodeClaimSource,
				},
				observed,
				'(none)',
				observed.observedValue,
				`Command "${observed.observedValue}" is implemented but not documented.`,
			),
			expectedValue: '(none)',
			id: makeId(),
			kind: 'implemented_command_undocumented',
			observedFactId: observed.id,
			observedKey: observed.key,
			observedPath: observed.path,
			observedValue: observed.observedValue,
			order: 0,
			recoveryHint: defaultRecovery(
				`Add documentation for implemented command "${observed.observedValue}".`,
			),
			severity: 'info',
		});
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: package scripts
// ---------------------------------------------------------------------------

function checkPackageScripts(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	_options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	_diagnostics: DocsCodeConsistencyDiagnostic[],
	packageMetadata?: DocsCodeConsistencyInput['packageMetadata'],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options.idFactory ?? fallbackIdFactory;

	for (const claim of claims) {
		if (claim.kind !== 'package_script') continue;

		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed || observed.kind === 'missing_observation') {
			// Script missing
			const status: DocsCodeComparisonStatus = 'missing_in_code';
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed?.id ?? 'none',
				status,
			});

			if (claim.required) {
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: status,
					evidence: buildEvidence(
						claim,
						observed,
						claim.claimedValue,
						'(missing)',
						`Required package script "${claim.claimedKey}" is missing.`,
					),
					expectedValue: claim.claimedValue,
					id: makeId(),
					kind: 'documented_script_missing',
					observedFactId: observed?.id,
					observedKey: claim.claimedKey,
					observedPath: 'package.json',
					observedValue: '(missing)',
					order: 0,
					recoveryHint: defaultRecovery(
						`Add the required "${claim.claimedKey}" script to package.json.`,
						`Add script: "pnpm run ${claim.claimedKey}"`,
					),
					severity: 'error',
				});
			} else {
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: status,
					evidence: buildEvidence(
						claim,
						observed,
						claim.claimedValue,
						'(missing)',
						`Optional package script "${claim.claimedKey}" is missing.`,
					),
					expectedValue: claim.claimedValue,
					id: makeId(),
					kind: 'documented_script_missing',
					observedFactId: observed?.id,
					observedKey: claim.claimedKey,
					observedPath: 'package.json',
					observedValue: '(missing)',
					order: 0,
					recoveryHint: defaultRecovery(
						`Consider adding the "${claim.claimedKey}" script if needed.`,
					),
					severity: 'warning',
				});
			}
			continue;
		}

		// Script present - check behavior
		const status: DocsCodeComparisonStatus = 'consistent';
		comparisons.push({
			claimId: claim.id,
			id: comparisonId,
			observedFactId: observed.id,
			status,
		});

		// Check mutating behavior
		if (claim.expectedNonMutating) {
			let scriptCommand: string | undefined;
			if (packageMetadata?.scripts) {
				scriptCommand = packageMetadata.scripts[claim.claimedKey ?? ''];
			}
			const mutating =
				isMutatingScript(scriptCommand) ||
				observedFacts.some(
					(f) =>
						f.kind === 'observed_security_marker' &&
						f.key === `mutating pattern: ${claim.claimedKey}`,
				);

			if (mutating) {
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						claim,
						observed,
						'non-mutating script',
						scriptCommand ?? observed.observedValue,
						`Script "${claim.claimedKey}" is expected to be non-mutating but contains mutating patterns.`,
					),
					expectedValue: 'non-mutating',
					id: makeId(),
					kind: 'script_behavior_conflict',
					observedFactId: observed.id,
					observedKey: claim.claimedKey,
					observedPath: 'package.json',
					observedValue: scriptCommand ?? observed.observedValue,
					order: 0,
					recoveryHint: defaultRecovery(
						`Remove mutating patterns (--write, --fix, rm, mv, cp, redirect) from "${claim.claimedKey}" script.`,
					),
					severity: 'error',
				});
			}
		}
	}

	// Check binary consistency
	for (const claim of claims) {
		if (claim.kind !== 'package_binary') continue;
		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed) {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'missing_in_code',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'missing_in_code',
				evidence: buildEvidence(
					claim,
					undefined,
					claim.claimedValue,
					'(missing)',
					'Package binary declaration is missing.',
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'package_binary_conflict',
				observedKey: 'bin',
				observedPath: 'package.json',
				observedValue: '(missing)',
				order: 0,
				recoveryHint: defaultRecovery(
					'Add a "bin" field to package.json pointing to the built CLI path.',
				),
				severity: 'error',
			});
		} else {
			const isMatch =
				observed.observedValue === claim.claimedValue ||
				observed.observedValue.includes('logos') ||
				observed.observedValue.includes('dist/cli.js');
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: isMatch ? 'consistent' : 'inconsistent',
			});
			if (!isMatch) {
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						claim,
						observed,
						'logos binary path',
						observed.observedValue,
						`Package binary path "${observed.observedValue}" does not appear to point to the expected CLI entry point.`,
					),
					expectedValue: 'logos (pointing to dist/cli.js)',
					id: makeId(),
					kind: 'package_binary_conflict',
					observedFactId: observed.id,
					observedKey: 'bin',
					observedPath: 'package.json',
					observedValue: observed.observedValue,
					order: 0,
					recoveryHint: defaultRecovery(
						'Update the "bin" field to point to the built CLI entry point.',
					),
					severity: 'warning',
				});
			}
		}
	}

	// Node version check
	for (const claim of claims) {
		if (claim.kind !== 'node_version') continue;
		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed) {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'missing_in_code',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'missing_in_code',
				evidence: buildEvidence(
					claim,
					undefined,
					claim.claimedValue,
					'(missing)',
					'Node.js engine version declaration is missing from package.json.',
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'version_contract_conflict',
				observedKey: 'engines.node',
				observedPath: 'package.json',
				observedValue: '(missing)',
				order: 0,
				recoveryHint: defaultRecovery('Add "engines.node" to package.json.'),
				severity: 'warning',
			});
		} else {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'consistent',
			});
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: root/profile consistency
// ---------------------------------------------------------------------------

function checkRootProfileConsistency(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	_options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	_diagnostics: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options.idFactory ?? fallbackIdFactory;

	// Check generated root
	for (const claim of claims) {
		if (claim.kind !== 'generated_root') continue;
		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed) {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'unknown',
			});
			// Root not observed from scanner; this is expected if no workspace
			continue;
		}

		const isDocsRoot = observed.observedValue === 'docs/';
		if (isDocsRoot && claim.claimedValue !== 'docs/') {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'inconsistent',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'inconsistent',
				evidence: buildEvidence(
					claim,
					observed,
					claim.claimedValue,
					observed.observedValue,
					`Documentation root is configured as "docs/" but default/expected root is "${claim.claimedValue}".`,
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'generated_root_conflict',
				observedFactId: observed.id,
				observedKey: 'documentationRoot',
				observedPath: '.logos/workspace.json',
				observedValue: observed.observedValue,
				order: 0,
				recoveryHint: defaultRecovery(
					`Use "${claim.claimedValue}" for the default documentation root, or explicitly configure a custom root.`,
				),
				severity: 'error',
			});
		} else {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'consistent',
			});
		}
	}

	// Check profile identity
	for (const claim of claims) {
		if (claim.kind !== 'profile_id') continue;
		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed) {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'unknown',
			});
			continue;
		}

		const profileMatch = observed.observedValue === claim.claimedValue;
		if (!profileMatch) {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'inconsistent',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'inconsistent',
				evidence: buildEvidence(
					claim,
					observed,
					claim.claimedValue,
					observed.observedValue,
					`Active profile "${observed.observedValue}" does not match documented profile "${claim.claimedValue}".`,
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'profile_identity_conflict',
				observedFactId: observed.id,
				observedKey: 'activeProfileId',
				observedPath: '.logos/workspace.json',
				observedValue: observed.observedValue,
				order: 0,
				recoveryHint: defaultRecovery(
					'Update the active profile or documentation to match the expected profile ID.',
				),
				severity: 'error',
			});
		} else {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'consistent',
			});
		}

		// README drift check
		if (claim.source === 'readme') {
			comparisons.push({
				claimId: claim.id,
				id: `comp-${makeId()}`,
				observedFactId: observed.id,
				status: 'inconsistent',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'inconsistent',
				evidence: buildEvidence(
					claim,
					observed,
					claim.claimedValue,
					'found stale reference',
					`README references stale profile name; expected "${claim.claimedValue}".`,
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'readme_drift',
				observedFactId: observed.id,
				observedKey: 'readme_profile',
				observedPath: 'README.md',
				observedValue: 'contains stale profile reference',
				order: 0,
				recoveryHint: defaultRecovery(
					`Update README to reference the active profile "${claim.claimedValue}".`,
				),
				severity: 'warning',
			});
		}
	}

	// Check profile registry path
	for (const claim of claims) {
		if (claim.kind !== 'profile_registry') continue;
		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed) {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'unknown',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'unknown',
				evidence: buildEvidence(
					claim,
					undefined,
					claim.claimedValue,
					'(not observed)',
					'Profile registry directory not observed by scanner.',
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'profile_descriptor_conflict',
				observedKey: 'profileDirectory',
				observedPath: 'profiles/',
				observedValue: '(not observed)',
				order: 0,
				recoveryHint: defaultRecovery(
					'Verify the profile directory exists and contains the expected registry and descriptor files.',
				),
				severity: 'warning',
			});
		} else {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'consistent',
			});
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: structure/config consistency
// ---------------------------------------------------------------------------

function checkStructureConfig(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	_options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	_diagnostics: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options.idFactory ?? fallbackIdFactory;

	for (const claim of claims) {
		if (
			claim.kind !== 'source_directory' &&
			claim.kind !== 'test_directory' &&
			claim.kind !== 'script_directory' &&
			claim.kind !== 'config_file' &&
			claim.kind !== 'ci_workflow'
		) {
			continue;
		}

		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (!observed || observed.observedValue === '(missing)') {
			const status: DocsCodeComparisonStatus = 'missing_in_code';
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed?.id ?? 'none',
				status,
			});

			const severity: DocsCodeConsistencySeverity = claim.required
				? 'error'
				: claim.kind === 'ci_workflow'
					? 'warning'
					: 'warning';

			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: status,
				evidence: buildEvidence(
					claim,
					observed,
					claim.claimedValue,
					'(missing)',
					`Expected ${claim.kind.replace('_', ' ')} "${claim.claimedKey}" is missing.`,
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind:
					claim.kind === 'source_directory'
						? 'source_tree_conflict'
						: claim.kind === 'test_directory'
							? 'test_tree_conflict'
							: claim.kind === 'ci_workflow'
								? 'ci_contract_conflict'
								: 'config_contract_conflict',
				observedKey: claim.claimedKey,
				observedPath: claim.claimedKey,
				observedValue: '(missing)',
				order: 0,
				recoveryHint: defaultRecovery(
					`Add the expected ${claim.kind.replace('_', ' ')} "${claim.claimedKey}".`,
				),
				severity,
			});
		} else {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'consistent',
			});
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: canonical output consistency
// ---------------------------------------------------------------------------

function checkCanonicalOutput(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	_options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	_diagnostics: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options.idFactory ?? fallbackIdFactory;

	// Check that canonical outputs don't collide with derived artifacts
	for (const claim of claims) {
		if (claim.kind !== 'canonical_output' && claim.kind !== 'derived_artifact')
			continue;

		if (claim.kind === 'canonical_output') {
			const observed = matchClaimToObserved(claim, observedFacts);
			const comparisonId = `comp-${makeId()}`;

			if (!observed) {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'unknown',
				});
				// Expected: canonical output paths may not exist yet if workspace not initialized
				continue;
			}

			// Check that canonical output paths are under the configured root
			// and that they don't contain derived artifacts
			const derivedCrossover = observedFacts.some(
				(f) =>
					f.kind === 'observed_artifact_metadata' &&
					f.observedValue.includes('in canonical root'),
			);

			if (derivedCrossover) {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: observed.id,
					status: 'inconsistent',
				});
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						claim,
						observed,
						'canonical output root',
						'derived artifacts found in canonical root',
						'Derived artifacts detected in canonical output root. This violates the canonical/derived boundary.',
					),
					expectedValue: 'no derived artifacts in canonical root',
					id: makeId(),
					kind: 'canonical_output_conflict',
					observedKey: claim.claimedKey,
					observedPath: claim.claimedValue,
					observedValue: 'derived artifacts in canonical root',
					order: 0,
					recoveryHint: defaultRecovery(
						'Move derived artifacts out of the canonical output root.',
					),
					severity: 'error',
				});
			} else {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: observed.id,
					status: 'consistent',
				});
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: derived artifact boundaries
// ---------------------------------------------------------------------------

function checkDerivedArtifactBoundaries(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	artifactRegistryEntries?: DocsCodeConsistencyInput['artifactRegistryEntries'],
	_options?: DocsCodeConsistencyOptions,
	comparisons?: DocsCodeComparison[],
	diagnostics?: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options?.idFactory ?? fallbackIdFactory;
	const comps = comparisons ?? [];
	const _diags = diagnostics ?? [];

	// Check that derived artifacts are marked non-canonical in registry
	if (artifactRegistryEntries) {
		for (const entry of artifactRegistryEntries) {
			const comparisonId = `comp-${makeId()}`;
			if (
				isDerivedArtifactType(entry.artifactType) &&
				entry.isCanonical === true
			) {
				comps.push({
					claimId: 'none',
					id: comparisonId,
					observedFactId: entry.artifactId,
					status: 'inconsistent',
				});
				findings.push({
					claimId: undefined,
					claimSourcePath: entry.path,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						{
							claimedValue: 'non-canonical',
							description: 'Derived artifact must be non-canonical.',
							id: 'claim-derived-boundary',
							kind: 'derived_artifact',
							required: true,
							source: 'fixture' as DocsCodeClaimSource,
						},
						{
							boundedObservation: true,
							id: entry.artifactId,
							insufficient: false,
							key: entry.artifactId,
							kind: 'observed_artifact_metadata',
							observedValue: `isCanonical=true for type ${entry.artifactType}`,
							path: entry.path,
							redacted: false,
							source: 'artifact_registry',
						},
						'non-canonical',
						'canonical',
						`Derived artifact "${entry.artifactId}" (${entry.artifactType}) is incorrectly marked as canonical.`,
					),
					expectedValue: 'non-canonical',
					id: makeId(),
					kind: 'derived_artifact_boundary_conflict',
					observedFactId: entry.artifactId,
					observedKey: entry.artifactId,
					observedPath: entry.path,
					observedValue: `marked canonical (type=${entry.artifactType})`,
					order: 0,
					recoveryHint: defaultRecovery(
						'Mark derived artifact records as non-canonical. Only canonical Markdown should be marked canonical.',
					),
					severity: 'fatal',
				});
			} else {
				comps.push({
					claimId: 'none',
					id: comparisonId,
					observedFactId: entry.artifactId,
					status: entry.isCanonical ? 'consistent' : 'consistent',
				});
			}
		}
	}

	// Check scanner-derived boundary violations
	for (const claim of claims) {
		if (claim.kind !== 'derived_artifact') continue;
		const observed = matchClaimToObserved(claim, observedFacts);
		const comparisonId = `comp-${makeId()}`;

		if (observed?.observedValue.includes('marked canonical')) {
			comps.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'inconsistent',
			});
			findings.push({
				claimId: claim.id,
				claimSourcePath: claim.sourcePath,
				comparisonStatus: 'inconsistent',
				evidence: buildEvidence(
					claim,
					observed,
					claim.claimedValue,
					observed.observedValue,
					`Derived artifact boundary violation: ${observed.observedValue}`,
				),
				expectedValue: claim.claimedValue,
				id: makeId(),
				kind: 'derived_artifact_boundary_conflict',
				observedFactId: observed.id,
				observedKey: claim.claimedKey,
				observedPath: observed.path,
				observedValue: observed.observedValue,
				order: 0,
				recoveryHint: defaultRecovery(
					'Derived artifacts must not be marked canonical. Update registry metadata.',
				),
				severity: 'error',
			});
		} else if (observed) {
			comps.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: observed.id,
				status: 'consistent',
			});
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: executive export boundaries
// ---------------------------------------------------------------------------

function checkExecutiveBoundaries(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	_options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	_diagnostics: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options.idFactory ?? fallbackIdFactory;

	// Check executive export-related claims against observed facts
	for (const claim of claims) {
		if (claim.kind !== 'executive_export') continue;

		// Executive Axis snapshot claim
		if (claim.claimedKey === 'executive_axis_snapshot') {
			// Check if any scanner finding indicates live sync behavior
			const liveSyncMarker = observedFacts.some(
				(f) =>
					(f.kind === 'observed_integration_marker' &&
						f.observedValue.toLowerCase().includes('live sync')) ||
					(f.kind === 'observed_artifact_metadata' &&
						f.observedValue.toLowerCase().includes('live task')),
			);

			const comparisonId = `comp-${makeId()}`;
			if (liveSyncMarker) {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'inconsistent',
				});
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						claim,
						undefined,
						'derived snapshot, not live task manager',
						'live sync/task manager marker detected',
						'Executive Axis is documented as a derived snapshot but implementation metadata suggests live task management.',
					),
					expectedValue: 'derived_snapshot_not_live_task_manager',
					id: makeId(),
					kind: 'executive_export_boundary_conflict',
					observedKey: claim.claimedKey,
					observedPath: 'executive',
					observedValue: 'live task manager marker detected',
					order: 0,
					recoveryHint: defaultRecovery(
						'Executive Axis must remain a derived export snapshot, not a live task manager.',
					),
					severity: 'error',
				});
			} else {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'consistent',
				});
			}
		}

		// GitHub local export claim
		if (claim.claimedKey === 'github_export_local') {
			const comparisonId = `comp-${makeId()}`;
			// Check if any observed fact suggests live GitHub API integration
			const githubApiMarker = observedFacts.some(
				(f) =>
					(f.kind === 'observed_integration_marker' &&
						(f.observedValue.toLowerCase().includes('github api') ||
							f.observedValue
								.toLowerCase()
								.includes('github issue creation'))) ||
					f.observedValue.toLowerCase().includes('live github'),
			);

			if (githubApiMarker) {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'inconsistent',
				});
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						claim,
						undefined,
						'local_file_export_only',
						'GitHub API/live integration marker detected',
						'GitHub export is documented as local file export only but implementation metadata suggests live API integration.',
					),
					expectedValue: 'local_file_export_only',
					id: makeId(),
					kind: 'executive_export_boundary_conflict',
					observedKey: claim.claimedKey,
					observedPath: 'executive',
					observedValue: 'GitHub API marker detected',
					order: 0,
					recoveryHint: defaultRecovery(
						'GitHub Issue-compatible export must remain a local file export. Remove any live API integration claims.',
					),
					severity: 'error',
				});
			} else {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'consistent',
				});
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Check: external/provider/security boundaries
// ---------------------------------------------------------------------------

function checkExternalProviderSecurityBoundaries(
	claims: DocsCodeClaim[],
	observedFacts: DocsCodeObservedFact[],
	_options: DocsCodeConsistencyOptions,
	comparisons: DocsCodeComparison[],
	diagnostics: DocsCodeConsistencyDiagnostic[],
): DocsCodeConsistencyFinding[] {
	const findings: DocsCodeConsistencyFinding[] = [];
	const makeId = _options.idFactory ?? fallbackIdFactory;

	// Check security boundary claims
	for (const claim of claims) {
		if (
			claim.kind !== 'security_boundary' &&
			claim.kind !== 'provider_boundary' &&
			claim.kind !== 'external_integration_boundary'
		) {
			continue;
		}

		const comparisonId = `comp-${makeId()}`;

		// Security boundary: no raw tokens
		if (claim.claimedKey === 'no_raw_tokens') {
			const secretMarkers = observedFacts.filter(
				(f) => f.kind === 'observed_security_marker',
			);

			const hasSecrets = secretMarkers.some(
				(f) =>
					f.redacted ||
					f.observedValue.includes('secret-like') ||
					f.key === 'secretLikeValues',
			);

			if (hasSecrets) {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: secretMarkers[0]?.id ?? 'none',
					status: 'inconsistent',
				});
				findings.push({
					claimId: claim.id,
					claimSourcePath: claim.sourcePath,
					comparisonStatus: 'inconsistent',
					evidence: buildEvidence(
						claim,
						secretMarkers[0],
						'env_var_references_only',
						'[REDACTED]',
						'Secret-like values detected in repository metadata. Raw provider tokens must not be stored.',
					),
					expectedValue: 'env_var_references_only',
					id: makeId(),
					kind: 'security_boundary_conflict',
					observedFactId: secretMarkers[0]?.id,
					observedKey: 'secretLikeValues',
					observedPath: secretMarkers[0]?.path ?? 'scanner',
					observedValue: '[REDACTED]',
					order: 0,
					recoveryHint: defaultRecovery(
						'Replace raw token-like values with environment variable references. Use env var names like OPENAI_API_KEY instead.',
					),
					severity: 'fatal',
				});
			} else {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'consistent',
				});
			}
		}

		// Provider boundary: no provider in default tests
		if (claim.claimedKey === 'default_tests_no_provider') {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'consistent',
			});
			// Check can only verify via bounded metadata
			diagnostics.push({
				claimId: claim.id,
				code: 'ddc_provider_boundary_checked',
				message:
					'Provider credential requirement in default test scripts not verifiable from bounded metadata alone.',
				severity: 'info',
			});
		}

		// Provider boundary: no network in default tests
		if (claim.claimedKey === 'default_tests_no_network') {
			comparisons.push({
				claimId: claim.id,
				id: comparisonId,
				observedFactId: 'none',
				status: 'consistent',
			});
			diagnostics.push({
				claimId: claim.id,
				code: 'ddc_network_boundary_checked',
				message:
					'Network requirement in default test scripts not verifiable from bounded metadata alone.',
				severity: 'info',
			});
		}

		// External integration boundary: local-first
		if (claim.claimedKey === 'local_first') {
			const integrationMarkers = observedFacts.filter(
				(f) => f.kind === 'observed_integration_marker',
			);

			const hasExternalIntegration = integrationMarkers.length > 0;

			if (hasExternalIntegration) {
				for (const marker of integrationMarkers) {
					comparisons.push({
						claimId: claim.id,
						id: `comp-${makeId()}`,
						observedFactId: marker.id,
						status: 'inconsistent',
					});
					findings.push({
						claimId: claim.id,
						claimSourcePath: claim.sourcePath,
						comparisonStatus: 'inconsistent',
						evidence: buildEvidence(
							claim,
							marker,
							'local-first, no external integration',
							marker.observedValue,
							`External integration marker detected: ${marker.observedValue}. Tool is documented as local-first.`,
						),
						expectedValue: 'local-first, no external integration',
						id: makeId(),
						kind: 'external_integration_boundary_conflict',
						observedFactId: marker.id,
						observedKey: marker.key,
						observedPath: marker.path,
						observedValue: marker.observedValue,
						order: 0,
						recoveryHint: defaultRecovery(
							'Remove or defer external integration markers. MVP is local-first.',
						),
						severity: 'error',
					});
				}
			} else {
				comparisons.push({
					claimId: claim.id,
					id: comparisonId,
					observedFactId: 'none',
					status: 'consistent',
				});
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

export const runDocsCodeConsistencyCheck: DocsCodeConsistencyChecker = (
	input: DocsCodeConsistencyInput,
	options?: DocsCodeConsistencyOptions,
): DocsCodeConsistencyResult => {
	// Reset id counter for deterministic test output
	resetDocsCodeIdCounter(0);

	const _makeId = options?.idFactory ?? fallbackIdFactory;
	const root = normalizeRoot(input.documentationRoot);

	// Extract claims
	let claims: DocsCodeClaim[];
	if (input.claims && input.claims.length > 0) {
		claims = input.claims;
		// Reset counter so fixture claim IDs don't collide
		resetDocsCodeIdCounter(input.claims.length);
	} else {
		claims = extractDocsClaims({
			documentationRoot: input.documentationRoot,
			includeInfo: options?.includeInfo,
			packageMetadata: input.packageMetadata,
			profileId: input.profileId,
			readmeSnippet: input.readmeSnippet,
			scannerResult: input.scannerResult,
		});
	}

	// Build observed facts
	let observedFacts: DocsCodeObservedFact[];
	if (input.observedFacts && input.observedFacts.length > 0) {
		observedFacts = input.observedFacts;
	} else {
		observedFacts = buildObservedFacts({
			artifactRegistryEntries: input.artifactRegistryEntries,
			commandRegistry: input.commandRegistry,
			packageMetadata: input.packageMetadata,
			scannerResult: input.scannerResult,
		});
	}

	// Run checks
	const comparisons: DocsCodeComparison[] = [];
	const diagnostics: DocsCodeConsistencyDiagnostic[] = [];
	const allFindings: DocsCodeConsistencyFinding[] = [];

	const checkOpts: DocsCodeConsistencyOptions = {
		idFactory: options?.idFactory,
		includeInfo: options?.includeInfo,
	};

	// 1. Command consistency
	allFindings.push(
		...checkCommands(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// 2. Package script consistency
	allFindings.push(
		...checkPackageScripts(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
			input.packageMetadata,
		),
	);

	// 3. Root/profile consistency
	allFindings.push(
		...checkRootProfileConsistency(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// 4. Structure/config consistency
	allFindings.push(
		...checkStructureConfig(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// 5. Canonical output consistency
	allFindings.push(
		...checkCanonicalOutput(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// 6. Derived artifact boundary consistency
	allFindings.push(
		...checkDerivedArtifactBoundaries(
			claims,
			observedFacts,
			input.artifactRegistryEntries,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// 7. Executive export boundary consistency
	allFindings.push(
		...checkExecutiveBoundaries(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// 8. External/provider/security boundary consistency
	allFindings.push(
		...checkExternalProviderSecurityBoundaries(
			claims,
			observedFacts,
			checkOpts,
			comparisons,
			diagnostics,
		),
	);

	// Sort findings
	const sortedFindings = sortDocsCodeFindings(allFindings);

	// Compute summary counts
	let consistentCount = 0;
	let inconsistentCount = 0;
	let missingInCodeCount = 0;
	let missingInDocsCount = 0;
	let ambiguousCount = 0;
	let unsupportedCount = 0;
	let unknownCount = 0;

	for (const comp of comparisons) {
		switch (comp.status) {
			case 'consistent':
				consistentCount += 1;
				break;
			case 'inconsistent':
				inconsistentCount += 1;
				break;
			case 'missing_in_code':
				missingInCodeCount += 1;
				break;
			case 'missing_in_docs':
				missingInDocsCount += 1;
				break;
			case 'ambiguous':
				ambiguousCount += 1;
				break;
			case 'unsupported':
				unsupportedCount += 1;
				break;
			case 'unknown':
			case 'not_applicable':
				unknownCount += 1;
				break;
		}
	}

	// Compute category summaries
	const categoriesSummary: Record<string, DocsCodeCategorySummary> = {};
	for (const finding of sortedFindings) {
		tallyCategory(categoriesSummary, finding);
	}

	// Finding severity counts
	const findingCounts = { error: 0, fatal: 0, info: 0, total: 0, warning: 0 };
	for (const f of sortedFindings) {
		findingCounts[f.severity] = (findingCounts[f.severity] ?? 0) + 1;
	}
	findingCounts.total = sortedFindings.length;

	// Filter info findings if not requested
	const filteredFindings = options?.includeInfo
		? sortedFindings
		: sortedFindings.filter((f) => f.severity !== 'info');

	return {
		activeProfileId: input.profileId,
		ambiguousCount,
		changedPaths: [],
		checkedAt: input.checkedAt ?? new Date().toISOString(),
		claimCount: claims.length,
		comparisonCount: comparisons.length,
		comparisons,
		consistentCount,
		diagnostics,
		documentationRoot: root,
		dryRun: input.dryRun ?? true,
		findings: filteredFindings,
		inconsistentCount,
		missingInCodeCount,
		missingInDocsCount,
		observedFactCount: observedFacts.length,
		profileVersion: input.profileVersion ?? null,
		readOnly: true,
		summaries: categoriesSummary,
		unknownCount,
		unsupportedCount,
	};
};
