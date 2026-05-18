/** Step 9.1 — HTML Artifact Planner: read-only planning service for HTML artifact generation */

import { discoverHtmlArtifactDeclarations } from './html-artifact-declarations.js';
import type {
	HtmlArtifactAction,
	HtmlArtifactBlocker,
	HtmlArtifactDeclaration,
	HtmlArtifactDiagnostic,
	HtmlArtifactPlan,
	HtmlArtifactPlanInput,
	HtmlArtifactPlanItem,
	HtmlArtifactPlanOptions,
	HtmlArtifactPlanResult,
	HtmlArtifactReadiness,
	HtmlArtifactReasonCode,
	HtmlArtifactSource,
	HtmlArtifactStatus,
	HtmlArtifactSummary,
} from './html-artifact-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<HtmlArtifactDiagnostic>,
): HtmlArtifactDiagnostic {
	return {
		code,
		expected: undefined,
		fieldPath: undefined,
		message,
		received: undefined,
		recoveryHint: undefined,
		relatedArtifactId: undefined,
		relatedArtifactKind: undefined,
		relatedGraphNodeId: undefined,
		relatedPhaseId: undefined,
		relatedSourceDocumentId: undefined,
		severity,
		sourcePath: undefined,
		...overrides,
	};
}

function createBlocker(
	code: HtmlArtifactReasonCode,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<HtmlArtifactBlocker>,
): HtmlArtifactBlocker {
	return {
		artifactKind: undefined,
		code,
		expected: undefined,
		graphNodeId: undefined,
		message,
		received: undefined,
		recoveryHint: undefined,
		relatedPhaseId: undefined,
		severity,
		sourceDocumentId: undefined,
		sourceKind: undefined,
		sourcePath: undefined,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

function resolveSources(
	declaration: HtmlArtifactDeclaration,
	input: HtmlArtifactPlanInput,
): HtmlArtifactSource[] {
	const sources: HtmlArtifactSource[] = [];

	if (
		declaration.documentCanonicalId !== undefined &&
		declaration.declarationSource === 'document_descriptor'
	) {
		const contractOutputs = input.contractGraph.getOutputsByDocumentId(
			declaration.documentCanonicalId,
		);
		const canonicalOutput = contractOutputs.find((o) => o.kind === 'canonical');
		sources.push({
			documentCanonicalId: declaration.documentCanonicalId,
			label: canonicalOutput?.path,
			outputPath: canonicalOutput?.path,
			phaseId: declaration.phaseId,
			required: true,
			sourceId: `canonical:${declaration.documentCanonicalId}`,
			sourceKind: 'canonical_markdown',
			status: undefined,
		});
	} else if (
		declaration.phaseId !== undefined &&
		declaration.documentCanonicalId === undefined
	) {
		const phaseDocs = input.contract.documents.filter(
			(d) => d.phaseId === declaration.phaseId,
		);
		for (const doc of phaseDocs) {
			const contractOutputs = input.contractGraph.getOutputsByDocumentId(
				doc.canonicalId,
			);
			const canonicalOutput = contractOutputs.find(
				(o) => o.kind === 'canonical',
			);
			if (canonicalOutput !== undefined) {
				sources.push({
					documentCanonicalId: doc.canonicalId,
					label: canonicalOutput.path,
					outputPath: canonicalOutput.path,
					phaseId: declaration.phaseId,
					required: true,
					sourceId: `canonical:${doc.canonicalId}`,
					sourceKind: 'canonical_markdown',
					status: undefined,
				});
			}
		}
	} else if (declaration.declarationSource === 'executive_html_mapping') {
		for (const doc of input.contract.documents) {
			const contractOutputs = input.contractGraph.getOutputsByDocumentId(
				doc.canonicalId,
			);
			const canonicalOutput = contractOutputs.find(
				(o) => o.kind === 'canonical',
			);
			if (canonicalOutput !== undefined) {
				sources.push({
					documentCanonicalId: doc.canonicalId,
					label: canonicalOutput.path,
					outputPath: canonicalOutput.path,
					phaseId: doc.phaseId,
					required: false,
					sourceId: `canonical:${doc.canonicalId}`,
					sourceKind: 'canonical_markdown',
					status: undefined,
				});
			}
		}
		sources.push({
			documentCanonicalId: undefined,
			label: 'Executive JSON execution model',
			outputPath: undefined,
			phaseId: undefined,
			required: true,
			sourceId: 'executive:json',
			sourceKind: 'executive_metadata',
			status: undefined,
		});
	}

	// Add register sources based on artifact kind
	switch (declaration.artifactKind) {
		case 'decision_map':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Decision register',
				outputPath: undefined,
				phaseId: undefined,
				required: true,
				sourceId: 'register:decisions',
				sourceKind: 'decision_register',
				status: undefined,
			});
			break;
		case 'risk_map':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Risk register',
				outputPath: undefined,
				phaseId: undefined,
				required: true,
				sourceId: 'register:risks',
				sourceKind: 'risk_register',
				status: undefined,
			});
			break;
		case 'validation_summary':
		case 'readiness_view':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Validation findings',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'validation:findings',
				sourceKind: 'validation_finding',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Staleness report',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'staleness:report',
				sourceKind: 'staleness_report',
				status: undefined,
			});
			break;
		case 'executive_readiness':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Executive readiness metadata',
				outputPath: undefined,
				phaseId: undefined,
				required: true,
				sourceId: 'executive:readiness',
				sourceKind: 'executive_metadata',
				status: undefined,
			});
			break;
		default:
			break;
	}

	return sources;
}

