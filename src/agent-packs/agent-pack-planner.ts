/** Step 10.1 — Agent Pack Planner: read-only planning service for agent pack generation */

import { discoverAgentPackDeclarations } from './agent-pack-declarations.js';
import {
	AGENT_PACK_KIND_ORDER,
	type AgentPackAction,
	type AgentPackBlocker,
	type AgentPackDeclaration,
	type AgentPackDiagnostic,
	type AgentPackKind,
	type AgentPackPlan,
	type AgentPackPlanInput,
	type AgentPackPlanItem,
	type AgentPackPlanOptions,
	type AgentPackPlanResult,
	type AgentPackReadiness,
	type AgentPackReasonCode,
	type AgentPackSource,
	type AgentPackStatus,
	type AgentPackSummary,
} from './agent-pack-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<AgentPackDiagnostic>,
): AgentPackDiagnostic {
	return {
		code,
		expected: undefined,
		fieldPath: undefined,
		message,
		received: undefined,
		recoveryHint: undefined,
		relatedClaimId: undefined,
		relatedGraphNodeId: undefined,
		relatedPackId: undefined,
		relatedPackKind: undefined,
		relatedPhaseId: undefined,
		relatedRegisterItemId: undefined,
		relatedSourceDocumentId: undefined,
		relatedSourceId: undefined,
		relatedValidationFindingId: undefined,
		severity,
		sourcePath: undefined,
		...overrides,
	};
}

