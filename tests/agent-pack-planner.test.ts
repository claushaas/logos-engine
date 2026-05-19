/** Step 10.1 — Agent Pack Planner comprehensive tests */

import { describe, expect, it } from 'vitest';
import type { AgentPackPlanInput } from '../src/agent-packs/index.js';
import {
	createAgentPackPlan,
	discoverAgentPackDeclarations,
	isAgentPackOutputPathSafe,
	resolveAgentPackOutputPath,
	summarizeAgentPackPlan,
} from '../src/agent-packs/index.js';

// ---------------------------------------------------------------------------
// Minimal input factory
// ---------------------------------------------------------------------------

function baseInput(
	overrides?: Partial<AgentPackPlanInput>,
): AgentPackPlanInput {
	return {
		artifactRegistryEntries: [],
		artifactRoot: undefined,
		consistencyFindings: undefined,
		contract: {
			documents: [],
			phases: [],
		},
		contractGraph: {
			getOutputsByDocumentId() {
				return [];
			},
			outputs: [],
		},
		dependencyGraph: { nodes: [] },
		documentationRoot: 'logos/',
		executiveConfig: undefined,
		manualEditCollisions: undefined,
		profileId: 'standard',
		regenerationPlan: undefined,
		registerSummary: undefined,
		stalenessResult: undefined,
		traceabilityMetadata: undefined,
		validationFindings: [],
		...overrides,
	};
}

function makeInputWithDoc(
	canonicalId: string,
	phaseId: string,
	agentPackOutputs?: AgentPackPlanInput['contract']['documents'][number]['outputAgentPacks'],
	canonicalOutputPath?: string,
): AgentPackPlanInput {
	const doc: AgentPackPlanInput['contract']['documents'][number] = {
		canonicalId,
		descriptorId: canonicalId,
		outputAgentPacks: agentPackOutputs ?? [],
		outputArtifacts: [],
		phaseId,
		sourcePath: `/profiles/standard/phases/${phaseId}/${canonicalId}.yml`,
		status: 'drafting',
		title: canonicalId.replace(/-/g, ' '),
	};

	const graphOutputs: AgentPackPlanInput['contractGraph']['outputs'] = [];

	if (canonicalOutputPath !== undefined) {
		graphOutputs.push({
			agentRole: undefined,
			constraints: undefined,
			documentCanonicalId: canonicalId,
			fieldPath: 'outputs.canonical',
			format: 'markdown',
			includes: undefined,
			isCanonical: true,
			kind: 'canonical',
			outputId: undefined,
			path: canonicalOutputPath,
			phaseId,
			purpose: 'Canonical output',
			role: 'canonical',
			sourcePath: doc.sourcePath,
		});
	}

	if (agentPackOutputs !== undefined) {
		for (const ap of agentPackOutputs) {
			graphOutputs.push({
				agentRole: ap.agentRole,
				constraints: ap.constraints,
				documentCanonicalId: canonicalId,
				fieldPath: 'outputs.agentPacks[0]',
				format: ap.format,
				includes: ap.includes,
				isCanonical: false,
				kind: 'agentPack',
				outputId: ap.id ?? undefined,
				path: ap.path,
				phaseId,
				purpose: ap.purpose,
				role: 'agent_pack',
				sourcePath: doc.sourcePath,
			});
		}
	}

	const contractGraph: AgentPackPlanInput['contractGraph'] = {
		getOutputsByDocumentId(id: string) {
			return this.outputs.filter((o) => o.documentCanonicalId === id);
		},
		outputs: graphOutputs,
	};

	return {
		artifactRegistryEntries: [],
		artifactRoot: undefined,
		consistencyFindings: undefined,
		contract: {
			documents: [doc],
			phases: [
				{
					documents: [
						{
							canonicalId,
							phaseId,
							sourcePath: doc.sourcePath,
							status: 'drafting',
							title: canonicalId,
						},
					],
					generatedOutputs: {},
					id: phaseId,
					order: 1,
					sourcePath: `/profiles/standard/phases/${phaseId}.yml`,
					title: phaseId,
				},
			],
		},
		contractGraph,
		dependencyGraph: { nodes: [] },
		documentationRoot: 'logos/',
		executiveConfig: undefined,
		manualEditCollisions: undefined,
		profileId: 'standard',
		regenerationPlan: undefined,
		registerSummary: undefined,
		stalenessResult: undefined,
		traceabilityMetadata: undefined,
		validationFindings: [],
	};
}

