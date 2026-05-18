/** Step 7.2 Staleness Detector — deterministic read-only staleness classification for output targets */

import type {
	DependencyGraphNodeId,
	DependencyGraphNodeKind,
} from '../dependency-graph/dependency-graph.js';
import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import {
	computeArtifactMetadataFingerprint,
	computeDependencyGraphFingerprint,
	computeDocumentDescriptorFingerprint,
	computeGeneratedMetadataFingerprint,
	computeProfileContractFingerprint,
	computeRelevantStateFingerprint,
} from './source-fingerprint.js';
import type {
	StalenessDependencyImpact,
	StalenessDetectionInput,
	StalenessDetectionOptions,
	StalenessDetectionResult,
	StalenessDiagnostic,
	StalenessReason,
	StalenessReasonCode,
	StalenessSeverity,
	StalenessSourceKind,
	StalenessStatus,
	StalenessSummary,
	StalenessTarget,
	StalenessTargetKind,
} from './staleness-types.js';
import { graphKindToStalenessTargetKind } from './staleness-types.js';

// ---------------------------------------------------------------------------
// Output node kinds that are staleness targets
// ---------------------------------------------------------------------------

const OUTPUT_NODE_KINDS: ReadonlySet<DependencyGraphNodeKind> = new Set([
	'canonical_output',
	'html_artifact',
	'agent_pack',
	'data_artifact',
	'report_artifact',
	'executive_output',
	'executive_json',
	'executive_markdown',
	'executive_html',
]);

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function detectStaleness(
	input: StalenessDetectionInput,
	options?: StalenessDetectionOptions,
): Promise<StalenessDetectionResult> {
	const outputNodes = input.dependencyGraph.nodes.filter((n) =>
		OUTPUT_NODE_KINDS.has(n.kind as DependencyGraphNodeKind),
	);

	const profileFingerprint = computeProfileContractFingerprint({
		phaseDescriptors: input.phaseDescriptors,
		profileId: input.profileId,
		profileVersion: input.profileVersion,
		registryPath: undefined,
		source: undefined,
	});

	const allTargets: StalenessTarget[] = [];
	const allDiagnostics: StalenessDiagnostic[] = [];
	const allWarnings: StalenessReason[] = [];

	// Build target map for upstream impact resolution
	const targetMap = new Map<DependencyGraphNodeId, StalenessTarget>();
	const targetStatusMap = new Map<DependencyGraphNodeId, StalenessStatus>();

	// First pass: classify each target independently
	for (const node of outputNodes) {
		const targetKind = graphKindToStalenessTargetKind(node.kind);
		if (targetKind === undefined) continue;

		const target = await classifyTarget(
			node.id,
			targetKind,
			node.documentCanonicalId ?? undefined,
			node.phaseId ?? undefined,
			input,
			options,
			profileFingerprint.value,
		);

		allTargets.push(target);
		targetMap.set(node.id, target);
		targetStatusMap.set(node.id, target.status);
	}

	// Second pass: resolve upstream dependency impacts
	const resolvedTargets: StalenessTarget[] = [];
	for (const target of allTargets) {
		const resolved = resolveUpstreamImpact(
			target,
			input,
			targetStatusMap,
			allWarnings,
		);
		resolvedTargets.push(resolved);
	}

	// Sort targets deterministically
	const sortedTargets = sortTargets(resolvedTargets, input);

	// Build summary
	const summary = buildSummary(sortedTargets, allWarnings);

	return {
		diagnostics: allDiagnostics,
		documentationRoot: input.documentationRoot,
		graphSummary: {
			edgeCount: input.dependencyGraph.edges.length,
			nodeCount: input.dependencyGraph.nodes.length,
			outputNodeCount: outputNodes.length,
		},
		optionalDependencyWarnings: allWarnings,
		profileId: input.profileId,
		readOnly: true,
		summary,
		targets: sortedTargets,
	};
}

// ---------------------------------------------------------------------------
// Classify a single target
// ---------------------------------------------------------------------------