// ---------------------------------------------------------------------------
// Staleness status lookup
// ---------------------------------------------------------------------------

function getStalenessStatus(
	documentCanonicalId: string,
	input: HtmlArtifactPlanInput,
): string | undefined {
	if (input.stalenessResult === undefined) return undefined;

	for (const target of input.stalenessResult.targets) {
		if (target.documentCanonicalId === documentCanonicalId) {
			return target.status;
		}
	}

	return undefined;
}

function _getSeverityBlockingStalenessStatus(status: string): boolean {
	return status === 'stale' || status === 'missing' || status === 'blocked';
}

// ---------------------------------------------------------------------------
// Regeneration plan lookup
// ---------------------------------------------------------------------------

function _getRegenerationStatus(
	documentCanonicalId: string,
	input: HtmlArtifactPlanInput,
): string | undefined {
	if (input.regenerationPlan === undefined) return undefined;

	for (const item of input.regenerationPlan.items) {
		if (item.documentCanonicalId === documentCanonicalId) {
			return item.status;
		}
	}
	return undefined;
}

function isBlockedInRegeneration(
	documentCanonicalId: string,
	input: HtmlArtifactPlanInput,
): boolean {
	if (input.regenerationPlan === undefined) return false;

	for (const item of input.regenerationPlan.items) {
		if (item.documentCanonicalId === documentCanonicalId) {
			return item.status === 'blocked';
		}
	}
	return false;
}

function _regenerationPlansBefore(
	htmlArtifactIndex: number,
	documentCanonicalId: string,
	input: HtmlArtifactPlanInput,
): boolean {
	if (input.regenerationPlan === undefined) return false;

	for (const item of input.regenerationPlan.items) {
		if (item.documentCanonicalId === documentCanonicalId) {
			return item.safeOrderIndex < htmlArtifactIndex + 1000;
		}
	}
	return false;
}

// ---------------------------------------------------------------------------
// Validation findings check
// ---------------------------------------------------------------------------

function hasReleaseBlockingValidationFinding(
	documentCanonicalId: string | undefined,
	phaseId: string | undefined,
	input: HtmlArtifactPlanInput,
): HtmlArtifactBlocker[] {
	const blockers: HtmlArtifactBlocker[] = [];

	for (const finding of input.validationFindings) {
		if (finding.severity !== 'error' && finding.severity !== 'fatal') continue;

		const affectsDoc =
			documentCanonicalId !== undefined &&
			finding.documentCanonicalId === documentCanonicalId;
		const affectsPhase = phaseId !== undefined && finding.phaseId === phaseId;

		if (affectsDoc || affectsPhase) {
			blockers.push(
				createBlocker(
					'release_blocking_validation_finding',
					'error',
					`Release-blocking validation finding "${finding.code}" affects source: ${finding.message}`,
					{
						relatedPhaseId: finding.phaseId as string | undefined,
						sourceDocumentId: finding.documentCanonicalId as string | undefined,
						sourcePath: finding.documentCanonicalId,
					},
				),
			);
		}
	}

	return blockers;
}