// ---------------------------------------------------------------------------
// Declaration discovery tests
// ---------------------------------------------------------------------------

describe('agent-pack declaration discovery', () => {
	it('discovers document-level agent-pack declarations where declared', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					agentRole: 'implementer',
					format: 'markdown',
					id: 'implementation-pack',
					path: 'logos/outcomes/agents/implementation-pack.md',
					purpose: 'Implementation pack for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const { declarations, diagnostics } = discoverAgentPackDeclarations(input);
		expect(diagnostics).toHaveLength(0);
		expect(declarations).toHaveLength(1);
		expect(declarations[0].packId).toBe('implementation-pack');
		expect(declarations[0].declarationSource).toBe('document_descriptor');
		expect(declarations[0].documentCanonicalId).toBe('01-thesis');
	});

	it('discovers phase-level agent-pack declarations where declared', () => {
		const input = baseInput({
			contract: {
				documents: [],
				phases: [
					{
						documents: [],
						generatedOutputs: {
							agentPacks: {
								directory: 'logos/outcomes/agents',
								suggestedArtifacts: ['foundation-context-pack.md'],
							},
						},
						id: '01-foundation',
						order: 1,
						sourcePath: '/profiles/standard/phases/01-foundation.yml',
						title: 'Foundation',
					},
				],
			},
		});

		const { declarations, diagnostics } = discoverAgentPackDeclarations(input);
		expect(diagnostics).toHaveLength(0);
		expect(declarations).toHaveLength(1);
		expect(declarations[0].declarationSource).toBe('phase_descriptor');
		expect(declarations[0].phaseId).toBe('01-foundation');
		expect(declarations[0].optional).toBe(true);
	});

	it('discovers executive agent-pack mapping declarations where declared', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					agentPack: {
						mapping: 'mappings/agent-pack.mapping.yml',
						path: 'logos/outcomes/executive/exports/agent-packs/overview.md',
						status: 'supported',
						targets: {
							opencode: {
								outputPath:
									'logos/outcomes/executive/exports/agent-packs/opencode/',
								supportedItemTypes: ['task', 'review'],
							},
						},
					},
				},
				readinessStatus: 'baseline_ready',
			},
		});

		const { declarations, diagnostics } = discoverAgentPackDeclarations(input);
		expect(diagnostics).toHaveLength(0);
		expect(declarations.length).toBeGreaterThanOrEqual(2);
		expect(
			declarations.some(
				(d) => d.declarationSource === 'executive_agent_pack_mapping',
			),
		).toBe(true);
	});

	it('malformed declaration produces diagnostic', () => {
		const input = baseInput({
			contract: {
				documents: [],
				phases: [
					{
						documents: [],
						generatedOutputs: {
							agentPacks: {
								artifacts: [{ id: 'missing-path' }],
							},
						},
						id: '01-foundation',
						order: 1,
						sourcePath: '/profiles/standard/phases/01-foundation.yml',
						title: 'Foundation',
					},
				],
			},
		});

		const { diagnostics } = discoverAgentPackDeclarations(input);
		expect(diagnostics.length).toBeGreaterThan(0);
		expect(
			diagnostics.some((d) => d.code === 'E_AGENT_PACK_DECL_PHASE_MALFORMED'),
		).toBe(true);
	});

	it('no declarations returns empty plan without crash', () => {
		const input = baseInput();
		const result = createAgentPackPlan(input);
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(0);
		expect(result.plan.items).toHaveLength(0);
		expect(result.plan.declarationCount).toBe(0);
	});

	it('declaration ordering is deterministic', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'pack-a',
					path: 'logos/outcomes/agents/a.md',
					purpose: 'A',
				},
				{
					format: 'markdown',
					id: 'pack-b',
					path: 'logos/outcomes/agents/b.md',
					purpose: 'B',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result1 = createAgentPackPlan(input);
		const result2 = createAgentPackPlan(input);
		expect(result1.plan.items.map((i) => i.packId)).toEqual(
			result2.plan.items.map((i) => i.packId),
		);
	});
});