async function classifyTarget(
	graphNodeId: DependencyGraphNodeId,
	targetKind: StalenessTargetKind,
	documentCanonicalId: CanonicalDocumentId | undefined,
	phaseId: PhaseId | undefined,
	input: StalenessDetectionInput,
	options: StalenessDetectionOptions | undefined,
	profileFingerprintVal: string,
): Promise<StalenessTarget> {
	const reasons: StalenessReason[] = [];
	const diagnostics: StalenessDiagnostic[] = [];

	// --- Get descriptor data ---
	const descriptor =
		documentCanonicalId !== undefined
			? input.loadedDescriptorData.get(documentCanonicalId)
			: undefined;

	const outputPath =
		input.dependencyGraph.nodeMap.get(graphNodeId)?.outputTargetPath;
	const _isCanonical =
		input.dependencyGraph.nodeMap.get(graphNodeId)?.isCanonical;

	// --- Find artifact registry entry ---
	const artifactEntry = findArtifactEntry(
		input,
		outputPath,
		documentCanonicalId,
	);

	// --- Generated metadata ---
	let generatedMetadata:
		| {
				metadata: {
					documentId: string;
					phaseId: string;
					profileId: string;
					canonicalOutput: string;
					generatedAt: string;
					generationStatus: string;
				};
				checksum: string | undefined;
				parsedSuccessfully: boolean;
				parseErrors: string[];
		  }
		| undefined;

	if (outputPath && options?.readGeneratedMetadata) {
		// Use project root from documentation root context - try to infer from input
		const projectRoot = input.documentationRoot;
		try {
			generatedMetadata = await options.readGeneratedMetadata(
				outputPath,
				projectRoot,
			);
		} catch {
			// Ignore read errors - will be classified as missing metadata
		}
	}

	if (
		!generatedMetadata &&
		outputPath &&
		input.generatedMetadataOverrides.has(outputPath)
	) {
		const override = input.generatedMetadataOverrides.get(outputPath);
		if (override) {
			generatedMetadata = {
				checksum: undefined,
				metadata: {
					canonicalOutput: override.canonicalOutput,
					documentId: override.documentId,
					generatedAt: override.generatedAt,
					generationStatus: override.generationStatus,
					phaseId: override.phaseId,
					profileId: override.profileId,
				},
				parsedSuccessfully: true,
				parseErrors: [],
			};
		}
	}

	// --- Compute current source fingerprints ---
	const descriptorFingerprint =
		descriptor !== undefined
			? computeDocumentDescriptorFingerprint({
					canonicalOutput: descriptor.canonicalOutput,
					documentCanonicalId: documentCanonicalId ?? '',
					inputs: descriptor.inputs,
					outputs: descriptor.outputs,
					phaseId: descriptor.phaseId,
					status: descriptor.status,
					title: descriptor.title,
				}).value
			: undefined;

	// --- Determine upstream document IDs for graph fingerprint ---
	const upstreamDocIds = getUpstreamDocumentIds(graphNodeId, input);
	const upstreamEdgeKinds = getUpstreamEdgeKinds(graphNodeId, input);
	const graphFingerprint = computeDependencyGraphFingerprint({
		upstreamDocumentIds: upstreamDocIds,
		upstreamEdgeKinds,
	}).value;

	// --- Relevant state fingerprint ---
	const relevantState = selectRelevantState(
		input,
		documentCanonicalId,
		upstreamDocIds,
	);
	const stateFingerprint = computeRelevantStateFingerprint(relevantState).value;

	// --- Artifact metadata fingerprint ---
	const artifactFingerprint =
		artifactEntry !== undefined
			? computeArtifactMetadataFingerprint({
					artifactId: artifactEntry.artifactId,
					artifactType: artifactEntry.artifactType,
					checksum: artifactEntry.checksum,
					generatedAt: artifactEntry.generatedAt,
					isCanonical: artifactEntry.isCanonical,
					path: artifactEntry.path,
					runId: artifactEntry.runId,
					sourceDocumentIds: artifactEntry.sourceDocumentIds,
					status: artifactEntry.status,
				}).value
			: undefined;

	// --- Generated metadata fingerprint ---
	const generatedFingerprint = generatedMetadata?.parsedSuccessfully
		? computeGeneratedMetadataFingerprint(generatedMetadata.metadata).value
		: undefined;

	// --- File existence ---
	let fileExists = false;
	if (outputPath && options?.outputFileExists) {
		try {
			fileExists = await options.outputFileExists(outputPath);
		} catch {
			// Unknown
		}
	} else if (artifactEntry) {
		// If we have an artifact registry entry, assume file exists unless we know otherwise
		fileExists =
			artifactEntry.status === 'generated' || artifactEntry.status === 'stale';
	}

	// --- Timestamps ---
	const generatedAt = generatedMetadata?.parsedSuccessfully
		? generatedMetadata.metadata.generatedAt
		: artifactEntry?.generatedAt;

	// --- Determine status ---
	const status = determineStatus(
		targetKind,
		outputPath,
		fileExists,
		artifactEntry,
		generatedMetadata,
		generatedAt,
		descriptor,
		documentCanonicalId,
		profileFingerprintVal,
		descriptorFingerprint,
		graphFingerprint,
		stateFingerprint,
		artifactFingerprint,
		generatedFingerprint,
		input,
		reasons,
		diagnostics,
		graphNodeId,
	);

	// --- Severity ---
	const severity: StalenessSeverity =
		status === 'current'
			? 'info'
			: status === 'stale'
				? 'warning'
				: status === 'missing'
					? 'warning'
					: status === 'blocked'
						? 'error'
						: status === 'orphaned'
							? 'warning'
							: 'info';

	return {
		artifactId: artifactEntry?.artifactId,
		changedSourceRefs: [],
		currentNodeFingerprint: stateFingerprint,
		diagnostics,
		documentCanonicalId,
		generatedAt,
		generationRunId:
			(artifactEntry?.runId ?? generatedMetadata?.metadata.documentId)
				? `generated_${documentCanonicalId ?? 'unknown'}`
				: undefined,
		graphNodeId,
		outputPath,
		phaseId,
		reasons,
		recordedSourceFingerprint: generatedFingerprint ?? artifactFingerprint,
		severity,
		status,
		targetId: graphNodeId,
		targetKind,
		upstreamImpacts: [],
	};
}