function hasReleaseBlockingConsistencyFinding(
	documentCanonicalId: string | undefined,
	phaseId: string | undefined,
	input: HtmlArtifactPlanInput,
): HtmlArtifactBlocker[] {
	const blockers: HtmlArtifactBlocker[] = [];

	for (const finding of input.validationFindings) {
		if (finding.severity !== 'error' && finding.severity !== 'fatal') continue;
		if (
			!finding.code.includes('consistency') &&
			!finding.code.includes('boundary')
		)
			continue;

		const affectsDoc =
			documentCanonicalId !== undefined &&
			finding.documentCanonicalId === documentCanonicalId;
		const affectsPhase = phaseId !== undefined && finding.phaseId === phaseId;

		if (affectsDoc || affectsPhase) {
			blockers.push(
				createBlocker(
					'release_blocking_consistency_finding',
					'error',
					`Release-blocking consistency finding "${finding.code}" affects source: ${finding.message}`,
					{
						relatedPhaseId: finding.phaseId as string | undefined,
						sourceDocumentId: finding.documentCanonicalId as string | undefined,
					},
				),
			);
		}
	}

	return blockers;
}

function hasBlockingOpenQuestion(input: HtmlArtifactPlanInput): boolean {
	if (input.registerSummary !== undefined) {
		return input.registerSummary.blockingOpenQuestionCount > 0;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Manual edit safety
// ---------------------------------------------------------------------------

function checkManualEditSafety(
	outputPath: string,
	input: HtmlArtifactPlanInput,
): HtmlArtifactBlocker[] {
	const blockers: HtmlArtifactBlocker[] = [];

	if (input.manualEditCollisions !== undefined) {
		for (const collisionPath of input.manualEditCollisions) {
			if (collisionPath === outputPath || collisionPath.endsWith(outputPath)) {
				blockers.push(
					createBlocker(
						'manual_edit_collision',
						'warning',
						`Output path "${outputPath}" has a known manual edit collision`,
						{
							sourcePath: collisionPath,
						},
					),
				);
			}
		}
	}

	// Check artifact registry for existing artifacts that might be overwritten
	for (const artifact of input.artifactRegistryEntries) {
		if (artifact.path === outputPath && artifact.artifactType === 'html') {
			if (artifact.status !== 'planned' && artifact.status !== 'failed') {
				blockers.push(
					createBlocker(
						'manual_edit_collision',
						'warning',
						`Existing HTML artifact at "${outputPath}" will be overwritten`,
						{
							sourcePath: artifact.path,
						},
					),
				);
			}
		}
	}

	return blockers;
}

// ---------------------------------------------------------------------------
// Artifact registry comparison
// ---------------------------------------------------------------------------

interface ArtifactRegistryComparison {
	existing: boolean;
	current: boolean;
	stale: boolean;
	orphaned: boolean;
	existingArtifact:
		| HtmlArtifactPlanInput['artifactRegistryEntries'][number]
		| undefined;
}

function compareWithArtifactRegistry(
	declaration: HtmlArtifactDeclaration,
	input: HtmlArtifactPlanInput,
): ArtifactRegistryComparison {
	const result: ArtifactRegistryComparison = {
		current: false,
		existing: false,
		existingArtifact: undefined,
		orphaned: false,
		stale: false,
	};

	for (const artifact of input.artifactRegistryEntries) {
		if (
			artifact.path === declaration.relativeOutputPath ||
			artifact.path === declaration.outputPath
		) {
			result.existing = true;
			result.existingArtifact = artifact;

			if (artifact.artifactType !== 'html') {
				result.current = false;
				result.stale = false;
				break;
			}

			if (artifact.status === 'stale') {
				result.stale = true;
				result.current = false;
			} else if (artifact.status === 'generated') {
				const allSourcesCurrent =
					declaration.documentCanonicalId !== undefined
						? artifact.sourceDocumentIds.includes(
								declaration.documentCanonicalId,
							)
						: true;

				if (allSourcesCurrent) {
					result.current = true;
				}
			}

			break;
		}
	}

	// Check for orphaned registries: HTML artifacts in registry that have no declaration
	for (const artifact of input.artifactRegistryEntries) {
		if (artifact.artifactType !== 'html') continue;
		const hasDecl = input.contract.documents.some(() => {
			for (const entry of input.artifactRegistryEntries) {
				if (entry.path === artifact.path) return true;
			}
			return false;
		});
		if (!hasDecl) {
			result.orphaned = true;
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Readiness evaluation
// ---------------------------------------------------------------------------

function evaluateReadiness(
	declaration: HtmlArtifactDeclaration,
	sources: HtmlArtifactSource[],
	registryComparison: ArtifactRegistryComparison,
	input: HtmlArtifactPlanInput,
): {
	status: HtmlArtifactStatus;
	action: HtmlArtifactAction;
	readiness: HtmlArtifactReadiness;
	blockers: HtmlArtifactBlocker[];
	warnings: HtmlArtifactBlocker[];
} {
	const blockers: HtmlArtifactBlocker[] = [];
	const warnings: HtmlArtifactBlocker[] = [];
	let anyBlocked = false;
	let anyWarned = false;

	// 1. Check optional/deferred declarations
	if (declaration.optional || declaration.deferred) {
		return {
			action: 'skip_current',
			blockers: [],
			readiness: buildReadiness(false, false, false, true, [], 0, 0),
			status: 'skipped',
			warnings: [
				createBlocker(
					'no_generated_canonical_file',
					'info',
					`HTML artifact "${declaration.artifactId}" is marked as optional or deferred`,
					{
						artifactKind: declaration.artifactKind,
						sourceDocumentId: declaration.documentCanonicalId,
					},
				),
			],
		};
	}

	// 2. Check canonical source staleness/missing
	for (const source of sources) {
		if (source.sourceKind === 'canonical_markdown' && source.required) {
			const docStalenessStatus =
				source.documentCanonicalId !== undefined
					? getStalenessStatus(source.documentCanonicalId, input)
					: undefined;

			if (docStalenessStatus === undefined) {
				// No staleness info - check if we have any metadata
				blockers.push(
					createBlocker(
						'canonical_source_unknown',
						'warning',
						`Canonical source "${source.documentCanonicalId ?? 'unknown'}" staleness status is unknown`,
						{
							sourceDocumentId: source.documentCanonicalId ?? undefined,
							sourceKind: 'canonical_markdown',
						},
					),
				);
				anyWarned = true;
			} else if (docStalenessStatus === 'current') {
				// Good - source is current
				source.status = docStalenessStatus;
			} else if (docStalenessStatus === 'missing') {
				blockers.push(
					createBlocker(
						'canonical_source_missing',
						'error',
						`Canonical source "${source.documentCanonicalId ?? 'unknown'}" is missing`,
						{
							sourceDocumentId: source.documentCanonicalId ?? undefined,
							sourceKind: 'canonical_markdown',
						},
					),
				);
				anyBlocked = true;
			} else if (docStalenessStatus === 'stale') {
				blockers.push(
					createBlocker(
						'canonical_source_stale',
						'error',
						`Canonical source "${source.documentCanonicalId ?? 'unknown'}" is stale`,
						{
							sourceDocumentId: source.documentCanonicalId ?? undefined,
							sourceKind: 'canonical_markdown',
						},
					),
				);
				anyBlocked = true;
			} else if (docStalenessStatus === 'blocked') {
				blockers.push(
					createBlocker(
						'canonical_source_blocked',
						'error',
						`Canonical source "${source.documentCanonicalId ?? 'unknown'}" is blocked`,
						{
							sourceDocumentId: source.documentCanonicalId ?? undefined,
							sourceKind: 'canonical_markdown',
						},
					),
				);
				anyBlocked = true;
			} else {
				blockers.push(
					createBlocker(
						'canonical_source_unknown',
						'warning',
						`Canonical source "${source.documentCanonicalId ?? 'unknown'}" status is "${docStalenessStatus}"`,
						{
							sourceDocumentId: source.documentCanonicalId ?? undefined,
							sourceKind: 'canonical_markdown',
						},
					),
				);
				anyWarned = true;
			}
		}

		if (source.sourceKind === 'executive_metadata' && source.required) {
			if (input.executiveConfig === undefined) {
				blockers.push(
					createBlocker(
						'executive_not_compiled',
						'error',
						'Executive configuration is not available',
						{
							sourceKind: 'executive_metadata',
						},
					),
				);
				anyBlocked = true;
			}
		}

		if (
			source.sourceKind === 'decision_register' ||
			source.sourceKind === 'risk_register'
		) {
			if (input.registerSummary === undefined) {
				warnings.push(
					createBlocker(
						'required_register_source_missing',
						'warning',
						`Register source "${source.sourceKind}" is not available`,
						{
							sourceKind: source.sourceKind,
						},
					),
				);
				anyWarned = true;
			}
		}
	}

	// 3. Check validation findings
	const validationBlockers = hasReleaseBlockingValidationFinding(
		declaration.documentCanonicalId,
		declaration.phaseId,
		input,
	);
	for (const b of validationBlockers) {
		blockers.push(b);
		anyBlocked = true;
	}

	// 4. Check consistency findings
	const consistencyBlockers = hasReleaseBlockingConsistencyFinding(
		declaration.documentCanonicalId,
		declaration.phaseId,
		input,
	);
	for (const b of consistencyBlockers) {
		blockers.push(b);
		anyBlocked = true;
	}

	// 5. Check blocking open questions
	if (hasBlockingOpenQuestion(input)) {
		for (const source of sources) {
			if (
				source.documentCanonicalId !== undefined &&
				source.sourceKind === 'canonical_markdown'
			) {
				warnings.push(
					createBlocker(
						'unresolved_blocking_open_question',
						'warning',
						'Unresolved blocking open question may affect HTML artifact content',
						{
							sourceDocumentId: source.documentCanonicalId,
						},
					),
				);
				anyWarned = true;
			}
		}
	}

	// 6. Traceability review requirements
	if (input.traceabilityMetadata !== undefined) {
		if (input.traceabilityMetadata.reviewRequiredCount > 0) {
			warnings.push(
				createBlocker(
					'review_required_inferred_source',
					'warning',
					`Traceability metadata indicates ${input.traceabilityMetadata.reviewRequiredCount} review-required items`,
					{
						sourceKind: 'traceability_metadata',
					},
				),
			);
			anyWarned = true;
		}
	}

	// 7. Manual edit collision check
	const manualEditBlockers = checkManualEditSafety(
		declaration.relativeOutputPath,
		input,
	);
	for (const b of manualEditBlockers) {
		warnings.push(b);
		anyWarned = true;
	}

	// 8. Artifact registry comparison
	if (registryComparison.orphaned) {
		warnings.push(
			createBlocker(
				'insufficient_metadata',
				'info',
				`Orphaned HTML artifact metadata detected for "${declaration.artifactId}"`,
				{
					artifactKind: declaration.artifactKind,
				},
			),
		);
		anyWarned = true;
	}

	// 9. Check regeneration plan
	if (
		declaration.documentCanonicalId !== undefined &&
		isBlockedInRegeneration(declaration.documentCanonicalId, input)
	) {
		blockers.push(
			createBlocker(
				'canonical_source_blocked',
				'error',
				`Canonical source "${declaration.documentCanonicalId}" is blocked in the regeneration plan`,
				{
					sourceDocumentId: declaration.documentCanonicalId,
					sourceKind: 'canonical_markdown',
				},
			),
		);
		anyBlocked = true;
	}

	// 10. Determine status and action
	let status: HtmlArtifactStatus;
	let action: HtmlArtifactAction;

	if (anyBlocked) {
		status = 'blocked';
		action = 'block_until_canonical_current';
	} else if (registryComparison.stale) {
		status = 'stale';
		action = 'plan_render';
	} else if (registryComparison.current) {
		status = 'skipped';
		action = 'skip_current';
	} else if (anyWarned && !anyBlocked) {
		status = 'requires_review';
		action = 'plan_render';
	} else {
		status = 'ready';
		action = 'plan_render';
	}

	const readiness = buildReadiness(
		!anyBlocked,
		true,
		!anyBlocked,
		!anyBlocked,
		blockers,
		blockers.length,
		warnings.length,
	);

	return {
		action,
		blockers,
		readiness,
		status,
		warnings,
	};
}

function buildReadiness(
	ready: boolean,
	sourcesReady: boolean,
	canonicalCurrent: boolean,
	originSafe: boolean,
	blockers: HtmlArtifactBlocker[],
	blockerCount: number,
	warningCount: number,
): HtmlArtifactReadiness {
	return {
		blockerCount,
		blockers,
		canonicalCurrent,
		originSafe,
		ready,
		sourcesReady,
		warningCount,
	};
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function bySeverity(
	a: 'error' | 'warning' | 'info',
	b: 'error' | 'warning' | 'info',
): number {
	const order: Record<string, number> = { error: 0, info: 2, warning: 1 };
	return (order[a] ?? 99) - (order[b] ?? 99);
}

// ---------------------------------------------------------------------------
// Main planner
// ---------------------------------------------------------------------------

export function createHtmlArtifactPlan(
	input: HtmlArtifactPlanInput,
	options: HtmlArtifactPlanOptions = {},
): HtmlArtifactPlanResult {
	const diagnostics: HtmlArtifactDiagnostic[] = [];
	const documentationRoot =
		options.documentationRootOverride ?? input.documentationRoot;
	const artifactRoot = options.artifactRootOverride ?? input.artifactRoot;
	const dryRun = options.dryRun ?? true;

	// Validate basic inputs
	if (input.contract.phases.length === 0) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_PLAN_EMPTY_CONTRACT',
				'warning',
				'Documentation contract contains no phases',
				{ recoveryHint: 'Load a valid profile contract' },
			),
		);
	}

	if (documentationRoot.length === 0) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_PLAN_MISSING_ROOT',
				'error',
				'Documentation root is not configured',
				{ recoveryHint: 'Run /init or configure documentation root' },
			),
		);
	}

	// -----------------------------------------------------------------------
	// 1. Discover declarations
	// -----------------------------------------------------------------------

	const { declarations, diagnostics: declDiagnostics } =
		discoverHtmlArtifactDeclarations(input);
	diagnostics.push(...declDiagnostics);

	// -----------------------------------------------------------------------
	// 2. Build plan items
	// -----------------------------------------------------------------------

	const items: HtmlArtifactPlanItem[] = [];

	for (const declaration of declarations) {
		const sources = resolveSources(declaration, input);
		const registryComparison = compareWithArtifactRegistry(declaration, input);

		const evalResult = evaluateReadiness(
			declaration,
			sources,
			registryComparison,
			input,
		);

		const canonicalSourceDocumentIds: string[] = [];
		const canonicalSourceOutputPaths: string[] = [];
		const sourcePhaseIds: string[] = [];

		for (const source of sources) {
			if (source.documentCanonicalId !== undefined) {
				if (!canonicalSourceDocumentIds.includes(source.documentCanonicalId)) {
					canonicalSourceDocumentIds.push(source.documentCanonicalId);
				}
				if (
					source.outputPath !== undefined &&
					!canonicalSourceOutputPaths.includes(source.outputPath)
				) {
					canonicalSourceOutputPaths.push(source.outputPath);
				}
				if (
					source.phaseId !== undefined &&
					!sourcePhaseIds.includes(source.phaseId)
				) {
					sourcePhaseIds.push(source.phaseId);
				}
			}
		}

		const allReasons: HtmlArtifactBlocker[] = [
			...evalResult.blockers,
			...evalResult.warnings,
		];
		allReasons.sort((a, b) => {
			const sev = bySeverity(a.severity, b.severity);
			if (sev !== 0) return sev;
			return a.code.localeCompare(b.code);
		});

		const itemDiagnostics: HtmlArtifactDiagnostic[] = [];
		for (const blocker of evalResult.blockers) {
			itemDiagnostics.push(
				createDiagnostic(
					blocker.code as string,
					blocker.severity,
					blocker.message,
					{
						fieldPath: declaration.descriptorPointer,
						recoveryHint: blocker.recoveryHint,
						relatedArtifactId: declaration.artifactId,
						relatedArtifactKind: declaration.artifactKind,
						relatedPhaseId: blocker.relatedPhaseId ?? declaration.phaseId,
						relatedSourceDocumentId:
							blocker.sourceDocumentId ?? declaration.documentCanonicalId,
						sourcePath: blocker.sourcePath ?? declaration.descriptorPath,
					},
				),
			);
		}

		// Traceability boundary based on declaration type
		const traceabilityBoundary =
			declaration.declarationSource === 'document_descriptor'
				? 'derived'
				: declaration.declarationSource === 'executive_html_mapping'
					? 'execution_aid'
					: 'derived';

		const planItem: HtmlArtifactPlanItem = {
			action: evalResult.action,
			artifactId: declaration.artifactId,
			artifactKind: declaration.artifactKind,
			blockers: evalResult.blockers,
			canonicalSourceDocumentIds,
			canonicalSourceOutputPaths,
			declarationSource: declaration.declarationSource,
			descriptorPath: declaration.descriptorPath,
			descriptorPointer: declaration.descriptorPointer,
			diagnostics: itemDiagnostics,
			documentCanonicalId: declaration.documentCanonicalId,
			isDerivedNonCanonical: true,
			orderIndex: declaration.orderIndex,
			outputPath: declaration.outputPath,
			phaseId: declaration.phaseId,
			profilePath: declaration.profilePath,
			readiness: evalResult.readiness,
			reasons: allReasons,
			relativeOutputPath: declaration.relativeOutputPath,
			sourcePhaseIds,
			sources,
			status: evalResult.status,
			title: declaration.title,
			traceabilityBoundary,
		};

		items.push(planItem);
	}

	// -----------------------------------------------------------------------
	// 3. Build plan summary
	// -----------------------------------------------------------------------

	const countByStatus: Record<string, number> = {};
	const countByAction: Record<string, number> = {};
	const countByKind: Record<string, number> = {};
	let blockerCount = 0;
	let warningCount = 0;
	let missingSourceCount = 0;
	let staleCount = 0;
	let requiresReviewCount = 0;
	let unsafePathCount = 0;

	for (const item of items) {
		countByStatus[item.status] = (countByStatus[item.status] ?? 0) + 1;
		countByAction[item.action] = (countByAction[item.action] ?? 0) + 1;
		countByKind[item.artifactKind] = (countByKind[item.artifactKind] ?? 0) + 1;

		blockerCount += item.blockers.length;
		warningCount += item.blockers.filter(
			(b) => b.severity === 'warning' || b.severity === 'info',
		).length;

		if (item.status === 'missing_source') missingSourceCount++;
		if (item.status === 'stale') staleCount++;
		if (item.status === 'requires_review') requiresReviewCount++;

		for (const b of item.blockers) {
			if (
				b.code === 'output_path_unsafe' ||
				b.code === 'required_source_path_unsafe'
			)
				unsafePathCount++;
		}
	}

	const declaredArtifactPaths = items.map((i) => i.relativeOutputPath);

	const plan: HtmlArtifactPlan = {
		artifactRoot,
		blockerCount,
		countByAction,
		countByKind,
		countByStatus,
		declarationCount: declarations.length,
		declaredArtifactPaths,
		diagnostics,
		documentationRoot,
		dryRun,
		items,
		missingSourceCount,
		profileId: input.profileId,
		readOnly: true,
		requiresReviewCount,
		staleCount,
		unsafePathCount,
		warningCount,
	};

	return { diagnostics, plan };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function summarizeHtmlArtifactPlan(
	plan: HtmlArtifactPlan,
): HtmlArtifactSummary {
	return {
		blockedCount: plan.countByStatus.blocked ?? 0,
		blockerSummary: plan.diagnostics
			.filter((d) => d.severity === 'error')
			.map((d) => `[${d.code}] ${d.message}`),
		declaredCount: plan.declarationCount,
		missingSourceCount: plan.countByStatus.missing_source ?? 0,
		plannedPaths: plan.declaredArtifactPaths,
		readyCount: plan.countByStatus.ready ?? 0,
		requiresReviewCount: plan.countByStatus.requires_review ?? 0,
		skippedCount: plan.countByStatus.skipped ?? 0,
		staleCount: plan.countByStatus.stale ?? 0,
		unknownCount: plan.countByStatus.unknown ?? 0,
		unsafePathCount: plan.unsafePathCount,
	};
}