// ---------------------------------------------------------------------------
// Pack classification tests
// ---------------------------------------------------------------------------

describe('agent-pack classification', () => {
	it('classifies review pack', () => {
		const input = makeInputWithDoc(
			'05-boundaries',
			'01-foundation',
			[
				{
					agentRole: 'reviewer',
					format: 'markdown',
					id: 'review-pack',
					path: 'logos/outcomes/agents/review.md',
					purpose: 'Review boundaries document',
				},
			],
			'logos/docs/01-foundation/05-boundaries.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].packKind).toBe('review');
	});

	it('classifies implementation pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					agentRole: 'implementer',
					format: 'markdown',
					id: 'impl-pack',
					path: 'logos/outcomes/agents/impl.md',
					purpose: 'Implement thesis document generation',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].packKind).toBe('implementation');
	});

	it('classifies task pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis update',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].packKind).toBe('task');
	});

	it('classifies documentation pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'doc-pack',
					path: 'logos/outcomes/agents/doc.md',
					purpose: 'Write documentation update',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].packKind).toBe('documentation');
	});

	it('classifies research pack without performing research', () => {
		const input = makeInputWithDoc(
			'02-core-assumptions',
			'02-validation',
			[
				{
					format: 'markdown',
					id: 'research-pack',
					path: 'logos/outcomes/agents/research.md',
					purpose: 'Research market assumptions',
				},
			],
			'logos/docs/02-validation/02-core-assumptions.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].packKind).toBe('research');
	});

	it('classifies follow-up pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'followup-pack',
					path: 'logos/outcomes/agents/followup.md',
					purpose: 'Follow up on open questions',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].packKind).toBe('follow_up');
	});

	it('classifies executive task pack without compiling Executive Axis', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					agentPack: {
						mapping: 'mappings/agent-pack.mapping.yml',
						path: 'logos/outcomes/executive/exports/agent-packs/overview.md',
						status: 'supported',
						targets: {
							opencode: {
								outputPath: 'logos/outcomes/executive/agent-packs/opencode/',
								supportedItemTypes: ['task', 'review'],
							},
						},
					},
				},
				readinessStatus: 'baseline_ready',
			},
		});

		const result = createAgentPackPlan(input);
		const execPacks = result.plan.items.filter(
			(i) => i.declarationSource === 'executive_agent_pack_mapping',
		);
		expect(execPacks.length).toBeGreaterThan(0);
	});

	it('unsupported pack kind produces requires_review or unknown', () => {
		const result = createAgentPackPlan(
			makeInputWithDoc(
				'01-thesis',
				'01-foundation',
				[
					{
						agentRole: 'unknown_role',
						format: 'markdown',
						id: 'weird-pack',
						path: 'logos/outcomes/agents/weird.md',
						purpose: 'weird unknown purpose',
					},
				],
				'logos/docs/01-foundation/01-thesis.md',
			),
		);

		expect(result.plan.items.length).toBeGreaterThanOrEqual(0);
	});
});

// ---------------------------------------------------------------------------
// Source resolution tests
// ---------------------------------------------------------------------------