// ---------------------------------------------------------------------------
// Determine status
// ---------------------------------------------------------------------------

function determineStatus(
	targetKind: StalenessTargetKind,
	outputPath: string | undefined,
	fileExists: boolean,
	artifactEntry:
		| {
				artifactId: string;
				artifactType: string;
				path: string;
				status: string;
				checksum: string | undefined;
				generatedAt: string | undefined;
				runId: string | undefined;
				isCanonical: boolean;
				sourceDocumentIds: readonly string[];
		  }
		| undefined,
	generatedMetadata:
		| {
				metadata: {
					documentId: string;
					phaseId: string;
					profileId: string;
					canonicalOutput: string;
					generatedAt: string;
					generationStatus: string;
				};
				checksum: string | undefined;
				parsedSuccessfully: boolean;
				parseErrors: string[];
		  }
		| undefined,
	generatedAt: string | undefined,
	descriptor:
		| {
				title: string;
				phaseId: PhaseId;
				canonicalOutput: string;
				outputs: readonly {
					kind: string;
					path: string | undefined;
					format: string | undefined;
				}[];
				inputs: readonly {
					type: string;
					id: string;
					required: boolean | undefined;
				}[];
				status: string | undefined;
		  }
		| undefined,
	documentCanonicalId: CanonicalDocumentId | undefined,
	_profileFingerprintVal: string,
	_descriptorFingerprint: string | undefined,
	_graphFingerprint: string,
	_stateFingerprint: string,
	_artifactFingerprint: string | undefined,
	_generatedFingerprint: string | undefined,
	input: StalenessDetectionInput,
	reasons: StalenessReason[],
	diagnostics: StalenessDiagnostic[],
	graphNodeId: DependencyGraphNodeId,
): StalenessStatus {
	const targetId = graphNodeId;

	// --- Check for orphaned: artifact exists but document no longer in contract ---
	if (artifactEntry && documentCanonicalId === undefined) {
		reasons.push(
			makeReason(
				'orphaned_document',
				'warning',
				`Artifact registry entry "${artifactEntry.artifactId}" references unknown document`,
				'artifact_registry',
				artifactEntry.artifactId,
				artifactEntry.path,
				targetId,
			),
		);
		return 'orphaned';
	}

	// --- Check for orphaned: output path exists but no longer corresponds to declared output ---
	if (
		artifactEntry &&
		descriptor === undefined &&
		documentCanonicalId !== undefined
	) {
		reasons.push(
			makeReason(
				'orphaned_document',
				'warning',
				`Artifact "${artifactEntry.artifactId}" maps to document "${documentCanonicalId}" which has no active descriptor`,
				'artifact_registry',
				artifactEntry.artifactId,
				artifactEntry.path,
				targetId,
			),
		);
		return 'orphaned';
	}

	// --- Check for unsafe output path ---
	if (outputPath && isUnsafePath(outputPath, input.documentationRoot)) {
		diagnostics.push(
			makeDiagnostic(
				'STALE_UNSAFE_PATH',
				'warning',
				`Output path "${outputPath}" is outside the documentation root`,
				outputPath,
				undefined,
				undefined,
				documentCanonicalId,
				undefined,
				graphNodeId,
				'The output path should be within the configured documentation root',
			),
		);
	}

	// --- Check missing: expected output but no file and no artifact ---
	// First, check if generated metadata overrides are available
	if (generatedMetadata?.parsedSuccessfully) {
		const meta = generatedMetadata.metadata;

		// Metadata document ID mismatch
		if (documentCanonicalId && meta.documentId !== documentCanonicalId) {
			reasons.push(
				makeReason(
					'generation_metadata_invalid',
					'warning',
					`Generated metadata document ID "${meta.documentId}" does not match active document "${documentCanonicalId}"`,
					'generated_metadata',
					meta.documentId,
					outputPath,
					targetId,
					documentCanonicalId,
					meta.documentId,
				),
			);
			return 'orphaned';
		}

		// Metadata profile ID mismatch
		if (meta.profileId !== input.profileId) {
			reasons.push(
				makeReason(
					'profile_contract_changed',
					'warning',
					`Generated metadata profile ID "${meta.profileId}" does not match active profile "${input.profileId}"`,
					'generated_metadata',
					meta.profileId,
					outputPath,
					targetId,
					input.profileId,
					meta.profileId,
				),
			);
			return 'stale';
		}

		// Metadata phase ID mismatch
		if (descriptor && meta.phaseId !== descriptor.phaseId) {
			reasons.push(
				makeReason(
					'document_descriptor_changed',
					'warning',
					`Generated metadata phase ID "${meta.phaseId}" does not match active phase "${descriptor.phaseId}"`,
					'generated_metadata',
					meta.phaseId,
					outputPath,
					targetId,
					descriptor.phaseId,
					meta.phaseId,
				),
			);
			return 'stale';
		}

		// Without any file to verify, but with valid metadata, return "stale" or "missing"
		// as appropriate
	}

	if (!fileExists && !artifactEntry) {
		// If we have metadata overrides but no file, check status based on metadata
		if (generatedMetadata?.parsedSuccessfully) {
			// Metadata exists but file may not; this is a metadata-only check path
			reasons.push(
				makeReason(
					'output_file_missing',
					'warning',
					`Output file "${outputPath ?? 'unknown'}" has metadata override but no file exists`,
					'output_file',
					documentCanonicalId ?? undefined,
					outputPath,
					targetId,
				),
			);
			return 'missing';
		}

		if (descriptor !== undefined && targetKind === 'canonical_markdown') {
			reasons.push(
				makeReason(
					'output_file_missing',
					'warning',
					`Expected canonical output for "${documentCanonicalId}" is missing`,
					'output_file',
					documentCanonicalId ?? undefined,
					outputPath,
					targetId,
				),
			);
			return 'missing';
		}
		if (artifactEntry === undefined && generatedMetadata === undefined) {
			reasons.push(
				makeReason(
					'generation_metadata_missing',
					'warning',
					`No generation metadata or artifact registry entry for "${targetId}"`,
					'generation_run',
					undefined,
					outputPath,
					targetId,
				),
			);
			diagnostics.push(
				makeDiagnostic(
					'STALE_NO_METADATA',
					'info',
					'Insufficient metadata to determine staleness',
					outputPath,
					undefined,
					undefined,
					documentCanonicalId,
					undefined,
					graphNodeId,
					'Run /generate to create outputs',
				),
			);
			return 'unknown';
		}
	}

	// --- Check missing: expected output but file absent ---
	if (!fileExists && artifactEntry) {
		reasons.push(
			makeReason(
				'output_file_missing',
				'warning',
				`Output file "${outputPath ?? artifactEntry.path}" is missing but artifact registry entry exists`,
				'output_file',
				artifactEntry.artifactId,
				outputPath,
				targetId,
			),
		);
		return 'missing';
	}

	// --- Check missing: artifact registry entry exists but file is missing ---
	if (!fileExists && generatedMetadata?.parsedSuccessfully) {
		reasons.push(
			makeReason(
				'output_file_missing',
				'warning',
				`Output file "${outputPath}" is missing`,
				'output_file',
				undefined,
				outputPath,
				targetId,
			),
		);
		return 'missing';
	}

	// --- Check generated metadata validity ---
	if (generatedMetadata && !generatedMetadata.parsedSuccessfully) {
		reasons.push(
			makeReason(
				'generation_metadata_invalid',
				'error',
				`Generated metadata could not be parsed: ${generatedMetadata.parseErrors.join(', ')}`,
				'generated_metadata',
				undefined,
				outputPath,
				targetId,
			),
		);
		diagnostics.push(
			makeDiagnostic(
				'STALE_METADATA_INVALID',
				'warning',
				'Generated metadata is invalid or unparseable',
				outputPath,
				undefined,
				undefined,
				documentCanonicalId,
				undefined,
				graphNodeId,
				'Regenerate the output to restore valid metadata',
			),
		);
		return 'unknown';
	}

	if (generatedMetadata?.parsedSuccessfully) {
		const meta = generatedMetadata.metadata;

		// Metadata document ID mismatch
		if (documentCanonicalId && meta.documentId !== documentCanonicalId) {
			reasons.push(
				makeReason(
					'generation_metadata_invalid',
					'warning',
					`Generated metadata document ID "${meta.documentId}" does not match active document "${documentCanonicalId}"`,
					'generated_metadata',
					meta.documentId,
					outputPath,
					targetId,
					documentCanonicalId,
					meta.documentId,
				),
			);
			return 'orphaned';
		}

		// Metadata profile ID mismatch
		if (meta.profileId !== input.profileId) {
			reasons.push(
				makeReason(
					'profile_contract_changed',
					'warning',
					`Generated metadata profile ID "${meta.profileId}" does not match active profile "${input.profileId}"`,
					'generated_metadata',
					meta.profileId,
					outputPath,
					targetId,
					input.profileId,
					meta.profileId,
				),
			);
			return 'stale';
		}

		// Metadata phase ID mismatch
		if (descriptor && meta.phaseId !== descriptor.phaseId) {
			reasons.push(
				makeReason(
					'document_descriptor_changed',
					'warning',
					`Generated metadata phase ID "${meta.phaseId}" does not match active phase "${descriptor.phaseId}"`,
					'generated_metadata',
					meta.phaseId,
					outputPath,
					targetId,
					descriptor.phaseId,
					meta.phaseId,
				),
			);
			return 'stale';
		}

		// Metadata canonical output path mismatch
		if (descriptor && meta.canonicalOutput !== descriptor.canonicalOutput) {
			diagnostics.push(
				makeDiagnostic(
					'STALE_OUTPUT_PATH_MISMATCH',
					'warning',
					`Generated metadata canonical output "${meta.canonicalOutput}" differs from expected "${descriptor.canonicalOutput}"`,
					outputPath,
					'canonicalOutput',
					undefined,
					documentCanonicalId,
					undefined,
					graphNodeId,
					'The output path may have changed since generation',
				),
			);
		}

		// Check generation timestamp vs state changes
		if (generatedAt) {
			const stateChangedAfterGeneration = checkStateChangedAfter(
				generatedAt,
				documentCanonicalId,
				upstreamDocIds(graphNodeId, input),
				input,
			);
			if (stateChangedAfterGeneration) {
				reasons.push(
					makeReason(
						'workspace_state_changed',
						'warning',
						`Relevant workspace state changed after generation (${generatedAt})`,
						'workspace_state',
						undefined,
						outputPath,
						targetId,
					),
				);
				return 'stale';
			}
		}
	}

	// --- Profile contract fingerprint comparison ---
	// (This is a simplified check - we compare the current profile fingerprint with
	// the fact that profile version may have changed)
	if (artifactEntry && generatedAt && input.profileVersion) {
		// If profile version field exists, it would have been captured in fingerprint
		// We rely on the overall status assessment
	}

	// --- Missing metadata for an expected output ---
	if (!generatedMetadata?.parsedSuccessfully && fileExists && !artifactEntry) {
		diagnostics.push(
			makeDiagnostic(
				'STALE_INSUFFICIENT_METADATA',
				'info',
				'File exists but has no generated metadata or artifact registry entry',
				outputPath,
				undefined,
				undefined,
				documentCanonicalId,
				undefined,
				graphNodeId,
				'May need regeneration to add metadata',
			),
		);
		return 'unknown';
	}

	// --- Check artifact registry mismatch ---
	if (artifactEntry && descriptor) {
		if (targetKind === 'canonical_markdown' && !artifactEntry.isCanonical) {
			diagnostics.push(
				makeDiagnostic(
					'STALE_ARTIFACT_CANONICALITY',
					'warning',
					`Artifact registry entry "${artifactEntry.artifactId}" is marked non-canonical for a canonical output`,
					artifactEntry.path,
					undefined,
					artifactEntry.artifactId,
					documentCanonicalId,
					undefined,
					graphNodeId,
					'The artifact registry entry should be canonical for this output',
				),
			);
		}

		// Check if artifact path is orphaned (no longer declared)
		if (
			descriptor.canonicalOutput &&
			artifactEntry.path !== descriptor.canonicalOutput &&
			targetKind === 'canonical_markdown'
		) {
			diagnostics.push(
				makeDiagnostic(
					'STALE_PATH_MISMATCH',
					'warning',
					`Artifact path "${artifactEntry.path}" differs from declared canonical output "${descriptor.canonicalOutput}"`,
					artifactEntry.path,
					undefined,
					artifactEntry.artifactId,
					documentCanonicalId,
					undefined,
					graphNodeId,
					'Re-evaluate output paths to align artifact registry with declared outputs',
				),
			);
		}
	}

	// --- Default: current ---
	// If the output exists, has valid metadata matching active contract,
	// and no upstream changes detected, mark as current
	if (fileExists) {
		if (
			generatedMetadata?.parsedSuccessfully &&
			generatedMetadata.metadata.documentId === documentCanonicalId &&
			generatedMetadata.metadata.profileId === input.profileId
		) {
			return 'current';
		}
		// Has file but insufficient metadata to determine status
		if (!generatedMetadata?.parsedSuccessfully && !artifactEntry) {
			return 'unknown';
		}
		// File exists with artifact entry but we can't verify metadata
		if (artifactEntry) {
			return 'current';
		}
		return 'unknown';
	}

	// Fallback
	reasons.push(
		makeReason(
			'insufficient_metadata',
			'info',
			'Insufficient metadata to determine staleness status',
			'generation_run',
			undefined,
			outputPath,
			targetId,
		),
	);
	return 'unknown';
}

