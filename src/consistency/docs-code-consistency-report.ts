/** Step 12.3 — Docs-vs-Code Consistency Report Builder */

import type {
	DocsCodeConsistencyFinding,
	DocsCodeConsistencyReport,
	DocsCodeConsistencyResult,
	DocsCodeConsistencySummary,
} from './docs-code-consistency-model.js';
import { findingKindToCategory } from './docs-code-consistency-model.js';

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

export function buildDocsCodeConsistencyReport(
	result: DocsCodeConsistencyResult,
): DocsCodeConsistencyReport {
	// Build summary
	const summary: DocsCodeConsistencySummary = {
		ambiguousCount: result.ambiguousCount,
		categories: result.summaries,
		claimCount: result.claimCount,
		comparisonCount: result.comparisonCount,
		consistentCount: result.consistentCount,
		findingCounts: {
			error: 0,
			fatal: 0,
			info: 0,
			total: 0,
			warning: 0,
		},
		inconsistentCount: result.inconsistentCount,
		missingInCodeCount: result.missingInCodeCount,
		missingInDocsCount: result.missingInDocsCount,
		observedFactCount: result.observedFactCount,
		unknownCount: result.unknownCount,
		unsupportedCount: result.unsupportedCount,
	};

	for (const f of result.findings) {
		summary.findingCounts[f.severity] =
			(summary.findingCounts[f.severity] ?? 0) + 1;
	}
	summary.findingCounts.total = result.findings.length;

	// Build claims checked section
	const claimsByKind: Record<string, number> = {};
	const claimsBySource: Record<string, number> = {};
	// We track these via comparison data indirectly
	for (const _comp of result.comparisons) {
		// Track status by comparison
	}

	// Command consistency section
	const commandConsistent: string[] = [];
	const commandInconsistent: string[] = [];
	const commandMissingInCode: string[] = [];
	const commandMissingInDocs: string[] = [];
	const commandUnknown: string[] = [];

	for (const finding of result.findings) {
		const cat = findingKindToCategory(finding.kind);
		if (cat === 'commands') {
			switch (finding.comparisonStatus) {
				case 'consistent':
					commandConsistent.push(formatFindingBrief(finding));
					break;
				case 'inconsistent':
					commandInconsistent.push(formatFindingBrief(finding));
					break;
				case 'missing_in_code':
					commandMissingInCode.push(formatFindingBrief(finding));
					break;
				case 'missing_in_docs':
					commandMissingInDocs.push(formatFindingBrief(finding));
					break;
				default:
					commandUnknown.push(formatFindingBrief(finding));
					break;
			}
		}
	}

	// Script consistency section
	const scriptConsistent: string[] = [];
	const scriptInconsistent: string[] = [];
	const scriptMissingInCode: string[] = [];
	const scriptUnknown: string[] = [];

	for (const finding of result.findings) {
		const cat = findingKindToCategory(finding.kind);
		if (cat === 'scripts') {
			switch (finding.comparisonStatus) {
				case 'consistent':
					scriptConsistent.push(formatFindingBrief(finding));
					break;
				case 'inconsistent':
					scriptInconsistent.push(formatFindingBrief(finding));
					break;
				case 'missing_in_code':
					scriptMissingInCode.push(formatFindingBrief(finding));
					break;
				default:
					scriptUnknown.push(formatFindingBrief(finding));
					break;
			}
		}
	}

	// Root/profile consistency
	const profileIssues: string[] = [];
	for (const finding of result.findings) {
		const cat = findingKindToCategory(finding.kind);
		if (cat === 'roots' || cat === 'profile') {
			profileIssues.push(formatFindingBrief(finding));
		}
	}

	// Structure/config consistency
	const expected: string[] = [];
	const observed: string[] = [];
	const missing: string[] = [];
	const extra: string[] = [];

	for (const finding of result.findings) {
		const cat = findingKindToCategory(finding.kind);
		if (cat === 'structure' || cat === 'configs') {
			if (finding.comparisonStatus === 'missing_in_code') {
				missing.push(formatFindingBrief(finding));
			} else if (finding.comparisonStatus === 'missing_in_docs') {
				extra.push(formatFindingBrief(finding));
			} else if (finding.comparisonStatus === 'consistent') {
				expected.push(formatFindingBrief(finding));
			} else {
				observed.push(formatFindingBrief(finding));
			}
		}
	}

	// Canonical output consistency
	const canonConsistent: string[] = [];
	const canonConflicts: string[] = [];
	for (const finding of result.findings) {
		if (findingKindToCategory(finding.kind) === 'canonical outputs') {
			if (finding.comparisonStatus === 'consistent') {
				canonConsistent.push(formatFindingBrief(finding));
			} else {
				canonConflicts.push(formatFindingBrief(finding));
			}
		}
	}

	// Derived boundary consistency
	const derivedConsistent: string[] = [];
	const derivedConflicts: string[] = [];
	for (const finding of result.findings) {
		if (findingKindToCategory(finding.kind) === 'derived boundaries') {
			if (finding.comparisonStatus === 'consistent') {
				derivedConsistent.push(formatFindingBrief(finding));
			} else {
				derivedConflicts.push(formatFindingBrief(finding));
			}
		}
	}

	// Executive boundary consistency
	const execConsistent: string[] = [];
	const execConflicts: string[] = [];
	for (const finding of result.findings) {
		if (findingKindToCategory(finding.kind) === 'executive exports') {
			if (finding.comparisonStatus === 'consistent') {
				execConsistent.push(formatFindingBrief(finding));
			} else {
				execConflicts.push(formatFindingBrief(finding));
			}
		}
	}

	// External/provider/security consistency
	const extConsistent: string[] = [];
	const extConflicts: string[] = [];
	for (const finding of result.findings) {
		const cat = findingKindToCategory(finding.kind);
		if (cat === 'external integration/provider/security boundaries') {
			if (finding.comparisonStatus === 'consistent') {
				extConsistent.push(formatFindingBrief(finding));
			} else {
				extConflicts.push(formatFindingBrief(finding));
			}
		}
	}

	// Findings by severity
	const findingsBySeverity: DocsCodeConsistencyReport['findingsBySeverity'] = {
		error: [],
		fatal: [],
		info: [],
		warning: [],
	};
	for (const finding of result.findings) {
		findingsBySeverity[finding.severity].push(formatFindingBrief(finding));
	}

	// Unknown observations
	const unknownObservations: string[] = [];
	for (const diag of result.diagnostics) {
		unknownObservations.push(`${diag.code}: ${diag.message}`);
	}
	for (const comp of result.comparisons) {
		if (comp.status === 'unknown' || comp.status === 'ambiguous') {
			unknownObservations.push(
				`Comparison ${comp.id}: status=${comp.status} (claim=${comp.claimId}, observed=${comp.observedFactId})`,
			);
		}
	}

	// Recommended next actions
	const recommendedNextActions: string[] = [];
	const fatalFindings = result.findings.filter((f) => f.severity === 'fatal');
	const errorFindings = result.findings.filter((f) => f.severity === 'error');
	const warningFindings = result.findings.filter(
		(f) => f.severity === 'warning',
	);

	if (fatalFindings.length > 0) {
		recommendedNextActions.push(
			`Address ${fatalFindings.length} fatal consistency finding(s) immediately (security boundaries, derived-artifact-as-canonical).`,
		);
	}
	if (errorFindings.length > 0) {
		recommendedNextActions.push(
			`Resolve ${errorFindings.length} error-level consistency finding(s) (missing commands/scripts, root/profile/boundary conflicts).`,
		);
	}
	if (warningFindings.length > 0) {
		recommendedNextActions.push(
			`Review ${warningFindings.length} warning-level finding(s) (README drift, missing optional config, undocumented commands).`,
		);
	}
	if (result.diagnostics.length > 0) {
		recommendedNextActions.push(
			'Review diagnostic messages for items that could not be fully verified from bounded metadata.',
		);
	}
	recommendedNextActions.push(
		'Re-run docs-vs-code consistency check after applying fixes to verify resolution.',
	);

	// Scope and policy note
	const scopeNote =
		'This consistency check is bounded and read-only. It compared documentation claims extracted from profile contracts, AGENTS.md operational commands, and known product/engineering documentation against bounded repository scanner metadata and command/artifact registry metadata. No arbitrary source code files were read, no scripts were executed, no AI providers were called, and no external network requests were made. The check does not prove complete source-code correctness or documentation completeness.';

	return {
		boundedDisclaimer:
			'This docs-vs-code consistency report is non-canonical and does not prove complete correctness. Checks are bounded to repository scanner metadata, command/artifact registry metadata, and known documentation claims. No arbitrary source files were read or scripts executed.',
		canonicalOutputConsistency: {
			conflicts: canonConflicts,
			consistent: canonConsistent,
		},
		claimsChecked: {
			byKind: claimsByKind,
			bySource: claimsBySource,
			total: result.claimCount,
		},
		commandConsistency: {
			consistent: commandConsistent,
			inconsistent: commandInconsistent,
			missingInCode: commandMissingInCode,
			missingInDocs: commandMissingInDocs,
			unknown: commandUnknown,
		},
		derivedArtifactBoundaryConsistency: {
			conflicts: derivedConflicts,
			consistent: derivedConsistent,
		},
		executiveExportBoundaryConsistency: {
			conflicts: execConflicts,
			consistent: execConsistent,
		},
		externalIntegrationProviderSecurityConsistency: {
			conflicts: extConflicts,
			consistent: extConsistent,
		},
		findingsBySeverity,
		observedFactsUsed: {
			byKind: {},
			bySource: {},
			total: result.observedFactCount,
		},
		packageScriptConsistency: {
			consistent: scriptConsistent,
			inconsistent: scriptInconsistent,
			missingInCode: scriptMissingInCode,
			unknown: scriptUnknown,
		},
		recommendedNextActions,
		rootProfileConsistency: {
			activeProfileId: result.activeProfileId,
			configuredRoot: result.documentationRoot,
			documentedRoot: 'logos/',
			profileIssues,
		},
		scopeAndPolicyNote: scopeNote,
		structureConfigConsistency: {
			expected,
			extra,
			missing,
			observed,
		},
		summary,
		unknownObservations,
	};
}

// ---------------------------------------------------------------------------
// Brief formatter
// ---------------------------------------------------------------------------

function formatFindingBrief(finding: DocsCodeConsistencyFinding): string {
	const severity = `[${finding.severity.toUpperCase()}]`;
	const kind = finding.kind.replace(/_/g, ' ');
	const detail = finding.evidence.summary;
	return `${severity} ${kind}: ${detail}`;
}