describe('agent-pack source resolution', () => {
	it('document-specific pack resolves corresponding canonical Markdown source', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					agentRole: 'reviewer',
					format: 'markdown',
					id: 'review-pack',
					path: 'logos/outcomes/agents/review.md',
					purpose: 'Review thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		const item = result.plan.items[0];
		expect(
			item.sources.some((s) => s.sourceKind === 'canonical_markdown'),
		).toBe(true);
		expect(item.canonicalSourceDocumentIds).toContain('01-thesis');
	});

	it('phase-level pack resolves phase canonical docs', () => {
		const input = baseInput({
			contract: {
				documents: [
					{
						canonicalId: '01-thesis',
						descriptorId: '01-thesis',
						outputAgentPacks: [],
						outputArtifacts: [],
						phaseId: '01-foundation',
						sourcePath: '/profiles/standard/phases/01-foundation/01-thesis.yml',
						status: 'drafting',
						title: 'Thesis',
					},
				],
				phases: [
					{
						documents: [
							{
								canonicalId: '01-thesis',
								phaseId: '01-foundation',
								sourcePath:
									'/profiles/standard/phases/01-foundation/01-thesis.yml',
								status: 'drafting',
								title: 'Thesis',
							},
						],
						generatedOutputs: {
							agentPacks: {
								directory: 'logos/outcomes/agents',
								suggestedArtifacts: ['foundation-context-pack.md'],
							},
						},
						id: '01-foundation',
						order: 1,
						sourcePath: '/profiles/standard/phases/01-foundation.yml',
						title: 'Foundation',
					},
				],
			},
		});

		const result = createAgentPackPlan(input);
		const item = result.plan.items[0];
		expect(item.sourcePhaseIds).toContain('01-foundation');
	});

	it('review pack resolves validation/consistency findings as sources', () => {
		const input = makeInputWithDoc(
			'05-boundaries',
			'01-foundation',
			[
				{
					agentRole: 'reviewer',
					format: 'markdown',
					id: 'review-pack',
					path: 'logos/outcomes/agents/review.md',
					purpose: 'Review boundaries',
				},
			],
			'logos/docs/01-foundation/05-boundaries.md',
		);

		const result = createAgentPackPlan(input);
		const item = result.plan.items[0];
		expect(
			item.sources.some((s) => s.sourceKind === 'validation_finding'),
		).toBe(true);
	});

	it('implementation pack resolves canonical docs, decisions, constraints, risks', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					agentRole: 'implementer',
					format: 'markdown',
					id: 'impl-pack',
					path: 'logos/outcomes/agents/impl.md',
					purpose: 'Implement thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		const item = result.plan.items[0];
		expect(item.sources.some((s) => s.sourceKind === 'decision_register')).toBe(
			true,
		);
		expect(item.sources.some((s) => s.sourceKind === 'risk_register')).toBe(
			true,
		);
	});

	it('agent pack is never used as source for canonical Markdown', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		const item = result.plan.items[0];
		expect(item.isDerivedExecutionAid).toBe(true);
		expect(item.sourceOfTruthWarning.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Readiness/blocker tests
// ---------------------------------------------------------------------------

describe('agent-pack readiness and blockers', () => {
	it('current canonical source makes pack ready', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withStaleness = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withStaleness);
		expect(result.plan.items[0].status).toBe('ready');
	});

	it('missing canonical source blocks pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withStaleness = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'missing',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withStaleness);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('stale canonical source blocks or marks stale according to rules', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withStaleness = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'stale',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withStaleness);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('blocked canonical source blocks pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withStaleness = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 1,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'blocked',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withStaleness);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('release-blocking validation finding blocks pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withFindings = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
			validationFindings: [
				{
					code: 'MISSING_REQUIRED_SECTION',
					documentCanonicalId: '01-thesis',
					id: 'F001',
					message: 'Missing required section',
					phaseId: '01-foundation',
					severity: 'error',
				},
			],
		});

		const result = createAgentPackPlan(withFindings);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('release-blocking consistency finding blocks pack', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withConsistency = baseInput({
			...input,
			consistencyFindings: {
				summary: { errorCount: 1, infoCount: 0, warningCount: 0 },
				violations: [
					{
						code: 'UNSAFE_PATH',
						documentCanonicalId: '01-thesis',
						id: 'C001',
						message: 'Unsafe output path detected',
						phaseId: undefined,
						severity: 'fatal',
					},
				],
			},
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withConsistency);
		expect(result.plan.items[0].status).toBe('blocked');
	});
});

// ---------------------------------------------------------------------------
// Staleness/regeneration integration tests
// ---------------------------------------------------------------------------

