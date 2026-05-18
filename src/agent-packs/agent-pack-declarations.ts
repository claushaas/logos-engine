/** Step 10.1 — Agent Pack Declaration Discovery */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import type {
	AgentPackDeclaration,
	AgentPackDiagnostic,
	AgentPackKind,
	AgentPackPlanInput,
} from './agent-pack-types.js';
import { AGENT_PACK_KIND_ORDER } from './agent-pack-types.js';

// ---------------------------------------------------------------------------
// Pack kind inference
// ---------------------------------------------------------------------------

const HEURISTIC_KIND_MAP: Record<string, AgentPackKind> = {
	analysis: 'research',
	api: 'implementation',
	audit: 'review',
	build: 'implementation',
	check: 'review',
	coding: 'implementation',
	compliance: 'review',
	context: 'documentation',
	custom: 'custom',
	design: 'implementation',
	develop: 'implementation',
	doc: 'documentation',
	documentation: 'documentation',
	experiment: 'research',
	explore: 'research',
	follow_up: 'follow_up',
	followup: 'follow_up',
	gap: 'follow_up',
	implement: 'implementation',
	investigate: 'research',
	learn: 'research',
	maintain: 'task',
	plan: 'task',
	refactor: 'implementation',
	research: 'research',
	review: 'review',
	spec: 'documentation',
	study: 'research',
	task: 'task',
	test: 'implementation',
	validate: 'review',
	verify: 'review',
	write: 'documentation',
};

function wordMatches(text: string, word: string): boolean {
	const lower = text.toLowerCase();
	const idx = lower.indexOf(word.toLowerCase());
	if (idx === -1) return false;
	const before = idx === 0 || /[\s_-]/.test(lower[idx - 1] ?? '');
	const after =
		idx + word.length >= lower.length ||
		/[\s_-]/.test(lower[idx + word.length] ?? '');
	return before && after;
}

function inferPackKind(
	packId: string,
	purpose: string | undefined,
	agentRole: string | undefined,
	templateType: string | undefined,
): AgentPackKind {
	const lower = packId.toLowerCase();
	const purposeLower = (purpose ?? '').toLowerCase();
	const roleLower = (agentRole ?? '').toLowerCase();
	const templateLower = (templateType ?? '').toLowerCase();

	function hasAnyWord(w: string): boolean {
		return (
			wordMatches(packId, w) ||
			wordMatches(purpose ?? '', w) ||
			wordMatches(agentRole ?? '', w) ||
			wordMatches(templateType ?? '', w)
		);
	}

	function hasAnySub(s: string): boolean {
		return (
			lower.includes(s) ||
			purposeLower.includes(s) ||
			roleLower.includes(s) ||
			templateLower.includes(s)
		);
	}

	// Executive task detection
	if (hasAnySub('executive') && (hasAnySub('task') || hasAnySub('export'))) {
		return 'executive_task';
	}
	if (templateType === 'agent_task' || templateType === 'task') {
		if (hasAnySub('executive')) return 'executive_task';
		return 'task';
	}

	// Research detection
	if (
		hasAnyWord('research') ||
		hasAnySub('investigate') ||
		hasAnySub('experiment') ||
		hasAnySub('explore')
	) {
		return 'research';
	}

	// Review detection
	if (
		hasAnyWord('review') ||
		hasAnySub('audit') ||
		hasAnySub('validate') ||
		hasAnySub('verify') ||
		hasAnySub('check')
	) {
		return 'review';
	}

	// Implementation detection
	if (
		hasAnyWord('implement') ||
		hasAnySub('coding') ||
		hasAnySub('build') ||
		hasAnySub('develop') ||
		hasAnySub('refactor')
	) {
		return 'implementation';
	}

	// Task detection
	if (hasAnyWord('task') || hasAnySub('maintain') || hasAnySub('plan')) {
		return 'task';
	}

	// Documentation detection
	if (
		hasAnyWord('doc') ||
		hasAnySub('documentation') ||
		hasAnySub('write') ||
		hasAnySub('spec')
	) {
		return 'documentation';
	}

	// Follow-up detection
	if (
		hasAnyWord('follow_up') ||
		hasAnyWord('followup') ||
		hasAnySub('gap') ||
		hasAnySub('unresolved')
	) {
		return 'follow_up';
	}

	// Heuristic keyword match
	for (const [keyword, kind] of Object.entries(HEURISTIC_KIND_MAP)) {
		if (
			lower.includes(keyword) ||
			purposeLower.includes(keyword) ||
			roleLower.includes(keyword)
		) {
			return kind;
		}
	}

	return 'custom';
}

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

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function pathHasTraversal(p: string): boolean {
	return p.includes('../') || p.includes('..\\');
}