function createBlocker(
	code: AgentPackReasonCode,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<AgentPackBlocker>,
): AgentPackBlocker {
	return {
		code,
		expected: undefined,
		graphNodeId: undefined,
		message,
		packKind: undefined,
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
	declaration: AgentPackDeclaration,
	input: AgentPackPlanInput,
): AgentPackSource[] {
	const sources: AgentPackSource[] = [];

	// Canonical markdown sources
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
		// Also add the document descriptor source
		sources.push({
			documentCanonicalId: declaration.documentCanonicalId,
			label: 'Document descriptor',
			outputPath: declaration.descriptorPath,
			phaseId: declaration.phaseId,
			required: true,
			sourceId: `descriptor:${declaration.documentCanonicalId}`,
			sourceKind: 'document_descriptor',
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
			sources.push({
				documentCanonicalId: doc.canonicalId,
				label: 'Document descriptor',
				outputPath: doc.sourcePath,
				phaseId: declaration.phaseId,
				required: true,
				sourceId: `descriptor:${doc.canonicalId}`,
				sourceKind: 'document_descriptor',
				status: undefined,
			});
		}
		// Profile descriptor source
		const phaseDesc = input.contract.phases.find(
			(p) => p.id === declaration.phaseId,
		);
		if (phaseDesc !== undefined) {
			sources.push({
				documentCanonicalId: undefined,
				label: 'Profile descriptor',
				outputPath: phaseDesc.sourcePath,
				phaseId: declaration.phaseId,
				required: false,
				sourceId: `profile:${phaseDesc.id}`,
				sourceKind: 'profile_descriptor',
				status: undefined,
			});
		}
	} else if (declaration.declarationSource === 'executive_agent_pack_mapping') {
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
			label: 'Executive agent pack mapping',
			outputPath: undefined,
			phaseId: undefined,
			required: true,
			sourceId: 'executive:agent-pack-mapping',
			sourceKind: 'executive_declaration',
			status: undefined,
		});
	}

	// Add register sources based on pack kind
	switch (declaration.packKind) {
		case 'review':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Validation findings',
				outputPath: undefined,
				phaseId: undefined,
				required: true,
				sourceId: 'validation:findings',
				sourceKind: 'validation_finding',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Risk register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:risks',
				sourceKind: 'risk_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Open questions',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:open_questions',
				sourceKind: 'open_question_register',
				status: undefined,
			});
			break;
		case 'implementation':
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
			sources.push({
				documentCanonicalId: undefined,
				label: 'Assumption register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:assumptions',
				sourceKind: 'assumption_register',
				status: undefined,
			});
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
			break;
		case 'task':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Decision register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:decisions',
				sourceKind: 'decision_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Risk register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:risks',
				sourceKind: 'risk_register',
				status: undefined,
			});
			break;
		case 'documentation':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Decision register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:decisions',
				sourceKind: 'decision_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Assumption register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:assumptions',
				sourceKind: 'assumption_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Open questions',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:open_questions',
				sourceKind: 'open_question_register',
				status: undefined,
			});
			break;
		case 'research':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Assumption register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:assumptions',
				sourceKind: 'assumption_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Hypothesis register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:hypotheses',
				sourceKind: 'hypothesis_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Open questions',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:open_questions',
				sourceKind: 'open_question_register',
				status: undefined,
			});
			break;
		case 'follow_up':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Open questions',
				outputPath: undefined,
				phaseId: undefined,
				required: true,
				sourceId: 'register:open_questions',
				sourceKind: 'open_question_register',
				status: undefined,
			});
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
			break;
		case 'executive_task':
			sources.push({
				documentCanonicalId: undefined,
				label: 'Executive declaration',
				outputPath: undefined,
				phaseId: undefined,
				required: true,
				sourceId: 'executive:declaration',
				sourceKind: 'executive_declaration',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Decision register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:decisions',
				sourceKind: 'decision_register',
				status: undefined,
			});
			sources.push({
				documentCanonicalId: undefined,
				label: 'Risk register',
				outputPath: undefined,
				phaseId: undefined,
				required: false,
				sourceId: 'register:risks',
				sourceKind: 'risk_register',
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
	input: AgentPackPlanInput,
): string | undefined {
	if (input.stalenessResult === undefined) return undefined;

	for (const target of input.stalenessResult.targets) {
		if (target.documentCanonicalId === documentCanonicalId) {
			return target.status;
		}
	}

	return undefined;
}

// ---------------------------------------------------------------------------
// Regeneration plan lookup
// ---------------------------------------------------------------------------

function isBlockedInRegeneration(
	documentCanonicalId: string,
	input: AgentPackPlanInput,
): boolean {
	if (input.regenerationPlan === undefined) return false;

	for (const item of input.regenerationPlan.items) {
		if (item.documentCanonicalId === documentCanonicalId) {
			return item.status === 'blocked';
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
	input: AgentPackPlanInput,
): AgentPackBlocker[] {
	const blockers: AgentPackBlocker[] = [];

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
						relatedPhaseId: finding.phaseId as
							| import('../profiles/documentation-contract.js').PhaseId
							| undefined,
						sourceDocumentId: finding.documentCanonicalId as
							| import('../profiles/documentation-contract.js').CanonicalDocumentId
							| undefined,
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
	input: AgentPackPlanInput,
): AgentPackBlocker[] {
	const blockers: AgentPackBlocker[] = [];

	if (input.consistencyFindings === undefined) return blockers;

	for (const violation of input.consistencyFindings.violations) {
		if (violation.severity !== 'error' && violation.severity !== 'fatal')
			continue;

		const affectsDoc =
			documentCanonicalId !== undefined &&
			violation.documentCanonicalId === documentCanonicalId;
		const affectsPhase = phaseId !== undefined && violation.phaseId === phaseId;

		if (affectsDoc || affectsPhase) {
			blockers.push(
				createBlocker(
					'release_blocking_consistency_finding',
					'error',
					`Release-blocking consistency finding "${violation.code}" affects source: ${violation.message}`,
					{
						relatedPhaseId: violation.phaseId as
							| import('../profiles/documentation-contract.js').PhaseId
							| undefined,
						sourceDocumentId: violation.documentCanonicalId as
							| import('../profiles/documentation-contract.js').CanonicalDocumentId
							| undefined,
					},
				),
			);
		}
	}

	return blockers;
}

function hasBlockingOpenQuestion(
	_documentCanonicalId: string | undefined,
	input: AgentPackPlanInput,
): boolean {
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
	input: AgentPackPlanInput,
): AgentPackBlocker[] {
	const blockers: AgentPackBlocker[] = [];

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

	for (const artifact of input.artifactRegistryEntries) {
		if (
			artifact.path === outputPath &&
			artifact.artifactType === 'agent_pack'
		) {
			if (artifact.status !== 'planned' && artifact.status !== 'failed') {
				blockers.push(
					createBlocker(
						'manual_edit_collision',
						'warning',
						`Existing agent-pack artifact at "${outputPath}" will be overwritten`,
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
		| AgentPackPlanInput['artifactRegistryEntries'][number]
		| undefined;
}

function compareWithArtifactRegistry(
	declaration: AgentPackDeclaration,
	input: AgentPackPlanInput,
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

			if (artifact.artifactType !== 'agent_pack') {
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

	// Check orphaned registries
	const declaredPaths = new Set(
		input.contractGraph.outputs
			.filter((output) => output.kind === 'agentPack' && !output.isCanonical)
			.map((output) => output.path),
	);
	for (const artifact of input.artifactRegistryEntries) {
		if (artifact.artifactType !== 'agent_pack') continue;
		const hasDecl = declaredPaths.has(artifact.path);
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
	declaration: AgentPackDeclaration,
	sources: AgentPackSource[],
	registryComparison: ArtifactRegistryComparison,
	input: AgentPackPlanInput,
): {
	status: AgentPackStatus;
	action: AgentPackAction;
	readiness: AgentPackReadiness;
	blockers: AgentPackBlocker[];
	warnings: AgentPackBlocker[];
} {
	const blockers: AgentPackBlocker[] = [];
	const warnings: AgentPackBlocker[] = [];
	let anyBlocked = false;
	let anyWarned = false;

	// 1. Check optional/deferred declarations
	if (declaration.optional || declaration.deferred) {
		return {
			action: 'skip_current',
			blockers: [],
			readiness: buildReadiness(false, false, false, false, [], 0, 0),
			status: 'skipped',
			warnings: [
				createBlocker(
					'no_generated_canonical_file',
					'info',
					`Agent pack "${declaration.packId}" is marked as optional or deferred`,
					{
						packKind: declaration.packKind,
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
				if (input.stalenessResult !== undefined) {
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
				}
			} else if (docStalenessStatus === 'current') {
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

		// Check optional canonical sources
		if (source.sourceKind === 'canonical_markdown' && !source.required) {
			const docStalenessStatus =
				source.documentCanonicalId !== undefined
					? getStalenessStatus(source.documentCanonicalId, input)
					: undefined;

			if (docStalenessStatus === 'stale' || docStalenessStatus === 'missing') {
				warnings.push(
					createBlocker(
						'optional_source_stale',
						'warning',
						`Optional canonical source "${source.documentCanonicalId ?? 'unknown'}" is ${docStalenessStatus}`,
						{
							sourceDocumentId: source.documentCanonicalId ?? undefined,
							sourceKind: 'canonical_markdown',
						},
					),
				);
				anyWarned = true;
			}
		}

		// Check executive declaration
		if (source.sourceKind === 'executive_declaration' && source.required) {
			if (input.executiveConfig === undefined) {
				blockers.push(
					createBlocker(
						'executive_not_compiled',
						'error',
						'Executive configuration is not available',
						{
							sourceKind: 'executive_declaration',
						},
					),
				);
				anyBlocked = true;
			}
		}

		// Check register sources
		if (
			source.sourceKind === 'decision_register' ||
			source.sourceKind === 'risk_register'
		) {
			if (source.required && input.registerSummary === undefined) {
				warnings.push(
					createBlocker(
						'required_decision_missing',
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
	if (
		hasBlockingOpenQuestion(declaration.documentCanonicalId, input) &&
		(declaration.packKind === 'implementation' ||
			declaration.packKind === 'review')
	) {
		for (const source of sources) {
			if (
				source.documentCanonicalId !== undefined &&
				source.sourceKind === 'canonical_markdown'
			) {
				blockers.push(
					createBlocker(
						'blocking_open_question',
						'error',
						'Unresolved blocking open question affects agent pack scope',
						{
							sourceDocumentId: source.documentCanonicalId,
						},
					),
				);
				anyBlocked = true;
			}
		}
	} else if (hasBlockingOpenQuestion(declaration.documentCanonicalId, input)) {
		for (const source of sources) {
			if (
				source.documentCanonicalId !== undefined &&
				source.sourceKind === 'canonical_markdown'
			) {
				warnings.push(
					createBlocker(
						'unresolved_non_blocking_open_question',
						'warning',
						'Unresolved blocking open question may affect pack content',
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
						sourceKind: 'traceability_source',
					},
				),
			);
			anyWarned = true;
		}
	}

	// 7. Research pack warning
	if (declaration.packKind === 'research') {
		warnings.push(
			createBlocker(
				'research_pack_unresolved',
				'info',
				'Research pack requires external work; planner does not perform research',
				{
					packKind: 'research',
				},
			),
		);
		anyWarned = true;
	}

	// 8. Manual edit collision check
	const manualEditBlockers = checkManualEditSafety(
		declaration.relativeOutputPath,
		input,
	);
	for (const b of manualEditBlockers) {
		warnings.push(b);
		anyWarned = true;
	}

	// 9. Artifact registry comparison
	if (registryComparison.orphaned) {
		warnings.push(
			createBlocker(
				'insufficient_metadata',
				'info',
				`Orphaned agent-pack artifact metadata detected for "${declaration.packId}"`,
				{
					packKind: declaration.packKind,
				},
			),
		);
		anyWarned = true;
	}

	// 10. Check regeneration plan
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

	// 11. Determine status and action
	let status: AgentPackStatus;
	let action: AgentPackAction;

	if (anyBlocked) {
		status = 'blocked';
		action = 'block_until_canonical_current';
	} else if (registryComparison.stale) {
		status = 'stale';
		action = 'plan_bundle';
	} else if (registryComparison.current) {
		status = 'skipped';
		action = 'skip_current';
	} else if (anyWarned && !anyBlocked) {
		status = 'requires_review';
		action = 'plan_bundle';
	} else {
		status = 'ready';
		action = 'plan_bundle';
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
	blockers: AgentPackBlocker[],
	blockerCount: number,
	warningCount: number,
): AgentPackReadiness {
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

function byPackKindOrder(a: AgentPackKind, b: AgentPackKind): number {
	return (AGENT_PACK_KIND_ORDER[a] ?? 99) - (AGENT_PACK_KIND_ORDER[b] ?? 99);
}

// Deterministic ordering for plan items
function sortPlanItems(items: AgentPackPlanItem[]): AgentPackPlanItem[] {
	return [...items].sort((a, b) => {
		// 1. Phase order
		const phaseA = a.phaseId ?? '';
		const phaseB = b.phaseId ?? '';
		if (phaseA !== phaseB) return phaseA.localeCompare(phaseB);

		// 2. Declaration source order
		const sourceOrder: Record<string, number> = {
			document_descriptor: 0,
			executive_agent_pack_mapping: 3,
			phase_descriptor: 1,
			profile_output_model: 2,
		};
		const srcA = sourceOrder[a.declarationSource] ?? 99;
		const srcB = sourceOrder[b.declarationSource] ?? 99;
		if (srcA !== srcB) return srcA - srcB;

		// 3. Source document order
		const docA = a.documentCanonicalId ?? '';
		const docB = b.documentCanonicalId ?? '';
		if (docA !== docB) return docA.localeCompare(docB);

		// 4. Pack kind order
		const kindOrder = byPackKindOrder(a.packKind, b.packKind);
		if (kindOrder !== 0) return kindOrder;

		// 5. Output declaration order
		if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;

		// 6. Stable pack id
		return a.packId.localeCompare(b.packId);
	});
}

// ---------------------------------------------------------------------------
// Main planner
// ---------------------------------------------------------------------------

export function createAgentPackPlan(
	input: AgentPackPlanInput,
	options: AgentPackPlanOptions = {},
): AgentPackPlanResult {
	const diagnostics: AgentPackDiagnostic[] = [];
	const documentationRoot =
		options.documentationRootOverride ?? input.documentationRoot;
	const artifactRoot = options.artifactRootOverride ?? input.artifactRoot;
	const dryRun = options.dryRun ?? true;

	// Validate basic inputs
	if (input.contract.phases.length === 0) {
		diagnostics.push(
			createDiagnostic(
				'E_AGENT_PACK_PLAN_EMPTY_CONTRACT',
				'warning',
				'Documentation contract contains no phases',
				{ recoveryHint: 'Load a valid profile contract' },
			),
		);
	}

	if (documentationRoot.length === 0) {
		diagnostics.push(
			createDiagnostic(
				'E_AGENT_PACK_PLAN_MISSING_ROOT',
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
		discoverAgentPackDeclarations(input);
	diagnostics.push(...declDiagnostics);

	// -----------------------------------------------------------------------
	// 2. Build plan items
	// -----------------------------------------------------------------------

	const unsortedItems: AgentPackPlanItem[] = [];

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

		const allReasons: AgentPackBlocker[] = [
			...evalResult.blockers,
			...evalResult.warnings,
		];
		allReasons.sort((a, b) => {
			const sev = bySeverity(a.severity, b.severity);
			if (sev !== 0) return sev;
			return a.code.localeCompare(b.code);
		});

		const itemDiagnostics: AgentPackDiagnostic[] = [];
		for (const blocker of evalResult.blockers) {
			itemDiagnostics.push(
				createDiagnostic(
					blocker.code as string,
					blocker.severity,
					blocker.message,
					{
						fieldPath: declaration.descriptorPointer,
						recoveryHint: blocker.recoveryHint,
						relatedPackId: declaration.packId,
						relatedPackKind: declaration.packKind,
						relatedPhaseId: blocker.relatedPhaseId ?? declaration.phaseId,
						relatedSourceDocumentId:
							blocker.sourceDocumentId ?? declaration.documentCanonicalId,
						sourcePath: blocker.sourcePath ?? declaration.descriptorPath,
					},
				),
			);
		}

		const sourceOfTruthWarning =
			'Agent packs are derived execution aids generated from canonical docs and structured state. They must never be treated as canonical project authority.';

		const planItem: AgentPackPlanItem = {
			action: evalResult.action,
			blockers: evalResult.blockers,
			canonicalSourceDocumentIds,
			canonicalSourceOutputPaths,
			declarationSource: declaration.declarationSource,
			descriptorPath: declaration.descriptorPath,
			descriptorPointer: declaration.descriptorPointer,
			diagnostics: itemDiagnostics,
			documentCanonicalId: declaration.documentCanonicalId,
			isDerivedExecutionAid: true,
			orderIndex: declaration.orderIndex,
			outputPath: declaration.outputPath,
			packId: declaration.packId,
			packKind: declaration.packKind,
			phaseId: declaration.phaseId,
			profilePath: declaration.profilePath,
			readiness: evalResult.readiness,
			reasons: allReasons,
			relativeOutputPath: declaration.relativeOutputPath,
			requiredAssumptionIds: [],
			requiredDecisionIds: [],
			requiredExecutiveItemRefs: [],
			requiredOpenQuestionIds: [],
			requiredProvenanceClaimIds: [],
			requiredRiskIds: [],
			requiredTraceabilitySourceIds: [],
			requiredValidationFindingIds: [],
			sourceOfTruthWarning,
			sourcePhaseIds,
			sources,
			status: evalResult.status,
			title: declaration.title,
		};

		unsortedItems.push(planItem);
	}

	// -----------------------------------------------------------------------
	// 3. Sort items deterministically
	// -----------------------------------------------------------------------

	const items = sortPlanItems(unsortedItems);

	// -----------------------------------------------------------------------
	// 4. Build plan summary
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
	let researchDeferredCount = 0;

	for (const item of items) {
		countByStatus[item.status] = (countByStatus[item.status] ?? 0) + 1;
		countByAction[item.action] = (countByAction[item.action] ?? 0) + 1;
		countByKind[item.packKind] = (countByKind[item.packKind] ?? 0) + 1;

		blockerCount += item.blockers.length;
		warningCount += item.blockers.filter(
			(b) => b.severity === 'warning' || b.severity === 'info',
		).length;

		if (item.status === 'missing_source') missingSourceCount++;
		if (item.status === 'stale') staleCount++;
		if (item.status === 'requires_review') requiresReviewCount++;
		if (item.packKind === 'research' && item.status === 'skipped')
			researchDeferredCount++;

		for (const b of item.blockers) {
			if (
				b.code === 'output_path_unsafe' ||
				b.code === 'required_source_path_unsafe'
			)
				unsafePathCount++;
		}
	}

	const declaredPackPaths = items.map((i) => i.relativeOutputPath);

	const plan: AgentPackPlan = {
		artifactRoot,
		blockerCount,
		countByAction,
		countByKind,
		countByStatus,
		declarationCount: declarations.length,
		declaredPackPaths,
		diagnostics,
		documentationRoot,
		dryRun,
		items,
		missingSourceCount,
		profileId: input.profileId,
		readOnly: true,
		requiresReviewCount,
		researchDeferredCount,
		staleCount,
		unsafePathCount,
		warningCount,
	};

	return { diagnostics, plan };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function summarizeAgentPackPlan(plan: AgentPackPlan): AgentPackSummary {
	return {
		blockedCount: plan.countByStatus.blocked ?? 0,
		blockerSummary: plan.diagnostics
			.filter((d) => d.severity === 'error')
			.map((d) => `[${d.code}] ${d.message}`),
		declaredCount: plan.declarationCount,
		missingSourceCount: plan.countByStatus.missing_source ?? 0,
		plannedPaths: plan.declaredPackPaths,
		readyCount: plan.countByStatus.ready ?? 0,
		requiresReviewCount: plan.countByStatus.requires_review ?? 0,
		researchDeferredCount: plan.researchDeferredCount,
		skippedCount: plan.countByStatus.skipped ?? 0,
		staleCount: plan.countByStatus.stale ?? 0,
		unknownCount: plan.countByStatus.unknown ?? 0,
		unsafePathCount: plan.unsafePathCount,
	};
}