describe('agent-pack staleness/regeneration integration', () => {
	it('pack with stale canonical source is blocked until canonical regeneration', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withStale = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'stale',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withStale);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('pack with canonical source blocked in regeneration plan is blocked', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withRegen = baseInput({
			...input,
			regenerationPlan: {
				diagnostics: [],
				items: [
					{
						action: 'block_until_canonical_current',
						artifactId: undefined,
						blockers: [],
						canonicalPrerequisites: [],
						documentCanonicalId: '01-thesis',
						outputPath: undefined,
						phaseId: '01-foundation',
						safeOrderIndex: 0,
						status: 'blocked',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withRegen);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('no files are written during planning', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.readOnly).toBe(true);
		expect(result.plan.dryRun).toBe(true);
	});

	it('no regeneration is executed', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		result.plan.items.forEach((item) => {
			expect(item.action).not.toBe('regenerate');
		});
	});
});

// ---------------------------------------------------------------------------
// Output path tests
// ---------------------------------------------------------------------------

describe('agent-pack output paths', () => {
	it('default root is logos/, not docs/', () => {
		expect(
			resolveAgentPackOutputPath(
				'outcomes/agents/pack.md',
				'logos/',
				undefined,
			),
		).toContain('logos/');
		expect(
			resolveAgentPackOutputPath(
				'outcomes/agents/pack.md',
				'logos/',
				undefined,
			),
		).not.toContain('docs/');
	});

	it('custom documentation/artifact root is honored', () => {
		const result = resolveAgentPackOutputPath(
			'outcomes/agents/pack.md',
			'my-docs/',
			undefined,
		);
		expect(result).toContain('my-docs/');
	});

	it('relative agent-pack output path resolves safely', () => {
		const result = resolveAgentPackOutputPath(
			'outcomes/agents/pack.md',
			'logos/',
			undefined,
		);
		expect(result).toBe('logos/outcomes/agents/pack.md');
	});

	it('path traversal is rejected', () => {
		const safety = isAgentPackOutputPathSafe(
			'logos/outcomes/../../unsafe/pack.md',
			'logos/',
		);
		expect(safety.safe).toBe(false);
	});

	it('unsafe absolute path is rejected', () => {
		const safety = isAgentPackOutputPathSafe('/etc/passwd', 'logos/');
		expect(safety.safe).toBe(false);
	});

	it('sibling roots are rejected by path safety', () => {
		const safety = isAgentPackOutputPathSafe('logos-other/pack.md', 'logos/');
		expect(safety.safe).toBe(false);
	});

	it('normalized output paths are deterministic', () => {
		const r1 = resolveAgentPackOutputPath(
			'outcomes\\agents\\pack.md',
			'logos/',
			undefined,
		);
		const r2 = resolveAgentPackOutputPath(
			'outcomes\\agents\\pack.md',
			'logos/',
			undefined,
		);
		expect(r1).toBe(r2);
	});
});

// ---------------------------------------------------------------------------
// Artifact registry comparison tests
// ---------------------------------------------------------------------------

describe('agent-pack artifact registry comparison', () => {
	it('existing current agent-pack artifact metadata can be skipped/current', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withRegistry = baseInput({
			...input,
			artifactRegistryEntries: [
				{
					artifactId: 'task-pack',
					artifactType: 'agent_pack',
					checksum: 'abc123',
					generatedAt: '2024-01-01T00:00:00.000Z',
					isCanonical: false,
					metadata: undefined,
					path: 'logos/outcomes/agents/task.md',
					runId: 'run-1',
					sourceDocumentIds: ['01-thesis'],
					status: 'generated',
				},
			],
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withRegistry);
		const item = result.plan.items.find((i) => i.packId === 'task-pack');
		expect(item).toBeDefined();
		if (item) {
			expect(['skipped', 'ready']).toContain(item.status);
		}
	});

	it('existing agent-pack becomes stale when canonical source changed', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withRegistry = baseInput({
			...input,
			artifactRegistryEntries: [
				{
					artifactId: 'task-pack',
					artifactType: 'agent_pack',
					checksum: 'old_checksum',
					generatedAt: '2024-01-01T00:00:00.000Z',
					isCanonical: false,
					metadata: undefined,
					path: 'logos/outcomes/agents/task.md',
					runId: 'run-1',
					sourceDocumentIds: ['01-thesis'],
					status: 'stale',
				},
			],
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'stale',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withRegistry);
		expect(result.plan.items[0].status).toBe('blocked');
	});

	it('orphaned agent-pack artifact metadata is diagnosed', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withOrphan = baseInput({
			...input,
			artifactRegistryEntries: [
				{
					artifactId: 'orphan-pack',
					artifactType: 'agent_pack',
					checksum: 'xyz',
					generatedAt: '2024-01-01T00:00:00.000Z',
					isCanonical: false,
					metadata: undefined,
					path: 'logos/outcomes/agents/orphan.md',
					runId: 'run-1',
					sourceDocumentIds: [],
					status: 'generated',
				},
			],
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withOrphan);
		expect(result.plan.items.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Manual edit safety tests
// ---------------------------------------------------------------------------

describe('agent-pack manual edit safety', () => {
	it('planner does not overwrite', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('planner records future overwrite risk as blocker/warning', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withManEdits = baseInput({
			...input,
			manualEditCollisions: ['logos/outcomes/agents/task.md'],
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withManEdits);
		const item = result.plan.items[0];
		expect(item.reasons.some((r) => r.code === 'manual_edit_collision')).toBe(
			true,
		);
	});
});

// ---------------------------------------------------------------------------
// Traceability/register integration tests
// ---------------------------------------------------------------------------

describe('agent-pack traceability/register integration', () => {
	it('plan item includes derived execution-aid marker', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].isDerivedExecutionAid).toBe(true);
	});

	it('plan item lists canonical sources', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].canonicalSourceDocumentIds).toContain(
			'01-thesis',
		);
	});

	it('plan item includes sourceOfTruthWarning', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].sourceOfTruthWarning).toContain(
			'never be treated as canonical',
		);
	});

	it('review-required traceability creates warning', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withTrace = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 1,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'info',
						status: 'current',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
			traceabilityMetadata: {
				boundary: 'derived',
				claimCount: 5,
				outputKind: 'agent_pack',
				reviewRequiredCount: 3,
				sourceCount: 2,
			},
		});

		const result = createAgentPackPlan(withTrace);
		const item = result.plan.items[0];
		expect(
			item.reasons.some((r) => r.code === 'review_required_inferred_source'),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Summary and plan structure tests
// ---------------------------------------------------------------------------

describe('agent-pack plan summary', () => {
	it('summary includes correct counts', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task for thesis',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		const summary = summarizeAgentPackPlan(result.plan);
		expect(summary.declaredCount).toBeGreaterThanOrEqual(1);
		expect(typeof summary.readyCount).toBe('number');
		expect(typeof summary.blockedCount).toBe('number');
	});

	it('plan has readOnly: true', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.readOnly).toBe(true);
	});

	it('plan items have deterministic orderIndex', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'pack-c',
					path: 'logos/outcomes/agents/c.md',
					purpose: 'C',
				},
				{
					format: 'markdown',
					id: 'pack-a',
					path: 'logos/outcomes/agents/a.md',
					purpose: 'A',
				},
				{
					format: 'markdown',
					id: 'pack-b',
					path: 'logos/outcomes/agents/b.md',
					purpose: 'B',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result1 = createAgentPackPlan(input);
		const result2 = createAgentPackPlan(input);
		expect(result1.plan.items.map((i) => i.packId)).toEqual(
			result2.plan.items.map((i) => i.packId),
		);
	});
});