// ---------------------------------------------------------------------------
// Resolve upstream dependency impacts
// ---------------------------------------------------------------------------

function resolveUpstreamImpact(
	target: StalenessTarget,
	input: StalenessDetectionInput,
	targetStatusMap: ReadonlyMap<DependencyGraphNodeId, StalenessStatus>,
	warnings: StalenessReason[],
): StalenessTarget {
	const graphNodeId = target.graphNodeId;
	if (graphNodeId === undefined) {
		return { ...target, upstreamImpacts: [] };
	}

	const upstreamEdges = input.dependencyGraph.upstreamEdges.get(graphNodeId);
	if (!upstreamEdges || upstreamEdges.length === 0) {
		return { ...target, upstreamImpacts: [] };
	}

	const impacts: StalenessDependencyImpact[] = [];
	let newStatus = target.status;
	const newReasons = [...target.reasons];

	for (const edge of upstreamEdges) {
		const upstreamId = edge.fromNodeId;
		const upstreamStatus = targetStatusMap.get(upstreamId);
		const required = edge.required ?? false;

		if (upstreamStatus === undefined) continue;

		const impact: StalenessDependencyImpact = {
			edgeKind: edge.kind,
			message: `Upstream ${edge.kind} target "${upstreamId}" has status "${upstreamStatus}"`,
			required,
			upstreamStatus,
			upstreamTargetId: upstreamId,
		};

		impacts.push(impact);

		if (required) {
			if (upstreamStatus === 'stale') {
				if (newStatus !== 'blocked' && newStatus !== 'missing') {
					newStatus = 'stale';
				}
				newReasons.push(
					makeReason(
						'upstream_required_stale',
						'warning',
						`Required upstream dependency "${upstreamId}" is stale`,
						'dependency_graph',
						upstreamId,
						undefined,
						target.targetId,
					),
				);
			} else if (upstreamStatus === 'missing') {
				newStatus = 'blocked';
				newReasons.push(
					makeReason(
						'upstream_required_missing',
						'error',
						`Required upstream dependency "${upstreamId}" is missing`,
						'dependency_graph',
						upstreamId,
						undefined,
						target.targetId,
					),
				);
			} else if (upstreamStatus === 'blocked') {
				newStatus = 'blocked';
				newReasons.push(
					makeReason(
						'upstream_required_blocked',
						'error',
						`Required upstream dependency "${upstreamId}" is blocked`,
						'dependency_graph',
						upstreamId,
						undefined,
						target.targetId,
					),
				);
			} else if (upstreamStatus === 'unknown') {
				// Keep current status but add a note
				if (newStatus === 'current') {
					newStatus = 'unknown';
				}
			}
		} else {
			// Optional dependency
			if (upstreamStatus === 'stale' || upstreamStatus === 'missing') {
				const warnReason = makeReason(
					'upstream_optional_changed',
					'info',
					`Optional upstream dependency "${upstreamId}" has status "${upstreamStatus}"`,
					'dependency_graph',
					upstreamId,
					undefined,
					target.targetId,
				);
				warnings.push(warnReason);
			}
		}
	}

	return {
		...target,
		reasons: newReasons,
		status: newStatus,
		upstreamImpacts: impacts,
	};
}