function pathIsUnsafeAbsolute(p: string): boolean {
	const trimmed = p.trim();
	if (trimmed.startsWith('/')) return true;
	if (/^[A-Za-z]:/.test(trimmed)) return true;
	return false;
}

export function resolveAgentPackOutputPath(
	declaredPath: string,
	documentationRoot: string,
	artifactRoot: string | undefined,
): string {
	const baseRoot = artifactRoot ?? documentationRoot.replace(/\/$/, '');
	const normalizedRoot = baseRoot.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	const normalizedPath = declaredPath.replace(/\\/g, '/');

	if (pathIsUnsafeAbsolute(normalizedPath)) return normalizedPath;

	const rootRelativePath = normalizedPath
		.replace(/^\.\/+/, '')
		.replace(/^\/+/, '');

	if (
		rootRelativePath === normalizedRoot ||
		rootRelativePath.startsWith(`${normalizedRoot}/`)
	) {
		return rootRelativePath;
	}

	return `${normalizedRoot}/${rootRelativePath}`;
}

export function isAgentPackOutputPathSafe(
	resolvedPath: string,
	documentationRoot: string,
): { safe: boolean; reason: string | undefined } {
	if (pathHasTraversal(resolvedPath)) {
		return {
			reason: 'Path traversal detected in agent-pack output path',
			safe: false,
		};
	}
	if (pathIsUnsafeAbsolute(resolvedPath)) {
		return {
			reason: 'Unsafe absolute path for agent-pack output',
			safe: false,
		};
	}

	const normalizedRoot = documentationRoot
		.replace(/\\/g, '/')
		.replace(/\/+$/, '');
	const normalizedPath = resolvedPath.replace(/\\/g, '/');

	if (!normalizedPath.startsWith(normalizedRoot)) {
		return {
			reason: `Agent-pack output path "${normalizedPath}" is outside the configured documentation root "${normalizedRoot}"`,
			safe: false,
		};
	}

	return { reason: undefined, safe: true };
}

// ---------------------------------------------------------------------------
// Main declaration discovery
// ---------------------------------------------------------------------------

export interface DiscoverAgentPackDeclarationsResult {
	declarations: AgentPackDeclaration[];
	diagnostics: AgentPackDiagnostic[];
}

/**
 * Discover all agent-pack declarations from:
 *   1. Document descriptor output agentPacks (kind: 'agentPack')
 *   2. Phase-level generatedOutputs.agentPacks declarations
 *   3. Executive agent-pack mapping declarations
 */