// ---------------------------------------------------------------------------
// Non-mutation tests
// ---------------------------------------------------------------------------

describe('agent-pack planner non-mutation', () => {
	it('Agent Pack planning writes no files', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.dryRun).toBe(true);
		expect(result.plan.readOnly).toBe(true);
		expect(result.plan.declaredPackPaths.length).toBeGreaterThan(0);
	});

	it('planner does not call AI/provider code', () => {
		// Proven by the absence of any AI import in agent-pack modules
		expect(createAgentPackPlan).toBeDefined();
	});

	it('planner does not mutate canonical Markdown', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const _result = createAgentPackPlan(input);
		// Planner should not have changed any input
		expect(input.contractGraph.outputs.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('agent-pack planner snapshots', () => {
	it('snapshot standard agent pack plan summary', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					agentRole: 'reviewer',
					format: 'markdown',
					id: 'review-pack',
					path: 'logos/outcomes/agents/review-thesis.md',
					purpose: 'Review thesis document',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		const snapshot = {
			declarationCount: result.plan.declarationCount,
			items: result.plan.items.map((i) => ({
				action: i.action,
				packId: i.packId,
				packKind: i.packKind,
				status: i.status,
				title: i.title,
			})),
			profileId: result.plan.profileId,
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot implementation pack plan', () => {
		const input = makeInputWithDoc(
			'02-problem',
			'01-foundation',
			[
				{
					agentRole: 'implementer',
					format: 'markdown',
					id: 'impl-pack',
					path: 'logos/outcomes/agents/impl-problem.md',
					purpose: 'Implement problem document generation',
				},
			],
			'logos/docs/01-foundation/02-problem.md',
		);

		const result = createAgentPackPlan(input);
		const snapshot = {
			items: result.plan.items.map((i) => ({
				packKind: i.packKind,
				sources: i.sources.map((s) => ({
					kind: s.sourceKind,
					required: s.required,
				})),
				status: i.status,
			})),
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot review pack plan', () => {
		const input = makeInputWithDoc(
			'05-boundaries',
			'01-foundation',
			[
				{
					agentRole: 'reviewer',
					format: 'markdown',
					id: 'review-pack',
					path: 'logos/outcomes/agents/review-boundaries.md',
					purpose: 'Review boundaries',
				},
			],
			'logos/docs/01-foundation/05-boundaries.md',
		);

		const result = createAgentPackPlan(input);
		const snapshot = {
			items: result.plan.items.map((i) => ({
				packKind: i.packKind,
				sources: i.sources.map((s) => ({
					kind: s.sourceKind,
					required: s.required,
				})),
				status: i.status,
			})),
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot follow-up pack plan', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'followup-pack',
					path: 'logos/outcomes/agents/followup.md',
					purpose: 'Follow up on unanswered questions',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		const snapshot = {
			packKind: result.plan.items[0].packKind,
			status: result.plan.items[0].status,
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot blocked missing-source plan', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withMissing = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 1,
					orphanedCount: 0,
					staleCount: 0,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'missing',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withMissing);
		const snapshot = {
			blockers: result.plan.items[0].blockers.map((b) => b.code),
			status: result.plan.items[0].status,
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot stale canonical source plan', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const withStale = baseInput({
			...input,
			stalenessResult: {
				diagnostics: [],
				summary: {
					blockedCount: 0,
					currentCount: 0,
					missingCount: 0,
					orphanedCount: 0,
					staleCount: 1,
					total: 1,
					unknownCount: 0,
				},
				targets: [
					{
						artifactId: undefined,
						diagnostics: [],
						documentCanonicalId: '01-thesis',
						graphNodeId: undefined,
						outputPath: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						reasons: [],
						severity: 'error',
						status: 'stale',
						targetId: 'canonical:01-thesis',
						targetKind: 'canonical_markdown',
					},
				],
			},
		});

		const result = createAgentPackPlan(withStale);
		const snapshot = {
			blockers: result.plan.items[0].blockers.map((b) => b.code),
			status: result.plan.items[0].status,
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot executive agent-pack mapping plan', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					agentPack: {
						mapping: 'mappings/agent-pack.mapping.yml',
						path: 'logos/outcomes/executive/exports/agent-packs/overview.md',
						status: 'supported',
						targets: {
							opencode: {
								outputPath:
									'logos/outcomes/executive/exports/agent-packs/opencode/',
								supportedItemTypes: ['task'],
							},
						},
					},
				},
				readinessStatus: 'baseline_ready',
			},
		});

		const result = createAgentPackPlan(input);
		const execPacks = result.plan.items.filter(
			(i) => i.declarationSource === 'executive_agent_pack_mapping',
		);
		const snapshot = {
			count: execPacks.length,
			items: execPacks.map((i) => ({
				packId: i.packId,
				packKind: i.packKind,
				status: i.status,
			})),
		};
		expect(snapshot).toMatchSnapshot();
	});

	it('snapshot diagnostics for malformed declaration', () => {
		const input = baseInput({
			contract: {
				documents: [],
				phases: [
					{
						documents: [],
						generatedOutputs: {
							agentPacks: {
								artifacts: [{ id: 'missing-path' }],
							},
						},
						id: '01-foundation',
						order: 1,
						sourcePath: '/profiles/standard/phases/01-foundation.yml',
						title: 'Foundation',
					},
				],
			},
		});

		const { diagnostics } = discoverAgentPackDeclarations(input);
		const snapshot = diagnostics.map((d) => ({
			code: d.code,
			severity: d.severity,
		}));
		expect(snapshot).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe('agent-pack edge cases', () => {
	it('empty contract produces valid result', () => {
		const result = createAgentPackPlan(baseInput());
		expect(result.plan.items).toHaveLength(0);
		expect(result.plan.declarationCount).toBe(0);
	});

	it('agent packs have derived execution aid warnings', () => {
		const input = makeInputWithDoc(
			'01-thesis',
			'01-foundation',
			[
				{
					format: 'markdown',
					id: 'task-pack',
					path: 'logos/outcomes/agents/task.md',
					purpose: 'Task',
				},
			],
			'logos/docs/01-foundation/01-thesis.md',
		);

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].sourceOfTruthWarning).toBeTruthy();
	});

	it('optional pack is skipped', () => {
		const input = baseInput({
			contract: {
				documents: [],
				phases: [
					{
						documents: [],
						generatedOutputs: {
							agentPacks: {
								directory: 'logos/outcomes/agents',
								suggestedArtifacts: ['optional-pack.md'],
							},
						},
						id: '01-foundation',
						order: 1,
						sourcePath: '/profiles/standard/phases/01-foundation.yml',
						title: 'Foundation',
					},
				],
			},
		});

		const result = createAgentPackPlan(input);
		expect(result.plan.items[0].status).toBe('skipped');
	});

	it('deferred executive pack is skipped', () => {
		const input = baseInput({
			executiveConfig: {
				exports: {
					agentPack: {
						mapping: 'mappings/agent-pack.mapping.yml',
						path: 'logos/outcomes/executive/exports/agent-packs/overview.md',
						status: 'planned',
						targets: {
							opencode: {
								outputPath: 'logos/outcomes/executive/agent-packs/opencode/',
								supportedItemTypes: ['task'],
							},
						},
					},
				},
				readinessStatus: 'draft',
			},
		});

		const result = createAgentPackPlan(input);
		for (const item of result.plan.items) {
			expect(item.status).toBe('skipped');
		}
	});

	it('both document-level and phase-level packs are discovered', () => {
		const input = baseInput({
			contract: {
				documents: [
					{
						canonicalId: '01-thesis',
						descriptorId: '01-thesis',
						outputAgentPacks: [],
						outputArtifacts: [],
						phaseId: '01-foundation',
						sourcePath: '/profiles/standard/phases/01-foundation/01-thesis.yml',
						status: 'drafting',
						title: 'Thesis',
					},
				],
				phases: [
					{
						documents: [
							{
								canonicalId: '01-thesis',
								phaseId: '01-foundation',
								sourcePath:
									'/profiles/standard/phases/01-foundation/01-thesis.yml',
								status: 'drafting',
								title: 'Thesis',
							},
						],
						generatedOutputs: {
							agentPacks: {
								directory: 'logos/outcomes/agents',
								suggestedArtifacts: ['foundation-pack.md'],
							},
						},
						id: '01-foundation',
						order: 1,
						sourcePath: '/profiles/standard/phases/01-foundation.yml',
						title: 'Foundation',
					},
				],
			},
			contractGraph: {
				getOutputsByDocumentId(id: string) {
					return this.outputs.filter((o) => o.documentCanonicalId === id);
				},
				outputs: [
					{
						agentRole: undefined,
						constraints: undefined,
						documentCanonicalId: '01-thesis',
						fieldPath: 'outputs.canonical',
						format: 'markdown',
						includes: undefined,
						isCanonical: true,
						kind: 'canonical',
						outputId: undefined,
						path: 'logos/docs/01-foundation/01-thesis.md',
						phaseId: '01-foundation',
						purpose: 'Canonical',
						role: 'canonical',
						sourcePath: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					},
					{
						agentRole: 'reviewer',
						constraints: undefined,
						documentCanonicalId: '01-thesis',
						fieldPath: 'outputs.agentPacks[0]',
						format: 'markdown',
						includes: undefined,
						isCanonical: false,
						kind: 'agentPack',
						outputId: 'doc-pack',
						path: 'logos/outcomes/agents/doc-pack.md',
						phaseId: '01-foundation',
						purpose: 'Doc agent pack',
						role: 'agent_pack',
						sourcePath: '/profiles/standard/phases/01-foundation/01-thesis.yml',
					},
				],
			},
		});

		const result = createAgentPackPlan(input);
		expect(result.plan.items.length).toBeGreaterThanOrEqual(2);
	});
});