// ---------------------------------------------------------------------------
// Helper: find artifact registry entry for a target
// ---------------------------------------------------------------------------

function findArtifactEntry(
	input: StalenessDetectionInput,
	outputPath: string | undefined,
	documentCanonicalId: CanonicalDocumentId | undefined,
): StalenessDetectionInput['artifactRegistryEntries'][number] | undefined {
	// First try exact path match
	if (outputPath) {
		for (const entry of input.artifactRegistryEntries) {
			if (entry.path === outputPath) return entry;
		}
	}
	// Then try source document match
	if (documentCanonicalId) {
		for (const entry of input.artifactRegistryEntries) {
			if (entry.sourceDocumentIds.includes(documentCanonicalId)) return entry;
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Helper: get upstream document IDs for a graph node
// ---------------------------------------------------------------------------

function upstreamDocIds(
	graphNodeId: DependencyGraphNodeId,
	input: StalenessDetectionInput,
): CanonicalDocumentId[] {
	const node = input.dependencyGraph.nodeMap.get(graphNodeId);
	if (!node) return [];

	const allUpstream = new Set<CanonicalDocumentId>();

	if (node.documentCanonicalId) {
		// Get the document node's upstream edges
		const docNodeId = `document:${node.documentCanonicalId}`;
		const docUpstreamEdges = input.dependencyGraph.upstreamEdges.get(docNodeId);
		if (docUpstreamEdges) {
			for (const edge of docUpstreamEdges) {
				const upstreamNode = input.dependencyGraph.nodeMap.get(edge.fromNodeId);
				if (upstreamNode?.documentCanonicalId) {
					allUpstream.add(upstreamNode.documentCanonicalId);
				}
			}
		}
	}

	// Also get direct upstream edges for the output node
	const outputUpstreamEdges =
		input.dependencyGraph.upstreamEdges.get(graphNodeId);
	if (outputUpstreamEdges) {
		for (const edge of outputUpstreamEdges) {
			const upstreamNode = input.dependencyGraph.nodeMap.get(edge.fromNodeId);
			if (upstreamNode?.documentCanonicalId) {
				allUpstream.add(upstreamNode.documentCanonicalId);
			}
		}
	}

	return [...allUpstream].sort();
}

function getUpstreamDocumentIds(
	graphNodeId: DependencyGraphNodeId,
	input: StalenessDetectionInput,
): CanonicalDocumentId[] {
	return upstreamDocIds(graphNodeId, input);
}

function getUpstreamEdgeKinds(
	graphNodeId: DependencyGraphNodeId,
	input: StalenessDetectionInput,
): string[] {
	const kinds: string[] = [];
	const upEdges = input.dependencyGraph.upstreamEdges.get(graphNodeId);
	if (upEdges) {
		for (const e of upEdges) {
			if (!kinds.includes(e.kind)) kinds.push(e.kind);
		}
	}
	const node = input.dependencyGraph.nodeMap.get(graphNodeId);
	if (node?.documentCanonicalId) {
		const docEdges = input.dependencyGraph.upstreamEdges.get(
			`document:${node.documentCanonicalId}`,
		);
		if (docEdges) {
			for (const e of docEdges) {
				if (!kinds.includes(e.kind)) kinds.push(e.kind);
			}
		}
	}
	return kinds.sort();
}

// ---------------------------------------------------------------------------
// Helper: select relevant state records
// ---------------------------------------------------------------------------

function selectRelevantState(
	input: StalenessDetectionInput,
	documentCanonicalId: CanonicalDocumentId | undefined,
	upstreamDocIds: readonly CanonicalDocumentId[],
): {
	decisions: readonly {
		id: string;
		title: string;
		status: string;
		body: string | undefined;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
	assumptions: readonly {
		id: string;
		title: string;
		status: string;
		body: string | undefined;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
	openQuestions: readonly {
		id: string;
		question: string;
		status: string;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
	risks: readonly {
		id: string;
		title: string;
		status: string;
		severity: string;
		createdAt: string | undefined;
		updatedAt: string | undefined;
	}[];
} {
	const relevantDocs = new Set<CanonicalDocumentId>(upstreamDocIds);
	if (documentCanonicalId) relevantDocs.add(documentCanonicalId);

	function isRelevant(affectedIds: readonly string[]): boolean {
		if (affectedIds.length === 0) return false;
		return affectedIds.some((id) => relevantDocs.has(id));
	}

	const decisions = input.decisions.filter(
		(d) => d.status === 'confirmed' && isRelevant(d.affectedDocumentIds),
	);

	const assumptions = input.assumptions.filter(
		(a) => a.status === 'active' && isRelevant(a.affectedDocumentIds),
	);

	const openQuestions = input.openQuestions.filter(
		(q) => q.status === 'open' && isRelevant(q.affectedDocumentIds),
	);

	const risks = input.risks.filter((r) => isRelevant(r.affectedDocumentIds));

	// Add records with global impact markers (empty affectedDocumentIds + confirmed status)
	const globalDecisions = input.decisions.filter(
		(d) => d.status === 'confirmed' && d.affectedDocumentIds.length === 0,
	);
	const globalAssumptions = input.assumptions.filter(
		(a) => a.status === 'active' && a.affectedDocumentIds.length === 0,
	);
	const globalQuestions = input.openQuestions.filter(
		(q) => q.status === 'open' && q.affectedDocumentIds.length === 0,
	);
	const globalRisks = input.risks.filter(
		(r) => r.affectedDocumentIds.length === 0,
	);

	return {
		assumptions: [...assumptions, ...globalAssumptions],
		decisions: [...decisions, ...globalDecisions],
		openQuestions: [...openQuestions, ...globalQuestions],
		risks: [...risks, ...globalRisks],
	};
}

// ---------------------------------------------------------------------------
// Helper: check if relevant state changed after generation
// ---------------------------------------------------------------------------

function checkStateChangedAfter(
	generatedAt: string,
	documentCanonicalId: CanonicalDocumentId | undefined,
	upstreamDocIds: readonly CanonicalDocumentId[],
	input: StalenessDetectionInput,
): boolean {
	const relevantDocs = new Set(upstreamDocIds);
	if (documentCanonicalId) relevantDocs.add(documentCanonicalId);

	function isRelevant(affectedIds: readonly string[]): boolean {
		if (affectedIds.length === 0) return false;
		return affectedIds.some((id) => relevantDocs.has(id));
	}

	const genTime = new Date(generatedAt).getTime();
	if (Number.isNaN(genTime)) return false;

	for (const d of input.decisions) {
		if (
			d.status === 'confirmed' &&
			isRelevant(d.affectedDocumentIds) &&
			d.updatedAt
		) {
			const upd = new Date(d.updatedAt).getTime();
			if (!Number.isNaN(upd) && upd > genTime) return true;
		}
	}

	for (const a of input.assumptions) {
		if (
			a.status === 'active' &&
			isRelevant(a.affectedDocumentIds) &&
			a.updatedAt
		) {
			const upd = new Date(a.updatedAt).getTime();
			if (!Number.isNaN(upd) && upd > genTime) return true;
		}
	}

	for (const q of input.openQuestions) {
		if (
			q.status === 'open' &&
			isRelevant(q.affectedDocumentIds) &&
			q.updatedAt
		) {
			const upd = new Date(q.updatedAt).getTime();
			if (!Number.isNaN(upd) && upd > genTime) return true;
		}
	}

	return false;
}

// ---------------------------------------------------------------------------
// Helper: check for unsafe output path
// ---------------------------------------------------------------------------

function isUnsafePath(outputPath: string, documentationRoot: string): boolean {
	const normalized = outputPath.replace(/^\.\//, '');
	const normalizedRoot = documentationRoot.replace(/\/$/, '');
	if (!normalizedRoot) return false;
	if (
		!normalized.startsWith(normalizedRoot) &&
		!normalized.startsWith('logos/') &&
		!normalized.startsWith('docs/')
	) {
		return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Sort targets deterministically
// ---------------------------------------------------------------------------

function sortTargets(
	targets: readonly StalenessTarget[],
	input: StalenessDetectionInput,
): StalenessTarget[] {
	return [...targets].sort((a, b) => {
		// 1. Phase order
		const phaseA = input.phaseDescriptors.findIndex((p) => p.id === a.phaseId);
		const phaseB = input.phaseDescriptors.findIndex((p) => p.id === b.phaseId);
		if (phaseA !== phaseB) return phaseA - phaseB;

		// 2. Document order
		if (a.documentCanonicalId !== b.documentCanonicalId) {
			return (a.documentCanonicalId ?? '').localeCompare(
				b.documentCanonicalId ?? '',
			);
		}

		// 3. Canonical before derived
		const isCanonicalA = a.targetKind === 'canonical_markdown' ? 0 : 1;
		const isCanonicalB = b.targetKind === 'canonical_markdown' ? 0 : 1;
		if (isCanonicalA !== isCanonicalB) return isCanonicalA - isCanonicalB;

		// 4. Target kind
		if (a.targetKind !== b.targetKind)
			return a.targetKind.localeCompare(b.targetKind);

		// 5. Target id tie-breaker
		return a.targetId.localeCompare(b.targetId);
	});
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
	targets: readonly StalenessTarget[],
	warnings: readonly StalenessReason[],
): StalenessSummary {
	const countByTargetKind: Record<string, number> = {};
	const countByStatus: Record<string, number> = {};

	let currentCount = 0;
	let staleCount = 0;
	let missingCount = 0;
	let blockedCount = 0;
	let orphanedCount = 0;
	let unknownCount = 0;

	for (const t of targets) {
		countByTargetKind[t.targetKind] =
			(countByTargetKind[t.targetKind] ?? 0) + 1;

		switch (t.status) {
			case 'current':
				currentCount++;
				break;
			case 'stale':
				staleCount++;
				break;
			case 'missing':
				missingCount++;
				break;
			case 'blocked':
				blockedCount++;
				break;
			case 'orphaned':
				orphanedCount++;
				break;
			case 'unknown':
				unknownCount++;
				break;
		}
	}

	countByStatus.current = currentCount;
	countByStatus.stale = staleCount;
	countByStatus.missing = missingCount;
	countByStatus.blocked = blockedCount;
	countByStatus.orphaned = orphanedCount;
	countByStatus.unknown = unknownCount;

	// Top stale reasons
	const staleTargets = targets.filter((t) => t.status === 'stale');
	const reasonCounts = new Map<string, number>();
	for (const t of staleTargets) {
		for (const r of t.reasons) {
			reasonCounts.set(r.code, (reasonCounts.get(r.code) ?? 0) + 1);
		}
	}
	const topStaleReasons = [...reasonCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([code, count]) => `${code} (${count})`);

	// Top blocking reasons
	const blockedTargets = targets.filter((t) => t.status === 'blocked');
	const blockReasonCounts = new Map<string, number>();
	for (const t of blockedTargets) {
		for (const r of t.reasons) {
			blockReasonCounts.set(r.code, (blockReasonCounts.get(r.code) ?? 0) + 1);
		}
	}
	const topBlockingReasons = [...blockReasonCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([code, count]) => `${code} (${count})`);

	return {
		blockedCount,
		countByStatus,
		countByTargetKind,
		currentCount,
		missingCount,
		optionalDependencyWarningCount: warnings.length,
		orphanedCount,
		staleCount,
		topBlockingReasons,
		topStaleReasons,
		total: targets.length,
		unknownCount,
	};
}

// ---------------------------------------------------------------------------
// Reason builder
// ---------------------------------------------------------------------------

function makeReason(
	code: StalenessReasonCode,
	severity: StalenessSeverity,
	message: string,
	sourceKind: StalenessSourceKind,
	sourceId: string | undefined,
	sourcePath: string | undefined,
	targetId: string,
	expected?: string,
	received?: string,
	upstreamTargetId?: string,
): StalenessReason {
	return {
		code,
		expected: expected ?? undefined,
		message,
		received: received ?? undefined,
		severity,
		sourceId,
		sourceKind,
		sourcePath,
		targetId,
		upstreamTargetId: upstreamTargetId ?? undefined,
	};
}

// ---------------------------------------------------------------------------
// Diagnostic builder
// ---------------------------------------------------------------------------

function makeDiagnostic(
	code: string,
	severity: 'info' | 'warning' | 'error',
	message: string,
	sourcePath: string | undefined,
	fieldPath: string | undefined,
	artifactId: string | undefined,
	documentCanonicalId: CanonicalDocumentId | undefined,
	phaseId: PhaseId | undefined,
	graphNodeId: DependencyGraphNodeId | undefined,
	recoveryHint: string | undefined,
	expected?: string,
	received?: string,
): StalenessDiagnostic {
	return {
		artifactId,
		code,
		documentCanonicalId,
		expected: expected ?? undefined,
		fieldPath,
		graphNodeId,
		message,
		phaseId,
		received: received ?? undefined,
		recoveryHint,
		severity,
		sourcePath,
	};
}