export function discoverAgentPackDeclarations(
	input: AgentPackPlanInput,
): DiscoverAgentPackDeclarationsResult {
	const declarations: AgentPackDeclaration[] = [];
	const diagnostics: AgentPackDiagnostic[] = [];
	let orderIndex = 0;

	const {
		contract,
		contractGraph,
		executiveConfig,
		documentationRoot,
		artifactRoot,
	} = input;

	// -------------------------------------------------------------------
	// 1. Document descriptor output agentPacks (kind: 'agentPack')
	// -------------------------------------------------------------------

	const agentPackOutputs = contractGraph.outputs.filter(
		(o) => o.kind === 'agentPack' && !o.isCanonical,
	);

	for (const output of agentPackOutputs) {
		if (output.path === undefined || output.path.length === 0) {
			diagnostics.push(
				createDiagnostic(
					'E_AGENT_PACK_DECL_EMPTY_PATH',
					'error',
					`Agent-pack output declaration has an empty path for document "${output.documentCanonicalId}"`,
					{
						fieldPath: output.fieldPath,
						relatedPhaseId: output.phaseId as PhaseId | undefined,
						relatedSourceDocumentId: output.documentCanonicalId as
							| CanonicalDocumentId
							| undefined,
						sourcePath: output.sourcePath,
					},
				),
			);
			continue;
		}

		const packId =
			output.outputId ??
			`agent_pack_${output.documentCanonicalId}_${String(orderIndex)}`;
		const declaredKind = inferPackKind(
			packId,
			output.purpose,
			output.agentRole,
			undefined,
		);

		if (!Object.hasOwn(AGENT_PACK_KIND_ORDER, declaredKind)) {
			diagnostics.push(
				createDiagnostic(
					'E_AGENT_PACK_DECL_UNSUPPORTED_KIND',
					'warning',
					`Unsupported agent-pack kind "${declaredKind}" for pack "${packId}"`,
					{
						fieldPath: output.fieldPath,
						recoveryHint: 'Pack will be treated as custom',
						relatedPackId: packId,
						relatedPackKind: declaredKind,
						relatedPhaseId: output.phaseId as PhaseId | undefined,
						relatedSourceDocumentId: output.documentCanonicalId as
							| CanonicalDocumentId
							| undefined,
						sourcePath: output.sourcePath,
					},
				),
			);
		}

		const relativeOutputPath = resolveAgentPackOutputPath(
			output.path,
			documentationRoot,
			artifactRoot,
		);

		const pathSafety = isAgentPackOutputPathSafe(
			relativeOutputPath,
			documentationRoot,
		);
		if (!pathSafety.safe) {
			diagnostics.push(
				createDiagnostic(
					'E_AGENT_PACK_DECL_UNSAFE_PATH',
					'error',
					pathSafety.reason ?? 'Unsafe agent-pack output path',
					{
						fieldPath: output.fieldPath,
						recoveryHint:
							'Correct the output path to be within the documentation root',
						relatedPackId: packId,
						relatedPackKind: declaredKind,
						relatedPhaseId: output.phaseId as PhaseId | undefined,
						relatedSourceDocumentId: output.documentCanonicalId as
							| CanonicalDocumentId
							| undefined,
						sourcePath: output.sourcePath,
					},
				),
			);
		}

		const declaration: AgentPackDeclaration = {
			agentRole: output.agentRole,
			constraints: output.constraints,
			declarationSource: 'document_descriptor',
			deferred: false,
			descriptorPath: output.sourcePath,
			descriptorPointer: output.fieldPath,
			documentCanonicalId: output.documentCanonicalId,
			format: output.format,
			includes: output.includes,
			optional: false,
			orderIndex,
			outputPath: output.path,
			packId,
			packKind: declaredKind,
			phaseId: output.phaseId as PhaseId | undefined,
			profilePath: output.sourcePath,
			purpose: output.purpose,
			relativeOutputPath,
			templateType: undefined,
			title: output.purpose ?? declaredKind.replace(/_/g, ' '),
		};

		declarations.push(declaration);
		orderIndex++;
	}

	// -------------------------------------------------------------------
	// 2. Phase-level generatedOutputs with agentPacks
	// -------------------------------------------------------------------

	for (const phase of contract.phases) {
		const genOutputs = phase.generatedOutputs;
		if (genOutputs === undefined || typeof genOutputs !== 'object') continue;

		const agentPacksSection = genOutputs.agentPacks as
			| Record<string, unknown>
			| undefined;
		if (agentPacksSection === undefined) continue;

		// Check for structured declarations (artifacts array)
		const artifacts = agentPacksSection.artifacts as
			| Array<Record<string, unknown>>
			| undefined;
		const suggestedArtifacts = agentPacksSection.suggestedArtifacts as
			| string[]
			| undefined;
		const directory = agentPacksSection.directory as string | undefined;

		if (Array.isArray(artifacts)) {
			for (const artifact of artifacts) {
				const id = typeof artifact.id === 'string' ? artifact.id : undefined;
				const path =
					typeof artifact.path === 'string' ? artifact.path : undefined;
				const purpose =
					typeof artifact.purpose === 'string' ? artifact.purpose : undefined;
				const agentRole =
					typeof artifact.agentRole === 'string'
						? artifact.agentRole
						: undefined;
				const templateType =
					typeof artifact.templateType === 'string'
						? artifact.templateType
						: undefined;

				if (id === undefined || path === undefined) {
					diagnostics.push(
						createDiagnostic(
							'E_AGENT_PACK_DECL_PHASE_MALFORMED',
							'error',
							`Phase-level agent-pack declaration in "${phase.id}" has missing id or path`,
							{
								fieldPath: 'generatedOutputs.agentPacks.artifacts',
								recoveryHint:
									'Each agent-pack declaration must have id and path fields',
								relatedPhaseId: phase.id,
								sourcePath: phase.sourcePath,
							},
						),
					);
					continue;
				}

				const packId = `agent_pack_phase_${phase.id}_${id}`;
				const declaredKind = inferPackKind(
					packId,
					purpose,
					agentRole,
					templateType,
				);

				const relativeOutputPath = resolveAgentPackOutputPath(
					path,
					documentationRoot,
					artifactRoot,
				);

				const pathSafety = isAgentPackOutputPathSafe(
					relativeOutputPath,
					documentationRoot,
				);

				declarations.push({
					agentRole,
					constraints: Array.isArray(artifact.constraints)
						? (artifact.constraints as string[])
						: undefined,
					declarationSource: 'phase_descriptor',
					deferred: artifact.deferred === true || artifact.deferred === 'true',
					descriptorPath: phase.sourcePath,
					descriptorPointer: 'generatedOutputs.agentPacks.artifacts',
					documentCanonicalId: undefined,
					format: 'markdown',
					includes: Array.isArray(artifact.includes)
						? (artifact.includes as string[])
						: undefined,
					optional: artifact.optional === true || artifact.optional === 'true',
					orderIndex,
					outputPath: path,
					packId,
					packKind: declaredKind,
					phaseId: phase.id,
					profilePath: phase.sourcePath,
					purpose,
					relativeOutputPath,
					templateType,
					title: purpose ?? declaredKind.replace(/_/g, ' '),
				});

				if (!pathSafety.safe) {
					diagnostics.push(
						createDiagnostic(
							'E_AGENT_PACK_DECL_UNSAFE_PATH',
							'error',
							pathSafety.reason ?? 'Unsafe agent-pack output path',
							{
								fieldPath: 'generatedOutputs.agentPacks.artifacts',
								recoveryHint: 'Correct the output path',
								relatedPackId: packId,
								relatedPackKind: declaredKind,
								relatedPhaseId: phase.id,
								sourcePath: phase.sourcePath,
							},
						),
					);
				}

				orderIndex++;
			}
		} else if (Array.isArray(suggestedArtifacts) && directory !== undefined) {
			// Suggested artifacts with a directory - generate simple declarations
			for (const suggested of suggestedArtifacts) {
				const packId = `agent_pack_phase_${phase.id}_${suggested.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
				const path = `${directory}/${suggested}`;
				const declaredKind = inferPackKind(
					packId,
					suggested,
					undefined,
					undefined,
				);

				const relativeOutputPath = resolveAgentPackOutputPath(
					path,
					documentationRoot,
					artifactRoot,
				);

				const pathSafety = isAgentPackOutputPathSafe(
					relativeOutputPath,
					documentationRoot,
				);

				declarations.push({
					agentRole: undefined,
					constraints: undefined,
					declarationSource: 'phase_descriptor',
					deferred: false,
					descriptorPath: phase.sourcePath,
					descriptorPointer: 'generatedOutputs.agentPacks.suggestedArtifacts',
					documentCanonicalId: undefined,
					format: 'markdown',
					includes: undefined,
					optional: true,
					orderIndex,
					outputPath: path,
					packId,
					packKind: declaredKind,
					phaseId: phase.id,
					profilePath: phase.sourcePath,
					purpose: suggested,
					relativeOutputPath,
					templateType: undefined,
					title: suggested.replace(/\.md$/, '').replace(/-/g, ' '),
				});

				if (!pathSafety.safe) {
					diagnostics.push(
						createDiagnostic(
							'E_AGENT_PACK_DECL_UNSAFE_PATH',
							'error',
							pathSafety.reason ?? 'Unsafe agent-pack output path',
							{
								fieldPath: 'generatedOutputs.agentPacks.suggestedArtifacts',
								recoveryHint: 'Correct the output path',
								relatedPackId: packId,
								relatedPackKind: declaredKind,
								relatedPhaseId: phase.id,
								sourcePath: phase.sourcePath,
							},
						),
					);
				}

				orderIndex++;
			}
		}
	}

	// -------------------------------------------------------------------
	// 3. Profile output model agentPacks declaration
	// -------------------------------------------------------------------

	// Profile output model agentPacks are already captured via contractGraph.outputs
	// but we also check for profile-level declarations not specific to any document
	const profileAgentPackOutputs = contractGraph.outputs.filter(
		(o) =>
			o.kind === 'agentPack' &&
			!o.isCanonical &&
			o.documentCanonicalId === undefined,
	);

	for (const output of profileAgentPackOutputs) {
		const packId =
			output.outputId ?? `agent_pack_profile_${String(orderIndex)}`;
		const declaredKind = inferPackKind(
			packId,
			output.purpose,
			output.agentRole,
			undefined,
		);

		const relativeOutputPath = resolveAgentPackOutputPath(
			output.path,
			documentationRoot,
			artifactRoot,
		);

		declarations.push({
			agentRole: output.agentRole,
			constraints: output.constraints,
			declarationSource: 'profile_output_model',
			deferred: false,
			descriptorPath: output.sourcePath,
			descriptorPointer: output.fieldPath,
			documentCanonicalId: undefined,
			format: output.format,
			includes: output.includes,
			optional: false,
			orderIndex,
			outputPath: output.path,
			packId,
			packKind: declaredKind,
			phaseId: undefined,
			profilePath: output.sourcePath,
			purpose: output.purpose,
			relativeOutputPath,
			templateType: undefined,
			title: output.purpose ?? declaredKind.replace(/_/g, ' '),
		});

		orderIndex++;
	}

	// -------------------------------------------------------------------
	// 4. Executive agent-pack mapping declarations
	// -------------------------------------------------------------------

	if (executiveConfig?.exports?.agentPack !== undefined) {
		const agentPackConfig = executiveConfig.exports.agentPack;

		// Generate packs for each supported target
		if (agentPackConfig.targets !== undefined) {
			for (const [targetName, targetConfig] of Object.entries(
				agentPackConfig.targets,
			)) {
				for (const itemType of targetConfig.supportedItemTypes) {
					const packId = `executive_agent_pack_${targetName}_${itemType}`;
					const outputPath = `${targetConfig.outputPath}${itemType}-pack.md`;

					// Map item type to pack kind
					const itemKindMap: Record<string, AgentPackKind> = {
						agent_prompt: 'task',
						blocker: 'follow_up',
						bug: 'task',
						decision: 'follow_up',
						doc_update: 'documentation',
						review: 'review',
						risk: 'follow_up',
						spike: 'research',
						task: 'task',
					};
					const declaredKind =
						itemKindMap[itemType] ??
						inferPackKind(packId, itemType, undefined, itemType);

					const relativeOutputPath = resolveAgentPackOutputPath(
						outputPath,
						documentationRoot,
						artifactRoot,
					);

					const pathSafety = isAgentPackOutputPathSafe(
						relativeOutputPath,
						documentationRoot,
					);

					declarations.push({
						agentRole: targetName,
						constraints: undefined,
						declarationSource: 'executive_agent_pack_mapping',
						deferred: agentPackConfig.status === 'planned',
						descriptorPath: undefined,
						descriptorPointer: `executive.exports.agentPack.targets.${targetName}`,
						documentCanonicalId: undefined,
						format: 'markdown',
						includes: [
							'objective',
							'source_normative_documents',
							'required_work',
							'acceptance_criteria',
							'constraints',
							'expected_outputs',
						],
						optional: agentPackConfig.status === 'planned',
						orderIndex,
						outputPath,
						packId,
						packKind: declaredKind,
						phaseId: undefined,
						profilePath: undefined,
						purpose: `Executive ${targetName} ${itemType} pack`,
						relativeOutputPath,
						templateType: itemType,
						title: `${targetName} ${itemType} pack`,
					});

					if (!pathSafety.safe) {
						diagnostics.push(
							createDiagnostic(
								'E_AGENT_PACK_DECL_UNSAFE_PATH',
								'error',
								pathSafety.reason ?? 'Unsafe agent-pack output path',
								{
									fieldPath: 'executive.exports.agentPack',
									recoveryHint: 'Correct the output path',
									relatedPackId: packId,
									relatedPackKind: declaredKind,
								},
							),
						);
					}

					orderIndex++;
				}
			}
		} else {
			// Single agent-pack export target
			const packId = 'executive_agent_pack_overview';
			const path =
				agentPackConfig.path ||
				'logos/outcomes/executive/exports/agent-packs/overview.md';
			const relativeOutputPath = resolveAgentPackOutputPath(
				path,
				documentationRoot,
				artifactRoot,
			);

			const pathSafety = isAgentPackOutputPathSafe(
				relativeOutputPath,
				documentationRoot,
			);

			declarations.push({
				agentRole: undefined,
				constraints: undefined,
				declarationSource: 'executive_agent_pack_mapping',
				deferred: agentPackConfig.status === 'planned',
				descriptorPath: undefined,
				descriptorPointer: 'executive.exports.agentPack',
				documentCanonicalId: undefined,
				format: 'markdown',
				includes: [
					'objective',
					'required_work',
					'acceptance_criteria',
					'constraints',
				],
				optional: agentPackConfig.status === 'planned',
				orderIndex,
				outputPath: path,
				packId,
				packKind: 'executive_task',
				phaseId: undefined,
				profilePath: undefined,
				purpose: 'Executive agent-pack export',
				relativeOutputPath,
				templateType: undefined,
				title: 'Executive Agent Pack',
			});

			if (!pathSafety.safe) {
				diagnostics.push(
					createDiagnostic(
						'E_AGENT_PACK_DECL_UNSAFE_PATH',
						'error',
						pathSafety.reason ?? 'Unsafe agent-pack output path',
						{
							fieldPath: 'executive.exports.agentPack',
							recoveryHint: 'Correct the output path',
							relatedPackId: packId,
							relatedPackKind: 'executive_task',
						},
					),
				);
			}

			orderIndex++;
		}
	}

	return { declarations, diagnostics };
}
